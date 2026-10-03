import React, { useState } from 'react';
import {
  CheckSquare,
  Trophy,
  Clock,
  Layers,
  FileText,
  Building,
  Navigation,
  Activity,
  Flame,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  ChevronRight,
  Info,
  X,
  Compass,
  GraduationCap,
  CalendarCheck,
  MapPin,
  Clock3,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import {
  AppState,
  StudentItem,
  ClassItem,
} from '../types';
import {
  todayISO,
  attOf,
  thisMonth,
  computeResults,
  round1,
  monthName,
  getAttendanceCredit,
  isSessionAfterEnrollment,
} from '../utils/helpers';
import { getLevelAndProgressFromXp } from '../utils/gamification';

interface StudentDashboardWidgetsProps {
  state: AppState;
  student: StudentItem;
  currentClassObj?: ClassItem;
  activityToDoCount?: number;
  onOpenLeaveRequestForm: () => void;
  onOpenLeaveResults: () => void;
  onOpenResourceLibrary: () => void;
  onOpenReportCard: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenScoresOverlay?: () => void;
}

export const StudentDashboardWidgets: React.FC<StudentDashboardWidgetsProps> = ({
  state,
  student,
  currentClassObj,
  activityToDoCount,
  onOpenLeaveRequestForm,
  onOpenLeaveResults,
  onOpenResourceLibrary,
  onOpenReportCard,
  onNavigateTab,
  onOpenScoresOverlay,
}) => {
  // Modal states for expanded cards
  const [activeModal, setActiveModal] = useState<'attendance' | 'rank' | 'schedule' | 'score' | 'subject_perf' | null>(null);

  // Data calculations
  const currentMonth = thisMonth();
  const activeClassId = currentClassObj?.id || state.classes[0]?.id || '';
  const periodResults = activeClassId ? computeResults(activeClassId, [currentMonth], state) : null;
  const myResult = periodResults?.rows.find(r => r.student.id === student.id);

  // Activity / To Do calculation (Homework, Quizzes, Exams open and not yet submitted)
  const studentEnrolledClassIds = student.classIds?.length
    ? student.classIds
    : currentClassObj
    ? [currentClassObj.id]
    : state.classes.length
    ? [state.classes[0].id]
    : [];

  const nowMs = Date.now();

  // Published Homework for student's classes
  const relevantHomework = (state.homework || []).filter(
    h => h.published && h.classIds.some(cId => studentEnrolledClassIds.includes(cId))
  );

  const pendingHomework = relevantHomework.filter(h => {
    // Check if student has submitted
    const isSubmitted = (state.homeworkSubmissions || []).some(
      s => s.homeworkId === h.id && s.studentId === student.id && (s.status === 'submitted' || s.status === 'marked')
    );
    if (isSubmitted) return false;

    // Check if open (not closed by deadline without late submissions allowed)
    const isPastDue = h.dueDateTime ? new Date(h.dueDateTime).getTime() < nowMs : false;
    const isClosed = isPastDue && h.allowLate === false;
    return !isClosed;
  });

  // Published Quizzes / Exams / Activities for student's classes
  const relevantActivities = (state.activities || []).filter(
    a => a.published && a.classIds.some(cId => studentEnrolledClassIds.includes(cId))
  );

  const pendingActivities = relevantActivities.filter(a => {
    // Check if student has submitted / completed
    const isSubmitted = (state.activityAttempts || []).some(
      att => att.activityId === a.id && att.studentId === student.id && (att.status === 'submitted' || att.status === 'marked' || att.status === 'auto_submitted')
    );
    if (isSubmitted) return false;

    // Check if currently open for student (between opensAt and closesAt if defined)
    const isOpen =
      (!a.opensAt || new Date(a.opensAt).getTime() <= nowMs) &&
      (!a.closesAt || new Date(a.closesAt).getTime() >= nowMs);
    return isOpen;
  });

  const totalToDo = pendingHomework.length + pendingActivities.length;
  const resolvedToDo = activityToDoCount !== undefined ? activityToDoCount : totalToDo;
  const activityDisplayValue = resolvedToDo > 0 ? `${resolvedToDo} To do` : 'All done';

  const handleOpenActivity = () => {
    onNavigateTab('activity');
  };

  // Attendance rate
  const classDuration = currentClassObj?.duration || 60;
  const studentAtt = (state.attendance || []).filter(
    a => (!activeClassId || a.classId === activeClassId) && isSessionAfterEnrollment(a.date, student) && a.records && a.records[student.id]?.status
  );
  const totalAttSessions = studentAtt.length;
  let totalCredit = 0;
  let presentCount = 0;
  studentAtt.forEach(a => {
    const rec = a.records[student.id];
    if (rec.status === 'P' || rec.status === 'L') presentCount++;
    totalCredit += getAttendanceCredit(rec, classDuration);
  });
  const attRate = totalAttSessions > 0 ? round1((totalCredit / totalAttSessions) * 100) : null;
  const attRateDisplay = attRate !== null ? `${attRate}%` : '—';

  // Streak/Level Calculations
  const xp = student.xp || 0;
  const { level, progressPct, title } = getLevelAndProgressFromXp(xp);

  return (
    <div className="space-y-6">
      {/* 6 Balanced Stat Metric Cards (Attendance, Class Rank, Schedule, Score, Subject Perf, Instructor) */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Attendance Card */}
        <button
          type="button"
          onClick={() => setActiveModal('attendance')}
          className="h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <CheckSquare className="w-5 h-5 animate-pulse-slow" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight">{attRateDisplay}</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Attendance</span>
        </button>

        {/* Class Rank Card */}
        <button
          type="button"
          onClick={() => setActiveModal('rank')}
          className="h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-amber-500/50 dark:hover:border-amber-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight">
            {myResult?.hasData && myResult?.rank !== null ? `#${myResult.rank}` : '—'}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Class Rank</span>
        </button>

        {/* Schedule Card */}
        <button
          type="button"
          onClick={() => setActiveModal('schedule')}
          className="h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-sky-500/50 dark:hover:border-sky-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight truncate max-w-full">
            {currentClassObj?.startTime || currentClassObj?.timeFrom || '20:00'}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Class Schedule</span>
        </button>

        {/* Score Card */}
        <button
          type="button"
          onClick={() => onOpenScoresOverlay?.()}
          className="h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Trophy className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight">
            {myResult?.hasData ? `${myResult.total} Pts` : '—'}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Score</span>
        </button>

        {/* Subject Performance Card */}
        <button
          type="button"
          onClick={() => setActiveModal('subject_perf')}
          className="h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight">
            {periodResults && periodResults.subs.length > 0 ? periodResults.subs.length : 0} Subs
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Subject Perf</span>
        </button>

        {/* Activity Card (Replaces Instructor Card) */}
        <button
          type="button"
          onClick={handleOpenActivity}
          className="relative h-[145px] sm:h-[155px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-md active:scale-95 shadow-xs group cursor-pointer"
        >
          {resolvedToDo > 0 && (
            <span
              className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5"
              title={`${resolvedToDo} to do`}
              aria-label="Activity action needed"
            >
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white dark:ring-[#121214] shadow-xs animate-dot-pulse" />
            </span>
          )}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight truncate max-w-full">
            {activityDisplayValue}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 leading-none">Activity</span>
        </button>
      </div>

      {/* MODALS / OVERLAYS FOR DETAILS */}
      {activeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Attendance Modal Content */}
            {activeModal === 'attendance' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Attendance Summary</h3>
                    <p className="text-xs text-slate-500">Live attendance overview for this semester</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present Count</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">{presentCount} sessions</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sessions</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">{totalAttSessions} sessions</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Attendance rate is calculated as total earned credit divided by sessions held so far this month (On-time: 1.0, Late: 0.75, Very late: 0.5, Excused: 0.5, Unexcused: 0).
                  </p>
                </div>
              </div>
            )}

            {/* Class Rank Modal Content */}
            {activeModal === 'rank' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Academic Standing &amp; Rank</h3>
                    <p className="text-xs text-slate-500">How you rank compared to your school classmates</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Current Level</span>
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">Level {level} &middot; {title}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block text-right">{progressPct}% to Level {level + 1}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Rank</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
                      {myResult?.hasData && myResult?.rank !== null ? `#${myResult.rank}` : '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Enrolled</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">{state.students.length} students</span>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Modal Content */}
            {activeModal === 'schedule' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Class Schedule Details</h3>
                    <p className="text-xs text-slate-500">Your specific class timetable information</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Days &amp; Availability</p>
                      <p className="text-[11px] text-slate-500">{currentClassObj?.days || 'Monday - Friday'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Time slot</p>
                      <p className="text-[11px] text-slate-500">
                        {currentClassObj?.timeFrom || '19:00'} - {currentClassObj?.timeTo || '20:30'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-rose-500" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Room/Location</p>
                      <p className="text-[11px] text-slate-500">{currentClassObj?.room || 'Online Classroom'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* Academic Subject Performance Details */}
            {activeModal === 'subject_perf' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subject Performance</h3>
                    <p className="text-xs text-slate-500">Breakdown of specific study components</p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 max-h-64 overflow-y-auto pr-1">
                  {periodResults && periodResults.subs.length > 0 ? (
                    periodResults.subs.map(sub => {
                      const scoreObj = myResult?.per[sub.id];
                      const pct = scoreObj?.pct || 0;
                      return (
                        <div key={sub.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{sub.name}</span>
                            <span className="font-bold text-slate-900 dark:text-white font-mono">{scoreObj?.got || 0} / {sub.max} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">No subject scores recorded yet.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenReportCard();
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download Full Report Card</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
