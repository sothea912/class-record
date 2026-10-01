import React, { useState } from 'react';
import { 
  Mail, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Trash2, 
  CheckCheck, 
  Send, 
  X, 
  MessageSquare, 
  Calendar, 
  User, 
  Clock, 
  ShieldCheck, 
  Info,
  CheckCircle,
  XCircle,
  MessageCircle
} from 'lucide-react';
import { AppState, AttendanceStatus, StudentPermissionRequest } from '../types';
import { attKey, formatRequestDateTime, studentsOf, uid } from '../utils/helpers';

interface PermitsViewProps {
  state: AppState;
  onApplyPermits: (
    items: {
      classId: string;
      date: string;
      studentId: string;
      status: AttendanceStatus;
      reason: string;
    }[]
  ) => void;
  onUpdatePermissionStatus?: (id: string, status: 'Approved' | 'Denied') => void;
  onAddManualPermission?: (req: StudentPermissionRequest) => void;
}

export const PermitsView: React.FC<PermitsViewProps> = ({ 
  state, 
  onApplyPermits,
  onUpdatePermissionStatus,
  onAddManualPermission
}) => {
  // Section A: Manual Form states
  const [manualClassId, setManualClassId] = useState(state.classes[0]?.id || '');
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualCategory, setManualCategory] = useState('Health & Medical');
  const [manualReason, setManualReason] = useState('');

  // Sorting and filtering states
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'All'>('Pending');
  const [sortBy, setSortBy] = useState<'Date' | 'StudentName' | 'StudentID'>('Date');

  // Webhook states
  const [appUrlInput, setAppUrlInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  });
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false);
  const [showWebhookSetup, setShowWebhookSetup] = useState(false);

  // Local feedback message
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showLocalToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Synchronize student list when manualClassId changes
  const classStudents = manualClassId ? studentsOf(manualClassId, state) : [];

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClassId) {
      showLocalToast('Please select a class first.', 'error');
      return;
    }
    if (!manualStudentId) {
      showLocalToast('Please select a student.', 'error');
      return;
    }
    if (!manualReason.trim()) {
      showLocalToast('Please enter a detailed reason.', 'error');
      return;
    }

    const studentObj = state.students.find(s => s.id === manualStudentId);
    if (!studentObj) return;

    const nowIso = new Date().toISOString();
    const req: StudentPermissionRequest = {
      id: uid('perm'),
      studentId: manualStudentId,
      classId: manualClassId,
      date: manualDate,
      reason: manualReason.trim(),
      category: manualCategory,
      createdAt: nowIso,
      status: 'Approved', // Manual teacher-logged excuses are approved by default
      decidedAt: nowIso,
    };

    if (onAddManualPermission) {
      onAddManualPermission(req);
      setManualReason('');
      showLocalToast(`Excuse logged successfully for ${studentObj.name}!`, 'success');
    } else {
      showLocalToast('Manual excuse addition not configured.', 'error');
    }
  };

  const handleStatusChange = (id: string, newStatus: 'Approved' | 'Denied') => {
    if (onUpdatePermissionStatus) {
      onUpdatePermissionStatus(id, newStatus);
    } else {
      showLocalToast('Status update handler is missing.', 'error');
    }
  };

  const handleSetupWebhook = async () => {
    if (!appUrlInput) {
      showLocalToast('Please enter a valid App URL.', 'error');
      return;
    }
    setIsSettingUpWebhook(true);
    try {
      const res = await fetch('/api/telegram-webhook-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: appUrlInput }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to configure Telegram webhook.');
      }
      showLocalToast('Telegram Webhook registered successfully!', 'success');
      setShowWebhookSetup(false);
    } catch (err: any) {
      console.error('[Webhook Setup Error]:', err);
      showLocalToast(`Setup failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSettingUpWebhook(false);
    }
  };

  // Filter permission requests
  const filteredPermissions = (state.studentPermissions || []).filter(p => {
    if (filterStatus === 'Pending') {
      return p.status === 'Pending';
    }
    return true; // Show all
  });

  // Sort permission requests
  const sortedPermissions = [...filteredPermissions].sort((a, b) => {
    if (sortBy === 'StudentName') {
      const studentA = state.students.find(s => s.id === a.studentId)?.name || '';
      const studentB = state.students.find(s => s.id === b.studentId)?.name || '';
      return studentA.localeCompare(studentB);
    }
    if (sortBy === 'StudentID') {
      const studentA = state.students.find(s => s.id === a.studentId)?.studentNo || '';
      const studentB = state.students.find(s => s.id === b.studentId)?.studentNo || '';
      return studentA.localeCompare(studentB);
    }
    // Default to Date (newest first)
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
            : toast.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          {toast.type === 'success' && <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Intro Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
          <Mail className="w-4 h-4" />
          <span>Absence &amp; Leave Request Center</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Manage Student Leave Permissions
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
          Log manual excuses directly, or approve/deny leave requests submitted in real-time by students from their portals. Approved requests instantly register as 'Excused' on the class attendance sheets.
        </p>
      </div>

      {/* SECTION A: MANUAL ENTRY FORM */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Section A — Submit Absence &amp; Permission Excuse (Manual Entry)
          </h3>
        </div>

        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Class Select */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Select Class
            </label>
            <select
              value={manualClassId}
              onChange={e => {
                setManualClassId(e.target.value);
                setManualStudentId(''); // reset student
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="">— Select Class —</option>
              {state.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Student Select */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Select Student
            </label>
            <select
              value={manualStudentId}
              onChange={e => setManualStudentId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
              disabled={!manualClassId}
            >
              <option value="">— Select Student —</option>
              {classStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.studentNo ? `(${s.studentNo})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Absence Date */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Absence Date
            </label>
            <input
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
            />
          </div>

          {/* Reason Category */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Reason Category
            </label>
            <select
              value={manualCategory}
              onChange={e => setManualCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="Health & Medical">Health / Medical Leave</option>
              <option value="Family Obligation">Family Obligation / Event</option>
              <option value="University Study">University / School Exam</option>
              <option value="Work Overtime">Work / Shift Conflict</option>
              <option value="Travel">Travel / Emergency</option>
              <option value="Other">Other Personal Reason</option>
            </select>
          </div>

          {/* Reason text */}
          <div className="md:col-span-2 space-y-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Detailed Reason
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualReason}
                onChange={e => setManualReason(e.target.value)}
                placeholder="e.g. Attending a sister's wedding or doctor appointment"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm shrink-0 active:scale-95 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Log Excuse</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION B: LIVE STUDENT-SUBMITTED REQUESTS GALLERY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-6">
        
        {/* Header Block & Telegram sync status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Section B — Live Student-Submitted Leave Requests ({sortedPermissions.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review and act on leave/excuse permissions requested by students from their personal student portals.
            </p>
          </div>

          {/* Bot connection pill card with Actionable Setup Button */}
          <div className="px-4 py-2.5 rounded-xl border bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 flex flex-col gap-2 max-w-sm w-full">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${state.telegramConfig ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
              <div className="text-[11px] leading-relaxed flex-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Telegram One-Way Notification Bot</span>
                {state.telegramConfig ? (
                  <span className="text-slate-500 text-[10px]">
                    Linked: <strong className="text-emerald-600 font-semibold">{state.telegramConfig.name}</strong> (@{state.telegramConfig.username || 'user'})
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-[10px]">
                    Bot Token saved. Send <strong className="text-amber-600">/start</strong> to sync!
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWebhookSetup(!showWebhookSetup)}
              className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-left underline underline-offset-2 flex items-center gap-1 self-start"
            >
              ⚙️ {showWebhookSetup ? 'Hide Setup Console' : 'Setup Webhook for Live Netlify'}
            </button>
          </div>
        </div>

        {/* Telegram Webhook Setup Panel */}
        {showWebhookSetup && (
          <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10 space-y-3 max-w-2xl text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <span>🔧 Live Webhook Configuration</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              To capture your Telegram Chat ID in serverless environments (like Netlify) without long-polling, register your live app URL with Telegram. Telegram will push events (like your <strong>/start</strong> message) directly on-demand.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                type="text"
                value={appUrlInput}
                onChange={e => setAppUrlInput(e.target.value)}
                placeholder="e.g. https://your-site.netlify.app"
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSetupWebhook}
                disabled={isSettingUpWebhook}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSettingUpWebhook ? (
                  <span>Registering...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Register Webhook</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed italic">
              * Note: Make sure to send <strong>/start</strong> to the bot after registering the webhook to capture your Chat ID!
            </div>
          </div>
        )}

        {/* Sorting and Filtering Control Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Filter Status:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setFilterStatus('Pending')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  filterStatus === 'Pending'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Pending Requests
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('All')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  filterStatus === 'All'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                All Requests
              </button>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-500 font-medium whitespace-nowrap">Sort By:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none font-medium w-full sm:w-auto"
            >
              <option value="Date">Date (Newest)</option>
              <option value="StudentName">Student Name</option>
              <option value="StudentID">Student ID</option>
            </select>
          </div>
        </div>

        {/* Gallery / List View */}
        {sortedPermissions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedPermissions.map(p => {
              const studentObj = state.students.find(s => s.id === p.studentId);
              const classObj = state.classes.find(c => c.id === p.classId);

              return (
                <div 
                  key={p.id} 
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all bg-white dark:bg-slate-900 shadow-sm ${
                    p.status === 'Approved' 
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/10' 
                      : p.status === 'Denied'
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {/* Card content top */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{studentObj?.name || 'Unknown Student'}</span>
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>ID: {studentObj?.studentNo || studentObj?.id || '—'}</span>
                          <span className="text-slate-300">•</span>
                          <span>Class: <strong className="font-semibold">{classObj?.name || p.classId}</strong></span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'Approved'
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          : p.status === 'Denied'
                          ? 'bg-rose-100 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                          : 'bg-amber-100 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                      }`}>
                        {p.status === 'Approved' ? 'Approved (Excused)' : p.status === 'Denied' ? 'Denied' : 'Pending Request'}
                      </span>
                    </div>

                    {/* Excuse Details Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>Leave Date: <strong className="font-mono text-slate-900 dark:text-white">{p.date}</strong></span>
                      </div>
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        Category: {p.category || 'General Leave'}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans mt-1">
                        "{p.reason}"
                      </p>
                    </div>
                  </div>

                  {/* Card actions bottom */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Submitted: {formatRequestDateTime(p.createdAt) || 'Today'}</span>
                    </span>

                    {p.status === 'Pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(p.id, 'Denied')}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-950/50 dark:text-rose-300 rounded-lg text-[11px] font-bold border border-rose-200/50 dark:border-rose-900/40 flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Deny</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(p.id, 'Approved')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Grant Leave</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-medium text-slate-400 italic flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
                        <span>
                          {p.status === 'Approved' ? 'Granted' : 'Denied'}
                          {p.decidedAt ? ` · ${formatRequestDateTime(p.decidedAt)}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-400 space-y-2">
            <Mail className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">No Matching Leave Requests</h4>
            <p className="text-[11px]">There are no student-submitted leave requests matching your filter and sort choices.</p>
          </div>
        )}
      </div>
    </div>
  );
};
