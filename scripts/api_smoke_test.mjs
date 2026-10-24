/**
 * SEEKTRIX — API smoke test. Run against a running server:
 *   node scripts/api_smoke_test.mjs                 # http://localhost:3000
 *   node scripts/api_smoke_test.mjs https://host    # any deployment
 *
 * Prints PASS / FAIL per case and exits non-zero on any failure.
 * Uses a distinctive name (THIRUVENGADAM) so it passes even before
 * database/search_holders_v2.sql is deployed; the final case reports which
 * search function is live.
 */
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
let failures = 0;
const results = [];

async function call(method, path, body) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json, ms: Date.now() - t0 };
}

async function check(label, fn) {
  try {
    const note = await fn();
    results.push(['PASS', label, note || '']);
  } catch (e) {
    failures++;
    results.push(['FAIL', label, e.message]);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function waitForJob(id, maxSeconds = 30) {
  for (let i = 0; i < maxSeconds; i++) {
    const r = await call('GET', `/api/search/${id}/status`);
    if (r.json?.status === 'completed' || r.json?.status === 'failed') return r.json;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`job ${id} did not finish within ${maxSeconds}s`);
}

console.log(`\nSEEKTRIX API smoke test → ${BASE}\n`);

let engineSeen = 'unknown';

await check('health: server up and database connected', async () => {
  const r = await call('GET', '/api/health');
  assert(r.status === 200 && r.json?.status === 'ok', `HTTP ${r.status}`);
  assert(r.json.database === 'connected', `database = ${r.json.database}`);
  return `${r.ms} ms`;
});

await check('suggest: rejects fewer than 3 letters', async () => {
  const r = await call('GET', '/api/suggest?name=ra');
  assert(r.status === 400, `expected 400, got ${r.status}`);
});

await check('suggest: distinctive name returns records', async () => {
  const r = await call('GET', '/api/suggest?name=thiruvengadam&state=Tamil%20Nadu');
  assert(r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  assert(r.json.total >= 1, 'no items');
  assert(/THIRUVENGADAM/i.test(r.json.items[0].holderName), `first item ${r.json.items[0].holderName}`);
  engineSeen = r.json.meta.engine;
  return `${r.json.total} items, ${r.json.meta.tookMs} ms, engine ${r.json.meta.engine}`;
});

await check('search: empty form is refused with a helpful message', async () => {
  const r = await call('POST', '/api/search', { fullName: '', email: '', city: '', state: '' });
  assert(r.status === 400 && /full name or your email/i.test(r.json?.error || ''), `${r.status} ${JSON.stringify(r.json)}`);
});

await check('search: malformed email is refused', async () => {
  const r = await call('POST', '/api/search', { fullName: '', email: 'nope' });
  assert(r.status === 400, `expected 400, got ${r.status}`);
});

await check('search: name with digits/HTML is refused', async () => {
  const r = await call('POST', '/api/search', { fullName: '<b>Rakesh</b> 123', email: 'a@b.co' });
  assert(r.status === 400, `expected 400, got ${r.status}`);
});

await check('search: email with nothing name-like is refused', async () => {
  const r = await call('POST', '/api/search', { fullName: '', email: 'abc123@gmail.com' });
  assert(r.status === 400 && /could not read a name/i.test(r.json?.error || ''), `${r.status} ${JSON.stringify(r.json)}`);
});

await check('search: email only → name derived from the address', async () => {
  const r = await call('POST', '/api/search', { fullName: '', email: 'ramesh.sen@outlook.com' });
  assert(r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  assert(r.json.fullName === 'ramesh sen', `fullName = ${r.json.fullName}`);
  assert(r.json.nameSource === 'email', `nameSource = ${r.json.nameSource}`);
  assert(r.json.logs.some((l) => l.status === 'warning' && /read from the email/i.test(l.message)), 'no warning log about the derived name');
  return `job ${r.json.id}`;
});

let jobId = null;
await check('search: name only (no email/state/city) is accepted and completes', async () => {
  const r = await call('POST', '/api/search', { fullName: 'Thiruvengadam' });
  assert(r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  jobId = r.json.id;
  assert(r.json.state === '' && r.json.email === '', 'state/email should be empty');
  const job = await waitForJob(jobId);
  assert(job.status === 'completed', `status ${job.status}`);
  assert(job.matchedCount >= 1, `matchedCount ${job.matchedCount}`);
  assert(job.confidenceScore >= 90, `confidence ${job.confidenceScore}`);
  assert(/across all of India/i.test(job.logs[0].message), `first log: ${job.logs[0].message}`);
  engineSeen = job.engine || engineSeen;
  return `${job.matchedCount} matches, best ${job.confidenceScore}%, engine ${job.engine}`;
});

await check('matches: ranked rows with score + reasons, served from cache', async () => {
  assert(jobId, 'no job from previous case');
  const r1 = await call('GET', `/api/search/${jobId}/matches`);
  assert(r1.status === 200 && r1.json.status === 'ready', `HTTP ${r1.status} ${r1.json?.status}`);
  assert(r1.json.matches.length >= 1, 'no matches');
  const m = r1.json.matches[0];
  assert(typeof m.matchedSimilarityScore === 'number' && m.matchReasons.length > 0, 'missing score/reasons');
  assert(m.holderName && m.companyName, 'missing holder/company');
  const r2 = await call('GET', `/api/search/${jobId}/matches`);
  assert(r2.ms < 1500, `second fetch took ${r2.ms} ms (should be served from the job cache)`);
  return `${r1.json.matches.length} rows; top ${m.matchedSimilarityScore}% ${m.matchLabel} "${m.holderName}"; 2nd fetch ${r2.ms} ms`;
});

await check('search: name + state runs as an advanced (state-first) search', async () => {
  const r = await call('POST', '/api/search', { fullName: 'Thiruvengadam', state: 'Tamil Nadu', city: 'Vellore' });
  assert(r.status === 201, `HTTP ${r.status}`);
  assert(/advanced/i.test(r.json.logs[0].message), `first log: ${r.json.logs[0].message}`);
  const job = await waitForJob(r.json.id);
  assert(job.status === 'completed' && job.matchedCount >= 1, `status ${job.status}, ${job.matchedCount} matches`);
  return `${job.matchedCount} matches`;
});

await check('status: unknown job id → 404', async () => {
  const r = await call('GET', '/api/search/REQ-NOPE/status');
  assert(r.status === 404, `expected 404, got ${r.status}`);
});

await check('matches: unknown job id → 404', async () => {
  const r = await call('GET', '/api/search/REQ-NOPE/matches');
  assert(r.status === 404, `expected 404, got ${r.status}`);
});

await check('search: common name never fabricates (completes, degraded flag honest)', async () => {
  const r = await call('POST', '/api/search', { fullName: 'Rakesh Kumar', state: 'Delhi' });
  assert(r.status === 201, `HTTP ${r.status}`);
  const job = await waitForJob(r.json.id, 40);
  assert(job.status === 'completed', `status ${job.status}`);
  const m = await call('GET', `/api/search/${r.json.id}/matches`);
  assert(m.json.matches.length === job.matchedCount, 'matches/count mismatch');
  for (const row of m.json.matches) assert(/kumar/i.test(row.holderName) || /rakesh/i.test(row.holderName), `unrelated row ${row.holderName}`);
  return `${job.matchedCount} matches, engine ${job.engine}, degraded=${job.degraded}`;
});

await check('rate limit: a burst of searches is throttled with 429', async () => {
  let got429 = false;
  for (let i = 0; i < 14 && !got429; i++) {
    const r = await call('POST', '/api/search', { fullName: 'Burst Test Person' });
    if (r.status === 429) got429 = true;
  }
  assert(got429, 'no 429 after 14 rapid searches');
  return 'throttled (limit resets after 60 s)';
});

console.log(results.map(([s, l, n]) => `  ${s === 'PASS' ? 'PASS' : 'FAIL'}  ${l}${n ? `\n        ${n}` : ''}`).join('\n'));
console.log(`\nSearch function live on the server: ${engineSeen === 'v2' ? 'v2 (search_holders_v2 deployed)' : engineSeen === 'v1-fallback' ? 'v1 fallback — deploy database/search_holders_v2.sql in the Supabase SQL Editor' : engineSeen}`);
console.log(`\n${failures ? failures + ' CASE(S) FAILED' : 'ALL CASES PASSED'}\n`);
process.exit(failures ? 1 : 0);
