import React from 'react';
import {
  Settings,
  UserCog,
  ShieldCheck,
  Moon,
  Sun,
  Download,
  LogOut,
  X,
  Layers,
  Database,
  ExternalLink,
} from 'lucide-react';
import { NavView, UserProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: NavView) => void;
  profile: UserProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onBackup: () => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  profile,
  isDark,
  onToggleTheme,
  onBackup,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-6 sm:pt-16">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-[#121212] border border-slate-200/90 dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#1c1c1c] text-slate-700 dark:text-slate-200">
              <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Settings</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Application controls & profile</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Teacher Profile Quick Access */}
          <button
            type="button"
            onClick={() => {
              onNavigate('profile');
              onClose();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#181818] dark:hover:bg-[#202020] border border-slate-200/70 dark:border-[#2a2a2a] transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'TC'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                  {profile.name || 'Teacher Profile'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {profile.school || 'Academic Workspace'} &bull; {profile.role || 'Instructor'}
                </p>
              </div>
            </div>
            <UserCog className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
          </button>

          {/* Student Portal & Accounts Sync */}
          <button
            type="button"
            onClick={() => {
              onNavigate('profile');
              onClose();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#181818] dark:hover:bg-[#202020] border border-slate-200/70 dark:border-[#2a2a2a] transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Student Portal & Auth
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Manage login accounts & security sync
                </p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </button>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200/70 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-2.5">
              {isDark ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Appearance Mode
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#222222] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#333333] hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-all cursor-pointer shadow-2xs"
            >
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>

          {/* Backup Data Export */}
          <button
            type="button"
            onClick={() => {
              onBackup();
              onClose();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#181818] dark:hover:bg-[#202020] border border-slate-200/70 dark:border-[#2a2a2a] transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  Export JSON Backup
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Download offline snapshot of database
                </p>
              </div>
            </div>
            <Database className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
          </button>
        </div>

        {/* Footer: Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#101010]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Instructor Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
