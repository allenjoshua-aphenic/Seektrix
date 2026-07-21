import React from 'react';
import { ShieldCheck, AlertOctagon, RefreshCw, Send, ArrowLeft } from 'lucide-react';
import { AppView } from '../types';

interface ErrorStateProps {
  errorCode?: string;
  errorMessage?: string;
  nodeId?: string;
  onRetry: () => void;
  setView: (view: AppView) => void;
}

export function SystemTimeoutError({
  errorCode = 'CONNECTION_TIMEOUT_504',
  errorMessage = 'The session could not connect to the remote registry database. The search connection timed out after 45000ms.',
  nodeId = 'GATEWAY-7',
  onRetry,
  setView
}: ErrorStateProps) {
  return (
    <div className="min-h-[75vh] flex items-center justify-center bg-night-sky text-off-white py-16 px-4">
      <div className="absolute w-[300px] h-[300px] rounded-full bg-red-500/5 blur-[80px] pointer-events-none" />
      
      <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-xl border border-red-500/15 shadow-2xl space-y-6 relative z-10" id="error-screen-card">
        
        {/* Error icon header */}
        <div className="flex items-center space-x-3 pb-3 border-b border-steel-gray/10 text-red-400">
          <AlertOctagon className="w-5 h-5 animate-pulse shrink-0" />
          <span className="font-mono text-xs uppercase tracking-widest font-semibold">{errorCode}</span>
        </div>

        <div className="space-y-3">
          <h3 className="font-serif-intellectual text-xl text-canvas-white font-medium">
            Database Connection Timeout
          </h3>
          <p className="text-xs text-[#dee2de]/55 leading-relaxed font-sans font-light">
            The search engine was unable to complete the query in the public registries index. The connection was temporarily interrupted by search rate limits of the hosting public disclosure server.
          </p>
          <div className="p-3 bg-[#171717] rounded border border-red-500/10 text-[10.5px] font-mono text-red-400/80 leading-relaxed font-light">
            EXCEPTION_LOG: {errorMessage} | Active Router: {nodeId}
          </div>
        </div>

        {/* Action button options */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onRetry}
            className="w-full py-2.5 bg-red-600/15 hover:bg-red-600/25 border border-red-500/20 rounded text-xs font-mono text-white text-semibold flex items-center justify-center space-x-1 px-4 cursor-pointer transition-colors"
            id="error-retry-node-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET AND RE-TRY DATABASE CONNECTION</span>
          </button>
          
          <button
            onClick={() => setView('dashboard')}
            className="w-full text-center text-[10.5px] font-mono text-[#dee2de]/40 hover:text-off-white flex items-center justify-center space-x-1.5 transition-colors cursor-pointer pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO WORKSPACE</span>
          </button>
        </div>

        {/* Compliance Footer check */}
        <div className="border-t border-steel-gray/10 pt-4 text-center text-[9px] font-mono text-[#dee2de]/25 uppercase tracking-wider">
          CURRENT SESSION STATE HAS BEEN PRESERVED
        </div>

      </div>
    </div>
  );
}
