---
date: 2026-08-24
type: design-proposal
status: ACCEPTED 2026-08-24 — six questions answered, schema approved; still no code written
session: Divinum Officium clone, corpus data-shape proposal
participants: Matt Proia, Claude Opus 5
updated: 2026-08-24 — §4 questions answered, §3 schema approved; second pass corrected psalmody and adopted render-as-oracle; third pass records what the parser taught us; fourth pass has the generated corpus, final sizes, and the 08-25 correction (Matt Proia)
---

# 2026-08-24 — Traditional Office corpus: proposed JSON shape

> **Superseded on status and schema — see the Amendments at the end of this record.** §4's six questions were answered and §3's schema was approved, both on 2026-08-24. The text below is what was proposed before those answers and is kept verbatim. Still no code written.

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

> **Superseded — see [§3 amended 2026-08-24](#3-amended-2026-08-24--schema-approved).** The per-date file layout below does not survive decisions 5 and 6; propers are keyed by office key instead. The three-layer split and the block vocabulary do survive.

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

> **Superseded — all six answered. See [§4 amended 2026-08-24](#4-amended-2026-08-24--all-six-open-questions-answered).**

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

## §3 amended 2026-08-24 — schema approved

Matt Proia, 2026-08-24. **Supersedes:** §3, whose three-layer sketch was written
before the six questions were answered. The schema below is **approved**. Still
no code written.

### Provenance of the examples

Every Latin and English string in this amendment is **copied verbatim from the
clone at `d298ce9`**, not composed. Sources: `English|Latin/Sancti/08-24.txt`,
`English|Latin/Commune/C1.txt`, `English/Psalterium/Psalmi/Psalmi major.txt`.
The St. Bartholomew collect was diffed byte-for-byte against
`English/Sancti/08-24.txt` `[Oratio]` and matches exactly, with the trailing
`$Per Dominum` lifted into the `conclusion` field. Elisions are marked `…`.

### Two findings from the source that shaped the schema

**`[Rule]` blocks.** `Latin/Sancti/08-24.txt` carries a machine-readable
resolution directive not noted in §3:

```
[Rule]
ex C1;
9 lectiones
Psalmi Dominica
Antiphonas horas
```

Where the common comes from, how many lessons, which psalter. Carrying it into
the day entry makes the generator's output auditable against the source rather
than something to be taken on trust.

**Hymn resolution — settled, and no season component is needed.** Surveyed
`Major Special.txt` (22 `Hymnus` blocks), Tempora (9 of 589 files define one),
Commune, and Sancti (39 of 454), against `horas/specials/hymni.pl:104–118`.
Two distinct naming regimes:

- **Proper and common files** name blocks `Hymnus <hora>` with **no scope** —
  the file *is* the scope.
- **The psalter** names them `Hymnus <scope> <hora>`, where `scope` is either a
  psalter day (`Day0`–`Day6`) **or** a season (`Adv`, `Quad`, `Quad5`,
  `Pasch`). `gettempora` returns one or the other into the **same slot** — they
  are alternatives, not orthogonal dimensions.

So a hymn ref needs a namespace, not a season field:

| Ref | When |
|---|---|
| `hymn:proper/<office-key>/<hora>` | the winner's own file defines one |
| `hymn:commune/<C-key>/<hora>` | the common defines one |
| `hymn:psalter/<scope>-<hora>[-hiemalis]` | fallback |

`hiemalis` (the winter form) is the one genuinely date-dependent variant —
`hymni.pl` appends it only for `Day0` at Laudes within Epiphany 2–6,
Quadragesima prep, or the October/November rank ranges. **The generator
resolves it and emits the final key.** No season logic ships to the client,
which is the point of precomputing.

**Two generator traps found in the same survey.** `HymnusM…` /
`HymnusMMatutinumUS` blocks are **monastic** and must not be picked up by
prefix-matching `Hymnus` — Still ships the Roman 1960 rite. And
`Hymnus Vespera 3` exists in three Sancti files, selected when `$vespera == 3`,
which is DO's marker for **Second** Vespers — independent confirmation that the
`vespers1` / `vespers2` split below is required and not a convenience.

### Schema A — a single day entry

In `office/traditional/calendar/<year>.json` under `days`. Identity and routing
only, no liturgical text.

```json
"2026-08-24": {
  "psalterDay": 1,
  "season": "pentecost",
  "week": "Pent12",

  "office": {
    "key": "Sancti/08-24",
    "title": { "la": "S. Bartholomæi Apostoli",
               "en": "St. Bartholomew the Apostle" },
    "rank": { "name": "Duplex II classis", "value": 5.5, "class": 2 },
    "commune": "C1",
    "colour": "red",
    "rule": { "ex": "C1", "lectiones": 9,
              "psalmi": "Dominica", "antiphonas": "horas" }
  },

  "morning": {
    "vigils": { "proper": "Sancti/08-24", "forms": ["concise", "full"] },
    "lauds":  { "proper": "Sancti/08-24" },
    "commemorations": []
  },

  "evening": {
    "vespers": {
      "kind": "second",
      "of":   { "date": "2026-08-24", "key": "Sancti/08-24" },
      "proper": "Sancti/08-24",
      "commune": "C1",
      "colour": "red",
      "commemorations": [
        { "key": "Tempora/Pent12-1", "reason": "occurrence",
          "title": { "la": "…", "en": "Monday of the Twelfth Week after Pentecost" } }
      ]
    }
  }
}
```

- **`evening` is a sibling of `morning`**, not a third hour inside it — decision
  1. `evening.vespers.of.date` disambiguates: equal to the entry's own date it
  is Second Vespers; equal to the *next* date the evening belongs to tomorrow's
  feast and it is First Vespers. The client reads this, never computes it.
- **`psalterDay: 1` and `rule.psalmi: "Dominica"` disagree deliberately.** Aug 24
  2026 is a Monday, so the ferial psalter day is 1, but a II class feast
  overrides to Sunday psalms. Both are kept so the calendar fact and the
  liturgical override stay separately visible.
- **`forms` on `vigils` records what exists**, not what was chosen. A feria with
  only ever three lessons carries `["concise"]` alone, so the UI does not offer
  a full form with no content behind it.

The occurrence/concurrence resolution shown is structurally illustrative. Under
the 1960 rubrics First Vespers is heavily restricted, and which office wins any
given evening is the generator's output — never hand-authored.

### Schema B — a single hour block

`propers/traditional/Sancti_08-24.json` → `.hours.vespers2`. **Keyed by office
key, not by date** — the normalization decisions 5 and 6 forced.

```json
{
  "office": "Sancti/08-24",
  "hour": "vespers",
  "kind": "second",
  "sources": ["Sancti/08-24", "Commune/C1", "Ordinarium/Vespera"],

  "parts": [
    { "type": "rubric", "forms": ["full"],
      "text": { "la": "Secreto", "en": "Said silently." } },
    { "type": "prayer", "ref": "prayer:pater-noster", "forms": ["full"] },
    { "type": "prayer", "ref": "prayer:ave-maria",   "forms": ["full"] },
    { "type": "versicle", "ref": "prayer:deus-in-adjutorium" },

    { "type": "psalmody",
      "source": "psalter:Day0 Vespera",
      "antiphons": "commune:C1 Ant Vespera",
      "items": [
        { "antiphon": { "text": {
            "la": "Hoc est præcéptum meum, * ut diligátis ínvicem, sicut diléxi vos.",
            "en": "This is my commandment * that you love one another, as I have loved you." } },
          "psalm": { "ref": "psalm:109" } },
        { "antiphon": { "text": {
            "la": "Majórem caritátem * nemo habet, ut ánimam suam ponat quis pro amícis suis.",
            "en": "Greater love than this no man hath, * that a man lay down his life for his friends." } },
          "psalm": { "ref": "psalm:110" } },
        { "antiphon": { "text": {
            "la": "Vos amíci mei estis, * si fecéritis quæ præcípio vobis, dicit Dóminus.",
            "en": "You are my friends * if you do the things that I command you, said the Lord." } },
          "psalm": { "ref": "psalm:111" } },
        { "antiphon": { "text": {
            "la": "Beáti pacífici, * beáti mundo corde: quóniam ipsi Deum vidébunt.",
            "en": "Blessed are the peacemakers * the clean of heart, they shall see God." } },
          "psalm": { "ref": "psalm:112" } },
        { "antiphon": { "text": {
            "la": "In patiéntia vestra * possidébitis ánimas vestras.",
            "en": "In your patience * you shall possess your souls." } },
          "psalm": { "ref": "psalm:113" } }
      ] },

    { "type": "chapter", "citation": "Eph 2:19-20", "resolvedBy": "engine",
      "text": {
        "la": "Fratres: Jam non estis hóspites et ádvenæ: sed estis cives Sanctórum et doméstici Dei: superædificáti super fundaméntum Apostolórum, et Prophetárum, ipso summo angulári lápide Christo Jesu.",
        "en": "Brothers: Now therefore you are no more strangers and foreigners; but you are fellow citizens with the saints, and the domestics of God, built upon the foundation of the apostles and prophets, Jesus Christ himself being the chief corner stone." },
      "response": { "ref": "prayer:deo-gratias" } },

    { "type": "hymn", "ref": "hymn:commune/C1/vespera", "forms": ["full"] },

    { "type": "versicle",
      "v": { "la": "Annuntiavérunt ópera Dei.", "en": "They declared the works of God." },
      "r": { "la": "Et facta ejus intellexérunt.", "en": "And understood his doings." } },

    { "type": "canticle", "name": "magnificat", "ref": "canticle:magnificat",
      "antiphon": { "slot": "Ant 3", "text": {
        "la": "Estóte fortes * in bello, et pugnáte cum antíquo serpénte: et accipiétis regnum ætérnum, allelúja.",
        "en": "Be valiant * in battle, fight the ancient serpent and accept the eternal kingdom. Alleluia." } } },

    { "type": "collect", "conclusion": "per-dominum",
      "text": {
        "la": "Omnípotens sempitérne Deus, qui hujus diéi venerándam sanctámque lætítiam in beáti Apóstoli tui Bartholomǽi festivitáte tribuísti: da Ecclésiæ tuæ, quǽsumus; et amáre quod crédidit, et prædicáre quod dócuit.",
        "en": "O Almighty and everlasting God, Who hast given unto us this day to be a day worshipful, and holy, and joyful, because of the Feast of thy blessed Apostle Bartholomew, grant, we beseech thee, unto thy Church both to love that which he believed, and to preach that which he taught." } },

    { "type": "commemoration", "reason": "occurrence", "of": "Tempora/Pent12-1",
      "forms": ["full"], "antiphon": "…", "versicle": "…", "collect": "…" },

    { "type": "conclusion", "ref": "ordinary:vespers-conclusion" },
    { "type": "marian", "ref": "marian:salve-regina" }
  ]
}
```

- **`forms` semantics.** Absent means both forms. `["full"]` means full only.
  Decision 4 is enforced *structurally*: `psalmody` may never carry a `forms`
  key, so concise physically cannot drop psalms — the schema forbids what the
  current app does.
- **Every human-readable string is a `{la, en}` pair** — decision 2. Refs are
  not, because the shared store carries both languages.
- **`antiphon.slot`** preserves the provenance established in the 2026-08-23
  trace: `Ant 1` is the Magnificat antiphon at First Vespers, `Ant 3` at Second.
  First Vespers lives at `.hours.vespers1` in the same file and differs chiefly
  in that slot.
- **`resolvedBy: "engine"`** flags a value the source files do not state
  outright. `Commune/C1.txt` has no `[Capitulum Vespera]`; the Vespers chapter
  is resolved in `capitulis.pl`. Marking these makes it visible which fields
  came from a readable file and which came from Perl, which matters when
  spot-checking (the register warning in the §Reference section of the
  [rebuild plan](2026-08-23-office-rebuild-plan.md) still applies).

### Vigils uses the same shape, with one addition

Concise is **not** a slice of full. Both lesson sets live in one `parts` array,
tagged — nine blocks `"forms": ["full"]`, three blocks `"forms": ["concise"]`,
each generated by asking Divinum Officium for that form. A renderer filtering on
`forms` gets a rubrically correct office either way; a renderer taking the first
three of nine gets something that looks right and is not.

## §3 amended 2026-08-24 (second pass) — psalmody corrected against the renderer

Matt Proia, 2026-08-24. **Supersedes:** the `psalmody` block in the §3 schema
above. Found by standing up the renderer natively (see the §2 amendment) and
comparing its output for 2026-08-24 against the hand-built schema.

**The schema's Vespers psalmody was wrong.**

| | Schema said | Renderer produces |
|---|---|---|
| Source | `psalter:Day0 Vespera` | `commune:C1 Ant Vespera 3` |
| Psalms | 109, 110, 111, 112, 113 | **109, 112, 115, 125, 138** |
| Antiphons | `C1 [Ant Vespera]` — "Hoc est præcéptum meum" | `C1 [Ant Vespera 3]` — "Iurávit Dóminus" |

**The rule that was missed, now verified in the source.** In `Commune/C1.txt`,
`[Ant Vespera]` carries **no** `;;psalm` numbers, so First Vespers falls through
to the psalter — which is what `[Rule] Psalmi Dominica` governs. `[Ant Vespera 3]`
carries its **own** psalm numbers (`;;109 ;;112 ;;115 ;;125 ;;138`), which
override the psalter at Second Vespers. The `3` suffix is DO's Second Vespers
marker throughout — the same marker as `Hymnus Vespera 3` and `Ant 3`.

**A distinction worth stating precisely, because conflating it caused the
error.** 109, 112, 115, 125, 138 is the **Common of Apostles** Second Vespers
set. It is *not* "Sunday Second Vespers". Sunday Vespers in the psalter
(`[Day0 Vespera]` in `Psalmi major.txt`) genuinely **is** 109, 110, 111, 112,
113 — that part of the original schema was correct in isolation and wrong only
because it was pointed at the wrong office.

The corrected antiphons, verbatim from the render:

| Psalm | Latin | English |
|---|---|---|
| 109 | Iurávit Dóminus, * et non pœnitébit eum: Tu es sacérdos in ætérnum. | The Lord hath sworn * and will not repent: thou art a Priest for ever. |
| 112 | Cóllocet eum * Dóminus cum princípibus pópuli sui. | That the Lord may set him * with the princes of his people. |
| 115 | Dirupísti, Dómine, * víncula mea: tibi sacrificábo hóstiam laudis. | O Lord, thou hast loosed my bonds; * I will offer thee the sacrifice of thanksgiving. |
| 125 | Eúntes ibant * et flebant, mitténtes sémina sua. | They went forth weeping * sowing their seed. |
| 138 | Confortátus est * principátus eórum, et honoráti sunt amíci tui, Deus. | O God, thy friends are honourable; * their power is waxen right strong. |

Everything else in the §3 hour block verified correct against the render:
chapter (Eph 2:19-20), versicle, Magnificat antiphon (*Estóte fortes*), collect,
and the hymn (*Exsúltet orbis gáudiis*).

## §4 amended 2026-08-24 (second pass) — decision 3 reworded

Matt Proia, 2026-08-24. **Supersedes:** decision 3 in the §4 amendment above,
which offered Vigils in "both forms, full (9 lessons) and concise (3)".

**Lesson count follows the calendar. It is not a toggle.** The office's own
`[Rule]` block and rank decide it, and Divinum Officium exposes no control over
it. Confirmed four independent ways:

1. `Latin/Sancti/08-24.txt` `[Rule]` → `9 lectiones`.
2. `horascommon.pl:2162` branches on `$winner{Rule} =~ /9 lectiones/` — the
   office decides, not the caller.
3. `horas.dialog`, DO's complete options list, has **no** lessons or nocturns
   control anywhere.
4. All four `expand` modes tested on 2026-08-24: `tota` 9 lessons/108 KB,
   `psalteria` 9/105 KB, `propria` 53 KB, `lineamenta` 12 KB. `expand` controls
   how much referenced text is inlined, not how many lessons are said.

Rendered evidence: 2026-08-24 (Duplex II classis) → **9 lessons**; 2026-08-25
and 2026-08-26 (ferias) → **3 lessons**. Three-lesson offices are real; there is
simply no three-lesson St. Bartholomew.

**Reworded decision 3.** Concise Vigils is an **explicitly non-rubrical
Nocturn I abridgement** — a Still product decision, not a liturgical form. It
must be labelled as such in the UI so it is never mistaken for the rubrical
three-lesson office. Full Vigils renders whatever the calendar gives, 9 or 3.

**Schema consequence.** `forms` on lesson blocks no longer means "which
rubrical form" — it means "included in Still's abridgement". And the day
entry's `vigils.forms` becomes `vigils.lessons: 9 | 3`, a calendar fact rather
than a menu of options.

## §2 amended 2026-08-24 — generation approach: render as oracle

Matt Proia, 2026-08-24. **Supersedes:** §2's implicit assumption that the
parser would read the `.txt` files. §2's core recommendation — drive DO's Perl
rather than port it — stands and is now proven in practice.

**Docker is not in the chain.** Docker Desktop is installed on the Windows box
but its engine cannot start (WSL absent). It is not needed: the Docker image
only serves the same CGI app, and `regress/scripts/generate-diff.sh` shows the
renderer is invoked directly:

```
perl web/cgi-bin/horas/officium.pl "version=Rubrics 1960" "command=prayVespera" "date=8-24-2026"
```

The sole missing dependency was `CGI.pm` (pure Perl, vendored locally). Dates
are `M-D-YYYY`. Latin and English come out of a **single** render as two `<TD>`
cells per row, so decision 2 costs nothing at generation time.

**Decision: the HTML render is ground truth, not the `.txt` sources.**

The reason is not convenience. `horascommon.pl:2173` defines `spell_var()`,
which applies **version-specific Latin orthography** at render time. For
`$version =~ /196/` it runs `tr/Jj/Ii/` across every non-tag part, with
exceptions for `H-Iesu` and `er eúmdem`; other versions get an entirely
different substitution set. The source files carry `hujus`; the Rubrics 1960
office says **`huius`**. Parsing `.txt` would ship the wrong orthography for the
rite we are shipping, and would do it silently.

### The drop-cap problem — resolved, and it was not DO's fault

Divinum Officium emits initials in their own font block:

```html
<FONT SIZE='+2' COLOR="red"><B><I>G</I></B></FONT>lória Patri, et Fílio, ...
```

The corruption reported earlier (`G lória`, `O mnípotens`) came from the
extraction step replacing every tag with a **space**. The document's own
whitespace is already correct.

**The rule: block-level tags become newlines; every other tag becomes the empty
string.** Never a space.

Proof that no cleverer rule is needed — of 24 single-letter font blocks in the
Vespers render, 22 run straight into their word (`G` + `lória`) and 2 are
followed by a legitimate space (`O` + ` ye who`, `O` + ` Almighty`). Inserting a
space corrupts the 22; stripping a space corrupts the 2. Doing neither is
correct for all 24.

**Verified:** the English collect extracted from the HTML by this rule is
**byte-identical** to `English/Sancti/08-24.txt` `[Oratio]`. The Latin
differs by exactly one word — `huius` for `hujus` — which is `spell_var()`
working as intended, and is precisely why the render is the oracle.

### Two consequences, both approved 2026-08-24

**`resolvedBy: "engine"` is dropped from the schema.** It existed to mark
fields the `.txt` files did not state outright. Under render-as-oracle every
field comes from the engine, so the marker distinguishes nothing.

**`psalms.json` is generated per rite-version, not shared.** `spell_var()`
makes Latin psalm text version-dependent, so one shared psalter would be wrong
for every version but the one it was generated from. Cost: the ~800 KB Latin
psalter is duplicated per version shipped. Still ships Rubrics 1960 only, so
this is currently one copy — but the generator must key the output by version
rather than assuming a single psalter.

## §3 amended 2026-08-24 (third pass) — what building the parser taught us

Written after the parser reached **135 passing assertions** across Vespers,
Lauds and Vigils (57 Vigils, 48 Lauds, 22 gap-closure, 8 Vespers) on
2026-08-24. Every item below was found by an assertion failing or by a survey
of the corpus — none was anticipated when the schema was approved.

### Six findings that change the schema

**1. Psalms carry verse ranges, and dropping them is silent.** The ferial
office renders `Psalmus 34(1-10) [1]`. A pattern requiring `Psalmus N [i]`
matched only 1 of 2026-08-25's 9 psalms — **eight would have vanished with no
error**. The psalm object gains an optional `verses` field:

```json
{ "ref": "psalm:34", "verses": "1-10" }
```

Ps 34, 36 and 37 are each split across three positions in one nocturn, so this
is the ferial norm, not an edge case. The same form appears in the psalter
itself (`226(1-27)`).

**2. Canticles are keyed by citation, never by name — ambiguity is proven.**
The render names a canticle rather than numbering it:

```
Canticum Trium Puerorum [4]
Dan 3:57-88,56
```

**Ten Latin names are ambiguous**, and two collide *within the fourteen Lauds
positions themselves*: `Canticum Trium Puerorum` is both **210** and **220**,
`Canticum Moysis` is both **224** and **226**. `Canticum Isaiæ` maps to twelve
numbers. **The citation is unique across all 51 canticles** (asserted, zero
collisions), and the render supplies it on the following line. Keyed off the
**Latin** files: English headers disagree (`Psalm222` is `Isa 38:10-24` in
Latin, `Isa 38:10-23` in English) and carry quirks such as `Canticle of_Tobias`.

The psalm object therefore records what it keyed on:

```json
{ "ref": "psalm:210", "citation": "Dan 3:57-88,56",
  "canticle": "Canticum Trium Puerorum" }
```

**3. `Ad Nocturnum` is a distinct label from `Nocturnus I`.** The ferial office
has **one** nocturn, labelled `Ad Nocturnum`; the nine-lesson office has three,
labelled `Psalmi cum lectionibus`, `Nocturnus II`, `Nocturnus III`. A parser
keyed on the roman-numeral form fails the ferial case outright. Nocturn count
is **read from the render, never assumed** — asserted in both directions.

Psalms and lessons **interleave**, so there is one `psalmody` block *per
nocturn*, not one per office; collapsing them would destroy the order. Every
psalm and every lesson carries a `nocturn` field.

**4. Inline rubrics are extracted as sibling blocks.** Stage directions sit
*inside* prayer text — `(genuflectitur)` mid-verse in the invitatory psalm,
`(Fit reverentia)` and `(Sequens versus dicitur flexis genibus)` inside the
Te Deum, and `(fit reverentia)` / `(Bow head)` in the Vespers and Lauds gospel
canticles. They are stripped from every text field and re-emitted as sibling
blocks immediately preceding the block they interrupted:

```json
{ "type": "rubric", "inline": true, "audio": "skip",
  "text": { "la": "Fit reverentia", "en": "bow head" } }
```

Asserted both ways: no raw parenthesised rubric survives in **any** text field,
and a corresponding block exists. Bare verse references such as `(1-10)` are
not rubrics and are left alone. **The text field is speakable with no
conditional logic** — which was the point.

**Standalone rubric prose also exists, and is not parenthesised.** Vigils emits
`Pater Noster dicitur secreto usque ad Et ne nos indúcas in tentatiónem:` and
`Reliqua omittuntur, nisi Laudes separandæ sint.` The parenthesis-only test
written for Vespers does not find them; detection is now "bare prose in the
heading position". This supersedes the note in the §2 amendment that the 1960
rite emits no rubric prose — **it does, in Vigils.** Vespers, Lauds, Prime and
Compline genuinely emit none.

**5. Hymn refs resolve from the first line — 145 hymns indexed.** Namespaces
as the earlier survey predicted: **100 proper, 22 commune, 23 psalter**. The
index is keyed on the Latin first line, which is the hymn's identity throughout
the tradition. Three things had to be handled: source lines carry
`{:H-AeternaChristi:}v. ` markup; `@` lines are cross-references or
sed-substitution derivations rather than text; and the 1960 `j`→`i`
normalisation must be applied so render and source compare equal.

Resolution **probes successive lines rather than assuming line 0** — the render
sometimes opens a hymn with a rubric (`Prima stropha sequentis hymni
dicitur…` on 2026-03-25). Asserted across all three namespaces on real dates:
`hymn:proper/sancti/12-25/vespera`, `hymn:commune/c2/laudes`,
`hymn:psalter/day2-laudes`.

**6. The psalmody source is only half-derivable — a real limit on the schema.**
The scope brace names the **namespace** but never the **specific key**:

| scope brace | namespace |
|---|---|
| `ex Commune aut Festo` | `commune` |
| `ex Proprio Sanctorum` | `proprium:sanctorum` |
| `ex Proprio de Tempore` | `proprium:temporis` |
| `ex Psalterio secundum diem` | `psalterium:diem` |
| `ex Psalterio secundum tempora` | `psalterium:tempora` |

A `Laudes:N` prefix also appears, selecting the Lauds psalm scheme — both
schemes observed (`Laudes:1` on 2026-02-02, `Laudes:2` on 2026-03-29).

**`ex Commune aut Festo` does not say *which* common; `ex Psalterio secundum
diem` does not say *which* day.** So the forms proposed earlier —
`commune:C1 Ant Vespera 3`, `psalter:Day0 Vespera` — **cannot be produced from
the hour render alone**. The `C1` comes from the calendar's `[Rule] ex C1`, the
`Day0` from `psalterDay`. The hour file therefore emits:

```json
{ "namespace": "commune", "scheme": null,
  "scope": "Psalmi & antiphonæ ex Commune aut Festo", "derived": true }
```

and the specific key stays in the calendar index, where it actually lives.
Joining the two is the client's job, or a later build step's — it is not
something the parser can infer. Guarded by an assertion that passes a
deliberately wrong `psalmody_source` as metadata and confirms it appears
nowhere in the output.

### Method note worth keeping

Assertions were written **before** each parser extension, and twice they caught
real silent-drop bugs on the first run — the Lauds canticle (items 4 and 5
dropped) and the ferial verse ranges (8 of 9 psalms dropped). Both would have
produced plausible-looking output over a three-year range.

Three assertion errors were mine, not the parser's, and are recorded because
the pattern matters: expected text transcribed from a **truncated** terminal
dump with the ending invented; and a shape assumption (`psalmody[0]`) that was
wrong about how nocturns nest. Verify expected values against the source file,
never against a dump that may have been cut.

## §3 amended 2026-08-24 (fourth pass) — corpus generated; final sizes

The corpus for **2026-08-24 → 2028-12-31** is generated and committed to
[`corpus/traditional/`](../../../corpus/traditional/). Tooling in
[`tools/office-corpus/`](../../../tools/office-corpus/). Still not wired into
the app.

### Correction: 2026-08-25 is not a feria

Earlier amendments repeatedly call 2026-08-25 "the feria", including in the
one-nocturn assertion work. **It is St. Ludovici, Regis Franciæ Confessoris,
III. classis** — confirmed against DO's Kalendarium. Every structural finding
that rested on it stands unchanged: one nocturn, three lessons, the
`Ad Nocturnum` label, and the psalm verse ranges. Only the label was wrong.
Three-lesson offices are a property of rank, and III class offices have three
lessons just as ferias do, which is why the mistake was invisible.

### Final sizes

Single-stream gzip, which is what a bundle actually costs:

| bundle | gzip |
|---|---|
| **Lauds + Vespers + shared store + calendar** | **810 KB** |
| Vigils alone (lazy-load candidate) | 2,268 KB |
| Everything in one bundle | 3,420 KB |

Raw: 17,579 KB across 2,092 proper documents, a 710 KB shared store
(`psalms.json` 435 KB — 150 psalms and canticles, 2,148 verses, both
languages; `hymns.json` 275 KB — 182 distinct hymns), and a 151 KB calendar.

**Vigils is 71% of the raw corpus** — 17.4 KB per document against 3.2 KB for
Vespers — because nine lessons of scripture and patristic prose are largely
unique text where psalmody repeats heavily. Splitting it into a lazy-loaded
bundle takes the install payload down **76%**, to under a megabyte for the
office most people actually pray daily.

### Dedup came to 29.4%, not the ~60% §3 implied

Honest accounting, because the earlier estimate was optimistic:

- Over 2.4 years **each liturgical day is mostly distinct.** Fixed feasts do
  collapse across all three years (Christmas, St. Bartholomew and the Nativity
  of the BVM each resolve to one shared document), but Vigils lessons follow a
  scriptural cycle that differs by year, and offices such as All Saints
  commemorate a different Sunday annually.
- Attaching office metadata to each document **reduced** dedup slightly, from
  2,004 to 2,092 unique documents. That is correct behaviour: a document now
  records which office it is, so two offices sharing text are no longer merged.

Where normalisation does pay is the shared store: **2,463 rendered hymn blocks
collapse to 182 distinct texts**, and the psalter is stored once rather than
inlined per day. That is 710 KB carrying what would otherwise be many MB.

### Office keys are title slugs, not Divinum Officium paths

`propers/s-bartholomaei-apostoli/vespers.json`, never `Sancti/08-24`.

**DO does not emit its internal office file keys in any output.** They exist
only inside the Perl — not in the office render, not in the Kalendarium, not in
the Ordo. Recovering them would mean reimplementing the resolution engine,
which §2 deliberately declined to do. So the office identity available to us is
the **title plus rank**, and keys are slugs of the title: stable, readable, and
derived from DO output, but not DO's own paths. Where one office has genuine
content variants across years, a numeric suffix separates them (201 offices do).

If a future need arises for DO's real keys, the honest options are to patch DO
to emit them or to maintain a mapping by hand — not to infer them.

### Two bugs found while harvesting the psalter

**English canticle citations disagree with Latin** — `1 Chron. 29:10-13`
against `1 Par. 29:10-13`. Keying both languages off the Latin citation map
left five canticles with Latin verses and `en: null`. The harvester now walks
Latin/English cell pairs and lets the **Latin side number both**, matching
segments positionally.

**A segment whose citation did not resolve dropped all its verses** rather than
yielding an unnumbered segment, which is what made the above silent.

Psalm 94 needed lifting from the Invitatory block: it renders with interleaved
refrains and no verse numbers, so it is not harvestable as numbered verses.
