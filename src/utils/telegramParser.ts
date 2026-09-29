import { AppState, AttendanceStatus, ClassItem, StudentItem } from '../types';
import { todayISO } from './helpers';

export interface ParsedPermission {
  rawName: string;
  classId: string;
  studentId: string;
  date: string;
  reason: string;
  status: AttendanceStatus;
  matched: boolean;
}

export function matchClassByName(className: string, classes: ClassItem[]): string {
  if (!className) return classes[0]?.id || '';
  const n = className.toLowerCase().trim();
  const exact = classes.find(c => c.name.toLowerCase().trim() === n);
  if (exact) return exact.id;
  const partial = classes.find(c => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  return partial ? partial.id : classes[0]?.id || '';
}

export function matchStudentByName(name: string, classId: string, students: StudentItem[]): string {
  if (!name) return '';
  const pool = classId ? students.filter(s => s.classIds && s.classIds.includes(classId)) : students;
  const n = name.toLowerCase().trim();
  const exact = pool.find(s => s.name.toLowerCase().trim() === n);
  if (exact) return exact.id;
  const partial = pool.find(s => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase()));
  return partial ? partial.id : '';
}

export function parsePermissionText(text: string, state: AppState): ParsedPermission[] {
  const cleaned = text.replace(/[📋✉️🙏📝]?\s*permission request:?/gi, '');
  const blocks = cleaned
    .split(/(?=name\s*:)/i)
    .map(b => b.trim())
    .filter(Boolean);

  return blocks
    .map(b => {
      const get = (re: RegExp): string => {
        const m = b.match(re);
        return m ? m[1].trim() : '';
      };
      const rawName = get(/name\s*:\s*(.+)/i);
      const className = get(/class\s*:\s*(.+)/i);
      let date = get(/date\s*:\s*(.+)/i);
      const reason = get(/reason\s*:\s*([\s\S]*)/i)
        .split(/\n\s*\n/)[0]
        .replace(/\n+$/, '')
        .trim();

      const dm = date.match(/(\d{4})-(\d{2})-(\d{2})/);
      date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : date || todayISO();

      const classId = matchClassByName(className, state.classes);
      const studentId = matchStudentByName(rawName, classId, state.students);

      return {
        rawName,
        classId,
        studentId,
        date,
        reason,
        status: 'E' as AttendanceStatus,
        matched: Boolean(studentId),
      };
    })
    .filter(e => Boolean(e.rawName));
}
