# Still — visual system

The tokens live in `index.html` as CSS custom properties on `:root` (banner
`DESIGN TOKENS`, just above the reset). This file is the explanation. If the two
disagree, the CSS is the truth; fix this file.

Contemplative Sitting (`#screen-sitting`) is the reference implementation. Every
other practice is redesigned by applying these tokens the same way, not by
inventing new values.

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
| `--t-sm` | 14–15px | Interface notes |
| `--t-base` | 16–18px | Body, anchor pills |
| `--t-md` | 20–24px | Quotes, instructions, the anchor line |
| `--t-lg` | 26–34px | Headings |
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
| `--candle-hi` | #fff1cf | The brightest point: ring core, hero numbers |
| `--gold` | #d9a441 | Attributions, saved states, secondary accents |
| `--gold-deep` | #8c5d12 | Reserved for shadows under gold |
| `--ember` `--ember-hi` | #ff9448 / #ffd7a8 | A tapped thought |
| `--text-hi` `--text-mid` `--text-low` `--text-faint` | warm white at .94 / .68 / .42 / .24 | Four text levels; there is no fifth |
| `--line` `--line-strong` | warm white at .12 / .24 | Hairlines, borders |
| `--gold-a10` `--gold-a25` `--gold-a55` | gold at .10 / .25 / .55 | Fills, borders, done-states |

All whites are warm (`255,246,232` family), never pure `#fff`. Feature palettes
in `W[]` still drive the shared background layers behind the screen; a token
screen paints its own atmosphere over them.

### Space

`--s-1` … `--s-8` = 4, 8, 12, 16, 24, 32, 48, 64px. `--gutter` is the screen's
side padding (18px at 390, 38px wide). `--measure` (34rem) caps content width.

### Motion

| Token | Value | Use |
|---|---|---|
| `--d-fast` | .2s | Hover, press |
| `--d-base` | .45s | State changes on controls |
| `--d-slow` | .9s | Phase-track colour, anchor line |
| `--d-breath` | 1.8s | Phase panel fade-in |
| `--d-drift` | 8s | Breathing glow loop |
| `--ease-out` | cubic-bezier(.2,.7,.2,1) | Everything that settles |
| `--ease-breath` | cubic-bezier(.45,0,.2,1) | Loops |

Under `prefers-reduced-motion`: `--d-breath` .3s, `--d-drift` 0, drift/flicker
animations `none`, the ember fades in place instead of rising.

### Shape

`--r-sm` 3px for cards and pills of text; `--r-pill` for buttons and toggles.

## Components (as built in Sitting)

- **Atmosphere** `.sit-atmos`: base radial gradient, a large breathing glow
  (`sitBreath`, `--d-drift`), a smaller flickering core (`sitFlicker`, 5.3s),
  a static SVG-turbulence grain tile, and a vignette. Placed `position:absolute;
  inset:0; z-index:0` inside the screen, `aria-hidden`.
- **Phase track** `.phase-track`: `justify-content:space-between`, labels
  `flex:0 0 auto; white-space:nowrap`, connectors `flex:1 1 6px; min-width:4px`.
  Under 420px the label drops to 9px and .1em tracking. `:has()` quiets every
  step in idle and marks every step done in complete. Three steps show:
  Settle, Watch, Return. The labels are display text only; the state machine's
  phases are still settle / watch / sit / return, `#ps-watch` stays in the DOM
  hidden by id (`setSittingPhase()` writes to it and assigns `className`
  outright, so a helper class would be wiped), and the sit state is the one
  labelled "Watch".
- **Ring** `.sit-ring`: SVG circle r=88 in a 200 viewBox, circumference 552.92.
  `--ring-frac` (1 → 0) drives `stroke-dashoffset`, arc opacity (.92 → .22), the
  halo and the core. Transitions are 1s linear so one-second ticks read as
  continuous. A tiny observer script after the Sitting markup reads the `m:ss`
  the state machine writes and sets `--ring-frac`; it holds no logic.
- **Ember** `.tap-ripple`: the element `tapThought()` already appends becomes
  a 10px radial ember with a glow that rises 58px and fades in .68s (it is
  removed at 700ms by the existing code). Reduced motion: fade in place.
- **Phase panel** `.companion-state.active`: `sitPhaseIn` over `--d-breath`
  with an 8px rise (`--rise`, 0 under reduced motion).
- **Voice block** `.voice` + `.voice-attrib`: serif italic quote, sans micro
  attribution in `--gold`, em dash in the markup.
- **Controls**: `.dur-btn` pills (selected = candle text on `--gold-a10`),
  `.anchor-pill` serif cards, `.btn-primary` / `.btn-primary.gold` pills,
  `.rec-*` recording card.

## Rules for the next practice

1. Add `data-tokens` to the screen root. The legacy `bumpFonts()` script (near
   the end of the file) inflates every element under 14px on phone user agents;
   `data-tokens` exempts the screen. Without it the type scale is destroyed on
   devices and looks fine in a desktop browser.
2. Scope every rule to the screen id. The old global classes (`.feat-*`,
   `.phase-instruction`, `.timer-display`) and the mobile blocks (`@media
   (max-width:1024px)` around line 1000 and `(max-width:768px)` around line
   1230 and 3700) fight unscoped rules with `!important`.
3. Do not use `<p>`, `<h1>`, `<h2>` for text inside `.feature-main`; the mobile
   block sizes them with `!important`. Use `<div>` and `<blockquote>` with the
   role classes. Never write `style="font-size:…"`; an attribute-selector rule
   rewrites those too.
4. Keep IDs, `onclick` hooks, and the classes the practice's JS toggles. Move
   markup freely otherwise. When JS writes inline styles that fight the tokens
   (Sitting's `playAnchor()` does), override with a commented `!important`
   rather than editing the logic.
5. Replace media backgrounds with the atmosphere recipe. Vary the glow's
   position and hue per practice rather than adding layers.
6. One timer ring per timed phase; hide the digits, never delete the element
   the state machine writes to.
7. Screenshot at 390×844 in every state before and after. The candle glow
   should be visible in each state; if a state is all text, it is too dense.
