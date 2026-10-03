import { AppState, AttendanceRecord, AttendanceStatus, StudentItem, StudentRankResult, SubjectItem } from '../types';

export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Returns today's date formatted as YYYY-MM-DD in Cambodia local time (Asia/Phnom_Penh, UTC+7)
 */
export const todayCambodiaISO = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const utc7 = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
    return utc7.toISOString().slice(0, 10);
  }
};

export const thisMonth = (): string => new Date().toISOString().slice(0, 7);

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export const STATUS_MAP: Record<AttendanceStatus, string> = {
  P: 'Present',
  L: 'Late',
  E: 'Excused',
  U: 'Unexcused',
};

export const ATT_BASE = 100;
export const ATT_EXCUSED_PENALTY = 5;
export const ATT_UNEXCUSED_PENALTY = 1;

/**
 * Calculate attendance credit for a single session record:
 * - 0 to 5 mins: On time (credit 1.0)
 * - 6 to 10 mins: Late (credit 0.75)
 * - 11 to 1/3 duration: Very late (credit 0.5)
 * - Beyond 1/3 duration: No credit (0)
 * - Excused: 0.5
 * - Unexcused absent: 0
 * - Migration safe: old Late records without minutes are treated as 8 minutes
 */
export function getAttendanceCredit(
  rec?: AttendanceRecord | null,
  classDuration: number = 60
): number {
  if (!rec || !rec.status) return 0;

  if (rec.status === 'P') {
    const mins = rec.minutesLate ?? 0;
    if (mins <= 5) return 1.0;
    if (mins <= 10) return 0.75;
    if (mins <= classDuration / 3) return 0.5;
    return 0;
  }

  if (rec.status === 'L') {
    const mins = rec.minutesLate ?? 8;
    if (mins >= 0 && mins <= 5) return 1.0;
    if (mins >= 6 && mins <= 10) return 0.75;
    if (mins > 10 && mins <= classDuration / 3) return 0.5;
    return 0;
  }

  if (rec.status === 'E') {
    return 0.5;
  }

  if (rec.status === 'U') {
    return 0;
  }

  return 0;
}

/**
 * Get category label and credit for lateness minutes
 */
export function getLatenessInfo(minutesLate: number, classDuration: number = 60): {
  label: string;
  credit: number;
  badgeColor: string;
} {
  if (minutesLate <= 5) {
    return { label: 'On time', credit: 1.0, badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
  }
  if (minutesLate <= 10) {
    return { label: 'Late', credit: 0.75, badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
  }
  if (minutesLate <= classDuration / 3) {
    return { label: 'Very late', credit: 0.5, badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' };
  }
  return { label: 'No credit', credit: 0, badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' };
}

/**
 * Calculate minutes late given class start time (e.g. "20:00") and joined at time (e.g. "20:15")
 */
export function calcMinutesLateFromJoinedAt(classStartTime: string, joinedAtTime: string): number {
  if (!classStartTime || !joinedAtTime) return 0;
  const [sh, sm] = classStartTime.split(':').map(Number);
  const [jh, jm] = joinedAtTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(jh) || isNaN(jm)) return 0;
  const startTotal = sh * 60 + sm;
  const joinTotal = jh * 60 + jm;
  const diff = joinTotal - startTotal;
  return Math.max(0, diff);
}

/**
 * Calculate joined at time given class start time (e.g. "20:00") and minutes late (e.g. 15 -> "20:15")
 */
export function calcJoinedAtFromMinutes(classStartTime: string, minutesLate: number): string {
  if (!classStartTime) return '';
  const [sh, sm] = classStartTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm)) return '';
  const total = (sh * 60 + sm + (minutesLate || 0)) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check if a session date is on or after a student's enrollment date
 */
export function isSessionAfterEnrollment(sessionDate: string, student?: StudentItem | null): boolean {
  if (!student) return true;
  const enrollDate = student.enrolledAt || student.enrollmentDate || student.createdAt || student.joinedAt;
  if (!enrollDate) return true;
  const enrollDay = String(enrollDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(enrollDay)) return true;
  return sessionDate >= enrollDay;
}

export function gradeOf(pct: number | null): string {
  if (pct === null || isNaN(pct)) return '—';
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  if (pct >= 50) return 'E';
  return 'F';
}

export function monthName(m: string): string {
  if (!m) return '—';
  const [y, mm] = m.split('-');
  return new Date(+y, +mm - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

export function prevMonths(month: string, n: number): string[] {
  const out: string[] = [];
  let [y, m] = month.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

export const attKey = (cid: string, date: string): string => 'att_' + cid + '_' + date;

export const cls = (id: string, state: AppState) => state.classes.find(c => c.id === id);
export const stu = (id: string, state: AppState) => state.students.find(s => s.id === id);
export const studentsOf = (cid: string, state: AppState): StudentItem[] =>
  state.students.filter(s => s.classIds && s.classIds.includes(cid)).sort((a, b) => a.name.localeCompare(b.name));
export const subjectsOf = (cid: string, state: AppState): SubjectItem[] =>
  state.subjects.filter(s => s.classId === cid).sort((a, b) => (a.order || 0) - (b.order || 0));
export const attOf = (cid: string, date: string, state: AppState) =>
  state.attendance.find(a => a.id === attKey(cid, date));

export function lateCountForMonth(studentId: string, month: string, state: AppState, classId?: string): number {
  const student = state.students.find(s => s.id === studentId);
  let count = 0;

  state.attendance
    .filter(a => (!classId || a.classId === classId) && a.date.startsWith(month))
    .forEach(a => {
      if (!isSessionAfterEnrollment(a.date, student)) return;
      const r = (a.records || {})[studentId];
      if (r && r.status === 'L') {
        count++;
      }
    });

  return count;
}

export function getPunctualityWarning(studentId: string, month: string, state: AppState, classId?: string): {
  level: 'yellow' | 'red';
  count: number;
  label: string;
  badgeClass: string;
  description: string;
} | null {
  const count = lateCountForMonth(studentId, month, state, classId);
  if (count >= 5) {
    return {
      level: 'red',
      count,
      label: 'Punctuality Warning',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
      description: `${count} late arrivals in ${monthName(month)} (5+ threshold reached)`,
    };
  }
  if (count >= 3) {
    return {
      level: 'yellow',
      count,
      label: 'Punctuality Warning',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      description: `${count} late arrivals in ${monthName(month)} (3+ threshold reached)`,
    };
  }
  return null;
}

export function isClassCancelled(classId: string, date: string, state: AppState): boolean {
  if (!state.classCancellations) return false;
  return state.classCancellations.some(
    c => c.classId === classId && c.originalDate === date && c.markCancelled
  );
}

export function attCountsForMonth(classId: string, studentId: string, month: string, state: AppState) {
  const c = { P: 0, L: 0, E: 0, U: 0 };
  const student = state.students.find(s => s.id === studentId);
  state.attendance
    .filter(a => a.classId === classId && a.date.startsWith(month))
    .forEach(a => {
      if (isClassCancelled(classId, a.date, state)) return;
      if (!isSessionAfterEnrollment(a.date, student)) return;
      const r = (a.records || {})[studentId];
      if (r && r.status && c[r.status] != null) {
        c[r.status]++;
      }
    });
  return c;
}

export function attScoreForMonth(classId: string, studentId: string, month: string, state: AppState): number {
  const student = state.students.find(s => s.id === studentId);
  const clsObj = state.classes.find(c => c.id === classId);
  const duration = clsObj?.duration || 60;

  let totalCredit = 0;
  let sessionsHeld = 0;

  state.attendance
    .filter(a => a.classId === classId && a.date.startsWith(month))
    .forEach(a => {
      if (isClassCancelled(classId, a.date, state)) return;
      if (!isSessionAfterEnrollment(a.date, student)) return;
      const r = (a.records || {})[studentId];
      if (r && r.status) {
        sessionsHeld++;
        totalCredit += getAttendanceCredit(r, duration);
      }
    });

  if (sessionsHeld === 0) return 0;
  return round1((totalCredit / sessionsHeld) * 100);
}

export function attStatsForMonth(classId: string, studentId: string, month: string, state: AppState) {
  const student = state.students.find(s => s.id === studentId);
  const clsObj = state.classes.find(c => c.id === classId);
  const duration = clsObj?.duration || 60;

  const c = { P: 0, L: 0, E: 0, U: 0 };
  let totalCredit = 0;
  let sessionsHeld = 0;

  state.attendance
    .filter(a => a.classId === classId && a.date.startsWith(month))
    .forEach(a => {
      if (isClassCancelled(classId, a.date, state)) return;
      if (!isSessionAfterEnrollment(a.date, student)) return;
      const r = (a.records || {})[studentId];
      if (r && r.status) {
        sessionsHeld++;
        if (c[r.status] != null) c[r.status]++;
        totalCredit += getAttendanceCredit(r, duration);
      }
    });

  const rate = sessionsHeld > 0 ? (totalCredit / sessionsHeld) * 100 : null;
  const ratePct = rate !== null ? `${round1(rate)}%` : '—';

  return {
    ...c,
    totalCredit: round1(totalCredit),
    sessionsHeld,
    rate: rate !== null ? round1(rate) : null,
    ratePct,
  };
}

export function attSummary(classId: string, studentId: string, months: string[], state: AppState) {
  const student = state.students.find(s => s.id === studentId);
  const clsObj = state.classes.find(c => c.id === classId);
  const duration = clsObj?.duration || 60;

  const tot = { P: 0, L: 0, E: 0, U: 0 };
  let totalCredit = 0;
  let sessionsHeld = 0;

  months.forEach(m => {
    state.attendance
      .filter(a => a.classId === classId && a.date.startsWith(m))
      .forEach(a => {
        if (isClassCancelled(classId, a.date, state)) return;
        if (!isSessionAfterEnrollment(a.date, student)) return;
        const r = (a.records || {})[studentId];
        if (r && r.status) {
          sessionsHeld++;
          if (tot[r.status] != null) tot[r.status]++;
          totalCredit += getAttendanceCredit(r, duration);
        }
      });
  });

  const rate = sessionsHeld > 0 ? (totalCredit / sessionsHeld) * 100 : null;
  const score = rate !== null ? round1(rate) : 0;
  const max = sessionsHeld > 0 ? 100 : 0;

  return {
    ...tot,
    totalCredit: round1(totalCredit),
    sessionsHeld,
    score,
    max,
    rate: rate !== null ? round1(rate) : null,
    ratePct: rate !== null ? `${round1(rate)}%` : '—',
  };
}

export function rosterFor(classId: string, months: string[], state: AppState): StudentItem[] {
  const ids = new Set(
    state.students
      .filter(s => s.classIds && s.classIds.includes(classId))
      .map(s => s.id)
  );

  state.attendance
    .filter(a => a.classId === classId && months.includes(a.date.slice(0, 7)))
    .forEach(a => Object.keys(a.records || {}).forEach(id => ids.add(id)));

  const subs = state.subjects.filter(s => s.classId === classId);
  subs.forEach(sub =>
    months.forEach(m => {
      const md = state.marks.find(mark => mark.subjectId === sub.id && mark.month === m);
      if (md && md.scores) Object.keys(md.scores).forEach(id => ids.add(id));
    })
  );

  months.forEach(m => {
    const cws = state.classwork.filter(w => w.classId === classId && w.month === m);
    cws.forEach(t => Object.keys(t.scores || {}).forEach(id => ids.add(id)));
  });

  return [...ids]
    .map(id => state.students.find(s => s.id === id))
    .filter((s): s is StudentItem => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function computeResults(
  classId: string,
  months: string[],
  state: AppState
): {
  rows: StudentRankResult[];
  subs: SubjectItem[];
  subjectMax: number;
  workMax: number;
  attMax: number;
} {
  const subs = state.subjects.filter(s => s.classId === classId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const list = rosterFor(classId, months, state);

  let subjectMax = 0;
  let workMax = 0;

  months.forEach(m => {
    subjectMax += subs.reduce((a, s) => a + Number(s.max), 0);
    const cws = state.classwork.filter(w => w.classId === classId && w.month === m);
    workMax += cws.reduce((a, t) => a + Number(t.max), 0);
  });

  // Check if any attendance sessions were held in this period
  const totalSessionsInPeriod = state.attendance.filter(
    a => a.classId === classId && months.includes(a.date.slice(0, 7))
  ).length;
  const attMax = totalSessionsInPeriod > 0 ? 100 : 0;

  const rows: StudentRankResult[] = list.map(s => {
    const per: Record<string, { got: number; max: number; pct: number }> = {};
    let subjTotal = 0;
    let hasSubjectScores = false;

    subs.forEach(sub => {
      let got = 0;
      let max = 0;
      months.forEach(m => {
        const md = state.marks.find(mark => mark.subjectId === sub.id && mark.month === m);
        const v = md && md.scores ? md.scores[s.id] : null;
        if (v != null && v !== ('' as unknown as number)) {
          got += Number(v);
          hasSubjectScores = true;
        }
        max += Number(sub.max);
      });
      per[sub.id] = { got: round1(got), max, pct: max ? round1((got / max) * 100) : 0 };
      subjTotal += got;
    });

    let work = 0;
    let hasWorkScores = false;
    months.forEach(m => {
      const cws = state.classwork.filter(w => w.classId === classId && w.month === m);
      cws.forEach(t => {
        const v = (t.scores || {})[s.id];
        if (v != null && v !== ('' as unknown as number)) {
          work += Number(v);
          hasWorkScores = true;
        }
      });
    });

    const att = attSummary(classId, s.id, months, state);
    const hasAttData = att.sessionsHeld > 0;
    const hasData = hasAttData || hasSubjectScores || hasWorkScores;

    const total = subjTotal + work + (hasAttData ? att.score : 0);
    const max = subjectMax + workMax + (hasAttData ? 100 : 0);
    const pct = hasData && max > 0 ? round1((total / max) * 100) : null;
    const comps = subs.length + (workMax ? 1 : 0) + (hasAttData ? 1 : 0);
    const avg = hasData && comps > 0 ? round1(total / comps) : 0;
    const grade = hasData && pct !== null ? gradeOf(pct) : '—';
    const status = hasData && pct !== null ? (pct >= 50 ? 'Pass' : 'Fail') : '—';

    return {
      student: s,
      per,
      work: round1(work),
      att,
      total: round1(total),
      max,
      pct,
      avg,
      grade,
      status,
      rank: null,
      of: list.length,
      hasData,
    };
  });

  // Rank only students who have recorded data
  const activeRows = rows.filter(r => r.hasData);
  activeRows.sort((a, b) => b.total - a.total);

  let rank = 0;
  let prev: number | null = null;
  let seen = 0;

  activeRows.forEach(r => {
    seen++;
    if (r.total !== prev) {
      rank = seen;
      prev = r.total;
    }
    r.rank = rank;
    r.of = activeRows.length;
  });

  // Sort all rows: active ranked first by rank, unranked at the end
  rows.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1;
    if (!a.hasData && b.hasData) return 1;
    if (a.hasData && b.hasData) {
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    }
    return a.student.name.localeCompare(b.student.name);
  });

  return { rows, subs, subjectMax, workMax, attMax };
}

export function sortStudents(list: StudentItem[], key: string): StudentItem[] {
  const arr = [...list];
  const byName = (a: StudentItem, b: StudentItem) => a.name.localeCompare(b.name);
  const byNo = (a: StudentItem, b: StudentItem) => {
    const na = (a.studentNo || '').trim();
    const nb = (b.studentNo || '').trim();
    const pa = parseFloat(na);
    const pb = parseFloat(nb);
    if (!isNaN(pa) && !isNaN(pb) && pa !== pb) return pa - pb;
    return na.localeCompare(nb, undefined, { numeric: true }) || byName(a, b);
  };

  if (key === 'name-desc') return arr.sort((a, b) => byName(b, a));
  if (key === 'no') return arr.sort(byNo);
  if (key === 'recent') return arr.reverse();
  return arr.sort(byName);
}

/**
 * Formats a permission request submission / decision date & time in local device time.
 * Output format: "M/D/YYYY · HH:mm" (e.g. "9/30/2026 · 20:24").
 * If the input is a legacy date-only string (e.g. "2026-09-30"), it returns only the date (e.g. "9/30/2026")
 * and avoids displaying fake times (such as 00:00 or 07:00).
 */
export function formatRequestDateTime(val?: any): string {
  if (!val) return '';

  // 1. Firestore Timestamp or object with toDate / seconds
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') {
      const d: Date = val.toDate();
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${datePart} · ${hours}:${mins}`;
      }
    }
    if (typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${datePart} · ${hours}:${mins}`;
      }
    }
  }

  // 2. Numeric timestamp (ms)
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} · ${hours}:${mins}`;
    }
  }

  // 3. String timestamp
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return '';

    // Check if it is a pure date string (no time component, e.g. "2026-09-30", "9/30/2026")
    const hasTimeComponent = str.includes('T') || (str.includes(':') && !str.startsWith('http'));
    if (!hasTimeComponent) {
      // Split YYYY-MM-DD to avoid timezone shifting when creating Date
      const parts = str.split(/[-/]/);
      if (parts.length === 3 && parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        return dateObj.toLocaleDateString();
      }
      const d = new Date(str);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : str;
    }

    // Has time component (e.g. ISO string "2026-10-01T13:40:00.000Z")
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} · ${hours}:${mins}`;
    }

    return str;
  }

  return '';
}

/**
 * Resize and center-crop image to 16:9 (640x360) JPEG format under 50KB for activity thumbnails
 */
export function processThumbnailImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = 640;
        const targetHeight = 360;
        const targetAspect = 16 / 9;
        const sourceAspect = img.width / img.height;

        let srcX = 0;
        let srcY = 0;
        let srcW = img.width;
        let srcH = img.height;

        if (sourceAspect > targetAspect) {
          srcW = img.height * targetAspect;
          srcX = (img.width - srcW) / 2;
        } else {
          srcH = img.width / targetAspect;
          srcY = (img.height - srcH) / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);

        // Quality 0.72 produces high quality 640x360 image ~30-45KB (under 50KB limit)
        const base64 = canvas.toDataURL('image/jpeg', 0.72);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export interface DifficultyMeta {
  level: number;
  label: string;
  shortLabel: string;
  badgeClass: string;
  stars: string;
}

export const DIFFICULTY_LEVELS: Record<number, DifficultyMeta> = {
  1: { level: 1, label: 'Very Easy', shortLabel: 'V. Easy', badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', stars: '★☆☆☆☆' },
  2: { level: 2, label: 'Easy', shortLabel: 'Easy', badgeClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20', stars: '★★☆☆☆' },
  3: { level: 3, label: 'Medium', shortLabel: 'Medium', badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20', stars: '★★★☆☆' },
  4: { level: 4, label: 'Hard', shortLabel: 'Hard', badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20', stars: '★★★★☆' },
  5: { level: 5, label: 'Very Hard', shortLabel: 'V. Hard', badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20', stars: '★★★★★' },
};

export const getDifficultyMeta = (diff?: number): DifficultyMeta => {
  return DIFFICULTY_LEVELS[diff || 3] || DIFFICULTY_LEVELS[3];
};

export type UrgencyLevel = 'overdue' | 'urgent' | 'medium' | 'long' | 'submitted';

export interface UrgencyMeta {
  level: UrgencyLevel;
  label: string;
  badgeClass: string;
  dotColor: string;
  sortRank: number; // 1: Overdue, 2: Urgent, 3: Medium, 4: Long, 5: Submitted
}

/**
 * Calculates urgency badge and sort rank automatically from due time (Cambodia UTC+7)
 * - Overdue = due in the past and not submitted -> red badge, sorts first
 * - Urgent = within 48 hours -> red badge
 * - Medium = within 7 days -> orange badge
 * - Long = later than 7 days or flexible -> blue badge
 * - Submitted / Marked -> drops to the bottom
 */
export function getActivityUrgency(dueDateTimeStr?: string, isSubmitted = false): UrgencyMeta {
  if (isSubmitted) {
    return {
      level: 'submitted',
      label: 'Submitted',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dotColor: 'bg-emerald-500',
      sortRank: 5,
    };
  }

  if (!dueDateTimeStr) {
    return {
      level: 'long',
      label: 'Flexible',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      dotColor: 'bg-blue-500',
      sortRank: 4,
    };
  }

  const dueDate = new Date(dueDateTimeStr);
  if (isNaN(dueDate.getTime())) {
    return {
      level: 'long',
      label: 'Flexible',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      dotColor: 'bg-blue-500',
      sortRank: 4,
    };
  }

  const now = Date.now();
  const diffMs = dueDate.getTime() - now;

  if (diffMs < 0) {
    return {
      level: 'overdue',
      label: 'Overdue',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse',
      dotColor: 'bg-rose-600',
      sortRank: 1,
    };
  }

  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 48) {
    return {
      level: 'urgent',
      label: 'Urgent (<48h)',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      dotColor: 'bg-rose-500',
      sortRank: 2,
    };
  }

  if (diffHours <= 7 * 24) {
    return {
      level: 'medium',
      label: 'Medium (≤7d)',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dotColor: 'bg-amber-500',
      sortRank: 3,
    };
  }

  return {
    level: 'long',
    label: 'Long (>7d)',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    sortRank: 4,
  };
}

