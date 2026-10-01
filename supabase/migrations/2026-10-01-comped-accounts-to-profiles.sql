-- 2026-10-01  the comped accounts move out of index.html and into the database
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- Until this release, isSubscribed() in index.html carried a hardcoded list of
-- nine email addresses that were always premium. A comp could therefore only be
-- granted, corrected or withdrawn by shipping a new build to three stores. They
-- now carry subscription_status = 'premium' on their own profile row, read by
-- the same line that reads every other premium account.
--
-- ─── ORDER MATTERS, AND THIS ONE IS NOT SAFE IN BOTH DIRECTIONS ───
-- The hardcoded list is gone from index.html in the same commit as this file.
-- Anyone in STEP 1 below who does not resolve to a profile row loses premium
-- the moment that build is deployed. So:
--   1. Run STEP 1 and read the result.
--   2. For every row where has_account is false, find the address they actually
--      signed up with and fix the list before running STEP 2. 'monsignorrichardson@gmail.com'
--      in particular carried the comment "<-- replace with his actual signup
--      email" in index.html, so it was never confirmed to be real.
--   3. Run STEP 2, re-run STEP 1, confirm every row reads premium.
--   4. Only then push and deploy.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 -- verify. Read-only. Does each comped address have an account yet?
-- ─────────────────────────────────────────────────────────────────────────────
with comped(email) as (
  values
    ('admin@stillprayer.app'),              -- PARISH_EMAIL
    ('gwilson@charlestondiocese.org'),
    ('guerricheckel@gmail.com'),
    ('matt@proiadigitalllc.com'),
    ('frjoetedesco@gmail.com'),
    ('frpatrick@subi.org'),
    ('m.p.schneider.lc@hotmail.com'),
    ('monsignorrichardson@gmail.com'),      -- unconfirmed address, see above
    ('mariamilagros16@gmail.com')
)
select c.email,
       (u.id is not null) as has_account,
       (p.id is not null) as has_profile,
       p.subscription_status
  from comped c
  left join auth.users     u on lower(u.email) = c.email
  left join public.profiles p on p.id = u.id
 order by has_account, c.email;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 -- grant. Run only after STEP 1 shows an account for every address.
-- ─────────────────────────────────────────────────────────────────────────────
update public.profiles p
   set subscription_status = 'premium'
  from auth.users u
 where u.id = p.id
   and lower(u.email) in (
     'admin@stillprayer.app',
     'gwilson@charlestondiocese.org',
     'guerricheckel@gmail.com',
     'matt@proiadigitalllc.com',
     'frjoetedesco@gmail.com',
     'frpatrick@subi.org',
     'm.p.schneider.lc@hotmail.com',
     'monsignorrichardson@gmail.com',
     'mariamilagros16@gmail.com'
   );

-- ─── ONE BEHAVIOURAL DIFFERENCE, WORTH KNOWING ───
-- The hardcoded list beat everything: it returned true before the status was
-- even read, so a comped account stayed premium no matter what the profile
-- said. The profile column does not. If revenuecat-webhook.js or
-- stripe-webhook.js ever processes a CANCELLATION or EXPIRATION for one of
-- these users, it writes subscription_status = 'free' and the comp is gone.
-- That only happens to someone who has also held a real paid subscription on
-- the same account. If a comp should be permanent regardless, it wants its own
-- column (e.g. profiles.comped boolean) that the webhooks never touch, and a
-- second clause in isSubscribed(). Not done here -- that is a product decision,
-- not a refactor.
