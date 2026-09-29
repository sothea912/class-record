import {
  AppState,
  AttendanceSession,
  ClassItem,
  ClassworkTask,
  CustomRecordItem,
  MarkDoc,
  StudentItem,
  SubjectItem,
  UserProfile,
} from '../types';
import { scrubCamfirst } from './storage';
import { todayISO, uid } from './helpers';

export interface ParsedJSONResult {
  success: boolean;
  error?: string;
  data: Partial<AppState>;
  stats: {
    classCount: number;
    studentCount: number;
    subjectCount: number;
    attendanceCount: number;
    markCount: number;
    classworkCount: number;
    customRecordCount: number;
    hasProfile: boolean;
  };
  summaryText: string;
  samplePreview: {
    classes: string[];
    students: string[];
    customRecordTitles: string[];
  };
}

/**
 * Intelligent JSON Parser that handles full backups, partial rosters, class lists, or arbitrary custom information.
 */
export function parseImportJSON(rawText: string, existingState: AppState): ParsedJSONResult {
  try {
    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        error: 'JSON text or file is empty.',
        data: {},
        stats: {
          classCount: 0,
          studentCount: 0,
          subjectCount: 0,
          attendanceCount: 0,
          markCount: 0,
          classworkCount: 0,
          customRecordCount: 0,
          hasProfile: false,
        },
        summaryText: 'Empty payload',
        samplePreview: { classes: [], students: [], customRecordTitles: [] },
      };
    }

    const rawParsed = JSON.parse(rawText);
    const parsed = scrubCamfirst(rawParsed);

    const defaultClassId = existingState.classes[0]?.id || 'cls_default';
    const result: Partial<AppState> = {
      classes: [],
      students: [],
      subjects: [],
      attendance: [],
      marks: [],
      classwork: [],
      customRecords: [],
    };

    // Case 1: Root is an Array
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return {
          success: false,
          error: 'The uploaded JSON array contains no items.',
          data: {},
          stats: {
            classCount: 0,
            studentCount: 0,
            subjectCount: 0,
            attendanceCount: 0,
            markCount: 0,
            classworkCount: 0,
            customRecordCount: 0,
            hasProfile: false,
          },
          summaryText: 'Empty array',
          samplePreview: { classes: [], students: [], customRecordTitles: [] },
        };
      }

      const first = parsed[0];
      // Check if it's an array of students (has name, studentNo, sex, guardian, dob, etc.)
      if (first && typeof first === 'object' && ('name' in first || 'studentName' in first || 'fullName' in first)) {
        result.students = parsed.map((item, idx) => normalizeStudent(item, idx, defaultClassId, existingState.classes));
      } else if (first && typeof first === 'object' && ('className' in first || 'room' in first || ('name' in first && 'level' in first))) {
        // Array of classes
        result.classes = parsed.map((item, idx) => normalizeClass(item, idx));
      } else if (first && typeof first === 'object' && ('subject' in first || ('name' in first && 'max' in first))) {
        // Array of subjects
        result.subjects = parsed.map((item, idx) => normalizeSubject(item, idx, defaultClassId));
      } else {
        // Array of arbitrary custom information records
        result.customRecords = parsed.map((item, idx) => ({
          id: item.id || `custom_${uid()}_${idx}`,
          category: item.category || item.type || 'Imported Information',
          title: item.title || item.name || `Record #${idx + 1}`,
          data: typeof item === 'object' && item !== null ? item : { value: item },
          createdAt: item.createdAt || new Date().toISOString(),
        }));
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Case 2: Root is an Object
      // Check for AppState fields
      if (Array.isArray(parsed.classes)) {
        result.classes = parsed.classes.map((c: any, i: number) => normalizeClass(c, i));
      }

      if (Array.isArray(parsed.students)) {
        result.students = parsed.students.map((s: any, i: number) =>
          normalizeStudent(s, i, defaultClassId, [...existingState.classes, ...(result.classes || [])])
        );
      }

      if (Array.isArray(parsed.subjects)) {
        result.subjects = parsed.subjects.map((sub: any, i: number) => normalizeSubject(sub, i, defaultClassId));
      }

      if (Array.isArray(parsed.attendance)) {
        result.attendance = parsed.attendance.filter(
          (a: any) => a && typeof a === 'object' && a.classId && a.date
        );
      }

      if (Array.isArray(parsed.marks)) {
        result.marks = parsed.marks.filter((m: any) => m && typeof m === 'object' && m.subjectId);
      }

      if (Array.isArray(parsed.classwork)) {
        result.classwork = parsed.classwork.filter((cw: any) => cw && typeof cw === 'object' && cw.title);
      }

      if (parsed.profile && typeof parsed.profile === 'object') {
        result.profile = {
          name: parsed.profile.name || '',
          role: parsed.profile.role || '',
          school: parsed.profile.school ? scrubCamfirst(parsed.profile.school) : '',
          className: parsed.profile.className || '',
          timeFrom: parsed.profile.timeFrom || '',
          timeTo: parsed.profile.timeTo || '',
          photo: parsed.profile.photo || null,
        };
      }

      if (parsed.teacherSecurity && typeof parsed.teacherSecurity === 'object') {
        result.teacherSecurity = parsed.teacherSecurity;
      }

      // Check for custom records or extra keys in the object
      if (Array.isArray(parsed.customRecords)) {
        result.customRecords = parsed.customRecords.map((cr: any, i: number) => ({
          id: cr.id || `custom_${uid()}_${i}`,
          category: cr.category || 'Custom Data',
          title: cr.title || `Entry #${i + 1}`,
          data: cr.data || cr,
          createdAt: cr.createdAt || new Date().toISOString(),
        }));
      }

      // If the object contains other top-level keys not part of standard AppState (e.g. "schoolInfo", "curriculum", "announcements", "calendar")
      const standardKeys = new Set([
        'classes',
        'students',
        'subjects',
        'attendance',
        'marks',
        'classwork',
        'studentPermissions',
        'profile',
        'teacherSecurity',
        'customRecords',
      ]);

      const extraKeys = Object.keys(parsed).filter(k => !standardKeys.has(k));
      if (extraKeys.length > 0) {
        extraKeys.forEach((key, idx) => {
          const val = parsed[key];
          result.customRecords!.push({
            id: `info_${key}_${uid()}`,
            category: 'External Information',
            title: formatTitle(key),
            data: typeof val === 'object' && val !== null ? val : { [key]: val },
            createdAt: new Date().toISOString(),
          });
        });
      }
    } else {
      return {
        success: false,
        error: 'Invalid JSON format. Expected an object or an array of records.',
        data: {},
        stats: {
          classCount: 0,
          studentCount: 0,
          subjectCount: 0,
          attendanceCount: 0,
          markCount: 0,
          classworkCount: 0,
          customRecordCount: 0,
          hasProfile: false,
        },
        summaryText: 'Invalid JSON',
        samplePreview: { classes: [], students: [], customRecordTitles: [] },
      };
    }

    const classCount = result.classes?.length || 0;
    const studentCount = result.students?.length || 0;
    const subjectCount = result.subjects?.length || 0;
    const attendanceCount = result.attendance?.length || 0;
    const markCount = result.marks?.length || 0;
    const classworkCount = result.classwork?.length || 0;
    const customRecordCount = result.customRecords?.length || 0;
    const hasProfile = Boolean(result.profile?.name || result.profile?.school);

    const totalItems =
      classCount +
      studentCount +
      subjectCount +
      attendanceCount +
      markCount +
      classworkCount +
      customRecordCount +
      (hasProfile ? 1 : 0);

    if (totalItems === 0) {
      return {
        success: false,
        error: 'No recognizable students, classes, records, or custom information found in this JSON file.',
        data: {},
        stats: {
          classCount: 0,
          studentCount: 0,
          subjectCount: 0,
          attendanceCount: 0,
          markCount: 0,
          classworkCount: 0,
          customRecordCount: 0,
          hasProfile: false,
        },
        summaryText: '0 valid items extracted',
        samplePreview: { classes: [], students: [], customRecordTitles: [] },
      };
    }

    const parts: string[] = [];
    if (studentCount) parts.push(`${studentCount} student${studentCount > 1 ? 's' : ''}`);
    if (classCount) parts.push(`${classCount} class${classCount > 1 ? 'es' : ''}`);
    if (subjectCount) parts.push(`${subjectCount} subject${subjectCount > 1 ? 's' : ''}`);
    if (attendanceCount) parts.push(`${attendanceCount} attendance session${attendanceCount > 1 ? 's' : ''}`);
    if (markCount) parts.push(`${markCount} exam score sheet${markCount > 1 ? 's' : ''}`);
    if (classworkCount) parts.push(`${classworkCount} task${classworkCount > 1 ? 's' : ''}`);
    if (customRecordCount) parts.push(`${customRecordCount} custom info record${customRecordCount > 1 ? 's' : ''}`);
    if (hasProfile) parts.push('Teacher Profile');

    return {
      success: true,
      data: result,
      stats: {
        classCount,
        studentCount,
        subjectCount,
        attendanceCount,
        markCount,
        classworkCount,
        customRecordCount,
        hasProfile,
      },
      summaryText: parts.join(' · '),
      samplePreview: {
        classes: (result.classes || []).slice(0, 5).map(c => c.name),
        students: (result.students || []).slice(0, 8).map(s => s.name),
        customRecordTitles: (result.customRecords || []).slice(0, 5).map(cr => cr.title),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse JSON file: ${err?.message || 'Syntax error in JSON file'}. Please verify syntax.`,
      data: {},
      stats: {
        classCount: 0,
        studentCount: 0,
        subjectCount: 0,
        attendanceCount: 0,
        markCount: 0,
        classworkCount: 0,
        customRecordCount: 0,
        hasProfile: false,
      },
      summaryText: 'JSON Syntax Error',
      samplePreview: { classes: [], students: [], customRecordTitles: [] },
    };
  }
}

/**
 * Merge imported JSON data into the current application state.
 */
export function mergeImportIntoState(
  current: AppState,
  imported: Partial<AppState>,
  mode: 'merge' | 'replace'
): AppState {
  if (mode === 'replace') {
    return {
      profile: imported.profile ? { ...current.profile, ...imported.profile } : current.profile,
      teacherSecurity: imported.teacherSecurity || current.teacherSecurity,
      classes: imported.classes && imported.classes.length > 0 ? imported.classes : current.classes,
      students: imported.students && imported.students.length > 0 ? imported.students : current.students,
      subjects: imported.subjects && imported.subjects.length > 0 ? imported.subjects : current.subjects,
      attendance: imported.attendance && imported.attendance.length > 0 ? imported.attendance : current.attendance,
      marks: imported.marks && imported.marks.length > 0 ? imported.marks : current.marks,
      classwork: imported.classwork && imported.classwork.length > 0 ? imported.classwork : current.classwork,
      studentPermissions: current.studentPermissions || [],
      customRecords: imported.customRecords && imported.customRecords.length > 0 ? imported.customRecords : current.customRecords || [],
    };
  }

  // 'merge' Mode: Smart upsert without losing records
  // 1. Classes: match by ID or case-insensitive Name
  const nextClasses = [...current.classes];
  if (imported.classes && imported.classes.length > 0) {
    for (const inc of imported.classes) {
      const idx = nextClasses.findIndex(
        c => c.id === inc.id || c.name.trim().toLowerCase() === inc.name.trim().toLowerCase()
      );
      if (idx >= 0) {
        nextClasses[idx] = { ...nextClasses[idx], ...inc, id: nextClasses[idx].id };
      } else {
        nextClasses.push(inc);
      }
    }
  }

  // 2. Students: match by ID, studentNo, or case-insensitive Name
  const nextStudents = [...current.students];
  if (imported.students && imported.students.length > 0) {
    for (const ins of imported.students) {
      const idx = nextStudents.findIndex(
        s =>
          s.id === ins.id ||
          (s.studentNo && ins.studentNo && s.studentNo.toLowerCase() === ins.studentNo.toLowerCase()) ||
          s.name.trim().toLowerCase() === ins.name.trim().toLowerCase()
      );
      if (idx >= 0) {
        // Merge classIds without duplicates
        const mergedClassIds = Array.from(new Set([...(nextStudents[idx].classIds || []), ...(ins.classIds || [])]));
        nextStudents[idx] = {
          ...nextStudents[idx],
          ...ins,
          id: nextStudents[idx].id,
          classIds: mergedClassIds,
        };
      } else {
        nextStudents.push(ins);
      }
    }
  }

  // 3. Subjects: match by ID or classId + name
  const nextSubjects = [...current.subjects];
  if (imported.subjects && imported.subjects.length > 0) {
    for (const sub of imported.subjects) {
      const idx = nextSubjects.findIndex(
        s => s.id === sub.id || (s.classId === sub.classId && s.name.trim().toLowerCase() === sub.name.trim().toLowerCase())
      );
      if (idx >= 0) {
        nextSubjects[idx] = { ...nextSubjects[idx], ...sub, id: nextSubjects[idx].id };
      } else {
        nextSubjects.push(sub);
      }
    }
  }

  // 4. Attendance: merge session records by ID
  const nextAttendance = [...current.attendance];
  if (imported.attendance && imported.attendance.length > 0) {
    for (const att of imported.attendance) {
      const idx = nextAttendance.findIndex(a => a.id === att.id);
      if (idx >= 0) {
        nextAttendance[idx] = {
          ...nextAttendance[idx],
          records: { ...nextAttendance[idx].records, ...att.records },
          savedAt: att.savedAt || new Date().toISOString(),
        };
      } else {
        nextAttendance.push(att);
      }
    }
  }

  // 5. Marks: merge by ID
  const nextMarks = [...current.marks];
  if (imported.marks && imported.marks.length > 0) {
    for (const m of imported.marks) {
      const idx = nextMarks.findIndex(x => x.id === m.id);
      if (idx >= 0) {
        nextMarks[idx] = {
          ...nextMarks[idx],
          scores: { ...nextMarks[idx].scores, ...m.scores },
        };
      } else {
        nextMarks.push(m);
      }
    }
  }

  // 6. Classwork: merge by ID or classId + title
  const nextClasswork = [...current.classwork];
  if (imported.classwork && imported.classwork.length > 0) {
    for (const cw of imported.classwork) {
      const idx = nextClasswork.findIndex(
        x => x.id === cw.id || (x.classId === cw.classId && x.title.trim().toLowerCase() === cw.title.trim().toLowerCase())
      );
      if (idx >= 0) {
        nextClasswork[idx] = {
          ...nextClasswork[idx],
          scores: { ...nextClasswork[idx].scores, ...cw.scores },
          max: cw.max || nextClasswork[idx].max,
        };
      } else {
        nextClasswork.push(cw);
      }
    }
  }

  // 7. Custom Records: merge by ID or category + title
  const nextCustomRecords = [...(current.customRecords || [])];
  if (imported.customRecords && imported.customRecords.length > 0) {
    for (const cr of imported.customRecords) {
      const idx = nextCustomRecords.findIndex(
        x => x.id === cr.id || (x.category === cr.category && x.title.trim().toLowerCase() === cr.title.trim().toLowerCase())
      );
      if (idx >= 0) {
        nextCustomRecords[idx] = {
          ...nextCustomRecords[idx],
          ...cr,
          updatedAt: new Date().toISOString(),
        };
      } else {
        nextCustomRecords.push(cr);
      }
    }
  }

  // 8. Profile: merge non-empty
  const nextProfile: UserProfile = { ...current.profile };
  if (imported.profile) {
    if (imported.profile.name) nextProfile.name = imported.profile.name;
    if (imported.profile.role) nextProfile.role = imported.profile.role;
    if (imported.profile.school) nextProfile.school = imported.profile.school;
    if (imported.profile.className) nextProfile.className = imported.profile.className;
    if (imported.profile.timeFrom) nextProfile.timeFrom = imported.profile.timeFrom;
    if (imported.profile.timeTo) nextProfile.timeTo = imported.profile.timeTo;
    if (imported.profile.photo) nextProfile.photo = imported.profile.photo;
  }

  return {
    profile: nextProfile,
    teacherSecurity: imported.teacherSecurity || current.teacherSecurity,
    classes: nextClasses,
    students: nextStudents,
    subjects: nextSubjects,
    attendance: nextAttendance,
    marks: nextMarks,
    classwork: nextClasswork,
    studentPermissions: current.studentPermissions || [],
    customRecords: nextCustomRecords,
  };
}

// Internal Normalizers
function normalizeStudent(
  item: any,
  idx: number,
  defaultClassId: string,
  availableClasses: ClassItem[]
): StudentItem {
  const name = String(item.name || item.studentName || item.fullName || `Student ${idx + 1}`).trim();
  const id = String(item.id || item.studentId || `s_${uid()}_${idx}`);
  const studentNo = item.studentNo || item.idNumber || item.code || `STD-${100 + idx + 1}`;
  const sex = item.sex || item.gender || 'M';
  const dob = item.dob || item.birthDate || item.dateOfBirth || '';
  const phone = item.phone || item.phoneNumber || item.contact || item.tel || '';
  const guardian = item.guardian || item.parent || item.parentName || '';
  const address = item.address || item.location || '';
  const note = item.note || item.notes || item.remark || '';
  const password = String(item.password || `${1000 + idx + 1}`);

  let classIds: string[] = [];
  if (Array.isArray(item.classIds)) {
    classIds = item.classIds.map(String);
  } else if (item.classId) {
    classIds = [String(item.classId)];
  } else if (item.className || item.class) {
    const targetName = String(item.className || item.class).toLowerCase().trim();
    const matched = availableClasses.find(c => c.name.toLowerCase().trim() === targetName);
    classIds = [matched ? matched.id : defaultClassId];
  } else {
    classIds = [defaultClassId];
  }

  return {
    ...item,
    id,
    name,
    studentNo,
    sex,
    dob,
    phone,
    guardian,
    address,
    note,
    password,
    classIds,
    photo: item.photo || null,
  };
}

function normalizeClass(item: any, idx: number): ClassItem {
  return {
    ...item,
    id: String(item.id || item.classId || `cls_${uid()}_${idx}`),
    name: String(item.name || item.className || item.title || `Class ${idx + 1}`).trim(),
    level: item.level || item.grade || 'General Level',
    timeFrom: item.timeFrom || '08:00',
    timeTo: item.timeTo || '09:30',
    days: item.days || 'Mon-Fri',
    room: item.room || 'Room 101',
  };
}

function normalizeSubject(item: any, idx: number, defaultClassId: string): SubjectItem {
  return {
    id: String(item.id || item.subjectId || `sub_${uid()}_${idx}`),
    classId: String(item.classId || defaultClassId),
    name: String(item.name || item.subjectName || item.subject || `Subject ${idx + 1}`).trim(),
    max: Number(item.max) || 100,
    order: Number(item.order) || idx + 1,
  };
}

function formatTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

/**
 * Downloads a sample JSON file to the user's browser.
 */
export function downloadJSONFile(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * Generates sample Student Roster JSON template
 */
export function generateStudentsSampleJSON(): any[] {
  return [
    {
      name: 'Vannak Chen',
      studentNo: 'STD-101',
      sex: 'M',
      dob: '2008-04-12',
      phone: '012 889 001',
      guardian: 'Sokha Chen (Father)',
      address: 'Phnom Penh, Cambodia',
      note: 'Honor student with distinction in mathematics and public debate.',
      password: '1001',
      className: 'Evening English A',
      customInfo: {
        bloodType: 'O+',
        hobby: 'Chess and Literature',
        emergencyContact: '011 223 344',
      },
    },
    {
      name: 'Channary Touch',
      studentNo: 'STD-102',
      sex: 'F',
      dob: '2008-09-25',
      phone: '017 334 556',
      guardian: 'Maly Touch (Mother)',
      address: 'Toul Kork, Phnom Penh',
      note: 'Active participant in classroom team projects.',
      password: '1002',
      className: 'Evening English A',
      customInfo: {
        bloodType: 'B+',
        hobby: 'Debate and Creative Writing',
        emergencyContact: '098 765 432',
      },
    },
    {
      name: 'Sovannarith Meas',
      studentNo: 'STD-103',
      sex: 'M',
      dob: '2007-11-18',
      phone: '095 445 667',
      guardian: 'Kosal Meas',
      address: 'Boeng Keng Kang, Phnom Penh',
      note: 'Class representative and peer tutor.',
      password: '1003',
      className: 'Evening English A',
      customInfo: {
        bloodType: 'A+',
        hobby: 'Science and Robotics',
        emergencyContact: '089 112 233',
      },
    },
  ];
}

/**
 * Generates sample Classes & Subjects JSON template
 */
export function generateClassesSampleJSON(): any {
  return {
    classes: [
      {
        id: 'cls_advance_prep',
        name: 'Advanced Academic English Prep',
        level: 'Upper Intermediate B2',
        timeFrom: '17:30',
        timeTo: '19:00',
        days: 'Mon - Fri',
        room: 'Lab 204',
        curriculumNotes: 'Pre-university English grammar, academic essays, and IELTS readiness.',
      },
      {
        id: 'cls_stem_prep',
        name: 'STEM Science & Tech Foundation',
        level: 'Secondary Level 3',
        timeFrom: '14:00',
        timeTo: '15:30',
        days: 'Tue, Thu, Sat',
        room: 'Room 302',
        curriculumNotes: 'Introduction to experimental methodology and scientific writing.',
      },
    ],
    subjects: [
      {
        id: 'sub_listening',
        classId: 'cls_advance_prep',
        name: 'Academic Listening & Note-Taking',
        max: 100,
        order: 1,
      },
      {
        id: 'sub_speaking',
        classId: 'cls_advance_prep',
        name: 'Public Presentation & Debate',
        max: 100,
        order: 2,
      },
      {
        id: 'sub_writing',
        classId: 'cls_advance_prep',
        name: 'Research Essay & Writing',
        max: 100,
        order: 3,
      },
    ],
  };
}

/**
 * Generates sample Custom Information JSON template to store other arbitrary information
 */
export function generateCustomInfoSampleJSON(): any {
  return {
    schoolAnnouncements: [
      {
        id: 'ann_01',
        title: 'Mid-Term Examination Schedule Released',
        date: todayISO(),
        details: 'Examinations begin next Monday. Students must arrive 15 minutes before the session starts.',
        priority: 'High',
      },
      {
        id: 'ann_02',
        title: 'Science Fair & Exhibition Registration',
        date: todayISO(),
        details: 'Submit team project proposals to the science lab coordinator by the end of the month.',
        priority: 'Normal',
      },
    ],
    academicCalendar: {
      term: 'Semester 1 - Academic Year 2026',
      orientationWeek: '2026-09-01 to 2026-09-07',
      midtermPeriod: '2026-10-15 to 2026-10-22',
      finalExams: '2026-12-10 to 2026-12-18',
      campusLocation: 'Academic Center Main Building',
    },
    facultyStaffDirectory: [
      {
        name: 'Dr. Michael Vance',
        department: 'Science & Mathematics',
        email: 'vance.science@academy.org',
        officeHours: 'Mon / Wed 14:00 - 16:00',
      },
      {
        name: 'Soth Sothea (Albe)',
        department: 'English Language Arts',
        email: 'albe.english@academy.org',
        officeHours: 'Mon - Fri 18:00 - 20:30',
      },
    ],
  };
}
