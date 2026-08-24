-- 2026-08-24  profiles.liturgical_rite -- the Office calendar preference
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- Additive only: no drops, no type changes, no data rewrites. Every statement
-- is guarded, so re-running it is a no-op.
--
-- Stage 3 of the Office rebuild -- see
-- vault/raw/decisions/2026-08-23-office-rebuild-plan.md section 3. This is the
-- FIRST user preference stored on the profile; every other one in the app
-- (office mode, spiritual depth, fasting, readability, bells) lives only in
-- localStorage. The client keeps localStorage as the synchronous source of
-- truth for rendering and treats this column as the cross-device mirror.

-- 1. The column.
--
--    NULLABLE, and deliberately WITHOUT a database default.
--
--    'modern' is the default for existing users (section 3: nobody's Office
--    changes under them without an explicit choice), but that default belongs
--    in the client, not here. A column default would backfill every existing
--    row to 'modern' and destroy the distinction this needs:
--
--      NULL          -- this account has never expressed a preference
--      'modern'      -- this account chose modern
--      'traditional' -- this account chose traditional
--
--    The sign-in rule is "profile wins". If every pre-existing row were
--    eagerly 'modern', a guest who chose Traditional and then signed in would
--    be silently reset to Modern by a value they never set -- which is the
--    exact harm section 3 is guarding against. With NULL meaning "unset", the
--    client can tell "no opinion on this account" from "chose modern" and
--    push the local choice up instead of clobbering it.
alter table public.profiles
  add column if not exists liturgical_rite text;

-- 2. Constrain the domain. NULL passes a CHECK (a null comparison is null,
--    not false), so this permits exactly: NULL, 'modern', 'traditional'.
--    ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, hence the guard.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_liturgical_rite_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_liturgical_rite_check
      check (liturgical_rite in ('modern', 'traditional'));
  end if;
end $$;

-- 3. Let a signed-in user write their own row.
--
--    RLS is enabled on profiles. Today the only client-side write to this
--    table is the RevenueCat subscription_status PATCH in index.html, and it
--    ends in .catch(() => {}) -- so if no UPDATE policy exists, that write has
--    been failing silently and nothing would have reported it. This policy is
--    what the Office Calendar toggle needs in order to persist at all.
--
--    WITH CHECK is stated explicitly even though Postgres would reuse USING
--    when it is omitted. Being explicit is the point in a security policy: it
--    says that the row must still belong to the caller AFTER the update, so
--    a user cannot reassign their row's id to somebody else.
--
--    CREATE POLICY has no IF NOT EXISTS either, hence the second guard.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- 4. Column-level grants for the new column.
--
--    Not decorative. refreshSubscription() in index.html carries a scar from
--    exactly this: when trial_extended_until was unreadable, the whole
--    `select=subscription_status,trial_extended_until` failed and took the
--    subscription status down with it, so the client now retries without the
--    newer column. Column privileges are unioned with any table-level grant,
--    so if profiles is already granted table-wide this is a harmless no-op --
--    and if it is column-scoped, this is what stops liturgical_rite from
--    breaking every select it appears in.
grant select (liturgical_rite), update (liturgical_rite)
  on public.profiles to authenticated;

-- No index. This column is only ever read by primary key (id = eq.<uid>),
-- which the profiles pkey already serves. Nothing filters or sorts on it.
--
-- No SELECT policy added. Reads of profiles by the user's own token already
-- work today (refreshSubscription), so a SELECT policy is already in place;
-- adding a second one would only widen access.
