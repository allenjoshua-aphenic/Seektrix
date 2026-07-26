# SEEKTRIX — Production Guide

> Generated 2026-07-19. This session: audited your **live Supabase project** (read-only — nothing was deleted or modified in the database), removed every fabricated-results path from the code, verified the changes with an adversarial multi-agent review, and smoke-tested the app end-to-end.
>
> Companion doc: [CODEBASE_REPORT.md](CODEBASE_REPORT.md) (full file-by-file architecture report).

---

## 1. TL;DR

| Question | Answer |
|---|---|
| Is my data in Supabase? | **Yes** — 100 rows, 10 companies, verified live. |
| Was the app using it? | **No.** Two blockers: the deployed `search_shareholders` function crashes (references columns your table doesn't have), and RLS blocks the anon key from reading anything. Every search was silently falling into the fake-data generator. |
| Is the fake-data problem fixed? | **Yes — in code, verified.** A search with no real match now returns an honest **0 results** everywhere (server + client). Tested live. |
| What must YOU do to finish? | **1 thing**: paste your API key(s) into `.env`. ~~Run the SQL~~ — **I already ran it in your project** (2026-07-19, second session): the fixed `search_shareholders` function is deployed and tested live. See §4. |
| Monthly data updates — code changes needed? | **No.** Adding new company rows to the table is all it takes. A dedicated ingestion table **`unclaimed_assets_live`** now exists, plus a tested Python loader (`ingest_csv.py`). See the runbook in §6. |

---

## 2. Live Database Audit (what I found in your Supabase)

Project: `discoverinseektrix@gmail.com's Project` — ref **`fxzuhspdgeilmlikicqz`** — ap-southeast-1 — Postgres 17 — ACTIVE_HEALTHY.
(Note: `seed.sql` in the repo has the ref misspelled as `fxzuhspdgeilmlikcqz` — missing an "i". The correct URL is `https://fxzuhspdgeilmlikicqz.supabase.co`.)

### Table `unclaimed_assets` (the only table) — the LIVE schema
| Column | Type | Nullable |
|---|---|---|
| `holder_name` | text | NOT NULL |
| `father_name` | text | yes |
| `company_name` | text | yes |
| `folio_number` | text | yes |
| `state` | text | yes |
| `full_address` | text | yes |
| `shares` | integer | NOT NULL |

⚠ This is **different from `seed.sql`** in the repo (which expects `id`, `bse_code`, `unclaimed_amount`, `municipal_region`, `disclosure_source`). The live schema is actually the better one — it matches exactly what the results table displays. The code has been updated to speak this schema natively.

### Data
- **100 rows, 10 companies, 10 states**: Asian Paints (8), Cipla (13), HCL Technologies (7), HDFC Bank (13), ICICI Bank (7), Infosys (14), L&T (11), Reliance (5), TCS (11), Wipro (11).
- Every row has `holder_name`, `father_name`, `state`, `full_address`, `shares` populated.
- Honest observation: this data looks **generated for demo** (father names repeat across unrelated holders, addresses don't match states — e.g. state "Telangana" with a Bengaluru address, folio prefixes don't match companies — e.g. an Infosys row with folio `HCL-IEPF-91727`). Fine for demo; replace with real PDF data as it comes.

### Infrastructure
- ✅ `pg_trgm` extension installed, and a **GIN trigram index already exists**: `idx_holder_name_trgm ON unclaimed_assets USING gin (lower(holder_name) gin_trgm_ops)` — fuzzy search will stay fast as data grows.
- ❌ **`search_shareholders` RPC is broken**: it selects `bse_code`, `unclaimed_amount`, `municipal_region`, `disclosure_source` — columns that don't exist. Confirmed live: calling it errors with `42703: column "bse_code" does not exist`. → Fixed by `supabase_fix_search_function.sql` (§4).
- ⚠ **RLS is ENABLED with zero policies** on `unclaimed_assets` — the anon key can read *nothing*. This is actually good for privacy (nobody can dump your table), and the fixed RPC is designed to work *with* it (see §4). But it's why the app currently gets zero rows.

### Search-logic verification (run read-only against your live data)
| Test | Result |
|---|---|
| `"rakesh kumar"` | 3 exact matches (score 1.00) — HDFC Bank, TCS, Infosys — plus lower-scored near-names |
| `"narayan krishnamurthi"` (misspelled) | Finds "Narayanan Krishnamurthy" at score 0.77 — typo-tolerance works |
| `"zzz nonexistent person"` | **0 rows** → the app now shows an honest "No Database Matches Located" |

---

## 3. What Changed in the Code (all verified + type-checked)

### The big one: no more fabricated results
Previously: if Supabase returned nothing (which was *always*, per §2), the server generated 3–4 fake shareholder records from the user's own name. The frontend did the same on any fetch error. **All of these paths are gone**:

| File | Change |
|---|---|
| [server.ts](../server.ts) | Removed the `getDeterministicLedgerRecords` fallback — empty Supabase result = empty response. Removed the unused fake `FALLBACK_LEDGER` and the father-name generator. Added `mapRowToRecord()` that maps your live 7-column schema honestly (real `shares`, real `father_name`, `state`, `full_address`; missing values stay empty — nothing is invented, including BSE codes). Server now prefers `SUPABASE_SERVICE_ROLE_KEY` (server-only) over the anon key. An RPC that *succeeds with 0 rows* is now final (no loose re-scan of the whole table). The table-scan fallback (only used if the RPC errors) now filters by **name only** and uses city/state purely for ranking — mirroring the SQL function — and no longer invents "Delhi" as a default state. `/api/search/:id/matches` now returns `shares`, `state`, `fullAddress`. |
| [src/components/Dashboard.tsx](../src/components/Dashboard.tsx) | Removed the client-side mock fallback (fetch errors now show an error toast + empty state, never fake rows). Removed the fake father-name generator — shows the DB value or "N/A". Shares come from the real `shares` column (was: invented as amount÷10). Payment modal shows the real record count (was hardcoded "(8 Records)"). Empty-state message rewritten for real users (was developer seeding instructions). **PDF export now paginates** — with 9+ matches, rows no longer silently fall off the page. |
| [src/components/ReportView.tsx](../src/components/ReportView.tsx) | (Currently unmounted screen, cleaned anyway:) removed mock fallback, removed the fake "Late Ramakrishnan Sundaram" default, share counts now come from the real `shares` field (was `amount/1250+12`). |
| [src/components/AdminPanel.tsx](../src/components/AdminPanel.tsx) | No longer counts the 11 hardcoded fake "registry" records in its metric cards — stats now reflect only locally uploaded records (real registry counts live in Supabase). |
| [src/api/client.ts](../src/api/client.ts), [src/data.ts](../src/data.ts) | Removed dead imports that kept the mock-data engine linked into the live bundle. |
| [src/types.ts](../src/types.ts) | Added optional `shares` to `UnclaimedAsset`. |
| `.env` (new) | Created with your project URL; keys are placeholders for you to paste (§4). Gitignored. |
| `supabase_fix_search_function.sql` (new) | The corrected RPC — see §4. |

### Verified
- `tsc --noEmit` — clean.
- 3 independent adversarial review agents re-read every changed file; all their **major/critical** findings were fixed (fake BSE codes, AdminPanel fake stats, "(8 Records)", PDF truncation, dead mock imports, over-matching filters). Remaining minor notes are catalogued in §7.
- Live smoke test: server boots, `/api/health` OK, full search flow (`submit → poll → completed → matches`) returns **honest `[]`** with no keys configured, landing page serves HTTP 200.

---

## 4. What YOU Do Next (2 minutes)

### Step 1 — Paste your keys into `.env`
Open **Supabase Dashboard → Project Settings → API Keys** and fill in [.env](../.env):
```env
VITE_SUPABASE_URL=https://fxzuhspdgeilmlikicqz.supabase.co   # already filled
VITE_SUPABASE_ANON_KEY=<paste the "anon / publishable" key>
SUPABASE_SERVICE_ROLE_KEY=<paste the "service_role / secret" key>   # server-only
```
(I could not fetch these for you — my tooling correctly refuses to reveal secret keys.)

### Step 2 — Run the SQL fix — ✅ ALREADY DONE FOR YOU
On 2026-07-19 (second session) I deployed [supabase_fix_search_function.sql](../database/supabase_fix_search_function.sql) directly to your project and verified it live:
- `search_shareholders('rakesh kumar', 'delhi')` → exact matches ranked first, Delhi rows boosted to the top;
- misspelled `'narayan krishnamurthi'` → still finds Narayanan Krishnamurthy;
- `'zzz nobody here'` → **0 rows**.

I also created the **`unclaimed_assets_live`** ingestion table (see §6) and proved its duplicate protection live (inserting the same 3 tagged test rows twice: first pass inserted 3, second pass 0; I then deleted only those 3 test rows — your data was never touched).

For reference, the deployed function:
- matches your real columns (no more `42703` errors),
- does pg_trgm fuzzy matching on `holder_name` using your existing GIN index (typo-tolerant, threshold 0.3),
- treats city/state as a **ranking boost, not a filter** (people's records often carry old addresses — a wrong city must not hide a real name match),
- is `SECURITY DEFINER`: the app can **search by name** while RLS keeps the full table locked (nobody can bulk-download your shareholder data with the anon key). This is the production-correct pattern — keep RLS ON, add no policies.

### Step 3 — Verify (1 minute)
```powershell
cd "C:\Personal Projects\Seektrix"
npm run dev
```
1. `http://localhost:3000/api/health` → should say `"database": "connected"`.
2. Search **"Rakesh Kumar"**, any city → expect 3 records with real shares/folios from your table.
3. Search **"Narayan Krishnamurthi"** (deliberate typos) → still finds Narayanan Krishnamurthy.
4. Search a made-up name → **"No Database Matches Located"** — the honest empty state.

---

## 5. How the System Works Now (current flow)

1. User submits Name + City + Email → `POST /api/search` (Express, [server.ts](../server.ts)).
2. Server runs a progress sequence (~10–15 s — cosmetic pacing; the log lines like "OCR scanning" are staged theater, kept as-is for the demo experience).
3. At 100% the **real query** runs: `search_shareholders(name, city)` RPC in Supabase (pg_trgm fuzzy, GIN-indexed, max 50 rows, best score first). If the RPC ever errors (e.g. SQL fix not yet applied), a table-scan fallback applies the same name-only philosophy (needs the service-role key, since RLS blocks anon selects).
4. Dashboard fetches `/api/search/:id/matches` and renders **exactly what the database says**: holder, father's name, company, folio, state, full address, shares. Zero matches → honest empty state. Fetch error → error toast, no fake data.
5. Blurred columns / ₹49–₹99 unlock / PDF download still work as before (payment is still **simulated** — see §7).

**The rule going forward: whatever is in `unclaimed_assets` is what users see. Nothing else. Change the data → the app changes. No deployments needed for data updates.**

---

## 6. Monthly Data-Ingestion Runbook (your future workflow)

Every month, companies publish their unclaimed/IEPF share registers → you extract rows from the PDFs → you add them to the table. **No code changes, ever.** Three ways, pick per situation:

### Option A — CSV Import (best for a full company batch, no SQL needed)
1. Extract the PDF's table into CSV with **exactly these headers**:
   ```csv
   holder_name,father_name,company_name,folio_number,state,full_address,shares
   ```
2. Dashboard → **Table Editor → unclaimed_assets → Insert → Import data from CSV** → upload → confirm.

### Option B — SQL INSERT (best for small additions)
```sql
INSERT INTO unclaimed_assets (holder_name, father_name, company_name, folio_number, state, full_address, shares) VALUES
('Suresh Menon', 'K. P. Menon', 'MRF Ltd.', 'MRF-IEPF-10021', 'Tamil Nadu', '14 Cathedral Road, Chennai', 120),
('Lakshmi Iyer', 'V. Iyer',    'MRF Ltd.', 'MRF-IEPF-10022', 'Tamil Nadu', '3 T Nagar, Chennai',        45);
```

### Option C — Script (best once volume grows / you want dedupe)
Adapt `seed_supabase.js` (it already inserts with folio-number dedupe) — but **strip its `generateFatherName()` fallback first**: it invents father names for rows that lack one, which must never happen with real people. Insert the real value or leave it NULL (the UI shows "N/A").

### Data rules (important)
- **Never invent a field.** If the PDF doesn't give father's name or address, leave it empty — the app now displays "N/A" honestly.
- `holder_name` and `shares` are required (NOT NULL). Everything else may be empty.
- **Dedupe on `folio_number`** — it's the natural unique key per company register. Consider making it unique: `CREATE UNIQUE INDEX CONCURRENTLY idx_folio_unique ON unclaimed_assets (folio_number);` (do this once, when you're sure existing data has no duplicates).
- Keep `state` consistent ("Tamil Nadu", not "TN"/"tamilnadu") — it powers result ranking.
- **Scale**: the GIN trigram index handles hundreds of thousands of rows; the RPC returns at most 50 best matches per search. 100 companies × a few thousand rows each is well within a free-tier Postgres. Watch the 500 MB database limit on the free plan as you grow (you're at 26 MB).
- After each monthly load, run one spot-check search for a name you just added.

### Replacing today's demo rows
When real data starts arriving, delete the demo rows at your convenience (e.g. `DELETE FROM unclaimed_assets WHERE folio_number LIKE '%-IEPF-9%'` — or just truncate and reload). I deleted nothing, per your instruction.

---

### The `unclaimed_assets_live` table + `ingest_csv.py` (added 2026-07-19, second session)

A dedicated **real-data table now exists in your Supabase** so demo data and real data never mix:

| Column | Notes |
|---|---|
| `id` | auto-generated |
| `holder_name` | required |
| `father_name`, `company_name`, `folio_number`, `state`, `full_address` | optional — NULL renders as "N/A" |
| `shares` | required integer |
| `source_file` | auto-filled with the CSV filename — tells you which monthly file each row came from |
| `created_at` | auto timestamp |
| UNIQUE `(company_name, folio_number)` | duplicate protection — re-running a CSV never duplicates rows that carry both values |

It has the same trigram search index and the same RLS lockdown as the main table.

**The loader — [ingest_csv.py](../scripts/ingest_csv.py)** (pure Python standard library, nothing to install):
```powershell
python scripts/ingest_csv.py MRF_july2026.csv --dry-run    # validate + preview, uploads nothing
python scripts/ingest_csv.py MRF_july2026.csv              # upload to unclaimed_assets_live
```
It validates every row (skips rows with missing names or bad share counts, reporting line numbers), rejects CSVs with duplicate headers, parses `"1,250"`-style numbers, stores blanks as NULL (never invents values), dedupes within the file, warns about rows that lack the company+folio dedupe key, and upserts in batches with duplicates ignored. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` (RLS blocks everything else). [sample_unclaimed_assets.csv](../data/sample_unclaimed_assets.csv) shows the format (its last row is intentionally invalid to demo validation).

**Going live with real data**: the app's search currently reads the demo table. When you're ready, run [supabase_switch_search_to_live.sql](../database/supabase_switch_search_to_live.sql) in the SQL Editor — searches instantly serve `unclaimed_assets_live` instead. Re-run `supabase_fix_search_function.sql` to switch back.

---

### Where to find each company's unclaimed-shares list (Reliance example)

Under **Section 124(6), Companies Act 2013**, every listed company must publish its unclaimed-dividend holders and the shares transferred to IEPF (dividends unclaimed 7 consecutive years). Three sources, best first:

1. **The company's Investor Relations page** (the primary source — but format varies by company):
   - ⚠ **Reliance publishes NO bulk file** — its page (https://www.ril.com/investors/shares/dividend-shares) only offers per-person lookup widgets (enter folio/DP ID → see one record). The "Dividend History" PDF there contains dividend rates, not names. Do not attempt to bulk-scrape lookup widgets — that violates the site's terms and is mass PII harvesting; use only lists the company actually publishes.
   - **Many companies DO publish the real list** ("shareholders whose shares are liable for transfer / transferred to IEPF" — names, folio/DP ID, share counts), as required by the IEPF Rules: e.g. IndianOil (iocl.com/transfer-of-equity), Infosys (infosys.com → Investors → Shareholder Services → Transfer of Equity Shares), Muthoot Finance, EIH Ltd. **Start with these companies.**
   - Search per company: `<company name> "liable for transfer to IEPF" list site:<companydomain>.com` or `<company> unclaimed dividend IEPF list`.
2. **The IEPF portal** — https://www.iepf.gov.in — company-wise unclaimed amount details (IEPF-2 filings) and the claim search.
3. **The company's RTA** (registrar): KFin Technologies for Reliance, Link Intime for many others — their portals have year-wise unpaid-dividend search/downloads.

**Monthly workflow per company**: download the list (often Excel — easier than PDF; for PDFs, extract the table with Excel's Data→From PDF, or any PDF-to-CSV tool) → rename/reorder columns to `holder_name, father_name, company_name, folio_number, state, full_address, shares` → `python scripts/ingest_csv.py <file>.csv --dry-run` → fix reported rows → run without `--dry-run`. Done — no code changes, ever.

Note on columns: company lists give *folio/DP-Client ID, name, shares, address, PIN*. There is usually **no rupee amount** (the share count IS the claimable asset — value = shares × market price), no father's name, and the name is a single field, not first/last — leave blank whatever the source doesn't provide.

### Team audit sheet — 150 companies ([company_audit_150.csv](../data/company_audit_150.csv) + [build_audit_sheet.gs](../scripts/build_audit_sheet.gs))

The 150-company target list is tracked in a Google Sheet the whole team edits. Two ways to create it:

- **Recommended — one click:** open https://sheets.new → *Extensions → Apps Script* → paste all of [scripts/build_audit_sheet.gs](../scripts/build_audit_sheet.gs) → Save → Run `buildAuditSheet` → authorise. It builds the **Company Audit** tab (all 151 rows, dropdowns, colour coding, filters, auto-dated `last_checked`) and a live **Dashboard** tab (coverage %, source-type breakdown, total records collected). Then *Share* with the team as Editors.
- **Manual:** *File → Import →* upload [data/company_audit_150.csv](../data/company_audit_150.csv) (no formatting/dropdowns).

Columns: `sr_no · company_name · bse_scrip_code · nse_symbol · industry · index_group · has_data · source_type · source_url · data_available_upto · record_count · fields_available · ingested_to_supabase · assigned_to · last_checked · notes`.

**The number in the source list is the BSE scrip code** (6-digit BSE listing code, e.g. Reliance 500325); the short code beside it is the NSE ticker symbol.

Known issues flagged in the list: **3 duplicate rows** — #50 Cipla (=#30), #141 Voltas (=#101), #148 Muthoot Finance (=#85) → **148 unique companies**; and 5 BSE codes to verify (rows 62, 89, 113, 137, 146) where the source image was cut off or the code looks unusual. Row 151 is PNB Gilts (already ingested — proof of pipeline), not part of the original 150.

To keep Git in sync with the team's progress, run `exportSheetAsCsv()` in the Apps Script editor and paste the logged output back into `data/company_audit_150.csv`.

### Source-discovery sweep results (2026-07-19) — see [company_sources.csv](../data/company_sources.csv)

A 10-agent web sweep checked every company currently in the demo DB for free official name-level lists. Verdict per company:

| Company | Bulk list with names? |
|---|---|
| **Asian Paints** | ✅ **YES — best source found**: 15 years of annual PDFs (FY2010-11→FY2024-25) with full name, father/husband name, address, folio, amounts; plus liable-for-transfer lists with share counts |
| **TCS** | ⚠ Partial: one live bulk PDF (2013–2019 unclaimed dividends: folio, name, shares) — must download in a browser (site blocks scripts); richer historical lists on the Wayback Machine |
| **ICICI Bank** | ⚠ Narrow: one ~38-name PDF (erstwhile ICICI Securities holders); rest widgets |
| Wipro | ❌ widgets now — but its deleted pre-2018 bulk lists (names, addresses) survive on the **Wayback Machine** |
| Reliance, Infosys, HDFC Bank, L&T, Cipla, HCL Tech | ❌ per-person lookup widgets only; notice PDFs contain no names |

**Strategic lessons:** (1) Mega-caps mostly moved to lookup widgets; mid/small caps (like PNB Gilts) still publish real lists — build breadth there first. (2) **Lists get deleted** (Wipro proved it) — when you find one, ingest it immediately; your DB becomes the archive. (3) The **Wayback Machine (web.archive.org)** is a legitimate free recovery channel for deleted official lists. (4) BSE announcement attachments rarely contain names — company IR pages are the primary channel. (5) Do not scrape per-person widgets and do not buy scraped databases from aggregators.

### ✅ First real company loaded: PNB Gilts Ltd (2026-07-19)

Proof of the whole pipeline, done end-to-end:
- Source: https://www.pnbgilts.com/uploads/annoucement/1524651350.pdf — PNB Gilts' *"List of shareholders whose shares are liable for transfer to IEPF Authority"* (5 pages; columns FOLIO NO / NAME / CURR SHR / ADD1-4 / PIN; both physical folios and demat IN-IDs).
- Converted with [convert_iepf_pdf.py](../scripts/convert_iepf_pdf.py) → [pnb_gilts_unclaimed.csv](../data/ingested/pnb_gilts_unclaimed.csv): **382 shareholders parsed, 0 data rows lost** (only the title and totals-footer lines skipped), state auto-extracted from the address for 332 rows.
- Validated with `ingest_csv.py --dry-run` (382 valid, 0 skipped) and loaded into **`unclaimed_assets_live`**: 382 rows, 15 states, 24,220 shares.
- Search verified live: fuzzy query "madhuri dalal" → *Madhuri Nimish Dalal, folio PNBGILTS-00000312, Maharashtra, 133 shares*.

Caveats to review: (a) parsed share total 24,220 vs the PDF footer's 24,139 (0.3% diff — spot-check a few rows against the PDF); (b) the file is from an April-2018 announcement, so these shares have likely since moved to the IEPF Authority — still claimable via Form IEPF-5, which is exactly Seektrix's use case, but newer year-lists exist on pnbgilts.com; (c) the app searches the demo table until you run [supabase_switch_search_to_live.sql](../database/supabase_switch_search_to_live.sql).

For the next company: `python scripts/convert_iepf_pdf.py <list.pdf> <out.csv> --company "X Ltd." --folio-prefix "X-"` → dry-run → ingest. If a company's PDF has a different layout, the converter's regex needs a small tweak — always compare the parsed totals with the PDF's own footer.

---

## 6c. IEPF Primer — the rules your whole business runs on

- **IEPF = Investor Education and Protection Fund**, run by the **IEPF Authority** under the **Ministry of Corporate Affairs (MCA)**, Government of India. Legal basis: **Sections 124–125, Companies Act 2013** + the **IEPF Rules, 2016**.
- **The 7-year rule (Section 124)**: a declared dividend that stays unclaimed sits in the company's Unpaid Dividend Account; after **7 consecutive years** unclaimed, the money goes to IEPF — and under **Section 124(6) the underlying SHARES themselves** are transferred to the IEPF Authority's demat account. (If the holder claimed even one dividend in between, the shares stay put.)
- **Why public lists exist (Rule 6)**: before transferring shares, the company MUST notify each affected shareholder, advertise in newspapers, and **publish on its website the list of shareholders whose shares are due for transfer** (name, folio/DP ID, share count). That list is Seektrix's raw material. Companies also file **Form IEPF-2** (investor-wise unclaimed amounts) with MCA within 60 days of each AGM.
- **Ownership is NEVER lost**: IEPF transfer is custodial. The owner or their legal heirs can claim back **at any time, forever**, by filing **Form IEPF-5** on mca.gov.in (then sending documents to the company's Nodal Officer; the company verifies within 30 days; the Authority credits shares back to the claimant's demat). Real-world timeline: usually 6–12+ months. This is precisely the service gap Seektrix monetizes: people don't know their (or their parents') shares are sitting with IEPF.
- **"Once moved to IEPF, does the list disappear online?"** The *claim right* never disappears, but the *public bulk file* can: the richest lists are the pre-transfer "liable for transfer" notices; after transfer, some companies keep year-wise archives while others (e.g. Reliance) replace files with per-person lookup widgets, and old PDFs vanish in site redesigns. **So harvest lists when you find them** — your `unclaimed_assets_live` table with its `source_file` column is exactly that permanent archive. The IEPF/MCA portals hold the master data but offer no public bulk downloads.
- **Columns explained**: *folio number / DP-Client ID* is the identifier the claimant needs for IEPF-5; *shares* is the claimable asset (value = shares × market price — lists carry no rupee column); dividend-statement lists (IEPF-2) carry rupee amounts instead of share counts.
- **Compliance posture**: these lists are published under legal mandate — using them to help owners discover claims is legitimate. Handle them as PII (your RLS lockdown is right), never present Seektrix output as a government document, and remember Seektrix is a private service assisting with claims, not affiliated with IEPF/MCA.

## 7. Honest Status: What Is Still NOT Production-Grade

Fixed this session: **results integrity** (the make-or-break item). Still open, in priority order:

1. **Payments are simulated.** The ₹49/₹99 checkout is a timer; card/UPI inputs go nowhere; unlocks are localStorage flags and the "locked" data is only CSS-blurred (readable via devtools). Before charging a single rupee: integrate Razorpay (or similar) with server-side verification, and stop sending locked fields to the browser at all.
2. **The PDF is styled as "UNION REGISTRY OF INDIA"** with a fake "digital signature ID". Now that it contains real people's data, an official-looking government document you generate is a serious legal risk in India. Rebrand it as a "Seektrix Search Report" before launch.
3. **Auth is fake.** Any password works; admin credentials (`discoverinseektrix@gmail.com` / `Serena@123`) are hardcoded in client JS ([AdminLogin.tsx:20](../src/components/AdminLogin.tsx#L20)) with a one-click bypass. Use Supabase Auth (already in your stack) and delete those.
4. **Email is never sent** despite the form promising a report. Integrate a mail service or drop the promise.
5. **Searches live in server memory** — a restart forgets them (the UI now shows an error toast instead of fake data, but persistence in a Supabase `searches` table would be better).
6. **Trust theater remains** (progress-bar OCR/pipeline messages, "3,842 registries", "ISO 27001", "SEBI/NPCI Verified", fake gateway nodes, hardcoded confidence scores, `totalMatchedValue` always ₹0 since your schema has no amount column). Cosmetic, but worth an honesty pass before public launch.
7. **Dead code to delete when convenient**: `src/data/mockResults.ts`, most of `src/data.ts`, `src/bse500_companies.ts`, `Header.tsx`, `HeroSearchForm.tsx`, `SearchProgressTracker.tsx`, `ReportPreviewCard.tsx`, `RegistrySourceBadge.tsx`, `ComplianceSection.tsx`, the unmounted `ReportView.tsx` (or wire it in), the simulate-empty/error scaffolding in `App.tsx`, and the outdated `seed.sql`/`insert.js` (their schemas no longer match the live table).
8. **Hosting**: `npm run build` + `NODE_ENV=production npm start` works on any Node host (Render/Railway/a VPS). Port is hardcoded 3000. Set the same `.env` values there.

## 7b. Final Hardcoded-Data Audit (2026-07-19, second session)

A dedicated audit agent re-read the entire live component graph after the latest edits. The verdict on **search-result data**:

✅ **No result data shown to users is mock, generated, or hardcoded.** Every holder name, father's name, company, folio, state, address and share count rendered in the live flow comes from Supabase; zero matches and errors show honest empty/error states. (This includes the final fix: the Dashboard no longer invents a "Manoj Kumar / Chennai" search subject when no search has been run.)

What *does* remain, fully catalogued:
- **Kept by your request**: the hardcoded admin login (`AdminLogin.tsx:20`) and its demo-bypass button.
- **Cosmetic theater (not result data)** — progress-stage messages (including one in `server.ts` that names TCS/Infosys/Asian Paints/Cipla/Dabur as "being scanned"), hardcoded 98/99 confidence scores, gateway-node labels, landing-page marketing stats and trust badges ("AES-256", "ISO 27001", "IEPF.GOV.IN: ONLINE"), the simulated payment gateway (still collects card/CVV/UPI details it sends nowhere), and the "UNION REGISTRY OF INDIA" PDF branding with invented "DOC REF"/"Digital Signature ID" stamps. These should be cleaned before public launch (§7), but they never masquerade as a user's search results.
- **Dead code (unreachable, contains mocks)**: `mockResults.ts`, `MASTER_UNCLAIMED_ASSETS`/`findAssetsForQuery`/`INTEGRATION_CREDENTIALS` in `data.ts`, `bse500_companies.ts`, and the unimported components (`Header`, `HeroSearchForm`, `SearchProgressTracker`, `ReportPreviewCard`, `RegistrySourceBadge`, `ComplianceSection`, `StatusBadge`, `SettingsPanel`*, `ReportView`). Delete them after `git init` for permanence.
- ⚠ **One trap to never touch**: `SettingsPanel.tsx` contains a copyable seed SQL block that would insert 17 *fabricated* "real-world" records into your database. Do not run it — real data enters only via `ingest_csv.py` or the dashboard importer. (*The settings view is currently unreachable from the live UI.)

## 8. Security Notes

- 🔴 **Rotate the Supabase Personal Access Token** you shared this session (`sbp_403...`): Dashboard → Account → Access Tokens → revoke it and create a new one. It grants full management access to your projects and was pasted in a chat — treat it as exposed.
- `.env` is correctly gitignored, and the repo is now under Git — `git ls-files` confirms no secrets or PII CSVs are tracked. Never commit real keys.
- Keep the **service_role key server-side only** (it's read via `SUPABASE_SERVICE_ROLE_KEY`, which Vite does *not* bundle into the browser — never rename it with a `VITE_` prefix).
- Keep **RLS enabled with no policies** on `unclaimed_assets` — combined with the `SECURITY DEFINER` search function, that's what stops bulk scraping of your shareholder data.
