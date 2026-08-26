-- 2026-08-26  Commission tracking -- platform/plan capture, payouts, rep_commissions
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- Additive only: no drops, no type changes, no data rewrites. Every statement
-- is guarded, so re-running it is a no-op.

-- 1. How the subscriber signed up, and on what plan.
--
--    Both NULLABLE and WITHOUT a database default, for the same reason
--    liturgical_rite is (2026-08-24): a default would backfill every existing
--    row with a value nobody observed. NULL here means "we never captured it",
--    which is true of every account predating this migration, and the
--    commission view has to tell that apart from a real answer.
--
--    signup_platform is written once, by the client, on first sign-in where it
--    is null -- first signup wins, so a reinstall on another platform does not
--    rewrite history.
--    subscription_plan is written by the Stripe and RevenueCat webhooks.
alter table public.profiles
  add column if not exists signup_platform   text,
  add column if not exists subscription_plan text;

-- 2. Constrain both domains. NULL passes a CHECK, so these permit exactly
--    NULL plus the listed values. ALTER TABLE ... ADD CONSTRAINT has no
--    IF NOT EXISTS, hence the guards.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_signup_platform_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_signup_platform_check
      check (signup_platform in ('web', 'ios', 'android'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_subscription_plan_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_subscription_plan_check
      check (subscription_plan in ('monthly', 'annual'));
  end if;
end $$;

-- 3. Column grants for the new columns.
--
--    signup_platform: the client writes it, so it needs update as well as
--    select. subscription_plan is written only by webhooks holding the service
--    key, which bypasses RLS and grants entirely -- so it gets select only, and
--    a signed-in user cannot promote themselves to an annual commission.
--
--    Not decorative: refreshSubscription() in index.html carries a scar from
--    trial_extended_until being unreadable and taking the whole select down
--    with it. Column privileges union with any table-level grant, so this is a
--    harmless no-op if profiles is already granted table-wide.
grant select (signup_platform), update (signup_platform)
  on public.profiles to authenticated;
grant select (subscription_plan)
  on public.profiles to authenticated;

-- 4. promo_codes.channel -- the column the report groups by.
--
--    ADDED HERE because it does not exist yet. Verified: no migration creates
--    it and nothing in netlify/functions or index.html references it. The
--    rep_commissions view below selects it, so without this the view would
--    fail to create.
--
--    Named channel, not type: promo_codes.type already exists, defaults to
--    'parish', and means the code's CATEGORY. Same trap parish_name avoided on
--    2026-08-23 -- two columns a letter apart meaning different things.
--    Unconstrained on purpose; the channel vocabulary is not settled.
alter table public.promo_codes
  add column if not exists channel text;

-- 5. Payouts -- what has actually been paid to a rep, for a period.
--
--    Nothing writes this yet; rows are entered by hand in the dashboard, the
--    same way promo_codes are. It exists so the portal can show what is owed
--    against what has been sent.
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  rep_email    text not null,
  amount       numeric not null,
  period_start date not null,
  period_end   date not null,
  status       text default 'pending',
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz default now()
);

-- 6. RLS on payouts: service role only.
--
--    Same pattern as promo_codes / promo_redemptions -- RLS enabled, NO
--    policies written. With RLS on and no policy every ordinary role is
--    denied; the service key bypasses RLS entirely, which is how
--    referral-report.js reaches it. The REVOKE is belt-and-braces against
--    Supabase's default grants to anon/authenticated on public tables, and the
--    GRANT restates service_role's access rather than trusting that the
--    revoke above left it untouched.
alter table public.payouts enable row level security;
revoke all on public.payouts from anon, authenticated;
grant all on public.payouts to service_role;

create index if not exists payouts_rep_email_idx on public.payouts (rep_email);

-- 7. rep_commissions -- one row per paying, referred subscriber.
--
--    WHAT THIS VIEW IS: a per-subscriber commission RATE, current as of now.
--    It is not a ledger and it is not what anybody gets paid. Payout is
--    calculated separately from actual Stripe and RevenueCat events, because
--    only those know when money actually moved. This view answers "what is
--    this subscriber worth per month, right now" and nothing else.
--
--    Annual subscribers therefore show their annual commission divided by 12,
--    as a monthly equivalent, so a running total across mixed plans adds up.
--    The real annual payment lands in the month it occurs, from the events.
--
--    JOIN SHAPE, and why it is not the obvious one.
--
--    Attribution follows profiles.referral_code, NOT promo_redemptions. Both
--    tables can answer "which code did this user use", but they disagree when a
--    user redeems more than one: promo_redemptions holds a row per redemption,
--    while referral_code is the FIRST code and is never overwritten. Joining
--    through promo_redemptions alone would emit one row per redemption and pay
--    two reps for one subscriber. promo_redemptions is joined only to recover
--    redeemed_at for that one attributed code.
--
--    promo_redemptions.user_id is TEXT while profiles.id is UUID, with no FK
--    between them (recorded 2026-08-23 as a known gap). The comparison casts
--    the uuid to text rather than the text to uuid: a malformed user_id would
--    make the uuid cast raise and take the whole view down, where the text
--    comparison simply does not match.
--
--    COMMISSION MATH -- exact, no rounding until the end:
--      net rate    web 0.97 (Stripe 3%), ios/android 0.85 (Apple/Google 15%)
--      rep share   0.30
--      base        monthly 9.99, annual 89.99 / 12
--
--      web  monthly    9.99      * 0.97 * 0.30 = 2.9070900 -> 2.91
--      app  monthly    9.99      * 0.85 * 0.30 = 2.5474500 -> 2.55
--      web  annual   (89.99/12)  * 0.97 * 0.30 = 2.1822575 -> 2.18
--      app  annual   (89.99/12)  * 0.85 * 0.30 = 1.9122875 -> 1.91
--
--    NULL signup_platform takes the 0.85 rate: the pessimistic assumption, so
--    an unknown platform never over-pays.
--    NULL subscription_plan is treated as monthly -- 9.99 is the base price and
--    the column is new, so every pre-existing subscriber is null here.
create or replace view public.rep_commissions as
select
  c.rep_name,
  c.rep_email,
  c.code,
  c.channel,
  c.description,
  p.id                        as subscriber_id,
  p.signup_platform,
  p.subscription_plan,
  round(
    (case when coalesce(p.subscription_plan, 'monthly') = 'annual'
            then 89.99 / 12
            else 9.99
          end
     * case when p.signup_platform = 'web' then 0.97 else 0.85 end
     * 0.30)::numeric, 2)     as monthly_commission,
  r.redeemed_at
from public.profiles p
join public.promo_codes c
  on c.code = p.referral_code
left join public.promo_redemptions r
  on r.code = c.code
 and r.user_id = p.id::text
where p.subscription_status = 'premium'
  and p.referral_code is not null;

-- 8. The view is service-role only, like the table it reports on.
--
--    This matters more than it looks. A Postgres view runs with its OWNER's
--    privileges by default, not the caller's, so RLS on profiles does NOT
--    filter it. If authenticated could select here, any signed-in user would
--    read every rep's commissions -- every subscriber id, every code, every
--    rep's email. referral-report.js reaches it with the service key and does
--    the per-rep filtering itself.
revoke all on public.rep_commissions from anon, authenticated;
grant select on public.rep_commissions to service_role;
