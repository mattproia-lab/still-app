-- 2026-10-01  the comped accounts move out of index.html and into the database
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- Until this release, isSubscribed() in index.html carried a hardcoded list of
-- nine email addresses that were always premium. A comp could therefore only be
-- granted, corrected or withdrawn by shipping a new build to three stores.
--
-- They now carry profiles.comped = true, which isSubscribed() reads first:
--
--   comped = true  OR  subscription_status IN ('premium','active')
--
-- WHY ITS OWN COLUMN, and not just subscription_status = 'premium':
-- stripe-webhook.js and revenuecat-webhook.js both write subscription_status.
-- A CANCELLATION or EXPIRATION for a real subscription one of these people
-- once held would set it to 'free' and silently revoke the comp. Neither
-- webhook touches profiles.comped, and neither should ever be changed to --
-- that is the whole point of the column. A comp is withdrawn by a deliberate
-- update here, and by nothing else.
--
-- ─── ORDER MATTERS, AND THIS ONE IS NOT SAFE IN BOTH DIRECTIONS ───
-- The hardcoded list is already gone from index.html. Anyone in STEP 2 below
-- who does not resolve to a profile row loses premium the moment that build is
-- deployed. So:
--   1. Run STEP 1 (the column) and STEP 2 (verify). Read STEP 2's result.
--   2. For every row where has_account is false, find the address they actually
--      signed up with and fix the list in STEP 3 before running it.
--      'monsignorrichardson@gmail.com' in particular carried the comment
--      "<-- replace with his actual signup email" in index.html, so it was
--      never confirmed to be a real signup address.
--   3. Run STEP 3, re-run STEP 2, confirm all nine read comped = true.
--   4. Only then push and deploy.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 -- the column. Safe to run on its own, changes no behaviour by itself.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists comped boolean not null default false;

comment on column public.profiles.comped is
  'Permanent granted access: reviewers, parish and clergy comps. Read by '
  'isSubscribed() in index.html alongside subscription_status. NEVER written '
  'by stripe-webhook.js or revenuecat-webhook.js -- a subscription event must '
  'not be able to revoke a comp. Change it by hand only.';

-- The client reads this column for the signed-in user through the same
-- profiles select that already returns subscription_status, so it needs no new
-- grant or policy of its own. If profiles uses column-scoped grants in this
-- project, add comped to the authenticated role's select list; the client
-- degrades safely if it cannot read it (refreshSubscription walks down to a
-- narrower select and leaves the cached value alone).

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 -- verify. Read-only. Run before STEP 3, and again after.
-- ─────────────────────────────────────────────────────────────────────────────
with comped_list(email) as (
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
       p.comped,
       p.subscription_status
  from comped_list c
  left join auth.users      u on lower(u.email) = c.email
  left join public.profiles p on p.id = u.id
 order by has_account, c.email;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 -- grant. Run only after STEP 2 shows an account for every address.
--           subscription_status is deliberately left alone: the comp is the
--           comped flag, and mixing the two back together is the thing this
--           migration exists to stop.
-- ─────────────────────────────────────────────────────────────────────────────
update public.profiles p
   set comped = true
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

-- ─── AFTERWARDS ───
-- To grant a comp:
--   update public.profiles set comped = true
--    where id = (select id from auth.users where lower(email) = 'someone@example.com');
--
-- To withdraw one:
--   update public.profiles set comped = false
--    where id = (select id from auth.users where lower(email) = 'someone@example.com');
--
-- Either takes effect on that person's device at the next refreshSubscription()
-- -- about a second after the app finds them signed in, and at every cold
-- launch after that. A withdrawn comp clears the device's cached flag.
--
-- To see every comp currently granted:
--   select u.email, p.comped, p.subscription_status
--     from public.profiles p join auth.users u on u.id = p.id
--    where p.comped;
