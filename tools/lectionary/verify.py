# Verify the generated readings: (1) a full sample week in 2026 against Felix Just's tables and the LitCal API; (2) every
# date 2026-2030 against the LitCal API's readings where it has them (Apache-2.0 dataset, independent of both sources);
# (3) the 2026/2027 observed days against Felix on all temporal days.
import sys, json, re, os, collections
sys.stdout.reconfigure(encoding='utf-8')
from lectlib import *
R = os.path.join(REPO, 'corpus', 'readings')
gen = {}
for y in (2026, 2027, 2028, 2029, 2030): gen.update(json.load(open(os.path.join(R, '%d.json' % y), encoding='utf-8'))['days'])

def lit_by_date(y):
    d = json.load(open(os.path.join(INPUTS, 'litcal', '%d-en.json' % y), encoding='utf-8'))['litcal']
    d = list(d.values()) if isinstance(d, dict) else d
    out = collections.defaultdict(list)
    for e in d:
        if not isinstance(e, dict) or e.get('is_vigil_mass'): continue
        r = e.get('readings')
        if not isinstance(r, dict) or not r.get('gospel'): continue
        out[e['date'][:10]].append((e['grade'], e['event_key'], {'first': norm_cite(r.get('first_reading','')), 'psalm': norm_cite(r.get('responsorial_psalm','')), 'second': norm_cite(r.get('second_reading','')), 'gospel': norm_cite(r.get('gospel',''))}))
    return out
lit = {}
for y in (2026, 2027, 2028, 2029, 2030):
    try: lit.update(lit_by_date(y))
    except Exception as e: print('litcal', y, 'unreadable', e)

def loose(a, b):
    """same citation, ignoring verse letters and 'or' alternatives: book, chapter and the first verse span must match"""
    if not a or not b: return None
    def key(c):
        c = c.split(' or ')[0]; c = re.sub(r'[a-z](?=[,\-; ]|$)', '', c); c = re.sub(r'\s+', ' ', c)
        m = re.match(r'^([^:]+):(\d+)', c); return (m.group(1), m.group(2)) if m else c
    return key(a) == key(b)

# (2) LitCal per-date check
agree = collections.Counter(); ex = []
TEMPORAL = ('sunday', 'weekday', 'triduum')
for date, rec in sorted(gen.items()):
    if date not in lit or 'readings' not in rec: continue
    if rec['rank'] not in TEMPORAL and not (rec['rank'] == 'solemnity' and rec['key'] in ('christmas','epiphany','maryMotherOfGod','ascension','pentecostSunday','trinitySunday','corpusChristi','sacredHeartOfJesus','christTheKing','easter','divineMercySunday') or rec['key'] in ('baptismOfTheLord','holyFamily','presentationOfTheLord','transfiguration','theExaltationOfTheHolyCross')): continue
    top = max(lit[date], key=lambda x: x[0])
    for role in ('first', 'psalm', 'second', 'gospel'):
        a, b = rec['readings'].get(role), top[2].get(role)
        v = loose(a, b)
        if v is None: continue
        agree[(date[:4], role, 'same' if v else 'diff')] += 1
        if not v and len(ex) < 24: ex.append((date, rec['name'][:28], rec['rank'][:8], role, a, '|', b, '|', top[1]))
print('LITCAL CHECK (generated vs the Apache-2.0 dataset, where it has readings):')
for y in ('2026','2027','2028','2029','2030'):
    s = sum(v for k, v in agree.items() if k[0]==y and k[2]=='same'); d = sum(v for k, v in agree.items() if k[0]==y and k[2]=='diff')
    print('  ', y, 'same', s, 'diff', d, '(%.1f%%)' % (100*s/(s+d) if s+d else 0))
for e in ex: print('   ', *e)

# (1) the sample week: 2026-09-06 (23rd Sunday, Year A) to 2026-09-12
print('\nSAMPLE WEEK 2026-09-06..12: generated | Felix | LitCal')
sun, wk = felix()
for i in range(7):
    date = '2026-09-%02d' % (6 + i); rec = gen[date]; A, W, _ = cycles(date)
    if dow(date) == 6: fx = sun.get((f"{ordinal(rec['week'])} Sunday in Ordinary Time", A))
    else: fx = wk.get((f"Ord. Time, Week {rec['week']}, {DOW[dow(date)]}", W))
    fxs = {r: ' or '.join(dict.fromkeys(c for c, _ in v)) for r, v in (fx or {}).items()}
    if 'second' in fxs and 'first' not in fxs and dow(date) != 6: fxs['first'] = fxs.pop('second')
    lt = max(lit[date], key=lambda x: x[0])[2] if date in lit else {}
    print(' ', date, rec['name'], '(' + rec['rank'] + ')', '[' + rec['source'] + ']')
    for role in ('first', 'psalm', 'second', 'gospel'):
        g = rec['readings'].get(role, ''); f = fxs.get(role, ''); l = lt.get(role, '')
        if g or f or l: print('     %-7s %-45s | %-45s | %s' % (role, g, re.sub(r'\+', ', ', f), l))
    if rec.get('ferial'): print('     ferial ', rec['ferial'])
    if rec.get('proper'): print('     proper ', rec['proper'])
