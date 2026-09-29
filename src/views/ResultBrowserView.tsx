import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Sparkles,
  Trophy,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { AppState, StudentRankResult } from '../types';
import {
  ATT_EXCUSED_PENALTY,
  ATT_UNEXCUSED_PENALTY,
  computeResults,
  monthName,
  round1,
  sortStudents,
} from '../utils/helpers';
import { Modal } from '../components/Modal';
import { downloadWordDoc } from '../utils/wordExport';

interface ResultBrowserViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ResultBrowserView: React.FC<ResultBrowserViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onShowToast,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [mode, setMode] = useState<'month' | 'term'>('month');
  const [activePeriod, setActivePeriod] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('rank');
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');

  // Selected student for detailed report card modal
  const [selectedStudentResult, setSelectedStudentResult] = useState<StudentRankResult | null>(null);

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No class available.
      </div>
    );
  }

  // Helper to get months for a period key
  const getPeriodMonths = (pKey: string): { months: string[]; label: string } => {
    if (!pKey) return { months: [], label: '' };
    if (pKey.includes('-T')) {
      const [y, t] = pKey.split('-T');
      const tn = Number(t);
      const start = (tn - 1) * 3 + 1;
      const months = [0, 1, 2].map(i => `${y}-${String(start + i).padStart(2, '0')}`);
      return { months, label: `Term ${tn} · ${y}` };
    }
    return { months: [pKey], label: monthName(pKey) };
  };

  // Helper to check if class has records in months
  const classHasData = (classId: string, months: string[]): boolean => {
    if (state.attendance.some(a => a.classId === classId && months.includes(a.date.slice(0, 7)))) {
      return true;
    }
    const subs = state.subjects.filter(s => s.classId === classId);
    if (
      subs.some(sub =>
        months.some(m => {
          const md = state.marks.find(mark => mark.subjectId === sub.id && mark.month === m);
          return md && md.scores && Object.keys(md.scores).length > 0;
        })
      )
    ) {
      return true;
    }
    if (months.some(m => state.classwork.some(w => w.classId === classId && w.month === m))) {
      return true;
    }
    return false;
  };

  // Export single student word report card
  const handleExportStudentWord = (r: StudentRankResult, ctxMonths: string[], ctxLabel: string) => {
    const { subs, workMax } = computeResults(currentClass.id, ctxMonths, state);
    const att = r.att;

    const subjRows = subs
      .map(
        s =>
          `<tr><td>${s.name}</td><td class="num">${r.per[s.id]?.got || 0} / ${r.per[s.id]?.max || s.max}</td><td class="num">${r.per[s.id]?.pct || 0}%</td></tr>`
      )
      .join('');

    const body = `
      <table class="stats"><tr>
        <td><b>${r.total} / ${r.max}</b> total</td>
        <td><b>${r.pct}%</b> overall</td>
        <td><b>Grade ${r.grade}</b></td>
        <td><b>Rank ${r.rank} / ${r.of}</b></td>
        <td><b>${r.status}</b></td>
      </tr></table>
      <h2>Academic Assessment Breakdown</h2>
      <table>
        <thead>
          <tr><th>Component</th><th class="num">Score Earned</th><th class="num">Percent</th></tr>
        </thead>
        <tbody>
          ${subjRows}
          ${workMax > 0 ? `<tr><td>Classwork & Homework Tasks</td><td class="num">${r.work} / ${workMax}</td><td class="num">${workMax ? round1((r.work / workMax) * 100) : 0}%</td></tr>` : ''}
          <tr><td>Attendance & Conduct Score</td><td class="num">${att.score} / ${att.max}</td><td class="num">${att.max ? round1((att.score / att.max) * 100) : 0}%</td></tr>
        </tbody>
      </table>
      <p class="muted">Attendance Record for Period: ${att.P} sessions present · ${att.L} late arrivals · ${att.E} excused absences (−${ATT_EXCUSED_PENALTY} pts each) · ${att.U} unexcused absences (−${ATT_UNEXCUSED_PENALTY} pt each).</p>`;

    const subtitle = `${r.student.studentNo ? `${r.student.studentNo} · ` : ''}${currentClass.name} · ${ctxLabel} · ${state.profile.school || ''}`;
    downloadWordDoc(
      `ReportCard_${r.student.name.replace(/\s+/g, '_')}_${ctxLabel.replace(/\s+/g, '_')}`,
      `Academic Report Card — ${r.student.name}`,
      subtitle,
      body
    );
    onShowToast(`Downloaded Report Card for ${r.student.name}`, 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Period Browser Header Controls */}
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
                onChange={e => {
                  onSelectClassId(e.target.value);
                  setActivePeriod('');
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

            {/* Year Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Academic Year
              </label>
              <div className="flex items-center p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setYear(year - 1);
                    setActivePeriod('');
                  }}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {year}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setYear(year + 1);
                    setActivePeriod('');
                  }}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode: Monthly vs Termly */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Cadence
              </label>
              <div className="flex items-center p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('month');
                    setActivePeriod('');
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    mode === 'month'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('term');
                    setActivePeriod('');
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    mode === 'term'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Termly
                </button>
              </div>
            </div>
          </div>

          {activePeriod && (
            <button
              type="button"
              onClick={() => setActivePeriod('')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-end flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to All {mode === 'term' ? 'Terms' : 'Months'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Period Content */}
      {!activePeriod ? (
        /* Period Cards Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {mode === 'month'
            ? Array.from({ length: 12 }, (_, i) => {
                const key = `${year}-${String(i + 1).padStart(2, '0')}`;
                const label = new Date(year, i, 1).toLocaleString('en', { month: 'long' });
                const hasData = classHasData(currentClass.id, [key]);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivePeriod(key)}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-md group ${
                      hasData
                        ? 'bg-white dark:bg-slate-900 border-blue-200/80 dark:border-blue-900/60 shadow-sm'
                        : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400">{key}</span>
                        {hasData ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {label}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 mt-4 block">
                      {hasData ? 'Active Records Available' : 'No records yet'}
                    </span>
                  </button>
                );
              })
            : [1, 2, 3, 4].map(t => {
                const key = `${year}-T${t}`;
                const { months } = getPeriodMonths(key);
                const hasData = classHasData(currentClass.id, months);
                const sub = `${monthName(months[0]).split(' ')[0]} – ${monthName(months[2]).split(' ')[0]}`;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivePeriod(key)}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-md group ${
                      hasData
                        ? 'bg-white dark:bg-slate-900 border-indigo-200/80 dark:border-indigo-900/60 shadow-sm'
                        : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400">{year}</span>
                        {hasData ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-950" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-indigo-600">
                        Term {t}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{sub}</p>
                    </div>
                    <span className="text-xs text-slate-500 mt-4 block">
                      {hasData ? 'Term records ready' : 'No records yet'}
                    </span>
                  </button>
                );
              })}
        </div>
      ) : (
        /* Period Student Report Cards View */
        (() => {
          const { months, label } = getPeriodMonths(activePeriod);
          const { rows } = computeResults(currentClass.id, months, state);

          if (rows.length === 0) {
            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No records found for {label}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter student marks, attendance, or classwork for this period to generate report cards.
                </p>
              </div>
            );
          }

          let sortedRows = [...rows];
          if (sortBy === 'name') sortedRows.sort((a, b) => a.student.name.localeCompare(b.student.name));
          else if (sortBy === 'grade') sortedRows.sort((a, b) => b.pct - a.pct);
          else if (sortBy === 'no')
            sortedRows.sort((a, b) => (a.student.studentNo || '').localeCompare(b.student.studentNo || ''));

          return (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 rounded-2xl">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    Report Cards: {label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any student to view their complete academic breakdown &amp; export their Word report card.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs"
                    >
                      <option value="rank">Rank (Highest First)</option>
                      <option value="name">Name (A–Z)</option>
                      <option value="grade">Percentage Score</option>
                      <option value="no">Student ID</option>
                    </select>
                  </div>

                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setViewMode('gallery')}
                      className={`p-1.5 rounded-lg ${viewMode === 'gallery' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'}`}
                      title="Cards"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'}`}
                      title="Table"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Display list or cards */}
              {viewMode === 'gallery' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedRows.map(r => (
                    <button
                      key={r.student.id}
                      type="button"
                      onClick={() => setSelectedStudentResult(r)}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {r.student.photo ? (
                            <img src={r.student.photo} alt={r.student.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center text-sm shrink-0">
                              {r.student.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {r.student.name}
                            </h4>
                            <p className="text-[11px] font-mono text-slate-400">{r.student.studentNo || 'No ID'}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                              r.grade === 'A'
                                ? 'bg-emerald-50 text-emerald-700'
                                : r.grade === 'B'
                                ? 'bg-blue-50 text-blue-700'
                                : r.grade === 'C'
                                ? 'bg-sky-50 text-sky-700'
                                : r.grade === 'D'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            Grade {r.grade}
                          </span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                            {r.pct}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Rank #{r.rank} of {r.of}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                          View Breakdown →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4 text-center">Rank</th>
                        <th className="py-3 px-4 text-center">Grade</th>
                        <th className="py-3 px-4 text-right">Percent</th>
                        <th className="py-3 px-4 text-right">Total Score</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedRows.map(r => (
                        <tr
                          key={r.student.id}
                          onClick={() => setSelectedStudentResult(r)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {r.student.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{r.student.studentNo}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">#{r.rank}</td>
                          <td className="py-3 px-4 text-center font-bold">{r.grade}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-blue-600">{r.pct}%</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">
                            {r.total} / {r.max}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.status === 'Pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-blue-600 font-semibold">
                            Open Card →
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Student Scorecard Drill-Down Modal */}
              {selectedStudentResult && (
                <Modal
                  isOpen={true}
                  onClose={() => setSelectedStudentResult(null)}
                  title={`Report Card: ${selectedStudentResult.student.name}`}
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentResult(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleExportStudentWord(selectedStudentResult, months, label);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/25 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Word Report Card</span>
                      </button>
                    </>
                  }
                >
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                      {selectedStudentResult.student.photo ? (
                        <img
                          src={selectedStudentResult.student.photo}
                          alt={selectedStudentResult.student.name}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-base">
                          {selectedStudentResult.student.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {selectedStudentResult.student.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {selectedStudentResult.student.studentNo || 'No ID'} &middot; {currentClass.name}
                        </p>
                        <p className="text-xs text-blue-600 font-semibold mt-0.5">{label}</p>
                      </div>
                    </div>

                    {/* Score summary grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Total Score</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                          {selectedStudentResult.total} / {selectedStudentResult.max}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Aggregate %</span>
                        <span className="text-base font-bold text-blue-600 block mt-0.5">
                          {selectedStudentResult.pct}%
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Letter Grade</span>
                        <span className="text-base font-bold text-emerald-600 block mt-0.5">
                          Grade {selectedStudentResult.grade}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Class Rank</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                          Rank #{selectedStudentResult.rank} of {selectedStudentResult.of}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Attendance Score</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                          {selectedStudentResult.att.score} / {selectedStudentResult.att.max}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-[11px] text-slate-400 font-medium">Standing</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                          {selectedStudentResult.status}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown table */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Subject / Component</th>
                            <th className="py-2.5 px-3 text-right">Score</th>
                            <th className="py-2.5 px-3 text-right">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {Object.entries(selectedStudentResult.per).map(([subId, item]) => {
                            const subName = state.subjects.find(s => s.id === subId)?.name || 'Subject';
                            return (
                              <tr key={subId}>
                                <td className="py-2 px-3 font-medium">{subName}</td>
                                <td className="py-2 px-3 text-right tabular-nums">
                                  {item.got} / {item.max}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                                  {item.pct}%
                                </td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td className="py-2 px-3 font-medium">Classwork &amp; Tasks</td>
                            <td className="py-2 px-3 text-right tabular-nums">{selectedStudentResult.work}</td>
                            <td className="py-2 px-3 text-right tabular-nums">—</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium">Attendance &amp; Presence</td>
                            <td className="py-2 px-3 text-right tabular-nums">{selectedStudentResult.att.score} / {selectedStudentResult.att.max}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-semibold">
                              {round1((selectedStudentResult.att.score / selectedStudentResult.att.max) * 100)}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Attendance breakdown: {selectedStudentResult.att.P} present, {selectedStudentResult.att.L} late, {selectedStudentResult.att.E} excused (−5 each), {selectedStudentResult.att.U} unexcused (−1 each).
                    </p>
                  </div>
                </Modal>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
};
