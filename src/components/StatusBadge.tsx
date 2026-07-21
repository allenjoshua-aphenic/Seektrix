import React from 'react';
import { PipelineStep } from '../types';
import { Loader2, CheckCircle2, ShieldAlert, Timer, FileSearch, Shuffle, ClipboardCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: PipelineStep | 'scanning' | 'parsing_docs' | 'matching_records' | 'verifying_entries' | 'report_ready' | string;
  className?: string;
  showText?: boolean;
}

export default function StatusBadge({ status, className = '', showText = true }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
      case 'Queued':
        return {
          label: 'Queued',
          colors: 'bg-amber-50 text-amber-800 border-amber-200/60',
          icon: <Timer className="w-3.5 h-3.5 text-amber-600 animate-spin" />
        };
      case 'Submitted':
      case 'submitted':
        return {
          label: 'Submitted',
          colors: 'bg-blue-50 text-blue-800 border-blue-200/60',
          icon: <FileSearch className="w-3.5 h-3.5 text-blue-600" />
        };
      case 'Scanning Registry Sources':
        return {
          label: 'Scanning Sources',
          colors: 'bg-sky-50 text-sky-800 border-sky-200/60',
          icon: <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
        };
      case 'pdf_indexing':
      case 'parsing_docs':
      case 'Parsing Documents':
        return {
          label: 'Parsing Documents',
          colors: 'bg-cyan-50 text-cyan-800 border-cyan-200/60',
          icon: <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
        };
      case 'ocr_scanning':
        return {
          label: 'Restructuring Logs',
          colors: 'bg-sky-50 text-sky-800 border-sky-200/60',
          icon: <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
        };
      case 'fuzzy_matching':
      case 'matching_records':
      case 'Matching Name Variants':
        return {
          label: 'Matching Variants',
          colors: 'bg-indigo-50 text-indigo-800 border-indigo-200/60',
          icon: <Shuffle className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
        };
      case 'cross_referencing':
      case 'verifying_entries':
      case 'Validating Records':
        return {
          label: 'Validating Records',
          colors: 'bg-purple-50 text-purple-800 border-purple-200/60',
          icon: <ClipboardCheck className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
        };
      case 'report_assembly':
      case 'Generating Report':
        return {
          label: 'Generating Report',
          colors: 'bg-pink-50 text-pink-800 border-pink-200/60',
          icon: <Loader2 className="w-3.5 h-3.5 text-pink-600 animate-spin" />
        };
      case 'completed':
      case 'report_ready':
      case 'Delivered':
        return {
          label: 'Delivered',
          colors: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        };
      case 'failed':
        return {
          label: 'Audit Failed',
          colors: 'bg-red-50 text-red-800 border-red-200/60',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
        };
      default:
        return {
          label: 'Analyzing',
          colors: 'bg-gray-100 text-gray-800 border-gray-200/60',
          icon: <FileSearch className="w-3.5 h-3.5 text-gray-600" />
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold font-mono tracking-wide ${config.colors} ${className}`}>
      {config.icon}
      {showText && <span>{config.label}</span>}
    </div>
  );
}
