# Subscription Check Paths

_Traced 2026-08-22 against [`index.html`](../../../index.html) and [`netlify/functions/`](../../../netlify/functions). Line numbers refreshed at commit `21fed35`; the `getValidToken` guard shifted everything below 11914 down by 23. A pointer map, not a copy; re-verify against the code before relying on it._

See also: [architecture.md](architecture.md#subscription-flow) for the region map · [stack.md](stack.md) for the service split.

## The one-line model

**Supabase `profiles.subscription_status` is the only authority.** Stripe and RevenueCat are both just writers into that column. Neither payment provider is ever *queried* at check time — not by the client, not by the server.

```
Stripe webhook ──┐
RevenueCat webhook ──┼──► profiles.subscription_status ──┬──► client isSubscribed()  (cached)
RC entitlement PATCH ─┘                                  └──► claude.js  (verified server-side)
```

## Client check — `isSubscribed()`

[index.html:12641](../../../index.html). Synchronous, reads a cache, consults exactly three sources:

| # | Source | Line |
|---|---|---|
| 1 | `COMP_EMAILS` — reviewer / parish / clergy comp list | 12644–12652 |
| 2 | `window._subStatus \|\| localStorage[PW_SUB_KEY]`, true on `'premium'` **or** `'active'` | 12654–12655 |
| 3 | `still_paid === '1'` — legacy / admin bypass | 12656 |

The cache is filled by `refreshSubscription()` ([12660](../../../index.html)) from `profiles.subscription_status`. `PW_SUB_KEY` persists in localStorage, so a returning user is granted access at cold launch before any network call completes.

Cleared only by: a free row from the server, sign-out, account deletion.

The hard gate is `shouldShowPaywall()` ([12706](../../../index.html)), called from `enterFeature`.

## Server check — `claude.js`

[netlify/functions/claude.js](../../../netlify/functions/claude.js) does not trust the client:

1. Verifies the Supabase access token — 151–154
2. Loads the profile server-side, `profile?.subscription_status || 'free'` — 157
3. Applies `LIMITS[status]` — 158; table at 13–14 (`free`: Deeper 0, Sophia 0, lectio 3 · `premium`: Deeper 14, Sophia 14, chamber 30, paths 20, lectio 12)
4. Family pooling for `sub_group_id` — 163–164; lifetime trial allowance for free users — 168
5. Rejects with `upgrade_required` 178 or `limit_reached` 185

## Worked case: Stripe premium, no RevenueCat entitlement, native app

**Access is granted in both paths.** RevenueCat is never consulted by either.

- Stripe's webhook wrote `'premium'` ([stripe-webhook.js:54](../../../netlify/functions/stripe-webhook.js)).
- Client: `refreshSubscription()` caches `'premium'` → `isSubscribed()` true at 12655 → no paywall.
- Server: `claude.js` reads `'premium'` from the profile → `LIMITS.premium`.
- **RevenueCat cannot revoke it.** `initRevenueCat()` ([14638](../../../index.html)) only writes on the positive branch — `if (…entitlements.active['premium'])` at 14662 sets the cache to `'active'` (14663–14664) and PATCHes the server to `'premium'` (14677). With no entitlement that branch is skipped: nothing written, nothing cleared. No RC-driven downgrade exists anywhere in the file.

## Flagged: `'active'` is a client-only value the server would not honor

- Client accepts `'premium'` **or** `'active'` — [index.html:12655](../../../index.html).
- Server `LIMITS` has only `free` and `premium` keys — [claude.js:13–14](../../../netlify/functions/claude.js). `LIMITS['active']` is `undefined`, so 158 falls back to **`LIMITS.free`**. Family pooling additionally requires `status === 'premium'` exactly (163).

**Latent, not live.** Nothing currently writes `'active'` to Supabase: [stripe-webhook.js:54,60](../../../netlify/functions/stripe-webhook.js) and [revenuecat-webhook.js:49,51](../../../netlify/functions/revenuecat-webhook.js) both write `'premium'`/`'free'`, and the client PATCH at 14677 writes `'premium'`. `'active'` lives only in the local cache (12793–12794, 14562–14563, 14663–14664).

### Where `'active'` came from — history, traced 2026-08-22

**The read predates every writer by six weeks, and it has never had a server-side source.**

| When | Commit | What happened |
|---|---|---|
| 2026-05-08 | `3ab531e` | `stripe-webhook.js` created. Writes `'premium'` / `'free'` — and has written **only** those two values in all four of its revisions (`3ab531e`, `b7999eb`, `ae14e86`, `ea1327e`). |
| **2026-06-08** | **`7bc9b53`** | **`isSubscribed()` is born**, in the commit that made Supabase the source of truth ("Trial preview during, hard lock after"). The very first version of the function already reads `if (s === 'premium' \|\| s === 'active')`. At that moment the only writer in existence was the Stripe webhook, writing `'premium'`. **`'active'` was a dead branch from the day it was written.** |
| 2026-06-16 | `e821c32` | `revenuecat-webhook.js` created. Also writes only `'premium'` / `'free'`. |
| 2026-07-20 | `3555da1` | First code to ever *write* `'active'` — the native RevenueCat restore path, caching to localStorage only. |
| 2026-07-26 | `c2c1882` | Anonymous IAP does the same on the entitlement-on-launch path. |
| 2026-08-01 | `10f585d` | Family Sharing fix PATCHes the server — with **`'premium'`**, not `'active'`. Still the only client→server write ([index.html:14677](../../../index.html)). |

**Was there ever a webhook that wrote `'active'`?** No. `git log -S "'active'" -- netlify/functions` returns **zero commits** — the string has never existed anywhere in the functions directory in the repo's history. Every historical revision of both webhooks was inspected directly; all write `'premium'` / `'free'`.

**Where the word actually comes from — RevenueCat, not Stripe.** The commit that first wrote it, `3555da1`, reads:

```js
&& Object.keys(customerInfo.entitlements.active || {}).length > 0;
   localStorage.setItem(PW_SUB_KEY, 'active');
```

`entitlements.active` is RevenueCat's SDK shape — the map of currently-active entitlements. The literal string `'active'` was lifted from that property name into the cache. It is an artifact of the SDK's object naming, not a status value from any provider.

**Does Stripe's vocabulary explain it?** Only as a plausible *motive* for the original defensive read, never as an actual source. Stripe subscriptions do carry `active` / `canceled` / `past_due` / `trialing` / `incomplete` / `unpaid` / `paused`, so accepting `'active'` in June 2026 looks like anticipating a future where the webhook forwarded Stripe's raw status. That never happened — `stripe-webhook.js` mapped to the app's own `'premium'` / `'free'` from its first commit onward, a month before `isSubscribed()` existed.

**Conclusion.** `'active'` is vestigial on the read side and RevenueCat-derived on the write side, and the two are unrelated in origin. No provider vocabulary was ever stored in `subscription_status`.

**Risk if it ever changes.** If anything writes `'active'` to the profile, client and server disagree silently: the app shows premium while Deeper and Amma Sophia return `upgrade_required`. The client PATCH at 14677 is one careless edit away from being the thing that does it — it sits four lines below a block that sets the local cache to `'active'`. **No code changed 2026-08-22 — investigation only** ([decision record](../../raw/decisions/2026-08-22-vault-setup-and-tts-endpoint.md)).

### Removing `'active'` is a two-step fix

`initRevenueCat()` **caches `'active'` locally while PATCHing `'premium'` to Supabase** ([14663–14664](../../../index.html) vs [14677](../../../index.html)) — the local cache and the server column disagree by design today, and the read at [12655](../../../index.html) is the only thing making the local half work. Order matters:

1. **First** change every site that caches `'active'` to cache `'premium'`. There are **three**, all native RevenueCat paths — `restorePurchases` ([12793–12794](../../../index.html)), `purchasePackage` success ([14562–14563](../../../index.html)), `initRevenueCat` entitlement-on-launch ([14663–14664](../../../index.html)).
2. **Then** drop `|| s === 'active'` from [12655](../../../index.html).

**Step 2 alone breaks native purchase and restore:** the user pays, the cache says `'active'`, the read no longer accepts it, and the paywall stays up. The cheaper fix in the other direction is unchanged and still one line — accept `'active'` as a `premium` alias in the server's `LIMITS` and touch nothing on the client.

## `profiles.subscription_end` — exists in Supabase, written by nothing

_Traced 2026-08-23._ The column is real — `subscription_end timestamptz NULL` on `public.profiles`, confirmed from `information_schema`. **No code has ever touched it.**

- **Stripe does not write it.** [stripe-webhook.js](../../../netlify/functions/stripe-webhook.js) writes exactly three things: `subscription_status` via `updateProfile` (5–11), `reflection_credits` via `addReflections` (13–24), and the `add_voice_credit` RPC (26–33). A subscription *ending* is handled at 58–61 by setting `subscription_status: 'free'` — a status flip, never a date.
- **RevenueCat does not write it.** [revenuecat-webhook.js:49,51](../../../netlify/functions/revenuecat-webhook.js) writes `subscription_status` and `sub_group_id` only.
- **Nothing reads it.** `git grep subscription_end` outside `vault/` returns zero hits in `index.html` and every function.
- **It has never existed in the code.** `git log -S "subscription_end"` outside `vault/` returns **zero commits** — the string has never appeared in any revision in the repo's history.

Same shape as [`'active'`](#flagged-active-is-a-client-only-value-the-server-would-not-honor): a column created in the database and never wired to anything. Expiry is expressed entirely as `subscription_status` flipping to `'free'`, so **there is no date-based subscription expiry anywhere in the system.** Do not assume this column carries a real end date — it is null for every profile that has never been hand-edited.

Relevant to the promo/trial work: `trial_extended_until` is being added as its own column rather than overloading this one, since the two mean different things (paid subscription ends vs trial relief ends).

## Resolved 2026-08-22: `elevenlabs-tts.js` deleted

**Confirmed gone from production 2026-08-23.** `GET` and `POST` to `https://stillprayer.app/.netlify/functions/elevenlabs-tts` both return **404** with an empty body, served straight from the Netlify edge (`Cache-Status: "Netlify Edge"; fwd=miss; fwd-status=404`) — the function is not deployed, not merely erroring ([decision record](../../raw/decisions/2026-08-22-vault-setup-and-tts-endpoint.md#3-elevenlabs-ttsjs--deleted-not-gated)).

The function had no auth and no subscription check — it parsed `{text, character}`, validated the character name, and generated, spending `ELEVEN_LABS_API_KEY` for any caller who could reach the URL.

It was also **dead code**. `git log -S "elevenlabs-tts" -- index.html www/index.html` returns two commits: the call was added in `69ab0b9` (2026-05-13) and removed the next day in `4d9d0bb` (2026-05-14, "audio via Render"). `www/index.html` was not created until `2d74580` (2026-05-26), so the string never existed in the file that native builds ship — no iOS or Android release could have called it. Exposure was the web app only, for ~24 hours in May 2026.

Deleted rather than gated. Voice TTS goes to the Render server: `requestVoice` [index.html:4131](../../../index.html) → `still-tts.onrender.com/tts` (4142), which takes `access_token` from `getValidToken()` (4140) and returns 401 `auth_required` (4161) / 402 `insufficient_balance` (4155). Gating for voice lives on that server, whose source is **not in this repo**.

Corrected here: earlier versions of [stack.md](stack.md) and [architecture.md](architecture.md) credited `elevenlabs-tts.js` as the voice TTS path, citing [index.html:4098](../../../index.html). That line is a comment mentioning ElevenLabs, not a call site.
