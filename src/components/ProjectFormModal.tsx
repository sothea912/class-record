import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Calendar,
  FileText,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ClassItem, ProjectCriterion, ProjectItem } from '../types';
import { todayISO, uid } from '../utils/helpers';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: ProjectItem) => Promise<void>;
  initialProject?: ProjectItem | null;
  classes: ClassItem[];
  selectedClassId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DEFAULT_PROJECT_CRITERIA: ProjectCriterion[] = [
  { id: 'crit_1', name: 'Content & Ideas', maxMark: 20, order: 0 },
  { id: 'crit_2', name: 'Structure & Time', maxMark: 20, order: 1 },
  { id: 'crit_3', name: 'Language Use', maxMark: 20, order: 2 },
  { id: 'crit_4', name: 'Pronunciation & Fluency', maxMark: 20, order: 3 },
  { id: 'crit_5', name: 'Delivery & Visual Aids', maxMark: 20, order: 4 },
];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProject,
  classes,
  selectedClassId,
  onShowToast,
}) => {
  const [name, setName] = useState('Presentation');
  const [classId, setClassId] = useState(selectedClassId || classes[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<ProjectCriterion[]>(DEFAULT_PROJECT_CRITERIA);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name || '');
      setClassId(initialProject.classId || classes[0]?.id || '');
      setDate(initialProject.date || todayISO());
      setDescription(initialProject.description || '');
      setCriteria(
        initialProject.criteria && initialProject.criteria.length > 0
          ? [...initialProject.criteria].sort((a, b) => a.order - b.order)
          : DEFAULT_PROJECT_CRITERIA
      );
    } else {
      setName('Presentation');
      setClassId(selectedClassId && selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '');
      setDate(todayISO());
      setDescription('');
      setCriteria(DEFAULT_PROJECT_CRITERIA.map(c => ({ ...c, id: `crit_${uid()}` })));
    }
    setFormError(null);
  }, [initialProject, isOpen, selectedClassId, classes]);

  // Live total calculation
  const totalMax = useMemo(() => {
    return criteria.reduce((sum, c) => sum + (Number(c.maxMark) || 0), 0);
  }, [criteria]);

  if (!isOpen) return null;

  // Criteria handlers
  const handleAddCriterion = () => {
    const newCriterion: ProjectCriterion = {
      id: `crit_${uid()}`,
      name: `Criterion ${criteria.length + 1}`,
      maxMark: 20,
      order: criteria.length,
    };
    setCriteria(prev => [...prev, newCriterion]);
  };

  const handleUpdateCriterion = (id: string, field: 'name' | 'maxMark', value: any) => {
    setCriteria(prev =>
      prev.map(c => {
        if (c.id === id) {
          if (field === 'maxMark') {
            const num = Math.max(1, Math.min(1000, Number(value) || 0));
            return { ...c, maxMark: num };
          }
          return { ...c, [field]: value };
        }
        return c;
      })
    );
  };

  const handleDeleteCriterion = (id: string) => {
    if (criteria.length <= 1) {
      onShowToast('A project must have at least one grading criterion.', 'info');
      return;
    }
    setCriteria(prev => {
      const filtered = prev.filter(c => c.id !== id);
      return filtered.map((c, idx) => ({ ...c, order: idx }));
    });
  };

  const handleMoveCriterion = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= criteria.length) return;
    setCriteria(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIdx];
      copy[newIdx] = temp;
      return copy.map((c, idx) => ({ ...c, order: idx }));
    });
  };

  const handleResetToDefault = () => {
    setCriteria(DEFAULT_PROJECT_CRITERIA.map(c => ({ ...c, id: `crit_${uid()}` })));
    onShowToast('Reset to default 5 speaking rubric criteria', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a project name.');
      return;
    }
    if (!classId) {
      setFormError('Please select a class for this project.');
      return;
    }
    if (criteria.length === 0) {
      setFormError('Please add at least one criterion.');
      return;
    }
    const emptyCrit = criteria.find(c => !c.name.trim());
    if (emptyCrit) {
      setFormError('All criteria must have a title.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const projectData: ProjectItem = {
        id: initialProject ? initialProject.id : `proj_${uid()}`,
        name: name.trim(),
        classId,
        description: description.trim(),
        date: date || todayISO(),
        criteria: criteria.map((c, idx) => ({
          id: c.id,
          name: c.name.trim(),
          maxMark: Number(c.maxMark) || 20,
          order: idx,
        })),
        totalMax,
        published: initialProject?.published || false,
        createdAt: initialProject ? initialProject.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(projectData);
      onShowToast(
        initialProject
          ? `Project "${projectData.name}" updated successfully.`
          : `Project "${projectData.name}" created!`,
        'success'
      );
      onClose();
    } catch (err: any) {
      console.error('[Project Save Error]:', err);
      setFormError(err.message || 'Failed to save project. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121216] border border-slate-200/80 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {initialProject ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Teacher-graded presentation with customizable scoring criteria
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {formError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Basic Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Presentation, Final Speaking Project"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Class <span className="text-rose-500">*</span>
              </label>
              <select
                value={classId}
                onChange={e => setClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id} className="dark:bg-slate-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Presentation Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Total Max Mark (Auto-calculated)
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-sm font-black text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>{totalMax} Points</span>
                <span className="text-[11px] font-bold text-emerald-600/80 dark:text-emerald-400/80">
                  {criteria.length} criteria
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Description / Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 5-minute individual presentation on environment or technology topics."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* 2. Customizable Grading Criteria Builder */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Grading Criteria Builder</span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                    Customizable Rubric
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Add, rename, adjust max marks, or reorder criteria. Total auto-sums.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Reset to 5 speaking rubric criteria (20 pts each)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Criterion</span>
                </button>
              </div>
            </div>

            {/* Criteria List */}
            <div className="space-y-2">
              {criteria.map((crit, idx) => (
                <div
                  key={crit.id}
                  className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 rounded-2xl transition-colors hover:border-purple-300 dark:hover:border-purple-500/30"
                >
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-0.5 text-slate-400">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCriterion(idx, 'up')}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === criteria.length - 1}
                      onClick={() => handleMoveCriterion(idx, 'down')}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="w-6 text-center text-xs font-black text-slate-400 font-mono">
                    {idx + 1}.
                  </span>

                  {/* Name Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={crit.name}
                      onChange={e => handleUpdateCriterion(crit.id, 'name', e.target.value)}
                      placeholder="Criterion title"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Max Mark Input */}
                  <div className="flex items-center gap-1.5 w-28 shrink-0">
                    <span className="text-[11px] font-bold text-slate-400">Max:</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={crit.maxMark}
                      onChange={e => handleUpdateCriterion(crit.id, 'maxMark', e.target.value)}
                      className="w-16 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCriterion(crit.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete Criterion"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total project maximum:{' '}
            <strong className="text-slate-900 dark:text-white">{totalMax} Marks</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : initialProject ? 'Update Project' : 'Create Project'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
