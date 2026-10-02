import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  RotateCcw,
  Save,
  Send,
  HelpCircle,
  Award,
  AlertTriangle,
  Eye,
  FileDown,
  ShieldAlert,
  GraduationCap,
  Trophy,
  Image as ImageIcon,
  Paperclip,
  Lock,
  Timer,
  CheckSquare,
} from 'lucide-react';
import {
  AppState,
  HomeworkItem,
  HomeworkQuestion,
  HomeworkSubmission,
  ActivityItem,
  ActivityAttempt,
  StudentBadgeItem,
  StudentItem,
} from '../types';
import {
  syncSaveHomeworkSubmission,
  syncFetchHomeworkFile,
  compressImageForHomework,
  syncSaveActivityAttempt,
  syncFetchActivityQuestions,
} from '../utils/firestoreSync';
import { round1, todayISO } from '../utils/helpers';
import { Modal } from '../components/Modal';

interface StudentActivityViewProps {
  state: AppState;
  studentId: string;
  student: StudentItem;
  activeClassId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function formatTimeRemaining(dueDateTimeStr: string): { text: string; isOverdue: boolean } {
  const due = new Date(dueDateTimeStr).getTime();
  const now = Date.now();
  const diff = due - now;

  if (diff <= 0) {
    const pastMinutes = Math.floor(-diff / (1000 * 60));
    if (pastMinutes < 60) return { text: `Overdue by ${pastMinutes}m`, isOverdue: true };
    const pastHours = Math.floor(pastMinutes / 60);
    if (pastHours < 24) return { text: `Overdue by ${pastHours}h`, isOverdue: true };
    const pastDays = Math.floor(pastHours / 24);
    return { text: `Overdue by ${pastDays}d`, isOverdue: true };
  }

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return { text: `Due in ${minutes}m`, isOverdue: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMins = minutes % 60;
    return { text: `Due in ${hours}h ${remMins > 0 ? `${remMins}m` : ''}`, isOverdue: false };
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return { text: `Due in ${days}d ${remHours > 0 ? `${remHours}h` : ''}`, isOverdue: false };
}

export const StudentActivityView: React.FC<StudentActivityViewProps> = ({
  state,
  studentId,
  student,
  activeClassId,
  onShowToast,
}) => {
  // Top 4 Section Tabs
  const [activeSection, setActiveSection] = useState<'homework' | 'quizzes' | 'achievement' | 'custom'>('homework');

  // Filter tabs for Homework
  const [hwTab, setHwTab] = useState<'todo' | 'submitted' | 'marked' | 'overdue'>('todo');

  // Filter tabs for Quizzes / Exams
  const [quizTab, setQuizTab] = useState<'upcoming' | 'open' | 'completed'>('open');

  // Active Homework Modal
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);

  // Active Quiz / Exam Runner Modal
  const [activeRunningActivity, setActiveRunningActivity] = useState<ActivityItem | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActivityAttempt | null>(null);
  const [activityQuestions, setActivityQuestions] = useState<HomeworkQuestion[]>([]);

  // Start Quiz Confirmation Dialog
  const [confirmStartActivity, setConfirmStartActivity] = useState<ActivityItem | null>(null);

  // Exam Instructions Acceptance
  const [examInstructionsAccepted, setExamInstructionsAccepted] = useState(false);

  // Runner state: current question index / current section ID
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [currentSectionId, setCurrentSectionId] = useState<string>('');
  const [runnerAnswers, setRunnerAnswers] = useState<Record<string, any>>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState<'Saved' | 'Saving...' | 'Offline'>('Saved');

  // Light integrity log: tab switches count
  const [tabSwitchesCount, setTabSwitchesCount] = useState<number>(0);

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeRemainingSec, setOvertimeRemainingSec] = useState<number>(300); // 5 mins extra

  // Result Slip Modal
  const [resultSlipAttempt, setResultSlipAttempt] = useState<{ attempt: ActivityAttempt; activity: ActivityItem } | null>(null);

  // Filtered lists for this student
  const studentEnrolledClassIds = student?.classIds || [activeClassId];

  const studentHomework = useMemo(() => {
    return (state.homework || []).filter(
      h => h.published && h.classIds.some(cId => studentEnrolledClassIds.includes(cId))
    );
  }, [state.homework, studentEnrolledClassIds]);

  const studentActivities = useMemo(() => {
    return (state.activities || []).filter(
      a => a.published && a.classIds.some(cId => studentEnrolledClassIds.includes(cId))
    );
  }, [state.activities, studentEnrolledClassIds]);

  const studentBadges = useMemo(() => {
    return (state.studentBadges || []).filter(b => b.studentId === studentId);
  }, [state.studentBadges, studentId]);

  // Track tab visibility changes for integrity log
  useEffect(() => {
    if (!activeRunningActivity) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchesCount(prev => prev + 1);
      }
    };
    const handleBlur = () => {
      setTabSwitchesCount(prev => prev + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeRunningActivity]);

  // Server-synced countdown timer effect
  useEffect(() => {
    if (!activeRunningActivity || !activeAttempt) return;

    const startMs = activeAttempt.serverStartTimeMs || new Date(activeAttempt.startedAt).getTime() || Date.now();
    const durationMs = ((activeAttempt.durationMinutes || 30) + (activeAttempt.extraMinutesGranted || 0)) * 60 * 1000;
    const overtimeTotalMs = 5 * 60 * 1000; // 5 extra minutes

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startMs;
      const remMs = durationMs - elapsed;

      if (remMs > 0) {
        setRemainingSeconds(Math.floor(remMs / 1000));
        setIsOvertime(false);
      } else {
        const overElapsed = elapsed - durationMs;
        const overRemMs = overtimeTotalMs - overElapsed;
        if (overRemMs > 0) {
          setIsOvertime(true);
          setOvertimeRemainingSec(Math.floor(overRemMs / 1000));
        } else {
          // Extra time expired -> Auto Submit!
          clearInterval(timerInterval);
          handleAutoSubmitTimeUp();
        }
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [activeRunningActivity, activeAttempt]);

  // Auto-save answers every 5 seconds
  useEffect(() => {
    if (!activeAttempt || !activeRunningActivity || activeAttempt.status === 'submitted' || activeAttempt.status === 'marked') return;

    const autoSaveTimer = setTimeout(async () => {
      setIsAutoSaving(true);
      setSaveStatusText('Saving...');
      try {
        const updated: ActivityAttempt = {
          ...activeAttempt,
          answers: runnerAnswers,
          tabSwitchesCount,
          updatedAt: new Date().toISOString(),
        };
        await syncSaveActivityAttempt(updated);
        setSaveStatusText('Saved');
      } catch (err) {
        setSaveStatusText('Offline');
      } finally {
        setIsAutoSaving(false);
      }
    }, 4000);

    return () => clearTimeout(autoSaveTimer);
  }, [runnerAnswers, tabSwitchesCount]);

  // Start Quiz / Exam Attempt
  const handleStartAttempt = async (activity: ActivityItem) => {
    setConfirmStartActivity(null);
    const attemptId = `${activity.id}_${studentId}`;
    const nowISO = new Date().toISOString();

    const newAttempt: ActivityAttempt = {
      id: attemptId,
      activityId: activity.id,
      studentId: studentId,
      classId: activeClassId || activity.classIds[0],
      kind: activity.kind,
      attemptNumber: 1,
      startedAt: nowISO,
      serverStartTimeMs: Date.now(),
      durationMinutes: activity.durationMinutes || 30,
      extraMinutesGranted: 0,
      status: 'in_progress',
      answers: {},
      tabSwitchesCount: 0,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    try {
      await syncSaveActivityAttempt(newAttempt);
      const qList = await syncFetchActivityQuestions(activity.id) || activity.questions || [];
      setActivityQuestions(qList);
      setActiveAttempt(newAttempt);
      setRunnerAnswers({});
      setCurrentQIndex(0);
      setTabSwitchesCount(0);
      if (activity.sections && activity.sections.length > 0) {
        setCurrentSectionId(activity.sections[0].id);
      }
      setActiveRunningActivity(activity);
      onShowToast(`Started ${activity.title}. Timer is running!`, 'success');
    } catch (err: any) {
      onShowToast('Failed to start: ' + err.message, 'error');
    }
  };

  // Student Submits Quiz / Exam
  const handleManualSubmit = async () => {
    if (!activeAttempt || !activeRunningActivity) return;
    try {
      const updated: ActivityAttempt = {
        ...activeAttempt,
        status: 'submitted',
        answers: runnerAnswers,
        tabSwitchesCount,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await syncSaveActivityAttempt(updated, student.name, activeRunningActivity.title);
      onShowToast('Quiz submitted successfully! Great work.', 'success');
      setActiveRunningActivity(null);
      setActiveAttempt(null);
    } catch (err: any) {
      onShowToast('Submission failed: ' + err.message, 'error');
    }
  };

  // Auto submit on time up
  const handleAutoSubmitTimeUp = async () => {
    if (!activeAttempt || !activeRunningActivity) return;
    try {
      const updated: ActivityAttempt = {
        ...activeAttempt,
        status: 'auto_submitted',
        answers: runnerAnswers,
        tabSwitchesCount,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await syncSaveActivityAttempt(updated, student.name, activeRunningActivity.title);
      onShowToast('Time expired! Your quiz was automatically submitted.', 'info');
      setActiveRunningActivity(null);
      setActiveAttempt(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Photo question answer upload
  const handlePhotoAnswerUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageForHomework(file, 1600);
      setRunnerAnswers(prev => ({ ...prev, [qId]: compressed }));
      onShowToast('Photo answer attached', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload photo', 'error');
    }
  };

  // Format timer string
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* =================================================================== */}
      {/* WELCOME BANNER & SECTION TABS */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 backdrop-blur-sm text-purple-300">
              Student Activity Hub
            </span>
            <h1 className="text-2xl font-black tracking-tight mt-1">Class Activities & Quizzes</h1>
            <p className="text-xs text-purple-200/80">
              Complete homework, monthly quizzes, achievement exams & earn badges!
            </p>
          </div>

          {/* Badges Count */}
          {studentBadges.length > 0 && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <Trophy className="w-5 h-5 text-amber-300" />
              <div>
                <span className="text-xs font-black block">{studentBadges.length} Badges Earned</span>
                <span className="text-[10px] text-purple-200">View Achievements below</span>
              </div>
            </div>
          )}
        </div>

        {/* 4 Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveSection('homework')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'homework'
                ? 'bg-white text-purple-950 shadow-md font-black'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Homework</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('quizzes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'quizzes'
                ? 'bg-white text-purple-950 shadow-md font-black'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Quizzes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('achievement')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'achievement'
                ? 'bg-white text-purple-950 shadow-md font-black'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Achievement & Exams</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('custom')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'custom'
                ? 'bg-white text-purple-950 shadow-md font-black'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Activities</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* A. HOMEWORK SECTION */}
      {/* =================================================================== */}
      {activeSection === 'homework' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {studentHomework.map(hw => {
              const sub = (state.homeworkSubmissions || []).find(
                s => s.homeworkId === hw.id && s.studentId === studentId
              );
              const isMarked = sub?.status === 'marked';
              const isSubmitted = sub?.status === 'submitted' || sub?.status === 'late';
              const countdown = formatTimeRemaining(hw.dueDateTime);

              return (
                <div
                  key={hw.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        {hw.type === 'form' ? 'Interactive Form' : 'Document'}
                      </span>
                      <span className={`text-[10px] font-bold ${countdown.isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                        {countdown.text}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">{hw.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{hw.instructions}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {isMarked ? `Score: ${sub?.score}/${hw.maxScore}` : isSubmitted ? 'Submitted' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedHomework(hw)}
                      className="px-3.5 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-500 cursor-pointer"
                    >
                      {isMarked ? 'View Mark' : isSubmitted ? 'View Submission' : 'Open Homework'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* B. QUIZZES SECTION */}
      {/* =================================================================== */}
      {activeSection === 'quizzes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {studentActivities.filter(a => a.kind === 'quiz').map(quiz => {
              const attempt = (state.activityAttempts || []).find(
                a => a.activityId === quiz.id && a.studentId === studentId
              );
              const isMarked = attempt?.status === 'marked';
              const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';

              // Check if currently open
              const now = Date.now();
              const openMs = quiz.opensAt ? new Date(quiz.opensAt).getTime() : 0;
              const closeMs = quiz.closesAt ? new Date(quiz.closesAt).getTime() : Infinity;
              const isOpenNow = (!quiz.opensAt || now >= openMs) && (!quiz.closesAt || now <= closeMs);

              return (
                <div
                  key={quiz.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        <span>{quiz.durationMinutes} Mins</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {isOpenNow ? '🟢 Open Now' : '⚪ Scheduled'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">{quiz.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{quiz.instructions}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {isMarked ? (
                        <span className="text-xs font-black text-emerald-600 block">
                          Score: {attempt.score}/{quiz.maxScore}
                        </span>
                      ) : isSubmitted ? (
                        <span className="text-xs font-bold text-blue-600 block">Submitted</span>
                      ) : (
                        <span className="text-xs text-slate-400">Not Started</span>
                      )}
                    </div>

                    {!isSubmitted && !isMarked ? (
                      <button
                        type="button"
                        disabled={!isOpenNow}
                        onClick={() => setConfirmStartActivity(quiz)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Take Quiz
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (attempt) setResultSlipAttempt({ attempt, activity: quiz });
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200"
                      >
                        View Result
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* C. ACHIEVEMENT & FINAL EXAM SECTION */}
      {/* =================================================================== */}
      {activeSection === 'achievement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {studentActivities.filter(a => a.kind === 'exam').map(exam => {
              const attempt = (state.activityAttempts || []).find(
                a => a.activityId === exam.id && a.studentId === studentId
              );
              const isMarked = attempt?.status === 'marked';
              const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';

              return (
                <div
                  key={exam.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{(exam.sections || []).length} Sections &middot; {exam.durationMinutes}m</span>
                      </span>
                      {isMarked && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${attempt.passed ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'}`}>
                          Grade {attempt.grade} &middot; {attempt.passed ? 'PASS' : 'FAIL'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">{exam.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{exam.instructions}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {isMarked ? (
                        <span className="text-xs font-black text-rose-600 block">
                          Score: {attempt.score}/{exam.maxScore}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">Pass: {exam.passPercent || 50}%</span>
                      )}
                    </div>

                    {!isSubmitted && !isMarked ? (
                      <button
                        type="button"
                        onClick={() => setConfirmStartActivity(exam)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Start Exam
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (attempt) setResultSlipAttempt({ attempt, activity: exam });
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200"
                      >
                        Result Slip
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Badges Gallery */}
          {studentBadges.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Earned Achievements & Badges</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {studentBadges.map(badge => (
                  <div key={badge.id} className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                      <Award className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{badge.title}</h4>
                    <p className="text-[10px] text-slate-500">{badge.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* D. CUSTOM ACTIVITIES SECTION */}
      {/* =================================================================== */}
      {activeSection === 'custom' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {studentActivities.filter(a => a.kind === 'custom').map(act => (
              <div
                key={act.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    {act.activityTypeLabel || 'Task'}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">{act.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{act.instructions}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600">Max: {act.maxScore} pts</span>
                  <button
                    type="button"
                    onClick={() => setConfirmStartActivity(act)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Open Activity
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: START QUIZ / EXAM CONFIRMATION */}
      {/* =================================================================== */}
      {confirmStartActivity && (
        <Modal
          isOpen={!!confirmStartActivity}
          onClose={() => setConfirmStartActivity(null)}
          title={`Start ${confirmStartActivity.kind === 'exam' ? 'Examination' : 'Quiz'}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Timer Notice</span>
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                You will have <strong>{confirmStartActivity.durationMinutes} minutes</strong> to complete this task. The timer runs continuously on the server clock and cannot be paused.
              </p>
            </div>

            {confirmStartActivity.kind === 'exam' && (
              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={examInstructionsAccepted}
                  onChange={e => setExamInstructionsAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600"
                />
                <span>I have read all examination rules and agree to submit my own independent work.</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStartActivity(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmStartActivity.kind === 'exam' && !examInstructionsAccepted}
                onClick={() => handleStartAttempt(confirmStartActivity)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-40 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Begin Now
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* INTERACTIVE QUIZ / EXAM RUNNER MODAL */}
      {/* =================================================================== */}
      {activeRunningActivity && activeAttempt && (
        <Modal
          isOpen={!!activeRunningActivity}
          onClose={() => {}} // Block accidental close without submitting
          title={activeRunningActivity.title}
          size="2xl"
        >
          <div className="space-y-5 max-h-[85vh] overflow-y-auto pr-1">
            {/* Top Status Bar: Timer + Auto-save indicator */}
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Status:</span>
                <span className={`text-xs font-bold ${saveStatusText === 'Saved' ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {saveStatusText}
                </span>
              </div>

              {/* Server Clock Countdown */}
              <div className={`px-4 py-1.5 rounded-xl font-black text-sm font-mono flex items-center gap-2 shadow-sm ${
                isOvertime
                  ? 'bg-amber-500 text-white animate-pulse'
                  : remainingSeconds <= 300
                  ? 'bg-rose-500 text-white'
                  : 'bg-purple-600 text-white'
              }`}>
                <Timer className="w-4 h-4" />
                <span>
                  {isOvertime ? `Extra time: ${formatTimer(overtimeRemainingSec)}` : formatTimer(remainingSeconds)}
                </span>
              </div>
            </div>

            {/* Questions Form */}
            <div className="space-y-6">
              {activityQuestions.map((q, idx) => {
                if (activeRunningActivity.pageMode === 'one_per_page' && idx !== currentQIndex) {
                  return null;
                }

                return (
                  <div key={q.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{q.title}</h3>
                          {q.description && <p className="text-xs text-slate-500 mt-1">{q.description}</p>}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-purple-600">{q.points} pts</span>
                    </div>

                    {q.image && (
                      <img src={q.image} alt="Question" className="max-h-64 rounded-2xl border object-contain mx-auto" />
                    )}

                    {/* Question Answering Inputs */}
                    {q.type === 'choice' && (
                      <div className="space-y-2 pt-2">
                        {(q.options || []).map((opt, oIdx) => (
                          <label key={oIdx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-purple-500 transition-colors">
                            <input
                              type="radio"
                              name={`ans_${q.id}`}
                              checked={runnerAnswers[q.id] === opt}
                              onChange={() => setRunnerAnswers(prev => ({ ...prev, [q.id]: opt }))}
                              className="text-purple-600"
                            />
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === 'checkbox' && (
                      <div className="space-y-2 pt-2">
                        {(q.options || []).map((opt, oIdx) => {
                          const currentArr: string[] = Array.isArray(runnerAnswers[q.id]) ? runnerAnswers[q.id] : [];
                          return (
                            <label key={oIdx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-purple-500 transition-colors">
                              <input
                                type="checkbox"
                                checked={currentArr.includes(opt)}
                                onChange={e => {
                                  const nextArr = e.target.checked
                                    ? [...currentArr, opt]
                                    : currentArr.filter(x => x !== opt);
                                  setRunnerAnswers(prev => ({ ...prev, [q.id]: nextArr }));
                                }}
                                className="rounded text-purple-600"
                              />
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'short' && (
                      <input
                        type="text"
                        value={runnerAnswers[q.id] || ''}
                        onChange={e => setRunnerAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Your answer..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      />
                    )}

                    {q.type === 'long' && (
                      <textarea
                        rows={4}
                        value={runnerAnswers[q.id] || ''}
                        onChange={e => setRunnerAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your detailed response..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    )}

                    {q.type === 'photo' && (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-purple-100">
                          <Upload className="w-4 h-4" />
                          <span>{runnerAnswers[q.id] ? 'Change Uploaded Photo' : 'Upload Photo Answer'}</span>
                          <input type="file" accept="image/*" onChange={e => handlePhotoAnswerUpload(q.id, e)} className="hidden" />
                        </label>
                        {runnerAnswers[q.id] && (
                          <img src={runnerAnswers[q.id]} alt="Answer" className="max-h-48 rounded-xl border" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions: Prev / Next / Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              {activeRunningActivity.pageMode === 'one_per_page' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-30 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentQIndex === activityQuestions.length - 1}
                    onClick={() => setCurrentQIndex(prev => Math.min(activityQuestions.length - 1, prev + 1))}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold disabled:opacity-30 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleManualSubmit}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md hover:opacity-90 cursor-pointer"
              >
                Submit Answers
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: RESULT SLIP VIEW */}
      {/* =================================================================== */}
      {resultSlipAttempt && (
        <Modal
          isOpen={!!resultSlipAttempt}
          onClose={() => setResultSlipAttempt(null)}
          title="Activity Result Slip"
          size="md"
        >
          <div className="space-y-4 p-2 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
              <Award className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {resultSlipAttempt.activity.title}
            </h3>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2">
              <div className="text-2xl font-black text-purple-600">
                {resultSlipAttempt.attempt.score} / {resultSlipAttempt.activity.maxScore}
              </div>
              {resultSlipAttempt.attempt.grade && (
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Grade: {resultSlipAttempt.attempt.grade} &middot; {resultSlipAttempt.attempt.passed ? 'PASSED' : 'FAILED'}
                </div>
              )}
            </div>

            {resultSlipAttempt.attempt.teacherNote && (
              <div className="text-left bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 text-xs text-purple-900 dark:text-purple-200">
                <strong>Teacher Note:</strong> {resultSlipAttempt.attempt.teacherNote}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
