import React, { useState, useEffect } from 'react';
import { Clock, UserX, Send, CheckCircle2 } from 'lucide-react';
import { submitAccountRequest } from '../utils/firestoreSync';

interface StudentSessionModalProps {
  status: 'unsyncing' | 'removed' | 'active' | null;
  studentId: string;
  studentName: string;
  studentNo?: string;
  onLogout: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudentSessionModal: React.FC<StudentSessionModalProps> = ({
  status,
  studentId,
  studentName,
  studentNo,
  onLogout,
  onShowToast,
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Handle Unsync 5-second countdown
  useEffect(() => {
    if (status === 'unsyncing') {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, onLogout]);

  // If status is normal/null, render nothing
  if (!status) return null;

  // Render Unsyncing Countdown Modal
  if (status === 'unsyncing') {
    const progressPct = ((5 - countdown) / 5) * 100;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Your account will log out in {countdown}…
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your teacher has unsynced your portal login. Your records are preserved, and your session will close now.
            </p>
          </div>

          {/* Loading / Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(100, Math.max(10, progressPct))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
              <span>Logging out</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{countdown}s remaining</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Log out now
          </button>
        </div>
      </div>
    );
  }

  // Render Removed / Deleted Modal
  const handleRequestNewAccount = async () => {
    setIsSubmitting(true);
    try {
      await submitAccountRequest(
        studentId,
        studentName,
        studentNo,
        'Student requested account restoration after removal'
      );
      setIsSubmitted(true);
      onShowToast('Request sent to your teacher!', 'success');
      setTimeout(() => {
        onLogout();
      }, 1600);
    } catch (err: any) {
      console.warn('Account request warning:', err);
      setIsSubmitted(true);
      setTimeout(() => {
        onLogout();
      }, 1600);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
          <UserX className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            You are no longer a user of this account.
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            This student account has been removed. If this was an accident or you need access restored, you may submit a request to your teacher.
          </p>
        </div>

        {isSubmitted ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Request sent to teacher! Returning to login screen…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRequestNewAccount}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Sending request…' : 'Request new account from teacher'}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Confirm & leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
