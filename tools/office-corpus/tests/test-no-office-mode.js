// The Office Mode (Concise/Full) toggle was removed and the Office pinned to
// Full. This asserts the removal stayed complete -- no dead buttons, no dead
// handlers, no half-collapsed branches.
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');
const src = fs.readFileSync(path, 'utf8');

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
const absent = (needle, msg) => {
  const n = (src.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  check(n === 0, `${msg} (found ${n})`);
};

// ---- 1. no surviving references --------------------------------------------
absent('officeConciseBtn',       'no officeConciseBtn / 2 / 3 anywhere');
absent('officeFullBtn',          'no officeFullBtn / 2 / 3 anywhere');
absent('getOfficeMode',          'no getOfficeMode');
absent('setOfficeMode',          'no setOfficeMode (covers setOfficeModeAndRender too)');
absent('setOfficeModeAndRender', 'no setOfficeModeAndRender');
absent('settingsOfficeModeLabel','no settingsOfficeModeLabel');
absent('isFull',                 'no isFull left over from the collapse');

// ---- 2. the localStorage key is left alone, but never written --------------
check(!/localStorage\.setItem\(\s*['"]still_office_mode['"]/.test(src),
      'still_office_mode is never written');
check(!/localStorage\.getItem\(\s*['"]still_office_mode['"]/.test(src),
      'still_office_mode is never read');
absent('still_office_mode', 'still_office_mode does not appear at all (key left in users\' storage, untouched by code)');

// ---- 3. Full-mode content is now unconditional ------------------------------
// Things that used to live behind `if (isFull)` must still be present.
const mustKeep = [
  ["eyebrow('Evening Hymn')",   'Vespers Evening Hymn kept'],
  ["eyebrow('Responsorium')",   'Vespers Responsorium kept'],
  ["eyebrow('Intercessions')",  'Vespers Intercessions kept'],
  ['Te Deum',                   'Te Deum kept'],
];
for (const [needle, msg] of mustKeep)
  check(src.includes(needle), msg);

// Psalm selection must take the full set, not a one-element slice.
check(/const todayVPsalms = vPsalms;/.test(src), 'Vespers takes all three psalms');
check(!/\[vPsalms\[0\]\]/.test(src), 'no one-psalm Vespers slice remains');
check(!/\[vigilsPsalms\[\(psalmWeek-1\) % 4\]\[0\]\]/.test(src), 'no one-psalm Vigils slice remains');

// Psalm eyebrows are always numbered now.
check(!/isFull \? `Psalm/.test(src), 'psalm eyebrow numbering is unconditional');

// ---- 4. audio cache keys pinned to full ------------------------------------
check(!/\$\{isFull \? 'full' : 'simple'\}/.test(src), 'no mode ternary left in a cache key');
for (const hour of ['lauds', 'vespers', 'compline'])
  check(new RegExp('`' + hour + '- paced3-[^`]*-full').test(src),
        `${hour} audio cache key pinned to full`);

// ---- 5. Te Deum is no longer gated on mode ---------------------------------
check(/if \(isTeDeum\) \{/.test(src), 'Te Deum gated on isTeDeum alone');

// ---- 6. the settings modal still has its other cards -----------------------
for (const card of ['Office Calendar', 'Spiritual Depth', 'Fasting Mode', 'Anchor Prayer'])
  check(src.includes('>' + card + '<'), `settings card still present: ${card}`);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASS' : fail + ' check(s) failed'}`);
process.exit(fail ? 1 : 0);
