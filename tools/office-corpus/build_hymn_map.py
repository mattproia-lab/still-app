#!/usr/bin/env python3
"""
Build a hymn first-line -> ref index from the Latin corpus.

The render names a hymn only by its scope brace and its text, so the ref is
recovered from the FIRST LINE, which is the hymn's identity throughout the
tradition (Ætérna Christi múnera, Invícte Martyr únicum, ...).

Namespaces follow the earlier hymn survey:
  hymn:proper/<office-key>/<hora>   the winner's own file defines one
  hymn:commune/<C-key>/<hora>       the common defines one
  hymn:psalter/<scope>-<hora>       fallback; scope is a psalter day OR a
                                    season -- alternatives in ONE slot

Monastic blocks (HymnusM..., HymnusMMatutinumUS) are excluded: Still ships the
Roman 1960 rite, and a prefix match on 'Hymnus' would wrongly catch them.
"""

import json
import re
import sys
from pathlib import Path

HORAS = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

# Block naming is NOT consistent: Major/Minor Special use "[Hymnus Day0 Laudes]"
# but Matutinum Special reverses it to "[Day3 Hymnus]". Match either.
BLOCK = re.compile(r"^\[([^\]]*Hymnus[^\]]*)\]")
# Monastic variants: HymnusM, Hymnus1M, and "[Day0 HymnusM]" -- not just a prefix.
MONASTIC = re.compile(r"Hymnus\d*M")
HORA = re.compile(r"\b(Laudes|Vespera|Matutinum|Completorium|Prima|Tertia|Sexta|Nona)\b")
PSALTER_SCOPE = re.compile(r"\b(Day[0-6]|Adv|Quad5|Quad|Pasch)\b")


def blocks(path):
    """Yield (block_name, [content lines]) for each [Hymnus...] block."""
    name, buf = None, []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if raw.startswith("["):
            if name:
                yield name, buf
            m = BLOCK.match(raw)
            name, buf = (m.group(1) if m else None), []
        elif name:
            buf.append(raw.strip())
    if name:
        yield name, buf


LABEL = re.compile(r"^\{:[^}]*:\}")
VMARK = re.compile(r"^[vV]\.\s*")


def normalise(line):
    """Strip DO markup and apply the 1960 j->i spelling so render and source
    compare equal (horascommon.pl spell_var: tr/Jj/Ii/ when version =~ /196/)."""
    if line is None:
        return None
    line = LABEL.sub("", line).strip()
    line = VMARK.sub("", line).strip()
    line = line.lstrip("*").strip()
    return line.translate(str.maketrans("Jj", "Ii"))


def first_line(lines):
    for l in lines:
        # '@' lines are cross-references or sed-substitution derivations, not text
        if not l or l.startswith(("(", "!", "$", "&", "#", "/", "@")):
            continue
        out = normalise(l)
        if out:
            return out
    return None


def build():
    index, collisions = {}, {}

    def add(first, ref, origin):
        if first is None:
            return
        if first in index and index[first]["ref"] != ref:
            collisions.setdefault(first, [index[first]["ref"]]).append(ref)
            return
        index[first] = {"ref": ref, "origin": origin}

    # 1. psalter (Major Special / Minor Special)
    for special in ("Major Special.txt", "Minor Special.txt",
                    "Matutinum Special.txt", "Prima Special.txt"):
        p = HORAS / "Latin/Psalterium/Special" / special
        if not p.exists():
            continue
        for name, lines in blocks(p):
            if MONASTIC.search(name):
                continue
            scope = PSALTER_SCOPE.search(name)
            hora_m = HORA.search(name)
            # If the block name carries no hour, the FILE is the hour
            # (Matutinum Special.txt -> Matutinum, Prima Special.txt -> Prima).
            hora = hora_m.group(1) if hora_m else special.split(" ")[0]
            if not scope or hora not in (
                    "Laudes", "Vespera", "Matutinum", "Completorium", "Prima",
                    "Tertia", "Sexta", "Nona"):
                continue
            suffix = "-hiemalis" if "hiemalis" in name else ""
            ref = f"hymn:psalter/{scope.group(1)}-{hora}{suffix}".lower()
            add(first_line(lines), ref, f"{special}:[{name}]")

    # 2. commune
    for p in sorted((HORAS / "Latin/Commune").glob("*.txt")):
        for name, lines in blocks(p):
            if MONASTIC.search(name):
                continue
            hora = HORA.search(name)
            if not hora:
                continue
            ref = f"hymn:commune/{p.stem}/{hora.group(1)}".lower()
            add(first_line(lines), ref, f"Commune/{p.stem}:[{name}]")

    # 3. proper (Sancti + Tempora)
    for sub in ("Sancti", "Tempora"):
        for p in sorted((HORAS / "Latin" / sub).glob("*.txt")):
            for name, lines in blocks(p):
                if MONASTIC.search(name):
                    continue
                hora = HORA.search(name)
                if not hora:
                    continue
                ref = f"hymn:proper/{sub}/{p.stem}/{hora.group(1)}".lower()
                add(first_line(lines), ref, f"{sub}/{p.stem}:[{name}]")

    return index, collisions


if __name__ == "__main__":
    index, collisions = build()
    ns = {}
    for v in index.values():
        ns[v["ref"].split("/")[0]] = ns.get(v["ref"].split("/")[0], 0) + 1
    print(json.dumps({
        "note": "hymn first line (Latin) -> ref; monastic blocks excluded",
        "count": len(index),
        "by_namespace": ns,
        "collisions": collisions,
        "index": index,
    }, ensure_ascii=False, indent=2))
