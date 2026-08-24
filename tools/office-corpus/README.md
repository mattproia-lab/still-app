# Office corpus generator

Build-time tooling for the traditional (1960 Roman Breviary) Office corpus.
**Nothing here ships to the app** — it produces JSON, and the JSON ships.

Design decisions and the reasoning behind them:
[`vault/raw/decisions/2026-08-24-office-corpus-json-shape.md`](../../vault/raw/decisions/2026-08-24-office-corpus-json-shape.md).

## How it works

Divinum Officium's own Perl renderer is the **oracle**: it is driven per date
and hour, and its HTML output is parsed. The `.txt` sources are *not* parsed —
`spell_var()` in `horascommon.pl` applies version-specific Latin orthography at
render time (the 1960 rite says `huius` where the source says `hujus`), so the
sources carry pre-normalisation text.

```
perl web/cgi-bin/horas/officium.pl "version=Rubrics 1960" \
     "command=prayVespera" "date=8-24-2026"
```

Dates are `M-D-YYYY`. Latin and English come out of a **single** render as two
`<TD>` cells per row. Docker is not required — the only missing dependency on a
stock Perl is `CGI.pm`.

## Files

| file | purpose |
|---|---|
| `parse_hour.py` | render → hour JSON, for `vespers`, `lauds`, `vigils` |
| `build_canticle_map.py` → `canticle-map.json` | canticle **citation** → DO psalm number |
| `build_hymn_map.py` → `hymn-map.json` | hymn Latin **first line** → ref (145 hymns) |
| `assert_lauds.py` / `assert_vigils.py` / `assert_gaps.py` | 135 assertions |

Both maps are generated; regenerate them if the DO clone is updated:

```
python build_canticle_map.py <clone>/web/www/horas > canticle-map.json
python build_hymn_map.py     <clone>/web/www/horas > hymn-map.json
```

## Two traps worth knowing before editing

**Tags become the empty string, never a space.** DO renders initials in their
own font block (`<FONT ...><B><I>G</I></B></FONT>lória`). Replacing tags with a
space yields `G lória` and `O mnípotens`; replacing with nothing is correct for
all cases, including the two where the following text legitimately begins with
a space (`O ye who`, `O Almighty`).

**Keys are citations and first lines, not names.** Ten canticle names are
ambiguous — `Canticum Trium Puerorum` is both 210 and 220, and two collide
inside the fourteen Lauds positions alone. The citation is unique across all 51.

## Running the assertions

```
python assert_lauds.py && python assert_vigils.py && python assert_gaps.py
```

They expect rendered HTML fixtures alongside them. Assertions are written
**before** each parser change — twice that caught silent-drop bugs (the Lauds
canticle, and ferial psalm verse ranges) that would otherwise have produced
plausible-looking output across a three-year range.
