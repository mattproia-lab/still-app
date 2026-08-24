#!/usr/bin/env python3
"""Assertions for the two closed gaps: hymn ref resolution, derived psalmody source."""
import json, subprocess, sys, os
from parse_hour import load_hymn_map, load_canticle_map

ok = fail = 0
def chk(l, g, w):
    global ok, fail
    if g == w: ok += 1; print(f"  PASS  {l}")
    else: fail += 1; print(f"  FAIL  {l}\n        got  {g!r}\n        want {w!r}")

def run(html, meta):
    out = subprocess.run([sys.executable, "parse_hour.py", html, json.dumps(meta)],
                         capture_output=True, text=True, encoding="utf-8",
                         env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return json.loads(out.stdout), out.stderr

def part(d, t):
    return next(p for p in d["parts"] if p["type"] == t)

print("=== 1. hymn ref resolution across all three namespaces ===")
# Refs are render-derived: hymn:<namespace>/<slug-of-first-line>. The namespace
# comes from the scope brace; the specific key (c1, day2) and the hour cannot
# survive render-derivation -- the scope names WHERE a hymn came from, not WHICH.
cases = [
    ("hy-12-25-2026-prayVespera.html", "vespers", "hymn:proper/iesu-redemptor-omnium", "PROPER"),
    ("hy-6-24-2026-prayVespera.html",  "vespers", "hymn:proper/ut-queant-laxis-resonare-fibris", "PROPER"),
    ("vespers-default.html",           "vespers", "hymn:commune/exsultet-orbis-gaudiis",          "COMMUNE"),
    ("lauds-8-10-2026.html",           "lauds",   "hymn:proper/invicte-martyr-unicum",           "PROPER"),
    ("hy-9-1-2026-prayVespera.html",   "vespers", "hymn:psalter/telluris-alme-conditor",        "PSALTER"),
    ("hy-9-1-2026-prayLaudes.html",    "lauds",   "hymn:psalter/ales-diei-nuntius",         "PSALTER"),
    ("matutinum-default.html",         "vigils",  "hymn:commune/aeterna-christi-munera",        "COMMUNE/vigils"),
]
seen_ns = set()
for html, hour, want, tag in cases:
    d, _ = run(html, {"office": "x", "hour": hour, "sources": []})
    got = part(d, "hymn")["ref"]
    chk(f"{tag:15} {html[:28]:30}", got, want)
    if got: seen_ns.add(got.split("/")[0])
chk("all three namespaces exercised", sorted(seen_ns),
    ["hymn:commune", "hymn:proper", "hymn:psalter"])

print("=== 2. hymn resolution survives a leading rubric line ===")
d, _ = run("hy-3-25-2026-prayVespera.html", {"office": "x", "hour": "vespers", "sources": []})
h = part(d, "hymn")
chk("3-25 Vespers rubric split out; hymn resolves to its real first line",
    h["ref"], "hymn:proper/ave-maris-stella")
rubs = [p for p in d["parts"] if p["type"] == "rubric" and (p.get("text") or {}).get("la")]
chk("3-25 the rubric is emitted as its own block",
    any("Prima stropha" in r["text"]["la"] for r in rubs), True)
chk("3-25 that rubric is audio:skip",
    all(r.get("audio") == "skip" for r in rubs
        if "Prima stropha" in (r["text"]["la"] or "")), True)
chk("3-25 rubric text is NOT inside the hymn lines",
    any("Prima stropha" in l for l in h["lines"]["la"]), False)

print("=== 3. psalmody source DERIVED from the render, not passed in ===")
# deliberately pass a WRONG psalmody_source; output must ignore it
d, err = run("vespers-default.html",
             {"office": "x", "hour": "vespers", "sources": [],
              "psalmody_source": "GARBAGE-SHOULD-BE-IGNORED"})
src = part(d, "psalmody")["source"]
chk("metadata value does not appear anywhere", "GARBAGE" in json.dumps(d), False)
chk("source marked derived", src["derived"], True)
chk("08-24 namespace", src["namespace"], "commune")
chk("08-24 raw scope", src["scope"], "Psalmi & antiphonæ ex Commune aut Festo")

d, _ = run("lauds-8-10-2026.html", {"office": "x", "hour": "lauds", "sources": []})
src = part(d, "psalmody")["source"]
chk("08-10 namespace (proper of saints)", src["namespace"], "proprium:sanctorum")

d, _ = run("vespers-12-2-2026.html", {"office": "x", "hour": "vespers", "sources": []})
src = part(d, "psalmody")["source"]
chk("12-02 namespace (psalter by day)", src["namespace"], "psalterium:diem")

d, _ = run("hy-9-1-2026-prayLaudes.html", {"office": "x", "hour": "lauds", "sources": []})
src = part(d, "psalmody")["source"]
chk("09-01 no scheme prefix on this date", src["scheme"], None)
chk("09-01 namespace", src["namespace"], "psalterium:diem")

# Both Lauds schemes exist; found by scanning, not assumed.
d, _ = run("laudes-scheme-2-2-2026.html", {"office": "x", "hour": "lauds", "sources": []})
src = part(d, "psalmody")["source"]
chk("02-02 Lauds scheme 1 captured", src["scheme"], "Laudes:1")
chk("02-02 namespace alongside scheme", src["namespace"], "proprium:sanctorum")

d, _ = run("laudes-scheme-3-29-2026.html", {"office": "x", "hour": "lauds", "sources": []})
src = part(d, "psalmody")["source"]
chk("03-29 Lauds scheme 2 captured", src["scheme"], "Laudes:2")
chk("03-29 namespace alongside scheme", src["namespace"], "proprium:temporis")

d, _ = run("mat-8-25-2026.html", {"office": "x", "hour": "vigils", "sources": []})
src = part(d, "psalmody")["source"]
chk("08-25 vigils namespace (psalter by season)", src["namespace"], "psalterium:tempora")

print(f"\n--- {ok} pass, {fail} fail ---")
sys.exit(1 if fail else 0)
