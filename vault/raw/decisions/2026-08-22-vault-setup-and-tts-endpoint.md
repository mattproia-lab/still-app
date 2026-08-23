---
date: 2026-08-22
type: decision-record
session: vault setup, exposure audit, subscription trace, auth-token fixes
participants: Matt Proia, Claude Opus 5
ingested: 2026-08-23
---

# 2026-08-22 — Vault setup, TTS endpoint removal, subscription trace, auth-token fixes

Long working session. Eight things settled. Written up 2026-08-23; the two
outstanding verifications (endpoint 404, vault 404) were run then and are
recorded with their results.

---

## 1. The vault exists

`vault/` scaffolded inside the app repo — `raw/` for verbatim sources,
`wiki/` for the cross-linked index (`36898c8`). Governing rules live in
[`vault/CLAUDE.md`](../../CLAUDE.md): ingestion protocol, contradiction rule,
no-fabrication rule, theology corpus scope.

**Decision: the vault never copies code.** Code is always ground truth and is
read live. The vault holds only what code cannot — decisions, history,
theology, marketing. `wiki/app/architecture.md` is a line-region *pointer map*
into `index.html`, explicitly not a copy, and the live file wins whenever the
two disagree.

Added later the same day (`0c9fd8d`): the four **approval rules** — read-only /
where-does-it-write / does-it-touch-git / does-the-pattern-overmatch — plus the
requirement that any disk- or git-touching command Claude proposes carries one
plain-English line saying what it touches and what is recoverable.

## 2. Netlify exposure — blocked

`netlify.toml` has `publish = "."`. The repo root **is** the web root, so
adding `vault/` to the repo published the whole vault to stillprayer.app by
default. Caught during the exposure audit.

Fixed in `afae167` with a forced 404:

```toml
[[redirects]]
  from = "/vault/*"
  to = "/404"
  status = 404
  force = true
```

`force = true` is the operative part — without it the real files on disk win.

**Verified live 2026-08-23:** `/vault/`, `/vault/CLAUDE.md`, and
`/vault/wiki/index.md` all return **404**.

Standing consequence, worth repeating because it will bite again: under
`publish = "."` **everything not explicitly blocked is publicly served.** Any
new top-level directory is public the moment it is committed.

## 3. `elevenlabs-tts.js` — deleted, not gated

The function took `{text, character}`, validated the character name, and
generated speech. **No auth, no subscription check** — anyone who could reach
the URL could spend `ELEVEN_LABS_API_KEY`.

It was also dead code. `git log -S "elevenlabs-tts" -- index.html www/index.html`
returns exactly two commits: the call was added in `69ab0b9` (2026-05-13) and
removed the next day in `4d9d0bb` (2026-05-14, "audio via Render").
`www/index.html` did not exist until `2d74580` (2026-05-26), so the string never
appeared in the file native builds ship — **no iOS or Android release could have
called it.** Real exposure: the web app only, for roughly 24 hours in May 2026.

**Decision: delete rather than gate** (`033e9f4`). Nothing called it, and voice
TTS already lives elsewhere — `requestVoice` ([index.html:4131](../../../index.html))
posts to `still-tts.onrender.com/tts` with an `access_token` from
`getValidToken()`, and that server returns 401 `auth_required` / 402
`insufficient_balance`. Gating lives on the Render server, **whose source is not
in this repo.**

**Verified live 2026-08-23** — the pending check from the session:

```
GET  https://stillprayer.app/.netlify/functions/elevenlabs-tts  → 404
POST (same URL, {"text":"test","character":"sophia"})           → 404, Content-Length: 0
                                                                   Server: Netlify
```

Confirmed gone from production. Netlify edge served the 404 directly
(`Cache-Status: "Netlify Edge"; fwd=miss; fwd-status=404`) — the function is
not merely erroring, it is not deployed.

Correction recorded at the same time: earlier `stack.md` and `architecture.md`
credited `elevenlabs-tts.js` as the voice path, citing
[index.html:4098](../../../index.html). That line is a comment mentioning
ElevenLabs, not a call site.

## 4. Subscription paths — traced end to end

Full trace in [`wiki/app/subscription-paths.md`](../../wiki/app/subscription-paths.md).

**The one-line model: Supabase `profiles.subscription_status` is the only
authority.** Stripe and RevenueCat are both just *writers* into that column.
Neither provider is ever queried at check time — not by the client, not by the
server.

- Client: `isSubscribed()` ([12641](../../../index.html)) is synchronous and
  reads a cache. Three sources only — comp-email list, the cached status, and
  the legacy `still_paid === '1'` bypass. Hard gate is `shouldShowPaywall()`
  ([12706](../../../index.html)).
- Server: `claude.js` does not trust the client — verifies the Supabase token,
  loads the profile server-side, applies `LIMITS[status]`, rejects with
  `upgrade_required` / `limit_reached`.

Worked case settled during the session: **Stripe premium, no RevenueCat
entitlement, native app → access granted in both paths.** RevenueCat cannot
revoke it. `initRevenueCat()` only writes on the positive branch; with no
entitlement that branch is skipped and nothing is cleared. There is no
RC-driven downgrade anywhere in the file.

## 5. The `'active'` mystery — solved

**What it is.** `isSubscribed()` accepts `'premium'` **or** `'active'`
([12655](../../../index.html)). The server's `LIMITS` table has only `free` and
`premium` keys, so `LIMITS['active']` is `undefined` and the server silently
falls back to `LIMITS.free`. Family pooling requires `'premium'` exactly.

**Where it came from.** Not Stripe. `git log -S "'active'" -- netlify/functions`
returns **zero commits** — the string has never existed in the functions
directory in the entire history of the repo. Every historical revision of both
webhooks was read directly; all write `'premium'` / `'free'`.

The read predates every writer by six weeks. `isSubscribed()` was born
2026-06-08 (`7bc9b53`) already containing `s === 'active'`, when the only writer
in existence was the Stripe webhook writing `'premium'`. **It was a dead branch
from the day it was written.** The first code to ever *write* `'active'` came
six weeks later, 2026-07-20 (`3555da1`), on the native RevenueCat restore path —
lifted straight off the SDK's own object shape:

```js
&& Object.keys(customerInfo.entitlements.active || {}).length > 0;
   localStorage.setItem(PW_SUB_KEY, 'active');
```

`entitlements.active` is RevenueCat's map of currently-active entitlements. The
literal string was taken from that *property name*. It is an artifact of SDK
naming, not a status value from any provider. Stripe's `active`/`canceled`/
`past_due` vocabulary is a plausible *motive* for the original defensive read
but was never its source.

**Conclusion: vestigial on the read side, RevenueCat-derived on the write side,
and the two are unrelated in origin.** No provider vocabulary was ever stored in
`subscription_status`.

**Current state: latent, not live.** Both webhooks and the client PATCH
([14677](../../../index.html)) all write `'premium'`. `'active'` exists only in
the local cache.

**Decision: no code changed. Investigation only.** The risk is recorded instead
— if anything ever writes `'active'` to the profile, client and server disagree
silently: the app shows premium while Deeper and Amma Sophia return
`upgrade_required`. The client PATCH at 14677 sits four lines below a block that
caches `'active'`, so it is one careless edit away from becoming that writer.

**Removal is a two-step fix, and it is not optional to do both.**
`initRevenueCat()` caches `'active'` locally while PATCHing `'premium'` to
Supabase — the local cache and the server column deliberately disagree today,
and the read at 12655 is the only thing making the local half work. So:

1. **First** change every site that caches `'active'` to cache `'premium'` —
   there are **three**, all native RevenueCat paths:
   `restorePurchases` ([12793–12794](../../../index.html)),
   `purchasePackage` success ([14562–14563](../../../index.html)),
   `initRevenueCat` entitlement-on-launch ([14663–14664](../../../index.html)).
2. **Then** drop `|| s === 'active'` from [12655](../../../index.html).

Doing step 2 alone breaks native purchase and restore — the user pays, the cache
says `'active'`, the read no longer accepts it, and the paywall stays up. The
cheaper alternative in the other direction remains: accept `'active'` as a
`premium` alias in the server's `LIMITS` and change nothing on the client.

## 6. Token-refresh guard

`c812a81` first: `refreshSubscription()` was reading a possibly-expired
`access_token` straight out of localStorage, so **paying users with a stale
token silently resolved to `'free'` and saw the paywall.** Now mints a fresh
token via `getValidToken()`, and `onAuthed()` re-checks and hides the paywall
when a login resolves as subscribed.

That fix exposed a second, worse one.

## 7. Concurrent-refresh logout bug — closed

`1e63e0d`. **Supabase rotates refresh tokens**, so two parallel refreshes
invalidate one another and the loser's token is dead — the user gets logged out.
`getValidToken()` had no guard against that, and `c812a81` had just added a new
caller.

Three defects, one commit:

- **Concurrent refreshes.** Added a single-flight guard, `_tokenRefresh`.
  Concurrent callers now await the one in-flight refresh instead of each firing
  their own.
- **Reentry.** `onAuthed()` calls `refreshSubscription()`, which calls back into
  `getValidToken()` — the refresh could re-enter itself. Same guard closes it,
  and `onAuthed(d.user)` now fires only after the token is stored.
- **The infinite loop.** The old code stored `d.access_token` unconditionally.
  An undefined value kept `needsRefresh` true forever, so **every subsequent
  call refreshed again.** Now it adopts a token only if one actually came back,
  and only overwrites the refresh token when the response carries one.

Applied to both `index.html` and `www/index.html` in the same commit.

## 8. Bundle ID split — confirmed intentional

`21fed35`. The vault had flagged this as a possible contradiction; **Matt
confirmed it is deliberate.**

| Platform | Identifier | Source |
|---|---|---|
| iOS | `app.stillprayer.www` | `PRODUCT_BUNDLE_IDENTIFIER` — **this is the App Store record** |
| Capacitor | `app.stillprayer.www` | `capacitor.config.json` `appId` — matches iOS |
| Android | `app.stillprayer.still` | `android/app/build.gradle`, both `namespace` and `applicationId` |

**Decision: do not harmonize them.** Changing a shipping bundle ID breaks the
store record and orphans existing installs. Recorded in `CLAUDE.md` and
`stack.md` so it does not get re-flagged as drift.

Sharp edge worth remembering: `capacitor.config.json` carries the **iOS** ID, so
anything reading `appId` at build time gets `app.stillprayer.www` on *both*
platforms. Android's real identifier comes from `build.gradle`, never from
Capacitor config.

## 9. Admin dashboard — never deployed

Checked during the exposure audit and again on 2026-08-23.

- **Not in the repo.** `git ls-files | grep -iE "dash|admin|analytics"` returns
  nothing. No admin file exists at any path, tracked or untracked.
- **Not on the site.** `/admin`, `/admin.html`, and `/admin/index.html` all
  return **404** from stillprayer.app.

What *does* exist in `index.html` is unrelated and much smaller: the comp
address `admin@stillprayer.app` ([12622](../../../index.html)), the legacy
`still_paid === '1'` bypass ([12656](../../../index.html)), and a console-only
`window.stillAdmin()` helper ([12870–12871](../../../index.html)). None of these
is a dashboard and none is a network surface.

**Nothing to block.** Given `publish = "."`, this matters mainly as a rule for
the future: if an admin dashboard is ever built, it is public the moment it is
committed unless a forced 404 goes in first — same treatment `vault/` got.

---

## Open items carried forward

- **`'active'`** — decided, not executed. Two-step fix above, or the `LIMITS`
  alias. No deadline; latent while every writer writes `'premium'`.
- **Render TTS server** — the real gate for voice, and its source is not in this
  repo. The vault cannot verify its auth behaviour from here.
- **`www/` drift** — still a manual `cp` sync with no build step. Re-run it
  before any iOS or Android build.
