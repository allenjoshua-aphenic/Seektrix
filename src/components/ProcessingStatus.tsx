import React, { useEffect, useState, useRef } from 'react';
import { SearchQuery } from '../types';
import { RefreshCw, CheckCircle2, ArrowRight, Award, Server, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useMobileScrollLock } from '../hooks/useMobileScrollLock';
import { useAppStore } from '../store/useAppStore';

interface ProcessingStatusProps {
  currentSearch: SearchQuery | null;
  onScanComplete: () => void;
  setView: (view: any) => void;
}

/**
 * Progress screen driven by the SERVER's real stages (polled every 1.5 s by
 * useSearchPolling). The bar glides towards the last reported percentage and
 * never runs ahead of it, so "100%" always means the results exist.
 */
export default function ProcessingStatus({ currentSearch, onScanComplete, setView }: ProcessingStatusProps) {
  const { setSelectedReport } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const scanCompleteCalled = useRef(false);

  useMobileScrollLock(showCompleteModal);

  const isDone = currentSearch?.status === 'completed';
  const isFailed = currentSearch?.status === 'failed';
  const serverProgress = currentSearch?.progressPercent ?? 0;
  const target = isDone ? 100 : Math.min(serverProgress, 97);
  const targetRef = useRef(target);
  targetRef.current = target;

  // The real stages, in the order the server runs them.
  const steps: { label: string; limit: number; desc: string }[] = [
    { label: 'Request received', limit: 10, desc: 'Your name, state and email reached the search server.' },
    { label: 'Name cleaned', limit: 20, desc: 'Titles, dots and abbreviations normalised (SHRI, KR., S/O …).' },
    { label: 'Word-for-word match', limit: 45, desc: 'Looking for your name as a phrase inside lakhs of registry rows, your state first.' },
    { label: 'Typo-tolerant match', limit: 70, desc: 'Allowing spelling differences (Laxmi/Lakshmi, Mohamed/Mohammed) when the first pass is thin.' },
    { label: 'Ranking & explanations', limit: 97, desc: 'Scoring every candidate on spelling, initials, sound-alike forms and state.' },
    { label: 'Results ready', limit: 100, desc: 'Report compiled from real registry records only.' }
  ];

  // New job → start from zero.
  useEffect(() => {
    setProgress(0);
    scanCompleteCalled.current = false;
    setShowCompleteModal(false);
  }, [currentSearch?.id]);

  // Glide towards the server-reported value.
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => (p >= targetRef.current ? p : Math.min(targetRef.current, p + 1)));
    }, 35);
    return () => clearInterval(timer);
  }, [currentSearch?.id]);

  // Completion side effects only once the server says "completed".
  useEffect(() => {
    if (isDone && progress >= 100 && !scanCompleteCalled.current) {
      scanCompleteCalled.current = true;
      setShowCompleteModal(true);
      onScanComplete();
    }
  }, [isDone, progress, onScanComplete]);

  // Keep the log panel scrolled to the newest entry.
  const logCount = currentSearch?.logs.length ?? 0;
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 80;
      if (logCount <= 2 || isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logCount, progress]);

  if (!currentSearch) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl glass-panel-light text-center font-mono shadow-md">
        <p className="text-red-500 font-bold">Process Error</p>
        <p className="text-dark-charcoal/80 mt-2">No active search query parameter detected inside core queue.</p>
      </div>
    );
  }

  const visibleLogs = currentSearch.logs;
  const stepTitleMap: Record<string, string> = {
    queued: 'Request received',
    pdf_indexing: 'Preparing',
    ocr_scanning: 'Preparing',
    fuzzy_matching: 'Word-for-word match',
    cross_referencing: 'Typo-tolerant match',
    report_assembly: 'Ranking',
    completed: 'Results ready',
    failed: 'Search failed'
  };

  return (
    <section className="bg-transparent text-[#171717] min-h-[85vh] pt-3 pb-14 relative overflow-hidden z-10">

      {/* Background glow overlay */}
      <div className="absolute top-[20%] left-[-10%] w-[350px] h-[350px] rounded-full bg-cofounder-blue/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-[#41a1cf]/5 blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-10">

        {/* Upper Header status banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cofounder-blue/10 border border-cofounder-blue/20 rounded text-xs text-action-azure font-sans">
            <Server className="w-3.5 h-3.5 animate-pulse" />
            <span>ACTIVE REGISTRY INQUIRY // SESSION ID <span className="font-mono">{currentSearch.id}</span></span>
          </div>
          <h1 className="font-serif-intellectual text-3xl sm:text-4xl tracking-tight text-dark-charcoal font-medium">
            {isFailed ? 'The search could not be completed' : isDone ? 'Search complete' : 'Searching Unclaimed Asset Registries...'}
          </h1>
          <p className="text-xs sm:text-sm text-medium-gray max-w-xl mx-auto font-sans font-light">
            Your name is matched against the shareholder lists loaded from company IEPF disclosures. Every result shown comes from a real registry row.
          </p>
        </div>

        {/* Failure panel */}
        {isFailed && (
          <div className="glass-panel-light p-6 rounded-2xl border border-red-200 text-sm font-sans flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="search-failed-panel">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-dark-charcoal">Something went wrong on the search server.</p>
                <p className="text-xs text-medium-gray mt-1">{currentSearch.logs[currentSearch.logs.length - 1]?.message || 'Please try again in a moment.'}</p>
              </div>
            </div>
            <button
              onClick={() => setView('landing')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cofounder-blue to-action-azure text-white text-xs font-semibold tracking-wide cursor-pointer border border-white/20 shrink-0"
            >
              Search again
            </button>
          </div>
        )}

        {/* Dynamic Progress indicator */}
        <div className="glass-panel-light p-6 rounded-2xl border border-white/70 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),inset_0_1px_2.5px_rgba(255,255,255,0.95)] space-y-4">
          <div className="flex justify-between items-center text-xs font-sans">
            <span className="text-[#646464] uppercase font-bold tracking-wider">Registry database search // {isDone ? 'complete' : isFailed ? 'failed' : 'in progress'}</span>
            <span className="text-cofounder-blue font-bold">{progress}% COMPLETED</span>
          </div>
          <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden border border-steel-gray/30">
            <motion.div
              style={{ width: `${progress}%` }}
              className={`h-full rounded-full shadow-lg ${isFailed ? 'bg-red-400' : 'bg-gradient-to-r from-cofounder-blue to-action-azure'}`}
              layout
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t border-steel-gray/20 pt-4 text-[11px] font-sans">
            <div>
              <p className="text-[#646464]/60">QUERY NAME</p>
              <p className="text-dark-charcoal font-semibold">{currentSearch.fullName}</p>
            </div>
            <div>
              <p className="text-[#646464]/60">STATE SCOPE</p>
              <p className="text-dark-charcoal font-semibold">{currentSearch.state || 'All India'}</p>
            </div>
            <div>
              <p className="text-[#646464]/60">ESTIMATED TIMER</p>
              <p className="text-cofounder-blue font-bold">
                {isDone ? '0' : Math.max(1, Math.ceil((100 - progress) * 0.1))}s remaining
              </p>
            </div>
            <div>
              <p className="text-[#646464]/60">MATCHES SO FAR</p>
              <p className="text-green-600 font-bold">{isDone ? currentSearch.matchedCount : '—'}</p>
            </div>
          </div>
        </div>

        {/* Lower Grid: Progress steps checklist & Terminal output */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Stepper Status list (left side) */}
          <div className="lg:col-span-5 glass-panel-light p-5 rounded-2xl border border-white/70 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),inset_0_1px_2.5px_rgba(255,255,255,0.95)] space-y-5">
            <h3 className="text-xs font-sans uppercase tracking-widest text-[#0081c0] pb-2 border-b border-steel-gray/20 font-bold">
              Search Stages
            </h3>

            <div className="space-y-4">
              {steps.map((item, index) => {
                const prevLimit = index > 0 ? steps[index - 1].limit : 0;
                const isStepDone = index === steps.length - 1 ? isDone && progress >= 100 : progress >= item.limit;
                const isStepActive = !isStepDone && progress >= prevLimit && !isFailed;

                return (
                  <div key={index} className="flex items-start space-x-3 text-xs leading-relaxed">
                    {isStepDone ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : isStepActive ? (
                      <RefreshCw className="w-5 h-5 text-action-azure animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-steel-gray/40 bg-transparent shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <p className={`font-sans font-semibold ${isStepDone ? 'text-dark-charcoal' : isStepActive ? 'text-action-azure font-bold' : 'text-[#646464]/40'}`}>
                        {item.label}
                      </p>
                      <p className={`text-[10px] font-sans ${isStepDone ? 'text-[#646464]' : isStepActive ? 'text-dark-charcoal/70 font-light' : 'text-[#646464]/30'}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real activity feed from the server */}
          <div className="lg:col-span-7 glass-panel-light rounded-2xl border border-white/75 p-5 font-sans text-xs flex flex-col h-[340px] shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),inset_0_1px_2.5px_rgba(255,255,255,0.95)]">
            <div className="flex items-center justify-between border-b border-steel-gray/20 pb-3 text-xs text-dark-charcoal font-sans">
              <div className="flex items-center space-x-2">
                <div className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isDone ? 'bg-[#10b981]' : 'animate-ping bg-[#10b981]'}`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
                </div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-cofounder-blue">Live search log</span>
              </div>
              <span className="text-[9px] font-mono text-[#646464] font-semibold bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                {currentSearch.engine ? `engine ${currentSearch.engine}` : 'connected'}
              </span>
            </div>

            <div ref={logContainerRef} className="flex-1 overflow-y-auto pt-4 pb-2 scrollbar-thin scrollbar-thumb-steel-gray/30 scrollbar-track-transparent pr-1">
              <div className="relative border-l-2 border-slate-100 ml-2.5 pl-5 space-y-4">
                {visibleLogs.map((log, index) => {
                  let badgeBg = 'bg-slate-50 border-slate-100 text-slate-500';
                  let dotBg = 'bg-slate-300';
                  let statusLabel = 'INFO';

                  if (log.status === 'success') {
                    badgeBg = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                    dotBg = 'bg-emerald-500';
                    statusLabel = 'COMPLETED';
                  } else if (log.status === 'warning') {
                    badgeBg = 'bg-amber-50 border-amber-100 text-amber-700';
                    dotBg = 'bg-amber-500';
                    statusLabel = 'WARNING';
                  } else if (log.status === 'processing') {
                    badgeBg = 'bg-sky-50 border-sky-100 text-sky-700';
                    dotBg = 'bg-[#0081c0] animate-pulse';
                    statusLabel = 'RUNNING';
                  }

                  const eventTitle = stepTitleMap[log.step] || 'System Operation';

                  return (
                    <motion.div
                      key={index}
                      className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${dotBg} shadow-sm z-10`} />
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-dark-charcoal text-[11px] tracking-tight">{eventTitle}</span>
                          <span className={`text-[8px] font-sans font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider inline-block ${badgeBg}`}>{statusLabel}</span>
                        </div>
                        <p className="text-[#646464] text-[11.5px] font-light leading-relaxed">{log.message}</p>
                      </div>
                      <div className="text-[10px] text-[#646464]/60 font-mono text-left sm:text-right shrink-0">
                        {log.timestamp}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {!isDone && !isFailed && (
                <div className="flex items-center space-x-2 ml-2 pl-5 mt-4 text-[11px] text-[#646464]/40 font-sans italic">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping" />
                  <span>Waiting for the next stage from the server…</span>
                </div>
              )}
            </div>

            <div className="border-t border-steel-gray/20 pt-3 text-[9.5px] text-[#646464] flex justify-between items-center bg-white/15">
              <span className="font-medium">SOURCE: COMPANY IEPF DISCLOSURES</span>
              <span className="font-medium tracking-wide">SEARCHING: {currentSearch.fullName?.toUpperCase()}</span>
            </div>
          </div>

        </div>

      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <div className="fixed inset-0 bg-[#171717]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel-light text-center max-w-sm w-full p-6 sm:p-8 rounded-2xl border border-white/75 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.15),inset_0_1px_2.5px_rgba(255,255,255,0.95)] relative"
            >
              <div className="mx-auto w-12 h-12 bg-green-500/10 border border-green-500/20 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Award className="w-6 h-6 animate-pulse" />
              </div>

              <h3 className="font-serif-intellectual text-xl text-dark-charcoal font-semibold mb-2">
                Registry Search Completed
              </h3>

              <p className="text-xs text-medium-gray leading-relaxed font-sans font-light mb-6">
                {currentSearch.matchedCount > 0
                  ? `${currentSearch.matchedCount} matching record${currentSearch.matchedCount === 1 ? '' : 's'} found${currentSearch.confidenceScore ? ` (best match ${currentSearch.confidenceScore}%)` : ''}.`
                  : 'No matching records were found in the registries loaded so far.'}
                {currentSearch.degraded && ' Some stages did not finish, so the list may be incomplete.'}
              </p>

              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedReport(currentSearch);
                  setView('dashboard');
                }}
                className="w-full py-3 bg-gradient-to-r from-cofounder-blue to-action-azure text-white text-xs font-semibold tracking-wide flex items-center justify-center space-x-1.5 cursor-pointer rounded-xl border border-white/20 shadow-[0_12px_28px_rgba(0,129,192,0.2),inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:shadow-[0_15px_32px_rgba(0,129,192,0.28)] transition-all duration-300"
              >
                <span>View Matching Results</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
}
