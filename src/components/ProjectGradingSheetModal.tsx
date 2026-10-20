import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Search,
  Eye,
  EyeOff,
  User,
  Users,
  Award,
  Calendar,
  Layers,
  Sparkles,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { ProjectItem, ProjectResult, StudentItem } from '../types';
import { exportProjectCsv, exportProjectExcel, printProjectScoringSheet } from '../utils/projectExport';
import { uid } from '../utils/helpers';

interface ProjectGradingSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectItem;
  className: string;
  schoolName?: string;
  teacherName?: string;
  enrolledStudents: StudentItem[];
  existingResults: ProjectResult[];
  onSaveResults: (results: ProjectResult[], publishStatus?: boolean) => Promise<void>;
  onTogglePublish: (published: boolean) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface EditableRow {
  id: string; // row id (or result id)
  studentId: string;
  topic: string;
  scores: Record<string, number | ''>;
  comment: string;
}

export const ProjectGradingSheetModal: React.FC<ProjectGradingSheetModalProps> = ({
  isOpen,
  onClose,
  project,
  className,
  schoolName = 'Central Academy',
  teacherName = 'Lead Instructor',
  enrolledStudents,
  existingResults,
  onSaveResults,
  onTogglePublish,
  onShowToast,
}) => {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [isPublished, setIsPublished] = useState<boolean>(project.published || false);
  const [searchStudent, setSearchStudent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize or synchronize rows from existingResults
  useEffect(() => {
    setIsPublished(project.published || false);

    // Map existing results for this project
    const currentResults = existingResults.filter(r => r.projectId === project.id);

    if (currentResults.length > 0) {
      // Map to editable rows
      const mapped: EditableRow[] = currentResults.map(r => ({
        id: r.id || `pr_${project.id}_${r.studentId}`,
        studentId: r.studentId,
        topic: r.topic || '',
        scores: { ...(r.scores || {}) },
        comment: r.comment || '',
      }));
      setRows(mapped);
    } else {
      // Auto-populate all enrolled students if no rows exist yet, so the teacher has a ready-to-grade sheet!
      if (enrolledStudents.length > 0) {
        const initial = enrolledStudents.map(st => ({
          id: `pr_${project.id}_${st.id}`,
          studentId: st.id,
          topic: '',
          scores: {},
          comment: '',
        }));
        setRows(initial);
      } else {
        setRows([]);
      }
    }
  }, [project, existingResults, enrolledStudents, isOpen]);

  // Set of selected student IDs to prevent duplicate picks
  const selectedStudentIds = useMemo(() => {
    return new Set(rows.map(r => r.studentId).filter(Boolean));
  }, [rows]);

  // Live row total calculation
  const calculateRowTotal = (scores: Record<string, number | ''>): number => {
    return project.criteria.reduce((sum, crit) => {
      const val = scores[crit.id];
      const num = typeof val === 'number' ? val : 0;
      return sum + num;
    }, 0);
  };

  // Row update handlers
  const handleUpdateStudent = (rowId: string, studentId: string) => {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, studentId } : r))
    );
  };

  const handleUpdateTopic = (rowId: string, topic: string) => {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, topic } : r))
    );
  };

  const handleUpdateScore = (rowId: string, criterionId: string, maxMark: number, rawValue: string) => {
    if (rawValue === '') {
      setRows(prev =>
        prev.map(r =>
          r.id === rowId
            ? { ...r, scores: { ...r.scores, [criterionId]: '' } }
            : r
        )
      );
      return;
    }

    const num = Number(rawValue);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(maxMark, num));

    setRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, scores: { ...r.scores, [criterionId]: clamped } }
          : r
      )
    );
  };

  const handleUpdateComment = (rowId: string, comment: string) => {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, comment } : r))
    );
  };

  const handleAddRow = () => {
    // Find first available student who hasn't been added yet
    const available = enrolledStudents.find(st => !selectedStudentIds.has(st.id));
    const newRow: EditableRow = {
      id: `pr_${project.id}_${available ? available.id : uid()}`,
      studentId: available ? available.id : '',
      topic: '',
      scores: {},
      comment: '',
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handlePopulateAllStudents = () => {
    const existingIds = new Set(rows.map(r => r.studentId));
    const newRows: EditableRow[] = [];
    enrolledStudents.forEach(st => {
      if (!existingIds.has(st.id)) {
        newRows.push({
          id: `pr_${project.id}_${st.id}`,
          studentId: st.id,
          topic: '',
          scores: {},
          comment: '',
        });
      }
    });
    if (newRows.length === 0) {
      onShowToast('All enrolled students are already on the scoring sheet.', 'info');
      return;
    }
    setRows(prev => [...prev, ...newRows]);
    onShowToast(`Added ${newRows.length} students to scoring sheet`, 'success');
  };

  // Convert current rows to ProjectResult records
  const compileProjectResults = (publishStatus: boolean): ProjectResult[] => {
    const now = new Date().toISOString();
    return rows
      .filter(r => r.studentId) // only valid students
      .map(r => {
        const cleanScores: Record<string, number> = {};
        project.criteria.forEach(c => {
          const val = r.scores[c.id];
          cleanScores[c.id] = typeof val === 'number' ? val : 0;
        });
        const total = calculateRowTotal(r.scores);

        return {
          id: `pr_${project.id}_${r.studentId}`,
          projectId: project.id,
          studentId: r.studentId,
          classId: project.classId,
          topic: r.topic.trim(),
          scores: cleanScores,
          total,
          comment: r.comment.trim(),
          published: publishStatus,
          gradedAt: now,
          updatedAt: now,
        };
      });
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const results = compileProjectResults(isPublished);
      await onSaveResults(results, isPublished);
      onShowToast(`Saved ${results.length} student scores as draft.`, 'success');
    } catch (err: any) {
      console.error('Save draft error:', err);
      onShowToast(err.message || 'Failed to save scores', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Publish / Unpublish Toggle
  const handleTogglePublishState = async () => {
    const nextPublished = !isPublished;
    setIsSaving(true);
    try {
      const results = compileProjectResults(nextPublished);
      await onSaveResults(results, nextPublished);
      await onTogglePublish(nextPublished);
      setIsPublished(nextPublished);
      onShowToast(
        nextPublished
          ? 'Project results published! Students can now view their scores.'
          : 'Project unpublished. Results are now hidden from students.',
        'success'
      );
    } catch (err: any) {
      console.error('Toggle publish error:', err);
      onShowToast(err.message || 'Failed to update publication status', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Export handlers
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const results = compileProjectResults(isPublished);
      await exportProjectExcel(
        project,
        className,
        schoolName,
        teacherName,
        enrolledStudents,
        results
      );
      onShowToast('Scoring sheet exported to Excel (.xlsx)', 'success');
    } catch (err: any) {
      console.error('Export Excel error:', err);
      onShowToast('Failed to export Excel file', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    try {
      const results = compileProjectResults(isPublished);
      exportProjectCsv(project, enrolledStudents, results);
      onShowToast('Scoring sheet exported to CSV', 'success');
    } catch (err: any) {
      console.error('Export CSV error:', err);
      onShowToast('Failed to export CSV file', 'error');
    }
  };

  const handlePrint = () => {
    try {
      const results = compileProjectResults(isPublished);
      printProjectScoringSheet(
        project,
        className,
        schoolName,
        teacherName,
        enrolledStudents,
        results
      );
    } catch (err: any) {
      console.error('Print sheet error:', err);
      onShowToast('Failed to open printable sheet', 'error');
    }
  };

  // Filter rows by student name
  const filteredRows = useMemo(() => {
    if (!searchStudent.trim()) return rows;
    const q = searchStudent.toLowerCase().trim();
    return rows.filter(r => {
      const st = enrolledStudents.find(s => s.id === r.studentId);
      return (
        st?.name.toLowerCase().includes(q) ||
        st?.studentNo?.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q)
      );
    });
  }, [rows, searchStudent, enrolledStudents]);

  // Count graded students (those with at least one criterion filled or topic)
  const gradedCount = useMemo(() => {
    return rows.filter(r => {
      if (!r.studentId) return false;
      return Object.values(r.scores).some(v => typeof v === 'number' && v > 0) || r.topic.trim().length > 0;
    }).length;
  }, [rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Sticky Header */}
      <div className="bg-white dark:bg-[#121216] border-b border-slate-200 dark:border-white/10 px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Back to Projects"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {project.name}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400">
                Speaking Scoring Sheet
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isPublished
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isPublished ? '● Published' : '○ Draft'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Class: <strong className="text-slate-700 dark:text-slate-300">{className}</strong></span>
              <span>·</span>
              <span>Date: <strong>{project.date || 'Today'}</strong></span>
              <span>·</span>
              <span>Total Max: <strong className="text-emerald-600 dark:text-emerald-400">{project.totalMax} pts</strong></span>
              <span>·</span>
              <span>Graded: <strong>{gradedCount} / {enrolledStudents.length}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative min-w-[160px] sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              placeholder="Search student or topic..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Export Menu */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download formatted Excel (.xlsx) file"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer"
            title="Print / Save PDF"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Publish / Unpublish Toggle */}
          <button
            type="button"
            onClick={handleTogglePublishState}
            disabled={isSaving}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
              isPublished
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-200'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            {isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isPublished ? 'Unpublish' : 'Publish Results'}</span>
          </button>

          {/* Save Draft Button */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {/* Main Table Area (Scrollable Spreadsheet) */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-100 dark:bg-[#0c0c10]">
        <div className="bg-white dark:bg-[#121216] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden min-w-[850px]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">No.</th>
                <th className="py-3 px-4 w-56">Student Name</th>
                <th className="py-3 px-4 w-60">Presentation Topic</th>
                {project.criteria.map(crit => (
                  <th key={crit.id} className="py-3 px-3 text-center min-w-[110px]">
                    <div className="truncate max-w-[130px] font-bold text-slate-800 dark:text-slate-200" title={crit.name}>
                      {crit.name}
                    </div>
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 lowercase font-normal">
                      max {crit.maxMark}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 w-28 text-center bg-purple-500/5 dark:bg-purple-500/10">
                  <div className="text-purple-700 dark:text-purple-300 font-black">TOTAL</div>
                  <div className="text-[10px] text-purple-600/80 dark:text-purple-400/80 lowercase font-normal">
                    max {project.totalMax}
                  </div>
                </th>
                <th className="py-3 px-4 min-w-[200px]">Comments / Remarks</th>
                <th className="py-3 px-2 w-12 text-center"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-300">
              {filteredRows.map((row, idx) => {
                const student = enrolledStudents.find(s => s.id === row.studentId);
                const rowTotal = calculateRowTotal(row.scores);
                const pct = project.totalMax > 0 ? Math.round((rowTotal / project.totalMax) * 100) : 0;
                
                // Color badge for total score
                let tierColor = 'text-rose-600 bg-rose-50 dark:bg-rose-950/40';
                if (pct >= 85) tierColor = 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40';
                else if (pct >= 70) tierColor = 'text-blue-700 bg-blue-50 dark:bg-blue-950/40';
                else if (pct >= 50) tierColor = 'text-amber-700 bg-amber-50 dark:bg-amber-950/40';

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-purple-50/20 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Student Select */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {/* Student Avatar */}
                        {student?.photo ? (
                          <img
                            src={student.photo}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/10"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {student?.name ? student.name.slice(0, 2).toUpperCase() : '?'}
                          </div>
                        )}

                        <select
                          value={row.studentId}
                          onChange={e => handleUpdateStudent(row.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="" disabled>Select Student...</option>
                          {enrolledStudents.map(st => {
                            const isChosenInAnotherRow =
                              st.id !== row.studentId && selectedStudentIds.has(st.id);
                            return (
                              <option
                                key={st.id}
                                value={st.id}
                                disabled={isChosenInAnotherRow}
                                className="dark:bg-slate-900"
                              >
                                {st.name} {st.studentNo ? `(${st.studentNo})` : ''}{' '}
                                {isChosenInAnotherRow ? '— [Already Graded]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </td>

                    {/* Topic */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={row.topic}
                        onChange={e => handleUpdateTopic(row.id, e.target.value)}
                        placeholder="e.g. How to Reduce Traffic Accidents"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                      />
                    </td>

                    {/* Criteria Inputs */}
                    {project.criteria.map(crit => {
                      const val = row.scores[crit.id];
                      const isOver = typeof val === 'number' && val > crit.maxMark;
                      return (
                        <td key={crit.id} className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={crit.maxMark}
                            step={0.5}
                            value={val !== undefined ? val : ''}
                            onChange={e =>
                              handleUpdateScore(row.id, crit.id, crit.maxMark, e.target.value)
                            }
                            placeholder="0"
                            className={`w-16 px-2 py-1.5 rounded-xl border text-center font-bold text-xs focus:outline-hidden ${
                              isOver
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600'
                                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-1 focus:ring-purple-500'
                            }`}
                          />
                        </td>
                      );
                    })}

                    {/* TOTAL (Auto-calculated) */}
                    <td className="py-3 px-4 text-center bg-purple-500/5 dark:bg-purple-500/10">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {rowTotal}
                          <span className="text-[10px] text-slate-400 font-normal"> / {project.totalMax}</span>
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${tierColor}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>

                    {/* Comments / Remarks */}
                    <td className="py-3 px-4">
                      <textarea
                        rows={1}
                        value={row.comment}
                        onChange={e => handleUpdateComment(row.id, e.target.value)}
                        placeholder="Instructor remarks, strengths & areas to improve..."
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500 resize-y min-h-[36px]"
                      />
                    </td>

                    {/* Remove Action */}
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Remove student row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5 + project.criteria.length}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    {rows.length === 0
                      ? 'No students on the scoring sheet yet. Click "+ Add Student Row" or "+ Populate Enrolled Students" below.'
                      : 'No students matching your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="bg-white dark:bg-[#121216] border-t border-slate-200 dark:border-white/10 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-purple-600" />
            <span>Add Student Row</span>
          </button>

          {rows.length < enrolledStudents.length && (
            <button
              type="button"
              onClick={handlePopulateAllStudents}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Add All Enrolled Students ({enrolledStudents.length - rows.length} remaining)</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
            {rows.length} rows · {gradedCount} graded
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
