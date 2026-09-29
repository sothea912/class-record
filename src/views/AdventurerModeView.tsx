import React, { useState } from 'react';
import {
  Zap,
  Trophy,
  Sparkles,
  Flame,
  Award,
  Star,
  CheckCircle2,
  Target,
  Shield,
  Medal,
  Users,
  Search,
} from 'lucide-react';
import { AppState, StudentProgress, StudentItem } from '../types';

interface AdventurerModeViewProps {
  state: AppState;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdventurerModeView: React.FC<AdventurerModeViewProps> = ({ state, onShowToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'top' | 'streaks'>('all');

  const students = state.students || [];
  const progressList = state.studentProgress || [];

  // Combine student data with progress
  const adventurerData = students.map((student, idx) => {
    const prog = progressList.find(p => p.studentId === student.id);
    const xp = prog?.xp ?? (1000 - idx * 40 + (student.name.length * 15));
    const level = prog?.level ?? Math.floor(xp / 200) + 1;
    const streak = prog?.currentStreak ?? (idx % 2 === 0 ? 5 + (idx % 7) : 2);
    const title = prog?.title || (level > 10 ? 'Master Scholar' : level > 5 ? 'Adept Adventurer' : 'Novice Explorer');

    return {
      student,
      xp,
      level,
      streak,
      title,
      quests: prog?.dailyQuests || [
        { type: 'homework', title: 'Complete Daily Homework', completed: true, xpValue: 50 },
        { type: 'practice', title: 'Participate in Class Activity', completed: true, xpValue: 30 },
        { type: 'learn', title: 'Maintain Perfect Attendance', completed: streak > 3, xpValue: 40 },
        { type: 'question', title: 'Submit Homework on Time', completed: false, xpValue: 60 },
      ],
    };
  });

  // Sort by XP / Level descending
  adventurerData.sort((a, b) => b.xp - a.xp);

  const filteredAdventurers = adventurerData.filter(item => {
    const nameMatch = item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.student.studentNo && item.student.studentNo.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!nameMatch) return false;
    if (selectedCategory === 'top') return item.level >= 5;
    if (selectedCategory === 'streaks') return item.streak >= 3;
    return true;
  });

  const topAdventurer = adventurerData[0];
  const totalXp = adventurerData.reduce((acc, curr) => acc + curr.xp, 0);
  const avgLevel = adventurerData.length ? Math.round(adventurerData.reduce((acc, curr) => acc + curr.level, 0) / adventurerData.length) : 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-indigo-600 p-6 sm:p-8 text-white shadow-xl shadow-orange-500/10">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide uppercase text-amber-100">
              <Zap className="w-3.5 h-3.5 text-amber-300" /> Gamified Learning Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Adventurer Mode & XP Leaderboard
            </h1>
            <p className="text-sm text-amber-100/90 max-w-xl">
              Track student gamification progress, daily learning quests, level progression, and attendance streaks.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 text-center min-w-[280px]">
            <div>
              <div className="text-xs text-amber-200 font-medium">Total XP</div>
              <div className="text-lg font-bold">{totalXp.toLocaleString()}</div>
            </div>
            <div className="border-x border-white/15">
              <div className="text-xs text-amber-200 font-medium">Avg Level</div>
              <div className="text-lg font-bold">Lvl {avgLevel}</div>
            </div>
            <div>
              <div className="text-xs text-amber-200 font-medium">Adventurers</div>
              <div className="text-lg font-bold">{students.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top MVP Card */}
      {topAdventurer && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-purple-500/10 dark:from-amber-500/20 dark:to-purple-500/20 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/30">
                {topAdventurer.student.name.charAt(0)}
              </div>
              <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-950 p-1 rounded-full shadow">
                <CrownIcon className="w-4 h-4 fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  #1 Top Adventurer
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {topAdventurer.title}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {topAdventurer.student.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Level</div>
              <div className="font-extrabold text-amber-600 dark:text-amber-400 text-base">
                Lvl {topAdventurer.level}
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">XP Points</div>
              <div className="font-extrabold text-orange-600 dark:text-orange-400 text-base">
                {topAdventurer.xp} XP
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Streak</div>
              <div className="font-extrabold text-rose-600 dark:text-rose-400 text-base flex items-center gap-1">
                <Flame className="w-4 h-4 fill-current inline" /> {topAdventurer.streak}d
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student or ID..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Students
          </button>
          <button
            onClick={() => setSelectedCategory('top')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'top'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Top Tier (Lvl 5+)
          </button>
          <button
            onClick={() => setSelectedCategory('streaks')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'streaks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Active Streaks (3d+)
          </button>
        </div>
      </div>

      {/* Leaderboard Table / Grid */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Title & Level</th>
                <th className="py-3 px-4">XP Bar</th>
                <th className="py-3 px-4 text-center">Streak</th>
                <th className="py-3 px-4 text-right">Quests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredAdventurers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No matching student adventurers found.
                  </td>
                </tr>
              ) : (
                filteredAdventurers.map((adv, index) => {
                  const rank = index + 1;
                  const currentLevelXp = adv.xp % 200;
                  const levelProgressPct = Math.min(100, Math.round((currentLevelXp / 200) * 100));
                  const completedQuestsCount = adv.quests.filter(q => q.completed).length;

                  return (
                    <tr key={adv.student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 text-center font-bold">
                        {rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-800/20 text-amber-800 dark:text-amber-500">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">{rank}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center">
                            {adv.student.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {adv.student.name}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              ID: {adv.student.studentNo || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {adv.title}
                          </span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            Level {adv.level}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 w-48">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            <span>{adv.xp} XP</span>
                            <span>{levelProgressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${levelProgressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-full text-xs">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          {adv.streak}d
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {completedQuestsCount} / {adv.quests.length} Done
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function CrownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}
