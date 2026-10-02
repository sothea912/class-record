import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Users,
  Layers,
  CheckSquare,
  FileSpreadsheet,
  Mail,
  FilePenLine,
  Sparkles,
  Trophy,
  GraduationCap,
  BookOpen,
  UserCog,
  ShieldCheck,
  FileUp,
  ArrowRight,
  X,
  FileText,
  Clock,
  Calendar,
  Settings,
} from 'lucide-react';
import { AppState, NavView, StudentItem, ClassItem } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onNavigate: (view: NavView, params?: any) => void;
  onSelectStudent: (student: StudentItem, tab?: string) => void;
  onSelectClass: (classId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  state,
  onNavigate,
  onSelectStudent,
  onSelectClass,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'students' | 'classes' | 'attendance' | 'results' | 'library' | 'settings'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.toLowerCase().trim();

  // 1. STUDENTS MATCH
  const matchingStudents = useMemo(() => {
    if (!q) return state.students.slice(0, 4);
    return state.students.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.studentNo && s.studentNo.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.note && s.note.toLowerCase().includes(q))
    );
  }, [state.students, q]);

  // 2. CLASSES MATCH
  const matchingClasses = useMemo(() => {
    if (!q) return state.classes.slice(0, 3);
    return state.classes.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.level && c.level.toLowerCase().includes(q)) ||
        (c.room && c.room.toLowerCase().includes(q)) ||
        (c.days && c.days.toLowerCase().includes(q))
    );
  }, [state.classes, q]);

  // 3. RESOURCE LIBRARY MATCH
  const matchingResources = useMemo(() => {
    const res = state.resources || [];
    if (!q) return res.slice(0, 3);
    return res.filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.authorOrTeacher && r.authorOrTeacher.toLowerCase().includes(q))
    );
  }, [state.resources, q]);

  // 4. ATTENDANCE ACTIONS & REGISTERS
  const attendanceActions = useMemo(() => {
    const items = [
      {
        id: 'attend',
        title: 'Daily Attendance Register',
        desc: 'Mark daily attendance, late entries & excused leaves',
        icon: CheckSquare,
        view: 'attend' as NavView,
      },
      {
        id: 'attreport',
        title: 'Monthly Attendance Report',
        desc: 'View attendance percentages, aggregates & export summaries',
        icon: FileSpreadsheet,
        view: 'attreport' as NavView,
      },
      {
        id: 'permits',
        title: 'Permission Requests (Telegram)',
        desc: 'Review and approve student excuse letters & leave notices',
        icon: Mail,
        view: 'permits' as NavView,
      },
    ];
    if (!q) return items;
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        'attendance'.includes(q) ||
        'leave'.includes(q) ||
        'excuse'.includes(q) ||
        'absent'.includes(q)
    );
  }, [q]);

  // 5. SCORES, MARKS & RANKINGS
  const scoringActions = useMemo(() => {
    const items = [
      {
        id: 'activity',
        title: 'Class Activity Center',
        desc: 'Create homework assignments, interactive question forms & grade student work',
        icon: FileText,
        view: 'activity' as NavView,
      },
      {
        id: 'subjects',
        title: 'Subjects & Exam Scoring',
        desc: 'Enter monthly test marks for Listening, Speaking, Reading, Writing',
        icon: FilePenLine,
        view: 'subjects' as NavView,
      },
      {
        id: 'classwork',
        title: 'Classwork & Homework Tasks',
        desc: 'Record project assignments, homework & participation points',
        icon: Sparkles,
        view: 'classwork' as NavView,
      },
      {
        id: 'results',
        title: 'Academic Class Ranking',
        desc: 'Overall student ranks, weighted totals, honors & GPA pass/fail',
        icon: Trophy,
        view: 'results' as NavView,
      },
      {
        id: 'report',
        title: 'Student Report Cards',
        desc: 'Individual grade breakdowns, printable report cards & summaries',
        icon: GraduationCap,
        view: 'report' as NavView,
      },
    ];
    if (!q) return items;
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        'marks'.includes(q) ||
        'scores'.includes(q) ||
        'results'.includes(q) ||
        'grades'.includes(q) ||
        'exam'.includes(q) ||
        'rank'.includes(q)
    );
  }, [q]);

  // 6. SYSTEM SETTINGS & AUTHENTICATION MANAGEMENT
  const settingsActions = useMemo(() => {
    const items = [
      {
        id: 'profile',
        title: 'Teacher Profile & School Settings',
        desc: 'Instructor identity, school banner, heading & timetable',
        icon: UserCog,
        view: 'profile' as NavView,
      },
      {
        id: 'portal-sync',
        title: 'Student Accounts & Portal Auth Sync',
        desc: 'Manage student login credentials, passwords & Firebase Auth sync',
        icon: ShieldCheck,
        view: 'profile' as NavView,
      },
      {
        id: 'import',
        title: 'Import JSON File',
        desc: 'Import rosters, JSON database backups, classes or marks',
        icon: FileUp,
        view: 'import' as NavView,
      },
    ];
    if (!q) return items;
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        'settings'.includes(q) ||
        'auth'.includes(q) ||
        'sync'.includes(q) ||
        'password'.includes(q) ||
        'backup'.includes(q) ||
        'import'.includes(q)
    );
  }, [q]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 pt-12 sm:pt-20">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#121212] border border-slate-200/90 dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[82vh]"
        >
          {/* Top Search Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#161616]">
            <Search className="w-5 h-5 text-blue-500 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search students, classes, attendance, marks, resources, settings…"
              className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-200/70 dark:bg-[#202020] border border-slate-300 dark:border-[#303030] px-1.5 py-0.5 rounded text-slate-500">
              ESC to close
            </kbd>
          </div>

          {/* Quick Filter Categories */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-[#202020] bg-white dark:bg-[#121212] overflow-x-auto scrollbar-none text-xs">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'students', label: `Students (${matchingStudents.length})` },
              { id: 'classes', label: `Classes (${matchingClasses.length})` },
              { id: 'attendance', label: 'Attendance' },
              { id: 'results', label: 'Marks & Results' },
              { id: 'library', label: `Library (${matchingResources.length})` },
              { id: 'settings', label: 'Settings & Auth' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e1e1e]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            {/* 1. STUDENTS CATEGORY */}
            {(activeCategory === 'all' || activeCategory === 'students') && matchingStudents.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>Students ({matchingStudents.length})</span>
                  </p>
                  <span className="text-[10px] text-slate-400">Click to open dedicated profile</span>
                </div>
                <div className="space-y-1">
                  {matchingStudents.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onSelectStudent(s);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {s.photo ? (
                          <img src={s.photo} alt={s.name} className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-[#333]" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {s.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            ID: <span className="font-mono text-slate-700 dark:text-slate-300">{s.studentNo || s.id}</span> &bull; {s.sex || 'Student'} &bull; {s.classIds?.length || 0} Class(es)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                          View Profile &rarr;
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. CLASSES CATEGORY */}
            {(activeCategory === 'all' || activeCategory === 'classes') && matchingClasses.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Classes ({matchingClasses.length})</span>
                  </p>
                </div>
                <div className="space-y-1">
                  {matchingClasses.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectClass(c.id);
                        onNavigate('classes');
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Level: {c.level || 'General'} &bull; {c.days || 'Regular'} &bull; Room: {c.room || 'Online'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                        Open Class &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. ATTENDANCE CATEGORY */}
            {(activeCategory === 'all' || activeCategory === 'attendance') && attendanceActions.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Attendance & Leaves</span>
                </p>
                <div className="space-y-1">
                  {attendanceActions.map(a => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onNavigate(a.view);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                              {a.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{a.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. MARKS & SCORING CATEGORY */}
            {(activeCategory === 'all' || activeCategory === 'results') && scoringActions.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Academic Marks & Results</span>
                </p>
                <div className="space-y-1">
                  {scoringActions.map(a => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onNavigate(a.view);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                              {a.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{a.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. RESOURCE LIBRARY */}
            {(activeCategory === 'all' || activeCategory === 'library') && matchingResources.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-500" />
                  <span>Resource Library ({matchingResources.length})</span>
                </p>
                <div className="space-y-1">
                  {matchingResources.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onNavigate('library');
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 truncate">
                            {r.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Category: {r.category} &bull; {r.authorOrTeacher || 'Teacher'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md">
                        Open Library &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. SETTINGS & AUTHENTICATION */}
            {(activeCategory === 'all' || activeCategory === 'settings') && settingsActions.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-purple-500" />
                  <span>Settings & Portal Auth</span>
                </p>
                <div className="space-y-1">
                  {settingsActions.map(s => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onNavigate(s.view);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#262626]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                              {s.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No matches state */}
            {matchingStudents.length === 0 &&
              matchingClasses.length === 0 &&
              matchingResources.length === 0 &&
              attendanceActions.length === 0 &&
              scoringActions.length === 0 &&
              settingsActions.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-semibold">No matches found for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-slate-500 mt-1">Try searching by student name, ID, class, attendance, marks, or resource title.</p>
                </div>
              )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
