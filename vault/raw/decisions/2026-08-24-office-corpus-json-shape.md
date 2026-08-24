---
date: 2026-08-24
type: design-proposal
status: ACCEPTED 2026-08-24 — all six open questions answered; still no code written
session: Divinum Officium clone, corpus data-shape proposal
participants: Matt Proia, Claude Opus 5
updated: 2026-08-24 — §4 open questions answered (Matt Proia)
---

# 2026-08-24 — Traditional Office corpus: proposed JSON shape

**Status: proposal only.** Nothing built, no schema committed, no app code
touched. This is stage 1 of the build sequence in
[the Office rebuild plan](2026-08-23-office-rebuild-plan.md) §4 — the
traditional corpus — presented for approval before implementation.

Divinum Officium cloned to scratchpad at commit
`d298ce904014df3811a5fe48dce6387ca40cb6d0`.

---

## 1. What the clone actually contains

The Windows clone partially fails as the plan predicted, but **less badly than
recorded**. `core.protectNTFS=false` was not the operative fix — the failures
were `Filename too long`, and they hit **only** `Latin-gabc/chants/*.gabc`
(Gregorian notation, not needed). Every text file landed. `git status` reports
the whole tree as deleted because the index did not finish writing; the
filesystem is complete. Verified by direct file counts, not by git.

| Path | Files | Size |
|---|---|---|
| `English/Tempora` | 589 | 1.77 MB |
| `English/Sancti` | 454 | 3.0 MB |
| `English/Commune` | 44 | 435 KB |
| `English/Psalterium` | — | 1.0 MB |
| `English/Psalterium/Psalmorum` | 202 | 792 KB |
| `English` total | — | 9.9 MB |
| `Latin` total | — | 20.1 MB |

**Correction to the plan's clone note:** it says the index is left empty and
"tens of thousands of files unwritten". Only 665 chant files were unwritten
here. The index observation is right; the file-loss estimate is not.

## 2. The decisive finding — do not port the engine

The DO renderer is **~20,000 lines of Perl** across `cgi-bin/horas/` and
`cgi-bin/DivinumOfficium/`. The `.txt` files are not data — they are a
templating DSL that the Perl interprets. `Ordinarium/Vespera.txt` in full is
structural directives, not text:

```
#Psalmi
#Capitulum Hymnus Versus
(sed rubrica Monastica nisi votiva C12 aut rubrica cisterciensis)
#Capitulum Responsorium Hymnus Versus
#Canticum: Magnificat
#Preces Feriales
(sed rubrica Monastica aut rubrica 1962 omittitur)
```

Five sigils carry meaning: `#` a structural section resolved in Perl, `$` an
include from `Prayers.txt` (65 blocks), `&` a shared block, `@` a cross-file
reference (`@Tempora/Pent01-4:Oratio`), and `(...)` a rubric conditional
evaluated against the selected kalendar. Calendars are **layered deltas** —
`Tabulae/Kalendaria/1960.txt` opens with `#This file only notes the changes to
Reduced - 1955`, so resolving 1960 means replaying a chain.

**Recommendation: generate, don't reimplement.** DO ships two headless
renderers of its own — `standalone/tools/epubgen2/EofficiumXhtml.pl` and
`regress/scripts/generate-diff.sh` with `expand-dates.pl` — plus
`docker-compose-generator.yml`. Drive that Perl in Docker over a date range,
parse its output into the JSON below, and commit the JSON. The Perl becomes a
**build-time dependency, never shipped**. Still ships static JSON.

This also keeps the attribution question clean: we redistribute the liturgical
text, not the software.

## 3. Proposed shape — three layers

The corpus is heavily repetitive: psalms recur weekly, the ordinary never
changes, and commons (`C1` = one Apostle, etc.) are shared across dozens of
feasts. Fully inlining each day would run 10–15 MB. So: **a normalized shared
store, plus thin per-day files that reference it.**

### Layer 1 — year calendar index (`office/traditional/calendar/2026.json`)

Identity and resolution only, no text. ~450 B/day, ~165 KB/year.

```json
{
  "schema": "still.office.calendar/1",
  "rite": "traditional",
  "kalendar": "1960",
  "year": 2026,
  "source": {
    "repo": "DivinumOfficium/divinum-officium",
    "commit": "d298ce904014df3811a5fe48dce6387ca40cb6d0"
  },
  "days": {
    "2026-08-24": {
      "psalterDay": 1,
      "season": "pentecost",
      "week": "Pent12",
      "office": {
        "key": "Sancti/08-24",
        "title": "St. Bartholomew the Apostle",
        "rank": { "name": "Duplex II classis", "value": 5.5, "class": 2 },
        "commune": "C1",
        "colour": "red"
      },
      "commemorations": [
        { "key": "Tempora/Pent12-1",
          "title": "Monday of the Twelfth Week after Pentecost" }
      ],
      "hours": {
        "vigils":  { "of": "Sancti/08-24", "nocturns": 3 },
        "lauds":   { "of": "Sancti/08-24" },
        "vespers": { "of": "Sancti/08-24", "kind": "second" }
      }
    }
  }
}
```

`psalterDay` is 0–6, Sunday-based, matching DO's `Day0`–`Day6`. `rank.value`
is DO's own numeric precedence (`;;Duplex II classis;;5.5;;ex C1` in
`Latin/Sancti/08-24.txt`) — keep it; it is what decides occurrence.

### Layer 2 — one resolved hour (`office/traditional/2026-08-24/vespers.json`)

An ordered array of typed blocks. Proper text — which exists nowhere else — is
inlined. Anything shared is a `ref`. Vespers/Lauds ≈ 3–7 KB; Vigils ≈ 12–20 KB.

```json
{
  "schema": "still.office.hour/1",
  "date": "2026-08-24",
  "hour": "vespers",
  "kind": "second",
  "title": "St. Bartholomew the Apostle",
  "rank": "Duplex II classis",
  "colour": "red",
  "sources": ["Sancti/08-24", "Commune/C1", "Ordinarium/Vespera"],
  "parts": [
    { "type": "rubric", "text": "Said silently." },
    { "type": "prayer", "ref": "prayer:pater-noster" },
    { "type": "prayer", "ref": "prayer:ave-maria" },
    { "type": "versicle", "ref": "prayer:deus-in-adjutorium" },

    { "type": "psalmody", "items": [
      { "antiphon": { "text": "In all the earth * their sound hath gone forth." },
        "psalm": { "ref": "psalm:109" } },
      { "antiphon": { "text": "Their words unto the ends * of the world." },
        "psalm": { "ref": "psalm:110" } },
      { "antiphon": { "text": "..." }, "psalm": { "ref": "psalm:111" } },
      { "antiphon": { "text": "..." }, "psalm": { "ref": "psalm:112" } },
      { "antiphon": { "text": "..." }, "psalm": { "ref": "psalm:116" } }
    ]},

    { "type": "chapter", "citation": "Eph 2:19-20",
      "text": "Brethren: Now you are no more strangers and foreigners...",
      "response": "Thanks be to God." },

    { "type": "hymn", "ref": "hymn:exsultet-orbis-gaudiis" },

    { "type": "versicle",
      "v": "Thou shalt make them princes over all the earth.",
      "r": "They shall remember thy name, O Lord." },

    { "type": "canticle", "name": "magnificat",
      "ref": "canticle:magnificat",
      "antiphon": { "text": "..." } },

    { "type": "collect",
      "text": "O Almighty and everlasting God, Who hast given unto us this day...",
      "conclusion": "per-dominum" },

    { "type": "commemoration",
      "title": "Monday of the Twelfth Week after Pentecost",
      "antiphon": { "text": "..." },
      "versicle": { "v": "...", "r": "..." },
      "collect": { "text": "...", "conclusion": "per-dominum" } },

    { "type": "conclusion", "ref": "ordinary:vespers-conclusion" },
    { "type": "marian", "ref": "marian:salve-regina" }
  ]
}
```

The block vocabulary is closed and small: `rubric`, `prayer`, `versicle`,
`psalmody`, `chapter`, `hymn`, `responsory`, `canticle`, `lesson`, `collect`,
`commemoration`, `conclusion`, `marian`. `lesson` is Vigils-only. One renderer
handles all three hours — the hours differ only in which blocks appear.

### Layer 3 — shared store, loaded once

`psalms.json` (~800 KB), `hymns.json`, `prayers.json` (65 blocks),
`ordinary.json`, `commons.json`, `marian.json`.

```json
{
  "schema": "still.office.psalms/1",
  "translation": "Douay-Rheims",
  "psalms": {
    "109": {
      "number": 109,
      "verses": [
        { "ref": "109:1a",
          "text": "The Lord said to my Lord: * Sit thou at my right hand:" },
        { "ref": "109:1b",
          "text": "Until I make thy enemies * thy footstool." }
      ]
    },
    "210": {
      "number": 210,
      "kind": "canticle",
      "title": "Canticle of the Three Young Men",
      "citation": "Dan 3:57-88,56",
      "verses": ["..."]
    }
  }
}
```

Two format facts to preserve, both verified in the source:

- **The `*` is the mediant**, the chant half-verse break, not a footnote. It
  must survive into the data; how it renders is a separate call.
- **Psalm numbers 210–273 are canticles**, not psalms — DO's own numbering.
  `Psalm210.txt` is the Benedicite. The psalter antiphon lines encode this as
  `antiphon text;;number`, so `;;210` in `[Day0 Laudes1]` points at a canticle.
  A naive "number ≤ 150" filter drops the canticles from Lauds entirely.

## 4. Open questions — these change the shape, so decide before building

1. **First vs Second Vespers.** Traditional Vespers on the evening of day N is
   frequently *First* Vespers of day N+1. "Today's Vespers" is therefore
   ambiguous at 6pm. This is not in the rebuild plan and it is a genuine
   modelling fork: either the calendar index emits a separate evening entry, or
   the client resolves it by clock time. **Recommend the former** — keep the
   liturgical logic at build time.
2. **Latin alongside English?** Doubles the corpus. Traditional-rite users
   often expect it, and DO has it aligned. Cheap to include now, expensive to
   retrofit — every text-bearing block would carry `{ "en": ..., "la": ... }`
   instead of a bare string. **Decide now, not later.**
3. **Vigils length.** Three nocturns is nine lessons — roughly 20 KB and 30+
   minutes to pray. Full form, the three-lesson ferial form, or both behind the
   existing concise/full toggle?
4. **Vespers is five psalms in the traditional rite, not three.** Still's
   current render shows three, and one in concise mode. Five is not optional in
   this rite, so "concise" has to mean something else here — shorter lessons,
   no hymn — or the concise toggle hides an incomplete office.
5. **Delivery.** Today the Office is constants compiled into `index.html` with
   no network call at all ([office-vespers.md](../../wiki/features/office-vespers.md)).
   1.2 MB of shared store cannot be inlined. This introduces the Office's first
   fetch-and-cache path. Bundle by season, or fetch per day?
6. **Coverage window.** Generating 2026–2028 and committing it is ~3 MB of JSON
   and removes all runtime calendar computation, at the cost of a regeneration
   step every few years. **Recommend it** — it sidesteps the entire class of
   date bugs recorded in the plan §6.

## 5. What this does not address

Stage 2 of the plan — the three known `modern`-rite bugs
(`getLiturgicalSeason()` off-by-one, `getPsalmWeek()` drift, missing
`vespersAntiphon`) — is untouched here and still unfixed. Precomputing the
traditional calendar means those bugs cannot affect the traditional rite, but
they remain live for `modern`, which is the default for existing users.

---

# Amendments

Appended blocks, newest last. Per the vault convention in
[CLAUDE.md](../../CLAUDE.md), decision records are amended by appending, never
by rewriting.

## §4 amended 2026-08-24 — all six open questions answered

Matt Proia, 2026-08-24. **Supersedes:** §4, which posed these as open. The
proposal moves from PROPOSED to ACCEPTED. Still no code written.

| # | Question | Decision |
|---|---|---|
| 1 | First vs Second Vespers | **Resolve at build time** — a separate evening entry in the calendar index |
| 2 | Latin alongside English | **Include it now** |
| 3 | Vigils length | **Both forms** — full (9 lessons) and concise (3); **concise is the default** |
| 4 | What concise means | **Fewer lessons, never fewer psalms** |
| 5 | Delivery | **Bundle everything. Offline is a feature.** |
| 6 | Coverage window | **Pregenerate 2026–2028**, regenerate annually |

### Two consequences that change the shape proposed in §3

**Decisions 5 and 6 together break the per-date file layout.** §3 proposed
`office/traditional/2026-08-24/vespers.json` — one file per date per hour. With
Latin included and three years pregenerated, that is roughly 30 KB/day of
propers per language, ×2 languages ×365 ×3 ≈ **55–65 MB**. Not bundleable.

The fix is that propers do not vary by year. `Sancti/08-24` is the same text
every year; only *which* office wins on a given date changes. So **propers are
keyed by their Divinum Officium office key, not by date**, and the calendar
index resolves date → office key. Three years then costs three calendar
indices (~165 KB each), not three copies of the corpus.

Revised bundle estimate: propers both languages ≈ 7 MB, shared store (psalms,
hymns, ordinary, commons, prayers) ≈ 2.3 MB, calendar indices ≈ 0.5 MB —
**≈ 10 MB raw, ≈ 3 MB gzipped**. Bundleable, and it is what makes decision 5
affordable.

**Concise Vigils is not "the first three of nine."** The three-lesson form is
a distinct rubrical form, not a truncation of the nine-lesson one. The
generator must emit it by asking Divinum Officium to render the three-lesson
office, and must not slice `[Lectio1]`–`[Lectio3]` out of a nine-lesson file.
Getting this wrong produces a plausible-looking office that is liturgically
incorrect, and it will not be obvious from inspection.

### Consequence for the existing modern rite

Decision 4 contradicts how Still's current concise mode behaves — it drops
Vespers to a single psalm ([office-vespers.md](../../wiki/features/office-vespers.md)).
Traditional Vespers is five psalms and concise may not reduce that. Whether the
modern rite's concise mode is brought into line with the same rule is a stage-2
question and is **not decided here**.
