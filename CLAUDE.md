# Still — working rules (repo root)

Single-file app: index.html (~14k lines) + Capacitor wrapper. Web, iOS, Android from one codebase.
For a map of index.html's major systems with line regions, read vault/wiki/app/architecture.md
before reading the whole file. Live code is ground truth if they disagree.

## Git
- Always `git add` specific files. Never `git add .`
- Commit each practice separately with a message naming it.
- Any command that writes or touches git gets one plain-English line saying what it does
  and why it's safe. Approve git commit/push/reset/checkout one at a time, never "don't ask again."

## Build output
- After any change to index.html: `cp index.html www/index.html`
  (same for bell-native.js, still-mobile/, assets/ if touched).
- Never copy partners.html, delete-account.html, privacy.html, support.html, reset.html into www/.

## Redesign boundaries
- Do not touch auth (Supabase), payments (RevenueCat, Stripe), Netlify functions, or Capacitor
  paths. Visual layer only unless I say otherwise. Keep all IDs, function names, and data flow intact.
- No new dependencies. No build step. Vanilla only.
- Every screen must work at 390px wide. Honor prefers-reduced-motion.
- Scripture is Douay-Rheims. Never invent quotes or attributions; mark gaps `[NEEDED: source]`.

## Voice
Direct, technical, no filler. Flag problems proactively.

vault/ has its own CLAUDE.md for the knowledge vault; it applies only there.

- Before any merge of redesign/practices into main: run /ultrareview on the branch first, then review its findings with Matt.