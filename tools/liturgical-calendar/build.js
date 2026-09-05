#!/usr/bin/env node
/* Build-time generator for the app's liturgical calendar.

   Writes corpus/calendar/general/<year>.json (General Roman Calendar) and
   corpus/calendar/us/<year>.json (United States) from romcal 1.3.0, which is a
   devDependency of this folder only. Nothing here ships to the app; the JSON
   does. The app reads the general file; the US file waits for a setting.

   Per date: the temporal day, every sanctoral celebration romcal lists for
   the day (optional memorials included, not just the winner), and the movable
   celebrations, with the winner marked from romcal's resolved calendar. The
   season, colour, psalter week and a week-of-season derived by counting
   Sundays are carried on the date.

   romcal 1.x resolves one celebration per day and drops the rest, so the
   losers come from its unresolved sources: Seasons.*(year) for the temporal
   cycle, Calendar.getCalendar(<country>).dates(year) for the sanctoral, and
   Celebrations.dates(year) for the movable solemnities. Where the General
   Roman Calendar has two optional memorials on one day romcal 1.x already
   folds them into one combined entry (25 May: Bede, Gregory VII, Mary
   Magdalene de' Pazzi); that entry is kept as romcal gives it.

   Before writing, 2026 is checked against five anchors; a wrong anchor stops
   the build with a non-zero exit.

   usage: node build.js 2026 2030
*/
'use strict';
const fs = require('fs');
const path = require('path');
const romcal = require('romcal');
const moment = require('moment');

const [from, to] = process.argv.slice(2).map(Number);
if (!from || !to || to < from) { console.error('usage: node build.js <fromYear> <toYear>'); process.exit(2); }

const OUT = path.resolve(__dirname, '..', '..', 'corpus', 'calendar');
const iso = m => (moment.isMoment(m) ? m : moment(m)).format('YYYY-MM-DD');
/* romcal's Dates are UTC moments; comparing them with local ones shifts a day
   west of Greenwich. Every date is reduced to its calendar day first. */
const day = m => moment(iso(m), 'YYYY-MM-DD');

/* ---------- normalisation ---------- */
const RANK = { SOLEMNITY: 'solemnity', FEAST: 'feast', MEMORIAL: 'memorial', OPT_MEMORIAL: 'optional',
               COMMEMORATION: 'commemoration', SUNDAY: 'sunday', FERIA: 'weekday', HOLY_WEEK: 'holy_week', TRIDUUM: 'triduum' };
const COLOR = { WHITE: 'white', GREEN: 'green', RED: 'red', PURPLE: 'violet', ROSE: 'rose', GOLD: 'white' };
const SEASON = { 'Advent': 'advent', 'Christmastide': 'christmas', 'Early Ordinary Time': 'ordinary_time', 'Lent': 'lent',
                 'Holy Week': 'holy_week', 'Easter': 'easter', 'Later Ordinary Time': 'ordinary_time' };
const SEASON_NAME = { advent: 'Advent', christmas: 'Christmas Time', ordinary_time: 'Ordinary Time', lent: 'Lent',
                      holy_week: 'Holy Week', triduum: 'The Sacred Paschal Triduum', easter: 'Easter Time' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4)] || 'th');

/* ---------- anchors ---------- */
function checkAnchors() {
  const D = romcal.Dates;
  const want = {
    'Ash Wednesday':          ['2026-02-18', iso(D.ashWednesday(2026))],
    'Easter':                 ['2026-04-05', iso(D.easter(2026))],
    'Pentecost':              ['2026-05-24', iso(D.pentecostSunday(2026))],
    'Christ the King':        ['2026-11-22', iso(D.christTheKing(2026))],
    'First Sunday of Advent': ['2026-11-29', iso(D.firstSundayOfAdvent(2026))],
  };
  let ok = true;
  for (const [name, [expected, got]] of Object.entries(want)) {
    const pass = expected === got;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: expected ${expected}, romcal ${got}`);
    if (!pass) ok = false;
  }
  if (!ok) { console.error('Anchor check failed; nothing written.'); process.exit(1); }
}

/* ---------- week of season, by counting Sundays ----------
   Ordinary Time follows the Church's numbering, which counting alone does not
   give: the first block counts forward from the Baptism of the Lord (the Monday
   after it opens Week 1, the Sunday after it is the 2nd Sunday), and the second
   block counts backward so that Christ the King is the 34th Sunday. Every other
   season counts Sundays forward from its start: Advent from its first Sunday,
   Lent from Ash Wednesday (week 0 is the days after Ash Wednesday), Easter from
   Easter Sunday (week 1 is the Octave), Christmas from Christmas Day. */
function sundaysBetween(a, b) {           // Sundays in (a, b]
  let n = 0; const d = day(a).add(1, 'day'), end = day(b);
  while (!d.isAfter(end, 'day')) { if (d.day() === 0) n++; d.add(1, 'day'); }
  return n;
}
function sundaysFrom(a, b) {              // Sundays in [a, b]
  return sundaysBetween(day(a).subtract(1, 'day'), b);
}
function weekOfSeason(date, season, year) {
  const D = romcal.Dates, d = day(date);
  switch (season) {
    case 'advent':    return sundaysFrom(D.firstSundayOfAdvent(d.month() === 0 ? year - 1 : year), d);
    case 'christmas': return sundaysBetween(D.christmas(d.month() === 11 ? year : year - 1), d) + 1;
    case 'lent':      return sundaysFrom(D.ashWednesday(year), d);
    case 'holy_week': return 6;
    case 'triduum':   return null;
    case 'easter':    return sundaysFrom(D.easter(year), d);
    case 'ordinary_time': {
      const baptism = D.baptismOfTheLord(year), ctk = D.christTheKing(year);
      if (d.isBefore(day(D.ashWednesday(year)), 'day')) return sundaysBetween(baptism, d) + 1;
      return 34 - sundaysBetween(d, ctk);
    }
  }
  return null;
}

/* The day's own name, in the Church's phrasing */
function dayName(date, season, week, temporal, win) {
  const d = day(date), wd = WEEKDAY[d.day()], sunday = d.day() === 0;
  // Days of the temporal cycle that carry their own name: Ash Wednesday, the
  // Triduum. (Palm Sunday, the Baptism, Holy Family and the like are named as
  // celebrations on the day line's other half.)
  if (win && win.source === 'celebration' && (win.type === 'FERIA' || win.type === 'TRIDUUM')) {
    return { holyThursday: 'Thursday of Holy Week', goodFriday: 'Friday of the Passion of the Lord', holySaturday: 'Holy Saturday' }[win.key] || win.name;
  }
  const inOctave = temporal && /Octave of Christmas/.test(temporal.name);
  switch (season) {
    case 'advent':    return sunday ? `${ordinal(week)} Sunday of Advent` : `${wd} of the ${ordinal(week)} Week of Advent`;
    case 'christmas': return inOctave ? `${wd} within the Octave of Christmas` : sunday ? `Sunday of Christmas Time` : `${wd} of Christmas Time`;
    case 'lent':      return week === 0 ? `${wd} after Ash Wednesday`
                                        : sunday ? `${ordinal(week)} Sunday of Lent` : `${wd} of the ${ordinal(week)} Week of Lent`;
    case 'holy_week': return sunday ? 'Palm Sunday of the Passion of the Lord' : `${wd} of Holy Week`;
    case 'triduum':   return wd;
    case 'easter':    return week === 1 ? (sunday ? 'Easter Sunday of the Resurrection of the Lord' : `${wd} within the Octave of Easter`)
                                        : sunday ? `${ordinal(week)} Sunday of Easter` : `${wd} of the ${ordinal(week)} Week of Easter`;
    case 'ordinary_time': return sunday ? `${ordinal(week)} Sunday in Ordinary Time` : `${wd} of the ${ordinal(week)} Week in Ordinary Time`;
  }
  return wd;
}

/* Self-check: romcal names its temporal days with the same week numbers the
   Church uses ("Saturday of the 22nd week of Ordinary Time"). Every day whose
   temporal name carries a number must agree with the derived week. */
function checkWeeks(days, year, country) {
  // romcal 1.3.0 quirk: in a year where the Baptism of the Lord falls on a
  // Monday (Epiphany on Sunday 7 January, e.g. 2029) it names the weekdays
  // after the Baptism "1st week" while naming the following Sunday the "2nd
  // Sunday". The Ordo numbers those weekdays as the 2nd week; so does the
  // derivation here. In such a year only the Sundays are compared.
  const baptismOnSunday = day(romcal.Dates.baptismOfTheLord(year)).day() === 0;
  let bad = 0, compared = 0;
  Object.entries(days).forEach(([k, d]) => {
    const t = d.celebrations.find(c => c.source === 'temporal');
    if (!t) return;
    const m = /(\d+)(?:st|nd|rd|th) (week|Sunday) of (Ordinary Time|Lent|Advent|Easter)/.exec(t.name);
    if (!m) return;
    if (m[2] === 'week' && !baptismOnSunday && m[3] === 'Ordinary Time') return;
    compared++;
    if (Number(m[1]) !== d.week) { bad++; if (bad <= 5) console.log(`  week mismatch ${k}: romcal "${t.name}" vs derived ${d.week}`); }
  });
  console.log(`${country}/${year}: week self-check against romcal's temporal names: ${compared} compared, ${bad} mismatches${baptismOnSunday ? '' : ' (Baptism on a Monday: Ordinary Time weekdays skipped, romcal quirk)'}`);
  if (bad) { console.error('Week derivation disagrees with romcal; nothing written.'); process.exit(1); }
}

/* ---------- one year, one country ---------- */
function buildYear(year, country) {
  const resolved = romcal.calendarFor({ year, country, locale: 'en', type: 'calendar' }, true);
  const byDate = {};
  const add = (item, source) => {
    const k = iso(item.moment);
    const meta = (item.data && item.data.meta) || {};
    (byDate[k] = byDate[k] || []).push({
      key: item.key, name: item.name, type: item.type, rank: RANK[item.type] || item.type.toLowerCase(),
      color: COLOR[(meta.liturgicalColor || {}).key] || null, source,
      titles: (meta.titles && meta.titles.length) ? meta.titles : undefined
    });
  };
  // temporal cycle
  Object.keys(romcal.Seasons).forEach(fn => romcal.Seasons[fn](year).forEach(item => add(item, 'temporal')));
  // movable celebrations
  romcal.Celebrations.dates(year).forEach(item => add(item, 'celebration'));
  // sanctoral: the General Roman Calendar, and the country's additions on top
  romcal.Calendar.getCalendar('general').dates(year).forEach(item => add(item, 'general'));
  if (country !== 'general') romcal.Calendar.getCalendar(country).dates(year).forEach(item => add(item, country));

  const out = {};
  resolved.forEach(win => {
    const k = iso(win.moment);
    const seasonKey = SEASON[(win.data.season || {}).key] || null;
    const list = byDate[k] || [];
    // Temporal days that romcal names but does not list as a source (e.g. the
    // resolved winner on a plain weekday) are added from the winner itself.
    if (!list.some(c => c.key === win.key)) add(win, win.source === 'g' ? 'general' : (win.source || 'temporal'));
    // dedupe: by key, and temporal rows by name (the Triduum days come from two Seasons lists)
    const cel = (byDate[k] || []).filter((c, i, a) => a.findIndex(x => x.key === c.key || (x.source === 'temporal' && c.source === 'temporal' && x.name === c.name)) === i)
      .map(c => ({ ...c, winner: c.key === win.key }));
    const temporal = cel.find(c => c.source === 'temporal');
    const winner = cel.find(c => c.winner);
    const season = win.type === 'TRIDUUM' ? 'triduum' : seasonKey;
    const week = weekOfSeason(k, season, year);
    out[k] = {
      season, seasonName: SEASON_NAME[season] || season,
      week, dayName: dayName(k, season, week, temporal, winner),
      color: COLOR[(win.data.meta.liturgicalColor || {}).key] || null,
      psalterWeek: (win.data.meta.psalterWeek || {}).key || null,
      winner: win.key,
      celebrations: cel.sort((a, b) => (b.winner - a.winner))
    };
  });
  return out;
}

/* ---------- the traditional calendar, sliced per year ----------
   The Office's corpus/traditional/calendar-index.json (Divinum Officium,
   Rubrics 1960) already answers "what is today" for the traditional rite:
   the Latin title, its class, the commemorations. The app cannot read that
   file directly (corpus/ is a forced 404 on the site and is not in the native
   bundle, and it is 1.1 MB), so the same records are re-sliced here, one small
   file per year, unchanged in content. */
function sliceTraditional() {
  const src = path.resolve(__dirname, '..', '..', 'corpus', 'traditional', 'calendar-index.json');
  if (!fs.existsSync(src)) { console.log('traditional: calendar-index.json not found, skipped'); return []; }
  const idx = JSON.parse(fs.readFileSync(src, 'utf8'));
  const byYear = {};
  Object.entries(idx.days).forEach(([k, v]) => { (byYear[k.slice(0, 4)] = byYear[k.slice(0, 4)] || {})[k] = {
    title: String(v.title || '').trim(), key: v.key, rank: v.rank, commemorations: v.commemorations || [], vespera: v.vespera || null, weekday: v.weekday || null }; });
  const dir = path.join(OUT, 'traditional'); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  Object.keys(byYear).sort().forEach(y => {
    const file = path.join(dir, `${y}.json`);
    fs.writeFileSync(file, JSON.stringify({ calendar: idx.kalendar || 'Rubrics 1960', source: 'corpus/traditional/calendar-index.json (Divinum Officium)', year: Number(y), days: byYear[y] }));
    files.push(file);
    console.log(`traditional/${y}: ${Object.keys(byYear[y]).length} days, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  });
  return files;
}

/* ---------- the served copies ----------
   corpus/ is the record; the app reads assets/, which Netlify serves and the
   sync copies into www/ for the native shell. Only what the app reads is
   copied: the general calendar, the traditional slices, and the lives. The US
   calendar stays in corpus/ until a setting reads it. */
function copyToAssets(files) {
  const assets = path.resolve(__dirname, '..', '..', 'assets', 'calendar');
  files.forEach(f => {
    const rel = path.relative(OUT, f);
    const dest = path.join(assets, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  });
  console.log(`assets/calendar: ${files.length} files copied`);
}

/* ---------- run ---------- */
checkAnchors();
const served = [];
for (const country of ['general', 'unitedStates']) {
  const dir = path.join(OUT, country === 'general' ? 'general' : 'us');
  fs.mkdirSync(dir, { recursive: true });
  for (let y = from; y <= to; y++) {
    const days = buildYear(y, country);
    checkWeeks(days, y, country);
    const file = path.join(dir, `${y}.json`);
    fs.writeFileSync(file, JSON.stringify({ calendar: country === 'general' ? 'General Roman Calendar' : 'United States',
      source: 'romcal 1.3.0', generated: new Date().toISOString().slice(0, 10), year: y, days }));
    if (country === 'general') served.push(file);
    const n = Object.keys(days).length, multi = Object.values(days).filter(d => d.celebrations.length > 1).length;
    console.log(`${country}/${y}: ${n} days, ${multi} with more than one celebration, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
served.push(...sliceTraditional());
copyToAssets(served);
