# SEEKTRIX — Relational Data Model (engineering audit)

> Goal: move from one flat table to **companies (parent) → unclaimed_holders (child)**
> with a foreign key, so the team can "add a company, then add its holders below it,"
> and scale cleanly to 150+ companies. Built from the **real columns** found in every
> downloaded file — not guesses. Migration SQL: [../database/schema_relational.sql](../database/schema_relational.sql).
>
> Status: **designed, not yet applied to the live DB.** Three decisions (§3) are yours
> to confirm first, because they change what data gets accepted or rejected.

---

## 1. Attribute audit — what the real files actually contain

Every downloaded IEPF file has a **different column set**. This is the single most
important finding, and it drives the whole schema.

| File | Name field | Identifier | Shares | Amount | Address | Other columns |
|---|---|---|---|---|---|---|
| Asian Paints | single "Name of Holder" | Folio/DPID-ClientID | ✅ | ✅ | — | Sr No |
| Bajaj Finance (xlsm) | **First/Middle/Last + Father** | Folio + DP-ID | ✅ | ✅ | ✅ +State/Pin | PAN, investment type, FY, transfer date |
| L&T | single "SHAREHOLDER" | Folio + Type(PHY/NSD) | ✅ | — | — | Type |
| ISGEC | single + **Joint1 + Joint2** | Folio | ✅ | — | ✅ | joint holders |
| SBI | single "Name of Entitled Shareholder" | **none** (no folio) | — | ✅ | ✅ | nature of amount, transfer date |
| Sun Pharma (csv, 154k rows) | single "Full Name" | Folio + DP-ID | — | ✅ | ✅ | dividend type, payment date, FY |
| Titan (xls, 33k rows) | **First/Middle/Last + Father** | Folio + DP-ID | ✅ | ✅ | ✅ +State/Pin | investment type, transfer date |
| TCS | single "1st Holder Name" | Folio/DPID-ClientID | ✅ | ✅ | — | per-dividend amount columns |
| Kotak | single "NAME" | Folio + Warrant No | — | ✅ | — | warrant no |
| Wipro (43pg) | **First/Middle/Last + Father** | Folio + DP-ID | ✅ | ✅ | ✅ +State/Pin/District | transfer date |

**What is universal (present or derivable in ALL files):**
1. a **full name** (either one field, or assembled from first+middle+last)
2. **at least one value** — a rupee amount *or* a share count (never both missing)
3. which **file** it came from (provenance)

**What varies:** first/last split (only the 3 MCA-template files), father/husband name,
joint holders, address, state/pin, PAN, dividend type, financial year, warrant no,
transfer date, holder type. Everything in this list must be **nullable** — no single
source has them all.

---

## 2. The schema

**`companies`** (parent — one row per company): `id` (PK), `company_name` (unique),
`bse_code`, `nse_symbol`, `industry`, `cin`, `registrar`, `iepf_page_url`, `created_at`.

**`unclaimed_holders`** (child — one row per shareholder record):
`id` (PK) · `company_id` (**FK → companies.id**, the link you asked for) ·
`full_name` · first/middle/last · father_or_husband · joint_holder_1/2 ·
folio_number · dp_client_id · pan · holder_type · address · state · pin ·
`shares` · `unclaimed_amount` · dividend_type · financial_year · warrant_no ·
transfer_date · `source_file` · `created_at`.

**`company_stats`** (a **view**, not a table): live counts per company —
`holder_count`, `total_shares`, `total_unclaimed_amount`, `latest_transfer_date`.
This is the "number of contacts / number of unclaimed assets" you wanted on the
company record. It's a view so it can **never go stale** — no trigger, no manual
recount; it's always correct the instant you add holders. (If you'd rather have real
stored columns on `companies`, we can add a trigger to maintain them — but the view is
the cleaner engineering choice.)

---

## 3. Nullability — your ask vs. the data (3 decisions)

You asked for `first_name`, `last_name`, `amount`, and the "main card" to be NOT NULL.
The audit in §1 shows each of those collides with real sources. Here is each conflict
and my recommendation:

### Decision A — Name: `first_name` + `last_name` NOT NULL ❌ won't work
Only 3 of 10 files (the MCA-template ones) split the name. Asian Paints, L&T, ISGEC,
**SBI, Sun Pharma (154k rows), TCS, Kotak** all give ONE name field. Forcing first+last
NOT NULL would **reject the majority of your data.**
- **Recommendation:** make **`full_name` NOT NULL** (satisfiable by 100% of rows — it's
  the real "name must exist" rule), and keep first/middle/last **nullable**, filled when
  the source splits them (or by a best-effort split later). → *This is what the SQL does.*

### Decision B — `unclaimed_amount` NOT NULL ❌ won't work as-is
The "shares liable for transfer" lists (L&T, ISGEC, and Asian Paints' shares list) have
a **share count but no rupee amount**. The dividend lists (SBI, Sun Pharma, Kotak) have
an **amount but no shares**. You can't force *both* NOT NULL, and forcing amount alone
rejects the share-only lists.
- **Recommendation:** a **CHECK constraint `amount IS NOT NULL OR shares IS NOT NULL`** —
  every row must carry *a value* (money or shares), but either satisfies it. This captures
  your real intent ("don't store a valueless row") without dropping valid data.
  → *This is what the SQL does (`holder_has_value`).*

### Decision C — the "main card" (identifier) NOT NULL ❌ risky
If "main card" means **PAN**: almost no public list includes PAN, so this is impossible.
If it means the **folio/DP-ID**: most lists have it, but **SBI's has none at all**.
- **Recommendation:** keep `folio_number`, `dp_client_id`, `pan` **nullable**. Dedup is
  handled by a unique index on `(company_id, folio_number, financial_year)` *where folio
  exists*; rows without a folio (SBI) are still stored and simply aren't folio-deduped.
  → *This is what the SQL does.* If you insist on a hard identifier rule, the closest
  safe one is a CHECK that "folio OR dp_client_id OR (address is present)" — tell me and
  I'll add it.

**Net:** the columns that are truly NOT NULL end up being **`company_id`, `full_name`,
`source_file`, and "amount-or-shares"** — which is the strongest guarantee the real data
can actually support. Everything else is nullable by necessity.

---

## 4. The workflow you wanted: "add a company, then add holders below it"

```sql
-- 1) add the company once
INSERT INTO companies (company_name, bse_code, nse_symbol, industry, registrar)
VALUES ('MRF Ltd.', '500290', 'MRF', 'Tyres', 'KFin')
RETURNING id;                      -- say it returns 7

-- 2) add its holders, all pointing at company_id = 7
INSERT INTO unclaimed_holders (company_id, full_name, folio_number, shares, unclaimed_amount, source_file)
VALUES
  (7, 'Suresh Menon', 'MRF-10021', 120, NULL, 'mrf_2025.csv'),
  (7, 'Lakshmi Iyer', 'MRF-10022', NULL, 4500.00, 'mrf_2025.csv');
```

The Python loader (`scripts/ingest_csv.py`) gets a `--company` flag: it upserts the
company row, grabs its `id`, then inserts every CSV row with that `company_id`. So your
whole monthly routine stays: **PDF → CSV → `ingest_csv.py --company "X Ltd."`** — the
loader handles the FK link automatically. `company_stats` then shows the new counts
instantly.

---

## 5. What else changes (so nothing breaks)

- **Search:** the RPC becomes `search_holders(name, city)` — it fuzzy-matches `full_name`
  and JOINs `companies` so results carry the company name. The Express server
  (`server.ts`) switches its `.rpc('search_shareholders', …)` call to `search_holders`
  and reads the new column names. Small, contained change.
- **The old table:** `unclaimed_assets_live` (382 rows) can be migrated into the new
  model with one `INSERT … SELECT` (create a "PNB Gilts Ltd." company row, copy the 382
  holders under it), then dropped. The demo `unclaimed_assets` table can be dropped too.
- **Ingestion of the downloaded files:** each file needs a small per-source column map
  (they all differ — §1), feeding the same `unclaimed_holders` shape. This is the one
  genuinely manual-ish step, because every company formats its list differently.

---

## 6. Recommended order of execution (once you confirm §3)

1. Run [../database/schema_relational.sql](../database/schema_relational.sql) → creates the two tables, view, indexes, RPC (non-destructive; doesn't touch existing tables).
2. Update `scripts/ingest_csv.py` to add the `--company` flag + company upsert.
3. Migrate the 382 PNB Gilts rows into the new model; verify search via `search_holders`.
4. Point `server.ts` at `search_holders`; test end-to-end.
5. Ingest the downloaded company files one by one (per-source column maps).
6. When happy, drop `unclaimed_assets` and `unclaimed_assets_live`.

**I've written the schema + this doc but have NOT run anything against your live database.**
Confirm the three §3 decisions (or just say "go with your recommendations") and I'll
apply it and wire up the loader + server.
