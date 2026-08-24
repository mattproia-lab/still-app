#!/usr/bin/env python3
"""
Parse one Divinum Officium rendered hour into Still's office hour schema.

Narrow by design: Vespers only, one day, one version. It exists to be checked
against a hand-verified office before it earns the right to run over a range.

Ground rules, from the render-as-oracle decision:
  - the HTML render is the source of truth, not the .txt files
  - block-level tags become newlines; every other tag becomes the EMPTY STRING.
    Never a space -- that is what corrupted drop caps ("G lória", "O mnípotens").
"""

import re
import html
import json
import sys

# --------------------------------------------------------------------------
# text extraction
# --------------------------------------------------------------------------

_BR = re.compile(r"(?i)<br\s*/?>")
_BLOCK = re.compile(r"(?i)</(p|tr|div|h1|h2|td|table)>")
_TAG = re.compile(r"<[^>]+>")

# navigation furniture the renderer injects into every cell
_NOISE = re.compile(r"^(?:\d+|Top|Next|Start|Top\s+Next)$")


def cell_lines(fragment):
    """HTML fragment -> list of clean text lines."""
    s = _BR.sub("\n", fragment)
    s = _BLOCK.sub("\n", s)
    s = _TAG.sub("", s)              # empty string, never a space
    s = html.unescape(s)
    out = []
    for line in s.split("\n"):
        line = re.sub(r"[ \t ]+", " ", line).strip()
        if line and not _NOISE.match(line):
            out.append(line)
    return out


def split_cells(doc):
    """Return [(latin_lines, english_lines), ...] in document order.

    The renderer emits one <TR> per section with two <TD> cells: Latin first
    (carrying ID='<Hour><n>'), English second (no ID).
    """
    cells = []
    for m in re.finditer(r"<TD([^>]*)>(.*?)</TD>", doc, re.S | re.I):
        attrs, body = m.group(1), m.group(2)
        cid = re.search(r"ID='([^']*)'", attrs)
        cells.append((cid.group(1) if cid else None, cell_lines(body)))
    return [(cells[i][1], cells[i + 1][1]) for i in range(0, len(cells) - 1, 2)]


# --------------------------------------------------------------------------
# line classification
# --------------------------------------------------------------------------

_HEADING = re.compile(r"^([^{]+?)\s*(?:\{(.*)\})?$")
_ANT = re.compile(r"^Ant\.\s*(.+)$")
_PSALM = re.compile(r"^Psalm(?:us)?\s+(\d+)(?:\(([\d,\-]+)\))?\s*\[(\d+)\]$")
_VERSE = re.compile(r"^\d+:\d+\w?\s")
_VERSICLE = re.compile(r"^℣\.\s*(.+)$")
_RESPONSE = re.compile(r"^℟\.\s*(.+)$")
_CITATION = re.compile(r"^(?:!)?((?:[1-4]\.?\s*)?[A-Z][a-zA-Z]+\.?\s+\d+:\d+(?:-\d+)?)$")
_OMITTED = re.compile(r"\{(?:omittitur|omit)\}")
# A canticle inside the psalmody renders by NAME, not number:
#     Canticum Trium Puerorum [4]
#     Dan 3:57-88,56          <- the disambiguating citation, next line
_CANTICLE_ITEM = re.compile(r"^Cantic(?:um|le)\s+(?:of\s+)?(.+?)\s*\[(\d+)\]$")

# citation -> DO psalm number. Unique across all 51 canticles; the NAME is not
# (Canticum Trium Puerorum is both 210 and 220), so never key on the name.
_CANTICLE_BY_CITATION = {}


_HYMN_BY_FIRST_LINE = {}


def load_hymn_map(path="hymn-map.json"):
    """first Latin line -> hymn ref. See build_hymn_map.py."""
    global _HYMN_BY_FIRST_LINE
    try:
        with open(path, encoding="utf-8") as fh:
            _HYMN_BY_FIRST_LINE = {k: v["ref"] for k, v in json.load(fh)["index"].items()}
    except OSError:
        _HYMN_BY_FIRST_LINE = {}
    return _HYMN_BY_FIRST_LINE


def resolve_hymn(lines, probe=5):
    """Resolve a hymn ref from its opening lines.

    Tries successive lines rather than assuming line 0: the render sometimes
    opens a hymn with a rubric ('Prima stropha sequentis hymni dicitur...'),
    so the first line is not always the hymn's first line.
    """
    for l in lines[:probe]:
        ref = _HYMN_BY_FIRST_LINE.get(l.strip())
        if ref:
            return ref
    return None


# Psalmody source, DERIVED from the render's scope brace (never passed in).
# The scope names the namespace but NOT the specific key -- 'ex Commune aut
# Festo' does not say which common. That identity lives in the calendar index
# ([Rule] ex C1, psalterDay), so it is deliberately absent here.
_SOURCE_RULES = [
    ("ex Commune aut Festo", "commune"),
    ("ex Proprio Sanctorum", "proprium:sanctorum"),
    ("ex Proprio de Tempore", "proprium:temporis"),
    ("ex Psalterio secundum diem", "psalterium:diem"),
    ("ex Psalterio secundum tempora", "psalterium:tempora"),
]
_SCHEME = re.compile(r"^(Laudes:\d)\s+")


def derive_psalmody_source(scope):
    """Scope brace -> {namespace, scheme, scope, derived}. None if absent."""
    if not scope:
        return None
    raw = re.sub(r"\s{2,}", " ", scope).strip()
    scheme = None
    m = _SCHEME.match(raw)
    if m:
        scheme = m.group(1)
        raw = raw[m.end():]
    namespace = None
    for needle, ns in _SOURCE_RULES:
        if needle in raw:
            namespace = ns
            break
    return {"namespace": namespace, "scheme": scheme,
            "scope": raw, "derived": True}


def load_canticle_map(path="canticle-map.json"):
    global _CANTICLE_BY_CITATION
    try:
        with open(path, encoding="utf-8") as fh:
            m = json.load(fh)
        _CANTICLE_BY_CITATION = {
            v["citation"]: int(k) for k, v in m["canticles"].items()
        }
    except OSError:
        _CANTICLE_BY_CITATION = {}
    return _CANTICLE_BY_CITATION


def heading_of(lines):
    """First line is the section heading: 'Psalmi {Psalmi & antiphonæ ...}'."""
    if not lines:
        return "", ""
    m = _HEADING.match(lines[0])
    if not m:
        return lines[0], ""
    return m.group(1).strip(), (m.group(2) or "").strip()


def pair_text(la, en):
    return {"la": la, "en": en}


# --------------------------------------------------------------------------
# liturgical marker stripping
# --------------------------------------------------------------------------
#
# Text fields carry markup that is meaningful to a reader but is noise to a
# speech synthesiser: versicle/response sigla, the "Ant." label, the "Let us
# pray" cue, the cross, and the psalm mediant.
#
# NOTE on the mediant (*): the approved record says it "must survive into the
# data; how it renders is a separate call". STRIP_MEDIANT=True reverses that on
# instruction. It is not destructive in practice -- the corpus is regenerated
# from the render, so flipping this flag and re-parsing restores it.

STRIP_MEDIANT = False

_LEAD_LABEL = re.compile(r"^\s*(?:℣\.|℟\.|Ant\.|R\.br\.)\s*")
_GLYPHS = re.compile(r"[✠†]")
_CUES = re.compile(r"^\s*(?:Orémus\.|Let us pray\.)\s*")

# Stage directions embedded mid-text: "(Fit reverentia)", "(genuflectitur)",
# "(Sequens versus dicitur flexis genibus)". Stripped from text and re-emitted
# as sibling rubric blocks so the text field is speakable with no conditionals.
# Bare verse references such as "(1-10)" are NOT rubrics.
_INLINE_RUBRIC = re.compile(r"\((?![\d\s:,\-]+\))([^)]{3,60})\)")


def extract_inline_rubrics(lines):
    """(cleaned_lines, [rubric_text, ...]) preserving order of appearance."""
    found, out = [], []
    for line in lines:
        hits = _INLINE_RUBRIC.findall(line)
        if hits:
            found.extend(h.strip() for h in hits)
            line = _INLINE_RUBRIC.sub("", line)
            line = re.sub(r"\s{2,}", " ", line).strip()
        out.append(line)
    return [l for l in out if l], found


def inline_rubric_blocks(la_lines, en_lines):
    """Strip inline rubrics from both languages; return (la, en, blocks)."""
    la_clean, la_r = extract_inline_rubrics(la_lines)
    en_clean, en_r = extract_inline_rubrics(en_lines)
    blocks = []
    for i in range(max(len(la_r), len(en_r))):
        blocks.append({
            "type": "rubric",
            "audio": "skip",
            "inline": True,
            "text": pair_text(la_r[i] if i < len(la_r) else None,
                              en_r[i] if i < len(en_r) else None),
        })
    return la_clean, en_clean, blocks


def clean(s, strip_mediant=None):
    """Strip liturgical markers from a text field destined for audio."""
    if not isinstance(s, str):
        return s
    if strip_mediant is None:
        strip_mediant = STRIP_MEDIANT
    s = _LEAD_LABEL.sub("", s)
    s = _CUES.sub("", s)
    s = _GLYPHS.sub("", s)
    if strip_mediant:
        s = s.replace("*", "")
    return re.sub(r"\s{2,}", " ", s).strip()


def clean_tree(node):
    """Apply clean() to every la/en text field in an emitted structure."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k in ("la", "en"):
                if isinstance(v, str):
                    out[k] = clean(v)
                elif isinstance(v, list):
                    out[k] = [clean(x) for x in v]
                else:
                    out[k] = clean_tree(v)
            else:
                out[k] = clean_tree(v)
        return out
    if isinstance(node, list):
        return [clean_tree(x) for x in node]
    return node


# --------------------------------------------------------------------------
# section parsers
# --------------------------------------------------------------------------

def parse_psalmody(sections):
    """Consume consecutive psalm sections into one psalmody block.

    Each section is: heading?, Ant., Psalmus N [i], verses..., Gloria, Ant.
    The first Ant. carries the flex asterisk; the trailing one is the repeat.
    """
    items = []
    for la, en in sections:
        la_ant = next((_ANT.match(l).group(1) for l in la if _ANT.match(l)), None)
        en_ant = next((_ANT.match(l).group(1) for l in en if _ANT.match(l)), None)
        pm = next((_PSALM.match(l) for l in la if _PSALM.match(l)), None)
        psalm = None
        if pm is not None:
            psalm = {"ref": f"psalm:{pm.group(1)}"}
            if pm.group(2):
                psalm["verses"] = pm.group(2)
        else:
            # A canticle: resolve by the citation on the following line.
            # NB the Benedicite (210) carries no Gloria Patri -- nothing here
            # may require a doxology or the item is silently dropped.
            for i, l in enumerate(la):
                m = _CANTICLE_ITEM.match(l)
                if not m:
                    continue
                citation = la[i + 1].strip() if i + 1 < len(la) else None
                resolved = _CANTICLE_BY_CITATION.get(citation)
                psalm = {
                    "ref": f"psalm:{resolved}" if resolved else None,
                    "citation": citation,
                    "canticle": m.group(1).strip(),
                }
                if resolved is None:
                    psalm["unresolved"] = True
                break
        if psalm is None:
            continue
        items.append({
            "antiphon": {"text": pair_text(la_ant, en_ant)},
            "psalm": psalm,
        })
    return items


def parse_chapter_hymn_versicle(la, en):
    """Vespera7: capitulum, hymn, versicle -- three blocks from one cell."""
    parts = []

    def carve(lines):
        cite = hymn_at = None
        for i, l in enumerate(lines[1:], 1):
            if cite is None and _CITATION.match(l):
                cite = (i, l)
            if hymn_at is None and l in ("Hymnus", "Hymn"):
                hymn_at = i
        return cite, hymn_at

    la_cite, la_hymn = carve(la)
    en_cite, en_hymn = carve(en)
    if la_cite is None or la_hymn is None:
        return parts

    # chapter: everything between the citation and the hymn marker
    def chapter_body(lines, cite_i, hymn_i):
        body, resp = [], None
        for l in lines[cite_i + 1:hymn_i]:
            if _RESPONSE.match(l):
                resp = _RESPONSE.match(l).group(1)
            else:
                body.append(l)
        return " ".join(body), resp

    la_body, la_resp = chapter_body(la, la_cite[0], la_hymn)
    en_body, en_resp = chapter_body(en, en_cite[0], en_hymn)
    parts.append({
        "type": "chapter",
        "citation": la_cite[1],
        "text": pair_text(la_body, en_body),
        "response": pair_text(la_resp, en_resp),
    })

    # hymn: from the marker to the first versicle
    def hymn_body(lines, hymn_i):
        out = []
        for l in lines[hymn_i + 1:]:
            if _VERSICLE.match(l):
                break
            out.append(l)
        return out

    la_lines = hymn_body(la, la_hymn)
    hymn_block = {
        "type": "hymn",
        "ref": resolve_hymn(la_lines),
        "forms": ["full"],
        "lines": pair_text(la_lines, hymn_body(en, en_hymn)),
    }
    if not hymn_block["ref"]:
        hymn_block["unresolved"] = True
    parts.append(hymn_block)

    # versicle: the trailing V/R pair
    def vr(lines):
        v = [l for l in lines if _VERSICLE.match(l)]
        r = [l for l in lines if _RESPONSE.match(l)]
        return (_VERSICLE.match(v[-1]).group(1) if v else None,
                _RESPONSE.match(r[-1]).group(1) if r else None)

    la_v, la_r = vr(la)
    en_v, en_r = vr(en)
    parts.append({"type": "versicle", "v": pair_text(la_v, en_v), "r": pair_text(la_r, en_r)})
    return parts


# Gospel canticle per hour, with the antiphon slot the 2026-08-23 trace fixed:
# Ant 1 = Magnificat at First Vespers, Ant 2 = Benedictus at Lauds,
# Ant 3 = Magnificat at Second Vespers.
_GOSPEL_CANTICLE = {
    "lauds":   ("benedictus", "Ant 2"),
    "vespers": ("magnificat", "Ant 3"),
}


def parse_gospel_canticle(la, en, hour, kind="second"):
    name, slot = _GOSPEL_CANTICLE[hour]
    if hour == "vespers" and kind == "first":
        slot = "Ant 1"
    la_ant = next((_ANT.match(l).group(1) for l in la if _ANT.match(l)), None)
    en_ant = next((_ANT.match(l).group(1) for l in en if _ANT.match(l)), None)
    return {
        "type": "canticle",
        "name": name,
        "ref": f"canticle:{name}",
        "antiphon": {"slot": slot, "text": pair_text(la_ant, en_ant)},
    }


_OREMUS = ("Orémus.", "Let us pray.")
_COMMEM = re.compile(r"^Commemorat(?:io|ion)\b\s*(?:of\s+)?(.*)$")

# Conclusion formulae, by their opening words in each language.
_CONCLUSIONS = [
    ("per-dominum", "Per Dóminum nostrum", "Through Jesus Christ"),
    ("qui-vivis", "Qui vivis et regnas", "Who livest and reignest"),
    ("per-eumdem", "Per eúndem Dóminum", "Through the same"),
    ("qui-tecum", "Qui tecum vivit", "Who liveth and reigneth"),
]


def _classify_conclusion(line_la):
    for key, la_open, _ in _CONCLUSIONS:
        if line_la.startswith(la_open):
            return key
    return None


def _collect_body(lines):
    """Lines after 'Orémus.' up to the conclusion formula.

    Returns (collect_text, conclusion_key). Drops V/R and the trailing Amen.
    """
    out, started, conclusion = [], False, None
    for l in lines:
        if l in _OREMUS:
            started = True
            continue
        if not started or _VERSICLE.match(l) or _RESPONSE.match(l):
            continue
        key = _classify_conclusion(l)
        if key or any(l.startswith(en) for _, _, en in _CONCLUSIONS):
            conclusion = conclusion or key
            continue
        out.append(l)
    return " ".join(out), conclusion


def split_commemorations(lines):
    """Split an Oratio cell into (main_lines, [commemoration_chunks])."""
    idx = [i for i, l in enumerate(lines) if _COMMEM.match(l)]
    if not idx:
        return lines, []
    chunks = []
    for j, start in enumerate(idx):
        end = idx[j + 1] if j + 1 < len(idx) else len(lines)
        chunks.append(lines[start:end])
    return lines[:idx[0]], chunks


def parse_oratio(la, en):
    """Oratio cell -> a collect block plus zero or more commemoration blocks.

    Commemorations are NOT their own table section; they are appended inside
    the Oratio cell after the collect's Amen, each introduced by a
    'Commemoratio <title>' line.
    """
    la_main, la_coms = split_commemorations(la[1:])
    en_main, en_coms = split_commemorations(en[1:])

    la_text, la_concl = _collect_body(la_main)
    en_text, _ = _collect_body(en_main)
    parts = [{
        "type": "collect",
        "text": pair_text(la_text, en_text),
        "conclusion": la_concl or "per-dominum",
    }]

    for la_c, en_c in zip(la_coms, en_coms):
        la_title = _COMMEM.match(la_c[0]).group(1).strip()
        en_title = _COMMEM.match(en_c[0]).group(1).strip()

        def first(pat, lines, grp=1):
            for l in lines:
                m = pat.match(l)
                if m:
                    return m.group(grp)
            return None

        c_la, c_concl = _collect_body(la_c[1:])
        c_en, _ = _collect_body(en_c[1:])
        parts.append({
            "type": "commemoration",
            "title": pair_text(la_title, en_title),
            "antiphon": {"text": pair_text(first(_ANT, la_c), first(_ANT, en_c))},
            "versicle": {
                "v": pair_text(first(_VERSICLE, la_c), first(_VERSICLE, en_c)),
                "r": pair_text(first(_RESPONSE, la_c), first(_RESPONSE, en_c)),
            },
            "collect": {
                "text": pair_text(c_la, c_en),
                "conclusion": c_concl or "per-dominum",
            },
            "forms": ["full"],
        })
    return parts


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------

PSALM_HEADINGS = {"Psalmi", "Psalms"}


def parse_hour(doc, meta):
    hour = meta.get("hour", "vespers")
    sections = split_cells(doc)
    if hour == "vigils":
        parts, skipped, nocturns = parse_vigils(sections, meta)
        return clean_tree({
            "office": meta.get("office"),
            "hour": hour,
            "nocturns": nocturns,
            "sources": meta.get("sources", []),
            "parts": parts,
        }), skipped
    parts = []
    skipped = []

    i = 0
    while i < len(sections):
        la, en = sections[i]
        head, scope = heading_of(la)

        if _OMITTED.search(la[0] if la else ""):
            skipped.append(la[0])
            i += 1
            continue

        if head == "Incipit":
            rub_la = [l for l in la[1:] if _is_rubric_prose(l)]
            rub_en = [l for l in en[1:] if _is_rubric_prose(l)]
            parts.append({
                "type": "rubric",
                "ref": f"ordinary:{hour}-incipit",
                "audio": "skip",
                "text": pair_text(" ".join(rub_la) or None, " ".join(rub_en) or None),
                "forms": ["full"],
            })
            la_v = next((l for l in la if _VERSICLE.match(l)), None)
            en_v = next((l for l in en if _VERSICLE.match(l)), None)
            la_r = next((l for l in la if _RESPONSE.match(l)), None)
            en_r = next((l for l in en if _RESPONSE.match(l)), None)
            parts.append({
                "type": "versicle",
                "ref": "prayer:deus-in-adjutorium",
                "v": pair_text(la_v, en_v),
                "r": pair_text(la_r, en_r),
            })

        elif head in PSALM_HEADINGS:
            run = []
            while i < len(sections):
                cell = sections[i][0]
                h, _ = heading_of(cell)
                first = not run
                if not first and h not in PSALM_HEADINGS and not _PSALM_SECTION(cell):
                    break
                run.append(sections[i])
                i += 1
            first_scope = heading_of(run[0][0])[1] if run else None
            parts.append({
                "type": "psalmody",
                "source": derive_psalmody_source(first_scope),
                "items": parse_psalmody(run),
            })
            continue

        elif head.startswith("Capitulum"):
            parts.extend(parse_chapter_hymn_versicle(la, en))

        elif head.startswith("Canticum:") or head.startswith("Canticle:"):
            parts.append(parse_gospel_canticle(la, en, hour, meta.get("kind", "second")))

        elif head == "Oratio":
            parts.extend(parse_oratio(la, en))

        elif head == "Conclusio":
            parts.append({"type": "conclusion", "ref": f"ordinary:{hour}-conclusion"})

        i += 1

    return clean_tree({
        "office": meta.get("office"),
        "hour": hour,
        "kind": meta.get("kind", "second"),
        "sources": meta.get("sources", []),
        "parts": parts,
    }), skipped


def _known_gaps(result, meta):
    """Non-blocking gaps, surfaced on stderr rather than silently accepted."""
    gaps = []
    for p in result["parts"]:
        if p.get("type") == "hymn" and p.get("unresolved"):
            first = (p.get("lines", {}).get("la") or [None])[0]
            gaps.append(f"hymn.ref unresolved; first line was {first!r}")
        if p.get("type") == "psalmody":
            src = p.get("source")
            if not src or not src.get("namespace"):
                gaps.append(f"psalmody source namespace underived from scope {src!r}")
    for p in result["parts"]:
        if p.get("type") == "psalmody":
            for it in p["items"]:
                if it["psalm"].get("unresolved"):
                    gaps.append(f"canticle unresolved: {it['psalm'].get('citation')!r}")
    return gaps


def _is_rubric_prose(line):
    """A stage direction: prose that is neither text, marker, nor structure.

    The 1960 rite emits none -- the rubrics that would produce them
    (Pater/Ave secreto) are suppressed. Kept so other versions parse.
    """
    if _VERSICLE.match(line) or _RESPONSE.match(line) or _ANT.match(line):
        return False
    if _PSALM.match(line) or _CITATION.match(line) or _VERSE.match(line):
        return False
    return line.startswith("(") and line.endswith(")")


def _PSALM_SECTION(lines):
    """True if the cell holds a psalmody item -- psalm OR canticle.

    Lauds position 4 is an OT canticle ('Canticum Trium Puerorum [4]'), so a
    psalm-only test breaks the run here and silently drops items 4 and 5.
    """
    return any(_PSALM.match(l) or _CANTICLE_ITEM.match(l) for l in lines)


# ==========================================================================
# Vigils (Matutinum)
# ==========================================================================
#
# Structurally unlike Vespers/Lauds: an invitatory with a repeating refrain, a
# hymn in its own section, psalms and lessons nested under one or three
# nocturns, and each lesson a three-part unit (benediction, reading,
# responsory). Nocturn count is READ, never assumed -- ferias have one.

_NOCTURN_HEAD = re.compile(r"^(Nocturn(?:us)?\s+[IVX]+|Ad Nocturnum|Psalmi cum lectionibus)")
_LECTIO = re.compile(r"^Lecti[oó]\s+(\d+)$|^Reading\s+(\d+)$")
_BENEDICTIO = re.compile(r"^(?:Benedictio|Benediction)\.\s*(.+)$")
_ABSOLUTIO = re.compile(r"^(?:Absolutio|Absolution)\.\s*(.+)$")
_TEDEUM = re.compile(r"^Te Deum$")
_REFRAIN = re.compile(r"^\*\s*(.+)$")

_VIGILS_HEADS = {"Incipit", "Invitatorium", "Invitatory", "Hymnus", "Hymn",
                 "Oratio", "Prayer", "Conclusio", "Conclusion"}


def _is_vigils_rubric_prose(lines):
    """A cell whose first line is bare prose -- a standalone stage direction.

    The 1960 Vigils emits two: 'Pater Noster dicitur secreto usque ad ...' and
    'Reliqua omittuntur, nisi Laudes separandae sint.' Neither is parenthesised,
    which is why the parenthesis-only test used for Vespers does not find them.
    """
    if not lines:
        return False
    first = lines[0]
    head, _ = heading_of(lines)
    if head in _VIGILS_HEADS or _NOCTURN_HEAD.match(head):
        return False
    if _VERSICLE.match(first) or _RESPONSE.match(first) or _ANT.match(first):
        return False
    if _PSALM.match(first) or _LECTIO.match(first) or _CANTICLE_ITEM.match(first):
        return False
    return bool(re.search(r"[a-zà-ÿ]{3}", first))


def parse_invitatory(la, en):
    """Antiphon + Ps 94, refrain alternating between full and short forms."""
    la_r, en_r, inline = inline_rubric_blocks(la[1:], en[1:])
    la_ants = [_ANT.match(l).group(1) for l in la_r if _ANT.match(l)]
    en_ants = [_ANT.match(l).group(1) for l in en_r if _ANT.match(l)]
    if not la_ants:
        return None, inline
    full_la = max(la_ants, key=len)
    short_la = min(la_ants, key=len)
    full_en = max(en_ants, key=len) if en_ants else None
    short_en = min(en_ants, key=len) if en_ants else None
    pattern = ["full" if a == full_la else "short" for a in la_ants]
    verses_la = [l for l in la_r
                 if not _ANT.match(l) and not _VERSICLE.match(l)
                 and not _RESPONSE.match(l)]
    verses_en = [l for l in en_r
                 if not _ANT.match(l) and not _VERSICLE.match(l)
                 and not _RESPONSE.match(l)]
    block = {
        "type": "invitatory",
        "psalm": {"ref": "psalm:94"},
        "antiphon": {"full": pair_text(full_la, full_en),
                     "short": pair_text(short_la, short_en)},
        "pattern": pattern,
        "verses": pair_text(verses_la, verses_en),
    }
    return block, inline


def parse_lesson(la, en, n_hint, nocturn):
    """One lesson: benediction, reading, and (except the last) a responsory."""
    la_c, en_c, inline = inline_rubric_blocks(la, en)
    out = list(inline)

    def bene(lines):
        return next((_BENEDICTIO.match(l).group(1) for l in lines
                     if _BENEDICTIO.match(l)), None)

    def absol(lines):
        return next((_ABSOLUTIO.match(l).group(1) for l in lines
                     if _ABSOLUTIO.match(l)), None)

    if absol(la_c):
        out.append({"type": "absolution",
                    "text": pair_text(absol(la_c), absol(en_c))})

    def carve(lines):
        idx = next((i for i, l in enumerate(lines) if _LECTIO.match(l)), None)
        if idx is None:
            return None, None, None, [], None
        m = _LECTIO.match(lines[idx])
        num = int(m.group(1) or m.group(2))
        src = cite = None
        body, i = [], idx + 1
        while i < len(lines):
            l = lines[i]
            if _VERSICLE.match(l) and "miserére" in l.lower():
                break
            if _VERSICLE.match(l) and "mercy upon us" in l.lower():
                break
            if _TEDEUM.match(l):
                break
            if _CITATION.match(l) and cite is None:
                cite = l
            elif not _VERSE.match(l) and src is None and cite is None and not body:
                src = l
            else:
                body.append(l)
            i += 1
        return num, src, cite, body, i

    num, src_la, cite, body_la, stop_la = carve(la_c)
    _, src_en, _, body_en, stop_en = carve(en_c)
    if num is None:
        return out, None

    lesson = {
        "type": "lesson",
        "n": num,
        "nocturn": nocturn,
        "benedictio": pair_text(bene(la_c), bene(en_c)),
        "source": pair_text(src_la, src_en),
        "citation": cite,
        "text": pair_text(" ".join(body_la), " ".join(body_en)),
    }

    # responsory: R. body / * refrain / V. verse / R. refrain
    tail_la = la_c[stop_la:] if stop_la else []
    tail_en = en_c[stop_en:] if stop_en else []

    def responsory(tail):
        resp = [_RESPONSE.match(l).group(1) for l in tail if _RESPONSE.match(l)]
        refr = next((_REFRAIN.match(l).group(1) for l in tail if _REFRAIN.match(l)), None)
        vers = [_VERSICLE.match(l).group(1) for l in tail if _VERSICLE.match(l)]
        body = next((r for r in resp if not r.startswith("Deo grátias")
                     and not r.startswith("Thanks be")), None)
        if not (body and refr):
            return None
        return {"body": body, "refrain": refr,
                "verse": vers[-1] if vers else None}

    r_la, r_en = responsory(tail_la), responsory(tail_en)
    if r_la:
        lesson["responsory"] = {
            "body": pair_text(r_la["body"], r_en["body"] if r_en else None),
            "refrain": pair_text(r_la["refrain"], r_en["refrain"] if r_en else None),
            "verse": pair_text(r_la["verse"], r_en["verse"] if r_en else None),
        }
    out.append(lesson)

    if any(_TEDEUM.match(l) for l in la_c):
        i = next(i for i, l in enumerate(la_c) if _TEDEUM.match(l))
        j = next((i for i, l in enumerate(en_c) if _TEDEUM.match(l)), len(en_c))
        out.append({"type": "tedeum",
                    "lines": pair_text(la_c[i + 1:], en_c[j + 1:])})
    return out, lesson


def parse_vigils(sections, meta):
    """Drive one Vigils office. Nocturn count is read from the render."""
    parts, skipped = [], []
    nocturn, nocturn_label = 0, None
    psalm_items, psalm_scope = [], None

    def flush_psalmody():
        if psalm_items:
            parts.append({"type": "psalmody", "scope": psalm_scope,
                          "source": derive_psalmody_source(psalm_scope),
                          "items": list(psalm_items)})
            psalm_items.clear()

    for la, en in sections:
        head, scope = heading_of(la)

        if _OMITTED.search(la[0] if la else ""):
            skipped.append(la[0])
            continue

        if head in ("Incipit",):
            la_c, en_c, inline = inline_rubric_blocks(la[1:], en[1:])
            parts.extend(inline)
            parts.append({"type": "rubric", "ref": "ordinary:vigils-incipit",
                          "audio": "skip", "text": pair_text(None, None),
                          "forms": ["full"]})
            v = next((l for l in la_c if _VERSICLE.match(l)), None)
            r = next((l for l in la_c if _RESPONSE.match(l)), None)
            ve = next((l for l in en_c if _VERSICLE.match(l)), None)
            re_ = next((l for l in en_c if _RESPONSE.match(l)), None)
            parts.append({"type": "versicle", "ref": "prayer:domine-labia",
                          "v": pair_text(v, ve), "r": pair_text(r, re_)})
            continue

        if head in ("Invitatorium", "Invitatory"):
            block, inline = parse_invitatory(la, en)
            parts.extend(inline)
            if block:
                parts.append(block)
            continue

        if head in ("Hymnus", "Hymn"):
            la_c, en_c, inline = inline_rubric_blocks(la[1:], en[1:])
            parts.extend(inline)
            hb = {"type": "hymn", "ref": resolve_hymn(la_c),
                  "scope": scope or None,
                  "lines": pair_text(la_c, en_c), "forms": ["full"]}
            if not hb["ref"]:
                hb["unresolved"] = True
            parts.append(hb)
            continue

        # a nocturn boundary, possibly also carrying the first psalm
        nm = _NOCTURN_HEAD.match(head)
        if nm:
            flush_psalmody()
            nocturn += 1
            nocturn_label = "Ad Nocturnum" if head.startswith("Ad Nocturnum") else head
            if scope:
                psalm_scope = scope
            # 'Ad Nocturnum' can appear as its own line inside the cell
            if any(l.startswith("Ad Nocturnum") for l in la):
                nocturn_label = "Ad Nocturnum"

        if _PSALM_SECTION(la):
            item = parse_psalmody([(la, en)])
            if item:
                it = item[0]
                it["nocturn"] = max(nocturn, 1)
                it["nocturn_label"] = nocturn_label
                psalm_items.append(it)
            continue

        if any(_LECTIO.match(l) for l in la):
            flush_psalmody()
            blocks, _ = parse_lesson(la, en, None, max(nocturn, 1))
            parts.extend(blocks)
            continue

        if head in ("Oratio", "Prayer"):
            flush_psalmody()
            parts.extend(parse_oratio(la, en))
            continue

        if head in ("Conclusio", "Conclusion"):
            flush_psalmody()
            parts.append({"type": "conclusion", "ref": "ordinary:vigils-conclusion"})
            continue

        if _is_vigils_rubric_prose(la):
            flush_psalmody()
            la_c, en_c, inline = inline_rubric_blocks(la, en)
            parts.extend(inline)
            parts.append({"type": "rubric", "audio": "skip", "inline": False,
                          "text": pair_text(la_c[0] if la_c else None,
                                            en_c[0] if en_c else None)})
            # a Pater/Absolutio cell also carries an absolution
            ab_la = next((_ABSOLUTIO.match(l).group(1) for l in la_c
                          if _ABSOLUTIO.match(l)), None)
            if ab_la:
                ab_en = next((_ABSOLUTIO.match(l).group(1) for l in en_c
                              if _ABSOLUTIO.match(l)), None)
                parts.append({"type": "absolution", "audio": None,
                              "text": pair_text(ab_la, ab_en)})
            continue

        # a bare versicle cell between psalmody and lessons
        if la and _VERSICLE.match(la[0]):
            v = _VERSICLE.match(la[0]).group(1)
            r = next((_RESPONSE.match(l).group(1) for l in la if _RESPONSE.match(l)), None)
            ve = next((_VERSICLE.match(l).group(1) for l in en if _VERSICLE.match(l)), None)
            re_ = next((_RESPONSE.match(l).group(1) for l in en if _RESPONSE.match(l)), None)
            parts.append({"type": "versicle", "v": pair_text(v, ve),
                          "r": pair_text(r, re_)})
            continue

    flush_psalmody()
    return parts, skipped, max(nocturn, 1)


if __name__ == "__main__":
    load_canticle_map()
    load_hymn_map()
    doc = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    meta = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {
        "office": "Sancti/08-24",
        "kind": "second",
        "sources": ["Sancti/08-24", "Commune/C1", "Ordinarium/Vespera"],
        "psalmody_source": "commune:C1 Ant Vespera 3",
    }
    result, skipped = parse_hour(doc, meta)
    if skipped:
        print("# skipped omitted sections: " + "; ".join(skipped), file=sys.stderr)
    for gap in _known_gaps(result, meta):
        print("# GAP (non-blocking): " + gap, file=sys.stderr)
    print(json.dumps(result, ensure_ascii=False, indent=2))
