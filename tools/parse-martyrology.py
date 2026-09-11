"""
Martyrology parser v5: separator-based + page-break-based day detection.
- Day boundaries are: (a) lines ending with *, (b) short lines after PAGE_NUM+MONTH_HDR
- Comprehensive OCR-aware ordinal patterns
- Validates day number against month section
"""
import sys, re, json

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

RAW = r'C:\Users\MATTPR~1\AppData\Local\Temp\claude\C--Users-matt-proia-Desktop-still-app\2f79dadb-c5ac-473c-9cad-8a8552499d6b\scratchpad\martyrology_raw.txt'
with open(RAW, 'rb') as f:
    data = f.read()
text = data.decode('utf-8', errors='replace')
lines = text.split('\n')

MONTH_HDR = re.compile(r'^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)[.,]?\s*$')
PAGE_NUM  = re.compile(r'^\s*\d+\s*$')
# Separator: SHORT lines that are just * or "— *" (max 10 chars)
# Day headers ending with * are longer and should NOT be treated as separators
SEPARATOR = re.compile(r'^[\s\—\-]*[\*\+]\s*$')

month_order = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
months_days = {1:31,2:28,3:31,4:30,5:31,6:30,7:31,8:31,9:30,10:31,11:30,12:31}

# Comprehensive OCR ordinal patterns — most specific first
ORDINAL_PAIRS = [
    # 31 — thirty-first: "XTbtrt^ffxrst", "XCbtrt^^jfirst" variants
    (r'thirty.?first|ubirt.{1,5}ff|ubirt.*first|xcbtrt.*first|xcbtrt.*fftrst|xcbtrt.*jfirst|xtbtrt.*first|xtbtrt.*ffxrst|xtbtrt.*fftrst', 31),
    # 30 — thirtieth: "Ubfrttetb", "XTbtrtietb" variants
    (r'thirtieth|ubirttetb|ubtrtieth|xtbtrtietb|xbtrtiet[bh]|tbtrtiet[bh]|ubfrttetb|ubfrt.*tetb', 30),
    # 29 — twenty-ninth, various OCR
    (r'twenty.?ninth|xtwenti.*ninth|uwenty.*ninth|uwent.*rintb|uwent.*[il]?[fu]ntb|.t?went.{1,4}.[fu]ntb|zt?went.{1,4}.[il][fu]ntb', 29),
    # 28 — twenty-eighth: "ZvQcntv*TEiQhth" variant
    (r'twenty.?eighth|uwenty.{1,8}btgbtb|uwenty.{1,8}eighth|uwentp.{1,8}tgbtb|uwent.{1,8}igbtb|uwent.{1,8}oigbtb|uwent.{1,8}0igbtb|t.?went.{1,8}bigbtb|t.?went.{1,8}bigbtfo|uwent.{1,8}bigbtb|z.?qcntv.*eiqhth|ttwen.{1,8}teiqhth', 28),
    # 27 — twenty-seventh: "Se\>entb", "U\vent£=5ev>entb" variants
    (r'twenty.?seventh|uwent.{1,8}seventb|uwenty.{1,8}seventh|uwent.{1,8}sepentb|uwent.{1,8}5e.{1,2}entb|uwent.{1,8}5entb|zwenty.*cventh|se.entb|u.vent.{1,8}5ev', 27),
    # 26 — twenty-sixth
    (r'twenty.?sixth|uwenty.{1,8}stxtb|uwentg.{1,8}stxtb|uwenty.{1,8}sixth|uwenty.{1,8}sxxtb|uwent.{1,8}ixtb|.went.{1,4}ixtb', 26),
    # 25 — twenty-fifth
    (r'twenty.?fifth|uwents.{1,8}fifth|uwenty.{1,8}fifth|uwent.{1,4}fftftb|uwent.{1,4}fiftb|.went.{1,4}fftftb', 25),
    # 24 — twenty-fourth
    (r'twenty.?fourth|uwents.{1,8}fourtb|uwenty.{1,8}fourth|uwent.{1,4}fourtb', 24),
    # 23 — twenty-third
    (r'twenty.?third|uwents.{1,8}umrt|uwenty.{1,8}third|uwents.{1,8}ubxrd|uwent.{1,8}[xu]?birfc|ewent.{1,8}birfc|.went.{1,8}birfc|t.?went.{1,8}birfc|uwent.{1,8}ubirt|uwent.{1,4}ubtrfc', 23),
    # 22 — twenty-second: OCR variants
    (r'twenty.?second|uwent.{1,8}seconfc|uwent.{1,8}second|uwent.{1,8}sccont|uwent.{1,8}scconb|t.?went.{1,4}seconfc|u.vent.{1,8}5econt|uwent.{1,8}eccmb', 22),
    # 21 — twenty-first
    (r'twenty.?first|went.{1,8}jfirst|uwent.{1,8}first|uwenty.{1,8}first|uwent.{1,4}ffirst|uwent.{1,4}fftrst|.went.{1,4}fftrst|t.?went.{1,4}fivbt|t.?wcnt.{1,4}fivbt|tlwcnt.*fivbt', 21),
    # 20 — twentieth: many OCR variants
    (r'twentieth|uwentieth|uwentteth|uwentp?etb|uwentxetb|xtwentietb|uwenttetf|ftwenttetf|uwentietb', 20),
    # 19 — nineteenth: "IRtneteentb", "IFlineteentb" variants
    (r'nineteenth|irtneteentb|irtnteenth|irineteentb|irinteenth|ifuneteentb|ifunteenth|ir?tneteentb|if?lineteentb', 19),
    # 18 — eighteenth: "3£tgMeentb", "3£tgbteentb" variants
    (r'eighteenth|etgbteentb|eigbteentb|eighteentb|btabteentb|btabt?eentb|lexgbteentb|btGbteentb|btg.*eentb|je?tgbteentb|3.tg.?eentb|3.tg.*eentb', 18),
    # 17 — seventeenth
    (r'seventeenth|seventeentb', 17),
    # 16 — sixteenth: "Sixteentb" variant
    (r'sixteenth|stxteentb|sixteeuth|stxteeuth|sixteentb|sixteeut', 16),
    # 15 — fifteenth: "ffffteentb" variant (ffff variant)
    (r'fifteenth|ffifteentb|fifteeuth|ffxfteentb|jfifteentb|fff?fteentb|ffffteentb', 15),
    # 14 — fourteenth
    (r'fourteenth|tfourteentb|ffourteentb', 14),
    # 13 — thirteenth
    (r'thirteenth|ubtrteentb|ubirteentb|ubxrteentb|ubtrteenth', 13),
    # 12 — twelfth
    (r'twelfth|uwelftb|uwelftfo|twelftb|xtwelftb|uwelftfo', 12),
    # 11 — eleventh: many OCR variants observed
    (r'eleventh|bleventb|bleventfo|ble.{1,3}entb|j.{1,3}le.{1,3}ent.|i.{0,2}ie.{1,3}entf', 11),
    # 10 — tenth
    (r'tenth|uentb|tentb|xentb|xtentb', 10),
    # 9 — ninth: many OCR variants
    (r'ninth|iruntb|rintb|rfuntb|irntntb|ntntb|ifuntb|iftntb|xfuntb|iruptb|irtntb|iruntb', 9),
    # 8 — eighth: "Bigbtb", "JEigbtb", "JBiQhth", "3£tabtb", "jEtgbtb" variants
    (r'eighth|btgbtb|eigbtb|btgbth|btgbttb|je?igbtb|jb?igbtb|jb.iqhth|3.tabtb|bigbtb|jEtgbtb|je?tgbtb', 8),
    # 7 — seventh: includes "Sepentb" variant
    (r'seventh|seventb|sepentb', 7),
    # 6 — sixth
    (r'sixth|stxtb|sfxtb|sixtb|sxxtb', 6),
    # 5 — fifth
    (r'fifth|jfiftb|fiftb', 5),
    # 4 — fourth
    (r'fourth|ffourtb|fourtb|ffourtfo', 4),
    # 3 — third
    (r'third|umrfc|ubtrfd|ubirfc|umrd|ubtrfc', 3),
    # 2 — second
    (r'second|seconfc', 2),
    # 1 — first: careful not to match "twenty-first" (already caught above)
    (r'(?<!\S)(?:fftrst|ffirst|ftrst|fust|first)(?!\S)', 1),
]

def parse_ordinal(line):
    ll = line.lower()
    for pattern, day in ORDINAL_PAIRS:
        if re.search(pattern, ll):
            return day
    return None

# "of" / "ot" (OCR variants) as day header signature
OF_PAT = re.compile(r'\s+(?:of|ot)\s+', re.IGNORECASE)

def is_day_header_candidate(s, month_num):
    """True if this short line could be a day header (has ordinal + of/ot or month)."""
    if not s or len(s) > 72 or len(s) < 8:
        return False
    if PAGE_NUM.match(s) or MONTH_HDR.match(s) or SEPARATOR.match(s):
        return False
    # Must have ordinal
    if parse_ordinal(s) is None:
        return False
    # Must have "of" or "ot" — all day headers say "The Xth Day of Month"
    return bool(OF_PAT.search(s))

def clean(text):
    text = re.sub(r'  +', ' ', text)
    text = re.sub(r'(\w)-\s+([a-z])', r'\1\2', text)
    return text.strip()

def split_em_dash(text):
    return re.split(r'\s*[—]\s*', text)

def make_entry(raw):
    raw = clean(raw)
    if len(raw) < 6:
        return None
    skip = [
        r'^answer',
        r'^n\.\s*b\.',
        r'^(also|and)\s+in\s+(other\s+)?places',
        r'^\s*$',
        r'^the\s+reading\s+of',
        r'^terminated',
    ]
    for p in skip:
        if re.match(p, raw, re.IGNORECASE):
            return None

    if len(raw) > 350:
        m = re.search(r'[.!?]\s', raw[:280])
        raw = raw[:m.end()].strip() if m else raw[:280].strip()

    raw = re.sub(r'^[TNHZ]\s+T\s+', 'At ', raw)
    raw = re.sub(r'^(rp|r[A-Z]|TN\s|ZTH?|rpH?|ZT\s)HE\s+', 'The ', raw, flags=re.IGNORECASE)
    raw = re.sub(r'^[A-Z]\s*\^\s+', '', raw)
    raw = clean(raw)

    m = re.match(
        r'(?:At\s+[^,]+,\s+)?(?:the\s+\w+\s+of\s+)?(?:of\s+)?'
        r'(SS?|Blessed?)\.\s+([\w\s\-]+?)(?:,\s+(.+))?$',
        raw, re.IGNORECASE)
    if m:
        prefix = 'St.' if m.group(1).lower().startswith('s') else 'Blessed'
        name = prefix + ' ' + m.group(2).strip().rstrip(',.')
        desc = clean(m.group(3) or '').split('.')[0]
        entry = {'name': name}
        if desc and len(desc) > 3:
            entry['desc'] = desc[:200]
        return entry

    raw_clean = re.sub(r'^[^A-Za-zÀ-ÿ]+', '', raw).strip()
    if not raw_clean:
        return None
    name = raw_clean.split(',')[0].strip()
    if '.' in name[:80] and len(name.split('.')[0]) > 4:
        name = name.split('.')[0].strip()
    if len(name) < 4:
        return None
    if len(name) > 150:
        name = name[:147] + '...'
    return {'name': name}

# -------- Month boundaries --------
month_starts = {}
for i, l in enumerate(lines):
    s = l.strip()
    if MONTH_HDR.match(s):
        mn = month_order.index(MONTH_HDR.match(s).group(1)) + 1
        if mn not in month_starts:
            month_starts[mn] = i

INDEX_LINE = next((i for i, l in enumerate(lines) if l.strip() == 'INDEX.'), len(lines))

def get_month_range(mn):
    start = month_starts.get(mn)
    if start is None:
        return None, None
    end = INDEX_LINE
    for mn2 in sorted(month_starts.keys()):
        if mn2 > mn:
            end = month_starts[mn2]
            break
    return start, end

# -------- Find all day-start line numbers for each month --------
# A day starts when:
# 1. We see a SEPARATOR line (anything ending with *)
# 2. We see a PAGE_NUM followed (possibly with MONTH_HDR) by a line matching is_day_header_candidate
# The day-header line itself is the first non-excluded line after the trigger.

def next_text_line(start_idx, end_idx):
    """Return index of first non-blank, non-page, non-month-hdr line at or after start_idx."""
    j = start_idx
    while j < end_idx:
        s = lines[j].strip()
        if s and not PAGE_NUM.match(s) and not MONTH_HDR.match(s):
            return j
        j += 1
    return None

martyrology = {}

for mn in range(1, 13):
    start, end = get_month_range(mn)
    if start is None:
        continue

    # Identify all day-header line indices within this month's range
    # Strategy: look for is_day_header_candidate lines, possibly after sep or page-break
    day_hdrs = []  # (line_idx, day_num)

    # Also collect separator positions
    sep_positions = set()
    for i in range(start, end):
        s = lines[i].strip()
        # Separator: line ending with * (bare or "— *")
        if SEPARATOR.match(s) and len(s) <= 10:
            # Find next text line
            j = next_text_line(i + 1, end)
            if j and is_day_header_candidate(lines[j].strip(), mn):
                sep_positions.add(j)

    # Also scan ALL lines in month range for day header candidates
    # This catches days that start without a separator (e.g. Sep 11 after page break)
    scan_positions = set()
    for i in range(start, end):
        s = lines[i].strip()
        if is_day_header_candidate(s, mn):
            scan_positions.add(i)

    # Combine all day-header positions
    all_positions = sep_positions | scan_positions

    # Convert positions to (idx, day_num) pairs
    for pos in sorted(all_positions):
        s = lines[pos].strip()
        d = parse_ordinal(s)
        if d and 1 <= d <= months_days[mn]:
            day_hdrs.append((pos, d))

    # Sort by line position
    day_hdrs.sort(key=lambda x: x[0])

    # Build segments: from each day header to the next
    days_found = set()
    for idx, (hdr_lineno, day_num) in enumerate(day_hdrs):
        next_hdr = day_hdrs[idx + 1][0] if idx + 1 < len(day_hdrs) else end
        text_lines = []
        for j in range(hdr_lineno + 1, next_hdr):
            s = lines[j].strip()
            if not s or PAGE_NUM.match(s) or MONTH_HDR.match(s):
                continue
            # Stop at a separator
            if SEPARATOR.match(s) and len(s) <= 10:
                break
            text_lines.append(s)

        raw_text = clean(' '.join(text_lines))
        parts = split_em_dash(raw_text)
        entries = [make_entry(p) for p in parts]
        entries = [e for e in entries if e and len(e.get('name', '')) > 3]

        key = f"{mn:02d}-{day_num:02d}"
        days_found.add(day_num)
        if key in martyrology:
            martyrology[key].extend(entries)
        else:
            martyrology[key] = entries

    missing = [d for d in range(1, months_days[mn] + 1) if d not in days_found]
    print(f"{month_order[mn-1]}: {len(days_found)}/{months_days[mn]} days.{' Missing: ' + str(missing) if missing else ' Complete!'}")

total = len(martyrology)
all_missing = [f"{mn:02d}-{d:02d}" for mn in range(1, 13) for d in range(1, months_days[mn] + 1)
               if f"{mn:02d}-{d:02d}" not in martyrology]
print(f"\nTotal: {total} days. Missing: {len(all_missing)}")
if all_missing:
    print("Missing:", all_missing[:50])

print("\n--- 01-01 (Circumcision) ---")
print(json.dumps(martyrology.get('01-01', [])[:4], indent=2, ensure_ascii=False))
print("\n--- 09-11 (Protus & Hyacinth) ---")
print(json.dumps(martyrology.get('09-11', [])[:4], indent=2, ensure_ascii=False))
print("\n--- 12-25 (Christmas) ---")
print(json.dumps(martyrology.get('12-25', [])[:4], indent=2, ensure_ascii=False))
print("\n--- 03-07 (Thomas Aquinas) ---")
print(json.dumps(martyrology.get('03-07', [])[:4], indent=2, ensure_ascii=False))
print("\n--- 08-15 (Assumption) ---")
print(json.dumps(martyrology.get('08-15', [])[:4], indent=2, ensure_ascii=False))

OUT = r'C:\Users\MATTPR~1\AppData\Local\Temp\claude\C--Users-matt-proia-Desktop-still-app\2f79dadb-c5ac-473c-9cad-8a8552499d6b\scratchpad\martyrology_v5.json'
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(martyrology, f, ensure_ascii=False, indent=2)
print(f'\nSaved: {OUT}')
