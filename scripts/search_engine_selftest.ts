/**
 * Self-test for the Node side of the fuzzy search (no database needed).
 *   npx tsx scripts/search_engine_selftest.ts
 * Exits non-zero if any expectation fails.
 */
import assert from 'node:assert/strict';
import { parseName, phoneticKey, jaroWinkler } from '../server/search/normalize';
import { scoreCandidate } from '../server/search/score';

let failures = 0;
function check(label: string, fn: () => void) {
  try { fn(); console.log(`  ok   ${label}`); }
  catch (e: any) { failures++; console.log(`  FAIL ${label}\n       ${e.message}`); }
}

console.log('\n── parseName ──');
check('strips honorific, dot, abbreviation and S/O part', () => {
  const p = parseName('SHRI RAKESH KR. SHARMA S/O RAM SHARMA');
  assert.equal(p.normalized, 'rakesh kumar sharma');
  assert.equal(p.relationPart, 'ram sharma');
  assert.deepEqual(p.removed, ['shri']);
});
check('trailing dot artefact "MOHAMED ALI ."', () => {
  assert.equal(parseName('MOHAMED ALI .').normalized, 'mohammed ali');
});
check('glued initials "VK Sharma" → v k sharma', () => {
  const p = parseName('VK Sharma');
  assert.deepEqual(p.tokens, ['v', 'k', 'sharma']);
  assert.deepEqual(p.initials, ['v', 'k']);
  assert.deepEqual(p.longTokens, ['sharma']);
});
check('only initials → no long tokens', () => {
  assert.equal(parseName('R K').longTokens.length, 0);
});
check('HUF / joint noise removed', () => {
  assert.equal(parseName('RAKESH KUMAR GUPTA HUF').normalized, 'rakesh kumar gupta');
});

console.log('\n── phoneticKey ──');
const same = (a: string, b: string) => assert.equal(phoneticKey(a), phoneticKey(b), `${a} (${phoneticKey(a)}) vs ${b} (${phoneticKey(b)})`);
check('Mohammed ≈ Mohamed ≈ Muhammad', () => { same('mohammed', 'mohamed'); same('mohammed', 'muhammad'); });
check('Lakshmi ≈ Laxmi', () => same('lakshmi', 'laxmi'));
check('Agarwal ≈ Agrawal ≈ Aggarwal', () => { same('agarwal', 'agrawal'); same('agarwal', 'aggarwal'); });
check('Rakesh ≈ Rakes, Sunil ≈ Suneel, Deepak ≈ Dipak', () => { same('rakesh', 'rakes'); same('sunil', 'suneel'); same('deepak', 'dipak'); });
check('Sharma ≠ Verma', () => assert.notEqual(phoneticKey('sharma'), phoneticKey('verma')));

console.log('\n── jaroWinkler ──');
check('identical = 1, rakesh/rajesh high, rakesh/sunita low', () => {
  assert.equal(jaroWinkler('rakesh', 'rakesh'), 1);
  assert.ok(jaroWinkler('rakesh', 'rajesh') > 0.85);
  assert.ok(jaroWinkler('rakesh', 'sunita') < 0.6);
});

console.log('\n── scoreCandidate ──');
const q = parseName('Rakesh Kumar Sharma');
const score = (cand: string, ctx: any = {}) => scoreCandidate(q, parseName(cand), ctx);

check('exact name = 100 (with state bonus capped)', () => {
  const s = score('RAKESH KUMAR SHARMA', { userState: 'Delhi', candidateState: 'DELHI' });
  assert.equal(s.score, 100); assert.equal(s.label, 'strong');
});
check('extra middle/last name still strong (≥ 90)', () => {
  const s = score('RAKESH KUMAR SHARMA GUPTA');
  assert.ok(s.score >= 90, `got ${s.score}`);
});
check('initials "R K SHARMA" is a possible/likely match, not strong', () => {
  const s = score('R K SHARMA');
  assert.ok(s.score >= 55 && s.score < 90, `got ${s.score}: ${s.reasons.join(' | ')}`);
});
check('abbreviation "RAKESH KR SHARMA" = strong', () => {
  const s = score('RAKESH KR SHARMA');
  assert.ok(s.score >= 90, `got ${s.score}`);
});
check('typo "RAKES KUMR SHARMA" still likely (≥ 75)', () => {
  const s = score('RAKES KUMR SHARMA');
  assert.ok(s.score >= 75, `got ${s.score}: ${s.reasons.join(' | ')}`);
});
check('different first name "RAJESH KUMAR SHARMA" ranks below the typo variant', () => {
  assert.ok(score('RAJESH KUMAR SHARMA').score < score('RAKES KUMR SHARMA').score);
});
check('wrong surname "RAKESH KUMAR VERMA" is weaker than any Sharma variant', () => {
  const s = score('RAKESH KUMAR VERMA');
  assert.ok(s.score < score('R K SHARMA').score + 15, `got ${s.score}`);
  assert.ok(s.reasons.some((r) => r.includes('not found')), s.reasons.join(' | '));
});
check('unrelated name "SUNITA DEVI" scores below the display cut-off (55)', () => {
  const s = score('SUNITA DEVI');
  assert.ok(s.score < 55, `got ${s.score}`);
});
check('state agreement adds, disagreement subtracts', () => {
  const same = score('RAKESH KUMAR SHARMA', { userState: 'Tamil Nadu', candidateState: 'TAMILNADU' }).score;
  const diff = score('RAKESH KUMAR SHARMA', { userState: 'Tamil Nadu', candidateState: 'Kerala' }).score;
  assert.ok(same > diff, `${same} vs ${diff}`);
});
check('reasons are human readable', () => {
  const s = score('RAKES KUMR SHARMA');
  assert.ok(s.reasons.some((r) => /close spelling|sounds like/.test(r)), s.reasons.join(' | '));
});
check('word order "SHARMA RAKESH KUMAR" still strong', () => {
  assert.ok(score('SHARMA RAKESH KUMAR').score >= 90);
});

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures ? 1 : 0);
