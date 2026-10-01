export type AttendanceStatus = 'P' | 'L' | 'E' | 'U';

export interface AttendanceRecord {
  status: AttendanceStatus;
  reason?: string;
  minutesLate?: number;
  joinedAt?: string;
}

export interface AttendanceSession {
  id: string; // att_{classId}_{date}
  classId: string;
  date: string; // YYYY-MM-DD
  records: Record<string, AttendanceRecord>; // studentId -> record
  savedAt?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  level?: string;
  timeFrom?: string;
  timeTo?: string;
  startTime?: string;
  duration?: number; // duration in minutes (default 60)
  days?: string;
  room?: string;
  meetLink?: string;
  [key: string]: any;
}

export type PasswordResetStatus = 'none' | 'pending' | 'granted' | 'normal';

export interface StudentItem {
  id: string;
  name: string;
  loginName?: string;
  photo?: string | null;
  studentNo?: string;
  sex?: string;
  gender?: string;
  dob?: string;
  dateOfBirth?: string;
  phone?: string;
  guardian?: string;
  parentName?: string;
  address?: string;
  note?: string;
  password?: string;
  classIds: string[];
  passwordResetStatus?: PasswordResetStatus;
  passwordResetExpiresAt?: string;
  accountStatus?: 'unsyncing' | 'removed' | 'active' | null;
  [key: string]: any;
}

export interface SubjectItem {
  id: string;
  classId: string;
  name: string;
  max: number;
  order: number;
}

export interface MarkDoc {
  id: string; // mk_{subjectId}_{month}
  subjectId: string;
  classId: string;
  month: string; // YYYY-MM
  scores: Record<string, number>; // studentId -> score
}

export type ClassworkType = 'homework' | 'project' | 'achievement' | 'participation';

export interface ClassworkTask {
  id: string;
  classId: string;
  title: string;
  type: ClassworkType;
  max: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  scores: Record<string, number>; // studentId -> score
}

export interface UserProfile {
  name?: string;
  role?: string;
  school?: string;
  className?: string;
  timeFrom?: string;
  timeTo?: string;
  photo?: string | null;
}

export interface TeacherSecurity {
  isConfigured: boolean; // false until teacher sets their own permanent password
  isSetupCompleted?: boolean; // true once setup is completed in Firestore
  password?: string; // permanent password set by teacher
  setupCodeUsed?: boolean; // true once one-time setup code has been used
  yellowFrom?: number; // default 1 min
  redFrom?: number; // default 10 min
  yellowPenalty?: number; // default 0 pts
  redPenalty?: number; // default 2 pts
}

export interface ClassJoinRecord {
  id: string; // {classId}_{date}_{studentId}
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  joinedAt: string; // ISO or server timestamp string
  classStart: string; // HH:mm
  minutesLate: number;
  status: 'green' | 'yellow' | 'red';
}

export type DashboardWidgetSize = '1x1' | '2x1' | '1x2' | '2x2' | '4x1' | '4x2';

export interface DashboardWidgetConfig {
  id: string;
  size: DashboardWidgetSize;
  hidden?: boolean;
}

export interface DashboardLayoutConfig {
  desktop: DashboardWidgetConfig[];
  mobile: DashboardWidgetConfig[];
}

export interface StudentPermissionRequest {
  id: string;
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  category: string;
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Acknowledged' | 'Denied';
  decidedAt?: string;
}

export interface DailyQuest {
  type: string; // 'homework' | 'practice' | 'learn' | 'question'
  title: string;
  completed: boolean;
  xpValue: number;
}

export interface StudentProgress {
  id: string;
  studentId: string;
  xp: number;
  level: number;
  title: string;
  currentStreak: number;
  longestStreak: number;
  lastQuestCompletionDate?: string;
  dailyQuests: DailyQuest[];
  avatarId?: string;
  overallScore: number;
}

export interface AuthUser {
  role: 'teacher' | 'student';
  studentId?: string; // set if student
  name: string;
}

export interface CustomRecordItem {
  id: string;
  category?: string;
  title: string;
  data: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type BannerColorTheme = 'green' | 'cyan' | 'amber' | 'purple' | 'coral';

export interface AnnouncementBanner {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  badge?: string; // e.g., 'Important', 'Exam Announcement', 'Library Pick', 'New Course'
  linkUrl?: string;
  bgColor?: BannerColorTheme;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
}

export type ResourceCategory = 'Books' | 'PDF Documents' | 'Lessons/Worksheets' | 'General Resources';

export interface LibraryResource {
  id: string;
  title: string;
  description?: string;
  category: ResourceCategory;
  fileUrl?: string; // Data URL or direct link
  fileName?: string;
  fileSize?: string;
  fileType?: string; // 'pdf' | 'doc' | 'epub' | 'link' | 'image' | 'archive' | 'sheet'
  externalLink?: string;
  authorOrTeacher?: string;
  classId?: string; // specific classId or 'all'
  tags?: string[];
  downloadsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AccountRequest {
  id: string;
  studentId: string;
  studentNo?: string;
  studentName: string;
  createdAt: string;
  status: 'pending' | 'resolved';
  reason?: string;
}

export interface ClassCancellationItem {
  id: string;
  classId: string;
  originalDate: string; // YYYY-MM-DD
  makeupDate?: string; // YYYY-MM-DD
  reason: string;
  markCancelled: boolean;
  createdAt: string;
  dismissedByStudents?: string[];
}

export interface AppState {
  profile: UserProfile;
  teacherSecurity?: TeacherSecurity;
  classes: ClassItem[];
  students: StudentItem[];
  subjects: SubjectItem[];
  attendance: AttendanceSession[];
  marks: MarkDoc[];
  classwork: ClassworkTask[];
  studentPermissions?: StudentPermissionRequest[];
  customRecords?: CustomRecordItem[];
  banners?: AnnouncementBanner[];
  resources?: LibraryResource[];
  studentProgress?: StudentProgress[];
  accountRequests?: AccountRequest[];
  classJoins?: ClassJoinRecord[];
  classCancellations?: ClassCancellationItem[];
  telegramConfig?: {
    chatId: string;
    username?: string;
    name?: string;
    updatedAt: string;
  };
}

export interface StudentRankResult {
  student: StudentItem;
  per: Record<string, { got: number; max: number; pct: number }>;
  work: number;
  att: {
    P: number;
    L: number;
    E: number;
    U: number;
    score: number;
    max: number;
    totalCredit: number;
    sessionsHeld: number;
    rate: number | null;
    ratePct: string;
  };
  total: number;
  max: number;
  pct: number | null;
  avg: number;
  grade: string;
  status: string;
  rank: number | null;
  of: number;
  hasData?: boolean;
}

export type NavView =
  | 'dash'
  | 'library'
  | 'students'
  | 'classes'
  | 'attend'
  | 'attreport'
  | 'permits'
  | 'notices'
  | 'subjects'
  | 'classwork'
  | 'results'
  | 'report'
  | 'import'
  | 'adventure'
  | 'profile';
