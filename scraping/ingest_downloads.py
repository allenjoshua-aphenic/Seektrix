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
import time
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

# Load pacing. Big batches are what make this fast (one round-trip per 2000
# rows); the safety net is the backoff in api(), which only costs time if
# Supabase actually pushes back. PACE just stops us hammering it flat out.
BATCH = 2000
PACE = 0.05          # seconds to idle between batches
REQ_TIMEOUT = 180    # per-request socket timeout
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


class RateLimited(Exception):
    pass


def api(method, path, body=None, prefer=None, tries=6):
    """One PostgREST call, retried with exponential backoff.

    Supabase's pooler answers overload with 429 / 503 / 5xx rather than a clean
    error, and a dropped socket mid-insert looks like a URLError. All of those
    are transient, so back off and retry instead of aborting a 300k-row load.
    A 4xx that is NOT a rate limit is a real bug in our payload — raise at once.
    """
    url = f"{BASE}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
               "Content-Type": "application/json", "User-Agent": "seektrix-ingest/1.0"}
    if prefer:
        headers["Prefer"] = prefer
    delay = 2.0
    for attempt in range(1, tries + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=REQ_TIMEOUT) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "ignore")[:300]
            transient = e.code in (408, 429, 500, 502, 503, 504)
            if not transient or attempt == tries:
                raise RuntimeError(f"HTTP {e.code} on {method} {path}: {detail}") from None
            wait = float(e.headers.get("Retry-After") or 0) or delay
            print(f"       ! HTTP {e.code}; backing off {wait:.0f}s "
                  f"(attempt {attempt}/{tries})")
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == tries:
                raise RuntimeError(f"network failure on {method} {path}: {e}") from None
            print(f"       ! {type(e).__name__}; retrying in {delay:.0f}s "
                  f"(attempt {attempt}/{tries})")
            time.sleep(delay)
        delay = min(delay * 2, 60)
    raise RuntimeError("unreachable")


def upsert_company(name, bse=None, nse=None, industry=None, url=None):
    payload = {"company_name": name, "bse_code": bse, "nse_symbol": nse, "industry": industry}
    if url:
        payload["iepf_page_url"] = url   # provenance: where this company's data was downloaded
    rows = api("POST", "companies?on_conflict=company_name", [payload],
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
    """Insert in small paced batches so a 100k-row file never saturates the DB.

    Each statement fires the holder-count trigger and updates the trigram index,
    so batch size is the main lever on how long a single transaction holds locks.
    BATCH rows per request + PACE seconds between requests keeps the instance
    responsive to live search traffic while the load runs.
    """
    n, total = 0, len(rows)
    t0 = time.time()
    for i in range(0, total, BATCH):
        chunk = rows[i:i + BATCH]
        for h in chunk:
            h["company_id"] = company_id
        api("POST", "unclaimed_holders", chunk, prefer="return=minimal")
        n += len(chunk)
        if n == total or (i // BATCH) % 10 == 0:
            rate = n / max(time.time() - t0, 0.001)
            print(f"     inserted {n}/{total}  ({rate:,.0f} rows/s)")
        if n < total:
            time.sleep(PACE)
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
        sheets = book.sheets()
        try:
            sheets = [book.sheet_by_name("Investor Details")]
        except xlrd.XLRDError:
            pass
        rows = None
        for sh in sheets:
            cand = [[str(c.value).strip() for c in sh.row(r)] for r in range(sh.nrows)]
            if any("Investor First Name" in c for r in cand[:40] for c in r):
                rows = cand
                break
        if rows is None:
            return []
    else:
        import openpyxl
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
        names = (["Investor Details"] if "Investor Details" in wb.sheetnames else []) + \
                [n for n in wb.sheetnames if n != "Investor Details"]
        rows = None
        for name in names:
            cand = [["" if v is None else str(v).strip() for v in row]
                    for row in wb[name].iter_rows(values_only=True)]
            if any("Investor First Name" in c for r in cand[:40] for c in r):
                rows = cand
                break
        if rows is None:
            return []
    # find header row
    hi = next(i for i, r in enumerate(rows) if any("Investor First Name" in c for c in r))
    hdr = rows[hi]
    # normalize header names: issuers vary case/spacing ("Amount Transferred",
    # "DP Id- Client Id-Account Number") — match on lowercased squashed keys
    def _norm(s):
        return re.sub(r"[\s-]+", "", s.lower())
    col = {_norm(name): idx for idx, name in enumerate(hdr) if name}

    def g(r, name):
        i = col.get(_norm(name))
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
        # An MCA IEPF-2 sheet carries ONE ROW PER INVESTOR PER FINANCIAL YEAR —
        # the same folio recurs with a different amount for FY-1..FY-7. Without a
        # financial_year the dedupe key collapses to (folio, "") and silently
        # keeps only the first year, dropping up to 6/7 of the file. Take the
        # trailing FY-n flag, falling back to the proposed transfer date.
        transfer = g(r, "Proposed Date of transfer to IEPF") or \
            next((r[i] for i, h in enumerate(hdr) if "Proposed Date" in h and i < len(r)), "")
        fy = next((r[i] for i, h in enumerate(hdr) if h.strip() == "Financial Year" and i < len(r)), "") or \
            next((c for c in reversed(r) if re.fullmatch(r"FY-\d", c.strip())), "")
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
                          financial_year=fy or (transfer or None),
                          transfer_date=parse_date(transfer) if transfer else None,
                          source_file=src))
    return [h for h in out if h]


def _pdf_lines(path):
    from pypdf import PdfReader
    for page in PdfReader(str(path)).pages:
        txt = (page.extract_text() or "").translate(_DASHES)
        for line in re.sub(r"[^\x20-\x7E\n]", " ", txt).splitlines():
            yield re.sub(r"\s+", " ", line).strip()


# unicode hyphens (U+2010..U+2015, minus sign) → ASCII '-' so folio/date tokens
# like IN300343‐10707240‐0000 survive the ASCII strip instead of splitting
_DASHES = {c: "-" for c in range(0x2010, 0x2016)}
_DASHES[0x2212] = "-"


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


def parse_pdf_techm(path, src):  # SR FOLIO NAME SHARES AMOUNT [more div cols]
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+)\s+(.+?)\s+(\d+)\s+([\d,]+\.\d{2})\s", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), shares=intval(m.group(3)),
                              unclaimed_amount=num(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_ongc(path, src):  # FOLIO NAME AMOUNT DATE
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^(\S+)\s+(.+?)\s+([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), unclaimed_amount=num(m.group(3)),
                              transfer_date=parse_date(m.group(4)), source_file=src))
    return [h for h in out if h]


def _split_name_addr(blob, maxtok=4):
    toks = blob.split()
    name = []
    for t in toks:
        if re.search(r"\d", t):
            break
        name.append(t)
        if len(name) >= maxtok:
            break
    if not name:
        name = toks[:2]
    return " ".join(name), " ".join(toks[len(name):])


def parse_pdf_ntpc(path, src):  # SNO <folio glued to NAME> ADDRESS AMOUNT .. SHARES_LIABLE(last int)
    out = []
    for ln in _pdf_lines(path):
        # anchor on the first rupee amount; everything before = sno + folio + name + address
        m = re.match(r"^\d+\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d ]+)$", ln)
        if not m:
            continue
        blob, amt, tail = m.groups()
        mf = re.match(r"^(\d{6,})(.*)$", blob)      # folio = leading long digit run (DP-ID)
        folio, rest = (mf.group(1), mf.group(2).strip()) if mf else (None, blob)
        name, addr = _split_name_addr(rest)
        if not name:
            continue
        tail_ints = [t for t in tail.split() if t.isdigit()]
        shares = intval(tail_ints[-1]) if tail_ints else None
        out.append(holder(name, folio_number=folio, address=addr or None, state=detect_state(addr),
                          shares=shares, unclaimed_amount=num(amt), source_file=src))
    return [h for h in out if h]


def parse_pdf_hindalco(path, src):  # NAME..INDIA STATE DIST PIN <folio>Amount for.. <amt> DATE
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^(.+?)INDIA\s+(.+?)\s+(\d{6})\s+(\d+)Amount for unclaimed and unpaid dividend"
                     r"\s*([\d,]+(?:\.\d+)?)\s+(\d{2}-[A-Z]{3}-\d{4})", ln)
        if not m:
            continue
        blob, region, pin, folio, amt, dt = m.groups()
        toks = blob.split()
        out.append(holder(" ".join(toks[:2]), address=blob, state=detect_state(region), pin=pin,
                          folio_number=folio, unclaimed_amount=num(amt),
                          transfer_date=parse_date(dt), source_file=src))
    return [h for h in out if h]


def parse_pdf_powergrid(path, src):  # multi-line MCA; join then regex each record
    from pypdf import PdfReader
    text = []
    for p in PdfReader(str(path)).pages:
        text.append(re.sub(r"[^\x20-\x7E\n]", " ", p.extract_text() or ""))
    joined = re.sub(r"\s+", " ", "\n".join(text).replace("\n", " "))
    rx = re.compile(r"(\d+)\s+(.+?)\s+INDIA\s+(.+?)\s+(\d{6})\s+(.+?)\s+([\d,]+)\.\d{2}\s+"
                    r"([\d,]+)\.\d{2}\s+(\d{2}-[A-Z]{3}-\d{4})")
    out = []
    for m in rx.finditer(joined):
        blob, region, pin, folio, shares, _nominal, dt = (m.group(2), m.group(3), m.group(4),
                                                          m.group(5), m.group(6), m.group(7), m.group(8))
        toks = blob.split()
        out.append(holder(" ".join(toks[:2]), address=blob, state=detect_state(region), pin=pin,
                          folio_number=re.sub(r"\s+", "", folio), shares=intval(shares),
                          transfer_date=parse_date(dt), source_file=src))
    return [h for h in out if h]


def parse_xlsx_bajajfinserv(path, src):  # Name & Address column; address wraps to following rows
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb.active
    rows = [["" if v is None else str(v).strip() for v in r] for r in ws.iter_rows(values_only=True)]
    hi = next(i for i, r in enumerate(rows) if any("Name & Address" in c for c in r))
    out, cur, addr = [], None, []
    for r in rows[hi + 1:]:
        dpid = r[1] if len(r) > 1 else ""
        folio = r[2] if len(r) > 2 else ""
        na = r[3] if len(r) > 3 else ""
        shares = r[5] if len(r) > 5 else ""
        amt = r[6] if len(r) > 6 else ""
        if folio or amt or shares:                       # start of a new investor
            if cur:
                cur["address"] = " ".join(addr)[:400] or None
                out.append(cur)
            cur = holder(na, dp_client_id=dpid or None, folio_number=folio or None,
                        shares=intval(shares), unclaimed_amount=num(amt), source_file=src)
            addr = []
        elif na and cur is not None:                     # address continuation line
            addr.append(na)
    if cur:
        cur["address"] = " ".join(addr)[:400] or None
        out.append(cur)
    return [h for h in out if h]


def parse_pdf_drreddys(path, src):  # SNO FOLIO NAME SHARES <per-FY amounts>
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+([A-Z]?\d{4,}|[A-Z]\d+)\s+(.+?)\s+(\d+)\s+([\d,]+)\s", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), shares=intval(m.group(3)),
                              unclaimed_amount=num(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_divis(path, src):  # SNO <folio glued>NAME ADDRESS... FINAL YYYY-YYYY AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+?)\s*([A-Z][A-Za-z].+?)\s+(?:FINAL|INTERIM)\s+([\d-]+)\s+([\d,]+\.\d{2})$", ln)
        if not m:
            continue
        folio, blob, fy, amt = m.groups()
        name, addr = _split_name_addr(blob, 4)
        out.append(holder(name, folio_number=folio, address=addr or None,
                          state=detect_state(addr), financial_year=fy,
                          unclaimed_amount=num(amt), source_file=src))
    return [h for h in out if h]


def parse_pdf_adani(path, src):  # SNO FOLIO NAME SHARES ADDRESS... PIN
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+)\s+(.+?)\s+(\d+)\s+(.+?)\s*(\d{6})?$", ln)
        if not m:
            continue
        folio, name, shares, addr, pin = m.groups()
        if not re.search(r"[A-Za-z]", name):
            continue
        out.append(holder(name.rstrip(" ."), folio_number=folio, shares=intval(shares),
                          address=addr or None, pin=pin, state=detect_state(addr or ""),
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_coalindia(path, src):  # SEQ DPID NAME ADDRESS... PIN SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\d{10,})\s+(.+?)\s+(\d{6})\s+(\d+)$", ln)
        if not m:
            continue
        dp, blob, pin, shares = m.groups()
        # Coal India names are Title/UPPER case followed by an address that
        # usually starts with a keyword or digits — cut at the first of those.
        cut = re.search(r"\b(?:S/O|D/O|W/O|C/O|QR|NEAR|VILL|VILLAGE|PO|P\.O|AT|FLAT|"
                        r"HOUSE|H\.NO|PLOT|ROAD|STREET|NO\.|\d)", blob, re.I)
        name = blob[:cut.start()].strip() if cut and cut.start() > 3 else blob
        addr = blob[cut.start():].strip() if cut and cut.start() > 3 else ""
        name = " ".join(name.split()[:5])
        out.append(holder(name, dp_client_id=dp, address=addr or None, pin=pin,
                          state=detect_state(addr or ""), shares=intval(shares), source_file=src))
    return [h for h in out if h]


def parse_pdf_shriram(path, src):  # SNO FOLIO NAME SHARES <per-FY amounts>
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\S+)\s+(.+?)\s+(\d+)\s+([\d,]+\.\d{2})", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), shares=intval(m.group(3)),
                              unclaimed_amount=num(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_indusind(path, src):  # SNO FOLIO NAME <amounts...> <holdings>
    # NOTE: on most pages the serial no. and folio are GLUED ("6000058066" =
    # row 60 + folio 0058066), so accept both spaced and glued forms.
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\d{6,})\s+([A-Z].+?)\s+([\d,. ]+)$", ln)
        if not m:
            m = re.match(r"^\d{1,4}(\d{7})\s+([A-Z].+?)\s+([\d,. ]+)$", ln)
        if not m:
            continue
        folio, name, tail = m.groups()
        nums = [t for t in tail.split() if re.fullmatch(r"[\d,]+(?:\.\d+)?", t)]
        if len(nums) < 4:
            continue
        out.append(holder(name, folio_number=folio, unclaimed_amount=num(nums[0]),
                          shares=intval(nums[-1]), source_file=src))
    return [h for h in out if h]


def parse_pdf_apollo(path, src):  # MCA-in-PDF, multi-line; join and regex records
    from pypdf import PdfReader
    text = []
    for p in PdfReader(str(path)).pages:
        text.append(re.sub(r"[^\x20-\x7E\n]", " ", p.extract_text() or ""))
    joined = re.sub(r"\s+", " ", "\n".join(text).replace("\n", " "))
    rx = re.compile(r"([A-Z][A-Za-z.\- ]{3,60}?)\s+(?:NA|[A-Z][A-Za-z.\- ]{0,40})?\s*INDIA\s+([A-Z ]+?)\s+"
                    r"(?:NA|[A-Za-z ]+?)\s+(\d{6})\s+(\d{5,})\s+Amount for unclaimed and\s*"
                    r"unpaid dividend\s+([\d,]+(?:\.\d+)?)\s+(\d{2}-[A-Z]{3}-\d{4})")
    out = []
    for m in rx.finditer(joined):
        name, state, pin, folio, amt, dt = m.groups()
        out.append(holder(name.strip(), state=state.title().strip(), pin=pin, folio_number=folio,
                          unclaimed_amount=num(amt), transfer_date=parse_date(dt), source_file=src))
    return [h for h in out if h]


def parse_pdf_tataconsumer(path, src):  # SNO NAME ADDRESS PIN FOLIO AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(.+?)\s+(\d{6})\s+(\S+)\s+([\d,]+\.\d{2})$", ln)
        if not m:
            continue
        blob, pin, folio, amt = m.groups()
        name, addr = _split_name_addr(blob, 4)
        out.append(holder(name, address=addr or None, pin=pin, state=detect_state(addr or ""),
                          folio_number=folio, unclaimed_amount=num(amt), source_file=src))
    return [h for h in out if h]


def parse_pdf_ltim(path, src):  # SNO FOLIO NAME <entitlement cols> (last two = base/current holding)
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\d{2,})\s+([A-Z][A-Za-z .]+?)\s+([\d ]+)$", ln)
        if not m:
            continue
        folio, name, tail = m.groups()
        nums = [t for t in tail.split() if t.isdigit()]
        if len(nums) < 3:
            continue
        out.append(holder(name.strip(), folio_number=folio, shares=intval(nums[-1]),
                          unclaimed_amount=num(nums[0]), source_file=src))
    return [h for h in out if h]


def parse_xls_bpcl(path, src):  # classic IEPF-2 sheet, header on row 2
    import xlrd
    sh = xlrd.open_workbook(str(path)).sheets()[0]
    rows = [[str(c.value).strip() for c in sh.row(r)] for r in range(sh.nrows)]
    hi = next(i for i, r in enumerate(rows) if any("First Name" in c for c in r))
    col = {n: i for i, n in enumerate(rows[hi])}

    def g(r, name):
        i = col.get(name)
        return r[i] if i is not None and i < len(r) else ""

    out = []
    for r in rows[hi + 1:]:
        fn = " ".join(x for x in [g(r, "First Name"), g(r, "Middle Name"), g(r, "Last Name")] if x).strip()
        if not fn:
            continue
        father = " ".join(x for x in [g(r, "Father/Husband First Name"),
                                      g(r, "Father/Husband Middle Name"),
                                      g(r, "Father/Husband Last Name")] if x and x != "NA").strip()
        amt = None
        for k in col:
            if "Amount" in k or "amount" in k:
                amt = num(g(r, k))
                if amt:
                    break
        out.append(holder(fn, father_or_husband_name=father or None, address=g(r, "Address"),
                          state=g(r, "State"), pin=re.sub(r"\.0$", "", g(r, "PIN Code")),
                          folio_number=g(r, "Folio Number of Securities") or g(r, "Folio Number"),
                          dp_client_id=g(r, "DP Id Client Id- Account Number"),
                          unclaimed_amount=amt, source_file=src))
    return [h for h in out if h]


# ── batch 51-80 parsers ──────────────────────────────────────────────────────
def _pdf_text(path):
    from pypdf import PdfReader
    out = []
    for p in PdfReader(str(path)).pages:
        out.append(re.sub(r"[^\x20-\x7E\n]", " ", (p.extract_text() or "").translate(_DASHES)))
    return "\n".join(out)


# address tokens that mark the end of a name when the two are run together
ADDR_STOP = re.compile(
    r"^(C/O|S/O|D/O|W/O|H/O|M/S|NO|NO\.|H|HNO|H\.NO|FLAT|PLOT|HOUSE|BUNGLOW|BUNGALOW|"
    r"ROOM|BLOCK|WARD|VILL|VILLAGE|POST|PO|P\.O|NEAR|OPP|BEHIND|QTR|QR|QUARTER|ROAD|"
    r"STREET|LANE|SECTOR|PHASE|BLDG|BUILDING|APT|APARTMENT|TOWER|FLOOR|DIST|DISTT|AT|"
    r"NEW|OLD|SHOP|GALI|MARG|NAGAR|COLONY|SOCIETY|CHAWL|MAIN|CROSS|TYPE|DOOR|DR|A/P)$")


def _name_then_addr(blob, maxtok=5):
    """Split 'NAME rest-is-address' where the address starts at the first token
    holding a digit or matching a known address keyword."""
    toks = blob.split()
    name = []
    for t in toks:
        if re.search(r"\d", t) or ADDR_STOP.match(t) or "/" in t:
            break
        name.append(t)
        if len(name) >= maxtok:
            break
    if not name:
        name = toks[:2]
    return " ".join(name), " ".join(toks[len(name):])


def parse_xlsx_sail(path, src):
    """SAIL: S No | FOLIO NO | NAME | 10 x DIV_AMT_<year> columns.
    One row per holder; unclaimed_amount = sum of every dividend column."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb["Sheet1"]
    out, hdr = [], None
    for row in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v).strip() for v in row]
        if hdr is None:
            if any(c.upper() == "NAME" for c in cells):
                hdr = [c.upper() for c in cells]
            continue
        col = {n: i for i, n in enumerate(hdr)}
        name = cells[col["NAME"]] if col.get("NAME") is not None else ""
        if not name:
            continue
        folio = cells[col["FOLIO NO"]].lstrip("`") if col.get("FOLIO NO") is not None else ""
        total = 0.0
        for h, i in col.items():
            if h.startswith("DIV_AMT") and i < len(cells):
                total += num(cells[i]) or 0
        out.append(holder(name, folio_number=folio or None,
                          dp_client_id=folio if folio[:2] in ("IN", "12", "13") else None,
                          unclaimed_amount=total or None,
                          financial_year="FY2018-19 to FY2024-25",
                          dividend_type="Cumulative unpaid dividend", source_file=src))
    return [h for h in out if h]


def parse_xlsx_canara(path, src):
    """Canara Bank: 5 sheets, MCA column names in UPPER CASE, one row per holder."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        hdr = None
        for row in ws.iter_rows(values_only=True):
            cells = ["" if v is None else str(v).strip() for v in row]
            if hdr is None:
                if any(c.upper().startswith("INVESTOR FIRST NAME") for c in cells):
                    hdr = {c.upper().strip(): i for i, c in enumerate(cells) if c}
                continue

            def g(k):
                i = hdr.get(k)
                return cells[i] if i is not None and i < len(cells) else ""

            fn = " ".join(x for x in [g("INVESTOR FIRST NAME"), g("INVESTOR MIDDLE NAME"),
                                      g("INVESTOR LAST NAME")] if x and x != "None").strip()
            if not fn:
                continue
            father = " ".join(x for x in [g("FATHER/HUSBAND FIRST NAME"),
                                          g("FATHER/HUSBAND MIDDLE NAME"),
                                          g("FATHER/HUSBAND LAST NAME")]
                              if x and x not in ("NA", "None")).strip()
            out.append(holder(fn, first_name=g("INVESTOR FIRST NAME") or None,
                              middle_name=g("INVESTOR MIDDLE NAME") or None,
                              last_name=g("INVESTOR LAST NAME") or None,
                              father_or_husband_name=father or None, address=g("ADDRESS"),
                              state=g("STATE").title() or None,
                              pin=re.sub(r"\.0$", "", g("PIN CODE")) or None,
                              folio_number=g("FOLIO NUMBER") or None,
                              dp_client_id=g("DP ID CLIENT ID") or None,
                              unclaimed_amount=num(g("AMOUNT TRANSFERRED")),
                              transfer_date=parse_date(g("PROPOSED DATE OF TRANSFER")),
                              source_file=src))
    return [h for h in out if h]


def parse_xlsx_acc(path, src):
    """ACC: header row '# Recs | Folio / Demat A/C | Name | Address | Micr | Warrant | Amount'."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb["Sheet4"]
    out, col = [], None
    for row in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v).strip() for v in row]
        if col is None:
            if any(c.startswith("Name Of The Shareholder") for c in cells):
                col = {c: i for i, c in enumerate(cells) if c}
            continue

        def g(k):
            i = col.get(k)
            return cells[i] if i is not None and i < len(cells) else ""

        name = g("Name Of The Shareholder")
        if not name:
            continue
        addr = re.sub(r"\s+", " ", g("Address Of The Shareholder"))
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          folio_number=g("Folio / Demat A/C") or None,
                          warrant_no=g("Warrant No.") or None,
                          unclaimed_amount=num(g("Amount")),
                          dividend_type="78th Final Dividend", source_file=src))
    return [h for h in out if h]


def parse_pdf_iocl(path, src):  # SNO FOLIO NAME SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+([A-Z]{2,4}\d{4,})\s+([A-Z][A-Z .&']+?)\s+([\d,]+)$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_godrej(path, src):  # SR FOLIO NAME ADDRESS SHARES AMOUNT (wraps)
    text = _pdf_text(path)
    text = re.sub(r"\s*\n\s*", " ", text)
    out = []
    for m in re.finditer(r"(?<!\d)(\d{1,6})\s+([A-Z]\d{5,7})\s+(.+?)\s+(\d{1,7})\s+([\d,]+\.\d{2})", text):
        name, addr = _name_then_addr(m.group(3), maxtok=6)
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          folio_number=m.group(2), shares=intval(m.group(4)),
                          unclaimed_amount=num(m.group(5)),
                          financial_year="Nov 2009 to May 2016", source_file=src))
    return [h for h in out if h]


def parse_pdf_pidilite(path, src):  # SRNO WNO FLNO NAME ADDRESS SHARES NETDVD
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+(\d{1,6})\s+(PI[A-Z]\d{6,})\s+(.+?)\s+(\d{1,7})\s+([\d,]+\.\d{2})", text):
        name, addr = _name_then_addr(m.group(3), maxtok=6)
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          folio_number=m.group(2), warrant_no=m.group(1),
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          financial_year="FY2024-25", source_file=src))
    return [h for h in out if h]


def parse_pdf_havells(path, src):
    """Havells: SR FOLIO NAME ADDRESS PIN SHARES <per-year amounts> TOTAL, wrapped
    across lines. Split on the folio, then read the money off the tail."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,4}\s+((?:IN\d{14}|\d{16}|\d{7}))\s+(.+?)\s+(\d{6})\s+"
                         r"(\d{1,7})\s+((?:[\d,]+\.\d{2}\s*)+)", text):
        name, addr = _name_then_addr(m.group(2), maxtok=4)
        amts = re.findall(r"[\d,]+\.\d{2}", m.group(5))
        f = m.group(1)
        demat = f.startswith("IN") or len(f) == 16
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          pin=m.group(3), folio_number=None if demat else f,
                          dp_client_id=f if demat else None,
                          shares=intval(m.group(4)), unclaimed_amount=num(amts[-1]),
                          financial_year="FY2018-19 to FY2024-25", source_file=src))
    return [h for h in out if h]


def parse_pdf_torrent(path, src):
    """Torrent: Sno+FOLIO glued, NAME, SHARES, AMOUNT, ADDRESS. The amount often
    runs into the address, so recover it from the per-share dividend rate that
    the unambiguous (space-separated) rows establish."""
    lines = [l for l in _pdf_lines(path) if l]
    clean_rows, rate_votes = [], {}
    pat = re.compile(r"^(\d{0,4}?)\s*((?:IN\d{14,16}|\d{14,16}|[A-Z]{1,4}\d{4,}))\s+"
                     r"([A-Z][A-Z .&']+?)\s+(\d{1,7})\s+(\d[\d,]*)(.*)$")
    for ln in lines:
        m = pat.match(ln)
        if not m:
            continue
        shares = intval(m.group(4))
        blob, tail = m.group(5).replace(",", ""), m.group(6)
        clean_rows.append((m.group(2), m.group(3), shares, blob, tail))
        if tail.startswith(" ") and shares:
            r = round(int(blob) / shares, 4)
            rate_votes[r] = rate_votes.get(r, 0) + 1
    rate = max(rate_votes, key=rate_votes.get) if rate_votes else None
    out = []
    for folio, name, shares, blob, tail in clean_rows:
        amt, addr = None, tail.strip()
        if rate and shares:
            want = str(int(round(shares * rate)))
            if blob.startswith(want):                 # amount glued to address
                amt, addr = float(want), (blob[len(want):] + tail).strip()
            elif blob == want:
                amt = float(want)
        if amt is None:
            addr = (blob + tail).strip() if not tail.startswith(" ") else addr
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          folio_number=folio if not folio[0].isdigit() else None,
                          dp_client_id=folio if folio[0].isdigit() else None,
                          shares=shares, unclaimed_amount=amt,
                          dividend_type="Interim", financial_year="2019-20", source_file=src))
    return [h for h in out if h]


def parse_pdf_dabur(path, src):  # N<DPID> NAME SHARES DD-MM-YYYY
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+((?:IN\d{14}|\d{16}|[A-Z]\d{6,}))\s+(.+?)\s+(\d+)\s+(\d{2}-\d{2}-\d{4})$", ln)
        if not m:
            continue
        f = m.group(1)
        out.append(holder(m.group(2), folio_number=f if f[0].isalpha() and not f.startswith("IN") else None,
                          dp_client_id=f if f.startswith("IN") or f[0].isdigit() else None,
                          shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_marico(path, src):
    """Marico: SR FOLIO NAME ADDRESS PIN SHARES AMOUNT. Records run together in
    the extracted text, so anchor on the folio and read to the money tail."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,4}\s+((?:IN\d{14}|\d{16}|[A-Z]{1,3}\d{5,}))\s*"
                         r"(.+?),?\s*(\d{6})\s+(\d[\d,]*)\s+(\d[\d,]*)(?!\S)", text):
        name, addr = _name_then_addr(m.group(2), maxtok=5)
        f = m.group(1)
        demat = f.startswith("IN") or f[0].isdigit()
        out.append(holder(name, address=addr or None, state=detect_state(m.group(2)),
                          pin=m.group(3), folio_number=None if demat else f,
                          dp_client_id=f if demat else None,
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          source_file=src))
    return [h for h in out if h]


def _mca_pdf_records(path, marker):
    """MCA IEPF-2 PDFs print one investor per record with a fixed 'Amount for ...
    dividend' label between the identity block and the money block. Splitting on
    that label yields chunks of the form
        <record i-1 money tail><record i identity>
    so each chunk pairs with the NEXT chunk's head for the money. Callers read
    the identity from the END of their chunk and ignore the leading tail."""
    text = _pdf_text(path)
    chunks = re.split(marker, text)
    for i in range(len(chunks) - 1):
        yield chunks[i], chunks[i + 1]


# a line that belongs to the previous record's money block, not to an identity
MCA_NOISE = re.compile(r"^(?:NO|YES|N\.A\.?|FY-\d|[A-Z]{5}\d{4}[A-Z]|X{4,}\d*|"
                       r"[\d,]+\.\d{2}|\d{2}-[A-Z]{3}-\d{4}|\d{2}-\d{2}-\d{4}|"
                       r"Page \d+.*|\s*)$", re.I)


def parse_pdf_bel(path, src):
    """BEL: MCA IEPF-2, one field per line — name, father, address, INDIA,
    state, district, pin, folio | AMOUNT, date, flags, FY-n."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for unclaimed and unpaid dividend"):
        lines = [l.strip() for l in ident.splitlines() if l.strip()]
        if len(lines) < 6:
            continue
        try:
            k = max(i for i, l in enumerate(lines) if l.upper() == "INDIA")
        except ValueError:
            continue
        tail = lines[k + 1:]
        if len(tail) < 4:
            continue
        state, district, pin, folio = tail[0], tail[1], tail[2], tail[3]
        if not re.fullmatch(r"\d{6}", pin):
            continue
        head = lines[:k]
        if len(head) < 3:
            continue
        addr = head[-1]
        # name may wrap over several lines; father is the line just before the
        # address. Walk back from there while the lines still look like a name —
        # anything numeric or flag-like is the previous record's money block.
        father = head[-2]
        j = len(head) - 2
        while j > 0 and not MCA_NOISE.match(head[j - 1]) and re.fullmatch(r"[A-Z.&'-]+", head[j - 1]):
            j -= 1
        name = "".join(head[j:-2])
        if not name or len(name) > 90:
            continue
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", money)
        fy = re.search(r"\bFY-(\d)\b", money)
        out.append(holder(name, father_or_husband_name=None if father.upper() in ("NA", "NOTAVAILABLE") else father,
                          address=addr, state=state.title(), pin=pin,
                          folio_number=folio if folio[0].isalpha() and not folio.startswith("IN") else None,
                          dp_client_id=folio if folio.startswith("IN") or folio[0].isdigit() else None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None,
                          financial_year=f"FY-{fy.group(1)}" if fy else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_bosch(path, src):
    """Bosch: MCA IEPF-2 flowed as prose. Identity block ends
    '... INDIA STATE DISTRICT PIN FOLIO'; the name is the leading glued caps run."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for unpaid and\s+unclaimed dividend"):
        blob = re.sub(r"\s*\n\s*", " ", ident).strip()
        # drop the previous record's money tail (…amount DD-MON-YYYY [flags])
        cut = list(re.finditer(r"\d{2}-[A-Z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        m = re.search(r"(.+?)\s+INDIA\s+([A-Z][A-Z ]+?)\s+([A-Z][A-Z ]+?)\s+(\d{6})\s+(\S+)$", blob)
        if not m:
            continue
        toks = m.group(1).split()
        if not toks:
            continue
        name = toks[0]
        if len(name) < 4:
            continue
        addr = " ".join(toks[1:])
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", money)
        folio = m.group(5)
        out.append(holder(name, address=addr or None, state=m.group(2).title(), pin=m.group(4),
                          folio_number=folio if folio[0].isalpha() and not folio.startswith("IN") else None,
                          dp_client_id=folio if folio.startswith("IN") or folio[0].isdigit() else None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_persistent(path, src):
    """Persistent: MCA IEPF-2; 'NAME NA ADDRESS INDIA STATE [DIST] PIN DPID'."""
    out = []
    for ident, money in _mca_pdf_records(path, r"AMOUNT FOR UNPAID AND\s+UNCLAIMED DIVIDEND"):
        blob = re.sub(r"\s*-\s*\n\s*", "-", ident)          # rejoin split DP-IDs
        blob = re.sub(r"\s*\n\s*", " ", blob).strip()
        cut = list(re.finditer(r"\d{2}-[A-Z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        blob = re.sub(r"^(?:NO|YES|FY-\d|\s)+", "", blob).strip()
        m = re.search(r"([A-Z][A-Z .&']+?)\s+NA\s+(.+?)\s+"
                      r"((?:IN\d{6}-\d{8}-\d{4}|\d{8}-\d{8}-\w{4}))\s*$", blob)
        if not m:
            continue
        addr = m.group(2)
        pin = re.search(r"\b(\d{6})\b", addr)
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", money)
        fy = re.search(r"\bFY-(\d)\b", money)
        out.append(holder(m.group(1), address=addr, state=detect_state(addr),
                          pin=pin.group(1) if pin else None,
                          dp_client_id=m.group(3).replace(" ", ""),
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None,
                          financial_year=f"FY-{fy.group(1)}" if fy else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_cummins(path, src):  # NAME ADDRESS State PIN CUMM<folio> AMOUNT DATE FY TYPE
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^(.+?)\s+(\d{6})\s+CUMM(\S+)\s+([\d,]+\.\d{2})\s+"
                     r"(\d{2}-\w{3}-\d{4})\s+(\d{4}-\d{2})\s+(\w+)$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=4)
        f = m.group(3)
        out.append(holder(name, address=addr or None, state=detect_state(m.group(1)), pin=m.group(2),
                          folio_number=None if f.startswith("IN") or f[0].isdigit() else f,
                          dp_client_id=f if f.startswith("IN") or f[0].isdigit() else None,
                          unclaimed_amount=num(m.group(4)),
                          transfer_date=parse_date(m.group(5)),
                          financial_year=m.group(6), dividend_type=m.group(7), source_file=src))
    return [h for h in out if h]


def parse_pdf_tatapower(path, src):
    """Tata Power: SR FOLIO TYPE NAME then 8 x (date, warrant, amount), then
    shares, then address. Sum the eight amounts."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    # pypdf breaks tokens mid-word on this file ('13-Sep-20 10', '1,250 .00').
    # Only rejoin the two shapes we know about — a blanket digit-join would
    # weld separate columns together and inflate every amount.
    text = re.sub(r"(\d{1,2}-[A-Za-z]{3}-\d{1,2})\s+(\d{1,3})(?=\s)", r"\1\2", text)
    text = re.sub(r"([\d,]+)\s*\.\s*(\d{2})(?=\s|$)", r"\1.\2", text)
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+([A-Z0-9]{6,12})\s+(PHY|DMT|NSDL|CDSL)\s+"
                         r"([A-Z][A-Z .&']+?)\s+(\d{1,2}-[A-Za-z]{3}-\d{4}.*?)"
                         r"(?=\s\d{1,6}\s+[A-Z0-9]{6,12}\s+(?:PHY|DMT|NSDL|CDSL)\s|$)", text):
        body = m.group(4)
        amts = re.findall(r"[\d,]+\.\d{2}", body)
        if not amts:
            continue
        total = sum(num(a) or 0 for a in amts)
        if total > 5_000_000:            # extraction went wrong — drop, never guess
            continue
        after = body[body.rfind(amts[-1]) + len(amts[-1]):]
        sh = re.match(r"\s+([\d,]+)\s", after)
        addr = after[sh.end():].strip() if sh else after.strip()
        out.append(holder(m.group(3), address=addr or None, state=detect_state(addr),
                          folio_number=m.group(1), holder_type=m.group(2),
                          shares=intval(sh.group(1)) if sh else None,
                          unclaimed_amount=total or None,
                          financial_year="2009 to 2016", source_file=src))
    return [h for h in out if h]


def parse_pdf_ambuja(path, src):  # SR DPID FOLIO NAME ADDR.. PIN HOLDING <warrant,amt> x7
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(IN\d{6}|\S+)\s+([A-Z]{2}\d{6}|\d{8,})\s+(.+?)\s+(\d{6})\s+(\d+)\s+(.*)$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(3), maxtok=5)
        nums = [int(x) for x in re.findall(r"\b\d+\b", m.group(6))]
        total = sum(nums[1::2]) if len(nums) >= 2 else None    # warrant, amount, warrant, amount…
        out.append(holder(name, address=addr or None, state=detect_state(addr), pin=m.group(4),
                          folio_number=m.group(2), shares=intval(m.group(5)),
                          unclaimed_amount=float(total) if total else None,
                          financial_year="FY2016-17 onward", source_file=src))
    return [h for h in out if h]


def parse_pdf_shreecement(path, src):  # SR FOLIO NAME ADDRESS PIN SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(SCL\d{6})\s*(.+?)\s+(\d{6})\s+(\d+)$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(2), maxtok=5)
        out.append(holder(name, address=addr or None, state=detect_state(addr), pin=m.group(3),
                          folio_number=m.group(1), shares=intval(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_dalmia(path, src):  # SR FOLIO NAME SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(DBL\d{6,})\s+([A-Z][A-Z .&']+?)\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_pnb(path, src):  # SR FOLIO / NAME ADDRESS SHARES N.A. dates AMOUNT ...
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+((?:IN\d{14}|\d{8,16}))\s+([A-Z].+?)\s+(\d{1,7})\s+"
                         r"N\.A\.\s+[\d/]+\s+[\d/]+\s+([\d,]+\.\d{2})", text):
        name, addr = _name_then_addr(m.group(2), maxtok=5)
        f = m.group(1)
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          folio_number=None if f.startswith("IN") else f,
                          dp_client_id=f if f.startswith("IN") else None,
                          shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                          financial_year="2005-06", source_file=src))
    return [h for h in out if h]


def parse_pdf_bob(path, src):  # SR NAME ADDRESS PIN FOLIO AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(.+?)\s+(\d{6})\s+([A-Z]{2,6}\d{4,})\s+([\d,]+\.\d{2})$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=5)
        out.append(holder(name, address=addr or None, state=detect_state(addr), pin=m.group(2),
                          folio_number=m.group(3), unclaimed_amount=num(m.group(4)),
                          financial_year="FY2016-17", source_file=src))
    return [h for h in out if h]


def parse_pdf_boi(path, src):  # SR FOLIO NAME SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(\d{6})\s+([A-Z][A-Z .&']+?)\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_siemens(path, src):  # SR NAME ADD1 ADD2 ADD3 CITY PIN SHARES AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+(.+?)\s+(\d{6})\s+(\d+)\s+([\d,]+\.\d{2})$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=5)
        out.append(holder(name, address=addr or None, state=detect_state(addr), pin=m.group(2),
                          shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                          financial_year="FY2023-24", source_file=src))
    return [h for h in out if h]


def parse_pdf_3m(path, src):
    """3M: SNO DPID/CLID NAME ADDR1..4 PIN SHARES AMOUNT. This one is genuinely
    column-formatted — name and address are separated by a run of spaces — so
    split the record on 2+ spaces instead of guessing where the name ends."""
    text = _pdf_text(path).replace("\n", " ")
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,5}\s*((?:IN\d{14}|\d{6}\s+\d{10}|\d{16}))"
                         r"(.+?)\s+(\d{6})\s+(\d{1,7})\s+([\d,]+\.\d{2})", text):
        parts = [p.strip() for p in re.split(r"\s{2,}", m.group(2).strip()) if p.strip()]
        if not parts:
            continue
        name, addr = parts[0], re.sub(r"\s+", " ", " ".join(parts[1:]))
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          pin=m.group(3), dp_client_id=m.group(1).replace(" ", ""),
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          financial_year="FY2024-25", source_file=src))
    return [h for h in out if h]


def parse_pdf_mphasis(path, src):  # SL DPID/FOLIO NAME AMOUNT SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d+\s+((?:IN\d{14}|\d{16}|[A-Z]\d{5,}))\s+([A-Z][A-Z .&']+?)\s+"
                     r"([\d,]+\.\d{2})\s+([\d,]+)$", ln)
        if not m:
            continue
        f = m.group(1)
        out.append(holder(m.group(2),
                          folio_number=None if f.startswith("IN") or f[0].isdigit() else f,
                          dp_client_id=f if f.startswith("IN") or f[0].isdigit() else None,
                          unclaimed_amount=num(m.group(3)), shares=intval(m.group(4)),
                          financial_year="7 years to 31-Mar-2026", source_file=src))
    return [h for h in out if h]


# ── batch 81-100 parsers ─────────────────────────────────────────────────────
def parse_xlsx_hpcl(path, src):
    """HPCL: SR NO | FLNO | NAM1 | ADD1-3 | CITY | PIN | … | Total Amt | Shares to Trsf."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = next(w for w in wb.worksheets if w.title.startswith("HPCL_Unpaid"))
    out, col = [], None
    for row in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v).strip() for v in row]
        if col is None:
            if any(c == "NAM1" for c in cells):
                col = {c: i for i, c in enumerate(cells) if c}
            continue

        def g(k):
            i = col.get(k)
            return cells[i] if i is not None and i < len(cells) else ""

        name = g("NAM1")
        if not name:
            continue
        addr = " ".join(x for x in [g("ADD1"), g("ADD2"), g("ADD3"), g("CITY")] if x and x != "None")
        f = g("FLNO")
        demat = f[:2] in ("IN", "12", "13")
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          pin=re.sub(r"\.0$", "", g("PIN")) or None,
                          folio_number=None if demat else f or None,
                          dp_client_id=f if demat else None,
                          pan=g("PAN") or None,
                          unclaimed_amount=num(g("Total Amt")),
                          shares=intval(g("Shares to Trsf to IEPF")),
                          financial_year="FY2018-19 to FY2025-26", source_file=src))
    return [h for h in out if h]


def parse_xlsx_berger(path, src):
    """Berger: FOLIO_NO | NAME | YR_2017..YR_2023 | TOTAL_SHARES | ADD1-4 | PIN."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb["Sheet1"]
    out, col = [], None
    for row in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v).strip() for v in row]
        if col is None:
            if any(c == "FOLIO_NO" for c in cells):
                col = {c: i for i, c in enumerate(cells) if c}
            continue

        def g(k):
            i = col.get(k)
            return cells[i] if i is not None and i < len(cells) else ""

        name = g("NAME")
        if not name:
            continue
        addr = " ".join(x for x in [g("ADD1"), g("ADD2"), g("ADD3"), g("ADD4")] if x and x != "None")
        yrs = sorted(k for k in col if k.startswith("YR_"))
        amt = num(g(yrs[-1])) if yrs else None      # newest year's running total
        pin = re.sub(r"\.0$", "", g("PIN"))
        out.append(holder(name, address=addr or None, state=detect_state(addr),
                          pin=pin if pin and pin != "0" else None,
                          folio_number=g("FOLIO_NO") or None,
                          shares=intval(g("TOTAL_SHARES")), unclaimed_amount=amt,
                          financial_year=yrs[-1].replace("YR_", "") if yrs else None,
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_gic(path, src):
    """GIC Re: Sl.No NAME+ADDRESS (no delimiter) AMOUNT DD-MON-YYYY FY."""
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+(.+?)\s+([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})\s+(\d{4}-\d{2})$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=5)
        out.append(holder(name, address=addr or None, state=detect_state(m.group(1)),
                          unclaimed_amount=num(m.group(2)),
                          transfer_date=parse_date(m.group(3)),
                          financial_year=m.group(4), source_file=src))
    return [h for h in out if h]


def parse_pdf_niacl(path, src):
    """New India Assurance: MCA IEPF-2 printed to PDF with EVERY field wrapped
    onto its own line, e.g.
        AAKASH / AGARWAL / MUKESHAGARWAL / J-3/46 DLF PHASE II ... / INDIA /
        Haryana / 122002 / 12044700- / 05992516- / TH00
    Each chunk still carries the previous record's money tail (amount, split
    date, PAN, split DOB) on the front — every one of those fragments contains a
    digit or a hyphen, which is what lets us find where the name really starts."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for\s+unclaimed\s+and unpaid\s+dividend"):
        lines = [l.strip() for l in ident.splitlines() if l.strip()]
        try:
            k = max(i for i, l in enumerate(lines) if l.upper() == "INDIA")
        except ValueError:
            continue
        after, head = lines[k + 1:], lines[:k]
        if not after or len(head) < 3:
            continue
        state = after[0]
        pin = next((l for l in after if re.fullmatch(r"\d{6}", l)), None)
        dp = re.sub(r"\s+", "", "".join(l for l in after if re.search(r"[-\d]", l) and l != pin))
        # drop the previous record's money tail: every fragment of it has a digit
        # or a hyphen, while a name fragment is pure letters
        i = 0
        while i < len(head) and not re.fullmatch(r"[A-Za-z.'&]{2,}", head[i]):
            i += 1
        head = head[i:]
        # the address is the first fragment that is not a bare name token
        j = 0
        while j < len(head) and re.fullmatch(r"[A-Za-z.'&]{2,}", head[j]):
            j += 1
        if j < 2 or j > len(head):
            continue
        name = " ".join(head[:j - 1])            # last pre-address token = father
        father = head[j - 1]
        addr = " ".join(head[j:])
        if not name:
            continue
        mo = re.search(r"([\d,]+\.\d{2})", money)
        out.append(holder(name, father_or_husband_name=None if father.upper() == "NA" else father,
                          address=addr or None, state=state, pin=pin,
                          dp_client_id=dp or None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_lic(path, src):
    """LIC: SR DPID NAME FATHER ADDRESS… PIN WARRANT 0 AMOUNT SHARES DD.MM.YYYY.
    pypdf splits decimals here ('22 .50'), so allow a space inside the amount."""
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+((?:IN\d{14}|\d{16}))\s+(.+?)\s+(\d[\d,]*\s?\.\s?\d{2})\s+"
                     r"(\d+)\s+(\d{2}\.\d{2}\.\d{4})$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(2), maxtok=4)
        out.append(holder(name, address=addr or None, state=detect_state(m.group(2)),
                          dp_client_id=m.group(1),
                          unclaimed_amount=num(m.group(3).replace(" ", "")),
                          shares=intval(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_lichousing(path, src):  # NAME DPID <marker> AMOUNT DD-MON-YYYY
    out = []
    for ident, money in _mca_pdf_records(path, r"AMOUNT FOR UNPAID AND UNCLAIMED DIVIDEND"):
        blob = re.sub(r"\s*-\s*\n\s*", "-", ident)
        blob = re.sub(r"\s*\n\s*", " ", blob).strip()
        cut = list(re.finditer(r"\d{2}-[A-Z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        m = re.search(r"([A-Z][A-Z .&']+?)\s+((?:IN\d{6}-\d{8}-\d{3,4}|\d{8}-\d{8}-\w{4}))\s*$", blob)
        if not m:
            continue
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", money)
        out.append(holder(m.group(1), dp_client_id=m.group(2),
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None,
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_petronet(path, src):  # <DIVTYPE YY> NAME 'FOLIO SHARES AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^([A-Z]+\s+\d{4})\s+(.+?)\s+'?((?:IN\d{14}|\d{16}))\s+(\d+)\s+([\d,]+)$", ln)
        if not m:
            continue
        out.append(holder(m.group(2), dp_client_id=m.group(3),
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          dividend_type=m.group(1).split()[0].title(),
                          financial_year=m.group(1).split()[1], source_file=src))
    return [h for h in out if h]


def parse_pdf_castrol(path, src):
    """Castrol: MCA IEPF-2 flowed as prose, same shape as Bosch."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for unclaimed and\s+unpaid dividend"):
        blob = re.sub(r"\s*-\s*\n\s*", "-", ident)
        blob = re.sub(r"\s*\n\s*", " ", blob).strip()
        cut = list(re.finditer(r"\d{2}-[A-Za-z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        blob = re.sub(r"^(?:No|Yes|FY-\d|\s)+", "", blob).strip()
        m = re.search(r"(.+?)\s+INDIA\s+([A-Za-z ]+?)\s+(\d{6})\s+(\S+)$", blob)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=4)
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})", money)
        f = m.group(4)
        demat = f.startswith("IN") or f[0].isdigit()
        out.append(holder(name, address=addr or None, state=m.group(2).strip().title(),
                          pin=m.group(3), folio_number=None if demat else f,
                          dp_client_id=f if demat else None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None,
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_upl(path, src):  # SR NAME ADDRESS PIN FOLIO SHARES AMOUNT DD-MON-YYYY
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,5}\s+(.+?)\s+(\d{6})\s+([A-Z]?\d{5,})\s+(\d{1,7})\s+"
                         r"([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", text):
        name, addr = _name_then_addr(m.group(1), maxtok=5)
        out.append(holder(name, address=addr or None, state=detect_state(m.group(1)),
                          pin=m.group(2), folio_number=m.group(3),
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          transfer_date=parse_date(m.group(6)), source_file=src))
    return [h for h in out if h]


def parse_pdf_coromandel(path, src):  # SR NAME FOLIO SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+([A-Z][A-Z .&']+?)\s+([A-Z]{2,6}\d{5,})\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(1), folio_number=m.group(2),
                              shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_chambal(path, src):
    """Chambal: NAME with the serial number GLUED to its end, then folio, shares.
    e.g. 'A SUNDARARAJAN76 E0112157  100'."""
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^([A-Z][A-Za-z .&'()-]+?)(\d{1,6})\s+([A-Z]?\d{5,}|[A-Z]{2}\d{14})\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(1).strip(), folio_number=m.group(3),
                              shares=intval(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_gfl(path, src):  # SR FOLIO NAME SHARES (folio may be glued to name)
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,5}\s+((?:IN\d{14}|[A-Z]\d{6}))\s*([A-Z][A-Za-z .&']+?)\s+(\d+)$", ln)
        if not m:
            continue
        f = m.group(1)
        out.append(holder(m.group(2), folio_number=None if f.startswith("IN") else f,
                          dp_client_id=f if f.startswith("IN") else None,
                          shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_akzo(path, src):
    """Akzo Nobel / JSW Dulux: NAME NA NA NA ADDRESS INDIA State District PIN
    FOLIO SHARES AMOUNT DD-MON-YYYY. The folio wraps mid-token
    ('000000000000000IC' + '023'), so match the record on the shares/amount/date
    tail and pull pin + folio out of the middle afterwards."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"([A-Z][A-Z .&']{3,}?)\s+NA\s+NA\s+NA\s+(.+?)\s+INDIA\s+(.+?)\s+"
                         r"(\d{1,7})\s+([\d,]+)\s+(\d{2}-[A-Z]{3}-\d{4})", text):
        mid = m.group(3)
        pin = re.search(r"\b(\d{6})\b", mid)
        folio = re.sub(r"\s+", "", mid[pin.end():]) if pin else None
        state = mid[:pin.start()].strip() if pin else mid.strip()
        out.append(holder(m.group(1), address=m.group(2), state=state.split()[0].title() if state else None,
                          pin=pin.group(1) if pin else None,
                          folio_number=folio or None,
                          shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                          transfer_date=parse_date(m.group(6)), source_file=src))
    return [h for h in out if h]


def parse_pdf_whirlpool(path, src):  # NAME FOLIO/DPID AMOUNT FY-n
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^([A-Z][A-Z .&']+?)\s+((?:WHIR\w+|IN\d{6}-\d{8}-\d{4}|\d{8}-\d{8}-\w{4}))\s+"
                     r"([\d,]+\.\d{2})\s+(FY-\d)$", ln)
        if not m:
            continue
        f = m.group(2)
        out.append(holder(m.group(1),
                          folio_number=f if f.startswith("WHIR") else None,
                          dp_client_id=None if f.startswith("WHIR") else f,
                          unclaimed_amount=num(m.group(3)),
                          financial_year=m.group(4), source_file=src))
    return [h for h in out if h]


# ── batch 101-120 parsers ────────────────────────────────────────────────────
# repeated page banners / column headers that would otherwise be read as names
HDR_NOISE = re.compile(r"FIRST NAME|MIDDLE NAME|LAST NAME|INVESTOR|FATHER/|SHAREHOLDER|"
                       r"UNPAID|UNCLAIMED|DIVIDEND|DETAILS|TRANSFER|PINCODE|PIN CODE|"
                       r"DUE DATE|NATURE|AMOUNT|ADDRESS|COUNTRY|DISTRICT|AS ON|DECLARATION|"
                       r"CIN/BCIN|NEW-\d|COMPANY/BANK", re.I)


def parse_pdf_oberoi(path, src):
    """Oberoi Realty: NAME ADDRESS INDIA STATE [DISTRICT] <marker> AMOUNT DATE.
    Every page repeats the company banner + column header, which lands inside
    the first record's identity chunk — strip it before reading the name."""
    out = []
    for ident, money in _mca_pdf_records(path, r"AMOUNT FOR UNPAID AND UNCLAIMED\s+DIVIDEND"):
        blob = re.sub(r"\s*\n\s*", " ", ident).strip()
        cut = list(re.finditer(r"\d{2}-[A-Z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        blob = re.sub(r"Oberoi Realty Limited.*?(?:Transfer to IEPF|Dividend[^A-Z]*)", " ", blob)
        blob = re.sub(r"Investor First Name.*?Transfer to IEPF", " ", blob, flags=re.I)
        m = re.search(r"(.+?)\s+INDIA\s+(.+)$", blob)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1).strip(), maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        rest = m.group(2)
        pin = re.search(r"\b(\d{6})\b", m.group(1) + " " + rest)
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", money)
        out.append(holder(name, address=addr or None, state=detect_state(rest) or detect_state(m.group(1)),
                          pin=pin.group(1) if pin else None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_bharatforge(path, src):  # SN FOLIO(glued)NAME SHARES AMOUNT DD-MM-YYYY
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+((?:IN\d{14}|\d{16}|[A-Z]{0,3}\d{5,}))\s*([A-Z][A-Za-z .&'()]+?)\s+"
                     r"(\d[\d,]*)\s+([\d,]+\.\d{2})\s+(\d{2}-\d{2}-\d{4})$", ln)
        if not m:
            continue
        f = m.group(1)
        demat = f.startswith("IN") or (f[0].isdigit() and len(f) >= 14)
        out.append(holder(m.group(2), folio_number=None if demat else f,
                          dp_client_id=f if demat else None,
                          shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_thermax(path, src):
    """Thermax: NAME / ADDRESS / INDIA STATE DISTRICT PIN FOLIO AMOUNT DATE.
    No marker label, and the state/district wrap mid-word ('HYDERAB / AD'), so
    walk the text segment by segment: each record ENDS at 'amount date', and
    within a segment the LAST 'INDIA' splits identity from location."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out, pos = [], 0
    for m in re.finditer(r"([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})", text):
        seg, pos = text[pos:m.start()], m.end()
        idx = seg.rfind(" INDIA ")
        if idx < 0:
            continue
        head, tail = seg[:idx].strip(), seg[idx + 7:]
        tm = re.search(r"(\d{6})\s+(\S+)\s*$", tail)
        name, addr = _name_then_addr(head, maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        f = tm.group(2) if tm else None
        demat = bool(f) and (f.startswith("IN") or f[0].isdigit())
        out.append(holder(name, address=addr or None,
                          state=detect_state(tail) or detect_state(head),
                          pin=tm.group(1) if tm else None,
                          folio_number=None if demat else f,
                          dp_client_id=f if demat else None,
                          unclaimed_amount=num(m.group(1)),
                          transfer_date=parse_date(m.group(2)), source_file=src))
    return [h for h in out if h]


def parse_pdf_apollotyres(path, src):  # S.NO MEMBER-ID SHARES NAME
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+([A-Z]?\d{6,})\s+(\d[\d,]*)\s+([A-Z][A-Za-z .&']+)$", ln)
        if m:
            out.append(holder(re.sub(r"\s+", " ", m.group(3)), folio_number=m.group(1),
                              shares=intval(m.group(2)),
                              financial_year="2009 to 2016", source_file=src))
    return [h for h in out if h]


def parse_pdf_irctc(path, src):  # SNO DPID NAME ADDRESS <per-year amounts> TOTAL
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+((?:IN\d{14}|\d{16}))\s+(.+?)\s+((?:[\d,]+\.\d{2}\s*)+)$", ln)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(2), maxtok=4)
        amts = re.findall(r"[\d,]+\.\d{2}", m.group(3))
        out.append(holder(name, address=addr or None, state=detect_state(m.group(2)),
                          dp_client_id=m.group(1), unclaimed_amount=num(amts[-1]),
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_ceat(path, src):
    """CEAT: MCA IEPF-2 flowed, columns wrapped hard (10k+ pages)."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for\s+unpaid and\s+unclaimed\s+dividend"):
        blob = re.sub(r"\s*\n\s*", " ", ident).strip()
        cut = list(re.finditer(r"\d{1,2}-[A-Za-z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        m = re.search(r"(.+?)\s+INDIA\s+([A-Za-z ]+?)\s+(\d{6})\s+(\S+)", blob)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})", money)
        # one row per investor PER DECLARED DIVIDEND — the declaration date is the
        # year discriminator; without it dedupe collapses all years into one row
        out.append(holder(name, address=addr or None, state=m.group(2).strip().title(),
                          pin=m.group(3), folio_number=m.group(4),
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          financial_year=mo.group(2) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_prestige(path, src):
    """Prestige Estates: MCA IEPF-2 flowed."""
    out = []
    for ident, money in _mca_pdf_records(path, r"Amount for unclaimed and\s+unpaid dividend"):
        blob = re.sub(r"\s*\n\s*", " ", ident).strip()
        cut = list(re.finditer(r"\d{1,2}-[A-Za-z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        m = re.search(r"(.+?)\s+INDIA\s+([A-Za-z ]+?)\s+(?:[A-Za-z ]+?\s+)?(\d{6})\s+(\S+)", blob)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1), maxtok=4)
        if not name:
            continue
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})", money)
        out.append(holder(name, address=addr or None, state=m.group(2).strip().title(),
                          pin=m.group(3), folio_number=m.group(4),
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo else None, source_file=src))
    return [h for h in out if h]


def parse_pdf_bdl(path, src):  # SNO DPID NAME ADDRESS PIN AMOUNT DD-Mon-YYYY
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+((?:IN\d{14}|\d{16}))\s+(.+?)\s+([\d,]+\.\d{2})\s+"
                         r"(\d{2}-[A-Za-z]{3}-\d{4})", text):
        name, addr = _name_then_addr(m.group(2), maxtok=5)
        pin = re.search(r"\b(\d{6})\b", m.group(2))
        out.append(holder(name, address=addr or None, state=detect_state(m.group(2)),
                          pin=pin.group(1) if pin else None, dp_client_id=m.group(1),
                          unclaimed_amount=num(m.group(3)),
                          transfer_date=parse_date(m.group(4)), source_file=src))
    return [h for h in out if h]


def parse_pdf_godrejprop(path, src):  # SNO MODE FOLIO NAME SHARES SHARES_DUE [DIVIDEND]
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+(DEMAT|PHYSICAL)\s+(\S+)\s+([A-Z][A-Za-z .&']+?)\s+"
                     r"(\d[\d,]*)\s+(\d[\d,]*)\s*([\d,]*\.?\d*)$", ln)
        if not m:
            continue
        f = m.group(2)
        demat = m.group(1) == "DEMAT"
        out.append(holder(m.group(3), folio_number=None if demat else f,
                          dp_client_id=f if demat else None, holder_type=m.group(1).title(),
                          shares=intval(m.group(5)), unclaimed_amount=num(m.group(6)),
                          financial_year="FY2014-15", source_file=src))
    return [h for h in out if h]


def parse_pdf_irfc(path, src):  # SNO NAME ADDRESS FOLIO TYPE PAN SHARES AMOUNT
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+(.+?)\s+((?:IN\d{14}|\d{16}))\s+([A-Z][A-Z ]+?)\s+"
                         r"(?:([A-Z]{5}\d{4}[A-Z])\s+)?(\d[\d,]*)\s+([\d,]+\.\d{2})(?!\d)", text):
        name, addr = _name_then_addr(m.group(1), maxtok=5)
        if not name or HDR_NOISE.search(name):
            continue
        pin = re.search(r"\b(\d{6})\b", m.group(1))
        out.append(holder(name, address=addr or None, state=detect_state(m.group(1)),
                          pin=pin.group(1) if pin else None, dp_client_id=m.group(2),
                          holder_type=m.group(3).strip().title(), pan=m.group(4),
                          shares=intval(m.group(5)), unclaimed_amount=num(m.group(6)),
                          dividend_type="Interim", financial_year="FY2024-25", source_file=src))
    return [h for h in out if h]


# ── batch 121-150 parsers ────────────────────────────────────────────────────
def _parse_mca_flowed(path, src, marker, fy_default=None):
    """Generic MCA IEPF PDF flowed as prose: identity block ends
    '... INDIA <state...> <pin> <folio>' followed by the marker label, then
    'AMOUNT DD-MON-YYYY [flags FY-n]'. Used by 7+ companies in batch 121-150."""
    out = []
    for ident, money in _mca_pdf_records(path, marker):
        blob = re.sub(r"\s*\n\s*", " ", ident).strip()
        cut = list(re.finditer(r"\d{1,2}-[A-Za-z]{3}-\d{4}", blob))
        if cut:
            blob = blob[cut[-1].end():].strip()
        blob = re.sub(r"^(?:No|Yes|NA|FY ?-? ?\d|UNPAID|\s)+", "", blob, flags=re.I).strip()
        m = re.search(r"(.+?)\s+INDIA\s+(.+)$", blob)
        if not m:
            continue
        name, addr = _name_then_addr(m.group(1).strip(), maxtok=4)
        if not name or len(name) < 3 or HDR_NOISE.search(name):
            continue
        rest = m.group(2)
        pin = None
        folio = None
        pm = list(re.finditer(r"\b(\d{6})\b", rest))
        if pm:
            pin = pm[0].group(1)
            folio = re.sub(r"\s+", "", rest[pm[0].end():]) or None
        mo = re.match(r"\s*([\d,]+\.\d{2})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})?", money)
        fy = re.search(r"\bFY ?-? ?(\d)\b", money[:160])
        demat = bool(folio) and (folio.startswith("IN") or folio[:2].isdigit())
        out.append(holder(name, address=addr or None,
                          state=detect_state(rest) or detect_state(m.group(1)), pin=pin,
                          folio_number=None if demat else folio,
                          dp_client_id=folio if demat else None,
                          unclaimed_amount=num(mo.group(1)) if mo else None,
                          transfer_date=parse_date(mo.group(2)) if mo and mo.group(2) else None,
                          financial_year=(f"FY-{fy.group(1)}" if fy else None) or
                                         (mo.group(2) if mo and mo.group(2) else fy_default),
                          source_file=src))
    return [h for h in out if h]


def parse_pdf_hzl(path, src):
    return _parse_mca_flowed(path, src, r"Dividend on shares transferred to IEPF")


def parse_pdf_aurobindo(path, src):
    return _parse_mca_flowed(path, src, r"Amount for unclaimed and unpaid dividend")


def parse_pdf_kirloskar(path, src):
    return _parse_mca_flowed(path, src, r"AMOUNT FOR UNPAID AND\s+UNCLAIMED DIVIDEND")


def parse_pdf_skf(path, src):
    return _parse_mca_flowed(path, src, r"Amount for unclaimed\s+and unpaid dividend")


def parse_pdf_century(path, src):
    return _parse_mca_flowed(path, src, r"Amount for unpaid and\s+unclaimed dividend")


def parse_pdf_zydus(path, src):
    return _parse_mca_flowed(path, src, r"Amount for unclaimed and\s+unpaid dividend")


def parse_pdf_eih(path, src):
    return _parse_mca_flowed(path, src, r"AMOUNT FOR UNCLAIMED\s+AND UNPAID DIVIDEND")


def parse_pdf_raymond(path, src):
    """Raymond: FOLIO NAME HOLDING <amount per FY>... — amounts are per-year
    unclaimed dividends for the same holder; keep their sum."""
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^(\d{6,10})\s+([A-Z][A-Za-z .&'()-]+?)\s+(\d+)\s+((?:[\d,]+(?:\.\d+)?\s*)+)$", ln)
        if not m:
            continue
        amts = [num(a) or 0 for a in re.findall(r"[\d,]+(?:\.\d+)?", m.group(4))]
        out.append(holder(m.group(2), folio_number=m.group(1), shares=intval(m.group(3)),
                          unclaimed_amount=sum(amts) or None,
                          financial_year="FY2015-16 to FY2021-22", source_file=src))
    return [h for h in out if h]


def parse_pdf_alkem(path, src):  # SR DPID NAME ADDR INDIA State PIN AMOUNT (flowed)
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,5}\s+((?:IN\d{14}|\d{16}))\s+(.+?)\s+INDIA\s+"
                         r"([A-Za-z ]+?)\s+(\d{6})\s+([\d,]+\.\d{2})(?!\d)", text):
        name, addr = _name_then_addr(m.group(2), maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        out.append(holder(name, address=addr or None, state=m.group(3).strip().title(),
                          pin=m.group(4), dp_client_id=m.group(1),
                          unclaimed_amount=num(m.group(5)), source_file=src))
    return [h for h in out if h]


def parse_pdf_nalco(path, src):
    """NALCO: SR NAME FATHER ADDR INDIA STATE DIST PIN FOLIO SHARES NOMINAL.
    Nominal value is face value, NOT an unclaimed amount — store shares only."""
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,5}\s+(.+?)\s*INDIA\s+(.+?)\s+(\d{6})\s+(\S+)\s+"
                         r"(\d{1,7})\s+[\d,]+\.\d{2}(?!\d)", text):
        name, _ = _name_then_addr(m.group(1), maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        folio = m.group(4)
        out.append(holder(name, state=detect_state(m.group(2)), pin=m.group(3),
                          dp_client_id=folio if folio.startswith("IN") or folio[:2].isdigit() else None,
                          folio_number=None if folio.startswith("IN") or folio[:2].isdigit() else folio,
                          shares=intval(m.group(5)), source_file=src))
    return [h for h in out if h]


def parse_pdf_ipca(path, src):  # SR FOLIO NAME SHARES
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+([A-Z]?\d{5,})\s+([A-Z][A-Za-z .&']+?)\s+(\d+)$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1),
                              shares=intval(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_lupin(path, src):
    """Lupin: DPID NAME DD-Mon-YYYY AMOUNT SERIAL. The trailing number is a
    running serial, NOT a year — treating it as \\d{4} silently dropped every
    row whose serial wasn't 4 digits (680 of 3739)."""
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^((?:IN\d{14}|\d{16}))\s+(.+?)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+"
                     r"([\d,]+\.\d{2})\s+\d{1,6}$", ln)
        if not m:
            continue
        out.append(holder(m.group(2), dp_client_id=m.group(1),
                          unclaimed_amount=num(m.group(4)),
                          transfer_date=parse_date(m.group(3)),
                          financial_year="FY2024-25", source_file=src))
    return [h for h in out if h]


def parse_pdf_timken(path, src):  # SR NAME SHARES AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+([A-Z][A-Za-z .&']+?)\s+(\d{1,7})\s+([\d,]+\.\d{2})$", ln)
        if m and not HDR_NOISE.search(m.group(1)):
            out.append(holder(m.group(1), shares=intval(m.group(2)),
                              unclaimed_amount=num(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_pdf_moil(path, src):  # SR NAME 'DPID ADDR PIN AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+(.+?)\s+'((?:IN\d{14}|\d{16}))\s+(.*?)\s+(\d{6})\s+([\d,]+\.\d{2})$", ln)
        if not m:
            continue
        out.append(holder(m.group(1), dp_client_id=m.group(2), address=m.group(3) or None,
                          state=detect_state(m.group(3)), pin=m.group(4),
                          unclaimed_amount=num(m.group(5)), source_file=src))
    return [h for h in out if h]


def parse_pdf_nmdc(path, src):
    """NMDC: mainframe-style statement; name line carries amount, due date,
    warrant and DP-ID; father/address lines follow. Bank + dividend-year appear
    in page headers — the year makes each (holder, year) row distinct."""
    year = None
    out = []
    for ln in _pdf_lines(path):
        y = re.search(r"DIVIDEND YEAR\s*:\s*([0-9]{4}-[0-9]{4}\s*\S*)", ln)
        if y:
            year = y.group(1).strip()
            continue
        # '18.TRISHALA JAIN   825.00 10-MAR-2033   50241682 IN304295-10882525'
        m = re.match(r"^(\d{1,6})\.\s*(.+?)\s+([\d,]+\.\d{2})\s+(\d{2}-[A-Z]{3}-\d{4})\s+(\d+)\s*(\S*)$", ln)
        if not m:
            continue
        name = m.group(2).strip(" -/")
        if not name or HDR_NOISE.search(name):
            continue
        dp = m.group(6) or None
        demat = bool(dp) and (dp.startswith("IN") or dp[:2].isdigit())
        out.append(holder(name, dp_client_id=dp if demat else None,
                          folio_number=None if demat else dp,
                          unclaimed_amount=num(m.group(3)),
                          transfer_date=parse_date(m.group(4)),
                          warrant_no=m.group(5),
                          financial_year=year, source_file=src))
    return [h for h in out if h]


def parse_pdf_vedanta(path, src):  # SR FOLIO NAME ADDR PIN SHARES AMOUNT (flowed)
    text = re.sub(r"\s*\n\s*", " ", _pdf_text(path))
    out = []
    for m in re.finditer(r"(?<!\d)\d{1,6}\s+((?:IN\d{14}|\d{16}|[A-Z]{0,3}\d{5,7}))\s+(.+?)\s+"
                         r"(\d{1,7})\s+([\d,]+\.\d{2})(?!\d)", text):
        name, addr = _name_then_addr(re.sub(r"^MR\.?S?\.?\s+", "", m.group(2)), maxtok=4)
        if not name or HDR_NOISE.search(name):
            continue
        f = m.group(1)
        demat = f.startswith("IN") or len(f) == 16
        out.append(holder(name, address=addr or None, state=detect_state(m.group(2)),
                          folio_number=None if demat else f, dp_client_id=f if demat else None,
                          shares=intval(m.group(3)), unclaimed_amount=num(m.group(4)),
                          dividend_type="Interim", financial_year="FY2023-24", source_file=src))
    return [h for h in out if h]


def parse_pdf_ncc(path, src):  # SR FOLIO NAME WARRANT SHARES AMOUNT
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^\d{1,6}\s+(\d{6,8})\s+([A-Z][A-Za-z .&'()-]+?)\s+(\d{6,8})\s+"
                     r"(\d{1,7})\s+([\d,]+\.\d{2})$", ln)
        if m:
            out.append(holder(m.group(2), folio_number=m.group(1), warrant_no=m.group(3),
                              shares=intval(m.group(4)), unclaimed_amount=num(m.group(5)),
                              source_file=src))
    return [h for h in out if h]


def parse_pdf_unominda(path, src):  # DPID WARRANT AMOUNT NAME [bank details]
    out = []
    for ln in _pdf_lines(path):
        m = re.match(r"^((?:IN\d{14}|\d{16}))\s+(\d{1,7})\s+([\d,]+\.\d{2})\s+([A-Z][A-Za-z .&']+?)(?:\s+\d.*)?$", ln)
        if not m:
            continue
        name = re.sub(r"\s+(?:SYN|BANK|PNB|SBI|UNION|INDIAN|CANARA|HDFC|ICICI)\b.*$", "", m.group(4))
        out.append(holder(name.strip(), dp_client_id=m.group(1), warrant_no=m.group(2),
                          unclaimed_amount=num(m.group(3)), source_file=src))
    return [h for h in out if h]


def parse_xlsx_crisil(path, src):
    """CRISIL: MCA-like sheet but headers lack the 'Investor' prefix."""
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        col = None
        for row in ws.iter_rows(values_only=True):
            cells = ["" if v is None else str(v).strip() for v in row]
            if col is None:
                if cells.count("First Name") == 1 and "Address" in cells:
                    col = {c: i for i, c in enumerate(cells) if c}
                continue

            def g(k):
                i = col.get(k)
                return cells[i] if i is not None and i < len(cells) else ""

            fn = " ".join(x for x in [g("First Name"), g("Middle Name"), g("Last Name")]
                          if x and x != "None").strip()
            if not fn:
                continue
            amt = next((num(cells[i]) for h, i in col.items()
                        if "Amount" in h and i < len(cells) and num(cells[i])), None)
            out.append(holder(fn, address=g("Address") or None, state=g("State").title() or None,
                              pin=re.sub(r"\.0$", "", g("Pincode")) or None,
                              folio_number=g("Folio Number") or None,
                              unclaimed_amount=amt, source_file=src))
    return [h for h in out if h]


def parse_xls_manappuram(path, src):
    """Manappuram: SLNO WNO FLNO NAM1 Add1-3 City PIN SHARES NETDVD MICRNO."""
    import xlrd
    out = []
    for sh in xlrd.open_workbook(str(path)).sheets():
        rows = [[str(c.value).strip() for c in sh.row(r)] for r in range(sh.nrows)]
        col = None
        for r in rows:
            if col is None:
                if "NAM1" in r:
                    col = {n: i for i, n in enumerate(r) if n}
                continue

            def g(k):
                i = col.get(k)
                return r[i] if i is not None and i < len(r) else ""

            name = g("NAM1")
            if not name:
                continue
            addr = " ".join(x for x in [g("Add1"), g("Add2"), g("Add3"), g("City")] if x)
            f = re.sub(r"\.0$", "", g("FLNO"))
            demat = f.startswith("IN") or (f[:2].isdigit() and len(f) >= 14)
            out.append(holder(name, address=addr or None, state=detect_state(addr),
                              pin=re.sub(r"\.0$", "", g("PIN")) or None,
                              folio_number=None if demat else f or None,
                              dp_client_id=f if demat else None,
                              warrant_no=re.sub(r"\.0$", "", g("WNO")) or None,
                              shares=intval(g("SHARES")), unclaimed_amount=num(g("NETDVD")),
                              financial_year="1st interim FY2024-25", source_file=src))
    return [h for h in out if h]


# per-company source URL → stored in companies.iepf_page_url (provenance / re-download)
COMPANY_URLS = {
    "Bajaj Finserv Ltd": "https://www.aboutbajajfinserv.com/content/dam/bajajfinserv/web/in/en/global/document/corporate/investor-relations/sebi/unclaimed-dividend-with-address-922020031010466.xlsx",
    "Tech Mahindra Ltd": "https://insights.techmahindra.com/investors/iepf-unclaimed-dividend-and-corresponding-shares-data-fy-2015-16.pdf",
    "NTPC Ltd": "https://ntpc.co.in/sites/default/files/inline-files/SHARES%20LIABLE%20TO%20BE%20TRANSFERRED%20TO%20IEPF%20IN%20NOVEMBER%202025.pdf",
    "Oil and Natural Gas Corp Ltd": "https://ongcindia.com/documents/77751/2660534/18Unpaid_Dividend2024-25.pdf",
    "Power Grid Corp of India Ltd": "https://www.powergrid.in/sites/default/files/Shareholders_Document/SharestransferredtoIEPFinMay2026.pdf",
    "Hindalco Industries Ltd": "https://web.archive.org/web/20240325072529id_/https://www.hindalco.com/upload/pdf/unclaimed-dividend_2013-14_AGM16092015.pdf",
    # batch 31-50
    "Dr Reddys Laboratories Ltd": "http://web.archive.org/web/20240225043407id_/https://www.drreddys.com/media/987243/website-data-details-of-shares-for-transfer-to-iepf-final.pdf",
    "Divis Laboratories Ltd": "https://www.divislabs.com/wp-content/uploads/2025/07/Dividend-due-for-transfer-to-IEPF-in-2025.pdf",
    "Bharti Airtel Ltd": "https://assets.airtel.in/static-assets/cms/investor/docs/BTVL_IEPF2_VALIDATED_FILE_YEAR_1.xlsm",
    "Adani Ports and SEZ Ltd": "https://www.adaniports.com/-/media/project/ports/corporategovernance/iepf/list-of-shareholders-whose-shares-are-liable-to-be-transferred-to-iepf.pdf",
    "Coal India Ltd": "https://archive.coalindia.in/DesktopModules/DocumentList/documents/Shareholders_whose_shares_will_be_transferred_to_IEPF_on_16.03.18_as_their_dividend_remain_unclaimed_for_7_consecutive_years__14122017.pdf",
    "Bharat Petroleum Corp Ltd": "https://www.bharatpetroleum.in/pdf/OurFinancial/2021-20221st-Interim-dividend-1be937.xls",
    "Shriram Finance Ltd": "https://cdn.shriramfinance.in/sfl-kalam/files/2026-05/SharesAndDividend-to-be-Transferred-to-IEPF-2026.pdf",
    "IndusInd Bank Ltd": "https://www.indusind.bank.in/content/dam/indusind-corporate/investor-resource/TransferofequitysharestotheInvestorEducationandProtectionFund/Dividend%202017-18/Transfer_of_shares_to_IEPF_for_the_year_2017-18.pdf",
    "Apollo Hospitals Enterprise Ltd": "https://www.apollohospitals.com/apollo_pdf/unclaimed-dividend-as-on-11th-august-2015.pdf",
    "Tata Consumer Products Ltd": "https://web.archive.org/web/20180219174553id_/http://www.tataglobalbeverages.com/docs/default-source/unclaimed-dividend/tf-21082017-section-124.pdf",
    "LTIMindtree Ltd": "https://investorsarchive.ltimindtree.com/sites/default/files/2025-03/list-of-shareholders-whose-shares-are-liable-to-be-transferred-to-iepf.pdf",
    # batch 51-80
    "Bharat Heavy Electricals Ltd": "https://www.bhel.com/sites/default/files/2025-09/Unpaid-dividend-wrt.-Final-dividend-2017-18.xls",
    "Steel Authority of India Ltd": "https://sail.co.in/sites/default/files/2026-05/Unpaid%20Dividends%20FY%202018-19%20to%20FY%202024-25.xlsx",
    "Indian Oil Corporation Ltd": "https://iocl.com/download/IEPF-share-transfer-data-(2017-10-31).pdf",
    "Bharat Electronics Ltd": "https://bel-india.in/wp-content/uploads/2023/01/BEL-Unpaid-and-Unclaimed-Dividend-Amount-and-Bonus-Fractional-Shares-Amount-Details-31.03.2019.pdf",
    "Godrej Consumer Products Ltd": "https://www.godrejindiasaarc.com/public/uploads/compliance/Detailsofshareholdersforwebsiteupload.pdf",
    "Pidilite Industries Ltd": "https://www.pidilite.com/content/dam/pidilitecorporatewebsite/corporate-governance/unclaimed-dividends-iepf/fy-2025-26/unclaimed-dividend-financial-year-2024-2025.pdf",
    "Havells India Ltd": "https://havells.com/media/wysiwyg/PDF/Unclaimed-Dividend/2026-2027/Underlying_Shares_of_unclaimed_Dividend_of_2018_19_Due_date_of_transfer_of_Dividend_to_IEPF_-_31st_August_2026_.pdf",
    "Torrent Pharmaceuticals Ltd": "https://www.torrentpharma.com/pdf/investors/List_of_shareholders_whose_Interim_Dividend_remained_unclaimed_unpaid.pdf",
    "Dabur India Ltd": "https://www.dabur.com/Investors/Investor%20Information/Unclaimed%20Dividend/Details%20of%20shares%20proposed%20to%20be%20transferred%20to%20IEPF/List%20of%20cases%20liable%20to%20be%20transferred%20to%20IEPF%20New.pdf",
    "Colgate-Palmolive India Ltd": "https://www.colgateinvestors.co.in/documents/unclaimed-dividends/2nd-interim-div-2018-19.xlsm",
    "Marico Ltd": "https://marico.com/investorspdf/List_of_equity_shares_liable_to_be_transferred_to_Demat_Account_of_IEPF_Authority.pdf",
    "Bosch Ltd": "https://www.bosch.in/media/our_company/shareholder_information/2024/unpaidyear2024.pdf",
    "Siemens Ltd": "https://assets.new.siemens.com/siemens/assets/api/uuid:319de7eb-a631-4a70-aa03-25f1bebd5eab/SL-Section-124-Report-FY-23-24.pdf",
    "ABB India Ltd": "https://web.archive.org/web/20240309112751id_/https://new.abb.com/docs/librariesprovider19/default-document-library/unclaimed-dividend-2017.xls",
    "3M India Ltd": "https://multimedia.3m.com/mws/media/2589096O/3m-india-statement-unpaid-unclaimed-dividend-37th-agm-march-31-2025.pdf",
    "Cummins India Ltd": "https://www.cummins.com/sites/default/files/2021-11/Cummins%20India%20Limited%20-%20Combined%20Unpaid%20Data%20as%20of%2031-03-2021.pdf",
    "Mphasis Ltd": "https://www.mphasis.com/content/dam/mphasis-com/global/en/investors/governance/shareholders-whose-dividend-remained-unpaid-for-seven-consecutive-years-as-at-31-march-2026.pdf",
    "Persistent Systems Ltd": "https://www.persistent.com/wp-content/uploads/2026/07/Consolidated-Unclaimed-Dividend-as-on-July-21-2025.pdf",
    "Tata Power Company Ltd": "https://web.archive.org/web/20240429220156id_/https://www.tatapower.com/pdf/investor-relations/IEPF-unencashed-dividend.pdf",
    "ACC Ltd": "https://web.archive.org/web/20170724065508id_/http://www.acclimited.com/assets/new/pdf/unclaimed_dividends/Details-of-Unclaimed-78th-Final-Dividend-for-the-year-ended-31.12.2015-2.8.2016.xlsx",
    "Ambuja Cements Ltd": "https://www.ambujagroup.com/documents/dividend-iepf/details-of-dividend-and-shares-transferred-to-iepf/details-of-dividend-shares-transferred-to-iepf-2024.pdf",
    "The Ramco Cements Ltd": "https://ramcocements.in/cms/uploads/20253480_IEPF_2_0e290cf9bf.xlsm",
    "Shree Cement Ltd": "https://www.shreecement.com/uploads/investors/shareholder/shares-transfer-to-iepf-november-2017.pdf",
    "Dalmia Bharat Ltd": "https://www.dalmiacement.com/assets/IEPF_NoticePublication/Shares-transferred-to-IEPF-Account-in-2019.pdf",
    "Punjab National Bank": "https://pnb.bank.in/document/dividend/Unclaimed_Dividend_2005-06(I).pdf",
    "Bank of Baroda": "https://bankofbaroda.bank.in/-/media/Project/BOB/CountryWebsites/India/pdfs2/2025/25-09/BOB-IEPF-1-2016-2017",
    "Bank of India": "https://bankofindia.bank.in/documents/20121/0/List_of_Unclaimed_Shares_Transfer_to_IEPF.pdf",
    "Canara Bank": "https://www.canarabank.bank.in/documents/d/guest/unpaid-dividend-data-for-fy-2022-23-19092023-1-",
    # batch 81-100
    "General Insurance Corp of India": "https://www.gicre.in/images/2026/Details_of_Unclaimed_or_Unpaid_Dividend_as_on_31st_March_2025.pdf",
    "New India Assurance Co Ltd": "https://www.newindia.co.in/cms/012d3094-6c06-47ca-80fa-12460b4d9e75/IEPF%202.pdf?guest=true",
    "Life Insurance Corp of India": "https://licindia.in/documents/d/guest/unclaimed-final-dividend-register-for-fy-2021-22-as-on-june-30-2026",
    "LIC Housing Finance Ltd": "https://cdn.lichousing.com/2026/01/Details-of-Unpaid-dividend-as-on-31-March-2025.pdf",
    "Muthoot Finance Ltd": "https://cdn.muthootfinance.com/sites/default/files/files/2026-03/Muthoot-Dividend-2025.xlsm",
    "Cholamandalam Investment and Finance Co Ltd": "https://files.cholamandalam.com/files/CHF_IEPF2_31032023.xls",
    "GAIL India Ltd": "https://gailebank.gail.co.in/InvestorsZone/GAIL_IEPF2_2016-17int%20to%202019-20int.xls",
    "Petronet LNG Ltd": "https://www.petronetlng.in/documents/d/pertonetlng/unpaid-dividend-as-on-31032026",
    "Hindustan Petroleum Corp Ltd": "https://www.hindustanpetroleum.com/documents/pdf/Unclaimed-Dividend-FY2018-19-Final-FY2025-26-Interim.xlsx",
    "Castrol India Ltd": "https://www.castrol.com/content/dam/castrol/country-sites-new/en_in/india/home/documents/investors/iepf-2.pdf",
    "UPL Ltd": "https://www.upl-ltd.com/downloads/policies/compliances/Details_of_Equity_Shares_transferred_to_IEPF.pdf",
    "Coromandel International Ltd": "https://www.coromandel.biz/wp-content/uploads/2026/01/Unpaid-Dividend-2023-24-Final.pdf",
    "Chambal Fertilisers and Chemicals Ltd": "https://investor.cfcl.in/list-of-shareholders.pdf",
    "Gujarat Fluorochemicals Ltd": "https://gfl.co.in/assets/pdf/Sub%20Tab%203%20-%20List%20of%20Shareholders%20whose%20shares%20have%20been%20transferred%20to%20IEPF%20-%20Demerger.pdf",
    "Berger Paints India Ltd": "https://berger-dev-s3-bucket.s3.ap-south-1.amazonaws.com/2024-05/BPLN_COMMON_UNPAID%20DIVIDEND%20%20FOLIOS_BASE%20YEAR%202016-17%20.xlsx",
    "Kansai Nerolac Paints Ltd": "https://www.nerolac.com/sites/default/files/2024-09/FY_2024-25.xlsm",
    "Akzo Nobel India Ltd": "https://www.jswdulux.com/pdf/IEPF/IEPF-4%20Statement%20of%20shares%20transferred%20to%20IEPF%202017.pdf",
    "Whirlpool of India Ltd": "https://corporate.whirlpool.in/wp-content/uploads/2024/07/IEPF-2-Statement.pdf",
    # batch 101-120
    "Oberoi Realty Ltd": "https://d3dy70zhjs5mi1.cloudfront.net/s3fs-public/Unpaid_Dividend_Website_2025.pdf",
    "Bharat Forge Ltd": "https://www.bharatforge.com/assets/pdf/investors/download/List-Unclaimed-and-Unpaid.pdf",
    "Thermax Ltd": "https://www.thermaxglobal.com/sites/default/files/2025-10/IEPF-2_Website.pdf",
    "Apollo Tyres Ltd": "https://corporate.apollotyres.com/content/dam/orbit/apollo-corporate/investors/corporate-governance/others/others/details-of-unclaimed-shares-for-transfer-to-iepfa-march-2024.pdf",
    "IRCTC Ltd": "https://www.irctc.com/assets/images/Detais%20of%20Unclaimed%20Dividend_as_on%2031.03.2025(03.07.2025).pdf",
    "CEAT Ltd": "https://www.ceat.com/content/dam/ceat/pdf/Unpaiddividend.pdf",
    "Prestige Estates Projects Ltd": "https://d1t2fddy6amcvs.cloudfront.net/investors/unclaimed-dividends/fy-2014-2015.pdf",
    "Bharat Dynamics Ltd": "https://bdl-india.in/sites/default/files/Unclaimed%20Final%20Dividend%202017-18%28Account%20104511100000955%29.pdf",
    "Godrej Properties Ltd": "https://gplwebsitecdnblob.blob.core.windows.net/godrej-cdn/Files/notice-to-shareholders-statement-of-equity-shares-due-for-transfer-to-iepf-1-kKVoBi4sj1YxSvSVrFq.pdf",
    "Indian Railway Finance Corp Ltd": "https://irfc.co.in/sites/default/files/inline-files/8TH%20IRFC%20UNPAID%201ST%20INTERIM%20DIVIDEND%20FY%2024-25_0.pdf",
    # batch 121-150
    "CRISIL Ltd": "https://www.crisil.com/content/dam/crisil/investors/dividends/unclaimed-dividends/unclaimed/2025/1.%20Unpaid%20Final%20Dividend%202024.xlsx",
    "Hindustan Zinc Ltd": "https://www.hzlindia.com/uploads/Website_upload_efe290bb10.pdf",
    "Raymond Ltd": "https://api.raymond.in/uploads/investor/1681296941278Shareholders%20Whose%20Shares%20Are%20Liable%20To%20Be%20Transferred%20To%20IEPF%20in%20FY%202022-23.pdf",
    "Alkem Laboratories Ltd": "https://admin.alkemlabs.com/uploads/Interim_Dividend_FY_2017_2018_unpaid_data_f4f696d02a.pdf",
    "National Aluminium Co Ltd": "https://nalcoindia.com/wp-content/uploads/2026/05/Shares-transferred_to_IEPF.pdf",
    "Ipca Laboratories Ltd": "https://www.ipca.com/wp-content/pdf/financials/shareholders-for-iepf-suspense-ac/list-of-shareholders-for-IEPF-suspense-ac-dec-2021.pdf",
    "Aurobindo Pharma Ltd": "https://www.aurobindo.com/api/uploads/unpaiddividendaccountdetails/APLN_UNPAID%20DIVIDEND%20REGISTER%20FOR%20INTERIM%20DIV%202025-26%20AS%20ON%2025.11.2025.pdf",
    "Manappuram Finance Ltd": "https://www.manappuram.com/sites/default/files/2025-05/Manappuram_1st_INT_2024-25_Unpaid_31032025.xls",
    "Lupin Ltd": "https://www.lupin.com/unclaimed-dividend-and-shares/List%20of%20shareholders%20whose%20dividend%20remains%20unpaid%20for%20financial%20year%202024-2025.pdf",
    "Timken India Ltd": "https://www.timken.com/wp-content/uploads/2026/01/List-of-Unpaid-Dividend-FY-2024-25.pdf",
    "MOIL Ltd": "https://backend.moil.nic.in/getFiles/public/document/6a314302a0-Statement_of_Unpaid_Unclaimed_2_Interim_Dividend_2025-26_as_on_08.03.2026.pdf",
    "NMDC Ltd": "https://www.nmdc.co.in/cms-admin/Upload/Dividends_Document/10658c863ffc41c6b2d751b872b62fa4_20260704170622109.pdf",
    "Kirloskar Brothers Ltd": "https://www.kirloskarpumps.com/wp-content/uploads/2025/12/List-of-unclaimed-dividend-31032025.pdf",
    "Exide Industries Ltd": "https://docs.exideindustries.com/pdf/unclaimed-dividends/2022-23/2022-23-final.xls",
    "SKF India Ltd": "https://cdn.skfmediahub.skf.com/api/public/094ecab00f682cfe/pdf_preview_medium/094ecab00f682cfe_pdf_preview_medium.pdf",
    "Kalpataru Projects International Ltd": "https://kalpataruprojects.com/api/view-file/Form_IEPF-2-Final-23.xls",
    "KEC International Ltd": "https://www.kecrpg.com/media/investorEducationMedia/Unpaid%20Dividend%202023-24.xlsx",
    "Vedanta Ltd": "https://www.vedantaresources.com/uploads/shareholder-information/unclaimed_dividend/Vedanta-1st-Interim-Dividend-2023-24-unpaid-list.pdf",
    "NCC Ltd": "https://ncclimited.com/unpaid-dividend/NCCL_V3_IEPF-2_2026_F.pdf",
    "Arvind Ltd": "https://www.arvind.com/sites/default/files/shareholders_corner/Arvind%20Ltd_IEPF-2_Div-2022-2023.xlsm",
    "Amara Raja Energy and Mobility Ltd": "https://www.amararajaeandm.com/Files/Unclaimed%20Dividend%20Sheet%20as%20on%20March%2031,%202026.xlsx",
    "Century Textiles and Industries Ltd": "https://www.adityabirlarealestate.com/abrelcms/uploads/stateofunclaimedorunpaiddividend/stateofunclaimedorunpaiddividend_1758279505.pdf",
    "EIH Ltd": "https://www.eihltd.com/-/media/eihltd/pdf-files/unclaimed-divident/unclaimed-dividend-all1.pdf",
    "Zydus Lifesciences Ltd": "https://www.zyduslife.com/investor/admin/uploads/18/99/Statement-of-Unclaimed-Dividend-account-March-31--2023.pdf",
    "UNO Minda Ltd": "http://web.archive.org/web/20201022114926id_/https://www.unominda.com/images/Corporate_governance/Corporate_Governance_Policies/Yearwise-unclaimed-dividend-details-as-at-30-09-2015.pdf",
}

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
    # ── batch 21-30 ──
    ("Bajaj Finserv Ltd - Unclaimed Assets.xlsx", "Bajaj Finserv Ltd", "532978", "BAJAJFINSV", "Financial Services", parse_xlsx_bajajfinserv),
    ("Tech Mahindra Ltd - Unclaimed Assets.pdf", "Tech Mahindra Ltd", "532755", "TECHM", "Information Technology", parse_pdf_techm),
    ("NTPC Ltd - Unclaimed Assets.pdf", "NTPC Ltd", "532555", "NTPC", "Power", parse_pdf_ntpc),
    ("Oil and Natural Gas Corp Ltd - Unclaimed Assets.pdf", "Oil and Natural Gas Corp Ltd", "500312", "ONGC", "Oil & Gas", parse_pdf_ongc),
    ("Power Grid Corp of India Ltd - Unclaimed Assets.pdf", "Power Grid Corp of India Ltd", "532898", "POWERGRID", "Power", parse_pdf_powergrid),
    ("Hindalco Industries Ltd - Unclaimed Assets.pdf", "Hindalco Industries Ltd", "500440", "HINDALCO", "Metals & Mining", parse_pdf_hindalco),
    # ── batch 31-50 (11 verified files) ──
    ("Dr Reddys Laboratories Ltd - Unclaimed Assets.pdf", "Dr Reddys Laboratories Ltd", "500124", "DRREDDY", "Pharmaceuticals", parse_pdf_drreddys),
    ("Divis Laboratories Ltd - Unclaimed Assets.pdf", "Divis Laboratories Ltd", "532488", "DIVISLAB", "Pharmaceuticals", parse_pdf_divis),
    ("Bharti Airtel Ltd - Unclaimed Assets.xlsx", "Bharti Airtel Ltd", "532454", "BHARTIARTL", "Telecom", parse_mca_excel),
    ("Adani Ports and SEZ Ltd - Unclaimed Assets.pdf", "Adani Ports and SEZ Ltd", "532921", "ADANIPORTS", "Ports & Logistics", parse_pdf_adani),
    ("Coal India Ltd - Unclaimed Assets.pdf", "Coal India Ltd", "533278", "COALINDIA", "Mining", parse_pdf_coalindia),
    ("Bharat Petroleum Corp Ltd - Unclaimed Assets.xls", "Bharat Petroleum Corp Ltd", "500547", "BPCL", "Oil & Gas", parse_xls_bpcl),
    ("Shriram Finance Ltd - Unclaimed Assets.pdf", "Shriram Finance Ltd", "511218", "SHRIRAMFIN", "Financial Services (NBFC)", parse_pdf_shriram),
    ("IndusInd Bank Ltd - Unclaimed Assets.pdf", "IndusInd Bank Ltd", "532187", "INDUSINDBK", "Banking & Financial Services", parse_pdf_indusind),
    ("Apollo Hospitals Enterprise Ltd - Unclaimed Assets.pdf", "Apollo Hospitals Enterprise Ltd", "508869", "APOLLOHOSP", "Healthcare", parse_pdf_apollo),
    ("Tata Consumer Products Ltd - Unclaimed Assets.pdf", "Tata Consumer Products Ltd", "500800", "TATACONSUM", "FMCG", parse_pdf_tataconsumer),
    ("LTIMindtree Ltd - Unclaimed Assets.pdf", "LTIMindtree Ltd", "540005", "LTIM", "Information Technology", parse_pdf_ltim),
    # ── batch 51-80 (28 verified files) ──
    ("Bharat Heavy Electricals Ltd - Unclaimed Assets.xls", "Bharat Heavy Electricals Ltd", "500103", "BHEL", "Capital Goods / Power Equipment", parse_mca_excel),
    ("Steel Authority of India Ltd - Unclaimed Assets.xlsx", "Steel Authority of India Ltd", "500113", "SAIL", "Metals & Mining", parse_xlsx_sail),
    ("Indian Oil Corporation Ltd - Unclaimed Assets.pdf", "Indian Oil Corporation Ltd", "530965", "IOC", "Oil & Gas", parse_pdf_iocl),
    ("Bharat Electronics Ltd - Unclaimed Assets.pdf", "Bharat Electronics Ltd", "500049", "BEL", "Defence Electronics", parse_pdf_bel),
    ("Godrej Consumer Products Ltd - Unclaimed Assets.pdf", "Godrej Consumer Products Ltd", "532424", "GODREJCP", "FMCG", parse_pdf_godrej),
    ("Pidilite Industries Ltd - Unclaimed Assets.pdf", "Pidilite Industries Ltd", "500331", "PIDILITIND", "Chemicals & Adhesives", parse_pdf_pidilite),
    ("Havells India Ltd - Unclaimed Assets.pdf", "Havells India Ltd", "517354", "HAVELLS", "Consumer Electricals", parse_pdf_havells),
    ("Torrent Pharmaceuticals Ltd - Unclaimed Assets.pdf", "Torrent Pharmaceuticals Ltd", "500420", "TORNTPHARM", "Pharmaceuticals", parse_pdf_torrent),
    ("Dabur India Ltd - Unclaimed Assets.pdf", "Dabur India Ltd", "500096", "DABUR", "FMCG", parse_pdf_dabur),
    ("Colgate-Palmolive India Ltd - Unclaimed Assets.xlsx", "Colgate-Palmolive India Ltd", "500830", "COLPAL", "FMCG", parse_mca_excel),
    ("Marico Ltd - Unclaimed Assets.pdf", "Marico Ltd", "531642", "MARICO", "FMCG", parse_pdf_marico),
    ("Bosch Ltd - Unclaimed Assets.pdf", "Bosch Ltd", "500530", "BOSCHLTD", "Auto Components", parse_pdf_bosch),
    ("Siemens Ltd - Unclaimed Assets.pdf", "Siemens Ltd", "500550", "SIEMENS", "Capital Goods", parse_pdf_siemens),
    ("ABB India Ltd - Unclaimed Assets.xls", "ABB India Ltd", "500002", "ABB", "Capital Goods", parse_mca_excel),
    ("3M India Ltd - Unclaimed Assets.pdf", "3M India Ltd", "523395", "3MINDIA", "Diversified Industrials", parse_pdf_3m),
    ("Cummins India Ltd - Unclaimed Assets.pdf", "Cummins India Ltd", "500480", "CUMMINSIND", "Capital Goods", parse_pdf_cummins),
    ("Mphasis Ltd - Unclaimed Assets.pdf", "Mphasis Ltd", "526299", "MPHASIS", "Information Technology", parse_pdf_mphasis),
    ("Persistent Systems Ltd - Unclaimed Assets.pdf", "Persistent Systems Ltd", "533179", "PERSISTENT", "Information Technology", parse_pdf_persistent),
    ("Tata Power Company Ltd - Unclaimed Assets.pdf", "Tata Power Company Ltd", "500400", "TATAPOWER", "Power", parse_pdf_tatapower),
    ("ACC Ltd - Unclaimed Assets.xlsx", "ACC Ltd", "500410", "ACC", "Cement", parse_xlsx_acc),
    ("Ambuja Cements Ltd - Unclaimed Assets.pdf", "Ambuja Cements Ltd", "500425", "AMBUJACEM", "Cement", parse_pdf_ambuja),
    ("The Ramco Cements Ltd - Unclaimed Assets.xlsx", "The Ramco Cements Ltd", "500260", "RAMCOCEM", "Cement", parse_mca_excel),
    ("Shree Cement Ltd - Unclaimed Assets.pdf", "Shree Cement Ltd", "500387", "SHREECEM", "Cement", parse_pdf_shreecement),
    ("Dalmia Bharat Ltd - Unclaimed Assets.pdf", "Dalmia Bharat Ltd", "542216", "DALBHARAT", "Cement", parse_pdf_dalmia),
    ("Punjab National Bank - Unclaimed Assets.pdf", "Punjab National Bank", "532461", "PNB", "Banking", parse_pdf_pnb),
    ("Bank of Baroda - Unclaimed Assets.pdf", "Bank of Baroda", "532134", "BANKBARODA", "Banking", parse_pdf_bob),
    ("Bank of India - Unclaimed Assets.pdf", "Bank of India", "532149", "BANKINDIA", "Banking", parse_pdf_boi),
    ("Canara Bank - Unclaimed Assets.xlsx", "Canara Bank", "532483", "CANBK", "Banking", parse_xlsx_canara),
    # ── batch 81-100 (18 verified files) ──
    ("General Insurance Corp of India - Unclaimed Assets.pdf", "General Insurance Corp of India", "540755", "GICRE", "Insurance", parse_pdf_gic),
    ("New India Assurance Co Ltd - Unclaimed Assets.pdf", "New India Assurance Co Ltd", "540769", "NIACL", "Insurance", parse_pdf_niacl),
    ("Life Insurance Corp of India - Unclaimed Assets.pdf", "Life Insurance Corp of India", "543526", "LICI", "Insurance", parse_pdf_lic),
    ("LIC Housing Finance Ltd - Unclaimed Assets.pdf", "LIC Housing Finance Ltd", "500253", "LICHSGFIN", "Financial Services", parse_pdf_lichousing),
    ("Muthoot Finance Ltd - Unclaimed Assets.xlsx", "Muthoot Finance Ltd", "533398", "MUTHOOTFIN", "Financial Services (NBFC)", parse_mca_excel),
    ("Cholamandalam Investment and Finance Co Ltd - Unclaimed Assets.xls", "Cholamandalam Investment and Finance Co Ltd", "511243", "CHOLAFIN", "Financial Services (NBFC)", parse_mca_excel),
    ("GAIL India Ltd - Unclaimed Assets.xls", "GAIL India Ltd", "532155", "GAIL", "Oil & Gas", parse_mca_excel),
    ("Petronet LNG Ltd - Unclaimed Assets.pdf", "Petronet LNG Ltd", "532522", "PETRONET", "Oil & Gas", parse_pdf_petronet),
    ("Hindustan Petroleum Corp Ltd - Unclaimed Assets.xlsx", "Hindustan Petroleum Corp Ltd", "500104", "HINDPETRO", "Oil & Gas", parse_xlsx_hpcl),
    ("Castrol India Ltd - Unclaimed Assets.pdf", "Castrol India Ltd", "500870", "CASTROLIND", "Oil & Gas / Lubricants", parse_pdf_castrol),
    ("UPL Ltd - Unclaimed Assets.pdf", "UPL Ltd", "512070", "UPL", "Agrochemicals", parse_pdf_upl),
    ("Coromandel International Ltd - Unclaimed Assets.pdf", "Coromandel International Ltd", "506395", "COROMANDEL", "Fertilisers", parse_pdf_coromandel),
    ("Chambal Fertilisers and Chemicals Ltd - Unclaimed Assets.pdf", "Chambal Fertilisers and Chemicals Ltd", "500085", "CHAMBLFERT", "Fertilisers", parse_pdf_chambal),
    ("Gujarat Fluorochemicals Ltd - Unclaimed Assets.pdf", "Gujarat Fluorochemicals Ltd", "542812", "FLUOROCHEM", "Chemicals", parse_pdf_gfl),
    ("Berger Paints India Ltd - Unclaimed Assets.xlsx", "Berger Paints India Ltd", "509480", "BERGEPAINT", "Paints", parse_xlsx_berger),
    ("Kansai Nerolac Paints Ltd - Unclaimed Assets.xlsx", "Kansai Nerolac Paints Ltd", "500165", "KANSAINER", "Paints", parse_mca_excel),
    ("Akzo Nobel India Ltd - Unclaimed Assets.pdf", "Akzo Nobel India Ltd", "500710", "AKZOINDIA", "Paints", parse_pdf_akzo),
    ("Whirlpool of India Ltd - Unclaimed Assets.pdf", "Whirlpool of India Ltd", "500238", "WHIRLPOOL", "Consumer Durables", parse_pdf_whirlpool),
    # ── batch 101-120 (10 verified files) ──
    ("Oberoi Realty Ltd - Unclaimed Assets.pdf", "Oberoi Realty Ltd", "533273", "OBEROIRLTY", "Real Estate", parse_pdf_oberoi),
    ("Bharat Forge Ltd - Unclaimed Assets.pdf", "Bharat Forge Ltd", "500493", "BHARATFORG", "Auto Components", parse_pdf_bharatforge),
    ("Thermax Ltd - Unclaimed Assets.pdf", "Thermax Ltd", "500411", "THERMAX", "Capital Goods", parse_pdf_thermax),
    ("Apollo Tyres Ltd - Unclaimed Assets.pdf", "Apollo Tyres Ltd", "500877", "APOLLOTYRE", "Tyres", parse_pdf_apollotyres),
    ("IRCTC Ltd - Unclaimed Assets.pdf", "IRCTC Ltd", "542830", "IRCTC", "Railways / Services", parse_pdf_irctc),
    ("CEAT Ltd - Unclaimed Assets.pdf", "CEAT Ltd", "500878", "CEATLTD", "Tyres", parse_pdf_ceat),
    ("Prestige Estates Projects Ltd - Unclaimed Assets.pdf", "Prestige Estates Projects Ltd", "533274", "PRESTIGE", "Real Estate", parse_pdf_prestige),
    ("Bharat Dynamics Ltd - Unclaimed Assets.pdf", "Bharat Dynamics Ltd", "541143", "BDL", "Defence", parse_pdf_bdl),
    ("Godrej Properties Ltd - Unclaimed Assets.pdf", "Godrej Properties Ltd", "533150", "GODREJPROP", "Real Estate", parse_pdf_godrejprop),
    ("Indian Railway Finance Corp Ltd - Unclaimed Assets.pdf", "Indian Railway Finance Corp Ltd", "543257", "IRFC", "Financial Services", parse_pdf_irfc),
    # ── batch 121-150 (25 verified files, smallest-first ingest order) ──
    ("CRISIL Ltd - Unclaimed Assets.xlsx", "CRISIL Ltd", "500092", "CRISIL", "Ratings / Analytics", parse_xlsx_crisil),
    ("Hindustan Zinc Ltd - Unclaimed Assets.pdf", "Hindustan Zinc Ltd", "500188", "HINDZINC", "Metals & Mining", parse_pdf_hzl),
    ("Raymond Ltd - Unclaimed Assets.pdf", "Raymond Ltd", "500330", "RAYMOND", "Textiles", parse_pdf_raymond),
    ("Alkem Laboratories Ltd - Unclaimed Assets.pdf", "Alkem Laboratories Ltd", "539523", "ALKEM", "Pharmaceuticals", parse_pdf_alkem),
    ("National Aluminium Co Ltd - Unclaimed Assets.pdf", "National Aluminium Co Ltd", "532234", "NATIONALUM", "Metals & Mining", parse_pdf_nalco),
    ("Ipca Laboratories Ltd - Unclaimed Assets.pdf", "Ipca Laboratories Ltd", "524494", "IPCALAB", "Pharmaceuticals", parse_pdf_ipca),
    ("Aurobindo Pharma Ltd - Unclaimed Assets.pdf", "Aurobindo Pharma Ltd", "524804", "AUROPHARMA", "Pharmaceuticals", parse_pdf_aurobindo),
    ("Manappuram Finance Ltd - Unclaimed Assets.xls", "Manappuram Finance Ltd", "531213", "MANAPPURAM", "Financial Services (NBFC)", parse_xls_manappuram),
    ("Lupin Ltd - Unclaimed Assets.pdf", "Lupin Ltd", "500257", "LUPIN", "Pharmaceuticals", parse_pdf_lupin),
    ("UNO Minda Ltd - Unclaimed Assets.pdf", "UNO Minda Ltd", "532539", "UNOMINDA", "Auto Components", parse_pdf_unominda),
    ("Timken India Ltd - Unclaimed Assets.pdf", "Timken India Ltd", "522113", "TIMKEN", "Auto Components", parse_pdf_timken),
    ("MOIL Ltd - Unclaimed Assets.pdf", "MOIL Ltd", "532636", "MOIL", "Mining", parse_pdf_moil),
    ("NMDC Ltd - Unclaimed Assets.pdf", "NMDC Ltd", "526371", "NMDC", "Mining", parse_pdf_nmdc),
    ("Kirloskar Brothers Ltd - Unclaimed Assets.pdf", "Kirloskar Brothers Ltd", "500241", "KIRLOSBROS", "Capital Goods", parse_pdf_kirloskar),
    ("Exide Industries Ltd - Unclaimed Assets.xlsx", "Exide Industries Ltd", "500086", "EXIDEIND", "Auto Components", parse_mca_excel),
    ("SKF India Ltd - Unclaimed Assets.pdf", "SKF India Ltd", "500472", "SKFINDIA", "Auto Components", parse_pdf_skf),
    ("Kalpataru Projects International Ltd - Unclaimed Assets.xls", "Kalpataru Projects International Ltd", "522287", "KPIL", "Capital Goods", parse_mca_excel),
    ("KEC International Ltd - Unclaimed Assets.xlsx", "KEC International Ltd", "532714", "KEC", "Capital Goods", parse_mca_excel),
    ("Vedanta Ltd - Unclaimed Assets.pdf", "Vedanta Ltd", "500295", "VEDL", "Metals & Mining", parse_pdf_vedanta),
    ("NCC Ltd - Unclaimed Assets.pdf", "NCC Ltd", "500294", "NCC", "Construction", parse_pdf_ncc),
    ("Arvind Ltd - Unclaimed Assets.xlsx", "Arvind Ltd", "500101", "ARVIND", "Textiles", parse_mca_excel),
    ("Amara Raja Energy and Mobility Ltd - Unclaimed Assets.xlsx", "Amara Raja Energy and Mobility Ltd", "500008", "AREM", "Auto Components", parse_mca_excel),
    ("Zydus Lifesciences Ltd - Unclaimed Assets.pdf", "Zydus Lifesciences Ltd", "532321", "ZYDUSLIFE", "Pharmaceuticals", parse_pdf_zydus),
    ("Century Textiles and Industries Ltd - Unclaimed Assets.pdf", "Century Textiles and Industries Ltd", "500040", "CENTURYTEX", "Textiles / Paper", parse_pdf_century),
    ("EIH Ltd - Unclaimed Assets.pdf", "EIH Ltd", "500840", "EIHOTEL", "Hotels", parse_pdf_eih),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--only", default="")
    ap.add_argument("--exact", action="store_true",
                    help="treat --only as exact company names (substring matching "
                         "would re-ingest e.g. 'State Bank of India' for 'Bank of India')")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not BASE or not KEY:
        sys.exit("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")
    folder = Path(args.folder)
    only = [s.strip().lower() for s in args.only.split(",") if s.strip()]
    sys.stdout.reconfigure(encoding="utf-8")

    grand = 0
    for fname, company, bse, nse, industry, parser in FILES:
        if only:
            hit = (company.lower() in only) if args.exact else \
                  any(o in company.lower() or o in fname.lower() for o in only)
            if not hit:
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
        cid = upsert_company(company, bse, nse, industry, COMPANY_URLS.get(company))
        print(f"   company_id={cid}; inserting...")
        grand += insert_holders(rows, cid)

    print(f"\nDONE. {grand} holder rows ingested this run.")


if __name__ == "__main__":
    main()
