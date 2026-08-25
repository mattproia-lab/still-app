// Combine the two harvests into corpus/traditional/store/ordinary.json:
//   ordinary.json   the two Gospel canticles (fixed text)
//   conclusions.json the three hour conclusions, per day per hour
//
// Both come from the Divinum Officium render. Nothing here composes text.
const fs = require('fs');
const path = require('path');

const SP = __dirname;
// Destination is given on the command line; see README.
const OUT = process.argv[2] || path.resolve(SP, '../../../corpus/traditional/store/ordinary.json');

const canticles = JSON.parse(fs.readFileSync(path.join(SP, 'ordinary.json'), 'utf8'));
const sweep = JSON.parse(fs.readFileSync(path.join(SP, 'conclusions.json'), 'utf8'));

const table = {
  _provenance: {
    source: 'DivinumOfficium/divinum-officium (MIT — see vault decision record 2026-08-23)',
    method: 'render-as-oracle: perl web/cgi-bin/horas/officium.pl, engine unmodified',
    extraction: 'block-level tags -> newline; every other tag -> empty string, never a space',
    verification:
      '209/252 verse strings extracted from the same renders are byte-identical to '
      + 'store/psalms.json. The rest are the two Gospel canticles (absent from the store '
      + '— the gap this file fills) and DO duplicate-numbered psalm incipit lines.',
    harvested: '2026-08-25',
    note: 'Generated. Do not hand-edit. Every string is lifted from the engine render; '
        + 'none is composed. Day-proper antiphons are excluded — the corpus carries those.',
  },

  'canticle:magnificat': canticles['canticle:magnificat'],
  'canticle:benedictus': canticles['canticle:benedictus'],

  conclusions: {
    note: 'The conclusion is not invariant: in Paschaltide Lauds and Vespers take '
        + '"Benedicámus Dómino, allelúia, allelúia" and Matins does not. Every day in '
        + 'the coverage window was rendered rather than deriving a rubric rule.',
    window: sweep._provenance.window,
    refs: {
      'ordinary:vigils-conclusion': 'vigils',
      'ordinary:lauds-conclusion': 'lauds',
      'ordinary:vespers-conclusion': 'vespers',
    },
    // The engine renders "Conclusio{omittitur}" on the Triduum -- the hours end
    // without a conclusion. Kept as an explicit flag, not an empty list, so the
    // screen skips the section deliberately and nobody later "fixes" a blank.
    variants: sweep.variants.map(v =>
      (v.la.length === 0 && v.en.length === 0)
        ? { omitted: true, marker: 'Conclusio{omittitur}',
            note: 'the Sacred Triduum omits the conclusion' }
        : v),
    days: sweep.days,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(table, null, 1));

const bytes = fs.statSync(OUT).size;
console.log(`wrote ${OUT}  (${(bytes / 1024).toFixed(1)} KB)`);
console.log(`  canticles:  magnificat ${table['canticle:magnificat'].verses.length} verses, `
          + `benedictus ${table['canticle:benedictus'].verses.length} verses`);
console.log(`  conclusions: ${sweep.variants.length} distinct variants across `
          + `${Object.keys(sweep.days).length} days`);
sweep.variants.forEach((v, i) => console.log(`    [${i}] ${v.la.join(' | ')}`));
