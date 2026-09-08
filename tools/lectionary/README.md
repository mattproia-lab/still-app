# Lectionary readings generator

Build-time tooling. **Nothing here ships to the app** — it produces JSON, and
the JSON ships. Python 3, standard library only; the app gains no runtime
dependency. `/tools/*` is a forced 404 on the site (`netlify.toml`).

```
python build.py              # = python build.py 2026 2030
python build.py 2031 2031    # one more year, once assets/calendar/general/2031.json exists
python verify.py             # the cross-check and the sample week
```

## What it writes

| file | content |
|---|---|
| `corpus/readings/<year>.json` | the Mass readings of every day as citations: first, psalm, second (Sundays and solemnities), gospel; the Easter Vigil's seven readings and their responses; the three other Christmas Masses |
| `assets/readings/<year>.json`, `www/assets/readings/` | copied by hand after a build (`cp corpus/readings/*.json assets/readings/`, then into `www/`) |

`corpus/` is the record; the app reads `assets/`, because `/corpus/*` is a
forced 404 on the site and `corpus/` is not in the native bundle.

## Inputs, all in `inputs/`

| folder | what | licence |
|---|---|---|
| `felix/Index-Sundays.htm`, `Index-Weekdays.htm` | Felix Just, S.J., Lectionary index tables for the 1998/2002 USA Lectionary, <https://catholic-resources.org/Lectionary/>, retrieved 2026-09-08. The structure: which citation is read on which lectionary day, by cycle A/B/C and year I/II, with lectionary numbers | copyright Felix Just, S.J.; kept here only so the build is reproducible, cited in the output, not redistributed by the app |
| `cpbjr/readings/2026_*.json`, `2027_*.json` | cpbjr/catholic-readings-api, commit 973e9864eb0f (2026-08-29): per-day citations derived from the USCCB daily readings, the two complete years | MIT, `cpbjr/LICENSE` |
| `litcal/<year>-en.json` | Liturgical Calendar API, `https://litcal.johnromanodorazio.com/api/dev/calendar/<year>?locale=en`, retrieved 2026-09-08; used by `verify.py` only | Apache-2.0 |
| (the calendar) | `corpus/calendar/general/<year>.json`, else `assets/calendar/general/<year>.json`, from `tools/liturgical-calendar` | — |

`lectlib.py` holds the citation normaliser (NAB and SBL abbreviations to full
modern book names), the parsers for the three inputs, and the cycle rule: the
liturgical year begins on the First Sunday of Advent, Sunday cycle A/B/C by
that year mod 3 (1 A, 2 B, 0 C), weekday cycle I odd, II even.

## How `build.py` fills a day

1. The calendar decides what the day is (winner celebration, rank, season,
   week). The build never overrides it.
2. A 2026 or 2027 day takes the observed cpbjr citations, unless USCCB read
   something the app's calendar does not celebrate (Ascension on the 7th Sunday
   of Easter, Thanksgiving Day, the Vigil's partial listing): then the day keeps
   the Lectionary's own readings and the observation goes under `observedUS`.
3. A later day that maps to the same lectionary day *and cycle* as an observed
   day reuses that observation (`source: cpbjr:<date> via felix:<key>`).
   Lenten and other cycle-free weekdays share across cycles. This also
   corrects two slips in the index's psalm table (Mondays of Lent 1 and 2).
4. Otherwise the day comes from the index tables (`source: felix:<key>|<cycle>`).
5. Solemnities and feasts take their own readings; those of the Lord by cycle.
   A memorial takes its own only when USCCB's Gospel chapter on it differed
   from the weekday's (2026/2027 evidence); otherwise the weekday stands and
   the memorial's readings sit under `proper`. A displaced weekday sits under
   `ferial`.
6. `dr` repeats the citations with Douay-Rheims book names and Vulgate psalm
   numbers; verse numbers are not converted (see `vault/wiki/content/lectionary.md`).

The build stops on nothing; it prints days without readings (`gaps`) and roles
missing on a day (`missing roles`) at the end. Both must be empty.

## What `verify.py` checks

- Every temporal day and feast of the Lord against the Liturgical Calendar
  API's readings where it has them: book, chapter and first verse. Prints the
  agreement counts per year and every disagreement. The remaining
  disagreements are the API's calendar (Epiphany on 6 January, Ascension and
  Corpus Christi on Thursday), its extra Masses on a date, and citation form;
  they are listed and read on the wiki page.
- The week 2026-09-06..12 against the index tables and the API, printed in full.

## For 2031

Build the calendar first (`tools/liturgical-calendar`), then `python build.py
2031 2031`. 2031 is cycle A / I: its Sundays reuse the 2026 observations and
its weekdays the 2027 ones wherever the lectionary day matches; the rest
derives from the index tables. Copy to `assets/readings/` and `www/`.
