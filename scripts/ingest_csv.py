#!/usr/bin/env python3
"""
SEEKTRIX — CSV -> Supabase ingestion tool
=========================================
Loads shareholder rows from a CSV file into the `unclaimed_assets_live` table
(or any table with the same columns) in your Supabase project.

Monthly workflow:
  1. Extract the company's unclaimed-shares PDF/Excel into a CSV with these
     headers (order does not matter, extra columns are ignored):

        holder_name,father_name,company_name,folio_number,state,full_address,shares

     Only holder_name and shares are REQUIRED. Leave unknown fields empty —
     they are stored as NULL and the app displays "N/A". NEVER invent values.
     STRONGLY RECOMMENDED: always fill company_name and folio_number — they
     form the duplicate-protection key (see Safety below).

  2. Run:
        python ingest_csv.py MRF_july2026.csv
        python ingest_csv.py MRF_july2026.csv --dry-run          # validate only
        python ingest_csv.py MRF_july2026.csv --table unclaimed_assets_live

Requirements:
  - Python 3.8+ (standard library only — nothing to pip install)
  - .env next to this script with VITE_SUPABASE_URL and
    SUPABASE_SERVICE_ROLE_KEY (service-role key needed because of RLS)

Safety:
  - Rows are UPSERTED with duplicates ignored on (company_name, folio_number),
    and exact in-file duplicates are dropped before upload, so re-running a
    CSV whose rows all carry company_name + folio_number never duplicates data.
  - CAVEAT: rows MISSING company_name or folio_number cannot be protected by
    the database key (SQL NULLs never conflict). The script warns about them;
    avoid re-running a file that contains such rows.
  - The script only ever INSERTS. It cannot delete or modify existing rows.
  - The bundled sample_unclaimed_assets.csv intentionally contains one invalid
    row (empty holder_name) to demonstrate validation.
  - The target table must have a UNIQUE constraint on (company_name,
    folio_number) — unclaimed_assets_live has it; other tables may not.
"""

import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.request

BATCH_SIZE = 500
REQUIRED_HEADERS = {"holder_name", "shares"}
MAX_SHARES = 2_147_483_647  # int4 column limit in Postgres
HTTP_TIMEOUT = 30
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env(path: str = None) -> dict:
    """Minimal .env parser (KEY=VALUE lines, # comment lines, optional quotes).

    Looks for .env next to this script first, then in the repo root (parent dir).
    """
    if path is None:
        for candidate in (os.path.join(SCRIPT_DIR, ".env"),
                          os.path.join(os.path.dirname(SCRIPT_DIR), ".env")):
            if os.path.exists(candidate):
                path = candidate
                break
        else:
            path = os.path.join(SCRIPT_DIR, ".env")
    env = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                env[key.strip()] = value
    env.update({k: v for k, v in os.environ.items() if k in (
        "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")})
    return env


def clean(value):
    """Trim and collapse whitespace (incl. newlines); empty becomes None (NULL)."""
    if value is None:
        return None
    value = re.sub(r"\s+", " ", str(value)).strip()
    return value or None


def parse_shares(value):
    """Parse the shares count. Accepts '1,234' / ' 50 '. Returns int or None."""
    if value is None:
        return None
    digits = str(value).replace(",", "").strip()
    if not re.fullmatch(r"\d+", digits):
        return None
    shares = int(digits)
    if shares > MAX_SHARES:
        return None
    return shares


def read_csv(csv_path: str):
    """Read and validate the CSV.

    Returns (valid_rows, skipped: list[(line_no, reason)], null_key_count).
    """
    valid, skipped = [], []
    seen_keys = set()
    null_key_count = 0
    source_file = os.path.basename(csv_path)

    try:
        f = open(csv_path, encoding="utf-8-sig", newline="")
    except OSError as e:
        sys.exit(f"ERROR: cannot open file: {e}")

    with f:
        try:
            reader = csv.DictReader(f)
            if reader.fieldnames is None:
                sys.exit("ERROR: CSV file is empty.")

            normalized = [(h or "").strip().lower() for h in reader.fieldnames]
            dupes = {h for h in normalized if h and normalized.count(h) > 1}
            if dupes:
                sys.exit(
                    f"ERROR: duplicate CSV column(s): {', '.join(sorted(dupes))}. "
                    "Duplicate headers silently lose data — fix the CSV first."
                )
            missing = REQUIRED_HEADERS - set(normalized)
            if missing:
                sys.exit(
                    f"ERROR: CSV is missing required column(s): {', '.join(sorted(missing))}\n"
                    f"Expected headers: holder_name, father_name, company_name, "
                    f"folio_number, state, full_address, shares"
                )

            for raw in reader:
                line_no = reader.line_num
                row = {(k or "").strip().lower(): v for k, v in raw.items() if k is not None}

                holder = clean(row.get("holder_name"))
                if not holder:
                    skipped.append((line_no, "missing holder_name"))
                    continue

                shares = parse_shares(row.get("shares"))
                if shares is None:
                    skipped.append((line_no, f"invalid shares value: {row.get('shares')!r} "
                                             f"(must be a whole number <= {MAX_SHARES})"))
                    continue

                company = clean(row.get("company_name"))
                folio = clean(row.get("folio_number"))

                if company and folio:
                    key = (company.lower(), folio.lower())
                    if key in seen_keys:
                        skipped.append((line_no, f"duplicate of earlier row (company+folio {folio})"))
                        continue
                    seen_keys.add(key)
                else:
                    null_key_count += 1

                valid.append({
                    "holder_name": holder,
                    "father_name": clean(row.get("father_name")),
                    "company_name": company,
                    "folio_number": folio,
                    "state": clean(row.get("state")),
                    "full_address": clean(row.get("full_address")),
                    "shares": shares,
                    "source_file": source_file,
                })
        except UnicodeDecodeError:
            sys.exit(
                "ERROR: the file is not UTF-8 encoded (Excel often saves 'ANSI' CSVs).\n"
                "Fix: in Excel use 'Save As -> CSV UTF-8', or re-export the file as UTF-8."
            )

    return valid, skipped, null_key_count


def post_batch(base_url: str, key: str, table: str, rows: list) -> None:
    """Upsert one batch via PostgREST; duplicate (company_name, folio_number) rows are ignored."""
    url = f"{base_url}/rest/v1/{table}?on_conflict=company_name,folio_number"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode(),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
            "User-Agent": "seektrix-ingest/1.0",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=HTTP_TIMEOUT).close()


def count_rows(base_url: str, key: str, table: str) -> str:
    """Return the table's total row count (via PostgREST count header)."""
    req = urllib.request.Request(
        f"{base_url}/rest/v1/{table}?select=holder_name",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range": "0-0",
            "User-Agent": "seektrix-ingest/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        content_range = resp.headers.get("Content-Range", "")
        return content_range.split("/")[-1] if "/" in content_range else "?"


def main() -> None:
    parser = argparse.ArgumentParser(description="Load a shareholder CSV into Supabase.")
    parser.add_argument("csv_file", help="Path to the CSV file")
    parser.add_argument("--table", default="unclaimed_assets_live",
                        help="Target table (default: unclaimed_assets_live). Must have a "
                             "UNIQUE (company_name, folio_number) constraint.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate and preview only — nothing is uploaded")
    args = parser.parse_args()

    if not os.path.exists(args.csv_file):
        sys.exit(f"ERROR: file not found: {args.csv_file}")

    valid, skipped, null_key_count = read_csv(args.csv_file)

    print(f"CSV parsed: {len(valid)} valid row(s), {len(skipped)} skipped.")
    for line_no, reason in skipped[:20]:
        print(f"  - line {line_no}: {reason}")
    if len(skipped) > 20:
        print(f"  ... and {len(skipped) - 20} more")
    if null_key_count:
        print(f"\nWARNING: {null_key_count} row(s) have no company_name+folio_number pair.")
        print("         These rows are NOT duplicate-protected — re-running this CSV")
        print("         would insert them again. Fill both columns whenever possible.")

    if args.dry_run:
        print("\n[DRY RUN] Nothing uploaded. First rows as they would be stored:")
        for row in valid[:3]:
            print(" ", json.dumps(row, ensure_ascii=False))
        return

    if not valid:
        sys.exit("Nothing to upload.")

    env = load_env()
    base_url = (env.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base_url or not key:
        sys.exit(
            "ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\n"
            "(Supabase Dashboard -> Project Settings -> API Keys -> service_role)"
        )

    uploaded = 0
    for i in range(0, len(valid), BATCH_SIZE):
        batch = valid[i:i + BATCH_SIZE]
        try:
            post_batch(base_url, key, args.table, batch)
        except urllib.error.HTTPError as e:
            sys.exit(f"ERROR: upload failed (HTTP {e.code}): {e.read().decode()[:500]}")
        except urllib.error.URLError as e:
            sys.exit(f"ERROR: could not reach Supabase ({e.reason}). Check your internet "
                     f"connection and VITE_SUPABASE_URL.")
        uploaded += len(batch)
        print(f"  uploaded {uploaded}/{len(valid)} ...")

    print(f"\nDone. {uploaded} row(s) sent to '{args.table}' "
          f"(duplicates on company_name+folio_number were ignored).")
    try:
        print(f"Table '{args.table}' now holds {count_rows(base_url, key, args.table)} total rows.")
    except Exception:
        pass


if __name__ == "__main__":
    main()
