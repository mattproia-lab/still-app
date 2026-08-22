# Still — Project Knowledge Vault

This vault is the living memory of **Still — Contemplative Prayer** (stillprayer.app, `app.stillprayer.still`), built and run by Matt Proia (Proia Digital LLC). You are the librarian and researcher for this vault. Your job: ingest sources faithfully, maintain an accurate cross-linked wiki, and answer questions with citations back to raw sources.

## Directory structure

```
vault/
├── CLAUDE.md            ← this file
├── raw/                 ← verbatim sources, NEVER edited after ingestion
│   ├── theology/        ← see Theology corpus scope below
│   │   ├── doctors/     ← Doctors of the Church (Liguori, Aquinas, Teresa of Ávila, John of the Cross…)
│   │   ├── saints/      ← other saints' writings & lives (Faber, Marmion, Denis the Carthusian…)
│   │   ├── catechism/   ← Catechism of the Catholic Church, Roman Catechism (Trent)
│   │   └── scripture/   ← Douay-Rheims texts, Catena Aurea commentary
│   ├── decisions/       ← architecture/design decision records
│   ├── sessions/        ← exported Claude conversation transcripts
│   ├── marketing/       ← copy, listings, X threads, n8n workflow notes
│   └── external/        ← articles, docs, App Store correspondence, PDFs
└── wiki/
    ├── index.md         ← master map of the vault
    ├── app/             ← architecture, codebase facts, deploy pipeline
    ├── features/        ← one page per feature (Rosary, Guide, Bells, Amma Sophia…)
    ├── content/         ← meditation corpus, sources, taxonomy, validation rules
    ├── ops/             ← store submissions, RevenueCat/Stripe, Supabase, builds
    └── marketing/       ← positioning, channels, experiments
```

## Theology corpus scope

The theological spine of the vault covers, in order of authority:

1. **Scripture** — Douay-Rheims only for quoted text.
2. **Catechism** — Catechism of the Catholic Church (cite by paragraph number, e.g. CCC §2708) and the Roman Catechism of Trent. Doctrinal claims in wiki pages should cite the CCC where possible.
3. **Doctors of the Church** — Aquinas, Liguori, Teresa of Ávila, John of the Cross, Francis de Sales, Bernard of Clairvaux, and others. Tag each raw file's frontmatter with `doctor: true` and the saint's name.
4. **Saints and spiritual masters** — Faber, Marmion, Denis the Carthusian, Guigo II, the Trappist/hesychast tradition, and other vetted authors. Public-domain translations preferred; record translator and edition in frontmatter.

Frontmatter template for `raw/theology/` files:

```yaml
---
author: Alphonsus Liguori
work: The Glories of Mary
edition: 1888, Grimm translation
doctor: true
source_url: (if any)
ingested: 2026-08-22
---
```

Taxonomy reminder: the meditation corpus uses `tradition` (not `patristic`) as its source category.

## Ingestion protocol

When Matt says "ingest this" (or drops a file into `raw/`):

1. **File the raw source** into the right `raw/` subfolder. Never alter its content. Prefix filename with date: `2026-08-22-<slug>.md`.
2. **Create or update wiki pages** — do not create a new page if an existing one covers the topic; update it and note the date.
3. **Every factual claim in a wiki page must cite its raw source** with a relative link: `([source](../../raw/decisions/2026-08-22-rosary-design.md))`.
4. **Update `wiki/index.md`** with any new pages.
5. **Report back**: what was filed, what pages changed, any contradictions with existing wiki content.

## Contradiction rule

If a new source contradicts the wiki, do not silently overwrite. Flag it: state both versions, cite both sources, and ask Matt which is current. Newer sources usually win for project state; never assume for theology.

## No-fabrication rule (inherited from the Rosary corpus)

- Never invent quotes, attributions, or scripture text. If a wiki page needs a quote you don't have in `raw/`, mark it `[NEEDED: source]`.
- Scripture is Douay-Rheims. Theological source taxonomy uses `tradition`, not `patristic`.
- When summarizing theological sources, the wiki page is an *index into* the raw text, not a replacement for it. Keep summaries short and link-heavy.

## Answering questions

- **Search, don't read everything.** Use grep/glob across `wiki/` first, follow links into `raw/` only as needed. Never load the whole vault into context.
- Answer with citations to vault files so Matt can verify.
- If the vault doesn't contain the answer, say so plainly — do not fill gaps from general knowledge without labeling it as such.

## Standing project facts (verify against wiki/app/ before relying on these)

- Single ~14,000-line `index.html`, Capacitor wrapper, iOS + Android + web. Netlify deploy, Supabase auth (`zbskapivansfewegllnz`), RevenueCat mobile / Stripe web, ElevenLabs + Anthropic AI features, Render TTS server.
- `www/` is manually synced build output: `cp index.html www/index.html && cp bell-native.js www/bell-native.js && cp -r still-mobile/. www/still-mobile/ && cp -r assets/. www/assets/`
- Git: always `git add` specific files, never `git add .`. Include the push command with every code change.
- iOS builds only on MacInCloud (`~/still-app`). Windows + VS Code is the primary environment.

## Relationship to the codebase

This vault lives at `vault/` inside the Still app repo. Code is never copied into the vault — Claude Code reads the live files directly, and they are always ground truth. The vault holds what code can't: decisions, history, theology, marketing.

- For "what does the code do" → read the actual source files.
- For "why is it this way" → search `wiki/` and `raw/decisions/`.
- `wiki/app/architecture.md` is a map of `index.html`'s major systems with line-region pointers — a table of contents, not a copy. Refresh it when architecture changes, and trust the live code over it if they disagree.

## Maintenance

- When asked to "audit the vault": check for wiki claims without citations, dead links, and pages not in the index.
- Monthly (or on request): produce a `wiki/changelog.md` entry summarizing what entered the vault.

## Voice

Answers are for Matt: direct, technical, no filler. Flag problems proactively.
