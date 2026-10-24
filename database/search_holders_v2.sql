-- ====================================================================
-- SEEKTRIX — search_holders_v2: production fuzzy name search
-- ====================================================================
-- WHY (measured 2026-10-17 against the live project):
--   The v1 function `search_holders` uses the `%` operator at pg_trgm's
--   default threshold of 0.3. On 13.7 lakh names that makes every row that
--   merely shares a common token ("kumar", "sharma", "ali", "lakshmi")
--   a candidate. Postgres then has to fetch and score lakhs of rows and the
--   query dies at Supabase's 8-second statement timeout. The Express server
--   silently fell back to a plain `ILIKE '%name%'` scan, so users were
--   getting unranked rows in table order.
--
--   The trigram GIN index `idx_holders_name_trgm` ON lower(full_name)
--   EXISTS and works (a nonsense name returns in ~300 ms). Nothing new has
--   to be indexed, so this file needs ZERO extra storage — it only
--   replaces function code.
--
-- WHAT v2 DOES:
--   * Two modes, both served by the existing GIN index:
--       mode = 'word'    → strict_word_similarity: the typed name must
--                          appear as a (near) word-for-word phrase inside
--                          the registered name. "rakesh kumar" matches
--                          "RAKESH KUMAR GUPTA" at 1.0, is order-insensitive,
--                          and ignores extra middle/last names.
--       mode = 'similar' → classic trigram similarity for typos
--                          ("rakes kumr" → "RAKESH KUMAR"), but at a
--                          caller-chosen threshold (the app uses 0.45–0.55)
--                          so the candidate set stays small.
--   * The threshold is set PER CALL with set_config(..., is_local = true),
--     so it never leaks to other connections (PostgREST runs each RPC in
--     its own transaction).
--   * Optional state filter applied inside the same index scan. When the
--     app knows the user's state it searches that state first (fast),
--     then widens to all of India only if needed.
--   * Optional regex `name_pattern` (built by the server from the initials
--     the user typed, e.g. "R K Sharma" → '^(?=.*\mr)(?=.*\mk)') so that
--     initials narrow the candidate set instead of being ignored.
--   * Returns the primary key + raw similarity scores so the Node layer
--     can re-rank with initials / phonetics / state bonuses and explain
--     every match to the user.
--
-- HOW TO APPLY (zero downtime, ~1 second):
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   v1 stays in place; the server falls back to it automatically if v2 is
--   missing, and switches to v2 the moment this is deployed.
--
-- SANITY CHECKS after running:
--   SELECT full_name, sim, wsim FROM search_holders_v2('rakesh kumar', '', 'word', 0.8, 20);
--   SELECT full_name, sim       FROM search_holders_v2('rakes kumr', 'delhi', 'similar', 0.45, 20);
--   SELECT full_name            FROM search_holders_v2('sharma', 'delhi', 'word', 0.8, 20, '^(?=.*\mr)(?=.*\mk)');
--   SELECT count(*)             FROM search_holders_v2('qzxjvw', '', 'word', 0.8, 20);  -- 0 rows, fast
-- ====================================================================

-- Drop earlier signatures so PostgREST never sees two overloads (ambiguity error).
DROP FUNCTION IF EXISTS public.search_holders_v2(text, text, text, real, integer);
DROP FUNCTION IF EXISTS public.search_holders_v2(text, text, text, real, integer, text);

CREATE FUNCTION public.search_holders_v2(
  search_name   text,
  search_state  text    DEFAULT ''::text,
  mode          text    DEFAULT 'word'::text,     -- 'word' | 'similar' | 'prefix'
  threshold     real    DEFAULT 0.8,
  max_rows      integer DEFAULT 200,
  name_pattern  text    DEFAULT NULL              -- optional case-insensitive regex on full_name
)
RETURNS TABLE(
  holder_id              bigint,
  company_name           text,
  full_name              text,
  father_or_husband_name text,
  folio_number           text,
  dp_client_id           text,
  state                  text,
  address                text,
  shares                 integer,
  unclaimed_amount       numeric,
  financial_year         text,
  sim                    real,      -- similarity(lower(full_name), query)
  wsim                   real,      -- strict_word_similarity(query, lower(full_name))
  state_match            boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  q   text    := lower(regexp_replace(btrim(coalesce(search_name, '')), '\s+', ' ', 'g'));
  st  text    := lower(btrim(coalesce(search_state, '')));
  pat text    := nullif(btrim(coalesce(name_pattern, '')), '');
  lim integer := LEAST(GREATEST(coalesce(max_rows, 200), 1), 500);
  th  real    := LEAST(GREATEST(coalesce(threshold, 0.8), 0.2), 1.0);
BEGIN
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  IF mode = 'similar' THEN
    -- Typo-tolerant whole-name similarity. Threshold is what keeps the
    -- GIN candidate set small: at 0.45 "suresh kumar" no longer matches
    -- "rakesh kumar" (0.44), while "rakes kumr" still does (0.50).
    PERFORM set_config('pg_trgm.similarity_threshold', th::text, true);

    RETURN QUERY
      SELECT s.*
      FROM (
        SELECT h.id,
               c.company_name,
               h.full_name,
               h.father_or_husband_name,
               h.folio_number,
               h.dp_client_id,
               h.state,
               h.address,
               h.shares,
               h.unclaimed_amount,
               h.financial_year,
               similarity(lower(h.full_name), q)                       AS sim_,
               strict_word_similarity(q, lower(h.full_name))           AS wsim_,
               (st <> '' AND (lower(h.state) = st
                              OR h.address ILIKE '%' || st || '%'))    AS st_match_
        FROM unclaimed_holders h
        JOIN companies c ON c.id = h.company_id
        WHERE lower(h.full_name) % q
          AND (st = '' OR lower(h.state) = st OR h.address ILIKE '%' || st || '%')
          AND (pat IS NULL OR h.full_name ~* pat)
      ) s
      ORDER BY s.sim_ DESC, s.wsim_ DESC, s.full_name
      LIMIT lim;

  ELSIF mode = 'prefix' THEN
    -- Type-ahead for a short single fragment ("rak"): names that start with it
    -- or contain a word starting with it. LIKE is served by the trigram index
    -- and there is no ORDER BY, so Postgres stops at the first `lim` hits.
    RETURN QUERY
      SELECT s.*
      FROM (
        SELECT h.id,
               c.company_name,
               h.full_name,
               h.father_or_husband_name,
               h.folio_number,
               h.dp_client_id,
               h.state,
               h.address,
               h.shares,
               h.unclaimed_amount,
               h.financial_year,
               similarity(lower(h.full_name), q)                       AS sim_,
               strict_word_similarity(q, lower(h.full_name))           AS wsim_,
               (st <> '' AND (lower(h.state) = st
                              OR h.address ILIKE '%' || st || '%'))    AS st_match_
        FROM unclaimed_holders h
        JOIN companies c ON c.id = h.company_id
        WHERE (lower(h.full_name) LIKE q || '%' OR lower(h.full_name) LIKE '% ' || q || '%')
          AND (st = '' OR lower(h.state) = st OR h.address ILIKE '%' || st || '%')
          AND (pat IS NULL OR h.full_name ~* pat)
        LIMIT lim
      ) s;

  ELSE
    -- Word-level match: the query must be a (near) exact phrase of words
    -- inside the registered name. Index-served via the %>> operator.
    PERFORM set_config('pg_trgm.strict_word_similarity_threshold', th::text, true);

    RETURN QUERY
      SELECT s.*
      FROM (
        SELECT h.id,
               c.company_name,
               h.full_name,
               h.father_or_husband_name,
               h.folio_number,
               h.dp_client_id,
               h.state,
               h.address,
               h.shares,
               h.unclaimed_amount,
               h.financial_year,
               similarity(lower(h.full_name), q)                       AS sim_,
               strict_word_similarity(q, lower(h.full_name))           AS wsim_,
               (st <> '' AND (lower(h.state) = st
                              OR h.address ILIKE '%' || st || '%'))    AS st_match_
        FROM unclaimed_holders h
        JOIN companies c ON c.id = h.company_id
        WHERE lower(h.full_name) %>> q
          AND (st = '' OR lower(h.state) = st OR h.address ILIKE '%' || st || '%')
          AND (pat IS NULL OR h.full_name ~* pat)
      ) s
      ORDER BY s.wsim_ DESC, s.sim_ DESC, s.full_name
      LIMIT lim;
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_holders_v2(text, text, text, real, integer, text)
  TO anon, authenticated, service_role;

-- Optional, recommended: give the API roles a little more headroom than the
-- default 8 s so a rare slow stage degrades gracefully instead of failing.
-- (The server still aborts its own calls at ~7.5 s, so users never wait longer.)
-- ALTER ROLE authenticator SET statement_timeout = '15s';
-- NOTIFY pgrst, 'reload config';
