-- 2026-10-01  events.user_id -- attribute an event to an account when there is one
--
-- Run once against the Still Supabase project (zbskapivansfewegllnz), via the
-- dashboard SQL editor. There is no Supabase CLI in this project, so this file
-- is a record of what was run, not something a tool applies automatically.
--
-- ─── ORDER: RUN THIS BEFORE DEPLOYING the index.html that sends user_id ───
-- The order is safe in both directions, which is why it can go first:
--   * Builds already installed on phones send no user_id at all, so their rows
--     have user_id null and the new check passes. Nothing in the field breaks.
--   * The new client sends user_id only together with that user's own JWT, so
--     auth.uid() matches it.
-- Deploying the client first would be the unsafe order: it would send user_id
-- to a table with no such column, PostgREST would answer 400, and every
-- signed-in event would be dropped until this ran.
--
-- public.events as it stood before this migration (confirmed 2026-10-01):
--   id          uuid                      not null
--   device_id   text                      not null
--   event_type  text                      not null
--   metadata    jsonb                     nullable
--   created_at  timestamptz               nullable
--   RLS enabled, with one policy:
--     "Insert events", for INSERT, to public, with_check: true
--   -- i.e. any caller could insert any row at all.

-- 1. The column. Nullable on purpose: an event logged before sign-in, or by
--    someone who never signs in, is still an event worth having. ON DELETE SET
--    NULL keeps the row and drops the attribution when an account is deleted,
--    which is what the Delete Account path needs -- a cascade would silently
--    rewrite history, and a restrict would block the deletion outright.
alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Reading events per account is the point of the column, so it gets an index.
create index if not exists events_user_id_idx on public.events (user_id);

-- 3. The insert check. A row may be anonymous, or it may name the caller, and
--    nothing else. Under the old `with_check: true` any client holding the anon
--    key -- which ships in the page and is public by design -- could have
--    written rows attributed to any user id it cared to name.
drop policy if exists "Insert events" on public.events;

create policy "Insert events" on public.events
  for insert to public
  with check (user_id is null or user_id = auth.uid());

-- No select policy is added, and none existed. Nothing reads this table through
-- the API; the dashboard and any service-role job bypass RLS. If a signed-in
-- user should ever read their own events, that is a separate policy and a
-- separate decision:
--   create policy "Read own events" on public.events
--     for select to public using (user_id = auth.uid());
