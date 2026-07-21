import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { searchApi } from '../api/client';
import { PipelineStep } from '../types';

export function useSearchPolling() {
  const activeSearch = useAppStore((state) => state.activeSearch);
  const updateSearchProgress = useAppStore((state) => state.updateSearchProgress);
  const setSelectedReport = useAppStore((state) => state.setSelectedReport);
  const setView = useAppStore((state) => state.setView);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeSearch || activeSearch.status === 'completed' || activeSearch.status === 'failed') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const id = activeSearch.id;
    let localProgress = activeSearch.progressPercent;

    timerRef.current = setInterval(async () => {
      const response = await searchApi.getStatus(id, localProgress);
      if (response.error || !response.data) {
        updateSearchProgress(id, localProgress, 'failed');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const { progressPercent, status, matchedCount, totalMatchedValue, confidenceScore } = response.data;
      localProgress = progressPercent;

      // Update progress + match data in store
      updateSearchProgress(id, progressPercent, status as PipelineStep, matchedCount, totalMatchedValue, confidenceScore);

      if (progressPercent >= 100 || status === 'completed') {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Build the completed query object for ReportView
        const completedQuery = {
          ...activeSearch,
          progressPercent: 100,
          status: 'completed' as PipelineStep,
          matchedCount: matchedCount ?? activeSearch.matchedCount,
          totalMatchedValue: totalMatchedValue ?? activeSearch.totalMatchedValue,
          confidenceScore: confidenceScore ?? activeSearch.confidenceScore,
        };

        // Set selectedReport so ReportView has a non-null currentQuery
        setSelectedReport(completedQuery);

        // Small delay so state settles before navigating
        setTimeout(() => setView('dashboard'), 100);
      }
    }, 2000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeSearch?.id]); // Only re-run when the search ID changes
}
