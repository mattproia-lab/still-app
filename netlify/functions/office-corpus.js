// Serves one resolved hour of the traditional Office (Rubrics 1960).
//
// Takes a date and an hour, resolves them against the generated corpus under
// corpus/traditional/, inlines every psalm verse and hymn stanza the hour
// refers to, and returns one self-contained document. The client never sees a
// "psalm:109" it has to go and dereference.
//
// The corpus reaches this function through included_files in netlify.toml, not
// over HTTP -- /corpus/* is a forced 404 and stays that way.
//
// Spec: the Office Corpus Endpoint record, 2026-08-25.
'use strict';

const fs = require('fs');
const path = require('path');

// Two layouts, one function. In the repo the corpus sits two levels up from
// netlify/functions/; in the deployed bundle esbuild flattens this file to the
// task root and included_files land beside it, relative to the base directory.
// Probe rather than assume -- the deployed layout cannot be verified locally.
const ROOT = [
  path.join(__dirname, '../../corpus/traditional'),
  path.join(process.cwd(), 'corpus/traditional'),
  path.join(__dirname, 'corpus/traditional'),
].find(dir => fs.existsSync(path.join(dir, 'calendar-index.json')))
  || path.join(__dirname, '../../corpus/traditional');

const WINDOW = { first: '2026-08-24', last: '2028-12-31' };   // 861 days
const HOURS = ['vigils', 'lauds', 'vespers'];                 // the corpus has no Compline
const FORM = 'full';                                          // the only form generated
const CORPUS_VERSION = '2026-08-24';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── warm-invocation memo ────────────────────────────────────────────────
// 1.1 MB of JSON that would otherwise be parsed on every invocation. Warm
// Lambdas keep it; rss-proxy.js uses the same module-scope pattern.
let _index = null;
let _store = null;
let _ordinary = null;
const _calendars = new Map();
const _propers = new Map();
const PROPER_CACHE_MAX = 64;

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadIndex() {
  if (!_index) _index = readJSON(path.join(ROOT, 'calendar-index.json'));
  return _index;
}

function loadStore() {
  if (!_store) {
    _store = {
      psalms: readJSON(path.join(ROOT, 'store/psalms.json')).psalms,
      hymns: readJSON(path.join(ROOT, 'store/hymns.json')),
    };
  }
  return _store;
}

// The texts the corpus names but does not carry: the three hour conclusions
// and the two Gospel canticles. Harvested from the Divinum Officium render,
// never composed -- see corpus/traditional/store/ordinary.json.
function loadOrdinary() {
  if (!_ordinary) _ordinary = readJSON(path.join(ROOT, 'store/ordinary.json'));
  return _ordinary;
}

function loadCalendar(year) {
  if (!_calendars.has(year)) {
    _calendars.set(year, readJSON(path.join(ROOT, `calendar/${year}.json`)));
  }
  return _calendars.get(year);
}

function loadProper(key, hour) {
  const id = `${key}/${hour}`;
  if (_propers.has(id)) return _propers.get(id);
  const file = path.join(ROOT, 'propers', key, `${hour}.json`);
  let doc;
  try {
    doc = readJSON(file);
  } catch (err) {
    // The calendar pointed at this file. Its absence is corruption, not a 404.
    throw new HttpError(500, 'corpus_corrupt',
      `calendar names ${id} but the proper could not be read`, { proper: id });
  }
  if (_propers.size >= PROPER_CACHE_MAX) _propers.delete(_propers.keys().next().value);
  _propers.set(id, doc);
  return doc;
}

// ── errors carry a code so the client branches on a string, not a status ──
class HttpError extends Error {
  constructor(status, code, message, detail) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail || null;
  }
}

// ── 1 · validate ────────────────────────────────────────────────────────
function validate(date, hour) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'bad_date', 'date must be YYYY-MM-DD', { got: date || null });
  }
  if (date < WINDOW.first || date > WINDOW.last) {
    throw new HttpError(404, 'outside_window',
      'the traditional corpus does not cover that date', { window: WINDOW });
  }
  if (hour === 'compline') {
    // Never generated: the rebuild plan scoped the corpus to three hours.
    throw new HttpError(404, 'no_traditional_compline',
      'the traditional corpus has no Compline; the modern constants supply it',
      { fallback: 'constants' });
  }
  if (!HOURS.includes(hour)) {
    throw new HttpError(400, 'bad_hour', `hour must be one of ${HOURS.join(', ')}`,
      { got: hour || null });
  }
}

// ── 2-4 · which office is this ──────────────────────────────────────────
function resolveOffice(date, hour) {
  const year = date.slice(0, 4);
  let calendar;
  try {
    calendar = loadCalendar(year);
  } catch (err) {
    throw new HttpError(404, 'no_office', `no calendar for ${year}`, { year });
  }
  const day = calendar.days && calendar.days[date];
  const pointer = day && day[hour];
  if (!pointer) {
    throw new HttpError(404, 'no_office', `the calendar has no ${hour} for ${date}`, { date, hour });
  }
  const key = String(pointer).split('/')[0];
  return { key, proper: loadProper(key, hour) };
}

function dayIdentity(date) {
  const entry = (loadIndex().days || {})[date] || {};
  return {
    key: entry.key || null,
    // Corpus titles carry a trailing space.
    title: (entry.title || '').trim() || null,
    rank: entry.rank || null,
    commemorations: entry.commemorations || [],
    vespera: entry.vespera || null,
    weekday: entry.weekday || null,
  };
}

// ── 5 · inline every reference ──────────────────────────────────────────

// Range filter. Selects by BOUNDS, never by requiring each verse number to be
// present: the store merges some verse pairs under the lower number (Ps 9 runs
// 9:7, 9:8, 9:10 -- 9:8 carries both 8 and 9). Asking for every integer would
// reject 488 legitimate ranges.
function selectVerses(record, range) {
  if (!range) return record.verses;
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(range));
  if (!m) return record.verses;
  const lo = Number(m[1]), hi = Number(m[2]);
  return record.verses.filter(v => {
    const n = parseInt(String(v.ref).split(':')[1], 10);
    return n >= lo && n <= hi;
  });
}

function resolvePsalm(psalm) {
  const num = String(psalm.ref).replace(/^psalm:/, '');
  const record = loadStore().psalms[num];
  if (!record) {
    throw new HttpError(500, 'dangling_ref', `psalm not in store: ${psalm.ref}`, { ref: psalm.ref });
  }
  const verses = selectVerses(record, psalm.verses);
  if (!verses.length) {
    // A silently empty psalm still looks like an office. Never emit one.
    throw new HttpError(500, 'empty_psalm',
      `${psalm.ref} range ${psalm.verses} selected no verses`, { ref: psalm.ref, verses: psalm.verses });
  }
  return {
    ref: psalm.ref,
    kind: record.kind || 'psalm',
    citation: psalm.citation || null,
    canticle: psalm.canticle || null,
    range: psalm.verses || null,
    verses,
  };
}

function resolveHymn(ref) {
  // Hymn store keys keep the "hymn:" prefix.
  const stanzas = loadStore().hymns[ref];
  if (!stanzas) {
    throw new HttpError(500, 'dangling_ref', `hymn not in store: ${ref}`, { ref });
  }
  return stanzas;
}

// The Gospel canticles are fixed. The conclusions are NOT: in Paschaltide
// Lauds and Vespers take "Benedicámus Dómino, allelúia, allelúia" and Matins
// does not. Rather than encode a rubric rule, the table carries the engine's
// own answer for every day in the window, and this looks it up.
function resolveOrdinary(ref, hour, date) {
  const table = loadOrdinary();

  if (ref.startsWith('canticle:')) {
    const entry = table[ref];
    if (!entry) throw new HttpError(500, 'dangling_ref', `canticle not available: ${ref}`, { ref });
    return entry;
  }

  const conclusions = table.conclusions || {};
  const slot = (conclusions.refs || {})[ref];
  if (!slot) {
    throw new HttpError(500, 'dangling_ref', `ordinary text not available: ${ref}`, { ref });
  }
  const day = (conclusions.days || {})[date];
  const idx = day && day[slot];
  if (idx === undefined || idx === null) {
    throw new HttpError(500, 'dangling_ref',
      `no conclusion recorded for ${date} ${slot}`, { ref, date, hour: slot });
  }
  const variant = (conclusions.variants || [])[idx];
  if (!variant) {
    throw new HttpError(500, 'dangling_ref',
      `conclusion variant ${idx} missing`, { ref, date, variant: idx });
  }
  return variant;
}

function keepForm(part) {
  return !part.forms || part.forms.includes(FORM);
}

function resolveParts(parts, hour, date) {
  const out = [];
  for (const part of parts || []) {
    if (!keepForm(part)) continue;
    const resolved = Object.assign({}, part);

    if (part.type === 'psalmody') {
      resolved.items = (part.items || []).map(item => Object.assign({}, item, {
        psalm: resolvePsalm(item.psalm),
      }));
    } else if (part.type === 'hymn' && part.ref) {
      resolved.stanzas = resolveHymn(part.ref);
    } else if (part.type === 'canticle' && part.ref) {
      // The corpus carries the day's antiphon but not the canticle itself.
      resolved.canticle = resolveOrdinary(part.ref, hour);
    } else if (part.type === 'conclusion' && part.ref) {
      const variant = resolveOrdinary(part.ref, hour, date);
      if (variant.omitted) {
        // The Sacred Triduum ends the hours without a conclusion. Say so
        // explicitly rather than emitting an empty list the screen might paint
        // as a blank section.
        resolved.omitted = true;
        resolved.note = variant.note || null;
      } else {
        resolved.lines = variant.la ? variant : variant.lines;
      }
    }

    out.push(resolved);
  }
  return out;
}

// ── Option A · name what is actually being served ───────────────────────
// Traditional Vespers on the evening of day N is frequently First Vespers of
// day N+1, and the corpus has no First Vespers text -- every vespers document
// is kind "second". Rather than silently serve the wrong office, the label
// says which office this is so a reader with traditional formation can see it.
//
// TODO — English office titles. `title` comes from the corpus, which carries
// only the Latin: "Second Vespers of S. Bartholomæi Apostoli". The genitive is
// correct Latin but reads awkwardly inside an English sentence. Using it as-is
// is deliberate: a hand-translated English title would be a guess, and wrong
// English is worse than correct Latin in the rite whose point is fidelity.
// Fixing this properly means English titles in the corpus (a generator change),
// not a translation table here.
function officeLabel(hour, kind, title) {
  if (!title) return null;
  if (hour === 'vespers') return `${kind === 'first' ? 'First' : 'Second'} Vespers of ${title}`;
  if (hour === 'lauds') return `Lauds of ${title}`;
  return `Matins of ${title}`;
}

// ── entry ───────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const q = event.queryStringParameters || {};
  const date = q.date;
  const hour = q.hour;

  try {
    validate(date, hour);

    const { key, proper } = resolveOffice(date, hour);
    const identity = dayIdentity(date);
    const kind = proper.kind || null;

    const payload = {
      rite: 'traditional',
      date,
      hour,
      kind,
      office: Object.assign({}, identity, { key: identity.key || key }),
      label: officeLabel(hour, kind, identity.title),
      langs: ['la', 'en'],
      source: 'corpus',
      corpusVersion: CORPUS_VERSION,
      nocturns: proper.nocturns === undefined ? null : proper.nocturns,
      parts: resolveParts(proper.parts, hour, date),
    };

    return respond(200, payload, {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Corpus-Version': CORPUS_VERSION,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return respond(err.status, { error: err.code, message: err.message, detail: err.detail });
    }
    console.error('office-corpus error:', err && err.stack ? err.stack : err);
    return respond(500, { error: 'internal', message: 'office could not be resolved' });
  }
};

function respond(statusCode, payload, extra) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS, extra || {}),
    body: JSON.stringify(payload),
  };
}

// Exported for tests, which invoke the pieces directly against the committed
// corpus -- no network, no Netlify.
exports._internals = {
  WINDOW, HOURS, FORM, CORPUS_VERSION,
  validate, resolveOffice, dayIdentity, resolveParts,
  selectVerses, resolvePsalm, resolveHymn, resolveOrdinary,
  officeLabel, keepForm, HttpError,
};
