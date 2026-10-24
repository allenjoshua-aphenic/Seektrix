/**
 * SEEKTRIX — deploy database/search_holders_v2.sql to the live Supabase project
 * and verify it, in one command. Uses whichever credential is available in .env:
 *
 *   DATABASE_URL           Postgres connection string (Dashboard → Connect → Session pooler URI)
 *   SUPABASE_ACCESS_TOKEN  Personal access token (Dashboard → Account → Access Tokens), used
 *                          with the Management API /v1/projects/{ref}/database/query
 *
 * Then verifies through the normal API (service-role key) that the function answers.
 *
 *   node scripts/deploy_search_function.mjs            # deploy + verify
 *   node scripts/deploy_search_function.mjs --verify   # verify only
 */
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ quiet: true });

const verifyOnly = process.argv.includes('--verify');
const sqlPath = path.resolve('database/search_holders_v2.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const rawUrl = process.env.VITE_SUPABASE_URL || '';
const base = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}.supabase.co`;
const ref = new URL(base).hostname.split('.')[0];
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const dbUrl = (process.env.DATABASE_URL || '').replace('postgresql+asyncpg', 'postgresql');
const pat = process.env.SUPABASE_ACCESS_TOKEN || '';

function log(s) { console.log(s); }

async function deployViaPostgres() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
  await client.connect();
  try {
    await client.query(sql);
    log('  deployed via direct Postgres connection');
    const idx = await client.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'unclaimed_holders' AND indexdef ILIKE '%gin_trgm_ops%'`);
    log(`  trigram index present: ${idx.rows.length ? idx.rows.map((r) => r.indexname).join(', ') : 'NO — create it: CREATE INDEX idx_holders_name_trgm ON unclaimed_holders USING gin (lower(full_name) gin_trgm_ops);'}`);
  } finally {
    await client.end();
  }
}

async function deployViaManagementApi() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Management API HTTP ${r.status}: ${text.slice(0, 300)}`);
  log('  deployed via Supabase Management API');
}

async function verify() {
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — cannot verify through the API');
  const sb = createClient(base, serviceKey, { auth: { persistSession: false } });
  const cases = [
    ['qzxjvw', '', 'word', 0.8, 'nonsense → 0 rows, fast'],
    ['rakesh kumar', 'delhi', 'word', 0.8, 'common name, state-first'],
    ['rakesh kumar', '', 'word', 0.8, 'common name, all India'],
    ['rakes kumr', '', 'similar', 0.45, 'typo tolerant'],
    ['lakshmi', '', 'word', 0.8, 'single common word'],
    ['rak', 'delhi', 'prefix', 0.8, 'type-ahead prefix'],
  ];
  let ok = true;
  for (const [name, state, mode, threshold, label] of cases) {
    const t0 = Date.now();
    const { data, error } = await sb.rpc('search_holders_v2', { search_name: name, search_state: state, mode, threshold, max_rows: 200, name_pattern: null });
    const ms = Date.now() - t0;
    if (error) { ok = false; log(`  FAIL ${label.padEnd(28)} "${name}" → ${error.message} (${ms} ms)`); continue; }
    log(`  ok   ${label.padEnd(28)} "${name}" → ${String(data.length).padStart(3)} rows in ${String(ms).padStart(5)} ms${data[0] ? `   e.g. ${data[0].full_name}` : ''}`);
  }
  return ok;
}

(async () => {
  log(`\nSEEKTRIX search function deploy → project ${ref}\n`);
  if (!verifyOnly) {
    if (dbUrl && !/localhost|127\.0\.0\.1/.test(dbUrl)) {
      await deployViaPostgres();
    } else if (pat) {
      await deployViaManagementApi();
    } else {
      log('  No credential able to run SQL was found in .env.');
      log('  Add ONE of these to .env and re-run:');
      log('    DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres');
      log('    SUPABASE_ACCESS_TOKEN=sbp_...');
      log('  Or paste database/search_holders_v2.sql into the Supabase SQL Editor and run:');
      log('    node scripts/deploy_search_function.mjs --verify');
      process.exit(2);
    }
  }
  log('\nVerifying through the API:');
  const ok = await verify();
  log(ok ? '\nsearch_holders_v2 is LIVE.\n' : '\nsearch_holders_v2 is NOT working — see errors above.\n');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('\n' + (e.message || e)); process.exit(1); });
