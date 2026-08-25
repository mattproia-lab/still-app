// The traditional branch of buildOffice().
//
// Feeds real resolved corpus documents -- produced by invoking the actual
// office-corpus function against the committed corpus -- through
// buildTraditionalOffice() and the two renderers. Functions are extracted from
// index.html by source anchor, never copied, so this cannot drift.
//
// The modern rite's byte-for-byte behaviour is test-build-office.js's job.
// This file only covers the traditional path.
const fs = require('fs');
const pathMod = require('path');

const REPO = pathMod.resolve(__dirname, '../../..');
const INDEX = pathMod.join(REPO, 'index.html');
const L = fs.readFileSync(INDEX, 'utf8').split(/\r?\n/);

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

function extractFn(name) {
  const a = 'function ' + name + '(', b = 'async function ' + name + '(';
  const s = L.findIndex(l => l.startsWith(a) || l.startsWith(b));
  if (s < 0) throw new Error(`function ${name} not found`);
  for (let i = s + 1; i < L.length; i++) if (L[i] === '}') return L.slice(s, i + 1).join('\n');
  throw new Error(`unclosed function ${name}`);
}
function extractLine(prefix) {
  const l = L.find(x => x.startsWith(prefix));
  if (!l) throw new Error(`line not found: ${prefix}`);
  return l;
}

const src = [
  extractLine('const OFFICE_CORPUS_ENDPOINT'),
  extractLine('const OFFICE_CORPUS_KEY'),
  extractLine('const OFFICE_CORPUS_MAX'),
  extractLine('const officeCorpus '),
  extractLine('const officeCorpusPending'),
  extractFn('hashText'),
  extractFn('paceOfficeText'),
  extractFn('buildTraditionalOffice'),
  extractFn('buildPendingOffice'),
  extractFn('renderOfficeHTML'),
  extractFn('renderOfficeText'),
  extractLine('const OFFICE_TTS_MAX'),
  extractFn('splitOfficeText'),
].join('\n\n');

const api = new Function('localStorage', 'console', 'window', 'document',
  src + '\nreturn { buildTraditionalOffice, buildPendingOffice, renderOfficeHTML, renderOfficeText,'
      + '\n         splitOfficeText, OFFICE_TTS_MAX };')(
  { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  { warn: () => {}, error: () => {}, log: () => {} },
  {}, { getElementById: () => null });

const corpusFn = require(pathMod.join(REPO, 'netlify/functions/office-corpus.js'));
const resolve = (date, hour) =>
  corpusFn.handler({ httpMethod: 'GET', queryStringParameters: { date, hour } })
    .then(r => ({ status: r.statusCode, doc: JSON.parse(r.body) }));

// What the voice service accepts in one request. Nothing that goes on the wire
// may reach it -- a whole office routinely would, which is why the spoken text
// is chunked before it is sent.
const TTS_HARD_LIMIT = 5000;

// 2026-08-24 St Bartholomew (II. classis), 2027-03-28 Easter Sunday (alleluia
// conclusion), 2026-11-02 All Souls (Requiem conclusion), 2027-03-26 Triduum.
const CASES = [
  ['2026-08-24', 'vespers'], ['2026-08-24', 'lauds'], ['2026-08-24', 'vigils'],
  ['2027-03-28', 'vespers'], ['2026-11-02', 'lauds'], ['2027-03-26', 'vespers'],
];

(async () => {
  console.log('— doc shape —');
  for (const [date, hour] of CASES) {
    const { status, doc: corpus } = await resolve(date, hour);
    if (status !== 200) { check(false, `${date}/${hour}: corpus resolved (${corpus.error})`); continue; }

    const doc = api.buildTraditionalOffice(corpus, hour, date, 'traditional');
    const key = `${date}/${hour}`;

    check(doc.rite === 'traditional', `${key}: rite is traditional`);
    check(doc.source === 'corpus', `${key}: source is corpus`);
    check(doc.langs.join(',') === 'la,en', `${key}: langs are la,en`);
    check(doc.date === date, `${key}: date carried through`);
    check(typeof doc.cacheKey === 'string' && doc.cacheKey.length > 0, `${key}: cacheKey present`);
    check(Array.isArray(doc.parts) && doc.parts.length > 10, `${key}: ${doc.parts.length} parts`);
    check(doc.parts.every(p => p.type && ['speak', 'skip'].includes(p.audio)),
      `${key}: every part has a type and audio of speak|skip`);
    check(!doc.parts.some(p => p.text === undefined && !['divider', 'nav'].includes(p.type)),
      `${key}: no part is missing its text`);

    // ── the paired-language contract ──
    const latin = doc.parts.filter(p => p.style && p.style.indexOf('200,146,12') >= 0);
    check(latin.length > 0, `${key}: ${latin.length} Latin blocks on screen`);
    check(latin.every(p => p.audio === 'skip'), `${key}: every Latin block is silent`);
    // Exact, not heuristic -- "alleluia" and "Lord" are English words too.
    const latinText = new Set(latin.map(p => p.text));
    const spoken = doc.parts.filter(p => p.audio === 'speak' && latinText.has(p.speak));
    check(spoken.length === 0, `${key}: no Latin block is also spoken`);

    // ── renderers ──
    const html = api.renderOfficeHTML(doc);
    const text = api.renderOfficeText(doc);
    check(html.length > 2000, `${key}: html renders (${(html.length / 1024).toFixed(1)} KB)`);
    check(text.length > 500, `${key}: audio text renders (${(text.length / 1024).toFixed(1)} KB)`);
    check(/[àáâãäèéêëìíîïòóôõöùúûüæœǽ]/i.test(html), `${key}: html carries accented Latin`);
    check(html.indexOf('undefined') < 0, `${key}: no "undefined" leaked into the html`);
    check(text.indexOf('undefined') < 0, `${key}: no "undefined" leaked into the audio text`);

    // -- what actually goes on the wire --
    const chunks = api.splitOfficeText(text);
    const longest = chunks.reduce((n, c) => Math.max(n, c.length), 0);
    check(chunks.length > 0, `${key}: splits into ${chunks.length} chunk(s)`);
    check(chunks.every(c => c.length < TTS_HARD_LIMIT),
      `${key}: no chunk reaches ${TTS_HARD_LIMIT} chars (longest ${longest})`);
    check(chunks.join('') === text, `${key}: the chunks rejoin into the spoken text exactly`);
    console.log('');
  }

  console.log('— Option A labelling —');
  const { doc: vespCorpus } = await resolve('2026-08-24', 'vespers');
  const vesp = api.buildTraditionalOffice(vespCorpus, 'vespers', '2026-08-24', 'traditional');
  check(/^Second Vespers of /.test(vesp.label || ''), `label: "${vesp.label}"`);
  check(api.renderOfficeHTML(vesp).indexOf(vesp.label) >= 0, 'the label reaches the screen');

  console.log('\n— the audio button —');
  for (const hour of ['vespers', 'lauds', 'vigils']) {
    const { doc: c } = await resolve('2026-08-24', hour);
    const d = api.buildTraditionalOffice(c, hour, '2026-08-24', 'traditional');
    const buttons = d.parts.filter(p => p.type === 'button');
    const notes = d.parts.filter(p => p.type === 'note');
    const html = api.renderOfficeHTML(d);
    if (hour === 'vigils') {
      check(buttons.length === 0, 'vigils: no Hear button is offered');
      check(notes.length === 1 && notes[0].text === 'Audio for Vigils coming soon.',
        'vigils: the note stands where the button would be');
      check(notes.every(n => n.audio === 'skip'), 'vigils: the note is not spoken');
      check(html.indexOf('Audio for Vigils coming soon.') >= 0, 'vigils: the note reaches the screen');
      check(html.indexOf('vigilsPlayBtn') < 0, 'vigils: no play button in the html');
    } else {
      const player = hour === 'lauds' ? 'playLaudsAudio()' : 'playVespersAudio()';
      check(buttons.length === 1 && buttons[0].id === `${hour}PlayBtn`, `${hour}: keeps its Hear button`);
      check(html.indexOf(player) >= 0, `${hour}: the button calls ${player}`);
      check(notes.length === 0, `${hour}: no "coming soon" note`);
    }
  }

  console.log('\n— the chunker —');
  check(api.OFFICE_TTS_MAX < TTS_HARD_LIMIT,
    `the chunk ceiling (${api.OFFICE_TTS_MAX}) sits under the service limit (${TTS_HARD_LIMIT})`);
  check(api.splitOfficeText('').length === 0, 'empty text yields no chunks');
  check(api.splitOfficeText('short').length === 1, 'a short text stays one chunk');
  // A section with no seam in it still has to be cut somewhere.
  const wall = 'x'.repeat(12000);
  const wallChunks = api.splitOfficeText(wall);
  check(wallChunks.every(c => c.length < TTS_HARD_LIMIT) && wallChunks.join('') === wall,
    `a seamless ${wall.length}-char section is forced into ${wallChunks.length} chunks anyway`);

  console.log('\n— pending and failure states —');
  const pending = api.buildPendingOffice('vespers', '2026-08-24', 'traditional', null);
  check(pending.source === 'pending', 'a cache miss yields source "pending"');
  check(pending.parts.length > 0 && api.renderOfficeHTML(pending).length > 200,
    'the pending doc still renders a card');
  const failed = api.buildPendingOffice('vespers', '2026-08-24', 'traditional', 'unreachable');
  check(failed.source === 'unavailable', 'a failed fetch yields source "unavailable"');
  check(api.renderOfficeHTML(failed).indexOf('modern calendar') >= 0,
    'the failure card tells the user how to get an office');

  console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
