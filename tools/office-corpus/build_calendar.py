#!/usr/bin/env python3
"""
Build the calendar index from Divinum Officium's own Kalendarium.

One CGI call per month rather than per day. The table gives, for each date:
  de Tempore   temporal office and/or its commemorations
  Sanctorum    sanctoral office and/or its commemorations
  Vespera      the concurrence note -- which office Vespers belongs to
  d.h.         day of week

IMPORTANT LIMIT: DO never emits its internal office file keys (Sancti/08-24)
in any output; they exist only inside the Perl. The office identity available
here is the TITLE plus rank. Keys below are slugs of that title -- stable,
readable, and derived from DO output, but not DO's own paths.

  python build_calendar.py <clone>/web <out.json> 2026 2028
"""

import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import date, timedelta
from pathlib import Path

RANK = re.compile(r"\b((?:I{1,3}|IV)\.\s*classis)\b")
COMMEM = re.compile(r"Commemoratio[^:]*:\s*(.+)$", re.I)


def slug(text, limit=56):
    s = unicodedata.normalize("NFKD", text)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("æ", "ae").replace("Æ", "ae").replace("œ", "oe")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s[:limit].rstrip("-")


def fetch_month(web, perl_lib, year, month):
    cmd = ["perl"]
    if perl_lib:
        cmd += ["-I", perl_lib]
    cmd += ["web/cgi-bin/horas/kalendar.pl", "version=Rubrics 1960",
            f"kmonth={month}", f"kyear={year}"]
    p = subprocess.run(cmd, capture_output=True, cwd=str(Path(web).parent))
    return p.stdout.decode("utf-8", errors="replace")


def cells(row):
    out = []
    for m in re.finditer(r"<T[DH][^>]*>(.*?)</T[DH]>", row, re.S | re.I):
        t = re.sub(r"(?i)<br\s*/?>", "\n", m.group(1))
        t = re.sub(r"<[^>]+>", "", t)
        import html as _h
        out.append(re.sub(r"[ \t]+", " ", _h.unescape(t)).strip())
    return out


def parse_month(doc, year, month):
    days = {}
    for row in re.findall(r"<TR[^>]*>(.*?)</TR>", doc, re.S | re.I):
        c = cells(row)
        if len(c) < 5 or not c[0].strip().isdigit():
            continue
        day = int(c[0].strip())
        tempore, sanctorum, vespera = c[1], c[2], c[3]

        commems = []
        office = None
        for field in (sanctorum, tempore):        # sanctoral wins if ranked
            for line in [l for l in field.split("\n") if l.strip()]:
                m = COMMEM.search(line)
                if m:
                    commems.append(m.group(1).strip())
                elif office is None and RANK.search(line):
                    office = line.strip()
        if office is None:
            for field in (tempore, sanctorum):
                for line in [l for l in field.split("\n") if l.strip()]:
                    if not COMMEM.search(line):
                        office = line.strip()
                        break
                if office:
                    break

        rank = None
        if office:
            rm = RANK.search(office)
            if rm:
                rank = rm.group(1)
        title = re.sub(RANK, "", office).strip(" .,") if office else None
        days[f"{year:04d}-{month:02d}-{day:02d}"] = {
            "title": title,
            "key": slug(title) if title else None,
            "rank": rank,
            "commemorations": commems,
            "vespera": vespera or None,
            "weekday": c[4],
        }
    return days


def main():
    web, out_path, y0, y1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    perl_lib = os.environ.get("PERL_LIB")
    all_days = {}
    for year in range(y0, y1 + 1):
        for month in range(1, 13):
            doc = fetch_month(web, perl_lib, year, month)
            all_days.update(parse_month(doc, year, month))
        print(f"  {year} done ({len(all_days)} days)", flush=True)
    Path(out_path).write_text(
        json.dumps({"kalendar": "Rubrics 1960", "days": all_days},
                   ensure_ascii=False, indent=1), encoding="utf-8")
    keys = {d["key"] for d in all_days.values() if d["key"]}
    print(json.dumps({
        "days": len(all_days),
        "distinct_office_keys": len(keys),
        "days_with_commemoration": sum(1 for d in all_days.values() if d["commemorations"]),
        "days_with_vespera_note": sum(1 for d in all_days.values() if d["vespera"]),
        "unresolved_title": sum(1 for d in all_days.values() if not d["title"]),
    }, indent=2))


if __name__ == "__main__":
    main()
