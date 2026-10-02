import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Layers,
  GraduationCap,
  Trophy,
  CheckSquare,
  Clock,
  KeyRound,
  FileSpreadsheet,
  BookOpen,
  ArrowRightLeft,
  Camera,
  AlertTriangle,
  UserX,
  FileText,
  Award,
  Sparkles,
} from 'lucide-react';
import { AppState, StudentItem, ClassItem, AttendanceStatus } from '../types';
import {
  getPunctualityWarning,
  getAttendanceCredit,
  isSessionAfterEnrollment,
  gradeOf,
  round1,
  thisMonth,
} from '../utils/helpers';
import {
  provisionStudentAuthAccount,
  unsyncStudentAuthAccount,
  unsyncStudentWithNotification,
} from '../utils/firestoreSync';
import { Modal } from '../components/Modal';

interface StudentProfileViewProps {
  state: AppState;
  studentId: string;
  initialTab?: 'overview' | 'academics' | 'attendance' | 'classes' | 'portal';
  onBack: () => void;
  onSaveStudent: (student: StudentItem, oldStudent?: StudentItem) => void;
  onDeleteStudent: (studentId: string) => void;
  onNavigate: (view: any) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  state,
  studentId,
  initialTab = 'overview',
  onBack,
  onSaveStudent,
  onDeleteStudent,
  onNavigate,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'attendance' | 'classes' | 'portal'>(initialTab);

  // Modals inside Profile View
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoveClassModalOpen, setIsMoveClassModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUnsyncModalOpen, setIsUnsyncModalOpen] = useState(false);
  const [isSyncingPortal, setIsSyncingPortal] = useState(false);

  // Edit form state
  const student = state.students.find(s => s.id === studentId);

  const [formName, setFormName] = useState(student?.name || '');
  const [formStudentNo, setFormStudentNo] = useState(student?.studentNo || '');
  const [formSex, setFormSex] = useState(student?.gender || student?.sex || '');
  const [formDob, setFormDob] = useState(student?.dateOfBirth || student?.dob || '');
  const [formPhone, setFormPhone] = useState(student?.phone || '');
  const [formGuardian, setFormGuardian] = useState(student?.parentName || student?.guardian || '');
  const [formAddress, setFormAddress] = useState(student?.address || '');
  const [formNote, setFormNote] = useState(student?.note || '');
  const [formPassword, setFormPassword] = useState(student?.password || '');
  const [formClassIds, setFormClassIds] = useState<string[]>(student?.classIds || []);

  // Move / Change class modal state
  const [targetClassIds, setTargetClassIds] = useState<string[]>(student?.classIds || []);

  if (!student) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Student Not Found</h3>
        <p className="text-sm text-slate-500">The requested student record could not be found or has been removed.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
        >
          Return to Student Directory
        </button>
      </div>
    );
  }

  // Calculate student academic rankings and subject marks across all classes
  const academicSummary = useMemo(() => {
    let totalScore = 0;
    let maxScore = 0;
    const subjectBreakdown: Array<{
      subjectName: string;
      score: number;
      max: number;
      className: string;
      percentage: number;
    }> = [];

    state.subjects.forEach(subj => {
      // Find mark docs for this subject
      const markDocs = state.marks.filter(m => m.subjectId === subj.id);
      markDocs.forEach(md => {
        if (md.scores && md.scores[student.id] !== undefined) {
          const score = md.scores[student.id];
          totalScore += score;
          maxScore += subj.max || 100;
          const cls = state.classes.find(c => c.id === subj.classId);
          subjectBreakdown.push({
            subjectName: subj.name,
            score,
            max: subj.max || 100,
            className: cls?.name || 'Class',
            percentage: Math.round((score / (subj.max || 100)) * 100),
          });
        }
      });
    });

    // Classwork tasks
    const classworkBreakdown: Array<{
      title: string;
      type: string;
      score: number;
      max: number;
      date: string;
      className: string;
    }> = [];

    state.classwork.forEach(task => {
      if (task.scores && task.scores[student.id] !== undefined) {
        const cls = state.classes.find(c => c.id === task.classId);
        classworkBreakdown.push({
          title: task.title,
          type: task.type,
          score: task.scores[student.id],
          max: task.max || 100,
          date: task.date,
          className: cls?.name || 'Class',
        });
      }
    });

    const overallPct = maxScore > 0 ? round1((totalScore / maxScore) * 100) : null;
    const grade = overallPct !== null ? gradeOf(overallPct) : '—';

    return {
      totalScore,
      maxScore,
      overallPct,
      grade,
      subjectBreakdown,
      classworkBreakdown,
    };
  }, [state.subjects, state.marks, state.classwork, state.classes, student.id]);

  // Calculate Attendance History
  const attendanceHistory = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let unexcusedCount = 0;
    let totalCredit = 0;
    const historyList: Array<{
      date: string;
      status: AttendanceStatus;
      reason?: string;
      className: string;
      minutesLate?: number;
      credit: number;
    }> = [];

    state.attendance.forEach(session => {
      if (!isSessionAfterEnrollment(session.date, student)) return;
      const rec = session.records?.[student.id];
      if (rec && rec.status) {
        const cls = state.classes.find(c => c.id === session.classId);
        const duration = cls?.duration || 60;
        const credit = getAttendanceCredit(rec, duration);
        totalCredit += credit;

        if (rec.status === 'P') presentCount++;
        else if (rec.status === 'L') lateCount++;
        else if (rec.status === 'E') excusedCount++;
        else if (rec.status === 'U') unexcusedCount++;

        historyList.push({
          date: session.date,
          status: rec.status,
          reason: rec.reason,
          minutesLate: rec.minutesLate,
          className: cls?.name || 'Class',
          credit,
        });
      }
    });

    historyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalSessions = presentCount + lateCount + excusedCount + unexcusedCount;
    const rate = totalSessions > 0 ? round1((totalCredit / totalSessions) * 100) : null;

    return {
      presentCount,
      lateCount,
      excusedCount,
      unexcusedCount,
      totalSessions,
      totalCredit: round1(totalCredit),
      rate,
      historyList,
    };
  }, [state.attendance, state.classes, student]);

  // Enrolled Classes
  const enrolledClasses = useMemo(() => {
    return (student.classIds || [])
      .map(cid => state.classes.find(c => c.id === cid))
      .filter(Boolean) as ClassItem[];
  }, [student.classIds, state.classes]);

  // Handle Edit Save
  const handleSaveEdit = () => {
    const updated: StudentItem = {
      ...student,
      name: formName.trim() || student.name,
      loginName: formName.trim() || student.loginName || student.name,
      studentNo: formStudentNo.trim() || student.studentNo,
      sex: formSex || student.sex,
      gender: formSex || student.gender || student.sex,
      dob: formDob || student.dob,
      dateOfBirth: formDob || student.dateOfBirth || student.dob,
      phone: formPhone.trim() || student.phone,
      guardian: formGuardian.trim() || student.parentName || student.guardian,
      parentName: formGuardian.trim() || student.parentName || student.guardian,
      address: formAddress.trim() || student.address,
      note: formNote.trim() || student.note,
      password: formPassword.trim() || student.password,
      classIds: formClassIds,
    };
    onSaveStudent(updated, student);
    onShowToast(`Updated profile for ${updated.name}`, 'success');
    setIsEditModalOpen(false);
  };

  // Handle Class Move / Transfer (Permanent Historical Data Preservation)
  const handleConfirmMoveClass = () => {
    const updated: StudentItem = {
      ...student,
      classIds: targetClassIds,
    };
    onSaveStudent(updated, student);
    onShowToast(`Class enrollment updated. All historical scores and attendance remain permanently preserved.`, 'success');
    setIsMoveClassModalOpen(false);
  };

  // Handle Portal Sync Toggle
  const handleTogglePortalSync = async () => {
    if (student.authUid) {
      // Unsync -> show confirmation dialog first
      setIsUnsyncModalOpen(true);
      return;
    }

    // Sync
    setIsSyncingPortal(true);
    try {
      const res = await provisionStudentAuthAccount(student);
      if (res.status === 'created' || res.status === 'linked_existing') {
        const updated = { ...student, authUid: res.uid, authEmail: res.email };
        onSaveStudent(updated, student);
        onShowToast(`Portal account provisioned: ${res.email}`, 'success');
      } else {
        onShowToast(`Sync error: ${res.error || 'Failed'}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Portal action failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSyncingPortal(false);
    }
  };

  const handleConfirmUnsync = async () => {
    setIsUnsyncModalOpen(false);
    setIsSyncingPortal(true);
    onShowToast('Notifying student…', 'info');
    try {
      const res = await unsyncStudentWithNotification(
        student,
        msg => onShowToast(msg, 'info')
      );
      if (res.success) {
        const updated = { ...student, authUid: undefined, authEmail: undefined, accountStatus: null };
        onSaveStudent(updated, student);
        onShowToast(`Portal account unsynced. Roster & marks remain 100% intact.`, 'info');
      } else {
        onShowToast(`Unsync failed: ${res.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Unsync error: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSyncingPortal(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] border border-slate-200/80 dark:border-[#2a2a2a] transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Student Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMoveClassModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-xs"
            title="Move or promote student to another class without losing any past records"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Move / Change Class</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormName(student.name);
              setFormStudentNo(student.studentNo || '');
              setFormSex(student.sex || '');
              setFormDob(student.dob || '');
              setFormPhone(student.phone || '');
              setFormGuardian(student.parentName || student.guardian || '');
              setFormAddress(student.address || '');
              setFormNote(student.note || '');
              setFormPassword(student.password || '');
              setFormClassIds(student.classIds || []);
              setIsEditModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#1c1c1c] hover:bg-slate-100 dark:hover:bg-[#242424] border border-slate-200 dark:border-[#333] transition-all cursor-pointer shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-all cursor-pointer shadow-xs"
            title="Delete Student"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline ml-1">Remove Student</span>
          </button>
        </div>
      </div>

      {/* Hero Profile Header Card */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200/90 dark:border-[#262626] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="relative group">
              {student.photo ? (
                <img
                  src={student.photo}
                  alt={student.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-slate-100 dark:ring-[#202020] shadow-md"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
                  {student.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Main Identity */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {student.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#303030]">
                  {student.studentNo || student.id}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  student.sex === 'Female'
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                }`}>
                  {student.sex || 'Student'}
                </span>

                {/* Punctuality Warning Badge */}
                {(() => {
                  const warning = getPunctualityWarning(student.id, thisMonth(), state);
                  if (!warning) return null;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-xs animate-in fade-in duration-200 ${warning.badgeClass}`}
                      title={warning.description}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{warning.label} ({warning.count} Lates)</span>
                    </span>
                  );
                })()}

                {/* Activity & Exam Achievement Badges */}
                {(state.studentBadges || []).filter(b => b.studentId === student.id).map(badge => (
                  <span
                    key={badge.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                    title={badge.description}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>{badge.title}</span>
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{student.phone}</span>
                  </span>
                )}
                {student.guardian && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Guardian: {student.guardian}</span>
                  </span>
                )}
                {student.dob && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>DOB: {student.dob}</span>
                  </span>
                )}
              </div>

              {/* Class Enrollments */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400">Current Classes:</span>
                {enrolledClasses.length > 0 ? (
                  enrolledClasses.map(c => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50"
                    >
                      {c.name} {c.level ? `(${c.level})` : ''}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-amber-500 font-medium">No class assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Portal Authentication Card */}
          <div className="w-full md:w-auto p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200/80 dark:border-[#2a2a2a] flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  student.authUid
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {student.authUid ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  <span>{student.authUid ? 'Portal Synced' : 'Portal Missing'}</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                {student.authEmail || (student.studentNo ? `${student.studentNo.toLowerCase()}@centralacademy.app` : 'No email assigned')}
              </p>
            </div>

            <button
              type="button"
              disabled={isSyncingPortal}
              onClick={handleTogglePortalSync}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                student.authUid
                  ? 'bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {student.authUid ? <UserX className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{isSyncingPortal ? 'Processing…' : student.authUid ? 'Unsync Portal' : 'Sync to Portal'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-[#202020] mt-6 pt-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview & Bio', icon: User },
            { id: 'academics', label: 'Scores & Results', icon: Trophy },
            { id: 'attendance', label: 'Attendance History', icon: CheckSquare },
            { id: 'classes', label: 'Classes & History', icon: Layers },
            { id: 'portal', label: 'Portal Security & Auth', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1c1c1c]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & BIO */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Quick Metrics */}
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> Attendance Rate
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {attendanceHistory.rate !== null ? `${attendanceHistory.rate}%` : '—'}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">
                {attendanceHistory.totalSessions > 0
                  ? `${attendanceHistory.presentCount} present of ${attendanceHistory.totalSessions} sessions`
                  : 'No sessions held yet'}
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> Academic Average
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {academicSummary.overallPct !== null ? `${academicSummary.overallPct}%` : '—'}
              </p>
              <span className="text-[11px] text-amber-600 font-medium">
                {academicSummary.maxScore > 0
                  ? `Grade: ${academicSummary.grade} (${academicSummary.totalScore}/${academicSummary.maxScore} pts)`
                  : 'No graded records yet'}
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" /> Enrolled Classes
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {enrolledClasses.length}
              </p>
              <span className="text-[11px] text-indigo-600 font-medium">
                Active classroom courses
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-500" /> Portal Password
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                {student.password || 'None'}
              </p>
              <span className="text-[11px] text-purple-600 font-medium">
                Student View unlock key
              </span>
            </div>
          </div>

          {/* Student Bio & Personal Record */}
          <div className="md:col-span-2 bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <span>Personal Profile & Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Full Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{student.name}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Student ID / Number</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100 text-sm">{student.studentNo || student.id}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Gender</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{student.sex || 'Not specified'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Date of Birth</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{student.dob || 'Not specified'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Phone / Telegram Contact</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{student.phone || 'No phone recorded'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                <span className="text-slate-400 font-medium block">Parent / Guardian</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{student.parentName || student.guardian || 'No guardian recorded'}</span>
              </div>
            </div>

            {student.address && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] text-xs">
                <span className="text-slate-400 font-medium block">Home Address</span>
                <span className="text-slate-800 dark:text-slate-200">{student.address}</span>
              </div>
            )}

            {student.note && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs">
                <span className="text-blue-700 dark:text-blue-300 font-bold block mb-1">Instructor Notes & Learning Goals:</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{student.note}</p>
              </div>
            )}
          </div>

          {/* Quick Class Summary Card */}
          <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Current Enrollments</span>
            </h3>

            <div className="space-y-2.5">
              {enrolledClasses.map(c => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424]">
                  <p className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.level || 'Standard'} &bull; {c.days || 'Regular'} &bull; {c.room || 'Room A'}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsMoveClassModalOpen(true)}
              className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold transition-all border border-indigo-200 dark:border-indigo-800"
            >
              Promote or Transfer Class &rarr;
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SCORES & ACADEMIC RESULTS */}
      {activeTab === 'academics' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Subject Exam Marks & Weighted Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">All assessments recorded for this student</p>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Overall: {academicSummary.overallPct}% ({academicSummary.grade})
              </span>
            </div>

            {academicSummary.subjectBreakdown.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No exam or subject marks recorded yet for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-[#181818] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-2.5 rounded-l-xl">Subject</th>
                      <th className="px-4 py-2.5">Class</th>
                      <th className="px-4 py-2.5">Score</th>
                      <th className="px-4 py-2.5">Max</th>
                      <th className="px-4 py-2.5">Percentage</th>
                      <th className="px-4 py-2.5 rounded-r-xl">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#202020]">
                    {academicSummary.subjectBreakdown.map((sb, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-[#181818]">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{sb.subjectName}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{sb.className}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{sb.score}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono">{sb.max}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{sb.percentage}%</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            sb.percentage >= 80
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : sb.percentage >= 50
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {sb.percentage >= 80 ? 'Distinction' : sb.percentage >= 50 ? 'Passing' : 'Needs Support'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Classwork & Projects */}
          <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Classwork, Homework & Project Tasks</span>
            </h3>

            {academicSummary.classworkBreakdown.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No classwork or assignment submissions recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {academicSummary.classworkBreakdown.map((cw, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{cw.title}</span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{cw.score}/{cw.max}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Type: {cw.type} &bull; Date: {cw.date}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY */}
      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                <span>Complete Attendance History Log</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chronological attendance sessions and excuses recorded in register</p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                P: {attendanceHistory.presentCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                L: {attendanceHistory.lateCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                E: {attendanceHistory.excusedCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                U: {attendanceHistory.unexcusedCount}
              </span>
            </div>
          </div>

          {attendanceHistory.historyList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No attendance sessions logged for this student yet.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-[#181818] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Class</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Notes / Excuse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#202020]">
                  {attendanceHistory.historyList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-[#181818]">
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200">{item.date}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{item.className}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          item.status === 'P'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.status === 'L'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : item.status === 'E'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          {item.status === 'P' ? 'Present' : item.status === 'L' ? 'Late' : item.status === 'E' ? 'Excused' : 'Unexcused'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{item.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CLASSES & HISTORY */}
      {activeTab === 'classes' && (
        <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Classroom Associations & History</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current and historical class enrollments. Changing classes maintains all past academic logs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMoveClassModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Change or Promote Class</span>
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {enrolledClasses.map(c => (
              <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Level: {c.level || 'Standard'} &bull; Days: {c.days || 'Mon–Fri'} &bull; Room: {c.room || 'General'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Active Enrolled
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PORTAL SECURITY & AUTHENTICATION */}
      {activeTab === 'portal' && (
        <div className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span>Student Portal Security & Firebase Auth Credentials</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] space-y-1">
              <span className="text-slate-400 font-medium block">Portal Auth Email</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">
                {student.authEmail || (student.studentNo ? `${student.studentNo.toLowerCase()}@centralacademy.app` : 'Not provisioned')}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] space-y-1">
              <span className="text-slate-400 font-medium block">Firebase Auth UID</span>
              <span className="font-mono text-slate-600 dark:text-slate-300 text-xs">
                {student.authUid || 'No Auth record in Firebase'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] space-y-1">
              <span className="text-slate-400 font-medium block">Stored Portal Password</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">
                {student.password || 'None'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-100 dark:border-[#242424] space-y-1">
              <span className="text-slate-400 font-medium block">Account Sync Status</span>
              <span className={`font-bold ${student.authUid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {student.authUid ? '✓ Verified Active in Cloud' : '⚠ Missing from Firebase Auth'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#202020] flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Syncing creates a real Firebase Authentication account for this student. Unsyncing removes only their login access.
            </p>
            <button
              type="button"
              disabled={isSyncingPortal}
              onClick={handleTogglePortalSync}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                student.authUid
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {student.authUid ? <UserX className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{isSyncingPortal ? 'Processing…' : student.authUid ? 'Unsync Portal Access' : 'Sync to Portal Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Profile: ${student.name}`}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Student ID / No</label>
              <input
                type="text"
                value={formStudentNo}
                onChange={e => setFormStudentNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
              <select
                value={formSex}
                onChange={e => setFormSex(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
              >
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
              <input
                type="date"
                value={formDob}
                onChange={e => setFormDob(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone / Telegram</label>
              <input
                type="text"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Parent / Guardian</label>
            <input
              type="text"
              value={formGuardian}
              onChange={e => setFormGuardian(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Student Portal Password</label>
            <input
              type="text"
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Instructor Notes</label>
            <textarea
              rows={2}
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* MOVE / CHANGE CLASS MODAL */}
      <Modal
        isOpen={isMoveClassModalOpen}
        onClose={() => setIsMoveClassModalOpen(false)}
        title={`Move or Promote Student: ${student.name}`}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsMoveClassModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMoveClass}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              Confirm Class Enrollment
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
            <span className="font-bold block mb-1">Safe Class Transfer & Promotion:</span>
            <p className="text-[11px] leading-relaxed">
              Moving this student to a different class will never delete or wipe their historical attendance or exam records. All past scores remain tied to their student ID permanently.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Select Enrolled Classes:
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-[#262626] rounded-xl p-2 bg-slate-50/50 dark:bg-[#181818]">
              {state.classes.map(c => {
                const isSelected = targetClassIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-[#202020] text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setTargetClassIds(prev => [...prev, c.id]);
                          } else {
                            setTargetClassIds(prev => prev.filter(id => id !== c.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{c.level || 'Standard'}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* UNSYNC CONFIRMATION MODAL */}
      <Modal
        isOpen={isUnsyncModalOpen}
        onClose={() => setIsUnsyncModalOpen(false)}
        title="Unsync Student Login"
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUnsyncModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUnsync}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm"
            >
              Confirm
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold block mb-1">Unsync Student Account</span>
            <p className="text-[11px] leading-relaxed">
              Unsync this student? This removes their Firebase login account. All their information (profile, attendance, marks, classwork, requests) stays in the app.
            </p>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Remove Student"
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                onDeleteStudent(student.id);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
            >
              Confirm
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200">
            <span className="font-bold block mb-1">Permanent Record Removal</span>
            <p className="text-[11px] leading-relaxed">
              Remove this student? This permanently deletes their Firebase login and all their information (attendance, marks, classwork, permission requests). This cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
