/**
 * SEEKTRIX — real-browser UI test (headless Chromium via Playwright).
 *
 * Playwright is NOT a project dependency (its browser download is ~150 MB).
 * One-time setup in any folder, e.g. the repo root:
 *     npm install --no-save playwright@1.49.1
 *     npx playwright install chromium
 * Then, with `npm run dev` running:
 *     node scripts/ui_browser_test.mjs            # http://localhost:3000
 *     node scripts/ui_browser_test.mjs https://host
 *
 * Covers: landing load, type-ahead (count only / hidden when empty), field
 * rules, name-only search through progress to results, browser Back/Forward
 * staying inside the app, email-only search, optional state, console errors.
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

const results = [];
let failures = 0;
async function check(label, fn) {
  try { const note = await fn(); results.push(['PASS', label, note || '']); }
  catch (e) { failures++; results.push(['FAIL', label, String(e.message || e).split('\n')[0]]); }
}
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

await check('landing page loads', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#hero-input-fullname', { timeout: 30000 });
  return page.url();
});

await check('no preview panel before typing', async () => {
  if (await page.locator('#hero-live-preview').count()) throw new Error('preview visible with empty name');
});

await check('type-ahead shows only a COUNT for a real name', async () => {
  await page.fill('#hero-input-fullname', 'Thiruvengadam');
  await page.waitForSelector('#hero-live-preview', { timeout: 20000 });
  const text = clean(await page.textContent('#hero-live-preview'));
  if (!/potential match/.test(text)) throw new Error(text);
  if (/LIC Housing|THIRUVENGADAM S/.test(text)) throw new Error('panel lists names: ' + text);
  return text;
});

await check('type-ahead shows NOTHING for a name with no matches', async () => {
  await page.fill('#hero-input-fullname', 'qzxjvw');
  await page.waitForSelector('#hero-live-preview', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(3000);
  if (await page.locator('#hero-live-preview').count()) throw new Error('preview visible for nonsense name');
});

await check('empty submit shows the field-rule message inline', async () => {
  await page.fill('#hero-input-fullname', '');
  await page.click('#hero-start-search-btn');
  const msg = clean(await page.textContent('#form-error-msg'));
  if (!/full name or your email/i.test(msg)) throw new Error(msg);
  return msg;
});

await check('name-only search → progress page → results table with scores', async () => {
  await page.fill('#hero-input-fullname', 'Thiruvengadam');
  await page.click('#hero-start-search-btn');
  await page.waitForSelector('text=Searching Unclaimed Asset Registries', { timeout: 20000 });
  await page.waitForSelector('text=View Matching Results', { timeout: 60000 });
  await page.click('text=View Matching Results');
  await page.waitForSelector('#results-data-table tbody tr', { timeout: 30000 });
  await page.waitForSelector('#search-meta-banner', { timeout: 30000 });
  const rows = await page.locator('#results-data-table tbody tr').count();
  const first = clean(await page.locator('#results-data-table tbody tr').first().textContent());
  if (!/\d+% (strong|likely|possible)/i.test(first)) throw new Error('no score badge: ' + first.slice(0, 120));
  return `${rows} rows; first: ${first.slice(0, 110)}`;
});

await check('browser BACK from results → landing page, still inside the app', async () => {
  await page.goBack();
  await page.waitForSelector('#hero-input-fullname', { timeout: 15000 });
  if (!page.url().startsWith(BASE)) throw new Error('left the app: ' + page.url());
  return page.url();
});

await check('browser FORWARD → results again', async () => {
  await page.goForward();
  await page.waitForSelector('#results-data-table', { timeout: 15000 });
});

await check('BACK from the progress page (search still running) → landing page', async () => {
  await page.goBack();
  await page.waitForSelector('#hero-input-fullname', { timeout: 15000 });
  await page.fill('#hero-input-fullname', 'Venkatesan');
  await page.click('#hero-start-search-btn');
  await page.waitForSelector('text=Searching Unclaimed Asset Registries', { timeout: 20000 });
  await page.goBack();
  await page.waitForSelector('#hero-input-fullname', { timeout: 15000 });
  if (!page.url().startsWith(BASE)) throw new Error('left the app: ' + page.url());
});

await check('email-only: note under the form + search uses the derived name', async () => {
  await page.fill('#hero-input-fullname', '');
  await page.fill('#hero-input-email', 'ramesh.sen@outlook.com');
  const rules = clean(await page.textContent('#hero-field-rules'));
  if (!/read the name from your email/i.test(rules)) throw new Error(rules);
  await page.click('#hero-start-search-btn');
  await page.waitForSelector('text=ramesh sen', { timeout: 20000 });
  return 'progress page shows "ramesh sen"';
});

await check('state dropdown is optional (no browser "required" block)', async () => {
  await page.goBack();
  await page.waitForSelector('#hero-input-fullname', { timeout: 15000 });
  const required = await page.$eval('#hero-select-state', (el) => el.required);
  if (required) throw new Error('state select still required');
});

await check('no uncaught page errors during the run', async () => {
  const real = pageErrors.filter((e) => !/favicon|ResizeObserver/i.test(e));
  if (real.length) throw new Error(real.slice(0, 3).join(' | '));
});

await browser.close();
console.log('\nSEEKTRIX browser UI test → ' + BASE + '\n');
console.log(results.map(([s, l, n]) => `  ${s}  ${l}${n ? `\n        ${n}` : ''}`).join('\n'));
console.log(`\n${failures ? failures + ' CASE(S) FAILED' : 'ALL CASES PASSED'}\n`);
process.exit(failures ? 1 : 0);
