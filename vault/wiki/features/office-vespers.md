# Vespers — the Office text

_Traced 2026-08-23 against [`index.html`](../../../index.html) at commit `1a1b30e`; line numbers re-verified and updated 2026-08-24 after the Stage 2 fixes, prompted by a report that Vespers was "showing yesterday's content". A pointer map, not a copy; re-verify against the code before relying on it._

See also: [subscription-paths.md](../app/subscription-paths.md) for the gate · [architecture.md](../app/architecture.md) for the region map.

## How the text is produced

**Entirely client-side, from constants compiled into `index.html`. No API, no server call, no cache layer.** The render is [14179–14240](../../../index.html); it is recomputed on every view.

Two functions supply every variable, and both read `new Date()` off the device:

| Function | Line | Returns |
|---|---|---|
| `getLiturgicalSeason()` | [13729](../../../index.html) | `ordinary` / `advent` / `christmas` / `lent` / `easter` |
| `getPsalmWeek()` | [13788](../../../index.html) | `1`–`4` |

**Neither is a date.** Nothing in the Vespers render takes a day-level input.

| Element | Source | Changes on |
|---|---|---|
| Opening versicle | literal in the render | never |
| Evening Hymn (full only) | literal | never |
| Antiphon (×4) | `OFFICE_SEASONS[season].vespersAntiphon` ([13805](../../../index.html)) — was `laudsAntiphon`, see issue 4 | season |
| Psalms (3, or 1 concise) | `VESPERS_PSALMS[(psalmWeek-1)%4+1]` ([14222](../../../index.html)) | 4-week cycle, anchored to Advent |
| Short Reading | `VESPERS_READINGS[season]` ([13970](../../../index.html)) | season |
| Responsorium (full only) | literal | never |
| Magnificat | `MAGNIFICAT` ([13988](../../../index.html)) | never |
| Intercessions (full only) | literal | never |
| Collect | `VESPERS_COLLECTS[season]` ([13979](../../../index.html)) | season |
| Marian antiphon | `MARIAN[OFFICE_SEASONS[season].marian]` ([14010](../../../index.html)) | season |

Contrast with the Sing the Hours player on the same screen, which stacks four cache layers. **The Office text has none.** Nothing here can serve stale content — if it looks unchanged, it is unchanged.

---

# Known issues

**Five issues. Issues 2–5 were fixed 2026-08-24; issue 1 is a content-model gap that only the corpus rebuild closes.**

**Status 2026-08-24:** **Stage 2 is done.** Issues 2, 3 and 4 are fixed in `index.html`, along with **issue 5**, a fourth date bug found while testing them and not part of the original four. Issue 1 stays open by design — it needs the traditional corpus and the rite toggle (stage 3), not a date fix. Regression tests are versioned at [`tools/office-corpus/tests/`](../../../tools/office-corpus/tests/). Full write-up: [§6 amended](../../raw/decisions/2026-08-23-office-rebuild-plan.md).

**Status 2026-08-25 — Stage 3 is done, and issue 1 is closed for the traditional rite.** The Office now has real daily propers: `buildOffice()` builds from the generated corpus, served by the `office-corpus` Netlify function, with Latin and English shown paired and the English alone spoken. **Issue 1 remains true of the `modern` rite**, which is still the seasonal-constants office this page describes and is still the default for existing users — so everything below stands for anyone who has not switched. Eight suites, 516 checks. **Stage 3 is complete as of 2026-08-25**: the rite toggle now sits on the Office screen itself, not only in Settings, which is what a traditional-rite user needs to reach the breviary at all. Traditional Compline remains the modern text and now says so on the card — a post-Advent item. Full write-up: [§4 amended 2026-08-25](../../raw/decisions/2026-08-23-office-rebuild-plan.md#4-amended-2026-08-25--stage-3-shipped-the-corpus-reaches-the-app), completed in [§4 amended 2026-08-25 (second)](../../raw/decisions/2026-08-23-office-rebuild-plan.md#4-amended-2026-08-25-second--stage-3-complete-the-toggle-reaches-the-user).

Two caveats a reader of this page should carry: traditional **Vespers is always Second Vespers** — the corpus has no First Vespers text, so on ~185 of 861 days the evening office properly belongs to the following day, and the screen labels it rather than hiding it; and there is **no traditional Compline**, which falls through to the modern constants.

## 1. No daily proper — the reported symptom

**Vespers is identical every day for weeks at a time, by construction.** Within a season the only thing that changes is the three psalms, once a week. There is no day-of-week psalter, no calendar of saints, no Magnificat antiphon of the day.

Ordinary Time runs from Pentecost to Advent, so through the summer the *entire* office is unchanged except for the weekly psalm rotation.

This is the likely explanation for "showing yesterday's content" — yesterday's Vespers and today's genuinely are the same text. **A content-model gap, not a caching bug.** No amount of cache-busting addresses it; it needs a liturgical calendar.

## 2. `getLiturgicalSeason()` — month off-by-one · **FIXED 2026-08-24**

[13729](../../../index.html). `md = now.getMonth()*100 + now.getDate()` uses a **0-based** month against **1-based** comparison constants (`1225`, `112`, `1027`).

Verified by running the function's arithmetic 2026-08-23:

```
md for Dec 25 = 1125   ->  md >= 1225  false
md for Jan 15 =   15   ->  md <=  112  true
```

Consequences:

- **Christmas Day returns `'advent'`.** Dec 25 gives `md = 1125`, which misses the Christmas branch and falls into the Advent range (`>= 1027 && < 1225`).
- **All of January and February 1–12 return `'christmas'`.** Any date in those ranges yields `md <= 112`.

Everything keyed on `season` is wrong for those spans — antiphon, reading, collect, Marian antiphon, and the season badge.

**Currently dormant.** Today returns `'ordinary'` correctly, but only by luck: `md = 723` happens to miss every wrong branch. It goes wrong at Advent and stays wrong for roughly seven weeks.

The `lent` / `easter` branches use `getAshWednesday()` / `getEaster()` and build their bounds the same 0-based way, so they compare consistently with `md` — those two appear unaffected by this particular fault.

**Fixed 2026-08-24.** A single `mmdd()` helper now does the 1-based conversion for every date, and the boundaries are named constants instead of inlined literals. Four dead declarations went with it, including `pentecost = easterSunday + 49` — a `Date` plus a number, which is string concatenation.

One correction to the note above: **the Advent bound was never part of this bug.** It was built `new Date(y,10,27).getMonth()*100+27`, which is 0-based like `md`, so the two agreed. Only the hardcoded `1225` and `112` disagreed. Advent behaviour is unchanged.

## 3. `getPsalmWeek()` — mid-week rollover, and it drifts · **FIXED 2026-08-24**

[13774](../../../index.html):

```js
const weekOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7*86400000));
return (weekOfYear % 4) + 1;
```

A fixed 7-day grid measured from Jan 1 — **not** from Sunday. Two faults:

- **It turns mid-week.** Jan 1 2026 was a Thursday, so the boundary started there. Liturgically the psalter turns at Vespers on Saturday evening.
- **It drifts.** `7*86400000` is fixed milliseconds and ignores DST. Jan 1 is MST, August is MDT, so the accumulated hour has already moved the boundary. Observed 2026-08-23:

```
Thu Aug 27 2026 -> week 2
Fri Aug 28 2026 -> week 3
```

Already Friday, not the original Thursday, and it will shift again at the November DST change.

If someone prays Vespers on a Sunday expecting the new week's psalms and gets the previous set, this is why.

**Fixed 2026-08-24.** The week is now found by walking back to the Sunday that opens it — rolling Saturday forward from 17:00, the app's own Vespers hour in `setOfficeTime()` — and counting whole weeks on `Date.UTC` midnights, which no DST change can move. Verified hour-by-hour across 14 months spanning both DST changes and a year boundary: all 61 rollovers land on Saturday 17:00, where previously all 61 landed on Thursday and drifted to Friday.

**The cycle was also re-anchored to the First Sunday of Advent** (2026-11-29), so week 1 begins with the liturgical year. This deliberately changed which psalms show: 2026-08-24 moved from week 2 to week 3.

## 4. Vespers uses the Lauds antiphon · **FIXED 2026-08-24**

All four antiphon slots in the Vespers render read `sData.laudsAntiphon` — around the psalms ([14197](../../../index.html), [14204](../../../index.html)) and around the Magnificat ([14217](../../../index.html), [14219](../../../index.html)).

**There is no `vespersAntiphon` key in `OFFICE_SEASONS`** ([13781](../../../index.html)); the object carries `laudsAntiphon`, `vigils`, `complineAntiphon`, and `marian` only. Vigils and Compline each have their own; Vespers borrows Lauds'.

Anyone praying both offices hears the same antiphon morning and evening.

**Fixed 2026-08-24.** `vespersAntiphon` was added to all five seasons and **six** call sites were rewired — four in the screen render ([14226](../../../index.html), [14233](../../../index.html), [14246](../../../index.html), [14248](../../../index.html)) and **two more this page missed**, in `playVespersAudio()` ([4436](../../../index.html), [4438](../../../index.html)). The audio path matters: its cache key is keyed on season, so the wrong antiphon was being cached and replayed, not merely rendered.

**The five antiphon texts are Claude's composition and Matt's liturgical review is outstanding.** Checked against the generated corpus: advent and christmas are attested as real Vespers antiphons; lent is thin; **ordinary is the Vespers _versicle_, not an antiphon** (162 corpus Vespers files carry it, none as an antiphon); **easter is unattested entirely** — "Resurrexi" is the Introit of Easter Sunday _Mass_. Deeper still, traditional Vespers has five psalm antiphons plus a distinct Magnificat antiphon, all proper to the day and usually drawn from its Gospel — never one seasonal text repeated four times. See the [decision record](../../raw/decisions/2026-08-23-office-rebuild-plan.md) for the full table.

## 5. `getAshWednesday()` — Lent starts a day early · **FIXED 2026-08-24**

**Not one of the original four.** Found 2026-08-24 by the regression test written for issue 2.

```js
return new Date(easter.getTime() - 46*86400000);   // the fault
```

Easter always falls after the March DST change and Ash Wednesday almost always before it, so the fixed-millisecond subtraction landed at **23:00 the previous day** and `getDate()` read the wrong date. Wrong in **every year 2024–2030** — it never once landed on a Wednesday. 2026 gave Tue 17 Feb where Ash Wednesday is Wed 18 Feb, so `getLiturgicalSeason()` returned `'lent'` on Shrove Tuesday.

Same root cause as issue 3: fixed-millisecond arithmetic across a DST boundary. Fixed with calendar arithmetic ([13769](../../../index.html)), which cannot drift. The same shape was hardened in `pentMD` at the same time — safe in US timezones, argued wrong in southern-hemisphere ones, but **that argument was never executed**: Node on Windows ignores `TZ`, so cross-timezone runs silently test the local zone and prove nothing.

---

## Resolved 2026-08-24 — it was issue 1

The open question here was whether the report meant the **psalms** looked unchanged (issue 3) or the **whole office** did (issue 1). It was issue 1: there is no daily proper, so yesterday's Office and today's genuinely are the same text.

Decision: **rebuild the Office with real daily propers** for Vespers, Lauds and Vigils, sourced from [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) (MIT covering software and liturgical texts alike, confirmed by project lead Fr. Albert Marcello 2026-08-24; attribution required — [source](../../raw/decisions/2026-08-23-office-rebuild-plan.md)), behind a **liturgical rite toggle** — `traditional` (1960 Roman Breviary) and `modern` (Ordinary Time, the default for existing users). Target is traditional Ordinary Time running before Advent, 2026-11-29.

Full reasoning, the build sequence, and the psalter-structure mismatch that forced a toggle rather than a merge: [2026-08-23-office-rebuild-plan.md](../../raw/decisions/2026-08-23-office-rebuild-plan.md).
