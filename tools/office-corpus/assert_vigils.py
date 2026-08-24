#!/usr/bin/env python3
"""
51 assertions for Vigils across two shapes:
  2026-08-24  St Bartholomew  -- three nocturns, nine lessons
  2026-08-25  feria           -- ONE nocturn, three lessons, psalms with ranges

Written BEFORE the parser was extended.
"""

import json
import re
import sys

from parse_hour import split_cells, heading_of, _ANT

ok = fail = 0
def chk(label, got, want):
    global ok, fail
    if got == want:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}\n        got  {got!r}\n        want {want!r}")


def fields(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("la", "en"):
                if isinstance(v, str):
                    yield v
                elif isinstance(v, list):
                    yield from (x for x in v if isinstance(x, str))
            else:
                yield from fields(v)
    elif isinstance(node, list):
        for x in node:
            yield from fields(x)


def by_type(d):
    P = {}
    for p in d["parts"]:
        P.setdefault(p["type"], []).append(p)
    return P


# parenthesised prose, excluding bare verse references like (1-10)
INLINE_RUBRIC = re.compile(r"\((?![\d\s:,\-]+\))[^)]{3,60}\)")


def feast():
    """2026-08-24 -- three nocturns, nine lessons."""
    d = json.load(open("vigils-0824.json", encoding="utf-8"))
    P = by_type(d)
    # psalms and lessons interleave, so there is one psalmody block PER NOCTURN.
    # Aggregate across blocks; assert the block count separately.
    items = [i for b in P["psalmody"] for i in b["items"]]
    les = P["lesson"]
    f = list(fields(d))

    print("=== A. structure & nocturn nesting ===")
    chk("1  hour is vigils", d["hour"], "vigils")
    chk("2  three nocturns detected", d["nocturns"], 3)
    chk("2b one psalmody block per nocturn", len(P["psalmody"]), 3)
    chk("3  nine psalms", [i["psalm"]["ref"] for i in items],
        [f"psalm:{n}" for n in (18, 33, 44, 46, 60, 63, 74, 96, 98)])
    chk("4  nocturn field on each psalm", [i["nocturn"] for i in items],
        [1, 1, 1, 2, 2, 2, 3, 3, 3])
    chk("5  nine lesson blocks", len(les), 9)
    chk("6  nocturn field on each lesson", [l["nocturn"] for l in les],
        [1, 1, 1, 2, 2, 2, 3, 3, 3])
    chk("7  nocturn count read from render, not hardcoded",
        d["nocturns"], len({i["nocturn"] for i in items}))

    print("=== B. Invitatorium (repeating refrain) ===")
    inv = P["invitatory"][0]
    chk("8  invitatory psalm is 94", inv["psalm"]["ref"], "psalm:94")
    chk("9  full antiphon", inv["antiphon"]["full"]["la"],
        "Regem Apostolórum Dóminum, * Veníte, adorémus.")
    chk("10 short refrain distinct from full", inv["antiphon"]["short"]["la"],
        "Veníte, adorémus.")
    chk("11 refrain pattern in order", inv["pattern"],
        ["full", "full", "full", "short", "full", "short", "full", "short", "full"])
    chk("12 five psalm-verse chunks", len(inv["verses"]["la"]), 5)
    chk("13 mediant preserved in full antiphon",
        "*" in inv["antiphon"]["full"]["la"], True)

    print("=== C. hymn as its own section ===")
    chk("14 exactly one hymn block", len(P["hymn"]), 1)
    chk("15 vigils has NO chapter block", P.get("chapter", []), [])
    chk("16 hymn first line", P["hymn"][0]["lines"]["la"][0], "Ætérna Christi múnera,")
    chk("17 hymn last line", P["hymn"][0]["lines"]["la"][-1], "Amen.")
    chk("18 hymn scope captured", P["hymn"][0].get("scope"), "ex Commune aut Festo")

    print("=== D. Lectio three-part unit ===")
    chk("19 every lesson has benedictio and text",
        all(l.get("benedictio") and l.get("text") for l in les), True)
    chk("20 lesson 1 benedictio", les[0]["benedictio"]["la"],
        "Benedictióne perpétua benedícat nos Pater ætérnus.")
    chk("21 lesson 1 source line", les[0]["source"]["la"],
        "De Epístola prima beáti Pauli Apóstoli ad Corínthios")
    chk("22 lesson 1 citation", les[0]["citation"], "1 Cor 4:1-5")
    r = les[0]["responsory"]
    chk("23 lesson 1 responsory has body/refrain/verse",
        all(r.get(k) for k in ("body", "refrain", "verse")), True)
    chk("24 lesson 9 has NO responsory", les[8].get("responsory"), None)
    chk("25 Te Deum block emitted", len(P.get("tedeum", [])), 1)
    chk("26 exactly 8 lessons carry responsories",
        sum(1 for l in les if l.get("responsory")), 8)

    print("=== E. rubric prose (not parenthesised) ===")
    rubs = P["rubric"]
    texts = [r["text"]["la"] for r in rubs if r.get("text", {}).get("la")]
    chk("27 Pater-secreto rubric emitted",
        any(t.startswith("Pater Noster dicitur secreto") for t in texts), True)
    chk("28 all rubrics marked audio:skip",
        all(r.get("audio") == "skip" for r in rubs), True)
    chk("29 Pater-secreto rubric la", next(
        (t for t in texts if t.startswith("Pater Noster dicitur secreto")), None),
        "Pater Noster dicitur secreto usque ad Et ne nos indúcas in tentatiónem:")
    chk("30 Reliqua-omittuntur rubric emitted",
        any(t.startswith("Reliqua omittuntur") for t in texts), True)
    chk("31 those rubrics are NOT parenthesised",
        any(t.startswith("(") for t in texts
            if t.startswith("Pater Noster") or t.startswith("Reliqua")), False)
    chk("32 Absolutio is its own block, not swallowed",
        len(P.get("absolution", [])), 3)

    print("=== F. collect / conclusion / hygiene ===")
    chk("33 collect conclusion", P["collect"][0]["conclusion"], "per-dominum")
    chk("34 sequence ends collect, conclusion",
        [p["type"] for p in d["parts"]][-2:], ["collect", "conclusion"])
    for i, g in enumerate("℣℟✠†"):
        chk(f"{35+i} no marker {g}", [x for x in f if g in x], [])
    chk("39 no 'Ant.' label", [x for x in f if x.startswith("Ant.")], [])
    chk("40 mediant preserved in psalm antiphons",
        all("*" in i["antiphon"]["text"]["la"] for i in items), True)
    chk("41 no double spaces", [x for x in f if "  " in x], [])

    print("=== assertion 42: inline rubrics stripped AND emitted ===")
    chk("42a raw parenthesised rubric absent from EVERY text field",
        [x for x in f if INLINE_RUBRIC.search(x)], [])
    inline = [r for r in rubs if r.get("inline")]
    chk("42b inline rubric blocks exist", len(inline) > 0, True)
    chk("42c 'Fit reverentia' emitted as a rubric block",
        any("Fit reverentia" in (r["text"]["la"] or "") for r in inline), True)
    chk("42d 'Sequens versus dicitur flexis genibus' emitted",
        any("Sequens versus" in (r["text"]["la"] or "") for r in inline), True)
    chk("42e every inline rubric is audio:skip",
        all(r.get("audio") == "skip" for r in inline), True)
    chk("43 omitted sections skipped, not emitted",
        any("omittitur" in str(p) for p in d["parts"]), False)


def feria():
    """2026-08-25 -- ONE nocturn, three lessons, psalms carrying verse ranges."""
    d = json.load(open("vigils-0825.json", encoding="utf-8"))
    P = by_type(d)
    items = [i for b in P["psalmody"] for i in b["items"]]
    les = P["lesson"]

    print("=== G. one-nocturn counter-case ===")
    chk("44 exactly ONE nocturn", d["nocturns"], 1)
    chk("44b exactly one psalmody block", len(P["psalmody"]), 1)
    chk("45 nocturn label is 'Ad Nocturnum', not 'Nocturnus I'",
        items[0].get("nocturn_label"), "Ad Nocturnum")
    chk("46 psalmody has 9 items, not 1 (verse-range guard)", len(items), 9)
    chk("47 psalm refs", [i["psalm"]["ref"] for i in items],
        [f"psalm:{n}" for n in (34, 34, 34, 36, 36, 36, 37, 37, 38)])
    chk("48 verse ranges captured",
        [i["psalm"].get("verses") for i in items],
        ["1-10", "11-17", "18-28", "1-15", "16-29", "30-40", "2-11", "12-23", None])
    chk("49 three lessons, all nocturn 1", [l["nocturn"] for l in les], [1, 1, 1])
    chk("50 Te Deum after lesson 3", len(P.get("tedeum", [])), 1)
    chk("51 psalmody scope captured", P["psalmody"][0].get("scope"),
        "Antiphonæ ex Psalterio secundum tempora")


if __name__ == "__main__":
    feast()
    feria()
    print(f"\n--- {ok} pass, {fail} fail ---")
    sys.exit(1 if fail else 0)
