import React, { useState, useEffect } from 'react';
import { UserCog, Camera, Save, Lock, ShieldCheck, KeyRound, ShieldAlert, UserX, Trash2, RefreshCw, Clock, AlertTriangle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { UserProfile, StudentItem, TeacherSecurity } from '../types';
import {
  provisionStudentAuthAccount,
  unsyncStudentAuthAccount,
  refreshAllStudentsAuthStatusLive,
  unsyncMultipleStudentsAuthAccounts,
  unsyncMultipleStudentsWithNotification,
  testStudentLoginSecondary,
  changeTeacherPasswordAccount,
  syncSaveSettings,
  fetchAppLogo,
  saveAppLogo,
  deleteAppLogo,
  saveAppWallpaperDual,
  removeAppWallpaperDual,
  saveAppHeaderInfo,
  compressImageToDataString,
  subscribeToAppBranding,
  compressWallpaperToDataString,
} from '../utils/firestoreSync';
import { Modal } from '../components/Modal';

interface ProfileViewProps {
  profile: UserProfile;
  teacherSecurity?: TeacherSecurity;
  students?: any[];
  onSaveProfile: (profile: UserProfile) => void;
  onSaveSecuritySettings?: (sec: TeacherSecurity) => void;
  onUpdatePassword?: (newPassword: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  teacherSecurity,
  students = [],
  onSaveProfile,
  onSaveSecuritySettings,
  onUpdatePassword,
  onShowToast,
}) => {
  const [name, setName] = useState(profile.name || '');
  const [role, setRole] = useState(profile.role || '');
  const [school, setSchool] = useState(profile.school || '');
  const [className, setClassName] = useState(profile.className || '');
  const [timeFrom, setTimeFrom] = useState(profile.timeFrom || '19:00');
  const [timeTo, setTimeTo] = useState(profile.timeTo || '20:30');
  const [photo, setPhoto] = useState<string | null>(profile.photo || null);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [appWallpaperDark, setAppWallpaperDark] = useState<string | null>(null);
  const [appWallpaperLight, setAppWallpaperLight] = useState<string | null>(null);
  const [appHeading, setAppHeading] = useState('');
  const [appSubtitle, setAppSubtitle] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToAppBranding((branding) => {
      setAppLogo(branding.logo || null);
      setAppWallpaperDark(branding.wallpaperDark || null);
      setAppWallpaperLight(branding.wallpaperLight || null);
      setAppHeading(branding.heading || '');
      setAppSubtitle(branding.subtitle || '');
    });
    return () => unsubscribe();
  }, []);

  const handleSaveHeaderInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveAppHeaderInfo(appHeading.trim(), appSubtitle.trim());
      onShowToast('App heading and subtitle applied successfully across all devices and student browsers!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to save heading and subtitle', 'error');
    }
  };

  const handleUploadAppWallpaperDual = async (type: 'dark' | 'light', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      onShowToast('File too large! Live wallpaper/video must be under 1MB to sync across all devices.', 'error');
      return;
    }

    try {
      onShowToast(`Processing and uploading ${type} mode wallpaper...`, 'info');
      let dataUrl: string;

      if (file.type.startsWith('image/')) {
        dataUrl = await compressWallpaperToDataString(file);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      await saveAppWallpaperDual(type, dataUrl);
      onShowToast(`Wallpaper (${type === 'dark' ? 'Dark Mode' : 'Light Mode'}) applied successfully across all devices and student browsers!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast('Failed to upload wallpaper: ' + (err.message || String(err)), 'error');
    }
  };

  const handleRemoveAppWallpaperDual = async (type: 'dark' | 'light') => {
    try {
      await removeAppWallpaperDual(type);
      onShowToast(`Wallpaper (${type === 'dark' ? 'Dark Mode' : 'Light Mode'}) removed across all devices.`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to remove wallpaper', 'error');
    }
  };

  const handleUploadAppLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataString(file);
      await saveAppLogo(compressed);
      setAppLogo(compressed);
      onShowToast('App logo applied successfully across all devices and student browsers!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload app logo', 'error');
    }
  };

  const handleRemoveAppLogo = async () => {
    try {
      await deleteAppLogo();
      setAppLogo(null);
      onShowToast('App logo removed across all devices!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to remove app logo', 'error');
    }
  };

  // Lateness & Penalty Settings
  const [yellowFrom, setYellowFrom] = useState<number>(teacherSecurity?.yellowFrom ?? 1);
  const [redFrom, setRedFrom] = useState<number>(teacherSecurity?.redFrom ?? 10);
  const [yellowPenalty, setYellowPenalty] = useState<number>(teacherSecurity?.yellowPenalty ?? 0);
  const [redPenalty, setRedPenalty] = useState<number>(teacherSecurity?.redPenalty ?? 2);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Sync Student Auth State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveSyncStatusMap, setLiveSyncStatusMap] = useState<Record<string, boolean> | null>(null);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  // Selective Student Checkboxes
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Function to toggle a student ID in the selection
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Function to toggle select all
  const toggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  const getStudentSyncStatus = (s: StudentItem): boolean => {
    if (liveSyncStatusMap && liveSyncStatusMap[s.id] !== undefined) {
      return liveSyncStatusMap[s.id];
    }
    return !!s.authUid;
  };

  const totalStudentsCount = students.length;
  const syncedCount = students.filter(s => getStudentSyncStatus(s)).length;
  const missingCount = Math.max(0, totalStudentsCount - syncedCount);

  // Handler for live sync status refresh directly against Firebase Authentication
  const handleRefreshLiveStatus = async () => {
    setIsRefreshing(true);
    try {
      onShowToast('Checking live student accounts directly against Firebase Authentication...', 'info');
      const res = await refreshAllStudentsAuthStatusLive(students);
      setLiveSyncStatusMap(res.syncedMap);
      onShowToast(`Live Sync Refreshed: ${res.syncedCount} / ${res.totalCount} active accounts verified in Firebase Auth.`, 'success');
    } catch (err: any) {
      console.error('Refresh sync error:', err);
      onShowToast(`Failed to refresh sync status: ${err.message || String(err)}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncAuth = async (syncAll = false) => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const targetStudents = syncAll
        ? students
        : students.filter(s => selectedStudentIds.includes(s.id));

      if (!syncAll && targetStudents.length === 0) {
        onShowToast('Please select at least one student to synchronize.', 'info');
        setIsSyncing(false);
        return;
      }

      onShowToast(`Synchronizing ${targetStudents.length} student account(s)...`, 'info');

      let createdCount = 0;
      let existingCount = 0;
      let failedCount = 0;
      const details: any[] = [];
      const updatedMap = { ...(liveSyncStatusMap || {}) };

      for (const student of targetStudents) {
        try {
          const res = await provisionStudentAuthAccount(student);
          if (res.status === 'created') {
            createdCount++;
            updatedMap[student.id] = true;
          } else if (res.status === 'linked_existing') {
            existingCount++;
            updatedMap[student.id] = true;
          } else {
            failedCount++;
            updatedMap[student.id] = false;
          }

          details.push({
            id: student.id,
            name: student.name,
            email: res.email,
            uid: res.uid,
            status: res.status,
            error: res.error,
          });
        } catch (err: any) {
          failedCount++;
          updatedMap[student.id] = false;
          details.push({
            id: student.id,
            name: student.name,
            email: `${student.id}@centralacademy.app`,
            status: 'failed',
            error: err.message || String(err),
          });
        }
      }

      setLiveSyncStatusMap(updatedMap);

      const summary = {
        createdCount,
        existingCount,
        failedCount,
        details,
      };

      setSyncResult(summary);

      if (failedCount > 0) {
        onShowToast(`Completed: ${createdCount} created, ${existingCount} linked, ${failedCount} warning(s).`, 'info');
      } else {
        onShowToast(`Successfully synchronized ${createdCount + existingCount} student credentials!`, 'success');
      }
    } catch (err: any) {
      console.error('Client-side auth sync error:', err);
      onShowToast(err.message || 'Synchronization failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Test Login per-student state
  const [testLoginResults, setTestLoginResults] = useState<
    Record<string, { testing?: boolean; success?: boolean; code?: string; error?: string; email?: string }>
  >({});

  const handleTestStudentLogin = async (student: StudentItem) => {
    setTestLoginResults(prev => ({
      ...prev,
      [student.id]: { testing: true },
    }));

    try {
      const res = await testStudentLoginSecondary(student);
      if (res.success) {
        setTestLoginResults(prev => ({
          ...prev,
          [student.id]: {
            testing: false,
            success: true,
            code: 'Login works',
            email: res.email,
          },
        }));
        onShowToast(`Login test passed for ${student.name}: Login works`, 'success');
      } else {
        setTestLoginResults(prev => ({
          ...prev,
          [student.id]: {
            testing: false,
            success: false,
            code: res.code || 'unknown-error',
            error: res.error,
            email: res.email,
          },
        }));
        onShowToast(`Login test failed for ${student.name}: ${res.code || 'failed'}`, 'error');
      }
    } catch (err: any) {
      setTestLoginResults(prev => ({
        ...prev,
        [student.id]: {
          testing: false,
          success: false,
          code: err.code || 'unknown-error',
          error: err.message || String(err),
        },
      }));
      onShowToast(`Login test error: ${err.message || String(err)}`, 'error');
    }
  };

  // Unsync state & handler (Single)
  const [unsyncModalStudent, setUnsyncModalStudent] = useState<StudentItem | null>(null);
  const [isUnsyncingStudent, setIsUnsyncingStudent] = useState(false);
  // Manual deletion fallback state (when credentials mismatch or deletion fails)
  const [manualDeleteStudent, setManualDeleteStudent] = useState<{ student: StudentItem; error: string } | null>(null);

  // Bulk Unsync state & handler
  const [isBulkUnsyncModalOpen, setIsBulkUnsyncModalOpen] = useState(false);
  const [isBulkUnsyncing, setIsBulkUnsyncing] = useState(false);

  const handleConfirmUnsync = async () => {
    if (!unsyncModalStudent) return;
    const targetStudent = unsyncModalStudent;
    setIsUnsyncingStudent(true);
    try {
      const res = await unsyncStudentAuthAccount(targetStudent, false);
      if (res.success) {
        // Clear local credentials on the student
        targetStudent.authUid = undefined;
        targetStudent.authEmail = undefined;
        setLiveSyncStatusMap(prev => ({
          ...(prev || {}),
          [targetStudent.id]: false,
        }));
        onShowToast(`Unsynced login account for ${targetStudent.name}. Roster & marks remain intact.`, 'success');
        setUnsyncModalStudent(null);
      } else {
        // Did NOT delete from Firebase Auth! Do NOT mark missing or revoked!
        setUnsyncModalStudent(null);
        setManualDeleteStudent({
          student: targetStudent,
          error: res.error || 'Password mismatch or credentials could not authenticate for deletion in Firebase Auth.',
        });
        onShowToast(`Could not delete Firebase Auth user automatically. Manual deletion required.`, 'error');
      }
    } catch (err: any) {
      console.error('Unsync error:', err);
      onShowToast(`Unsync failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsUnsyncingStudent(false);
    }
  };

  const handleForceMarkMissing = async () => {
    if (!manualDeleteStudent) return;
    const { student } = manualDeleteStudent;
    try {
      const res = await unsyncStudentAuthAccount(student, true);
      if (res.success) {
        student.authUid = undefined;
        student.authEmail = undefined;
        setLiveSyncStatusMap(prev => ({
          ...(prev || {}),
          [student.id]: false,
        }));
        onShowToast(`Student ${student.name} marked as missing in portal.`, 'info');
      }
    } catch (err: any) {
      onShowToast(`Error: ${err.message || String(err)}`, 'error');
    } finally {
      setManualDeleteStudent(null);
    }
  };

  const handleConfirmBulkUnsync = async () => {
    const targetStudents = students.filter(s => selectedStudentIds.includes(s.id));
    if (targetStudents.length === 0) return;

    setIsBulkUnsyncing(true);
    try {
      onShowToast('Notifying students…', 'info');
      const res = await unsyncMultipleStudentsWithNotification(
        targetStudents,
        msg => onShowToast(msg, 'info')
      );

      const updatedMap = { ...(liveSyncStatusMap || {}) };
      targetStudents.forEach(s => {
        s.authUid = undefined;
        s.authEmail = undefined;
        s.accountStatus = null;
        updatedMap[s.id] = false;
      });
      setLiveSyncStatusMap(updatedMap);
      setSelectedStudentIds([]);
      setIsBulkUnsyncModalOpen(false);

      if (res.failedCount > 0) {
        onShowToast(`Unsynced ${res.successCount} account(s), ${res.failedCount} failed. Roster and grades remain intact.`, 'info');
      } else {
        onShowToast(`Successfully unsynced ${res.successCount} student account(s). Roster and grades remain 100% intact.`, 'success');
      }
    } catch (err: any) {
      console.error('Bulk unsync error:', err);
      onShowToast(`Bulk unsync failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsBulkUnsyncing(false);
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
          setPhoto(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => {
    onSaveProfile({
      name: name.trim(),
      role: role.trim(),
      school: school.trim(),
      className: className.trim(),
      timeFrom,
      timeTo,
      photo,
    });

    const updatedSec: TeacherSecurity = {
      ...(teacherSecurity || { isConfigured: true, isSetupCompleted: true }),
      yellowFrom: Number(yellowFrom),
      redFrom: Number(redFrom),
      yellowPenalty: Number(yellowPenalty),
      redPenalty: Number(redPenalty),
    };

    if (onSaveSecuritySettings) {
      onSaveSecuritySettings(updatedSec);
    } else {
      syncSaveSettings(
        {
          name: name.trim(),
          role: role.trim(),
          school: school.trim(),
          className: className.trim(),
          timeFrom,
          timeTo,
          photo,
        },
        updatedSec
      );
    }

    onShowToast('Instructor profile and lateness rules saved to cloud', 'success');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onShowToast('New password must be at least 8 characters long.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onShowToast('New passwords do not match.', 'error');
      return;
    }

    setIsChangingPass(true);
    try {
      await changeTeacherPasswordAccount(oldPassword, newPassword);
      if (onUpdatePassword) onUpdatePassword(newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('Instructor password updated successfully!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update password', 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Intro */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
          <UserCog className="w-4 h-4" />
          <span>Institutional Branding &amp; Signature</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Teacher Profile &amp; School Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Your profile photo, official instructor title, and school campus name are embedded into all printed certificates, Word documents, and student-facing scorecards.
        </p>
      </div>

      {/* App Logo Settings Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">App Logo (Login Screen)</h3>
            <p className="text-xs text-slate-500">Custom square logo displayed on all login screens.</p>
          </div>
          {appLogo ? (
            <div className="flex items-center gap-2">
              <img src={appLogo} alt="App Logo" className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={handleRemoveAppLogo}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-sm">
              Upload Logo
              <input type="file" accept="image/*" onChange={handleUploadAppLogo} className="hidden" />
            </label>
          )}
        </div>

        {/* Heading & Subtitle Form for Login Screen */}
        <form onSubmit={handleSaveHeaderInfo} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Heading (Login View)</label>
              <input
                type="text"
                value={appHeading}
                onChange={e => setAppHeading(e.target.value)}
                placeholder="e.g. Central Academy"
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtitle (Login View)</label>
              <input
                type="text"
                value={appSubtitle}
                onChange={e => setAppSubtitle(e.target.value)}
                placeholder="e.g. English Tutorial Online Class"
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Save Heading &amp; Subtitle
            </button>
          </div>
        </form>
      </div>

      {/* Login Wallpaper / Live Video Card (Split Dark / Light Mode) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">App Background Wallpapers</h3>
          <p className="text-xs text-slate-500">Configure independent wallpapers for Light Mode and Dark Mode. If none are set, solid background defaults are used.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Wallpaper (Light Mode) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Wallpaper (Light Mode)</h4>
              <p className="text-[11px] text-slate-500">Applied behind views in light theme.</p>
            </div>
            <div className="flex items-center gap-2">
              {appWallpaperLight ? (
                <>
                  <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAppWallpaperDual('light')}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                    title="Remove Light Wallpaper"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                  Upload Wallpaper
                  <input type="file" accept="video/*,image/*" onChange={e => handleUploadAppWallpaperDual('light', e)} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Wallpaper (Dark Mode) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Wallpaper (Dark Mode)</h4>
              <p className="text-[11px] text-slate-500">Applied behind views in dark theme.</p>
            </div>
            <div className="flex items-center gap-2">
              {appWallpaperDark ? (
                <>
                  <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAppWallpaperDual('dark')}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                    title="Remove Dark Wallpaper"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                  Upload Wallpaper
                  <input type="file" accept="video/*,image/*" onChange={e => handleUploadAppWallpaperDual('dark', e)} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Photo Upload Section */}
        <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
          {photo ? (
            <img
              src={photo}
              alt="Teacher"
              className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-500/20 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
              <Camera className="w-8 h-8" />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePickPhoto}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 shadow-sm"
              >
                Upload Profile Picture
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="px-2.5 py-1 text-xs text-rose-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Recommended: Square portrait photo. Appears in navigation and document headings.
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Soth Sothea (Albe)"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Teaching Role / Title
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. English Lead Instructor"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              School / Campus / Centre Name
            </label>
            <input
              type="text"
              value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder="e.g. Central Academy or School Name"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Default Classroom Name
            </label>
            <input
              type="text"
              value={className}
              onChange={e => setClassName(e.target.value)}
              placeholder="e.g. Evening English A"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Default Class Start Time
            </label>
            <input
              type="time"
              value={timeFrom}
              onChange={e => setTimeFrom(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Default Class End Time
            </label>
            <input
              type="time"
              value={timeTo}
              onChange={e => setTimeTo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/25 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile &amp; Settings</span>
          </button>
        </div>
      </div>

      {/* Instructor Security & Google Auth Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Instructor Authentication &amp; Security</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Managed via Google Authentication
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Your instructor account is authenticated directly using your Google account via Firebase Authentication. Passwords, 2-Step Verification, and security recovery are managed safely inside your Google Account settings.
          </p>
        </div>
      </div>

      {/* Student Roster Authentication Sync */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <KeyRound className="w-4 h-4" />
          <span>Student Accounts &amp; Portal Authentication</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Roster Security &amp; Portal Access Sync
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Students access the secure Student Portal using their Name/ID and assigned password. This utility batch-provisions real credentials inside Firebase Authentication, ensuring every student has a safe, verified account.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Student Auth Coverage
            </span>
            <span className="text-lg font-extrabold text-slate-800 dark:text-white block font-mono">
              {syncedCount} / {totalStudentsCount} Accounts Synced
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {missingCount === 0 ? '✓ Every student has a provisioned Firebase Auth account!' : `⚠ ${missingCount} student(s) lack a verified cloud auth record.`}
            </span>
          </div>

          <button
            type="button"
            disabled={isRefreshing || isSyncing || students.length === 0}
            onClick={handleRefreshLiveStatus}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all shadow-xs shrink-0 active:scale-95 ${
              isRefreshing
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
            }`}
            title="Re-check all accounts live against Firebase Authentication"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Verifying Live Auth...' : 'Refresh Sync Status'}</span>
          </button>
        </div>

        {/* Student Checklist for Selective Sync */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/10">
          <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={students.length > 0 && selectedStudentIds.length === students.length}
                onChange={toggleSelectAll}
                className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Roster Checklist ({selectedStudentIds.length} Selected)</span>
            </div>
            <span>Status</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-56 overflow-y-auto scrollbar-thin">
            {students.map(student => {
              const isSelected = selectedStudentIds.includes(student.id);
              const isSynced = getStudentSyncStatus(student);

              return (
                <div key={student.id} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudentSelection(student.id)}
                      className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <div className="truncate">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block truncate">{student.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate font-mono">
                        ID: {student.studentNo || student.id}
                        {student.authEmail ? ` • ${student.authEmail}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Live Test Login Result if tested */}
                    {testLoginResults[student.id]?.code && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                          testLoginResults[student.id].success
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        }`}
                        title={testLoginResults[student.id].error || testLoginResults[student.id].email}
                      >
                        {testLoginResults[student.id].success ? '✓ ' : '✗ '}
                        {testLoginResults[student.id].code}
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isSynced
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {isSynced ? 'Synced' : 'Missing'}
                    </span>

                    {/* Test Login Button */}
                    <button
                      type="button"
                      disabled={testLoginResults[student.id]?.testing}
                      onClick={() => handleTestStudentLogin(student)}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200/80 dark:border-sky-800/60 flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer"
                      title="Test credentials with isolated secondary Firebase instance"
                    >
                      {testLoginResults[student.id]?.testing ? (
                        <span className="w-2.5 h-2.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      )}
                      <span>{testLoginResults[student.id]?.testing ? 'Testing...' : 'Test Login'}</span>
                    </button>

                    {isSynced && (
                      <button
                        type="button"
                        onClick={() => setUnsyncModalStudent(student)}
                        className="px-2 py-1 rounded-md text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer"
                        title="Delete login account only (preserves all student grades, attendance, and records)"
                      >
                        <UserX className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Unsync</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {students.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No students enrolled in the directory.
              </div>
            )}
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          {selectedStudentIds.length > 0 && (
            <button
              type="button"
              disabled={isSyncing || isBulkUnsyncing || isRefreshing}
              onClick={() => setIsBulkUnsyncModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all select-none border shrink-0 ${
                isSyncing || isBulkUnsyncing
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-800'
                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Unsync Selected ({selectedStudentIds.length})</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSyncing || isBulkUnsyncing || selectedStudentIds.length === 0}
            onClick={() => handleSyncAuth(false)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all select-none shrink-0 ${
              isSyncing || isBulkUnsyncing || selectedStudentIds.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-850'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sync Selected ({selectedStudentIds.length})</span>
          </button>

          <button
            type="button"
            disabled={isSyncing || isBulkUnsyncing || students.length === 0}
            onClick={() => handleSyncAuth(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all select-none border shrink-0 ${
              isSyncing || isBulkUnsyncing || students.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-850'
                : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sync All Students</span>
          </button>
        </div>

        {syncResult && (
          <div className="p-4 rounded-xl bg-slate-950/90 text-slate-300 font-mono text-[11px] leading-relaxed border border-slate-800 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-slate-400">
              <span>SYNC REPORT</span>
              <span className={syncResult.failedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {syncResult.failedCount > 0 ? 'COMPLETED WITH WARNINGS' : 'SUCCESS'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pb-1.5">
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="block text-emerald-400 font-bold">{syncResult.createdCount}</span>
                <span className="text-[10px] text-slate-500 font-sans">Created</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="block text-blue-400 font-bold">{syncResult.existingCount}</span>
                <span className="text-[10px] text-slate-500 font-sans">Already Synced</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="block text-rose-400 font-bold">{syncResult.failedCount}</span>
                <span className="text-[10px] text-slate-500 font-sans">Failed</span>
              </div>
            </div>
            {syncResult.details && syncResult.details.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border-t border-slate-900 pt-1.5 scrollbar-thin">
                {syncResult.details.map((d: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] py-0.5 border-b border-slate-900/50">
                    <span className="truncate max-w-[120px] font-bold text-slate-400">{d.name}</span>
                    <span className="truncate text-slate-500 max-w-[150px]">{d.email}</span>
                    <span className={`font-bold shrink-0 ${
                      d.status === 'created' ? 'text-emerald-400' :
                      d.status === 'linked_existing' ? 'text-blue-400' :
                      d.status === 'failed' ? 'text-rose-400' : 'text-slate-500'
                    }`}>
                      {d.status === 'created' ? 'Created' :
                       d.status === 'linked_existing' ? 'Active' :
                       d.status === 'failed' ? 'Failed' : 'Synced'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Unsyncing Student Authentication (Single) */}
      <Modal
        isOpen={!!unsyncModalStudent}
        onClose={() => !isUnsyncingStudent && setUnsyncModalStudent(null)}
        title="Unsync Student Login"
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isUnsyncingStudent}
              onClick={() => setUnsyncModalStudent(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUnsyncingStudent}
              onClick={handleConfirmUnsync}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <UserX className={`w-3.5 h-3.5 ${isUnsyncingStudent ? 'animate-spin' : ''}`} />
              <span>{isUnsyncingStudent ? 'Unsyncing...' : 'Unsync Login'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                Revoke portal login for {unsyncModalStudent?.name}?
              </span>
              <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                This will delete ONLY their Firebase Authentication user account.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
            <p>
              <strong>What stays intact:</strong> All grades, attendance records, classroom enrollments, and profile data in your roster remain 100% safe and untouched.
            </p>
            <p>
              <strong>What changes:</strong> The student will no longer be able to log into the Student Portal until you click &quot;Sync Selected&quot; to provision a fresh account for them.
            </p>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Bulk Unsyncing Selected Students */}
      <Modal
        isOpen={isBulkUnsyncModalOpen}
        onClose={() => !isBulkUnsyncing && setIsBulkUnsyncModalOpen(false)}
        title={`Unsync ${selectedStudentIds.length} Selected Student Account(s)`}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isBulkUnsyncing}
              onClick={() => setIsBulkUnsyncModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBulkUnsyncing}
              onClick={handleConfirmBulkUnsync}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <UserX className={`w-3.5 h-3.5 ${isBulkUnsyncing ? 'animate-spin' : ''}`} />
              <span>{isBulkUnsyncing ? 'Unsyncing Accounts...' : `Unsync (${selectedStudentIds.length}) Accounts`}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                Revoke portal login for {selectedStudentIds.length} selected student(s)?
              </span>
              <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                This will delete ONLY their Firebase Authentication accounts.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
            <p>
              <strong>100% Safe:</strong> All grades, attendance records, exam scores, and classroom profiles remain completely preserved in Firestore.
            </p>
            <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-900/40 text-[11px]">
              {students
                .filter(s => selectedStudentIds.includes(s.id))
                .map(s => (
                  <div key={s.id} className="py-1 flex justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                    <span className="font-mono text-slate-400">{s.studentNo || s.id}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Fallback Modal when Firebase Auth account cannot be deleted automatically */}
      <Modal
        isOpen={!!manualDeleteStudent}
        onClose={() => setManualDeleteStudent(null)}
        title="Firebase Auth Manual Deletion Required"
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setManualDeleteStudent(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForceMarkMissing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Mark as Missing</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                Cannot automatically delete Firebase Auth account
              </span>
              <p className="text-[11px] leading-relaxed">
                {manualDeleteStudent?.error}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Required fallback steps:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
              <li>Open <strong>Firebase Console &rarr; Authentication &rarr; Users</strong>.</li>
              <li>Locate and delete the user account for student <strong>{manualDeleteStudent?.student.name}</strong>.</li>
              <li>Return here and click <strong>&quot;Mark as Missing&quot;</strong> below to clear their local portal link and allow re-syncing.</li>
            </ol>
          </div>
        </div>
      </Modal>
    </div>
  );
};
