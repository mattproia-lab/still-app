# index.html — Architecture Map

_Table of contents for [`index.html`](../../../index.html), not a copy of it. Refreshed 2026-09-07 by a structural pass over the `redesign/practices` branch at `8362db1` (17,892 lines; 98 commits ahead of `main`). Every region below is a pointer into the live file — **read the code, not this page, for what anything does.** Line numbers drift with every edit; treat them as ±50 and refresh this page when structure changes ([CLAUDE.md](../../CLAUDE.md)). The previous map (2026-08-22, 15,773 lines) predates the redesign; what it described that no longer exists is listed at the end._

Companion pages: [stack.md](stack.md) (services, platforms) · [deploy.md](deploy.md) (Netlify, `www/` sync) · [subscription-paths.md](subscription-paths.md) (how access is decided). The visual system itself is documented in [DESIGN.md](../../../DESIGN.md) at the repo root, not here.

## Top-level file layout

| Lines | Contents |
|---|---|
| 1–8 | `<head>`, meta (`viewport-fit=cover`), fonts |
| 9–1095 | **First stylesheet.** Design tokens 57 (`:root`, `body.readable` 110, reduced-motion overrides 122); background system 139 (`.bg-base`, the lancet window, floor pool, grain); screen system 162 (`.screen` fixed, `visibility` with the fade); shared header 178; feature content area 203; home 287; **token-screen shared components** 414 (`.atmos` 432, header/frame 468, phase track, type roles, ring 544, buttons); Contemplative Sitting 606 (the reference implementation); the Companion remnant 726; other-screen scaffold 759; settings modal 812; **mobile responsive block** 850 (the `!important` rules and the `[style*="font-size"]` rewrites at 1082) |
| 1096–1106 | Hash-route script |
| 1108 | `<body>` |
| 1112–1143 | The Sacristy (hidden image gallery) markup |
| 1144–1342 | Onboarding: `#ob-1` 1148 (photograph step), `#ob-2` 1189 (the Guestmaster's letter as text, `data-tokens`); its scripts 1229 (`pinDocument`, the document-never-scrolls guard), 1280 (the letter's two doors), 1315 (store badges) |
| 1337 | `<script src="still-mobile/sing-the-hours.js">` |
| 1343–1411 | Sign-in overlay `#authOverlay` (`data-tokens`) |
| 1412–1546 | Paywall `#paywall` (`data-tokens`; plans, code field `#pwCode`, trial info); its display-logic script 1469 |
| 1547–1560 | Trial terms screen `#trialTerms` |
| 1561–1730 | One script, four display-only IIFEs: the terms screen's number words 1562, the trial's one reminder 1605, **Over time** graph 1638, the App Store review request 1683 (`still_review_requested`, 15 entries, `[NEEDED: plugin]` at 1691) |
| 1735–1763 | `#bgBase`, `.lancet-wrap` (the stained-glass window `animateTo()` paints), floor pool, stone border, grain |
| 1764–1885 | Home `#home` (the only `.screen` without `data-tokens` besides Night Watch and Resources); ⓘ pulse script 1858 |
| 1886–3974 | **Practice screens** — see the next table. Display-only scripts in the body: timer rings 2083 (`RINGS` 2091), Breath orb 2580, Office atmosphere by hour 2785, the voices' share card 3042 |
| 3553–3572 | Info panel `#infoOverlay` / `#infoPanel` |
| 3573–~3700 | Settings modal `#settingsModal` (readable toggle 3683, fasting toggle 3622, bell voice picker ~3750) |
| 3975–4232 | **The Dialogue Chamber** markup `#screen-dialogue` (`data-tokens`, fixed, not a `.screen`); its ring-watcher script 4198 |
| 4233–5780 | **Second stylesheet — every practice on the tokens.** Chamber 4237, Darkness 4460, Lectio 4505, Office 4674, Examen 4777, Breath 4835, Rule 4932, Autobiography 5046, **the voices** 5163, Settings 5264, Paywall 5382, Trial terms 5444, the letter 5472, Saint of the Day 5495, Rosary 5606, Sign-in 5743 |
| **5782–16812** | **The main application script** — everything in the sections below |
| 16814–16844 | `bumpFonts()` (phone UAs only; skips `[data-tokens]`) |
| 16846–16860 | Touch and zoom guards |
| 16861–17723 | **Dialogue Chamber module** (`DC` IIFE 16863; wiring to Still 17715–17722) |
| 17724–17731 | Safari keepalive |
| 17732 | `<script src="bell-native.js">` |
| 17733–17891 | Desert Fathers weekly series — native local-notification scheduler (Capacitor only) |

## Screens and overlays

Every practice is one `<div id="screen-…" class="screen">`, shown by `showScreen()` (6407), entered through `enterFeature()` (6562), which dispatches to the practice's init. `data-tokens` scopes a screen into the shared components and exempts it from `bumpFonts()`.

| Screen | Markup | Tokens | Init / owner |
|---|---|---|---|
| Home | 1764 | no | `buildBeads` 6451, `homeActivate` 6523 |
| Contemplative Sitting | 1886 | yes | state machine 6912+, `startSitting` 6939, `completeSitting` 9159 |
| Rosary Meditations (`#screen-witnesses`) | 2137 | yes | `CoW` 7259, `initWitnesses` 7585 |
| Lectio Divina | 2171 | yes | `initLectio` 9803, machine `lectioGoTo` 8646 |
| Examen | 2461 | yes | `initExamen` 12751 |
| Darkness Mode | 2483 | yes | `initDarknessScreen` 12872 |
| Breath Prayer (`#screen-breath`) | 2515 | yes | `startHeartPrayer` 14624 |
| The Companion | 2600 | yes (`.voice-screen`) | `askCompanion` 7700 |
| Saint of the Day | 2682 | yes (`data-color`) | `initSaintScreen` 8101 |
| Divine Office (`#screen-office`) | 2713 | yes (`data-hour`) | `initOfficeScreen` 16207, `enterOfficeHour` 15216 |
| Rule of Life | 2818 | yes | `loadRuleItems` 11589 |
| Spiritual Autobiography (Amma Sophia's tab `#autobio-mystic` 2986) | 2874 | yes | `initAutobio` 9363, `renderMysticTab` 7788 |
| Deeper | 3205 | yes (`.voice-screen`) | `askDeeper` 7903 |
| Night Watch | 3280 | no | `checkNightWatch` 12977 (2–4am only) |
| Resources | 3318 | no (inline styles) | static |
| The Dialogue Chamber | 3975 | yes (own `.dc-screen`, not `.screen`) | `DC.init` 16863+ |

Overlays that are not screens: the Guide (built by JS, `Guide` 11800), Spiritual Paths (built by JS, `Paths` 10150), Settings 3573, Info panel 3554, the Crisis card (built by JS, `Crisis` 9175), the Sacristy 1112, the paywall 1412, sign-in 1343, onboarding 1144.

## Major systems in the main script (5782–16812)

### Shell

| System | Region | Entry points |
|---|---|---|
| Voice player | 5782–6120 | `requestVoice` 5821 → `still-tts.onrender.com/tts` 5832; `CHARACTER_AMBIENCE` 5881; `playVoiceUrl` 5889; Office pacing `paceOfficeText` 5988, `/office-tts` 6055 |
| Feature and colour data | 6121–6200 | `F[]` 6121 (the home list; `screen` names drive the router), `W[]` 6173 (one RGB per practice; the same triplets are the `--atmos-rgb` values in the stylesheet) |
| `FN_BASE` | 6201 | native → `https://stillprayer.app`, web → `''` |
| Colour animation | 6205–6406 | `animateTo` 6244 |
| Router | 6407–6443, 6562–6617 | `showScreen` 6407, `goHome` 6431 and again 6610 (the second wins), `activateCompanion` 6438, `enterFeature` 6562 |
| Boot | 6618–6700 | `DOMContentLoaded`: auth overlay lift, onboarding gate, `still_readable` 6449 |
| Home | 6444–6700 | `buildBeads` 6451, `homeActivate` 6523 |
| Bells (playback) | 6701–6776 | `loadBellFile` 6730, `playBell` 6743 |
| Recording | 6777–6911 | MediaRecorder, blob URLs, no upload |
| Mobile enter tab | 16261–16326 | `initMobileScroll` 16289 |
| Spiritual depth, Office rite | 16327–16471 | `getLiturgicalRite` 16355 |
| Settings helpers | 16472–16811 | `openSettings` 16507, `showUpgrade` 16562, `initRevenueCat` 16723, fasting 16474, readable 16511 |

### Practices

| Practice | Region | Notes |
|---|---|---|
| Contemplative Sitting | 6912–7258 | machine 6912, wake lock 7010, `tapThought` 7096, `drawThoughtGraph` 7141; Over time and the review request read its save from the body script at 1561 |
| The Guestmaster's letter | 7244 | `playGuestmasterAudio`; the source is detached whenever the letter is off screen (`data-src` at 1223) |
| Rosary Meditations | 7259–7586 | `CoW` IIFE: `DAY_SET`, `PRAYERS`, `loadSet` → `assets/rosary/<set>.json` 7285, `drawPool`, rosary TTS 7483, the Madonna close 7532 |
| **The voices** | 7587–7976 | one pattern: `COMPANION_SYSTEM` 7589, `DEEPER_SYSTEM` 7609, `askCompanion` 7700, `askMystic` 7827 (Amma Sophia, `MYSTIC_SYSTEM` 7808), `askDeeper` 7903. Each writes to its `.companion-state` panels; the photograph is a threshold shown only while the opening is on screen (stylesheet 5163). Rate limit for the Companion 14583–14609 |
| **The liturgical day** | 8001–8085 | `Liturgy` IIFE 8018: `assets/calendar/general/<year>.json` 8028, `assets/calendar/traditional/<year>.json` 8033, `assets/saints/lives.json` 8038; `getTodaysSaint` 8073 answers synchronously once the year and the lives have loaded |
| **Saint of the Day** | 8086–8185 | `initSaintScreen` 8101 sets `data-color` from the day's liturgical colour; the 183 lives are data, not code |
| Lectio Divina | 8186–8946 | `LP1`–`LP8` 8186+ → `PASSAGES` 8578; fast-day passages 8591; `lectioGoTo` 8646; `generateLectioQ` 8797, `generateClosingPrayer` 8871 (both through `claude.js`) |
| Spiritual Autobiography | 9343–9820 | `saveJournalEntry` 9448, `buildMonthNarrative` 9512 (`claude.js`), `buildLocalNarrative` 9595 (works with no AI) |
| Spiritual Paths | 10150–11503 | `Paths` object: `DISCERNMENT` 10155, backgrounds 10323–10326 (`paths-bg.webp`, `center-bg.webp`), `_upgradeReflection` 10792 (`claude.js`), **Reading Toward the Center** `CENTER_SCRIPTURE` 10913, progress `still_center_lit` 11380 |
| Rule of Life | 11504–11799 | `loadRuleItems` 11589; `still_rule_items`, mirrored as one upserted row through `Sync` |
| The Guide | 11800–12737 | `Guide` IIFE; returns `{ open, close, memoryDigest, setTheme }` 12735 |
| Examen | 12738–12837 | `EXAMEN_QUESTIONS` 12740, `renderExamenStep` 12765 |
| Darkness Mode | 12838–12932 | `DARKNESS_TEXTS` 12840 (seven texts, two of them psalms); `initDarknessScreen` 12872, `renderDarknessText` 12891; audio `playDarknessReflection` 13700 → `tag-darkness` 13709 and `/office-tts` 13719 |
| Night Watch | 12952–13025 | `checkNightWatch` 12977 |
| Breath Prayer | 14610–14779 | `startHeartPrayer` 14624 |
| Practice calendar | 14793–14900 | `renderPracticeCalendar` 14796; presence marks, no streaks |
| **Divine Office** | 14901–16260 | season 14901 (`getLiturgicalSeason`), `OFFICE_SEASONS` 14984, `OFFICE_READINGS` 15074, `OFFICE_COLLECTS` 15099, `enterOfficeHour` 15216, `officeGoChooser` 15251, **traditional corpus** `OFFICE_CORPUS_ENDPOINT` 15280 (`/.netlify/functions/office-corpus`, cache `still_office_corpus_v1`, 24 hours kept), `prefetchOffice` 15387, `buildTraditionalOffice` 15487, `buildOffice` 15782, `renderOfficeHTML` 16096 (screen) and `renderOfficeText` 16164 (speech), `renderOfficeHour` 16172, `initOfficeScreen` 16207; Sing the Hours episodes `initSingTheHours` 13769 |

### Data layer

| System | Region | Notes |
|---|---|---|
| `DB` | 8947–8990 | localStorage journal `still_entries`; every practice's `DB.save(type, …)` |
| `Memory` | 8991–9158 | cross-practice recall for the voices; `updateProfile` 9127 (`claude.js`); `label()` at 8996 has no entry for `chamber` |
| `Crisis` | 9175–9249 | crisis-language patterns and the resources card |
| `VoiceCredit` | 9250–9342 | audio top-up; `stripe-checkout` 9267 |
| `Sync` | 9821–9967 | pushes entries to Supabase; `DB.save` is wrapped at 9951 |
| `StorageSettings` | 9968–10149 | Storage & Privacy panel |
| Info panel | 13026–13325 | `openInfo` 13276; the "why this exists" texts per practice |
| Supabase | 13341–13746 | `SUPA_URL` 13344, `onAuthed` 13354, `getValidToken` 13489, `continueAsGuest` 13590, `requireAccount` 13599; delete account `showDeleteAccount` 6329 → `delete-account` 6377 |
| Analytics | 13747–13783 | `trackEvent` 13750 |
| Sacristy, Shop | 13784–13949 | `openSacristy` 13858 (reads `still-mobile/src/image/…` 13787–13797 and `assets/rosary/madonna.jpg` 13817), `openShop` 13872 |

### Trial, paywall, purchases

Trace in this order. The client-side rule is one number: `PAYWALL_DAYS = 14` from first open, nothing else; the session counter is retired (`PW_SESSIONS_KEY` kept only for `redeemPromoCode`).

1. **Trial state** 13950–14112 — keys 13975–13984 (`still_trial_start`, `still_paid`, `still_plan`, `still_sub_status`, `still_trial_ext`, `still_trial_terms_shown`, `still_trial_reminder_shown`, dev override `still_trial_debug`); `initTrial` 13986, `isSubscribed` 13995, `getTrialDaysLeft` 14073, `trialExtensionActive` 14084, `trialIsOver` 14091, `shouldShowPaywall` 14099.
2. **Paywall** — markup 1412, display logic 1469, `showPaywall` 14113, `PAYWALL_PRICES` beside the constants; terms screen 1547 with its script at 1561; the one reminder 1605.
3. **Web, Stripe** — `stripe-checkout` at 9267 (`VoiceCredit`), 16669 and 16708 (settings helpers); `checkStripeReturn` 14162, `showWelcomePremium` 14202.
4. **Native, RevenueCat** — `initRevenueCat` 16723, `showUpgrade` 16562, `restorePurchases` 14554; `Purchases.logIn` on sign-in in `onAuthed`.
5. **Codes** — `redeemPromoCode` 14452 → `redeem-code` 14468. The code field is hidden on native (Apple 3.1.1).

Server side: [`stripe-checkout.js`](../../../netlify/functions/stripe-checkout.js), [`stripe-webhook.js`](../../../netlify/functions/stripe-webhook.js), [`revenuecat-webhook.js`](../../../netlify/functions/revenuecat-webhook.js), [`redeem-code.js`](../../../netlify/functions/redeem-code.js); migrations under [`supabase/migrations/`](../../../supabase/migrations). Full trace: [subscription-paths.md](subscription-paths.md).

### Onboarding, settings, bells

| System | Region | Notes |
|---|---|---|
| Onboarding | 14239–14440 | `obNext` 14261, `obFinish` 14376 (`still_onboarded`); the letter markup at 1189 |
| Bell schedule and prefs | 14441–14580 | `toggleBell` 14441, `saveBellSettings` 14501 (Supabase `bell_preferences`); picker in the settings markup ~3750 (`assets/bell-*.wav`) |
| Settings modal script | 12933–12951 | `toggleFasting` 12935, `toggleReadable` 12940 (`still_readable`, `body.readable`) |
| Keyboard navigation | 13326–13337 | |
| Wake lock, Office | 14780–14792 | |

### The Dialogue Chamber (16861–17723)

`DC` IIFE 16863. Config 16865 (bell, the three environment videos, `apiEndpoint`, `apiFeature: 'chamber'`, model); voices `DC_VOICE_SYSTEM` 16880 and `DC_SUGGEST_SYSTEM`; `CORPUS` (Siena, Genoa, psalms) and `THRESHOLD_QUOTES`; crisis mirror `DC_SEVERE` / `DC_TENDER`; state `S` and `store` (`dc_visits`, `dc_pace`, `dc_margin`, `dc_remember`, `dc_carry`); `show()` lists the fourteen phases; `buildEnv` / `setEnv` (sea, bridge, flame); `callStill` → `claude.js`; phases `init`, `enterCell`, `chooseDoor`, `offer`, `renderWord`, the Colloquy (`startColloquy` … `colBless`), `recordVisit` (the one `DB.save('chamber', …)` per session), `carryLine` (the other, plus `dc_carry`), `showMargin`. Wiring at 17715–17722 sets the endpoint, the asset paths, `onLeave` → `goHome()`, `onRemain` → Sitting with `window.dcSkipSettle`. Visual layer: markup 3975, stylesheet 4237, DESIGN.md "The Dialogue Chamber".

## Netlify functions (20 on disk)

Called through `window.FN_BASE + '/.netlify/functions/<name>'`. Directory: [`netlify/functions/`](../../../netlify/functions).

| Function | Called from |
|---|---|
| `claude.js` | every LLM voice — 11 call sites: the Companion 7712, Amma Sophia 7847, Deeper 7917, Lectio 8812 and 8890, `Memory.updateProfile` 9133, the Autobiography 9574, Paths 10799, the Chamber 16871/17211/17712 |
| `office-corpus.js` | the traditional Office, 15280; reads `corpus/traditional/` through `included_files` in `netlify.toml` (33), never over HTTP |
| `tag-darkness.js`, `tag-response.js` | text pre-tagging for TTS pauses, 13709 and 5807 |
| `stripe-checkout.js`, `stripe-webhook.js`, `revenuecat-webhook.js`, `redeem-code.js` | subscription flow above; the webhooks are called by Stripe and RevenueCat, not the page |
| `delete-account.js` | 6377 |
| `rss-proxy.js` | [`still-mobile/sing-the-hours.js`](../../../still-mobile/sing-the-hours.js) only |
| `create-promo-code.js`, `referral-report.js` | [`partners.html`](../../../partners.html) only (web-only page, never in `www/`) |
| `bell-vigils/lauds/vespers/compline.js` | no in-page caller on this branch; `bell-native.js` schedules local notifications and does not call them |
| `community-submit.js`, `community-report.js` | **no caller** — Community is gone from the app |
| `send-notifications.js`, `generate-demo-audio.js` | no in-page caller (push and demo audio are operator tools) |

TTS is not a Netlify function: `still-tts.onrender.com` (`/tts` 5832, `/office-tts` 6055 and 13719, `/rosary-tts` 7483).

## Tools (build-time only, nothing ships)

[`tools/`](../../../tools):

- `liturgical-calendar/` — romcal 1.3.0 devDependency; `npm run build` writes `assets/calendar/general/2026…2030.json`; `extract-lives.js` writes `assets/saints/lives.json`. README in the folder.
- `office-corpus/` — Python; drives Divinum Officium's own renderer per date and hour and parses its HTML into `corpus/traditional/` (calendar index, propers, psalms, hymn and canticle maps; `assert_*.py` tests). Decision record: [`2026-08-24-office-corpus-json-shape.md`](../../raw/decisions/2026-08-24-office-corpus-json-shape.md).
- `validate-dr.py` and `dr-bible.json` — Douay-Rheims validation of quoted Scripture.
- `fetch-rosary-images.mjs` and `rosary-image-report.json` — the sacred-art fetch for `assets/rosary/`.

Root-level `generate-demo-audio.js` and `generate-bedtime-stories.js` are operator scripts of the same kind; `diff.txt` at the root is a stray.

## Assets the app reads

Paths are relative to the repo root and to `www/` after a sync. Anything not listed here is on disk but not loaded by `index.html`.

| Path | Read by |
|---|---|
| `assets/grain-256.png` | the shared grain tile, stylesheet 158/460/587/4265/4475 |
| `assets/bell.mp3` | the Chamber's bell 16867 |
| `assets/bell-abbey.wav`, `bell-call.wav`, `bell-tower.wav`, `bell-village.wav` | the bell voice picker ~3754; `bell-call` also the Desert Fathers notifications 17823 |
| `assets/candle.mp4` | Sitting's candle video 3292 and the Chamber's flame environment 17718 |
| `assets/sea_loop.mp4`, `assets/bridge_loop.mp4` | the Chamber's sea and bridge environments 17719–17720 |
| `assets/paths-bg.webp`, `assets/center-bg.webp` | Spiritual Paths 10323–10326 |
| `assets/badge-googleplay.png` | store badges 1171 |
| `assets/calendar/general/<year>.json` (2026–2030), `assets/calendar/traditional/<year>.json` (2026–2028) | `Liturgy` 8028–8033 |
| `assets/saints/lives.json` | `Liturgy` 8038 |
| `assets/rosary/{joyful,sorrowful,glorious,luminous}.json` | `CoW.loadSet` 7285 (307 meditations) |
| `assets/rosary/cloud-of-witnesses.jpg`, `assets/rosary/madonna.jpg` | the Rosary screen 2158 and its close 7532; the Sacristy 13817 |
| `assets/rosary/*.jpg` (103) | the Sacristy gallery |
| `still-mobile/sing-the-hours.js` | 1337 |
| `still-mobile/assets/Guestmaster_audio.mp3` | the letter, 1223 (`data-src`, attached only while the letter is open) |
| `still-mobile/assets/{companion,deeper,ammaSophia}_demo.mp3` | onboarding demos 3509–3535, 14300–14302 |
| `still-mobile/src/audio/nature_sounds.mp3`, `deeper_music.mp3`, `amma_ambient.mp4` | `CHARACTER_AMBIENCE` 5882–5884, 14294–14296 |
| `still-mobile/src/image/hero.mp4` | onboarding 1151 |
| `still-mobile/src/image/{companion,deeper,autobiography,saint,darkness,nightwatch}_bg.jpg` | practice thresholds and backdrops 2495–3283 (Darkness's is a threshold only) |
| `still-mobile/src/image/churchposter.png` | Resources 3332 |
| `still-mobile/src/image/{splash_bg,still_bg,guestmaster_letter,amma-sophia}.jpg` | the Sacristy 13787–13797 |

On disk but not read by `index.html` on this branch: `assets/incense.mp4`, `assets/candlelauds.jpg`, `assets/guide-bg.webp`, `assets/icon.png`, and the retired backgrounds `still-mobile/src/image/{lectio,examen,breath,rule,bedtime,community,night}_bg.jpg` and the `*_question.jpg` set. `corpus/` (26 MB) is read only by the `office-corpus` function; `/corpus/*` is a forced 404 on the site. `practices/` is the web-only SEO folder, never synced to `www/`.

## Gone since the 2026-08-22 map

- **Community** — screen, question and responses, `community-submit`/`community-report` callers, and the direct `api.anthropic.com` fallback that was the old map's "known anomaly". The functions remain on disk with no caller; the violet became the Rosary's hue.
- The session-count paywall (`PAYWALL_SESSIONS`) and the day-30 discount.
- The Guestmaster's letter as an audio-first step; it is text with optional audio.
- The Office written out three times (see the comment at 15766); one `buildOffice` now serves screen and speech.
- `The Office` as the practice's name; it is Divine Office everywhere the user sees it (the Memory digest label at 8997 still says "the Office").

## New since the 2026-08-22 map

- The DESIGN.md token system and the second stylesheet (4233–5780); every practice screen except Home, Night Watch and Resources carries `data-tokens`.
- Saint of the Day and the liturgical day (`Liturgy`), with the calendar and the lives as JSON under `assets/`.
- The traditional Office corpus and its Netlify function.
- Readable mode (`body.readable`), Over time, the trial's one reminder, the review request, the Chamber on the tokens.
