-- 2026-08-26b  Referral cap -- promo_codes.max_referrals + redeem_promo_code()
--
-- Addendum to 2026-08-26-commission-tracking.sql, and an amendment to
-- 2026-08-23b-redeem-promo-code-rpc.sql. Run it the same way, in the dashboard
-- SQL editor, in one pass.
--
-- The cap bounds how many ACTIVE PREMIUM subscribers a rep may hold at once.
-- It is not promo_codes.uses_remaining, which counts redemptions ever, treats a
-- free redeemer as spent, and is never restored by churn. This one counts only
-- live paying subscribers: a free redeemer never occupies a slot, and a
-- cancellation opens one.

-- 1. The cap itself.
--
--    NULL means uncapped, which is what every existing code becomes -- no code
--    changes behaviour by running this. INTEGER, not smallint: a parish code
--    could plausibly outgrow 32k, and widening a live column later is worse
--    than being generous now.
--
--    Declared per CODE but enforced per REP (section 3), because the count it
--    is compared against spans every code the rep owns. A rep with several
--    codes therefore has several copies of the limit, and the one that applies
--    is whichever code is being redeemed. Keep them equal across a rep's codes
--    unless you specifically want a code that can push past the others.
alter table public.promo_codes
  add column if not exists max_referrals integer;

-- 2. Indexes for the count, which now runs on every single redemption.
--
--    The partial index matches the WHERE clause exactly, so the count reads only
--    live premium rows rather than scanning profiles. The second serves the
--    subselect that resolves a rep's codes.
create index if not exists profiles_referral_code_premium_idx
  on public.profiles (referral_code)
  where subscription_status = 'premium';

create index if not exists promo_codes_rep_email_idx
  on public.promo_codes (rep_email);

-- 3. redeem_promo_code(), amended.
--
--    Reproduced in full because CREATE OR REPLACE replaces the whole body.
--    Everything from 2026-08-23b is unchanged except the block marked CAP.
--
--    ADVISORY LOCK, and why the existing row lock is not enough. The original
--    FOR UPDATE serialises redemptions OF ONE CODE. The cap spans every code a
--    rep owns, so two people redeeming two DIFFERENT codes of the same rep
--    would both read count = max - 1 and both pass. pg_advisory_xact_lock keyed
--    on the rep's email serialises the whole rep for the rest of the
--    transaction, and releases on commit or rollback with no cleanup.
--
--    A code with no rep_email is not capped: "this rep's other codes" has no
--    meaning without a rep, and NULL = NULL would silently match nothing and
--    read as a count of zero -- an uncapped code that looked capped.
--
--    KNOWN LIMIT: this gates REDEMPTION on a count of CURRENTLY PREMIUM
--    subscribers, but a person redeeming is on a free trial and is not premium
--    yet. A rep at 49/50 can take one more redemption and then watch twenty
--    earlier redeemers convert, reaching 69 without breaking any rule. The cap
--    limits who may enter the funnel, not how many end up paying. A hard
--    ceiling on payable subscribers would belong in the reporting path.
create or replace function public.redeem_promo_code(
  p_code text,
  p_user text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo   public.promo_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_active  integer;
begin
  -- Lock this code's row for the rest of the transaction. Concurrent
  -- redemptions of the same code queue here instead of racing.
  select * into v_promo
    from public.promo_codes
   where code = upper(p_code)
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid code');
  end if;

  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Code has expired');
  end if;

  if coalesce(v_promo.uses_remaining, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Code has no uses remaining');
  end if;

  -- CAP -- active premium subscribers already attributed to this rep.
  if v_promo.max_referrals is not null and v_promo.rep_email is not null then
    -- Serialise this rep across all of their codes, not just this one.
    perform pg_advisory_xact_lock(hashtext(lower(v_promo.rep_email)));

    -- Counted through profiles.referral_code, matching how rep_commissions
    -- attributes -- NOT through promo_redemptions, which holds a row per
    -- redemption and would count a two-code redeemer twice.
    select count(*) into v_active
      from public.profiles p
     where p.subscription_status = 'premium'
       and p.referral_code in (select c.code
                                 from public.promo_codes c
                                where lower(c.rep_email) = lower(v_promo.rep_email));

    if v_active >= v_promo.max_referrals then
      return jsonb_build_object('ok', false,
                                'error', 'This code has reached its referral limit');
    end if;
  end if;

  -- The profile must exist before we grant anything to it.
  select * into v_profile from public.profiles where id = p_user::uuid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  -- Claim it. UNIQUE (code, user_id) makes this exactly-once per user, so a
  -- second attempt lands here rather than double-granting.
  begin
    insert into public.promo_redemptions (code, user_id)
         values (upper(p_code), p_user);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Code already redeemed');
  end;

  -- Real arithmetic, under the row lock taken above.
  update public.promo_codes
     set uses_remaining = uses_remaining - 1
   where id = v_promo.id;

  -- First-wins on both fields: coalesce only fills what is still null, so a
  -- second code never overwrites the first and never extends the trial again.
  update public.profiles
     set referral_code        = coalesce(referral_code, upper(p_code)),
         trial_extended_until = coalesce(trial_extended_until, now() + interval '14 days')
   where id = p_user::uuid
   returning * into v_profile;

  return jsonb_build_object(
    'ok',                   true,
    'type',                 v_promo.type,
    'description',          v_promo.description,
    'referral_code',        v_profile.referral_code,
    'trial_extended_until', v_profile.trial_extended_until
  );
end;
$$;

-- 4. Grants, restated. CREATE OR REPLACE keeps the existing ACL, so these are
--    a no-op on an unchanged signature -- included because the 2026-08-23b
--    record shows the service_role grant being lost once already and having to
--    be added by hand after a 403 in production.
revoke all on function public.redeem_promo_code(text, text) from public;
revoke all on function public.redeem_promo_code(text, text) from anon;
revoke all on function public.redeem_promo_code(text, text) from authenticated;
grant execute on function public.redeem_promo_code(text, text) to service_role;
