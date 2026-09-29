import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, Plus, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { StudentPermissionRequest } from '../types';

interface LeaveRequestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestNewLeave: () => void;
  requests: StudentPermissionRequest[];
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

type FilterTab = 'All' | 'Approved' | 'Denied' | 'Pending';

export const LeaveRequestResultsModal: React.FC<LeaveRequestResultsModalProps> = ({
  isOpen,
  onClose,
  onRequestNewLeave,
  requests,
  triggerButtonRef,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    } else if (triggerButtonRef && triggerButtonRef.current) {
      triggerButtonRef.current.focus();
    }
  }, [isOpen, triggerButtonRef]);

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Approved') return r.status === 'Approved';
    if (activeFilter === 'Denied') return r.status === 'Denied';
    if (activeFilter === 'Pending') return r.status === 'Pending';
    return true;
  });

  const countAll = requests.length;
  const countApproved = requests.filter(r => r.status === 'Approved').length;
  const countDenied = requests.filter(r => r.status === 'Denied').length;
  const countPending = requests.filter(r => r.status === 'Pending').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-results-title"
        >
          {/* Motion Backdrop Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0"
          />

          {/* Centered Modal Card */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-[92%] max-w-[560px] max-h-[80vh] bg-white dark:bg-[#141414] border border-slate-200/90 dark:border-[#2a2a2a] rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white focus:outline-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="leave-results-title" className="text-base sm:text-lg font-bold leading-tight">
                    Leave Request Results
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Track decisions and status on your permission requests
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 sm:px-6 py-2.5 bg-slate-50/80 dark:bg-[#181818]/80 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
              <div className="grid grid-cols-4 gap-1 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                {[
                  { id: 'All', label: 'All', count: countAll },
                  { id: 'Approved', label: 'Approved', count: countApproved },
                  { id: 'Pending', label: 'Pending', count: countPending },
                  { id: 'Denied', label: 'Denied', count: countDenied },
                ].map(tab => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as FilterTab)}
                      className={`px-1 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer truncate flex items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-300/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const isApproved = req.status === 'Approved' || req.status === 'Acknowledged';
                  const isDenied = req.status === 'Denied';
                  const isPending = req.status === 'Pending';

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200/70 dark:border-[#2a2a2a] space-y-2 text-xs sm:text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-slate-900 dark:text-white">{req.date}</span>
                          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/40">
                            {req.category}
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 border flex items-center gap-1 ${
                          isApproved
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60'
                            : isDenied
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {isDenied && <XCircle className="w-3 h-3 text-rose-500" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-500" />}
                          <span>{req.status}</span>
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        {req.reason}
                      </p>
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                        Submitted on {new Date(req.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold">No permission requests found in this view.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#161616]/50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestNewLeave();
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Leave Request</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
