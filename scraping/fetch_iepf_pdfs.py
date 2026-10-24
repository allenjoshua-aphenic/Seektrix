#!/usr/bin/env python3
"""
SEEKTRIX — IEPF shareholder-list fetcher + verifier
===================================================
Downloads candidate IEPF / unclaimed-dividend files for a batch of companies,
VERIFIES each actually contains a table of shareholder NAMES (not a newspaper
notice or an empty lookup page), and saves only the verified ones as
    "<Company> - Unclaimed Assets.<ext>"
into the output folder. Native format is preserved (PDF / CSV / XLS / XLSX /
XLSM) because CSV/Excel are actually easier to ingest than PDF.

Uses Scrapling's Fetcher (curl_cffi browser TLS-impersonation) so it can pull
files from Akamai/Cloudflare-protected company sites that block plain requests.

Input:  JSON  [{"company": "...", "candidates": ["url1", "url2", ...]}, ...]
Usage:  python scraping/fetch_iepf_pdfs.py scraping/candidates.json "<output_dir>"
"""

import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse, unquote

from scrapling.fetchers import Fetcher
from curl_cffi import requests as cffi_requests

import warnings
warnings.filterwarnings("ignore", message=".*[Vv]erif.*")

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# ── verification heuristics ──────────────────────────────────────────────────
DEMAT_RE = re.compile(r"\bIN[0-9A-Z]{6}[0-9]{6,10}\b|\bIN[0-9]{14,16}\b")
FOLIO_RE = re.compile(r"\b[A-Z]{0,5}[-/]?\d{5,}\b")
NAME_RE = re.compile(r"\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z.]+){1,4})\b")
NOTICE_WORDS = ["hereby", "pursuant to", "shareholders are requested",
                "notice is hereby", "attention of the", "is hereby given"]


def _score_text(text: str, n_units: int):
    """Shared scoring: (is_real, est_records, reason) from extracted text."""
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
    low = text.lower()
    if len(text.strip()) < 200:
        return False, 0, f"almost no extractable text ({n_units} pages/sheets — likely scanned notice)"
    demat = len(DEMAT_RE.findall(text))
    folio = len(FOLIO_RE.findall(text))
    names = len(set(NAME_RE.findall(text)))
    ids = demat + folio
    notice = sum(low.count(w) for w in NOTICE_WORDS)
    est = max(demat, folio // 2, names)
    if ids >= 5 and names >= 5:
        if notice > ids and demat == 0 and folio < 10:
            return False, est, f"reads as a notice (prose {notice} vs ids {ids})"
        return True, est, f"{names} distinct names, {demat} demat IDs, {folio} folio tokens"
    return False, est, f"not enough tabular data (names={names}, demat={demat}, folio={folio}, notice={notice})"


def verify_pdf(data: bytes):
    if PdfReader is None:
        return False, 0, "pypdf not installed"
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        return False, 0, f"unreadable PDF ({type(e).__name__})"
    parts = []
    for page in reader.pages[:40]:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            pass
    return _score_text("\n".join(parts), len(reader.pages))


def verify_csv(data: bytes):
    try:
        text = data.decode("utf-8-sig", "ignore")
    except Exception:
        text = data.decode("latin-1", "ignore")
    lines = [l for l in text.splitlines() if l.strip()]
    if len(lines) < 6:
        return False, 0, f"only {len(lines)} lines"
    return _score_text("\n".join(lines[:400]), len(lines))


def verify_xls(data: bytes, ext: str):
    try:
        if ext == ".xls":
            import xlrd
            book = xlrd.open_workbook(file_contents=data)
            texts, rows = [], 0
            for sh in book.sheets():
                rows += sh.nrows
                for r in range(min(sh.nrows, 300)):
                    texts.append(" ".join(str(c.value) for c in sh.row(r)))
            return _score_text("\n".join(texts), max(1, rows))
        else:  # xlsx / xlsm
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            texts, rows = [], 0
            for ws in wb.worksheets:
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    if i > 400:
                        break
                    rows += 1
                    texts.append(" ".join("" if v is None else str(v) for v in row))
            return _score_text("\n".join(texts), max(1, rows))
    except Exception as e:
        return False, 0, f"could not parse {ext} ({type(e).__name__}: {str(e)[:60]})"


def ext_of(url: str, data: bytes) -> str:
    if data[:4] == b"%PDF":
        return ".pdf"
    if data[:2] == b"PK":                     # zip container = xlsx/xlsm/docx
        return ".xlsm" if b"vbaProject" in data[:200000] else ".xlsx"
    if data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":  # OLE = legacy .xls
        return ".xls"
    path = unquote(urlparse(url).path).lower()
    for e in (".pdf", ".xlsm", ".xlsx", ".xls", ".csv"):
        if path.endswith(e):
            return e
    # CSV / text fallback
    return ".csv" if b"," in data[:500] else ".bin"


def verify(data: bytes, ext: str):
    if ext == ".pdf":
        return verify_pdf(data)
    if ext == ".csv":
        return verify_csv(data)
    if ext in (".xls", ".xlsx", ".xlsm"):
        return verify_xls(data, ext)
    return False, 0, f"unsupported type {ext}"


def safe_name(company: str, ext: str) -> str:
    base = re.sub(r"[^\w &.-]", "", company).strip()
    return f"{base} - Unclaimed Assets{ext}"


def fetch(url: str) -> bytes | None:
    for imp in ("chrome", "safari", "firefox"):
        try:
            r = Fetcher.get(url, impersonate=imp, timeout=90, stealthy_headers=True)
            if r.status == 200:
                body = r.body
                if isinstance(body, str):
                    body = body.encode("latin-1", "ignore")
                if len(body) > 200:
                    return body
        except Exception:
            continue
    # Several issuer sites (SAIL, BEL, Petronet, Whirlpool) serve an INCOMPLETE
    # certificate chain — the leaf is fine but the intermediate is missing, so
    # strict verification fails even though the host is genuine. Retry without
    # verification. Safe here: these are public disclosure documents, we send no
    # credentials, and every file is content-verified below before it is kept.
    for imp in ("chrome", "firefox"):
        try:
            r = cffi_requests.get(url, impersonate=imp, timeout=120, verify=False)
            if r.status_code == 200 and len(r.content) > 200:
                print("     (fetched with TLS verification disabled — incomplete chain)")
                return r.content
        except Exception:
            continue
    return None


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: fetch_iepf_pdfs.py <candidates.json> <output_dir>")
    cand_path, out_dir = sys.argv[1], Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    batch = json.loads(Path(cand_path).read_text(encoding="utf-8"))
    summary = []

    for entry in batch:
        company = entry["company"]
        print(f"\n=== {company} ===")
        saved, detail = None, []
        for url in entry.get("candidates", []):
            print(f"  down: {url[:95]}")
            data = fetch(url)
            if not data:
                detail.append(f"unreachable: {url}")
                print("     x could not download")
                continue
            ext = ext_of(url, data)
            ok, est, reason = verify(data, ext)
            print(f"     {'OK REAL DATA' if ok else 'x rejected'} [{ext}, {len(data)//1024} KB] — {reason}")
            detail.append(f"{'OK' if ok else 'REJECT'} [{ext}] ({reason}): {url}")
            if ok:
                path = out_dir / safe_name(company, ext)
                path.write_bytes(data)
                saved = {"file": path.name, "ext": ext, "records_est": est, "kb": len(data)//1024, "url": url}
                print(f"     -> saved: {path.name}  (~{est} records)")
                break
            time.sleep(0.4)
        summary.append({"company": company, "saved": saved, "detail": detail})

    print("\n" + "=" * 64)
    print("RESULT")
    got = [s for s in summary if s["saved"]]
    for s in summary:
        if s["saved"]:
            v = s["saved"]
            print(f"  OK  {s['company']}: {v['file']}  (~{v['records_est']} records, {v['kb']} KB)")
        else:
            print(f"  --  {s['company']}: no verified file")
    print(f"\n{len(got)}/{len(summary)} companies saved a verified real-data file.")
    Path(cand_path).with_suffix(".result.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
