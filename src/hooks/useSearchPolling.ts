import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { searchApi } from '../api/client';
import { PipelineStep } from '../types';

const POLL_MS = 1500;

/**
 * Polls the server for the active job's real progress.
 * Each poll carries its own AbortSignal; switching jobs or unmounting cancels
 * the in-flight request so a late response can never overwrite newer state.
 */
export function useSearchPolling() {
  const activeSearch = useAppStore((state) => state.activeSearch);
  const updateSearchProgress = useAppStore((state) => state.updateSearchProgress);
  const setSelectedReport = useAppStore((state) => state.setSelectedReport);
  const addToast = useAppStore((state) => state.addToast);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      controllerRef.current?.abort();
      controllerRef.current = null;
    };

    if (!activeSearch || activeSearch.status === 'completed' || activeSearch.status === 'failed') {
      stop();
      return;
    }

    const id = activeSearch.id;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      const response = await searchApi.getStatus(id, controller.signal);
      if (cancelled || response.aborted) return;

      if (response.error || !response.data) {
        if (response.status === 404) {
          updateSearchProgress(id, 0, 'failed');
          addToast('Search session lost', 'The server no longer has this search (it may have restarted). Please run it again.', 'error');
          return;
        }
        // transient network hiccup: keep polling
        timerRef.current = setTimeout(poll, POLL_MS * 2);
        return;
      }

      const { progressPercent, status, matchedCount, totalMatchedValue, confidenceScore, logs } = response.data;
      updateSearchProgress(id, progressPercent, status as PipelineStep, matchedCount, totalMatchedValue, confidenceScore, logs, {
        engine: response.data.engine,
        degraded: response.data.degraded,
        degradedReason: response.data.degradedReason,
      });

      if (status === 'completed') {
        setSelectedReport({
          ...activeSearch,
          progressPercent: 100,
          status: 'completed',
          matchedCount,
          totalMatchedValue,
          confidenceScore,
          logs,
          engine: response.data.engine,
          degraded: response.data.degraded,
          degradedReason: response.data.degradedReason,
        });
        return;
      }
      if (status === 'failed') return;

      timerRef.current = setTimeout(poll, POLL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      stop();
    };
  }, [activeSearch?.id, activeSearch?.status === 'completed', activeSearch?.status === 'failed']);
}
