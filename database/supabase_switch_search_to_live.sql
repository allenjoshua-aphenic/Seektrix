-- ====================================================================
-- SEEKTRIX — Point the app's search at unclaimed_assets_live
-- ====================================================================
-- Run this in the Supabase SQL Editor WHEN you are ready for users to
-- search the real ingested data (unclaimed_assets_live) instead of the
-- demo table (unclaimed_assets). Re-run supabase_fix_search_function.sql
-- to switch back to the demo table at any time.
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
  FROM unclaimed_assets_live u
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
