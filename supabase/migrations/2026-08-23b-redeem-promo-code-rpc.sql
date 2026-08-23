-- 2026-08-23b  redeem_promo_code() -- atomic redemption
--
-- Addendum to 2026-08-23-promo-attribution-and-trial-extension.sql. Run it the
-- same way, in the dashboard SQL editor.
--
-- Why an RPC rather than a sequence of PostgREST calls: uses_remaining cannot
-- be decremented atomically over REST. PostgREST can only write a literal, so
-- read-then-write loses updates when several people redeem the same code at
-- once -- which is the normal case here (a code read aloud at a parish, typed
-- by everyone at the same moment). SELECT ... FOR UPDATE serialises them.
--
-- Safe to re-run: CREATE OR REPLACE.

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

-- Only the service key may call this. redeem-code.js is the sole caller.
revoke all on function public.redeem_promo_code(text, text) from public;
revoke all on function public.redeem_promo_code(text, text) from anon;
revoke all on function public.redeem_promo_code(text, text) from authenticated;

-- GRANT added after initial migration. The REVOKE statements above correctly
-- block public/anon/authenticated, but also blocked service_role, which is
-- the role redeem-code.js uses via SUPABASE_SERVICE_KEY. This grant was run
-- manually on 2026-08-23 after a 403 permission denied error in production.
grant execute on function public.redeem_promo_code(text, text) to service_role;
