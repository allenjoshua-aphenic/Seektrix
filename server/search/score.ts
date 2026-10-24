/**
 * Re-ranking of database candidates in Node.
 *
 * Postgres (pg_trgm) is good at pulling a few hundred plausible rows out of
 * 13.7 lakh quickly. It is NOT good at knowing that "R K Sharma" is the same
 * person as "RAKESH KUMAR SHARMA", that "Mohamed" sounds like "Mohammed", or
 * that a user from Tamil Nadu is more likely to be the Chennai record than the
 * Kolkata one. That judgement happens here, on a small list, in microseconds,
 * and every decision is written down as a human-readable reason.
 */
import { ParsedName, jaroWinkler, normalizeState, phoneticKey } from './normalize';

export type MatchKind = 'exact' | 'phonetic' | 'typo' | 'prefix' | 'initial' | 'none';
export type MatchLabel = 'strong' | 'likely' | 'possible' | 'weak';

export interface TokenAlignment {
  queryToken: string;
  candidateToken: string | null;
  kind: MatchKind;
  weight: number;
}

export interface MatchExplanation {
  /** Display score, 0..100 (clamped). */
  score: number;
  /** Ranking score, unclamped (can exceed 100 so bonuses still order ties). */
  rank: number;
  label: MatchLabel;
  reasons: string[];
  alignments: TokenAlignment[];
  stateMatch: boolean | null; // null = no state supplied by the user
}

export interface ScoreContext {
  userState?: string | null;
  candidateState?: string | null;
  candidateAddress?: string | null;
  /** Type-ahead: the last typed word may be unfinished ("rakesh ku" → "kumar"). */
  prefixLastToken?: boolean;
}

// Weights — tuned so that: exact 100 · typo/sound-alike ~93-96 · extra name parts
// cost ~8 each · initials give partial credit · state is a tie-breaker, not a gate.
const W = {
  exact: 1,
  phonetic: 0.9,
  prefix: 0.78,
  shortPrefix: 0.85,   // only for the last token in type-ahead mode
  initial: 0.6,
  typoMin: 0.6,        // Jaro-Winkler 0.86 → 0.6, 1.0 → 0.9
  extraPenalty: 0.08,
  extraFloor: 0.7,
  missingLongest: 0.7,
  orderBonus: 0.02,
  stateBonus: 0.03,
  stateMismatch: -0.03,
};

function capWord(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function capWords(s: string): string {
  return s.split(' ').map(capWord).join(' ');
}

function tokenMatch(qt: string, ct: string, allowShortPrefix: boolean): { weight: number; kind: MatchKind } {
  if (qt === ct) return { weight: W.exact, kind: 'exact' };
  const qInitial = qt.length === 1;
  const cInitial = ct.length === 1;
  if (qInitial || cInitial) {
    return qt[0] === ct[0] ? { weight: W.initial, kind: 'initial' } : { weight: 0, kind: 'none' };
  }
  const pk = phoneticKey(qt);
  if (pk.length >= 2 && pk === phoneticKey(ct)) return { weight: W.phonetic, kind: 'phonetic' };
  if (allowShortPrefix && qt.length >= 2 && ct.startsWith(qt)) return { weight: W.shortPrefix, kind: 'prefix' };
  if (Math.min(qt.length, ct.length) >= 4 && (ct.startsWith(qt) || qt.startsWith(ct))) {
    return { weight: W.prefix, kind: 'prefix' };
  }
  const jw = jaroWinkler(qt, ct);
  if (jw >= 0.86) return { weight: W.typoMin + ((jw - 0.86) / 0.14) * 0.3, kind: 'typo' };
  return { weight: 0, kind: 'none' };
}

export function labelFor(score: number): MatchLabel {
  if (score >= 90) return 'strong';
  if (score >= 75) return 'likely';
  if (score >= 55) return 'possible';
  return 'weak';
}

export function scoreCandidate(query: ParsedName, candidate: ParsedName, ctx: ScoreContext = {}): MatchExplanation {
  const q = query.tokens;
  const c = candidate.tokens;
  if (!q.length || !c.length) {
    return { score: 0, rank: 0, label: 'weak', reasons: ['Empty name'], alignments: [], stateMatch: null };
  }

  // Greedy alignment: longest query tokens first, each candidate token used once.
  const order = q.map((_, i) => i).sort((a, b) => q[b].length - q[a].length);
  const used = new Array<boolean>(c.length).fill(false);
  const alignments: TokenAlignment[] = new Array(q.length);
  const matchedIdx: number[] = [];
  const lastIdx = q.length - 1;

  for (const qi of order) {
    let best = { weight: 0, kind: 'none' as MatchKind, at: -1 };
    for (let ci = 0; ci < c.length; ci++) {
      if (used[ci]) continue;
      const m = tokenMatch(q[qi], c[ci], !!ctx.prefixLastToken && qi === lastIdx);
      if (m.weight > best.weight) best = { ...m, at: ci };
    }
    if (best.at >= 0 && best.weight > 0) {
      used[best.at] = true;
      matchedIdx[qi] = best.at;
      alignments[qi] = { queryToken: q[qi], candidateToken: c[best.at], kind: best.kind, weight: best.weight };
    } else {
      alignments[qi] = { queryToken: q[qi], candidateToken: null, kind: 'none', weight: 0 };
    }
  }

  const coverage = alignments.reduce((s, a) => s + a.weight, 0) / q.length;
  if (coverage === 0) {
    return { score: 0, rank: 0, label: 'weak', reasons: ['No part of the name matches'], alignments, stateMatch: null };
  }

  const reasons: string[] = [];
  for (const a of alignments) {
    const qt = capWord(a.queryToken);
    const ct = a.candidateToken ? capWord(a.candidateToken) : '';
    switch (a.kind) {
      case 'exact': reasons.push(a.queryToken.length === 1 ? `Initial "${qt}" present` : `"${qt}" matches exactly`); break;
      case 'phonetic': reasons.push(`"${qt}" sounds like "${ct}"`); break;
      case 'typo': reasons.push(`"${qt}" is a close spelling of "${ct}"`); break;
      case 'prefix': reasons.push(`"${qt}" is a shorter form of "${ct}"`); break;
      case 'initial': reasons.push(a.queryToken.length === 1 ? `Initial "${qt}" matches "${ct}"` : `"${qt}" recorded as initial "${ct}"`); break;
      case 'none': reasons.push(`"${qt}" not found in the record`); break;
    }
  }

  // Extra name parts on the record (middle names, surnames the user did not type) cost a little.
  const extras = c.filter((_, i) => !used[i]);
  let factor = Math.max(W.extraFloor, 1 - W.extraPenalty * extras.length);
  if (extras.length) reasons.push(`Record also has "${extras.map(capWord).join(' ')}"`);

  // The longest typed word is almost always the surname or given name; missing it is serious.
  if (alignments[order[0]].kind === 'none') factor *= W.missingLongest;

  // Same order of words as typed → small bonus.
  let bonus = 0;
  const seq = matchedIdx.filter((v) => v !== undefined);
  const inOrder = seq.length > 1 && seq.every((v, i) => i === 0 || seq[i - 1] < v);
  if (inOrder) bonus += W.orderBonus;

  // State: a confirmation, not a gate — people move, registers hold old addresses.
  let stateMatch: boolean | null = null;
  const userState = normalizeState(ctx.userState);
  if (userState) {
    const recState = normalizeState(ctx.candidateState);
    const addr = String(ctx.candidateAddress ?? '').toLowerCase();
    if ((recState && recState === userState) || (addr && addr.includes(userState))) {
      stateMatch = true;
      bonus += W.stateBonus;
      reasons.push(`Registered in ${capWords(userState)}`);
    } else if (recState) {
      stateMatch = false;
      bonus += W.stateMismatch;
      reasons.push(`Registered in ${capWords(recState)}, not ${capWords(userState)}`);
    } else {
      stateMatch = false;
    }
  }

  const rank = Math.round((coverage * factor + bonus) * 1000) / 10;   // one decimal, unclamped
  const score = Math.max(0, Math.min(100, Math.round(rank)));
  return { score, rank, label: labelFor(score), reasons, alignments, stateMatch };
}
