import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 right-auto sm:right-6 z-50 flex flex-col gap-1.5 max-w-[280px] sm:max-w-xs w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isInfo = toast.type === 'info';
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 350 }}
              className={`pointer-events-auto flex items-center justify-between gap-2.5 px-3 py-1.5 sm:py-2 rounded-xl shadow-md border backdrop-blur-md ${
                isError
                  ? 'bg-rose-950/90 text-rose-100 border-rose-800/80 shadow-rose-950/20'
                  : isInfo
                  ? 'bg-slate-900/95 text-slate-100 border-slate-700/80 shadow-slate-950/20'
                  : 'bg-slate-900/95 text-white border-slate-800/90 shadow-slate-950/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 text-left">
                {isError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : isInfo ? (
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="text-xs font-semibold leading-tight">{toast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors shrink-0 cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
