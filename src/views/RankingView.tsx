import React, { useState } from 'react';
import {
  Trophy,
  Download,
  Printer,
  Sparkles,
  KeyRound,
  Search,
  Filter,
  Medal,
  Award,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AppState, StudentRankResult } from '../types';
import { computeResults, monthName, prevMonths, round1, thisMonth } from '../utils/helpers';
import { downloadWordDoc } from '../utils/wordExport';
import { downloadStudentViewFile } from '../utils/studentViewGenerator';

interface RankingViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const RankingView: React.FC<RankingViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onShowToast,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [endMonth, setEndMonth] = useState<string>(thisMonth());
  const [span, setSpan] = useState<string>('1');
  const [search, setSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No class available.
      </div>
    );
  }

  const months = prevMonths(endMonth, Number(span));
  const { rows, subs, subjectMax, workMax, attMax } = computeResults(currentClass.id, months, state);

  const label =
    months.length === 1
      ? monthName(months[0])
      : `${monthName(months[0])} – ${monthName(months[months.length - 1])}`;

  const activeGradedRows = rows.filter(r => r.hasData && r.pct !== null);
  const classAvg = activeGradedRows.length
    ? round1(activeGradedRows.reduce((a, r) => a + (r.pct || 0), 0) / activeGradedRows.length)
    : 0;
  const passingCount = activeGradedRows.filter(r => (r.pct || 0) >= 50).length;

  // Filter rows
  let filteredRows = rows;
  if (gradeFilter) {
    filteredRows = filteredRows.filter(r => r.grade === gradeFilter);
  }
  if (statusFilter) {
    filteredRows = filteredRows.filter(r => r.status === statusFilter);
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filteredRows = filteredRows.filter(
      r =>
        r.student.name.toLowerCase().includes(q) ||
        (r.student.studentNo && r.student.studentNo.toLowerCase().includes(q))
    );
  }

  const handleExportWord = () => {
    if (!rows.length) {
      onShowToast('No students to export in this period', 'error');
      return;
    }
    const headCells =
      subs.map(s => `<th class="num">${s.name}</th>`).join('') +
      (workMax ? `<th class="num">Classwork</th>` : '') +
      `<th class="num">Attendance</th><th class="num">Total</th><th class="num">Average</th><th class="num">Percent</th><th class="num">Grade</th><th class="num">Status</th>`;

    const rowsHtml = rows
      .map(
        r => `<tr>
          <td class="num">${r.rank !== null ? r.rank : '—'}</td>
          <td><b>${r.student.name}</b>${r.student.studentNo ? ` (${r.student.studentNo})` : ''}</td>
          ${subs.map(s => `<td class="num">${r.per[s.id]?.got ?? '—'} / ${r.per[s.id]?.max || s.max}</td>`).join('')}
          ${workMax ? `<td class="num">${r.hasData ? r.work : '—'} / ${workMax}</td>` : ''}
          <td class="num">${r.att.sessionsHeld > 0 ? `${r.att.score} / ${r.att.max}` : '—'}</td>
          <td class="num"><b>${r.hasData ? `${r.total} / ${r.max}` : '—'}</b></td>
          <td class="num">${r.hasData ? r.avg : '—'}</td>
          <td class="num"><b>${r.pct !== null ? `${r.pct}%` : '—'}</b></td>
          <td class="num">${r.grade}</td>
          <td class="num ${r.status === 'Pass' ? 'badge-pass' : r.status === 'Fail' ? 'badge-fail' : ''}">${r.status}</td>
        </tr>`
      )
      .join('');

    const body = `
      <table class="stats"><tr>
        <td><b>${classAvg}%</b> class average</td><td><b>${passingCount}/${activeGradedRows.length || rows.length}</b> scoring 50%+</td><td><b>${rows.length}</b> students</td>
      </tr></table>
      <table>
        <thead>
          <tr><th class="num">Rank</th><th>Student</th>${headCells}</tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p class="muted">Grading Scale: A ≥90 · B ≥80 · C ≥70 · D ≥60 · E ≥50 · F &lt;50. Attendance rate = earned credit / sessions held (On-time: 1.0 · Late: 0.75 · Very Late: 0.5 · Excused: 0.5 · Unexcused: 0).</p>`;

    const subtitle = `${label} · ${state.profile.school || ''} · Teacher: ${state.profile.name || ''}`;
    downloadWordDoc(
      `Academic_Ranking_${currentClass.name.replace(/\s+/g, '_')}_${label.replace(/\s+/g, '_')}`,
      `Academic Ranking & Merit — ${currentClass.name}`,
      subtitle,
      body
    );
    onShowToast('Word ranking report downloaded', 'success');
  };

  const handleGenerateStudentView = () => {
    const res = downloadStudentViewFile(currentClass.name, label, rows, subs, workMax);
    if (!res.success) {
      onShowToast(res.message, 'error');
    } else {
      onShowToast(res.message, 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Printable Heading */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-blue-600">
        <h1 className="text-xl font-bold text-slate-900">Academic Ranking — {currentClass.name}</h1>
        <p className="text-xs text-slate-600">
          {label} &middot; Class Average: {classAvg}% &middot; {state.profile.school || ''} &middot; Teacher: {state.profile.name || ''}
        </p>
      </div>

      {/* Controls Bar */}
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

            {/* Ending Month */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Period Ending Month
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={e => setEndMonth(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none font-mono"
              />
            </div>

            {/* Span */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Period Span
              </label>
              <select
                value={span}
                onChange={e => setSpan(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                <option value="1">1 Month (Current)</option>
                <option value="3">3 Months (Quarterly / Term)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
            <button
              type="button"
              onClick={handleGenerateStudentView}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5 active:scale-95"
              title="Generate a password-locked single file to send to students"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Generate Student Portal</span>
            </button>

            <button
              type="button"
              onClick={handleExportWord}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200/70 dark:border-blue-900 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Download Word Report</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all"
              title="Print"
            >
              <Printer className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Aggregated Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Class Average</span>
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-100 block mt-1 tabular-nums">
              {classAvg}%
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Passing (50%+)</span>
            <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 block mt-1 tabular-nums">
              {passingCount}/{rows.length}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 rounded-xl">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Max Points Possible</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white block mt-1 tabular-nums">
              {subjectMax + workMax + attMax}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 rounded-xl">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Months Aggregated</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white block mt-1 tabular-nums">
              {months.length}
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex-1 min-w-[200px] max-w-xs relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter student in ranking…"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Grade:</span>
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
            >
              <option value="">All Grades</option>
              <option value="A">Grade A (≥90%)</option>
              <option value="B">Grade B (≥80%)</option>
              <option value="C">Grade C (≥70%)</option>
              <option value="D">Grade D (≥60%)</option>
              <option value="E">Grade E (≥50%)</option>
              <option value="F">Grade F (&lt;50%)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="Pass">Pass Only</option>
              <option value="Fail">Fail Only</option>
            </select>
          </div>

          <span className="ml-auto text-slate-400">
            Showing <b className="text-slate-700 dark:text-slate-200">{filteredRows.length}</b> students
          </span>
        </div>
      </div>

      {/* Main Ranking Table */}
      {filteredRows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No student records</h3>
          <p className="text-xs text-slate-500">
            Set up subjects and enter exam or attendance scores for this period.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Merit Standing &middot; {currentClass.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Attendance: Earned Credit / Sessions (0–5m: 1.0 · 6–10m: 0.75 · 11m–⅓: 0.5 · &gt;⅓: 0 · Excused: 0.5 · Absent: 0)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-14">Rank</th>
                  <th className="py-3 px-4">Student</th>
                  {subs.map(s => (
                    <th key={s.id} className="py-3 px-3 text-right">
                      {s.name}
                    </th>
                  ))}
                  {workMax > 0 && <th className="py-3 px-3 text-right">Classwork</th>}
                  <th className="py-3 px-3 text-right">Attendance</th>
                  <th className="py-3 px-4 text-right">Total Score</th>
                  <th className="py-3 px-3 text-right">Average</th>
                  <th className="py-3 px-3 text-right">Percent</th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRows.map(r => {
                  const isRanked = r.hasData && r.rank !== null;
                  const isTop1 = isRanked && r.rank === 1;
                  const isTop2 = isRanked && r.rank === 2;
                  const isTop3 = isRanked && r.rank === 3;

                  return (
                    <tr
                      key={r.student.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isTop1 ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Rank Indicator */}
                      <td className="py-3 px-3 text-center">
                        {!isRanked ? (
                          <span className="font-mono text-slate-400 font-semibold">—</span>
                        ) : isTop1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 font-extrabold text-xs shadow-sm ring-2 ring-amber-300">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-sm">
                            2
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-sm">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-slate-500 font-semibold">{r.rank}</span>
                        )}
                      </td>

                      {/* Student info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {r.student.photo ? (
                            <img src={r.student.photo} alt={r.student.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {r.student.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {r.student.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {r.student.studentNo || 'No ID'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Subject Marks */}
                      {subs.map(s => {
                        const item = r.per[s.id];
                        return (
                          <td key={s.id} className="py-3 px-3 text-right tabular-nums">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item && r.hasData ? item.got : '—'}</span>
                            <span className="block text-[10px] text-slate-400">{item && r.hasData ? `${item.pct}%` : ''}</span>
                          </td>
                        );
                      })}

                      {/* Classwork */}
                      {workMax > 0 && (
                        <td className="py-3 px-3 text-right tabular-nums">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.hasData ? r.work : '—'}</span>
                          <span className="block text-[10px] text-slate-400">{r.hasData ? `/ ${workMax}` : ''}</span>
                        </td>
                      )}

                      {/* Attendance */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{r.att.sessionsHeld > 0 ? r.att.score : '—'}</span>
                        <span className="block text-[10px] text-slate-400">{r.att.sessionsHeld > 0 ? `/ ${r.att.max}` : ''}</span>
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{r.hasData ? r.total : '—'}</span>
                        <span className="block text-[10px] text-slate-400">{r.hasData ? `/ ${r.max}` : ''}</span>
                      </td>

                      {/* Average */}
                      <td className="py-3 px-3 text-right tabular-nums font-mono text-slate-600 dark:text-slate-300">
                        {r.hasData ? r.avg : '—'}
                      </td>

                      {/* Percent */}
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-sm">
                        {r.pct !== null ? (
                          <span className={r.pct >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}>
                            {r.pct}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono font-normal text-xs">—</span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="py-3 px-3 text-center">
                        {r.grade !== '—' ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs ${
                              r.grade === 'A'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : r.grade === 'B'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : r.grade === 'C'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                : r.grade === 'D'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : r.grade === 'E'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {r.grade}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Status Pass / Fail */}
                      <td className="py-3 px-4 text-center">
                        {r.status !== '—' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              r.status === 'Pass'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                            }`}
                          >
                            {r.status === 'Pass' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-rose-500" />
                            )}
                            <span>{r.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
