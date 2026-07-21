import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, dismissToast } = useAppStore();

  return (
    <div 
      id="toast-container" 
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    timestamp: string;
  };
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    // Auto Dismiss after 6 seconds
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      bg: 'bg-white/95 border-emerald-500/30 text-[#171717]',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      accent: 'bg-emerald-600',
    },
    error: {
      bg: 'bg-white/95 border-rose-500/30 text-[#171717]',
      icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
      accent: 'bg-rose-600',
    },
    warning: {
      bg: 'bg-white/95 border-amber-500/30 text-[#171717]',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      accent: 'bg-amber-500',
    },
    info: {
      bg: 'bg-white/95 border-blue-500/30 text-[#171717]',
      icon: <Info className="w-5 h-5 text-[#0081c0]" />,
      accent: 'bg-[#0081c0]',
    },
  }[toast.type];

  return (
    <motion.div
      id={`toast-item-${toast.id}`}
      layout
      initial={{ opacity: 0, y: 35, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -25, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md ${config.bg}`}
    >
      {/* Accent strip */}
      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${config.accent}`} />

      <div className="flex-shrink-0 mt-0.5 ml-1">
        {config.icon}
      </div>

      <div className="flex-grow space-y-0.5 select-text pl-1 pr-1">
        <h4 className="font-sans font-bold text-[13px] tracking-tight text-slate-800 leading-tight">
          {toast.title}
        </h4>
        <p className="font-sans text-[11px] font-medium leading-relaxed text-slate-600">
          {toast.message}
        </p>
        <span className="block font-mono text-[9px] text-slate-400 font-semibold pt-0.5">
          {toast.timestamp}
        </span>
      </div>

      <button
        id={`toast-close-${toast.id}`}
        type="button"
        aria-label="Dismiss Notification"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
