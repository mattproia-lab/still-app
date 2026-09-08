# index.html — Architecture Map

_Table of contents for [`index.html`](../../../index.html), not a copy of it. Refreshed 2026-09-08 by re-finding every pointer in the `redesign/practices` branch at `a520a7c` (18,090 lines; 134 commits ahead of `main`); the structural pass was 2026-09-07 at `8362db1`. Every region below is a pointer into the live file — **read the code, not this page, for what anything does.** Line numbers drift with every edit; treat them as ±50 and refresh this page when structure changes ([CLAUDE.md](../../CLAUDE.md)). The previous map (2026-08-22, 15,773 lines) predates the redesign; what it described that no longer exists is listed at the end._

Companion pages: [stack.md](stack.md) (services, platforms) · [deploy.md](deploy.md) (Netlify, `www/` sync) · [subscription-paths.md](subscription-paths.md) (how access is decided). The visual system itself is documented in [DESIGN.md](../../../DESIGN.md) at the repo root, not here.

## Top-level file layout

| Lines | Contents |
|---|---|
| 1–8 | `<head>`, meta (`viewport-fit=cover`), fonts |
| 9–1095 | **First stylesheet.** Design tokens 57 (`:root`, `body.readable` 110, reduced-motion overrides 122); background system 139 (`.bg-base`, the lancet window, floor pool, grain); screen system 162 (`.screen` fixed, `visibility` with the fade); shared header 178; feature content area 203; home 287; **token-screen shared components** 414 (`.atmos` 432, header/frame 468, phase track, type roles, ring 544, buttons); Contemplative Sitting 606 (the reference implementation); the Companion remnant 726; other-screen scaffold 759; settings modal 812; **mobile responsive block** 850 (the `!important` rules and the `[style*="font-size"]` rewrites at 1082) |
| 1096–1106 | Hash-route script |
| 1108 | `<body>` |
| 1115–1146 | The Sacristy (hidden image gallery) markup |
| 1147–1367 | Onboarding: `#ob-1` 1158 (photograph step), `#ob-2` 1228 (the Guestmaster's letter as text, `data-tokens`); its scripts 1268 (`pinDocument`, the document-never-scrolls guard), 1319 (the letter's two doors), 1354 (store badges) |
| 1362 | `<script src="still-mobile/sing-the-hours.js">` |
| 1368–1436 | Sign-in overlay `#authOverlay` (`data-tokens`) |
| 1437–1571 | Paywall `#paywall` (`data-tokens`; plans, code field `#pwCode`, trial info); its display-logic script 1494 |
| 1572–1585 | Trial terms screen `#trialTerms` |
| 1586–1759 | One script, four display-only IIFEs: the terms screen's number words 1587, the trial's one reminder 1641, **Over time** graph 1663, the App Store review request 1712 (`still_review_requested`, 15 entries, `[NEEDED: plugin]` at 1720) |
| 1760–1788 | `#bgBase`, `.lancet-wrap` (the stained-glass window `animateTo()` paints), floor pool, stone border, grain |
| 1789–1910 | Home `#home` (the only `.screen` without `data-tokens` besides Night Watch and Resources); ⓘ pulse script 1883 |
| 1911–3999 | **Practice screens** — see the next table. Display-only scripts in the body: timer rings 2108 (`RINGS` 2116), Breath orb 2605, Office atmosphere by hour 2810, the voices' share card 3068 |
| 3578–3597 | Info panel `#infoOverlay` / `#infoPanel` |
| 3598–~3725 | Settings modal `#settingsModal` (readable toggle 3708, fasting toggle 3647, bell voice picker ~3779) |
| 4000–4257 | **The Dialogue Chamber** markup `#screen-dialogue` (`data-tokens`, fixed, not a `.screen`); its ring-watcher script 4223 |
| 4258–5904 | **Second stylesheet — every practice on the tokens.** Chamber 4270, Darkness 4489, Lectio 4534, Office 4704, Examen 4806, Breath 4869, Rule 4963, Autobiography 5080, **the voices** 5217, Settings 5302, Paywall 5416, Trial terms 5473, the onboarding door 5503, the letter 5602, Saint of the Day 5624, Rosary 5738, Sign-in 5873 |
| **5906–17010** | **The main application script** — everything in the sections below |
| 17014–17044 | `bumpFonts()` (phone UAs only; skips `[data-tokens]`) |
| 17046–17060 | Touch and zoom guards |
| 17061–17921 | **Dialogue Chamber module** (`DC` IIFE 17061; wiring to Still 17913–17920) |
| 17923–17930 | Safari keepalive |
| 17930 | `<script src="bell-native.js">` |
| 17933–18090 | Desert Fathers weekly series — native local-notification scheduler (Capacitor only) |

## Screens and overlays

Every practice is one `<div id="screen-…" class="screen">`, shown by `showScreen()` (6594), entered through `enterFeature()` (6749), which dispatches to the practice's init. `data-tokens` scopes a screen into the shared components and exempts it from `bumpFonts()`.

| Screen | Markup | Tokens | Init / owner |
|---|---|---|---|
| Home | 1789 | no | `buildBeads` 6638, `homeActivate` 6710 |
| Contemplative Sitting | 1911 | yes | state machine 7099+, `startSitting` 7126, `completeSitting` 9349 |
| Rosary Meditations (`#screen-witnesses`) | 2162 | yes | `CoW` 7446, `initWitnesses` 7775 |
| Lectio Divina | 2196 | yes | `initLectio` 9993, machine `lectioGoTo` 8836 |
| Examen | 2486 | yes | `initExamen` 12941 |
| Darkness Mode | 2508 | yes | `initDarknessScreen` 13062 |
| Breath Prayer (`#screen-breath`) | 2540 | yes | `startHeartPrayer` 14822 |
| The Companion | 2625 | yes (`.voice-screen`) | `askCompanion` 7890 |
| Saint of the Day | 2707 | yes (`data-color`) | `initSaintScreen` 8291 |
| Divine Office (`#screen-office`) | 2738 | yes (`data-hour`) | `initOfficeScreen` 16405, `enterOfficeHour` 15414 |
| Rule of Life | 2843 | yes | `loadRuleItems` 11779 |
| Spiritual Autobiography (Amma Sophia's tab `#autobio-mystic` 3011) | 2899 | yes | `initAutobio` 9553, `renderMysticTab` 7978 |
| Deeper | 3230 | yes (`.voice-screen`) | `askDeeper` 8093 |
| Night Watch | 3305 | no | `checkNightWatch` 13167 (2–4am only) |
| Resources | 3343 | no (inline styles) | static |
| The Dialogue Chamber | 4000 | yes (own `.dc-screen`, not `.screen`) | `DC.init` 17061+ |

Overlays that are not screens: the Guide (built by JS, `Guide` 11990), Spiritual Paths (built by JS, `Paths` 10340), Settings 3598, Info panel 3578, the Crisis card (built by JS, `Crisis` 9365), the Sacristy 1115, the paywall 1437, sign-in 1368, onboarding 1147.

## Major systems in the main script (5906–17010)

### Shell

| System | Region | Entry points |
|---|---|---|
| Voice player | 5906–6300 | `AudioFetch` 5954 (the screen lock held around every voice and Office fetch, with the one retry on return); `requestVoice` 5988 → `still-tts.onrender.com/tts` 6005; `CHARACTER_AMBIENCE` 6061; `playVoiceUrl` 6069; Office pacing `paceOfficeText` 6168, `/office-tts` 6235 |
| Feature and colour data | 6308–6387 | `F[]` 6308 (the home list; `screen` names drive the router), `W[]` 6360 (one RGB per practice; the same triplets are the `--atmos-rgb` values in the stylesheet) |
| `FN_BASE` | 6388 | native → `https://stillprayer.app`, web → `''` |
| Colour animation | 6392–6593 | `animateTo` 6432 |
| Router | 6594–6630, 6749–6804 | `showScreen` 6594, `goHome` 6618 and again 6797 (the second wins), `activateCompanion` 6625, `enterFeature` 6749 |
| Boot | 6805–6887 | `DOMContentLoaded`: auth overlay lift, onboarding gate, `still_readable` 6636 |
| Home | 6631–6887 | `buildBeads` 6638, `homeActivate` 6710 |
| Bells (playback) | 6888–6963 | `loadBellFile` 6917, `playBell` 6930 |
| Recording | 6964–7098 | MediaRecorder, blob URLs, no upload |
| Mobile enter tab | 16459–16524 | `initMobileScroll` 16487 |
| Spiritual depth, Office rite | 16525–16669 | `getLiturgicalRite` 16553 |
| Settings helpers | 16670–17009 | `openSettings` 16705, `showUpgrade` 16760, `initRevenueCat` 16921, fasting 16672, readable 16709 |

### Practices

| Practice | Region | Notes |
|---|---|---|
| Contemplative Sitting | 7099–7445 | machine 7099, wake lock 7197, `tapThought` 7283, `drawThoughtGraph` 7328; Over time and the review request read its save from the body script at 1586 |
| The Guestmaster's letter | 7431 | `playGuestmasterAudio`; the source is detached whenever the letter is off screen (`data-src` at 1262) |
| Rosary Meditations | 7446–7776 | `CoW` IIFE: `DAY_SET`, `PRAYERS`, `loadSet` → `assets/rosary/<set>.json` 7470, `drawPool`, rosary TTS 7671, the Madonna close 7722 |
| **The voices** | 7777–8166 | one pattern: `COMPANION_SYSTEM` 7779, `DEEPER_SYSTEM` 7799, `askCompanion` 7890, `askMystic` 8017 (Amma Sophia, `MYSTIC_SYSTEM` 7998), `askDeeper` 8093. Each writes to its `.companion-state` panels; the photograph is a threshold shown only while the opening is on screen (stylesheet 5188). Rate limit for the Companion 14781–14807 |
| **The liturgical day** | 8191–8275 | `Liturgy` IIFE 8208: `assets/calendar/general/<year>.json` 8218, `assets/calendar/traditional/<year>.json` 8223, `assets/saints/lives.json` 8228; `getTodaysSaint` 8263 answers synchronously once the year and the lives have loaded |
| **Saint of the Day** | 8276–8375 | `initSaintScreen` 8291 sets `data-color` from the day's liturgical colour; the 183 lives are data, not code |
| Lectio Divina | 8376–9136 | `LP1`–`LP8` 8376+ → `PASSAGES` 8768; fast-day passages 8781; `lectioGoTo` 8836; `generateLectioQ` 8987, `generateClosingPrayer` 9061 (both through `claude.js`) |
| Spiritual Autobiography | 9533–10010 | `saveJournalEntry` 9638, `buildMonthNarrative` 9702 (`claude.js`), `buildLocalNarrative` 9785 (works with no AI) |
| Spiritual Paths | 10340–11693 | `Paths` object: `DISCERNMENT` 10345, backgrounds 10513–10516 (`paths-bg.webp`, `center-bg.webp`), `_upgradeReflection` 10982 (`claude.js`), **Reading Toward the Center** `CENTER_SCRIPTURE` 11103, progress `still_center_lit` 11570 |
| Rule of Life | 11694–11989 | `loadRuleItems` 11779; `still_rule_items`, mirrored as one upserted row through `Sync` |
| The Guide | 11990–12927 | `Guide` IIFE; returns `{ open, close, memoryDigest, setTheme }` 12925 |
| Examen | 12928–13027 | `EXAMEN_QUESTIONS` 12930, `renderExamenStep` 12955 |
| Darkness Mode | 13028–13122 | `DARKNESS_TEXTS` 13030 (seven texts, two of them psalms); `initDarknessScreen` 13062, `renderDarknessText` 13081; audio `playDarknessReflection` 13890 → `tag-darkness` 13901 and `/office-tts` 13912 |
| Night Watch | 13142–13215 | `checkNightWatch` 13167 |
| Breath Prayer | 14808–14977 | `startHeartPrayer` 14822 |
| Practice calendar | 14991–15098 | `renderPracticeCalendar` 14994; presence marks, no streaks |
| **Divine Office** | 15099–16458 | season 15099 (`getLiturgicalSeason`), `OFFICE_SEASONS` 15182, `OFFICE_READINGS` 15272, `OFFICE_COLLECTS` 15297, `enterOfficeHour` 15414, `officeGoChooser` 15449, **traditional corpus** `OFFICE_CORPUS_ENDPOINT` 15478 (`/.netlify/functions/office-corpus`, cache `still_office_corpus_v1`, 24 hours kept), `prefetchOffice` 15585, `buildTraditionalOffice` 15685, `buildOffice` 15980, `renderOfficeHTML` 16294 (screen) and `renderOfficeText` 16362 (speech), `renderOfficeHour` 16370, `initOfficeScreen` 16405; Sing the Hours episodes `initSingTheHours` 13967 |

### Data layer

| System | Region | Notes |
|---|---|---|
| `DB` | 9140–9180 | localStorage journal `still_entries`; every practice's `DB.save(type, …)` |
| `Memory` | 9181–9348 | cross-practice recall for the voices; `updateProfile` 9317 (`claude.js`); `label()` at 9186 has no entry for `chamber` |
| `Crisis` | 9365–9439 | crisis-language patterns and the resources card |
| `VoiceCredit` | 9456–9532 | audio top-up; `stripe-checkout` 9457 |
| `Sync` | 10011–10157 | pushes entries to Supabase; `DB.save` is wrapped at 10141 |
| `StorageSettings` | 10185–10366 | Storage & Privacy panel |
| Info panel | 13216–13515 | `openInfo` 13466; the "why this exists" texts per practice |
| Supabase | 13531–13939 | `SUPA_URL` 13534, `onAuthed` 13544, `getValidToken` 13679, `continueAsGuest` 13780, `requireAccount` 13789; delete account `showDeleteAccount` 6516 → `delete-account` 6564 |
| Analytics | 13940–13981 | `trackEvent` 13948 |
| Sacristy, Shop | 13982–14147 | `openSacristy` 14056 (reads `still-mobile/src/image/…` 13985–13995 and `assets/rosary/madonna.jpg` 14015), `openShop` 14070 |

### Trial, paywall, purchases

Trace in this order. The client-side rule is one number: `PAYWALL_DAYS = 14` from first open, nothing else; the session counter is retired (`PW_SESSIONS_KEY` kept only for `redeemPromoCode`).

1. **Trial state** 14148–14310 — keys 14173–14182 (`still_trial_start`, `still_paid`, `still_plan`, `still_sub_status`, `still_trial_ext`, `still_trial_terms_shown`, `still_trial_reminder_shown`, dev override `still_trial_debug`); `initTrial` 14184, `isSubscribed` 14193, `getTrialDaysLeft` 14271, `trialExtensionActive` 14282, `trialIsOver` 14289, `shouldShowPaywall` 14297.
2. **Paywall** — markup 1437, display logic 1494, `showPaywall` 14311, `PAYWALL_PRICES` beside the constants; terms screen 1572 with its script at 1586; the one reminder 1641.
3. **Web, Stripe** — `stripe-checkout` at 9457 (`VoiceCredit`), 16867 and 16906 (settings helpers); `checkStripeReturn` 14360, `showWelcomePremium` 14400.
4. **Native, RevenueCat** — `initRevenueCat` 16921, `showUpgrade` 16760, `restorePurchases` 14752; `Purchases.logIn` on sign-in in `onAuthed`.
5. **Codes** — `redeemPromoCode` 14650 → `redeem-code` 14666. The code field is hidden on native (Apple 3.1.1).

Server side: [`stripe-checkout.js`](../../../netlify/functions/stripe-checkout.js), [`stripe-webhook.js`](../../../netlify/functions/stripe-webhook.js), [`revenuecat-webhook.js`](../../../netlify/functions/revenuecat-webhook.js), [`redeem-code.js`](../../../netlify/functions/redeem-code.js); migrations under [`supabase/migrations/`](../../../supabase/migrations). Full trace: [subscription-paths.md](subscription-paths.md).

### Onboarding, settings, bells

| System | Region | Notes |
|---|---|---|
| Onboarding | 14437–14638 | `obNext` 14459, `obFinish` 14574 (`still_onboarded`); the letter markup at 1228 |
| Bell schedule and prefs | 14639–14778 | `toggleBell` 14639, `saveBellSettings` 14699 (Supabase `bell_preferences`); picker in the settings markup ~3779 (`assets/bell-*.wav`) |
| Settings modal script | 13123–13141 | `toggleFasting` 13125, `toggleReadable` 13130 (`still_readable`, `body.readable`) |
| Keyboard navigation | 13516–13527 | |
| Wake lock, Office | 14980–14990 | `requestOfficeLock` is defined and never called; only `releaseOfficeLock` runs (from `officeGoChooser`). The lock that actually protects the Office audio is `AudioFetch` 5954 |

### The Dialogue Chamber (17061–17921)

`DC` IIFE 17061. Config 17065 (bell, the three environment videos, `apiEndpoint`, `apiFeature: 'chamber'`, model); voices `DC_VOICE_SYSTEM` 17077 and `DC_SUGGEST_SYSTEM`; `CORPUS` (Siena, Genoa, psalms) and `THRESHOLD_QUOTES`; crisis mirror `DC_SEVERE` / `DC_TENDER`; state `S` and `store` (`dc_visits`, `dc_pace`, `dc_margin`, `dc_remember`, `dc_carry`); `show()` lists the fourteen phases; `buildEnv` / `setEnv` (sea, bridge, flame); `callStill` → `claude.js`; phases `init`, `enterCell`, `chooseDoor`, `offer`, `renderWord`, the Colloquy (`startColloquy` … `colBless`), `recordVisit` (the one `DB.save('chamber', …)` per session), `carryLine` (the other, plus `dc_carry`), `showMargin`. Wiring at 17913–17920 sets the endpoint, the asset paths, `onLeave` → `goHome()`, `onRemain` → Sitting with `window.dcSkipSettle`. Visual layer: markup 4000, stylesheet 4262, DESIGN.md "The Dialogue Chamber".

## Netlify functions (20 on disk)

Called through `window.FN_BASE + '/.netlify/functions/<name>'`. Directory: [`netlify/functions/`](../../../netlify/functions).

| Function | Called from |
|---|---|
| `claude.js` | every LLM voice — 11 call sites: the Companion 7902, Amma Sophia 8037, Deeper 8107, Lectio 9002 and 9080, `Memory.updateProfile` 9323, the Autobiography 9764, Paths 10989, the Chamber 17069/17409/17910 |
| `office-corpus.js` | the traditional Office, 15478; reads `corpus/traditional/` through `included_files` in `netlify.toml` (33), never over HTTP |
| `tag-darkness.js`, `tag-response.js` | text pre-tagging for TTS pauses, 13901 and 5931 |
| `stripe-checkout.js`, `stripe-webhook.js`, `revenuecat-webhook.js`, `redeem-code.js` | subscription flow above; the webhooks are called by Stripe and RevenueCat, not the page |
| `delete-account.js` | 6564 |
| `rss-proxy.js` | [`still-mobile/sing-the-hours.js`](../../../still-mobile/sing-the-hours.js) only |
| `create-promo-code.js`, `referral-report.js` | [`partners.html`](../../../partners.html) only (web-only page, never in `www/`) |
| `bell-vigils/lauds/vespers/compline.js` | no in-page caller on this branch; `bell-native.js` schedules local notifications and does not call them |
| `community-submit.js`, `community-report.js` | **no caller** — Community is gone from the app |
| `send-notifications.js`, `generate-demo-audio.js` | no in-page caller (push and demo audio are operator tools) |

TTS is not a Netlify function: `still-tts.onrender.com` (`/tts` 6005, `/office-tts` 6235 and 13912, `/rosary-tts` 7671).

## Tools (build-time only, nothing ships)

[`tools/`](../../../tools):

- `lectionary/` — Python, standard library; `build.py` writes `corpus/readings/2026…2030.json` (the Mass readings as citations, Sunday A/B/C and weekday I/II cycles, the proper of saints, a Douay-Rheims block) from the calendar, Felix Just's index tables and the cpbjr observations kept under `inputs/`; `verify.py` cross-checks. README in the folder; vault page [`lectionary.md`](../content/lectionary.md).
- `liturgical-calendar/` — romcal 1.3.0 devDependency; `npm run build` writes `assets/calendar/general/2026…2030.json`; `extract-lives.js` writes `assets/saints/lives.json`. README in the folder.
- `office-corpus/` — Python; drives Divinum Officium's own renderer per date and hour and parses its HTML into `corpus/traditional/` (calendar index, propers, psalms, hymn and canticle maps; `assert_*.py` tests). Decision record: [`2026-08-24-office-corpus-json-shape.md`](../../raw/decisions/2026-08-24-office-corpus-json-shape.md).
- `validate-dr.py` and `dr-bible.json` — Douay-Rheims validation of quoted Scripture.
- `fetch-rosary-images.mjs` and `rosary-image-report.json` — the sacred-art fetch for `assets/rosary/`.

Root-level `generate-demo-audio.js` and `generate-bedtime-stories.js` are operator scripts of the same kind; `diff.txt` at the root is a stray.

## Assets the app reads

Paths are relative to the repo root and to `www/` after a sync. Anything not listed here is on disk but not loaded by `index.html`.

| Path | Read by |
|---|---|
| `assets/grain-256.png` | the shared grain tile, stylesheet 158/460/587/4290/4500 |
| `assets/bell.mp3` | the Chamber's bell 17065 |
| `assets/bell-abbey.wav`, `bell-call.wav`, `bell-tower.wav`, `bell-village.wav` | the bell voice picker ~3779; `bell-call` also the Desert Fathers notifications 18021 |
| `assets/candle.mp4` | Sitting's candle video 3317 and the Chamber's flame environment 17912 |
| `assets/sea_loop.mp4`, `assets/bridge_loop.mp4` | the Chamber's sea and bridge environments 17913–17914 |
| `assets/paths-bg.webp`, `assets/center-bg.webp` | Spiritual Paths 10513–10516 |
| `assets/badge-googleplay.png` | store badges 1193 |
| `assets/calendar/general/<year>.json` (2026–2030), `assets/calendar/traditional/<year>.json` (2026–2028) | `Liturgy` 8218–8223 |
| `assets/saints/lives.json` | `Liturgy` 8228 |
| `assets/rosary/{joyful,sorrowful,glorious,luminous}.json` | `CoW.loadSet` 7470 (307 meditations) |
| `assets/rosary/cloud-of-witnesses.jpg`, `assets/rosary/madonna.jpg` | the Rosary screen 2183 and its close 7722; the Sacristy 14015 |
| `assets/rosary/*.jpg` (103) | the Sacristy gallery |
| `still-mobile/sing-the-hours.js` | 1362 |
| `still-mobile/assets/Guestmaster_audio.mp3` | the letter, 1262 (`data-src`, attached only while the letter is open) |
| `still-mobile/assets/{companion,deeper,ammaSophia}_demo.mp3` | onboarding demos 3534–3560, 14498–14500 |
| `still-mobile/src/audio/nature_sounds.mp3`, `deeper_music.mp3`, `amma_ambient.mp4` | `CHARACTER_AMBIENCE` 6062–6064, 14492–14494 |
| `assets/door/monk-cell.webp` | the onboarding door 1165 and 1176 (the monk in his cell; traced sources under `assets/source/`, ignored) |
| `still-mobile/src/image/{companion,deeper,autobiography,saint,darkness,nightwatch}_bg.jpg` | practice thresholds and backdrops 2520–3308 (Darkness's is a threshold only) |
| `still-mobile/src/image/churchposter.png` | Resources 3357 |
| `still-mobile/src/image/{splash_bg,still_bg,guestmaster_letter,amma-sophia}.jpg` | the Sacristy 13985–13995 |

On disk but not read by `index.html` on this branch: `still-mobile/src/image/hero.mp4` (the door's former video), `assets/readings/<year>.json` (the Lectionary table, 2026–2030, generated by `tools/lectionary/`; no reader yet), `assets/incense.mp4`, `assets/candlelauds.jpg`, `assets/guide-bg.webp`, `assets/icon.png`, and the retired backgrounds `still-mobile/src/image/{lectio,examen,breath,rule,bedtime,community,night}_bg.jpg` and the `*_question.jpg` set. `corpus/` (26 MB) is read only by the `office-corpus` function; `/corpus/*` is a forced 404 on the site. `practices/` is the web-only SEO folder, never synced to `www/`.

## Gone since the 2026-08-22 map

- **Community** — screen, question and responses, `community-submit`/`community-report` callers, and the direct `api.anthropic.com` fallback that was the old map's "known anomaly". The functions remain on disk with no caller; the violet became the Rosary's hue.
- The session-count paywall (`PAYWALL_SESSIONS`) and the day-30 discount.
- The Guestmaster's letter as an audio-first step; it is text with optional audio.
- The Office written out three times (see the comment at 15964); one `buildOffice` now serves screen and speech.
- `The Office` as the practice's name; it is Divine Office everywhere the user sees it (the Memory digest label at 9187 still says "the Office").

## New since the 2026-08-22 map

- The DESIGN.md token system and the second stylesheet (4258–5904); every practice screen except Home, Night Watch and Resources carries `data-tokens`.
- Saint of the Day and the liturgical day (`Liturgy`), with the calendar and the lives as JSON under `assets/`.
- The traditional Office corpus and its Netlify function.
- Readable mode (`body.readable`), Over time, the trial's one reminder, the review request, the Chamber on the tokens.
- Since the structural pass (2026-09-08): the base text levels one step brighter (tokens 89–90, readable mode 119–120); the onboarding door as the monk in his cell (1158–1230); `AudioFetch` 5954; the `?vv=1` viewport readout removed; the theology corpus under `vault/raw/theology/` and the Lectionary table under `corpus/readings/` and `assets/readings/` (data, not code).
