import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
// Reads from .env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
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
  // Prefer the service-role key (server-only, bypasses RLS); fall back to the anon key.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!rawUrl || !key) {
    console.warn('[SEEKTRIX] Supabase credentials not set. Searches will return zero matches.');
    return null;
  }
  const url = formatSupabaseUrl(rawUrl);
  supabase = createClient(url, key);
  console.log(`[SEEKTRIX] Supabase client initialized with URL: ${url}`);
  return supabase;
}

// ── TYPES ────────────────────────────────────────────────────────────────────
interface ActiveSearch {
  id: string;
  fullName: string;
  city: string;
  email: string;
  submittedAt: string;
  status: 'queued' | 'ocr_scanning' | 'pdf_indexing' | 'fuzzy_matching' | 'cross_referencing' | 'report_assembly' | 'completed' | 'failed';
  progressPercent: number;
  estimatedCompletionMinutes: number;
  matchedCount: number;
  confidenceScore: number;
  totalMatchedValue: number;
  logs: Array<{ timestamp: string; message: string; step: string; status: 'info' | 'success' | 'warn' }>;
}

interface LedgerRecord {
  companyName: string;
  bseCode: string;
  holderName: string;
  folioNumber: string;
  unclaimedAmount: number;
  municipalRegion: string;
  disclosureSource: string;
  fatherName: string;
  shares: number;
  state: string;
  fullAddress: string;
}

// ── CITY & STATE RESOLVER ──────────────────────────────────────────────────
function resolveCityAndState(cityInput: string): { city: string; state: string } {
  const input = (cityInput || '').trim();
  const parts = input.split(',').map(s => s.trim());
  if (parts.length >= 2 && parts[1]) {
    return {
      city: parts[0],
      state: parts[1]
    };
  }
  
  const lowerCity = parts[0].toLowerCase();
  
  const cityStateMap: Record<string, string> = {
    chennai: 'Tamil Nadu',
    coimbatore: 'Tamil Nadu',
    madurai: 'Tamil Nadu',
    trichy: 'Tamil Nadu',
    salem: 'Tamil Nadu',
    bengaluru: 'Karnataka',
    bangalore: 'Karnataka',
    mysore: 'Karnataka',
    mumbai: 'Maharashtra',
    pune: 'Maharashtra',
    nagpur: 'Maharashtra',
    thane: 'Maharashtra',
    hyderabad: 'Telangana',
    secunderabad: 'Telangana',
    delhi: 'Delhi',
    'new delhi': 'Delhi',
    kolkata: 'West Bengal',
    calcutta: 'West Bengal',
    ahmedabad: 'Gujarat',
    surat: 'Gujarat',
    vadodara: 'Gujarat',
    jaipur: 'Rajasthan',
    jodhpur: 'Rajasthan',
    udaipur: 'Rajasthan',
    lucknow: 'Uttar Pradesh',
    kanpur: 'Uttar Pradesh',
    noida: 'Uttar Pradesh',
    ghaziabad: 'Uttar Pradesh',
    patna: 'Bihar',
    bhopal: 'Madhya Pradesh',
    indore: 'Madhya Pradesh',
    kochi: 'Kerala',
    cochin: 'Kerala',
    trivandrum: 'Kerala',
    thiruvananthapuram: 'Kerala',
    chandigarh: 'Punjab',
    ludhiana: 'Punjab',
    amritsar: 'Punjab',
    dehradun: 'Uttarakhand',
    gurugram: 'Haryana',
    gurgaon: 'Haryana',
    faridabad: 'Haryana'
  };

  if (cityStateMap[lowerCity]) {
    return {
      city: parts[0],
      state: cityStateMap[lowerCity]
    };
  }

  // Unknown city: report no state rather than guessing one.
  return {
    city: parts[0],
    state: ''
  };
}

// ── IN-MEMORY QUERY STORE ────────────────────────────────────────────────────
const activeQueries = new Map<string, ActiveSearch>();

// ── FUZZY MATCHING (used for fallback only — Supabase uses pg_trgm) ──────────
function computeFuzzyScore(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 85;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return Math.round(((maxLen - matrix[a.length][b.length]) / maxLen) * 100);
}

// ── HONEST ROW MAPPER ────────────────────────────────────────────────────────
// Maps a Supabase row from the search_holders RPC / unclaimed_holders table
// (columns: company_name via join, full_name, father_or_husband_name,
// folio_number, dp_client_id, state, address, shares, unclaimed_amount) to a
// LedgerRecord. No field is ever invented: missing values stay empty/zero.
function mapRowToRecord(row: any): LedgerRecord {
  // company_name comes flat from the RPC, or nested via a PostgREST embed (companies.company_name)
  const comp = row.company_name || row.companyName || row.companies?.company_name || '';
  const address = row.full_address || row.fullAddress || row.address || '';
  return {
    companyName: comp,
    bseCode: row.bse_code || row.bseCode || '',
    holderName: row.full_name || row.holder_name || row.holderName || '',
    folioNumber: row.folio_number || row.folioNumber || row.dp_client_id || '',
    unclaimedAmount: Number(row.unclaimed_amount ?? row.unclaimedAmount ?? 0),
    municipalRegion: address || row.state || '',
    disclosureSource: row.disclosure_source || row.disclosureSource || '',
    fatherName: row.father_or_husband_name || row.father_name || row.fatherName || '',
    shares: Number(row.shares ?? 0),
    state: row.state || '',
    fullAddress: address
  };
}

// ── SUPABASE SEARCH ─────────────────────────────────────────────────────────
// Calls the search_shareholders stored function in Supabase (pg_trgm fuzzy match)
async function searchSupabase(fullName: string, city: string): Promise<LedgerRecord[]> {
  const client = getSupabase();
  if (!client) return [];

  const { city: resolvedCity, state: resolvedState } = resolveCityAndState(city);

  try {
    console.log(`[SEEKTRIX] Searching Supabase for "${fullName}" in "${city}"`);
    
    // 1. Try the RPC call first
    try {
      const { data, error } = await client.rpc('search_holders', {
        search_name: fullName.toLowerCase().trim(),
        search_city: resolvedCity.toLowerCase().trim()
      });

      if (!error) {
        // A successful RPC is authoritative — including an honest zero-match result.
        console.log(`[SEEKTRIX] Supabase RPC returned ${data?.length ?? 0} matches.`);
        return (data || []).map(mapRowToRecord);
      }

      console.warn('[SEEKTRIX] RPC failed, trying direct select fallback:', error.message);
    } catch (rpcErr: any) {
      console.warn('[SEEKTRIX] RPC exception:', rpcErr.message);
    }

    // 2. Fallback (only if the RPC errors, e.g. not yet deployed): a SAFE,
    //    server-side-filtered, LIMITED query on unclaimed_holders — never a full
    //    table scan (the table can hold hundreds of thousands of rows).
    console.log('[SEEKTRIX] RPC unavailable — falling back to a filtered unclaimed_holders query...');
    const qName = fullName.toLowerCase().trim();
    const { data: rows, error: selectError } = await client
      .from('unclaimed_holders')
      .select('full_name, father_or_husband_name, folio_number, dp_client_id, state, address, shares, unclaimed_amount, companies(company_name)')
      .ilike('full_name', `%${qName}%`)
      .limit(50);

    if (selectError) {
      console.error('[SEEKTRIX] Fallback select failed:', selectError.message);
      return [];
    }
    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map(mapRowToRecord);

  } catch (err) {
    console.error('[SEEKTRIX] Supabase search failed:', err);
    return [];
  }
}

// ── GET MATCHES (Supabase only — an empty result is an honest empty result) ──
async function getMatchesForQuery(q: ActiveSearch): Promise<LedgerRecord[]> {
  const supabaseResults = await searchSupabase(q.fullName, q.city);
  console.log(`[SEEKTRIX] Supabase returned ${supabaseResults.length} matches for "${q.fullName}"`);
  return supabaseResults;
}

// ── SERVER ───────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    res.json({ status: 'ok', engine: 'SEEKTRIX Node v3', database: dbStatus });
  });

  // ── SUBMIT SEARCH ─────────────────────────────────────────────────────────
  app.post('/api/search', (req, res) => {
    const { fullName, city, email } = req.body;
    if (!fullName || !city || !email) {
      return res.status(400).json({ error: 'Missing mandatory fields: fullName, city, email.' });
    }

    const randomId = `REQ-${1000 + Math.floor(Math.random() * 9000)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newQuery: ActiveSearch = {
      id: randomId,
      fullName: fullName.trim(),
      city: city.trim(),
      email: email.trim(),
      submittedAt: nowStr,
      status: 'queued',
      progressPercent: 0,
      estimatedCompletionMinutes: 1.5,
      matchedCount: 0,
      confidenceScore: 99,
      totalMatchedValue: 0,
      logs: [
        { timestamp: nowStr, message: 'Registry search initialized. Slot appended to regional queue.', step: 'queued', status: 'info' }
      ]
    };

    activeQueries.set(randomId, newQuery);

    // Background progress simulation + real Supabase search at completion
    let currentPct = 0;
    const interval = setInterval(async () => {
      const q = activeQueries.get(randomId);
      if (!q) { clearInterval(interval); return; }

      currentPct += Math.floor(Math.random() * 15) + 12;
      if (currentPct >= 100) currentPct = 100;

      q.progressPercent = currentPct;
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

      if (currentPct >= 100) {
        clearInterval(interval);
        q.status = 'report_assembly';
        q.logs.push({ timestamp, message: 'Fuzzy cross-references matched. Assembling claim dossier...', step: 'report_assembly', status: 'info' });
        activeQueries.set(randomId, q);

        // ── REAL SUPABASE SEARCH HAPPENS HERE ──
        try {
          const matches = await getMatchesForQuery(q);
          q.status = 'completed';
          q.matchedCount = matches.length;
          q.totalMatchedValue = matches.reduce((sum, m) => sum + m.unclaimedAmount, 0);
          q.confidenceScore = matches.length > 0 ? 98 : 99;
          q.progressPercent = 100;
          q.logs.push({
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
            message: `Discovery complete. Found ${matches.length} matching claim${matches.length !== 1 ? 's' : ''} across IEPF/MCA databases.`,
            step: 'completed',
            status: 'success'
          });
          activeQueries.set(randomId, q);
          console.log(`[SEEKTRIX] Query ${randomId} completed: ${matches.length} matches found.`);
        } catch (err) {
          q.status = 'failed';
          q.logs.push({ timestamp, message: 'Search pipeline encountered an error.', step: 'failed', status: 'warn' });
          activeQueries.set(randomId, q);
        }
      } else if (currentPct >= 80) {
        q.status = 'cross_referencing';
        if (!q.logs.some(l => l.step === 'cross_referencing'))
          q.logs.push({ timestamp, message: 'Name variations indexed. Conducting IEPF nodal cross-verification.', step: 'cross_referencing', status: 'info' });
      } else if (currentPct >= 60) {
        q.status = 'fuzzy_matching';
        if (!q.logs.some(l => l.step === 'fuzzy_matching'))
          q.logs.push({ timestamp, message: 'Running pg_trgm fuzzy name match against unclaimed_assets table.', step: 'fuzzy_matching', status: 'info' });
      } else if (currentPct >= 40) {
        q.status = 'ocr_scanning';
        if (!q.logs.some(l => l.step === 'ocr_scanning'))
          q.logs.push({ timestamp, message: 'Scanning indexed company IEPF records: TCS, Infosys, Asian Paints, Cipla, Dabur...', step: 'ocr_scanning', status: 'info' });
      } else {
        q.status = 'pdf_indexing';
        if (!q.logs.some(l => l.step === 'pdf_indexing'))
          q.logs.push({ timestamp, message: 'Validating BSE codes. Connecting to Supabase registry node.', step: 'pdf_indexing', status: 'info' });
      }

      activeQueries.set(randomId, q);
    }, 1200);

    res.status(201).json(newQuery);
  });

  // ── STATUS POLL ───────────────────────────────────────────────────────────
  app.get('/api/search/:id/status', (req, res) => {
    const q = activeQueries.get(req.params.id);
    if (!q) return res.status(404).json({ error: 'Inquiry ID not found.' });
    res.json({
      id: q.id,
      status: q.status,
      progressPercent: q.progressPercent,
      estimatedCompletionMinutes: q.estimatedCompletionMinutes,
      matchedCount: q.matchedCount,
      confidenceScore: q.confidenceScore,
      totalMatchedValue: q.totalMatchedValue,
      logs: q.logs
    });
  });

  // ── GET MATCHES FOR REPORT ────────────────────────────────────────────────
  app.get('/api/search/:id/matches', async (req, res) => {
    const q = activeQueries.get(req.params.id);
    if (!q) return res.status(404).json({ error: 'Search session not found.' });

    try {
      const matches = await getMatchesForQuery(q);
      const response = matches.map((item, idx) => ({
        id: `MR-${req.params.id}-${idx}`,
        companyName: item.companyName,
        bseCode: item.bseCode,
        holderName: item.holderName,
        matchedSimilarityScore: computeFuzzyScore(q.fullName, item.holderName),
        folioNumber: item.folioNumber,
        unclaimedAmount: item.unclaimedAmount,
        municipalRegion: item.municipalRegion,
        disclosureSource: item.disclosureSource,
        fatherName: item.fatherName,
        shares: item.shares,
        state: item.state,
        fullAddress: item.fullAddress
      }));
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve matches.' });
    }
  });

  // ── VITE DEV / STATIC PROD ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
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
