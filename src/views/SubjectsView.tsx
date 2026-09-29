import React, { useState } from 'react';
import {
  FilePenLine,
  Plus,
  Save,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AppState, SubjectItem } from '../types';
import { round1, studentsOf, subjectsOf, thisMonth, uid } from '../utils/helpers';
import { Modal } from '../components/Modal';

interface SubjectsViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onSaveSubject: (subject: SubjectItem) => void;
  onDeleteSubject: (subjectId: string) => void;
  onSaveMarks: (classId: string, month: string, subjectScores: Record<string, Record<string, number>>) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onSaveSubject,
  onDeleteSubject,
  onSaveMarks,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [month, setMonth] = useState<string>(thisMonth());

  // Subject Modal state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubjectItem | null>(null);
  const [subName, setSubName] = useState('');
  const [subMax, setSubMax] = useState<number>(100);

  // Scores working draft: subjectId -> studentId -> score
  const [scoresDraft, setScoresDraft] = useState<Record<string, Record<string, number | ''>>>({});

  // Sync draft when class or month changes
  React.useEffect(() => {
    if (!currentClass) return;
    const subs = subjectsOf(currentClass.id, state);
    const draft: Record<string, Record<string, number | ''>> = {};
    subs.forEach(s => {
      const doc = state.marks.find(m => m.subjectId === s.id && m.month === month);
      draft[s.id] = {};
      if (doc?.scores) {
        Object.entries(doc.scores).forEach(([stuId, val]) => {
          draft[s.id][stuId] = val;
        });
      }
    });
    setScoresDraft(draft);
  }, [currentClass?.id, month, state.marks, state.subjects]);

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No class available. Create a class first.
      </div>
    );
  }

  const subs = subjectsOf(currentClass.id, state);
  const students = studentsOf(currentClass.id, state);
  const totalMax = subs.reduce((a, s) => a + Number(s.max), 0);

  const openAddSubject = () => {
    setEditingSub(null);
    setSubName('');
    setSubMax(100);
    setIsSubModalOpen(true);
  };

  const openEditSubject = (s: SubjectItem) => {
    setEditingSub(s);
    setSubName(s.name);
    setSubMax(s.max);
    setIsSubModalOpen(true);
  };

  const handleSaveSubject = () => {
    if (!subName.trim()) {
      alert('Please name the subject');
      return;
    }
    const subObj: SubjectItem = {
      id: editingSub ? editingSub.id : uid('sub'),
      classId: currentClass.id,
      name: subName.trim(),
      max: Number(subMax) || 100,
      order: editingSub ? editingSub.order : subs.length,
    };
    onSaveSubject(subObj);
    setIsSubModalOpen(false);
  };

  const handleScoreChange = (subjectId: string, studentId: string, valueStr: string) => {
    setScoresDraft(prev => {
      const subScores = { ...(prev[subjectId] || {}) };
      if (valueStr === '') {
        subScores[studentId] = '';
      } else {
        subScores[studentId] = Math.max(0, parseFloat(valueStr) || 0);
      }
      return {
        ...prev,
        [subjectId]: subScores,
      };
    });
  };

  const handleSaveMarks = () => {
    const finalScores: Record<string, Record<string, number>> = {};
    Object.entries(scoresDraft).forEach(([subId, stuMap]) => {
      finalScores[subId] = {};
      Object.entries(stuMap).forEach(([stuId, val]) => {
        if (val !== '' && !isNaN(Number(val))) {
          finalScores[subId][stuId] = Number(val);
        }
      });
    });
    onSaveMarks(currentClass.id, month, finalScores);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Session Controls Header */}
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

            {/* Exam Month */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Exam Scoring Month
              </label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-end">
            <button
              type="button"
              onClick={openAddSubject}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-blue-500" />
              <span>Add Subject</span>
            </button>

            <button
              type="button"
              onClick={handleSaveMarks}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Marks</span>
            </button>
          </div>
        </div>

        {/* Subject Chips Row */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-400 mr-1">Active Subjects:</span>
          {subs.length === 0 ? (
            <span className="text-xs text-amber-500">No subjects set up for this class yet.</span>
          ) : (
            subs.map(s => (
              <div
                key={s.id}
                className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <span>{s.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">max {s.max}</span>
                <button
                  type="button"
                  onClick={() => openEditSubject(s)}
                  className="text-slate-400 hover:text-blue-500"
                  title="Edit Subject"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSubject(s.id)}
                  className="text-slate-400 hover:text-rose-500"
                  title="Delete Subject"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Marks Matrix Table */}
      {subs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FilePenLine className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Subjects Set Up</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add subjects such as Listening, Speaking, Reading, Writing with custom maximum scores to begin entering grades.
          </p>
          <button
            type="button"
            onClick={openAddSubject}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Add First Subject
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          No students enrolled in {currentClass.name}. Add students in the Students directory.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Exam Scores &middot; {currentClass.name}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Test Weight: {totalMax} pts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  {subs.map(s => (
                    <th key={s.id} className="py-3 px-3 text-right">
                      <span>{s.name}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">
                        Max {s.max}
                      </span>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Total Score</th>
                  <th className="py-3 px-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {students.map(s => {
                  let sum = 0;
                  subs.forEach(sub => {
                    const val = scoresDraft[sub.id]?.[s.id];
                    if (val !== '' && val != null) sum += Number(val);
                  });
                  const pct = totalMax ? round1((sum / totalMax) * 100) : 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          {s.photo ? (
                            <img src={s.photo} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span>{s.name}</span>
                        </div>
                      </td>

                      {/* Inputs per subject */}
                      {subs.map(sub => {
                        const val = scoresDraft[sub.id]?.[s.id] ?? '';
                        return (
                          <td key={sub.id} className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={sub.max}
                              step="0.5"
                              value={val}
                              onChange={e => handleScoreChange(sub.id, s.id, e.target.value)}
                              placeholder="—"
                              className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono font-medium text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right tabular-nums font-bold">
                        <span className="text-slate-900 dark:text-white">{round1(sum)}</span>
                        <span className="text-slate-400 font-normal"> / {totalMax}</span>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums font-bold">
                        <span className={pct >= 50 ? 'text-emerald-600' : 'text-rose-600'}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject Add / Edit Modal */}
      <Modal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        title={editingSub ? `Edit Subject: ${editingSub.name}` : 'Add Subject to Class'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSubModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSubject}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {editingSub ? 'Save Subject' : 'Add Subject'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              value={subName}
              onChange={e => setSubName(e.target.value)}
              placeholder="e.g. Listening, Speaking, Reading, Writing"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Maximum Test Score
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={subMax}
              onChange={e => setSubMax(Number(e.target.value) || 100)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The maximum determines how much this subject weighs in the final aggregate percentage.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
