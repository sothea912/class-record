import React, { useState } from 'react';
import {
  Users,
  Layers,
  CheckCircle2,
  FilePenLine,
  ArrowRight,
  Sparkles,
  Trophy,
  Mail,
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  UserPlus,
  KeyRound,
  Trash2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { AppState, NavView, StudentItem, AccountRequest } from '../types';
import { todayISO, attOf, studentsOf, subjectsOf, thisMonth, computeResults } from '../utils/helpers';
import { provisionStudentAuthAccount, resolveAccountRequest, deleteAccountRequest } from '../utils/firestoreSync';

interface OverviewViewProps {
  state: AppState;
  onNavigate: (view: NavView) => void;
  onSelectClass: (classId: string) => void;
  onTakeAttendance: (classId: string) => void;
  onSaveStudent?: (student: StudentItem, oldStudent?: StudentItem) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  onNavigate,
  onSelectClass,
  onTakeAttendance,
  onSaveStudent,
  onShowToast,
}) => {
  const today = todayISO();
  const currentMonth = thisMonth();
  const takenTodayCount = state.classes.filter(c => attOf(c.id, today, state)).length;
  const [syncingRequestId, setSyncingRequestId] = useState<string | null>(null);

  // Pending account requests
  const pendingRequests = (state.accountRequests || []).filter(r => r.status === 'pending');

  const handleSyncFromRequest = async (req: AccountRequest) => {
    const student = state.students.find(s => s.id === req.studentId);
    if (!student) {
      if (onShowToast) {
        onShowToast(`Student record for ${req.studentName} is missing from roster. Re-enroll student first.`, 'error');
      }
      return;
    }

    setSyncingRequestId(req.id);
    try {
      const res = await provisionStudentAuthAccount(student);
      if (res.status === 'created' || res.status === 'linked_existing') {
        const updatedStudent: StudentItem = {
          ...student,
          authUid: res.uid,
          authEmail: res.email,
          accountStatus: 'active',
        };
        if (onSaveStudent) {
          onSaveStudent(updatedStudent, student);
        }
        await resolveAccountRequest(req.id);
        if (onShowToast) {
          onShowToast(`Synced portal account for ${req.studentName} (${res.email})`, 'success');
        }
      } else {
        if (onShowToast) {
          onShowToast(`Sync failed: ${res.error || 'Authentication error'}`, 'error');
        }
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Error: ${err.message || String(err)}`, 'error');
      }
    } finally {
      setSyncingRequestId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await deleteAccountRequest(requestId);
      if (onShowToast) {
        onShowToast('Account request dismissed.', 'info');
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Dismiss error: ${err.message || String(err)}`, 'error');
      }
    }
  };

  // Compute top ranked student from active class if available
  const firstClassId = state.classes[0]?.id;
  const topResult = firstClassId
    ? computeResults(firstClassId, [currentMonth], state).rows[0]
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-800 to-indigo-900 dark:from-purple-800 dark:via-indigo-900 dark:to-purple-950 text-white p-6 sm:p-8 shadow-2xl shadow-blue-900/20 dark:shadow-purple-950/20 border border-blue-400/30 dark:border-purple-500/20 interactive-card">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-slate-900 dark:bg-black/40 dark:text-white backdrop-blur-md text-xs font-extrabold tracking-wide mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#FEA339]" />
            <span>Academic Management &amp; Preparation Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-sm text-white">
            Welcome back, {state.profile.name || 'Teacher'}
          </h1>
          <p className="mt-2 text-sm sm:text-base font-medium text-blue-100/90 dark:text-purple-200/90 leading-relaxed">
            {state.profile.school ? `${state.profile.school} · ` : ''}
            Today is {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
          </p>
        </div>

        {/* Ambient background blur shapes */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-400/20 dark:bg-[#FEA339]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 right-24 w-64 h-64 bg-indigo-500/30 dark:bg-[#77DDFA]/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="color-card-green p-5 rounded-3xl shadow-sm interactive-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Students</span>
            <div className="w-9 h-9 rounded-2xl bg-[#4BA95F]/20 text-[#4BA95F] flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {state.students.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-bold">enrolled</span>
          </div>
        </div>

        <div className="color-card-cyan p-5 rounded-3xl shadow-sm interactive-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active Classes</span>
            <div className="w-9 h-9 rounded-2xl bg-[#77DDFA]/25 text-[#0092c4] dark:text-[#77DDFA] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {state.classes.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-bold">timetables</span>
          </div>
        </div>

        <div className="color-card-amber p-5 rounded-3xl shadow-sm interactive-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Attendance Today</span>
            <div className="w-9 h-9 rounded-2xl bg-[#FEA339]/25 text-[#b8670c] dark:text-[#FEA339] flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {takenTodayCount}/{state.classes.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-bold">logged</span>
          </div>
        </div>

        <div className="color-card-purple p-5 rounded-3xl shadow-sm interactive-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Subjects Set Up</span>
            <div className="w-9 h-9 rounded-2xl bg-[#9985FB]/25 text-[#735ae8] dark:text-[#9985FB] flex items-center justify-center font-bold">
              <FilePenLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {state.subjects.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-bold">criteria</span>
          </div>
        </div>
      </div>

      {/* Main Classroom Action Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes Table (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Classroom Timetable &amp; Registers
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attendance status and enrollment across your classes
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('classes')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {state.classes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-3">
              <p className="text-sm font-medium">No classes set up yet</p>
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Create your first class
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {state.classes.map(c => {
                const enrolled = studentsOf(c.id, state);
                const att = attOf(c.id, today, state);
                let attendanceBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Not taken today
                  </span>
                );

                if (att) {
                  const records = Object.values(att.records || {});
                  const present = records.filter(r => r.status === 'P' || r.status === 'L').length;
                  attendanceBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {present}/{enrolled.length} present
                    </span>
                  );
                }

                return (
                  <div
                    key={c.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                          {c.name}
                        </span>
                        {c.level && (
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {(c.timeFrom || c.timeTo) && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {c.timeFrom}–{c.timeTo}
                          </span>
                        )}
                        {c.days && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {c.days}
                          </span>
                        )}
                        {c.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {c.room}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      {attendanceBadge}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectClass(c.id);
                          onTakeAttendance(c.id);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Take Attendance</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quick Workflows & Merit Spotlight */}
        <div className="space-y-6">
          {/* Account Requests Inbox Widget */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Student Account Requests
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                pendingRequests.length > 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {pendingRequests.length} pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-400">No pending student restoration requests.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-0.5">
                {pendingRequests.map(req => {
                  const student = state.students.find(s => s.id === req.studentId);
                  const isSyncing = syncingRequestId === req.id;

                  return (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{req.studentName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {req.studentNo ? `${req.studentNo} · ` : ''}ID: {req.studentId}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(req.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => handleSyncFromRequest(req)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Provision Firebase Auth account for this student"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>{isSyncing ? 'Syncing…' : 'Sync Student'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Dismiss / Delete request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                          &ldquo;{req.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merit / Top Performer Widget */}
          {topResult && (
            <div className="color-card-amber rounded-2xl p-5 shadow-sm interactive-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Class Leader &middot; {currentMonth}
                </span>
                <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                  Rank #1
                </span>
              </div>
              <div className="flex items-center gap-3">
                {topResult.student.photo ? (
                  <img
                    src={topResult.student.photo}
                    alt={topResult.student.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold flex items-center justify-center text-sm ring-2 ring-amber-400">
                    {topResult.student.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {topResult.student.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Score: <span className="font-semibold text-slate-800 dark:text-slate-200">{topResult.total}</span> / {topResult.max} ({topResult.pct}%)
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    Grade {topResult.grade} &middot; Outstanding attendance ({topResult.att.score} pts)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('permits')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/60 dark:border-slate-700/60 transition-all text-xs font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span>Parse Telegram Excuse Messages</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('results')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/60 dark:border-slate-700/60 transition-all text-xs font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Calculate Class Rankings</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('attreport')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/60 dark:border-slate-700/60 transition-all text-xs font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Download Monthly Attendance Word Doc</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
