-- ====================================================================
-- SEEKTRIX — Relational schema: companies (parent) → unclaimed_holders (child)
-- ====================================================================
-- Replaces the single flat table with a proper 2-table model so you can
-- "add a company, then add its holders below it" and scale to 150+ companies.
--
-- Designed from the ACTUAL columns found across all downloaded files
-- (Asian Paints, Bajaj, L&T, ISGEC, SBI, Sun Pharma, Titan, TCS, Kotak, Wipro).
-- See docs/DATA_MODEL.md for the full attribute audit and the reasoning behind
-- every NULL / NOT NULL / CHECK decision.
--
-- NOT YET RUN against the live database — review the 3 decisions in the doc first.
-- ====================================================================

-- ── 1. PARENT: one row per company ──────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name  text NOT NULL UNIQUE,
  bse_code      text,
  nse_symbol    text,
  industry      text,
  cin           text,               -- corporate identity number (from IEPF-2 files)
  registrar     text,               -- RTA: KFin / Link Intime / Datamatics / MUFG ...
  iepf_page_url text,               -- where the list was sourced
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. CHILD: one row per shareholder record, linked to its company ──
CREATE TABLE IF NOT EXISTS unclaimed_holders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- NAME (full_name is the only always-present name field; splits are best-effort)
  full_name              text NOT NULL CHECK (length(trim(full_name)) > 0),
  first_name             text,
  middle_name            text,
  last_name              text,
  father_or_husband_name text,
  joint_holder_1         text,      -- ISGEC-style joint holders
  joint_holder_2         text,

  -- IDENTIFIERS (nullable — SBI's list has none; PAN is rarely published)
  folio_number  text,
  dp_client_id  text,               -- NSDL/CDSL demat id (IN30...)
  pan           text,
  holder_type   text,               -- PHY / NSDL / CDSL

  -- ADDRESS
  address       text,
  state         text,
  pin           text,

  -- VALUE (at least ONE of these must be present — see CHECK below)
  shares            integer,
  unclaimed_amount  numeric(14,2),

  -- DIVIDEND / PROVENANCE METADATA
  dividend_type   text,             -- Interim / Final
  financial_year  text,
  warrant_no      text,
  transfer_date   date,             -- date transferred to IEPF
  source_file     text NOT NULL,    -- which downloaded file this row came from
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- A record with neither a rupee amount NOR a share count is worthless → reject it.
  CONSTRAINT holder_has_value CHECK (unclaimed_amount IS NOT NULL OR shares IS NOT NULL)
);

-- ── 3. Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_holders_company    ON unclaimed_holders (company_id);
CREATE INDEX IF NOT EXISTS idx_holders_name_trgm  ON unclaimed_holders USING gin (lower(full_name) gin_trgm_ops);

-- Dedup guard: where a folio exists, the same company+folio+year can't be imported twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_holder_dedup
  ON unclaimed_holders (company_id, folio_number, financial_year)
  WHERE folio_number IS NOT NULL;

-- ── 4. Live rollup metadata (a VIEW — never goes stale, no maintenance) ──
CREATE OR REPLACE VIEW company_stats AS
SELECT
  c.id, c.company_name, c.bse_code, c.nse_symbol, c.industry,
  count(h.id)                             AS holder_count,
  coalesce(sum(h.shares), 0)             AS total_shares,
  coalesce(sum(h.unclaimed_amount), 0)   AS total_unclaimed_amount,
  max(h.transfer_date)                    AS latest_transfer_date
FROM companies c
LEFT JOIN unclaimed_holders h ON h.company_id = c.id
GROUP BY c.id;

-- ── 5. Security: same model as before (RLS on, search via SECURITY DEFINER RPC) ──
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE unclaimed_holders ENABLE ROW LEVEL SECURITY;

-- ── 6. Search function: fuzzy name match, returns the holder + its company ──
DROP FUNCTION IF EXISTS search_holders(text, text);
CREATE OR REPLACE FUNCTION search_holders(search_name text, search_city text DEFAULT ''::text)
RETURNS TABLE(
  company_name text, full_name text, father_or_husband_name text,
  folio_number text, dp_client_id text, state text, full_address text,
  shares integer, unclaimed_amount numeric, financial_year text, score real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT c.company_name, h.full_name, h.father_or_husband_name,
         h.folio_number, h.dp_client_id, h.state, h.address,
         h.shares, h.unclaimed_amount, h.financial_year,
         similarity(lower(h.full_name), lower(search_name)) AS score
  FROM unclaimed_holders h
  JOIN companies c ON c.id = h.company_id
  WHERE lower(h.full_name) % lower(search_name)
  ORDER BY
    (CASE WHEN search_city <> '' AND (h.state ILIKE '%'||search_city||'%'
          OR h.address ILIKE '%'||search_city||'%') THEN 0 ELSE 1 END),
    score DESC
  LIMIT 50;
$fn$;
GRANT EXECUTE ON FUNCTION search_holders(text, text) TO anon, authenticated;
