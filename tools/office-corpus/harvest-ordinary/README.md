# Harvesting `store/ordinary.json`

Produces the one corpus file the main generator does not: the texts Divinum
Officium *names* in an hour document but does not carry inline — the two Gospel
canticles and the three hour conclusions.

**Nothing here composes text.** Every string is lifted from Divinum Officium's
own HTML render, per the render-as-oracle decision in
[`2026-08-24-office-corpus-json-shape.md`](../../../vault/raw/decisions/2026-08-24-office-corpus-json-shape.md)
(§2 amended). The `.txt` sources are deliberately not read: `spell_var()`
applies Rubrics-1960 orthography at render time (`huius`, not `hujus`), so
parsing the sources would ship the wrong spelling silently.

## Why this file has to exist

`resolveOrdinary()` in `netlify/functions/office-corpus.js` needs five refs the
corpus carries no text for:

| ref | count in corpus | what it carries |
|---|---|---|
| `ordinary:{vigils,lauds,vespers}-conclusion` | 1,470 | `ref` and `type`, nothing else |
| `canticle:magnificat`, `canticle:benedictus` | 986 | the day's antiphon, no canticle text |

The generator was right not to write the Magnificat 493 times. The three
`*-incipit` refs are deliberate empty markers and need nothing.

`test-office-corpus.js` re-derives this set from the corpus on every run and
fails if a regeneration widens it.

## Recipe

Clone the engine and its data. **The `Ordinarium/` directory alone is not
enough** — it holds the skeleton (`&psalm(...)` directives), and the engine
expands it against `Psalterium/`, `Sancti/`, `Tempora/`. Rendering needs all of
it.

```sh
git -c core.protectNTFS=false -c core.longpaths=true \
    clone --filter=blob:none --sparse --depth 1 \
    https://github.com/DivinumOfficium/divinum-officium.git do

git -C do -c core.longpaths=true sparse-checkout set \
    web/cgi-bin web/www/horas/Ordinarium \
    web/www/horas/Latin web/www/horas/English \
    web/www/Tabulae web/www/kalendar
```

**`core.longpaths=true` is the load-bearing flag on Windows, not
`protectNTFS`.** The failure is MAX_PATH: the chant `.gabc` filenames exceed
260 characters under a deep working directory. Excluding `Latin-gabc` (as the
sparse set above does) avoids it too. The vault's note about NTFS filename
restrictions describes a different, also-real problem; this was the one that
bit.

Then render and harvest:

```sh
node harvest.js          # the two Gospel canticles, from one day's render
node sweep.js            # the three conclusions, every day in the window
node build-ordinary.js ../../../corpus/traditional/store/ordinary.json
```

`sweep.js` takes about 15 minutes (2,583 renders at ~0.35 s).

## `lib/` is a CGI shim, not a vendored CGI.pm

`officium.pl` needs `CGI`, `CGI::Cookie` and `CGI::Carp`, and CGI 4.68 drags in
`URI` and `CGI::Util`. The engine touches six entry points in total
(`new`, `param`, `header`, `cookie`, `charset`, `redirect`), so `lib/` supplies
those directly. **Harness code — it touches no liturgical text.**

The engine itself is never patched. If you need to trace something, patch a
throwaway copy and restore it before harvesting.

## Extraction rule

Block-level tags become newlines; **every other tag becomes the empty string,
never a space.** DO emits drop-cap initials in their own font block
(`<FONT ...><B><I>G</I></B></FONT>lória`), and the document's own whitespace is
already correct — inserting a space corrupts the 22 initials that run into
their word, stripping one corrupts the 2 that are legitimately spaced.

Runs of literal spaces are then collapsed, which is what the main generator
does; see the verification below.

## Verification — how we know nothing was written

`harvest.js` extracts 252 numbered verse lines from the same three renders and
compares them to the already-committed `store/psalms.json`:

- **209 of 252 are byte-identical** in both Latin and English.
- **22** of the remainder are the Magnificat (`1:46`–`1:55`) and Benedictus
  (`1:68`–`1:79`) — absent from the store, which is the gap this file fills.
- **21** are DO's duplicate-numbered psalm incipit lines: when an antiphon
  quotes a psalm's opening, the render prints it again under the same verse
  number (`109:1` appears twice). The main generator de-duplicated.

**No ref carries different wording between render and store.** The extraction
reproduces the generator's register, so these five texts sit in the same
register as the corpus they join.

## The conclusion is not one text

The sweep exists because a single conclusion would be wrong on 29 days of the
861-day window. Five distinct variants were found, all rubrically coherent:

| # | when | what changes |
|---|---|---|
| 0 | ordinary days | `Benedicámus Dómino` |
| 1 | All Souls (2 Nov) | the whole conclusion — `Réquiem ætérnam` |
| 2 | Easter Octave (Lauds + Vespers), and Vespers of the Saturday before Septuagesima | `Benedicámus Dómino, allelúia, allelúia` |
| 3 | the Sacred Triduum | `Conclusio{omittitur}` — omitted entirely |
| 4 | 25 April, Lauds | short form, no `Fidélium ánimæ` |

Two of these would not have been guessed. **Matins never takes the alleluia**,
even at Easter, while Lauds and Vespers do. And variant 2 on the Saturday
before Septuagesima is the *alleluia farewell* — the double alleluia added at
First Vespers before alleluia is dropped until Easter — which is why that day
appears alongside the Easter Octave and its Lauds that morning does not.

This is the argument for render-as-oracle in miniature: the rubric is real, it
is not written down anywhere in the corpus, and no rule anyone would have
reached for produces it.
