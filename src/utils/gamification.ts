import { StudentProgress, DailyQuest, AttendanceSession } from '../types';

export const AVATAR_OPTIONS = [
  { id: 'avatar_1', name: 'Scholar Dragon', icon: '🐲', color: 'from-amber-500 to-red-500' },
  { id: 'avatar_2', name: 'Cyber Owl', icon: '🦉', color: 'from-blue-500 to-indigo-500' },
  { id: 'avatar_3', name: 'Phoenix Rising', icon: '🦅', color: 'from-orange-500 to-amber-500' },
  { id: 'avatar_4', name: 'Tech Tiger', icon: '🐯', color: 'from-emerald-500 to-teal-500' },
  { id: 'avatar_5', name: 'Galactic Lion', icon: '🦁', color: 'from-purple-500 to-pink-500' },
  { id: 'avatar_6', name: 'Astra Fox', icon: '🦊', color: 'from-rose-500 to-orange-500' },
];

export function getLevelAndProgressFromXp(xp: number = 0) {
  const levelXpStep = 200;
  const level = Math.floor(xp / levelXpStep) + 1;
  const currentXp = xp % levelXpStep;
  const xpForNextLevel = levelXpStep;
  const progressPct = Math.min(100, Math.round((currentXp / levelXpStep) * 100));

  let title = 'Novice Explorer';
  if (level >= 15) title = 'Grand Master Scholar';
  else if (level >= 10) title = 'Master Adventurer';
  else if (level >= 7) title = 'Expert Scholar';
  else if (level >= 4) title = 'Adept Adventurer';
  else if (level >= 2) title = 'Apprentice Scholar';

  return {
    level,
    currentXp,
    xpForNextLevel,
    progressPct,
    title,
  };
}

export function calculateAttendanceScore(studentId: string, attendance: AttendanceSession[] = []): number {
  if (!attendance || attendance.length === 0) return 100;
  let present = 0;
  let total = 0;

  for (const session of attendance) {
    if (session.records && session.records[studentId]) {
      total++;
      const st = session.records[studentId].status;
      if (st === 'P') present += 1;
      else if (st === 'L') present += 0.8;
      else if (st === 'E') present += 0.9;
    }
  }

  if (total === 0) return 100;
  return Math.round((present / total) * 100);
}

export function createDefaultProgress(studentId: string): StudentProgress {
  const defaultQuests: DailyQuest[] = [
    { type: 'homework', title: 'Complete Daily Homework Task', completed: false, xpValue: 50 },
    { type: 'practice', title: 'Attend Scheduled Class Session', completed: true, xpValue: 30 },
    { type: 'learn', title: 'Review Course Material & Notes', completed: false, xpValue: 40 },
    { type: 'question', title: 'Maintain 5-Day Attendance Streak', completed: true, xpValue: 60 },
  ];

  return {
    id: `prog_${studentId}`,
    studentId,
    xp: 250,
    level: 2,
    title: 'Apprentice Scholar',
    currentStreak: 5,
    longestStreak: 7,
    dailyQuests: defaultQuests,
    avatarId: 'avatar_1',
    overallScore: 92,
  };
}
