// Sweep the whole coverage window and record the conclusion the engine
// actually renders, per date per hour.
//
// Necessary because the conclusion is NOT invariant: in Paschaltide Lauds and
// Vespers take "Benedicámus Dómino, allelúia, allelúia" while Matutinum does
// not. Rather than encode a rubric rule I cannot verify, this asks the engine
// for every day in the window and stores the answer.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const DO = path.join(SP, 'do');
const OUT = path.join(SP, 'conclusions.json');

const HOURS = { vigils: 'prayMatutinum', lauds: 'prayLaudes', vespers: 'prayVesperae' };
const FIRST = '2026-08-24', LAST = '2028-12-31';

const BLOCK = /^<\/?(BR|P|TR|TD|TH|DIV|TABLE|TBODY|H[1-6]|HR|LI|UL|OL|BLOCKQUOTE)\b[^>]*>$/i;
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function detag(h) {
  let o = '', i = 0;
  while (i < h.length) {
    const l = h.indexOf('<', i);
    if (l < 0) { o += h.slice(i); break; }
    o += h.slice(i, l);
    const g = h.indexOf('>', l);
    if (g < 0) break;
    o += BLOCK.test(h.slice(l, g + 1)) ? '\n' : '';
    i = g + 1;
  }
  return o.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ENT[m])
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/[ \t ]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n').trim();
}
const NAV = /^(Top Next|Top|Next|\d+)$/;
const cellLines = t => (t || '').split('\n').map(s => s.trim()).filter(s => s && !NAV.test(s));

function conclusionOf(html) {
  const trRe = /<TR\b[^>]*>([\s\S]*?)<\/TR>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const tdRe = /<TD\b[^>]*>([\s\S]*?)<\/TD>/gi;
    let c; const cells = [];
    while ((c = tdRe.exec(m[1]))) cells.push(detag(c[1]));
    const la = cellLines(cells[0]);
    if ((la[0] || '').startsWith('Conclusio'))
      return { la: la.slice(1), en: cellLines(cells[1]).slice(1) };
  }
  return null;
}

const pad = n => String(n).padStart(2, '0');
const dates = [];
for (let d = new Date(FIRST + 'T00:00:00Z'); d <= new Date(LAST + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  dates.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
}

const variants = [];
const keyOf = v => JSON.stringify(v);
const seen = new Map();
const days = {};
let missing = 0;

console.log(`sweeping ${dates.length} days x 3 hours = ${dates.length * 3} renders`);
dates.forEach((iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const doDate = `${m}-${d}-${y}`;
  days[iso] = {};
  for (const [hour, cmd] of Object.entries(HOURS)) {
    let html = '';
    try {
      html = execFileSync('perl', ['-I' + path.join(SP, 'lib'),
        'web/cgi-bin/horas/officium.pl',
        'version=Rubrics 1960', 'command=' + cmd, 'date=' + doDate,
        'lang1=Latin', 'lang2=English'],
        { cwd: DO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { html = ''; }
    const concl = conclusionOf(html);
    if (!concl) { days[iso][hour] = null; missing++; continue; }
    const k = keyOf(concl);
    if (!seen.has(k)) { seen.set(k, variants.length); variants.push(concl); }
    days[iso][hour] = seen.get(k);
  }
  if ((n + 1) % 60 === 0) console.log(`  ${n + 1}/${dates.length} days, ${variants.length} distinct variants so far`);
});

fs.writeFileSync(OUT, JSON.stringify({
  _provenance: {
    source: 'DivinumOfficium/divinum-officium',
    method: 'render-as-oracle, engine unmodified; every day in the window rendered',
    window: { first: FIRST, last: LAST, days: dates.length },
    harvested: '2026-08-25',
  },
  variants, days,
}, null, 1));

console.log(`\ndone. ${variants.length} distinct conclusion variants, ${missing} days with no conclusion row.`);
variants.forEach((v, i) => console.log(`  [${i}] ${v.la.join(' | ')}`));
