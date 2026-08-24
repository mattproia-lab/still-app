#!/usr/bin/env python3
"""
Harvest the psalter from RENDERED output, per the spell_var finding.

The source .txt files carry pre-normalisation orthography: spell_var() in
horascommon.pl applies version-specific Latin spelling at render time, so the
Rubrics 1960 psalter says 'huius' where the source says 'hujus'. Parsing the
sources would ship the wrong orthography silently.

Psalms are often rendered in segments -- Ps 9 appears as 2-11, 12-21, 22-32 and
33-39 -- so verses are accumulated by their own reference and unioned across
every sighting. The store therefore holds each psalm ONCE, in full, and a
verse range in an hour document is applied by filtering at render time.

  python build_psalms.py <clone>/web <out.json> <date> [<date> ...]
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from parse_hour import split_cells, cell_lines, RUBRIC_MARK  # noqa: E402

HOURS = ("prayMatutinum", "prayLaudes", "prayVespera", "prayCompletorium")
TITLE = re.compile(r"^Psalm(?:us)?\s+(\d+)(?:\([\d,\-]+\))?\s*\[\d+\]$")
CANT = re.compile(r"^Cantic(?:um|le)\s+(?:of\s+)?(.+?)\s*\[\d+\]$")
VERSE = re.compile(r"^(\d+:\d+\w?)\s+(.*)$")
CITE = re.compile(r"^[A-Za-z0-9][^:]{0,24}\s\d+:\d+")


def render(web, perl_lib, command, mdy):
    cmd = ["perl"]
    if perl_lib:
        cmd += ["-I", perl_lib]
    cmd += ["web/cgi-bin/horas/officium.pl", "version=Rubrics 1960",
            f"command={command}", f"date={mdy}"]
    p = subprocess.run(cmd, capture_output=True, cwd=str(Path(web).parent))
    return p.stdout.decode("utf-8", errors="replace")


def _segments(lines, cit2num):
    """[(number_or_None, [verse lines])] in cell order."""
    out, current, buf, started = [], None, [], False
    for i, raw in enumerate(lines):
        if raw.startswith(RUBRIC_MARK):
            continue
        line = raw
        m = TITLE.match(line)
        cm = CANT.match(line)
        if m or cm:
            if started:
                out.append((current, buf))
            if m:
                current = m.group(1)
            else:
                # English canticle citations disagree with Latin
                # ('1 Chron. 29:10-13' vs '1 Par. 29:10-13'), so this lookup
                # fails on the English side. Keep the segment anyway, unnumbered
                # -- harvest_pair assigns the number positionally from Latin.
                nxt = (lines[i + 1] if i + 1 < len(lines) else "").strip()
                current = cit2num.get(nxt)
                if current is None and nxt:
                    # same base-citation fallback the parser uses: the render
                    # applies a verse range ('Deut 32:1-27') where the canticle
                    # header gives the full span ('Deut 32:1-65')
                    bm = re.match(r"^(.*?\s\d+):(\S+)$", nxt)
                    if bm:
                        base = bm.group(1) + ":"
                        current = next((n for c, n in cit2num.items()
                                        if c.startswith(base)), None)
            buf, started = [], True
            continue
        if not started:
            continue
        vm = VERSE.match(line)
        if vm:
            buf.append((vm.group(1), vm.group(2).strip()))
        elif CITE.match(line):
            continue
        elif buf:
            out.append((current, buf))
            current, buf, started = None, [], False
    if started:
        out.append((current, buf))
    return out


def harvest_pair(la_lines, en_lines, la_store, en_store, cit2num):
    """Harvest a Latin/English cell pair.

    The LATIN side determines the psalm number for both languages: English
    canticle citations disagree with Latin ('1 Chron. 29:10-13' vs
    '1 Par. 29:10-13'), so an English-side lookup silently loses those verses.
    Segments are matched by position within the pair.
    """
    la_segs = [s for s in _segments(la_lines, cit2num) if s[1]]
    en_segs = [s for s in _segments(en_lines, cit2num) if s[1]]
    for idx, (num, verses) in enumerate(la_segs):
        if num is None:
            continue
        for ref, text in verses:
            la_store.setdefault(str(num), {})[ref] = text
        if idx < len(en_segs):
            for ref, text in en_segs[idx][1]:
                en_store.setdefault(str(num), {})[ref] = text


def main():
    web, out_path = sys.argv[1], sys.argv[2]
    dates = sys.argv[3:]
    perl_lib = os.environ.get("PERL_LIB")

    cmap = json.loads((Path(__file__).parent / "canticle-map.json")
                      .read_text(encoding="utf-8"))
    cit2num = {v["citation"]: k for k, v in cmap["canticles"].items()}

    la_store, en_store = {}, {}
    if Path(out_path).exists():
        prev = json.loads(Path(out_path).read_text(encoding="utf-8"))["psalms"]
        for num, rec in prev.items():
            for v in rec["verses"]:
                if v.get("la"):
                    la_store.setdefault(num, {})[v["ref"]] = v["la"]
                if v.get("en"):
                    en_store.setdefault(num, {})[v["ref"]] = v["en"]
        print(f"  merging into existing store ({len(prev)} psalms)", flush=True)
    for mdy in dates:
        for command in HOURS:
            doc = render(web, perl_lib, command, mdy)
            if "<TD" not in doc:
                continue
            for la, en in split_cells(doc):
                harvest_pair(la, en, la_store, en_store, cit2num)
        print(f"  {mdy}", flush=True)

    psalms = {}
    for num in sorted(set(la_store) | set(en_store), key=int):
        la_v, en_v = la_store.get(num, {}), en_store.get(num, {})
        order = sorted(set(la_v) | set(en_v),
                       key=lambda r: [int(x) for x in re.findall(r"\d+", r)])
        psalms[num] = {
            "number": int(num),
            "kind": "canticle" if int(num) > 150 else "psalm",
            "verses": [{"ref": r, "la": la_v.get(r), "en": en_v.get(r)}
                       for r in order],
        }
    Path(out_path).write_text(
        json.dumps({"translation": "Douay-Rheims / Rubrics 1960 orthography",
                    "psalms": psalms}, ensure_ascii=False,
                   separators=(",", ":")), encoding="utf-8")

    nums = sorted(int(n) for n in psalms)
    print(json.dumps({
        "harvested": len(psalms),
        "psalms_1_150": len([n for n in nums if n <= 150]),
        "canticles": [n for n in nums if n > 150],
        "total_verses": sum(len(p["verses"]) for p in psalms.values()),
        "missing_a_language": [n for n, p in psalms.items()
                               if any(v["la"] is None or v["en"] is None
                                      for v in p["verses"])][:20],
    }, indent=2))


if __name__ == "__main__":
    main()
