import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { db, auth } from '../utils/firebase';
import { COLLECTIONS, sanitizeForFirestore } from '../utils/firestoreSync';
import { APP_VERSION } from '../constants';
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Camera,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  Send,
  Download,
  BookOpen,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  CalendarCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  Building,
  HelpCircle,
  Layers,
  FileText,
  Activity,
  Library,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Bell,
  Trash2,
  Flame,
  Zap,
  Users,
  Video,
  Compass,
  X,
  CalendarX,
  Check,
  KeyRound,
  Lock,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  AppState,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  StudentItem,
  StudentPermissionRequest,
  StudentProgress,
  DailyQuest,
  ClassCancellationItem,
} from '../types';
import {
  AVATAR_OPTIONS,
  getLevelAndProgressFromXp,
  calculateAttendanceScore,
  createDefaultProgress,
} from '../utils/gamification';
import { syncSaveStudentProgress, syncSaveClassJoin, syncSaveAutoJoinAttendance, syncSaveDashboardLayout, subscribeToAppBranding } from '../utils/firestoreSync';
import {
  ATT_EXCUSED_PENALTY,
  ATT_UNEXCUSED_PENALTY,
  computeResults,
  getAttendanceCredit,
  getPunctualityWarning,
  isSessionAfterEnrollment,
  monthName,
  round1,
  thisMonth,
  todayISO,
  todayCambodiaISO,
  uid,
} from '../utils/helpers';
import { downloadWordDoc } from '../utils/wordExport';
import { StudentFloatingNav } from '../components/StudentFloatingNav';
import { StudentSessionModal } from '../components/StudentSessionModal';
import { StudentOnboardingModal } from '../components/StudentOnboardingModal';
import { StudentDashboardWidgets } from '../components/StudentDashboardWidgets';
import { AttendanceJoinChart } from '../components/AttendanceJoinChart';
import { LeaveRequestFormModal } from '../components/LeaveRequestFormModal';
import { LeaveRequestResultsModal } from '../components/LeaveRequestResultsModal';
import { ResourceLibraryView } from './ResourceLibraryView';
import { StudentActivityView } from './StudentActivityView';

interface StudentPortalViewProps {
  state: AppState;
  studentId: string;
  onLogout: () => void;
  onUpdateStudent: (updatedStudent: StudentItem) => void;
  onSubmitPermission: (req: StudentPermissionRequest) => void;
  onDeletePermission?: (permitId: string) => void;
  onDismissCancellation?: (cancellationId: string, studentId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  firestoreStatus?: 'connected' | 'connecting' | 'offline';
}

type PortalTab = 'overview' | 'activity' | 'attendance' | 'library' | 'results' | 'classes' | 'profile';

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  state,
  studentId,
  onLogout,
  onUpdateStudent,
  onSubmitPermission,
  onDeletePermission,
  onDismissCancellation,
  isDark,
  onToggleTheme,
  onShowToast,
  firestoreStatus = 'connected',
}) => {
  // Single source of truth: the student's document in the `students` collection via state.students
  const student = state.students.find(s => s.id === studentId);

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0C0C0C] text-slate-800 dark:text-slate-200 p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-xl font-bold">
            🎓
          </div>
          <h2 className="text-lg font-bold">Loading Student Profile...</h2>
          <p className="text-xs text-slate-500">Connecting to student record database...</p>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#282828] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Tab navigation
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');

  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [appHeading, setAppHeading] = useState<string | null>(null);
  const [appSubtitle, setAppSubtitle] = useState<string | null>(null);
  const [isQuickNavOpen, setIsQuickNavOpen] = useState(false);
  const [isScoresOverlayOpen, setIsScoresOverlayOpen] = useState(false);

  React.useEffect(() => {
    const unsubscribe = subscribeToAppBranding((branding) => {
      setAppLogo(branding.logo !== undefined ? branding.logo : null);
      setAppHeading(branding.heading !== undefined ? branding.heading : null);
      setAppSubtitle(branding.subtitle !== undefined ? branding.subtitle : null);
    });
    return () => unsubscribe();
  }, []);

  // Find or generate student progress
  const progress: StudentProgress = useMemo(() => {
    const existing = (state.studentProgress || []).find(p => p.studentId === studentId);
    if (existing) {
      // Calculate overallScore live incorporating attendance
      const attendanceContrib = calculateAttendanceScore(studentId, state.attendance || []);
      return {
        ...existing,
        overallScore: existing.xp + attendanceContrib,
      };
    }
    const def = createDefaultProgress(studentId);
    const attendanceContrib = calculateAttendanceScore(studentId, state.attendance || []);
    def.overallScore = def.xp + attendanceContrib;
    return def;
  }, [state.studentProgress, studentId, state.attendance]);

  // Streak reset/daily quests checklist reset auto-sync logic
  React.useEffect(() => {
    if (!studentId || !state.studentProgress) return;
    const todayStr = new Date().toISOString().split('T')[0];
    
    const existing = (state.studentProgress || []).find(p => p.studentId === studentId);
    if (existing) {
      let needsUpdate = false;
      const updatedProg = { ...existing };

      if (existing.lastQuestCompletionDate !== todayStr) {
        const hasCompletedQuests = existing.dailyQuests.some(q => q.completed);
        if (hasCompletedQuests) {
          updatedProg.dailyQuests = existing.dailyQuests.map(q => ({ ...q, completed: false }));
          needsUpdate = true;
        }

        if (existing.lastQuestCompletionDate) {
          const lastDate = new Date(existing.lastQuestCompletionDate);
          const todayDate = new Date(todayStr);
          const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 1 && existing.currentStreak > 0) {
            updatedProg.currentStreak = 0;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        syncSaveStudentProgress(updatedProg);
      }
    }
  }, [studentId, state.studentProgress]);

  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [isLeaveResultsOpen, setIsLeaveResultsOpen] = useState(false);

  // Enrolled classes
  const studentClasses = useMemo(() => {
    return state.classes.filter(c => student?.classIds?.includes(c.id));
  }, [state.classes, student?.classIds]);

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 15000); // update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const parseTimeToMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  const getJoinButtonConfig = () => {
    if (!currentClassObj) {
      return { disabled: true, text: 'No Class Selected', reason: 'noclass' };
    }
    if (!currentClassObj.meetLink) {
      return { disabled: true, text: 'No online link set for this class', reason: 'nolink' };
    }

    const classStart = currentClassObj.timeFrom || '08:00';
    const classEnd = currentClassObj.timeTo || '09:30';

    const startMin = parseTimeToMinutes(classStart);
    const endMin = parseTimeToMinutes(classEnd);

    if (startMin === null || endMin === null) {
      return { disabled: false, text: 'Join Class', reason: 'always' };
    }

    const activeStartMin = startMin - 10;

    if (currentTimeMinutes < activeStartMin) {
      return { disabled: false, text: `Join Class (Starts ${classStart})`, reason: 'future', tooltip: `Class starts at ${classStart}` };
    }
    if (currentTimeMinutes > endMin) {
      return { disabled: true, text: 'Class ended', reason: 'ended' };
    }

    return { disabled: false, text: 'Join Class', reason: 'now' };
  };

  const handleCopyMeetLink = async () => {
    const link = currentClassObj?.meetLink;
    if (!link) return;

    const config = getJoinButtonConfig();
    if (config.reason === 'future') {
      onShowToast("Sorry, your class hasn't started yet.", 'info');
      return;
    }
    if (config.disabled) {
      return;
    }

    let copied = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(link);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      onShowToast('Meeting link copied', 'success');
    } else {
      onShowToast('Could not copy, please use Join Class instead', 'error');
    }
  };

  const handleJoinClass = async () => {
    if (!currentClassObj) {
      onShowToast('No active class selected for check-in', 'error');
      return;
    }

    if (!currentClassObj.meetLink) {
      onShowToast('No online link set for this class', 'error');
      return;
    }

    const today = todayCambodiaISO();
    const classStart = currentClassObj.timeFrom || '08:00';
    const classEnd = currentClassObj.timeTo || '09:30';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMin = parseTimeToMinutes(classStart);
    const endMin = parseTimeToMinutes(classEnd);

    if (startMin !== null && endMin !== null) {
      const activeStartMin = startMin - 10;
      if (currentMinutes < activeStartMin) {
        onShowToast("Sorry, your class hasn't started yet.", 'info');
        return;
      }
      if (currentMinutes > endMin) {
        onShowToast('This class has already ended.', 'error');
        return;
      }
    }

    // 1. Open the meeting link immediately — the student must never be blocked from joining
    const meetLink = currentClassObj.meetLink;
    try {
      window.open(meetLink, '_blank');
    } catch (e) {
      console.warn('Could not open meet link via window.open:', e);
    }

    // 2. Check if already checked in today in local state to prevent redundant writes
    const existingSession = state.attendance.find(a => a.classId === currentClassObj.id && a.date === today);
    const existingRecord = existingSession?.records ? existingSession.records[studentId] : null;

    if (existingRecord) {
      const joinTimeStr = existingRecord.joinedAt
        ? new Date(existingRecord.joinedAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Phnom_Penh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : 'class start';
      onShowToast(`Already checked in today at ${joinTimeStr}`, 'info');
      return;
    }

    // Also record legacy class join if not present
    const existingJoin = (state.classJoins || []).find(
      j => j.classId === currentClassObj.id && j.studentId === studentId && j.date === today
    );
    if (!existingJoin) {
      const [startH, startM] = classStart.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(startH || 8, startM || 0, 0, 0);
      const diffMs = now.getTime() - startDate.getTime();
      const minsLate = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      let status: 'green' | 'yellow' | 'red' = 'green';
      if (minsLate >= (state.teacherSecurity?.redFrom ?? 10)) status = 'red';
      else if (minsLate >= (state.teacherSecurity?.yellowFrom ?? 1)) status = 'yellow';
      syncSaveClassJoin(currentClassObj.id, studentId, today, classStart, minsLate, status).catch(() => {});
    }

    // 3. Save auto-join attendance record into COLLECTIONS.ATTENDANCE
    try {
      const res = await syncSaveAutoJoinAttendance(currentClassObj.id, studentId, today);
      if (res.status === 'already_exists') {
        onShowToast(`Already checked in today at ${res.timeStr || 'class start'}`, 'info');
      } else {
        onShowToast(`Attendance recorded at ${res.timeStr}`, 'success');
      }
    } catch (err: any) {
      console.error('[Auto-Join Attendance Error]:', err);
      const realReason = err?.code || err?.message || String(err);
      onShowToast(
        `Your class link opened, but your attendance was not recorded. Please tell your teacher (${realReason})`,
        'error'
      );
    }
  };

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return studentClasses[0]?.id || state.classes[0]?.id || '';
  });

  React.useEffect(() => {
    if (studentClasses.length > 0) {
      if (!selectedClassId || !studentClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(studentClasses[0].id);
      }
    } else if (state.classes.length > 0) {
      if (!selectedClassId || !state.classes.some(c => c.id === selectedClassId)) {
        setSelectedClassId(state.classes[0].id);
      }
    }
  }, [studentClasses, state.classes, selectedClassId]);

  const activeClassId = selectedClassId || studentClasses[0]?.id || state.classes[0]?.id || '';
  const currentClassObj = state.classes.find(c => c.id === activeClassId);

  // Profile Edit fields
  const [editName, setEditName] = useState(student?.name || '');
  const [editSex, setEditSex] = useState(student?.gender || student?.sex || 'Female');
  const [editDob, setEditDob] = useState(student?.dateOfBirth || student?.dob || '');
  const [editPhone, setEditPhone] = useState(student?.phone || '');
  const [editParentName, setEditParentName] = useState(student?.parentName || student?.guardian || '');
  const [editAddress, setEditAddress] = useState(student?.address || '');
  const [editPhoto, setEditPhoto] = useState<string | null>(student?.photo || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change state (Fix 2: student self-service password update)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Synchronize field state if student doc updates remotely
  React.useEffect(() => {
    if (student) {
      setEditName(student.name || '');
      setEditSex(student.gender || student.sex || 'Female');
      setEditDob(student.dateOfBirth || student.dob || '');
      setEditPhone(student.phone || '');
      setEditParentName(student.parentName || student.guardian || '');
      setEditAddress(student.address || '');
      setEditPhoto(student.photo || null);
    }
  }, [
    student?.id,
    student?.name,
    student?.gender,
    student?.sex,
    student?.dateOfBirth,
    student?.dob,
    student?.phone,
    student?.parentName,
    student?.guardian,
    student?.address,
    student?.photo,
  ]);

  // Permission Request Form fields
  const [permClassId, setPermClassId] = useState(studentClasses[0]?.id || '');
  const [permDate, setPermDate] = useState(todayISO());
  const [permCategory, setPermCategory] = useState('Health & Medical');
  const [permReason, setPermReason] = useState('');
  const [confirmingAbandonId, setConfirmingAbandonId] = useState<string | null>(null);
  const [isAttendancePermsExpanded, setIsAttendancePermsExpanded] = useState(false);
  const [isHistoryPermsExpanded, setIsHistoryPermsExpanded] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

  // Filter permission requests for this student
  const myPermRequests = useMemo(() => {
    return (state.studentPermissions || []).filter(p => p.studentId === student?.id);
  }, [state.studentPermissions, student?.id]);

  // Track seen permission IDs in localStorage to manage unread status badges
  const [seenPermIds, setSeenPermIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`seen_perms_${studentId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Identify unread permission updates (Granted or Denied by teacher, not yet viewed)
  const unreadPerms = useMemo(() => {
    return myPermRequests.filter(
      p => (p.status === 'Approved' || p.status === 'Denied') && !seenPermIds.includes(p.id)
    );
  }, [myPermRequests, seenPermIds]);

  const hasUnread = unreadPerms.length > 0;

  // Real-time count of activities that need action (Homework, Quizzes, Exams open & not yet submitted)
  const activityToDoCount = useMemo(() => {
    if (!student) return 0;
    const studentEnrolledClassIds = student.classIds?.length
      ? student.classIds
      : (activeClassId ? [activeClassId] : []);
    const nowMs = Date.now();

    // 1. Published Homework
    const relevantHomework = (state.homework || []).filter(
      h => h.published && h.classIds.some(cId => studentEnrolledClassIds.includes(cId))
    );
    const pendingHomework = relevantHomework.filter(h => {
      const isSubmitted = (state.homeworkSubmissions || []).some(
        s => s.homeworkId === h.id && s.studentId === student.id && (s.status === 'submitted' || s.status === 'marked')
      );
      if (isSubmitted) return false;
      const isPastDue = h.dueDateTime ? new Date(h.dueDateTime).getTime() < nowMs : false;
      const isClosed = isPastDue && h.allowLate === false;
      return !isClosed;
    });

    // 2. Published Activities (Quiz, Exam, Custom)
    const relevantActivities = (state.activities || []).filter(
      a => a.published && a.classIds.some(cId => studentEnrolledClassIds.includes(cId))
    );
    const pendingActivities = relevantActivities.filter(a => {
      const isSubmitted = (state.activityAttempts || []).some(
        att => att.activityId === a.id && att.studentId === student.id && (att.status === 'submitted' || att.status === 'marked' || att.status === 'auto_submitted')
      );
      if (isSubmitted) return false;
      const isOpen =
        (!a.opensAt || new Date(a.opensAt).getTime() <= nowMs) &&
        (!a.closesAt || new Date(a.closesAt).getTime() >= nowMs);
      return isOpen;
    });

    return pendingHomework.length + pendingActivities.length;
  }, [state.homework, state.homeworkSubmissions, state.activities, state.activityAttempts, student, activeClassId]);

  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`dismissed_notices_${studentId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissNoticeLocal = (noticeId: string) => {
    const next = [...dismissedNoticeIds, noticeId];
    setDismissedNoticeIds(next);
    try {
      localStorage.setItem(`dismissed_notices_${studentId}`, JSON.stringify(next));
    } catch (err) {
      console.warn('Failed to save dismissed notice:', err);
    }
  };

  const studentCancellations = useMemo(() => {
    const list = state.classCancellations || [];
    // Deduplicate notices by ID to ensure React list rendering has guaranteed unique keys.
    // This solves any duplicate key collisions on the student portal side.
    const uniqueMap = new Map<string, ClassCancellationItem>();
    list.forEach(c => {
      if (c && c.id) {
        uniqueMap.set(c.id, c);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());

    return uniqueList.filter(c => {
      const cls = state.classes.find(cl => cl.id === c.classId);
      return cls && student?.classIds?.includes(cls.id);
    });
  }, [state.classCancellations, state.classes, student]);

  const activeBannerCancellation = useMemo(() => {
    return studentCancellations.find(c => !dismissedNoticeIds.includes(c.id));
  }, [studentCancellations, dismissedNoticeIds]);

  const undismissedCancellationCount = studentCancellations.filter(
    c => !dismissedNoticeIds.includes(c.id)
  ).length;

  const hasTotalUnread = hasUnread || undismissedCancellationCount > 0;

  // New Spotlight Notice States
  const [notificationCenterTab, setNotificationCenterTab] = useState<'All' | 'Leave Requests' | 'Class Updates'>('All');
  const [shownNoticeIds, setShownNoticeIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`shown_notices_${studentId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [spotlightNotices, setSpotlightNotices] = useState<ClassCancellationItem[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);
  const [spotlightOpen, setSpotlightOpen] = useState<boolean>(false);
  const [isSpotlightExiting, setIsSpotlightExiting] = useState<boolean>(false);
  const [dragY, setDragY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = React.useRef<number>(0);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Hook 1: Monitor studentCancellations live to trigger Spotlight Notice
  React.useEffect(() => {
    if (!studentCancellations || studentCancellations.length === 0) {
      return;
    }

    // Read the fresh shown notices from localStorage directly to prevent any stale closures
    let freshShownIds: string[] = [];
    try {
      const saved = localStorage.getItem(`shown_notices_${studentId}`);
      freshShownIds = saved ? JSON.parse(saved) : [];
    } catch {
      freshShownIds = [];
    }

    // Unshown notices are those that are NOT in freshShownIds
    const unseen = studentCancellations.filter(c => !freshShownIds.includes(c.id));

    if (unseen.length > 0) {
      // Sort unseen so that newest are first
      const sortedUnseen = [...unseen].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // Mark all these notices as shown immediately so they don't pop up again
      const newShownIds = Array.from(new Set([...freshShownIds, ...unseen.map(u => u.id)]));
      setShownNoticeIds(newShownIds);
      try {
        localStorage.setItem(`shown_notices_${studentId}`, JSON.stringify(newShownIds));
      } catch (err) {
        console.warn('Failed to save shown notices', err);
      }

      // Initialize the spotlight queue with all unseen notices
      setSpotlightNotices(sortedUnseen);
      setSpotlightIndex(0);
      setSpotlightOpen(true);
      setIsSpotlightExiting(false);

      // Trigger navigator.vibrate if available
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(200);
        } catch (e) {
          console.warn('Vibration failed', e);
        }
      }
    }
  }, [studentCancellations, studentId]);

  const currentSpotlightNotice = spotlightNotices[spotlightIndex];

  // Hook 2: Dismiss handler for Spotlight Notice with try-catch failsafes
  const handleDismissSpotlight = (immediate = false) => {
    try {
      if (immediate) {
        if (spotlightIndex < spotlightNotices.length - 1) {
          setSpotlightIndex(prev => prev + 1);
        } else {
          setSpotlightOpen(false);
          setSpotlightNotices([]);
        }
        return;
      }

      setIsSpotlightExiting(true);
      setTimeout(() => {
        try {
          setIsSpotlightExiting(false);
          setDragY(0);
          if (spotlightIndex < spotlightNotices.length - 1) {
            setSpotlightIndex(prev => prev + 1);
          } else {
            setSpotlightOpen(false);
            setSpotlightNotices([]);
          }
        } catch (err) {
          console.error("Failsafe inside timeout:", err);
          setSpotlightOpen(false);
          setSpotlightNotices([]);
        }
      }, 250);
    } catch (err) {
      console.error("Failsafe in handleDismissSpotlight:", err);
      setSpotlightOpen(false);
      setSpotlightNotices([]);
    }
  };

  const handleViewInNotifications = () => {
    setNotificationCenterTab('Class Updates');
    setIsNotificationDropdownOpen(true);
    handleDismissSpotlight();
  };

  // Hook 3: Live deletion listener: if notice is deleted by teacher, close spotlight immediately
  React.useEffect(() => {
    if (spotlightOpen && currentSpotlightNotice) {
      const exists = studentCancellations.some(c => c.id === currentSpotlightNotice.id);
      if (!exists) {
        // Teacher deleted current notice! Close spotlight or move to next
        handleDismissSpotlight(true);
      }
    }
  }, [studentCancellations, currentSpotlightNotice, spotlightOpen]);

  // Hook 4: Notification Center automatic Read status sync on opening
  React.useEffect(() => {
    if (isNotificationDropdownOpen || isLeaveResultsOpen) {
      // opened notification center: mark all student cancellations as read
      const allNoticeIds = studentCancellations.map(c => c.id);
      if (allNoticeIds.length > 0) {
        const nextDismissed = Array.from(new Set([...dismissedNoticeIds, ...allNoticeIds]));
        setDismissedNoticeIds(nextDismissed);
        try {
          localStorage.setItem(`dismissed_notices_${studentId}`, JSON.stringify(nextDismissed));
        } catch (err) {
          console.warn('Failed to save dismissed notices:', err);
        }
      }
    }
  }, [isNotificationDropdownOpen, isLeaveResultsOpen, studentCancellations, studentId]);

  // Hook 5: Block scroll on page behind when spotlight is open
  React.useEffect(() => {
    if (spotlightOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [spotlightOpen]);

  // Hook 6: Trap focus in card on open/change, and support Escape key dismissal
  React.useEffect(() => {
    if (spotlightOpen && cardRef.current) {
      cardRef.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!spotlightOpen) return;

      if (e.key === 'Escape') {
        // Fallback: Escape key immediately dismisses
        setSpotlightOpen(false);
        setSpotlightNotices([]);
        return;
      }

      if (e.key === 'Tab' && cardRef.current) {
        const focusableElements = cardRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === cardRef.current) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (spotlightOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [spotlightOpen, spotlightIndex, spotlightNotices.length]);

  // Pointer/Touch Drag handlers for Swipe Up dismissal of spotlight card
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If we've clicked or tapped on a button, do not capture pointer or start dragging
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartY.current = e.clientY;
    setDragY(0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY.current;
    if (deltaY < 0) {
      setDragY(deltaY); // Swiping up moves up
    } else {
      setDragY(deltaY * 0.15); // Swiping down has resistance
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);

    if (dragY < -40) {
      // Swipe up dismisses past ~40px
      handleDismissSpotlight();
    } else {
      // Spring back
      setDragY(0);
    }
  };

  const formatNoticeDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return dateStr;
  };

  // Attendance filter in Attendance Tab
  const [attStatusFilter, setAttStatusFilter] = useState<string>('all');

  // Calculate results for the student's selected class
  const currentMonth = thisMonth();
  const periodResults = activeClassId ? computeResults(activeClassId, [currentMonth], state) : null;
  const myResult = periodResults?.rows.find(r => r.student.id === student?.id);

  // Extract all personal attendance records for this student
  const personalAttendance = useMemo(() => {
    if (!student) return [];
    const list: {
      id: string;
      classId: string;
      className: string;
      date: string;
      status: AttendanceStatus;
      minutesLate?: number;
      joinedAt?: string;
      reason?: string;
    }[] = [];

    state.attendance.forEach(session => {
      if (!isSessionAfterEnrollment(session.date, student)) return;
      // Check if this session is for a class the student is enrolled in
      const rec = session.records[student.id];
      if (rec && rec.status) {
        const clsObj = state.classes.find(c => c.id === session.classId);
        list.push({
          id: session.id,
          classId: session.classId,
          className: clsObj?.name || 'Class',
          date: session.date,
          status: rec.status,
          minutesLate: rec.minutesLate,
          joinedAt: rec.joinedAt,
          reason: rec.reason,
        });
      }
    });

    // Sort by date descending (newest first)
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.attendance, state.classes, student]);

  // Filtered attendance list
  const filteredAttendance = useMemo(() => {
    return personalAttendance.filter(item => {
      if (activeClassId && item.classId !== activeClassId) return false;
      if (attStatusFilter !== 'all' && item.status !== attStatusFilter) return false;
      return true;
    });
  }, [personalAttendance, activeClassId, attStatusFilter]);

  // Aggregate attendance statistics
  const attStats = useMemo(() => {
    const relevant = personalAttendance.filter(
      item => !activeClassId || item.classId === activeClassId
    );
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;
    let totalCredit = 0;
    const duration = currentClassObj?.duration || 60;

    relevant.forEach(item => {
      if (item.status === 'P') present++;
      else if (item.status === 'L') late++;
      else if (item.status === 'E') excused++;
      else if (item.status === 'U') unexcused++;
      totalCredit += getAttendanceCredit(
        { status: item.status, minutesLate: item.minutesLate, joinedAt: item.joinedAt },
        duration
      );
    });

    const total = present + late + excused + unexcused;
    const rate = total > 0 ? round1((totalCredit / total) * 100) : null;
    const ratePct = rate !== null ? `${rate}%` : '—';
    const score = rate !== null ? round1(rate) : 0;

    return {
      total,
      present,
      late,
      excused,
      unexcused,
      totalCredit: round1(totalCredit),
      rate,
      ratePct,
      score,
    };
  }, [personalAttendance, activeClassId, currentClassObj?.duration]);

  const markUnreadAsRead = () => {
    const allHandledIds = myPermRequests
      .filter(p => p.status === 'Approved' || p.status === 'Denied')
      .map(p => p.id);
    if (allHandledIds.length > 0) {
      const nextSeen = Array.from(new Set([...seenPermIds, ...allHandledIds]));
      setSeenPermIds(nextSeen);
      try {
        localStorage.setItem(`seen_perms_${studentId}`, JSON.stringify(nextSeen));
      } catch (err) {
        console.warn('Failed to save seen permissions', err);
      }
    }
  };


  // Flying notification & Bell bounce states
  const [isBellBouncing, setIsBellBouncing] = useState(false);
  const [flyingNotification, setFlyingToast] = useState<{
    id: number;
    deltaX: number;
    deltaY: number;
  } | null>(null);

  const triggerFlyingNotification = () => {
    const bellEl = document.getElementById('student-notification-bell');
    let deltaX = -250;
    let deltaY = -550;

    if (bellEl) {
      const rect = bellEl.getBoundingClientRect();
      const startX = window.innerWidth - 180;
      const startY = window.innerHeight - 90;
      deltaX = (rect.left + rect.width / 2) - startX;
      deltaY = (rect.top + rect.height / 2) - startY;
    }

    setFlyingToast({
      id: Date.now(),
      deltaX,
      deltaY,
    });

    setTimeout(() => {
      setFlyingToast(null);
      setIsBellBouncing(true);
      setTimeout(() => setIsBellBouncing(false), 600);
    }, 900);
  };

  // Mark activities as seen when student navigates to activity tab
  React.useEffect(() => {
    if (activeTab === 'activity' && student) {
      try {
        const studentEnrolledClassIds = student.classIds?.length ? student.classIds : (activeClassId ? [activeClassId] : []);
        const hwIds = (state.homework || []).filter(h => h.published && h.classIds.some(c => studentEnrolledClassIds.includes(c))).map(h => h.id);
        const actIds = (state.activities || []).filter(a => a.published && a.classIds.some(c => studentEnrolledClassIds.includes(c))).map(a => a.id);
        const allIds = [...hwIds, ...actIds];
        localStorage.setItem(`seen_activities_${student.id}`, JSON.stringify(allIds));
      } catch {}
    }
  }, [activeTab, student, activeClassId, state.homework, state.activities]);

  // Graceful loading screen state
  const [isLoadingTimeout, setIsLoadingTimeout] = useState<boolean>(false);

  React.useEffect(() => {
    if (!student) {
      const timer = setTimeout(() => {
        setIsLoadingTimeout(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [student]);

  if (!student && !isLoadingTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#F8F9FA] via-emerald-50/20 to-sky-50/20 dark:from-[#0C0C0C] dark:via-[#111111] dark:to-[#0C0C0C] text-slate-900 dark:text-white p-6">
        <div className="flex flex-col items-center max-w-sm text-center space-y-5 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4BA95F] via-[#77DDFA] to-[#9985FB] flex items-center justify-center font-bold text-white text-xl shadow-xl shadow-[#4BA95F]/20">
              <GraduationCap className="w-8 h-8 text-white animate-bounce" />
            </div>
            <div className="absolute -inset-2.5 rounded-3xl border-2 border-[#4BA95F]/40 border-t-transparent animate-spin" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Loading Student Portal…
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Syncing academic credentials, attendance &amp; scores from Cloud Firestore…
            </p>
          </div>

          <div className="w-48 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#4BA95F] h-full rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!student && isLoadingTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <StudentSessionModal
          status="removed"
          studentId={studentId}
          studentName="Student"
          onLogout={onLogout}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  if (!student) return null;

  if (student.accountStatus === 'removed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <StudentSessionModal
          status="removed"
          studentId={studentId}
          studentName={student.name}
          studentNo={student.studentNo}
          onLogout={onLogout}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  const handlePickPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const S = 256;
          const canvas = document.createElement('canvas');
          canvas.width = S;
          canvas.height = S;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setEditPhoto(dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    if (!editName.trim()) {
      onShowToast('Please enter your full name', 'error');
      return;
    }

    const currentName = (student.name || '').trim();
    const currentPhoto = student.photo || null;
    const currentGender = student.gender || student.sex || 'Female';
    const currentDateOfBirth = student.dateOfBirth || student.dob || '';
    const currentPhone = (student.phone || '').trim();
    const currentParentName = (student.parentName || student.guardian || '').trim();
    const currentAddress = (student.address || '').trim();

    const newName = editName.trim();
    const newPhoto = editPhoto || null;
    const newGender = editSex || 'Female';
    const newDateOfBirth = editDob || '';
    const newPhone = editPhone.trim();
    const newParentName = editParentName.trim();
    const newAddress = editAddress.trim();

    // 1. Build strict changes diff: ONLY changed fields, strictly among:
    // name, photo, gender, dateOfBirth, phone, parentName, address
    // NEVER send loginName, sex, dob, guardian, id, studentNo, or undefined values!
    const changes: Record<string, any> = {};

    if (newName !== currentName) {
      changes.name = newName;
    }
    if (newPhoto !== currentPhoto) {
      changes.photo = newPhoto;
    }
    if (newGender !== currentGender) {
      changes.gender = newGender;
    }
    if (newDateOfBirth !== currentDateOfBirth) {
      changes.dateOfBirth = newDateOfBirth;
    }
    if (newPhone !== currentPhone) {
      changes.phone = newPhone;
    }
    if (newParentName !== currentParentName) {
      changes.parentName = newParentName;
    }
    if (newAddress !== currentAddress) {
      changes.address = newAddress;
    }

    if (Object.keys(changes).length === 0) {
      onShowToast('No profile changes detected to save.', 'info');
      return;
    }

    // Always include updatedAt timestamp when saving changes
    changes.updatedAt = new Date().toISOString();

    setIsSavingProfile(true);
    const docPath = `students/${student.id}`;

    try {
      // Ensure user ownership link in users/{uid} is guaranteed before writing
      const currentUser = auth.currentUser;
      if (currentUser?.uid) {
        try {
          const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists() || !userSnap.data()?.studentId) {
            await setDoc(
              userDocRef,
              sanitizeForFirestore({
                uid: currentUser.uid,
                role: 'student',
                studentId: student.id,
                name: newName,
                email: currentUser.email || '',
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            );
          }
        } catch (linkErr) {
          console.warn('[Student Profile Save] users link check warning:', linkErr);
        }
      }

      // Single source of truth: Write directly to `students/{studentId}` in Firestore
      const studentDocRef = doc(db, COLLECTIONS.STUDENTS, student.id);
      await updateDoc(studentDocRef, changes);

      // Keep active auth user session display name updated in localStorage
      try {
        const rawAuth = localStorage.getItem('auth_user');
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth);
          if (parsed?.role === 'student' && parsed.studentId === student.id) {
            if (changes.name) parsed.name = changes.name;
            localStorage.setItem('auth_user', JSON.stringify(parsed));
          }
        }
      } catch (e) {}

      // Update parent state
      onUpdateStudent({
        ...student,
        ...changes,
        // Maintain UI compatibility for views accessing sex, dob, guardian
        sex: changes.gender || student.gender || student.sex,
        dob: changes.dateOfBirth || student.dateOfBirth || student.dob,
        guardian: changes.parentName !== undefined ? changes.parentName : (student.parentName || student.guardian),
      });

      onShowToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      console.error('[Student Profile Save Error]:', err);
      const errCode = err?.code || (err?.name ? String(err.name) : 'unknown-error');
      const errMsg = err?.message || String(err);
      onShowToast(`Failed to save profile [${errCode}] at path "${docPath}": ${errMsg}`, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const curr = currentPassword.trim();
    const next = newPassword.trim();
    const conf = confirmPassword.trim();

    // 1. Validate: all fields filled, new password at least 6 characters, new and confirm match, new password different from current.
    if (!curr || !next || !conf) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (next.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (next !== conf) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (next === curr) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setPasswordError('Authentication session not found. Please log in again.');
      return;
    }

    setIsChangingPassword(true);

    try {
      // 2. Re-authenticate the student with their current password (Firebase reauthenticateWithCredential)
      const credential = EmailAuthProvider.credential(currentUser.email, curr);
      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (authErr: any) {
        const code = authErr?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setPasswordError('Current password is incorrect.');
          setIsChangingPassword(false);
          return;
        } else if (code === 'auth/too-many-requests') {
          setPasswordError('Too many attempts, please wait a few minutes.');
          setIsChangingPassword(false);
          return;
        } else {
          setPasswordError(authErr?.message || 'Authentication failed. Please verify your current password.');
          setIsChangingPassword(false);
          return;
        }
      }

      // 3. Call Firebase updatePassword on the logged-in student's Auth account
      await updatePassword(currentUser, next);

      // 4. Immediately update the password in the student's document in Firestore (students/{studentId})
      const studentDocRef = doc(db, COLLECTIONS.STUDENTS, student.id);
      await updateDoc(studentDocRef, {
        password: next,
        updatedAt: new Date().toISOString(),
      });

      // Update in local state
      onUpdateStudent({
        ...student,
        password: next,
      });

      onShowToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setIsChangePasswordOpen(false);
    } catch (err: any) {
      console.error('[Student Change Password Error]:', err);
      setPasswordError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmitPermission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permClassId) {
      onShowToast('Please select a class for your permission request', 'error');
      return;
    }
    if (!permReason.trim()) {
      onShowToast('Please enter a reason for your absence excuse', 'error');
      return;
    }

    const classObj = state.classes.find(c => c.id === permClassId);
    const className = classObj?.name || 'Class';

    const req: StudentPermissionRequest = {
      id: uid('perm'),
      studentId: student.id,
      classId: permClassId,
      date: permDate,
      reason: permReason.trim(),
      category: permCategory,
      createdAt: new Date().toISOString(),
      status: 'Pending',
    };

    onSubmitPermission(req);
    setPermReason('');
    onShowToast('Permission request submitted to instructor', 'success');

    // Trigger flying notification animation sequence
    triggerFlyingNotification();

    // Trigger backend Telegram notification in background
    try {
      fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          studentNo: student.studentNo || '',
          className: className,
          date: permDate,
          category: permCategory,
          message: permReason.trim(),
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            console.warn('[Telegram Notify API Warning]:', data.error);
          } else {
            console.log('[Telegram Notify API Success] Message sent to teacher.');
          }
        })
        .catch(err => {
          console.warn('[Telegram Notify API network error]:', err);
        });
    } catch (err) {
      console.warn('[Telegram Notify trigger exception]:', err);
    }
  };

  const handleDownloadReportCard = () => {
    if (!myResult || !currentClassObj || !periodResults) return;
    const { subs, workMax } = periodResults;
    const att = myResult.att;
    const label = monthName(currentMonth);

    const subjRows = subs
      .map(
        s =>
          `<tr><td>${s.name}</td><td class="num">${myResult.per[s.id]?.got || 0} / ${myResult.per[s.id]?.max || s.max}</td><td class="num">${myResult.per[s.id]?.pct || 0}%</td></tr>`
      )
      .join('');

    const body = `
      <table class="stats"><tr>
        <td><b>${myResult.total} / ${myResult.max}</b> total</td>
        <td><b>${myResult.pct}%</b> overall</td>
        <td><b>Grade ${myResult.grade}</b></td>
        <td><b>Rank ${myResult.rank} / ${myResult.of}</b></td>
        <td><b>${myResult.status}</b></td>
      </tr></table>
      <h2>Academic Assessment Breakdown</h2>
      <table>
        <thead>
          <tr><th>Component</th><th class="num">Score Earned</th><th class="num">Percent</th></tr>
        </thead>
        <tbody>
          ${subjRows}
          ${workMax > 0 ? `<tr><td>Classwork & Homework Tasks</td><td class="num">${myResult.work} / ${workMax}</td><td class="num">${workMax ? round1((myResult.work / workMax) * 100) : 0}%</td></tr>` : ''}
          <tr><td>Attendance & Conduct Score</td><td class="num">${att.score} / ${att.max}</td><td class="num">${att.max ? round1((att.score / att.max) * 100) : 0}%</td></tr>
        </tbody>
      </table>
      <p class="muted">Attendance Record for Period: ${att.P} sessions present · ${att.L} late arrivals · ${att.E} excused absences (−${ATT_EXCUSED_PENALTY} pts each) · ${att.U} unexcused absences (−${ATT_UNEXCUSED_PENALTY} pt each).</p>`;

    const subtitle = `${student.studentNo ? `${student.studentNo} · ` : ''}${currentClassObj.name} · ${label} · ${state.profile.school || ''}`;
    downloadWordDoc(
      `StudentReport_${student.name.replace(/\s+/g, '_')}_${label.replace(/\s+/g, '_')}`,
      `Academic Report Card — ${student.name}`,
      subtitle,
      body
    );
    onShowToast('Report card downloaded (.doc)', 'success');
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50/95 dark:bg-[#09090b]/95 text-slate-900 dark:text-slate-100 transition-colors flex flex-col pb-36 lg:pb-12 max-w-[1440px] mx-auto w-full shadow-2xl relative">
      {/* First-Time Onboarding Welcome Intro (Per-Browser LocalStorage Scoped) */}
      <StudentOnboardingModal
        studentId={studentId}
        studentName={student.name}
      />

      {/* Real-time Session Modal (Unsync countdown / Removal notice) */}
      <StudentSessionModal
        status={student.accountStatus || null}
        studentId={studentId}
        studentName={student.name}
        studentNo={student.studentNo}
        onLogout={onLogout}
        onShowToast={onShowToast}
      />

      {/* Top Header Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#0C0C0C]/80 border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {appLogo ? (
              <img
                src={appLogo}
                alt="Logo"
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/10 shrink-0 shadow-md"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4BA95F] via-[#77DDFA] to-[#9985FB] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="truncate text-left">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                {appHeading || 'Class Record & Academic Prep'}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold truncate leading-tight">
                {appSubtitle || 'Academic Management Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Real-time Cloud Connection Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                firestoreStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#6cd283] border-emerald-500/20'
                  : firestoreStatus === 'connecting'
                  ? 'bg-[#FEA339]/10 text-[#FEA339] border-[#FEA339]/20 animate-pulse'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/70'
              }`}
              title="Real-Time Cloud Connection"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  firestoreStatus === 'connected'
                    ? 'bg-[#4BA95F] animate-pulse'
                    : firestoreStatus === 'connecting'
                    ? 'bg-[#FEA339] animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <span>{firestoreStatus === 'connected' ? 'Live Sync' : firestoreStatus === 'connecting' ? 'Syncing…' : 'Offline'}</span>
            </div>

            {/* Notification Ring Bell Icon (Standardized circular button) */}
            <div className="relative">
              <button
                id="student-notification-bell"
                type="button"
                onClick={() => {
                  markUnreadAsRead();
                  setIsNotificationDropdownOpen(prev => !prev);
                }}
                className={`w-10 h-10 rounded-full border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/80 dark:bg-[#181818]/80 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-sm relative ${
                  hasTotalUnread ? 'text-rose-500 dark:text-rose-400' : ''
                } ${isBellBouncing ? 'animate-bell-bounce' : ''}`}
                title={hasTotalUnread ? 'New class updates or notifications!' : 'Notification Center'}
              >
                <Bell className="w-4 h-4" />
                {hasTotalUnread && (
                  <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-[#0C0C0C] animate-pulse" />
                )}
              </button>
            </div>

            {/* Dark / Light Toggle (Standardized circular button) */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-full border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/80 dark:bg-[#181818]/80 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-sm"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#FEA339]" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Logout (Standardized circular button) */}
            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 rounded-full border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/80 dark:bg-[#181818]/80 text-rose-500 dark:text-rose-400 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-900/60 cursor-pointer transition-all shadow-sm"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layering Side Navigation (Desktop) vs Main Content Area */}
      <div className="w-full flex flex-col lg:flex-row gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8 flex-grow">
        {/* Desktop Polished Full-Height Sidebar Menu */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 self-stretch sticky top-20 bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-lg space-y-6 justify-between min-h-[calc(100vh-6.5rem)]">
          <div className="space-y-5">
            {/* Top Compact Profile Card */}
            <div
              onClick={() => setActiveTab('profile')}
              className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center gap-3.5 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/10 transition-all group"
              title="View and Edit Student Profile"
            >
              {student.photo ? (
                <img
                  src={student.photo}
                  alt={student.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#4BA95F]/30 shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4BA95F] to-[#77DDFA] text-white font-extrabold flex items-center justify-center text-base shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  {student.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                    {student.name}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {student.studentNo || 'Student'} &middot; {currentClassObj?.name || 'Class'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-[#4BA95F]/15 text-[#4BA95F] border border-[#4BA95F]/20">
                  Student
                </span>
              </div>
            </div>

            {/* Navigation links */}
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 block mb-2">
                Main Menu
              </span>
              <div className="flex flex-col gap-1.5">
                {[
                  { id: 'overview' as const, label: 'Overview', icon: Activity },
                  { id: 'activity' as const, label: 'Class Activity', icon: Sparkles },
                  { id: 'attendance' as const, label: 'Attendance', icon: CalendarCheck },
                  { id: 'library' as const, label: 'Resource Library', icon: BookOpen },
                  { id: 'results' as const, label: 'Scores & Results', icon: Trophy },
                  { id: 'classes' as const, label: 'Classes', icon: Layers },
                  { id: 'profile' as const, label: 'Profile', icon: User },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#4BA95F]/15 text-[#4BA95F] dark:text-[#5ec874] shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#4BA95F]' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.id === 'activity' && activityToDoCount > 0 && (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#141414] shadow-xs animate-dot-pulse shrink-0"
                            title={`${activityToDoCount} to do`}
                          />
                        )}
                        {isActive && (
                          <span className="w-1.5 h-4 rounded-full bg-[#4BA95F]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enrolled class selector for desktop if multiple classes */}
            {studentClasses.length > 1 && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 block">Class Session</span>
                <select
                  value={activeClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  {studentClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Action Shortcuts at bottom of Sidebar */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 block">Quick Actions</span>
            <button
              type="button"
              onClick={() => setIsLeaveFormOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <span>Request Leave</span>
            </button>

            {myResult && (
              <button
                type="button"
                onClick={handleDownloadReportCard}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <span>Report Card (.doc)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsScoresOverlayOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Trophy className="w-3.5 h-3.5" />
              </div>
              <span>Scores Standings</span>
            </button>
          </div>
        </aside>

        {/* Render Mobile Floating Navigation & Quick Actions via React Portal into document.body to ensure true viewport pinning without ancestor containing-block interference */}
        {typeof document !== 'undefined' && createPortal(
          <>
            {/* Mobile Quick Actions Backdrop: Dims & subtly blurs dashboard behind the menu while keeping nav & panel sharp */}
            {isQuickNavOpen && (
              <div
                className="lg:hidden fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
                onClick={() => setIsQuickNavOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Mobile Quick Actions Panel: Narrow vertical rectangle anchored to the right, floating above bottom nav with clear gaps */}
            {isQuickNavOpen && (
              <div
                className="lg:hidden fixed right-4 z-[95] w-56 bg-white/95 dark:bg-[#161618]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 text-slate-800 dark:text-slate-200 text-xs select-none"
                style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10 mb-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Quick Actions</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickNavOpen(false)}
                    className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('activity'); setIsQuickNavOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="truncate">Class Activity</span>
                    </div>
                    {activityToDoCount > 0 && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#161618] shadow-xs animate-dot-pulse shrink-0 ml-2"
                        title={`${activityToDoCount} to do`}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsLeaveFormOpen(true); setIsQuickNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="truncate">Request Leave</span>
                  </button>

                  {myResult && (
                    <button
                      type="button"
                      onClick={() => { handleDownloadReportCard(); setIsQuickNavOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <span className="truncate">Report Card</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setIsScoresOverlayOpen(true); setIsQuickNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <span className="truncate">Scores Standings</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Floating Pill Tab Bar Navigation (Glassmorphic) */}
            <nav
              className="lg:hidden fixed left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto z-[90] bg-white/85 dark:bg-[#0C0C0C]/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 rounded-full px-1.5 py-1.5 sm:px-2.5 sm:py-2 shadow-2xl shadow-black/30 flex items-center justify-between gap-0.5 sm:gap-1"
              style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-full transition-all active:scale-95 ${
                  activeTab === 'overview'
                    ? 'text-[#4BA95F] bg-[#4BA95F]/15 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span className="text-[9px] font-black mt-0.5 tracking-tight truncate">Home</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('attendance')}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-full transition-all active:scale-95 ${
                  activeTab === 'attendance'
                    ? 'text-[#4BA95F] bg-[#4BA95F]/15 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span className="text-[9px] font-black mt-0.5 tracking-tight truncate">Attendance</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-full transition-all active:scale-95 ${
                  activeTab === 'library'
                    ? 'text-[#4BA95F] bg-[#4BA95F]/15 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span className="text-[9px] font-black mt-0.5 tracking-tight truncate">Library</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('classes')}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-full transition-all active:scale-95 ${
                  activeTab === 'classes'
                    ? 'text-[#4BA95F] bg-[#4BA95F]/15 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span className="text-[9px] font-black mt-0.5 tracking-tight truncate">Classes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-full transition-all active:scale-95 ${
                  activeTab === 'profile'
                    ? 'text-[#4BA95F] bg-[#4BA95F]/15 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span className="text-[9px] font-black mt-0.5 tracking-tight truncate">Profile</span>
              </button>

              {/* Merged Quick Navigation FAB inside the bottom navigation bar */}
              <div className="relative shrink-0 ml-0.5 sm:ml-1">
                <button
                  type="button"
                  onClick={() => setIsQuickNavOpen(prev => !prev)}
                  className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white bg-gradient-to-tr from-[#581C87] to-[#3B0764] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg relative ${
                    isQuickNavOpen ? 'rotate-45' : ''
                  }`}
                  title="Quick Actions"
                >
                  <Compass className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white animate-[spin_10s_linear_infinite]" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white dark:border-[#0C0C0C] animate-pulse" />
                </button>
              </div>
            </nav>
          </>,
          document.body
        )}

        {/* Content Panel Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* =================================================================== */}
          {/* 1. STUDENT OVERVIEW DASHBOARD (MAIN LANDING PAGE) */}
          {/* =================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile-only Welcome Banner */}
              <div className="bg-gradient-to-r from-blue-600 via-blue-800 to-indigo-900 dark:from-purple-800 dark:via-indigo-900 dark:to-purple-950 text-white border border-blue-400/30 dark:border-purple-500/20 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-5">
                {/* Left side on Desktop / Top Row on Phone: Avatar + Info */}
                <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                  {student.photo ? (
                    <img
                      src={student.photo}
                      alt={student.name}
                      className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover ring-2 sm:ring-4 ring-white/20 shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/10 backdrop-blur-md text-white font-extrabold flex items-center justify-center text-lg sm:text-2xl shrink-0 shadow-md ring-2 sm:ring-4 ring-white/10">
                      {student.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="text-left min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h2 className="text-base sm:text-2xl font-black text-white tracking-tight leading-snug break-words">
                        Welcome, {student.name}
                      </h2>
                      {(() => {
                        const warning = getPunctualityWarning(student.id, thisMonth(), state, activeClassId);
                        if (!warning) return null;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${warning.badgeClass}`}
                            title={warning.description}
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{warning.label} ({warning.count} Lates)</span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs sm:text-sm text-blue-100/90 dark:text-purple-200/90 font-semibold break-words">
                      {student.studentNo ? `${student.studentNo} · ` : ''}{currentClassObj?.name || 'Classroom'}
                    </p>
                  </div>
                </div>

                {/* Join Class button and Copy Link button: On phone, on their own row below; on desktop, right-aligned and vertically centered */}
                {currentClassObj && (
                  <div className="w-full sm:w-auto shrink-0 flex items-center sm:self-center gap-2">
                    {(() => {
                      const config = getJoinButtonConfig();
                      return (
                        <>
                          <button
                            type="button"
                            disabled={config.disabled}
                            onClick={() => {
                              if (config.reason === 'future') {
                                onShowToast("Sorry, your class hasn't started yet.", 'info');
                                return;
                              }
                              handleJoinClass();
                            }}
                            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-xs ${
                              config.disabled
                                ? 'bg-slate-700/40 text-slate-400 border border-slate-600/30 cursor-not-allowed opacity-50'
                                : config.reason === 'future'
                                ? 'bg-blue-800/60 hover:bg-blue-700 text-blue-100 dark:bg-purple-700/60 dark:hover:bg-purple-700 dark:text-purple-200 border border-blue-400/30 dark:border-purple-500/30 cursor-pointer'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-500/10'
                            }`}
                          >
                            <Video className="w-4 h-4 shrink-0" />
                            <span>{config.text}</span>
                          </button>

                          {currentClassObj.meetLink && (
                            <button
                              type="button"
                              disabled={config.disabled}
                              onClick={handleCopyMeetLink}
                              title="Copy meeting link"
                              aria-label="Copy meeting link"
                              className={`w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl transition-all active:scale-95 shadow-xs ${
                                config.disabled
                                  ? 'bg-slate-700/40 text-slate-400 border border-slate-600/30 cursor-not-allowed opacity-50'
                                  : config.reason === 'future'
                                  ? 'bg-blue-800/60 hover:bg-blue-700 text-blue-100 dark:bg-purple-700/60 dark:hover:bg-purple-700 dark:text-purple-200 border border-blue-400/30 dark:border-purple-500/30 cursor-pointer'
                                  : 'bg-white/15 hover:bg-white/25 border border-white/25 text-white cursor-pointer'
                              }`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Beautiful, High-Structure Grid & Lists (Bank style) */}
              <div className="space-y-4">
                <StudentDashboardWidgets
                  state={state}
                  student={student}
                  currentClassObj={currentClassObj}
                  activityToDoCount={activityToDoCount}
                  onOpenLeaveRequestForm={() => setIsLeaveFormOpen(true)}
                  onOpenLeaveResults={() => setIsLeaveResultsOpen(true)}
                  onOpenResourceLibrary={() => setActiveTab('library')}
                  onOpenReportCard={handleDownloadReportCard}
                  onNavigateTab={setActiveTab}
                  onOpenScoresOverlay={() => setIsScoresOverlayOpen(true)}
                />

                {/* Shared Version label directly below the six stat tiles with small gap, centered */}
                <div className="text-center pt-2 pb-1 select-none">
                  <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                    {APP_VERSION}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* CLASS ACTIVITY TAB (Homework, Quizzes, Achievement) */}
          {/* =================================================================== */}
          {activeTab === 'activity' && (
            <StudentActivityView
              state={state}
              studentId={studentId}
              student={student}
              activeClassId={activeClassId}
              onShowToast={onShowToast}
            />
          )}

          {/* =================================================================== */}
          {/* 2. DEDICATED STUDENT ATTENDANCE INTERFACE */}
          {/* =================================================================== */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <AttendanceJoinChart
                joins={state.classJoins || []}
                permissions={myPermRequests || []}
                attendanceRecords={personalAttendance}
                classDuration={currentClassObj?.duration || 60}
                classStartTime={currentClassObj?.startTime || currentClassObj?.timeFrom || '20:00'}
                yellowFrom={state.teacherSecurity?.yellowFrom ?? 1}
                redFrom={state.teacherSecurity?.redFrom ?? 10}
                yellowPenalty={state.teacherSecurity?.yellowPenalty ?? 0}
                redPenalty={state.teacherSecurity?.redPenalty ?? 2}
              />

              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Filter Registered Attendance Sessions
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                  {studentClasses.length > 1 && (
                    <select
                      value={activeClassId}
                      onChange={e => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      {studentClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <select
                    value={attStatusFilter}
                    onChange={e => setAttStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Statuses ({personalAttendance.length})</option>
                    <option value="P">Present Only ({attStats.present})</option>
                    <option value="L">Late Only ({attStats.late})</option>
                    <option value="E">Excused Only ({attStats.excused})</option>
                    <option value="U">Unexcused Only ({attStats.unexcused})</option>
                  </select>
                </div>
              </div>

              {/* Attendance Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white block tabular-nums">
                    {attStats.present}
                  </span>
                  <span className="text-[11px] text-slate-400">On-time sessions</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5" />
                    <span>Late</span>
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white block tabular-nums">
                    {attStats.late}
                  </span>
                  <span className="text-[11px] text-slate-400">Late arrivals</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Excused</span>
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white block tabular-nums">
                    {attStats.excused}
                  </span>
                  <span className="text-[11px] text-slate-400">−{ATT_EXCUSED_PENALTY} pts each</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Unexcused</span>
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white block tabular-nums">
                    {attStats.unexcused}
                  </span>
                  <span className="text-[11px] text-slate-400">−{ATT_UNEXCUSED_PENALTY} pt each</span>
                </div>
              </div>

              {/* History list */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Daily Attendance History ({filteredAttendance.length} records)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Total Recorded: {attStats.total} Sessions
                  </span>
                </div>

                {filteredAttendance.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {filteredAttendance.map(item => (
                      <div
                        key={`${item.classId}_${item.date}`}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              item.status === 'P'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : item.status === 'L'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : item.status === 'E'
                                ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {item.status}
                          </div>

                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm block">
                              {item.date}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {item.className}
                            </span>
                            {item.reason && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-0.5">
                                Note: &ldquo;{item.reason}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-xs ${
                              item.status === 'P'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : item.status === 'L'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : item.status === 'E'
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {item.status === 'P'
                              ? 'Present'
                              : item.status === 'L'
                              ? 'Late Arrival'
                              : item.status === 'E'
                              ? 'Excused Absence'
                              : 'Unexcused Absence'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                    No attendance records found matching the selected filter.
                  </div>
                )}
              </div>

              {/* Shared Version label directly below attendance content */}
              <div className="text-center pt-2 pb-1 select-none">
                <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 3. DEDICATED STUDENT RESOURCE LIBRARY */}
          {/* =================================================================== */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <ResourceLibraryView
                state={state}
                isTeacher={false}
                onShowToast={onShowToast}
                selectedClassId={activeClassId}
              />
              {/* Shared Version label directly below library content */}
              <div className="text-center pt-2 pb-1 select-none">
                <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 4. SCORES & RESULTS TAB */}
          {/* =================================================================== */}
          {activeTab === 'results' && (
            <div className="space-y-5">
              {myResult ? (
                <>
                  <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white p-5 sm:p-7 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-blue-100 mb-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>{monthName(currentMonth)} Standings</span>
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                          {currentClassObj?.name || 'Classroom Result'}
                        </h2>
                        <p className="text-xs sm:text-sm text-blue-100 mt-1">
                          Teacher: {state.profile.name || 'Instructor'} &middot; {state.profile.school || 'School'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-center">
                          <span className="text-[11px] text-blue-100 block uppercase font-bold tracking-wider">
                            Grade
                          </span>
                          <span className="text-3xl font-black text-amber-300 block">
                            {myResult.grade}
                          </span>
                        </div>

                        <div className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-center">
                          <span className="text-[11px] text-blue-100 block uppercase font-bold tracking-wider">
                            Rank
                          </span>
                          <span className="text-2xl sm:text-3xl font-black block">
                            #{myResult.rank}
                            <span className="text-xs font-normal text-blue-100 block">of {myResult.of}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs sm:text-sm text-blue-100">
                        Total: <strong className="text-white text-base">{myResult.total}</strong> / {myResult.max} points ({myResult.pct}%)
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadReportCard}
                        className="px-4 py-2 bg-white text-blue-800 hover:bg-blue-50 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Download Report Card (.doc)</span>
                      </button>
                    </div>
                  </div>

                  {/* Components */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                        Total Points
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white block mt-1 tabular-nums">
                        {myResult.total}
                        <span className="text-xs font-normal text-slate-400"> / {myResult.max}</span>
                      </span>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                        Overall Percentage
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 block mt-1 tabular-nums">
                        {myResult.pct}%
                      </span>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                        Attendance Score
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 block mt-1 tabular-nums">
                        {myResult.att.score}
                        <span className="text-xs font-normal text-slate-400"> / {myResult.att.max}</span>
                      </span>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                        Standing Status
                      </span>
                      <span className={`text-xl sm:text-2xl font-bold block mt-1 ${myResult.status === 'Pass' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {myResult.status}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 space-y-2">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    No scores recorded yet for {monthName(currentMonth)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your instructor will enter your exam marks and classwork soon.
                  </p>
                </div>
              )}

              {/* Shared Version label directly below scores content */}
              <div className="text-center pt-2 pb-1 select-none">
                <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 5. CLASSES & TIMETABLE TAB */}
          {/* =================================================================== */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                My Class Schedule &amp; Timetable
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {studentClasses.map(c => (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                          {c.name}
                        </h3>
                        {c.level && (
                          <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-md mt-1 inline-block">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                        Enrolled
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {(c.timeFrom || c.timeTo) && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.timeFrom} – {c.timeTo}
                          </span>
                        </div>
                      )}

                      {c.days && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>Days: {c.days}</span>
                        </div>
                      )}

                      {c.room && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Room / Location: {c.room}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shared Version label directly below classes content */}
              <div className="text-center pt-2 pb-1 select-none">
                <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 6. PROFILE TAB */}
          {/* =================================================================== */}
          {activeTab === 'profile' && (
            <div className="max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Customize Profile &amp; Interface
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Set your photo, edit your academic profile details, and switch between Light and Dark interface modes.
                </p>
              </div>

              {/* Theme switcher */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                    Appearance Theme
                  </span>
                  <span className="text-xs text-slate-500">
                    Currently active: <strong className="font-semibold text-[#4BA95F]">{isDark ? 'Dark Mode' : 'Light Mode'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                  <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5 text-xs sm:text-sm">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {editPhoto ? (
                    <img
                      src={editPhoto}
                      alt={student.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-[#4BA95F] shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-7 h-7" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePickPhoto}
                        className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition-all cursor-pointer"
                      >
                        Change Photo
                      </button>
                      {editPhoto && (
                        <button
                          type="button"
                          onClick={() => setEditPhoto(null)}
                          className="px-2 py-1 text-xs text-rose-500 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">Recommended square photo (PNG or JPG)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Gender
                    </label>
                    <select
                      value={editSex}
                      onChange={e => setEditSex(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editDob}
                      onChange={e => setEditDob(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Phone / Telegram
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +855 12 345 678"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Parent / Guardian Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Parent or Guardian"
                      value={editParentName}
                      onChange={e => setEditParentName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Street / City"
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full py-3 bg-[#4BA95F] hover:bg-[#3e8f50] disabled:opacity-60 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Profile Changes…</span>
                      </>
                    ) : (
                      <span>Save Profile Changes</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Portal Security & Password (Fix 2: Student can change own password) */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#4BA95F]" />
                      <span>Portal Account Password</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      Change your portal login password anytime using your current password.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordOpen(prev => !prev);
                      setPasswordError(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                  >
                    <KeyRound className="w-4 h-4 text-purple-500" />
                    <span>{isChangePasswordOpen ? 'Cancel' : 'Change Password'}</span>
                  </button>
                </div>

                {isChangePasswordOpen && (
                  <form onSubmit={handleChangePassword} className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-4">
                    {passwordError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                          Current Password
                        </label>
                        <input
                          type="password"
                          required
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="Current password"
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-[#4BA95F] focus:outline-none text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangePasswordOpen(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordError(null);
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Password…</span>
                          </>
                        ) : (
                          <span>Confirm Password Change</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Shared Version label directly below profile content */}
              <div className="text-center pt-2 pb-1 select-none">
                <span className="text-[10px] text-slate-600/80 dark:text-white/50 font-mono italic tracking-wide">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>



      {/* Centered Leave Request Form Modal ("Request Leave / Permission") */}
      <LeaveRequestFormModal
        isOpen={isLeaveFormOpen}
        onClose={() => setIsLeaveFormOpen(false)}
        state={state}
        studentId={student.id}
        studentClasses={studentClasses}
        onSubmitPermission={onSubmitPermission}
        onShowToast={onShowToast}
      />

      {/* Centered Leave Request Results Modal */}
      <LeaveRequestResultsModal
        isOpen={isLeaveResultsOpen || isNotificationDropdownOpen}
        onClose={() => {
          setIsLeaveResultsOpen(false);
          setIsNotificationDropdownOpen(false);
        }}
        onRequestNewLeave={() => {
          setIsLeaveResultsOpen(false);
          setIsNotificationDropdownOpen(false);
          setIsLeaveFormOpen(true);
        }}
        requests={myPermRequests}
        cancellations={studentCancellations}
        classes={state.classes}
        studentId={studentId}
        dismissedNoticeIds={dismissedNoticeIds}
        homework={state.homework || []}
        submissions={(state.homeworkSubmissions || []).filter(s => s.studentId === studentId)}
        onNavigateTab={setActiveTab}
        onDismissCancellation={handleDismissNoticeLocal}
        initialTab={notificationCenterTab}
      />

      {/* Floating Academic Scores & Standings Overlay */}
      {isScoresOverlayOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsScoresOverlayOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 pt-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 relative text-slate-900 dark:text-white mt-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Circular Close (X) Button punching through top edge of card */}
            <button
              type="button"
              onClick={() => setIsScoresOverlayOpen(false)}
              className="absolute -top-4 right-4 w-9 h-9 rounded-full bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-md hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer z-20"
              title="Close standings overlay"
            >
              <X className="w-4.5 h-4.5 text-slate-800 dark:text-slate-100" />
            </button>

            {myResult ? (
              <div className="space-y-4 text-left">
                {/* Standings Blue Card */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 text-white p-4 shadow-lg">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 dark:bg-white/95 backdrop-blur-md text-[10px] font-black text-slate-900 mb-2 shadow-xs">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{monthName(currentMonth)} Standings</span>
                  </span>
                  <h3 className="text-base font-black tracking-tight truncate leading-tight">
                    {currentClassObj?.name || 'Academic standing'}
                  </h3>
                  <p className="text-[10px] text-blue-100 mt-0.5">
                    Instructor: {state.profile?.name || 'Soth Sothea'}
                  </p>

                  <div className="flex items-center gap-2.5 mt-3.5">
                    <div className="flex-1 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-white/95 border border-white/40 text-center shadow-xs">
                      <span className="text-[9px] text-slate-800 block uppercase font-extrabold tracking-wider leading-none">Grade</span>
                      <span className="text-lg font-black text-slate-900 block mt-1 leading-none">{myResult.grade || '—'}</span>
                    </div>
                    <div className="flex-1 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-white/95 border border-white/40 text-center shadow-xs">
                      <span className="text-[9px] text-slate-800 block uppercase font-extrabold tracking-wider leading-none">Rank</span>
                      <span className="text-lg font-black text-slate-900 block mt-1 leading-none">#{myResult.rank || '—'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-blue-50">
                      {myResult.total ?? 0} / {myResult.max ?? 0} Points ({myResult.pct ?? 0}%)
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadReportCard}
                      className="px-2.5 py-1.5 bg-white text-blue-800 hover:bg-blue-50 font-black rounded-lg text-[9px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3 h-3 text-blue-600" />
                      <span>Report Card</span>
                    </button>
                  </div>
                </div>

                {/* Grid Components */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-left shadow-xs">
                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider block leading-none">Total Points</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100 block mt-1.5 font-mono">{myResult.total ?? 0} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ {myResult.max ?? 0}</span></span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-left shadow-xs">
                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider block leading-none">Percentage</span>
                    <span className="text-base font-black text-blue-700 dark:text-blue-400 block mt-1.5 font-mono">{myResult.pct ?? 0}%</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-left shadow-xs">
                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider block leading-none">Attendance</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400 block mt-1.5 font-mono">{myResult.att?.score ?? 0} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ {myResult.att?.max ?? 0}</span></span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-left shadow-xs">
                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider block leading-none">Status</span>
                    <span className={`text-base font-black block mt-1.5 ${myResult.status === 'Pass' ? 'text-emerald-700 dark:text-emerald-400 animate-pulse' : 'text-rose-700 dark:text-rose-400'}`}>{myResult.status || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <Trophy className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No results recorded</h3>
                <p className="text-xs text-slate-500 font-medium">Please check back later.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Embedded Animation Keyframes */}
      <style>{`
        @keyframes flyToBell {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          60% {
            opacity: 0.9;
          }
          100% {
            transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.15);
            opacity: 0;
          }
        }

        @property --border-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        @keyframes rotate-border {
          to {
            --border-angle: 360deg;
          }
        }

        @keyframes overlay-fade-in {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
          }
        }

        @keyframes overlay-fade-out {
          from {
            opacity: 1;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
          }
          to {
            opacity: 0;
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
          }
        }

        .overlay-entrance {
          animation: overlay-fade-in 0.25s ease-out forwards;
        }

        .overlay-exit {
          animation: overlay-fade-out 0.25s ease-in forwards;
        }

        @keyframes slide-down-overshoot {
          0% {
            transform: translate3d(-50%, -150%, 0);
          }
          70% {
            transform: translate3d(-50%, 10px, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @keyframes slide-up-exit {
          to {
            transform: translate3d(-50%, -150%, 0);
            opacity: 0;
          }
        }

        .spotlight-entrance {
          animation: slide-down-overshoot 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .spotlight-exit {
          animation: slide-up-exit 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards;
        }

        .spotlight-glowing-card {
          --border-angle: 0deg;
          position: relative;
          background: #020617; /* Slate-950 */
        }

        .spotlight-glowing-border::before {
          content: "";
          position: absolute;
          inset: -1.5px; /* sharp thin border */
          border-radius: calc(1rem + 1.5px);
          z-index: -1;
          background: conic-gradient(
            from var(--border-angle),
            transparent 20%,
            var(--glow-color-1, #f59e0b) 40%,
            var(--glow-color-2, #fbbf24) 60%,
            transparent 80%
          );
          animation: rotate-border 3s linear infinite;
        }

        @keyframes soft-pulse {
          0%, 100% {
            box-shadow: 0 0 6px 1px var(--glow-shadow-color, rgba(245, 158, 11, 0.25));
          }
          50% {
            box-shadow: 0 0 12px 2px var(--glow-shadow-color, rgba(245, 158, 11, 0.35));
          }
        }

        .spotlight-pulse-glow {
          animation: soft-pulse 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .spotlight-entrance {
            animation: none !important;
            transform: translate3d(-50%, 0, 0) !important;
          }
          .spotlight-exit {
            animation: none !important;
            opacity: 0 !important;
          }
          .spotlight-glowing-border::before {
            animation: none !important;
            background: var(--glow-color-1, #f59e0b) !important;
          }
          .spotlight-pulse-glow {
            animation: none !important;
            box-shadow: 0 0 6px 1px var(--glow-shadow-color, rgba(245, 158, 11, 0.35)) !important;
          }
        }
      `}</style>

      {/* Spotlight Notice Overlay & Modal Card */}
      {spotlightOpen && currentSpotlightNotice && (
        <div
          role="alertdialog"
          aria-modal="true"
          className={`fixed inset-0 z-[250] flex items-start justify-center p-4 overflow-y-auto ${
            isSpotlightExiting ? 'overlay-exit' : 'overlay-entrance'
          }`}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            ref={cardRef}
            tabIndex={0}
            className={`fixed left-1/2 w-[92%] max-w-[340px] select-none pointer-events-auto touch-none focus:outline-none transition-all duration-300 ${
              isSpotlightExiting ? 'spotlight-exit' : 'spotlight-entrance'
            }`}
            style={{
              top: `calc(1.5rem + env(safe-area-inset-top, 0px))`,
              transform: `translate3d(-50%, ${dragY}px, 0)`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="spotlight-glowing-card spotlight-glowing-border spotlight-pulse-glow p-3.5 bg-slate-950/95 border border-white/10 rounded-2xl relative overflow-hidden flex flex-col gap-2.5 text-white shadow-2xl"
              style={{
                '--glow-color-1': currentSpotlightNotice.makeupDate ? '#3b82f6' : '#f59e0b',
                '--glow-color-2': currentSpotlightNotice.makeupDate ? '#8b5cf6' : '#fbbf24',
                '--glow-shadow-color': currentSpotlightNotice.makeupDate ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)',
              } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                    currentSpotlightNotice.makeupDate
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    <CalendarX className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[17px] sm:text-[18px] font-black tracking-tight text-white leading-tight">
                      {currentSpotlightNotice.makeupDate ? 'Class rescheduled' : 'Class cancelled'}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Class ID: {currentSpotlightNotice.classId}
                    </p>
                  </div>
                </div>

                {spotlightNotices.length > 1 && (
                  <span className="text-[10px] font-black text-slate-300 bg-white/10 px-2 py-0.5 rounded-lg shrink-0">
                    {spotlightIndex + 1} of {spotlightNotices.length}
                  </span>
                )}
              </div>

              {/* Compact Inline Dates Layout - text exactly 14px (text-sm is 14px) */}
              <div className="space-y-1 text-sm font-medium border-t border-white/5 pt-2 text-slate-300">
                <p>
                  Original Class: <strong className="font-mono text-slate-100">{formatNoticeDate(currentSpotlightNotice.originalDate)}</strong>
                </p>
                {currentSpotlightNotice.makeupDate && (
                  <p className="text-emerald-400">
                    Makeup Class: <strong className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/15">{formatNoticeDate(currentSpotlightNotice.makeupDate)}</strong>
                  </p>
                )}
              </div>

              {/* Tight Reason Message Block */}
              {currentSpotlightNotice.reason && (
                <div className="text-[11px] sm:text-xs text-slate-300 bg-white/5 p-2 rounded-xl border border-white/5 italic font-medium leading-relaxed line-clamp-2">
                  &ldquo;{currentSpotlightNotice.reason}&rdquo;
                </div>
              )}

              {/* Tighter Action Buttons (max height 40px - 44px) */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleDismissSpotlight()}
                  className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Got it</span>
                </button>

                <button
                  type="button"
                  onClick={handleViewInNotifications}
                  className="w-full h-8 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 font-bold rounded-xl text-[10px] sm:text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-3 h-3" />
                  <span>View in notifications</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
