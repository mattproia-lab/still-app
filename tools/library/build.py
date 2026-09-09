# Build assets/library/<slug>/ from the vault's raw texts: an index of chapters and one JSON file per
# chapter, so the app loads a text one chapter at a time. Nothing in vault/raw is edited; this reads
# the files and shapes them for display (page markers, running heads and transcriber notes dropped).
# usage: python build.py            (from anywhere; writes into the repo's assets/library)
import re, io, os, json, collections

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RAW = os.path.join(ROOT, 'vault', 'raw', 'theology')
OUT = os.path.join(ROOT, 'assets', 'library')

def read(rel):
    s = io.open(os.path.join(RAW, rel), encoding='utf-8').read().replace('\r\n', '\n')
    # drop the vault frontmatter
    if s.startswith('---\n'):
        j = s.index('\n---\n', 4); s = s[j + 5:]
    return s

def paragraphs(lines, strip_notes=True):
    """Blank-line separated blocks -> {'t':'p','s':text}; single newlines inside a block become spaces."""
    out, cur = [], []
    def flush():
        if cur:
            t = ' '.join(x.strip() for x in cur)
            t = re.sub(r'\s+', ' ', t).strip()
            if t: out.append({'t': 'p', 's': t})
        cur.clear()
    for l in lines:
        if not l.strip(): flush()
        else: cur.append(l)
    flush()
    return out

def write_text(slug, meta, chapters):
    d = os.path.join(OUT, slug); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d, f))
    index = dict(meta); index['slug'] = slug; index['chapters'] = []
    for n, (title, blocks) in enumerate(chapters, 1):
        words = sum(len(b['s'].split()) for b in blocks)
        fn = 'c%d.json' % n
        with io.open(os.path.join(d, fn), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'n': n, 'title': title, 'blocks': blocks}, f, ensure_ascii=False, separators=(',', ':'))
        index['chapters'].append({'n': n, 'title': title, 'file': fn, 'words': words})
    with io.open(os.path.join(d, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    total = sum(c['words'] for c in index['chapters'])
    print('%-14s %3d chapters %8d words' % (slug, len(chapters), total))

ROMAN = {'I':1,'V':5,'X':10,'L':50,'C':100}
def roman(s):
    t = 0
    for i, c in enumerate(s):
        v = ROMAN[c]; t += -v if i + 1 < len(s) and ROMAN[s[i+1]] > v else v
    return t

def parts_of(blocks, words_per=2400, label='Part'):
    """Cut a long run of blocks into numbered parts at paragraph boundaries."""
    parts, cur, n = [], [], 0
    for b in blocks:
        cur.append(b); n += len(b['s'].split())
        if n >= words_per: parts.append(cur); cur, n = [], 0
    if cur: parts.append(cur)
    return [('%s %d' % (label, i + 1), p) for i, p in enumerate(parts)]

# ── The renderings made for Still (Guigo II, Denis) ─────────────────────
# One shape: an H1 (skipped), H2/H3 headings as chapters, an italic line straight under a heading
# as the chapter's subtitle, *emphasis* flattened, review markers dropped from the reading text.
def rendering(rel):
    s = read(rel)
    lines = s.split('\n')
    chapters, cur, title, buf = [], None, None, []
    def flush():
        if title is not None:
            blocks = paragraphs(buf)
            if blocks: chapters.append((title, blocks))
    for l in lines:
        m = re.match(r'^(#{1,3})\s+(.*)$', l)
        if m:
            if m.group(1) == '#' or (m.group(1) == '##' and m.group(2).startswith('or,')): continue
            flush(); title = re.sub(r'\*', '', m.group(2)).strip(); buf = []
            continue
        if title is None: continue
        it = re.match(r'^\*(.+)\*\s*$', l.strip())
        if it and not any(x.strip() for x in buf):   # the chapter's own subtitle line (blank lines before it do not count)
            title = title + ' · ' + it.group(1).strip(); continue
        buf.append(re.sub(r'\*([^*]+)\*', r'\1', l).replace('[REVIEW NEEDED] ', ''))
    flush()
    return chapters

def guigo(): return rendering('saints/2026-09-08-guigo-scala-claustralium-english-rendering.md')
def denis_meditatione(): return rendering('saints/2026-09-09-denis-the-carthusian-de-meditatione-english-rendering.md')
def denis_fonte_lucis(): return rendering('saints/2026-09-09-denis-the-carthusian-de-fonte-lucis-ac-semitis-vitae-english-rendering.md')
def denis_contemplatione(): return rendering('saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-primus-english-rendering.md')
def denis_contemplatione_b2(): return rendering('saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-secundus-english-rendering.md')
def denis_contemplatione_b3(): return rendering('saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-tertius-english-rendering.md')

# ── The Cloud of Unknowing ───────────────────────────────────────────────
def cloud():
    L = read('saints/2026-09-08-cloud-of-unknowing-underhill-1922.md').split('\n')
    def idx(pat, start=0):
        for i in range(start, len(L)):
            if re.search(pat, L[i]): return i
        return -1
    t0 = idx(r'^\s*Here Beginneth a Table of the Chapters'); t1 = idx(r'AND HERE ENDETH THE TABLE', t0)
    # titles from the table: heading line then description lines
    titles = {}; k = None; desc = []
    for l in L[t0 + 1:t1]:
        m = re.match(r'^\s*THE ([A-Z\- ]+?) CHAPTER\s*$', l)
        if m:
            if k: titles[k] = ' '.join(desc).strip()
            k = m.group(1); desc = []
        elif k and l.strip(): desc.append(l.strip())
    if k: titles[k] = ' '.join(desc).strip()
    body_start = idx(r'^Here beginneth a book of contemplation')
    first = idx(r'^\s*HERE BEGINNETH THE FIRST CHAPTER', body_start)
    end = idx(r'^\s*HERE ENDETH THE CLOUD OF UNKNOWING', first)
    chapters = [('The Prayer and the Prologue', paragraphs(L[body_start:t0]))]
    heads = [i for i in range(first, end) if re.match(r'^\s*HERE BEGINNETH THE [A-Z\- ]+ CHAPTER', L[i])]
    heads.append(end)
    for a, b in zip(heads, heads[1:]):
        m = re.match(r'^\s*HERE BEGINNETH THE ([A-Z\- ]+?) CHAPTER', L[a]); k = m.group(1)
        num = len(chapters)
        t = titles.get(k, '')
        chapters.append(('%d · %s' % (num, t[:90]) if t else 'Chapter %d' % num, paragraphs(L[a + 1:b])))
    return chapters

# ── The Imitation, Challoner ─────────────────────────────────────────────
def kempis():
    s = read('saints/2026-09-08-thomas-a-kempis-following-of-christ-challoner.md')
    s = re.sub(r'\[Transcriber\'s note:.*?\]', '', s, flags=re.S)
    s = re.sub(r'\{\d+\}', '', s); s = re.sub(r'\[USCCB:[^\]]*\]', '', s)
    L = s.split('\n')
    start = next(i for i, l in enumerate(L) if l.strip() == 'Book I.')
    endm = next(i for i, l in enumerate(L) if l.strip() == 'The End.')
    book = ''; chapters = []; i = start
    cur_title, buf = None, []
    def flush():
        if cur_title:
            blocks = paragraphs(buf)
            for b in blocks: b['s'] = b['s'].replace('_', '')
            chapters.append((cur_title, blocks))
    while i < endm:
        l = L[i]
        mb = re.match(r'^\s*Book (I|II|III|IV)\.\s*$', l)
        mc = re.match(r'^\s*Chap\.? ([IVXL]+)\.?-+\s*(.*)$', l)
        if mb: book = 'Book ' + mb.group(1); i += 1; continue
        if re.match(r'^\s*End Of Book', l): i += 1; continue
        if mc:
            flush()
            t = mc.group(2)
            j = i + 1
            while j < len(L) and L[j].strip() and not L[j].strip().endswith('_.') and '_' in L[j]: t += ' ' + L[j].strip(); j += 1
            if j < len(L) and L[j].strip() and t.count('_') % 2 == 1: t += ' ' + L[j].strip(); j += 1
            t = re.sub(r'[_\s]+', ' ', t).strip().rstrip('.')
            cur_title = '%s · %s. %s' % (book, mc.group(1), t); buf = []; i = j; continue
        buf.append(l); i += 1
    flush()
    return chapters

# ── The Confessions, Pusey ───────────────────────────────────────────────
def confessions():
    L = read('doctors/2026-09-08-augustine-confessions-pusey.md').split('\n')
    heads = [i for i, l in enumerate(L) if re.match(r'^BOOK [IVX]+\s*$', l)]
    end = next(i for i, l in enumerate(L) if 'GRATIAS TIBI DOMINE' in l)
    heads.append(end)
    out = []
    for a, b in zip(heads, heads[1:]):
        out.append(('Book %s' % L[a].split()[1], paragraphs(L[a + 1:b])))
    return out

# ── The Expositions on the Psalms, Coxe's NPNF ───────────────────────────
def expositions():
    L = read('doctors/2026-09-08-augustine-expositions-on-the-psalms-npnf1-08.md').split('\n')
    heads = [i for i, l in enumerate(L) if re.match(r'^\s*Psalm [CLXVI]+\.?\s*(\[\d+\])?\s*$', l)]
    end = next(i for i, l in enumerate(L) if l.strip() == 'Indexes' and i > heads[-1])
    heads.append(end)
    out = []; seen = set()
    for a, b in zip(heads, heads[1:]):
        n = roman(re.match(r'^\s*Psalm ([CLXVI]+)', L[a]).group(1))
        if n in seen: n = 13   # the transcription heads Psalm XIII "Psalm XII." a second time
        seen.add(n)
        blocks = [x for x in paragraphs(L[a + 1:b]) if not re.match(r'^_{5,}$', x['s'])]
        heb = n + 1 if 10 <= n <= 145 else n
        out.append(('Psalm %d%s' % (n, ' (Vulgate %d)' % (n - 1) if 10 <= n <= 146 else ''), blocks))
    return out

# ── Cassian, the Conferences (NPNF II/XI) ───────────────────────────────
def cassian():
    L = read('saints/2026-09-08-cassian-conferences-gibson-npnf2-11.md').split('\n')
    start = next(i for i, l in enumerate(L) if l.strip() == 'The Conferences of John Cassian.')
    heads = [i for i in range(start, len(L)) if re.match(r'^\s*[IVXL]+\. .*Conference of Abbot .*\.\s*(\[\d+\])?\s*$', L[i])]
    # the Conferences end where the next work in the volume begins (the seven books on the Incarnation)
    end = next(i for i in range(heads[-1], len(L)) if re.match(r'^\s*(Book I\.|Preface\.)\s*$', L[i]) or L[i].strip() == 'Indexes')
    heads.append(end)
    out = []
    for a, b in zip(heads, heads[1:]):
        title = re.sub(r'\s*\[\d+\]', '', L[a].strip())
        blocks = []; buf = []
        def flush():
            for x in paragraphs(buf):
                if not re.match(r'^_{5,}$', x['s']): blocks.append(x)
            buf.clear()
        i = a + 1
        while i < b:
            l = L[i]
            if re.match(r'^\s*(The (Second|Third) Part of the Conferences)', l) or re.match(r'^\s*of John Cassian\.\s*$', l): i += 1; continue
            m = re.match(r'^\s*Chapter ([IVXL]+)\.\s*$', l)
            if m:
                flush()
                j = i + 1
                while j < b and not L[j].strip(): j += 1
                t = ''
                while j < b and L[j].strip() and not re.match(r'^\s*_{5,}', L[j]): t += ' ' + L[j].strip(); j += 1
                blocks.append({'t': 'h', 's': ('Chapter %s. ' % m.group(1)) + re.sub(r'\s+', ' ', t).strip()}); i = j; continue
            buf.append(l); i += 1
        flush()
        out.append((title, blocks))
    return out

# ── Thérèse, Taylor ──────────────────────────────────────────────────────
def therese():
    L = read('doctors/2026-09-08-therese-of-lisieux-story-of-a-soul-taylor.md').split('\n')
    pats = [(r'^PREFACE\s*$', 'Preface, by Cardinal Bourne'), (r'^PROLOGUE: ', 'Prologue · her parentage and birth'),
            (r'^CHAPTER ([IVX]+)\b(.*)$', None), (r'^EPILOGUE: ', 'Epilogue · a victim of Divine Love'),
            (r'^COUNSELS AND REMINISCENCES', 'Counsels and Reminiscences'), (r'^LETTERS OF SOEUR THERESE\s*$', 'Letters'),
            (r'^PRAYERS OF SOEUR THERESE', 'Prayers'), (r'^SELECTED POEMS OF SOEUR THERESE', 'Selected poems')]
    first = next(i for i, l in enumerate(L) if re.match(r'^PREFACE\s*$', l))
    heads = []
    for i in range(first, len(L)):
        for p, t in pats:
            m = re.match(p, L[i])
            if m:
                if t is None:
                    t = 'Chapter %s' % m.group(1) + (' · ' + m.group(2).strip().title() if m.group(2).strip() else '')
                if t == 'Letters' and any(h[1] == 'Letters' for h in heads): break
                heads.append((i, t)); break
    heads.append((len(L), None))
    out = []
    for (a, t), (b, _) in zip(heads, heads[1:]):
        blocks = [x for x in paragraphs(L[a + 1:b]) if not re.match(r'^_{5,}$', x['s']) and x['s'] != 'END OF THE AUTOBIOGRAPHY']
        out.append((t, blocks))
    return out

# ── de Sales, Ross 1924 (OCR) ────────────────────────────────────────────
def desales():
    L = read('doctors/2026-09-08-francis-de-sales-introduction-to-the-devout-life.md').split('\n')
    def clean(lines):
        out = []
        for l in lines:
            s = l.strip()
            if not s: out.append(''); continue
            if re.match(r'^(Ch\.\s*\d+\]|INTRODUCTION TO|THE DEVOUT LIFE|\[Pt\.)', s): continue   # running heads
            if re.match(r'^[\divxl]{1,4}\s*$', s, re.I): continue                                   # page numbers
            if re.match(r'^[^A-Za-z]{0,3}$', s): continue                                            # scanner noise
            out.append(re.sub(r'(\w)- $', r'\1-', l))
        # re-join hyphenated line breaks
        joined = []
        for l in out:
            if joined and joined[-1].endswith('-') and l and l[0].islower(): joined[-1] = joined[-1][:-1] + l.lstrip(); continue
            joined.append(l)
        return joined
    start = next(i for i, l in enumerate(L) if l.strip() == 'NOTICE TO THE READER')
    end = next(i for i, l in enumerate(L) if 'Vive Jesus, to whom' in l) + 3
    first = next(i for i, l in enumerate(L) if i > 1800 and re.match(r'^\s*CHAPTER', l))
    heads = [start] + [i for i in range(first, end) if re.match(r'^\s*CHAPTERS?\b', L[i])] + [end]
    out = []
    for k, (a, b) in enumerate(zip(heads, heads[1:])):
        span = L[a + 1:b]
        if k == 0:
            out.append(("Notice to the Reader, and the Author's Preface", paragraphs(clean(span)))); continue
        # the running heads name the part and the chapter more reliably than the OCR of the heading itself
        pt = next((m.group(1) for l in span for m in [re.search(r'\[Pt\. (\d)', l)] if m), None)
        ch = next((m.group(1) for l in span for m in [re.search(r'^Ch\. (\d+)\]', l.strip())] if m), None)
        t = []; j = 0
        while j < len(span) and len(t) < 4:
            x = span[j].strip()
            if x and re.match(r"^[A-Z][A-Z ,;:'\-]+$", x) and not re.match(r'^(INTRODUCTION TO|THE DEVOUT LIFE)', x): t.append(x)
            elif t: break
            j += 1
        label = ('Part %s · ' % pt if pt else '') + ('Chapter %s' % ch if ch else 'Chapter') + (' · ' + ' '.join(t).title() if t else '')
        out.append((label, paragraphs(clean(span))))
    return [c for c in out if c[1]]

# ── Budge, the Paradise (OCR, two volumes) ──────────────────────────────
def budge():
    out = []
    for vol, rel, anchors in ((1, 'saints/2026-09-08-budge-paradise-of-the-holy-fathers-vol-1.md',
                               [(r'^preface\s*$', 'Preface'), (r'^Contents  of', None), (r'Now,  by  race  the  blessed  Anthony', 'The Life of Saint Anthony, by Athanasius'),
                                (r'^PALLADIUS  the  Bishop  to  Lausus', 'The Histories of the Fathers (Palladius, Pachomius, Jerome)')]),
                              (2, 'saints/2026-09-08-budge-paradise-of-the-holy-fathers-vol-2.md',
                               [(r'^WHEN  Abba  Arsenius  was  in  the  palace', 'The Sayings of the Fathers'), (r'^INDEX\s*$', None)])):
        L = read(rel).split('\n')
        pos = []
        for pat, t in anchors:
            for i, l in enumerate(L):
                if re.search(pat, l): pos.append((i, t)); break
        pos.sort()
        cuts = [(i, t) for i, t in pos]
        cuts.append((len(L), None))
        for (a, t), (b, _) in zip(cuts, cuts[1:]):
            if t is None: continue
            lines = []
            for l in L[a:b]:
                s = re.sub(r'\s{2,}', ' ', l).strip()
                if not s: lines.append(''); continue
                if re.match(r'^[^A-Za-z]{0,4}$', s) or re.match(r'^\d{1,3}$', s): continue
                if len(s) < 40 and re.match(r'^[A-Za-z\W]+$', s) and s == s.upper(): continue   # running titles
                if re.match(r'^(Ubc|Xife|Bntbon|\^|cn)', s): continue
                lines.append(s)
            blocks = paragraphs(lines)
            parts = parts_of(blocks, 2400, t + ' ·')
            out.extend(parts)
    return out

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_text('devout-life', {'title': 'Introduction to the Devout Life', 'author': 'Francis de Sales', 'source': 'vault/raw/theology/doctors/2026-09-08-francis-de-sales-introduction-to-the-devout-life.md (Ross, 1924; OCR)'}, desales())
    write_text('imitation', {'title': 'The Imitation of Christ', 'author': 'Thomas à Kempis', 'source': 'vault/raw/theology/saints/2026-09-08-thomas-a-kempis-following-of-christ-challoner.md (Challoner, 1819)'}, kempis())
    write_text('paradise', {'title': 'The Paradise of the Holy Fathers', 'author': 'E. A. Wallis Budge, translator', 'source': 'vault/raw/theology/saints/2026-09-08-budge-paradise-of-the-holy-fathers-vol-1.md and -vol-2.md (1907; OCR)'}, budge())
    write_text('conferences', {'title': 'The Conferences', 'author': 'John Cassian', 'source': 'vault/raw/theology/saints/2026-09-08-cassian-conferences-gibson-npnf2-11.md (Gibson, 1894)'}, cassian())
    write_text('cloud', {'title': 'The Cloud of Unknowing', 'author': 'Anonymous, fourteenth century', 'source': 'vault/raw/theology/saints/2026-09-08-cloud-of-unknowing-underhill-1922.md (Underhill, 1922)'}, cloud())
    write_text('story-of-a-soul', {'title': 'The Story of a Soul', 'author': 'Thérèse of Lisieux', 'source': 'vault/raw/theology/doctors/2026-09-08-therese-of-lisieux-story-of-a-soul-taylor.md (Taylor, 1912)'}, therese())
    write_text('confessions', {'title': 'The Confessions', 'author': 'Augustine of Hippo', 'source': 'vault/raw/theology/doctors/2026-09-08-augustine-confessions-pusey.md (Pusey, 1838)'}, confessions())
    write_text('expositions', {'title': 'Expositions on the Psalms', 'author': 'Augustine of Hippo', 'source': 'vault/raw/theology/doctors/2026-09-08-augustine-expositions-on-the-psalms-npnf1-08.md (Coxe, 1888)'}, expositions())
    write_text('ladder', {'title': 'The Ladder of Monks', 'author': 'Guigo II', 'source': 'vault/raw/theology/saints/2026-09-08-guigo-scala-claustralium-english-rendering.md (rendering for Still, 2026)'}, guigo())
    write_text('denis-meditatione', {'title': 'On Meditation', 'author': 'Denis the Carthusian', 'source': 'vault/raw/theology/saints/2026-09-09-denis-the-carthusian-de-meditatione-english-rendering.md (rendering for Still, 2026, from Opera omnia XLI, 1912)'}, denis_meditatione())
    write_text('denis-fonte-lucis', {'title': 'On the Fountain of Light', 'author': 'Denis the Carthusian', 'source': 'vault/raw/theology/saints/2026-09-09-denis-the-carthusian-de-fonte-lucis-ac-semitis-vitae-english-rendering.md (rendering for Still, 2026, from Opera omnia XLI, 1912)'}, denis_fonte_lucis())
    write_text('denis-contemplatione', {'title': 'On Contemplation (Book I)', 'author': 'Denis the Carthusian', 'source': 'vault/raw/theology/saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-primus-english-rendering.md (rendering for Still, 2026, from Opera omnia XLI, 1912)'}, denis_contemplatione())
    write_text('denis-contemplatione-b2', {'title': 'On Contemplation (Book II)', 'author': 'Denis the Carthusian', 'source': 'vault/raw/theology/saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-secundus-english-rendering.md (rendering for Still, 2026, from Opera omnia XLI, 1912)'}, denis_contemplatione_b2())
    write_text('denis-contemplatione-b3', {'title': 'On Contemplation (Book III)', 'author': 'Denis the Carthusian', 'source': 'vault/raw/theology/saints/2026-09-09-denis-the-carthusian-de-contemplatione-liber-tertius-english-rendering.md (rendering for Still, 2026, from Opera omnia XLI, 1912)'}, denis_contemplatione_b3())
