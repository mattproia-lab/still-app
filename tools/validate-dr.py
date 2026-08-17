#!/usr/bin/env python3
"""
validate-dr.py — overwrite scripture.text in Rosary meditation files with
canonical Douay-Rheims (Challoner) text, keyed on scripture.ref.

Usage:
    python3 validate-dr.py dr-bible.json meditations-*.json rosary/*.json

- ref is authoritative; text is treated as a placeholder and replaced.
- Refs use DR book names (Isaias, Tobias, Canticle of Canticles,
  1 Paralipomenon, Apocalypse, DR psalm numbering). Common modern names
  are aliased; an unknown book fails loudly rather than silently skipping.
- Ranges ("Luke 2:29-30") are joined with a space.
- Every replacement that differs beyond punctuation is printed for review.

dr-bible.json is produced from Project Gutenberg etext #1581 (the Challoner
Douay-Rheims). Verse texts include DR typographic conventions as printed,
including acrostic letters in Lamentations ("Ain.") — strip those at the
display layer if desired, not here.
"""
import json, re, sys, difflib

ALIAS = {"Psalm": "Psalms", "Canticles": "Canticle of Canticles",
         "Song of Songs": "Canticle of Canticles", "Isaiah": "Isaias",
         "Revelation": "Apocalypse", "Tobit": "Tobias",
         "1 Chronicles": "1 Paralipomenon", "2 Chronicles": "2 Paralipomenon"}

def lookup(bible, ref):
    m = re.match(r'^(.*?)\s+(\d+):(\d+)(?:-(\d+))?$', ref.strip())
    if not m:
        raise ValueError(f"unparseable ref: {ref}")
    book, ch, v1, v2 = m.group(1), m.group(2), int(m.group(3)), m.group(4)
    book = ALIAS.get(book, book)
    if book not in bible:
        raise KeyError(f"unknown book {book!r} in ref {ref}")
    chap = bible[book].get(ch)
    if not chap:
        raise KeyError(f"{book} has no chapter {ch}")
    v2 = int(v2) if v2 else v1
    parts = []
    for v in range(v1, v2 + 1):
        if str(v) not in chap:
            raise KeyError(f"{book} {ch}:{v} not found")
        parts.append(chap[str(v)])
    return " ".join(parts)

def norm(s):
    return re.sub(r'[^a-z0-9 ]', '', s.lower().replace('\u2019', "'")).strip()

def records(doc):
    if "meditations" in doc:
        return doc["meditations"]
    return [m for my in doc.get("mysteries", []) for m in my["meditations"]]

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    bible = json.load(open(sys.argv[1]))
    for path in sys.argv[2:]:
        doc = json.load(open(path))
        changed = 0
        for m in records(doc):
            ref, old = m["scripture"]["ref"], m["scripture"]["text"]
            canon = lookup(bible, ref)
            if norm(old) != norm(canon):
                sim = difflib.SequenceMatcher(None, norm(old), norm(canon)).ratio()
                print(f"[{m['id']}] {ref}  similarity {sim:.2f}")
                print(f"  was : {old}")
                print(f"  now : {canon}\n")
                changed += 1
            m["scripture"]["text"] = canon
        json.dump(doc, open(path, "w"), indent=2, ensure_ascii=False)
        print(f"{path}: {changed} replaced\n")

if __name__ == "__main__":
    main()
