import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  CheckSquare,
  FileSpreadsheet,
  Mail,
  Bell,
  FilePenLine,
  Sparkles,
  Trophy,
  GraduationCap,
  Download,
  Moon,
  Sun,
  X,
  BookOpen,
  LogOut,
  FileUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pin,
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
  noticeCount: number;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Custom Premium Tooltip Component
const SidebarTooltip: React.FC<{ text: string; children: React.ReactNode; disabled?: boolean }> = ({
  text,
  children,
  disabled,
}) => {
  if (disabled) return <>{children}</>;
  return (
    <div className="relative group/tooltip flex items-center justify-center">
      {children}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-white/10 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-150 transform scale-95 group-hover/tooltip:scale-100 whitespace-nowrap z-[100] pointer-events-none">
        {text}
      </div>
    </div>
  );
};

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
  noticeCount,
}) => {
  // Whole sidebar collapse (Icon rail mode)
  const [isWholeCollapsed, setIsWholeCollapsed] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleWholeCollapsed = () => {
    setIsWholeCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (err) {
        console.warn('Failed to save sidebar collapse state:', err);
      }
      return next;
    });
  };

  // Group collapsible state
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Pinned items state (Quick Access strip)
  const [pinned, setPinned] = React.useState<NavView[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar_pins');
      return saved ? JSON.parse(saved) : ['attend', 'notices', 'students'];
    } catch {
      return ['attend', 'notices', 'students'];
    }
  });

  const togglePin = (viewId: NavView) => {
    setPinned(prev => {
      let next: NavView[];
      if (prev.includes(viewId)) {
        next = prev.filter(p => p !== viewId);
      } else {
        next = [...prev, viewId];
        // Limit to max 3 pinned items. Swap out first pin if exceeded.
        if (next.length > 3) {
          next.shift();
        }
      }
      try {
        localStorage.setItem('sidebar_pins', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save pins:', err);
      }
      return next;
    });
  };

  const isPinned = (viewId: NavView) => pinned.includes(viewId);

  // Group definitions keeping the exact order and names requested
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
        { id: 'students' as NavView, label: 'Students', icon: Users },
        { id: 'classes' as NavView, label: 'Classes', icon: Layers },
      ],
    },
    {
      label: 'Attendance',
      items: [
        { id: 'attend' as NavView, label: 'Take Attendance', icon: CheckSquare },
        { id: 'attreport' as NavView, label: 'Attendance Report', icon: FileSpreadsheet },
        { id: 'permits' as NavView, label: 'Permission Requests', icon: Mail, badge: pendingPermissionCount },
        { id: 'notices' as NavView, label: 'Notices', icon: Bell, badge: noticeCount },
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
  ];

  // Helper mapping views to groups for auto-expanding
  const VIEW_TO_GROUP: Record<string, string> = {
    dash: 'Main',
    library: 'Main',
    students: 'People',
    classes: 'People',
    attend: 'Attendance',
    attreport: 'Attendance',
    permits: 'Attendance',
    notices: 'Attendance',
    adventure: 'Attendance',
    subjects: 'Marks & Ranking',
    classwork: 'Marks & Ranking',
    results: 'Marks & Ranking',
    report: 'Marks & Ranking',
  };

  const activeGroup = VIEW_TO_GROUP[currentView];

  const isGroupExpanded = (groupLabel: string) => {
    if (activeGroup === groupLabel) return true;
    return collapsedGroups[groupLabel] !== true; // Default to true (expanded)
  };

  const toggleGroup = (groupLabel: string) => {
    if (activeGroup === groupLabel) return; // Prevent collapsing active group
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupLabel]: !prev[groupLabel] };
      try {
        localStorage.setItem('sidebar_collapsed_groups', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save collapsed groups state:', err);
      }
      return next;
    });
  };

  // Collapse/Expand all groups toggle helper
  const handleCollapseExpandAll = () => {
    const anyExpanded = navSections.some(sec => isGroupExpanded(sec.label));
    const next: Record<string, boolean> = {};
    navSections.forEach(sec => {
      next[sec.label] = anyExpanded; // True means collapsed, false means expanded
    });
    setCollapsedGroups(next);
    try {
      localStorage.setItem('sidebar_collapsed_groups', JSON.stringify(next));
    } catch (err) {
      console.warn('Failed to save group states:', err);
    }
  };

  // Get total pending badges in a group when collapsed
  const getGroupBadgeCount = (groupLabel: string) => {
    if (groupLabel === 'Attendance') {
      return (pendingPermissionCount > 0 ? pendingPermissionCount : 0) + (noticeCount > 0 ? noticeCount : 0);
    }
    return 0;
  };

  // Flattened mapping of items for quick access lookup
  const allItems = React.useMemo(() => {
    return navSections.flatMap(sec => sec.items);
  }, [navSections]);

  const pinnedItems = React.useMemo(() => {
    return pinned
      .map(pId => allItems.find(item => item.id === pId))
      .filter((item): item is NavItem => item !== undefined);
  }, [pinned, allItems]);

  const brandInitials = profile.school
    ? profile.school.trim().slice(0, 2).toUpperCase()
    : 'CR';

  // Responsive constraint: Never collapse the sidebar to icon rail on mobile screen
  const isCollapsed = isWholeCollapsed && !isOpenMobile;
  const sidebarWidthClass = isCollapsed ? 'w-[64px]' : 'w-64';

  const content = (
    <div
      className={`flex flex-col h-full bg-white dark:bg-[#0C0C0C] text-slate-800 dark:text-white backdrop-blur-2xl border-r border-slate-200 dark:border-[#262626] ${sidebarWidthClass} select-none transition-all duration-300 relative`}
    >
      {/* Brand Header */}
      {!isCollapsed ? (
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-[#262626] h-[57px] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 dark:from-purple-800 dark:via-indigo-900 dark:to-purple-950 flex items-center justify-center font-bold text-white shadow-md text-xs tracking-wider shrink-0">
              {brandInitials}
            </div>
            <div className="leading-tight truncate">
              <h1 className="text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                Class Record
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                {profile.school || 'Academic Workspace'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleWholeCollapsed}
              className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {isOpenMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center border-b border-slate-200 dark:border-[#262626] h-[57px] shrink-0">
          <button
            type="button"
            onClick={toggleWholeCollapsed}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Card Block */}
      {!isCollapsed ? (
        <button
          type="button"
          onClick={() => {
            onNavigate('profile');
            if (isOpenMobile) onCloseMobile();
          }}
          className="mx-3 my-2.5 p-2 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] hover:bg-slate-100 dark:hover:bg-[#1b1b1b] transition-all text-left flex items-center gap-2.5 min-w-0 group/profile ring-1 ring-black/5"
        >
          {profile.photo ? (
            <img
              src={profile.photo}
              alt={profile.name || 'Teacher'}
              className="w-8.5 h-8.5 rounded-lg object-cover ring-2 ring-[#4BA95F]/50 shrink-0 group-hover/profile:scale-105 transition-transform"
            />
          ) : (
            <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-[#4BA95F] to-[#2d6f3b] flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm group-hover/profile:scale-105 transition-transform">
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'TC'}
            </div>
          )}
          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
              {profile.name || 'Teacher Profile'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {profile.role || 'Instructor'}
            </p>
          </div>
        </button>
      ) : (
        <div className="my-3 flex justify-center shrink-0">
          <SidebarTooltip text={`${profile.name || 'Teacher'} (${profile.role || 'Instructor'})`}>
            <button
              type="button"
              onClick={() => {
                onNavigate('profile');
                if (isOpenMobile) onCloseMobile();
              }}
              className="focus:outline-none focus:ring-2 focus:ring-[#4BA95F] rounded-lg p-0.5"
            >
              {profile.photo ? (
                <img
                  src={profile.photo}
                  alt={profile.name || 'Teacher'}
                  className="w-9 h-9 rounded-lg object-cover ring-2 ring-[#4BA95F]/50 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4BA95F] to-[#2d6f3b] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                  {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'TC'}
                </div>
              )}
            </button>
          </SidebarTooltip>
        </div>
      )}

      {/* Quick Access Strip */}
      {!isCollapsed && (
        <div className="mx-3 mb-2 shrink-0">
          <div className="px-1 mb-1.5 flex items-center justify-between text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
            <span>Quick Access</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50/40 dark:bg-[#141414]/30 border border-slate-200/50 dark:border-[#262626]/50 p-1.5 rounded-xl justify-around min-h-[44px]">
            {pinnedItems.length === 0 ? (
              <span className="text-[9px] text-slate-400 dark:text-slate-500 italic py-1">Pin items for quick link</span>
            ) : (
              pinnedItems.map(item => {
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
                    className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all cursor-pointer ${
                      active
                        ? 'bg-[#4BA95F] text-white shadow-md shadow-[#4BA95F]/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-[#1a1a1a]'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-white dark:border-[#0C0C0C]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Menu / Collapsible Header Toggle */}
      {!isCollapsed && (
        <div className="px-4 py-1.5 flex items-center justify-between border-b border-slate-200/50 dark:border-[#262626]/50 pb-1.5 mb-1 bg-slate-50/30 dark:bg-[#111111]/10 select-none shrink-0">
          <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Menu Navigation</span>
          <button
            type="button"
            onClick={handleCollapseExpandAll}
            className="text-[9px] font-extrabold text-[#4BA95F] dark:text-[#6cd283] hover:underline focus:outline-none focus:ring-1 focus:ring-[#4BA95F] px-1.5 py-0.5 rounded cursor-pointer"
          >
            {navSections.some(sec => isGroupExpanded(sec.label)) ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      )}

      {/* Navigation Sections Area (Middle - Only scrolling area) */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 custom-sidebar-scrollbar select-none">
        {navSections.map(sec => {
          const expanded = isGroupExpanded(sec.label);

          if (isCollapsed) {
            // Icon-only mode divider instead of header
            return (
              <div key={sec.label} className="space-y-1">
                <div className="border-t border-slate-200/50 dark:border-[#262626]/50 my-2 mx-1.5" />
                {sec.items.map(item => {
                  const active = currentView === item.id;
                  const Icon = item.icon;
                  return (
                    <SidebarTooltip key={item.id} text={item.label}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          if (isOpenMobile) onCloseMobile();
                        }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center relative transition-all cursor-pointer ${
                          active
                            ? 'bg-[#4BA95F]/15 text-[#4BA95F] dark:text-[#6cd283] border-l-2 border-[#4BA95F]'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a]'
                        }`}
                        aria-label={item.label}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {item.badge != null && item.badge > 0 && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-white dark:border-[#0C0C0C]" />
                        )}
                      </button>
                    </SidebarTooltip>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={sec.label} className="space-y-1">
              {/* Collapsible Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(sec.label)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-[#4BA95F] rounded-lg cursor-pointer text-left"
              >
                <span className="truncate">{sec.label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!expanded && getGroupBadgeCount(sec.label) > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Group items wrapper with height transitions */}
              <div
                className="transition-all duration-200 ease-in-out overflow-hidden space-y-0.5"
                style={{
                  maxHeight: expanded ? `${sec.items.length * 40}px` : '0px',
                  opacity: expanded ? 1 : 0,
                }}
              >
                {sec.items.map(item => {
                  const active = currentView === item.id;
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          if (isOpenMobile) onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative cursor-pointer ${
                          active
                            ? 'bg-[#4BA95F]/15 text-[#4BA95F] dark:text-[#6cd283] border-l-2 border-[#4BA95F] pl-2'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-[#1a1a1a]/60 pl-2.5'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              active
                                ? 'text-[#4BA95F] dark:text-[#6cd283]'
                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {/* Badges showing counts for Permission Requests and Notices */}
                        {item.badge != null && item.badge > 0 && (
                          <span className="text-[9px] font-bold font-mono bg-rose-500 text-white px-1.5 py-0.2 rounded-full shrink-0 group-hover:opacity-0 transition-opacity">
                            {item.badge}
                          </span>
                        )}
                      </button>

                      {/* Hover Pin trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(item.id);
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md bg-slate-50/50 dark:bg-[#1c1c1c]/50 hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-400 hover:text-[#FEA339] z-10 cursor-pointer focus:opacity-100 transition-opacity ${
                          isPinned(item.id) ? 'opacity-100 text-[#FEA339]' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title={isPinned(item.id) ? 'Unpin from Quick Access' : 'Pin to Quick Access'}
                      >
                        <Pin className={`w-3 h-3 ${isPinned(item.id) ? 'fill-[#FEA339] text-[#FEA339]' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Footer Controls (Never scrolls) */}
      <div className="p-3 border-t border-slate-200 dark:border-[#262626] bg-slate-50/80 dark:bg-[#111111]/80 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2.5">
            {/* Live Firestore indicator */}
            <div
              className="flex items-center gap-1.5 cursor-help"
              title="Firestore live database connection active and fully synced"
            >
              <span className="w-2 h-2 rounded-full bg-[#4BA95F] animate-pulse" />
              <span className="text-[10px] font-bold text-[#4BA95F] dark:text-[#6cd283] select-none">Live Sync</span>
            </div>

            {/* Quick Actions Buttons */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onBackup}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#FEA339] dark:hover:text-[#FEA339] hover:bg-slate-200/50 dark:hover:bg-[#1e1e1e] transition-all cursor-pointer"
                title="Export JSON Backup"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigate('import');
                  if (isOpenMobile) onCloseMobile();
                }}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#77DDFA] dark:hover:text-[#77DDFA] hover:bg-slate-200/50 dark:hover:bg-[#1e1e1e] transition-all cursor-pointer"
                title="Import JSON Data"
              >
                <FileUp className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#FEA339] dark:hover:text-[#FEA339] hover:bg-slate-200/50 dark:hover:bg-[#1e1e1e] rounded-lg transition-all cursor-pointer"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-[#FEA339]" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Collapsed dot status */}
            <div
              className="cursor-help py-1"
              title="Firestore live database connection active and fully synced"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#4BA95F] animate-pulse block" />
            </div>

            <SidebarTooltip text="Export JSON Backup">
              <button
                type="button"
                onClick={onBackup}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#FEA339] hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </SidebarTooltip>

            <SidebarTooltip text="Import JSON Data">
              <button
                type="button"
                onClick={() => {
                  onNavigate('import');
                  if (isOpenMobile) onCloseMobile();
                }}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#77DDFA] hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-all cursor-pointer"
              >
                <FileUp className="w-4 h-4" />
              </button>
            </SidebarTooltip>

            <SidebarTooltip text={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#FEA339] hover:bg-slate-100 dark:hover:bg-[#1e1e1e] rounded-lg transition-all cursor-pointer flex items-center justify-center"
              >
                {isDark ? <Sun className="w-4 h-4 text-[#FEA339]" /> : <Moon className="w-4 h-4" />}
              </button>
            </SidebarTooltip>

            {onLogout && (
              <SidebarTooltip text="Sign out of Google">
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </SidebarTooltip>
            )}
          </div>
        )}

        {/* Embedded Custom Styles */}
        <style>{`
          .custom-sidebar-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-sidebar-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(156, 163, 175, 0.25);
            border-radius: 4px;
          }
          .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(156, 163, 175, 0.45);
          }
        `}</style>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar with layout animation */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 z-30 shrink-0 ${sidebarWidthClass} transition-all duration-300`}
      >
        {content}
      </aside>

      {/* Mobile Drawer Slide-in Overlay */}
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
