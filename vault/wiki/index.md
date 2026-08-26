# Vault Index

Master map of the vault. Every new wiki page gets a line here (step 4 of the ingestion protocol in [CLAUDE.md](../CLAUDE.md)).

## app/
- [stack.md](app/stack.md) — platform, backend services, native-vs-web origin. Flags the iOS/Android app-ID split. _(2026-08-22)_
- [deploy.md](app/deploy.md) — Netlify config, the manual `www/` sync and its drift risk, build environments, git conventions. _(2026-08-22)_
- [subscription-paths.md](app/subscription-paths.md) — how `isSubscribed()` and `claude.js` decide access. Flags the `'active'` vs `'premium'` mismatch and the unauthenticated TTS function. _(2026-08-22)_
- [architecture.md](app/architecture.md) — line-region map of `index.html`'s major systems: shell, practices, data layer, subscription flow, bells, Rosary, Netlify functions. _(2026-08-22)_

## raw/decisions/
- [2026-08-23-office-rebuild-plan.md](../raw/decisions/2026-08-23-office-rebuild-plan.md) — Divinum Officium cleared as a source (MIT covering software and liturgical texts alike, confirmed by project lead Fr. Albert Marcello 2026-08-24 — licence question closed), the Office rebuilt with real daily propers, a `traditional` / `modern` rite toggle, build sequence, and the pre-Advent target. _(2026-08-24)_
- [2026-08-23-promo-attribution-system.md](../raw/decisions/2026-08-23-promo-attribution-system.md) — per-parish/rep promo attribution columns, `trial_extended_until` on the profile, the `redeem_promo_code()` RPC and why a row lock was required, the unauthenticated `user_id` hole closed, and the missing `service_role` GRANT caught as a 403 in production. _(2026-08-23)_
- [2026-08-22-vault-setup-and-tts-endpoint.md](../raw/decisions/2026-08-22-vault-setup-and-tts-endpoint.md) — vault creation and the no-code-copies rule, Netlify `publish = "."` exposure blocked, `elevenlabs-tts.js` deleted (404 confirmed live), subscription trace, the `'active'` origin solved, token-refresh guard and the concurrent-refresh logout bug, bundle ID split confirmed intentional, admin dashboard never deployed. _(2026-08-23)_

## features/
- [office-vespers.md](features/office-vespers.md) — how the Vespers text is produced. Originally four known issues, none fixed: no daily proper, `getLiturgicalSeason()` month off-by-one (Christmas returns `'advent'`), `getPsalmWeek()` mid-week rollover that drifts with DST, and Vespers reusing the Lauds antiphon. **All four now fixed**, plus a fifth date bug found while testing (Stage 2, 2026-08-24). The no-daily-proper gap is closed for the **traditional** rite by the corpus rebuild (**Stage 3 complete, 2026-08-25** — corpus, bilingual renderer, and a rite toggle on the Office screen; 516 checks) and remains true of the **modern** rite, which is still the default. Traditional Compline is still the modern text, disclosed on the card, and is a post-Advent item. _(2026-08-23, updated 2026-08-25)_

## content/
_(meditation corpus, sources, taxonomy, validation rules — no pages yet)_

## ops/
_(store submissions, RevenueCat/Stripe, Supabase, builds — no pages yet)_

## marketing/
_(positioning, channels, experiments — no pages yet)_
