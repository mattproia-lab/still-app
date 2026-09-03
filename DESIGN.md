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
  a mid-range phone composites them for free.
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

Set on `[data-tokens]` with Sitting's values; a screen overrides them on its
root. RGB triplets, so alpha can be scaled with `--atmos-a`.

| Variable | Sitting | Lectio | Meaning |
|---|---|---|---|
| `--atmos-ground` / `--atmos-mid` | #1e1108 / #0d0704 | #0c1a1e / #050c0f | Ground gradient stops |
| `--atmos-gy` | 100% | 30% | Where the ground gradient is anchored |
| `--atmos-glow` `-2` `-3` | 255,176,84 … | 222,214,190 … | The breathing glow, out to in |
| `--atmos-core` `-2` | 255,216,150 … | 244,238,220 … | The flicker core |
| `--atmos-x` / `--atmos-y` | 50% / 74% | 50% / 36% | Where the light sits |
| `--atmos-a` | 1 | .62 | Overall strength |

Sitting is a candle on a table: warm, low centre, watched. Lectio is lamplight
on a page: cool ink ground, pale vellum glow placed behind the text, softer so
scripture keeps its contrast. Put the glow where the eye rests in that practice.

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

### Hour palette

| Hour | Glow | Strength | Height |
|---|---|---|---|
| Vigils | near-black, cool grey `110,110,140` | .3 | 70% |
| Lauds | warming gold `255,196,110` | .95 | 62% |
| Prime | pale morning `236,228,205` | .7 | 40% |
| Terce | bright `255,240,200` | 1.1 | 34% |
| Sext | brightest `255,244,210` | 1.2 | 30% |
| None | amber `255,176,70` | .95 | 50% |
| Vespers | copper `214,120,70` | .95 | 68% |
| Compline | deep blue-grey `120,140,170` | .55 | 72% |

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
