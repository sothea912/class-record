import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  Lock,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Camera,
  X,
  KeyRound,
  FileUp,
  Clock3,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { AppState, StudentItem } from '../types';
import { getPunctualityWarning, sortStudents, thisMonth, uid } from '../utils/helpers';
import { Modal } from '../components/Modal';
import {
  resetStudentPasswordByTeacher,
  provisionStudentAuthAccount,
  unsyncStudentAuthAccount,
  unsyncStudentWithNotification,
} from '../utils/firestoreSync';

interface StudentsViewProps {
  state: AppState;
  onSaveStudent: (student: StudentItem, oldStudent?: StudentItem) => void;
  onDeleteStudent: (studentId: string) => void;
  selectedClassId: string;
  onNavigate?: (view: any) => void;
  onOpenStudentProfile?: (studentId: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  state,
  onSaveStudent,
  onDeleteStudent,
  selectedClassId,
  onNavigate,
  onOpenStudentProfile,
}) => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>(selectedClassId || '');
  const [sexFilter, setSexFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');

  const handleGrantPasswordReset = (student: StudentItem) => {
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const updated: StudentItem = {
      ...student,
      passwordResetStatus: 'granted',
      passwordResetExpiresAt: expires,
    };
    onSaveStudent(updated);
  };

  const handleRevokePasswordReset = (student: StudentItem) => {
    const updated: StudentItem = {
      ...student,
      passwordResetStatus: 'none',
      passwordResetExpiresAt: undefined,
    };
    onSaveStudent(updated);
  };

  // Reset Password Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStudentTarget, setResetStudentTarget] = useState<StudentItem | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);

  const openResetPasswordModal = (s: StudentItem) => {
    setResetStudentTarget(s);
    setResetNewPassword(s.password || `${1000 + Math.floor(Math.random() * 9000)}`);
    setIsResetModalOpen(true);
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStudentTarget || !resetNewPassword.trim()) return;

    setIsResetLoading(true);
    try {
      await resetStudentPasswordByTeacher(resetStudentTarget.id, resetNewPassword.trim());
      onSaveStudent({
        ...resetStudentTarget,
        password: resetNewPassword.trim(),
      }, resetStudentTarget);
      alert(`Password for ${resetStudentTarget.name} has been updated to: ${resetNewPassword.trim()}. The student can now log into their portal with this password.`);
      setIsResetModalOpen(false);
    } catch (err: any) {
      alert(`Failed to reset password: ${err.message || String(err)}`);
    } finally {
      setIsResetLoading(false);
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [autoSyncOnEnroll, setAutoSyncOnEnroll] = useState(true);
  const [isModalSyncing, setIsModalSyncing] = useState(false);
  const [modalSyncFeedback, setModalSyncFeedback] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formStudentNo, setFormStudentNo] = useState('');
  const [formSex, setFormSex] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGuardian, setFormGuardian] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [formPhoto, setFormPhoto] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingStudent(null);
    setModalSyncFeedback(null);
    setAutoSyncOnEnroll(true);
    setFormName('');
    setFormStudentNo(`STU-${1000 + state.students.length + 1}`);
    setFormSex('');
    setFormDob('');
    setFormPhone('');
    setFormGuardian('');
    setFormAddress('');
    setFormNote('');
    setFormPassword(`${1000 + state.students.length + 1}`);
    setFormClassIds(selectedClassId ? [selectedClassId] : state.classes.length ? [state.classes[0].id] : []);
    setFormPhoto(null);
    setIsModalOpen(true);
  };

  const openEditModal = (s: StudentItem) => {
    setEditingStudent(s);
    setModalSyncFeedback(null);
    setFormName(s.name);
    setFormStudentNo(s.studentNo || '');
    setFormSex(s.sex || '');
    setFormDob(s.dob || '');
    setFormPhone(s.phone || '');
    setFormGuardian(s.guardian || '');
    setFormAddress(s.address || '');
    setFormNote(s.note || '');
    setFormPassword(s.password || '');
    setFormClassIds(s.classIds || []);
    setFormPhoto(s.photo || null);
    setIsModalOpen(true);
  };

  const handleModalSyncStudent = async () => {
    if (!editingStudent) return;
    setIsModalSyncing(true);
    setModalSyncFeedback(null);
    try {
      const currentObj: StudentItem = {
        ...editingStudent,
        name: formName.trim() || editingStudent.name,
        studentNo: formStudentNo.trim() || editingStudent.studentNo,
        password: formPassword.trim() || editingStudent.password,
        classIds: formClassIds,
      };
      const res = await provisionStudentAuthAccount(currentObj);
      if (res.status === 'created' || res.status === 'linked_existing') {
        const updated = { ...currentObj, authUid: res.uid, authEmail: res.email };
        setEditingStudent(updated);
        onSaveStudent(updated, editingStudent);
        setModalSyncFeedback(`Synced (${res.email})`);
      } else {
        setModalSyncFeedback(`Sync error: ${res.error || 'Failed'}`);
      }
    } catch (err: any) {
      setModalSyncFeedback(`Sync failed: ${err.message || String(err)}`);
    } finally {
      setIsModalSyncing(false);
    }
  };

  const [isUnsyncConfirmOpen, setIsUnsyncConfirmOpen] = useState(false);

  const handleModalUnsyncStudent = () => {
    if (!editingStudent) return;
    setIsUnsyncConfirmOpen(true);
  };

  const handleExecuteUnsyncStudent = async () => {
    if (!editingStudent) return;
    setIsUnsyncConfirmOpen(false);
    setIsModalSyncing(true);
    setModalSyncFeedback('Notifying student…');
    try {
      const res = await unsyncStudentWithNotification(editingStudent, msg => {
        setModalSyncFeedback(msg);
      });
      if (res.success) {
        const updated = { ...editingStudent, authUid: undefined, authEmail: undefined, accountStatus: null };
        setEditingStudent(updated);
        onSaveStudent(updated, editingStudent);
        setModalSyncFeedback(`Unsynced: Portal login removed. All student information kept.`);
      } else {
        setModalSyncFeedback(`Unsync error: ${res.error || 'Failed'}`);
      }
    } catch (err: any) {
      setModalSyncFeedback(`Unsync failed: ${err.message || String(err)}`);
    } finally {
      setIsModalSyncing(false);
    }
  };

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
          setFormPhoto(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => {
    if (!formName.trim()) {
      alert('Please enter the student full name');
      return;
    }
    const studentObj: StudentItem = {
      id: editingStudent ? editingStudent.id : uid('stu'),
      name: formName.trim(),
      studentNo: formStudentNo.trim(),
      sex: formSex,
      dob: formDob,
      phone: formPhone.trim(),
      guardian: formGuardian.trim(),
      address: formAddress.trim(),
      note: formNote.trim(),
      password: formPassword.trim(),
      classIds: formClassIds,
      photo: formPhoto,
      authUid: editingStudent?.authUid,
      authEmail: editingStudent?.authEmail,
    };
    onSaveStudent(studentObj, editingStudent || undefined);

    if (!editingStudent && autoSyncOnEnroll) {
      provisionStudentAuthAccount(studentObj).then(res => {
        if (res.uid) {
          onSaveStudent({ ...studentObj, authUid: res.uid, authEmail: res.email }, studentObj);
        }
      }).catch(err => {
        console.warn('Auto-sync on enroll notice:', err);
      });
    }

    setIsModalOpen(false);
  };

  // Filter students
  let filtered = state.students;
  if (classFilter) {
    filtered = filtered.filter(s => s.classIds && s.classIds.includes(classFilter));
  }
  if (sexFilter) {
    filtered = filtered.filter(s => s.sex === sexFilter);
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.studentNo && s.studentNo.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }

  const sorted = sortStudents(filtered, sortBy);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by student name, ID or phone…"
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action & View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('gallery')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'gallery'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Gallery Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('import')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <FileUp className="w-4 h-4 text-blue-500" />
                <span>Import JSON</span>
              </button>
            )}

            {/* Add Student Button */}
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/25 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll New Student</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Class:</span>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="">All Classes ({state.students.length})</option>
              {state.classes.map(c => {
                const count = state.students.filter(s => s.classIds?.includes(c.id)).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Gender:</span>
            <select
              value={sexFilter}
              onChange={e => setSexFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="name">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="no">Student ID</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400 text-xs font-medium">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{sorted.length}</span> students
          </div>
        </div>
      </div>

      {/* Students View */}
      {sorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No students match your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria, clearing filters, or enroll a new student.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            Enroll Student
          </button>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(s => {
            const classNames = (s.classIds || [])
              .map(cid => state.classes.find(c => c.id === cid)?.name)
              .filter(Boolean);

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Avatar and Top Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => onOpenStudentProfile?.(s.id)}
                      className="flex items-center gap-3 cursor-pointer group/item"
                    >
                      {s.photo ? (
                        <img
                          src={s.photo}
                          alt={s.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0 group-hover/item:ring-blue-400 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0 group-hover/item:opacity-90 transition-opacity">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors flex items-center gap-1">
                          <span>{s.name}</span>
                          <span className="text-[10px] text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity">&rarr;</span>
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          {s.studentNo || 'No ID on file'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Meta */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {/* Punctuality Warning Badge */}
                    {(() => {
                      const warning = getPunctualityWarning(s.id, thisMonth(), state);
                      if (!warning) return null;
                      return (
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${warning.badgeClass}`}>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{warning.label} ({warning.count} Lates)</span>
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Classes:</span>
                      <div className="flex flex-wrap gap-1">
                        {classNames.length > 0 ? (
                          classNames.map(cn => (
                            <span
                              key={cn}
                              className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium"
                            >
                              {cn}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-amber-500">Unassigned</span>
                        )}
                      </div>
                    </div>

                    {s.phone && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{s.phone}</span>
                      </div>
                    )}

                    {s.dob && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Born: {s.dob}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer status & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {s.passwordResetStatus === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleGrantPasswordReset(s)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-sm flex items-center gap-1.5 transition-all animate-pulse"
                        title="Student requested permission to change password. Click to grant 1-hour access."
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Grant Password Change</span>
                      </button>
                    ) : s.passwordResetStatus === 'granted' && s.passwordResetExpiresAt && new Date(s.passwordResetExpiresAt).getTime() > Date.now() ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800"
                          title={`Permission active until ${new Date(s.passwordResetExpiresAt).toLocaleTimeString()}`}
                        >
                          <Clock3 className="w-3 h-3" />
                          <span>Permission Granted (1h)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRevokePasswordReset(s)}
                          className="text-[10px] text-slate-400 hover:text-rose-500 underline"
                          title="Revoke permission immediately"
                        >
                          Lock
                        </button>
                      </div>
                    ) : s.password ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400" title={`Student password: ${s.password}`}>
                        <KeyRound className="w-3 h-3" />
                        <span>Portal set</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
                        <Lock className="w-3 h-3" />
                        <span>No password</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openResetPasswordModal(s)}
                      className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1 transition-all"
                      title="Reset Student Password via Firebase Auth"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Reset Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit Student"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStudent(s.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete Student"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Date of Birth</th>
                  <th className="py-3 px-4">Phone / Contact</th>
                  <th className="py-3 px-4">Guardian</th>
                  <th className="py-3 px-4">Classes</th>
                  <th className="py-3 px-4">Portal Key</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sorted.map(s => {
                  const classNames = (s.classIds || [])
                    .map(cid => state.classes.find(c => c.id === cid)?.name)
                    .filter(Boolean);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          onClick={() => onOpenStudentProfile?.(s.id)}
                          className="flex items-center gap-3 cursor-pointer group/cell"
                        >
                          {s.photo ? (
                            <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 group-hover/cell:ring-blue-400 transition-all" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0 group-hover/cell:opacity-90 transition-opacity">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white block group-hover/cell:text-blue-600 dark:group-hover/cell:text-blue-400 transition-colors">
                                {s.name}
                              </span>
                              {(() => {
                                const warning = getPunctualityWarning(s.id, thisMonth(), state);
                                if (!warning) return null;
                                return (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full border ${warning.badgeClass}`}>
                                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                    <span>{warning.count}L</span>
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">{s.studentNo || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{s.sex || '—'}</td>
                      <td className="py-3 px-4 font-mono">{s.dob || '—'}</td>
                      <td className="py-3 px-4">{s.phone || '—'}</td>
                      <td className="py-3 px-4">{s.guardian || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {classNames.length > 0 ? (
                            classNames.map(cn => (
                              <span
                                key={cn}
                                className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium"
                              >
                                {cn}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {s.passwordResetStatus === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleGrantPasswordReset(s)}
                            className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold shadow-sm animate-pulse"
                            title="Click to grant 1-hour password change permission"
                          >
                            Grant Change
                          </button>
                        ) : s.passwordResetStatus === 'granted' && s.passwordResetExpiresAt && new Date(s.passwordResetExpiresAt).getTime() > Date.now() ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            <Clock3 className="w-2.5 h-2.5" />
                            <span>Granted (1h)</span>
                          </span>
                        ) : s.password ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <KeyRound className="w-3 h-3" />
                            <span>Set</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-500 font-medium">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(s.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? `Edit Student: ${editingStudent.name}` : 'Enroll New Student'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/25"
            >
              {editingStudent ? 'Save Changes' : 'Enroll Student'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Photo Picker */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            {formPhoto ? (
              <img
                src={formPhoto}
                alt="Preview"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-500"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                <Camera className="w-6 h-6" />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePickPhoto}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  Choose Student Photo
                </button>
                {formPhoto && (
                  <button
                    type="button"
                    onClick={() => setFormPhoto(null)}
                    className="px-2 py-1 text-xs text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Square automatic crop, saved securely with their classroom profile.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Chan Sokha"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Student ID / Number
              </label>
              <input
                type="text"
                value={formStudentNo}
                onChange={e => setFormStudentNo(e.target.value)}
                placeholder="e.g. STU-1001"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Gender
              </label>
              <select
                value={formSex}
                onChange={e => setFormSex(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— Select Gender —</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={formDob}
                onChange={e => setFormDob(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Phone / Telegram
              </label>
              <input
                type="text"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="+855 ..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                Parent / Guardian
              </label>
              <input
                type="text"
                value={formGuardian}
                onChange={e => setFormGuardian(e.target.value)}
                placeholder="Parent name &amp; relation"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Student Portal Password & Direct Cloud Portal Sync */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Student View Portal Password</span>
            </label>
            <input
              type="text"
              value={formPassword}
              onChange={e => setFormPassword(e.target.value)}
              placeholder="e.g. their birth year, phone digits or ID"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Used when exporting the offline &ldquo;Student View&rdquo; file and logging into the online Student Portal.
            </p>

            {/* Direct Portal Sync / Unsync controls inside Edit modal */}
            {editingStudent ? (
              <div className="pt-2.5 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    editingStudent.authUid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {editingStudent.authUid ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <span>{editingStudent.authUid ? 'Portal Account Active (Synced)' : 'No Portal Account (Missing)'}</span>
                  </span>
                  {modalSyncFeedback && (
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {modalSyncFeedback}
                    </span>
                  )}
                </div>

                {editingStudent.authUid ? (
                  <button
                    type="button"
                    disabled={isModalSyncing}
                    onClick={handleModalUnsyncStudent}
                    className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 rounded-lg transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                    title="Delete login account only while keeping student profile and marks intact"
                  >
                    <UserX className="w-3 h-3" />
                    <span>{isModalSyncing ? 'Unsyncing...' : 'Unsync from Portal'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isModalSyncing}
                    onClick={handleModalSyncStudent}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                    title="Provision Firebase Auth portal login account now"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>{isModalSyncing ? 'Syncing...' : 'Sync to Portal Now'}</span>
                  </button>
                )}
              </div>
            ) : (
              /* Direct Auto-Sync on Enroll option in Enroll modal */
              <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-blue-900 dark:text-blue-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncOnEnroll}
                    onChange={e => setAutoSyncOnEnroll(e.target.checked)}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Sync to Portal Now (Auto-provision Firebase Auth on enrollment)</span>
                </label>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-0.5 pl-5.5">
                  Provisions verified login credentials in Firebase Auth immediately so student can log in right away.
                </p>
              </div>
            )}
          </div>

          {/* Class Enrollment Checkboxes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Enrolled Classes
            </label>
            <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/40 max-h-36 overflow-y-auto space-y-1.5">
              {state.classes.map(c => {
                const checked = formClassIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 p-1 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormClassIds([...formClassIds, c.id]);
                        } else {
                          setFormClassIds(formClassIds.filter(id => id !== c.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium">{c.name}</span>
                    {c.level && <span className="text-[11px] text-slate-400">({c.level})</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1 text-xs">
              Personal Notes
            </label>
            <textarea
              rows={2}
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              placeholder="Strengths, learning goals, or special notes…"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Reset Student Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Student Password — ${resetStudentTarget?.name || ''}`}
      >
        <form onSubmit={handleExecutePasswordReset} className="space-y-4 pt-2">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
            <p className="leading-relaxed">
              Updating password for <strong className="font-bold">{resetStudentTarget?.name}</strong> ({resetStudentTarget?.studentNo || 'ID: ' + resetStudentTarget?.id}). This updates both the student document and their real Firebase Authentication account credentials.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              New Student Portal Password
            </label>
            <input
              type="text"
              required
              value={resetNewPassword}
              onChange={e => setResetNewPassword(e.target.value)}
              placeholder="Minimum 4 characters"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResetLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isResetLoading ? 'Updating Firebase Auth…' : 'Save & Update Password'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Unsync Student Confirmation Modal */}
      <Modal
        isOpen={isUnsyncConfirmOpen}
        onClose={() => setIsUnsyncConfirmOpen(false)}
        title="Unsync Student Login"
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUnsyncConfirmOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteUnsyncStudent}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm"
            >
              Confirm
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold block mb-1">Unsync Firebase Account</span>
            <p className="text-[11px] leading-relaxed">
              Unsync this student? This removes their Firebase login account. All their information (profile, attendance, marks, classwork, requests) stays in the app.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
