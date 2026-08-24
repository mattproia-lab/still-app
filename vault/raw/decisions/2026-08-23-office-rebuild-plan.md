---
date: 2026-08-23
type: decision-record
session: Divinum Officium evaluation, Office rebuild plan, rite toggle
participants: Matt Proia, Claude Opus 5
ingested: 2026-08-24
---

# 2026-08-23 — Office rebuild: Divinum Officium as source, and a liturgical rite toggle

Decisions only. **No code written, no schema changed.** Prompted by a report
that Vespers was showing yesterday's content, which turned out to be correct
behaviour — the Office has no daily proper at all. See
[office-vespers.md](../../wiki/features/office-vespers.md) for the trace that
led here.

---

## 1. Divinum Officium — MIT, cleared for use

**MIT, verbally confirmed by the maintainer on 2026-08-23. Commercial use is
cleared on the strength of that statement. Attribution required.**

Source: [DivinumOfficium/divinum-officium](https://github.com/DivinumOfficium/divinum-officium).

**No `LICENSE` file exists in the repository.** Verified 2026-08-23: the
GitHub `/license` endpoint returns **404**, the API reports
`"license": null`, and a recursive search of the entire tree for any path
matching `licen[sc]e`, `copying`, or `copyright` returns **nothing**. GitHub
only auto-detects a licence from a `LICENSE` file, which is why every
automated check reports the project as unlicensed.

Two things support the grant, and neither is a licence file:

- **The maintainer's verbal confirmation, 2026-08-23** — the basis on which
  commercial use is cleared.
- A `#### MIT License` section in prose in `README.md`, around line 83,
  carrying the standard MIT text. Written, but scoped by its own wording to
  "this software and associated documentation files (the 'Software')".

That scoping is why the verbal confirmation matters: what Still needs is the
**liturgical text data** under `web/www/horas/`, and whether the README's
"Software" reaches it is an open question inside the project — there are open
issues titled "Separate licenses for software and liturgical texts in the
project", "Reusing data in a different project", and "License?". The verbal
statement covers what the README arguably does not.

**Follow-up requested: ask the maintainers to add a `LICENSE` file to the
repository.** A verbal confirmation is not durable — it does not survive a
maintainer change, it cannot be cited by a reviewer, and it leaves every
automated licence scan reporting Still as depending on unlicensed content. A
committed `LICENSE` file, ideally one that says explicitly whether the
liturgical texts are included, would make this permanent. Until then this
record **is** the evidence, so do not delete it.

An earlier note in this vault said the project was unlicensed. That reflected
the automated checks, which are still accurate as far as they go; it is
superseded on the question of permission by the maintainer's confirmation.

Attribution is required and will be given.

## 2. The Office section will be rebuilt with proper daily texts

**Vespers, Lauds, and Vigils all get real daily propers.**

This is the fix for the root finding of the 2026-08-23 trace: the Office
currently has **no daily granularity whatsoever**. Nothing in the render takes
a day-level input. Within a season the only thing that changes is the psalms,
once a week — so through Ordinary Time the entire Office is unchanged from
Pentecost to Advent. "Showing yesterday's content" was accurate: yesterday's
Office and today's are the same text.

That is a content-model gap, not a bug, and no fix to the existing date
functions addresses it.

## 3. A liturgical rite toggle in settings

Two rites, user-selectable:

| Setting | Content | Notes |
|---|---|---|
| **traditional** | 1960 Roman Breviary, sourced from Divinum Officium | The new corpus |
| **modern** | Ordinary Time | **Default for existing users** |

Defaulting existing users to **modern** means nobody's Office changes under
them without an explicit choice.

**The two psalters are structurally different, and this is why a toggle rather
than a merge.** Divinum Officium uses the traditional **one-week** psalter —
`Day0`–`Day6`, all 150 psalms across a single week. Still's current
`VESPERS_PSALMS` is a **four-week** cycle. These are not convertible.

Noted from the comparison: Still's week 1 Vespers is Ps 109, 110, 111 — the
first three of Divinum Officium's *Sunday* Vespers, and week 4 is Ps 109, 111,
127 remixed. The existing "four-week cycle" does not correspond to any real
psalter scheme; it looks like Sunday Vespers redistributed to appear varied.
Adopting the traditional corpus **replaces** that structure rather than
populating it.

## 4. Build sequence

Three stages, **all shipped together** — nothing goes out partially.

1. **Traditional corpus first.** Build the 1960 Roman Breviary content from
   Divinum Officium.
2. **Modern corpus bugs second.** Fix the existing Ordinary Time path (§6).
3. **Toggle third.** Wire the setting once both corpora are correct.

Building the traditional corpus first means the harder, larger piece is proven
before the toggle depends on it, and the modern fixes land against a known-good
reference.

## 5. Target — before Advent

**Traditional Ordinary Time running before the First Sunday of Advent,
2026-11-29** (verified a Sunday; Christmas 2026 falls on a Friday).

**97 days from 2026-08-24.**

The date is not arbitrary: Advent is when the season changes, when
`getLiturgicalSeason()`'s off-by-one starts producing wrong output (§6), and
when a liturgical app is most visible to its users. Shipping into Ordinary Time
means the traditional corpus gets exercised in the quiet season before it has
to handle a season transition.

## 6. Known issues to fix regardless of rite

All three predate this plan and are recorded in
[office-vespers.md](../../wiki/features/office-vespers.md). None is fixed yet.
They belong to stage 2 but affect any rite.

**`getLiturgicalSeason()` — month off-by-one.** `md = now.getMonth()*100 +
now.getDate()` uses a 0-based month against 1-based constants. Christmas Day
returns `'advent'`; all of January and February 1–12 return `'christmas'`.
Currently dormant — today returns `'ordinary'` by luck — and **goes wrong at
Advent**, which is exactly the ship window in §5.

**`getPsalmWeek()` — mid-week rollover that drifts.** Rolls on a fixed 7-day
grid measured from Jan 1, not from Sunday, so it turns mid-week rather than at
Saturday Vespers. The fixed `7*86400000` ignores DST, and the boundary has
already drifted from Thursday to Friday; it moves again at the November change.
Moot for the traditional rite, which has a weekly psalter, but it has to be
right for the modern one.

**Missing `vespersAntiphon`.** All four antiphon slots in the Vespers render
read `sData.laudsAntiphon`; `OFFICE_SEASONS` has no `vespersAntiphon` key.
Vigils and Compline each have their own. Anyone praying both offices hears the
same antiphon morning and evening.

---

## Reference — what the Divinum Officium data looks like

Sampled 2026-08-23 from `Tempora/Pent02-0.txt` and
`Psalterium/Psalmi/Psalmi major.txt`. `Pent02` is the traditional calendar's
**Second Sunday after Pentecost**, which is not the modern "second week of
Ordinary Time" — the numbering systems do not align. That particular file also
falls within the Octave of Corpus Christi.

**Antiphon numbering**, established from `Major Special.txt` rather than
assumed: `[Ant 1]` = Magnificat at First Vespers, `[Ant 2]` = Benedictus at
Lauds, `[Ant 3]` = Magnificat at Second Vespers. `[Dominica Ant 2]` sits inside
the Lauds block and its body reads `/:as in the Propers of Time:/`, which is
what sends it to the Tempora file.

**Translation register.** Traditional Anglican-Douay — "Sit thou at my right
hand", "he shall delight exceedingly in his commandments". Psalms 109 and 111
are verbatim Douay-Rheims, which matches the vault's standing rule that
scripture is DR only. Not uniformly DR, though: *"Tres púeri"* renders as "The
three young boys" where Douay has "the three children", and *"Jubiláte Deo
omnis terra"* as "Shout with joy to God all the earth" where DR Ps 99 reads
"Sing joyfully to God, all the earth". The antiphons look hand-translated from
the Latin with DR as a strong influence. **Spot-check rather than bulk-import.**

**Clone note.** Cloning on Windows fails partway — filename restrictions leave
the git index empty and tens of thousands of files unwritten, though most text
files land. Use `core.protectNTFS=false` or clone under WSL.
