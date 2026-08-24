// Office Calendar (liturgical rite) toggle -- persistence rules.
// Extracts the real block out of index.html and runs it against stubs.
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');
const L = fs.readFileSync(path, 'utf8').split(/\r?\n/);

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

// ---- extract the block ------------------------------------------------------
const s = L.findIndex(l => l.includes('const RITE_KEY'));
const e = L.findIndex((l, i) => i > s && l.includes('SETTINGS HELPERS'));
if (s < 0 || e < 0) { console.log('FAIL  could not locate the rite block'); process.exit(1); }
const src = L.slice(s, e - 2).join('\n');

// ---- sandbox ----------------------------------------------------------------
function load(opts) {
  opts = opts || {};
  const user   = 'user'   in opts ? opts.user   : null;
  const token  = 'token'  in opts ? opts.token  : 'tok';
  const remote = 'remote' in opts ? opts.remote : undefined;
  const ok     = 'ok'     in opts ? opts.ok     : true;
  const status = 'status' in opts ? opts.status : 200;

  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  if (token) store['still_access_token'] = token;

  const calls = [];
  const fetchStub = (url, o) => {
    o = o || {};
    calls.push({ url, method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null });
    return Promise.resolve({
      ok, status,
      json: () => Promise.resolve(remote === undefined ? [{}] : [{ liturgical_rite: remote }]),
    });
  };

  const warn = [];
  const consoleStub = { warn: function () { warn.push([].join.call(arguments, ' ')); }, log: function () {} };

  const factory = new Function(
    'localStorage', 'document', 'fetch', 'window', 'SUPA_URL', 'SUPA_ANON',
    'getValidToken', 'console', 'setTimeout',
    src + '\nreturn { getLiturgicalRite, setLiturgicalRite, syncLiturgicalRite, ' +
          'pushLiturgicalRite, RITES, RITE_KEY, SETTINGS_SECTIONS };'
  );
  const api = factory(
    localStorage,
    { getElementById: () => null },
    fetchStub,
    { currentUser: user },
    'https://x.supabase.co',
    'anon',
    async () => token,
    consoleStub,
    fn => fn()
  );
  return { api, store, calls, warn };
}

// ---- 1. default -------------------------------------------------------------
check(load().api.getLiturgicalRite() === 'modern', "default with nothing stored is 'modern'");
{
  const t = load();
  t.store['still_liturgical_rite'] = 'latin';          // junk / retired value
  check(t.api.getLiturgicalRite() === 'modern', 'unrecognised stored value falls back to modern');
  t.store['still_liturgical_rite'] = 'traditional';
  check(t.api.getLiturgicalRite() === 'traditional', 'stored traditional is honoured');
}
check(load().api.RITE_KEY === 'still_liturgical_rite', 'localStorage key is still_liturgical_rite');
check(JSON.stringify(load().api.RITES) === '["modern","traditional"]', 'rites are exactly modern|traditional');

// ---- 2. explicit choice -----------------------------------------------------
{
  const t = load();                                     // guest: no user
  t.api.setLiturgicalRite('traditional');
  check(t.store['still_liturgical_rite'] === 'traditional', 'guest choice is written to localStorage');
  check(t.calls.length === 0, 'guest choice does not attempt a profile write');
}
{
  const t = load({ user: { id: 'u1' } });
  t.api.setLiturgicalRite('traditional');
  check(t.store['still_liturgical_rite'] === 'traditional', 'signed-in choice is written locally');
  check(t.calls.length === 1 && t.calls[0].method === 'PATCH', 'signed-in choice PATCHes the profile');
  check(!!t.calls[0].body && t.calls[0].body.liturgical_rite === 'traditional', 'PATCH body carries the rite');
  check(/profiles\?id=eq\.u1/.test(t.calls[0].url), "PATCH targets the caller's own row");
}
{
  const t = load({ user: { id: 'u1' } });
  t.api.setLiturgicalRite('byzantine');                 // not a valid rite
  check(t.store['still_liturgical_rite'] === undefined, 'invalid rite is not stored');
  check(t.calls.length === 0, 'invalid rite is not pushed');
}

// ---- 3. sign-in conflict rule ----------------------------------------------
(async () => {
  {
    const t = load({ user: { id: 'u1' }, remote: 'traditional' });
    t.store['still_liturgical_rite'] = 'modern';        // device disagrees
    await t.api.syncLiturgicalRite();
    check(t.store['still_liturgical_rite'] === 'traditional',
          'profile wins on sign-in over a differing local value');
    check(t.calls.filter(c => c.method === 'PATCH').length === 0,
          'profile-wins does not echo a PATCH back');
  }
  {
    // NULL profile: this account has never expressed a preference. A guest's
    // choice must survive rather than be reset to a value they never set.
    const t = load({ user: { id: 'u1' }, remote: null });
    t.store['still_liturgical_rite'] = 'traditional';
    await t.api.syncLiturgicalRite();
    check(t.store['still_liturgical_rite'] === 'traditional',
          "NULL profile keeps the guest's local choice");
    const patches = t.calls.filter(c => c.method === 'PATCH');
    check(patches.length === 1 && patches[0].body.liturgical_rite === 'traditional',
          'NULL profile adopts the local choice by pushing it up');
  }
  {
    // Migration not run yet -- the read 404s. Must not clobber local state.
    const t = load({ user: { id: 'u1' }, ok: false, status: 404 });
    t.store['still_liturgical_rite'] = 'traditional';
    await t.api.syncLiturgicalRite();
    check(t.store['still_liturgical_rite'] === 'traditional',
          'a failed read leaves the local value alone');
    check(t.warn.some(w => /liturgical_rite read failed/.test(w)),
          'a failed read is warned about, not swallowed');
  }
  {
    const t = load({ user: null, remote: 'traditional' });
    await t.api.syncLiturgicalRite();
    check(t.calls.length === 0, 'guest sign-in sync is a no-op');
  }

  // ---- 4. the rite select must be its own request ---------------------------
  const whole = fs.readFileSync(path, 'utf8');
  check(!/select=subscription_status[^'"`]*liturgical_rite/.test(whole),
        'liturgical_rite is NOT appended to the subscription select');

  // ---- 5. markup + openSettings dedup ---------------------------------------
  check((whole.match(/function openSettings\s*\(/g) || []).length === 1,
        'exactly one openSettings definition remains');
  check(/function openSettings\(section\)/.test(whole), 'the surviving openSettings takes a section');
  check(!/showScreen\('settings'\)/.test(whole), 'the dead settings-screen call is gone');
  check(/id="rite-settings"/.test(whole), 'the card carries id="rite-settings" for deep-linking');
  check(/>Office Calendar</.test(whole), 'card label is "Office Calendar"');
  check(/Traditional follows the 1960 Roman Breviary\. Modern uses Ordinary Time\./.test(whole),
        'card description matches the agreed copy');
  check(/id="riteTraditionalBtn"[\s\S]{0,400}?setLiturgicalRite\('traditional'\)/.test(whole),
        'Traditional button wired to setLiturgicalRite');
  check(/id="riteModernBtn"[\s\S]{0,400}?setLiturgicalRite\('modern'\)/.test(whole),
        'Modern button wired to setLiturgicalRite');
  const sect = load().api.SETTINGS_SECTIONS;
  check(sect.bells === 'bells-settings' && sect.rite === 'rite-settings',
        'deep-link map covers both bells and rite');

  console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
  process.exit(fail ? 1 : 0);
})();
