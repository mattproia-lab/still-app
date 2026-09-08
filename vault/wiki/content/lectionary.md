# The Lectionary for Mass — the readings table, 2026–2030

_Index into the generated data and its sources, not a replacement for them. Built 2026-09-08._

This is data, not a text: which readings fall on which day, from the three-year Sunday cycle (A/B/C), the two-year weekday cycle (I/II), and the proper of saints where the calendar has one. Citations only; the words come from the Douay-Rheims copy ([scripture-douay-rheims.md](scripture-douay-rheims.md)).

## The files

- [`corpus/readings/<year>.json`](../../../corpus/readings/) for 2026, 2027, 2028, 2029, 2030 — one record per calendar day, keyed `YYYY-MM-DD`, 1,826 days, none without readings. Copied unchanged to [`assets/readings/`](../../../assets/readings/) for the app to fetch and to `www/assets/readings/`; `corpus/` itself is a forced 404 on the site (`netlify.toml`).
- Sizes: 219,506 / 219,634 / 216,292 / 214,437 / 214,519 bytes; 1,084,388 bytes for the five.
- Each file's top level carries `year`, `generated`, `calendar`, `cycles`, `sources` and `fields`; the `fields` block documents every key below ([2026.json](../../../corpus/readings/2026.json)).

A day's record: `name`, `key` (romcal's), `rank`, `season`, `week`, `sundayCycle`, `weekdayCycle`; `readings` = `{first, psalm, second, gospel}` (`second` on Sundays and solemnities only; the Easter Vigil also carries `vigil`, its seven Old Testament readings in order, `vigilPsalms` by number, and `epistlePsalm`; Christmas carries `otherMasses` for the Vigil, Midnight and Dawn Masses); `dr`, the same citations with Douay-Rheims book names and Vulgate psalm numbers; `source`; and where they apply `ferial` (the weekday's readings a celebration displaced), `proper` (a memorial's own readings when the weekday's are the day's), `observedUS` (see below) and `check`.

## Sources

Three inputs and one independent cross-check. None was copied into `raw/theology/`; the two licences and the description of the MIT dataset are filed verbatim under `raw/external/`.

1. **The calendar** — the General Roman Calendar as the app already computes it, [`assets/calendar/general/<year>.json`](../../../assets/calendar/general/) (romcal 1.3.0). It decides what each day *is* (the winner celebration, its rank, season and week); the readings table never overrides it. Note that this calendar moves Epiphany, Ascension and Corpus Christi to Sunday.
2. **The structure of the Lectionary** — Felix Just, S.J., "Lectionary Statistics and Indexes" tables for the 1998/2002 USA Lectionary: <https://catholic-resources.org/Lectionary/Index-Sundays.htm> (Sundays and solemnities by cycle, with lectionary numbers) and <https://catholic-resources.org/Lectionary/Index-Weekdays.htm> (weekdays by year I/II), retrieved 2026-09-08. The pages are copyright Felix Just, S.J. (1998–2025 on the site's notice); they were parsed for the citations and lectionary numbers and are cited, not filed. The `source` field of a derived day reads `felix:<day name>|<cycle>`.
3. **Observed US practice** — cpbjr/catholic-readings-api, MIT licence ([raw LICENSE](../../raw/external/2026-09-08-cpbjr-catholic-readings-api-license.md), [raw README](../../raw/external/2026-09-08-cpbjr-catholic-readings-api-readme.md)), commit 973e9864eb0f of 2026-08-29: per-day citations derived from the USCCB daily readings, complete for 2026 and 2027. Its 2025 files are shifted by a day from mid-October and were not used. The `source` field reads `cpbjr:<date>`.
4. **Cross-check only** — the Liturgical Calendar API (Liturgical-Calendar/LiturgicalCalendarAPI, Apache-2.0), `https://litcal.johnromanodorazio.com/api/dev/calendar/<year>?locale=en`, which returns readings for the days its own dataset covers. Not a build input.

The USCCB site itself blocked retrieval after one request (HTTP 403): <https://bible.usccb.org/bible/readings/>. Given for the record; nothing was taken from it directly.

## How a day is filled

- **The cycle**: the liturgical year begins on the First Sunday of Advent; Sunday cycle A/B/C by that year mod 3 (1 = A, 2 = B, 0 = C), weekday cycle I for odd years, II for even. So 2026 is A/II until 2026-11-29, then B/I; 2027 B/I; 2028 C/II; 2029 A/I; 2030 B/II. Each record carries its own two cycles.
- **2026 and 2027**: the observed cpbjr citations, day by day (725 days). Felix's tables fill a role cpbjr lacks (one psalm, 2027-02-01).
- **2028–2030**: a day whose calendar name maps to the same lectionary day *and cycle* as an observed 2026/2027 day reuses that observation (`source: cpbjr:<date> via felix:<key>`; 349 days). Otherwise the day is derived from Felix's tables (627 days across the five years). Fixed-date feasts and solemnities of the Lord take their observed readings when the cycle matches (125 days in 2028–2030), else Felix's entry for the cycle.
- **Memorials**: a memorial takes its own readings only when the readings USCCB used on it in 2026/2027 have a different Gospel chapter from the weekday's (48 celebrations, mostly feasts of apostles and evangelists and the solemnities); otherwise the weekday's readings stand and the memorial's are kept under `proper`. This is the Lectionary's own norm for memorials and it is what the observed data shows.
- **US-only observances**: where USCCB read something the app's calendar does not celebrate (the Ascension readings on the 7th Sunday of Easter, Thanksgiving Day on 2026-11-26), the app's day keeps its own readings and the observation sits in `observedUS` (5 records, including the Easter Vigil, whose cpbjr listing is partial and was replaced by Felix's full structure).
- **App rules** (Matt, 2026-09-08): where a day carries alternatives joined by ` or `, the app shows the first option; a psalm is shown whole, not by verse range, because Vulgate verse numbering differs from the citations' (the `dr` block gives the Vulgate psalm number for that).
- **Douay block**: `dr` maps book names (Isaias, Ecclesiasticus, Apocalypse, 1–4 Kings, Canticle of Canticles…) and psalm numbers to the Vulgate's (Psalm 95 → Psalms 94; 9/10 → 9; 114/115 → 113; 116 → 114-115; 147 → 146-147) so a citation can be resolved against [`corpus/scripture/dr/`](../../../corpus/scripture/dr/). **Verse numbers are not converted.** Where the NAB and the Vulgate divide verses differently (parts of the Psalms, Sirach, Hosea, Joel, Malachi, Song of Songs), the verse range may point a verse or two off in the Douay text. Whether the app resolves by verse or shows the whole chapter is Matt's decision; see the open item below.

## Verification, 2026-09-08

**A full sample week, 2026-09-06 to 2026-09-12**, read from the generated file against Felix Just's tables (23rd week of Ordinary Time, Year A / II) and the Liturgical Calendar API where it has the day:

| Date | Day | First | Psalm | Second | Gospel | Felix | LitCal |
|---|---|---|---|---|---|---|---|
| 09-06 | 23rd Sunday of Ordinary Time | Ezekiel 33:7-9 | Psalm 95:1-2, 6-7, 8-9 | Romans 13:8-10 | Matthew 18:15-20 | same (psalm divided 6-7b, 7c-9) | same |
| 09-07 | Monday, week 23 | 1 Corinthians 5:1-8 | Psalm 5:5-6, 7, 12 | — | Luke 6:6-11 | same | no entry |
| 09-08 | Nativity of the Blessed Virgin Mary, feast | Micah 5:1-4a | Psalm 13:6ab, 6c | — | Matthew 1:1-16, 18-23 | proper; ferial kept (1 Corinthians 6:1-11, Luke 6:12-19) | no entry |
| 09-09 | Saint Peter Claver, optional memorial | 1 Corinthians 7:25-31 | Psalm 45:11-12, 14-15, 16-17 | — | Luke 6:20-26 | same (the ferial) | no entry |
| 09-10 | Thursday, week 23 | 1 Corinthians 8:1b-7, 11-13 | Psalm 139:1b-3, 13-14ab, 23-24 | — | Luke 6:27-38 | same | no entry |
| 09-11 | Friday, week 23 | 1 Corinthians 9:16-19, 22b-27 | Psalm 84:3, 4, 5-6, 12 | — | Luke 6:39-42 | same | no entry |
| 09-12 | Holy Name of Mary, optional memorial | 1 Corinthians 10:14-22 | Psalm 116:12-13, 17-18 | — | Luke 6:43-49 | same (the ferial) | no entry |

Every citation in the week matches Felix's table for that lectionary day (book, chapter and verses; the Sunday psalm is the same verses divided differently), and the Sunday matches the API.

**Every day against the Liturgical Calendar API**, on the temporal days and the Lord's feasts where the API carries readings (book, chapter and first verse compared; alternatives and verse letters ignored):

| Year | Roles agreeing | Roles differing |
|---|---|---|
| 2026 | 415 | 41 |
| 2027 | 167 | 24 |
| 2028 | 247 | 22 |
| 2029 | 355 | 32 |
| 2030 | 220 | 25 |

Each of the 144 differences was read. They fall into four groups, none of which changed the table: (a) the API's calendar keeps Epiphany on January 6 and Ascension and Corpus Christi on Thursday, so the weekdays of January 2–12, the 7th Sunday of Easter, Corpus Christi Sunday and Epiphany-on-January-7 carry other readings there; (b) the API's top entry on the date is a different Mass (the Chrism Mass on Holy Thursday; readings of its own for the optional memorials of Gregory of Narek, Paul VI, Teresa of Calcutta, Faustina and John of Ávila, where the Lectionary norm and the observed data keep the weekday); (c) citation form (Psalm 66 (67), a bare Psalm 24, Sirach 3:2-6, 12-14 against 3:3-7, 14-17a for the same passage under NAB and Vulgate verse numbers); (d) three places where the table follows USCCB as cpbjr recorded it and the API differs: Jude 17, 20b-25 on 2026-05-30, John 10:1-10 on 2027-04-19, and Psalm 71 on the Saturday of week 9, year II.

**Two slips in Felix's psalm table**, found by this comparison and corrected by the observed data: Monday of the 1st week of Lent is listed as Psalm 20:8, 9, 10, 15 and Monday of the 2nd week as Psalm 78:8, 9, 11, 13; USCCB (cpbjr 2026-02-23 and 2026-03-02) and the API give Psalms 19 and 79. The table carries 19 and 79 for every year, since those Lenten days map to the same lectionary day in each cycle.

## Open items for Matt

- **Verse numbering in `dr`** (above): psalms are shown whole (decided); for the other books whose NAB and Vulgate verse numbers differ (Sirach, Hosea, Joel, Malachi, Song of Songs) the range still points into the Douay text unadjusted.
- **The generator** lives in [`tools/lectionary/`](../../../tools/lectionary/) with its inputs (the two Felix Just pages, the cpbjr 2026 and 2027 files with their licence, the five API responses) and a README; `python build.py 2031 2031` makes the next year once its calendar exists. Rebuilt from there on 2026-09-08 with output identical to the files above.
- The Sunday-table entries Felix marks with notes (the scrutiny Gospels of Lent in years B and C, the options of the Holy Family) are carried as `or` alternatives in one string; the app shows the first (rule above), so the order inside the string is the base entry's citation first, then the variants.
