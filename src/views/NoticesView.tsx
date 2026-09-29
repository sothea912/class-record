import React, { useState, useMemo } from 'react';
import {
  Bell,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  CalendarX,
  Filter,
  CheckSquare,
  Square,
  Info,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { AppState, ClassCancellationItem } from '../types';
import {
  syncDeleteClassNotice,
  syncDeleteMultipleClassNotices
} from '../utils/firestoreSync';

interface NoticesViewProps {
  state: AppState;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const NoticesView: React.FC<NoticesViewProps> = ({ state, onShowToast }) => {
  // Filtering and view states
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<string[]>([]);

  // LocalStorage hidden list
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hidden_notices_teacher');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal/Confirmation Dialog States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'delete_one' | 'delete_bulk' | 'delete_selected';
    targetId?: string;
  } | null>(null);

  // Firestore Permission Error display state
  const [rulesError, setRulesError] = useState<{
    message: string;
    rulesText: string;
  } | null>(null);

  const handleHideNotice = (id: string, isHiding: boolean) => {
    let nextHidden: string[];
    if (isHiding) {
      nextHidden = [...hiddenIds, id];
      onShowToast('Notice hidden from your view', 'info');
    } else {
      nextHidden = hiddenIds.filter(x => x !== id);
      onShowToast('Notice restored to your view', 'success');
    }
    setHiddenIds(nextHidden);
    try {
      localStorage.setItem('hidden_notices_teacher', JSON.stringify(nextHidden));
    } catch (e) {
      console.warn('Failed to save hidden notices to localStorage', e);
    }
  };

  const handleHideAllListed = (listedNotices: ClassCancellationItem[]) => {
    const idsToHide = listedNotices.map(n => n.id);
    const nextHidden = Array.from(new Set([...hiddenIds, ...idsToHide]));
    setHiddenIds(nextHidden);
    try {
      localStorage.setItem('hidden_notices_teacher', JSON.stringify(nextHidden));
    } catch (e) {
      console.warn('Failed to save hidden notices to localStorage', e);
    }
    onShowToast(`Hid ${idsToHide.length} notices from your view`, 'info');
  };

  const handleUnhideAll = () => {
    setHiddenIds([]);
    try {
      localStorage.setItem('hidden_notices_teacher', JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear hidden notices', e);
    }
    onShowToast('All hidden notices restored to your view', 'success');
  };

  // Filter & process notices
  const allNotices = useMemo(() => {
    const list = state.classCancellations || [];
    // Deduplicate notices by ID to ensure React list rendering has guaranteed unique keys.
    // This solves the duplicate key collisions that cause phantom DOM elements and abnormal card stretching on deletion.
    const uniqueMap = new Map<string, ClassCancellationItem>();
    list.forEach(n => {
      if (n && n.id) {
        uniqueMap.set(n.id, n);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());
    
    // Sort newest first by createdAt
    return uniqueList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.classCancellations]);

  const filteredNotices = useMemo(() => {
    return allNotices.filter(n => {
      // Filter by Class
      if (selectedClassId !== 'all' && n.classId !== selectedClassId) {
        return false;
      }
      // Filter by Hidden (Hide hidden notices unless showHidden is toggled)
      const isHidden = hiddenIds.includes(n.id);
      if (isHidden && !showHidden) {
        return false;
      }
      return true;
    });
  }, [allNotices, selectedClassId, hiddenIds, showHidden]);

  // Checkbox toggle
  const handleToggleSelectNotice = (id: string) => {
    setSelectedNoticeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedNoticeIds.length === filteredNotices.length) {
      setSelectedNoticeIds([]);
    } else {
      setSelectedNoticeIds(filteredNotices.map(n => n.id));
    }
  };

  const executeDeleteOne = async (id: string) => {
    try {
      setRulesError(null);
      await syncDeleteClassNotice(id);
      // Remove from selected list if present
      setSelectedNoticeIds(prev => prev.filter(x => x !== id));
      onShowToast('Notice deleted for everyone.', 'success');
    } catch (err: any) {
      console.error(err);
      const isPermissionDenied = err.message?.includes('permission-denied') || err.message?.includes('insufficient permissions');
      if (isPermissionDenied) {
        setRulesError({
          message: err.message,
          rulesText: `match /classNotices/{noticeId} {
  allow read: if isSignedIn();
  allow write: if isAdmin();
}`
        });
      } else {
        onShowToast(`Failed to delete notice: ${err.message || err}`, 'error');
      }
    }
  };

  const executeDeleteBulk = async (idsToDelete: string[]) => {
    try {
      setRulesError(null);
      await syncDeleteMultipleClassNotices(idsToDelete);
      setSelectedNoticeIds([]);
      onShowToast(`Successfully deleted ${idsToDelete.length} notices for everyone.`, 'success');
    } catch (err: any) {
      console.error(err);
      const isPermissionDenied = err.message?.includes('permission-denied') || err.message?.includes('insufficient permissions');
      if (isPermissionDenied) {
        setRulesError({
          message: err.message,
          rulesText: `match /classNotices/{noticeId} {
  allow read: if isSignedIn();
  allow write: if isAdmin();
}`
        });
      } else {
        onShowToast(`Failed to delete notices: ${err.message || err}`, 'error');
      }
    }
  };

  const handleConfirmAction = () => {
    if (!confirmModal) return;
    const { actionType, targetId } = confirmModal;
    setConfirmModal(null);

    if (actionType === 'delete_one' && targetId) {
      executeDeleteOne(targetId);
    } else if (actionType === 'delete_bulk') {
      const ids = filteredNotices.map(n => n.id);
      executeDeleteBulk(ids);
    } else if (actionType === 'delete_selected') {
      executeDeleteBulk(selectedNoticeIds);
    }
  };

  // Get class name helper
  const getClassName = (classId: string) => {
    const cls = state.classes.find(c => c.id === classId);
    return cls ? cls.name : 'Unknown Class';
  };

  return (
    <div className="space-y-6">
      {/* Rules Error Card if Permission Denied occurs */}
      {rulesError && (
        <div className="p-5 bg-rose-500/10 border-2 border-rose-500 rounded-2xl space-y-3 text-slate-900 dark:text-white">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-500">Firestore Rules Permission Denied</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                The Firestore operations failed due to insufficient permissions. Please copy the rules below and paste them into your Firebase Console Rules editor to enable deletion of notices:
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="p-3.5 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto select-all max-h-40">
              {rulesError.rulesText}
            </pre>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setRulesError(null)}
              className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold rounded-lg transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Control Actions Header Card */}
      <div className="bg-white dark:bg-[#121212] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Class Filter & Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              <span>Filter:</span>
              <select
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value);
                  setSelectedNoticeIds([]);
                }}
                className="bg-transparent border-none outline-none focus:ring-0 font-bold text-slate-900 dark:text-white cursor-pointer pr-4 py-0"
              >
                <option value="all">All Classes</option>
                {state.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowHidden(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showHidden
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200/50'
              }`}
            >
              {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showHidden ? 'Showing Hidden' : 'Hide Hidden'}</span>
            </button>

            {hiddenIds.length > 0 && (
              <button
                type="button"
                onClick={handleUnhideAll}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all cursor-pointer"
              >
                Restore {hiddenIds.length} Hidden
              </button>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hide Listed notices for me */}
            <button
              type="button"
              disabled={filteredNotices.length === 0}
              onClick={() => handleHideAllListed(filteredNotices)}
              className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide Listed for Me</span>
            </button>

            {/* Selected Actions */}
            {selectedNoticeIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const nextHidden = Array.from(new Set([...hiddenIds, ...selectedNoticeIds]));
                    setHiddenIds(nextHidden);
                    localStorage.setItem('hidden_notices_teacher', JSON.stringify(nextHidden));
                    setSelectedNoticeIds([]);
                    onShowToast(`Hid ${selectedNoticeIds.length} selected notices`, 'info');
                  }}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Selected ({selectedNoticeIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Delete Selected Notices?',
                      message: `This will permanently delete the ${selectedNoticeIds.length} selected notices for all students. This action cannot be undone.`,
                      actionType: 'delete_selected'
                    })
                  }
                  className="px-3.5 py-2 text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedNoticeIds.length})</span>
                </button>
              </>
            )}

            {/* Delete listed for everyone */}
            <button
              type="button"
              disabled={filteredNotices.length === 0}
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  title: 'Delete All Listed Notices?',
                  message: `This will permanently delete all ${filteredNotices.length} notices currently displayed in this view for all students. This cannot be undone.`,
                  actionType: 'delete_bulk'
                })
              }
              className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All listed for Everyone ({filteredNotices.length})</span>
            </button>
          </div>

        </div>

        {/* Selected notices information */}
        {filteredNotices.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
              >
                {selectedNoticeIds.length === filteredNotices.length ? (
                  <CheckSquare className="w-4 h-4 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {selectedNoticeIds.length === filteredNotices.length
                    ? 'Deselect All'
                    : `Select All Listed (${filteredNotices.length})`}
                </span>
              </button>
            </div>
            <span>
              Showing {filteredNotices.length} of {allNotices.length} notices
            </span>
          </div>
        )}
      </div>

      {/* Roster Notices List Grid */}
      {filteredNotices.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-400 flex items-center justify-center mx-auto">
            <CalendarX className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No notices published yet.
          </p>
          <p className="text-xs text-slate-400">
            When you cancel or reschedule a class in the Daily Attendance Register, the notices will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotices.map(notice => {
            const isHidden = hiddenIds.includes(notice.id);
            const isSelected = selectedNoticeIds.includes(notice.id);
            const isReschedule = !!notice.makeupDate;

            return (
              <div
                key={notice.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  isHidden
                    ? 'bg-slate-50/50 dark:bg-[#111111]/40 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                    : 'bg-white dark:bg-[#121212] border-slate-200 dark:border-[#202020] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelectNotice(notice.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isReschedule
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
                        }`}
                      >
                        {isReschedule ? 'Rescheduled' : 'Cancelled'}
                      </span>
                      {isHidden && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 flex items-center gap-0.5">
                          <EyeOff className="w-2.5 h-2.5" />
                          <span>Hidden</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold">
                      {notice.id.slice(-5)}
                    </div>
                  </div>

                  {/* Class Info */}
                  <div className="space-y-1 mt-1">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                      {getClassName(notice.classId)}
                    </h4>
                  </div>

                  {/* Dates Section */}
                  <div className="mt-3.5 space-y-1.5 p-3 rounded-xl bg-slate-50/80 dark:bg-[#161616] border border-slate-150 dark:border-slate-850 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-medium">Original Date:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{notice.originalDate}</strong>
                    </div>
                    {isReschedule && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Makeup Date:</span>
                        <strong className="font-mono text-emerald-700 dark:text-emerald-300">{notice.makeupDate}</strong>
                      </div>
                    )}
                  </div>

                  {/* Reason Text */}
                  {notice.reason && (
                    <div className="mt-3.5 text-xs text-slate-700 dark:text-slate-300 bg-amber-50/20 dark:bg-amber-950/5 p-2.5 rounded-xl border border-dashed border-amber-200/50 dark:border-amber-900/20">
                      <p className="font-bold text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span>Reason / Message</span>
                      </p>
                      <p className="italic leading-relaxed font-medium text-slate-600 dark:text-slate-400">&ldquo;{notice.reason}&rdquo;</p>
                    </div>
                  )}
                </div>

                {/* Card Footer controls */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{new Date(notice.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Hide toggle */}
                    <button
                      type="button"
                      onClick={() => handleHideNotice(notice.id, !isHidden)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title={isHidden ? 'Show notice in your list' : 'Hide notice from your list'}
                    >
                      {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          title: 'Delete Notice for Everyone?',
                          message: 'This will permanently delete this notice from Firestore, removing it from all student device banners and notification centers. This action cannot be undone.',
                          actionType: 'delete_one',
                          targetId: notice.id
                        })
                      }
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete permanently for everyone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold leading-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
