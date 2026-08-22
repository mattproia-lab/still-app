# Stack & Platform Facts

_Ingested 2026-08-22 from the Standing project facts in [CLAUDE.md](../../CLAUDE.md), each claim re-verified against the live repo. Code is ground truth; where the two disagreed, the code wins and the conflict is logged under [Flagged contradictions](#flagged-contradictions)._

## Shape of the app

- One monolithic [`index.html`](../../../index.html) holds the entire web app — **15,773 lines** as of 2026-08-22 (working tree). It is the app; there is no bundler or framework build step.
- [`bell-native.js`](../../../bell-native.js) (275 lines) is the only other first-party script at the repo root.
- Capacitor 8 wraps the same HTML for native: [`@capacitor/ios`, `@capacitor/android`, `@capacitor/local-notifications`](../../../package.json). Web dir is `www` ([capacitor.config.json](../../../capacitor.config.json)).
- Native shells live in [`ios/`](../../../ios) and [`android/`](../../../android).

## Backend services

| Concern | Implementation | Source |
|---|---|---|
| Auth + data | Supabase, project ref `zbskapivansfewegllnz` | [index.html:11834](../../../index.html) (`SUPA_URL`) |
| Serverless API | 17 Netlify functions in [`netlify/functions/`](../../../netlify/functions) | [netlify.toml:19](../../../netlify.toml) |
| Purchases (mobile) | RevenueCat via `@revenuecat/purchases-capacitor` | [package.json](../../../package.json), [index.html:14446](../../../index.html) (`initRevenueCat()`), [revenuecat-webhook.js](../../../netlify/functions/revenuecat-webhook.js) |
| Purchases (web) | Stripe Checkout | [index.html:8148](../../../index.html) (`CHECKOUT_FN`), [stripe-checkout.js](../../../netlify/functions/stripe-checkout.js), [stripe-webhook.js](../../../netlify/functions/stripe-webhook.js) |
| LLM | Anthropic, proxied through [`claude.js`](../../../netlify/functions/claude.js) — 9 call sites in index.html | [index.html:6017, 6152, 6222, 7681, 7760, 8014, 8456, 9586, 15592](../../../index.html) |
| TTS (all voice) | Render server `https://still-tts.onrender.com` — endpoints `/tts` (character voices), `/office-tts`, `/rosary-tts`. Takes `access_token`; returns 401 `auth_required` / 402 `insufficient_balance` | [index.html:4142, 4286, 4360, 4485, 5806, 12182](../../../index.html) |
| Push | OneSignal (`onesignal-cordova-plugin`), [send-notifications.js](../../../netlify/functions/send-notifications.js) | [package.json](../../../package.json) |

## Native vs. web origin

In the native shell the page is served from `capacitor://localhost`, so relative function paths don't resolve. `window.FN_BASE` switches to `https://stillprayer.app` on native and `''` on web — every Netlify function call goes through it ([index.html:4595](../../../index.html)).

## Flagged contradictions

**App ID.** [CLAUDE.md](../../CLAUDE.md) states the app ID is `app.stillprayer.still`. The repo has two different ones:

- Android — `app.stillprayer.still` ([android/app/build.gradle](../../../android/app/build.gradle), both `namespace` and `applicationId`) ✅ matches
- iOS — `app.stillprayer.www` ([ios/App/App.xcodeproj/project.pbxproj](../../../ios/App/App.xcodeproj/project.pbxproj), `PRODUCT_BUNDLE_IDENTIFIER`)
- Capacitor — `app.stillprayer.www` ([capacitor.config.json](../../../capacitor.config.json), `appId`)

The platforms genuinely ship under different identifiers. **Matt: which is the App Store record — is `app.stillprayer.www` the shipping iOS bundle ID, or drift from a Capacitor scaffold?** Not resolved in the vault; do not "fix" either side until confirmed.

**Line count.** CLAUDE.md says "~14,000-line index.html"; actual is 15,773. Treat the standing figure as stale, not wrong-in-kind.

## Anomalies worth a look

- [index.html:12331](../../../index.html) calls `https://api.anthropic.com/v1/messages` **directly from the browser** with no auth header (community-response AI fallback, model string `claude-sonnet-4-6`). Every other LLM call routes through the `claude.js` function. As written this request cannot succeed — no API key, and browser-origin calls to the Anthropic API are blocked by default. Likely dead fallback inside a `try/catch`, so it fails silently. Flagged, not changed.

## See also

[architecture.md](architecture.md) — the line-region map of index.html's major systems. This page covers the stack; that one covers internal structure.
