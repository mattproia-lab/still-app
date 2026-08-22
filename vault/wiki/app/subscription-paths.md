# Subscription Check Paths

_Traced 2026-08-22 against the live [`index.html`](../../../index.html) working tree (uncommitted subscription fix present — subtract ~2 from line numbers above 12600 for HEAD) and [`netlify/functions/`](../../../netlify/functions). A pointer map, not a copy; re-verify against the code before relying on it._

See also: [architecture.md](architecture.md#subscription-flow) for the region map · [stack.md](stack.md) for the service split.

## The one-line model

**Supabase `profiles.subscription_status` is the only authority.** Stripe and RevenueCat are both just writers into that column. Neither payment provider is ever *queried* at check time — not by the client, not by the server.

```
Stripe webhook ──┐
RevenueCat webhook ──┼──► profiles.subscription_status ──┬──► client isSubscribed()  (cached)
RC entitlement PATCH ─┘                                  └──► claude.js  (verified server-side)
```

## Client check — `isSubscribed()`

[index.html:12618](../../../index.html). Synchronous, reads a cache, consults exactly three sources:

| # | Source | Line |
|---|---|---|
| 1 | `COMP_EMAILS` — reviewer / parish / clergy comp list | 12620–12629 |
| 2 | `window._subStatus \|\| localStorage[PW_SUB_KEY]`, true on `'premium'` **or** `'active'` | 12631–12632 |
| 3 | `still_paid === '1'` — legacy / admin bypass | 12633 |

The cache is filled by `refreshSubscription()` ([12637](../../../index.html)) from `profiles.subscription_status` (fetch at 12643, cached at 12649–12650). `PW_SUB_KEY` persists in localStorage, so a returning user is granted access at cold launch before any network call completes.

Cleared only by: a free row from the server (12648), sign-out (12863), account deletion (4786).

The hard gate is `shouldShowPaywall()` ([12683](../../../index.html)), called from `enterFeature`.

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
- Client: `refreshSubscription()` caches `'premium'` → `isSubscribed()` true at 12632 → no paywall.
- Server: `claude.js` reads `'premium'` from the profile → `LIMITS.premium`.
- **RevenueCat cannot revoke it.** `initRevenueCat()` ([14615](../../../index.html)) only writes on the positive branch — `if (…entitlements.active['premium'])` at 14639 sets the cache to `'active'` (14640–14641) and PATCHes the server to `'premium'` (14654). With no entitlement that branch is skipped: nothing written, nothing cleared. No RC-driven downgrade exists anywhere in the file.

## Flagged: `'active'` is a client-only value the server would not honor

- Client accepts `'premium'` **or** `'active'` — [index.html:12632](../../../index.html).
- Server `LIMITS` has only `free` and `premium` keys — [claude.js:13–14](../../../netlify/functions/claude.js). `LIMITS['active']` is `undefined`, so 158 falls back to **`LIMITS.free`**. Family pooling additionally requires `status === 'premium'` exactly (163).

**Latent, not live.** Nothing currently writes `'active'` to Supabase: [stripe-webhook.js:54,60](../../../netlify/functions/stripe-webhook.js) and [revenuecat-webhook.js:49,51](../../../netlify/functions/revenuecat-webhook.js) both write `'premium'`/`'free'`, and the client PATCH at 14654 writes `'premium'`. `'active'` lives only in the local cache (12771, 14540, 14641).

If anything ever does write it to the profile, client and server disagree silently: the app shows premium while Deeper and Amma Sophia return `upgrade_required`. Cheapest fix is accepting `'active'` as a `premium` alias in `LIMITS`, or dropping `'active'` from 12632.

## Resolved 2026-08-22: `elevenlabs-tts.js` deleted

The function had no auth and no subscription check — it parsed `{text, character}`, validated the character name, and generated, spending `ELEVEN_LABS_API_KEY` for any caller who could reach the URL.

It was also **dead code**. `git log -S "elevenlabs-tts" -- index.html www/index.html` returns two commits: the call was added in `69ab0b9` (2026-05-13) and removed the next day in `4d9d0bb` (2026-05-14, "audio via Render"). `www/index.html` was not created until `2d74580` (2026-05-26), so the string never existed in the file that native builds ship — no iOS or Android release could have called it. Exposure was the web app only, for ~24 hours in May 2026.

Deleted rather than gated. Voice TTS goes to the Render server: `requestVoice` [index.html:4131](../../../index.html) → `still-tts.onrender.com/tts` (4142), which takes `access_token` from `getValidToken()` (4140) and returns 401 `auth_required` (4161) / 402 `insufficient_balance` (4155). Gating for voice lives on that server, whose source is **not in this repo**.

Corrected here: earlier versions of [stack.md](stack.md) and [architecture.md](architecture.md) credited `elevenlabs-tts.js` as the voice TTS path, citing [index.html:4098](../../../index.html). That line is a comment mentioning ElevenLabs, not a call site.
