// Extracts the real date functions from index.html and runs them under a controlled clock.
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');

function extract() {
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex(l => l.startsWith('function getLiturgicalSeason()'));
  const end   = lines.findIndex(l => l.startsWith('// Seasonal antiphon data'));
  if (start < 0 || end < 0) throw new Error('anchors not found');
  return lines.slice(start, end).join('\n');
}

// `frozenMs` is a real epoch ms. new Date() with no args returns it;
// every other Date construction behaves normally.
function load(frozenMs) {
  const src = extract();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(frozenMs); else super(...a); }
    static now() { return frozenMs; }
  }
  const factory = new Function('Date', src + '\nreturn { getLiturgicalSeason, getPsalmWeek, getEaster, getAshWednesday };');
  return factory(FakeDate);
}

// Local-time helper: build epoch ms for a local wall-clock instant.
const at = (y, m1, d, h = 12, mi = 0) => new Date(y, m1 - 1, d, h, mi, 0, 0).getTime();

module.exports = { load, extract, at };
