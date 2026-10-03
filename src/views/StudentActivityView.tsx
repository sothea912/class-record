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
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  AppState,
  HomeworkItem,
  HomeworkQuestion,
  HomeworkSubmission,
  HomeworkSubmissionFile,
  SubmissionFileDoc,
  ActivityItem,
  ActivityAttempt,
  StudentBadgeItem,
  StudentItem,
} from '../types';
import {
  syncSaveHomeworkSubmission,
  syncSaveHomeworkSubmissionWithFiles,
  syncFetchSubmissionFiles,
  syncFetchHomeworkFile,
  compressImageForHomework,
  syncSaveActivityAttempt,
  syncFetchActivityQuestions,
} from '../utils/firestoreSync';
import { round1, todayISO, getDifficultyMeta, getActivityUrgency, UrgencyMeta, uid } from '../utils/helpers';
import { Modal } from '../components/Modal';
import { ActivityCardThumbnail } from '../components/ActivityCardThumbnail';

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

export type ViewMode = 'gallery' | 'list';
export type SortOption = 'due_soonest' | 'due_latest' | 'urgency' | 'type' | 'diff_asc' | 'diff_desc';
export type StatusFilter = 'all' | 'todo' | 'submitted' | 'marked';
export type TypeFilter = 'all' | 'homework' | 'quiz' | 'exam' | 'custom' | 'achievement';

export interface UnifiedActivityItem {
  id: string;
  originalId: string;
  kind: 'homework' | 'quiz' | 'exam' | 'custom';
  title: string;
  instructions: string;
  dueDateTime?: string;
  maxScore: number;
  thumbnail?: string;
  difficulty: number;
  type?: 'form' | 'upload';
  durationMinutes?: number;
  opensAt?: string;
  closesAt?: string;
  isOpenNow: boolean;
  status: 'todo' | 'submitted' | 'marked';
  detailedStatus: string;
  score?: number;
  grade?: string;
  passed?: boolean;
  isOverdue: boolean;
  countdown: { text: string; isOverdue: boolean };
  urgency: UrgencyMeta;
  rawHomework?: HomeworkItem;
  rawActivity?: ActivityItem;
  rawSubmission?: HomeworkSubmission;
  rawAttempt?: ActivityAttempt;
}

export const StudentActivityView: React.FC<StudentActivityViewProps> = ({
  state,
  studentId,
  student,
  activeClassId,
  onShowToast,
}) => {
  // View mode, sorting, and filtering state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('student_activity_view_mode');
      return saved === 'list' ? 'list' : 'gallery';
    } catch {
      return 'gallery';
    }
  });

  const [sortBy, setSortBy] = useState<SortOption>('urgency');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('student_activity_view_mode', mode);
    } catch {}
  };

  // Active Homework Modal
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);
  const [hwAnswers, setHwAnswers] = useState<Record<string, any>>({});
  const [hwAttachedFiles, setHwAttachedFiles] = useState<{
    fileId: string;
    name: string;
    type: string;
    size: number;
    base64Data: string;
    previewUrl?: string;
  }[]>([]);
  const [hwLinks, setHwLinks] = useState<string[]>([]);
  const [hwLinkInput, setHwLinkInput] = useState('');
  const [hwExternalLink, setHwExternalLink] = useState('');
  const [isSubmittingHw, setIsSubmittingHw] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [replaceTargetFileId, setReplaceTargetFileId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [hwErrorMessage, setHwErrorMessage] = useState<string | null>(null);
  const [viewingStudentPhoto, setViewingStudentPhoto] = useState<string | null>(null);

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

  // Current Homework submission
  const currentSubmission = useMemo(() => {
    if (!selectedHomework) return null;
    return (state.homeworkSubmissions || []).find(
      s => s.homeworkId === selectedHomework.id && s.studentId === studentId
    ) || null;
  }, [selectedHomework, state.homeworkSubmissions, studentId]);

  // Helper to normalize question title display if it matches generic placeholder
  const getDisplayQuestionTitle = (rawTitle: string | undefined, index: number) => {
    if (!rawTitle || /^Question\s+\d+$/i.test(rawTitle.trim())) {
      return `Question ${index + 1}`;
    }
    return rawTitle;
  };

  // Sync form inputs when selected homework changes
  useEffect(() => {
    setHwErrorMessage(null);
    if (!selectedHomework) {
      setHwAnswers({});
      setHwAttachedFiles([]);
      setHwExternalLink('');
      return;
    }
    if (currentSubmission) {
      setHwAnswers(currentSubmission.answers || {});
      setHwAttachedFiles((currentSubmission.files || []).map(f => ({
        fileId: f.fileId || uid('file'),
        name: f.name,
        type: f.type,
        size: f.size || 0,
        base64Data: f.base64Data || '',
        previewUrl: f.previewUrl,
      })));
      setHwExternalLink(currentSubmission.externalLink || '');
    } else {
      setHwAnswers({});
      setHwAttachedFiles([]);
      setHwExternalLink('');
    }
  }, [selectedHomework, currentSubmission]);

  // Download teacher's attachment
  const handleDownloadHwAttachment = async (hw: HomeworkItem) => {
    setHwErrorMessage(null);
    try {
      if (hw.attachmentData) {
        const link = document.createElement('a');
        link.href = hw.attachmentData;
        link.download = hw.attachmentName || `${hw.title}_document`;
        link.click();
        return;
      }
      if (hw.hasSubcollectionFile && hw.subcollectionFileId) {
        setDownloadingFileId(hw.subcollectionFileId);
        const fileDoc = await syncFetchHomeworkFile(hw.subcollectionFileId);
        if (fileDoc?.base64Data) {
          const link = document.createElement('a');
          link.href = fileDoc.base64Data;
          link.download = fileDoc.fileName || `${hw.title}_document`;
          link.click();
        } else {
          throw new Error('Attachment file data could not be retrieved from database.');
        }
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      setHwErrorMessage('Download failed: ' + msg);
      onShowToast('Download failed: ' + msg, 'error');
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Student attaches a file to their submission
  const handleStudentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHwErrorMessage(null);
    try {
      if (file.type.startsWith('image/')) {
        const compressed = await compressImageForHomework(file, 1600);
        setHwAttachedFiles(prev => [...prev, {
          fileId: uid('file'),
          name: file.name,
          type: file.type,
          size: file.size,
          base64Data: compressed,
          previewUrl: compressed,
        }]);
        onShowToast('Image attached', 'success');
      } else {
        if (file.size > 700 * 1024) {
          const msg = 'File exceeds 700KB. For larger files, please share a Google Drive or Telegram link.';
          setHwErrorMessage(msg);
          onShowToast(msg, 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          setHwAttachedFiles(prev => [...prev, {
            fileId: uid('file'),
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data: reader.result as string,
          }]);
          onShowToast('File attached', 'success');
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      const msg = 'Failed to attach file: ' + (err.message || String(err));
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Student uploads a photo answer for a specific question in a form
  const handleHwPhotoAnswerUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHwErrorMessage(null);
    try {
      const compressed = await compressImageForHomework(file, 1200);
      setHwAnswers(prev => ({ ...prev, [qId]: compressed }));
      onShowToast('Photo answer attached', 'success');
    } catch (err: any) {
      const msg = 'Failed to upload photo: ' + (err.message || String(err));
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Student submits homework
  const handleSubmitHomework = async () => {
    if (!selectedHomework) return;
    setHwErrorMessage(null);
    const isOverdue = formatTimeRemaining(selectedHomework.dueDateTime).isOverdue;
    if (isOverdue && selectedHomework.allowLate === false) {
      const msg = 'This homework is past its deadline and does not accept late submissions.';
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
      return;
    }

    // Required file upload check if teacher required it
    if (selectedHomework.requireFileUpload && hwAttachedFiles.length === 0 && !hwExternalLink.trim()) {
      const msg = 'This assignment requires at least one file attachment or link before submitting.';
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
      return;
    }

    // Required questions validation for form type
    if (selectedHomework.type === 'form' && selectedHomework.questions) {
      for (let qIdx = 0; qIdx < selectedHomework.questions.length; qIdx++) {
        const q = selectedHomework.questions[qIdx];
        if (q.required) {
          const val = hwAnswers[q.id];
          const isAnswered = Array.isArray(val) ? val.length > 0 : (val !== undefined && val !== null && String(val).trim() !== '');
          if (!isAnswered) {
            const qTitle = getDisplayQuestionTitle(q.title, qIdx);
            const msg = `Please answer required question: "${qTitle}"`;
            setHwErrorMessage(msg);
            onShowToast(msg, 'error');
            return;
          }
        }
      }
    }

    // If upload type, require at least one file or external link
    if (selectedHomework.type === 'upload' && hwAttachedFiles.length === 0 && !hwExternalLink.trim()) {
      const msg = 'Please attach at least one file or provide a link to your work.';
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
      return;
    }

    try {
      setIsSubmittingHw(true);
      const subId = `${selectedHomework.id}_${studentId}`;
      const nowISO = new Date().toISOString();

      const fileDocs: SubmissionFileDoc[] = hwAttachedFiles.map(f => ({
        id: f.fileId,
        submissionId: subId,
        homeworkId: selectedHomework.id,
        studentId: studentId,
        fileName: f.name,
        fileType: f.type,
        size: f.size,
        base64Data: f.base64Data,
        createdAt: nowISO,
      }));

      const submissionFilesMeta: HomeworkSubmissionFile[] = hwAttachedFiles.map(f => ({
        fileId: f.fileId,
        name: f.name,
        type: f.type,
        size: f.size,
        previewUrl: f.previewUrl,
      }));

      const submissionObj: HomeworkSubmission = {
        id: subId,
        homeworkId: selectedHomework.id,
        studentId: studentId,
        classId: activeClassId || (selectedHomework.classIds && selectedHomework.classIds[0]) || '',
        status: isOverdue ? 'late' : 'submitted',
        isLate: isOverdue,
        submittedAt: nowISO,
        answers: selectedHomework.type === 'form' ? hwAnswers : undefined,
        files: submissionFilesMeta,
        externalLink: hwExternalLink.trim() || undefined,
        createdAt: currentSubmission?.createdAt || nowISO,
        updatedAt: nowISO,
      };

      await syncSaveHomeworkSubmissionWithFiles(submissionObj, fileDocs, student.name, selectedHomework.title);
      onShowToast(isOverdue ? 'Homework submitted (late).' : 'Homework submitted successfully! Great job.', 'success');
      setSelectedHomework(null);
    } catch (err: any) {
      const msg = 'Failed to submit: ' + (err.message || String(err));
      setHwErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      setIsSubmittingHw(false);
    }
  };

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
      let qList = await syncFetchActivityQuestions(activity.id);
      if (!qList || qList.length === 0) {
        qList = activity.questions || [];
      }
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
      console.error('Failed to start attempt:', err);
      onShowToast('Failed to start: ' + (err.message || String(err)), 'error');
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

  // All unified activities for this student
  const allUnifiedActivities = useMemo<UnifiedActivityItem[]>(() => {
    const list: UnifiedActivityItem[] = [];

    // 1. Process Homework items
    for (const hw of studentHomework) {
      const sub = (state.homeworkSubmissions || []).find(
        s => s.homeworkId === hw.id && s.studentId === studentId
      );
      const isMarked = sub?.status === 'marked';
      const isSubmitted = sub?.status === 'submitted' || sub?.status === 'late';
      const status: 'todo' | 'submitted' | 'marked' = isMarked
        ? 'marked'
        : isSubmitted
        ? 'submitted'
        : 'todo';
      const detailedStatus = sub?.status || 'pending';
      const countdown = formatTimeRemaining(hw.dueDateTime);
      const isOverdue = countdown.isOverdue && !isSubmitted && !isMarked;
      const urgency = getActivityUrgency(hw.dueDateTime, isSubmitted || isMarked);

      list.push({
        id: `hw_${hw.id}`,
        originalId: hw.id,
        kind: 'homework',
        title: hw.title,
        instructions: hw.instructions || '',
        dueDateTime: hw.dueDateTime,
        maxScore: hw.maxScore,
        thumbnail: hw.thumbnail,
        difficulty: hw.difficulty || 3,
        type: hw.type,
        isOpenNow: true,
        status,
        detailedStatus,
        score: sub?.score,
        isOverdue,
        countdown,
        urgency,
        rawHomework: hw,
        rawSubmission: sub,
      });
    }

    // 2. Process Quizzes, Exams, and Custom Activities
    for (const act of studentActivities) {
      const attempt = (state.activityAttempts || []).find(
        a => a.activityId === act.id && a.studentId === studentId
      );
      const isMarked = attempt?.status === 'marked';
      const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';
      const status: 'todo' | 'submitted' | 'marked' = isMarked
        ? 'marked'
        : isSubmitted
        ? 'submitted'
        : 'todo';
      const detailedStatus = attempt?.status || 'not_started';

      const now = Date.now();
      const openMs = act.opensAt ? new Date(act.opensAt).getTime() : 0;
      const closeMs = act.closesAt ? new Date(act.closesAt).getTime() : Infinity;
      const isOpenNow = (!act.opensAt || now >= openMs) && (!act.closesAt || now <= closeMs);

      const countdown = act.closesAt
        ? formatTimeRemaining(act.closesAt)
        : { text: 'Flexible schedule', isOverdue: false };
      const isOverdue = Boolean(act.closesAt && countdown.isOverdue && !isSubmitted && !isMarked);
      const urgency = getActivityUrgency(act.closesAt, isSubmitted || isMarked);

      list.push({
        id: `act_${act.id}`,
        originalId: act.id,
        kind: act.kind,
        title: act.title,
        instructions: act.instructions || '',
        dueDateTime: act.closesAt,
        maxScore: act.maxScore,
        thumbnail: act.thumbnail,
        difficulty: act.difficulty || 3,
        durationMinutes: act.durationMinutes,
        opensAt: act.opensAt,
        closesAt: act.closesAt,
        isOpenNow,
        status,
        detailedStatus,
        score: attempt?.score,
        grade: attempt?.grade,
        passed: attempt?.passed,
        isOverdue,
        countdown,
        urgency,
        rawActivity: act,
        rawAttempt: attempt,
      });
    }

    return list;
  }, [studentHomework, studentActivities, state.homeworkSubmissions, state.activityAttempts, studentId]);

  // Counts for filter chips
  const counts = useMemo(() => {
    const total = allUnifiedActivities.length;
    const todo = allUnifiedActivities.filter(a => a.status === 'todo').length;
    const submitted = allUnifiedActivities.filter(a => a.status === 'submitted').length;
    const marked = allUnifiedActivities.filter(a => a.status === 'marked').length;
    const overdue = allUnifiedActivities.filter(a => a.isOverdue).length;

    const hwCount = allUnifiedActivities.filter(a => a.kind === 'homework').length;
    const quizCount = allUnifiedActivities.filter(a => a.kind === 'quiz').length;
    const examCount = allUnifiedActivities.filter(a => a.kind === 'exam').length;
    const customCount = allUnifiedActivities.filter(a => a.kind === 'custom').length;

    return { total, todo, submitted, marked, overdue, hwCount, quizCount, examCount, customCount };
  }, [allUnifiedActivities]);

  // Filtered and Sorted list of activities
  const filteredAndSortedActivities = useMemo(() => {
    let result = [...allUnifiedActivities];

    // Filter by Type
    if (typeFilter !== 'all' && typeFilter !== 'achievement') {
      result = result.filter(item => item.kind === typeFilter);
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'due_soonest') {
        if (!a.dueDateTime && !b.dueDateTime) return 0;
        if (!a.dueDateTime) return 1;
        if (!b.dueDateTime) return -1;
        return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
      }

      if (sortBy === 'due_latest') {
        if (!a.dueDateTime && !b.dueDateTime) return 0;
        if (!a.dueDateTime) return 1;
        if (!b.dueDateTime) return -1;
        return new Date(b.dueDateTime).getTime() - new Date(a.dueDateTime).getTime();
      }

      if (sortBy === 'urgency') {
        // Sort rank: 1: Overdue, 2: Urgent (<48h), 3: Medium (≤7d), 4: Long (>7d), 5: Submitted/Marked
        if (a.urgency.sortRank !== b.urgency.sortRank) {
          return a.urgency.sortRank - b.urgency.sortRank;
        }
        // Secondary sort: soonest due date
        if (a.dueDateTime && b.dueDateTime) {
          return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
        }
        return 0;
      }

      if (sortBy === 'type') {
        const kindOrder: Record<string, number> = { homework: 1, quiz: 2, exam: 3, custom: 4 };
        const orderA = kindOrder[a.kind] || 99;
        const orderB = kindOrder[b.kind] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      }

      if (sortBy === 'diff_asc') {
        return (a.difficulty || 3) - (b.difficulty || 3);
      }

      if (sortBy === 'diff_desc') {
        return (b.difficulty || 3) - (a.difficulty || 3);
      }

      return 0;
    });

    return result;
  }, [allUnifiedActivities, typeFilter, statusFilter, sortBy]);

  // Action Button Renderer
  const renderActionButton = (item: UnifiedActivityItem) => {
    if (item.kind === 'homework') {
      const isMarked = item.status === 'marked';
      const isSubmitted = item.status === 'submitted';
      return (
        <button
          type="button"
          onClick={() => setSelectedHomework(item.rawHomework!)}
          className="px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          <span>{isMarked ? 'View Mark' : isSubmitted ? 'View Submission' : 'Open Homework'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    if (item.kind === 'quiz') {
      const isMarked = item.status === 'marked';
      const isSubmitted = item.status === 'submitted';
      const inProgress = item.rawAttempt?.status === 'in_progress';

      if (isMarked || isSubmitted) {
        return (
          <button
            type="button"
            onClick={() => {
              if (item.rawAttempt && item.rawActivity) {
                setResultSlipAttempt({ attempt: item.rawAttempt, activity: item.rawActivity });
              }
            }}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>{isMarked ? 'View Result' : 'View Submission'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        );
      }

      return (
        <button
          type="button"
          disabled={!item.isOpenNow}
          onClick={() => {
            if (inProgress) {
              handleStartAttempt(item.rawActivity!);
            } else {
              setConfirmStartActivity(item.rawActivity!);
            }
          }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          <span>{inProgress ? 'Resume Quiz' : 'Take Quiz'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    if (item.kind === 'exam') {
      const isMarked = item.status === 'marked';
      const isSubmitted = item.status === 'submitted';
      const inProgress = item.rawAttempt?.status === 'in_progress';

      if (isMarked || isSubmitted) {
        return (
          <button
            type="button"
            onClick={() => {
              if (item.rawAttempt && item.rawActivity) {
                setResultSlipAttempt({ attempt: item.rawAttempt, activity: item.rawActivity });
              }
            }}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>{isMarked ? 'Result Slip' : 'View Exam'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => {
            if (inProgress) {
              handleStartAttempt(item.rawActivity!);
            } else {
              setConfirmStartActivity(item.rawActivity!);
            }
          }}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          <span>{inProgress ? 'Resume Exam' : 'Start Exam'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    // Custom kind
    const isMarked = item.status === 'marked';
    return (
      <button
        type="button"
        onClick={() => {
          if (isMarked && item.rawAttempt && item.rawActivity) {
            setResultSlipAttempt({ attempt: item.rawAttempt, activity: item.rawActivity });
          } else if (item.rawActivity) {
            setConfirmStartActivity(item.rawActivity);
          }
        }}
        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
      >
        <span>{isMarked ? 'View Feedback' : 'Open Activity'}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full min-w-0 overflow-hidden px-1 sm:px-0">
      {/* =================================================================== */}
      {/* WELCOME BANNER & STATS */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 backdrop-blur-sm text-purple-300">
              Student Activity Hub
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 truncate">Class Activities & Tasks</h1>
            <p className="text-xs text-purple-200/80 line-clamp-2 mt-0.5">
              Complete homework assignments, quizzes & exams on time to achieve high scores!
            </p>
          </div>

          {/* Badges / Stat Quick Link */}
          {studentBadges.length > 0 && (
            <button
              type="button"
              onClick={() => setTypeFilter('achievement')}
              className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 transition-all cursor-pointer text-left shrink-0"
            >
              <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
              <div>
                <span className="text-xs font-black block">{studentBadges.length} Badges Earned</span>
                <span className="text-[10px] text-purple-200">View Achievements</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* CONTROL BAR: TYPE CHIPS, VIEW TOGGLE, SORTING, STATUS CHIPS */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Row 1: Type Filter Chips & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Type Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: 'all', label: 'All activities', icon: Sparkles, count: counts.total },
              { id: 'homework', label: 'Homework', icon: BookOpen, count: counts.hwCount },
              { id: 'quiz', label: 'Quizzes', icon: HelpCircle, count: counts.quizCount },
              { id: 'exam', label: 'Exams', icon: Award, count: counts.examCount },
              { id: 'custom', label: 'Custom', icon: CheckSquare, count: counts.customCount },
              { id: 'achievement', label: 'Achievements', icon: Trophy, count: studentBadges.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id as TypeFilter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Controls: View Mode & Sort Dropdown */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Sort by Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 hidden sm:flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                aria-label="Sort activities by"
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="urgency">⚡ Urgency (Auto)</option>
                <option value="due_soonest">⏰ Due (Soonest first)</option>
                <option value="due_latest">📅 Due (Latest first)</option>
                <option value="diff_asc">⭐ Difficulty (Easy → Hard)</option>
                <option value="diff_desc">🌟 Difficulty (Hard → Easy)</option>
                <option value="type">📂 Activity Type</option>
              </select>
            </div>

            {/* View Mode Toggle: Gallery vs List */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleSetViewMode('gallery')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'gallery'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Gallery View (Large Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-[11px]">Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('list')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="List View (Compact Rows)"
              >
                <List className="w-4 h-4" />
                <span className="text-[11px]">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Filter Chips (All, To do, Submitted, Marked) */}
        {typeFilter !== 'achievement' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {[
              { id: 'all', label: 'All', count: counts.total },
              { id: 'todo', label: 'To do', count: counts.todo },
              { id: 'submitted', label: 'Submitted', count: counts.submitted },
              { id: 'marked', label: 'Marked', count: counts.marked },
            ].map(st => {
              const isActive = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id as StatusFilter)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] font-mono ${isActive ? 'text-purple-600 dark:text-purple-300' : 'text-slate-400'}`}>
                    ({st.count})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MAIN VIEW: GALLERY OR LIST OF ACTIVITIES */}
      {/* =================================================================== */}
      {typeFilter === 'achievement' ? (
        /* Achievements & Badges Gallery */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Earned Achievements & Badges</span>
              </h3>
              <span className="text-xs font-bold text-slate-400">{studentBadges.length} Total</span>
            </div>

            {studentBadges.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Complete homework and quizzes with high scores to earn achievement badges!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {studentBadges.map(badge => (
                  <div key={badge.id} className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl text-center space-y-2 shadow-xs">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                      <Award className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{badge.title}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{badge.description}</p>
                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-mono block">
                      {new Date(badge.awardedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : filteredAndSortedActivities.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No activities found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No items match your current filter settings. Try switching filters.'
              : 'You have no published class activities at the moment.'}
          </p>
        </div>
      ) : viewMode === 'gallery' ? (
        /* =================================================================== */
        /* GALLERY VIEW: 2 COLUMNS ON DESKTOP, 1 ON PHONE */
        /* =================================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredAndSortedActivities.map(item => {
            const diffMeta = getDifficultyMeta(item.difficulty);
            const isHomework = item.kind === 'homework';
            const isQuiz = item.kind === 'quiz';
            const isExam = item.kind === 'exam';
            const isCustom = item.kind === 'custom';

            let typeBadgeLabel = 'Homework';
            let typeBadgeClass = 'bg-purple-100/90 text-purple-800 dark:bg-purple-950/90 dark:text-purple-200 border-purple-200 dark:border-purple-800';
            if (isQuiz) {
              typeBadgeLabel = 'Quiz';
              typeBadgeClass = 'bg-indigo-100/90 text-indigo-800 dark:bg-indigo-950/90 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800';
            } else if (isExam) {
              typeBadgeLabel = 'Exam';
              typeBadgeClass = 'bg-rose-100/90 text-rose-800 dark:bg-rose-950/90 dark:text-rose-200 border-rose-200 dark:border-rose-800';
            } else if (isCustom) {
              typeBadgeLabel = 'Activity';
              typeBadgeClass = 'bg-amber-100/90 text-amber-800 dark:bg-amber-950/90 dark:text-amber-200 border-amber-200 dark:border-amber-800';
            }

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group overflow-hidden"
              >
                {/* Top: Thumbnail with Kind gradient / custom thumbnail */}
                <div className="space-y-3">
                  <ActivityCardThumbnail
                    thumbnail={item.thumbnail}
                    kind={item.kind}
                    difficulty={item.difficulty}
                    label={item.kind === 'homework' ? (item.type === 'form' ? 'Interactive Form' : 'Document') : typeBadgeLabel}
                    topLeftBadge={
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-xs ${typeBadgeClass}`}>
                        {typeBadgeLabel}
                      </span>
                    }
                    topRightBadge={
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold backdrop-blur-md border shadow-xs bg-white/90 dark:bg-slate-900/90 ${diffMeta.badgeClass}`}
                        title={`Difficulty: ${diffMeta.label}`}
                      >
                        <span className="opacity-90">{diffMeta.stars}</span> {diffMeta.shortLabel}
                      </span>
                    }
                  />

                  {/* Badges Bar: Urgency badge, Due Countdown, Points */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Urgency Badge (shown on every card) */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${item.urgency.badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${item.urgency.dotColor}`} />
                      <span>{item.urgency.label}</span>
                    </span>

                    {/* Due Countdown */}
                    {item.dueDateTime && (
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${item.countdown.isOverdue && item.status === 'todo' ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.countdown.text}</span>
                      </span>
                    )}

                    {/* Max points */}
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-auto">
                      Max: <strong className="text-purple-600 dark:text-purple-400">{item.maxScore} pts</strong>
                    </span>
                  </div>

                  {/* Title & Instructions */}
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.instructions && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {item.instructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Status pill, Score, and Action Button */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {item.status === 'marked' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">
                          Graded: {item.score}/{item.maxScore} pts
                        </span>
                        {item.grade && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            {item.grade}
                          </span>
                        )}
                      </div>
                    ) : item.status === 'submitted' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                          Submitted {item.detailedStatus === 'late' ? '(Late)' : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${item.isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                          {item.detailedStatus === 'in_progress' ? 'In Progress' : 'To Do'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  {renderActionButton(item)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =================================================================== */
        /* LIST VIEW: COMPACT ROWS */
        /* =================================================================== */
        <div className="space-y-3">
          {filteredAndSortedActivities.map(item => {
            const diffMeta = getDifficultyMeta(item.difficulty);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all group overflow-hidden"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* Small 16:9 Thumbnail preview */}
                  <div className="w-16 h-11 sm:w-24 sm:h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shrink-0 relative">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-purple-700 to-indigo-900 flex items-center justify-center text-white">
                        {item.kind === 'quiz' ? <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : item.kind === 'exam' ? <Award className="w-4 h-4 sm:w-5 sm:h-5" /> : <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Type Badge */}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.kind === 'homework' ? (item.type === 'form' ? 'Form' : 'Doc') : item.kind}
                      </span>

                      {/* Urgency Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${item.urgency.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.urgency.dotColor}`} />
                        <span>{item.urgency.label}</span>
                      </span>

                      {/* Difficulty Stars */}
                      <span className="text-[10px] font-bold text-amber-500" title={`Difficulty: ${diffMeta.label}`}>
                        {diffMeta.stars}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h4>

                    {/* Due Date & Max points */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {item.dueDateTime && (
                        <span className={`flex items-center gap-1 ${item.countdown.isOverdue && item.status === 'todo' ? 'text-rose-500 font-bold' : ''}`}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.countdown.text}</span>
                        </span>
                      )}
                      <span>&middot;</span>
                      <span>Max: {item.maxScore} pts</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status & Action Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                  {item.status === 'marked' ? (
                    <span className="text-xs font-black text-emerald-600 font-mono">
                      {item.score}/{item.maxScore} pts
                    </span>
                  ) : item.status === 'submitted' ? (
                    <span className="text-xs font-bold text-blue-600 font-mono">
                      Submitted
                    </span>
                  ) : (
                    <span className={`text-xs font-bold font-mono ${item.isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                      {item.isOverdue ? 'Overdue' : 'To Do'}
                    </span>
                  )}

                  {renderActionButton(item)}
                </div>
              </div>
            );
          })}
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
      {/* MODAL: HOMEWORK (FORM & UPLOAD) */}
      {/* =================================================================== */}
      {selectedHomework && (
        <Modal
          isOpen={!!selectedHomework}
          onClose={() => setSelectedHomework(null)}
          title={selectedHomework.title}
          size="2xl"
        >
          <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1">
            {/* Red Error Message Banner if any error occurred */}
            {hwErrorMessage && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-200">Error Occurred</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-mono break-all">{hwErrorMessage}</p>
                </div>
              </div>
            )}

            {/* Header info bar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  {selectedHomework.type === 'form' ? 'Interactive Form' : 'Document Submission'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Max Score: <strong className="text-purple-600 dark:text-purple-400">{selectedHomework.maxScore} pts</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className={formatTimeRemaining(selectedHomework.dueDateTime).isOverdue ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}>
                  {formatTimeRemaining(selectedHomework.dueDateTime).text}
                </span>
              </div>
            </div>

            {/* Instructions */}
            {selectedHomework.instructions && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Instructions</h4>
                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedHomework.instructions}
                </p>
              </div>
            )}

            {/* Teacher's Attachment / External Link */}
            {(selectedHomework.attachmentName || selectedHomework.hasSubcollectionFile || selectedHomework.externalLink) && (
              <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Teacher's Materials & Links</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedHomework.attachmentName || selectedHomework.hasSubcollectionFile) && (
                    <button
                      type="button"
                      disabled={!!downloadingFileId}
                      onClick={() => handleDownloadHwAttachment(selectedHomework)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <FileDown className="w-4 h-4 text-purple-600" />
                      <span>
                        {downloadingFileId ? 'Downloading...' : `Download ${selectedHomework.attachmentName || 'Attachment'}`}
                      </span>
                    </button>
                  )}
                  {selectedHomework.externalLink && (
                    <a
                      href={selectedHomework.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4 text-purple-600" />
                      <span>Open External Resource</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* VIEW MODE: MARKED SUBMISSION */}
            {/* ============================================================= */}
            {currentSubmission?.status === 'marked' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-emerald-800 dark:text-emerald-300 tracking-wider">Teacher Graded</span>
                      <h4 className="text-base font-black text-emerald-950 dark:text-white">
                        Score: {currentSubmission.score} / {selectedHomework.maxScore} pts
                      </h4>
                    </div>
                  </div>
                  {currentSubmission.markedAt && (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                      Marked {new Date(currentSubmission.markedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {currentSubmission.teacherNote && (
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">Teacher's Overall Feedback</span>
                    <p className="text-xs text-purple-950 dark:text-purple-100 whitespace-pre-wrap">{currentSubmission.teacherNote}</p>
                  </div>
                )}

                {/* Question review for form type */}
                {selectedHomework.type === 'form' && (selectedHomework.questions || []).map((q, idx) => {
                  const studentAns = currentSubmission.answers?.[q.id];
                  const qMark = currentSubmission.questionMarks?.[q.id];
                  const qComment = currentSubmission.questionComments?.[q.id];
                  const displayTitle = getDisplayQuestionTitle(q.title, idx);

                  return (
                    <div key={q.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white">{displayTitle}</h5>
                            {q.description && <p className="text-[11px] text-slate-500">{q.description}</p>}
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-600">
                          {qMark !== undefined ? `${qMark} / ${q.points} pts` : `${q.points} pts`}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Your Answer:</span>
                        {q.type === 'photo' && studentAns ? (
                          <img src={studentAns} alt="Student answer" className="max-h-48 rounded-lg border" />
                        ) : Array.isArray(studentAns) ? (
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{studentAns.join(', ') || 'No answer'}</p>
                        ) : (
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{studentAns !== undefined && studentAns !== '' ? String(studentAns) : 'No answer'}</p>
                        )}
                      </div>

                      {qComment && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-2.5 text-xs text-amber-900 dark:text-amber-200">
                          <strong>Teacher Comment:</strong> {qComment}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Upload review */}
                {selectedHomework.type === 'upload' && currentSubmission.files && currentSubmission.files.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Submitted Files:</span>
                    <div className="flex flex-wrap gap-2">
                      {currentSubmission.files.map((f, fIdx) => (
                        <div key={fIdx} className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border text-xs font-medium flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>{f.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* VIEW MODE: SUBMITTED (AWAITING MARK) */}
            {/* ============================================================= */}
            {(currentSubmission?.status === 'submitted' || currentSubmission?.status === 'late') && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-blue-950 dark:text-white">
                        Submitted {currentSubmission.isLate ? '(Late)' : 'Successfully'}
                      </h4>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        Your work has been submitted and is currently awaiting grading by your teacher.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Questions view */}
                {selectedHomework.type === 'form' && (selectedHomework.questions || []).map((q, idx) => {
                  const studentAns = currentSubmission.answers?.[q.id];
                  const displayTitle = getDisplayQuestionTitle(q.title, idx);
                  return (
                    <div key={q.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{idx + 1}. {displayTitle}</span>
                        <span className="text-xs text-slate-400 font-mono">{q.points} pts</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs">
                        {q.type === 'photo' && studentAns ? (
                          <img src={studentAns} alt="Answer" className="max-h-48 rounded-lg border" />
                        ) : Array.isArray(studentAns) ? (
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{studentAns.join(', ') || 'No answer'}</p>
                        ) : (
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{studentAns !== undefined && studentAns !== '' ? String(studentAns) : 'No answer'}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ============================================================= */}
            {/* EDIT MODE: PENDING / NOT SUBMITTED */}
            {/* ============================================================= */}
            {(!currentSubmission || currentSubmission.status === 'draft' || currentSubmission.status === 'resubmit_requested') && (
              <div className="space-y-6">
                {/* Form Questions */}
                {selectedHomework.type === 'form' && (
                  <div className="space-y-5">
                    {(selectedHomework.questions || []).map((q, idx) => {
                      const displayTitle = getDisplayQuestionTitle(q.title, idx);
                      return (
                        <div key={q.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{displayTitle}</h3>
                                  {q.required && (
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">
                                      Required
                                    </span>
                                  )}
                                </div>
                                {q.description && <p className="text-xs text-slate-500 mt-1">{q.description}</p>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600 shrink-0">{q.points} pts</span>
                          </div>

                          {q.image && (
                            <img src={q.image} alt="Question" className="max-h-64 rounded-2xl border object-contain mx-auto" />
                          )}

                          {/* Choice */}
                          {q.type === 'choice' && (
                            <div className="space-y-2 pt-1">
                              {(q.options || []).map((opt, oIdx) => (
                                <label key={oIdx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-purple-500 transition-colors">
                                  <input
                                    type="radio"
                                    name={`hw_ans_${q.id}`}
                                    checked={hwAnswers[q.id] === opt}
                                    onChange={() => setHwAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                    className="text-purple-600"
                                  />
                                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {/* Checkbox */}
                          {q.type === 'checkbox' && (
                            <div className="space-y-2 pt-1">
                              {(q.options || []).map((opt, oIdx) => {
                                const currentArr: string[] = Array.isArray(hwAnswers[q.id]) ? hwAnswers[q.id] : [];
                                return (
                                  <label key={oIdx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-purple-500 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={currentArr.includes(opt)}
                                      onChange={e => {
                                        const nextArr = e.target.checked
                                          ? [...currentArr, opt]
                                          : currentArr.filter(x => x !== opt);
                                        setHwAnswers(prev => ({ ...prev, [q.id]: nextArr }));
                                      }}
                                      className="rounded text-purple-600"
                                    />
                                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Dropdown */}
                          {q.type === 'dropdown' && (
                            <div className="pt-1">
                              <select
                                value={hwAnswers[q.id] || ''}
                                onChange={e => setHwAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                              >
                                <option value="">-- Choose an answer --</option>
                                {(q.options || []).map((opt, oIdx) => (
                                  <option key={oIdx} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* True / False */}
                          {q.type === 'boolean' && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              {['True', 'False'].map(choice => (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => setHwAnswers(prev => ({ ...prev, [q.id]: choice }))}
                                  className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                                    hwAnswers[q.id] === choice
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-purple-300'
                                  }`}
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Short Answer */}
                          {q.type === 'short' && (
                            <input
                              type="text"
                              value={hwAnswers[q.id] || ''}
                              onChange={e => setHwAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Type your answer here..."
                              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                            />
                          )}

                          {/* Long Answer */}
                          {q.type === 'long' && (
                            <textarea
                              rows={4}
                              value={hwAnswers[q.id] || ''}
                              onChange={e => setHwAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Type your detailed response here..."
                              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                            />
                          )}

                          {/* Photo Answer */}
                          {q.type === 'photo' && (
                            <div className="space-y-3">
                              <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-purple-100 transition-colors">
                                <Upload className="w-4 h-4" />
                                <span>{hwAnswers[q.id] ? 'Replace Photo Answer' : 'Upload Photo Answer'}</span>
                                <input type="file" accept="image/*" onChange={e => handleHwPhotoAnswerUpload(q.id, e)} className="hidden" />
                              </label>
                              {hwAnswers[q.id] && (
                                <div className="relative inline-block">
                                  <img src={hwAnswers[q.id]} alt="Answer" className="max-h-48 rounded-xl border shadow-sm" />
                                  <button
                                    type="button"
                                    onClick={() => setHwAnswers(prev => {
                                      const next = { ...prev };
                                      delete next[q.id];
                                      return next;
                                    })}
                                    className="absolute top-2 right-2 p-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* File Attachment Section (Supported for BOTH Form and Upload types) */}
                {(selectedHomework.type === 'upload' || selectedHomework.allowStudentFileUpload !== false || selectedHomework.requireFileUpload) && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-4 h-4 text-purple-600" />
                        <span>Attach Files & Documents</span>
                      </h3>
                      {selectedHomework.requireFileUpload && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full">
                          File Upload Required
                        </span>
                      )}
                    </div>

                    {/* File Uploader */}
                    <div className="space-y-3">
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 dark:border-purple-800/60 hover:border-purple-400 rounded-2xl bg-white dark:bg-slate-900 cursor-pointer transition-colors">
                        <Upload className="w-8 h-8 text-purple-500 mb-2" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Click to upload PDF, DOC, DOCX, JPG, JPEG, PNG
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Max 5 files. Images resized automatically. Documents up to 700KB.
                        </span>
                        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleStudentFileUpload} className="hidden" />
                      </label>

                      {/* Attached files list */}
                      {hwAttachedFiles.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Attached files ({hwAttachedFiles.length}/5):</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {hwAttachedFiles.map((file, idx) => {
                              const isImg = file.type?.startsWith('image/');
                              const imgSrc = file.previewUrl || (file.base64Data?.startsWith('data:image') ? file.base64Data : undefined);
                              return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    {isImg && imgSrc ? (
                                      <img src={imgSrc} alt="Thumb" className="w-10 h-10 object-cover rounded-lg border shrink-0" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" title={file.name}>
                                        {file.name}
                                      </span>
                                      {file.size ? (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {(file.size / 1024).toFixed(1)} KB
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setHwAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-rose-500 hover:text-rose-600 text-xs font-bold cursor-pointer p-1.5 shrink-0"
                                    title="Remove file"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* External Link Input */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Or Share Link (Google Drive / Telegram / Website)
                      </label>
                      <input
                        type="url"
                        value={hwExternalLink}
                        onChange={e => setHwExternalLink(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedHomework(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingHw}
                    onClick={handleSubmitHomework}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:opacity-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingHw ? 'Submitting...' : 'Submit Homework'}</span>
                  </button>
                </div>
              </div>
            )}
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
