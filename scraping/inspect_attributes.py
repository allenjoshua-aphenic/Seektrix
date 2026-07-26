#!/usr/bin/env python3
"""
SEEKTRIX — attribute inspector
==============================
Walks the downloaded-files folder and reports, for every PDF / CSV / XLS /
XLSX / XLSM, the column headers (attributes) it actually contains, plus a
sample row and the row count. Used to design the relational schema from the
real data rather than from guesses.

Usage:  python scraping/inspect_attributes.py "C:\\Users\\VC\\Downloads\\UNCLAIMED ASSETS DATA"
"""
import csv
import io
import re
import sys
from pathlib import Path


def inspect_csv(p: Path):
    raw = p.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        text = raw.decode("latin-1", "ignore")
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0] if rows else []
    sample = rows[1] if len(rows) > 1 else []
    return header, sample, max(0, len(rows) - 1)


def inspect_xls(p: Path):
    import xlrd
    book = xlrd.open_workbook(str(p))
    out = []
    for sh in book.sheets():
        if sh.nrows == 0:
            continue
        # header is often not row 0 (IEPF templates have title rows) — find the
        # first row with >=4 non-empty string-ish cells
        hdr_row, header = 0, []
        for r in range(min(sh.nrows, 25)):
            vals = [str(c.value).strip() for c in sh.row(r)]
            nonempty = [v for v in vals if v]
            if len(nonempty) >= 4:
                hdr_row, header = r, vals
                break
        sample = [str(c.value).strip() for c in sh.row(hdr_row + 1)] if sh.nrows > hdr_row + 1 else []
        out.append((sh.name, header, sample, sh.nrows - hdr_row - 1))
    return out


def inspect_xlsx(p: Path):
    import openpyxl
    wb = openpyxl.load_workbook(str(p), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        hdr_row, header, rows_after = 0, [], 0
        allrows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i > 5000:
                break
            allrows.append(["" if v is None else str(v).strip() for v in row])
        for r, vals in enumerate(allrows[:25]):
            nonempty = [v for v in vals if v]
            if len(nonempty) >= 4:
                hdr_row, header = r, vals
                break
        sample = allrows[hdr_row + 1] if len(allrows) > hdr_row + 1 else []
        out.append((ws.title, header, sample, max(0, len(allrows) - hdr_row - 1)))
    return out


def inspect_pdf(p: Path):
    from pypdf import PdfReader
    reader = PdfReader(str(p))
    n = len(reader.pages)
    text = ""
    for page in reader.pages[:2]:
        try:
            text += (page.extract_text() or "") + "\n"
        except Exception:
            pass
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
    # show the first ~1400 chars so the header row is visible
    return n, text[:1400]


def main():
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    files = sorted([f for f in folder.iterdir()
                    if f.suffix.lower() in (".pdf", ".csv", ".xls", ".xlsx", ".xlsm")])
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Inspecting {len(files)} files in: {folder}\n")
    for f in files:
        print("=" * 78)
        print(f"FILE: {f.name}   [{f.stat().st_size//1024} KB]")
        ext = f.suffix.lower()
        try:
            if ext == ".csv":
                h, s, n = inspect_csv(f)
                print(f"  rows: ~{n}")
                print(f"  COLUMNS ({len(h)}): {h}")
                print(f"  sample:  {s}")
            elif ext == ".xls":
                for name, h, s, n in inspect_xls(f):
                    print(f"  sheet '{name}'  rows: ~{n}")
                    print(f"  COLUMNS ({len([x for x in h if x])}): {[x for x in h if x]}")
                    print(f"  sample:  {[x for x in s if x][:12]}")
            elif ext in (".xlsx", ".xlsm"):
                for name, h, s, n in inspect_xlsx(f):
                    print(f"  sheet '{name}'  rows: ~{n}")
                    print(f"  COLUMNS ({len([x for x in h if x])}): {[x for x in h if x]}")
                    print(f"  sample:  {[x for x in s if x][:12]}")
            elif ext == ".pdf":
                n, txt = inspect_pdf(f)
                print(f"  pages: {n}")
                print("  --- first-page text (find the column header row) ---")
                print("  " + txt.replace("\n", "\n  "))
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}")
        print()


if __name__ == "__main__":
    main()
