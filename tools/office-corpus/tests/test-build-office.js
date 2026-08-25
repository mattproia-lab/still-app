// Characterisation test for the buildOffice split.
//
// The split must not change behaviour, so this pins today's behaviour exactly:
// it runs the real renderOfficeHour() and the four play*Audio() builders under
// a frozen clock across a matrix of dates and hours, and stores the resulting
// HTML and audio text as a golden file.
//
//   PART 1  runs now and forever after. Any byte that changes fails it.
//   PART 2  activates the moment buildOffice() exists in index.html. It asserts
//           the doc shape, and that renderOfficeHTML(doc) / renderOfficeText(doc)
//           reproduce PART 1's goldens exactly.
//
// Everything is extracted from index.html by source anchor, never copied, so
// the test cannot drift from shipped code and cannot survive a rename silently.
const fs = require('fs');
const pathMod = require('path');
const INDEX = pathMod.resolve(__dirname, '../../../index.html');
const GOLDEN = pathMod.resolve(__dirname, 'golden/modern-office.json');

const L = fs.readFileSync(INDEX, 'utf8').split(/\r?\n/);
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

// ---------------------------------------------------------------- extraction
function extractFn(name, optional) {
  const re = new RegExp(`^(async )?function ${name}\\s*\\(`);
  const s = L.findIndex(l => re.test(l));
  if (s < 0) { if (optional) return null; throw new Error(`function ${name} not found`); }
  for (let i = s + 1; i < L.length; i++) if (L[i] === '}') return L.slice(s, i + 1).join('\n');
  throw new Error(`unclosed function ${name}`);
}
function extractLine(prefix) {
  const i = L.findIndex(l => l.startsWith(prefix));
  if (i < 0) throw new Error(`line not found: ${prefix}`);
  return L[i];
}
function extractBlock(startPrefix, endPrefix) {
  const s = L.findIndex(l => l.startsWith(startPrefix));
  const e = L.findIndex(l => l.startsWith(endPrefix));
  if (s < 0 || e < 0 || e < s) throw new Error(`block not found: ${startPrefix} .. ${endPrefix}`);
  return L.slice(s, e + 1).join('\n');
}

const REQUIRED = ['getLiturgicalSeason', 'getEaster', 'getAshWednesday', 'getPsalmWeek',
                  'hashText', 'paceOfficeText', 'requestOfficeAudio', 'getLiturgicalRite',
                  'playVigilsAudio', 'playLaudsAudio', 'playVespersAudio', 'playComplineAudio',
                  'renderOfficeHour'];
const SPLIT_FNS = ['buildOffice', 'renderOfficeHTML', 'renderOfficeText'];

const src = [
  extractLine('const PSALTER_ROLL_HOUR'),
  extractLine('const PSALTER_ANCHOR_MS'),
  // The split routes every render through the rite setting, so the harness has
  // to carry it. The stub localStorage returns null, which is 'modern'.
  extractLine('const RITE_KEY'),
  extractLine('const RITES'),
  extractBlock('const OFFICE_SEASONS', 'const TE_DEUM'),
  ...REQUIRED.map(n => extractFn(n)),
  ...SPLIT_FNS.map(n => extractFn(n, true)).filter(Boolean),
].join('\n\n');

const splitExists = SPLIT_FNS.every(n => extractFn(n, true) !== null);

// ------------------------------------------------------------------ sandbox
function load(frozenMs, saint) {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(frozenMs); else super(...a); }
    static now() { return frozenMs; }
  }
  const card = { innerHTML: '' };
  const els = {};
  const document = {
    getElementById: id => {
      if (id === 'officeCard') return card;
      if (!els[id]) els[id] = { textContent: '', disabled: false, style: {} };
      return els[id];
    },
  };
  const audio = [];
  // Capture at the NETWORK boundary, not at requestOfficeAudio: playVigilsAudio
  // does not use that helper -- it has its own inline fetch. The POST body is
  // the one place all four hours converge, so it is the honest thing to pin.
  const fetchStub = (url, opts) => {
    opts = opts || {};
    if (opts.body) { try { audio.push(JSON.parse(opts.body)); } catch (e) { /* not ours */ } }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ cached: true, url: 'test://audio' }) });
  };
  const factory = new Function(
    'Date', 'document', 'localStorage', 'getTodaysSaint', 'console', 'fetch', 'playVoiceUrl',
    '__audio',
    src +
    '\nreturn { renderOfficeHour, playVigilsAudio, playLaudsAudio, playVespersAudio,' +
    '\n         playComplineAudio, getLiturgicalSeason, getPsalmWeek,' +
    '\n         buildOffice: typeof buildOffice === "function" ? buildOffice : null,' +
    '\n         renderOfficeHTML: typeof renderOfficeHTML === "function" ? renderOfficeHTML : null,' +
    '\n         renderOfficeText: typeof renderOfficeText === "function" ? renderOfficeText : null };'
  );
  const api = factory(
    FakeDate, document,
    { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    () => saint || null,
    { warn: () => {}, error: () => {}, log: () => {} },
    fetchStub,
    () => {},
    audio
  );
  return { api, card, audio };
}

// -------------------------------------------------------------------- matrix
const at = (y, m1, d, h = 12) => new Date(y, m1 - 1, d, h, 0, 0, 0).getTime();
const SOLEMNITY = { name: 'Test Solemnity', rank: 'solemnity' };

const CASES = [
  { id: 'ordinary-mon',      ms: at(2026,  8, 24), saint: null },
  { id: 'ordinary-sun',      ms: at(2026,  8, 23), saint: null },       // Sunday -> Te Deum
  { id: 'ordinary-solemnity',ms: at(2026,  8, 25), saint: SOLEMNITY },  // Tue + solemnity
  { id: 'advent-sun',        ms: at(2026, 11, 29), saint: null },       // psalter week 1
  { id: 'advent-wed',        ms: at(2026, 12,  2), saint: null },
  { id: 'christmas-fri',     ms: at(2026, 12, 25), saint: null },
  { id: 'lent-sun',          ms: at(2026,  3,  1), saint: null },
  { id: 'lent-thu',          ms: at(2026,  2, 19), saint: null },
  { id: 'easter-sun',        ms: at(2026,  4,  5), saint: null },
  { id: 'easter-tue',        ms: at(2026,  4,  7), saint: null },
];
const HOURS = ['vigils', 'lauds', 'vespers', 'compline'];
const PLAY = { vigils: 'playVigilsAudio', lauds: 'playLaudsAudio',
               vespers: 'playVespersAudio', compline: 'playComplineAudio' };

// ------------------------------------------------------- PART 1: golden capture
async function capture() {
  const out = {};
  for (const c of CASES) {
    for (const hour of HOURS) {
      const { api, card, audio } = load(c.ms, c.saint);
      api.renderOfficeHour(hour);
      await api[PLAY[hour]]();
      out[`${c.id}/${hour}`] = {
        season:   api.getLiturgicalSeason(),
        psalmWeek: api.getPsalmWeek(),
        html:     card.innerHTML,
        audioText: audio[0] ? audio[0].text : null,
        cacheKey:  audio[0] ? audio[0].cacheKey : null,
      };
    }
  }
  return out;
}

(async () => {
  const current = await capture();
  const keys = Object.keys(current);

  console.log(`— PART 1: characterisation (${keys.length} case/hour combinations) —`);

  if (!fs.existsSync(GOLDEN)) {
    fs.mkdirSync(pathMod.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 1));
    console.log(`BASELINE  captured ${keys.length} goldens -> ${pathMod.relative(process.cwd(), GOLDEN)}`);
    console.log('BASELINE  re-run to compare against it');
  } else {
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    const gk = Object.keys(golden);
    check(gk.length === keys.length, `golden covers the same ${keys.length} combinations`);
    let diffs = 0;
    for (const k of keys) {
      const g = golden[k], c = current[k];
      if (!g) { console.log(`FAIL  ${k}: missing from golden`); diffs++; continue; }
      for (const field of ['season', 'psalmWeek', 'html', 'audioText', 'cacheKey']) {
        if (JSON.stringify(g[field]) !== JSON.stringify(c[field])) {
          console.log(`FAIL  ${k}: ${field} changed`);
          if (field === 'html' || field === 'audioText') {
            const a = String(g[field] || ''), b = String(c[field] || '');
            let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
            console.log(`        first difference at char ${i}`);
            console.log(`        golden:  …${a.slice(Math.max(0, i - 40), i + 60)}`);
            console.log(`        current: …${b.slice(Math.max(0, i - 40), i + 60)}`);
          } else {
            console.log(`        golden ${JSON.stringify(g[field])} -> current ${JSON.stringify(c[field])}`);
          }
          diffs++;
        }
      }
    }
    check(diffs === 0, `all ${keys.length} combinations byte-identical to golden`);
  }

  // Sanity: the goldens must actually contain an office, or this test proves nothing.
  const sample = current['ordinary-mon/vespers'];
  check(!!sample && sample.html.length > 2000, 'captured HTML is substantial (not an empty render)');
  check(!!sample && /Magnificat/.test(sample.html), 'captured Vespers HTML contains the Magnificat');
  check(!!sample && sample.audioText && sample.audioText.length > 1000, 'captured audio text is substantial');
  check(!!sample && /^[0-9a-z]{1,8}$/.test(sample.cacheKey || ''),
        'cache key is a hashText() digest');
  // Every hour must have reached the network boundary -- Vigils takes a different
  // route to it than the other three, so a null here means Vigils went uncaptured.
  const noAudio = keys.filter(k => !current[k].audioText);
  check(noAudio.length === 0, `all ${keys.length} combinations captured audio text (missing: ${noAudio.join(', ') || 'none'})`);
  check(!!current['ordinary-mon/vigils'].audioText, 'Vigils audio captured despite bypassing requestOfficeAudio');

  // ------------------------------------------------- PART 2: the doc contract
  console.log('\n— PART 2: buildOffice contract —');
  if (!splitExists) {
    console.log('PENDING  buildOffice / renderOfficeHTML / renderOfficeText not present yet.');
    console.log('PENDING  These assertions activate automatically once the split lands.');
  } else {
    for (const c of CASES.slice(0, 3)) {
      for (const hour of HOURS) {
        const key = `${c.id}/${hour}`;
        const { api } = load(c.ms, c.saint);
        const doc = await api.buildOffice(hour, 'modern', new Date(c.ms));

        // --- shape ---
        check(doc && typeof doc === 'object', `${key}: buildOffice returns an object`);
        check(doc.hour === hour, `${key}: doc.hour is the requested hour`);
        check(doc.rite === 'modern', `${key}: doc.rite is 'modern'`);
        check(/^\d{4}-\d{2}-\d{2}$/.test(doc.date), `${key}: doc.date is an ISO date`);
        check(typeof doc.title === 'string' && doc.title.length > 0, `${key}: doc.title present`);
        check(doc.source === 'constants', `${key}: doc.source is 'constants' for modern`);
        check(Array.isArray(doc.langs) && doc.langs.includes('en'), `${key}: doc.langs includes en`);
        check(typeof doc.cacheKey === 'string' && doc.cacheKey.length > 0, `${key}: doc.cacheKey present`);
        check(Array.isArray(doc.parts) && doc.parts.length > 0, `${key}: doc.parts is a non-empty array`);

        // every part is well formed and audio-classified
        const bad = (doc.parts || []).filter(p =>
          !p || typeof p.type !== 'string' || !['speak', 'skip'].includes(p.audio));
        check(bad.length === 0, `${key}: every part has a type and audio of speak|skip`);

        // --- equivalence with PART 1 ---
        const g = (fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : current)[key];
        check(api.renderOfficeHTML(doc) === g.html,
              `${key}: renderOfficeHTML(doc) reproduces the golden HTML exactly`);
        check(api.renderOfficeText(doc) === g.audioText,
              `${key}: renderOfficeText(doc) reproduces the golden audio text exactly`);
        check(doc.cacheKey === g.cacheKey, `${key}: doc.cacheKey matches the golden cache key`);
      }
    }
  }

  console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
