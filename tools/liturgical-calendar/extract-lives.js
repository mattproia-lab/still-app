#!/usr/bin/env node
/* One-time move of the SAINTS table out of index.html into corpus/saints/lives.json.

   Each of the 183 lives keeps its name, feast string, rank, bio and prayer
   exactly as written. Entries are keyed by romcal's celebration key where one
   celebration on that date matches the name, and by the original MM-DD where
   none does. Two fields are added to the schema, empty for now: practice and
   practice_source. Prints the matched count and the unmatched list.

   usage: node extract-lives.js            (reads ../../index.html and the general 2026 calendar)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = html.indexOf('const SAINTS = {'), b = html.indexOf('function getTodaysSaint');
if (a < 0 || b < 0) { console.error('SAINTS table not found in index.html'); process.exit(1); }
const SAINTS = new Function(html.slice(a, b) + '; return SAINTS;')();
const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus', 'calendar', 'general', '2026.json'), 'utf8')).days;

const STOP = new Set(['saint', 'saints', 'st', 'sts', 'blessed', 'the', 'of', 'and', 'or', 'our', 'lord', 'lady', 'virgin', 'martyr', 'martyrs',
  'bishop', 'bishops', 'priest', 'priests', 'doctor', 'doctors', 'church', 'religious', 'abbot', 'abbess', 'pope', 'king', 'queen', 'apostle', 'apostles',
  'evangelist', 'confessor', 'deacon', 'hermit', 'companions', 'his', 'her', 'mary', 'jesus', 'holy', 'most', 'blessed', 'bvm', 'de', 'da', 'del', 'di', 'la', 'le', 'du']);
/* Names the token match cannot see through: a spelling, a synonym, a title. */
const ALIAS = { '02-03': 'blase', '09-08': 'birth', '11-02': 'souls' };
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const tokens = s => norm(s).split(/\s+/).filter(t => t && !STOP.has(t) && t.length > 2);

const out = { schema: 'still-saints-lives/1', source: 'Moved from the SAINTS table in index.html (in-house writing, May 2026); keys are romcal 1.3.0 celebration keys where a celebration on the date matched the name, else MM-DD.',
  fields: { name: 'display name', feast: 'display rank string', rank: 'solemnity | feast | memorial | optional', date: 'MM-DD', bio: 'one paragraph', prayer: 'one prayer', practice: 'optional: one concrete thing to do today, like the saint (empty until written)', practice_source: 'optional: where the practice comes from (empty until written)' },
  entries: {} };
let matched = 0; const unmatched = [];
Object.keys(SAINTS).sort().forEach(md => {
  const e = SAINTS[md];
  const day = cal[`2026-${md}`];
  const candidates = day ? day.celebrations.filter(c => c.source !== 'temporal') : [];
  const want = ALIAS[md] ? [ALIAS[md]] : tokens(e.name);
  let best = null, bestScore = 0;
  candidates.forEach(c => {
    const have = new Set(tokens(c.name));
    const hits = want.filter(t => have.has(t)).length;
    const score = want.length ? hits / want.length : 0;
    if (hits >= 1 && score > bestScore) { best = c; bestScore = score; }
  });
  const key = best && bestScore >= 0.5 ? best.key : md;
  if (best && bestScore >= 0.5) matched++; else unmatched.push({ date: md, name: e.name, candidates: candidates.map(c => c.name) });
  if (out.entries[key]) { console.error('duplicate key', key, 'for', md, e.name); process.exit(1); }
  out.entries[key] = { name: e.name, feast: e.feast, rank: e.rank, date: md, bio: e.bio, prayer: e.prayer, practice: '', practice_source: '' };
});
fs.mkdirSync(path.join(ROOT, 'corpus', 'saints'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'corpus', 'saints', 'lives.json'), JSON.stringify(out, null, 1));
// The served copy: corpus/ is a forced 404 on the site and absent from the native bundle; assets/ is neither.
fs.mkdirSync(path.join(ROOT, 'assets', 'saints'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'corpus', 'saints', 'lives.json'), path.join(ROOT, 'assets', 'saints', 'lives.json'));
console.log(`lives: ${Object.keys(out.entries).length} entries written; ${matched} keyed by romcal celebration key, ${unmatched.length} keyed by MM-DD`);
unmatched.forEach(u => console.log(`  ${u.date}  ${u.name}  ->  calendar that day: ${u.candidates.length ? u.candidates.join(' | ') : '(temporal only)'}`));
