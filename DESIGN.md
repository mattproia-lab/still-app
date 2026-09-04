# Still — visual system

The tokens live in `index.html` as CSS custom properties on `:root` (banner
`DESIGN TOKENS`, just above the reset). The shared components live in the block
banner `TOKEN SCREENS -- shared components`, scoped to `[data-tokens]`. This
file is the explanation. If the two disagree, the CSS is the truth; fix this
file.

Contemplative Sitting (`#screen-sitting`) is the reference implementation.
Lectio Divina (`#screen-lectio`) is the second screen on the system and the
model for a read practice. Every other practice is redesigned by applying these
tokens and components the same way, not by inventing new values.

## Principles

- **Two voices.** The tradition speaks in serif (quotes, saints, scripture,
  instructions that are addressed to the person). The interface speaks in a
  quiet sans (labels, buttons, notes, counts' captions). Nothing else.
- **Drawn light, not photographs.** Backgrounds are gradients, grain and a
  breathing glow. No video, no JPEG. Only `transform` and `opacity` animate, so
  a mid-range phone composites them for free. Photographs are permitted at a
  practice's threshold only, never behind reading text: graded toward the
  practice's hue, under the shared grain and vignette, and gone on one slow
  fade before the first inner screen.
- **Time is light, not a number.** A phase's timer is a ring that dims toward
  silence. Countdown digits stay in the DOM for the state machine but are
  visually hidden.
- **A breath, not a bounce.** Phase changes fade over `--d-breath`. Nothing
  springs, slides in from the side, or scales up.
- **One page deepening.** A practice with movements shows them as one spine (the
  phase track) and carries what was received forward: the previous phrase
  above the current one, the word into Oratio, the word and passage into
  Complete. Only where the state machine already writes it.
- **390px first.** Every screen is laid out for a 390px viewport and only then
  allowed to widen. Row labels never wrap; connectors flex instead.
- **Reduced motion is honoured.** Durations shrink and drift animations stop
  under `prefers-reduced-motion`; fades remain because they are not motion.

## Tokens

### Type

| Token | Value | Use |
|---|---|---|
| `--font-serif` | Cormorant Garamond, Georgia fallback | The tradition's voice |
| `--font-sans` | Instrument Sans, system-ui fallback | The interface |
| `--t-micro` | 10–11px | Tracked uppercase labels, attributions, buttons |
| `--t-xs` | 12–13px | Hints, meta, tap prompts |
| `--t-sm` | 14–15px | Interface notes, echo subtitles |
| `--t-base` | 16–18px | Body, anchor pills, textareas (16px keeps iOS from zooming) |
| `--t-md` | 20–24px | Quotes, instructions, the anchor line, echo titles |
| `--t-lg` | 26–34px | Headings, the current phrase in Lectio, the received word |
| `--t-xl` | 40–56px | Counts |
| `--t-2xl` | 56–80px | Hero numbers |
| `--track-label` / `--track-wide` | .22em / .32em | Uppercase tracking (labels / screen title) |
| `--lh-tight` `--lh-snug` `--lh-text` `--lh-loose` | 1.05 / 1.3 / 1.6 / 1.8 | Line heights |

The scale is fluid (`clamp()` between 390px and 1200px). Never write a pixel
font-size inside a token screen; never write an inline `style="font-size"`.

Both faces load from Google Fonts in `<head>` with `display=swap`. The fallback
stacks are real: Georgia and system-ui render the layout acceptably offline.

### Colour

| Token | Value | Use |
|---|---|---|
| `--ink-0` `--ink-1` `--ink-2` | #050302 / #0b0705 / #140d08 | Ground, from deepest up |
| `--candle` | #f2c777 | Light: the ring, selected states, the bell chip |
| `--candle-hi` | #fff1cf | The brightest point: ring core, hero numbers, the received word |
| `--gold` | #d9a441 | Attributions, saved states, secondary accents |
| `--gold-deep` | #8c5d12 | Reserved for shadows under gold |
| `--ember` `--ember-hi` | #ff9448 / #ffd7a8 | A tapped thought |
| `--text-hi` `--text-mid` `--text-low` `--text-faint` | warm white at .94 / .68 / .42 / .24 | Four text levels; there is no fifth |
| `--line` `--line-strong` | warm white at .12 / .24 | Hairlines, borders |
| `--gold-a10` `--gold-a25` `--gold-a55` | gold at .10 / .25 / .55 | Fills, borders, done-states |

All whites are warm (`255,246,232` family), never pure `#fff`. The gold accent
is system-wide; a practice varies its atmosphere, not its accent.

### Atmosphere variables

One hue per practice. `--atmos-rgb` is an RGB triplet taken verbatim from the
stained-glass array `W[]` in the script, so the practice's atmosphere is the
same colour as its bead and its background wash on home. The ground, the
breathing glow and the flicker core are all derived from it in the shared
block; a screen sets only these on its root:

| Variable | Meaning |
|---|---|
| `--atmos-rgb` | The hue, `r,g,b`, from `W[]` |
| `--atmos-a` | Strength, `W[].i` unless the practice needs otherwise |
| `--atmos-x` / `--atmos-y` | Where the light sits |
| `--atmos-gy` | Where the ground gradient is anchored (default 100%) |

Derived (do not set per practice): `--atmos-ground` (hue at 14% into ink),
`--atmos-mid` (7%), `--atmos-core` (hue lifted 55% toward white) via
`color-mix()`; the flame layer carries a plain-rgba fallback for engines
without it.

### Practice palette

| Practice | `--atmos-rgb` | `W[]` | Strength | Light sits |
|---|---|---|---|---|
| Sitting | 205,155,10 | gold | .92 | 50% / 74%, a candle on the table |
| Lectio | 0,172,192 | teal | .90 | 50% / 36%, behind the text |
| Examen | 22,50,215 | cobalt | .90 | 50% / 58%, behind the answer |
| The Guide | 156,74,47 | ember | .86 | 50% / 36%, behind the text |
| Spiritual Paths | 64,52,150 | twilight indigo | .74 | 50% / 36%, behind the text |
| Office · Lauds (and the chooser default) | 205,155,10 | gold | .95 | 62% |
| Office · Vespers | 162,10,52 | rose | .95 | 68% |
| Office · Vigils, Compline | as defined below | — | .3 / .55 | 70% / 72% |
| Breath Prayer | 100,20,200 | deep violet | .82 | 50% / 42%, behind the orb; it breathes |
| Rosary (pending) | 162,10,52 or as decided | rose | — | to be designed |

Put the glow where the eye rests in that practice. Text and gold accents do
not change with the hue.

### Space

`--s-1` … `--s-8` = 4, 8, 12, 16, 24, 32, 48, 64px. `--gutter` is the screen's
side padding (18px at 390, 38px wide). `--measure` (34rem) caps content width.
Lectio adds `--measure-read` (30rem, about 65 characters of the serif) for the
phrase being read.

### Motion

| Token | Value | Use |
|---|---|---|
| `--d-fast` | .2s | Hover, press |
| `--d-base` | .45s | State changes on controls |
| `--d-slow` | .9s | Phase-track colour, anchor line, echo body |
| `--d-breath` | 1.8s | Phase panel fade-in, banner and question cards |
| `--d-drift` | 8s | Breathing glow loop |
| `--ease-out` | cubic-bezier(.2,.7,.2,1) | Everything that settles |
| `--ease-breath` | cubic-bezier(.45,0,.2,1) | Loops |

Under `prefers-reduced-motion`: `--d-breath` .3s, `--d-drift` 0, drift/flicker
animations `none`, the ember fades in place instead of rising, the generating
button stops breathing.

### Shape

`--r-sm` 3px for cards and pills of text; `--r-pill` for buttons and toggles.

## Shared components (`[data-tokens]`)

- **Atmosphere** `.atmos` with `.atmos-glow`, `.atmos-flame`, `.atmos-grain`,
  `.atmos-vignette`: `position:absolute; inset:0; z-index:0; aria-hidden`.
  Driven entirely by the atmosphere variables above.
- **Header and frame**: `.app-header`, `.screen-title`, `.back-btn`,
  `.feature-main` are restyled under `[data-tokens]`. The `!important`s there
  answer the mobile blocks, which set the same properties with `!important`.
- **Phase track** `.phase-track` / `.phase-step` / `.phase-step-dot` /
  `.phase-connector`: `justify-content:space-between`, labels `flex:0 0 auto;
  white-space:nowrap`, connectors `flex:1 1 6px; min-width:4px`. Under 420px
  the label drops to 9px and .1em tracking (Lectio .04em; four Latin names).
  Sitting's machine marks `.done`/`.current` itself; Lectio's does not, so
  Lectio's track is marked from the active panel with `:has()`.
- **Phase panel fade**: `.companion-state.active` and `.lectio-phase.active`
  animate `phaseIn` over `--d-breath` with an 8px rise (`--rise`, 0 under
  reduced motion). Exit is the screen's own `display:none`.
- **Type roles**: `.voice` + `.voice-attrib` (serif italic quote, sans micro
  attribution in gold, em dash in the markup), `.voice-quiet`, `.voice-left`,
  `.voice-card`; `.heading` (serif, `--t-lg`); `.body` and `.body-small`
  (sans); `.instruction` (serif, centred); `.ui-label`, `.ui-note`, `.ui-hint`;
  `.rule` and `.rule-short`.
- **Counts**: `.count-hero`, `.count-label`, `.count-line`.
- **Ring** `.ring` with `.ring-halo`, `.ring-svg` (circle r=88 in a 200
  viewBox, circumference 552.92), `.ring-track`, `.ring-arc`, `.ring-core`.
  `--ring-frac` (1 → 0) drives `stroke-dashoffset`, arc opacity (.92 → .22),
  the halo and the core. Transitions are 1s linear so one-second ticks read as
  continuous. The digits the state machine writes get `.timer-value`
  (visually hidden, `aria-hidden`).
- **Timer-ring script**: one `<script>` after the Sitting markup holds a
  `RINGS` table of `{ timer, ring, panel }` ids. It observes each timer's text
  and each panel's class, takes the first value written after a panel goes
  active as that phase's length, and sets `--ring-frac`. Non-`m:ss` text (Lectio
  writes `✦` at the end) reads as 0. It calls nothing. To add a timed phase,
  add a row.
- **Buttons**: `.btn-primary`, `.btn-primary.gold`, `.btn-begin` (full width),
  `.btn-ghost`, `.btn-row` (centred; `.btn-row.left` for form pages).
- **Generating state**: when a practice disables a button while it waits on
  the model, style `:disabled` as quiet and breathing (`officeBreath`), with no
  explanatory copy. Lectio's `#generateQBtn` is the example. Never show the
  user a note about keys, models, or limits.

## Practice-specific patterns

- **Sitting**: `.tap-zone` with the ring inside it as the target; `.tap-ripple`
  restyled as an ember (10px, rises 58px, fades in .68s inside the 700ms the
  code gives it); `.anchor-line` under the ring (two `!important`s beat the
  inline style `playAnchor()` writes); `.dur-btn`, `.anchor-pill`, `.rec-*`.
  The fourth step `#ps-watch` is hidden by id because `setSittingPhase()`
  assigns `className` outright.
- **Lectio**: `.lectio-col` (measure) and `.lectio-col-read` (reading
  measure); `.lectio-prev-phrase` faint above `.lectio-curr-phrase`;
  `.passage-choice` cards with `.is-today`; `.lectio-source-group` as native
  `<details>`; `.echo-*` accordion with serif titles and sans subtitles;
  `.lectio-carry` for the word carried into Oratio; `.claude-q-card` and
  `.closing-prayer-card` share a floating label; `.lectio-chip` summary. The
  passage list is built by `buildPassageList()`; its template now emits classes
  only, no inline presentation.

- **The Office**: no timer, so no ring. The glow takes the colour of the
  canonical hour through `#screen-office[data-hour]`, one variable set per
  hour (all eight are defined; the app currently builds four). A small script
  after the markup mirrors the hour name the state code writes into
  `#officeScreenTitle` onto `data-hour`; on the chooser the light is the hour
  the clock says. `.office-hour` cards carry a dot in their hour's colour.
  The card is painted by `renderOfficeHTML()`, which emits `.office-*`
  classes (`badge`, `title`, `eyebrow`, `text`, `versicle`, `latin`,
  `divider`, `hear`, `note`, `loading`, `nav`); a part's own `style` string
  from the corpus passes through as before. Its HTML bytes are pinned by
  `tools/office-corpus/tests/test-build-office.js`; when the templates
  change, delete `tests/golden/modern-office.json`, run the test twice, and
  confirm only the `html` field of the golden moved. The Sing the Hours
  player injects its own `<style>`; the id-scoped `.sth-*` rules outrank it.

- **The Examen**: no timer, so no ring. The array's cobalt sits low in the
  room (`--atmos-rgb` 22,50,215, strength .90, `--atmos-y` 58%): its own blue,
  more saturated and quieter than Compline's grey-blue, nothing like Vespers'
  rose. Evening, but turned inward. Every movement is painted by `renderExamenStep()` into
  the one `.content-card`, wrapped in `.examen-step` so each replacement
  enters on `phaseIn`. The track is dots only (`.examen-track`, one per
  question, six when fasting) marked from `examenStep` in the template; the
  movement is named beneath it (`.examen-movement`) with the movement just
  finished carried above it in `.examen-prev`. `examenFinish()` paints
  `.examen-complete`. The app's five movements are Gratitude, Awareness,
  Feeling, Grace, Forward; their prompts are the journal entry's keys, so
  they are data, not copy. The Grace prompt's double hyphen is shown as an em
  dash by a replace in `renderExamenStep()`, never in the data.

- **The Guide**: no timer, so no ring; no card, the light comes through. The
  array's ember (`--atmos-rgb` 156,74,47, strength .86) sits behind the text
  at Lectio's height (36%, ground anchored at 30%): a reading practice. The
  practice is a self-contained IIFE (`const Guide`) that builds an overlay,
  `#stillGuide`, not a `.screen`; `build()` gives the root `data-tokens` and
  the four atmosphere layers, and `injectStyles()` injects the stylesheet
  from the `CSS` template literal (so CSS escapes are written `\\2014`, and
  no backtick or `${` may appear). The overlay itself scrolls, because
  `transition()` resets `root.scrollTop`, so `.atmos` is `position:fixed`
  under it and the header is `sticky` on an opaque band. The spine is
  painted by `renderRail()`: five dots (`.sg-track`) for the five movements,
  only the current one marked, since the Guide may be entered anywhere; while
  searching the heart the seven root numerals (`.sg-roots`) sit beneath. Each
  screen opens with `head()`: what was just finished in `.sg-prev` (the
  previous card's title, the previous root's name, the previous stage's
  heading), then the movement in `.sg-movement`. Granada's passages are
  `.sg-passage` (serif, `--t-md`, `--measure-read`); the questions put to the
  reader (`.sg-prompt`, `ul.questions`) and every instruction are sans. The
  content's double hyphens and straight quotes are display-transformed by
  `typo()` at render time; the data, some of which `saveExamen()` writes, is
  untouched. Class names the IIFE's `wire()` and `onKey()` query (`.go`,
  `.ghost`, `.back`, `.controls`, `.opt`, `.choice`, `.num`, `data-*` hooks)
  are kept and carry the shared button classes beside them. `injectFonts()`
  is a no-op: the faces are in `<head>`.

- **Spiritual Paths**: no timer, so no ring; no card. The array's twilight
  indigo (`--atmos-rgb` 64,52,150, strength .74) sits behind the text at
  Lectio's height (36%, ground anchored at 30%): a reading practice, laid out
  like the Guide. The `Paths` object builds an overlay, `#pathsOverlay`, in
  `_ensure()`: `data-tokens` on the root, the atmosphere fixed to the
  viewport, a sticky `.app-header` on an opaque band, and a `.vessel` holding
  `#pathsStage`, which `_frame()` repaints with each screen inside
  `.sg-screen.in` (`phaseIn`). The stylesheet is injected from a template
  literal, so no backtick or `${` may appear in it. Two screens are
  thresholds and keep their photographs, the one exception to drawn light:
  the entry screen (`.threshold`, `paths-bg.webp`) and Reading Toward the
  Center's intro (`.threshold-center`, `center-bg.webp`). Each is an
  `.atmos-photo` layer between the flame and the grain, graded toward the
  indigo, shown only while its class is on the root. `_frame()` drops both
  classes before every render and the threshold renders add theirs back, so
  leaving a threshold is one slow fade (`--d-veil`, 1.5 × `--d-breath`) in
  which the photograph goes and the glow beneath it rises; the header band
  is a pseudo-element so it can thin over the photograph the same way.
  `centerHome()` still writes `--veil-a` / `--veil-b` as lamps are lit; the
  centre photograph's grade reads them. The discernment's spine is
  `_track(phase)`: the four phases from the day data as a `.phase-track`,
  those walked done, the one in hand current, all done on the finished
  screen. Scripture is `.scripture` (serif italic, gold hairline) with a
  sans attribution; the teaching, the practice and the Center's mirrors are
  `p.body` in the serif at `--t-md`; the Douay-Rheims verses are
  `.ctr-passage` with verse numbers in the sans; the reflection read back on
  the rest days (`.panel`) is serif italic, mid-weight, no card. Labels,
  options (`.opt`), inputs (`.note`, 16px so iOS does not zoom), buttons
  (`.go` carrying `.btn-primary` beside it) and the lamps map (`.ctr-*`, now
  scoped here rather than global) are on the tokens. `_typo()` curls quotes
  and sets em dashes at render time in `_body()`, the reflection, the
  textarea placeholder and the verses; the data is untouched, since
  `centerComplete()` reads the mirror for the carry. The old parchment skin,
  its EB Garamond, its `@media (max-width:640px)` overrides and the global
  `.ctr-*` block are gone; `#pathsOverlay` left the safe-area padding list
  because the header carries the inset.

- **Breath Prayer**: no ring, because the session counts up and has no
  length; the elapsed time is a quiet tabular figure. No card. The array's
  deep violet (`--atmos-rgb` 100,20,200, strength .82) sits behind the orb
  (42%, ground anchored at 60%). This is the one practice where the
  atmosphere itself breathes: on `#screen-breath` the glow and flame drop the
  drift loop and instead transition (4s ease-in-out, `--d-inhale`, the
  pacing code's own interval) with `data-breath` on the screen root, swelling
  and brightening on `inhale`, settling and dimming on `exhale`, still at
  `rest`. A small script after the markup mirrors the attribute from the
  scale the pacing code writes to `#heartOrb` (1.3, 0.85, 1); it calls
  nothing. The orb keeps its inline transform and its tap; its drawing (a
  halo in the practice's hue, a hairline ring, a candle core) and its
  transition live in CSS. The pacing code also writes the two prayer lines'
  colours, the Begin button's colour and the bell toggle's colour inline;
  attribute selectors on those exact values (`[style*=".95)"]`,
  `[style*="255,255,255"]`) map them onto the text levels with commented
  `!important`s, and the lines cross-fade over two seconds. The milestone's
  `<p>` is what `showHeartMilestone()` writes to, so it stays a `<p>` with
  `!important` sizes against the mobile block. `#breathPrayer` is the whole
  prayer and the one element `setBreathPrayer()` rewrites (the two breath
  lines carry fixed text), so it stays on the screen as a quiet serif block
  beneath the eyebrow. Under reduced motion the light breathes in
  brightness only and the orb's inline scale is overridden to none.

### Hour palette

| Hour | `--atmos-rgb` | Strength | Height |
|---|---|---|---|
| Vigils | near-black, cool grey `110,110,140` | .3 | 70% |
| Lauds | gold `205,155,10` (the Sitting bead) | .95 | 62% |
| Prime | pale morning `236,228,205` | .7 | 40% |
| Terce | bright `255,240,200` | 1.1 | 34% |
| Sext | brightest `255,244,210` | 1.2 | 30% |
| None | amber `255,176,70` | .95 | 50% |
| Vespers | rose `162,10,52` (the Office bead) | .95 | 68% |
| Compline | deep blue-grey `120,140,170` | .55 | 72% |

The chooser's hour dots use the same triplets (`--hour-rgb`).

The light rises through the morning, stands high at midday, and sinks and
cools toward night. Text and accents stay warm white and gold in every hour.

## Rules for the next practice

1. Add `data-tokens` to the screen root. It scopes you into the shared
   components and exempts the screen from the legacy `bumpFonts()` script
   (near the end of the file), which inflates every element under 14px on
   phone user agents. Without it the type scale is destroyed on devices and
   looks fine in a desktop browser.
2. Scope every screen-specific rule to the screen id. The old global classes
   (`.feat-*`, `.phase-instruction`, `.timer-display`) and the mobile blocks
   (`@media (max-width:1024px)` around line 1000 and `(max-width:768px)` around
   line 1230 and 3600) fight unscoped rules with `!important`. Delete the old
   screen's mobile overrides when you retire its old stylesheet.
3. Do not use `<p>`, `<h1>`, `<h2>` for text inside `.feature-main`; the mobile
   block sizes them with `!important`. Use `<div>` and `<blockquote>` with the
   role classes. Never write `style="font-size:…"`; an attribute-selector rule
   rewrites those too. JS-built templates count: move their inline styles to
   classes.
4. Keep IDs, `onclick` hooks, inputs and the classes the practice's JS toggles.
   Move markup freely otherwise. When JS writes inline styles that fight the
   tokens, override with a commented `!important` rather than editing the
   logic. Label strings JS restores (arrows, "Saved") may be updated to the
   typographic glyphs the markup uses.
5. Replace media backgrounds with the atmosphere. Set the variables on the
   screen root; do not add layers.
6. One ring per timed phase, a row in `RINGS`; hide the digits, never delete
   the element the state machine writes to.
7. If the practice has movements, give it a phase track and mark it from the
   active panel with `:has()` when the machine does not mark it itself. Drop
   per-panel eyebrows that repeat the header title and the track.
8. Screenshot at 390×844 in every state before and after. The glow should be
   visible in each state; if a state is all text, it is too dense.
9. A practice built as an overlay (the Guide) takes `data-tokens` on the
   overlay root and the atmosphere layers as its first child. If the overlay
   is its own scroller, fix the atmosphere to the viewport and make the header
   sticky; otherwise the light scrolls away with the first screenful.
10. Content that is data (strings a save function writes, or keys) keeps its
   double hyphens and straight quotes; fix the display with a transform at
   render time (`typo()` in the Guide, `_typo()` in Spiritual Paths, the
   replace in `renderExamenStep()`).
11. Photographs are permitted at a practice's threshold only, never behind
   reading text. A threshold photograph is one `.atmos-photo` layer between
   the flame and the grain, graded toward the practice's `--atmos-rgb`, shown
   by a class on the root and removed on a single slow fade before the first
   inner screen. Inner screens are drawn light only.
