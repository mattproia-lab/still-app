# Scripture — the Douay-Rheims Bible, Challoner revision

_Index into the raw text, not a replacement for it. Ingested 2026-09-08._

**Raw file:** [`raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md`](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md) — 5.86 MB, the whole of Project Gutenberg eBook #1581 between its START and END markers, verbatim, with only the Gutenberg header and licence stripped ([frontmatter](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).

## Edition

- The title page in the raw file: translated from the Latin Vulgate; the Old Testament first published by the English College at Douay in 1609 and 1610, the New Testament by the English College at Rheims in 1582; "The Whole Revised and Diligently Compared with the Latin Vulgate by Bishop Richard Challoner A.D. 1749-1752" ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).
- The etext: Project Gutenberg #1581, "The Bible, Douay-Rheims, Complete", released 1998-12-01, most recently updated 2023-09-23, credited to Dennis McCarthy and Tad Book; original publication given as "Catholic Software" ([frontmatter](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md), recorded from the Gutenberg header before it was stripped; the header itself is at <https://www.gutenberg.org/ebooks/1581>).
- Public domain in the United States: the revision is 1749–1752 and every printing it derives from predates 1929; Gutenberg distributes it as public domain in the US ([frontmatter](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).

## What the raw file holds

- The 73 books, each chapter headed "_Book_ Chapter _n_" with Challoner's chapter summary beneath, verses as "_chapter_:_verse_. text" paragraphs, and Challoner's annotations as paragraphs after the verse they gloss (for example the note "Ruleth me.... In Hebrew, Is my shepherd" after Psalm 22:1) ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).
- Book names as the Douay gives them, which the app and the vault use: Josue, 1–4 Kings (the two books of Samuel are the first and second), 1–2 Paralipomenon, 1–2 Esdras (Nehemias is the second), Tobias, Canticle of Canticles, Ecclesiasticus, Isaias, Jeremias, Ezechiel, Osee, Abdias, Jonas, Micheas, Habacuc, Sophonias, Aggeus, Zacharias, Malachias, 1–2 Machabees, Apocalypse ([table of contents in the source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).
- Psalm numbering is the Vulgate's: Psalm 117:24 is "This is the day which the Lord hath made: let us be glad and rejoice therein" (the Hebrew Psalm 118); Psalm 22 is "Dominus regit me" ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)).
- After the Apocalypse the etext carries appendices: extracts from the 1582 Rhemes and 1610 Doway printings in their original spelling, "additional books", "books for comparison", the Rheims preface to the reader and its glossary "Hard vvordes explicated" ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)). They are in the raw file and not in the app copy.

## The app-readable copy

Generated from the raw text on 2026-09-08 by a parser kept in the session scratchpad (verse paragraphs joined, headings and annotations left out), one file per book:

- [`corpus/scripture/dr/<slug>.json`](../../../corpus/scripture/dr/) — `{ "book": "Genesis", "chapters": { "1": { "1": "In the beginning God created heaven, and earth.", … } } }`, verses keyed by chapter then verse, the Douay's own text including its typographic conventions (the acrostic letters in Lamentations, for example).
- [`corpus/scripture/dr/books.json`](../../../corpus/scripture/dr/books.json) — the 73 books in canonical order with slug, testament, chapter and verse counts, and the notes below.
- Copied unchanged to [`assets/scripture/dr/`](../../../assets/scripture/dr/) for the app to fetch (and to `www/assets/scripture/dr/`); `corpus/` is a forced 404 on the site.

Counts: 73 books, 35,786 verses.

Two places where the source's numbering needs a rule, both recorded in `books.json`:

- **Psalm 113** is numbered in two series in the source, as the Vulgate has it: "In exitu Israel" 1–8, then "Non nobis" 1–18 ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)). The copy keys the second series as chapter `113b` (the scholars' Psalm 113B).
- **Proverbs 12** has two paragraphs labelled 12:12 in the etext: "He that is delighted in passing his time over wine, leaveth a reproach in his strong holds" and then "The desire of the wicked is the fortification of evil men" ([source](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md)). Printed Douay editions carry the first sentence at the end of verse 11. By Matt's decision of 2026-09-08 the app copy appends it to 12:11 and keys the second as 12; the raw file keeps the etext's labels.

Relation to the older tool file: [`tools/dr-bible.json`](../../../tools/dr-bible.json) was produced from the same etext for `validate-dr.py` and agrees with the new copy on 35,759 verses; it has Psalm 113's second series overwriting the first under the same keys, and its Proverbs 12:11 lacks the sentence the etext mislabels. It is left as it is, since the Rosary validator reads it.

## Verification, 2026-09-08

Five verses read from the app copy against the raw text:

| Reference | App copy |
|---|---|
| Genesis 1:1 | In the beginning God created heaven, and earth. |
| Psalm 117:24 | This is the day which the Lord hath made: let us be glad and rejoice therein. |
| John 1:1 | In the beginning was the Word: and the Word was with God: and the Word was God. |
| Apocalypse 22:21 | The grace of our Lord Jesus Christ be with you all. Amen. |
| Ecclesiasticus 2:1 | Son, when thou comest to the service of God, stand in justice and in fear, and prepare thy soul for temptation. |

Each matches its verse paragraph in the [raw file](../../raw/theology/scripture/2026-09-08-douay-rheims-bible-challoner.md); the parser's own check joined every verse the same way as the older tool file on all 35,759 verses they share.
