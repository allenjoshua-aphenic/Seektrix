#!/usr/bin/env python3
"""
SEEKTRIX — ingest the downloaded IEPF files into companies + unclaimed_holders
==============================================================================
For every file in the Downloads folder this:
  1. upserts the company row (PostgREST, on_conflict=company_name) -> company_id
  2. parses the file with a per-layout parser -> normalized holder rows
  3. bulk-inserts holders under that company_id

Uses ONLY the repo .env (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY); the
service key bypasses RLS. Never invents values: missing fields become NULL, and
a row with neither an amount nor a share count is skipped (matches the DB CHECK).

Usage: python scraping/ingest_downloads.py "C:\\Users\\VC\\Downloads\\UNCLAIMED ASSETS DATA"
       python scraping/ingest_downloads.py "<dir>" --only "Sun,Titan"     # subset
       python scraping/ingest_downloads.py "<dir>" --dry-run              # parse only
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

STATES = ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH",
          "CHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND",
          "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA",
          "MIZORAM", "NAGALAND", "ODISHA", "ORISSA", "PUNJAB", "RAJASTHAN", "SIKKIM",
          "TAMIL NADU", "TAMILNADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND",
          "UTTARANCHAL", "WEST BENGAL", "DELHI", "NEW DELHI", "CHANDIGARH", "PUDUCHERRY",
          "PONDICHERRY", "JAMMU AND KASHMIR", "JAMMU & KASHMIR", "GOA"]
STATE_CANON = {"ORISSA": "Odisha", "TAMILNADU": "Tamil Nadu", "NEW DELHI": "Delhi",
               "CHATTISGARH": "Chhattisgarh", "UTTARANCHAL": "Uttarakhand",
               "PONDICHERRY": "Puducherry", "JAMMU & KASHMIR": "Jammu and Kashmir"}


def detect_state(text):
    up = (text or "").upper()
    for s in STATES:
        if s in up:
            return STATE_CANON.get(s, s.title())
    return None


def parse_date(s):
    for fmt in ("%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y"):
        try:
            return datetime.strptime(s.strip().title(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def split_caps_name(blob, maxtok=5):
    """Leading ALL-CAPS tokens = name; the rest (Title/number) = address.
    Works for SBI where names are uppercase and addresses are title-case."""
    toks = blob.split()
    name = []
    for t in toks:
        # a name token is pure uppercase letters/dots; anything else (lowercase,
        # digits, "C/", punctuation) marks the start of the address.
        if not re.fullmatch(r"[A-Z.]+", t):
            break
        name.append(t)
        if len(name) >= maxtok:
            break
    if not name:
        name = toks[:2]
    return " ".join(name), " ".join(toks[len(name):])

BATCH = 2000
HERE = Path(__file__).resolve().parent


def load_env():
    env = {}
    p = HERE.parent / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
BASE = (ENV.get("VITE_SUPABASE_URL") or "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ""


def api(method, path, body=None, prefer=None):
    url = f"{BASE}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
               "Content-Type": "application/json", "User-Agent": "seektrix-ingest/1.0"}
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def upsert_company(name, bse=None, nse=None, industry=None):
    rows = api("POST", "companies?on_conflict=company_name",
               [{"company_name": name, "bse_code": bse, "nse_symbol": nse, "industry": industry}],
               prefer="resolution=merge-duplicates,return=representation")
    return rows[0]["id"]


def dedupe(rows):
    """Drop rows that would collide on the DB's (company_id, folio_number,
    financial_year) unique index (only applies where folio is present)."""
    seen, out = set(), []
    for h in rows:
        f = h.get("folio_number")
        if f:
            key = (f.lower(), (h.get("financial_year") or "").lower())
            if key in seen:
                continue
            seen.add(key)
        out.append(h)
    return out


def insert_holders(rows, company_id):
    n = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        for h in chunk:
            h["company_id"] = company_id
        api("POST", "unclaimed_holders", chunk, prefer="return=minimal")
        n += len(chunk)
        print(f"     inserted {n}/{len(rows)}")
    return n


# ── value helpers ────────────────────────────────────────────────────────────
def num(v):
    if v is None:
        return None
    s = re.sub(r"[^\d.]", "", str(v))
    if not s or s == ".":
        return None
    try:
        f = float(s)
        return f if f != 0 else None
    except ValueError:
        return None


def intval(v):
    f = num(v)
    return int(f) if f is not None else None


def clean(v):
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def holder(full_name, **kw):
    fn = clean(full_name)
    if not fn:
        return None
    row = {"full_name": fn, "first_name": None, "middle_name": None, "last_name": None,
           "father_or_husband_name": None, "joint_holder_1": None, "joint_holder_2": None,
           "folio_number": None, "dp_client_id": None, "pan": None, "holder_type": None,
           "address": None, "state": None, "pin": None, "shares": None,
           "unclaimed_amount": None, "dividend_type": None, "financial_year": None,
           "warrant_no": None, "transfer_date": None, "source_file": kw.get("source_file")}
    for k, v in kw.items():
        if k in row:
            row[k] = clean(v) if isinstance(v, str) else v
    # enforce the DB CHECK client-side so we don't send doomed rows
    if row["unclaimed_amount"] is None and row["shares"] is None:
        return None
    return row


# ── parsers (one per file layout) ────────────────────────────────────────────
def parse_csv_sunpharma(path, src):
    text = path.read_bytes().decode("utf-8-sig", "ignore")
    out = []
    for r in csv.DictReader(io.StringIO(text)):
        out.append(holder(r.get("Full Name of Shareholder"),
                          address=r.get("Address"), folio_number=r.get("Folio No."),
                          dp_client_id=r.get("DP ID and Client ID"),
                          dividend_type=r.get("Dividend Type (Interim/Final)"),
                          unclaimed_amount=num(r.get("Amount (Rs.)")),
                          financial_year=r.get("Financial Year"), source_file=src))
    return [h for h in out if h]


def parse_mca_excel(path, src):
    ext = path.suffix.lower()
    if ext == ".xls":
        import xlrd
        book = xlrd.open_workbook(str(path))
        sh = book.sheet_by_name("Investor Details")
        rows = [[str(c.value).strip() for c in sh.row(r)] for r in range(sh.nrows)]
    else:
        import openpyxl
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
        ws = wb["Investor Details"]
        rows = [["" if v is None else str(v).strip() for v in row]
                for row in ws.iter_rows(values_only=True)]
    # find header row
    hi = next(i for i, r in enumerate(rows) if any("Investor First Name" in c for c in r))
    hdr = rows[hi]
    col = {name: idx for idx, name in enumerate(hdr)}

    def g(r, name):
        i = col.get(name)
        return r[i] if i is not None and i < len(r) else ""

    out = []
    for r in rows[hi + 1:]:
        fn = " ".join(x for x in [g(r, "Investor First Name"), g(r, "Investor Middle Name"),
                                  g(r, "Investor Last Name")] if x).strip()
        if not fn:
            continue
        father = " ".join(x for x in [g(r, "Father/Husband First Name"),
                                      g(r, "Father/Husband Middle Name"),
                                      g(r, "Father/Husband Last Name")] if x).strip()
        out.append(holder(fn, first_name=g(r, "Investor First Name"),
                          middle_name=g(r, "Investor Middle Name"),
                          last_name=g(r, "Investor Last Name"),
                          father_or_husband_name=father, address=g(r, "Address"),
                          state=g(r, "State"), pin=re.sub(r"\.0$", "", g(r, "Pin Code")),
                          folio_number=g(r, "Folio Number"),
                          dp_client_id=g(r, "DP Id-Client Id-Account Number"),
                          dividend_type=g(r, "Investment Type"),
                          unclaimed_amount=num(g(r, "Amount transferred")),
                          shares=intval(g(r, "Number of underlying Shares")),
                          source_file=src))
    return [h for h in out if h]


def _pdf_lines(path):
    from pypdf import PdfReader
    for page in PdfReader(str(path)).pages:
        txt = page.extract_text() or ""
        for line in re.sub(r"[^\x20-\x7E\n]", " ", txt).splitlines():
            yield re.sub(r"\s+", " ", line).strip()


def parse_pdf_ap(path, src):  # Asian Paints: N FOLIO NAME SHARES AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+([A-Z0-9]{6,})\s+(.+?)\s+([\d,]+)\s+([\d,]+\.\d{2})$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                              source_file=src))
    return [h for h in out if h]


def parse_pdf_lt(path, src):  # L&T: N TYPE FOLIO SHAREHOLDER SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(PHY|NSD|CDSL)\s+(\S+)\s+(.+?)\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(3), holder_type=m.group(1), folio_number=m.group(2),
                              shares=intval(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_kotak(path, src):  # Kotak: N FOLIO NAME WARRANT AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+)\s+(.+?)\s+(\d{5,})\s+([\d,]+\.\d{2})$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), warrant_no=m.group(3),
                              unclaimed_amount=num(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_tcs(path, src):  # TCS: N FOLIO NAME SHARES TOTAL_AMT (then per-div cols)
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+)\s+(.+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+[\d,]", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                              source_file=src))
    return [h for h in out if h]


def parse_pdf_infosys(path, src):  # shares-identified: N TYPE FOLIO NAME WARRANT SHARES [divs]
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(PHY|NSD|CDSL)\s+(\S+)\s+(.+?)\s+(\d{5,})\s+(\d+)\s+[\d,]+\.\d", ln)
        if m:
            out.append(holder(m.group(3), holder_type=m.group(1), folio_number=m.group(2),
                              warrant_no=m.group(4), shares=intval(m.group(5)), source_file=src))
    return [h for h in out if h]


def parse_pdf_isgec(path, src):  # N FOLIO Name1 Joint1 Joint2 Address... SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+([A-Z]{1,4}\d+)\s+(.+?)\s+(\d+)$", ln)
        if not m:
            continue
        folio, blob, shares = m.group(1), m.group(2), m.group(3)
        toks = blob.split()
        name = " ".join(toks[:3])          # Name1 (best-effort; joint holders follow)
        out.append(holder(name, folio_number=folio, shares=intval(shares),
                          address=blob, state=detect_state(blob), source_file=src))
    return [h for h in out if h]


def parse_pdf_wipro(path, src):  # MCA-in-PDF, one investor per line, anchored on ' INDIA '
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^(.+?)\s+INDIA\s+(.+?)\s+(\d{6})\s+(IN\w+)\s+IN\w+\s+(\d+)\s*\d*\s*Amount"
                     r".*?([\d,]+\.\d{2})\s+(\d{2} [A-Z]{3} \d{4})$", ln)
        if not m:
            continue
        blob, region, pin, dp, shares, amt, dt = m.groups()
        toks = blob.split()
        name = " ".join(toks[:2])          # investor name (father/address follow, best-effort)
        out.append(holder(name, address=blob, state=detect_state(region), pin=pin,
                          dp_client_id=dp, shares=intval(shares), unclaimed_amount=num(amt),
                          transfer_date=parse_date(dt), source_file=src))
    return [h for h in out if h]


def parse_pdf_sbi(path, src):  # multi-line: N NAME ADDRESS <phrase FY> AMOUNT DATE
    from pypdf import PdfReader
    text = []
    for page in PdfReader(str(path)).pages:
        t = page.extract_text() or ""
        text.append(re.sub(r"[^\x20-\x7E\n]", " ", t))
    joined = re.sub(r"\s+", " ", "\n".join(text).replace("\n", " "))
    rx = re.compile(
        r"(\d+)\s+(.+?)\s+Unclaimed/Unpaid Dividend transferred\s+to IEPF for FY\s+"
        r"(\d{4}\s*-\s*\d{2,4})\s+([\d,]+\.\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{4})")
    out = []
    for m in rx.finditer(joined):
        blob, fy, amt, dt = m.group(2), m.group(3), m.group(4), m.group(5)
        name, addr = split_caps_name(blob)
        out.append(holder(name, address=addr or blob, state=detect_state(blob),
                          unclaimed_amount=num(amt), financial_year=re.sub(r"\s+", "", fy),
                          transfer_date=parse_date(dt), source_file=src))
    return [h for h in out if h]


# ── file registry ────────────────────────────────────────────────────────────
FILES = [
    ("Sun Pharmaceutical Industries Ltd - Unclaimed Assets.csv", "Sun Pharmaceutical Industries Ltd", "524715", "SUNPHARMA", "Pharmaceuticals", parse_csv_sunpharma),
    ("Titan Company Ltd - Unclaimed Assets.xls", "Titan Company Ltd", "500114", "TITAN", "Consumer Durables / Jewellery", parse_mca_excel),
    ("Bajaj Finance Ltd - Unclaimed Assets.xlsm", "Bajaj Finance Ltd", "500034", "BAJFINANCE", "Financial Services (NBFC)", parse_mca_excel),
    ("Asian Paints Ltd - Unclaimed Assets.pdf", "Asian Paints Ltd", "500820", "ASIANPAINT", "Paints & Chemicals", parse_pdf_ap),
    ("IEPF-shares-shareholder-list L&T.pdf", "Larsen & Toubro Ltd", "500510", "LT", "Engineering & Infrastructure", parse_pdf_lt),
    ("unpaid-dividend-21-22 kotak.pdf", "Kotak Mahindra Bank Ltd", "500247", "KOTAKBANK", "Banking & Financial Services", parse_pdf_kotak),
    ("unclaimed-dividend-details-august-13-2013-October-24-2019 TCS.pdf", "Tata Consultancy Services Ltd", "532540", "TCS", "Information Technology", parse_pdf_tcs),
    # ── harder multi-line PDFs (added later) ──
    ("shares-identified-transfer-december2016.pdf", "Infosys Ltd", "500209", "INFY", "Information Technology", parse_pdf_infosys),
    ("List-of-Shareholders-whose-shares-have-been-transferred-to-IEPF isgec.pdf", "ISGEC Heavy Engineering Ltd", "533033", "ISGEC", "Capital Goods", parse_pdf_isgec),
    ("Wipro Ltd - Unclaimed Assets.pdf", "Wipro Ltd", "507685", "WIPRO", "Information Technology", parse_pdf_wipro),
    ("State Bank of India - Unclaimed Assets.pdf", "State Bank of India", "500112", "SBIN", "Banking & Financial Services", parse_pdf_sbi),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--only", default="")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not BASE or not KEY:
        sys.exit("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")
    folder = Path(args.folder)
    only = [s.strip().lower() for s in args.only.split(",") if s.strip()]
    sys.stdout.reconfigure(encoding="utf-8")

    grand = 0
    for fname, company, bse, nse, industry, parser in FILES:
        if only and not any(o in company.lower() or o in fname.lower() for o in only):
            continue
        path = folder / fname
        if not path.exists():
            print(f"SKIP (missing): {fname}")
            continue
        print(f"\n=== {company}  <-  {fname} ===")
        try:
            rows = parser(path, fname)
        except Exception as e:
            print(f"   PARSE ERROR: {type(e).__name__}: {e}")
            continue
        rows = dedupe(rows)
        print(f"   parsed {len(rows)} valid holder rows (after dedup)")
        if rows[:1]:
            s = rows[0]
            print(f"   sample: {s['full_name']} | folio={s['folio_number']} | "
                  f"shares={s['shares']} | amt={s['unclaimed_amount']}")
        if args.dry_run or not rows:
            continue
        cid = upsert_company(company, bse, nse, industry)
        print(f"   company_id={cid}; inserting...")
        grand += insert_holders(rows, cid)

    print(f"\nDONE. {grand} holder rows ingested this run.")


if __name__ == "__main__":
    main()
