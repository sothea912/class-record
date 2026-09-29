import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, X, Send, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { AppState, ClassItem, StudentPermissionRequest } from '../types';
import { todayISO, uid } from '../utils/helpers';
import { syncSavePermission } from '../utils/firestoreSync';

interface LeaveRequestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  studentId: string;
  studentClasses: ClassItem[];
  onSubmitPermission: (req: StudentPermissionRequest) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const CATEGORIES = [
  'Health & Medical',
  'Family Emergency',
  'Personal Matter',
  'Official School Event',
  'Transportation / Weather',
];

export const LeaveRequestFormModal: React.FC<LeaveRequestFormModalProps> = ({
  isOpen,
  onClose,
  state,
  studentId,
  studentClasses,
  onSubmitPermission,
  onShowToast,
  triggerButtonRef,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const initialClassId = studentClasses[0]?.id || state.classes[0]?.id || '';
  const [permClassId, setPermClassId] = useState<string>(initialClassId);
  const [permDate, setPermDate] = useState<string>(todayISO());
  const [permCategory, setPermCategory] = useState<string>(CATEGORIES[0]);
  const [permReason, setPermReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync selected class when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!permClassId && (studentClasses[0]?.id || state.classes[0]?.id)) {
        setPermClassId(studentClasses[0]?.id || state.classes[0]?.id || '');
      }
    }
  }, [isOpen, studentClasses, state.classes, permClassId]);

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

  // Existing submitted requests for this student
  const myRequests = (state.studentPermissions || []).filter(p => p.studentId === studentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permClassId) {
      onShowToast('Please select a class for your permission request', 'error');
      return;
    }
    if (!permReason.trim()) {
      onShowToast('Please enter a reason for your absence excuse', 'error');
      return;
    }

    setIsSubmitting(true);
    const req: StudentPermissionRequest = {
      id: uid('perm'),
      studentId,
      classId: permClassId,
      date: permDate,
      reason: permReason.trim(),
      category: permCategory,
      createdAt: new Date().toISOString(),
      status: 'Pending',
    };

    try {
      onSubmitPermission(req);
      await syncSavePermission(req);
      setPermReason('');
      onShowToast('Leave permission request submitted successfully!', 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Failed to submit request: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-form-title"
        >
          {/* Backdrop */}
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
            className="relative z-10 w-[92%] max-w-[560px] max-h-[85vh] bg-white dark:bg-[#141414] border border-slate-200/90 dark:border-[#2a2a2a] rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white focus:outline-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="leave-form-title" className="text-base sm:text-lg font-bold leading-tight">
                    Request Leave / Permission
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Submit absence excuse or leave request directly to your instructor
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

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Classroom / Timetable
                    </label>
                    <select
                      value={permClassId}
                      onChange={e => setPermClassId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {(studentClasses.length > 0 ? studentClasses : state.classes).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.level ? `(${c.level})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Absence Date
                    </label>
                    <input
                      type="date"
                      required
                      value={permDate}
                      onChange={e => setPermDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category of Reason
                  </label>
                  <select
                    value={permCategory}
                    onChange={e => setPermCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Detailed Reason for Absence
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={permReason}
                    onChange={e => setPermReason(e.target.value)}
                    placeholder="e.g. Attending a medical appointment, fever, family commitment..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>{isSubmitting ? 'Submitting Request…' : 'Submit Permission Request'}</span>
                </button>
              </form>

              {/* Compact Submitted Requests List Below Form */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                    My Submitted Requests ({myRequests.length})
                  </span>
                </div>

                {myRequests.length > 0 ? (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {myRequests.slice(0, 5).map(req => {
                      const isApproved = req.status === 'Approved' || req.status === 'Acknowledged';
                      const isDenied = req.status === 'Denied';
                      const isPending = req.status === 'Pending';

                      return (
                        <div
                          key={req.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200/60 dark:border-[#282828] text-xs flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-slate-900 dark:text-white">{req.date}</span>
                              <span className="text-[10px] text-slate-500 truncate">({req.category})</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{req.reason}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border flex items-center gap-1 ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isDenied
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isApproved && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />}
                            {isDenied && <XCircle className="w-2.5 h-2.5 text-rose-500" />}
                            {isPending && <Clock className="w-2.5 h-2.5 text-amber-500" />}
                            <span>{req.status}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                    No leave requests submitted yet.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
