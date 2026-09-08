# Shared helpers for the lectionary build: citation normalisation, Felix Just's indexes, cpbjr's days, romcal's days, cycles.
import re, json, glob, os, html, collections, datetime
V = os.path.dirname(os.path.abspath(__file__))          # tools/lectionary
REPO = os.path.dirname(os.path.dirname(V))
INPUTS = os.path.join(V, 'inputs')

ABBR = {
 # NAB and SBL style abbreviations -> modern full name
 'Gen':'Genesis','Ex':'Exodus','Exod':'Exodus','Lev':'Leviticus','Num':'Numbers','Dt':'Deuteronomy','Deut':'Deuteronomy','Jos':'Joshua','Josh':'Joshua',
 'Jgs':'Judges','Judg':'Judges','Ru':'Ruth','Ruth':'Ruth','1 Sm':'1 Samuel','2 Sm':'2 Samuel','1 Sam':'1 Samuel','2 Sam':'2 Samuel','1 Kgs':'1 Kings','2 Kgs':'2 Kings',
 '1 Chr':'1 Chronicles','2 Chr':'2 Chronicles','Ezr':'Ezra','Ezra':'Ezra','Neh':'Nehemiah','Tb':'Tobit','Tob':'Tobit','Jdt':'Judith','Est':'Esther','Esth':'Esther',
 '1 Mc':'1 Maccabees','2 Mc':'2 Maccabees','1 Macc':'1 Maccabees','2 Macc':'2 Maccabees','Jb':'Job','Job':'Job','Ps':'Psalm','Pss':'Psalm','Prv':'Proverbs','Prov':'Proverbs',
 'Eccl':'Ecclesiastes','Qoh':'Ecclesiastes','Sg':'Song of Songs','Song':'Song of Songs','Cant':'Song of Songs','Wis':'Wisdom','Sir':'Sirach','Is':'Isaiah','Isa':'Isaiah',
 'Jer':'Jeremiah','Lam':'Lamentations','Bar':'Baruch','Ez':'Ezekiel','Ezek':'Ezekiel','Dn':'Daniel','Dan':'Daniel','Hos':'Hosea','Jl':'Joel','Joel':'Joel','Am':'Amos','Amos':'Amos',
 'Ob':'Obadiah','Obad':'Obadiah','Jon':'Jonah','Jonah':'Jonah','Mi':'Micah','Mic':'Micah','Na':'Nahum','Nah':'Nahum','Hb':'Habakkuk','Hab':'Habakkuk','Zep':'Zephaniah','Zeph':'Zephaniah',
 'Hg':'Haggai','Hag':'Haggai','Zec':'Zechariah','Zech':'Zechariah','Mal':'Malachi','Mt':'Matthew','Matt':'Matthew','Mk':'Mark','Mark':'Mark','Lk':'Luke','Luke':'Luke','Jn':'John','John':'John',
 'Acts':'Acts','Rom':'Romans','1 Cor':'1 Corinthians','2 Cor':'2 Corinthians','Gal':'Galatians','Eph':'Ephesians','Phil':'Philippians','Col':'Colossians',
 '1 Thes':'1 Thessalonians','2 Thes':'2 Thessalonians','1 Thess':'1 Thessalonians','2 Thess':'2 Thessalonians','1 Tm':'1 Timothy','2 Tm':'2 Timothy','1 Tim':'1 Timothy','2 Tim':'2 Timothy',
 'Ti':'Titus','Titus':'Titus','Phlm':'Philemon','Heb':'Hebrews','Jas':'James','1 Pt':'1 Peter','2 Pt':'2 Peter','1 Pet':'1 Peter','2 Pet':'2 Peter','1 Jn':'1 John','2 Jn':'2 John','3 Jn':'3 John',
 'Jude':'Jude','Rv':'Revelation','Rev':'Revelation',
 'Psalms':'Psalm','Ecclesiasticus':'Sirach','Apocalypse':'Revelation','Canticle of Canticles':'Song of Songs','Songs':'Song of Songs','Psalm':'Psalm',
}
FULL = set(ABBR.values())
GOSPELS = ('Matthew','Mark','Luke','John')

def clean(s):
    s = html.unescape(s or '')
    s = s.replace('\u2014','-').replace('\u2013','-').replace('\xa0',' ').replace('\u2019',"'")
    s = re.sub(r'\s+',' ',s).strip().rstrip('.').strip()
    return s

def norm_cite(s):
    """One citation or an 'or' pair -> canonical text with full modern book names."""
    s = clean(s)
    if not s: return ''
    parts = re.split(r'\s+or\s+', s)
    out = []
    last_book = None
    for p in parts:
        p = re.sub(r'^(Cf\.|cf\.|See)\s+','',p).strip()
        m = re.match(r'^((?:[123]\s?)?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)?)\.?\s*(\d.*)$', p)
        if m:
            book, rest = m.group(1), m.group(2)
            book = re.sub(r'^([123])([A-Za-z])', r'\1 \2', book)
            book = ABBR.get(book, book)
            if book not in FULL: return s   # unknown book: leave the string untouched for a human
            last_book = book
        elif re.match(r'^\d', p) and last_book:
            book, rest = last_book, p          # "Matthew 4:12-23 or 4:12-17"
        elif re.match(r'^\d', p):
            book, rest = 'Psalm', p            # a bare "137:1-2" is a psalm in this data
        else:
            return s
        rest = re.sub(r'\s*:\s*', ':', rest); rest = re.sub(r'\s*,\s*', ', ', rest); rest = re.sub(r'\s*-\s*', '-', rest); rest = re.sub(r'\s+and\s+', ', ', rest); rest = re.sub(r'\s*;\s*', '; ', rest)
        out.append(book + ' ' + rest.strip())
    return ' or '.join(out)

def tables(path):
    h = open(path, encoding='utf-8', errors='ignore').read()
    out = []
    for t in re.findall(r'<table.*?</table>', h, re.S|re.I):
        rows = []
        for r in re.findall(r'<tr.*?</tr>', t, re.S|re.I):
            cells = [clean(re.sub(r'<[^>]+>', ' ', c)) for c in re.findall(r'<t[dh].*?</t[dh]>', r, re.S|re.I)]
            if cells: rows.append(cells)
        out.append(rows)
    return out

def felix():
    """Returns (sun, wk): sun[(day, cycle)] = {role: [(cite, lect)]}, wk[(day, year)] likewise. Roles: first, psalm, second, gospel."""
    sun = collections.defaultdict(lambda: collections.defaultdict(list))
    for t in tables(os.path.join(INPUTS,'felix','Index-Sundays.htm')):
        head = ' '.join(t[0]).lower()
        base = 'first' if 'old testament' in head else 'gospel' if 'gospel' in head else 'psalm' if 'psalm' in head else 'second'
        for cells in t[1:]:
            if len(cells) < 3: continue
            cite, lect, day = cells[0], cells[1], clean(cells[2])
            pairs = re.findall(r'(\d+)(?:-([ABC]+))?', lect)
            if not pairs: continue
            num = pairs[0][0]
            cyc = ''.join(sorted(set(''.join(c for _, c in pairs)))) or 'ABC'
            nc = norm_cite(cite)
            role = base
            if base == 'gospel' and not nc.split(' ')[0] in GOSPELS and not (nc.startswith('John') or nc.startswith('Matthew') or nc.startswith('Mark') or nc.startswith('Luke')):
                role = 'second'
            for c in cyc: sun[(day, c)][role].append((nc, num))
    wk = collections.defaultdict(lambda: collections.defaultdict(list))
    for t in tables(os.path.join(INPUTS,'felix','Index-Weekdays.htm')):
        head = ' '.join(t[0]).lower()
        role = 'first' if 'old testament' in head else 'second' if 'new testament' in head else 'gospel' if 'gospel' in head else 'psalm'
        for cells in t[1:]:
            if len(cells) < 4: continue
            cite, day, year, lect = cells[0], clean(cells[1]), cells[2].strip(), cells[3]
            ys = ['I'] if year == '1' else ['II'] if year == '2' else ['I','II']
            for y in ys: wk[(day, y)][role].append((norm_cite(cite), lect))
    return sun, wk

def cpbjr():
    cp = {}
    for f in glob.glob(os.path.join(INPUTS,'cpbjr','readings','*.json')):
        d = json.load(open(f, encoding='utf-8')); r = d.get('readings', {})
        cp[d['date']] = {'first': norm_cite(r.get('firstReading','')), 'psalm': norm_cite(r.get('psalm','')), 'second': norm_cite(r.get('secondReading','')), 'gospel': norm_cite(r.get('gospel','')), 'season': d.get('season')}
    return cp

def romcal(years=(2024,2025,2026,2027,2028,2029,2030)):
    rom = {}
    for y in years:
        p = os.path.join(REPO,'corpus','calendar','general',f'{y}.json')
        if not os.path.exists(p): p = os.path.join(REPO,'assets','calendar','general',f'{y}.json')
        if os.path.exists(p): rom.update(json.load(open(p,encoding='utf-8'))['days'])
    return rom

def advent1(y):
    xmas = datetime.date(y,12,25)
    return xmas - datetime.timedelta(days=(xmas.weekday()+1)%7 + 21)

def cycles(date):
    d = datetime.date(int(date[:4]),int(date[5:7]),int(date[8:10]))
    lit = d.year + 1 if d >= advent1(d.year) else d.year
    return {1:'A',2:'B',0:'C'}[lit%3], 'I' if lit%2 else 'II', lit

ORD = {1:'1st',2:'2nd',3:'3rd',21:'21st',22:'22nd',23:'23rd',31:'31st',32:'32nd',33:'33rd'}
def ordinal(n): return ORD.get(n, f'{n}th')
DOW = ['Mon','Tues','Wed','Thurs','Fri','Sat','Sun']
def dow(date): return datetime.date(int(date[:4]),int(date[5:7]),int(date[8:10])).weekday()
