import React, { useState, useEffect } from 'react';
import {
  AnnouncementBanner,
  AppState,
  AttendanceSession,
  AttendanceStatus,
  AuthUser,
  ClassCancellationItem,
  ClassItem,
  ClassworkTask,
  LibraryResource,
  MarkDoc,
  NavView,
  StudentItem,
  StudentPermissionRequest,
  SubjectItem,
  UserProfile,
} from './types';
import {
  exportBackupJSON,
  loadAuthSession,
  loadStoredState,
  saveAuthSession,
  saveStoredState,
} from './utils/storage';
import { attKey } from './utils/helpers';
import {
  seedFirestoreIfEmpty,
  subscribeToFirestore,
  provisionAllStudentsAuth,
  syncSaveClass,
  syncSaveClassNotice,
  syncDeleteClass,
  syncSaveStudent,
  syncDeleteStudent,
  syncSaveStudents,
  syncSaveSubject,
  syncDeleteSubject,
  syncSaveAttendance,
  syncDeleteAttendance,
  syncSaveMarkDoc,
  syncSaveClassworkTask,
  syncDeleteClassworkTask,
  syncSavePermission,
  syncDeletePermission,
  syncSaveBanner,
  syncDeleteBanner,
  syncSaveResource,
  syncDeleteResource,
  syncSaveSettings,
  deleteStudentWithNotificationAndFullCleanup,
  provisionStudentAuthAccount,
  deleteAccountRequest,
  subscribeToAppBranding,
} from './utils/firestoreSync';
import { testConnection } from './utils/firebase';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastContainer, ToastMessage } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { Modal } from './components/Modal';

import { OverviewView } from './views/OverviewView';
import { ResourceLibraryView } from './views/ResourceLibraryView';
import { StudentsView } from './views/StudentsView';
import { ClassesView } from './views/ClassesView';
import { AttendanceView } from './views/AttendanceView';
import { AttendanceReportView } from './views/AttendanceReportView';
import { PermitsView } from './views/PermitsView';
import { SubjectsView } from './views/SubjectsView';
import { ClassworkView } from './views/ClassworkView';
import { RankingView } from './views/RankingView';
import { ResultBrowserView } from './views/ResultBrowserView';
import { ProfileView } from './views/ProfileView';
import { NoticesView } from './views/NoticesView';
import { LoginView } from './views/LoginView';
import { StudentPortalView } from './views/StudentPortalView';
import { StudentProfileView } from './views/StudentProfileView';
import { ImportView } from './views/ImportView';
import { AdventurerModeView } from './views/AdventurerModeView';
import { TeacherActivityView } from './views/TeacherActivityView';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadStoredState());
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuthSession());
  const [currentView, setCurrentView] = useState<NavView | 'student-profile'>('dash');
  const [selectedStudentProfileId, setSelectedStudentProfileId] = useState<string | null>(null);
  const [selectedStudentProfileTab, setSelectedStudentProfileTab] = useState<'overview' | 'academics' | 'attendance' | 'classes' | 'portal'>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return state.classes[0]?.id || '';
  });
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(true);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');

  // Dark / Light Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('classrecord_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Mobile drawer
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Command palette (⌘K)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Custom Deletion Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isWarning?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    
    setToasts(prev => {
      // Prevent duplicate stacking: filter out any existing toast with identical text
      const filtered = prev.filter(t => t.text !== text);
      const next = [...filtered, { id, text, type }];
      // Limit to a maximum of 2 visible at once, keeping the newest ones
      if (next.length > 2) {
        return next.slice(next.length - 2);
      }
      return next;
    });

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Sync dark class on root document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('classrecord_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('classrecord_theme', 'light');
    }
  }, [isDark]);

  const [appWallpaperDark, setAppWallpaperDark] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('cached_app_wallpaper_dark');
    } catch {
      return null;
    }
  });

  const [appWallpaperLight, setAppWallpaperLight] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('cached_app_wallpaper_light');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsubscribe = subscribeToAppBranding((branding) => {
      const darkWall = branding.wallpaperDark !== undefined ? branding.wallpaperDark : null;
      const lightWall = branding.wallpaperLight !== undefined ? branding.wallpaperLight : null;
      setAppWallpaperDark(darkWall || null);
      setAppWallpaperLight(lightWall || null);

      try {
        if (darkWall) {
          sessionStorage.setItem('cached_app_wallpaper_dark', darkWall);
        } else {
          sessionStorage.removeItem('cached_app_wallpaper_dark');
        }
        if (lightWall) {
          sessionStorage.setItem('cached_app_wallpaper_light', lightWall);
        } else {
          sessionStorage.removeItem('cached_app_wallpaper_light');
        }
      } catch {}
    });
    return () => unsubscribe();
  }, []);

  const activeWallpaper = isDark ? appWallpaperDark : appWallpaperLight;

  useEffect(() => {
    if (activeWallpaper) {
      document.documentElement.classList.add('has-wallpaper');
    } else {
      document.documentElement.classList.remove('has-wallpaper');
    }
  }, [activeWallpaper]);

  // Connect & subscribe to Firestore for real-time multi-device database persistence
  useEffect(() => {
    setFirestoreStatus('connecting');
    console.log('[Firestore] Initiating real-time connection to Cloud Firestore...');

    testConnection().then(connected => {
      if (connected) {
        setFirestoreStatus('connected');
        if (authUser) {
          seedFirestoreIfEmpty(state);
        }
      } else {
        setFirestoreStatus('offline');
      }
    });

    const unsubscribe = subscribeToFirestore(
      authUser,
      updater => {
        setState(updater);
        setIsCloudSyncing(false);
        setFirestoreStatus('connected');
      },
      err => {
        console.warn('[Firestore Real-Time Sync Alert]:', err);
        setIsCloudSyncing(false);
        setFirestoreStatus('offline');
      },
      () => {
        setFirestoreStatus('connected');
        setIsCloudSyncing(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authUser]);

  // Persist state to local cache as backup
  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  // Ensure selectedClassId stays valid
  useEffect(() => {
    if (state.classes.length > 0 && (!selectedClassId || !state.classes.some(c => c.id === selectedClassId))) {
      setSelectedClassId(state.classes[0].id);
    }
  }, [state.classes, selectedClassId]);

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    saveAuthSession(user);
    showToast(`Welcome back, ${user.name}!`);
  };

  const handleLogout = () => {
    setAuthUser(null);
    saveAuthSession(null);
    showToast('Signed out of session', 'info');
  };

  const handleUpdateTeacherPassword = (newPassword: string, teacherName: string) => {
    const updatedSec = {
      isConfigured: true,
      setupCodeUsed: true,
      password: newPassword,
    };
    const updatedProf = {
      ...state.profile,
      name: teacherName,
    };

    setState(prev => ({
      ...prev,
      teacherSecurity: updatedSec,
      profile: updatedProf,
    }));
    syncSaveSettings(updatedProf, updatedSec);
    showToast('Instructor password configured & saved to cloud', 'success');
  };

  // Student specific handlers
  const handleUpdateStudentFromPortal = (updatedStudent: StudentItem) => {
    setState(prev => {
      const idx = prev.students.findIndex(s => s.id === updatedStudent.id);
      const next = [...prev.students];
      if (idx >= 0) next[idx] = updatedStudent;
      return { ...prev, students: next };
    });

    // Update active auth session name if changed
    if (authUser?.role === 'student' && authUser.studentId === updatedStudent.id) {
      const nextAuth: AuthUser = { ...authUser, name: updatedStudent.name };
      setAuthUser(nextAuth);
      saveAuthSession(nextAuth);
    }
  };

  const handleSubmitStudentPermission = (req: StudentPermissionRequest) => {
    // 1. Add to student permissions list
    const nextPerms = [req, ...(state.studentPermissions || [])];

    setState(prev => ({
      ...prev,
      studentPermissions: nextPerms,
    }));

    // Cloud persistence
    syncSavePermission(req);
  };

  const handleDeleteStudentPermission = async (permitId: string) => {
    setState(prev => ({
      ...prev,
      studentPermissions: (prev.studentPermissions || []).filter(p => p.id !== permitId),
    }));
    await syncDeletePermission(permitId);
  };

  // Teacher Administration Handlers
  const handleSaveStudent = (student: StudentItem, oldStudent?: StudentItem) => {
    const priorStudent = oldStudent || state.students.find(s => s.id === student.id);
    setState(prev => {
      const idx = prev.students.findIndex(s => s.id === student.id);
      const next = [...prev.students];
      if (idx >= 0) next[idx] = student;
      else next.push(student);
      return { ...prev, students: next };
    });
    syncSaveStudent(student, priorStudent);
    showToast(`Saved student: ${student.name}`);
  };

  const handleDeleteStudent = (studentId: string) => {
    const s = state.students.find(x => x.id === studentId);
    if (!s) return;
    setConfirmModal({
      isOpen: true,
      title: 'Remove Student',
      message: 'Remove this student? This permanently deletes their Firebase login and all their information (attendance, marks, classwork, permission requests). This cannot be undone.',
      confirmLabel: 'Confirm',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await deleteStudentWithNotificationAndFullCleanup(
            s,
            state,
            msg => showToast(msg, 'info')
          );

          if (res.success) {
            setState(prev => ({
              ...prev,
              students: prev.students.filter(x => x.id !== studentId),
              attendance: res.cleanedAttendance,
              marks: res.cleanedMarks,
              classwork: res.cleanedClasswork,
              studentPermissions: (prev.studentPermissions || []).filter(p => p.studentId !== studentId),
              accountRequests: (prev.accountRequests || []).filter(r => r.studentId !== studentId),
            }));
            showToast(`Student "${s.name}" & all information permanently removed.`, 'success');
          } else {
            // Stop and explain why; Firestore data was NOT deleted
            showToast(`Deletion failed: ${res.error || 'Authentication mismatch. Firestore data was preserved.'}`, 'error');
          }
        } catch (err: any) {
          console.error('Delete student error:', err);
          showToast(`Deletion error: ${err.message || String(err)}`, 'error');
        }
      }
    });
  };

  const handleSaveClass = (cls: ClassItem) => {
    setState(prev => {
      const idx = prev.classes.findIndex(c => c.id === cls.id);
      const next = [...prev.classes];
      if (idx >= 0) next[idx] = cls;
      else next.push(cls);
      return { ...prev, classes: next };
    });
    syncSaveClass(cls);
    showToast(`Saved class: ${cls.name}`);
  };

  const handleDeleteClass = (classId: string) => {
    const cls = state.classes.find(x => x.id === classId);
    if (!cls) return;

    // Verify if there are enrolled students in this class
    const enrolledStudents = state.students.filter(s => s.classIds?.includes(classId));
    if (enrolledStudents.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Class Deletion Blocked',
        message: `Cannot delete class "${cls.name}" because it still has ${enrolledStudents.length} enrolled student(s) (e.g., ${enrolledStudents.slice(0, 3).map(s => s.name).join(', ')}${enrolledStudents.length > 3 ? '...' : ''}). Please unlink or reassign these students first.`,
        isWarning: true,
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete Class Timetable',
      message: `Are you sure you want to permanently delete class "${cls.name}"? This will remove all timetable courses, registered marks, and attendance sheets. This action cannot be undone.`,
      onConfirm: () => {
        setState(prev => ({
          ...prev,
          classes: prev.classes.filter(c => c.id !== classId),
          subjects: prev.subjects.filter(s => s.classId !== classId),
          attendance: prev.attendance.filter(a => a.classId !== classId),
          classwork: prev.classwork.filter(w => w.classId !== classId),
        }));
        syncDeleteClass(classId);
        showToast(`Class "${cls.name}" and associated sessions removed`, 'info');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleUpdateRoster = (classId: string, studentIds: string[]) => {
    const nextStudents = state.students.map(s => {
      const isEnrolled = s.classIds?.includes(classId);
      const shouldBeEnrolled = studentIds.includes(s.id);
      if (isEnrolled === shouldBeEnrolled) return s;

      const currentIds = new Set(s.classIds || []);
      if (shouldBeEnrolled) currentIds.add(classId);
      else currentIds.delete(classId);

      return {
        ...s,
        classIds: Array.from(currentIds),
      };
    });

    setState(prev => ({ ...prev, students: nextStudents }));
    syncSaveStudents(nextStudents);
    showToast('Class roster updated successfully in cloud');
  };

  const handleSaveCancellation = async (item: ClassCancellationItem) => {
    try {
      showToast('Publishing class notice to cloud...', 'info');
      await syncSaveClassNotice(item);
      // The active real-time Firestore listener automatically syncs classCancellations state.
      // Removing the manual local state update here prevents duplicate notices from being created.
      showToast('Class notice published to cloud successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to publish class notice:', err);
      showToast(`Failed to publish class notice: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleDismissCancellation = (cancellationId: string, studentId: string) => {
    setState(prev => {
      const nextCancellations = (prev.classCancellations || []).map(c => {
        if (c.id === cancellationId) {
          const dismissed = c.dismissedByStudents || [];
          if (!dismissed.includes(studentId)) {
            return { ...c, dismissedByStudents: [...dismissed, studentId] };
          }
        }
        return c;
      });
      const next: AppState = {
        ...prev,
        classCancellations: nextCancellations,
      };
      saveStoredState(next);
      return next;
    });
  };
  const handleSaveAttendance = (session: AttendanceSession) => {
    setState(prev => {
      const idx = prev.attendance.findIndex(a => a.id === session.id);
      const next = [...prev.attendance];
      if (idx >= 0) next[idx] = session;
      else next.push(session);
      return { ...prev, attendance: next };
    });
    syncSaveAttendance(session);
    showToast(`Attendance register saved for ${session.date}`);
  };

  const handleDeleteAttendanceSessions = async (sessionIds: string[]) => {
    if (!sessionIds.length) return;
    setState(prev => ({
      ...prev,
      attendance: prev.attendance.filter(a => !sessionIds.includes(a.id)),
    }));
    await Promise.all(sessionIds.map(id => syncDeleteAttendance(id)));
    showToast(`Deleted ${sessionIds.length} daily register session(s)`, 'info');
  };

  const handleApplyPermits = (
    items: {
      classId: string;
      date: string;
      studentId: string;
      status: AttendanceStatus;
      reason: string;
    }[]
  ) => {
    const attMap: Record<string, AttendanceSession> = {};
    state.attendance.forEach(a => {
      attMap[a.id] = { ...a, records: { ...a.records } };
    });

    items.forEach(item => {
      const k = attKey(item.classId, item.date);
      if (!attMap[k]) {
        attMap[k] = {
          id: k,
          classId: item.classId,
          date: item.date,
          records: {},
          savedAt: new Date().toISOString(),
        };
      }
      attMap[k].records[item.studentId] = {
        status: item.status,
        reason: item.reason,
      };
    });

    const updatedSessions = Object.values(attMap);
    setState(prev => ({
      ...prev,
      attendance: updatedSessions,
    }));

    // Cloud save updated sessions
    updatedSessions.forEach(session => {
      syncSaveAttendance(session);
    });

    showToast(`Filed ${items.length} permission excuse(s) into attendance register`);
  };

  const handleSaveSubject = (subject: SubjectItem) => {
    setState(prev => {
      const idx = prev.subjects.findIndex(s => s.id === subject.id);
      const next = [...prev.subjects];
      if (idx >= 0) next[idx] = subject;
      else next.push(subject);
      return { ...prev, subjects: next };
    });
    syncSaveSubject(subject);
    showToast(`Saved subject: ${subject.name}`);
  };

  const handleDeleteSubject = (subjectId: string) => {
    const sub = state.subjects.find(s => s.id === subjectId);
    if (!sub) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Subject',
      message: `Are you sure you want to permanently delete subject "${sub.name}"? This will remove all student scores recorded for this subject. This action cannot be undone.`,
      onConfirm: () => {
        setState(prev => ({
          ...prev,
          subjects: prev.subjects.filter(s => s.id !== subjectId),
          marks: prev.marks.filter(m => m.subjectId !== subjectId),
        }));
        syncDeleteSubject(subjectId);
        showToast(`Subject "${sub.name}" deleted`, 'info');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleUpdatePermissionStatus = async (id: string, status: 'Approved' | 'Denied') => {
    const perm = state.studentPermissions?.find(p => p.id === id);
    if (!perm) return;

    const updatedPerm: StudentPermissionRequest = {
      ...perm,
      status,
      decidedAt: new Date().toISOString(),
    };

    // Update local state
    setState(prev => ({
      ...prev,
      studentPermissions: (prev.studentPermissions || []).map(p => p.id === id ? updatedPerm : p),
    }));

    // Sync to Firestore
    await syncSavePermission(updatedPerm);

    // If Approved, automatically register as Excused in attendance register
    if (status === 'Approved') {
      const attId = attKey(perm.classId, perm.date);
      const existingSession = state.attendance.find(a => a.id === attId);
      const records = existingSession ? { ...existingSession.records } : {};

      records[perm.studentId] = {
        status: 'E' as AttendanceStatus,
        reason: perm.reason,
      };

      const updatedSession: AttendanceSession = {
        id: attId,
        classId: perm.classId,
        date: perm.date,
        records,
        savedAt: new Date().toISOString(),
      };

      setState(prev => {
        const idx = prev.attendance.findIndex(a => a.id === attId);
        const next = [...prev.attendance];
        if (idx >= 0) next[idx] = updatedSession;
        else next.push(updatedSession);
        return { ...prev, attendance: next };
      });

      await syncSaveAttendance(updatedSession);
      showToast(`Granted permission for ${state.students.find(s => s.id === perm.studentId)?.name || 'student'} and registered as Excused`, 'success');
    } else {
      showToast(`Denied permission for ${state.students.find(s => s.id === perm.studentId)?.name || 'student'}`, 'info');
    }
  };

  const handleManualPermission = async (req: StudentPermissionRequest) => {
    // 1. Save approved permission request
    setState(prev => ({
      ...prev,
      studentPermissions: [req, ...(prev.studentPermissions || [])],
    }));
    await syncSavePermission(req);

    // 2. Register as Excused in attendance register
    const attId = attKey(req.classId, req.date);
    const existing = state.attendance.find(a => a.id === attId);
    const records = existing ? { ...existing.records } : {};

    records[req.studentId] = {
      status: 'E' as AttendanceStatus,
      reason: req.reason,
    };

    const updatedSession: AttendanceSession = {
      id: attId,
      classId: req.classId,
      date: req.date,
      records,
      savedAt: new Date().toISOString(),
    };

    setState(prev => {
      const idx = prev.attendance.findIndex(a => a.id === attId);
      const next = [...prev.attendance];
      if (idx >= 0) next[idx] = updatedSession;
      else next.push(updatedSession);
      return { ...prev, attendance: next };
    });

    await syncSaveAttendance(updatedSession);
    showToast(`Successfully registered Excuse for ${state.students.find(s => s.id === req.studentId)?.name}`, 'success');
  };

  const handleSaveMarks = (
    classId: string,
    month: string,
    subjectScores: Record<string, Record<string, number>>
  ) => {
    const marksMap: Record<string, typeof state.marks[0]> = {};
    state.marks.forEach(m => {
      marksMap[m.id] = { ...m, scores: { ...m.scores } };
    });

    const toSync: MarkDoc[] = [];
    Object.entries(subjectScores).forEach(([subjectId, scores]) => {
      const id = `mk_${subjectId}_${month}`;
      const docData: MarkDoc = {
        id,
        subjectId,
        classId,
        month,
        scores,
      };
      marksMap[id] = docData;
      toSync.push(docData);
    });

    setState(prev => ({
      ...prev,
      marks: Object.values(marksMap),
    }));

    toSync.forEach(m => syncSaveMarkDoc(m));
    showToast(`Marks saved for ${month}`);
  };

  const handleSaveTask = (task: ClassworkTask) => {
    setState(prev => {
      const idx = prev.classwork.findIndex(t => t.id === task.id);
      const next = [...prev.classwork];
      if (idx >= 0) next[idx] = task;
      else next.push(task);
      return { ...prev, classwork: next };
    });
    syncSaveClassworkTask(task);
    showToast(`Task created: ${task.title}`);
  };

  const handleDeleteTask = (taskId: string) => {
    const task = state.classwork.find(t => t.id === taskId);
    if (!task) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Classwork Task',
      message: `Are you sure you want to delete the classwork task "${task.title}"? This will remove all student scores recorded for this task. This action cannot be undone.`,
      onConfirm: () => {
        setState(prev => ({
          ...prev,
          classwork: prev.classwork.filter(t => t.id !== taskId),
        }));
        syncDeleteClassworkTask(taskId);
        showToast(`Classwork task "${task.title}" removed`, 'info');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveScores = (
    classId: string,
    month: string,
    scores: Record<string, Record<string, number>>
  ) => {
    const updatedTasks: ClassworkTask[] = [];
    const nextCw = state.classwork.map(t => {
      if (t.classId === classId && t.month === month && scores[t.id]) {
        const updated = {
          ...t,
          scores: scores[t.id],
        };
        updatedTasks.push(updated);
        return updated;
      }
      return t;
    });

    setState(prev => ({ ...prev, classwork: nextCw }));
    updatedTasks.forEach(task => syncSaveClassworkTask(task));
    showToast('Classwork scores updated');
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setState(prev => ({
      ...prev,
      profile,
    }));
    syncSaveSettings(profile, state.teacherSecurity);
  };

  const handleSaveBanner = async (banner: AnnouncementBanner) => {
    try {
      showToast(`Saving banner "${banner.title}" to cloud...`, 'info');
      await syncSaveBanner(banner);
      setState(prev => {
        const idx = (prev.banners || []).findIndex(b => b.id === banner.id);
        const next = [...(prev.banners || [])];
        if (idx >= 0) next[idx] = banner;
        else next.unshift(banner);
        return { ...prev, banners: next };
      });
      showToast(`Banner "${banner.title}" saved to cloud`, 'success');
    } catch (err: any) {
      console.error('Failed to save banner:', err);
      let friendlyError = err?.message || String(err);
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          friendlyError = parsed.error;
        }
      } catch {
        // Not a JSON error
      }
      showToast(`Failed to save banner: ${friendlyError}`, 'error');
    }
  };

  const handleDeleteBanner = (bannerId: string) => {
    const ban = (state.banners || []).find(b => b.id === bannerId);
    if (!ban) return;
    setConfirmModal({
      isOpen: true,
      title: 'Remove Carousel Banner',
      message: `Are you sure you want to remove the announcement banner "${ban.title}" from the carousel?`,
      onConfirm: async () => {
        try {
          setState(prev => ({
            ...prev,
            banners: (prev.banners || []).filter(b => b.id !== bannerId),
          }));
          await syncDeleteBanner(bannerId);
          showToast('Banner removed from carousel', 'info');
        } catch (err: any) {
          console.error('Failed to delete banner:', err);
          let friendlyError = err?.message || String(err);
          try {
            const parsed = JSON.parse(err.message);
            if (parsed && parsed.error) {
              friendlyError = parsed.error;
            }
          } catch {}
          showToast(`Failed to delete banner: ${friendlyError}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveResource = async (resource: LibraryResource) => {
    try {
      showToast(`Saving resource "${resource.title}" to cloud...`, 'info');
      await syncSaveResource(resource);
      setState(prev => {
        const idx = (prev.resources || []).findIndex(r => r.id === resource.id);
        const next = [...(prev.resources || [])];
        if (idx >= 0) next[idx] = resource;
        else next.unshift(resource);
        return { ...prev, resources: next };
      });
      showToast(`Resource "${resource.title}" saved to library`, 'success');
    } catch (err: any) {
      console.error('Failed to save resource:', err);
      let friendlyError = err?.message || String(err);
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          friendlyError = parsed.error;
        }
      } catch {
        // Not a JSON error
      }
      showToast(`Failed to save resource: ${friendlyError}`, 'error');
    }
  };

  const handleDeleteResource = (resourceId: string) => {
    const res = (state.resources || []).find(r => r.id === resourceId);
    if (!res) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Library Resource',
      message: `Are you sure you want to permanently delete the resource "${res.title}" from the digital library?`,
      onConfirm: async () => {
        try {
          setState(prev => ({
            ...prev,
            resources: (prev.resources || []).filter(r => r.id !== resourceId),
          }));
          await syncDeleteResource(resourceId);
          showToast(`Resource "${res.title}" deleted from library`, 'info');
        } catch (err: any) {
          console.error('Failed to delete resource:', err);
          let friendlyError = err?.message || String(err);
          try {
            const parsed = JSON.parse(err.message);
            if (parsed && parsed.error) {
              friendlyError = parsed.error;
            }
          } catch {}
          showToast(`Failed to delete resource: ${friendlyError}`, 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // If not logged in -> render Login View
  if (!authUser) {
    return (
      <>
        <LoginView
          state={state}
          onLoginSuccess={handleLoginSuccess}
          onUpdateTeacherPassword={handleUpdateTeacherPassword}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          firestoreStatus={firestoreStatus}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // If logged in as Student -> render dedicated Student Portal View
  if (authUser.role === 'student' && authUser.studentId) {
    return (
      <>
        {activeWallpaper ? (
          activeWallpaper.includes('video') || activeWallpaper.startsWith('data:video') ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="fixed inset-0 -z-20 pointer-events-none w-screen h-screen object-cover"
              src={activeWallpaper}
            />
          ) : (
            <div
              className="fixed inset-0 -z-20 pointer-events-none w-screen h-screen bg-cover bg-center"
              style={{ backgroundImage: `url(${activeWallpaper})` }}
            />
          )
        ) : null}
        <StudentPortalView
          state={state}
          studentId={authUser.studentId}
          onLogout={handleLogout}
          onUpdateStudent={handleUpdateStudentFromPortal}
          onSubmitPermission={handleSubmitStudentPermission}
          onDeletePermission={handleDeleteStudentPermission}
          onDismissCancellation={handleDismissCancellation}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onShowToast={showToast}
          firestoreStatus={firestoreStatus}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Logged in as Teacher: Full Administration View
  return (
    <>
      {activeWallpaper ? (
        activeWallpaper.includes('video') || activeWallpaper.startsWith('data:video') ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="fixed inset-0 -z-20 pointer-events-none w-screen h-screen object-cover"
            src={activeWallpaper}
          />
        ) : (
          <div
            className="fixed inset-0 -z-20 pointer-events-none w-screen h-screen bg-cover bg-center"
            style={{ backgroundImage: `url(${activeWallpaper})` }}
          />
        )
      ) : null}
      <div className="min-h-screen flex bg-[#F8F9FA] dark:bg-[#0C0C0C] text-slate-900 dark:text-white transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView === 'student-profile' ? 'students' : currentView}
        onNavigate={setCurrentView}
        profile={state.profile}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onBackup={() => {
          exportBackupJSON(state);
          showToast('JSON backup exported', 'success');
        }}
        onLogout={handleLogout}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        studentCount={state.students.length}
        classCount={state.classes.length}
        pendingPermissionCount={(state.studentPermissions || []).filter(p => p.status === 'Pending').length}
        noticeCount={state.classCancellations?.length || 0}
        unreadHomeworkCount={(state.teacherNotifications || []).filter(n => n.type === 'homework_submitted' && !n.read).length}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          currentView={currentView === 'student-profile' ? 'students' : currentView}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onLogout={handleLogout}
          firestoreStatus={firestoreStatus}
          isCloudSyncing={isCloudSyncing}
        />

        <main className="flex-1 p-3 sm:p-5 lg:p-7 overflow-y-auto">
            {currentView === 'dash' && (
              <OverviewView
                state={state}
                onNavigate={setCurrentView}
                onSelectClass={setSelectedClassId}
                onTakeAttendance={classId => {
                  setSelectedClassId(classId);
                  setCurrentView('attend');
                }}
                onSaveStudent={handleSaveStudent}
                onShowToast={showToast}
              />
            )}

            {currentView === 'student-profile' && selectedStudentProfileId && (
              <StudentProfileView
                state={state}
                studentId={selectedStudentProfileId}
                initialTab={selectedStudentProfileTab}
                onBack={() => setCurrentView('students')}
                onSaveStudent={handleSaveStudent}
                onDeleteStudent={handleDeleteStudent}
                onNavigate={setCurrentView}
                onShowToast={showToast}
              />
            )}

            {currentView === 'library' && (
              <ResourceLibraryView
                state={state}
                isTeacher={true}
                onSaveBanner={handleSaveBanner}
                onDeleteBanner={handleDeleteBanner}
                onSaveResource={handleSaveResource}
                onDeleteResource={handleDeleteResource}
                onShowToast={showToast}
                selectedClassId={selectedClassId}
              />
            )}

            {currentView === 'students' && (
              <StudentsView
                state={state}
                onSaveStudent={handleSaveStudent}
                onDeleteStudent={handleDeleteStudent}
                selectedClassId={selectedClassId}
                onNavigate={setCurrentView}
                onShowToast={showToast}
                onOpenStudentProfile={id => {
                  setSelectedStudentProfileId(id);
                  setSelectedStudentProfileTab('overview');
                  setCurrentView('student-profile');
                }}
              />
            )}

            {currentView === 'classes' && (
              <ClassesView
                state={state}
                onSaveClass={handleSaveClass}
                onDeleteClass={handleDeleteClass}
                onUpdateRoster={handleUpdateRoster}
                onNavigate={setCurrentView}
              />
            )}

            {currentView === 'attend' && (
              <AttendanceView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onSaveAttendance={handleSaveAttendance}
                onSaveCancellation={handleSaveCancellation}
              />
            )}

            {currentView === 'attreport' && (
              <AttendanceReportView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onSaveAttendance={handleSaveAttendance}
                onDeleteAttendanceSessions={handleDeleteAttendanceSessions}
              />
            )}

            {currentView === 'permits' && (
              <PermitsView
                state={state}
                onApplyPermits={handleApplyPermits}
                onUpdatePermissionStatus={handleUpdatePermissionStatus}
                onAddManualPermission={handleManualPermission}
              />
            )}

            {currentView === 'notices' && (
              <NoticesView
                state={state}
                onShowToast={showToast}
              />
            )}

            {currentView === 'activity' && (
              <TeacherActivityView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onShowToast={showToast}
              />
            )}

            {currentView === 'subjects' && (
              <SubjectsView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onSaveSubject={handleSaveSubject}
                onDeleteSubject={handleDeleteSubject}
                onSaveMarks={handleSaveMarks}
              />
            )}

            {currentView === 'classwork' && (
              <ClassworkView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onSaveTask={handleSaveTask}
                onDeleteTask={handleDeleteTask}
                onSaveScores={handleSaveScores}
              />
            )}

            {currentView === 'results' && (
              <RankingView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onShowToast={showToast}
              />
            )}

            {currentView === 'report' && (
              <ResultBrowserView
                state={state}
                selectedClassId={selectedClassId}
                onSelectClassId={setSelectedClassId}
                onShowToast={showToast}
              />
            )}

            {currentView === 'import' && (
              <ImportView
                state={state}
                onApplyImport={newState => {
                  setState(newState);
                  saveStoredState(newState);
                }}
                onShowToast={showToast}
              />
            )}

            {currentView === 'profile' && (
              <ProfileView
                profile={state.profile}
                students={state.students}
                onSaveProfile={handleSaveProfile}
                onUpdatePassword={newPass => handleUpdateTeacherPassword(newPass, state.profile.name || 'Soth Sothea (Albe)')}
                onShowToast={showToast}
              />
            )}

            {currentView === 'adventure' && (
              <AdventurerModeView
                state={state}
                onShowToast={showToast}
              />
            )}
          </main>

          {/* Global Quick Search (⌘K Command Palette) */}
          <CommandPalette
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            state={state}
            onNavigate={setCurrentView}
            onSelectStudent={(stu, tab) => {
              setSelectedStudentProfileId(stu.id);
              if (tab) setSelectedStudentProfileTab(tab as any);
              else setSelectedStudentProfileTab('overview');
              setCurrentView('student-profile');
            }}
            onSelectClass={classId => {
              setSelectedClassId(classId);
            }}
          />

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onNavigate={setCurrentView}
            profile={state.profile}
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
            onBackup={() => {
              exportBackupJSON(state);
              showToast('JSON backup exported successfully', 'success');
            }}
            onLogout={handleLogout}
          />

          {/* Custom Deletion / Warning Confirmation Modal */}
          <Modal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            title={confirmModal.title}
            footer={
              confirmModal.isWarning ? (
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Understood
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmModal.onConfirm}
                    className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm shadow-rose-500/20 active:scale-95"
                  >
                    {confirmModal.confirmLabel || 'Confirm'}
                  </button>
                </>
              )
            }
          >
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {confirmModal.message}
            </p>
          </Modal>

          {/* Toast Notification Container */}
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      </div>
    </>
  );
}



