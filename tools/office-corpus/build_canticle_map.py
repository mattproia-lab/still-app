#!/usr/bin/env python3
"""
Build the canticle name/citation -> DO psalm-number map.

Divinum Officium numbers canticles 210-273 inside its psalm namespace, but the
RENDER names them instead of numbering them:

    Canticum Trium Puerorum [4]
    Dan 3:57-88,56

The name alone is ambiguous -- 'Canticum Trium Puerorum' is both 210
(Dan 3:57-88,56) and 220 (Dan 3:52-57). The citation on the following line is
what disambiguates, so the map is keyed on (name, citation) and on citation
alone where that is unique.

Keyed off the LATIN files: the English headers disagree in places (Psalm222 is
Isa 38:10-24 in Latin, Isa 38:10-23 in English) and carry data quirks such as
'Canticle of_Tobias'.
"""

import json
import re
import sys
from pathlib import Path

HORAS = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
HEADER = re.compile(r"^\((.*?)\s*\*\s*(.*?)\)\s*$")

# Lauds canticle positions, from Psalterium/Psalmi/Psalmi major.txt
LAUDES1 = {f"Day{i}": 210 + i for i in range(7)}   # 210-216
LAUDES2 = {f"Day{i}": 220 + i for i in range(7)}   # 220-226


def build():
    by_number, by_citation, by_name = {}, {}, {}
    for path in sorted((HORAS / "Latin/Psalterium/Psalmorum").glob("Psalm2*.txt")):
        num = int(re.search(r"Psalm(\d+)", path.name).group(1))
        first = path.read_text(encoding="utf-8", errors="replace").splitlines()[0]
        m = HEADER.match(first.strip())
        if not m:
            continue
        name, citation = m.group(1).strip(), m.group(2).strip()
        by_number[num] = {"name": name, "citation": citation}
        by_citation.setdefault(citation, []).append(num)
        by_name.setdefault(name, []).append(num)
    return by_number, by_citation, by_name


if __name__ == "__main__":
    by_number, by_citation, by_name = build()
    out = {
        "note": "DO canticle numbering; key on (name, citation) from the Latin files",
        "laudes1": LAUDES1,
        "laudes2": LAUDES2,
        "canticles": {str(k): v for k, v in sorted(by_number.items())},
        "ambiguous_names": {n: v for n, v in sorted(by_name.items()) if len(v) > 1},
        "ambiguous_citations": {c: v for c, v in sorted(by_citation.items()) if len(v) > 1},
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
