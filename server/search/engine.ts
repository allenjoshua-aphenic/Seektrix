/**
 * Staged fuzzy search engine.
 *
 *   typed name ──► parseName ──► Stage 1  "word"    (strict_word_similarity ≥ 0.8, user's state)
 *                                Stage 2  "similar" (trigram similarity ≥ 0.45, user's state)   if < 25 rows
 *                                Stage 3  widen to all India                                     if < 10 rows
 *                                        ──► Node re-rank (initials, phonetics, state) ──► top 50 with reasons
 *
 * Every database call has its own AbortController timeout (7.5 s, under
 * Supabase's 8 s limit) so a slow stage degrades the result instead of
 * failing the whole search. If the v2 SQL function is not deployed yet the
 * engine falls back to v1 once and flags the result as degraded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ParsedName, parseName } from './normalize';
import { MatchLabel, scoreCandidate } from './score';

export const TUNING = {
  wordThreshold: 0.8,            // Stage 1: how close to a word-for-word phrase match
  quickWordThreshold: 0.65,      // type-ahead: the last word is usually unfinished
  similarThresholdState: 0.45,   // Stage 2 with a state filter (small candidate set → can be looser)
  similarThresholdNationwide: 0.5,
  minScore: 55,                  // below this a candidate is not shown
  stageTimeoutMs: 7500,          // per DB call; Supabase kills at 8000
  quickTimeoutMs: 4500,          // for type-ahead suggestions
  maxCandidatesPerStage: 200,
  resultLimit: 50,
  enoughFromStage1: 25,          // skip typo stage when the precise stage already has this many
  enoughBeforeWidening: 10,      // widen to all-India only when the state search has fewer than this
  cacheTtlMs: 10 * 60 * 1000,
  cacheMaxEntries: 300,
};

export interface MatchRecord {
  id: string;
  companyName: string;
  holderName: string;
  fatherName: string;
  folioNumber: string;
  dpClientId: string;
  state: string;
  fullAddress: string;
  shares: number;
  unclaimedAmount: number;
  financialYear: string;
  score: number;
  rank: number;
  matchLabel: MatchLabel;
  matchReasons: string[];
  dbSimilarity: number | null;
  dbWordSimilarity: number | null;
  stateMatch: boolean | null;
}

export interface StageInfo {
  name: string;
  mode: 'word' | 'similar' | 'prefix' | 'v1';
  threshold: number | null;
  state: string;
  rows: number;
  ms: number;
  error?: string;
}

export interface SearchMeta {
  normalizedQuery: string;
  tokens: string[];
  removed: string[];
  stages: StageInfo[];
  engine: 'v2' | 'v1-fallback' | 'none';
  degraded: boolean;
  /** Plain-language sentence safe to show to end users. */
  degradedReason?: string;
  /** Technical detail for the owner / logs (function names, timeouts). */
  degradedDetail?: string;
  totalCandidates: number;
  tookMs: number;
  fromCache: boolean;
}

export interface SearchResult {
  matches: MatchRecord[];
  meta: SearchMeta;
}

export interface SearchOptions {
  state?: string;
  city?: string;
  limit?: number;
  /** Type-ahead mode: one cheap stage, short timeout, few rows. */
  quick?: boolean;
  signal?: AbortSignal;
  onStage?: (stage: StageInfo, progressPercent: number) => void;
}

class RpcError extends Error {
  code: string;
  timedOut: boolean;
  constructor(message: string, code = '', timedOut = false) {
    super(message);
    this.code = code;
    this.timedOut = timedOut;
  }
}

function isMissingFunction(e: RpcError): boolean {
  return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message);
}

/** "R K Sharma" → '^(?=.*\mr)(?=.*\mk)': every initial must start some word, any order. */
export function initialsPattern(parsed: ParsedName): string | null {
  const letters = parsed.initials.filter((i) => /^[a-z]$/.test(i));
  if (!letters.length) return null;
  return '^' + letters.map((l) => `(?=.*\\m${l})`).join('');
}

type Row = Record<string, any>;

export class SearchEngine {
  private v2Available: boolean | null = null; // null = unknown until first call
  private cache = new Map<string, { at: number; result: SearchResult }>();

  constructor(private readonly getClient: () => SupabaseClient | null) {}

  /** For /api/health: is the v2 SQL function deployed? (cached answer from real traffic) */
  get searchFunctionStatus(): 'v2' | 'v1-only' | 'unknown' {
    if (this.v2Available === null) return 'unknown';
    return this.v2Available ? 'v2' : 'v1-only';
  }

  async search(rawName: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const started = Date.now();
    const parsed = parseName(rawName);
    const limit = Math.min(Math.max(opts.limit ?? TUNING.resultLimit, 1), 200);
    const userState = (opts.state || '').trim();
    const quick = !!opts.quick;

    const baseMeta = (): SearchMeta => ({
      normalizedQuery: parsed.normalized,
      tokens: parsed.tokens,
      removed: parsed.removed,
      stages: [],
      engine: 'none',
      degraded: false,
      totalCandidates: 0,
      tookMs: 0,
      fromCache: false,
    });

    if (parsed.longTokens.length === 0) {
      const meta = baseMeta();
      meta.degraded = true;
      meta.degradedReason = 'Please type at least one full name part (three or more letters), not only initials.';
      meta.tookMs = Date.now() - started;
      return { matches: [], meta };
    }

    const cacheKey = `${quick ? 'q' : 'f'}|${parsed.normalized}|${userState.toLowerCase()}|${limit}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TUNING.cacheTtlMs) {
      return { ...hit.result, meta: { ...hit.result.meta, fromCache: true, tookMs: Date.now() - started } };
    }

    const client = this.getClient();
    if (!client) {
      const meta = baseMeta();
      meta.degraded = true;
      meta.degradedReason = 'Database credentials are not configured on the server.';
      meta.tookMs = Date.now() - started;
      return { matches: [], meta };
    }

    const meta = baseMeta();
    const candidates = new Map<string, Row>();
    // Full search: only real words go to the trigram index. Type-ahead: keep the
    // half-typed last fragment too ("rakesh ku") so the index ranks "RAKESH KU…" first.
    const dbQuery = quick
      ? parsed.tokens.filter((t) => t.length >= 2).join(' ')
      : parsed.longTokens.join(' ');
    // Initials always become a word-start regex. In type-ahead mode the half-typed
    // last word becomes one too ("rakesh ku" → a word starting with "ku"), so the
    // index returns RAKESH KUMAR… rather than RAKESH K ROY.
    const initialsPat = initialsPattern(parsed);
    const lastTok = parsed.tokens[parsed.tokens.length - 1] || '';
    const fragment = quick && lastTok.length >= 2 && /^[a-z]+$/.test(lastTok) ? lastTok : null;
    const pattern = fragment
      ? (initialsPat || '^') + `(?=.*\\m${fragment})`
      : initialsPat;
    const timeout = quick ? TUNING.quickTimeoutMs : TUNING.stageTimeoutMs;
    const perStage = quick ? Math.max(limit * 3, 12) : TUNING.maxCandidatesPerStage;
    const wordThreshold = quick ? TUNING.quickWordThreshold : TUNING.wordThreshold;

    // A lone short fragment in type-ahead ("rak") is a prefix search, not a word match.
    const singleShort = quick && parsed.tokens.length === 1 && lastTok.length >= 3 && lastTok.length <= 5;
    const stage1Mode: 'word' | 'prefix' = singleShort ? 'prefix' : 'word';
    const stage1Label = singleShort ? `names starting with "${lastTok}"` : 'precise match';

    const runStage = async (name: string, mode: 'word' | 'similar' | 'prefix', threshold: number, state: string, progress: number): Promise<boolean> => {
      const t0 = Date.now();
      const info: StageInfo = { name, mode, threshold, state, rows: 0, ms: 0 };
      try {
        const rows = await this.callRpc(client, 'search_holders_v2', {
          search_name: dbQuery,
          search_state: state,
          mode,
          threshold,
          max_rows: perStage,
          // typo and prefix stages must not insist on the exact fragment spelling
          name_pattern: mode === 'word' ? pattern : initialsPat,
        }, timeout, opts.signal);
        this.v2Available = true;
        for (const r of rows) {
          const key = String(r.holder_id ?? `${r.full_name}|${r.company_name}|${r.folio_number}|${r.financial_year}`);
          if (!candidates.has(key)) candidates.set(key, r);
        }
        info.rows = rows.length;
        return true;
      } catch (e: any) {
        const err = e instanceof RpcError ? e : new RpcError(String(e?.message || e));
        if (isMissingFunction(err)) {
          this.v2Available = false;
          info.error = 'fast search engine not available yet';
          return false;
        }
        info.error = err.timedOut ? 'timed out' : err.message;
        meta.degraded = true;
        meta.degradedReason = err.timedOut
          ? 'The registry took too long to answer for one part of this search, so the list may be incomplete. Adding your state narrows the search; you can also simply try again.'
          : 'One part of this search hit a database error, so the list may be incomplete. Please try again in a moment.';
        meta.degradedDetail = err.timedOut
          ? `${name}: statement timeout after ${TUNING.stageTimeoutMs} ms`
          : `${name}: ${err.message}`;
        return true;
      } finally {
        info.ms = Date.now() - t0;
        meta.stages.push(info);
        opts.onStage?.(info, progress);
      }
    };

    // ── Stage plan ─────────────────────────────────────────────────────────
    let v2ok = await runStage(stage1Label + (userState ? ` in ${userState}` : ''), stage1Mode, wordThreshold, userState, 45);

    if (v2ok && !quick && candidates.size < TUNING.enoughFromStage1 && !opts.signal?.aborted) {
      v2ok = await runStage('typo-tolerant match' + (userState ? ` in ${userState}` : ''), 'similar',
        userState ? TUNING.similarThresholdState : TUNING.similarThresholdNationwide, userState, 70);
    }

    if (v2ok && userState && candidates.size < TUNING.enoughBeforeWidening && !opts.signal?.aborted) {
      v2ok = await runStage(stage1Label + ', all India', stage1Mode, wordThreshold, '', 80);
      if (v2ok && !quick && candidates.size < TUNING.enoughBeforeWidening && parsed.longTokens.length >= 2 && !opts.signal?.aborted) {
        v2ok = await runStage('typo-tolerant match, all India', 'similar', TUNING.similarThresholdNationwide, '', 88);
      }
    }

    if (v2ok && quick && candidates.size === 0 && parsed.longTokens.length >= 2 && !opts.signal?.aborted) {
      await runStage('typo-tolerant match', 'similar', 0.55, userState, 70);
    }

    meta.engine = 'v2';

    // ── Fallback: v2 not deployed yet → v1 once, honestly flagged ──────────
    if (!v2ok) {
      meta.engine = 'v1-fallback';
      meta.degraded = true;
      meta.degradedReason = 'Our faster search engine is not switched on yet, so this search ran in compatibility mode: very common names may return nothing and spelling tolerance is limited.';
      meta.degradedDetail = 'search_holders_v2 is not deployed; fell back to legacy search_holders (threshold 0.3). Run: node scripts/deploy_search_function.mjs';
      const t0 = Date.now();
      const info: StageInfo = { name: 'legacy search_holders', mode: 'v1', threshold: 0.3, state: userState, rows: 0, ms: 0 };
      try {
        const rows = await this.callRpc(client, 'search_holders', {
          search_name: dbQuery,
          search_city: (opts.city || userState || '').toLowerCase(),
        }, timeout, opts.signal);
        rows.forEach((r, i) => candidates.set(`v1-${i}`, { ...r, holder_id: null, address: r.full_address, wsim: null, sim: r.score ?? null }));
        info.rows = rows.length;
      } catch (e: any) {
        const err = e instanceof RpcError ? e : new RpcError(String(e?.message || e));
        info.error = err.timedOut ? 'timed out' : err.message;
        meta.degradedReason = err.timedOut
          ? 'This is a very common name and the compatibility-mode search ran out of time, so no records could be listed yet. Our faster engine is not switched on yet; adding your state or a second name part helps meanwhile.'
          : 'The compatibility-mode search failed for this name. Please try again in a moment.';
        meta.degradedDetail = err.timedOut
          ? 'legacy search_holders timed out (8 s statement_timeout); deploy database/search_holders_v2.sql'
          : `legacy search_holders failed: ${err.message}`;
      } finally {
        info.ms = Date.now() - t0;
        meta.stages.push(info);
        opts.onStage?.(info, 80);
      }
    }

    // ── Re-rank in Node ────────────────────────────────────────────────────
    const scored: MatchRecord[] = [];
    for (const [key, r] of candidates) {
      const candidateName: ParsedName = parseName(String(r.full_name ?? ''));
      const ex = scoreCandidate(parsed, candidateName, {
        userState,
        candidateState: r.state,
        candidateAddress: r.address ?? r.full_address,
        prefixLastToken: quick,
      });
      if (ex.score < TUNING.minScore) continue;
      scored.push({
        id: key,
        companyName: String(r.company_name ?? ''),
        holderName: String(r.full_name ?? ''),
        fatherName: String(r.father_or_husband_name ?? ''),
        folioNumber: String(r.folio_number ?? ''),
        dpClientId: String(r.dp_client_id ?? ''),
        state: String(r.state ?? ''),
        fullAddress: String(r.address ?? r.full_address ?? ''),
        shares: Number(r.shares ?? 0) || 0,
        unclaimedAmount: Number(r.unclaimed_amount ?? 0) || 0,
        financialYear: String(r.financial_year ?? ''),
        score: ex.score,
        rank: ex.rank,
        matchLabel: ex.label,
        matchReasons: ex.reasons,
        dbSimilarity: r.sim == null ? null : Number(r.sim),
        dbWordSimilarity: r.wsim == null ? null : Number(r.wsim),
        stateMatch: ex.stateMatch,
      });
    }
    scored.sort((a, b) => b.rank - a.rank
      || Number(b.stateMatch === true) - Number(a.stateMatch === true)
      || (b.dbWordSimilarity ?? 0) - (a.dbWordSimilarity ?? 0)
      || (b.dbSimilarity ?? 0) - (a.dbSimilarity ?? 0)
      || a.holderName.localeCompare(b.holderName));

    meta.totalCandidates = candidates.size;
    meta.tookMs = Date.now() - started;
    opts.onStage?.({ name: 'ranking', mode: 'word', threshold: null, state: userState, rows: scored.length, ms: 0 }, 95);

    const result: SearchResult = { matches: scored.slice(0, limit), meta };
    if (!meta.degraded) this.remember(cacheKey, result);
    return result;
  }

  private remember(key: string, result: SearchResult) {
    if (this.cache.size >= TUNING.cacheMaxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), result });
  }

  private async callRpc(client: SupabaseClient, fn: string, args: Record<string, unknown>, timeoutMs: number, outer?: AbortSignal): Promise<Row[]> {
    if (outer?.aborted) throw new RpcError('cancelled', 'ABORTED', false);
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
    const onOuter = () => ctrl.abort();
    outer?.addEventListener('abort', onOuter, { once: true });
    try {
      const { data, error } = await client.rpc(fn, args).abortSignal(ctrl.signal);
      if (error) {
        const msg = String(error.message || '');
        if (timedOut || /abort/i.test(msg)) throw new RpcError(timedOut ? 'server-side time budget exceeded' : 'cancelled', timedOut ? 'TIMEOUT' : 'ABORTED', timedOut);
        if (/statement timeout/i.test(msg)) throw new RpcError('database statement timeout', '57014', true);
        throw new RpcError(msg, String((error as any).code || ''));
      }
      return (data as Row[]) || [];
    } catch (e: any) {
      if (e instanceof RpcError) throw e;
      if (timedOut || e?.name === 'AbortError') throw new RpcError(timedOut ? 'server-side time budget exceeded' : 'cancelled', timedOut ? 'TIMEOUT' : 'ABORTED', timedOut);
      throw new RpcError(String(e?.message || e), String(e?.code || ''));
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuter);
    }
  }
}
