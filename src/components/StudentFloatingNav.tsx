import React, { useState } from 'react';
import {
  Compass,
  Mail,
  Trophy,
  BookOpen,
  Layers,
  User,
  CalendarCheck,
  Download,
  Settings,
  X,
  Check,
  Sparkles,
  Video,
} from 'lucide-react';
import { Modal } from './Modal';

export type QuickNavActionId = 'leave' | 'join' | 'results' | 'report' | 'library' | 'classes' | 'attendance' | 'profile';

interface QuickNavOption {
  id: QuickNavActionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabTarget?: string;
  color: string;
}

const ALL_QUICK_OPTIONS: QuickNavOption[] = [
  { id: 'leave', label: 'Request Leave / Permission', icon: Mail, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'join', label: 'Join Class (Google Meet)', icon: Video, color: 'text-rose-500 bg-rose-500/10' },
  { id: 'results', label: 'View Scores & Results', icon: Trophy, tabTarget: 'results', color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'report', label: 'Download Report Card', icon: Download, color: 'text-purple-500 bg-purple-500/10' },
  { id: 'library', label: 'Resource Library', icon: BookOpen, tabTarget: 'library', color: 'text-blue-500 bg-blue-500/10' },
  { id: 'classes', label: 'Class Schedule & Info', icon: Layers, tabTarget: 'classes', color: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'attendance', label: 'Attendance History', icon: CalendarCheck, tabTarget: 'attendance', color: 'text-teal-500 bg-teal-500/10' },
  { id: 'profile', label: 'My Student Profile', icon: User, tabTarget: 'profile', color: 'text-purple-500 bg-purple-500/10' },
];

interface StudentFloatingNavProps {
  onNavigateTab: (tab: any) => void;
  onOpenLeaveRequest?: () => void;
  onJoinClass?: () => void;
  onDownloadReportCard?: () => void;
  hasReportCard?: boolean;
}

export const StudentFloatingNav: React.FC<StudentFloatingNavProps> = ({
  onNavigateTab,
  onOpenLeaveRequest,
  onJoinClass,
  onDownloadReportCard,
  hasReportCard,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Enabled action IDs (default: 'leave', 'join', 'results', 'report')
  const [enabledIds, setEnabledIds] = useState<QuickNavActionId[]>(() => {
    try {
      const saved = localStorage.getItem('student_quick_nav_shortcuts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['leave', 'join', 'results', 'report'];
  });

  const handleToggleOption = (id: QuickNavActionId) => {
    setEnabledIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      const finalIds: QuickNavActionId[] = next.length > 0 ? next : ['leave'];
      try {
        localStorage.setItem('student_quick_nav_shortcuts', JSON.stringify(finalIds));
      } catch {}
      return finalIds;
    });
  };

  const activeOptions = ALL_QUICK_OPTIONS.filter(opt => enabledIds.includes(opt.id));

  return (
    <>
      {/* Floating Action Button on Right Side */}
      <div className="fixed bottom-20 md:bottom-8 right-5 z-40 select-none flex flex-col items-end">
        {/* Expanded Popup Menu */}
        {isOpen && (
          <div className="mb-3 w-64 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-xl border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl p-2.5 space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-[#222222] mb-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#4BA95F]" />
                <span>Quick Navigator</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(true)}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Customize quick navigation shortcuts"
              >
                <Settings className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            {/* Quick Action List */}
            <div className="space-y-1">
              {activeOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === 'leave' && onOpenLeaveRequest) {
                        onOpenLeaveRequest();
                      } else if (opt.id === 'join' && onJoinClass) {
                        onJoinClass();
                      } else if (opt.id === 'report' && onDownloadReportCard) {
                        onDownloadReportCard();
                      } else if (opt.tabTarget) {
                        onNavigateTab(opt.tabTarget);
                      }
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202020] transition-colors cursor-pointer group"
                  >
                    <div className={`p-1.5 rounded-lg ${opt.color} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {opt.label}
                    </span>
                  </button>
                );
              })}

              {hasReportCard && onDownloadReportCard && (
                <button
                  type="button"
                  onClick={() => {
                    onDownloadReportCard();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202020] transition-colors cursor-pointer group"
                >
                  <div className="p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    Download Report Card
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Circular Action Button */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl shadow-[#4BA95F]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ${
            isOpen
              ? 'bg-slate-800 dark:bg-slate-700 rotate-45'
              : 'bg-gradient-to-tr from-[#4BA95F] to-[#77DDFA]'
          }`}
          title="Quick Navigation Menu"
          aria-label="Toggle quick navigation"
        >
          {isOpen ? <X className="w-5 h-5 text-white" /> : <Compass className="w-6 h-6 text-white animate-[spin_10s_linear_infinite]" />}
        </button>
      </div>

      {/* Customize Navigator Modal */}
      <Modal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        title="Customize Quick Navigator"
        maxWidth="max-w-sm"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose which shortcuts appear when you tap the floating navigation button.
          </p>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {ALL_QUICK_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isChecked = enabledIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleOption(opt.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-[#181818] border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{opt.label}</span>
                  </div>
                  {isChecked && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};
