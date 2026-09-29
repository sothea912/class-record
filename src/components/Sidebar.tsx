import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  CheckSquare,
  FileSpreadsheet,
  Mail,
  FilePenLine,
  Sparkles,
  Trophy,
  GraduationCap,
  UserCog,
  Download,
  Moon,
  Sun,
  X,
  BookOpen,
  LogOut,
  FileUp,
  Zap,
} from 'lucide-react';
import { NavView, UserProfile } from '../types';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  profile: UserProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onBackup: () => void;
  onLogout?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  studentCount: number;
  classCount: number;
  pendingPermissionCount: number;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  profile,
  isDark,
  onToggleTheme,
  onBackup,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  studentCount,
  classCount,
  pendingPermissionCount,
}) => {
  const navSections: { label: string; items: NavItem[] }[] = [
    {
      label: 'Main',
      items: [
        { id: 'dash' as NavView, label: 'Overview', icon: LayoutDashboard },
        { id: 'library' as NavView, label: 'Resource Library', icon: BookOpen },
      ],
    },
    {
      label: 'People',
      items: [
        { id: 'students' as NavView, label: 'Students', icon: Users, badge: studentCount },
        { id: 'classes' as NavView, label: 'Classes', icon: Layers, badge: classCount },
      ],
    },
    {
      label: 'Attendance',
      items: [
        { id: 'attend' as NavView, label: 'Take Attendance', icon: CheckSquare },
        { id: 'attreport' as NavView, label: 'Attendance Report', icon: FileSpreadsheet },
        { id: 'permits' as NavView, label: 'Permission Requests', icon: Mail, badge: pendingPermissionCount },
        { id: 'adventure' as NavView, label: 'Adventurer Mode', icon: Zap },
      ],
    },
    {
      label: 'Marks & Ranking',
      items: [
        { id: 'subjects' as NavView, label: 'Subjects & Exams', icon: FilePenLine },
        { id: 'classwork' as NavView, label: 'Classwork', icon: Sparkles },
        { id: 'results' as NavView, label: 'Class Ranking', icon: Trophy },
        { id: 'report' as NavView, label: 'Report Cards', icon: GraduationCap },
      ],
    },
    {
      label: 'Data & Tools',
      items: [
        { id: 'import' as NavView, label: 'Import JSON File', icon: FileUp },
        { id: 'profile' as NavView, label: 'Teacher Profile', icon: UserCog },
      ],
    },
  ];

  const brandInitials = profile.school
    ? profile.school.trim().slice(0, 2).toUpperCase()
    : 'CR';

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0C0C0C] text-slate-800 dark:text-white backdrop-blur-2xl border-r border-slate-200 dark:border-[#262626] w-64 select-none">
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 dark:from-purple-800 dark:via-indigo-900 dark:to-purple-950 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/20 dark:shadow-purple-900/20 text-sm tracking-wider">
            {brandInitials}
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Class Record
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
              {profile.school || 'Academic Workspace'}
            </p>
          </div>
        </div>
        {isOpenMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Teacher Profile Card */}
      <div className="mx-3 my-3 p-3 rounded-xl bg-slate-100/90 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] shadow-inner">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt={profile.name || 'Teacher'}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#4BA95F]/50 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4BA95F] to-[#2d6f3b] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'TC'}
              </div>
            )}
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {profile.name || 'Teacher Profile'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {profile.role || 'Instructor'}
              </p>
              {(profile.timeFrom || profile.timeTo) && (
                <p className="text-[10px] text-[#4BA95F] dark:text-[#77DDFA] font-mono mt-0.5 font-semibold">
                  {profile.timeFrom || ''}–{profile.timeTo || ''}
                </p>
              )}
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
              title="Sign out of Google"
              aria-label="Sign out of Google"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
        {navSections.map(sec => (
          <div key={sec.label} className="space-y-1">
            <div className="px-2 text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              {sec.label}
            </div>
            {sec.items.map(item => {
              const active = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                    active
                      ? 'bg-[#4BA95F] text-white shadow-md shadow-[#4BA95F]/30 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        active ? 'text-white' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge != null && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        active
                          ? 'bg-[#3d8c4e] text-white'
                          : 'bg-slate-200 dark:bg-[#222222] text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-slate-200 dark:border-[#262626] space-y-2 bg-slate-50/80 dark:bg-[#111111]">
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4BA95F] animate-pulse" />
            <span className="font-medium text-[#4BA95F] dark:text-[#6cd283]">Firestore Live</span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1e1e1e] rounded-lg transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#FEA339]" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onNavigate('import');
              if (isOpenMobile) onCloseMobile();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#2a2a2a] rounded-xl transition-all shadow-sm"
            title="Import JSON Data"
          >
            <FileUp className="w-3.5 h-3.5 text-[#77DDFA] shrink-0" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={onBackup}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#2a2a2a] rounded-xl transition-all shadow-sm"
            title="Export JSON Backup"
          >
            <Download className="w-3.5 h-3.5 text-[#FEA339] shrink-0" />
            <span>Backup</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-[#FF908D] hover:bg-rose-50 dark:hover:bg-[#201515] rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Version watermark */}
        <div className="text-[9.5px] text-center italic text-slate-700 dark:text-slate-400 font-medium select-none pt-1 border-t border-slate-200 dark:border-slate-800/60 mt-1">
          Teacher Portal &middot; UI build 2026-09-28-r2
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 z-30 shrink-0">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
