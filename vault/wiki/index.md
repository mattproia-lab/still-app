# Vault Index

Master map of the vault. Every new wiki page gets a line here (step 4 of the ingestion protocol in [CLAUDE.md](../CLAUDE.md)).

## app/
- [stack.md](app/stack.md) — platform, backend services, native-vs-web origin. Flags the iOS/Android app-ID split. _(2026-08-22)_
- [deploy.md](app/deploy.md) — Netlify config, the manual `www/` sync and its drift risk, build environments, git conventions. _(2026-08-22)_
- [subscription-paths.md](app/subscription-paths.md) — how `isSubscribed()` and `claude.js` decide access. Flags the `'active'` vs `'premium'` mismatch and the unauthenticated TTS function. _(2026-08-22)_
- [architecture.md](app/architecture.md) — line-region map of `index.html`'s major systems: shell, practices, data layer, subscription flow, bells, Rosary, Netlify functions. _(2026-08-22)_

## features/
_(one page per feature — no pages yet)_

## content/
_(meditation corpus, sources, taxonomy, validation rules — no pages yet)_

## ops/
_(store submissions, RevenueCat/Stripe, Supabase, builds — no pages yet)_

## marketing/
_(positioning, channels, experiments — no pages yet)_
