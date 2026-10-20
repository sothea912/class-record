import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  Award,
  BookOpen,
  HelpCircle,
  FileCheck2,
  Sparkles,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  X,
  MessageSquare,
  Calendar,
  Layers,
  Percent,
} from 'lucide-react';
import { AppState, ClassItem, StudentItem, ProjectItem, ProjectResult } from '../types';

export interface TaskResultItem {
  id: string;
  type: 'homework' | 'quiz' | 'exam' | 'activity' | 'project';
  title: string;
  date: string;
  status: 'graded' | 'pending' | 'not_submitted';
  score: number | null;
  maxScore: number;
  percentage: number | null;
  comment?: string;
  topic?: string;
  projectCriteria?: Array<{
    id: string;
    name: string;
    score: number;
    maxMark: number;
  }>;
}

interface StudentTaskResultViewProps {
  state: AppState;
  studentId: string;
  currentClassObj?: ClassItem | null;
  onBack: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type FilterChip = 'all' | 'homework' | 'quiz' | 'exam' | 'activity' | 'project';

export const StudentTaskResultView: React.FC<StudentTaskResultViewProps> = ({
  state,
  studentId,
  currentClassObj,
  onBack,
  onShowToast,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [selectedItem, setSelectedItem] = useState<TaskResultItem | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Unseen results tracking in localStorage
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`seen_task_results_${studentId}`);
      if (stored) return new Set(JSON.parse(stored));
    } catch {
      // fallback
    }
    return new Set();
  });

  // Brief initial loading shimmer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // Save newly seen IDs
  const markAsSeen = (id: string) => {
    if (seenIds.has(id)) return;
    setSeenIds(prev => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(`seen_task_results_${studentId}`, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Compile all student tasks & results
  const allTaskResults: TaskResultItem[] = useMemo(() => {
    const items: TaskResultItem[] = [];
    const activeClassId = currentClassObj?.id;

    // 1. Homework
    const studentSubs = (state.homeworkSubmissions || []).filter(s => s?.studentId === studentId);
    const hwList = (state.homework || []).filter(h => {
      if (!h || !h.published) return false;
      if (!activeClassId || activeClassId === 'all') return true;
      return h.classIds && h.classIds.includes(activeClassId);
    });

    hwList.forEach(hw => {
      if (!hw) return;
      const sub = studentSubs.find(s => s?.homeworkId === hw.id);
      const dueDate = hw.dueDateTime || hw.createdAt || new Date().toISOString();

      if (sub && (sub.status === 'marked' || sub.score !== undefined)) {
        const score = typeof sub.score === 'number' ? sub.score : 0;
        const max = hw.maxScore || 100;
        const pct = max > 0 ? Math.round((score / max) * 100) : 0;
        items.push({
          id: `hw_${hw.id}`,
          type: 'homework',
          title: hw.title || 'Homework',
          date: sub.markedAt || sub.submittedAt || dueDate,
          status: 'graded',
          score,
          maxScore: max,
          percentage: pct,
          comment: sub.teacherNote || (sub as any).feedback || (sub as any).comment || '',
        });
      } else if (sub && sub.status === 'submitted') {
        items.push({
          id: `hw_${hw.id}`,
          type: 'homework',
          title: hw.title || 'Homework',
          date: sub.submittedAt || dueDate,
          status: 'pending',
          score: null,
          maxScore: hw.maxScore || 100,
          percentage: null,
          comment: '',
        });
      } else {
        items.push({
          id: `hw_${hw.id}`,
          type: 'homework',
          title: hw.title || 'Homework',
          date: dueDate,
          status: 'not_submitted',
          score: null,
          maxScore: hw.maxScore || 100,
          percentage: null,
          comment: '',
        });
      }
    });

    // 2. Activities (Quizzes, Achievement & Exams, Custom Activities)
    const attempts = (state.activityAttempts || []).filter(a => a?.studentId === studentId);
    const actList = (state.activities || []).filter(a => {
      if (!a || !a.published) return false;
      if (!activeClassId || activeClassId === 'all') return true;
      return a.classIds && a.classIds.includes(activeClassId);
    });

    actList.forEach(act => {
      if (!act) return;
      const att = attempts.find(a => a?.activityId === act.id);
      const actType = act.kind === 'quiz' ? 'quiz' : act.kind === 'exam' ? 'exam' : 'activity';
      const dueDate = act.dueDateTime || act.createdAt || new Date().toISOString();

      if (att && (att.markedAt || att.status === 'marked' || typeof att.score === 'number')) {
        const score = typeof att.score === 'number' ? att.score : 0;
        const max = act.maxScore || 100;
        const pct = max > 0 ? Math.round((score / max) * 100) : 0;
        items.push({
          id: `act_${act.id}`,
          type: actType,
          title: act.title || 'Activity',
          date: att.markedAt || att.submittedAt || dueDate,
          status: 'graded',
          score,
          maxScore: max,
          percentage: pct,
          comment: att.teacherNote || (att as any).feedback || '',
        });
      } else if (att) {
        items.push({
          id: `act_${act.id}`,
          type: actType,
          title: act.title || 'Activity',
          date: att.submittedAt || dueDate,
          status: 'pending',
          score: null,
          maxScore: act.maxScore || 100,
          percentage: null,
          comment: '',
        });
      } else {
        items.push({
          id: `act_${act.id}`,
          type: actType,
          title: act.title || 'Activity',
          date: dueDate,
          status: 'not_submitted',
          score: null,
          maxScore: act.maxScore || 100,
          percentage: null,
          comment: '',
        });
      }
    });

    // 3. Projects (Presentation Projects - ONLY published projects)
    const projects = (state.projects || []).filter(p => {
      if (!p || !p.published) return false;
      if (!activeClassId || activeClassId === 'all') return true;
      return p.classId === activeClassId;
    });

    projects.forEach(proj => {
      if (!proj) return;
      const result = (state.projectResults || []).find(
        r => r && r.projectId === proj.id && r.studentId === studentId && (r.published !== false)
      );

      if (result) {
        const total = typeof result.total === 'number' ? result.total : 0;
        const max = proj.totalMax || 100;
        const pct = max > 0 ? Math.round((total / max) * 100) : 0;

        const criteriaBreakdown = (proj.criteria || []).map(crit => ({
          id: crit.id,
          name: crit.name,
          score: result.scores && typeof result.scores[crit.id] === 'number' ? result.scores[crit.id] : 0,
          maxMark: crit.maxMark,
        }));

        items.push({
          id: `proj_${proj.id}`,
          type: 'project',
          title: proj.name || 'Project',
          date: result.gradedAt || proj.date || proj.createdAt,
          status: 'graded',
          score: total,
          maxScore: max,
          percentage: pct,
          comment: result.comment || '',
          topic: result.topic || '',
          projectCriteria: criteriaBreakdown,
        });
      } else {
        items.push({
          id: `proj_${proj.id}`,
          type: 'project',
          title: proj.name || 'Project',
          date: proj.date || proj.createdAt,
          status: 'pending',
          score: null,
          maxScore: proj.totalMax || 100,
          percentage: null,
          comment: '',
        });
      }
    });

    // Sort newest first by date
    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });

    return items;
  }, [state, studentId, currentClassObj]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allTaskResults;
    return allTaskResults.filter(i => i.type === activeFilter);
  }, [allTaskResults, activeFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const graded = allTaskResults.filter(i => i.status === 'graded' && i.percentage !== null);
    const totalGraded = graded.length;
    const avgScore = totalGraded > 0
      ? Math.round(graded.reduce((sum, i) => sum + (i.percentage || 0), 0) / totalGraded)
      : null;
    const latest = graded.length > 0 ? graded[0] : null;

    return { totalGraded, avgScore, latest };
  }, [allTaskResults]);

  // Score color helper matching Merit Standing
  const getScoreColorClass = (pct: number | null) => {
    if (pct === null) return 'text-slate-400 dark:text-slate-500';
    if (pct >= 80) return 'text-emerald-500 dark:text-emerald-400';
    if (pct >= 60) return 'text-blue-500 dark:text-blue-400';
    if (pct >= 50) return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-500 dark:text-rose-400';
  };

  // Type badge formatting
  const getTypeMeta = (type: TaskResultItem['type']) => {
    switch (type) {
      case 'homework':
        return {
          label: 'Homework',
          icon: BookOpen,
          bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'quiz':
        return {
          label: 'Quiz',
          icon: HelpCircle,
          bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
      case 'exam':
        return {
          label: 'Exam',
          icon: FileCheck2,
          bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      case 'activity':
        return {
          label: 'Activity',
          icon: Sparkles,
          bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'project':
        return {
          label: 'Project',
          icon: FolderKanban,
          bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
        };
    }
  };

  const handleOpenDetail = (item: TaskResultItem) => {
    markAsSeen(item.id);
    setSelectedItem(item);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#13091e] via-[#0d0517] to-[#07020d] text-slate-100 flex justify-center pb-28 pt-2 antialiased">
      <div className="w-full max-w-[440px] px-4 space-y-4">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 pt-2 pb-3 bg-[#13091e]/90 backdrop-blur-xl border-b border-purple-500/15 flex items-center justify-between -mx-4 px-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-purple-500/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer min-h-[44px]"
              aria-label="Back to overview"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Task Result</span>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              </h1>
              <p className="text-[11px] font-semibold text-purple-300/80 truncate max-w-[240px]">
                {currentClassObj?.name || 'Class Record'} &middot; Academic History
              </p>
            </div>
          </div>

          <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </header>

        {/* Top Summary Card (3 Compact Stats Side by Side) */}
        <div className="bg-[#1a0f2e]/80 border border-purple-500/25 rounded-3xl p-3.5 backdrop-blur-xl shadow-lg shadow-purple-950/20">
          <div className="grid grid-cols-3 divide-x divide-purple-500/20">
            {/* 1. Total Graded */}
            <div className="text-center px-2 flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-1.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-purple-200/70 uppercase tracking-wider block">
                Total Graded
              </span>
              <span className="text-base sm:text-lg font-black text-white tabular-nums mt-0.5">
                {stats.totalGraded}
              </span>
            </div>

            {/* 2. Average Score */}
            <div className="text-center px-2 flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-1.5">
                <Percent className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-purple-200/70 uppercase tracking-wider block">
                Average Score
              </span>
              <span
                className={`text-base sm:text-lg font-black tabular-nums mt-0.5 ${getScoreColorClass(
                  stats.avgScore
                )}`}
              >
                {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
              </span>
            </div>

            {/* 3. Latest Result */}
            <div className="text-center px-2 flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-1.5">
                <Award className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-purple-200/70 uppercase tracking-wider block">
                Latest Result
              </span>
              <span className="text-base sm:text-lg font-black text-white tabular-nums mt-0.5 truncate max-w-full">
                {stats.latest && stats.latest.score !== null
                  ? `${stats.latest.score}/${stats.latest.maxScore}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Horizontally Scrollable Filter Chips (scrollbar hidden) */}
        <div className="no-scrollbar overflow-x-auto -mx-4 px-4 flex items-center gap-2 py-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'homework', label: 'Homework' },
              { id: 'quiz', label: 'Quiz' },
              { id: 'exam', label: 'Exam' },
              { id: 'activity', label: 'Activity' },
              { id: 'project', label: 'Project' },
            ] as const
          ).map(chip => {
            const isActive = activeFilter === chip.id;
            const count =
              chip.id === 'all'
                ? allTaskResults.length
                : allTaskResults.filter(i => i.type === chip.id).length;

            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black tracking-tight whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400/50'
                    : 'bg-[#180e2b]/80 text-purple-200/70 hover:bg-[#201338] hover:text-white border border-purple-500/15'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single-Column List of Result Cards */}
        {isLoading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className="bg-[#170e28]/70 border border-purple-500/15 rounded-3xl p-4 animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-purple-500/15 rounded-md w-3/4" />
                    <div className="h-3 bg-purple-500/10 rounded-md w-1/3" />
                  </div>
                  <div className="w-16 h-8 bg-purple-500/15 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-[#170e28]/60 border border-purple-500/20 rounded-3xl p-8 text-center space-y-3 shadow-sm my-6">
            <div className="w-14 h-14 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-white">
                No results yet. Your graded work will appear here.
              </h3>
              <p className="text-xs text-purple-200/70 max-w-xs mx-auto">
                Graded homework, quizzes, exams, and published projects will be displayed automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {filteredItems.map(item => {
              const meta = getTypeMeta(item.type);
              const Icon = meta.icon;
              const isUnseen = !seenIds.has(item.id);
              const isCommentExpanded = expandedComments[item.id] || false;
              const hasComment = Boolean(item.comment && item.comment.trim());

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="relative bg-[#170e28]/85 hover:bg-[#1f1335] active:scale-[0.99] border border-purple-500/20 hover:border-purple-400/50 rounded-3xl p-4 shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${meta.bg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.bg}`}
                        >
                          {meta.label}
                        </span>

                        {item.status === 'graded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Graded</span>
                          </span>
                        ) : item.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            <AlertCircle className="w-3 h-3" />
                            <span>Not Submitted</span>
                          </span>
                        )}

                        {isUnseen && item.status === 'graded' && (
                          <span className="flex h-2 w-2 relative" title="New unseen score">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                          </span>
                        )}
                      </div>

                      <h2 className="text-sm font-extrabold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                        {item.title}
                      </h2>

                      {item.topic && (
                        <p className="text-[11px] text-purple-200/80 italic line-clamp-1 mt-0.5">
                          Topic: {item.topic}
                        </p>
                      )}

                      <span className="text-[10px] font-semibold text-purple-300/60 block mt-1">
                        {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="text-right shrink-0 pl-1">
                      {item.score !== null ? (
                        <>
                          <div className="text-base sm:text-lg font-black tracking-tight text-white tabular-nums">
                            {item.score}
                            <span className="text-[11px] font-normal text-purple-300/60 ml-0.5">
                              /{item.maxScore}
                            </span>
                          </div>
                          <div
                            className={`text-[11px] font-black tabular-nums ${getScoreColorClass(
                              item.percentage
                            )}`}
                          >
                            {item.percentage}%
                          </div>
                        </>
                      ) : (
                        <span className="text-xs font-mono font-bold text-purple-300/50">—</span>
                      )}
                    </div>
                  </div>

                  {hasComment && (
                    <div
                      className="mt-3 pt-2.5 border-t border-purple-500/15"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-2 bg-[#120820]/80 border border-purple-500/15 rounded-2xl p-2.5 text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-purple-300/70 block uppercase">
                            Teacher Remark
                          </span>
                          <p
                            className={`text-slate-200 mt-0.5 break-words ${
                              isCommentExpanded ? '' : 'line-clamp-2'
                            }`}
                          >
                            "{item.comment}"
                          </p>
                          {(item.comment?.length || 0) > 85 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedComments(prev => ({
                                  ...prev,
                                  [item.id]: !prev[item.id],
                                }))
                              }
                              className="text-[10px] font-bold text-purple-400 hover:text-purple-300 mt-1 cursor-pointer"
                            >
                              {isCommentExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-semibold text-purple-300/60 pt-1">
                    <span>Tap to view details</span>
                    <ChevronRight className="w-3.5 h-3.5 text-purple-400/80 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* DETAIL VIEW BOTTOM SHEET / MODAL */}
      {/* =================================================================== */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[460px] bg-[#170e28] border-t sm:border border-purple-500/25 rounded-t-[32px] sm:rounded-3xl max-h-[88vh] overflow-y-auto shadow-2xl p-5 text-slate-100 space-y-4 animate-in slide-in-from-bottom duration-250"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 rounded-full bg-purple-500/30 mx-auto sm:hidden -mt-1 mb-2" />

            <div className="flex items-start justify-between gap-3 border-b border-purple-500/15 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      getTypeMeta(selectedItem.type).bg
                    }`}
                  >
                    {getTypeMeta(selectedItem.type).label}
                  </span>
                  <span className="text-[11px] text-purple-300/70 font-semibold">
                    {selectedItem.date ? new Date(selectedItem.date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  {selectedItem.title}
                </h3>
                {selectedItem.topic && (
                  <p className="text-xs text-purple-300/90 italic mt-0.5">
                    Topic: {selectedItem.topic}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#1f1335]/70 border border-purple-500/20 rounded-3xl p-5 text-center flex flex-col items-center justify-center space-y-2">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-purple-950/60 stroke-current"
                    strokeWidth="3.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`stroke-current ${
                      selectedItem.percentage && selectedItem.percentage >= 80
                        ? 'text-emerald-400'
                        : selectedItem.percentage && selectedItem.percentage >= 60
                        ? 'text-blue-400'
                        : selectedItem.percentage && selectedItem.percentage >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                    strokeDasharray={`${selectedItem.percentage || 0}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-white tabular-nums">
                    {selectedItem.score !== null ? selectedItem.score : '—'}
                  </span>
                  <span className="text-[10px] text-purple-300/70 font-bold -mt-0.5">
                    /{selectedItem.maxScore}
                  </span>
                </div>
              </div>

              <div>
                <span
                  className={`text-sm font-black tabular-nums ${getScoreColorClass(
                    selectedItem.percentage
                  )}`}
                >
                  {selectedItem.percentage !== null ? `${selectedItem.percentage}%` : 'Pending'}
                </span>
                <span className="text-[11px] text-purple-200/70 block">
                  {selectedItem.status === 'graded' ? 'Final Evaluated Mark' : 'Awaiting Grading'}
                </span>
              </div>
            </div>

            {selectedItem.type === 'project' && selectedItem.projectCriteria && (
              <div className="space-y-2.5">
                <span className="text-xs font-black text-purple-300 uppercase tracking-wider block">
                  Rubric Criteria Breakdown
                </span>

                <div className="space-y-2 bg-[#120820]/90 border border-purple-500/20 rounded-2xl p-3">
                  {selectedItem.projectCriteria.map(crit => {
                    const critPct =
                      crit.maxMark > 0 ? Math.round((crit.score / crit.maxMark) * 100) : 0;
                    return (
                      <div key={crit.id} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">{crit.name}</span>
                          <span className="font-mono font-bold text-purple-300 tabular-nums">
                            {crit.score} / {crit.maxMark}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-purple-950/60 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: `${Math.min(100, critPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedItem.comment ? (
              <div className="space-y-1.5">
                <span className="text-xs font-black text-purple-300 uppercase tracking-wider block">
                  Teacher's Evaluation &amp; Feedback
                </span>
                <div className="bg-[#120820] border border-purple-500/25 rounded-2xl p-4 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold">
                    <MessageSquare className="w-4 h-4" />
                    <span>Teacher Remarks</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap italic">
                    "{selectedItem.comment}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#120820]/60 border border-purple-500/10 rounded-2xl p-3 text-center text-xs text-purple-300/60">
                No teacher comments entered for this item.
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-black text-xs transition-all shadow-md shadow-purple-600/30 cursor-pointer min-h-[44px]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
