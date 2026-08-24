const {load, at} = require('./harness.js');

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOUR = 3600000;
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

// Walk hour by hour across a 14-month span that contains BOTH US DST changes
// (2026-11-01 fall back, 2027-03-14 spring forward) and the year boundary,
// recording every instant where getPsalmWeek() changes value.
const start = at(2026, 9, 1, 0);
const end   = at(2027, 11, 1, 0);

const transitions = [];
let prev = load(start).getPsalmWeek();
const seen = new Set([prev]);
for (let t = start + HOUR; t <= end; t += HOUR) {
  const v = load(t).getPsalmWeek();
  seen.add(v);
  if (v !== prev) { transitions.push({ d: new Date(t), from: prev, to: v }); prev = v; }
}

// 1. Every rollover must be at Saturday 17:00 local -- First Vespers, the
//    app's own Vespers hour (index.html, setOfficeTime()).
const badDay = transitions.filter(x => !(x.d.getDay() === 6 && x.d.getHours() === 17));
check(badDay.length === 0,
      `all ${transitions.length} rollovers land on Sat 17:00 (bad: ${badDay.length})`);
for (const x of badDay.slice(0, 5))
  console.log(`        ${x.d.toDateString()} ${String(x.d.getHours()).padStart(2,'0')}:00 ` +
              `${DAYS[x.d.getDay()]}  ${x.from} -> ${x.to}`);

// 2. Exactly one rollover per week.
check(transitions.length === 61, `one rollover per week: ${transitions.length} (want 61)`);

// 3. Domain and ordering.
check([...seen].every(v => [1,2,3,4].includes(v)), `values stay within 1..4 (${[...seen].sort().join(',')})`);
check(transitions.every(x => x.to === (x.from % 4) + 1), 'each step advances by exactly one, cycling');

// 4. The week must not change mid-week, including across the DST fall-back.
const span = [at(2026,10,31,17), at(2026,10,31,23), at(2026,11,1,12), at(2026,11,4,12), at(2026,11,6,23)];
const vals = span.map(t => load(t).getPsalmWeek());
check(vals.every(v => v === vals[0]),
      `Sat 17:00 Oct 31 -> Fri Nov 6 constant across DST fall-back (${vals.join(',')})`);

// 5. Anchor -- the four-week cycle restarts at First Vespers of Advent.
//    Plan section 5: First Sunday of Advent 2026 = 2026-11-29.
check(new Date(2026,10,29).getDay() === 0, 'anchor 2026-11-29 really is a Sunday');
check(load(at(2026,11,29,9)).getPsalmWeek() === 1, 'First Sunday of Advent 2026 -> week 1');
check(load(at(2026,11,28,17)).getPsalmWeek() === 1, 'First Vespers of Advent (Sat 17:00) -> week 1');
check(load(at(2026,11,28,16)).getPsalmWeek() === 4, 'hour before First Vespers -> week 4 (previous cycle ends)');

// Cycle forward and backward from the anchor.
for (let k = -4; k <= 8; k++) {
  const d = new Date(2026, 10, 29 + 7*k, 9);
  const want = (((k % 4) + 4) % 4) + 1;
  check(load(d.getTime()).getPsalmWeek() === want,
        `Advent${k < 0 ? '' : '+'}${k}w  ${d.toDateString()} -> week ${want}`);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
process.exit(fail ? 1 : 0);
