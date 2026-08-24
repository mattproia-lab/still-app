#!/usr/bin/env python3
"""
Build the hymn index from RENDERED output, not from source.

Why: some hymns do not exist in the corpus as literal text. DO generates them
by applying sed substitutions to another block
(`@:Hymnus Laudes:s/Invícte Martyr,/Martyr Dei, qui/ ...`), so
'Huius orátu, Deus alme, nobis' appears nowhere in Latin/ and can never be
indexed from source. Indexing from renders makes every hymn that can appear
indexable by construction, and dissolves three separate source-side problems:
substitution-derived hymns, block names with a trailing underscore
(`[Hymnus Laudes_]`, which `\\bLaudes\\b` will not match), and hymns whose
render opens with a rubric line.

Identity is the hymn's TEXT. Measured over 2463 rendered hymn blocks spanning
2026-08-24..2028-12-31: 140 distinct first lines, of which only 7 carry more
than one distinct body. Those 7 get a short content hash appended; the other
133 are keyed on the first line alone.

  python build_hymn_map_rendered.py <parsed_out_dir> > hymn-map.json
"""

import hashlib
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path


def slug(text, limit=48):
    """Accent-folded, lowercase, hyphenated identifier."""
    s = unicodedata.normalize("NFKD", text)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("æ", "ae").replace("Æ", "ae").replace("œ", "oe").replace("Œ", "oe")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s[:limit].rstrip("-")


def body_hash(lines):
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()[:6]


# The hymn's scope brace supplies the namespace -- the same disambiguator the
# psalmody source uses. It names WHERE the hymn came from, never which key:
# 'ex Commune aut Festo' does not say which common.
_NS = [
    ("ex Commune aut Festo", "commune"),
    ("ex Proprio Sanctorum", "proper"),
    ("ex Proprio de Tempore", "tempora"),
    ("ex Psalterio", "psalter"),
]


def namespace_of(scope):
    if not scope:
        return "unscoped"
    for needle, ns in _NS:
        if needle in scope:
            return ns
    return "unscoped"


def harvest(out_dir):
    """(namespace, first_line, body_hash) -> {lines, hours, scopes, count}"""
    seen = defaultdict(lambda: {"hours": set(), "scopes": set(),
                                "count": 0, "lines": None})
    for path in sorted(Path(out_dir).glob("20*/*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        for p in d["parts"]:
            if p.get("type") != "hymn":
                continue
            la = (p.get("lines") or {}).get("la") or []
            if not la:
                continue
            ns = namespace_of(p.get("scope"))
            key = (ns, la[0], body_hash(la))
            rec = seen[key]
            rec["hours"].add(d["hour"])
            if p.get("scope"):
                rec["scopes"].add(p["scope"])
            rec["count"] += 1
            rec["lines"] = la
    return seen


def build(out_dir):
    seen = harvest(out_dir)
    by_ns_first = defaultdict(list)
    for (ns, first, bh), rec in seen.items():
        by_ns_first[(ns, first)].append((bh, rec))

    # index is keyed on the first line; each entry carries per-namespace refs so
    # the parser can disambiguate with the scope it already parses.
    index, ambiguous = defaultdict(dict), {}
    for (ns, first), variants in by_ns_first.items():
        base = f"hymn:{ns}/{slug(first)}"
        if len(variants) == 1:
            bh, rec = variants[0]
            index[first][ns] = {"ref": base, "hours": sorted(rec["hours"]),
                                "occurrences": rec["count"]}
        else:
            # Same namespace AND same opening line, but genuinely different
            # text -> content-address as a last resort.
            entries = []
            for bh, rec in sorted(variants, key=lambda v: -v[1]["count"]):
                entries.append({"ref": f"{base}--{bh}", "body": bh,
                                "hours": sorted(rec["hours"]),
                                "occurrences": rec["count"]})
            index[first][ns] = entries[0]
            ambiguous.setdefault(first, {})[ns] = entries
    return dict(index), ambiguous, seen


if __name__ == "__main__":
    index, ambiguous, seen = build(sys.argv[1])
    total = sum(r["count"] for r in seen.values())
    multi_ns = {k: sorted(v) for k, v in index.items() if len(v) > 1}
    print(json.dumps({
        "note": "built from rendered output; identity is the hymn text. "
                "Unambiguous first lines key on the line alone; the few that "
                "carry more than one body are content-addressed with --<hash>.",
        "blocks_harvested": total,
        "distinct_first_lines": len(index),
        "resolved_by_scope": len(multi_ns),
        "ambiguous_after_scope": len(ambiguous),
        "index": index,
        "same_line_multiple_namespaces": multi_ns,
        "ambiguous_by_body": ambiguous,
    }, ensure_ascii=False, indent=2))
