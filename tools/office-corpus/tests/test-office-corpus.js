// Tests for netlify/functions/office-corpus.js.
//
// Invokes the handler directly against the committed corpus -- no network, no
// Netlify, no deploy. What this cannot prove is the included_files bundling;
// that only shows up on a real deploy.
const fs = require('fs');
const pathMod = require('path');

const FN = pathMod.resolve(__dirname, '../../../netlify/functions/office-corpus.js');
const CORPUS = pathMod.resolve(__dirname, '../../../corpus/traditional');

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

const fn = require(FN);
const I = fn._internals;

const call = (date, hour) =>
  fn.handler({ httpMethod: 'GET', queryStringParameters: { date, hour } })
    .then(r => ({ status: r.statusCode, body: JSON.parse(r.body), headers: r.headers }));

(async () => {
  // ── 1 · validation ────────────────────────────────────────────────────
  console.log('— validation —');
  const bad = [
    ['bogus', 'vespers', 400, 'bad_date'],
    [undefined, 'vespers', 400, 'bad_date'],
    ['2026-08-23', 'vespers', 404, 'outside_window'],   // day before coverage
    ['2029-01-01', 'vespers', 404, 'outside_window'],   // day after coverage
    ['2026-09-01', 'sext', 400, 'bad_hour'],
    ['2026-09-01', 'compline', 404, 'no_traditional_compline'],
  ];
  for (const [date, hour, status, code] of bad) {
    const r = await call(date, hour);
    check(r.status === status && r.body.error === code,
      `${date}/${hour} -> ${status} ${code} (got ${r.status} ${r.body.error})`);
  }

  const compline = await call('2026-09-01', 'compline');
  check(compline.body.detail && compline.body.detail.fallback === 'constants',
    'Compline names the modern fallback so the client never guesses');

  const edges = [['2026-08-24', 'first day of coverage'], ['2028-12-31', 'last day of coverage']];
  for (const [date, label] of edges) {
    const r = await call(date, 'vespers');
    check(r.status === 200, `${label} (${date}) resolves`);
  }

  // ── 2 · a known day ───────────────────────────────────────────────────
  console.log('\n— resolution —');
  const bart = await call('2026-08-24', 'vespers');
  check(bart.status === 200, '2026-08-24 vespers resolves');
  check(bart.body.rite === 'traditional', 'rite is traditional');
  check(bart.body.source === 'corpus', 'source is corpus');
  check(Array.isArray(bart.body.langs) && bart.body.langs.join(',') === 'la,en',
    'both languages are served');
  check(bart.body.office && /Bartholom/i.test(bart.body.office.title || ''),
    `office title is St Bartholomew (got ${bart.body.office && bart.body.office.title})`);
  check(bart.body.office.title === (bart.body.office.title || '').trim(),
    'office title is trimmed (the corpus stores a trailing space)');
  check(bart.headers['X-Corpus-Version'] === I.CORPUS_VERSION, 'corpus version header set');

  // ── 3 · Option A: say which Vespers this is ───────────────────────────
  console.log('\n— Option A labelling —');
  check(bart.body.kind === 'second', 'vespers kind is "second" -- the corpus has no First Vespers');
  check(/^Second Vespers of /.test(bart.body.label || ''),
    `label names the office: "${bart.body.label}"`);
  const laudsLabel = (await call('2026-08-24', 'lauds')).body.label;
  check(/^Lauds of /.test(laudsLabel || ''), `Lauds labelled: "${laudsLabel}"`);

  // Every vespers document in the corpus is Second Vespers. If a regeneration
  // ever adds First Vespers, this fails and the label logic needs revisiting.
  const kinds = new Set();
  for (const dir of fs.readdirSync(pathMod.join(CORPUS, 'propers'))) {
    const f = pathMod.join(CORPUS, 'propers', dir, 'vespers.json');
    if (fs.existsSync(f)) kinds.add(JSON.parse(fs.readFileSync(f, 'utf8')).kind);
  }
  check(kinds.size === 1 && kinds.has('second'),
    `all vespers documents are kind "second" (${[...kinds].join(', ')})`);

  // ── 4 · verse ranges select by bounds ─────────────────────────────────
  console.log('\n— psalm ranges —');
  const store = JSON.parse(fs.readFileSync(pathMod.join(CORPUS, 'store/psalms.json'), 'utf8')).psalms;
  // Ps 9 skips verse 9: 9:8 carries both 8 and 9. A bounds filter must keep it.
  const ps9 = I.selectVerses(store['9'], '2-11');
  check(ps9.length > 0 && ps9.some(v => v.ref === '9:8'),
    'Ps 9 range 2-11 keeps the merged 9:8 (bounds filter, not integer-presence)');
  check(!ps9.some(v => parseInt(v.ref.split(':')[1], 10) > 11),
    'Ps 9 range 2-11 excludes verses past the upper bound');
  check(I.selectVerses(store['9'], null).length === store['9'].verses.length,
    'no range means the whole psalm');

  // ── 5 · nothing dangles, nothing is empty ─────────────────────────────
  console.log('\n— every reference resolves —');
  // Includes the days the conclusion sweep found irregular: the Triduum
  // (conclusion omitted), All Souls (Requiem conclusion), Easter Sunday and
  // the Saturday before Septuagesima (alleluia), 25 April (short form).
  const SAMPLE = ['2026-08-24', '2026-11-02', '2026-11-29', '2026-12-25',
                  '2027-01-23', '2027-03-26', '2027-03-28', '2027-04-25',
                  '2027-05-16', '2028-02-29', '2028-04-14', '2028-12-31'];
  let parts = 0, empties = 0, errors = [];
  for (const date of SAMPLE) {
    for (const hour of I.HOURS) {
      const r = await call(date, hour);
      if (r.status !== 200) { errors.push(`${date}/${hour}: ${r.body.error}`); continue; }
      for (const p of r.body.parts) {
        parts++;
        if (p.type === 'psalmody') {
          for (const it of p.items || []) {
            if (!it.psalm || !it.psalm.verses || !it.psalm.verses.length) empties++;
          }
        }
        if (p.type === 'hymn' && (!p.stanzas)) empties++;
        if (p.type === 'canticle' && !p.canticle) empties++;
        // A conclusion is either present with lines, or explicitly omitted.
        if (p.type === 'conclusion' && !p.omitted && !(p.lines && p.lines.la)) empties++;
      }
    }
  }
  check(errors.length === 0, `all ${SAMPLE.length * 3} sampled day/hours resolve (${errors.join('; ') || 'none failed'})`);
  check(parts > 0, `${parts} parts resolved across the sample`);
  check(empties === 0, `no part came back with an empty body (${empties} empty)`);

  // ── 6 · the textless-ref set is still closed ──────────────────────────
  console.log('\n— the ordinary table stays closed —');
  // Re-derive which refs the corpus names but carries no text for. If a
  // regeneration widens this set, the ordinary table needs a new entry and
  // this test is the thing that says so.
  const textless = new Set();
  for (const dir of fs.readdirSync(pathMod.join(CORPUS, 'propers'))) {
    for (const hour of I.HOURS) {
      const f = pathMod.join(CORPUS, 'propers', dir, `${hour}.json`);
      if (!fs.existsSync(f)) continue;
      for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).parts) {
        if (!p.ref) continue;
        if (p.ref.startsWith('hymn:') || p.ref.startsWith('psalm:')) continue;
        const hasText = (p.text && (p.text.la || p.text.en)) || (p.v && (p.v.la || p.v.en));
        const isMarker = p.type === 'rubric';   // *-incipit: deliberate empty markers
        if (!hasText && !isMarker) textless.add(p.ref);
      }
    }
  }
  const EXPECTED = ['canticle:benedictus', 'canticle:magnificat',
                    'ordinary:lauds-conclusion', 'ordinary:vespers-conclusion',
                    'ordinary:vigils-conclusion'];
  const got = [...textless].sort();
  check(got.length === EXPECTED.length && got.every((r, i) => r === EXPECTED[i]),
    `exactly ${EXPECTED.length} refs need the ordinary table (${got.join(', ')})`);

  const ordinaryFile = pathMod.join(CORPUS, 'store/ordinary.json');
  check(fs.existsSync(ordinaryFile), 'store/ordinary.json is present');
  if (fs.existsSync(ordinaryFile)) {
    const ord = JSON.parse(fs.readFileSync(ordinaryFile, 'utf8'));
    check(!!ord._provenance && /render/i.test(ord._provenance.method || ''),
      'ordinary.json records that it was harvested from the render, not composed');
    for (const ref of EXPECTED) {
      check(!!(ord[ref] || (ord.conclusions && ord.conclusions.refs && ord.conclusions.refs[ref])),
        `ordinary table carries ${ref}`);
    }
  }

  // ── 7 · the conclusion is seasonal, and the irregular days are right ──
  console.log('\n— seasonal conclusions —');
  const conclusionOf = async (date, hour) => {
    const r = await call(date, hour);
    return (r.body.parts || []).find(p => p.type === 'conclusion') || null;
  };
  const text = c => c && c.lines ? c.lines.la.join(' ') : '';

  const ordinary = await conclusionOf('2026-09-01', 'vespers');
  check(/Benedicámus Dómino\./.test(text(ordinary)), 'an ordinary day gets the plain Benedicámus');

  const easter = await conclusionOf('2027-03-28', 'vespers');
  check(/allelúia, allelúia/.test(text(easter)), 'Easter Sunday Vespers takes the double alleluia');

  const easterVigils = await conclusionOf('2027-03-28', 'vigils');
  check(!/allelúia/.test(text(easterVigils)), 'Matins never takes the alleluia, even at Easter');

  const farewell = await conclusionOf('2027-01-23', 'vespers');
  check(/allelúia, allelúia/.test(text(farewell)),
    'Saturday before Septuagesima takes the alleluia farewell at Vespers');
  const farewellLauds = await conclusionOf('2027-01-23', 'lauds');
  check(!/allelúia/.test(text(farewellLauds)), '...but not at Lauds that morning');

  const allSouls = await conclusionOf('2026-11-02', 'vespers');
  check(/Réquiem ætérnam/.test(text(allSouls)), 'All Souls gets the Requiem conclusion');

  // The engine renders "Conclusio{omittitur}" on the Triduum and the corpus
  // agrees by carrying no conclusion part at all -- the two are consistent, so
  // nothing has to be suppressed at render time.
  const triduum = await conclusionOf('2027-03-26', 'vespers');
  check(triduum === null, 'the Triduum office carries no conclusion part');
  const triduumSweep = JSON.parse(
    fs.readFileSync(pathMod.join(CORPUS, 'store/ordinary.json'), 'utf8')).conclusions;
  const idx = triduumSweep.days['2027-03-26'].vespers;
  check(triduumSweep.variants[idx] && triduumSweep.variants[idx].omitted === true,
    'and the harvested table records that day as Conclusio{omittitur}');

  console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
