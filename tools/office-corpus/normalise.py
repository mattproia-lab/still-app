#!/usr/bin/env python3
"""
Normalise per-date parse output into the shipped corpus shape.

Per-date output duplicates heavily: the same feast recurs every year, ferial
offices repeat weekly, and hymn text is inlined into every hour that uses it.
This collapses that into:

  store/hymns.json          hymn text, once per distinct hymn
  store/psalms.json         the psalter, once, with verse refs
  propers/<office>/<hour>.json   one document per DISTINCT hour
  calendar/<year>.json      date -> the three proper keys for that day

Office keys come from the calendar index, which is derived from DO's own
Kalendarium. NOTE: they are slugs of the office TITLE, not DO's internal file
paths (Sancti/08-24) -- DO never emits those in any output. Where one office
has genuine content variants across years (Vigils lessons follow a scriptural
cycle), a numeric suffix separates them.

  python normalise.py <parsed_out_dir> <corpus_out_dir> [calendar-index.json] [psalms.json]
"""

import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HOURS = ("vigils", "lauds", "vespers")


def digest(obj):
    return hashlib.sha1(
        json.dumps(obj, ensure_ascii=False, sort_keys=True,
                   separators=(",", ":")).encode("utf-8")).hexdigest()[:12]


def kb(n):
    return f"{n/1024:,.0f} KB"


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    cal_path = sys.argv[3] if len(sys.argv) > 3 else None
    psalms_path = sys.argv[4] if len(sys.argv) > 4 else None
    cal = {}
    if cal_path and Path(cal_path).exists():
        cal = json.loads(Path(cal_path).read_text(encoding="utf-8"))["days"]
    (dst / "propers").mkdir(parents=True, exist_ok=True)
    (dst / "store").mkdir(parents=True, exist_ok=True)
    (dst / "calendar").mkdir(parents=True, exist_ok=True)

    hymns = {}                       # ref -> {la, en}
    propers = {}                     # key -> document
    seen_content = {}                # content hash -> key
    variant_counter = Counter()      # base key -> variants seen
    calendar = defaultdict(dict)     # year -> date -> {hour: key}
    stats = Counter()
    raw_bytes = 0

    for path in sorted(src.glob("20*/*.json")):
        raw = path.read_text(encoding="utf-8")
        raw_bytes += len(raw.encode("utf-8"))
        d = json.loads(raw)
        date, hour = path.parent.name, d["hour"]
        stats["hour-files"] += 1

        # lift hymn text into the shared store, leave the ref behind
        for p in d["parts"]:
            if p.get("type") == "hymn" and p.get("ref"):
                if p["ref"] not in hymns:
                    hymns[p["ref"]] = p.get("lines")
                p.pop("lines", None)

        body = {k: v for k, v in d.items() if k not in ("office",)}
        entry = cal.get(date) or {}
        if entry.get("key"):
            body["office"] = {"key": entry["key"], "title": entry.get("title"),
                              "rank": entry.get("rank")}
        content = digest(body)
        # Readable key from the calendar; a numeric suffix separates genuine
        # content variants of the same office (Vigils lessons differ by year).
        base = f"{entry['key']}/{hour}" if entry.get("key") else f"_unkeyed/{content}"
        if content not in seen_content:
            n = variant_counter[base]
            variant_counter[base] += 1
            seen_content[content] = base if n == 0 else f"{base}-{n+1}"
        key = seen_content[content]
        if key not in propers:
            propers[key] = body
            stats[f"unique-{hour}"] += 1
        calendar[date[:4]][date] = calendar[date[:4]].get(date, {})
        calendar[date[:4]][date][hour] = key

    for key, doc in propers.items():
        out_file = dst / "propers" / f"{key}.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")
    if psalms_path and Path(psalms_path).exists():
        (dst / "store" / "psalms.json").write_text(
            Path(psalms_path).read_text(encoding="utf-8"), encoding="utf-8")
    (dst / "store" / "hymns.json").write_text(
        json.dumps(hymns, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")
    for year, days in calendar.items():
        (dst / "calendar" / f"{year}.json").write_text(
            json.dumps({"year": int(year), "days": days},
                       ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")

    def dirsize(p):
        return sum(f.stat().st_size for f in p.rglob("*.json"))

    p_sz, s_sz, c_sz = (dirsize(dst / "propers"), dirsize(dst / "store"),
                        dirsize(dst / "calendar"))

    # split by hour, for the lazy-load question
    import gzip
    by_hour = defaultdict(lambda: [0, 0, 0])   # files, raw, gzip
    for f in (dst / "propers").rglob("*.json"):
        hour = next((h for h in HOURS if f.stem == h or f.stem.startswith(h + "-")),
                    "other")
        b = f.read_bytes()
        by_hour[hour][0] += 1
        by_hour[hour][1] += len(b)
        by_hour[hour][2] += len(gzip.compress(b, 9))

    def gzdir(paths):
        return len(gzip.compress(b"".join(p.read_bytes() for p in paths), 9))

    store_files = sorted((dst / "store").glob("*.json"))
    cal_files = sorted((dst / "calendar").glob("*.json"))
    daily = [f for f in (dst / "propers").rglob("*.json")
             if not (f.stem == "vigils" or f.stem.startswith("vigils-"))]
    vigils = [f for f in (dst / "propers").rglob("*.json")
              if f.stem == "vigils" or f.stem.startswith("vigils-")]
    split = {
        "install_bundle_lauds_vespers": kb(gzdir(daily + store_files + cal_files)),
        "lazy_bundle_vigils": kb(gzdir(vigils)),
        "everything_one_bundle": kb(gzdir(list((dst / "propers").rglob("*.json"))
                                          + store_files + cal_files)),
    }
    print(json.dumps({
        "input": {"hour_files": stats["hour-files"], "bytes": raw_bytes,
                  "human": kb(raw_bytes)},
        "unique_documents": {
            "total": len(propers),
            **{h: stats[f"unique-{h}"] for h in HOURS},
        },
        "hymns_in_store": len(hymns),
        "sizes": {
            "propers": kb(p_sz), "store": kb(s_sz), "calendar": kb(c_sz),
            "total": kb(p_sz + s_sz + c_sz),
        },
        "reduction": f"{100 * (1 - (p_sz + s_sz + c_sz) / raw_bytes):.1f}%",
        "by_hour": {h: {"files": v[0], "raw": kb(v[1]), "gzip": kb(v[2])}
                    for h, v in sorted(by_hour.items())},
        "bundling": split,
    }, indent=2))


if __name__ == "__main__":
    main()
