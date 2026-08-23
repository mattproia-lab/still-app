-- 2026-08-23  Promo code attribution + trial extension
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- Additive only: no drops, no type changes, no data rewrites. Every statement
-- is IF NOT EXISTS, so re-running it is a no-op.

-- 1. Attribution for per-parish / per-rep promo codes.
--    Nothing reads these at runtime. They exist so redemptions can be traced
--    back to the rep or parish that handed the code out.
--    Note: promo_codes.type already defaults to 'parish' and means the code's
--    CATEGORY. parish_name is the specific parish. Different things.
alter table public.promo_codes
  add column if not exists rep_name    text,
  add column if not exists rep_email   text,
  add column if not exists parish_name text;

-- 2. Promo benefits recorded on the profile.
--    referral_code        -- first code this user redeemed. Never overwritten.
--    trial_extended_until -- client-side paywall relief until this instant.
--                            Set once; not stackable, never overwritten.
--
--    Deliberately NOT reusing profiles.subscription_end: that column means
--    "paid subscription ends", is written by nothing today, and has never
--    appeared in any commit in this repo. Overloading it would conflate two
--    unrelated ideas. See vault/wiki/app/subscription-paths.md.
alter table public.profiles
  add column if not exists referral_code        text,
  add column if not exists trial_extended_until timestamptz;

-- No index added for attribution reporting: the existing unique constraint
-- promo_redemptions_code_user_id_key is a btree on (code, user_id), whose
-- leading column already serves lookups filtered by code alone.

-- No RLS policy changes. RLS is enabled on all three tables; redeem-code.js
-- reaches them with the service key, which bypasses RLS entirely.
