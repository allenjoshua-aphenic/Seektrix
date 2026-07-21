# SEEKTRIX

Unclaimed-shares discovery platform for India. Users search their name against
official IEPF/company shareholder registries stored in Supabase and discover
shares/dividends they (or their family) can claim back.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind v4 (in `src/`) |
| Backend | Express (`server.ts`) — serves the SPA **and** the `/api/*` search endpoints on port 3000 |
| Database | Supabase (Postgres 17) — table `unclaimed_assets` (demo) / `unclaimed_assets_live` (real data), pg_trgm fuzzy search via the `search_shareholders` function |
| Data ingestion | Python (`scripts/ingest_csv.py`, `scripts/convert_iepf_pdf.py`) |

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
