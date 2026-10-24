# SEEKTRIX

Unclaimed-shares discovery platform for India. Users search their name against
official IEPF/company shareholder registries stored in Supabase and discover
shares/dividends they (or their family) can claim back.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind v4 (in `src/`) |
| Backend | Express (`server.ts`) — serves the SPA **and** the `/api/*` search endpoints on port 3000 |
| Database | Supabase (Postgres 17) — `companies` → `unclaimed_holders` (13.7 lakh rows), pg_trgm GIN index on `lower(full_name)`, search function `search_holders_v2` (`database/search_holders_v2.sql`) |
| Search engine | `server/search/` — staged fuzzy search (word match → typo match → widen), Node re-ranking with initials / sound-alike / state reasons, per-call abort timeouts, result cache |
| Data ingestion | Python (`scraping/fetch_iepf_pdfs.py`, `scraping/ingest_downloads.py`) |

## Running it

There is **one process**: the Express server serves the React frontend *and* the `/api/*` endpoints.

```powershell
cd "C:\Personal Projects\Seektrix"
npm install                 # first time only
npm run dev                 # → http://localhost:3000  (frontend + backend, hot reload)
```

Production build and run:

```powershell
cd "C:\Personal Projects\Seektrix"
npm run build               # Vite → dist/, esbuild → dist/server.cjs
$env:NODE_ENV = 'production'; npm start      # PowerShell
# set NODE_ENV=production&& npm start        # cmd.exe
```

Useful checks:

```powershell
npm run lint                                   # TypeScript type-check
npx tsx scripts/search_engine_selftest.ts      # name normaliser + scorer unit checks (no DB)
node scripts/api_smoke_test.mjs                # 15 API cases against the running server (PASS/FAIL)
node scripts/ui_browser_test.mjs               # 12 real-browser cases (needs Playwright, see file header)
curl http://localhost:3000/api/health          # database + which search function is live
```

## How a search works

**Field rules.** Full name *or* email is enough; state and city are optional. A state turns the search into an *advanced* search that looks at records registered in that state first and only widens to all of India when few are found. With only an email, the server reads the name from its local part (`ramesh.sen@…` → "ramesh sen") because the registries store names, folios and addresses, never email addresses, and it says so in the search log.

1. **Type-ahead** (`GET /api/suggest?name=&state=`): the hero form waits 350 ms after the last keystroke, cancels the previous request with an `AbortController`, and shows up to 8 possible records.
2. **Full search** (`POST /api/search`): the server normalises the name (titles, dots, `KR.` → `kumar`, `S/O …` stripped) and runs staged queries against `search_holders_v2`:
   - *word match* — the typed words must appear as a phrase inside the registered name (`strict_word_similarity ≥ 0.8`), the user's state first;
   - *typo match* — trigram similarity ≥ 0.45 (state) / 0.5 (all India) only if the first stage is thin;
   - initials such as `R K Sharma` become a regex filter (`^(?=.*\mr)(?=.*\mk)`) so they narrow instead of being ignored.
3. **Re-ranking in Node** (`server/search/score.ts`): token alignment with exact / sound-alike / close-spelling / prefix / initial weights, penalties for extra name parts, a state tie-breaker, and a human-readable reason list per row.
4. The client polls `GET /api/search/:id/status` for real progress and reads `GET /api/search/:id/matches` from the job cache — the database is queried once per search.

If `search_holders_v2` is not deployed the server falls back to the legacy `search_holders` once and flags the result as *degraded* in the UI; it never fabricates or silently substitutes a substring scan.

### Deploying the search function (one time)

```powershell
cd "C:\Personal Projects\Seektrix"
node scripts/deploy_search_function.mjs            # deploys database/search_holders_v2.sql and verifies it
node scripts/deploy_search_function.mjs --verify   # verify only (e.g. after pasting the SQL in the dashboard)
```

The script needs one credential able to run SQL in `.env`: either `DATABASE_URL` (Dashboard → Connect → Session pooler URI) or `SUPABASE_ACCESS_TOKEN` (Dashboard → Account → Access Tokens). Without either, paste the file into the Supabase SQL Editor and run `--verify`.

## Quick start

```bash
npm install
# create .env from .env.example and fill in the Supabase keys
npm run dev          # → http://localhost:3000
```

`npm run lint` type-checks. `npm run build` + `NODE_ENV=production npm start` for a production run.

## Repository layout

```
├── src/               Frontend (React SPA)
├── server.ts          Backend (Express + Vite middleware)
├── database/          Supabase SQL (search function, live-table switch; legacy/ = outdated)
├── scripts/           Data tooling: PDF→CSV converter, CSV→Supabase loader (legacy/ = outdated)
├── data/              Source registry + sample CSV (data/ingested/ = real PII, git-ignored)
├── docs/              PRODUCTION_GUIDE.md (read this first), CODEBASE_REPORT.md, GIT_SETUP_GUIDE.md
├── index.html         SPA shell
└── .env.example       Environment template — copy to .env, never commit .env
```

## Documentation

- **[docs/PRODUCTION_GUIDE.md](docs/PRODUCTION_GUIDE.md)** — how everything works, Supabase setup, monthly data-ingestion runbook, IEPF primer, open production gaps.
- **[docs/GIT_SETUP_GUIDE.md](docs/GIT_SETUP_GUIDE.md)** — team Git workflow (`working → staging → main`).
- **[docs/CODEBASE_REPORT.md](docs/CODEBASE_REPORT.md)** — file-by-file architecture audit.

## Deployment

No Git-based CI/CD. Frontend deploys to **Vercel**, backend to **Render** — both track the `main` branch only.
