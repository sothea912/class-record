import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Save,
  Trash2,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';
import { AppState, ClassworkTask, ClassworkType } from '../types';
import { round1, studentsOf, thisMonth, todayISO, uid } from '../utils/helpers';
import { Modal } from '../components/Modal';

interface ClassworkViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onSaveTask: (task: ClassworkTask) => void;
  onDeleteTask: (taskId: string) => void;
  onSaveScores: (classId: string, month: string, scores: Record<string, Record<string, number>>) => void;
}

export const ClassworkView: React.FC<ClassworkViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onSaveTask,
  onDeleteTask,
  onSaveScores,
}) => {
  const currentClass = state.classes.find(c => c.id === selectedClassId) || state.classes[0];
  const [month, setMonth] = useState<string>(thisMonth());

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<ClassworkType>('homework');
  const [taskMax, setTaskMax] = useState<number>(20);
  const [taskDate, setTaskDate] = useState<string>(todayISO());

  // Scores working draft: taskId -> studentId -> score
  const [scoresDraft, setScoresDraft] = useState<Record<string, Record<string, number | ''>>>({});

  // Sync draft when class or month changes
  React.useEffect(() => {
    if (!currentClass) return;
    const tasks = state.classwork.filter(w => w.classId === currentClass.id && w.month === month);
    const draft: Record<string, Record<string, number | ''>> = {};
    tasks.forEach(t => {
      draft[t.id] = {};
      if (t.scores) {
        Object.entries(t.scores).forEach(([stuId, val]) => {
          draft[t.id][stuId] = val;
        });
      }
    });
    setScoresDraft(draft);
  }, [currentClass?.id, month, state.classwork]);

  if (!currentClass) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        No class available.
      </div>
    );
  }

  const tasks = state.classwork.filter(w => w.classId === currentClass.id && w.month === month);
  const students = studentsOf(currentClass.id, state);
  const totalMax = tasks.reduce((a, t) => a + Number(t.max), 0);

  const openAddTask = () => {
    setTaskTitle('');
    setTaskType('homework');
    setTaskMax(20);
    setTaskDate(todayISO());
    setIsTaskModalOpen(true);
  };

  const handleSaveNewTask = () => {
    if (!taskTitle.trim()) {
      alert('Please name the task');
      return;
    }
    const tObj: ClassworkTask = {
      id: uid('cw'),
      classId: currentClass.id,
      title: taskTitle.trim(),
      type: taskType,
      max: Number(taskMax) || 10,
      date: taskDate,
      month,
      scores: {},
    };
    onSaveTask(tObj);
    setIsTaskModalOpen(false);
  };

  const handleScoreChange = (taskId: string, studentId: string, valStr: string) => {
    setScoresDraft(prev => {
      const taskScores = { ...(prev[taskId] || {}) };
      if (valStr === '') {
        taskScores[studentId] = '';
      } else {
        taskScores[studentId] = Math.max(0, parseFloat(valStr) || 0);
      }
      return {
        ...prev,
        [taskId]: taskScores,
      };
    });
  };

  const handleSaveScores = () => {
    const finalScores: Record<string, Record<string, number>> = {};
    Object.entries(scoresDraft).forEach(([taskId, stuMap]) => {
      finalScores[taskId] = {};
      Object.entries(stuMap).forEach(([stuId, val]) => {
        if (val !== '' && !isNaN(Number(val))) {
          finalScores[taskId][stuId] = Number(val);
        }
      });
    });
    onSaveScores(currentClass.id, month, finalScores);
  };

  const TYPE_LABELS: Record<ClassworkType, { label: string; color: string }> = {
    homework: { label: 'Homework', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    project: { label: 'Project', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    achievement: { label: 'Achievement', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    participation: { label: 'Participation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    quiz: { label: 'Quiz', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    exam: { label: 'Exam', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Controls Bar */}
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

            {/* Month Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Month
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
              onClick={openAddTask}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-blue-500" />
              <span>Add Task</span>
            </button>

            <button
              type="button"
              onClick={handleSaveScores}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Scores</span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span>
            {tasks.length} Task{tasks.length === 1 ? '' : 's'} assigned in this month
          </span>
          <span className="font-mono font-medium">Total Classwork Pool: {totalMax} pts</span>
        </div>
      </div>

      {/* Task Score Table */}
      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Tasks in This Month</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Assign homework, speaking presentations, or achievement tasks. The scores automatically roll into the monthly ranking.
          </p>
          <button
            type="button"
            onClick={openAddTask}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Create Task
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          No students enrolled in this class.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Classwork Scoring Matrix &middot; {currentClass.name}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  {tasks.map(t => {
                    const typeConfig = TYPE_LABELS[t.type] || TYPE_LABELS.homework;
                    return (
                      <th key={t.id} className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="truncate max-w-[140px] font-semibold text-slate-800 dark:text-slate-200">
                            {t.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(t.id)}
                            className="text-slate-400 hover:text-rose-500"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Max {t.max}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-4 text-right">Classwork Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {students.map(s => {
                  let sum = 0;
                  tasks.forEach(t => {
                    const val = scoresDraft[t.id]?.[s.id];
                    if (val !== '' && val != null) sum += Number(val);
                  });

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

                      {/* Inputs per task */}
                      {tasks.map(t => {
                        const val = scoresDraft[t.id]?.[s.id] ?? '';
                        return (
                          <td key={t.id} className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={t.max}
                              step="0.5"
                              value={val}
                              onChange={e => handleScoreChange(t.id, s.id, e.target.value)}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Add Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Create Classwork Task"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNewTask}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              Add Task
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Task Name *
            </label>
            <input
              type="text"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              placeholder="e.g. Unit 3 Vocabulary Assignment"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Category
              </label>
              <select
                value={taskType}
                onChange={e => setTaskType(e.target.value as ClassworkType)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="homework">Homework</option>
                <option value="quiz">Monthly Quiz</option>
                <option value="exam">Final / Exam</option>
                <option value="project">Project</option>
                <option value="achievement">Achievement Task</option>
                <option value="participation">Participation</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Maximum Points
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={taskMax}
                onChange={e => setTaskMax(Number(e.target.value) || 10)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={taskDate}
              onChange={e => setTaskDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
