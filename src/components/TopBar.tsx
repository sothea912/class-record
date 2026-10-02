import React from 'react';
import {
  Menu,
  Search,
  Printer,
  Sun,
  Moon,
  LogOut,
  Settings,
} from 'lucide-react';
import { NavView } from '../types';
import { CompactStatusIndicator } from './CompactStatusIndicator';

interface TopBarProps {
  currentView: NavView;
  onOpenMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  firestoreStatus?: 'connected' | 'connecting' | 'offline';
  isCloudSyncing?: boolean;
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  dash: { title: 'Dashboard Overview', subtitle: 'Live classroom health, daily attendance & rosters' },
  library: { title: 'Resource Library & Course Materials', subtitle: 'Course textbooks, lesson worksheets, PDF guides & announcements' },
  students: { title: 'Student Directory', subtitle: 'Manage student profiles, credentials & class assignments' },
  classes: { title: 'Class Management', subtitle: 'Class schedules, rooms, levels & enrollments' },
  attend: { title: 'Daily Attendance Register', subtitle: 'Quick-mark statuses, log absence excuses & late notes' },
  attreport: { title: 'Attendance Analytics & Reports', subtitle: 'Monthly aggregates, attendance rates & printable sheets' },
  permits: { title: 'Permission Requests Parser', subtitle: 'Auto-detect telegram excuses & bulk-file into registers' },
  notices: { title: 'Class Notices & Announcements Manager', subtitle: 'Hides and deletes class cancellations or makeup reschedules for all students' },
  activity: { title: 'Class Activity Center', subtitle: 'Create homework assignments, interactive question forms & grade student work' },
  subjects: { title: 'Subjects & Exam Scoring', subtitle: 'Grade exams, set component weights & track monthly tests' },
  classwork: { title: 'Classwork & Homework Tasks', subtitle: 'Record homework, project & achievement activities' },
  results: { title: 'Academic Ranking & Merit', subtitle: 'Comprehensive score calculation, pass/fail status & honors' },
  report: { title: 'Student Report Cards', subtitle: 'Monthly & termly performance breakdowns & export cards' },
  import: { title: 'Dedicated JSON File Import', subtitle: 'Upload JSON files to update classes, student rosters, marks, or store custom data' },
  profile: { title: 'Instructor Profile & School', subtitle: 'Manage official school heading, timetable & certificates' },
  adventure: { title: 'Adventurer Mode (Gamification)', subtitle: 'Track and reward student engagement, levels, XP & streaks' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onOpenMobileMenu,
  onOpenSearch,
  onOpenSettings,
  isDark,
  onToggleTheme,
  onLogout,
  firestoreStatus = 'connected',
  isCloudSyncing = true,
}) => {
  const viewInfo = VIEW_TITLES[currentView] || { title: 'Classroom', subtitle: '' };

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-slate-50/90 dark:bg-[#0C0C0C]/90 border-b border-slate-200/80 dark:border-[#262626] px-3 sm:px-6 py-2.5 sm:py-3 transition-colors no-print shadow-xs">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors shrink-0 cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="truncate">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {viewInfo.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {viewInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Compact Dual Status Indicator (Inner Dot = Cloud Sync, Outer Ring = Firestore Live) */}
          <div className="mr-1">
            <CompactStatusIndicator
              firestoreStatus={firestoreStatus}
              isCloudSyncing={isCloudSyncing}
            />
          </div>

          {/* Universal Command Center Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-50 dark:bg-[#181818] dark:text-slate-300 dark:hover:bg-[#222222] border border-slate-200/90 dark:border-[#2a2a2a] rounded-xl transition-all shadow-xs backdrop-blur-md cursor-pointer"
            title="Search students, classes, attendance, marks, resources (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-600 dark:text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Search command…</span>
            <kbd className="hidden md:inline-block text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#0C0C0C] dark:text-slate-500 dark:border-[#2a2a2a] px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Theme Mode Toggle (Light/Dark) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-[#181818] dark:hover:bg-[#222222] border border-slate-200/90 dark:border-[#2a2a2a] rounded-xl transition-colors shadow-xs backdrop-blur-md cursor-pointer"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle visual theme"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#FEA339] shrink-0" />
                <span className="hidden lg:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span className="hidden lg:inline">Dark</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-[#181818] dark:hover:bg-[#222222] border border-slate-200/90 dark:border-[#2a2a2a] rounded-xl transition-colors shadow-xs backdrop-blur-md cursor-pointer"
            title="Open Application Settings"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:flex p-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-[#181818] dark:hover:bg-[#222222] border border-slate-200/90 dark:border-[#2a2a2a] rounded-xl transition-colors shadow-xs backdrop-blur-md cursor-pointer"
            title="Print Current View"
          >
            <Printer className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          </button>

          {/* Teacher Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 sm:p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 bg-white hover:bg-rose-50 text-rose-600 dark:bg-transparent dark:text-slate-400 dark:border-transparent dark:hover:text-[#FF908D] dark:hover:bg-[#201515] border border-slate-200/90 rounded-xl transition-colors shadow-xs backdrop-blur-md cursor-pointer"
            title="Sign Out of Teacher Account"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
