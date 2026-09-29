import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Mail,
  AlertCircle,
  FileText,
  Trash2,
} from 'lucide-react';
import { AppState, AttendanceStatus, AttendanceSession } from '../types';
import { attOf, monthName, round1, studentsOf, thisMonth } from '../utils/helpers';
import { downloadWordDoc } from '../utils/wordExport';
import { downloadAttendanceExcel } from '../utils/excelExport';
import { Modal } from '../components/Modal';

interface AttendanceReportViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onSaveAttendance: (session: AttendanceSession) => void;
}

export const AttendanceReportView: React.FC<AttendanceReportViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onSaveAttendance,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonth());
  const [selectedDay, setSelectedDay] = useState<string>('');

  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    studentName: string;
    date: string;
    status: AttendanceStatus | '';
    reason: string;
  } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const handleCellClick = (
    studentId: string,
    studentName: string,
    dateStr: string,
    rec?: { status?: AttendanceStatus; reason?: string }
  ) => {
    setEditingCell({
      studentId,
      studentName,
      date: dateStr,
      status: rec?.status || '',
      reason: rec?.reason || '',
    });
    setConfirmDelete(false);
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    const { studentId, date, status, reason } = editingCell;

    // Find existing session for this date & class
    const session = state.attendance.find(a => a.classId === currentClass.id && a.date === date);
    if (!session) return; // Should always exist since column was selected from 'days'

    // Clone records
    const updatedRecords = { ...session.records };

    if (!status) {
      // Revert/clear cell
      delete updatedRecords[studentId];
    } else {
      updatedRecords[studentId] = {
        status,
        reason: (status === 'E' || status === 'U' || status === 'L') ? reason : '',
      };
    }

    const updatedSession: AttendanceSession = {
      ...session,
      records: updatedRecords,
      savedAt: new Date().toISOString(),
    };

    onSaveAttendance(updatedSession);
    setEditingCell(null);
  };

  const handleConfirmDelete = () => {
    if (!editingCell) return;
    const { studentId, date } = editingCell;

    const session = state.attendance.find(a => a.classId === currentClass.id && a.date === date);
    if (session) {
      const updatedRecords = { ...session.records };
      delete updatedRecords[studentId];

      const updatedSession: AttendanceSession = {
        ...session,
        records: updatedRecords,
        savedAt: new Date().toISOString(),
      };

      onSaveAttendance(updatedSession);
    }
    setEditingCell(null);
    setConfirmDelete(false);
  };

  const handleExportExcel = async () => {
    try {
      await downloadAttendanceExcel(currentClass, selectedMonth, studentRows, days);
    } catch (err) {
      console.error('Failed to generate Excel report:', err);
      alert('Failed to generate Excel report. Please try again.');
    }
  };

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No class selected.
      </div>
    );
  }

  const list = studentsOf(currentClass.id, state);
  const days = state.attendance
    .filter(a => a.classId === currentClass.id && a.date.startsWith(selectedMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Totals for this month
  const tot = { P: 0, L: 0, E: 0, U: 0 };
  const studentRows = list.map(s => {
    const k: Record<AttendanceStatus, number> = { P: 0, L: 0, E: 0, U: 0 };
    const reasons: string[] = [];
    days.forEach(d => {
      const r = (d.records || {})[s.id];
      if (r && r.status) {
        k[r.status]++;
        if (r.reason) reasons.push(`${d.date.slice(8)}/${d.date.slice(5, 7)}: ${r.reason}`);
      }
    });
    tot.P += k.P;
    tot.L += k.L;
    tot.E += k.E;
    tot.U += k.U;
    const marked = k.P + k.L + k.E + k.U;
    const rate = marked ? Math.round(((k.P + k.L) / marked) * 100) : 0;
    return {
      student: s,
      k,
      rate,
      reasons,
    };
  });

  const exportMonthlyWord = () => {
    if (!days.length) {
      alert('Nothing recorded yet for this month');
      return;
    }
    const rowsHtml = studentRows
      .map(
        r => `<tr>
          <td><b>${r.student.name}</b></td>
          <td class="num">${r.k.P}</td>
          <td class="num">${r.k.L}</td>
          <td class="num">${r.k.E}</td>
          <td class="num">${r.k.U}</td>
          <td class="num"><b>${r.rate}%</b></td>
          <td class="muted">${r.reasons.join(' · ') || '—'}</td>
        </tr>`
      )
      .join('');

    const body = `
      <table class="stats"><tr>
        <td><b>${tot.P}</b> present</td><td><b>${tot.L}</b> late</td><td><b>${tot.E}</b> excused</td><td><b>${tot.U}</b> unexcused</td>
      </tr></table>
      <table>
        <thead>
          <tr>
            <th>Student</th><th class="num">Present</th><th class="num">Late</th><th class="num">Excused</th><th class="num">Unexcused</th><th class="num">Attendance Rate</th><th>Reasons Provided</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;

    const subtitle = `${monthName(selectedMonth)} · ${days.length} session${days.length === 1 ? '' : 's'} · ${state.profile.school || ''} · Teacher: ${state.profile.name || ''}`;
    downloadWordDoc(
      `Attendance_${currentClass.name.replace(/\s+/g, '_')}_${selectedMonth}`,
      `Attendance Report — ${currentClass.name}`,
      subtitle,
      body
    );
  };

  const exportDayWord = () => {
    const d = days.find(x => x.date === selectedDay);
    if (!d) return;
    const rowsHtml = list
      .map(s => {
        const r = (d.records || {})[s.id];
        const statusText = r?.status ? (r.status === 'P' ? 'Present' : r.status === 'L' ? 'Late' : r.status === 'E' ? 'Excused' : 'Unexcused') : 'Not marked';
        return `<tr>
          <td>${s.name}</td>
          <td>${statusText}</td>
          <td class="muted">${r?.reason || '—'}</td>
        </tr>`;
      })
      .join('');

    const body = `<table><thead><tr><th>Student</th><th>Status</th><th>Reason</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    const subtitle = `${selectedDay} · ${state.profile.school || ''} · Teacher: ${state.profile.name || ''}`;
    downloadWordDoc(
      `Attendance_${currentClass.name.replace(/\s+/g, '_')}_${selectedDay}`,
      `Session Attendance — ${currentClass.name}`,
      subtitle,
      body
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Printable Heading (Only visible in print) */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-blue-600">
        <h1 className="text-xl font-bold text-slate-900">Attendance Report — {currentClass.name}</h1>
        <p className="text-xs text-slate-600">
          {monthName(selectedMonth)} &middot; {days.length} Recorded Sessions &middot; {state.profile.school || ''} &middot; Teacher: {state.profile.name || ''}
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Class picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Class
              </label>
              <select
                value={currentClass.id}
                onChange={e => {
                  onSelectClassId(e.target.value);
                  setSelectedDay('');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                {state.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Report Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setSelectedDay('');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>

            {/* Specific Day Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Specific Day Drill-Down
              </label>
              <select
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                disabled={days.length === 0}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none disabled:opacity-50"
              >
                <option value="">All Days (Monthly Summary)</option>
                {days.map(d => (
                  <option key={d.date} value={d.date}>
                    {new Date(d.date + 'T00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 self-start lg:self-end">
            {selectedDay ? (
              <button
                type="button"
                onClick={exportDayWord}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>Export Day (.doc)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200/70 dark:border-emerald-900 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Download Excel Report</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Aggregated Totals Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Total Present
            </span>
            <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200 block mt-1 tabular-nums">
              {tot.P}
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Late Arrivals
            </span>
            <span className="text-xl font-bold text-amber-900 dark:text-amber-200 block mt-1 tabular-nums">
              {tot.L}
            </span>
          </div>

          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl">
            <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              Excused Absences
            </span>
            <span className="text-xl font-bold text-indigo-900 dark:text-indigo-200 block mt-1 tabular-nums">
              {tot.E}
            </span>
          </div>

          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded-xl">
            <span className="text-xs font-medium text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              Unexcused Absences
            </span>
            <span className="text-xl font-bold text-rose-900 dark:text-rose-200 block mt-1 tabular-nums">
              {tot.U}
            </span>
          </div>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No attendance recorded in {monthName(selectedMonth)}
          </h3>
          <p className="text-xs text-slate-500">
            Take attendance for a few sessions to view monthly analytics and download Word reports.
          </p>
        </div>
      ) : selectedDay ? (
        /* Specific Day Drill-Down View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Session Register: {selectedDay} ({new Date(selectedDay + 'T00:00').toLocaleDateString('en', { weekday: 'long' })})
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDay('')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Back to Monthly Summary
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reason Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {list.map(s => {
                  const d = days.find(x => x.date === selectedDay);
                  const rec = (d?.records || {})[s.id];
                  const st = rec?.status;
                  return (
                    <tr 
                      key={s.id} 
                      className="hover:bg-blue-50/20 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      onClick={() => handleCellClick(s.id, s.name, selectedDay, rec)}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {s.name}
                      </td>
                      <td className="py-3 px-4">
                        {st === 'P' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm group-hover:scale-105 transition-transform">
                            Present
                          </span>
                        ) : st === 'L' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm group-hover:scale-105 transition-transform">
                            Late
                          </span>
                        ) : st === 'E' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm group-hover:scale-105 transition-transform">
                            Excused
                          </span>
                        ) : st === 'U' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm group-hover:scale-105 transition-transform">
                            Unexcused
                          </span>
                        ) : (
                          <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">·</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{rec?.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Summary & Daily Register Matrix */
        <div className="space-y-6">
          {/* Summary by Student Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Student Attendance Summary &middot; {monthName(selectedMonth)}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4 text-right">Present</th>
                    <th className="py-3 px-4 text-right">Late</th>
                    <th className="py-3 px-4 text-right">Excused</th>
                    <th className="py-3 px-4 text-right">Unexcused</th>
                    <th className="py-3 px-4 text-right">Attendance Rate</th>
                    <th className="py-3 px-4">Reason History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {studentRows.map(r => (
                    <tr key={r.student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {r.student.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{r.student.studentNo}</span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-600">{r.k.P}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-amber-600">{r.k.L}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-indigo-600">{r.k.E}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-rose-600">{r.k.U}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold">
                        <span className={r.rate >= 80 ? 'text-emerald-600' : 'text-rose-600'}>
                          {r.rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                        {r.reasons.length > 0 ? r.reasons.join(' · ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Register Matrix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Daily Register Grid ({days.length} Sessions)
              </h3>
              <span className="text-xs text-slate-400">P = Present, L = Late, E = Excused, U = Unexcused</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Student</th>
                    {days.map(d => (
                      <th key={d.date} className="py-3 px-2 text-center whitespace-nowrap font-mono">
                        {d.date.slice(8)}/{d.date.slice(5, 7)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap">
                        {s.name}
                      </td>
                      {days.map(d => {
                        const rec = (d.records || {})[s.id];
                        const st = rec?.status;
                        return (
                          <td 
                            key={d.date} 
                            className="py-2.5 px-2 text-center cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-colors group"
                            onClick={() => handleCellClick(s.id, s.name, d.date, rec)}
                          >
                            {st === 'P' ? (
                              <span className="inline-block w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 font-bold leading-6 text-[11px] group-hover:scale-110 shadow-sm transition-all">
                                P
                              </span>
                            ) : st === 'L' ? (
                              <span className="inline-block w-6 h-6 rounded-md bg-amber-100 text-amber-700 font-bold leading-6 text-[11px] group-hover:scale-110 shadow-sm transition-all">
                                L
                              </span>
                            ) : st === 'E' ? (
                              <span className="inline-block w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 font-bold leading-6 text-[11px] group-hover:scale-110 shadow-sm transition-all">
                                E
                              </span>
                            ) : st === 'U' ? (
                              <span className="inline-block w-6 h-6 rounded-md bg-rose-100 text-rose-700 font-bold leading-6 text-[11px] group-hover:scale-110 shadow-sm transition-all">
                                U
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold leading-6 group-hover:text-blue-500 group-hover:scale-125 transition-all inline-block w-6 h-6">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Cell Modal */}
      {editingCell && (
        <Modal
          isOpen={editingCell !== null}
          onClose={() => {
            setEditingCell(null);
            setConfirmDelete(false);
          }}
          title={confirmDelete ? "Confirm Deletion" : "Edit Attendance"}
          maxWidth="max-w-md"
        >
          {confirmDelete ? (
            <div className="space-y-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/50 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-900 dark:text-rose-200 text-xs">Destructive Action</h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    You are removing the attendance record for <strong>{editingCell.studentName}</strong> on <strong>{new Date(editingCell.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>. This cell will revert back to an unmarked state.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Are you sure you want to proceed?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Student &amp; Session Date
                </span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  {editingCell.studentName}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {new Date(editingCell.date + 'T00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Status Picker Buttons */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Attendance Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'P', label: 'Present', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', active: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' },
                    { value: 'L', label: 'Late', bg: 'bg-amber-100 text-amber-800 border-amber-300', active: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' },
                    { value: 'E', label: 'Excused', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300', active: 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' },
                    { value: 'U', label: 'Unexcused', bg: 'bg-rose-100 text-rose-800 border-rose-300', active: 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20' },
                  ].map(opt => {
                    const isSel = editingCell.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditingCell(prev => prev ? { ...prev, status: opt.value as any } : null)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all ${
                          isSel ? opt.active : `${opt.bg} hover:brightness-95`
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Associated Note/Reason (shown for Late, Excused, Unexcused) */}
              {(editingCell.status === 'E' || editingCell.status === 'U' || editingCell.status === 'L') && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Associated Reason / Note Text
                  </label>
                  <input
                    type="text"
                    value={editingCell.reason}
                    onChange={e => setEditingCell(prev => prev ? { ...prev, reason: e.target.value } : null)}
                    placeholder="Provide a brief note or reason..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3.5 mt-2">
                <div>
                  {editingCell.status && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Record</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/20 transition-all active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
