\timing on
\echo '=== word mode, state=delhi ==='
SELECT full_name, state, round(sim::numeric,2) sim, round(wsim::numeric,2) wsim FROM search_holders_v2('rakesh kumar', 'delhi', 'word', 0.8, 10);
\echo '=== word mode, all India (cap 500) ==='
SELECT count(*) FROM search_holders_v2('rakesh kumar', '', 'word', 0.8, 500);
\echo '=== similar mode, typo "rakes kumr gupta" in delhi ==='
SELECT full_name, state, round(sim::numeric,2) sim FROM search_holders_v2('rakes kumr gupta', 'delhi', 'similar', 0.45, 10);
\echo '=== similar mode, "mohammed ali" all India ==='
SELECT full_name, state, round(sim::numeric,2) sim FROM search_holders_v2('mohammed ali', '', 'similar', 0.5, 10);
\echo '=== word mode, single token "sharma" in delhi ==='
SELECT full_name, state, round(wsim::numeric,2) wsim FROM search_holders_v2('sharma', 'delhi', 'word', 0.8, 8);
\echo '=== word mode, "lakshmi narayan" (should also surface LAXMI via similar) ==='
SELECT full_name, state, round(sim::numeric,2) sim FROM search_holders_v2('lakshmi narayan', '', 'similar', 0.45, 8);
\echo '=== nonsense ==='
SELECT count(*) FROM search_holders_v2('qzxjvw', '', 'word', 0.8, 20);
\echo '=== threshold really applied inside the function? (counts must differ) ==='
SELECT (SELECT count(*) FROM search_holders_v2('rakesh kumar','', 'similar', 0.3, 500)) AS at_0_30,
       (SELECT count(*) FROM search_holders_v2('rakesh kumar','', 'similar', 0.45, 500)) AS at_0_45,
       (SELECT count(*) FROM search_holders_v2('rakesh kumar','', 'similar', 0.6, 500)) AS at_0_60;
\echo '=== GUC must NOT leak after the call (defaults 0.3 / 0.5) ==='
SHOW pg_trgm.similarity_threshold;
SHOW pg_trgm.strict_word_similarity_threshold;
\echo '=== candidate-set size per threshold on 400k rows ==='
SELECT set_limit(0.3);  SELECT count(*) AS cands_sim_0_30 FROM unclaimed_holders WHERE lower(full_name) % 'rakesh kumar';
SELECT set_limit(0.45); SELECT count(*) AS cands_sim_0_45 FROM unclaimed_holders WHERE lower(full_name) % 'rakesh kumar';
SELECT set_limit(0.5);  SELECT count(*) AS cands_sim_0_50 FROM unclaimed_holders WHERE lower(full_name) % 'rakesh kumar';
SET pg_trgm.strict_word_similarity_threshold = 0.8;
SELECT count(*) AS cands_word_0_80 FROM unclaimed_holders WHERE lower(full_name) %>> 'rakesh kumar';
\echo '=== EXPLAIN word mode (expect Bitmap Index Scan on idx_holders_name_trgm) ==='
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT h.id FROM unclaimed_holders h WHERE lower(h.full_name) %>> 'rakesh kumar' AND (lower(h.state) = 'delhi' OR h.address ILIKE '%delhi%') ORDER BY strict_word_similarity('rakesh kumar', lower(h.full_name)) DESC LIMIT 200;
\echo '=== EXPLAIN similar mode 0.45 ==='
SET pg_trgm.similarity_threshold = 0.45;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT h.id FROM unclaimed_holders h WHERE lower(h.full_name) % 'rakesh kumar' ORDER BY similarity(lower(h.full_name), 'rakesh kumar') DESC LIMIT 200;
\echo '=== EXPLAIN the LIVE v1 shape at 0.3 (the problem) ==='
SET pg_trgm.similarity_threshold = 0.3;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT h.id FROM unclaimed_holders h WHERE lower(h.full_name) % 'rakesh kumar' ORDER BY similarity(lower(h.full_name), 'rakesh kumar') DESC LIMIT 50;
