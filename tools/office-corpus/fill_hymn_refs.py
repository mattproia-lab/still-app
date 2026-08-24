#!/usr/bin/env python3
"""
Fill hymn refs into already-parsed output.

The hymn index is built FROM rendered output, so there is a one-pass
chicken-and-egg: the first parse emits hymn text with no ref, the index is
built from that text, and this pass writes the refs back. No re-render is
needed -- the lookup is a pure function of the hymn's first line and scope,
both already in the file.

  python fill_hymn_refs.py <out_dir> [hymn-map.json]
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import parse_hour as ph


def main():
    out_dir = Path(sys.argv[1])
    ph.load_hymn_map(sys.argv[2] if len(sys.argv) > 2
                     else str(Path(__file__).parent / "hymn-map.json"))

    counts = Counter()
    unresolved = Counter()
    for path in sorted(out_dir.glob("20*/*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for p in d["parts"]:
            if p.get("type") != "hymn":
                continue
            counts["hymn-blocks"] += 1
            lines = (p.get("lines") or {}).get("la") or []
            ref = ph.resolve_hymn(lines, p.get("scope"))
            if ref:
                if p.get("ref") != ref:
                    p["ref"] = ref
                    changed = True
                if p.pop("unresolved", None) is not None:
                    changed = True
                counts["resolved"] += 1
            else:
                p["ref"] = None
                p["unresolved"] = True
                counts["still-unresolved"] += 1
                unresolved[(lines[0] if lines else None, p.get("scope"))] += 1
                changed = True
        if changed:
            path.write_text(json.dumps(d, ensure_ascii=False,
                                       separators=(",", ":")), encoding="utf-8")
            counts["files-rewritten"] += 1

    print(json.dumps(dict(counts), indent=2))
    if unresolved:
        print("\nstill unresolved:")
        for (first, scope), n in unresolved.most_common(20):
            print(f"  {n:5}  {str(first)[:52]:54} scope={scope!r}")
    else:
        print("\nall hymn refs resolved")


if __name__ == "__main__":
    main()
