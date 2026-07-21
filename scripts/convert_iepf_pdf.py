#!/usr/bin/env python3
"""
SEEKTRIX — IEPF shareholder-list PDF -> CSV converter
=====================================================
Converts a company's "List of shareholders whose shares are liable for
transfer to IEPF Authority" PDF into the Seektrix ingestion CSV.

Built for the common fixed-width layout:
    FOLIO NO | NAME | CURR SHR | ADD1 | ADD2 | ADD3 | ADD4 | PIN
(as used by PNB Gilts and many registrars). Handles both physical folios
(numeric) and demat IDs (IN + 14 digits), and the PDF quirk where the
share count is glued to the first letter of the address ("1B" = 1 share).

Usage:
    pip install pypdf                      (one time)
    python convert_iepf_pdf.py <list.pdf> <output.csv> --company "PNB Gilts Ltd."
    python ingest_csv.py <output.csv> --dry-run
    python ingest_csv.py <output.csv>

Every company formats its list slightly differently — always run --dry-run
and eyeball the first rows before uploading. Never invent missing fields.
"""

import argparse
import csv
import re
import sys

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("ERROR: pypdf is not installed. Run:  pip install pypdf")

STATES = [
    "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA",
    "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA",
    "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND",
    "ODISHA", "ORISSA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TAMILNADU",
    "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "W BENGAL",
    "DELHI", "NEW DELHI", "CHANDIGARH", "PONDICHERRY", "PUDUCHERRY", "JAMMU",
]
STATE_CANON = {"ORISSA": "Odisha", "W BENGAL": "West Bengal", "TAMILNADU": "Tamil Nadu",
               "NEW DELHI": "Delhi", "JAMMU": "Jammu and Kashmir",
               "PONDICHERRY": "Puducherry"}
CITY_STATE = {
    "MUMBAI": "Maharashtra", "BOMBAY": "Maharashtra", "THANE": "Maharashtra",
    "PUNE": "Maharashtra", "NAGPUR": "Maharashtra", "CALCUTTA": "West Bengal",
    "KOLKATA": "West Bengal", "CHENNAI": "Tamil Nadu", "MADRAS": "Tamil Nadu",
    "BANGALORE": "Karnataka", "BENGALURU": "Karnataka", "HYDERABAD": "Telangana",
    "AHMEDABAD": "Gujarat", "SURAT": "Gujarat", "BARODA": "Gujarat",
    "VADODARA": "Gujarat", "JAIPUR": "Rajasthan", "LUCKNOW": "Uttar Pradesh",
    "KANPUR": "Uttar Pradesh", "PATNA": "Bihar", "BHOPAL": "Madhya Pradesh",
    "INDORE": "Madhya Pradesh", "COCHIN": "Kerala", "KOCHI": "Kerala",
    "CHANDIGARH": "Chandigarh", "AMRITSAR": "Punjab", "LUDHIANA": "Punjab",
    "GURGAON": "Haryana", "FARIDABAD": "Haryana", "NOIDA": "Uttar Pradesh",
    "GHAZIABAD": "Uttar Pradesh", "AURANGABAD": "Maharashtra",
    "MORADABAD": "Uttar Pradesh", "DURGAPUR": "West Bengal",
}

ROW_RE = re.compile(r"^(IN\d{14}|\d{4,})\s+([A-Z][A-Z .\-'/]*?)\s+(\d+)([A-Z]?)\s*(.*)$")


def detect_state(address: str):
    """Pull the state out of the address text (extraction, not invention)."""
    upper = address.upper()
    for s in STATES:
        if s in upper:
            return STATE_CANON.get(s, s.title())
    for city, state in CITY_STATE.items():
        if city in upper:
            return state
    return None


def normalize(line: str) -> str:
    # PDFs pad table cells with non-ASCII filler glyphs; the data is ASCII.
    line = re.sub(r"[^\x20-\x7E]", " ", line)
    return re.sub(r"\s+", " ", line).strip()


def convert(pdf_path: str, csv_path: str, company: str, folio_prefix: str):
    reader = PdfReader(pdf_path)
    rows, failed = [], []
    for page in reader.pages:
        for raw in (page.extract_text() or "").splitlines():
            line = normalize(raw)
            if not line or line.upper().startswith("FOLIO"):
                continue
            m = ROW_RE.match(line)
            if not m:
                failed.append(line[:100])
                continue
            folio, name, shares, glued, rest = m.groups()
            if glued:
                rest = f"{glued} {rest}".strip()
            pin_match = re.search(r"(\d{6})\s*$", rest)
            address = rest[:pin_match.start()].strip() if pin_match else rest.strip()
            full_address = re.sub(r"\s+", " ",
                                  f"{address} {pin_match.group(1) if pin_match else ''}").strip()
            rows.append({
                "holder_name": " ".join(name.split()).title(),
                "father_name": "",
                "company_name": company,
                "folio_number": folio if folio.startswith("IN") else f"{folio_prefix}{folio}",
                "state": detect_state(full_address) or "",
                "full_address": full_address,
                "shares": shares,
            })

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "holder_name", "father_name", "company_name", "folio_number",
            "state", "full_address", "shares"])
        writer.writeheader()
        writer.writerows(rows)

    total_shares = sum(int(r["shares"]) for r in rows)
    print(f"Parsed {len(rows)} shareholder rows -> {csv_path}")
    print(f"Total shares parsed: {total_shares:,} "
          f"(compare with the total printed at the end of the PDF!)")
    print(f"State detected for {sum(1 for r in rows if r['state'])}/{len(rows)} rows")
    if failed:
        print(f"\n{len(failed)} unparsed line(s) — usually the title/footer; VERIFY these "
              f"are not data rows:")
        for line in failed[:10]:
            print("  -", line)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert an IEPF shareholder-list PDF to CSV.")
    parser.add_argument("pdf", help="Path to the company's IEPF list PDF")
    parser.add_argument("csv", help="Output CSV path")
    parser.add_argument("--company", required=True, help='Company name, e.g. "PNB Gilts Ltd."')
    parser.add_argument("--folio-prefix", default="",
                        help='Prefix for numeric folios, e.g. "PNBGILTS-" (keeps them unique across companies)')
    args = parser.parse_args()
    convert(args.pdf, args.csv, args.company, args.folio_prefix)
