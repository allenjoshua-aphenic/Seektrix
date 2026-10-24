import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { SearchEngine, TUNING } from './server/search/engine';
import { JobStore, SearchJob } from './server/search/jobs';
import { rateLimit } from './server/ratelimit';

dotenv.config();
// NOTE: no import.meta.url here — the production bundle is CommonJS (see package.json
// "build"), where import.meta is empty and fileURLToPath(undefined) would crash on start.

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
// Reads from .env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY
let supabase: SupabaseClient | null = null;

function formatSupabaseUrl(url: string | undefined): string {
  if (!url) return '';
  let trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}.supabase.co`;
  }
  return trimmed;
}

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const rawUrl = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!rawUrl || !key) {
    console.warn('[SEEKTRIX] Supabase credentials not set. Searches will return zero matches.');
    return null;
  }
  const url = formatSupabaseUrl(rawUrl);
  supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log(`[SEEKTRIX] Supabase client initialized with URL: ${url}`);
  return supabase;
}

// ── CITY → STATE (only used when the client did not send a state) ───────────
const CITY_STATE: Record<string, string> = {
  chennai: 'Tamil Nadu', coimbatore: 'Tamil Nadu', madurai: 'Tamil Nadu', trichy: 'Tamil Nadu', salem: 'Tamil Nadu',
  bengaluru: 'Karnataka', bangalore: 'Karnataka', mysore: 'Karnataka', mysuru: 'Karnataka',
  mumbai: 'Maharashtra', pune: 'Maharashtra', nagpur: 'Maharashtra', thane: 'Maharashtra', nashik: 'Maharashtra',
  hyderabad: 'Telangana', secunderabad: 'Telangana',
  delhi: 'Delhi', 'new delhi': 'Delhi',
  kolkata: 'West Bengal', calcutta: 'West Bengal', howrah: 'West Bengal',
  ahmedabad: 'Gujarat', surat: 'Gujarat', vadodara: 'Gujarat', rajkot: 'Gujarat',
  jaipur: 'Rajasthan', jodhpur: 'Rajasthan', udaipur: 'Rajasthan',
  lucknow: 'Uttar Pradesh', kanpur: 'Uttar Pradesh', noida: 'Uttar Pradesh', ghaziabad: 'Uttar Pradesh', agra: 'Uttar Pradesh', varanasi: 'Uttar Pradesh',
  patna: 'Bihar', bhopal: 'Madhya Pradesh', indore: 'Madhya Pradesh',
  kochi: 'Kerala', cochin: 'Kerala', trivandrum: 'Kerala', thiruvananthapuram: 'Kerala',
  chandigarh: 'Punjab', ludhiana: 'Punjab', amritsar: 'Punjab',
  dehradun: 'Uttarakhand', gurugram: 'Haryana', gurgaon: 'Haryana', faridabad: 'Haryana',
  bhubaneswar: 'Odisha', guwahati: 'Assam', ranchi: 'Jharkhand', raipur: 'Chhattisgarh', panaji: 'Goa', visakhapatnam: 'Andhra Pradesh', vijayawada: 'Andhra Pradesh',
};

function resolveState(stateInput: string | undefined, cityInput: string | undefined): { city: string; state: string } {
  const city = String(cityInput || '').split(',')[0].trim();
  let state = String(stateInput || '').trim();
  if (!state) {
    const parts = String(cityInput || '').split(',').map((s) => s.trim());
    if (parts.length >= 2 && parts[1]) state = parts[1];
  }
  if (!state && city) state = CITY_STATE[city.toLowerCase()] || '';
  return { city, state };
}

// ── INPUT VALIDATION ─────────────────────────────────────────────────────────
const NAME_RE = /^[\p{L}\p{M}\s.'&/()-]{2,120}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** "ramesh.sen@outlook.com" → "ramesh sen". Returns '' when nothing name-like is left. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0].toLowerCase();
  const STOP = new Set(['mail', 'email', 'info', 'contact', 'admin', 'hello', 'office', 'me', 'my', 'the', 'official', 'team', 'support', 'test', 'user', 'id']);
  const parts = local.split(/[^a-z]+/).filter((p) => p && !STOP.has(p));
  // Need something name-like: one part of 4+ letters, or two parts of 3+ ("sen.raj").
  const longParts = parts.filter((p) => p.length >= 3);
  if (!parts.some((p) => p.length >= 4) && longParts.length < 2) return '';
  return parts.join(' ');
}

// ── ENGINE + JOB STORE ───────────────────────────────────────────────────────
const engine = new SearchEngine(getSupabase);
const jobs = new JobStore();

async function runJob(job: SearchJob) {
  const t0 = Date.now();
  if (job.nameSource === 'email') {
    jobs.log(job, 'queued', `No name was typed, so the search uses "${job.fullName}", read from the email address ${job.email}. Type the full name as it appears on the share certificate for a more precise search.`, 'warning');
  }
  jobs.log(job, 'queued', `Search received for "${job.fullName}"${job.state ? ` in ${job.state} (advanced: narrowed to this state first)` : ' across all of India'}. Cleaning the name: titles, punctuation and abbreviations are normalised.`);
  job.status = 'fuzzy_matching';
  job.progressPercent = 10;

  try {
    const result = await engine.search(job.fullName, {
      state: job.state,
      city: job.city,
      limit: TUNING.resultLimit,
      onStage: (stage, progress) => {
        job.progressPercent = Math.max(job.progressPercent, Math.min(progress, 97));
        if (stage.name === 'ranking') {
          job.status = 'report_assembly';
        } else if (stage.mode === 'similar') {
          job.status = 'cross_referencing';
        } else {
          job.status = 'fuzzy_matching';
        }
        jobs.log(job, job.status, jobs.stageMessage(stage), stage.error ? 'warning' : 'info');
      },
    });

    job.result = result;
    job.matchedCount = result.matches.length;
    job.totalMatchedValue = Math.round(result.matches.reduce((s, m) => s + (m.unclaimedAmount || 0), 0) * 100) / 100;
    job.confidenceScore = result.matches[0]?.score ?? 0;
    job.status = 'completed';
    job.progressPercent = 100;
    job.finishedAt = Date.now();

    if (result.meta.degraded && result.meta.degradedReason) {
      jobs.log(job, 'report_assembly', result.meta.degradedReason, 'warning');
    }
    jobs.log(job, 'completed',
      result.matches.length
        ? `Found ${result.matches.length} record${result.matches.length === 1 ? '' : 's'} for "${job.fullName}" (best match ${job.confidenceScore}%) in ${Date.now() - t0} ms.`
        : `No records matching "${job.fullName}" were found in ${Date.now() - t0} ms.`,
      'success');
    console.log(`[SEEKTRIX] ${job.id} completed: ${result.matches.length} matches, engine=${result.meta.engine}, ${Date.now() - t0} ms, degraded=${result.meta.degraded}`);
  } catch (err: any) {
    job.status = 'failed';
    job.error = String(err?.message || err);
    job.finishedAt = Date.now();
    jobs.log(job, 'failed', `The search could not be completed: ${job.error}`, 'warning');
    console.error(`[SEEKTRIX] ${job.id} failed:`, err);
  }
}

// ── SERVER ───────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));

  // CORS — needed when the frontend (e.g. Vercel) and this API (e.g. Render) are on
  // different origins. The API uses no cookies or sessions, so a permissive default is
  // safe; restrict with CORS_ORIGIN=https://app.example.com,https://www.example.com
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── HEALTH CHECK ──────────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const client = getSupabase();
    let dbStatus = 'not configured';
    if (client) {
      try {
        const { error } = await client.from('companies').select('id').limit(1);
        dbStatus = error ? `error: ${error.message}` : 'connected';
      } catch {
        dbStatus = 'unreachable';
      }
    }
    res.json({
      status: 'ok',
      engine: 'SEEKTRIX Node v4 (staged fuzzy search)',
      database: dbStatus,
      searchFunction: engine.searchFunctionStatus,
      tuning: TUNING,
    });
  });

  // ── TYPE-AHEAD SUGGESTIONS (debounced + cancellable on the client) ────────
  app.get('/api/suggest', rateLimit({ name: 'suggest', windowMs: 60_000, max: 60 }), async (req, res) => {
    const name = cleanText(req.query.name, 120);
    const state = cleanText(req.query.state, 40);
    if (name.length < 3 || !NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Type at least three letters of the name.' });
    }
    // If the browser cancels (user kept typing), stop the database work too.
    const ctrl = new AbortController();
    req.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
    try {
      // Count up to 50 potential matches (the UI shows the number); return only a few items.
      const result = await engine.search(name, { state, quick: true, limit: 50, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      res.json({
        query: name,
        state,
        total: result.matches.length,
        items: result.matches.slice(0, 8).map((m) => ({
          holderName: m.holderName,
          companyName: m.companyName,
          state: m.state,
          score: m.score,
          label: m.matchLabel,
        })),
        meta: {
          normalizedQuery: result.meta.normalizedQuery,
          tookMs: result.meta.tookMs,
          engine: result.meta.engine,
          degraded: result.meta.degraded,
          degradedReason: result.meta.degradedReason,
          fromCache: result.meta.fromCache,
        },
      });
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      res.status(500).json({ error: 'Suggestion lookup failed.', detail: String(err?.message || err) });
    }
  });

  // ── SUBMIT SEARCH ─────────────────────────────────────────────────────────
  app.post('/api/search', rateLimit({ name: 'search', windowMs: 60_000, max: 12 }), (req, res) => {
    const typedName = cleanText(req.body?.fullName, 120);
    const email = cleanText(req.body?.email, 200);
    const { city, state } = resolveState(cleanText(req.body?.state, 40), cleanText(req.body?.city, 80));

    // Name OR email is enough. State and city are optional narrowing ("advanced search").
    if (!typedName && !email) {
      return res.status(400).json({ error: 'Enter your full name or your email address to search. State and city are optional.' });
    }
    if (typedName && !NAME_RE.test(typedName)) {
      return res.status(400).json({ error: 'The name may only contain letters, spaces, dots, apostrophes and hyphens.' });
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    let fullName = typedName;
    let nameSource: 'typed' | 'email' = 'typed';
    if (!fullName) {
      // The registries hold names, folios and addresses — never email addresses — so an
      // email can only be searched through the name it contains ("ramesh.sen@…" → "ramesh sen").
      fullName = nameFromEmail(email);
      nameSource = 'email';
      if (!fullName) {
        return res.status(400).json({ error: 'We could not read a name from that email address. The registries store names, not emails, so please type the name you want to search.' });
      }
    }

    const job = jobs.create({ fullName, nameSource, city, state, email });
    // Fire and forget: the client polls /status, then fetches /matches.
    void runJob(job);
    res.status(201).json(jobs.publicView(job));
  });

  // ── STATUS POLL ───────────────────────────────────────────────────────────
  app.get('/api/search/:id/status', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Inquiry ID not found (the server may have restarted). Please run the search again.' });
    res.json(jobs.publicView(job));
  });

  // ── MATCHES FOR THE REPORT (served from the job cache — no second DB search) ──
  app.get('/api/search/:id/matches', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Search session not found (the server may have restarted). Please run the search again.' });
    if (job.status === 'failed') return res.status(500).json({ status: 'failed', error: job.error || 'Search failed.' });
    if (job.status !== 'completed' || !job.result) {
      return res.status(202).json({ status: 'running', progressPercent: job.progressPercent, step: job.status });
    }
    res.json({
      status: 'ready',
      id: job.id,
      query: { fullName: job.fullName, city: job.city, state: job.state },
      matches: job.result.matches.map((m, idx) => ({
        id: `MR-${job.id}-${idx}`,
        companyName: m.companyName,
        bseCode: '',
        holderName: m.holderName,
        matchedSimilarityScore: m.score,
        matchLabel: m.matchLabel,
        matchReasons: m.matchReasons,
        folioNumber: m.folioNumber || m.dpClientId,
        dpClientId: m.dpClientId,
        unclaimedAmount: m.unclaimedAmount,
        municipalRegion: m.fullAddress || m.state,
        disclosureSource: '',
        fatherName: m.fatherName,
        shares: m.shares,
        state: m.state,
        fullAddress: m.fullAddress,
        financialYear: m.financialYear,
        stateMatch: m.stateMatch,
      })),
      meta: job.result.meta,
    });
  });

  // ── VITE DEV / STATIC PROD ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SEEKTRIX] Server running at http://localhost:${PORT}`);
    console.log(`[SEEKTRIX] Supabase: ${process.env.VITE_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY) ? 'configured' : 'NOT configured (searches will return zero matches)'}`);
  });
}

startServer();
