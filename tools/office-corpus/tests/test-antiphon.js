const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');
const src = fs.readFileSync(path, 'utf8');
const L = src.split(/\r?\n/);
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

// --- 1. OFFICE_SEASONS data -------------------------------------------------
const s = L.findIndex(l => l.startsWith('const OFFICE_SEASONS = {'));
const e = L.findIndex((l, i) => i > s && l === '};');
const SEASONS = new Function('return ' + L.slice(s, e + 1).join('\n').replace(/^const OFFICE_SEASONS = /, '').replace(/;$/, ''))();

const want = ['label','laudsAntiphon','vespersAntiphon','vigils','complineAntiphon','marian'];
for (const [name, d] of Object.entries(SEASONS)) {
  check(want.every(k => k in d), `${name}: has all keys [${want.join(', ')}]`);
  check(typeof d.vespersAntiphon === 'string' && d.vespersAntiphon.trim().length > 0,
        `${name}: vespersAntiphon is a non-empty string`);
  check(d.vespersAntiphon !== d.laudsAntiphon,
        `${name}: Vespers antiphon differs from Lauds`);
}
check(Object.keys(SEASONS).length === 5, `all 5 seasons present (${Object.keys(SEASONS).join(', ')})`);

// Every season getLiturgicalSeason can return must exist in the table.
for (const k of ['ordinary','advent','christmas','lent','easter'])
  check(k in SEASONS, `season '${k}' present in OFFICE_SEASONS`);

// --- 2. Each office block reads only its own antiphon key -------------------
const blockStart = (needle) => L.findIndex(l => l.includes(needle));
const bounds = {
  vigils:   [blockStart(`if (hour === 'vigils')`),    blockStart(`} else if (hour === 'lauds')`)],
  lauds:    [blockStart(`} else if (hour === 'lauds')`),   blockStart(`} else if (hour === 'vespers')`)],
  vespers:  [blockStart(`} else if (hour === 'vespers')`), blockStart(`} else if (hour === 'compline')`)],
};
for (const [k, [a, b]] of Object.entries(bounds)) {
  if (a < 0 || b < 0 || b <= a) { check(false, `${k}: could not locate render block`); continue; }
  const body = L.slice(a, b).join('\n');
  const reads = [...body.matchAll(/sData\.(\w+)/g)].map(m => m[1]).filter(x => /Antiphon|vigils/.test(x));
  const uniq = [...new Set(reads)];
  const expect = { vigils: 'vigils', lauds: 'laudsAntiphon', vespers: 'vespersAntiphon' }[k];
  check(uniq.length > 0 && uniq.every(r => r === expect),
        `${k} render block reads only sData.${expect} (found: ${uniq.join(', ') || 'none'})`);
}

// --- 3. Audio path matches the screen --------------------------------------
const audio = (fn, expect) => {
  const a = L.findIndex(l => l.includes(`async function ${fn}(`));
  const b = L.findIndex((l, i) => i > a && l.startsWith('async function'));
  const body = L.slice(a, b > a ? b : a + 60).join('\n');
  const uniq = [...new Set([...body.matchAll(/sData\.(\w+Antiphon)/g)].map(m => m[1]))];
  check(uniq.length > 0 && uniq.every(r => r === expect),
        `${fn}() reads only sData.${expect} (found: ${uniq.join(', ') || 'none'})`);
};
audio('playLaudsAudio', 'laudsAntiphon');
audio('playVespersAudio', 'vespersAntiphon');

console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
process.exit(fail ? 1 : 0);
