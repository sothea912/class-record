import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, Plus, CheckCircle2, XCircle, Clock, AlertCircle, CalendarX, FileText } from 'lucide-react';
import { StudentPermissionRequest, ClassCancellationItem, ClassItem, HomeworkItem, HomeworkSubmission } from '../types';

interface LeaveRequestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestNewLeave: () => void;
  requests: StudentPermissionRequest[];
  cancellations: ClassCancellationItem[];
  classes: ClassItem[];
  studentId: string;
  dismissedNoticeIds: string[];
  homework?: HomeworkItem[];
  submissions?: HomeworkSubmission[];
  onNavigateTab?: (tab: any) => void;
  onDismissCancellation?: (cancellationId: string) => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
  initialTab?: FilterTab;
}

type FilterTab = 'All' | 'Homework' | 'Leave Requests' | 'Class Updates';

export const LeaveRequestResultsModal: React.FC<LeaveRequestResultsModalProps> = ({
  isOpen,
  onClose,
  onRequestNewLeave,
  requests,
  cancellations,
  classes,
  studentId,
  dismissedNoticeIds,
  onDismissCancellation,
  triggerButtonRef,
  initialTab,
  homework = [],
  submissions = [],
  onNavigateTab,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync activeFilter with initialTab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveFilter(initialTab);
    }
  }, [isOpen, initialTab]);

  // Filter relevant cancellations for this student's enrolled classes
  const studentCancellations = cancellations.filter(c => {
    const cls = classes.find(cl => cl.id === c.classId);
    return cls;
  });

  const hwItems = (homework || []).filter(h => h.published);
  const countHw = hwItems.length;
  const countAll = requests.length + studentCancellations.length + countHw;
  const countLeaves = requests.length;
  const countClasses = studentCancellations.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0"
          />

          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-[92%] max-w-[580px] max-h-[82vh] bg-white dark:bg-[#141414] border border-slate-200/90 dark:border-[#2a2a2a] rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white focus:outline-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold leading-tight">
                    Notification Center
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Class updates, schedule changes &amp; leave request status
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
                  { id: 'Homework', label: 'Homework', count: countHw },
                  { id: 'Leave Requests', label: 'Leave', count: countLeaves },
                  { id: 'Class Updates', label: 'Updates', count: countClasses },
                ].map(tab => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as FilterTab)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer truncate flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
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
              {(activeFilter === 'All' || activeFilter === 'Homework') && hwItems.length > 0 && (
                <div className="space-y-3">
                  {hwItems.map(hw => {
                    const sub = (submissions || []).find(s => s.homeworkId === hw.id);
                    const isMarked = sub?.status === 'marked';
                    return (
                      <div
                        key={hw.id}
                        className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-900/40 space-y-2.5 text-xs sm:text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {isMarked ? `Graded: ${hw.title}` : `New Homework: ${hw.title}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                Due: {new Date(hw.dueDateTime).toLocaleDateString('en-GB')}
                              </span>
                            </div>
                          </div>
                          {isMarked ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                              Score: {sub.score}/{hw.maxScore}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-200">
                              Assignment
                            </span>
                          )}
                        </div>
                        {isMarked && sub.teacherNote && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-white/60 dark:bg-[#181818]/60 p-2 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            &ldquo;{sub.teacherNote}&rdquo;
                          </p>
                        )}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onNavigateTab?.('activity');
                            }}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            Open Activity
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {(activeFilter === 'All' || activeFilter === 'Class Updates') && studentCancellations.length > 0 && (
                <div className="space-y-3">
                  {studentCancellations.map(c => {
                    const cls = classes.find(cl => cl.id === c.classId);
                    const isDismissed = dismissedNoticeIds.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 space-y-2.5 text-xs sm:text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <CalendarX className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {cls?.name || 'Class'} Cancelled
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                Original: {c.originalDate}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Class Update
                          </span>
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 leading-normal font-medium">
                          Class on <strong className="font-mono">{c.originalDate}</strong> is cancelled.
                          {c.makeupDate && (
                            <span> Makeup scheduled for <strong className="font-mono text-blue-600 dark:text-blue-400">{c.makeupDate}</strong>.</span>
                          )}
                        </p>

                        {c.reason && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-white/60 dark:bg-[#181818]/60 p-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            &ldquo;{c.reason}&rdquo;
                          </p>
                        )}

                        {!isDismissed && onDismissCancellation && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => onDismissCancellation(c.id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              Mark as Read
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(activeFilter === 'All' || activeFilter === 'Leave Requests') && requests.length > 0 && (
                <div className="space-y-3">
                  {requests.map(req => {
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
                          Leave Request &middot; Submitted on {new Date(req.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {requests.length === 0 && studentCancellations.length === 0 && (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold">No notifications found in this view.</p>
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
