# Liturgical calendar generator

Build-time tooling. **Nothing here ships to the app** — it produces JSON, and
the JSON ships. romcal 1.3.0 is a devDependency of this folder only; the app
gains no runtime dependency.

```
npm install          # once, in this folder
npm run build        # = node build.js 2026 2030
node extract-lives.js
```

## What it writes

| file | content |
|---|---|
| `corpus/calendar/general/<year>.json` | the General Roman Calendar, 2026–2030 |
| `corpus/calendar/us/<year>.json` | the United States calendar beside it; generated, unused until a setting reads it |
| `corpus/calendar/traditional/<year>.json` | `corpus/traditional/calendar-index.json` (Divinum Officium, Rubrics 1960) re-sliced per year, content unchanged |
| `corpus/saints/lives.json` | the 183 lives moved out of `index.html` |
| `assets/calendar/…`, `assets/saints/lives.json` | the served copies of the general calendar, the traditional slices and the lives |

`corpus/` is the record; the app reads `assets/`, because `/corpus/*` is a
forced 404 on the site (`netlify.toml`) and `corpus/` is not in the native
bundle, while `assets/` is served and synced into `www/`.

## Per date

```
"2026-09-05": {
  "season": "ordinary_time", "seasonName": "Ordinary Time", "week": 22,
  "dayName": "Saturday of the 22nd Week in Ordinary Time",
  "color": "green", "psalterWeek": 2,
  "winner": "saturdayOfThe22ndWeekOfOrdinaryTime",
  "celebrations": [ { "key", "name", "type", "rank", "color", "source", "winner" }, … ]
}
```

`celebrations` holds every celebration romcal lists for the day — the temporal
day, the sanctoral (optional memorials included), the movable celebrations —
with the winner marked from romcal's resolved calendar. Where the General
Calendar has two optional memorials on one day romcal 1.x folds them into one
combined entry (25 May); it is kept as given.

`rank` is one of `solemnity feast memorial optional commemoration sunday
weekday holy_week triduum`. `season` is one of `advent christmas lent
holy_week triduum easter ordinary_time`. `color` is `green violet white red
rose`.

## The week

Derived by counting Sundays, not read from romcal. Ordinary Time follows the
Ordo: the first block counts forward from the Baptism of the Lord (the Monday
after it opens Week 1), the second counts backward so that Christ the King is
the 34th. Advent, Lent (week 0 = the days after Ash Wednesday) and Easter
(week 1 = the Octave) count forward from their first day.

## Checks the build makes

- Five 2026 anchors before anything is written: Ash Wednesday 18 Feb, Easter
  5 Apr, Pentecost 24 May, Christ the King 22 Nov, First Sunday of Advent
  29 Nov. A wrong anchor stops the build.
- Every derived week is compared with the number in romcal's own temporal name
  ("Saturday of the 22nd week of Ordinary Time"); any mismatch stops the build.
  **romcal 1.3.0 quirk:** in a year where the Baptism of the Lord falls on a
  Monday (2029) romcal names the weekdays after it "1st week" while naming the
  following Sunday the "2nd Sunday". The Ordo, and this derivation, number
  those weekdays as the 2nd week; in such a year only Sundays are compared.

## The lives

`extract-lives.js` keys each life by the romcal celebration key of the
celebration on its date whose name matches (178 of 183), else by `MM-DD` (the
five American saints not on the General Calendar: Marguerite Bourgeoys, Michael
Ghebre, Damien of Molokai, Isidore the Farmer, Kateri Tekakwitha). Three
matches are by alias (Blase, the Nativity of Mary, All Souls). The schema adds
`practice` and `practice_source`, empty until written. The SAINTS table it
reads from is gone from `index.html` now; the script is kept for the record.

## What it does not cover

The 1962 calendar is not in romcal. The traditional rite uses the Office's own
corpus (Divinum Officium, Rubrics 1960), which covers 2026-08-24 → 2028-12-31.
