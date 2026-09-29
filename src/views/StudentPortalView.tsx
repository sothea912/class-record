import React, { useState, useMemo } from 'react';
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
} from '../types';
import {
  AVATAR_OPTIONS,
  getLevelAndProgressFromXp,
  calculateAttendanceScore,
  createDefaultProgress,
} from '../utils/gamification';
import { syncSaveStudentProgress, syncSaveClassJoin, syncSaveDashboardLayout, subscribeToAppBranding } from '../utils/firestoreSync';
import {
  ATT_EXCUSED_PENALTY,
  ATT_UNEXCUSED_PENALTY,
  computeResults,
  monthName,
  round1,
  thisMonth,
  todayISO,
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

interface StudentPortalViewProps {
  state: AppState;
  studentId: string;
  onLogout: () => void;
  onUpdateStudent: (updatedStudent: StudentItem) => void;
  onSubmitPermission: (req: StudentPermissionRequest) => void;
  onDeletePermission?: (permitId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  firestoreStatus?: 'connected' | 'connecting' | 'offline';
}

type PortalTab = 'overview' | 'attendance' | 'library' | 'results' | 'classes' | 'profile';

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  state,
  studentId,
  onLogout,
  onUpdateStudent,
  onSubmitPermission,
  onDeletePermission,
  isDark,
  onToggleTheme,
  onShowToast,
  firestoreStatus = 'connected',
}) => {
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

  const handleJoinClass = async () => {
    if (!currentClassObj) {
      onShowToast('No active class selected for check-in', 'error');
      return;
    }

    if (!currentClassObj.meetLink) {
      onShowToast('No online link set for this class', 'error');
      return;
    }

    const today = todayISO();
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

    // Check if already checked in today
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

      try {
        await syncSaveClassJoin(currentClassObj.id, studentId, today, classStart, minsLate, status);
        onShowToast(`Checked in to ${currentClassObj.name} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`, 'success');
      } catch (err: any) {
        console.warn('Class join sync warning:', err);
      }
    } else {
      const joinTimeStr = existingJoin.joinedAt ? new Date(existingJoin.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'class start';
      onShowToast(`Already checked in today at ${joinTimeStr}`, 'info');
    }

    const meetLink = currentClassObj.meetLink;
    window.open(meetLink, '_blank');
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
  const [editSex, setEditSex] = useState(student?.sex || 'Female');
  const [editDob, setEditDob] = useState(student?.dob || '');
  const [editPhone, setEditPhone] = useState(student?.phone || '');
  const [editGuardian, setEditGuardian] = useState(student?.guardian || '');
  const [editAddress, setEditAddress] = useState(student?.address || '');
  const [editPhoto, setEditPhoto] = useState<string | null>(student?.photo || null);
  const [editPassword, setEditPassword] = useState(student?.password || '');

  // Synchronize field state if student doc updates remotely
  React.useEffect(() => {
    if (student) {
      setEditName(student.name || '');
      setEditSex(student.sex || 'Female');
      setEditDob(student.dob || '');
      setEditPhone(student.phone || '');
      setEditGuardian(student.guardian || '');
      setEditAddress(student.address || '');
      setEditPhoto(student.photo || null);
      setEditPassword(student.password || '');
    }
  }, [
    student?.id,
    student?.name,
    student?.sex,
    student?.dob,
    student?.phone,
    student?.guardian,
    student?.address,
    student?.photo,
    student?.password,
  ]);

  // Live 60-Minute Countdown Timer for Granted Password Reset
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (student?.passwordResetStatus === 'granted' && student?.passwordResetExpiresAt) {
      const ms = new Date(student.passwordResetExpiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(ms / 1000));
    }
    return 0;
  });

  React.useEffect(() => {
    if (student?.passwordResetStatus !== 'granted' || !student?.passwordResetExpiresAt) {
      setSecondsRemaining(0);
      return;
    }

    const calc = () => {
      const ms = new Date(student.passwordResetExpiresAt!).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(ms / 1000));
      setSecondsRemaining(secs);
      if (secs === 0 && student.passwordResetStatus === 'granted') {
        const updated: StudentItem = {
          ...student,
          passwordResetStatus: 'none',
          passwordResetExpiresAt: undefined,
        };
        onUpdateStudent(updated);
        onShowToast('Password change window expired. Original password preserved.', 'info');
      }
    };

    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [student?.passwordResetStatus, student?.passwordResetExpiresAt]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleRequestPasswordChange = () => {
    if (!student) return;
    const updated: StudentItem = {
      ...student,
      passwordResetStatus: 'pending',
    };
    onUpdateStudent(updated);
    onShowToast('Password change request sent to instructor for approval', 'success');
  };

  // Permission Request Form fields
  const [permClassId, setPermClassId] = useState(studentClasses[0]?.id || '');
  const [permDate, setPermDate] = useState(todayISO());
  const [permCategory, setPermCategory] = useState('Health & Medical');
  const [permReason, setPermReason] = useState('');
  const [confirmingAbandonId, setConfirmingAbandonId] = useState<string | null>(null);
  const [isAttendancePermsExpanded, setIsAttendancePermsExpanded] = useState(false);
  const [isHistoryPermsExpanded, setIsHistoryPermsExpanded] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

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
      reason?: string;
    }[] = [];

    state.attendance.forEach(session => {
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

    relevant.forEach(item => {
      if (item.status === 'P') present++;
      else if (item.status === 'L') late++;
      else if (item.status === 'E') excused++;
      else if (item.status === 'U') unexcused++;
    });

    const total = present + late + excused + unexcused;
    const rate = total > 0 ? round1(((present + late * 0.75) / total) * 100) : 100;
    const score = Math.max(0, 100 - excused * ATT_EXCUSED_PENALTY - unexcused * ATT_UNEXCUSED_PENALTY);

    return {
      total,
      present,
      late,
      excused,
      unexcused,
      rate,
      score,
    };
  }, [personalAttendance, activeClassId]);

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

  const isPasswordGranted = Boolean(
    student?.passwordResetStatus === 'granted' &&
      student?.passwordResetExpiresAt &&
      new Date(student.passwordResetExpiresAt).getTime() > Date.now()
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      onShowToast('Please enter your name', 'error');
      return;
    }
    const updated: StudentItem = {
      ...student,
      name: editName.trim(),
      sex: editSex,
      dob: editDob,
      phone: editPhone.trim(),
      guardian: editGuardian.trim(),
      address: editAddress.trim(),
      photo: editPhoto,
    };

    if (isPasswordGranted && editPassword.trim()) {
      updated.password = editPassword.trim();
      updated.passwordResetStatus = 'none';
      updated.passwordResetExpiresAt = undefined;
      onShowToast('Profile and new password updated successfully!', 'success');
    } else {
      onShowToast('Profile updated successfully', 'success');
    }

    onUpdateStudent(updated);
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060608] text-slate-900 dark:text-slate-100 transition-colors flex flex-col pb-28 lg:pb-12 max-w-[1200px] mx-auto w-full shadow-2xl relative">
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
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#0C0C0C]/80 border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-6 py-3">
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
                  hasUnread ? 'text-rose-500 dark:text-rose-400' : ''
                } ${isBellBouncing ? 'animate-bell-bounce' : ''}`}
                title={hasUnread ? 'New permission request updates!' : 'Permission Notifications'}
              >
                <Bell className="w-4 h-4" />
                {hasUnread && (
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
      <div className="w-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 flex-grow">
        {/* Desktop Sticky Sidebar Menu */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 h-fit sticky top-20 bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Academics</span>
            <span className="text-base font-black text-slate-900 dark:text-white block mt-1">Student Portal</span>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'attendance'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'library'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Resource Library</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'results'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Scores &amp; Results</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'classes'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Classes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#4BA95F]/10 text-[#4BA95F]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </div>

          {/* Enrolled class selector for desktop if multiple classes */}
          {studentClasses.length > 1 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Session</span>
              <select
                value={activeClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
              >
                {studentClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </aside>

        {/* Mobile Quick Actions Backdrop: Dims & subtly blurs dashboard behind the menu while keeping nav & panel sharp */}
        {isQuickNavOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
            onClick={() => setIsQuickNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Quick Actions Panel: Narrow vertical rectangle anchored to the right, floating above bottom nav with clear gaps */}
        {isQuickNavOpen && (
          <div
            className="lg:hidden fixed bottom-[98px] right-4 z-50 w-56 bg-white/95 dark:bg-[#161618]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 text-slate-800 dark:text-slate-200 text-xs select-none"
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
        <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white/20 dark:bg-[#0C0C0C]/35 backdrop-blur-xl border border-white/25 dark:border-white/10 rounded-full p-2.5 shadow-2xl shadow-black/25 flex items-center justify-around gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center p-2 rounded-full transition-all shrink-0 active:scale-95 ${
              activeTab === 'overview'
                ? 'text-[#4BA95F] bg-[#4BA95F]/15 px-3'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4.5 h-4.5" />
            <span className="text-[9px] font-black mt-0.5 tracking-tight">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center p-2 rounded-full transition-all shrink-0 active:scale-95 ${
              activeTab === 'attendance'
                ? 'text-[#4BA95F] bg-[#4BA95F]/15 px-3'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarCheck className="w-4.5 h-4.5" />
            <span className="text-[9px] font-black mt-0.5 tracking-tight">Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex flex-col items-center justify-center p-2 rounded-full transition-all shrink-0 active:scale-95 ${
              activeTab === 'library'
                ? 'text-[#4BA95F] bg-[#4BA95F]/15 px-3'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span className="text-[9px] font-black mt-0.5 tracking-tight">Library</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`flex flex-col items-center justify-center p-2 rounded-full transition-all shrink-0 active:scale-95 ${
              activeTab === 'classes'
                ? 'text-[#4BA95F] bg-[#4BA95F]/15 px-3'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4.5 h-4.5" />
            <span className="text-[9px] font-black mt-0.5 tracking-tight">Classes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center p-2 rounded-full transition-all shrink-0 active:scale-95 ${
              activeTab === 'profile'
                ? 'text-[#4BA95F] bg-[#4BA95F]/15 px-3'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4.5 h-4.5" />
            <span className="text-[9px] font-black mt-0.5 tracking-tight">Profile</span>
          </button>

          {/* Merged Quick Navigation FAB inside the bottom navigation bar */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsQuickNavOpen(prev => !prev)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white bg-gradient-to-tr from-[#581C87] to-[#3B0764] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg relative ${
                isQuickNavOpen ? 'rotate-45' : ''
              }`}
              title="Quick Actions"
            >
              <Compass className="w-4.5 h-4.5 text-white animate-[spin_10s_linear_infinite]" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white dark:border-[#0C0C0C] animate-pulse" />
            </button>
          </div>
        </nav>

        {/* Content Panel Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* =================================================================== */}
          {/* 1. STUDENT OVERVIEW DASHBOARD (MAIN LANDING PAGE) */}
          {/* =================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile-only Banner */}
              <div className="bg-gradient-to-r from-blue-600 via-blue-800 to-indigo-900 dark:from-purple-800 dark:via-indigo-900 dark:to-purple-950 text-white border border-blue-400/30 dark:border-purple-500/20 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center gap-5 justify-start">
                {student.photo ? (
                  <img
                    src={student.photo}
                    alt={student.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-white/20 shrink-0 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10 backdrop-blur-md text-white font-extrabold flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-lg ring-4 ring-white/10">
                    {student.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-left space-y-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                      Welcome, {student.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-blue-100/90 dark:text-purple-200/90 font-semibold mt-1">
                      {student.studentNo ? `${student.studentNo} · ` : ''}{currentClassObj?.name || 'Classroom'}
                    </p>
                  </div>

                  {currentClassObj && (
                    <div className="pt-1">
                      {(() => {
                        const config = getJoinButtonConfig();
                        return (
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
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
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
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Beautiful, High-Structure Grid & Lists (Bank style) */}
              <div className="space-y-4">
                <StudentDashboardWidgets
                  state={state}
                  student={student}
                  currentClassObj={currentClassObj}
                  onOpenLeaveRequestForm={() => setIsLeaveFormOpen(true)}
                  onOpenLeaveResults={() => setIsLeaveResultsOpen(true)}
                  onOpenResourceLibrary={() => setActiveTab('library')}
                  onOpenReportCard={handleDownloadReportCard}
                  onNavigateTab={setActiveTab}
                  onOpenScoresOverlay={() => setIsScoresOverlayOpen(true)}
                />
              </div>
            </div>
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
                  <div className="space-y-2.5">
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
            </div>
          )}

          {/* =================================================================== */}
          {/* 3. DEDICATED STUDENT RESOURCE LIBRARY */}
          {/* =================================================================== */}
          {activeTab === 'library' && (
            <ResourceLibraryView
              state={state}
              isTeacher={false}
              onShowToast={onShowToast}
              selectedClassId={activeClassId}
            />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
          )}

          {/* =================================================================== */}
          {/* 6. PROFILE TAB */}
          {/* =================================================================== */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Customize Profile &amp; Interface
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Set your photo, edit your name, and switch between Light and Dark interface modes.
                </p>
              </div>

              {/* Theme switcher */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                    Appearance Theme
                  </span>
                  <span className="text-xs text-slate-500">
                    Currently active: <strong className="font-semibold text-blue-600 dark:text-blue-400">{isDark ? 'Dark Mode' : 'Light Mode'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                  <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {editPhoto ? (
                    <img
                      src={editPhoto}
                      alt={student.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-500 shrink-0"
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
                        className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
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
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Gender
                    </label>
                    <select
                      value={editSex}
                      onChange={e => setEditSex(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white"
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-slate-900 dark:text-white"
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Portal Password</span>
                      </label>
                    </div>

                    <div>
                      {isPasswordGranted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                          <Clock3 className="w-3.5 h-3.5 animate-spin" />
                          <span>Editable ({formatCountdown(secondsRemaining)})</span>
                        </span>
                      ) : student.passwordResetStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold animate-pulse">
                          <Clock3 className="w-3.5 h-3.5" />
                          <span>Request Sent (Pending Approval)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestPasswordChange}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Request Change Password</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="password"
                      disabled={!isPasswordGranted}
                      value={isPasswordGranted ? editPassword : '••••••••'}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder={isPasswordGranted ? 'Enter your new password' : 'Password locked'}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono transition-all ${
                        isPasswordGranted
                          ? 'bg-white dark:bg-slate-900 border-2 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 dark:text-white focus:outline-none'
                          : 'bg-slate-200/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-slate-400 cursor-not-allowed select-none'
                      }`}
                    />

                    {isPasswordGranted && (
                      <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                        <span className="font-medium text-[11px] sm:text-xs">
                          Instructor granted permission. Enter your new password and click <strong>Save Profile Changes</strong> below.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#4BA95F] hover:bg-[#3e8f50] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </form>
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

      {/* Footer Build Watermark */}
      <footer className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-400 font-medium font-mono border-t border-slate-200/60 dark:border-slate-800 mt-10">
        <span>Student Portal &middot; UI build 2026-09-28-r2</span>
      </footer>

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
      `}</style>
    </div>
  );
};
