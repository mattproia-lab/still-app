# Build corpus/readings/<year>.json for 2026-2030 (python build.py [first-year last-year]): citations only, from romcal's calendar (the winner of each day),
# Felix Just's Lectionary index tables (the structure: Sundays A/B/C, weekdays I/II, the seasons, the fixed-date feasts),
# and the cpbjr per-day citations for 2026 and 2027 (observed US practice, and the memorials' proper readings).
import sys, json, re, os, collections, datetime
sys.stdout.reconfigure(encoding='utf-8')
from lectlib import *

sun, wk = felix(); cp = cpbjr(); rom = romcal()
cp = {d: v for d, v in cp.items() if d[:4] in ('2026', '2027')}   # the two complete observed years (2025 is shifted by a day from mid-October and is not shipped here)

def psalm_norm(s): return re.sub(r'\+', ', ', s or '')
def join(cites):
    seen = []
    for c in cites:
        if c and c not in seen: seen.append(c)
    return ' or '.join(seen)

def variants(table, base, cyc):
    """All of Felix's entries for a day: the base name and its '(...)' variants (options, notes, '1st reading'), not the Vigil."""
    out = []
    for (name, c), v in table.items():
        if c != cyc: continue
        if name == base or (name.startswith(base + ' (') or name.startswith(base + '(')):
            if 'Vigil' in name and 'Vigil' not in base: continue
            out.append((name, v))
    out.sort(key=lambda x: x[0] != base)   # the base entry first, so its citations lead the ' or ' lists
    return out

def felix_set(table, key):
    """One day's readings from Felix's tables: {first, psalm, second, gospel[, vigil, vigilPsalms]} or None."""
    base, cyc = key
    ents = variants(table, base, cyc)
    if not ents: return None
    roles = collections.defaultdict(list); vigil = {}; vpsalm = {}
    for name, v in ents:
        tag = name[len(base):].lower()
        for role, lst in v.items():
            cites = [c for c, _ in lst]
            m = re.search(r'(\d)(?:st|nd|rd|th) reading', tag)
            if base == 'Easter Vigil' and m: vigil[int(m.group(1))] = join(cites); continue
            m2 = re.search(r'resp\. (\d[ab]?)', tag) or re.search(r'(\d)(?:st|nd|rd|th) response', tag)
            if base == 'Easter Vigil' and m2: vpsalm[m2.group(1)] = psalm_norm(join(cites)); continue
            if '1st reading' in tag: role = 'first'
            elif '2nd reading' in tag: role = 'second'
            elif 'proper gospel' in tag: role = 'gospel'
            elif 'resp' in tag: role = 'psalm'
            roles[role].extend(cites)
    out = {}
    for role in ('first', 'psalm', 'second', 'gospel'):
        if roles.get(role): out[role] = psalm_norm(join(roles[role])) if role == 'psalm' else join(roles[role])
    # weekdays and feasts read Acts and the epistles as the FIRST reading; only Sundays and solemnities have a second
    if 'second' in out and 'first' not in out and (table is wk or base == 'Easter Vigil'): out['first'] = out.pop('second')
    # Sundays and solemnities of Easter time read Acts as the first reading; Felix's Sunday tables list it with the epistles
    if 'first' not in out and 'second' in out:
        alts = out['second'].split(' or '); acts = [a for a in alts if a.startswith('Acts ')]
        if acts and len(alts) > 1:
            out['first'] = join(acts); rest = [a for a in alts if not a.startswith('Acts ')]
            out['second'] = join(rest)
    if vigil:
        out['vigil'] = [vigil[i] for i in sorted(vigil)]
        out['first'] = out['vigil'][0]
        if vpsalm:
            out['vigilPsalms'] = {k: vpsalm[k] for k in sorted(vpsalm, key=lambda k: (int(k[0]), k))}
            out['psalm'] = join([vpsalm.get('1a'), vpsalm.get('1b')])      # after the first reading
            if vpsalm.get('8'): out['epistlePsalm'] = vpsalm['8']          # after the epistle, before the Gospel
    return out or None

# ---------- romcal day -> Felix key ----------
def sunday_keys(day, A):
    s, w, n = day['season'], day['week'], day['dayName']
    if s == 'ordinary_time': return [('34th Sunday in Ord. Time: Christ the King' if w == 34 else f'{ordinal(w)} Sunday in Ordinary Time', A)]
    if s == 'advent': return [(f'{ordinal(w)} Sunday of Advent', A)]
    if s == 'lent': return [(f'{ordinal(w)} Sunday of Lent', A)]
    if s == 'easter': return [('Easter Sunday: Resurrection of the Lord', A)] if w == 1 else [(f'{ordinal(w)} Sunday of Easter', A), (f'{ordinal(w)} Sunday of Easter ( note 2 )', A)]
    if s == 'holy_week': return [('Palm Sunday Mass', A)]
    if s == 'christmas': return [('2nd Sunday after Christmas ( note 1 )', A)]
    return []
EPIPHANY = {}
for _d, _day in rom.items():
    if any(c.get('key') == 'epiphany' and c.get('winner') for c in _day['celebrations']): EPIPHANY[_d[:4]] = _d
def weekday_keys(day, date, W):
    s, w, d = day['season'], day['week'], dow(date); D = DOW[d]; mmdd = date[5:]
    after_epiphany = date > EPIPHANY.get(date[:4], '9999')
    if s == 'ordinary_time': return [(f'Ord. Time, Week {w}, {D}', W)]
    if s == 'advent':
        if mmdd >= '12-17': return [(f'Advent, Dec. {int(mmdd[3:])}', W), (f'Advent, Dec. {int(mmdd[3:])} (morning Mass)', W)]
        return [(f'Advent, Week {w}, {D}', W)]
    if s == 'lent':
        if w == 0: return [({'Wed':'Ash Wednesday','Thurs':'Thursday after Ash Wed','Fri':'Friday after Ash Wed','Sat':'Saturday after Ash Wed'}.get(D, ''), W)]
        return [(f'Lent, Week {w}, {D}', W)]
    if s == 'holy_week': return [(f'Holy Week, {D}', W)]
    if s == 'triduum': return [({'Thurs':"Holy Thursday: Mass of the Lord's Supper", 'Fri':"Good Friday of the Lord's Passion", 'Sat':'Easter Vigil'}.get(D, ''), W)]
    if s == 'easter':
        if w == 1: return [(f'Easter Octave, {D}', W)]
        if w == 7 and D == 'Sat': return [('Easter, Week 7, Sat morn', W)]
        return [(f'Easter, Week {w}, {D}', W)]
    if s == 'christmas':
        dd = int(mmdd[3:]); mm = mmdd[:2]
        if mm == '12': return [(f'{ {29:"5th",30:"6th",31:"7th"}.get(dd, "")} Day in Xmas Octave, Dec. {dd}', W)]
        if 2 <= dd <= 5 and not after_epiphany: return [(f'Christmas Weekday: Jan. {dd}', W)]
        if dd == 6 and not after_epiphany: return [('Christmas Weekday: Jan. 6 (if Epiphany is Jan. 7 or 8)', W)]
        if dd == 7 and not after_epiphany: return [('Christmas Weekday: Jan. 7 (if Epiphany is Jan. 8)', W)]
        return [({'Mon':'Mon after Epiphany, or Jan. 7','Tues':'Tues after Epiphany, or Jan. 8','Wed':'Wed after Epiphany, or Jan. 9','Thurs':'Thurs after Epiphany, or Jan. 10','Fri':'Fri after Epiphany, or Jan. 11','Sat':'Sat after Epiphany, or Jan. 12'}.get(D, ''), W)]
    return []

def temporal_set(day, date, A, W):
    keys = sunday_keys(day, A) if dow(date) == 6 else weekday_keys(day, date, W)
    table = sun if dow(date) == 6 else wk
    for k in keys:
        r = felix_set(table, k) or felix_set(wk if table is sun else sun, k)
        if r: return r, 'felix:%s|%s' % k
    return None, None

# celebrations with their own readings in the Sunday table, by romcal key (the fixed-date ones are found by date)
LORD = {
 'christmas': "Dec. 25: Christmas: Mass during the Day", 'epiphany': 'The Epiphany of the Lord', 'baptismOfTheLord': 'Sunday after Epiphany: Baptism of the Lord',
 'holyFamily': 'Sunday in Octave of Christmas: Holy Family', 'maryMotherOfGod': 'Jan. 1: Mary, Mother of God', 'ascension': 'Ascension of the Lord',
 'pentecostSunday': 'Pentecost Sunday', 'trinitySunday': 'Sunday after Pentecost: Holy Trinity', 'corpusChristi': 'Sunday after Trinity Sun: Body & Blood of Christ',
 'sacredHeartOfJesus': 'Friday after 2nd Sun after Pentecost: Sacred Heart', 'christTheKing': '34th Sunday in Ord. Time: Christ the King',
 'palmSunday': 'Palm Sunday Mass', 'easter': 'Easter Sunday: Resurrection of the Lord', 'holyThursday': "Holy Thursday: Mass of the Lord's Supper",
 'goodFriday': "Good Friday of the Lord's Passion", 'holySaturday': 'Easter Vigil', 'divineMercySunday': '2nd Sunday of Easter',
 'immaculateHeartOfMary': 'Sat >2nd Sun >Pentecost: Immaculate Heart of BVMary (Proper Gospel only)',
}
CHRISTMAS_MASSES = ['Dec. 25: Christmas: Vigil Mass', 'Dec. 25: Christmas: Mass at Midnight', 'Dec. 25: Christmas: Mass at Dawn']

MON = {'jan':1,'feb':2,'march':3,'mar':3,'april':4,'apr':4,'may':5,'june':6,'jun':6,'july':7,'jul':7,'aug':8,'sept':9,'sep':9,'oct':10,'nov':11,'dec':12}
fixed = collections.defaultdict(set)
for (name, c) in list(sun) + list(wk):
    m = re.match(r'^([A-Za-z]+)\.?\s+(\d{1,2}):\s*(.*)$', name)
    if m and m.group(1).lower() in MON:
        base = re.sub(r'\s*\(.*$', '', name).strip()
        fixed[(MON[m.group(1).lower()], int(m.group(2)))].add(base)
def lookup_fixed(date, A, W):
    mm, dd = int(date[5:7]), int(date[8:10])
    bases = [b for b in fixed.get((mm, dd), ()) if 'Vigil' not in b]
    if not bases: return None, None
    # the Day Mass over other entries; the most complete set
    best = None
    for b in sorted(bases, key=lambda b: ('Day' not in b, len(b))):
        r = felix_set(sun, (b, A)) or felix_set(wk, (b, W)) or felix_set(wk, (b, 'I')) or felix_set(sun, (b, 'A'))
        if r and (best is None or len(r) > len(best[0])): best = (r, b)
    return best if best else (None, None)

def gospel_id(c):
    m = re.match(r'^((?:[123] )?[A-Za-z]+) (\d+)', c or ''); return (m.group(1), m.group(2)) if m else None

# ---------- proper readings observed in cpbjr (a memorial whose gospel chapter is not the weekday's) ----------
observed = {}
for date, day in sorted(rom.items()):
    if date not in cp: continue
    w = [c for c in day['celebrations'] if c.get('winner')]; w = w[0] if w else None
    if not w or w['rank'] not in ('memorial', 'optional memorial', 'feast', 'solemnity'): continue
    A, W, _ = cycles(date)
    fer, _ = temporal_set(day, date, A, W)
    ob = {k: v for k, v in cp[date].items() if k in ('first', 'psalm', 'second', 'gospel') and v}
    if ob.get('gospel') and (not fer or gospel_id(ob['gospel']) != gospel_id(fer.get('gospel'))):
        observed.setdefault(w['key'], []).append((ob, date, A))

def gospel_ids(c): return {gospel_id(x) for x in (c or '').split(' or ')}
# the readings USCCB used on each temporal day of 2026/2027, by the Felix key it maps to: later years with the same key and
# cycle reuse them (this also corrects the index's own slips, e.g. its psalm numbers for the Mondays of Lent 1 and 2)
by_key = {}
for date, day in sorted(rom.items()):
    if date not in cp: continue
    w = [c for c in day['celebrations'] if c.get('winner')]; w = w[0] if w else None
    if not w or w['rank'] not in ('sunday', 'weekday', 'memorial', 'optional memorial'): continue
    A, W, _ = cycles(date)
    fer, fsrc = temporal_set(day, date, A, W)
    ob = {k: v for k, v in cp[date].items() if k in ('first', 'psalm', 'second', 'gospel') and v}
    if fer and ob.get('gospel') and gospel_id(ob['gospel']) in gospel_ids(fer.get('gospel')) and gospel_id(ob.get('first')) in gospel_ids(fer.get('first')) | {None}:
        by_key.setdefault(fsrc, (ob, date))
for fsrc in list(by_key):
    base, cyc = fsrc[len('felix:'):].rsplit('|', 1)
    if cyc in ('I', 'II'):
        other = 'II' if cyc == 'I' else 'I'
        if felix_set(wk, (base, cyc)) == felix_set(wk, (base, other)): by_key.setdefault('felix:%s|%s' % (base, other), by_key[fsrc])

# ---------- Douay-Rheims names and psalm numbers ----------
DR = {'Joshua':'Josue','1 Samuel':'1 Kings','2 Samuel':'2 Kings','1 Kings':'3 Kings','2 Kings':'4 Kings','1 Chronicles':'1 Paralipomenon','2 Chronicles':'2 Paralipomenon',
      'Ezra':'1 Esdras','Nehemiah':'2 Esdras','Tobit':'Tobias','Sirach':'Ecclesiasticus','Song of Songs':'Canticle of Canticles','Isaiah':'Isaias','Jeremiah':'Jeremias',
      'Ezekiel':'Ezechiel','Hosea':'Osee','Obadiah':'Abdias','Jonah':'Jonas','Micah':'Micheas','Habakkuk':'Habacuc','Zephaniah':'Sophonias','Haggai':'Aggeus',
      'Zechariah':'Zacharias','Malachi':'Malachias','1 Maccabees':'1 Machabees','2 Maccabees':'2 Machabees','Revelation':'Apocalypse','Psalm':'Psalms'}
def vulgate_psalm(n):
    if n <= 8: return str(n)
    if n in (9, 10): return '9'
    if 11 <= n <= 113: return str(n - 1)
    if n in (114, 115): return '113'
    if n == 116: return '114-115'
    if 117 <= n <= 146: return str(n - 1)
    if n == 147: return '146-147'
    return str(n)
def to_dr(cite):
    if not cite: return cite
    parts = []
    for p in cite.split(' or '):
        m = re.match(r'^((?:[123] )?[A-Za-z]+(?: of [A-Za-z]+)?) (\d+)(.*)$', p)
        if not m: parts.append(p); continue
        book, ch, rest = m.group(1), int(m.group(2)), m.group(3)
        if book == 'Psalm': rest = re.sub(r'; (\d+):', lambda m: '; %s:' % vulgate_psalm(int(m.group(1))), rest)   # "Psalm 42:2-3; 43:3, 4"
        parts.append('Psalms %s%s' % (vulgate_psalm(ch), rest) if book == 'Psalm' else '%s %d%s' % (DR.get(book, book), ch, rest))
    return ' or '.join(parts)
def dr_block(r): return {k: (to_dr(v) if isinstance(v, str) else [to_dr(x) for x in v] if isinstance(v, list) else v) for k, v in r.items()}

# ---------- generate ----------
OUT = os.path.join(REPO, 'corpus', 'readings'); os.makedirs(OUT, exist_ok=True)
stats = collections.Counter(); gaps = []; missing = collections.Counter()
YEARS = tuple(range(int(sys.argv[1]), int(sys.argv[2]) + 1)) if len(sys.argv) == 3 else (2026, 2027, 2028, 2029, 2030)
for year in YEARS:
    days = {}
    for date, day in sorted(rom.items()):
        if not date.startswith(str(year)): continue
        w = [c for c in day['celebrations'] if c.get('winner')]; w = w[0] if w else {'key': None, 'name': day['dayName'], 'rank': 'weekday'}
        A, W, lit = cycles(date)
        rec = {'name': w['name'], 'key': w['key'], 'rank': w['rank'], 'season': day['season'], 'week': day['week'], 'sundayCycle': A, 'weekdayCycle': W}
        fer, fsrc = temporal_set(day, date, A, W)
        own, osrc = None, None
        if w['key'] in LORD:
            nm = LORD[w['key']]
            own = felix_set(sun, (nm, A)) or felix_set(wk, (nm, W)) or felix_set(wk, (nm, 'I')) or felix_set(sun, (nm, 'A'))
            if own: osrc = 'felix:' + nm
            if w['key'] == 'christmas':
                rec['otherMasses'] = {m.split(': ')[-1]: felix_set(sun, (m, A)) for m in CHRISTMAS_MASSES}
        if not own and w['rank'] in ('solemnity', 'feast', 'memorial', 'optional memorial'):
            own, nm = lookup_fixed(date, A, W)
            if own: osrc = 'felix:' + nm
        obs = None
        if w['key'] in observed and w['rank'] in ('solemnity', 'feast', 'memorial', 'optional memorial') and w['key'] != 'holySaturday':
            cands = observed[w['key']]
            same = [c for c in cands if c[2] == A]
            obs = same[0] if same else (None if w['key'] in LORD else cands[0])   # the Lord's days change with the cycle
        if obs:
            # the readings USCCB used on this celebration in 2026/2027 lead; Felix fills what they lack
            ob, od, _ = obs
            merged = dict(ob)
            for k2, v2 in (own or {}).items():
                if k2 not in merged: merged[k2] = v2
            own, osrc = merged, 'cpbjr:' + od + ((' + ' + osrc) if osrc and len(merged) > len(ob) else '')
        takes_own = w['rank'] in ('solemnity', 'feast', 'sunday', 'triduum') or (w['rank'] in ('memorial', 'optional memorial') and w['key'] in observed and own and gospel_id(own.get('gospel')) != gospel_id((fer or {}).get('gospel')))
        us_only = None
        if date in cp and w['rank'] in ('sunday', 'weekday') and fer and cp[date]['gospel'] and gospel_id(cp[date]['gospel']) not in gospel_ids(fer.get('gospel')):
            # USCCB read something else that day (Ascension moved to Sunday, Thanksgiving): the app's calendar keeps the day, the observation is kept aside
            us_only = {k: v for k, v in cp[date].items() if k in ('first', 'psalm', 'second', 'gospel') and v}
        if date in cp and w['key'] == 'holySaturday' and own:
            rec['readings'] = own; rec['source'] = osrc; rec['observedUS'] = {k: v for k, v in cp[date].items() if k in ('first', 'psalm', 'second', 'gospel') and v}; rec['observedUSNote'] = 'cpbjr:%s lists the Vigil differently; the Lectionary structure is kept' % date
            stats['derived'] += 1
        elif date in cp and us_only:
            rec['readings'] = fer; rec['source'] = fsrc; rec['observedUS'] = us_only; rec['observedUSNote'] = 'cpbjr:%s, a US observance not in the app calendar' % date
            if own: rec['proper'] = own; rec['properSource'] = osrc
            stats['derived'] += 1
        elif date not in cp and w['rank'] in ('sunday', 'weekday') and fer and fsrc in by_key:
            ob, od = by_key[fsrc]
            rec['readings'] = dict(ob); rec['source'] = 'cpbjr:%s via %s' % (od, fsrc)
            for k2 in ('first', 'psalm', 'second', 'gospel'):
                if k2 not in rec['readings'] and fer.get(k2) and (k2 != 'second' or w['rank'] == 'sunday'): rec['readings'][k2] = fer[k2]
            if own: rec['proper'] = own; rec['properSource'] = osrc
            stats['derived'] += 1
        elif date in cp:
            ob = {k: v for k, v in cp[date].items() if k in ('first', 'psalm', 'second', 'gospel') and v}
            rec['readings'] = ob; rec['source'] = 'cpbjr:' + date
            fill = own if (own and takes_own) else fer
            for k2 in ('first', 'psalm', 'second', 'gospel'):
                if k2 not in ob and fill and fill.get(k2) and (k2 != 'second' or w['rank'] in ('sunday', 'solemnity')):
                    ob[k2] = fill[k2]; rec['source'] += ' (+%s from %s)' % (k2, osrc if fill is own else fsrc)
            if own and 'vigil' in own: rec['readings']['vigil'] = own['vigil']; rec['readings']['vigilPsalms'] = own.get('vigilPsalms', {})
            if fer and (takes_own or own): rec['ferial'] = fer; rec['ferialSource'] = fsrc
            if own and not takes_own: rec['proper'] = own; rec['properSource'] = osrc
            if own and takes_own: rec['check'] = osrc
            stats['observed'] += 1
        else:
            if own and takes_own:
                rec['readings'] = dict(own); rec['source'] = osrc
                for k2 in ('first', 'psalm', 'gospel'):
                    if not rec['readings'].get(k2) and fer and fer.get(k2): rec['readings'][k2] = fer[k2]; rec['source'] += ' (+%s from %s)' % (k2, fsrc)
                if fer: rec['ferial'] = fer; rec['ferialSource'] = fsrc
            elif fer:
                rec['readings'] = fer; rec['source'] = fsrc
                if own: rec['proper'] = own; rec['properSource'] = osrc
            elif own:
                rec['readings'] = own; rec['source'] = osrc
            else:
                gaps.append((date, w['name'], w['rank'], day['season'], day['dayName'])); stats['gap'] += 1
            if 'readings' in rec: stats['derived'] += 1
        if 'readings' in rec:
            rec['dr'] = dr_block(rec['readings'])
            for role in ('first', 'psalm', 'gospel'):
                if not rec['readings'].get(role): missing[(year, role, w['rank'])] += 1
            if w['rank'] in ('sunday', 'solemnity') and not rec['readings'].get('second') and not (day['season'] == 'easter' and day['week'] == 1):
                missing[(year, 'second', w['name'][:30])] += 1
        days[date] = rec
    doc = {'year': year, 'generated': '2026-09-08',
           'calendar': 'General Roman Calendar as the app computes it: assets/calendar/general/%d.json (romcal 1.3.0)' % year,
           'cycles': {'sunday': cycles('%d-06-01' % year)[0], 'weekday': cycles('%d-06-01' % year)[1], 'note': 'the cycle turns at the First Sunday of Advent; each day carries its own'},
           'sources': {
             'felix': 'Felix Just, S.J., Lectionary index tables for the 1998/2002 USA Lectionary, https://catholic-resources.org/Lectionary/Index-Sundays.htm and Index-Weekdays.htm, retrieved 2026-09-08; copyright Felix Just, S.J.; cited, not copied',
             'cpbjr': 'cpbjr/catholic-readings-api (MIT), commit 973e9864eb0f of 2026-08-29, readings/2026 and readings/2027: per-day citations derived from USCCB'},
           'fields': {
             'readings': "the day's Mass readings as citations: first, psalm, second (Sundays and solemnities), gospel; on the Easter Vigil also vigil (the Old Testament readings in order) and vigilPsalms. Modern book names, verse numbering as the sources give it",
             'dr': 'the same with Douay-Rheims book names and Vulgate psalm numbers; verse numbers are not converted',
             'ferial': "the weekday's readings when a celebration displaced them", 'proper': "a memorial's own readings when the weekday's are the day's",
             'source': 'where the readings came from: cpbjr:<date> for 2026 and 2027 (observed); cpbjr:<date> via felix:<key> when a later day maps to the same lectionary day and cycle; felix:<day name>|<cycle> otherwise',
             'observedUS': 'what USCCB read that day when the app calendar keeps a different celebration (Ascension transferred to Sunday, Thanksgiving Day)',
             'vigil': 'Easter Vigil only: the seven Old Testament readings in order; vigilPsalms their responses by number (1a/1b are the options after the first reading, 8 follows the epistle)'},
           'days': days}
    with open(os.path.join(OUT, '%d.json' % year), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1); f.write('\n')
    print(year, 'days', len(days), 'with readings', sum(1 for d in days.values() if 'readings' in d))
print('stats', dict(stats)); print('gaps', len(gaps))
for g in gaps[:30]: print('  ', *g)
print('missing roles:')
for k, v in sorted(missing.items()): print('  ', k, v)
print('observed proper keys', len(observed), sorted(observed)[:40])
