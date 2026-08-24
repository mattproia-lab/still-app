---
date: 2026-08-23
type: decision-record
session: promo code attribution, trial extension, redeem-code hardening
participants: Matt Proia, Claude Opus 5
ingested: 2026-08-23
---

# 2026-08-23 — Promo attribution, trial extension, and the redeem-code rewrite

Built and shipped today. Custom promo codes per parish and per rep, a 14-day
trial extension recorded on the profile, and a rewrite of `redeem-code.js` that
closed an unauthenticated write path along the way.

Commits: `91eeba4` (migration), `95393bd` (function), `66dea4a` (client),
`0f933f4` + `418f576` (the missing grant). Live and confirmed working.

---

## What prompted it

Three asks: write the redeemed code to the profile, extend the user's trial by
14 days, and validate against a Supabase table so codes could be made per
parish and per rep.

**The third already existed.** `redeem-code.js` had validated against a
`promo_codes` table since it was written — there was never a hardcoded list.
Per-parish codes worked the day the function shipped; what was missing was any
column saying *which* parish, so redemptions could not be attributed.

**And the grants it handed out were already dead.** The client wrote three
localStorage keys on success — `still_promo_ai_sessions`,
`still_stories_expires`, `still_premium` — and **nothing in the codebase ever
read any of them.** Note `still_premium` is not `PW_PAID_KEY` (`still_paid`) or
`PW_SUB_KEY` (`still_sub_status`), the keys `isSubscribed()` actually consults.
Redemption validated the code, burned a use, recorded the redemption, said
"✦ Code redeemed. Welcome." — and granted nothing. Dropped entirely rather than
revived, on Matt's call.

## Schema

Confirmed against `information_schema` before anything was designed, not
inferred from code.

**`promo_codes`** — added `rep_name`, `rep_email`, `parish_name`, all `text`,
all nullable. Nothing reads them at runtime; they exist so redemptions can be
traced back to whoever handed the code out.

Named `parish_name`, not `parish`: `promo_codes.type` already defaults to
`'parish'` and means the code's *category*. Two columns a letter apart meaning
different things would have been a trap.

**`profiles`** — added `referral_code text` and `trial_extended_until timestamptz`.

**Not reused: `profiles.subscription_end`.** It already exists and is written by
nothing — see [subscription-paths.md](../../wiki/app/subscription-paths.md#profilessubscription_end--exists-in-supabase-written-by-nothing).
Overloading it would have conflated "paid subscription ends" with "trial relief
ends". Kept separate deliberately.

**Nothing added that already existed.** `promo_redemptions` already carried
`UNIQUE (code, user_id)`, so no constraint was needed — and that constraint went
on to do real work (below). No index was added either: the unique constraint is
a btree on `(code, user_id)` whose leading column already serves lookups by
code alone.

## `redeem_promo_code()` — one transaction, one row lock

Migration `2026-08-23b`. Does validate → claim → decrement → grant in a single
`security definer` function.

**Why an RPC at all.** The plan originally called for plain PostgREST calls with
a conditional `uses_remaining=gt.0` filter on the decrement. **That was wrong
and was corrected before any code was written.** PostgREST can only write a
literal — it cannot express `uses_remaining = uses_remaining - 1` — so the value
written is the stale one that was read. Two users redeeming at once both read 5
and both write 4: a classic lost update.

That is not a rare edge here. It is the *normal* case: a code read aloud at a
parish and typed by forty people in the same minute. A code with ten uses would
have been consumed far more than ten times.

`select … for update` on the code row serialises them, and the decrement is real
arithmetic under that lock.

**Two things the RPC got for free:**

- **The injection class disappeared.** The old function interpolated
  `code.toUpperCase()` straight into three PostgREST query strings. The worst
  was the PATCH filter, where a crafted code could widen which rows got written.
  RPC arguments travel in a JSON body, so there is no query string left to
  escape — removed by construction rather than patched.
- **`UNIQUE (code, user_id)` became the mutex.** The insert is wrapped in an
  exception handler catching `unique_violation`, replacing a TOCTOU pre-check
  that two concurrent callers could both pass.

**First-wins is enforced in the database,** not in a branch:

```sql
set referral_code        = coalesce(referral_code, upper(p_code)),
    trial_extended_until = coalesce(trial_extended_until, now() + interval '14 days')
```

`coalesce` only fills what is still null, so a second code overwrites neither
field and never extends the trial again. Not stackable, per Matt's decision —
a rep holding five codes cannot chain one user to 70 days.

## The auth hole

`redeem-code.js` took `user_id` **from the request body and never verified it.**
Any caller could POST any account id.

While the grants were inert this was survivable. The moment the function began
PATCHing `profiles` with a paid benefit it stopped being survivable: an
unauthenticated caller could grant a trial extension to any account, or drain a
parish's `uses_remaining` in a loop.

**RLS gave no cover.** RLS is enabled on all three tables, but the function holds
the service key, which bypasses it entirely. The anon-key 401s seen while
probing the schema were not evidence that this path was safe.

Now verifies the Supabase access token against `/auth/v1/user` and derives the
id from the auth server, matching `getUserFromToken()` in
[claude.js:53–62](../../../netlify/functions/claude.js). `user_id` is no longer
accepted from the client at all.

**One pre-existing bug fixed on the way.** The redemption insert used
`Prefer: return=minimal` and its response was never checked, so two concurrent
redemptions both fell through to the decrement even though only one row was
written. Codes leaked uses on every concurrent double-tap.

## Client

- Sends `access_token` from `getValidToken()` instead of `user_id`
  ([index.html:13156](../../../index.html)).
- `trialIsOver()` ([12749](../../../index.html)) consults
  `trialExtensionActive()` ([12742](../../../index.html)) **first**. Because it
  short-circuits ahead of both tests, one check lifts both halves of the trial —
  the 14-day clock and the 20-session cap — and because it rides on the profile
  it follows the user across devices, which a local session reset cannot do.
- Cached in `PW_TRIAL_EXT_KEY` ([12646](../../../index.html)) beside
  `PW_SUB_KEY`, so the gate reads it synchronously at cold launch before any
  network call resolves — same pattern as the subscription cache.
- The three dead localStorage keys are gone.

**`refreshSubscription()` ([12678](../../../index.html)) got a fallback.**
Adding `trial_extended_until` to its `select=` created a real risk: if that
column were unreadable, the whole request fails and the function bails on
`!res.ok` **before** writing `subscription_status`. Paying users would stop
refreshing and, on a fresh device, resolve to `free` and hit the paywall — the
exact failure `c812a81` fixed the day before, reintroduced from a new direction.

It now retries once with the original status-only select. On that degraded path
the extension cache is deliberately **left alone rather than cleared**, since
the real value is unknown and clearing would revoke a live extension.

Column privileges were checked before shipping: both new columns appear in the
`authenticated` grants, so the fallback should never fire in production.

## Server features unchanged — deliberately

`claude.js` was not touched. Per Matt: client paywall relief only.

**Consequence, stated so it is not a surprise later:** a parish user with an
extended trial gets the paywall lifted but still hits `upgrade_required` on
Deeper and Amma Sophia after 4 lifetime uses each
([claude.js:33](../../../netlify/functions/claude.js), `TRIAL_TOTAL`). The
extension is a paywall concession, not an entitlement.

## The missing `GRANT` — caught in production

The RPC migration revoked execute from `public`, `anon`, and `authenticated` to
keep the function off the public surface. **It never granted execute back to
`service_role`** — the role `SUPABASE_SERVICE_KEY` authenticates as, and the
only caller.

Postgres grants `EXECUTE` on new functions to `PUBLIC` by default; the revoke
stripped that and left nothing behind it.

Surfaced as a **403 permission denied in production** on the first real
redemption. Fixed by running the grant manually and recording it in the
migration file (`0f933f4`, comment rewritten in `418f576`):

```sql
grant execute on function public.redeem_promo_code(text, text) to service_role;
```

**Worth keeping.** The 403 was diagnostically clean — it proved the request
reached Supabase with a valid service key and a resolvable function and stopped
only at the permission check, which ruled out the client half and the token in
one shot. It also corrected a wrong claim made during the session: PostgREST
returns 404 for a function that does not exist, but **403** for one that exists
and is not executable by the caller.

The lesson is narrow and worth repeating: **a `revoke` on a function needs a
matching `grant` for whoever actually calls it.** Blanket revokes are not
symmetric with default privileges.

## Verified

- **End-to-end redemption passed.** `TEST2026` redeemed successfully;
  `referral_code` and `trial_extended_until` confirmed present in `profiles`.
- Both new `profiles` columns confirmed in the `authenticated` grants.
- Both migrations run against the project before the code shipped, so the
  database led the code — the safe direction.

## Open

- **Not-stackable is unverified.** The first redemption was confirmed; a
  *second, different* code leaving both fields unchanged was not tested. It is
  the one requirement whose failure is silent — stacking would not error, it
  would quietly hand out 70-day trials.
- **The test account has spent its grant.** First-wins is permanent, so whatever
  profile redeemed `TEST2026` can never receive a real code. Null both columns
  before using that account with a live code.
- **`promo_redemptions.user_id` is `text`** while `profiles.id` is `uuid` with an
  FK to `auth.users`. No referential integrity, no cascade — redemption rows
  survive account deletion as orphans. Not in scope; worth a ticket.
- **`promo_codes.max_uses` is unused.** `uses_remaining` is the only live
  counter. Do not assume `max_uses` reflects anything.
- **No admin UI.** Codes are created by inserting rows in the Supabase
  dashboard. Fine for now; the attribution columns exist so reporting is
  possible when it matters.
