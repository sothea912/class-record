export type AttendanceStatus = 'P' | 'L' | 'E' | 'U';

export interface AttendanceRecord {
  status: AttendanceStatus;
  reason?: string;
  minutesLate?: number;
  joinedAt?: string;
  source?: string; // 'auto-join'
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

export type ClassworkType = 'homework' | 'project' | 'achievement' | 'participation' | 'quiz' | 'exam';

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
  lateGracePeriod?: number; // default 10 min
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

export type HomeworkQuestionType = 'short' | 'long' | 'choice' | 'checkbox' | 'dropdown' | 'boolean' | 'photo';

export interface HomeworkQuestion {
  id: string;
  title: string;
  description?: string;
  image?: string;
  type: HomeworkQuestionType;
  points: number;
  required: boolean;
  options?: string[];
  optionImages?: Record<number, string>;
  sectionHeading?: string;
  sectionId?: string;
}

export type ActivityKind = 'homework' | 'quiz' | 'exam' | 'custom';

export interface ExamSection {
  id: string;
  title: string;
  instructions?: string;
  readingPassage?: string;
  image?: string;
  timeLimitMinutes?: number;
  weightPercent?: number;
}

export interface GradingScaleItem {
  grade: string;
  minPercent: number;
  maxPercent: number;
}

export interface ActivityItem {
  id: string; // act_{uid} or qz_{uid} or ex_{uid}
  kind: ActivityKind;
  title: string;
  instructions?: string;
  classIds: string[];
  month: string;
  dueDateTime?: string;
  opensAt?: string;
  closesAt?: string;
  durationMinutes?: number;
  maxScore: number;
  allowLate?: boolean;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  attemptsAllowed?: number;
  resultsRelease?: 'immediate' | 'manual';
  pageMode?: 'one_per_page' | 'all_on_one_page';
  sections?: ExamSection[];
  passPercent?: number;
  gradingScale?: GradingScaleItem[];
  activityTypeLabel?: string;
  scoringColumn?: 'homework' | 'quiz' | 'exam' | 'participation';
  attachmentName?: string;
  attachmentType?: string;
  attachmentData?: string;
  externalLink?: string;
  questionsCount?: number;
  questions?: HomeworkQuestion[];
  published: boolean;
  badgesEnabled?: boolean;
  thumbnail?: string; // Base64 640x360 JPEG under 50KB
  difficulty?: number; // 1 to 5 (1=Very easy, 2=Easy, 3=Medium, 4=Hard, 5=Very hard)
  createdAt: string;
  updatedAt: string;
}

export interface ActivityAttempt {
  id: string; // ${activityId}_${studentId} or ${activityId}_${studentId}_${attemptNumber}
  activityId: string;
  studentId: string;
  classId: string;
  kind: ActivityKind;
  attemptNumber: number;
  startedAt: string;
  serverStartTimeMs?: number;
  durationMinutes: number;
  extraMinutesGranted?: number;
  submittedAt?: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'marked' | 'resubmit_requested';
  answers: Record<string, any>;
  files?: HomeworkSubmissionFile[];
  externalLink?: string;
  tabSwitchesCount?: number;
  score?: number;
  sectionScores?: Record<string, number>;
  grade?: string;
  passed?: boolean;
  questionMarks?: Record<string, number>;
  questionComments?: Record<string, string>;
  teacherNote?: string;
  markedAt?: string;
  markedBy?: string;
  resultsReleased?: boolean;
  retakeAllowed?: boolean;
  history?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentBadgeItem {
  id: string;
  studentId: string;
  badgeType: 'perfect_score' | 'top_3' | 'most_improved' | 'never_missed_quiz';
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
  activityId?: string;
}

export interface HomeworkItem {
  id: string; // hw_{uid}
  title: string;
  instructions: string;
  type: 'upload' | 'form';
  classIds: string[];
  dueDateTime: string; // ISO string
  maxScore: number;
  allowLate: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentData?: string; // Base64 data (compressed images)
  externalLink?: string; // Link to Google Drive / Telegram
  hasSubcollectionFile?: boolean;
  subcollectionFileId?: string;
  thumbnail?: string; // Base64 640x360 JPEG under 50KB
  difficulty?: number; // 1 to 5 (1=Very easy, 2=Easy, 3=Medium, 4=Hard, 5=Very hard)
  allowStudentFileUpload?: boolean; // Default true: allows student file attachments
  requireFileUpload?: boolean; // Default false: requires at least one file before submit
  questions?: HomeworkQuestion[];
}

export interface HomeworkFileDoc {
  id: string;
  homeworkId: string;
  fileName: string;
  fileType: string;
  base64Data: string;
  size: number;
  uploadedAt: string;
}

export interface SubmissionFileDoc {
  id: string; // fileId
  submissionId: string;
  homeworkId: string;
  studentId: string;
  fileName: string;
  fileType: string;
  size: number;
  base64Data: string;
  createdAt: string;
}

export interface HomeworkAnswerKey {
  homeworkId: string;
  keys: Record<string, string | string[] | boolean>;
}

export interface HomeworkSubmissionFile {
  fileId: string;
  name: string;
  type: string;
  size?: number;
  previewUrl?: string;
  base64Data?: string; // Kept only if small image or backward compatibility
  externalLink?: string;
}

export interface HomeworkSubmission {
  id: string; // ${homeworkId}_${studentId}
  homeworkId: string;
  studentId: string;
  classId: string;
  status: 'draft' | 'submitted' | 'late' | 'marked' | 'resubmit_requested';
  submittedAt?: string;
  isLate?: boolean;
  answers?: Record<string, any>;
  files?: HomeworkSubmissionFile[];
  links?: string[];
  externalLink?: string;
  score?: number;
  questionMarks?: Record<string, number>;
  questionComments?: Record<string, string>;
  teacherNote?: string;
  markedAt?: string;
  markedBy?: string;
  history?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherNotificationItem {
  id: string;
  studentId: string;
  studentName: string;
  type: 'homework_submitted' | 'quiz_submitted' | 'exam_submitted' | 'activity_submitted';
  title: string;
  homeworkId?: string;
  activityId?: string;
  timestamp: string;
  read: boolean;
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
  homework?: HomeworkItem[];
  homeworkSubmissions?: HomeworkSubmission[];
  activities?: ActivityItem[];
  activityAttempts?: ActivityAttempt[];
  studentBadges?: StudentBadgeItem[];
  teacherNotifications?: TeacherNotificationItem[];
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
  | 'activity'
  | 'subjects'
  | 'classwork'
  | 'results'
  | 'report'
  | 'import'
  | 'adventure'
  | 'profile';
