-- ====================================================================
-- SEEKTRIX — Fix search_shareholders to match the LIVE table schema
-- ====================================================================
-- WHY: the currently deployed function selects columns (bse_code,
-- unclaimed_amount, municipal_region, disclosure_source) that do NOT
-- exist in the live unclaimed_assets table, so every call errors with
--   ERROR 42703: column "bse_code" does not exist
-- and the app can never use the fast fuzzy-search path.
--
-- HOW TO APPLY (10 seconds):
-- 1. Supabase Dashboard -> project fxzuhspdgeilmlikicqz -> SQL Editor
-- 2. Paste this whole file -> Run
--
-- WHAT IT DOES:
--   • pg_trgm fuzzy match on holder_name (threshold 0.3 — catches typos
--     like "Rakes Kumar" -> "Rakesh Kumar"), using the existing
--     idx_holder_name_trgm GIN index.
--   • City/state is a RANKING BOOST, not a hard filter — a person's
--     record often carries an old address, so a wrong city must not
--     hide a genuine name match.
--   • SECURITY DEFINER: the function can read the table even though
--     RLS is enabled with no policies. This is intentional and good:
--     the anon key can SEARCH BY NAME but can never dump the whole
--     table (direct SELECTs stay blocked by RLS).
--   • Returns at most 50 rows, best matches first.
--   • If no name matches, it returns ZERO rows — and the app now shows
--     an honest "no records found" instead of fabricated data.
-- ====================================================================

DROP FUNCTION IF EXISTS public.search_shareholders(text, text);

CREATE OR REPLACE FUNCTION public.search_shareholders(search_name text, search_city text DEFAULT ''::text)
RETURNS TABLE(
  holder_name text,
  father_name text,
  company_name text,
  folio_number text,
  state text,
  full_address text,
  shares integer,
  score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    u.holder_name,
    u.father_name,
    u.company_name,
    u.folio_number,
    u.state,
    u.full_address,
    u.shares,
    similarity(lower(u.holder_name), lower(search_name)) AS score
  FROM unclaimed_assets u
  WHERE lower(u.holder_name) % lower(search_name)
  ORDER BY
    (CASE
       WHEN search_city <> ''
        AND (u.state ILIKE '%' || search_city || '%'
             OR u.full_address ILIKE '%' || search_city || '%')
       THEN 0 ELSE 1
     END),
    score DESC
  LIMIT 50;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_shareholders(text, text) TO anon, authenticated;

-- Quick sanity checks you can run right after:
--   SELECT * FROM search_shareholders('rakesh kumar', '');
--   SELECT * FROM search_shareholders('rakes kumr', '');        -- typo still matches
--   SELECT * FROM search_shareholders('nonexistent person', ''); -- returns 0 rows
