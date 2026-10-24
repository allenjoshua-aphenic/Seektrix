# Local Postgres test bed for the fuzzy search

Reproduces the checks used to validate `database/search_holders_v2.sql` without
touching the live Supabase project. Needs Docker.

```powershell
cd "C:\Personal Projects\Seektrix"
docker run -d --name seektrix-pgtest -e POSTGRES_HOST_AUTH_METHOD=trust -p 55432:5432 postgres:17
# wait ~3 s, then:
docker exec -i seektrix-pgtest psql -U postgres -q -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;"
Get-Content scripts\pgtest\setup_synthetic_registry.sql | docker exec -i seektrix-pgtest psql -U postgres -q      # 400k synthetic names + GIN index (~7 s)
Get-Content database\search_holders_v2.sql              | docker exec -i seektrix-pgtest psql -U postgres -v ON_ERROR_STOP=1 -q
Get-Content scripts\pgtest\run_checks.sql               | docker exec -i seektrix-pgtest psql -U postgres          # timings, thresholds, EXPLAIN plans
$env:PGTEST_URL = "postgres://postgres@localhost:55432/postgres"; npx tsx scripts/engine_local_e2e.ts            # real engine code against it
docker rm -f seektrix-pgtest
```

Expected: every function call well under 100 ms on 400k rows, `Bitmap Index Scan on
idx_holders_name_trgm` in every plan, and `SHOW pg_trgm.similarity_threshold`
back at 0.3 after a call (the per-call threshold must not leak).
