-- 2026-09-14  STILL2: additive 30-day trial extension
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- What this does:
--   1. Adds extension_days integer to promo_codes (nullable, so existing rows
--      keep the original first-wins/14-day behaviour).
--   2. Replaces redeem_promo_code() with a version that, for codes where
--      extension_days IS NOT NULL, stacks days additively on top of whatever
--      trial_extended_until is already set (or now, if it has passed).
--      Codes without extension_days keep the original COALESCE/first-wins logic.
--   3. Inserts STILL2 with extension_days = 30.
--
-- CREATE OR REPLACE preserves existing grants on the function, so the
-- service_role grant from 2026-08-23 does not need to be re-run.

-- 1. New column
alter table public.promo_codes
  add column if not exists extension_days integer;

-- 2. Updated RPC
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

  select * into v_profile from public.profiles where id = p_user::uuid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  -- Claim it. UNIQUE (code, user_id) makes this exactly-once per user.
  begin
    insert into public.promo_redemptions (code, user_id)
         values (upper(p_code), p_user);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Code already redeemed');
  end;

  update public.promo_codes
     set uses_remaining = uses_remaining - 1
   where id = v_promo.id;

  -- Additive (extension_days set): start from wherever trial_extended_until
  -- currently sits, or now() if it has passed or was never set, then add the
  -- code's days. This stacks on top of any prior extension.
  -- First-wins (extension_days null): original behaviour — 14 days from now,
  -- only if trial_extended_until has never been set on this profile.
  if v_promo.extension_days is not null then
    update public.profiles
       set referral_code        = coalesce(referral_code, upper(p_code)),
           trial_extended_until = greatest(coalesce(trial_extended_until, now()), now())
                                  + (v_promo.extension_days || ' days')::interval
     where id = p_user::uuid
     returning * into v_profile;
  else
    update public.profiles
       set referral_code        = coalesce(referral_code, upper(p_code)),
           trial_extended_until = coalesce(trial_extended_until, now() + interval '14 days')
     where id = p_user::uuid
     returning * into v_profile;
  end if;

  return jsonb_build_object(
    'ok',                   true,
    'type',                 v_promo.type,
    'description',          v_promo.description,
    'referral_code',        v_profile.referral_code,
    'trial_extended_until', v_profile.trial_extended_until
  );
end;
$$;

-- 3. Insert STILL2
insert into public.promo_codes (code, type, description, uses_remaining, extension_days)
values ('STILL2', 'general', '30-day trial extension', 10000, 30)
on conflict (code) do nothing;
