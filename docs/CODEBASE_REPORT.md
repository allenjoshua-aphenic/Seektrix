# SEEKTRIX — Complete Codebase Report

> Generated 2026-07-19 by a full multi-agent analysis (every file in the repo was read end-to-end).
> Project: unclaimed-shares discovery platform for India (IEPF-style shareholder search).

---

## 1. TL;DR — The Answers You Asked For

| Question | Answer |
|---|---|
| Where is the **frontend**? | `src/` — a Vite + React 19 + TypeScript + Tailwind v4 single-page app. Entry: `index.html` → `src/main.tsx` → `src/App.tsx`. |
| Where is the **backend**? | `server.ts` in the **project root**. One Express server (port 3000) that serves the frontend AND the `/api/*` endpoints, and talks to Supabase. There is **no Python/FastAPI/Celery backend** — those `.env` entries are dead leftovers. |
| What do I install **globally**? | **Nothing.** All tools (`tsx`, `vite`, `esbuild`, `typescript`) are local devDependencies. You only need **Node.js 22 LTS** (or 18/20) installed on the machine. |
| Install command | `npm install` (see §3 — do **not** use `npm ci`, the npm lockfile is stale). |
| Run command | `npm run dev` → http://localhost:3000 |
| Will adding data to Supabase **complete the project**? | **NO.** The pipe from Supabase → UI genuinely works, but there are **critical code gaps** (see §7). The biggest one: **when Supabase finds no match, the app silently FABRICATES fake shareholder records for whatever name was searched** — and then asks the user to pay ₹49/₹99 to unlock them. That must be removed before any real user touches this. Payments, auth, and email are also entirely simulated. |

---

## 2. What This Project Actually Is

- **One process, two roles.** `server.ts` runs Express. In dev mode it mounts Vite as middleware, so the same `localhost:3000` serves the React app *and* the API. In production it serves the built files from `dist/`.
- **The search flow** (what a user experiences): enter Name + State/City + Email on the landing page → a "processing" screen with progress bar → a results table (Dashboard) with some columns blurred behind a ₹49/₹99 paywall → PDF download.
- **The data source**: a single Supabase table **`unclaimed_assets`** plus one SQL function **`search_shareholders(search_name, search_city)`**. That's it — one table, one RPC.
- The repo was originally scaffolded from a **Google AI Studio template** (README, `metadata.json`, the browser-tab title "My Google AI Studio App", and the unused `@google/genai` dependency are all leftovers).

---

## 3. Installation & Running (fresh machine, after unzip)

### Prerequisites
- **Node.js 22 LTS** (minimum 18). If not installed: `winget install OpenJS.NodeJS.LTS`
- Nothing else. No global npm packages, no Python, no Redis, no Docker.

### Install
```powershell
cd "C:\Personal Projects\Seektrix"
npm install
```

**Important lockfile note:** the repo has BOTH `bun.lock` and `package-lock.json`.
- `bun.lock` is **up to date** (the project was last built with Bun).
- `package-lock.json` is **stale** (missing `pg` / `@types/pg`), so **`npm ci` will fail** — use plain `npm install`.
- Alternative that reproduces the exact tested dependency tree: install Bun (`winget install Oven-sh.Bun`) then `bun install --frozen-lockfile`.
- Pick one manager and delete the other lockfile to avoid future drift.

### Configure environment
Create a `.env` file in the project root (**none exists right now — this is why the app currently never touches Supabase**):
```env
VITE_SUPABASE_URL=https://fxzuhspdgeilmlikcqz.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon/public key from Supabase → Settings → API>
```
(`seed.sql` line 6 already references your exact project `fxzuhspdgeilmlikcqz`, so these scripts were written for the Supabase project you showed.)

### Run
```powershell
npm run dev          # dev server on http://localhost:3000
npm run build        # production build: dist/ + dist/server.cjs
$env:NODE_ENV = 'production'; npm start    # production run (NODE_ENV=production is REQUIRED)
```
- `npm run lint` = TypeScript type-check only (`tsc --noEmit`).
- `npm run clean` uses `rm -rf` — POSIX only; on Windows delete `dist/` manually or use Git Bash.
- The port is **hardcoded to 3000** in `server.ts` (no `PORT` env support).

### One-off data scripts (root of repo)
| Script | What it does | Needs |
|---|---|---|
| `seed.sql` | **Run this in the Supabase SQL Editor.** Drops & recreates `unclaimed_assets` (full 10-column schema), disables RLS, inserts 17 seed rows, creates the `search_shareholders` RPC. **This is the only artifact that creates everything `server.ts` expects.** | Supabase dashboard |
| `seed_supabase.js` | Inserts the same seed rows via the Supabase JS client (`node scripts/legacy/seed_supabase.js`) | `.env` with the two VITE_SUPABASE vars |
| `insert.js` | Inserts seed rows via a **direct Postgres connection** (`node scripts/legacy/insert.js`) — ⚠ its `CREATE TABLE` is missing `father_name`, `shares`, `state` columns | `DATABASE_URL` in `.env` |
| `test_query.js` | Connectivity smoke test (`node scripts/test_query.js`) | `.env` with the two VITE_SUPABASE vars |

### Environment variables — real vs dead
**Actually read by code:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — server.ts, src/api/supabase.ts, SettingsPanel, seed/test scripts
- `DATABASE_URL` — `insert.js` only
- `NODE_ENV` — server.ts (dev vs prod mode)
- `DISABLE_HMR` — vite.config.ts (AI Studio only; ignore locally)

**Dead — no code reads them (safe to delete from `.env.example`):**
- `GEMINI_API_KEY` (the `@google/genai` package is installed but **never imported anywhere**)
- `DATABASE_SYNC_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `ENVIRONMENT` — leftovers from a Python/Celery backend that does not exist in this repo
- `VITE_API_URL` — read into a constant that is never used (all fetches are relative)

---

## 4. Complete File Map

### Root (backend + config + data scripts)
| File | Role |
|---|---|
| `server.ts` | **THE BACKEND.** Express server: `/api/health`, `POST /api/search`, `GET /api/search/:id/status`, `GET /api/search/:id/matches`. Holds searches in an **in-memory Map** (lost on restart). Queries Supabase via RPC `search_shareholders`, falls back to a full-table select + JS fuzzy match (Levenshtein), and — critically — falls back to **generated fake results** when Supabase yields nothing. Also contains a city→state resolver for ~40 Indian cities and a father-name generator. |
| `package.json` | Scripts + deps (name still says `react-example`). |
| `vite.config.ts` | React + Tailwind v4 plugins; `@` alias → project root. |
| `tsconfig.json` | AI Studio template config — **`strict` mode is OFF**. |
| `index.html` | SPA shell — title is still **"My Google AI Studio App"** (change before launch). |
| `seed.sql` / `seed_supabase.js` / `insert.js` / `test_query.js` | Database setup/seed/test scripts (see §3). |
| `.env.example` | Template — mostly dead vars (see above). |
| `README.md`, `metadata.json` | AI Studio template leftovers. |
| `bun.lock` + `package-lock.json` | Two lockfiles; bun.lock is the current one. |
| `.gitignore` | Correct (protects `.env`) — but the folder is **not a git repo yet**, so it does nothing until `git init`. |

### `src/` (frontend)
**Core:**
| File | Role |
|---|---|
| `main.tsx` | React entry; mounts `App`. |
| `App.tsx` | Root component + view router (Zustand-driven, no react-router). Owns the search submit flow. Contains "simulate empty" / "simulate error" demo handlers and a fake waitlist alert. |
| `index.css` | Tailwind v4 theme, glassmorphism classes, print styles. Loads Google Fonts at runtime. |
| `types.ts` | All shared TypeScript types (`SearchQuery`, `UnclaimedAsset`, `PipelineStep`, …). |

**API / state / hooks / utils:**
| File | Role |
|---|---|
| `api/client.ts` | Fetch wrapper for `POST /api/search` + status polling. (Has dead mock imports and an unused `VITE_API_URL`.) |
| `api/supabase.ts` | Browser-side Supabase client — used **only** by the Settings panel "test connection" button. The search itself never uses it. |
| `store/useAppStore.ts` | Zustand store: user, view, search history (memory only), toasts, paywall unlocks + payment log (localStorage). |
| `hooks/useSearchPolling.ts` | Polls search status every 2s, navigates to dashboard on completion. |
| `hooks/useMobileScrollLock.ts` | Body scroll lock for mobile modals (genuinely fine). |
| `utils/gateway.ts` | **Pure theater** — fabricated "gateway node" labels (GW-MUMBAI-04 etc.). No such infrastructure exists. |

**Mock-data layer (all fabricated):**
| File | Role |
|---|---|
| `data.ts` | 11 hardcoded "master" asset records (one names real public figure **Nandan Nilekani** — legal risk), fake pipeline logs, fake "integration credentials", FAQ copy. |
| `data/mockResults.ts` | **The result-fabrication engine.** For ANY name/state/city it hash-generates 3–4 plausible "Unclaimed" records naming real companies (Reliance, MRF, Infosys, HDFC…) and real authorities (IEPF, EPFO, LIC). Imported by **server.ts** as the empty-result fallback. |
| `bse500_companies.ts` | 100% **dead code** — 50 real BSE companies padded to a fake "BSE 500" with 450 invented companies. Never called. |

**Components (24 files) — live ones:**
| File | Role |
|---|---|
| `Navbar.tsx` | Top nav (5 of 6 advertised asset types are "Coming soon"). |
| `HeroSection.tsx` | Landing hero + **the real search form** (state/city dropdowns; the selected State is silently dropped before the API call). |
| `LandingSections.tsx` | All marketing sections; hardcoded stats ("3,842 registries", "2.1M records" — invented). |
| `ProcessingStatus.tsx` | The "search in progress" screen — progress bar is a **random client-side timer**, unrelated to any real work. |
| `Dashboard.tsx` | **The actual results screen.** Fetches `/api/search/:id/matches` (real Supabase path), blurs columns behind the simulated ₹49/₹99 paywall, generates the "UNION REGISTRY OF INDIA" jsPDF certificate. Falls back to fake results on any fetch error. |
| `DashboardQuickActionFooter.tsx` | IEPF/RBI claim checklist (good real-world guidance text; PDF button is an alert() stub). |
| `AuthScreens.tsx` | Sign-in/up — **accepts any credentials**; a checkbox grants admin. |
| `AdminLogin.tsx` | ⚠ **Hardcoded admin credentials in client JS**: `discoverinseektrix@gmail.com` / `Serena@123` (also shown as placeholders), plus a one-click bypass button. |
| `AdminPanel.tsx` | Admin console — cache/reindex buttons are scripted animations; JSON "ingestion" writes to localStorage that **nothing reads**; revenue stats total the simulated payments. |
| `SettingsPanel.tsx` | Contains the one real Supabase feature (connection test) + embedded copy of the seed SQL. Save/email/PDF-encryption toggles do nothing. |
| `PricingSection.tsx` | 3 hardcoded tiers (₹0/₹2,499/₹9,999); every CTA just opens the auth screen — no billing exists. |
| `LegalPages.tsx` | Hardcoded privacy/terms/compliance text (has typos; download button is an alert() stub). |
| `Footer.tsx`, `FAQAccordion.tsx`, `ToastContainer.tsx`, `SystemStates.tsx`, `StatusBadge.tsx` | Chrome/UI. ToastContainer is genuinely clean. |

**Components that are DEAD CODE (imported by nothing — delete or wire in):**
- `ReportView.tsx` (1,341 lines!) — the polished report/dossier screen. Imported in App.tsx but **no view ever renders it**; Dashboard.tsx is what users actually see.
- `Header.tsx` (superseded by Navbar), `HeroSearchForm.tsx` (superseded by HeroSection's inline form), `SearchProgressTracker.tsx` (superseded by ProcessingStatus), `ReportPreviewCard.tsx`, `RegistrySourceBadge.tsx`, `ComplianceSection.tsx`.

---

## 5. End-to-End Data Flow (how a search really works)

1. User submits name/city/email in **HeroSection** → `App.tsx handleLaunchSearch` (this also silently "logs in" the user — no real auth) → `POST /api/search`.
2. `server.ts` creates an in-memory search (`REQ-xxxx`) and starts a **fake progress timer** (random % increments with scripted log lines like "OCR scanning" — no OCR exists). Nothing has touched the database yet.
3. Frontend polls `GET /api/search/:id/status` every 2s; ProcessingStatus meanwhile animates its **own, second** fake progress bar.
4. When the server's timer hits 100%, the **real query finally runs**:
   - Try RPC `search_shareholders(name, city)` in Supabase;
   - else `select * from unclaimed_assets` (⚠ capped at 1000 rows by Supabase) + JS fuzzy filter;
   - **else FABRICATE 3–4 fake records from the user's own name** (`mockResults.ts`) ← the critical flaw.
5. Poller sees `completed` → navigates to **Dashboard**, which calls `GET /api/search/:id/matches` (re-runs the same query) and renders the table — real Supabase rows genuinely appear here when they exist.
6. Blurred columns → simulated ₹49/₹99 payment (a client-side timer; card/UPI details are collected and **sent nowhere**) → localStorage "unlock" → jsPDF certificate download.

**Supabase objects the code depends on:**
- Table `unclaimed_assets` with columns: `id, company_name, bse_code, holder_name, folio_number, unclaimed_amount, municipal_region, disclosure_source, father_name, shares, state`
- Function `search_shareholders(search_name text, search_city text)` (created only by `seed.sql`)
- RLS **disabled** on the table (the app uses only the anon key)

---

## 6. What Is REAL vs What Is FAKE

### Genuinely working
- Express API + polling + Zustand store + toasts + navigation plumbing
- The Supabase query path (RPC → select fallback → rendered table): **real rows do reach the screen**
- Match similarity score (real Levenshtein), match counts and total value
- City→state resolution; jsPDF actually produces PDFs; seed/test scripts work; health check works

### Simulated / fake (must know before launch)
| # | Fake thing | Where |
|---|---|---|
| 1 | **Fabricated search results when DB has no match** — invents unclaimed shares for the user's own name, then paywalls them | `server.ts:343-345` → `mockResults.ts`; also client-side in `Dashboard.tsx:194-211` and `ReportView.tsx:78-85` |
| 2 | Progress bars & pipeline logs (both server and client are random timers; "OCR", "pg_trgm", "cross-referencing" logs are scripted strings) | `server.ts:401-457`, `ProcessingStatus.tsx:52-72` |
| 3 | Payments — ₹49/₹99 checkout is a timer with a literal "Simulate Scan Success" button; collects card number/CVV/UPI and sends them nowhere; unlocks are localStorage flags readable/bypassable in devtools (blurred data is already in the DOM) | `Dashboard.tsx:90-134`, `ReportView.tsx:109-142` |
| 4 | Auth — any email/password works; admin password hardcoded in shipped JS | `AuthScreens.tsx`, `AdminLogin.tsx:20-21` |
| 5 | Email — the collected email is never sent anything (no mail library exists) | everywhere email is promised |
| 6 | Father names — hash-generated fake fathers attached even to **real** DB rows when `father_name` is NULL (4 copies of the same generator) | `server.ts:141-159`, `Dashboard.tsx:161-172`, `mockResults.ts`, `seed_supabase.js` |
| 7 | Share counts — invented at render time (`amount/10` or `amount/1250+12`); the DB `shares` column is never displayed | `Dashboard.tsx:187`, `ReportView.tsx:325` |
| 8 | Trust artifacts — fake "SHA256" checksums, hardcoded 98/99% confidence, "UNION REGISTRY OF INDIA" official-looking PDF, "SEBI/NPCI Verified", "ISO 27001", "AES-256", fake gateway nodes, fake live-status badges, fake integration credentials | Dashboard/ReportView PDFs, LandingSections, HeroSection, gateway.ts, data.ts |
| 9 | Admin panel operations — cache refresh / reindex are scripted animations; JSON ingestion goes to a localStorage key nothing reads; "revenue" totals the simulated payments | `AdminPanel.tsx` |
| 10 | Waitlist, legal-PDF download, checklist-PDF download, settings save, SMTP toggle, PDF encryption toggle — all `alert()` stubs or no-ops | App.tsx, LegalPages, DashboardQuickActionFooter, SettingsPanel |

> ⚠ **Honest warning:** as the code stands, a real user with NO unclaimed shares would be shown convincing fabricated records (naming real companies and government authorities), and asked to pay to unlock a government-styled PDF containing invented data. Whatever the original intent, shipping that would be indistinguishable from a scam and could have serious legal consequences in India (consumer protection, impersonation of official documents, collecting card details without a processor). Items 1, 3, 6, 7, and 8 must be fixed/removed **before any real user touches this app**.

---

## 7. "Is Adding Data to Supabase Enough?" — The Completion Checklist

**No.** Here is the actual path to completion, in priority order:

### Phase A — Make the data path real (required, small effort)
1. **Create `.env`** with your Supabase URL + anon key (§3). Right now the app never contacts Supabase at all.
2. **Run `seed.sql` in the Supabase SQL Editor** — it is the only script that creates the correct 10-column table AND the `search_shareholders` RPC. (Your dashboard shows "No migrations", so it likely hasn't been run on this project yet — verify in Table Editor.)
3. **Remove every fabricated-results fallback** so "no match" honestly returns zero results:
   - `server.ts` `getMatchesForQuery` — return `[]` instead of `getDeterministicLedgerRecords(...)`
   - `Dashboard.tsx` catch-block fallback to `getDeterministicUnclaimedAssets`
   - (`ReportView.tsx` too if you ever wire it in)
4. **Stop fabricating fields on real rows**: drop the father-name generator calls in `server.ts`/`Dashboard.tsx`; display the DB `shares` column instead of `amount/10`.
5. When ingesting your 100 companies' PDFs, **populate ALL columns**: `father_name`, `shares`, `state` included — otherwise the UI has nothing real to show for them. Note `insert.js`'s `CREATE TABLE` is missing those three columns; prefer the `seed.sql` schema and extend the insert scripts.

### Phase B — Make it correct at scale (required before 100 companies)
6. **Fix the 1000-row ceiling**: the non-RPC fallback does `select('*')` with no filter — Supabase caps that at 1000 rows, so most of your data would be invisible. Keep matching in SQL: rely on the RPC, add a `pg_trgm` index (`CREATE EXTENSION pg_trgm; CREATE INDEX ON unclaimed_assets USING gin (holder_name gin_trgm_ops);`) and a similarity threshold.
7. **Tighten matching**: the current two-sided `LIKE '%name%'` returns OTHER people's records for common name fragments (searching "Kumar" matches every Kumar). With real personal data that's a privacy leak. Require a minimum similarity score.
8. **Persist searches**: `activeQueries` is an in-memory Map — every server restart breaks `/matches` (and used to trigger the fake fallback). Store searches in a Supabase table.

### Phase C — Make the business real (required before charging anyone)
9. **Payments**: integrate a real gateway (Razorpay is the standard for INR/UPI) with server-side verification, and enforce unlocks server-side (never send locked fields to the browser — currently they're just CSS-blurred).
10. **Auth**: use Supabase Auth (it's already in your stack); delete the hardcoded admin credentials.
11. **Email**: integrate a mail service (e.g. Resend) or remove the email-report promise.
12. **Remove misleading trust claims**: fake checksums, "UNION REGISTRY OF INDIA" certificate styling, "SEBI/NPCI Verified", fabricated stats. Replace with honest copy.
13. Decide the fate of `ReportView.tsx` (the nicer report UI, currently never rendered) — wire it in or delete it, plus the other 6 dead components.

### Phase D — Hygiene (nice to have)
14. `git init` (the .gitignore is ready and correctly protects `.env`).
15. Fix the browser-tab title in `index.html`; remove `@google/genai` and the dead env vars; delete the stale lockfile; enable `strict` in tsconfig; remove the Nandan Nilekani mock record.

---

## 8. Known Bugs Found (beyond the fakes)

1. `useAppStore.updateSearchProgress` completion toast reads **stale** matchedCount/value — the "found N matches" toast often says 0.
2. `retryQuery` reuses the same search id → `useSearchPolling`'s `[activeSearch?.id]` dependency never re-fires → **retried searches hang at 0% forever** (and never re-hit the server).
3. One failed poll instantly marks a search "failed" — no retry/backoff.
4. `ReportView` PDF pagination: >8 assets produces 3+ pages all labeled "of 2".
5. Payment modal shows hardcoded "(8 Records)" regardless of the real count.
6. `mockResults.ts`: EPF folio prefixes always "KA-BAN" regardless of state; hyphenated BSE codes truncated by `id.split('-')[1]`.
7. BSE code 532461 is assigned to **Punjab National Bank** in `mockResults.ts` but **Kotak Mahindra Bank** in `bse500_companies.ts` — at least one is wrong.
8. `HeroSection`'s selected State is passed to `App.tsx` but dropped before the API call — the backend guesses state from city instead.
9. `AdminPanel` textarea placeholder shows literal `\n` characters; a state-updater race can log wrong steps during "cache refresh".
10. Search history is in-memory only — lost on every page refresh despite star/archive UI implying persistence.
11. Dozens of unused imports/props/dead state across components (`tsc` won't flag them — strict mode and `noUnusedLocals` are off).

---

## 9. Suggested Immediate Next Steps

1. `npm install` → create `.env` → `npm run dev` → confirm http://localhost:3000/api/health says `"database": "connected"`.
2. Run `seed.sql` in the Supabase SQL Editor (project `fxzuhspdgeilmlikcqz`) and search "Vijay Malhotra" / "Delhi" in the app to prove the real path end-to-end.
3. Apply Phase A fixes (remove fabrication fallbacks) — this is a ~30-line change and the single most important one.
4. Then start ingesting your company PDFs into `unclaimed_assets`, making sure every row carries `father_name`, `shares`, and `state`.
5. Tackle Phase B before the data grows past ~1000 rows, and Phase C before charging anyone a rupee.
