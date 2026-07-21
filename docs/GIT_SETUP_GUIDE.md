# SEEKTRIX — Team Git Setup & Workflow Guide

> For the 3-person Seektrix team at **aphenic.com**. Written for developers setting up
> Git collaboration for the first time. Follow it top-to-bottom once; after that,
> only §7 (daily workflow) matters day-to-day.
>
> Status: your local repository is **already initialized** with the three branches
> (`main`, `staging`, `working`) and a clean first commit — you only need to do the
> GitHub side (§2–§5) and push (§6).

---

## 1. Platform choice: GitHub, and why

| Option | Verdict |
|---|---|
| **GitHub (recommended)** | Best ecosystem: Vercel and Render (your deploy targets) have one-click GitHub integrations; simplest PR review UI; free private repos with unlimited collaborators. |
| GitLab | Fine alternative. One real advantage: **enforced protected branches are free on private repos** (GitHub charges for that — see honest note below). Choose GitLab only if enforced protection matters more than the Vercel/Render integration convenience. |
| Azure DevOps | Overkill for a 3-person team; clunkier UI. Skip. |

**Honest pricing note:** on GitHub's **Free** plan, *private* repositories do **not
enforce** branch-protection rules (they're a paid feature for private repos). Your options:
- **Option A (₹0):** rely on team discipline — everyone follows the workflow in §7 and simply never pushes directly to `main`/`staging`. Perfectly workable for 3 trusted people.
- **Option B (~US$4/user/month, GitHub Team):** enforced protection — direct pushes to `main`/`staging` become *impossible*, PR review can be made mandatory. Recommended once real users/revenue exist.

**Organization vs personal account:** create an **Organization**, don't host the repo
under one person's account. The org owns the code (no crisis if a member leaves),
membership can require 2FA, and access is managed per-member. Cost is the same (free).

---

## 2. Create the account and organization (one-time, owner only)

1. Go to https://github.com/signup → sign up with **allenjoshua@aphenic.com** → verify the email.
2. **Enable 2FA immediately**: Profile photo → *Settings → Password and authentication → Enable two-factor authentication* (use Google Authenticator or similar). Do not skip — this account will control your production code.
3. Create the organization: click **+** (top-right) → **New organization** → choose the **Free** plan → name it `aphenic` (or `seektrix-team` if taken) → set contact email to allenjoshua@aphenic.com → skip inviting members for now.
4. Org security: *Org → Settings → Authentication security* → tick **Require two-factor authentication for everyone**.

## 3. Create the private repository

1. On the org page → **New repository**.
2. Name: `seektrix`. Visibility: **Private** ← the critical setting. Nobody outside invited members can see, clone, or even discover it.
3. **Do NOT** tick "Add a README", .gitignore, or license — the local repo already has everything; the remote must start empty.
4. Create. Copy the URL it shows: `https://github.com/<org>/seektrix.git`.
5. After the first push, double-check privacy: open the repo URL in a private/incognito browser window — you should get a 404. That's proof the public can't see it.

## 4. Invite the two teammates

1. Each teammate creates their own free GitHub account (their @aphenic.com email) + 2FA.
2. Org → *People → Invite member* → their username/email → role **Member**.
3. Repo → *Settings → Collaborators and teams → Add teams/people* → give both **Write** access.
   - **Write** = clone, pull, push, create branches, open PRs — everything they need.
   - Do **not** give Admin (that can change settings/delete the repo). Only the owner keeps Admin.

## 5. Branch setup on GitHub (after the first push)

1. Repo → *Settings → General → Default branch* → set to **`working`** (so fresh clones and new PRs default to the everyday branch).
2. If on **GitHub Team** (Option B): *Settings → Branches → Add branch protection rule*:
   - Pattern `main`: ✅ Require a pull request before merging (1 approval) · ✅ Block force pushes · ✅ Restrict deletions.
   - Pattern `staging`: ✅ Require a pull request before merging · ✅ Block force pushes.
3. If on **Free** (Option A): write the rule in your team chat instead — *"nobody ever runs `git push` while on `main` or `staging`; those branches only change through PRs on GitHub"* — and stick to it.

---

## 6. First push (owner, one-time)

The local repo in `C:\Personal Projects\Seektrix` is already initialized: three branches exist, `.gitignore` protects secrets, and the initial commit is made. Connect and push:

```bash
cd "C:\Personal Projects\Seektrix"

# connect the remote (paste your real org name)
git remote add origin https://github.com/<org>/seektrix.git

# push all three branches (the -u links local↔remote so plain `git push` works later)
git push -u origin main
git push -u origin staging
git push -u origin working
```

Git will pop up a browser window to sign in the first time (Git Credential Manager
ships with Git for Windows — approve it once and it remembers).

**Teammates then get the code with:**
```bash
git clone https://github.com/<org>/seektrix.git
cd seektrix
git switch working          # daily work happens here
npm install
copy .env.example .env      # then paste the Supabase keys (shared privately — NOT via Git!)
npm run dev
```

---

## 7. The workflow: `working → staging → main`

```
   working   ← everyone codes here, every day
      │  Pull Request (on GitHub) when a feature set is ready
      ▼
   staging   ← test here; fix bugs here if found
      │  Pull Request when staging is verified
      ▼
   main      ← production-ready only; Vercel + Render read this branch
```

### Daily routine (every developer, every day)

```bash
git switch working
git pull --rebase origin working     # ALWAYS start by syncing (rebase = no messy merge bubbles)

# ... edit code ...

git add -A
git commit -m "feat: add company filter to search results"
git pull --rebase origin working     # sync again in case a teammate pushed meanwhile
git push
```

Commit small and often — one logical change per commit.

### Promoting working → staging (when a feature set is ready to test)

1. On GitHub: **Pull requests → New** → base: `staging`, compare: `working` → title like `Staging: search filters + PDF fix` → create.
2. Another teammate skims the diff (this is your code review) → **Merge** (use the normal *"Create a merge commit"* button).
3. Everyone tests the staging build locally: `git switch staging && git pull && npm run dev`.
4. Found a bug? Fix it **on `staging`** (commit + push there), keep testing.

### Promoting staging → main (when staging is verified)

1. PR on GitHub: base `main`, compare `staging` → review → merge.
2. Vercel/Render (connected to `main`) pick it up automatically — that's your release.
3. **Sync-back** (important — do this after every merge to main, especially if staging got bug-fix commits):

```bash
git switch working
git pull origin main        # bring staging's bug-fixes back into working
git push
```

Without the sync-back, `working` drifts behind and the next PR shows confusing old diffs.

### Merge vs rebase — the simple rule
- **Rebase** only your local unpushed commits: `git pull --rebase` on `working`. Never rebase `staging`/`main` or anything already pushed that others may have.
- **Merge** for all promotions via GitHub PRs.

### Resolving a conflict (will happen — it's normal)
```bash
git pull --rebase origin working
# CONFLICT in src/components/Dashboard.tsx
#  → open the file, look for <<<<<<< ======= >>>>>>> markers, keep the correct code
git add src/components/Dashboard.tsx
git rebase --continue
git push
```
If you get lost mid-rebase: `git rebase --abort` returns you to safety; then ask a teammate to pair on it.

---

## 8. Repository structure (already applied)

```
seektrix/
├── src/                        # FRONTEND — React SPA (components, store, hooks, api)
├── server.ts                   # BACKEND — Express server (root by design: npm scripts + Render run it directly)
├── database/                   # SQL that defines the Supabase side
│   ├── supabase_fix_search_function.sql      # deploys/repairs the search function (demo table)
│   ├── supabase_switch_search_to_live.sql    # repoints search at the real-data table
│   └── legacy/seed.sql                       # outdated schema — kept for history only
├── scripts/                    # Data tooling (Python + Node)
│   ├── ingest_csv.py           # CSV → Supabase loader (needs SUPABASE_SERVICE_ROLE_KEY)
│   ├── convert_iepf_pdf.py     # IEPF shareholder-list PDF → CSV
│   ├── test_query.js           # Supabase connectivity smoke test
│   └── legacy/                 # insert.js, seed_supabase.js — outdated, do not use
├── data/
│   ├── company_sources.csv     # per-company registry of where lists are published (COMMITTED)
│   ├── sample_unclaimed_assets.csv           # format example (COMMITTED)
│   └── ingested/               # real shareholder CSVs (PII) — GIT-IGNORED, lives in Supabase
├── docs/                       # PRODUCTION_GUIDE.md · CODEBASE_REPORT.md · this file
├── index.html · vite.config.ts · tsconfig.json · package.json · package-lock.json
├── .env.example                # committed template
└── .env                        # real keys — GIT-IGNORED, never committed
```

**Committed:** everything above except the ignored items.
**Ignored (via `.gitignore`):** `node_modules/`, `dist/`/`build/`, `.env*` (except `.env.example`), `data/ingested/` (real people's PII must not enter Git history), `__pycache__/`, logs, OS junk.
**Never commit, ever:** `.env`, any API key or token in any file, real shareholder CSVs, `dist/` builds.

## 9. Secrets policy (read twice)

- `.env` is git-ignored — verify with `git status` before your first push; it must **not** appear.
- Share keys between teammates via a password manager or private DM — never via Git, never in code, never in PR descriptions.
- Vercel and Render each have their own *Environment Variables* settings pages — paste the same values there when you deploy; they are never read from the repo.
- If a key ever lands in a commit: **rotate the key in Supabase immediately** (Dashboard → Project Settings → API Keys). Deleting the commit is not enough — Git history is forever.
- The Supabase **secret key** (`sb_secret_…`) belongs only in `.env` and in Render's env settings — never in any `VITE_*` variable (those are bundled into the public browser JS).

## 10. Conventions

- **Commit messages:** `type: short description` — types: `feat`, `fix`, `docs`, `refactor`, `chore`, `data` (for registry/source updates). Example: `fix: PDF pagination past 8 rows`.
- **PR titles:** `Staging: <what's included>` / `Release: <what's included>`.
- **Extra branches:** you shouldn't normally need any beyond the three; if someone wants to experiment, `feature/<name>` branched off `working`, merged back into `working`, then deleted.
- **Maintenance:** delete merged feature branches; once a month everyone runs `git fetch --prune`.
- **Backup:** GitHub is the backup. Push at least daily — unpushed work on a dead laptop is gone.

## 11. Common beginner mistakes (avoid these)

1. Committing `.env` or `node_modules/` — check `git status` before `git add -A` the first few times.
2. Working while sitting on `staging`/`main` — always `git switch working` first; add the branch to your terminal prompt if possible.
3. `git push --force` on a shared branch — never. If Git refuses your push, the answer is `git pull --rebase`, not force.
4. Giant week-long commits — commit per logical change; reviews and conflict-fixes stay easy.
5. Fixing a staging bug on `working` and wondering why staging still fails — staging bugs get fixed **on staging**.
6. Forgetting the sync-back after a release (§7) — set a habit: merge to main → immediately update working.
7. Sharing the repo by adding random collaborators "temporarily" — access reviews are the owner's job; keep the list to exactly the team.

## 12. Deployment note (for later)

No CI/CD through Git for now — just connect both platforms to `main` when ready:
- **Vercel** (frontend): import the GitHub repo → framework Vite → build `npm run build` → output `dist` → set the `VITE_*` env vars → production branch `main`.
- **Render** (backend): new Web Service from the repo → build `npm install && npm run build` → start `NODE_ENV=production node dist/server.cjs` → set all `.env` values → branch `main`.
- Note: as a single Express app, Seektrix can also run entirely on Render alone (it serves the frontend too). Splitting across Vercel+Render will additionally require CORS/API-URL changes in the code — plan that as a task on `working` when you get there.
