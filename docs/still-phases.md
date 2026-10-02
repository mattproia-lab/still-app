# Still — phase handoff

Written 2026-10-02. What has been done across the phased work, what is pushed,
and what is still open. Live code is ground truth wherever this page and the
code disagree; line numbers are deliberately omitted because they drift.

Companion pages: `vault/wiki/app/architecture.md` (the pointer map into
`index.html`), `vault/wiki/app/subscription-paths.md`, `DESIGN.md`,
`docs/deeper-test-questions.md` (the Deeper regression set).

---

## Standing rules this work followed

From `CLAUDE.md`, and worth repeating because two of them bit during the work:

- Single-file app. `index.html` + a Capacitor wrapper. No build step, no new
  dependencies, vanilla only.
- **After any change to `index.html`: `cp index.html www/index.html`.** Same
  for `bell-native.js`. Never copy `partners.html`, `delete-account.html`,
  `privacy.html`, `support.html`, `reset.html` into `www/`.
- Visual layer only — do not touch auth, payments, Netlify functions or
  Capacitor paths unless told. **Two exceptions were explicitly authorised:**
  the `events`/`profiles` migrations (Phase 2) and the `claude.js` passthrough
  (the Deeper model flag).
- Stage specific files by path. Never `git add .` or `-A`.
- Scripture is Douay-Rheims. Never invent quotes or attributions; mark gaps
  `[NEEDED: source]`.
- Every screen works at 390px. Honour `prefers-reduced-motion`.
- No streaks, no guilt language, no "you missed". Never force sign-in on first
  open.

### How changes were verified

There is no build step, so three throwaway harnesses did the checking. They
live in the session scratchpad, not the repo; recreate them if useful.

- **Inline-script syntax check** — extract every `<script>` from `index.html`
  and parse each with Node's `vm.Script`. 22 blocks, and this caught nothing
  only because every edit was assertion-guarded first.
- **Assertion-guarded edits** — every edit asserted its target string appeared
  exactly once before replacing. This caught two real ambiguities: a
  `SPIRITUAL AUTOBIOGRAPHY` banner that matched twice, and the Deeper/Companion
  reply handlers being byte-identical.
- **Behavioural harnesses** — the Office pacing output, the short-Hour builder,
  the Douay-Rheims lookup (21 cases), the sentence splitter, and the devotion
  matcher were each run in Node against the real assets.

---

## Phase 1 — investigation (no code)

Audited the trial, the premium check, analytics, the first run, every AI-audio
path, and the products on sale. Findings that shaped everything after:

- The trial is **one localStorage key**, `still_trial_start`. No server record.
  Incognito, a reinstall, or a new device each give a fresh 14 days.
- `events` had **no migration in the repo** — created by hand in the dashboard.
- `office` logged on open; `sitting`, `lectio`, `examen` only on completion.
- **TTS was never a Netlify function.** All of it is `still-tts.onrender.com`.
- The `/start` funnel files named in the original Phase 5 brief **did not
  exist** in any commit on any branch.

## Phase 2 — analytics, comps, bypasses · **pushed**

`3758470`, `5672699`

- `public.events` gained `user_id uuid references auth.users(id) on delete set
  null`, and the insert policy went from `with_check: true` — which let any
  holder of the public anon key write rows attributed to anyone — to
  `user_id is null or user_id = auth.uid()`.
- `trackEvent` sent the **anon key as its own bearer on every call**, so
  `auth.uid()` was always null and the new policy would have rejected every
  signed-in insert. It now sends the user's JWT when there is one and falls back
  to logging anonymously when the token can't be had.
- New events: `bell_armed {hour,bell}`, `rosary {mystery}`,
  `paywall_view {door}` (13 call sites each pass their own door),
  `purchase_tap {product,platform}`, `purchase_complete {product,platform}`.
- `sitting`/`lectio`/`examen` now log on open as well as completion. **All four
  practices carry `metadata.phase`, so a bare count of `event_type` now counts
  opens and completions together** — filter on `phase`; rows from before this
  release have none.
- `?resetTrial` and `window.stillResetTrial()` removed. The URL was live on
  production: anyone could restart their 14 days from the address bar.
- `window.stillAdmin()` removed. It wrote `still_paid=1`, which nothing clears,
  so one console call granted that device premium permanently.
- Nine hardcoded comped email addresses left `isSubscribed()` for
  **`profiles.comped`** — its own boolean, because both webhooks write
  `subscription_status` and a cancellation would otherwise have revoked a comp.
  Neither webhook touches `comped`; both PATCH explicit field objects, so it is
  out of reach by construction.
- `signOut()` now clears the subscription caches. It kept them, so the next
  person to sign in on a device read the last person's status until a refresh.

**Migrations run:** `supabase/migrations/2026-10-01-events-user-id.sql`,
`2026-10-01-comped-accounts-to-profiles.sql`. **7 of 9 comps applied** —
`gwilson@charlestondiocese.org` and `m.p.schneider.lc@hotmail.com` have no
account. If either signs up, set `comped = true` by hand; the migration's
AFTERWARDS block has the one-liner.

## Phase 3 — the first session · **pushed**

`3abc3ab`

Was: the door, the Guestmaster's seven-paragraph letter, then a sign-in
overlay. Nothing prayed, no bell armed. Now three steps, about 85 seconds:

1. The door, unchanged.
2. **One short Hour**, chosen by the clock. The spine of today's real Office —
   opening versicle, first psalm cut to its first strophe, short reading,
   collect — selected out of `buildOffice()`'s own doc, so no text is
   duplicated and none invented. 132 words, ~53 seconds of reading.
3. **The bell.** "Hear the bell" plays the chosen voice file — the one the
   notification actually carries — before anything is asked of the system. Only
   then does "Ring it each morning" reach `scheduleBells()`.

Ends at home as a guest, with `PW_GUEST='1'` so the second cold launch doesn't
wall them at the auth overlay. The letter moved to Settings → About, where its
link and audio already existed.

**The four Hours' times became data.** They were literal text in the Settings
markup that `bell-native.js` parsed back out of the DOM — unchangeable, and
editing that text would have moved the bell for everyone who had already armed
one, because the launch re-arm reads the same rows. `still_hour_times` is
per-device with defaults identical to the old literals, so an existing device is
bit-for-bit unchanged. The rows are `<input type="time">` now and editable.
First run writes **Lauds 07:00** and only behind two gates: `still_onboarded`
absent **and** `still_bells` never written.

Events: `first_run_start`, `first_run_hour_complete {hour}`,
`first_run_bell {armed|denied|not_now|web}`, `first_run_complete`.

**A trap worth remembering:** `playBell()` is gated on `bellEnabled` and plays
Sitting's *synthesised* bell, not the chosen `assets/bell-*.wav`. Use
`stillPreviewBell()` for anything that should sound like the notification.

## Phase 4 — character voices go text-only · **pushed**

`d1e04c4`

Removed the three `◎ Hear response` buttons (Companion, Amma Sophia, Deeper),
`requestVoice()`, the ElevenLabs pre-tagging (`prepareVoiceResponse`,
`_taggedResponses`, which called `tag-response.js`), and `_voiceSeq`.

The **audio-credit wallet went with them**, because it only ever paid for these:
`/tts` was the single TTS endpoint the client sent an `access_token` to, so the
only one billable to a person. Removed: `VoiceCredit`, `showVoiceTopUp()`, the
`?credit=added` return, `buyAudioCredits()` (which had **no caller at all** —
the native RevenueCat route was unreachable), the paywall's audio-credit line,
and the delete-account balance mention.

**Kept deliberately, because Office, Darkness and Rosary still speak:**
`AudioFetch`, `playVoiceUrl()`, and `CHARACTER_AMBIENCE` — Darkness passes
`'ammaSophia'` and would lose its ambience bed without the last one.

Server side left in place on purpose: `stripe-checkout.js`'s
`tier:'audio_credit'` branch, `revenuecat-webhook.js`'s `still_audio_credit`
branch, `add_voice_credit`, and the `voice_wallet` table — so a purchase in
flight still lands. `tag-response.js` has no caller but stays deployed for
builds already on phones.

**Render:** `/tts` must answer HTTP **200** with
`{audio:null, url:null, cached:false, silent:true, reason:'character_voice_retired'}`
— never 401 or 402, because old builds map 402 to "Add audio credit" and would
sell a retired product. `/office-tts` and `/rosary-tts` untouched. Node handler
and deploy steps were handed over separately.

## Phase 4b — audio placement and pacing · **pushed**

`10a3739`, `0b748f6`

- The Hear button moved to the **top** of each Office Hour (both rites, with
  the traditional rite's Vigils "coming soon" note), the Rosary's **Listen**
  above the scripture, and Darkness's **Hear Reflection** under the heading.
  The Office parts carry `audio:'skip'`, so placement never affects the spoken
  text. No CSS changes were needed — existing margins already spaced them.
- **Modern Vigils is now paced.** It was the one Hour that skipped
  `paceOfficeText()`, so its spoken text carried **no break tags at all** and
  nothing rested between its three psalms.
- `paceOfficeText()` itself already met the 1.5s floor: every spoken part is
  joined by a blank line and every one of those becomes a 2.0s break →
  `[long pause]` on Eleven v4.
- `BR_MAJOR` was `'\n<break 3.0s/> . <break 2.0s/>\n'`. The period was a **v3
  workaround** — something had to sit between two stacked breaks for both to
  register. On v4 it became a literal period floating between two pause tags,
  in line to be spoken, at six transitions in every paced Hour. Now one break.
- Every key that can cache paced text moved to `paced4`: lauds, vespers,
  compline, vigils, and the **traditional rite, which had carried no pacing
  marker at all**. The Darkness key is untouched — it never goes through
  `paceOfficeText()`.

## Deeper accuracy · **pushed through `d5bebe8`**

`54f2652`, `76a713f`, `d5bebe8`

**Citations are shown, not deleted.** The prompt asks for a CCC paragraph; the
client then stripped every `(CCC nnnn)` and `(ST …)` out of the prose, so the
number survived only on the SOURCE line and the journal kept none of it. They
are harvested before the prose is cleaned and set beneath the reply — CCC as
links, Summa and Father citations as plain text — and `Memory.record` now stores
the uncleaned body.

**Scripture comes from our own Douay-Rheims.** The prompt asked for RSV-CE,
against the project rule and every other surface. It now asks for DR names and
numbering and asks Deeper to **give the reference and never write the verse
out**. A `SCRIPTURE:` metadata line carries the references; each resolves
through `lectioParseCitation`/`lectioVersesFor` — the Gospel-of-the-day reader,
not a second parser — and the real DR text is shown. A reference that doesn't
resolve shows the reference alone. 21 lookup cases pass, including
Isaiah→Isaias, Revelation→Apocalypse, Sirach→Ecclesiasticus, Ezra→1 Esdras.
**1 and 2 Kings are deliberately not aliased** — in the DR those *are* 1 and 2
Samuel.

**All five sources named** in the prompt, the home card, the screen line and the
info panel. The loading line had read "CCC · Philokalia · Desert Fathers"; the
Philokalia is nowhere in Deeper's prompt and the Desert Fathers are the
Companion's.

**Share card.** The dangling fragment was not the card's doing: both voices
split replies with `/[^.!?]+[.!?]+/`, which treats `St.` as a sentence end, and
the invitation scan then lifted the first backwards match — possibly from the
middle — leaving a hole the card exposed. `window.stillSentences()` is
abbreviation-aware, the invitation is now only ever the closing sentence, and
the card keeps whole sentences and adds "Read the full answer at
stillprayer.app". It also shows the invitation and the SOURCE line, matching the
screen. Fixed in passing: both voices fell back to `inv||sentences[last]`, which
showed the last sentence **twice**.

**Prompt:** no opening remark about the question; and a section on devotional
promises establishing that the Twelfth Promise is **the grace of final
penitence** — a grace, never to be swapped for *final impenitence*, the sin the
prompt names throughout.

## Devotions reference + model flag · **this commit**

- **`assets/devotions/reference.json` is wired in.** `Devotions.contextFor()`
  matches a question against `keywords` and injects **at most one** entry.
  `wording` decides use: `verbatim` quoted exactly, `standard_printed` quotable
  **only** with "in the commonly printed wording", `summary` never quoted. An
  empty `items` or any other `wording` gets the no-text rule.
  - First Fridays was **two entries and the how-to shadowed the promise** — "am
    I guaranteed heaven?" scored higher on the requirements and never reached
    the Twelfth Promise. Merged: one entry per devotion, requirements carried as
    non-quotable substance.
  - The **Fifteen Promises of the Rosary ship with an empty `items` array on
    purpose.** The attribution to St Dominic isn't supported by the earliest
    sources and the circulated list can't be traced to Bl. Alan de la Roche.
- **`DEEPER_MODE`** — one word, `'a' | 'b' | 'legacy'`. `legacy` is exactly what
  shipped before. Default **`'a'`**.
  - `a` — `claude-sonnet-5-5`, `max_tokens: 350`, `thinking:{type:'between_tools'}`
  - `b` — `claude-sonnet-5-5`, `max_tokens: 1400`, `thinking:{type:'adaptive'}`,
    `output_config:{effort:'low'}`
  - **Why thinking must be configured at all:** on Sonnet 5.5, *omitting*
    `thinking` runs adaptive thinking, and thinking tokens bill against
    `max_tokens`. At 350 that could consume the whole budget. `{type:'disabled'}`
    returns a 400 there, so `between_tools` is the parameter that turns it off.
- **`claude.js` forwards `thinking` and `output_config` only when sent**, so
  every other feature's request body is byte-identical.
- **The reply is read from the first TEXT block**, not `content[0]` — under mode
  `b` the first block is a thinking block whose text is empty by default, which
  would have painted a blank reflection. A `stop_reason: 'refusal'` is met with
  the prompt's own ON LIMITS line rather than as an error; Sonnet 5.5 runs
  safety classifiers and this voice is asked about sin, despair and death.

### Cost, measured

`DEEPER_SYSTEM` is 13,311 chars ≈ 3,600 tokens; `Memory.context` caps at 1,400
chars ≈ 380; a question ~70. So ~4,050 in, ≤350 out.

| | Sonnet 4.6 | Sonnet 5.5 |
|---|---|---|
| Input / output per MTok | $3.00 / $15.00 | $2.00 / $10.00 |
| **Per answer** | **≈ $0.0170** | **≈ $0.0113** |
| Per 1,000 answers | $17.03 | $11.30 |

33% cheaper on both legs. A devotion entry adds roughly 200–500 tokens when one
matches (~$0.0004–0.0010 on mode `a`).

### Prompt caching — decided against at current traffic

Cache **writes cost ~1.25×** base input; **reads ~0.1×** (so $0.20/MTok on
Sonnet 5.5 against $2.00 cold). Default TTL is **5 minutes**; a `ttl: "1h"`
option exists, whose write premium is higher and **is not stated in the
reference used here** — confirm before relying on it.

Caching pays only when reads outnumber writes by more than about **1 : 3.6**
(0.9 saved per read against 0.25 paid per write). At **5–10 Deeper calls a day**
the calls are minutes-to-hours apart, so under a 5-minute TTL essentially every
call is a miss that pays the write premium:

- 10 calls/day, no caching: 10 × 3,600 × $2/MTok = **$0.072/day**
- 10 calls/day, all misses: × 1.25 = **$0.090/day** → **25% worse**

**Not built.** It becomes worth building when Deeper calls routinely arrive
within 5 minutes of each other — roughly 300+/day, or any burst pattern. When it
is built, `system` must be split into two blocks: the frozen `DEEPER_SYSTEM`
with `cache_control`, then memory and the devotion **after** it. Today they are
concatenated into one string, so there is no stable prefix to cache at.

---

## Open

### 1. Phase 5 — the `/start` funnel · **uncommitted**

Untracked in the working tree and deliberately excluded from every commit:
`start/`, `netlify/functions/start-checkout.js`, `start-claim.js`,
`start-webhook.js`, `netlify/lib/`. Also untracked: `gods-eye-view/` (unrelated).

Still to decide for the landing page, from the original brief:

- **Today's Office without duplicating texts.** The seam is `buildOffice()` plus
  `office-corpus.js`, which already reads `corpus/traditional/` through
  `included_files`. The recommendation was a shared endpoint (an
  `office-today.js`) rather than a second copy of the texts; **this was never
  formally proposed or approved.**

  **Decided for the landing page (2026-10-02):**

  - **The Hour follows the visitor's local clock, not always Lauds.** Use the
    same rule the app uses — `setOfficeTime()` → `window._officeAutoHour`, with
    the thresholds `<5` Vigils, `<17` Lauds, `<20` Vespers, else Compline. The
    page shows whichever Hour the visitor is actually in. This is the rule the
    onboarding door already reads for its edge grade and that `obHourNow()` uses
    for the first session, so there are three callers and it should be shared,
    not re-implemented a fourth time.
  - **`◎ Hear [Hour]` sits at the very top of the Office section, above the
    text** — matching what Phase 4b did in the app. The label names the Hour
    being shown, so it changes with the clock.
  - **An optional `?hour=` parameter overrides the clock**, accepting `lauds`,
    `vespers`, `compline`, `vigils`, so a specific ad can open on a specific
    Hour. Validate against that list and fall back to the clock on anything
    else; don't trust the parameter into a lookup.

  Two things to carry over from the app's own Office work, because the landing
  page will hit both: Vigils has no traditional-rite audio (the corpus Matins is
  ~26,000 spoken characters), and the rite should be forced to `modern` for a
  first-time visitor, who has no traditional corpus cached and would otherwise
  get a "still loading" office.
- **Translation rights for public web display.** The traditional corpus is
  parsed from Divinum Officium and `assets/scripture/dr/` is public domain, but
  the modern-rite psalms and collects in `OFFICE_SEASONS` / `OFFICE_READINGS` /
  `OFFICE_COLLECTS` have **not been audited for public display**. In-app use
  under one set of assumptions is not the same thing.
- A live Deeper taste (`deeper-taste.js`) with per-visitor and global caps.
- Meta Pixel: **not installed anywhere.** An earlier grep appeared to find
  `fbq` in `index.html`; that was a false positive inside the 300KB base64
  `BELL_DATA_URL`.

⚠️ **`publish = "."` means the repo root is the web root.** Anything not
explicitly 404'd in `netlify.toml` is live the moment it is pushed. `vault/`,
`supabase/`, `corpus/`, `tools/` and `netlify/` are blocked; **`docs/` and
`assets/devotions/` are not**, so `reference.json` is reachable at
`/assets/devotions/reference.json`. That is harmless for public devotional
texts — but check this for every new top-level directory.

### 2. Pricing decision · **pending, blocks item 3**

Monthly $9.99 and annual $89.99 are live; a **$39.99 lifetime** is under
consideration and no decision has been made. `PAYWALL_PRICES` is the one client
constant; Stripe and RevenueCat carry their own. Nothing in the phased work
changed a price.

### 3. Audio credit removal from the stores · **waiting on pricing**

`still_audio_credit` is unreachable in the app but **still on sale**. To retire:
remove from the RevenueCat offering then archive the product; App Store Connect
→ Remove from Sale; Google Play → Deactivate; Stripe → archive the price behind
`STRIPE_AUDIO_CREDIT_PRICE_ID` and its product. Note the dead Stripe price said
**$14.99** while both webhooks credited **$10.00**.

`still_yearly` stays on sale pending item 2. **Do not cancel ElevenLabs or
Render** — Office, Darkness and Rosary all still use them.

### 4. Native builds · **needed**

`index.html`, `bell-native.js` and `claude.js` have all changed since the last
build. Run `npx cap sync`, then build iOS and Android.

Test on a real device, because none of it can be seen in a browser:

- Delete and reinstall, then walk the **whole first run** — the notification
  prompt only appears in its true position on device.
- Settings → the four Hours read 4:00 / **7:00** / 18:00 / 21:00 with Lauds on;
  an **existing** install still reads 6:00 with its own toggles untouched.
- Vigils audio — first time that Hour runs through the paced/split path.
- Deeper under `DEEPER_MODE='a'` — a reply arrives and is not blank.

### 5. `/office-tts` and `/rosary-tts` cache poisoning · **open, unfixed**

Both endpoints take a **client-supplied `cacheKey` with no authentication** —
unlike `/tts`, which at least carried an `access_token`. Anyone can POST
arbitrary text under a key the app will later read, and the cached clip is then
served to every user who opens that Hour. `/rosary-tts` keys by meditation id,
with the same exposure.

Options, in order of preference: derive the key **server-side** from the text
(hash it on Render, ignore any client key); or require a Supabase JWT as `/tts`
did; or sign the key with a shared secret the client can't forge. The first is
the only one that closes it without adding auth to a path that currently has
none. **This lives in the `still-tts` repo, not here.**

### 6. CCC paragraph map · **open**

Citations link to the Catechism's table of contents, not the paragraph.
Verified against `_INDEX.HTM`: vatican.va publishes the CCC as ~250 page files
(`__P1.HTM`…`__PAE.HTM`), its hrefs carry **section names only**, no URL
contains a paragraph number, and there is **no paragraph→page index**. Guessing
a page would hand a reader the wrong text while implying verification.

Two routes: fetch the ~250 pages once and record the real paragraph range each
covers, shipping that as a lookup table (genuinely verified, and it would need
rechecking if the Vatican re-publishes); or accept a host that supports
per-paragraph anchors. **vatican.va was the stated requirement, so the second
hasn't been pursued.**

### 7. First-run "Hear it prayed" button · **idea, not built**

Add to the short Hour in the first session. Worth noting it would be the first
thing in the run to depend on the network and on Render being warm — a cold
Render start is slow enough to blow the 90-second target, so it should be
optional and never block the step. The Office's own `◎ Hear [Hour]` already
exists one tap further in.

### 8. Capacitor version mismatch · **open, low risk**

`@capacitor/android` is pinned `^8.5.0` while `@capacitor/core`,
`@capacitor/ios` and `@capacitor/cli` are `^8.3.4`. Same major, so the carets
resolve compatibly and nothing is known to be broken — but Android's pin is
ahead of the toolchain's. Align them (raise the other three to `^8.5.0`, or drop
android to `^8.3.4`) at the next dependency pass, and run `npx cap doctor`.

### 9. OneSignal cleanup · **open**

`onesignal-cordova-plugin ^5.3.12` is still a dependency, and references remain
in `index.html`, `bell-native.js`, `OneSignalSDKWorker.js`, `send-notifications.js`
and the four `bell-*.js` functions. Per `bell-native.js`'s own header the web SDK
was removed in `2391f30` and nothing replaced it, so **those pushes reach
nobody** — local notifications are the only delivery path.

⚠️ **`netlify.toml` still schedules all four `bell-*` functions hourly**
(`schedule = "0 * * * *"`) plus `send-notifications` daily. That is ~96 wasted
scheduled invocations a day doing nothing. Removing those four schedule blocks
is the cheapest part of this cleanup and is independent of the plugin removal.

### 10. Devotions entries awaiting a source · **open**

Four of seven entries carry `[NEEDED: source]` and are injected with the
"present nothing as a quotation" instruction until verified:

| Entry | What's missing |
|---|---|
| Twelve Promises of the Sacred Heart | A named public-domain edition (page scan) to check each item. The list is a later compilation, not one text in St Margaret Mary's hand. Currently `standard_printed`, so it is quotable **only** with "in the commonly printed wording". |
| Brown Scapular | The earliest surviving text of the 1251 vision postdates the event; attribution disputed. |
| Divine Mercy | Diary paragraph numbers and verbatim wording need the published Diary. |
| Fifteen Promises of the Rosary | A critical source, if one exists. Ships with empty `items` by design. |

### 11. Smaller things noticed, not acted on

- `obNext()`, `playDemoAudio()`, `stopDemoAudio()` and the empty
  `ONBOARDING_DEMOS` are now unreachable by the first-run flow. Dead but
  harmless.
- `isSubscribed()` still honours the legacy `still_paid` flag. Nothing sets it
  except the legacy `?payment=success` path; removing it could revoke access for
  an old direct-payment user, so it was left alone.
- The trial remains resettable by clearing site data or reinstalling. Server-side
  trial tracking was never requested. **A web visitor can still take unlimited
  14-day trials.**
- `community-submit.js` and `community-report.js` have no caller — Community is
  gone from the app.
- `requestOfficeLock` is defined and never called.
- **`nature_sounds` is referenced in two different cases.** The file on disk is
  `still-mobile/src/audio/nature_sounds.MP3`. `CHARACTER_AMBIENCE` names it
  `nature_sounds.mp3` in lower case; the dead `playDemoAudio()` copy names it
  `.MP3` correctly. Netlify is case-sensitive, so the lower-case reference
  cannot resolve on the web. It is not reached today — that entry is the
  Companion's ambience bed, and the Companion's spoken audio went in Phase 4,
  leaving `playVoiceUrl` to be called only with `'office'` (no ambience entry)
  and `'ammaSophia'` — but it will bite whoever next wires a voice to that map.
  Fix the case at `CHARACTER_AMBIENCE`, or rename the file to lower case and
  update both references plus the explicit header in `netlify.toml`.
- **`netlify.toml` had four rules that silently did nothing**, all for the same
  reason: a splat is only honoured at the END of a path. `/*.md` (so `CLAUDE.md`
  and `DESIGN.md` were served in full), `/*.js` (an identity rewrite that was a
  no-op regardless), and the three `*.mp3` / `*.mp4` `Content-Type` headers. All
  four are fixed; the file now has no non-terminal splat anywhere. **Worth
  re-checking after any future edit** — a wrong pattern here fails open and
  silently.

---

## Commit trail

| Commit | What |
|---|---|
| `3758470` | Analytics: events.user_id, five new events, drop the trial reset |
| `5672699` | `profiles.comped`; remove the `stillAdmin` bypass |
| `3abc3ab` | First session: one short Hour, then the bell, home as a guest |
| `d1e04c4` | The character voices are read, not heard |
| `10a3739` | Audio buttons to the top of the Hour, meditation, reflection |
| `0b748f6` | One break at the major rests; every paced cache key → `paced4` |
| `54f2652` | Deeper: checkable citations, Scripture from our own Douay-Rheims |
| `76a713f` | Share card: whole sentences, in the screen's order, with the source |
| `d5bebe8` | Devotions reference file and the 20-question test set |
| *this one* | Devotions wired in; `DEEPER_MODE` flag; `claude.js` passthrough |
