import { useEffect, useRef, useState } from 'react';
import { searchApi } from '../api/client';
import { SuggestResponse } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export type SuggestStatus = 'idle' | 'typing' | 'loading' | 'ready' | 'error';

export interface NameSuggestState {
  status: SuggestStatus;
  /** The query the current items belong to. */
  query: string;
  items: SuggestResponse['items'];
  total: number;
  meta: SuggestResponse['meta'] | null;
  error: string | null;
}

const EMPTY: NameSuggestState = { status: 'idle', query: '', items: [], total: 0, meta: null, error: null };

/**
 * Live "possible records" preview for the search bar.
 *
 *  - Debounce: waits `delayMs` after the last keystroke (and state change).
 *  - Cancel token: every new lookup aborts the in-flight one through an
 *    AbortController, and a sequence number discards any response that still
 *    arrives for an older query, so results can never show up out of order.
 */
export function useNameSuggest(name: string, state: string, opts: { minLength?: number; delayMs?: number; enabled?: boolean } = {}): NameSuggestState {
  const { minLength = 3, delayMs = 350, enabled = true } = opts;
  const debouncedName = useDebouncedValue(name.trim(), delayMs);
  const debouncedState = useDebouncedValue(state.trim(), delayMs);
  const [result, setResult] = useState<NameSuggestState>(EMPTY);
  const controllerRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const q = debouncedName;
    if (q.length < minLength) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setResult(EMPTY);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const seq = ++seqRef.current;

    setResult((prev) => ({ ...prev, status: 'loading', error: null }));

    searchApi.suggest(q, debouncedState, controller.signal).then((res) => {
      if (res.aborted || seq !== seqRef.current) return; // superseded by a newer keystroke
      if (res.error || !res.data) {
        setResult({ status: 'error', query: q, items: [], total: 0, meta: null, error: res.error || 'Lookup failed' });
        return;
      }
      setResult({ status: 'ready', query: q, items: res.data.items, total: res.data.total, meta: res.data.meta, error: null });
    });

    return () => controller.abort();
  }, [debouncedName, debouncedState, enabled, minLength]);

  // While the user is still typing (raw differs from debounced) show a "typing" state.
  const isTyping = enabled && name.trim().length >= minLength && name.trim() !== debouncedName;
  if (isTyping && result.status !== 'loading') {
    return { ...result, status: 'typing' };
  }
  return result;
}
