---
date: 2026-08-23
type: decision-record
session: Divinum Officium evaluation, Office rebuild plan, rite toggle
participants: Matt Proia, Claude Opus 5
ingested: 2026-08-24
updated: 2026-08-24 — §1 licence question resolved (Fr. Albert Marcello)
---

# 2026-08-23 — Office rebuild: Divinum Officium as source, and a liturgical rite toggle

Decisions only. **No code written, no schema changed.** Prompted by a report
that Vespers was showing yesterday's content, which turned out to be correct
behaviour — the Office has no daily proper at all. See
[office-vespers.md](../../wiki/features/office-vespers.md) for the trace that
led here.

---

## 1. Divinum Officium — MIT, cleared for use

> **Superseded on the licence question — see [§1 amended 2026-08-24](#1-amended-2026-08-24--licence-question-resolved) at the end of this record.** The text below is what was known on 2026-08-23 and is kept verbatim. Its open questions are closed; its factual observations still hold.

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

---

# Amendments

Appended blocks, newest last. Per the vault convention in
[CLAUDE.md](../../CLAUDE.md), decision records are amended by appending, never
by rewriting — the superseded text stays where it was.

## §1 amended 2026-08-24 — licence question resolved

**Fr. Albert Marcello, Divinum Officium project lead, confirmed on 2026-08-24
that the MIT licence covers the entirety of the site — the software and the
liturgical text data alike.** Commercial use is cleared. Attribution required.
**The licence question is closed; no further clarification is needed.**

**Supersedes:** §1, on the question of permission and scope.

### What this answers

§1 had the grant's *scope* open, not its existence. Still needs the
**liturgical text data** under `web/www/horas/`, and the `#### MIT License`
section in `README.md` scopes itself by its own wording to "this software and
associated documentation files (the 'Software')". Whether "Software" reached
the texts was an open question inside the project — hence the open issues §1
lists ("Separate licenses for software and liturgical texts in the project",
"Reusing data in a different project", "License?").

Fr. Marcello's confirmation answers exactly that: the licence covers the whole
site, texts included. The 2026-08-23 verbal confirmation recorded in §1 cleared
commercial use but left the software/data boundary implicit; this one does not.

### What §1 still gets right

**The `LICENSE` file is still absent**, and §1's verification of that — 404 on
the GitHub `/license` endpoint, `"license": null` from the API, no path
matching `licen[sc]e`/`copying`/`copyright` anywhere in the tree — stands. Any
dependency scan of Still will keep reporting Divinum Officium as unlicensed.

That is now a reporting artefact rather than a permissions problem. **This
record is the citation** when a reviewer asks, which is why §1 says not to
delete it and why this amendment does not replace it.

### What is closed

§1's **follow-up request** — ask the maintainers to add a `LICENSE` file — is
**dropped**. The reasoning behind it (a verbal confirmation is not durable, it
does not survive a maintainer change, it cannot be cited by a reviewer) was
sound and is worth keeping visible, but Matt's judgement on 2026-08-24 is that
the project lead's confirmation settles the matter and no further clarification
will be sought.

### Downstream

Two wiki pages carried the superseded "verbally confirmed by the maintainer —
no `LICENSE` file in the repo" wording and were updated to match on 2026-08-24:
[office-vespers.md](../../wiki/features/office-vespers.md) and
[index.md](../../wiki/index.md).

## §6 amended 2026-08-24 — Stage 2 shipped, and a fourth bug found

**All three §6 bugs are fixed, plus a fourth discovered while testing them.**
Stage 2 of the §4 build sequence is complete. No corpus integration touched;
the toggle (stage 3) is still unbuilt.

**Supersedes:** §6, on status only — the three faults it describes are
accurate, and are now fixed rather than open.

### The fourth bug — `getAshWednesday()` starts Lent a day early

Not in §6, not in [office-vespers.md](../../wiki/features/office-vespers.md);
found by the test written for the §6 season bug.

```js
return new Date(easter.getTime() - 46*86400000);   // the fault
```

Easter is always after the March DST change and Ash Wednesday is almost always
before it, so the fixed-millisecond subtraction lands at **23:00 on the
previous day**. `getDate()` then reads the wrong day. Verified wrong in **every
year 2024–2030**: 2026 returned Tue 17 Feb where Ash Wednesday is Wed 18 Feb.
It never even landed on a Wednesday.

Consequence: `getLiturgicalSeason()` returned `'lent'` one day early each year
— Shrove Tuesday read as Lent. Same root cause as the §6 `getPsalmWeek()`
drift: fixed-millisecond arithmetic across a DST boundary. Fixed with calendar
arithmetic (`new Date(y, m, d - 46)`), which cannot drift.

**A fifth instance of the same fault was hardened at the same time**:
`pentMD` computed Pentecost as `easter.getTime() + 49*86400000`. In US
timezones this is safe — no DST transition falls between Easter and Pentecost
— and it was **not** observed failing. It is wrong in southern-hemisphere
zones, where DST ends in April (Sydney 2024: Easter 31 Mar, transition 7 Apr,
inside the window). **That reasoning was not executed** — Node on Windows
ignores `TZ`, so it silently resolves back to the local zone and any
cross-timezone run is vacuous. Changed on the argument, not on a test.

### What changed in `index.html`

| Bug | Fix |
|---|---|
| `getLiturgicalSeason()` off-by-one | one `mmdd()` helper, 1-based; boundaries promoted to named constants; four dead declarations removed (incl. `pentecost = easterSunday + 49`, a string concatenation) |
| `getPsalmWeek()` drift | rolls at Saturday 17:00; weeks counted on `Date.UTC` midnights |
| missing `vespersAntiphon` | key added to all five seasons; **six** call sites rewired |
| `getAshWednesday()` | calendar arithmetic |

Two details worth keeping:

- **The Advent boundary was never part of the off-by-one.** Its bound was
  built `new Date(y,10,27).getMonth()*100+27` — 0-based, matching the 0-based
  `md`. Only the hardcoded `1225`/`112` literals disagreed. Advent behaviour is
  unchanged by the fix.
- **The antiphon bug reached the audio path too.** §6 and the wiki record four
  slots in the screen render; `playVespersAudio()` had two more. Its cache key
  is keyed on season, so wrong-antiphon audio was being **cached and replayed**.

### `getPsalmWeek()` is anchored to Advent

The four-week cycle now restarts at First Vespers of the **First Sunday of
Advent** (2026-11-29, verified a Sunday — §5), so week 1 lands where the
liturgical year begins.

This **changes which psalms show today**: 2026-08-24 moved from week 2 to
week 3. That is a deliberate content change, decided by Matt on 2026-08-24, not
a side effect of the rollover fix. Per §3 the existing four-week cycle
"does not correspond to any real psalter scheme" anyway.

### `vespersAntiphon` — added, and flagged for liturgical review

The bug could not be fixed without content: no Vespers antiphon existed
anywhere in the codebase. Five were written to match the register of the
existing seasonal antiphons. **They are Claude's composition, not an ingested
source**, which the [CLAUDE.md](../../CLAUDE.md) no-fabrication rule makes a
thing to mark rather than assume. Each was then checked against the generated
traditional corpus. **Matt's review is outstanding on all five.**

| Season | Text | Attested in corpus as | Verdict |
|---|---|---|---|
| advent | Behold, the Lord shall come, and all his saints with him. | Vespers psalm antiphon (`vespers \| 2.antiphon`, ×3) | **sound** |
| christmas | Glory to God in the highest, and on earth peace to men of good will. | Vespers Magnificat antiphon (`vespers \| canticle.antiphon`, ×3) | **sound** |
| lent | Behold, now is the acceptable time; now is the day of salvation. | Vespers Magnificat antiphon ×1; mostly a Vigils lesson/responsory | thin but attested |
| ordinary | Let my prayer be directed as incense in thy sight, O Lord. | **the Vespers versicle** (`vespers \| versicle.v`, ×162) — never an antiphon | **wrong genre** |
| easter | I am risen, and am still with thee, alleluia. | **nothing** — appears only as Ps 138:16 in `store/psalms.json` | **unattested** |

- **ordinary** — Ps 140:2. Strongly Vespers-proper (162 of 493 Vespers files
  carry it) but as the *versicle*, never as an antiphon.
- **easter** — "Resurrexi, et adhuc tecum sum" is the **Introit of Easter
  Sunday Mass**. It is a Missal text, not a Breviary one, and the corpus has no
  antiphon anywhere matching it. Weakest of the five. Attested Paschal
  alternatives exist, e.g. *"Behold My Hands and my Feet, that it is I myself,
  alleluia, alleluia"* (`die-iii-infra-octavam-paschae`, `Ant 3`).

**The structural deviation is larger than any single text, and no wording fixes
it.** Traditional Vespers carries **five psalm antiphons, one per psalm, plus a
distinct Magnificat antiphon** — 384 of 493 corpus Vespers files have exactly
five. They are **proper to the day and usually drawn from that day's Gospel**
("The wine failing, Jesus commanded the water pots to be filled",
`dominica-ii-post-epiphaniam`), never seasonal. The modern rite here repeats
**one seasonal antiphon four times** across three psalms.

So a seasonal `vespersAntiphon` cannot be traditional Vespers psalmody in
principle. It is a correct fix *within the modern rite's existing seasonal
model*, and it is exactly the §2 "no daily proper" gap that the traditional
corpus is being built to close. Judge the five as modern-rite stopgaps, not as
breviary texts.

### Tests

Versioned at
[`tools/office-corpus/tests/`](../../../tools/office-corpus/tests/) —
`test-season.js`, `test-psalmweek.js`, `test-antiphon.js`, and `harness.js`.
The harness **extracts the functions out of `index.html` by source anchor**
rather than copying them, and throws if an anchor moves, so the tests cannot
drift from shipped code. They cover only the machine's local timezone; see the
`TZ` caveat above.
