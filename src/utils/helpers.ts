import { AppState, AttendanceStatus, StudentItem, StudentRankResult, SubjectItem } from '../types';

export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

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

export function gradeOf(pct: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
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

export function attCountsForMonth(classId: string, studentId: string, month: string, state: AppState) {
  const c = { P: 0, L: 0, E: 0, U: 0 };
  state.attendance
    .filter(a => a.classId === classId && a.date.startsWith(month))
    .forEach(a => {
      const r = (a.records || {})[studentId];
      if (r && r.status && c[r.status] != null) {
        c[r.status]++;
      }
    });
  return c;
}

export function attScoreForMonth(classId: string, studentId: string, month: string, state: AppState): number {
  const c = attCountsForMonth(classId, studentId, month, state);
  return Math.max(0, ATT_BASE - c.E * ATT_EXCUSED_PENALTY - c.U * ATT_UNEXCUSED_PENALTY);
}

export function attSummary(classId: string, studentId: string, months: string[], state: AppState) {
  const tot = { P: 0, L: 0, E: 0, U: 0 };
  let score = 0;
  months.forEach(m => {
    const c = attCountsForMonth(classId, studentId, m, state);
    tot.P += c.P;
    tot.L += c.L;
    tot.E += c.E;
    tot.U += c.U;
    score += attScoreForMonth(classId, studentId, m, state);
  });
  return { ...tot, score: round1(score), max: 100 * months.length };
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
  const attMax = 100 * months.length;

  months.forEach(m => {
    subjectMax += subs.reduce((a, s) => a + Number(s.max), 0);
    const cws = state.classwork.filter(w => w.classId === classId && w.month === m);
    workMax += cws.reduce((a, t) => a + Number(t.max), 0);
  });

  const rows: StudentRankResult[] = list.map(s => {
    const per: Record<string, { got: number; max: number; pct: number }> = {};
    let subjTotal = 0;

    subs.forEach(sub => {
      let got = 0;
      let max = 0;
      months.forEach(m => {
        const md = state.marks.find(mark => mark.subjectId === sub.id && mark.month === m);
        const v = md && md.scores ? md.scores[s.id] : null;
        if (v != null && v !== ('' as unknown as number)) got += Number(v);
        max += Number(sub.max);
      });
      per[sub.id] = { got: round1(got), max, pct: max ? round1((got / max) * 100) : 0 };
      subjTotal += got;
    });

    let work = 0;
    months.forEach(m => {
      const cws = state.classwork.filter(w => w.classId === classId && w.month === m);
      cws.forEach(t => {
        const v = (t.scores || {})[s.id];
        if (v != null && v !== ('' as unknown as number)) work += Number(v);
      });
    });

    const att = attSummary(classId, s.id, months, state);
    const total = subjTotal + work + att.score;
    const max = subjectMax + workMax + attMax;
    const pct = max ? round1((total / max) * 100) : 0;
    const comps = subs.length + (workMax ? 1 : 0) + 1; // +1 for attendance
    const grade = gradeOf(pct);

    return {
      student: s,
      per,
      work: round1(work),
      att,
      total: round1(total),
      max,
      pct,
      avg: comps ? round1(total / comps) : 0,
      grade,
      status: grade === 'F' ? 'Fail' : 'Pass',
      rank: 1,
      of: list.length,
    };
  });

  rows.sort((a, b) => b.total - a.total);
  let rank = 0;
  let prev: number | null = null;
  let seen = 0;

  rows.forEach(r => {
    seen++;
    if (r.total !== prev) {
      rank = seen;
      prev = r.total;
    }
    r.rank = rank;
    r.of = rows.length;
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
