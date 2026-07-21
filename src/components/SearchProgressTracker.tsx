import React, { useEffect, useRef } from 'react';
import { SearchQuery, PipelineStep } from '../types';
import { Terminal, Shield, CheckCircle2, ChevronRight, Server, Timer } from 'lucide-react';
import { motion } from 'motion/react';
import StatusBadge from './StatusBadge';
import { getGatewayNode } from '../utils/gateway';

interface SearchProgressTrackerProps {
  currentSearch: SearchQuery;
  progressPercent: number;
}

export default function SearchProgressTracker({ currentSearch, progressPercent }: SearchProgressTrackerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  const steps: { label: string; limit: number; desc: string }[] = [
    { label: 'Submitted', limit: 12, desc: 'Query registered successfully to system queue.' },
    { label: 'Queued', limit: 25, desc: 'Assigned priority slot in secure regional query stream.' },
    { label: 'Scanning Registry Sources', limit: 38, desc: 'Scanning active MCA registers, AMFI listings, and public EPFO ledgers.' },
    { label: 'Parsing Documents', limit: 55, desc: 'Decoding unstructured ledger tables, scan sheets, and PDF pages.' },
    { label: 'Matching Name Variants', limit: 70, desc: 'Analyzing phonetics, typos, and maiden/legal name shifts.' },
    { label: 'Validating Records', limit: 85, desc: 'Liaising with regional indices to compile direct match validity.' },
    { label: 'Generating Report', limit: 100, desc: 'Structuring final claim dossiers, nodal officer routing, and audit records.' },
    { label: 'Delivered', limit: 101, desc: 'Discovery report completed and transmitted to workspace profile.' }
  ];

  // Scroll terminal logs container only (without affecting the whole body document scrolling)
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 80;
      if (progressPercent < 10 || isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [progressPercent]);

  // Determine which step is currently executing
  const getActiveStepKey = (): string => {
    if (progressPercent >= 100) return 'Delivered';
    if (progressPercent >= 85) return 'Generating Report';
    if (progressPercent >= 70) return 'Validating Records';
    if (progressPercent >= 55) return 'Matching Name Variants';
    if (progressPercent >= 38) return 'Parsing Documents';
    if (progressPercent >= 25) return 'Scanning Registry Sources';
    if (progressPercent >= 12) return 'Queued';
    return 'Submitted';
  };

  const activeStepKey = getActiveStepKey();

  // Slice logs to show dynamically as progress advances
  const allLogs = currentSearch.logs || [];
  const numLogsToShow = Math.min(allLogs.length, Math.floor((progressPercent / 100) * allLogs.length) + 1);
  const visibleLogs = allLogs.slice(0, numLogsToShow);

  return (
    <div className="space-y-6">
      {/* Target summary bar */}
      <div className="glass-panel-light p-5 rounded-2xl border border-white/70 shadow-[0_4px_20px_rgba(0,0,0,0.035)] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="block text-[10px] uppercase font-sans tracking-wide text-[#646464] font-bold">Inquiry Target</span>
          <span className="text-sm font-semibold text-dark-charcoal mt-1 block">{currentSearch.fullName}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-sans tracking-wide text-[#646464] font-bold">Region Scope</span>
          <span className="text-sm text-dark-charcoal mt-1 block">{currentSearch.city}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-sans tracking-wide text-[#646464] font-bold">Estimated Remaining</span>
          <span className="text-sm text-cofounder-blue font-semibold mt-1 block">
            {progressPercent >= 100 ? 'Completed' : `${Math.ceil((100 - progressPercent) * 0.45)}s`}
          </span>
        </div>
        <div className="flex items-center justify-end sm:justify-start">
          <StatusBadge status={activeStepKey} />
        </div>
      </div>

      {/* Progress tracker bar */}
      <div className="glass-panel-light p-6 rounded-2xl border border-white/70 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-dark-charcoal">Systemic Verification Pulse</span>
          <span className="font-sans text-cofounder-blue font-bold">{progressPercent}% Compiled</span>
        </div>
        <div className="h-2.5 w-full bg-slate-200/50 rounded-full overflow-hidden p-[1px] border border-stone-200">
          <motion.div 
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-cofounder-blue via-[#41a1cf] to-action-azure rounded-full"
            layout
          />
        </div>
      </div>

      {/* Grid: Workflow checklist & logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Stepper block */}
        <div className="lg:col-span-5 glass-panel-light p-5 rounded-2xl border border-white/70 shadow-[0_4px_25px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-dark-charcoal font-sans uppercase tracking-wider">Verification Checklist</h3>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold font-sans uppercase">SECURE</span>
          </div>
          
          <div className="space-y-4">
            {steps.map((item, index) => {
              let isDone = false;
              let isCurrent = false;

              const currentLimit = item.limit;
              const prevLimit = index > 0 ? steps[index - 1].limit : 0;

              if (index === 7) {
                isDone = progressPercent >= 100;
                isCurrent = progressPercent >= 99 && progressPercent < 100;
              } else {
                isDone = progressPercent >= currentLimit;
                isCurrent = progressPercent >= prevLimit && progressPercent < currentLimit;
              }

              return (
                <div key={index} className="flex items-start space-x-3 text-xs">
                  {isDone ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5 border border-blue-200">
                      <Server className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 mt-0.5 border border-gray-200 font-sans text-[9px] font-bold">
                      {index + 1}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <p className={`font-medium ${isDone ? 'text-dark-charcoal' : isCurrent ? 'text-cofounder-blue font-bold animate-pulse' : 'text-gray-400'}`}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-gray-500 font-sans leading-snug">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Activity Timeline / Event Feed */}
        <div className="lg:col-span-7 glass-panel-light rounded-2xl border border-white/75 p-5 font-sans text-xs flex flex-col h-[340px] shadow-[0_15px_35px_rgba(0,0,0,0.035),inset_0_1px_2.5px_rgba(255,255,255,0.95)]">
          <div className="flex items-center justify-between border-b border-steel-gray/20 pb-3 text-xs text-dark-charcoal font-sans">
            <div className="flex items-center space-x-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
              </div>
              <span className="font-bold uppercase tracking-wider text-[10px] text-cofounder-blue">Live Verification Registry Stream</span>
            </div>
            <span className="text-[9px] font-mono text-[#646464] font-semibold bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
              Node: {getGatewayNode(currentSearch?.city)}
            </span>
          </div>

          {/* Log print list (Timeline Style) */}
          <div ref={logContainerRef} className="flex-1 overflow-y-auto pt-4 pb-2 scrollbar-thin scrollbar-thumb-steel-gray/30 scrollbar-track-transparent pr-1">
            <div className="relative border-l-2 border-slate-100 ml-2.5 pl-5 space-y-4">
              {visibleLogs.map((log, index) => {
                // Determine status styling
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
                  statusLabel = 'CORRELATING';
                }

                const stepTitleMap: Record<string, string> = {
                  'queued': 'Query Scheduled',
                  'pdf_indexing': 'Source Discovery',
                  'ocr_scanning': 'OCR Structural Scan',
                  'fuzzy_matching': 'Fuzzy Legal Match',
                  'cross_referencing': 'Cross Reference Registry',
                  'report_assembly': 'Dossier Compiled',
                  'completed': 'Registry Finalized'
                };

                const eventTitle = stepTitleMap[log.step] || 'System Operation';

                return (
                  <motion.div 
                    key={index} 
                    className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Left Dot on standard line anchor */}
                    <span className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${dotBg} shadow-sm z-10`} />
                    
                    {/* Main Message Block */}
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-dark-charcoal text-[11px] tracking-tight">{eventTitle}</span>
                        <span className={`text-[8px] font-sans font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider inline-block ${badgeBg}`}>{statusLabel}</span>
                      </div>
                      <p className="text-[#646464] text-[11.5px] font-light leading-relaxed">{log.message}</p>
                    </div>

                    {/* Right Time stamp block */}
                    <div className="text-[10px] text-[#646464]/60 font-mono text-left sm:text-right shrink-0">
                      {log.timestamp}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {progressPercent < 100 && (
              <div className="flex items-center space-x-2 ml-2 pl-5 mt-4 text-[11px] text-[#646464]/40 font-sans italic">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping" />
                <span>Iterating registry indexes for associated records...</span>
              </div>
            )}
          </div>

          <div className="border-t border-steel-gray/20 pt-3 text-[9.5px] text-[#646464] flex justify-between items-center bg-white/15">
            <span className="font-medium">COMPLIANCE LEDGER: VERIFIED</span>
            <span className="font-medium tracking-wide">SECURE SHA-256 SESSION CODES</span>
          </div>
        </div>

      </div>
    </div>
  );
}
