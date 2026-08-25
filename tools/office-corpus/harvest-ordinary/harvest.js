// Harvest the five texts the corpus names but does not carry, from the
// Divinum Officium render (render-as-oracle, per the Stage 1 decision).
//
// Nothing here is composed. Every string is lifted from officium.pl's own
// HTML output by the documented rule: block tags -> newline, all other tags
// -> the empty string, never a space.
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const RENDER = path.join(SP, 'render');
const OUT = path.join(SP, 'ordinary.json');

const BLOCK = /^<\/?(BR|P|TR|TD|TH|DIV|TABLE|TBODY|H[1-6]|HR|LI|UL|OL|BLOCKQUOTE)\b[^>]*>$/i;
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function detag(html) {
  let out = '', i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt);
    if (gt < 0) break;
    out += BLOCK.test(html.slice(lt, gt + 1)) ? '\n' : '';
    i = gt + 1;
  }
  return out
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ENT[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function rows(file) {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const trRe = /<TR\b[^>]*>([\s\S]*?)<\/TR>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [];
    const tdRe = /<TD\b[^>]*>([\s\S]*?)<\/TD>/gi;
    let c;
    while ((c = tdRe.exec(m[1]))) cells.push(detag(c[1]));
    out.push(cells);
  }
  return out;
}

// Drop the per-cell navigation furniture DO puts in the top-right corner.
const NAV = /^(Top\s+Next|Top|Next|\d+)$/;
// Collapse runs of literal spaces. This is NOT the drop-cap rule (which is
// about never inventing or eating a space at a tag boundary); it is the same
// normalisation the corpus generator applied — verified by 209/252 extracted
// verse strings matching store/psalms.json verbatim once applied.
const squash = s => s.replace(/[ \t ]+/g, ' ').trim();
const lines = cell => cell.split('\n').map(squash).filter(s => s && !NAV.test(s));

// ── conclusions ───────────────────────────────────────────────────────
// A run of versicle/response pairs under the "Conclusio" heading.
function conclusion(latinCell, englishCell) {
  const la = lines(latinCell).slice(1);   // drop "Conclusio"
  const en = lines(englishCell).slice(1); // drop "Conclusion"
  if (la.length !== en.length) throw new Error(`conclusion cell mismatch ${la.length}/${en.length}`);
  const pairs = [];
  for (let i = 0; i < la.length; i += 2) {
    const v = { la: la[i], en: en[i] };
    const r = la[i + 1] === undefined ? null : { la: la[i + 1], en: en[i + 1] };
    if (!/^℣\./.test(v.la) || (r && !/^℟\./.test(r.la)))
      throw new Error(`unexpected conclusion shape at ${i}: ${v.la}`);
    pairs.push({ v, r });
  }
  return pairs;
}

// ── gospel canticles ──────────────────────────────────────────────────
// Heading, canticle title, citation, numbered verses, then the doxology.
// The antiphon is proper to the day and already lives in the corpus, so it
// is deliberately excluded here.
function canticle(latinCell, englishCell) {
  const la = lines(latinCell), en = lines(englishCell);
  const pick = arr => {
    const verses = [], dox = [];
    let citation = null;
    for (const l of arr) {
      const m = /^(\d+:\d+)\s+(.*)$/.exec(l);
      if (m) { verses.push({ ref: m[1], text: m[2] }); continue; }
      if (/^(Luc\.|Luke)\s/.test(l)) { citation = l; continue; }
      if (/^[℣℟]\./.test(l)) dox.push(l);
    }
    return { citation, verses, dox };
  };
  const L = pick(la), E = pick(en);
  if (L.verses.length !== E.verses.length)
    throw new Error(`canticle verse count mismatch ${L.verses.length}/${E.verses.length}`);
  // DO repeats a psalm's incipit as a second line under the same verse number
  // when the antiphon quotes it. That must not happen inside a canticle; if it
  // ever does, the harvest is silently duplicating a line.
  const dupes = L.verses.map(v => v.ref).filter((r, i, a) => a.indexOf(r) !== i);
  if (dupes.length) throw new Error(`duplicate canticle verse refs: ${dupes.join(', ')}`);
  if (L.dox.length !== E.dox.length || L.dox.length !== 2)
    throw new Error(`canticle doxology mismatch ${L.dox.length}/${E.dox.length}`);
  return {
    citation: { la: L.citation, en: E.citation },
    verses: L.verses.map((v, i) => {
      if (v.ref !== E.verses[i].ref) throw new Error(`verse ref mismatch ${v.ref}/${E.verses[i].ref}`);
      return { ref: v.ref, la: v.text, en: E.verses[i].text };
    }),
    doxology: {
      v: { la: L.dox[0], en: E.dox[0] },
      r: { la: L.dox[1], en: E.dox[1] },
    },
  };
}

// ── locate rows by their own heading, never by index ──────────────────
function findRow(rs, latinHeading) {
  const i = rs.findIndex(cells => (lines(cells[0] || '')[0] || '').startsWith(latinHeading));
  if (i < 0) throw new Error(`row not found: ${latinHeading}`);
  return rs[i];
}

const V = rows(path.join(RENDER, 'vespers.html'));
const L = rows(path.join(RENDER, 'lauds.html'));
const M = rows(path.join(RENDER, 'vigils.html'));

const magRow = findRow(V, 'Canticum: Magnificat');
const benRow = findRow(L, 'Canticum: Benedictus');

const table = {
  'ordinary:vespers-conclusion': { type: 'conclusion', hour: 'vespers', lines: conclusion(...findRow(V, 'Conclusio')) },
  'ordinary:lauds-conclusion':   { type: 'conclusion', hour: 'lauds',   lines: conclusion(...findRow(L, 'Conclusio')) },
  'ordinary:vigils-conclusion':  { type: 'conclusion', hour: 'vigils',  lines: conclusion(...findRow(M, 'Conclusio')) },
  'canticle:magnificat':         Object.assign({ type: 'canticle', name: 'magnificat' }, canticle(magRow[0], magRow[1])),
  'canticle:benedictus':         Object.assign({ type: 'canticle', name: 'benedictus' }, canticle(benRow[0], benRow[1])),
};

const out = {
  _provenance: {
    source: 'DivinumOfficium/divinum-officium',
    method: 'render-as-oracle — perl web/cgi-bin/horas/officium.pl, engine unmodified',
    command: 'version=Rubrics 1960 command=pray{Vesperae,Laudes,Matutinum} date=8-24-2026 lang1=Latin lang2=English',
    extraction: 'block-level tags -> newline; every other tag -> empty string, never a space',
    harvested: '2026-08-25',
    note: 'Not composed. Every string below is lifted from the engine render. '
        + 'Day-proper antiphons are deliberately excluded: the corpus already carries them.',
  },
  ...table,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('wrote ' + path.relative(SP, OUT));
for (const [k, v] of Object.entries(table)) {
  console.log('  ' + k.padEnd(30) + (v.lines ? v.lines.length + ' versicle pairs'
                                             : v.verses.length + ' verses + doxology'));
}
