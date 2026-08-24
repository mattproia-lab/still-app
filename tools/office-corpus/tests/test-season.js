const {load, at} = require('./harness.js');

// Expected season per the app's own approximate boundaries:
//   Christmas: Dec 25 - Jan 12      Advent: Nov 27 - Dec 24
//   Lent: Ash Wed - Easter eve      Easter: Easter - Pentecost
//   everything else: Ordinary
const cases = [
  // [y, m, d, expected, why]
  [2026, 12, 25, 'christmas', 'Christmas Day itself'],
  [2026, 12, 26, 'christmas', 'Christmas octave'],
  [2027,  1,  1, 'christmas', 'Jan 1, still Christmas'],
  [2027,  1, 12, 'christmas', 'last day of the Christmas span'],
  [2027,  1, 13, 'ordinary',  'day after Christmas span ends'],
  [2027,  1, 15, 'ordinary',  'mid-January is NOT Christmas'],
  [2027,  2,  1, 'ordinary',  'February is NOT Christmas'],
  [2027,  2, 12, 'lent',      'Feb 12 2027 is Lent (Ash Wed Feb 10), NOT Christmas'],
  [2026, 11, 27, 'advent',    'Advent begins (app approximation)'],
  [2026, 11, 29, 'advent',    'First Sunday of Advent 2026'],
  [2026, 12, 24, 'advent',    'Christmas Eve, last day of Advent'],
  [2026, 11, 26, 'ordinary',  'day before Advent'],
  [2026,  8, 24, 'ordinary',  'today'],
  [2026,  7, 23, 'ordinary',  'the date the vault sampled'],
  // Lent / Easter 2026: Easter = Apr 5, Ash Wed = Feb 18, Pentecost = May 24
  [2026,  2, 18, 'lent',      'Ash Wednesday 2026'],
  [2026,  3, 30, 'lent',      'Holy Week'],
  [2026,  4,  4, 'lent',      'Holy Saturday'],
  [2026,  4,  5, 'easter',    'Easter Sunday 2026'],
  [2026,  5, 24, 'easter',    'Pentecost 2026'],
  [2026,  5, 25, 'ordinary',  'day after Pentecost'],
  [2026,  2, 17, 'ordinary',  'Shrove Tuesday, day before Lent'],
];

let pass = 0, fail = 0;
for (const [y, m, d, want, why] of cases) {
  const got = load(at(y, m, d)).getLiturgicalSeason();
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}  want=${want.padEnd(9)} got=${got.padEnd(9)} ${why}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
