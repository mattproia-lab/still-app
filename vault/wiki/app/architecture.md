# index.html — Architecture Map

_Table of contents for [`index.html`](../../../index.html), not a copy of it. Built 2026-08-22 by a structural pass over the working-tree file (15,773 lines, uncommitted edits present). Every region below is a pointer into the live file — **read the code, not this page, for what anything does.** Line numbers drift with every edit; treat them as ±50 and refresh this page when structure changes ([CLAUDE.md](../../CLAUDE.md))._

Companion pages: [stack.md](stack.md) (services, platforms, app-ID conflict) · [deploy.md](deploy.md) (Netlify, `www/` sync).

## Top-level file layout

| Lines | Contents |
|---|---|
| 1–113 | `<head>`, meta, fonts |
| 114–133 | Early inline script |
| 136 | `<script src="still-mobile/sing-the-hours.js">` |
| 137–1185 | **All CSS.** Sub-banners: reset 185, background 192, screen system 215, shared header 227, feature area 252, home 371, sitting 483, recording 611, companion 709, other screens 800, settings modal 892, mobile responsive 925 |
| 1187–1197 | Inline script |
| 1199–4091 | `<body>` — screen markup, one `<header>`+section per feature. Bell voice picker UI + inline script 2999–3141; Dialogue Chamber markup ~3200–3410; Lectio Divina styles 3699–4090 |
| **4092–14694** | **The main application script** — everything in the next section |
| 14696–14740 | Small scripts (touch/zoom guards) |
| 14741–15603 | **Dialogue Chamber** module (`DC` IIFE, 14743) |
| 15604–15611 | Inline script |
| 15612 | `<script src="bell-native.js">` |
| 15613–15771 | Desert Fathers weekly series — native local-notification scheduler (Capacitor-only) |

## Major systems in the main script (4092–14694)

### Shell — routing, color, home

| System | Region | Entry points |
|---|---|---|
| Voice player v2 | 4093–4510 | `playVoiceUrl` 4199, `_taggedResponses` 4105, `CHARACTER_AMBIENCE` 4191, office TTS pacing `paceOfficeText` 4334 |
| `FN_BASE` origin switch | 4593–4597 | Native → `https://stillprayer.app`; web → `''` |
| Feature + color data | 4512–4597 | `F[]` feature list 4515, `W[]` per-feature colors 4570 |
| Color animation | 4598–4719 | `animateTo` 4639 — rAF interpolation between feature palettes |
| Router | 4720–4836 | `showScreen` 4801, `enterFeature` 4952 (dispatches to each feature's init) |
| Home screen | 4837–5091 | `buildBeads` 4845, `buildFeatList` 4867, `homeActivate` 4917 |
| Mobile enter tab | 14294–14359 | `initMobileScroll` 14323 — scroll activates, tab enters |
| Init | 14430–14694 | `initRevenueCat` 14615, `showUpgrade` 14465, `restorePurchases` 14488 |

### Prayer practices

| Practice | Region | Notes |
|---|---|---|
| **Bells** | 5092–5167 | Web Audio: `playBell` 5135, `loadBellFile` 5122. See [Bells](#bells-full-picture) below — spans four files. |
| Recording (opening/anchor prayer) | 5168–5302 | MediaRecorder, blob URLs, no upload |
| Contemplative sitting | 5303–5605 | State machine 5306, wake lock 5366, `tapThought` 5444, `drawThoughtGraph` 5489 |
| **Rosary — Cloud of Witnesses** | 5606–5890 | `CoW` IIFE. See [Rosary](#rosary--cloud-of-witnesses) below. |
| The Companion | 5891–6052 | `COMPANION_SYSTEM` 5894 (Desert Fathers/Mothers, pre-1900 sources), rate limit `companionUses` 5978; persistent limit at 13339–13365 |
| **Amma Sophia** (banner reads "THE MYSTIC") | 6053–6197 | `MYSTIC_QUOTES` 6056, `MYSTIC_SYSTEM` 6113 (the Amma Sophia persona), `renderMysticTab` 6093. Voice id `ammaSophia` |
| Deeper | 6198–6283 | `DEEPER_SYSTEM` 5914 (defined up with Companion), UI 6201+ |
| Saints calendar | 6305–7051 | `SAINTS` keyed `'MM-DD'` 6305, `getTodaysSaint` 7042. Rendering lives separately at 13302–13338 |
| Lectio Divina | 7052–7826 | Passage corpus `LP1`–`LP8` 7052–7443 → `PASSAGES` 7444; state machine `lectioGoTo` 7514, phrase 7551, oratio 7659, contemplatio timer 7708 |
| Spiritual Paths | 9048–10288 | `Paths` object. 14-day Ignatian discernment `DISCERNMENT` 9053; **Reading Toward the Center** — 26-day Revelation path — 9612–10288 (`DAYS` 9615, `CENTER_SCRIPTURE` 9700, progress key `still_center_lit` 10167) |
| Rule of Life | 10290–10349 + 14240–14293 | `still_rule_items` localStorage, mirrored to cloud as one upserted `rule_of_life` row |
| **The Guide** | 10350–11204 | `Guide` IIFE, badge "The Seven Roots" — motive-by-motive content 10352+, returns `{open, close, memoryDigest, setTheme}` 11203. Opened by router at 4957, not a `showScreen` target |
| Examen | 11205–11303 | `EXAMEN_QUESTIONS` 11208, one-question-at-a-time flow |
| Darkness mode | 11304–11385 | `DARKNESS_TEXTS` 11307 — curated, no AI |
| Night Watch | 11405–11495 | Time-locked 2–4am, `checkNightWatch` 11431 |
| Breath / Prayer of the Heart | 13366–13535 | `startHeartPrayer` 13381, milestones 13370 |
| Practice calendar | 13549–13642 | Presence marks, explicitly no streaks |
| The Office | 13643–14239 | Liturgical season 13650, Easter computus 13676, psalms/readings/collects 13741–13923, `renderOfficeHour` 13981. Concise/full mode 14360–14387 |

### Data layer

| System | Region | Notes |
|---|---|---|
| `DB` | 7831–7871 | localStorage journal — all practice entries. Device-local by design |
| `Memory` | 7872–8039 | Cross-practice recall feeding the AI voices |
| `Crisis` | 8056–8146 | Crisis-language detection and response |
| `Sync` | 8719–8892 | Pushes `DB` entries to Supabase; `DB.save` is monkey-patched at 9046 to auto-push |
| `StorageSettings` | 8893–9047 | Storage & Privacy panel; injects its own Settings button 9022–9045 |
| Supabase auth | 11830–12086 | `SUPA_URL` 11834, `SUPA_ANON` 11835 (publishable anon key — RLS is what protects the data), `onAuthed` 11844, guest mode 11991, `requireAccount` 12000 |
| Community | 12087–12223 | Anonymous daily question + 3 responses, device-keyed submission |
| Analytics | 12224–12409 | Anonymous events on practice completion, silent on failure |
| Autobiography | 8223–8718 | Journal/month/echoes tabs, `buildLocalNarrative` 8477 (works with zero AI) |

### Subscription flow

The money path is spread across four regions — trace it in this order:

1. **Trial state** 12597–12693 — `PAYWALL_DAYS = 14` / `PAYWALL_SESSIONS = 20` (12597–12598), keys `still_trial_start`, `still_trial_sessions`, `still_paid`, `still_sub_status`. `initTrial` 12608, `isSubscribed` 12618 (reads cached Supabase `subscription_status`), `trialIsOver` 12676, `shouldShowPaywall` 12683.
2. **Paywall UI** 12694–12790 — `showPaywall` 12694, trial previews `maybeShowTrialPreview` 12751, parish/gift path `contactParish` 12757 (`admin@stillprayer.app`).
3. **Web — Stripe** — `VoiceCredit` 8147–8222 holds `CHECKOUT_FN = '/.netlify/functions/stripe-checkout'` 8148; return handling `checkStripeReturn` 12791, `showWelcomePremium` 12831.
4. **Native — RevenueCat** — `initRevenueCat` 14615, `showUpgrade` 14465, `restorePurchases` 14488 and 13196, account linking on sign-in 11842–11851 (`Purchases.logIn` with the Supabase user id, for cross-device sync).
5. **Day-30 discount** 13221–13301 — `checkDay30Discount` 13225, `handleDiscount` 13290.

Server side: [`stripe-checkout.js`](../../../netlify/functions/stripe-checkout.js), [`stripe-webhook.js`](../../../netlify/functions/stripe-webhook.js), [`revenuecat-webhook.js`](../../../netlify/functions/revenuecat-webhook.js), [`redeem-code.js`](../../../netlify/functions/redeem-code.js).

Full trace of how access is actually decided — client cache vs. server verification, and two flagged mismatches: [subscription-paths.md](subscription-paths.md).

### Bells — full picture

Four files, easy to lose:

- **Playback** — `index.html` 5092–5167 (Web Audio buffer, custom file upload).
- **Picker UI** — `index.html` 2999–3141 (inline script in body; slots include a 15:00 Rosary bell).
- **Schedule + prefs** — `index.html` 13029–13161: `toggleBell` 13071, `saveBellSettings` 13126, persisted to the Supabase `bell_preferences` table (13038 read, 13138 write). Simple on/off toggle `setBell` 14347.
- **Native scheduling** — [`bell-native.js`](../../../bell-native.js) (275 lines) + Capacitor local notifications; Desert Fathers weekly series scheduler at `index.html` 15613–15771.
- **Server audio** — [`bell-vigils.js`](../../../netlify/functions/bell-vigils.js), [`bell-lauds.js`](../../../netlify/functions/bell-lauds.js), [`bell-vespers.js`](../../../netlify/functions/bell-vespers.js), [`bell-compline.js`](../../../netlify/functions/bell-compline.js).

### Rosary — Cloud of Witnesses

`CoW` IIFE, `index.html` 5606–5890 (`initWitnesses` 5890 is the only external entry point; router hits it at 4955).

- Set-per-weekday: `DAY_SET` 5611 — Sun Glorious, Mon Joyful, Tue Sorrowful, Wed Glorious, Thu Luminous, Fri Sorrowful, Sat Joyful.
- Fixed prayers inline at `PRAYERS` 5614 (Douay-Rheims-era English: Creed, Our Father, Hail Mary, Glory Be, Fatima, Salve).
- **Meditation corpus is external data, not code**: `assets/rosary/{joyful,sorrowful,glorious,luminous}.json`, fetched lazily by `loadSet` 5630. Verified 2026-08-22: 20 mysteries, **307 meditations** total (joyful 78, sorrowful 78, glorious 76, luminous 75).
- Decade draw `drawPool` 5639 — opener first, closer last, `any` shuffled between; two-closer pools alternate by rosary count that day.
- Audio: `still-tts.onrender.com/rosary-tts` 5806, cached in Supabase by meditation id.
- Sacred-art gallery for the same screen: `assets/rosary/*.jpg` (~100 images), surfaced through the Sacristy 12410–12497.

### Netlify functions (17)

Called through `window.FN_BASE + '/.netlify/functions/<name>'`. Directory: [`netlify/functions/`](../../../netlify/functions).

| Function | Used by |
|---|---|
| `claude.js` | All LLM voices — 9 call sites: 6017, 6152, 6222, 7681, 7760, 8014, 8456, 9586, and the Dialogue Chamber at 15592 |
| _(none — voice TTS goes to the Render server, not a Netlify function)_ | `requestVoice` 4131 → `still-tts.onrender.com/tts` 4142 |
| `bell-vigils/lauds/vespers/compline.js` | Bell audio |
| `stripe-checkout.js`, `stripe-webhook.js` | Web subscription |
| `revenuecat-webhook.js`, `redeem-code.js` | Mobile subscription, gift/parish codes |
| `community-submit.js`, `community-report.js` | Community 12087–12223 |
| `send-notifications.js` | OneSignal push |
| `delete-account.js` | `showDeleteAccount` 4723 |
| `tag-darkness.js`, `tag-response.js` | Text pre-tagging for TTS pauses |
| `generate-demo-audio.js` | Onboarding demos 12888–12992 |
| `rss-proxy.js` | — _(no in-page caller found; verify before relying on it)_ |

## Known anomaly

`index.html:12331` calls `https://api.anthropic.com/v1/messages` directly from the browser, with no auth header, as the community-response AI fallback. Every other LLM call goes through `claude.js`. It cannot succeed as written and fails silently inside a `try/catch`. Recorded in [stack.md](stack.md#anomalies-worth-a-look); not changed.
