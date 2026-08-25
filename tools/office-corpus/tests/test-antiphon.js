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
// Since the buildOffice split it does not merely match it -- it IS it. The
// wrong-antiphon-in-the-audio-cache bug was a divergence between two copies of
// the office; there is now one copy, so what has to be guarded is that the
// play*Audio() builders stayed thin and never grow a second one.
const thin = (fn) => {
  const a = L.findIndex(l => l.includes(`async function ${fn}(`));
  const b = L.findIndex((l, i) => i > a && l === '}');
  if (a < 0 || b <= a) { check(false, `${fn}(): could not locate function`); return; }
  const body = L.slice(a, b + 1).join('\n');
  check(!/sData\./.test(body),  `${fn}() reads no sData -- buildOffice owns the antiphons`);
  check(!/text \+=/.test(body), `${fn}() builds no office text of its own`);
  check(/buildOffice\(/.test(body) && /renderOfficeText\(/.test(body),
        `${fn}() goes through buildOffice + renderOfficeText`);
};
['playVigilsAudio', 'playLaudsAudio', 'playVespersAudio', 'playComplineAudio'].forEach(thin);

// buildOffice() is the single reader. If an antiphon is read anywhere else,
// a second copy of the office has started to grow.
const bs = L.findIndex(l => l.startsWith('function buildOffice('));
const be = L.findIndex((l, i) => i > bs && l === '}');
if (bs < 0 || be <= bs) check(false, 'buildOffice(): could not locate function');
else {
  const outside = L.filter((l, i) => (i < bs || i > be) && /sData\.\w*(Antiphon|vigils)/.test(l));
  check(outside.length === 0,
        `no antiphon is read outside buildOffice() (found ${outside.length})`);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
process.exit(fail ? 1 : 0);
