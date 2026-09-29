import React, { useState } from 'react';
import {
  CheckSquare,
  Calendar,
  Save,
  CheckCircle2,
  Clock,
  Mail,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  Search,
  CalendarX,
} from 'lucide-react';
import { AppState, AttendanceRecord, AttendanceSession, AttendanceStatus, ClassCancellationItem } from '../types';
import {
  attKey,
  attOf,
  calcJoinedAtFromMinutes,
  calcMinutesLateFromJoinedAt,
  getLatenessInfo,
  sortStudents,
  studentsOf,
  todayISO,
  uid,
} from '../utils/helpers';
import { Modal } from '../components/Modal';

interface AttendanceViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
  onSaveCancellation: (item: ClassCancellationItem) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onSaveAttendance,
  onSaveCancellation,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [date, setDate] = useState<string>(todayISO());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [filterMode, setFilterMode] = useState<'all' | 'unmarked' | 'absent'>('all');
  const [search, setSearch] = useState('');

  // Cancel / Reschedule Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelOriginalDate, setCancelOriginalDate] = useState(date);
  const [cancelMakeupDate, setCancelMakeupDate] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelMarkCancelled, setCancelMarkCancelled] = useState(true);

  const handleSaveCancellation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;
    if (!cancelOriginalDate) {
      alert('Please specify the original class date.');
      return;
    }
    if (!cancelReason.trim()) {
      alert('Please provide a reason / message for students.');
      return;
    }

    const item: ClassCancellationItem = {
      id: uid('cancel'),
      classId: currentClass.id,
      originalDate: cancelOriginalDate,
      makeupDate: cancelMakeupDate.trim() || undefined,
      reason: cancelReason.trim(),
      markCancelled: cancelMarkCancelled,
      createdAt: new Date().toISOString(),
    };

    onSaveCancellation(item);
    setIsCancelModalOpen(false);
    alert('Class cancellation / reschedule notice published to students successfully!');
  };

  const classStartTime = currentClass?.startTime || currentClass?.timeFrom || '20:00';
  const classDuration = currentClass?.duration || 60;

  // Working draft records for the selected class & date
  const existingSession = currentClass ? attOf(currentClass.id, date, state) : null;
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(
    existingSession ? { ...existingSession.records } : {}
  );

  // When class or date changes, sync draft and prefill from class_joins if not already marked
  React.useEffect(() => {
    if (!currentClass) return;
    const session = attOf(currentClass.id, date, state);
    const initialRecords: Record<string, AttendanceRecord> = session ? { ...session.records } : {};

    // Check class_joins for this class and date
    const joinsForSession = (state.classJoins || []).filter(
      j => j.classId === currentClass.id && j.date === date
    );

    joinsForSession.forEach(j => {
      if (!initialRecords[j.studentId]?.status) {
        const isLate = (j.minutesLate ?? 0) > 0;
        const timeFormatted = j.joinedAt
          ? new Date(j.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          : '';
        initialRecords[j.studentId] = {
          status: isLate ? 'L' : 'P',
          minutesLate: isLate ? j.minutesLate : 0,
          joinedAt: timeFormatted || calcJoinedAtFromMinutes(classStartTime, j.minutesLate ?? 0),
          reason: isLate ? `Self check-in at ${timeFormatted} (+${j.minutesLate}m late)` : `Self check-in at ${timeFormatted}`,
        };
      }
    });

    setRecords(initialRecords);
  }, [currentClass?.id, date, state.attendance, state.classJoins]);

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 max-w-xl mx-auto">
        <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No classes found</h3>
        <p className="text-xs text-slate-500">Create a class before recording attendance.</p>
      </div>
    );
  }

  const enrolledStudents = studentsOf(currentClass.id, state);
  const pastSessions = [...new Set(state.attendance.filter(a => a.classId === currentClass.id).map(a => a.date))].sort().reverse();

  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(prev => {
      const existing = prev[studentId] || { status: 'P' };
      const nextRec: AttendanceRecord = {
        ...existing,
        status,
      };
      if (status === 'P') {
        nextRec.minutesLate = 0;
      } else if (status === 'L') {
        if (nextRec.minutesLate === undefined || nextRec.minutesLate === null) {
          nextRec.minutesLate = 10;
          nextRec.joinedAt = calcJoinedAtFromMinutes(classStartTime, 10);
        }
      }
      return {
        ...prev,
        [studentId]: nextRec,
      };
    });
  };

  const handleSetMinutesLate = (studentId: string, minutes: number) => {
    const mins = Math.max(0, minutes);
    setRecords(prev => {
      const existing = prev[studentId] || { status: 'L' as AttendanceStatus };
      const joinedAt = calcJoinedAtFromMinutes(classStartTime, mins);
      return {
        ...prev,
        [studentId]: {
          ...existing,
          status: 'L',
          minutesLate: mins,
          joinedAt,
        },
      };
    });
  };

  const handleSetJoinedAt = (studentId: string, joinedAtTime: string) => {
    const mins = calcMinutesLateFromJoinedAt(classStartTime, joinedAtTime);
    setRecords(prev => {
      const existing = prev[studentId] || { status: 'L' as AttendanceStatus };
      return {
        ...prev,
        [studentId]: {
          ...existing,
          status: 'L',
          minutesLate: mins,
          joinedAt: joinedAtTime,
        },
      };
    });
  };

  const handleSetReason = (studentId: string, reason: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'E' as AttendanceStatus }),
        reason,
      },
    }));
  };

  const handleMarkAllPresent = () => {
    const next: Record<string, AttendanceRecord> = { ...records };
    enrolledStudents.forEach(s => {
      next[s.id] = { status: 'P', minutesLate: 0, reason: next[s.id]?.reason || '' };
    });
    setRecords(next);
  };

  const handleSave = () => {
    const session: AttendanceSession = {
      id: attKey(currentClass.id, date),
      classId: currentClass.id,
      date,
      records,
      savedAt: new Date().toISOString(),
    };
    onSaveAttendance(session);
  };

  // Status stats
  let countP = 0, countL = 0, countE = 0, countU = 0, countMarked = 0;
  enrolledStudents.forEach(s => {
    const r = records[s.id];
    if (r?.status) {
      countMarked++;
      if (r.status === 'P') countP++;
      else if (r.status === 'L') countL++;
      else if (r.status === 'E') countE++;
      else if (r.status === 'U') countU++;
    }
  });

  // Filter student list
  let displayed = enrolledStudents;
  if (filterMode === 'unmarked') {
    displayed = displayed.filter(s => !records[s.id]?.status);
  } else if (filterMode === 'absent') {
    displayed = displayed.filter(s => {
      const st = records[s.id]?.status;
      return st === 'L' || st === 'E' || st === 'U';
    });
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    displayed = displayed.filter(s => s.name.toLowerCase().includes(q) || (s.studentNo && s.studentNo.toLowerCase().includes(q)));
  }

  const sortedList = sortStudents(displayed, 'name');

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Session Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Class picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Class
              </label>
              <select
                value={currentClass.id}
                onChange={e => onSelectClassId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                {state.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Register Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>

            {/* Past dates jump */}
            {pastSessions.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  History Jump
                </label>
                <select
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none max-w-[180px] truncate"
                >
                  <option value={todayISO()}>Today ({todayISO()})</option>
                  {pastSessions.map(d => (
                    <option key={d} value={d}>
                      {d} {d === todayISO() ? '(Today)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200/70 dark:border-blue-900 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Register</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCancelOriginalDate(date);
                setCancelMakeupDate('');
                setCancelReason('');
                setCancelMarkCancelled(true);
                setIsCancelModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-200/70 dark:border-rose-900 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <CalendarX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Reschedule / Cancel Class</span>
            </button>
          </div>
        </div>

        {/* Live Attendance Counters & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
              <span>{countMarked}/{enrolledStudents.length} Marked</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{countP} Present</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{countL} Late</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
              <Mail className="w-3.5 h-3.5 text-indigo-500" />
              <span>{countE} Excused</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>{countU} Unexcused</span>
            </div>
          </div>

          {/* Filter options */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unmarked')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'unmarked'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Unmarked
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('absent')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'absent'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Late/Absent
              </button>
            </div>

            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1 rounded-lg ${
                  viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1 rounded-lg ${
                  viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Register */}
      {sortedList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <p className="text-sm font-semibold">No students to display</p>
          <p className="text-xs">All students may have been marked, or no students are enrolled in this class.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4 w-72">Attendance Status</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sortedList.map(s => {
                  const rec = records[s.id] || {};
                  const currentStatus = rec.status;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        currentStatus === 'U'
                          ? 'bg-rose-50/20'
                          : currentStatus === 'E'
                          ? 'bg-indigo-50/20'
                          : currentStatus === 'L'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {s.photo ? (
                            <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {s.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{s.studentNo || '—'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status Buttons & Inline Lateness Controls */}
                      <td className="py-3 px-4">
                        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetStatus(s.id, 'P')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'P'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(s.id, 'L')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'L'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-500 hover:text-amber-700 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            Late
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(s.id, 'E')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'E'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-indigo-700 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            Excused
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(s.id, 'U')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'U'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-rose-700 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            Unexcused
                          </button>
                        </div>

                        {/* Inline Lateness Configuration Widget */}
                        {currentStatus === 'L' && (
                          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2 max-w-md">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
                                  Minutes late:
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={240}
                                  value={rec.minutesLate ?? 10}
                                  onChange={e => handleSetMinutesLate(s.id, Number(e.target.value))}
                                  className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-950 dark:text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                {[5, 10, 15, 20, 30].map(chip => (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() => handleSetMinutesLate(s.id, chip)}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                                      (rec.minutesLate ?? 10) === chip
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    {chip}m
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40 text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 dark:text-slate-400">Joined at:</span>
                                <input
                                  type="time"
                                  value={rec.joinedAt || calcJoinedAtFromMinutes(classStartTime, rec.minutesLate ?? 10)}
                                  onChange={e => handleSetJoinedAt(s.id, e.target.value)}
                                  className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                                />
                              </div>

                              {(() => {
                                const info = getLatenessInfo(rec.minutesLate ?? 10, classDuration);
                                return (
                                  <span className={`px-2 py-0.5 rounded-md font-bold ${info.badgeColor}`}>
                                    {info.label} ({info.credit} credit)
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Reason Field */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rec.reason || ''}
                          onChange={e => handleSetReason(s.id, e.target.value)}
                          placeholder="Note for late arrival or excused leave…"
                          className="w-full max-w-md px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedList.map(s => {
            const rec = records[s.id] || {};
            const currentStatus = rec.status;

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  {s.photo ? (
                    <img src={s.photo} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</h4>
                    <p className="text-[11px] font-mono text-slate-400">{s.studentNo || 'No ID'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSetStatus(s.id, 'P')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentStatus === 'P' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    P
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStatus(s.id, 'L')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentStatus === 'L' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStatus(s.id, 'E')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentStatus === 'E' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    E
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStatus(s.id, 'U')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentStatus === 'U' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    U
                  </button>
                </div>

                {/* Inline Lateness Configuration for Card View */}
                {currentStatus === 'L' && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200">Late:</span>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={rec.minutesLate ?? 10}
                          onChange={e => handleSetMinutesLate(s.id, Number(e.target.value))}
                          className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-950 dark:text-amber-100 focus:outline-none font-mono"
                        />
                        <span className="text-[10px] text-slate-400">mins</span>
                      </div>

                      {(() => {
                        const info = getLatenessInfo(rec.minutesLate ?? 10, classDuration);
                        return (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${info.badgeColor}`}>
                            {info.label} ({info.credit}c)
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1">
                      {[5, 10, 15, 20, 30].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleSetMinutesLate(s.id, chip)}
                          className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-all ${
                            (rec.minutesLate ?? 10) === chip
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {chip}m
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                      <span className="text-slate-500 dark:text-slate-400">Joined at:</span>
                      <input
                        type="time"
                        value={rec.joinedAt || calcJoinedAtFromMinutes(classStartTime, rec.minutesLate ?? 10)}
                        onChange={e => handleSetJoinedAt(s.id, e.target.value)}
                        className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  value={rec.reason || ''}
                  onChange={e => handleSetReason(s.id, e.target.value)}
                  placeholder="Reason / note…"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule / Cancel Class Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Reschedule / Cancel Class"
      >
        <form onSubmit={handleSaveCancellation} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Original Class Date *
            </label>
            <input
              type="date"
              value={cancelOriginalDate}
              onChange={e => setCancelOriginalDate(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Makeup Date (optional)
            </label>
            <input
              type="date"
              value={cancelMakeupDate}
              onChange={e => setCancelMakeupDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Can be any day including weekends or event days.</span>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Message / Reason *
            </label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Short explanation for students..."
              rows={3}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="markCancelledCheck"
              checked={cancelMarkCancelled}
              onChange={e => setCancelMarkCancelled(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <label htmlFor="markCancelledCheck" className="font-medium text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              Mark original day as Cancelled (does not affect student attendance)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
            >
              Publish Notice
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
