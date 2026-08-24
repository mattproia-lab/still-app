#!/usr/bin/env python3
"""
Render and parse every day in a range, for all three hours, both languages.

Writes one JSON per (date, hour) and an error report. Nothing is judged here --
the point is to surface what breaks across a real range before the output is
used for anything.

  python run_range.py <clone>/web <out_dir> 2026-08-24 2028-12-31
"""

import datetime as dt
import json
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import parse_hour as ph

HOURS = [("vigils", "prayMatutinum"), ("lauds", "prayLaudes"), ("vespers", "prayVespera")]
VERSION = "Rubrics 1960"


def render(web, perl_lib, command, date):
    """Run DO's renderer. Returns (html, error_or_None).

    officium.pl locates DivinumOfficium/*.pm via FindBin, which resolves
    against the CWD -- so it must be run FROM the clone root with a relative
    script path, exactly as regress/scripts/generate-diff.sh does.
    """
    root = Path(web).parent
    cmd = ["perl"]
    if perl_lib:
        cmd += ["-I", perl_lib]
    cmd += ["web/cgi-bin/horas/officium.pl",
            f"version={VERSION}", f"command={command}",
            f"date={date.month}-{date.day}-{date.year}"]
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=120, cwd=str(root))
    except subprocess.TimeoutExpired:
        return None, "render-timeout"
    if p.returncode != 0:
        return None, f"render-exit-{p.returncode}"
    html = p.stdout.decode("utf-8", errors="replace")
    if "<TD" not in html:
        return None, "render-empty"
    return html, None


def main():
    web, out_dir, start_s, end_s = sys.argv[1:5]
    perl_lib = os.environ.get("PERL_LIB")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    ph.load_canticle_map(str(Path(__file__).parent / "canticle-map.json"))
    ph.load_hymn_map(str(Path(__file__).parent / "hymn-map.json"))

    start = dt.date.fromisoformat(start_s)
    end = dt.date.fromisoformat(end_s)

    problems = []          # (date, hour, kind, detail)
    counts = Counter()
    day = start
    total_days = (end - start).days + 1

    while day <= end:
        for hour, command in HOURS:
            counts["attempted"] += 1
            html, err = render(web, perl_lib, command, day)
            if err:
                problems.append((str(day), hour, err, ""))
                counts["render-failed"] += 1
                continue
            try:
                result, skipped = ph.parse_hour(html, {"hour": hour, "office": None})
            except Exception as exc:                       # noqa: BLE001
                problems.append((str(day), hour, "parse-exception",
                                 f"{type(exc).__name__}: {exc}"))
                counts["parse-exception"] += 1
                continue

            for gap in ph._known_gaps(result, {}):
                kind = ("hymn-unresolved" if gap.startswith("hymn.ref")
                        else "source-underived")
                problems.append((str(day), hour, kind, gap))
                counts[kind] += 1

            # structural sanity, not correctness
            types = [p["type"] for p in result["parts"]]
            if not types:
                problems.append((str(day), hour, "empty-parts", ""))
                counts["empty-parts"] += 1
            psalmody = [p for p in result["parts"] if p["type"] == "psalmody"]
            if not psalmody:
                problems.append((str(day), hour, "no-psalmody", ""))
                counts["no-psalmody"] += 1
            for blk in psalmody:
                for it in blk["items"]:
                    if not it["psalm"].get("ref"):
                        problems.append((str(day), hour, "psalm-unresolved",
                                         json.dumps(it["psalm"], ensure_ascii=False)))
                        counts["psalm-unresolved"] += 1

            d = out / str(day)
            d.mkdir(exist_ok=True)
            (d / f"{hour}.json").write_text(
                json.dumps(result, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8")
            counts["written"] += 1

        if (day - start).days % 30 == 0:
            done = (day - start).days + 1
            print(f"  {day}  {done}/{total_days} days", flush=True)
        day += dt.timedelta(days=1)

    report = {"range": [start_s, end_s], "counts": dict(counts),
              "problems": [{"date": a, "hour": b, "kind": c, "detail": d}
                           for a, b, c, d in problems]}
    (out / "_errors.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(counts), indent=2))
    print(f"problems: {len(problems)} -> {out / '_errors.json'}")


if __name__ == "__main__":
    main()
