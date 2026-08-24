#!/usr/bin/env python3
"""
32 assertions for Lauds of 2026-08-10 (St Lawrence, Duplex II classis).

Written BEFORE the parser was extended. Long strings are cross-checked against
independently extracted render lines rather than against the parser's own
output; short distinctive values are hardcoded.
"""

import json
import re
import sys

from parse_hour import split_cells, heading_of, _ANT, _VERSICLE, _RESPONSE

HTML = "lauds-8-10-2026.html"
JSON = "lauds-0810.json"

ok = fail = 0
def chk(label, got, want):
    global ok, fail
    if got == want:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}\n        got  {got!r}\n        want {want!r}")


def text_fields(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("la", "en"):
                if isinstance(v, str):
                    yield v
                elif isinstance(v, list):
                    yield from (x for x in v if isinstance(x, str))
            else:
                yield from text_fields(v)
    elif isinstance(node, list):
        for x in node:
            yield from text_fields(x)


def main():
    d = json.load(open(JSON, encoding="utf-8"))
    doc = open(HTML, encoding="utf-8", errors="replace").read()
    cells = split_cells(doc)
    P = {}
    for p in d["parts"]:
        P.setdefault(p["type"], []).append(p)
    ps = P["psalmody"][0]
    fields = list(text_fields(d))

    print("=== A. structure ===")
    chk("1  hour is lauds", d["hour"], "lauds")
    chk("2  part sequence", [p["type"] for p in d["parts"]],
        ["rubric", "versicle", "psalmody", "chapter", "hymn",
         "versicle", "canticle", "collect", "conclusion"])
    chk("3  exactly one psalmody block", len(P["psalmody"]), 1)
    chk("4  psalmody has 5 items (silent-drop guard)", len(ps["items"]), 5)
    chk("5  omitted section skipped, not emitted",
        any("Preces" in str(p) for p in d["parts"]), False)

    print("=== B. the canticle (new failure mode) ===")
    chk("6  psalm refs", [i["psalm"]["ref"] for i in ps["items"]],
        ["psalm:92", "psalm:99", "psalm:62", "psalm:210", "psalm:148"])
    cant = ps["items"][3]
    chk("7  item 4 resolved to 210 via citation", cant["psalm"]["ref"], "psalm:210")
    chk("7b item 4 records the citation it keyed on",
        cant["psalm"].get("citation"), "Dan 3:57-88,56")
    cmap = json.load(open("canticle-map.json", encoding="utf-8"))
    chk("8  name alone would have been ambiguous",
        sorted(cmap["ambiguous_names"]["Canticum Trium Puerorum"]), [210, 220])

    # ---- assertion 9: MANDATORY. The Benedicite carries no Gloria Patri. ----
    cant_cell = next(la for la, en in cells
                     if any(l.startswith("Canticum Trium Puerorum") for l in la))
    gloria = [l for l in cant_cell if "Glória Patri" in l]
    chk("9a RENDER: Benedicite cell genuinely has no Gloria Patri", gloria, [])
    chk("9b PARSER: item still emitted despite absent Gloria",
        cant["psalm"]["ref"], "psalm:210")
    chk("9c PARSER: its antiphon still captured",
        bool(cant["antiphon"]["text"]["la"]), True)

    chk("10 canticle antiphon la", cant["antiphon"]["text"]["la"],
        "Misit Dóminus * Angelum suum, et liberávit me de médio ignis, et non sum æstuátus.")
    chk("11 canticle antiphon en", cant["antiphon"]["text"]["en"],
        "The Lord hath sent His Angel, * and hath delivered me out of the midst of the fire, "
        "so that I am not scorched.")   # verified against English/Sancti/08-10.txt

    print("=== C. antiphons cross-checked against render ===")
    raw_ants_la, raw_ants_en = [], []
    for la, en in cells:
        h, _ = heading_of(la)
        if h.startswith("Capitulum") or h.startswith("Canticum:"):
            break
        m = [l for l in la if _ANT.match(l)]
        n = [l for l in en if _ANT.match(l)]
        if m:
            raw_ants_la.append(_ANT.match(m[0]).group(1))
            raw_ants_en.append(_ANT.match(n[0]).group(1))
    chk("12 five antiphons found in render", len(raw_ants_la), 5)
    for i in range(5):
        chk(f"{13+i*2} antiphon {i+1} la", ps["items"][i]["antiphon"]["text"]["la"], raw_ants_la[i])
        chk(f"{14+i*2} antiphon {i+1} en", ps["items"][i]["antiphon"]["text"]["en"], raw_ants_en[i])

    print("=== D. chapter / hymn / versicle ===")
    ch = P["chapter"][0]
    chk("22 chapter citation (numbered book form)", ch["citation"], "2 Cor 9:6")
    cap_cell_la, cap_cell_en = next((la, en) for la, en in cells
                                    if heading_of(la)[0].startswith("Capitulum"))
    chk("23 chapter text la", ch["text"]["la"], cap_cell_la[2])
    chk("24 chapter text en", ch["text"]["en"], cap_cell_en[2])
    chk("25 chapter response", (ch["response"]["la"], ch["response"]["en"]),
        ("Deo grátias.", "Thanks be to God."))
    hy = P["hymn"][0]
    chk("26 hymn first line la", hy["lines"]["la"][0], "Invícte Martyr, únicum")
    chk("26b hymn first line en", hy["lines"]["en"][0],
        "Martyr of God, whose strength was steeled")
    v = P["versicle"][-1]
    chk("27 trailing versicle la", (v["v"]["la"], v["r"]["la"]),
        ("Dispérsit, dedit paupéribus.", "Iustítia eius manet in sǽculum sǽculi."))

    print("=== E. Benedictus ===")
    c = P["canticle"][0]
    chk("28 canticle name", c["name"], "benedictus")
    chk("29 antiphon slot is Ant 2 (not Ant 3)", c["antiphon"]["slot"], "Ant 2")
    ben_la, ben_en = next((la, en) for la, en in cells
                          if heading_of(la)[0].startswith("Canticum:"))
    chk("30 Benedictus antiphon la", c["antiphon"]["text"]["la"],
        _ANT.match(next(l for l in ben_la if _ANT.match(l))).group(1))
    chk("31 Benedictus antiphon en", c["antiphon"]["text"]["en"],
        _ANT.match(next(l for l in ben_en if _ANT.match(l))).group(1))

    print("=== F. collect ===")
    col = P["collect"][0]
    or_la, or_en = next((la, en) for la, en in cells if heading_of(la)[0] == "Oratio")
    chk("32 collect la", col["text"]["la"], or_la[4])
    chk("33 collect en", col["text"]["en"], or_en[4])
    chk("34 conclusion", col["conclusion"], "per-dominum")

    print("=== G. marker hygiene ===")
    for i, (g, name) in enumerate(
            [("℣", "versicle siglum"), ("℟", "response siglum"),
             ("✠", "cross (incl. mid-verse Benedictus 1:68)"), ("†", "dagger")]):
        chk(f"{35+i} no {name}", [x for x in fields if g in x], [])
    chk("39 no 'Ant.' label", [x for x in fields if x.startswith("Ant.")], [])
    chk("40 mediant preserved in all five antiphons",
        all("*" in i["antiphon"]["text"]["la"] for i in ps["items"]), True)
    chk("40b mediant preserved in Benedictus antiphon",
        "*" in c["antiphon"]["text"]["la"], True)
    chk("41 no double spaces", [x for x in fields if "  " in x], [])

    print("=== H. negative ===")
    chk("32N no commemoration block", P.get("commemoration", []), [])

    print(f"\n--- {ok} pass, {fail} fail ---")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
