/**
 * Drive the real SearchEngine against a LOCAL Postgres that has
 * database/search_holders_v2.sql deployed (see the docker test setup), by
 * wrapping `pg` in the tiny slice of the supabase-js interface the engine
 * uses: client.rpc(fn, args).abortSignal(signal) → { data, error }.
 *
 *   PGTEST_URL=postgres://postgres@localhost:55432/postgres npx tsx scripts/engine_local_e2e.ts
 */
import pg from 'pg';
import { SearchEngine } from '../server/search/engine';

const url = process.env.PGTEST_URL || 'postgres://postgres@localhost:55432/postgres';
const pool = new pg.Pool({ connectionString: url, max: 4 });

function fakeSupabase(): any {
  return {
    rpc(fn: string, args: Record<string, unknown>) {
      let signal: AbortSignal | undefined;
      const builder: any = {
        abortSignal(s: AbortSignal) { signal = s; return builder; },
        then(resolve: (v: any) => void) {
          const names = Object.keys(args);
          const sql = `SELECT * FROM ${fn}(${names.map((n, i) => `${n} := $${i + 1}`).join(', ')})`;
          const client$ = pool.connect();
          const run = async () => {
            const c = await client$;
            const onAbort = () => { void pool.query(`SELECT pg_cancel_backend(${(c as any).processID})`); };
            signal?.addEventListener('abort', onAbort, { once: true });
            try {
              const r = await c.query(sql, Object.values(args));
              return { data: r.rows, error: null };
            } catch (e: any) {
              return { data: null, error: { message: e.message, code: e.code } };
            } finally {
              signal?.removeEventListener('abort', onAbort);
              c.release();
            }
          };
          run().then(resolve);
        },
      };
      return builder;
    },
  };
}

async function main() {
  const engine = new SearchEngine(fakeSupabase);
  const cases: Array<[string, string]> = [
    ['Rakesh Kumar', 'Delhi'],
    ['Rakesh Kumar Gupta', 'Delhi'],
    ['rakes kumr gupta', 'Delhi'],
    ['R K Sharma', 'Delhi'],
    ['Shri Rakesh Kr. Sharma', ''],
    ['Mohamed Ali', 'Kerala'],
    ['Laxmi Narayanan', 'Tamil Nadu'],
    ['Thiruvengadam', ''],
    ['Venkatesan R', 'Tamil Nadu'],
    ['qzxjvw nobody', ''],
    ['R K', 'Delhi'],
  ];
  for (const [name, state] of cases) {
    const r = await engine.search(name, { state, limit: 5 });
    console.log(`\n"${name}"${state ? ' / ' + state : ''}  →  ${r.matches.length} shown of ${r.meta.totalCandidates} candidates, ${r.meta.tookMs} ms, engine=${r.meta.engine}${r.meta.degraded ? ', DEGRADED: ' + r.meta.degradedReason : ''}`);
    for (const s of r.meta.stages) console.log(`   stage ${s.name.padEnd(36)} ${String(s.rows).padStart(4)} rows ${String(s.ms).padStart(5)} ms${s.error ? '  ' + s.error : ''}`);
    for (const m of r.matches) console.log(`   ${String(m.score).padStart(3)}% ${m.matchLabel.padEnd(8)} ${m.holderName.padEnd(28)} ${m.state.padEnd(14)} ${m.matchReasons.slice(0, 3).join(' · ')}`);
  }
  // quick / suggest mode
  for (const [qn, qs] of [['rakesh ku', 'Delhi'], ['rak', 'Delhi'], ['ven', ''], ['rakesh k', '']] as Array<[string, string]>) {
    const q = await engine.search(qn, { state: qs, quick: true, limit: 8 });
    console.log(`\nQUICK "${qn}"${qs ? ' / ' + qs : ''} → ${q.matches.length} items in ${q.meta.tookMs} ms (${q.meta.stages.map((s) => s.name + ':' + s.rows + '/' + s.ms + 'ms').join(', ')})`);
    for (const m of q.matches.slice(0, 5)) console.log(`   ${m.score}% ${m.holderName}`);
  }
  // cache hit
  const again = await engine.search('Rakesh Kumar', { state: 'Delhi', limit: 5 });
  console.log(`\nCACHE "Rakesh Kumar" / Delhi again → fromCache=${again.meta.fromCache}, ${again.meta.tookMs} ms`);
  // abort behaviour
  const ctrl = new AbortController();
  const p = engine.search('Mohammed Ali', { state: '', limit: 5, signal: ctrl.signal });
  ctrl.abort();
  const aborted = await p;
  console.log(`ABORT → ${aborted.matches.length} matches, degraded=${aborted.meta.degraded}, stages=${aborted.meta.stages.map((s) => s.error || 'ok').join(',')}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
