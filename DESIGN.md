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
  fade before the first inner screen. Devotional images are the other
  exception: where an image is content (the Rosary's mystery images, its
  closing Madonna and Child) it is shown as a framed image in the flow
  (`.devotional`): the shared frame, the grain and the vignette on the image
  itself, the atmosphere's hue bleeding into its edges, with the text beneath
  or beside it, never over it.
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
- **The viewport is what is visible.** Full-screen layers use `inset: 0`, never
  a height. Where a height must be written it is `100dvh` with `100vh` on the
  line before it as the fallback; `100vh` alone is never written, because iOS
  reports it as the tallest the viewport ever gets and the address bar takes
  the difference off the bottom. The viewport meta carries `viewport-fit=cover`
  and every header pads its top with `env(safe-area-inset-top)`. The document
  itself never scrolls: `html` and `body` are `overflow:hidden` at `100dvh`
  with `overscroll-behavior:none`, never locked with a negative top, and every
  screen and overlay is a fixed direct child of `body`. `pinDocument()`, the
  first script, holds the document at 0 whenever a surface opens
  (`showScreen`, the Guide, Paths, the paywall, Settings, the letter, the
  terms, onboarding) and whenever the window or the visual viewport reports a
  move, except while a field has focus, so a fixed layer is never carried off
  the top by a toolbar collapsing or a stray scroll.

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
| Rule of Life | 8,120,32 | forest | .88 | 50% / 36%, behind the text |
| Rosary Meditations | 192,28,172 | violet | .88 | 50% / 36%, behind the text |
| Spiritual Autobiography | 70,8,152 | purple | .90 | 50% / 36%, behind the text |
| The Companion | 6,34,98 | navy | .80 | 50% / 36%, behind the text |
| Deeper | 120,148,200 | softer blue | .55 | 50% / 36%, behind the text |
| Amma Sophia (the Autobiography's Inspiration tab) | 58,86,150 | dusk blue, `SOPHIA` beside the array | .68 | 50% / 36%, behind the text |

Put the glow where the eye rests in that practice. Text and gold accents do
not change with the hue.

Saint of the Day is the one screen whose hue is the Church's, not the
array's: the atmosphere takes the day's liturgical colour, set on
`#screen-saint[data-color]` by `initSaintScreen()` from the calendar.

| Colour | `--atmos-rgb` | Strength | Worn |
|---|---|---|---|
| Green | 16,112,52 | .90 | Ordinary Time |
| Violet | 92,36,158 | .88 | Advent, Lent |
| White (warm) | 235,215,170 | .62 | Christmas, Easter, most feasts and solemnities |
| Red | 172,20,36 | .88 | Passion, Pentecost, martyrs |
| Rose | 214,96,132 | .80 | Gaudete and Laetare Sundays |

Green is the default before the calendar loads. Text and gold accents do not
change with the colour.

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
  `.atmos-vignette`: `position:absolute; inset:0; z-index:0; aria-hidden`,
  `contain:strict`. Driven entirely by the atmosphere variables above. It is
  always exactly the box it sits in: a screen's, or the viewport's where an
  overlay sets `position:fixed` (the Guide, Spiritual Paths, the paywall, the
  terms, the letter, sign-in); `inset:0` sizes it and `contain` keeps the
  page that scrolls over it out of its layout and paint. The grain is a
  256px raster tile, `assets/grain-256.png` (warm white at a noise alpha up
  to .12, made by a small node script and checked in), repeated by the
  compositor; the SVG turbulence filter it replaces was rasterised across
  the whole layer. The same tile is the site-wide `.grain` over home and
  the `.devotional` frame's grain. Inactive screens are
  `visibility:hidden` as well as `opacity:0`, switched after the fade, so
  only the active screen's atmosphere is painted and composited; before
  this every screen's glow and flame (`will-change`) stayed on the GPU at
  once, seventeen atmospheres under whichever overlay was open.
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

- **Rule of Life**: a document, not a practice, so no threshold, no
  photograph, no ring, no card. The array's forest (`--atmos-rgb` 8,120,32,
  strength .88) sits behind the text at the Guide's height. The rule is read,
  not ticked: no checkboxes. Each commitment is a serif line (`.rol-name`,
  a button that opens the inline editor on tap), an optional sans description
  beneath, and a faint provenance line (`.rol-source`) where the item came
  from a Guide movement or a seed's tradition; the remove is a faint `×` at
  the edge. Items are grouped by rhythm under quiet serif headings ("Each
  day," "Each week," "This season."), painted by `renderRuleItems()` from the
  in-memory model. The store (`still_rule_items`) gains optional `rhythm`
  and `source` fields; `rhythm` reads as daily when absent, and every older
  shape (`{name, desc, checked}`, the Guide's `{name}`, bare strings) loads
  through `ruleNormalize()`. The Guide's `addRule(name, source)` now names
  its movement. The established date is stored beside the array in
  `still_rule_established` (ISO), stamped on the first save that holds an
  item, mirrored in the cloud row and restored from it; `setRuleDate()`
  renders it, falling back to today only when nothing is stored. From the sixth commitment one serif line sits under the
  input (`.rol-growing`); the add is never refused. Four seeds
  (`RULE_SEEDS`: Benedict, Ignatius, the Divine Office, Francis de Sales)
  are shown open beneath the empty state and behind a "Begin
  from a tradition" link once anything is written; each adds its
  commitments with the rhythm set and the tradition as source, skipping
  names already present, never replacing. The vault holds no text for these
  traditions, so each seed states the pattern without quotation and carries
  `[NEEDED: source]` in a code comment. "Print this page" calls
  `window.print()`; the `@media print` block shows only `#screen-rule`, drops
  the atmosphere, header, add row, seeds and foot, and sets the sheet in the
  app's faces in ink on white. Untouched: the Examen, the calendar, the
  cloud mirror's shape.

- **Rosary Meditations**: no ring; the beads are the progress. No card. The
  array's violet, Community's retired hue (`--atmos-rgb` 192,28,172, strength .88), sits behind
  the text at the Guide's height. The images are content, not backdrop: the
  cloud-of-witnesses photograph is no longer the screen's background, and
  each mystery's image is the first thing on its screen, a `.devotional`
  frame at reading measure (`#cowImg`, still the tap target for another
  meditation), then the title, the fruit, the scripture and the meditation
  in the serif. The beads (`.cow-beads`, painted by `beadsHTML()` inside the
  `CoW` module) are five decades on one line, an Our Father bead and ten
  Hail Marys each: decades prayed in gold, the decade in hand lit as the
  meditations advance through its pool, the current bead in the candle;
  nothing lit on the opening, everything lit at the close. The close is the
  Madonna and Child: `#cowBgImg`, which `finish()` swaps and `exit()` swaps
  back, now lives in a `.cow-hero.devotional` at the top of the scroller,
  hidden until `.cow-finale`, then full-height like a threshold, fading up
  over `--d-breath`, with the concluding prayers beneath it. The module's
  templates use `<div>` where they used `<p>` and `<h3>`, because the
  mobile block sizes `.feature-main p` with `!important`; every id, `data-*`
  hook, `.cow-*` class the module binds to, the audio, the prayers, the
  mystery data and the saves are unchanged. There was no bead-arc code to
  remove; only a stale banner line naming it.

- **Sign in / create account** (`#authOverlay`): one screen on the tokens,
  Sitting's gold behind the fields (`--atmos-rgb` 205,155,10, .92, at 46%),
  no card. One email field, one password field, two actions always visible
  with Sign in primary; no toggle between modes. `signIn()` and
  `createAccount()` set the mode `submitAuth()` reads and call it; the
  Supabase requests (`/auth/v1/signup`, `/auth/v1/token`, `/auth/v1/recover`)
  and everything after a successful auth are untouched. Errors show in place
  through `showAuthError(text, action)`: an unknown email or wrong password
  on Sign in (GoTrue's `invalid_credentials` covers both) offers "Create this
  account instead" in one tap; an existing email on Create account says so
  and moves focus to Sign in. The global `.auth-input` / `.auth-btn` rules
  stay for the phone-verify screen; this overlay's fields are `.auth-field`
  and its buttons the shared classes.

- **Spiritual Autobiography**: a reading surface, no card, no ring. The
  array's purple (`--atmos-rgb` 70,8,152, strength .90) sits behind the text
  at the Guide's height. The photograph is content, not backdrop: it heads
  the page in a `.devotional.graded` frame at reading measure (the `.graded`
  modifier quiets the image and washes it toward the practice's hue) and
  scrolls away with the rest; nothing is laid over it. The Inspiration tab's
  portrait is framed the same way, with its words beneath. Tabs are one row
  of sans labels (`.autobio-tab`, the one in hand in the candle); each pane
  enters on `phaseIn`. Entries (`.activity-chip`, `.echo-entry`), the echo
  from the past, the quote and the narrative (`.journal-narrative`, whose
  `<p>`s the narrative builders emit and the mobile block would resize, hence
  the `!important`s) are serif at reading measure; dates, types, counts'
  labels and tabs are sans. The month counts (`.stat-chip`) are figures with
  labels, not chips. `renderPracticeCalendar()` paints its cells inline and
  is untouched. The tab handler had a stray `S` token that threw on every
  tab switch, so the Echoes, Record and Inspiration renderers never ran; it
  is removed. The saves, `DB`, the memory digest and the narrative request
  are unchanged.

- **Saint of the Day**: on the real calendar. No card, no ring; the hue is
  the day's liturgical colour (table above). The General Roman Calendar is
  generated by `tools/liturgical-calendar/` from romcal 1.3.0 into
  `corpus/calendar/general/<year>.json` for 2026 to 2030 (the United States
  calendar beside it, unused until a setting reads it), each date carrying
  its season, a week derived by counting Sundays (Ordinary Time numbered as
  the Ordo numbers it, forward from the Baptism and back from Christ the
  King), its colour, psalter week, and every celebration romcal lists with
  the winner marked. The traditional rite reads the same records the Office
  prays, `corpus/traditional/calendar-index.json`, re-sliced per year. The
  app reads the copies the generator writes under `assets/calendar/` and
  `assets/saints/`, because `corpus/` is a forced 404 on the site and is not
  in the native bundle. `Liturgy` (an IIFE beside the screen code) fetches
  the year and the lives the moment it is defined, so `getTodaysSaint()`
  answers synchronously: the Office's Te Deum rule reads its `rank`, which
  is `solemnity` on solemnities. While the year is still in flight,
  `renderOfficeHour()` waits on the same promise before painting (with a
  four-second ceiling, and a repaint when the file lands), so Vigils opened
  in the first second of a weekday solemnity still gets its Te Deum. The lives are `corpus/saints/lives.json`, the
  183 bios and prayers moved out of the script unchanged, keyed by romcal's
  celebration key (178) or MM-DD (5 American saints not on the General
  Calendar), with empty `practice` and `practice_source` fields. The screen
  is three parts: the day (`.sd-day`, `.sd-celebration`, `.sd-meta`, the
  other celebrations quietly), the saint (`.sd-name`, `.sd-bio` in the
  serif, the prayer as a `.voice`), and, only when a life carries a
  practice, "Today, like [name]:" with Keep this, which adds it to the Rule
  for the season through `ruleAddItem()` with the saint as source. No day
  is silent: with no life on file the day shows Psalm 117:24 (Douay-Rheims,
  attributed), and on a free Saturday in Ordinary Time the memorial of the
  Blessed Virgin Mary. The old "A Day of Ordinary Time" fallback and its
  unattributed quotation are gone.

- **The voices (the Companion, Deeper)**: one pattern, one voice each. No
  card, no ring; the light sits behind the text at the Guide's height. Three
  states on the `.companion-state` panels the ask functions already toggle.
  The opening: the voice's mark (`.voice-mark`, the cross in gold), its name
  (`.voice-name`, sans micro) and its line (`.voice-line`, serif italic), the
  prompt in the serif at `--t-md` with no quotation marks (`.voice-prompt`:
  the voice is speaking), the textarea (`.voice-write`, serif italic at
  `--t-base`, a hairline frame, `!important`s against the global
  `.companion-textarea` rule it still carries for the Autobiography's sake),
  and the action row (`.voice-actions`) with the remaining line beside the
  button in the sans at micro size, sentence case so it holds to two lines at
  390px (`.voice-remaining`, the Companion's own weekly count; Deeper keeps
  no count, so its slot is empty). The writing: the figure recedes. The
  answer: a reading surface, the source as a gold micro label
  (`.voice-source`), the reply in the serif at reading measure
  (`.voice-reply`), the invitation beneath a hairline (`.voice-invitation`),
  then Hear response and the follow-ups stacked in `.voice-after`. Each
  voice's photograph is its threshold, kept as the same file: one
  `.atmos-photo` layer between the flame and the grain, graded toward the
  hue and quieted, standing in the lower half of the frame (`height:52%`, its
  top dissolving through a mask) so the input never sits over a face at
  390px. The photograph reads in its own colours, no desaturation; the hue
  is a light grade at the edges only and the band settles into the ink at
  its foot, under the shared grain and vignette. It stays through the
  opening and the writing (`:has()` on the input panel's `.active`) and
  recedes on the one slow fade (`--d-veil`) when the listening state
  begins, staying gone on the answer; no logic changed. The answer keeps
  the question: `.voice-question`, the serif italic at reading measure with
  a hairline beneath, read from the textarea by a watcher on the answer
  panel the moment it shows, nothing stored. Beside Hear response, Share
  (`shareVoiceCard()`) draws the exchange on a 1080x1350 canvas in the
  app's faces: the voice's hue as the ground, the cross and the name, the
  question in the serif italic, the reply in the serif, stillprayer.app as
  the watermark. Long replies scale the type down together to two thirds;
  past that the card ends with an ellipsis and the full text stays in the
  app. Offered through `navigator.share` with the file where the browser
  allows, on native through a Capacitor Share plugin with Filesystem if one
  is present, otherwise as a download. No dependency. Both prompts
  carry their em dash and curled apostrophe in the markup, since no save
  reads them. The old `.companion-*` stylesheet is retired except the state
  contract (Sitting's panels use it) and the textarea rule; the mobile
  block's `.companion-wrap p` and `#cResponseText`/`#dResponseText` lines
  are gone. The requests, the feature keys, the limits and their display
  logic, the digest, the playback and the saves are unchanged.

- **Amma Sophia**: the third voice, on the same pattern, in place: she stays
  the Autobiography's Inspiration tab (`#autobio-mystic`, now also
  `.voice-pane`, the scope the `.voice-*` text rules share with
  `.voice-screen`). While her tab is in hand the room takes her hue, a dusk
  blue between the Companion's navy and Deeper's softer blue, `SOPHIA` beside
  the `W[]` array (she is not a home world, so not a row) and set on the
  screen by a `:has()` on the pane's `.active`; the framed photograph at
  the head of the page grades toward it with her. Her portrait stays a
  `.devotional` frame, the light grade only (the `.graded` wash was too
  heavy on her face), with her name and line beneath, then the day's quote
  from the tradition. The opening: her prompt in the serif, in her
  voice ("Bring a question, or leave it empty and let me speak."), the
  textarea, Speak to me. The portrait stays through the writing. Once the
  ask has left the opening (`showMysticState()` hides `#mysticInput`
  inline, so `#mysticInput[style*="none"]` is the state) the portrait
  recedes on the one slow fade and closes, the quote steps aside, and her
  name heads the listening and the answer, which keeps the question at the
  top and is the reply in the serif at reading measure with Hear response,
  Share and Ask another beneath; no left rule, no card, no repeated label. The old `.ab-response` card, `.ab-listen` and the mobile block's
  `#mysticResponseText` line are gone. Her request, feature key, limit,
  the onboarding-free flag, the playback and the saves are unchanged.

- **Settings** (`#settingsModal`): chrome, not a practice. No atmosphere;
  the field alone on `--ink-1`, the sheet keeping its overlay geometry and
  the iOS max-height rule, the header sticky inside the scrolling panel with
  Close as the one way out (the Done button is gone). Five groups in this
  order, each a sans micro heading (`.st-heading`) over hairline rows
  (`.st-row`), no cards: Practice (Office calendar, anchor prayer, how the
  voices speak, fasting mode), Bells (the master switch, bell voice, the
  Hours with their times, your own bells, the notification note), Reading
  (larger, brighter text), Account (the signed-in email, subscription with
  View plans and Restore purchases, the promo code, Sign out as a plain
  ghost), About (version, privacy, support, a colophon). Delete account sits
  alone past About, plain text with its warning line, the only red. Labels
  are sentence case in the sans; only the title is serif. One switch
  (`.st-switch`) wherever on/off is meant, driven by `aria-pressed`, which
  every setter already writes; the `!important`s beat the inline background
  and knob transform they also write. The bell's On/Off pair is one switch
  calling the same `setBell()` with the opposite of `bellEnabled`. A
  segmented control (`.st-seg`) only for the calendar and the voices, the
  chosen button read off the inline colour `renderRiteButtons()` and
  `setDepth()` write. Bell voices are rows with a play control and the
  chosen one in the candle; the radio the picker's change listener needs is
  still in the row, visually hidden. The two bell templates emit classes
  instead of inline styles; their inputs, classes and listeners are what
  bell-native.js and the save read, unchanged. A small script after the
  sheet paints the account line, the version and `data-platform` for the
  note (iPhone, Android, web) on open; it calls nothing. The mobile block's
  14px-on-every-div rule for the panel, the old modal classes and the
  header-wrap rule are retired. Every onclick target and storage key is the
  one it was.

- **Paywall** (`#paywall`): one component for both entry points, the lock
  (`showPaywall(false)`, the trial over) and the plans preview
  (`showUpgrade()`, from Settings and the voices' limits); the legacy
  Premium screen is gone. No card, no border. Sitting's gold behind the text
  at the Guide's height, the atmosphere fixed under a scrolling column on
  `--ink-0`, so nothing shows through from home. The wordmark in the serif,
  the eyebrow beneath in the sans micro ("Your trial has ended" or "Still,
  without limits" by entry point), the offer as two quiet rows
  (`.pw-plan`), annual first and selected by default, one mark in the
  candle on the chosen row, the plan name, its price and the saving; under
  the annual row the year by the day. What they keep in the serif as plain
  sentences, the audio note in the sans, one primary action carrying the
  selected price. Beneath it "Have a code?", which opens a field in place;
  Redeem hands the code to the Settings field and calls the same
  `redeemPromoCode()`, whose message is mirrored back. Hidden on the native
  app, as the Settings field is (Apple 3.1.1). Then the trial line (only on
  the lock, from the trial constants), Restore purchases, Contact, Not now
  (only on the preview) and Sign out as ghost links, then Privacy and Terms.
  Delete account is not here; it lives in Settings. The prices are
  `PAYWALL_PRICES` beside the trial constants, the one place the paywall
  reads a price; `pwRender()` writes the rows, the saving (what twelve
  months would cost against the year, rounded), the per-day line (the annual
  price over 365, to the nearest cent) and the action, and `pwBill()` moves
  the selection. `pwSubscribe()` still calls `startCheckout()` with
  `annual` or `personal`; `restorePurchase()` and `signOut()` are the
  calls they were.

- **Trial**: days alone. `PAYWALL_DAYS` (14) from the first open, the start
  in `still_trial_start`; the session limit and its counter are gone
  (`PW_SESSIONS_KEY` stays defined only because `redeemPromoCode()` still
  resets it). `trialIsOver()` is days-left-zero, lifted while a redeemed
  code's `trial_extended_until` is in the future. The terms are said once
  (`#trialTerms`): one screen over home on the tokens, the wordmark, the
  terms in the serif with the number written from `PAYWALL_DAYS`, Begin.
  Its script shows it the first time home is active for a trial that began
  within the last day, records the start it was shown for in
  `still_trial_terms_shown`, and calls nothing. Under Account in Settings
  one line, "Trial · n days left", "Trial · extended" or "Trial · ended",
  painted from `getTrialDaysLeft()` and hidden once subscribed. Dev
  override: `localStorage.still_trial_debug = '{"daysLeft": 3}'` makes
  `getTrialDaysLeft()` return that number; it is read only when set and
  never for a subscriber (`trialDebug()` checks `isSubscribed()` first), and
  a `sittingsLeft` field is ignored. To walk a trial on the preview with a
  throwaway account: set `daysLeft` to 14 to see the terms (they show for a
  trial that began within the last day), then lower it; clear
  `still_trial_terms_shown` to see the terms again. The one reminder
  (`#trialReminder`, in Contemplative Sitting's Session Complete panel): when
  `PAYWALL_REMIND_DAYS` (3) days or fewer remain, one sans line beneath the
  closing quote, "n days left in your trial. Nothing changes until then.",
  with "See the offer" as a gold link calling `showUpgrade()`. Painted by a
  script watching the panel's `.active`; shown once per trial and recorded
  in `still_trial_reminder_shown` the moment it shows, so leaving the screen
  is the dismissal; never during a practice, never on home, never while a
  code's extension holds. Set `daysLeft` to 3 and finish a sitting to see
  it; clear the key to see it again. After the trial the app still opens to
  home with no interstitial: the launch lock is gone and the startup block
  only refreshes the subscription cache. `enterFeature()` is the one gate:
  Contemplative Sitting, Saint of the Day and Rosary Meditations
  (`TRIAL_FREE_SCREENS`) open
  without a paywall; every other practice and voice shows it at its door,
  every time, always dismissable. Not now hides it and the person is on
  home, where they never left; never at launch.
  `showPaywall()` now reads the state for its copy ("Your trial has ended"
  once over, "Still, without limits" before) and always offers Not now; the
  argument callers pass is kept but no longer decides anything. The Day-30
  discount code and the shadowed trial reset at the Night Watch are deleted;
  `?resetTrial` in the URL still resets, beside the one definition. Set
  `daysLeft` to 0 and tap a practice to see the door.

- **The letter** (`#ob-2`, the Guestmaster's letter): onboarding's second
  step, once per install, since onboarding shows only while
  `still_onboarded` is unset and `obFinish()` sets it; and the same step
  lifted again from Settings > About ("Read the Guestmaster's letter",
  `showGuestmasterLetter()`), where Begin only closes it
  (`obLetterBegin()` branches on `window._letterReread`) and nothing is
  recorded. The letter is text now, transcribed from the photograph with
  its one typo mended ("let them come to you"): the salutation, the
  paragraphs and the sign-off in the serif at reading measure, in the
  candle-hi rather than the white, the gold cross at its head and the wax
  seal as a small SVG in the seal's red beneath the sign-off. No card, no
  border; Sitting's gold at full strength with the glow low like a candle
  on the table (`--atmos-y` 74%, the ground at 100%). "Cell of the Guest"
  and its line stay above; "Hear the letter read aloud" is the same button
  and audio; Begin is the one action. The two image classes
  (`.letter-mobile`, `.letter-desktop`) and the photograph's markup are
  retired; the file stays, and the Sacristy still shows it.

- **Home** (`#home`): not redesigned. Two things only. The list's type is
  on the loaded faces: the practice names and the wordmark in the serif,
  the eyebrow, the badges, the header's label, the description panel and
  its action and the gallery button in the sans, every size, weight,
  colour and spacing as it was, and so are the mobile Enter tab (serif) and
  the counter (sans); the dots are drawn, with no type. The ⓘ in the header pulses in the candle on a first visit
  (`#homeInfoBtn.info-unseen`, a text-shadow and a small scale, still under
  reduced motion) until it is tapped once; the script beside the home
  markup then writes `still_info_seen` and it never returns.
  `openHomeInfo()` is untouched.

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
