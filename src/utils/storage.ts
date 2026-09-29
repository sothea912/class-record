import { AppState, ClassItem, StudentItem, SubjectItem } from '../types';
import { thisMonth, todayISO } from './helpers';

const STORAGE_KEY = 'classrecord_state_v2';

export const EMPTY_APP_STATE: AppState = {
  profile: {
    name: 'Soth Sothea (Albe)',
    role: 'English Lead Instructor',
    school: 'Central Academy',
    className: 'Main Campus',
    timeFrom: '19:00',
    timeTo: '20:30',
    photo: null,
  },
  teacherSecurity: {
    isConfigured: false,
    password: '',
  },
  classes: [],
  students: [],
  subjects: [],
  attendance: [],
  marks: [],
  classwork: [],
  studentPermissions: [],
  customRecords: [],
  banners: [
    {
      id: 'ban_1',
      title: 'Term 2 Mid-Semester Examinations Schedule',
      description: 'Exam timetable and revision guidelines for Listening, Speaking, Reading, and Writing assessments.',
      badge: 'Exam Schedule',
      bgColor: 'amber',
      order: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ban_2',
      title: 'New Digital Resource Library Now Live',
      description: 'Explore course textbooks, interactive grammar guides, PDF documents, and downloadable worksheets.',
      badge: 'Resource Library',
      bgColor: 'green',
      order: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ban_3',
      title: 'Weekend IELTS Intensive Workshop & Mock Tests',
      description: 'Enhance your IELTS speaking fluency and writing band score with personal instructor feedback.',
      badge: 'Special Workshop',
      bgColor: 'purple',
      order: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ban_4',
      title: 'Personalized Student Portal Analytics',
      description: 'Check your real-time attendance rate, class ranking, subject breakdowns, and downloadable report cards.',
      badge: 'Portal Update',
      bgColor: 'cyan',
      order: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  resources: [
    {
      id: 'res_1',
      title: 'English Grammar in Use — Advanced Reference & Practice',
      description: 'Comprehensive reference and practice guide for intermediate and advanced learners with answer key.',
      category: 'Books',
      fileName: 'Advanced_Grammar_Guide.pdf',
      fileSize: '12.4 MB',
      fileType: 'pdf',
      authorOrTeacher: 'Soth Sothea',
      downloadsCount: 42,
      tags: ['Grammar', 'Advanced', 'Reference'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'res_2',
      title: 'Oxford Academic Word List & Collocations Handbook',
      description: 'Essential vocabulary guide for IELTS, academic essays, and formal classroom presentations.',
      category: 'Books',
      fileName: 'Academic_Word_List_2026.pdf',
      fileSize: '8.1 MB',
      fileType: 'pdf',
      authorOrTeacher: 'Central Academy',
      downloadsCount: 38,
      tags: ['Vocabulary', 'IELTS', 'Academic'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'res_3',
      title: 'IELTS Academic Writing Task 1 & 2 Blueprint Guide',
      description: 'Complete band 7.5+ structure templates, vocabulary phrases, and model high-scoring answers.',
      category: 'PDF Documents',
      fileName: 'IELTS_Writing_Task_Blueprint.pdf',
      fileSize: '4.5 MB',
      fileType: 'pdf',
      authorOrTeacher: 'Soth Sothea',
      downloadsCount: 65,
      tags: ['IELTS', 'Writing', 'Band 7+'],
      createdAt: new Date().toISOString(),
    },
  ],
};

export const INITIAL_DEMO_DATA: AppState = EMPTY_APP_STATE;

export function scrubCamfirst<T>(val: T): T {
  if (typeof val === 'string') {
    return val.replace(/camfirst(\s*school)?/gi, 'Central Academy').trim() as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(scrubCamfirst) as unknown as T;
  }
  if (val && typeof val === 'object' && val !== null) {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = scrubCamfirst(v);
    }
    return res;
  }
  return val;
}

const AUTH_KEY = 'classrecord_auth_session';

export function loadAuthSession(): { role: 'teacher' | 'student'; studentId?: string; name: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return scrubCamfirst(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAuthSession(auth: { role: 'teacher' | 'student'; studentId?: string; name: string } | null): void {
  try {
    if (!auth) localStorage.removeItem(AUTH_KEY);
    else localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    // Ignore
  }
}

export const TEACHER_DEFAULT_SETUP_CODES = ['TEACHER2026', '123456', 'ALBE2026'];

export function loadStoredState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_APP_STATE;
    const rawParsed = JSON.parse(raw);
    const parsed = scrubCamfirst(rawParsed);

    const filteredClasses = Array.isArray(parsed.classes)
      ? parsed.classes.filter((c: ClassItem) => c.id !== 'c_evening_a' && c.name !== 'Evening English A')
      : [];
    const filteredStudents = Array.isArray(parsed.students)
      ? parsed.students.filter((s: StudentItem) => s.id !== 's_sokha' && s.name !== 'Chan Sokha' && s.id !== 's_visal')
      : [];

    return {
      profile: parsed.profile || EMPTY_APP_STATE.profile,
      teacherSecurity: parsed.teacherSecurity || { isConfigured: false, password: '' },
      classes: filteredClasses,
      students: filteredStudents,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      classwork: Array.isArray(parsed.classwork) ? parsed.classwork : [],
      studentPermissions: Array.isArray(parsed.studentPermissions) ? parsed.studentPermissions : [],
      customRecords: Array.isArray(parsed.customRecords) ? parsed.customRecords : [],
      banners: Array.isArray(parsed.banners) && parsed.banners.length > 0 ? parsed.banners : EMPTY_APP_STATE.banners,
      resources: Array.isArray(parsed.resources) && parsed.resources.length > 0 ? parsed.resources : EMPTY_APP_STATE.resources,
    };
  } catch (err) {
    console.warn('Failed to load state from localStorage', err);
    return EMPTY_APP_STATE;
  }
}

export function saveStoredState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage', err);
  }
}

export function exportBackupJSON(state: AppState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `class-record-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
