# Vespers — the Office text

_Traced 2026-08-23 against [`index.html`](../../../index.html) at commit `1a1b30e`, prompted by a report that Vespers was "showing yesterday's content". A pointer map, not a copy; re-verify against the code before relying on it._

See also: [subscription-paths.md](../app/subscription-paths.md) for the gate · [architecture.md](../app/architecture.md) for the region map.

## How the text is produced

**Entirely client-side, from constants compiled into `index.html`. No API, no server call, no cache layer.** The render is [14179–14240](../../../index.html); it is recomputed on every view.

Two functions supply every variable, and both read `new Date()` off the device:

| Function | Line | Returns |
|---|---|---|
| `getLiturgicalSeason()` | [13729](../../../index.html) | `ordinary` / `advent` / `christmas` / `lent` / `easter` |
| `getPsalmWeek()` | [13774](../../../index.html) | `1`–`4` |

**Neither is a date.** Nothing in the Vespers render takes a day-level input.

| Element | Source | Changes on |
|---|---|---|
| Opening versicle | literal in the render | never |
| Evening Hymn (full only) | literal | never |
| Antiphon (×4) | `OFFICE_SEASONS[season].laudsAntiphon` ([13781](../../../index.html)) | season |
| Psalms (3, or 1 concise) | `VESPERS_PSALMS[(psalmWeek-1)%4+1]` ([13917](../../../index.html)) | 4-week cycle |
| Short Reading | `VESPERS_READINGS[season]` ([13941](../../../index.html)) | season |
| Responsorium (full only) | literal | never |
| Magnificat | `MAGNIFICAT` ([13959](../../../index.html)) | never |
| Intercessions (full only) | literal | never |
| Collect | `VESPERS_COLLECTS[season]` ([13950](../../../index.html)) | season |
| Marian antiphon | `MARIAN[OFFICE_SEASONS[season].marian]` ([13981](../../../index.html)) | season |

Contrast with the Sing the Hours player on the same screen, which stacks four cache layers. **The Office text has none.** Nothing here can serve stale content — if it looks unchanged, it is unchanged.

---

# Known issues

**All four are recorded, none is fixed. No code changed 2026-08-23 — investigation only.**

**Status 2026-08-24:** all four now have a plan — see the [Office rebuild decision record](../../raw/decisions/2026-08-23-office-rebuild-plan.md). Issue 1 is addressed by rebuilding the Office with real daily propers; issues 2–4 are stage 2 of that build. Nothing is fixed yet.

## 1. No daily proper — the reported symptom

**Vespers is identical every day for weeks at a time, by construction.** Within a season the only thing that changes is the three psalms, once a week. There is no day-of-week psalter, no calendar of saints, no Magnificat antiphon of the day.

Ordinary Time runs from Pentecost to Advent, so through the summer the *entire* office is unchanged except for the weekly psalm rotation.

This is the likely explanation for "showing yesterday's content" — yesterday's Vespers and today's genuinely are the same text. **A content-model gap, not a caching bug.** No amount of cache-busting addresses it; it needs a liturgical calendar.

## 2. `getLiturgicalSeason()` — month off-by-one

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

## 3. `getPsalmWeek()` — mid-week rollover, and it drifts

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

## 4. Vespers uses the Lauds antiphon

All four antiphon slots in the Vespers render read `sData.laudsAntiphon` — around the psalms ([14197](../../../index.html), [14204](../../../index.html)) and around the Magnificat ([14217](../../../index.html), [14219](../../../index.html)).

**There is no `vespersAntiphon` key in `OFFICE_SEASONS`** ([13781](../../../index.html)); the object carries `laudsAntiphon`, `vigils`, `complineAntiphon`, and `marian` only. Vigils and Compline each have their own; Vespers borrows Lauds'.

Anyone praying both offices hears the same antiphon morning and evening.

---

## Resolved 2026-08-24 — it was issue 1

The open question here was whether the report meant the **psalms** looked unchanged (issue 3) or the **whole office** did (issue 1). It was issue 1: there is no daily proper, so yesterday's Office and today's genuinely are the same text.

Decision: **rebuild the Office with real daily propers** for Vespers, Lauds and Vigils, sourced from [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) (MIT covering software and liturgical texts alike, confirmed by project lead Fr. Albert Marcello 2026-08-24; attribution required — [source](../../raw/decisions/2026-08-23-office-rebuild-plan.md)), behind a **liturgical rite toggle** — `traditional` (1960 Roman Breviary) and `modern` (Ordinary Time, the default for existing users). Target is traditional Ordinary Time running before Advent, 2026-11-29.

Full reasoning, the build sequence, and the psalter-structure mismatch that forced a toggle rather than a merge: [2026-08-23-office-rebuild-plan.md](../../raw/decisions/2026-08-23-office-rebuild-plan.md).
