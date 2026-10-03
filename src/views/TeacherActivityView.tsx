import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ExternalLink,
  Trash2,
  Edit,
  Eye,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
  Search,
  Filter,
  Users,
  Award,
  HelpCircle,
  Paperclip,
  Image as ImageIcon,
  CheckSquare,
  ArrowLeft,
  MessageSquare,
  Save,
  Send,
  AlertTriangle,
  FolderOpen,
  Download,
  BarChart2,
  Layers,
  ChevronRight,
  ShieldAlert,
  GraduationCap,
  Unlock,
  Lock,
  Timer,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AppState,
  HomeworkItem,
  HomeworkQuestion,
  HomeworkQuestionType,
  HomeworkSubmission,
  HomeworkAnswerKey,
  HomeworkFileDoc,
  ActivityItem,
  ActivityAttempt,
  ActivityKind,
  ExamSection,
  GradingScaleItem,
  ClassItem,
  StudentItem,
  ClassworkType,
} from '../types';
import {
  syncSaveHomework,
  syncDeleteHomework,
  syncSaveHomeworkMark,
  syncDeleteHomeworkSubmission,
  syncFetchHomeworkAnswerKey,
  syncFetchHomeworkFile,
  compressImageForHomework,
  readDocAsBase64,
  syncMarkTeacherNotificationRead,
  syncSaveActivity,
  syncDeleteActivity,
  syncFetchActivityQuestions,
  syncFetchActivityAnswerKey,
  syncSaveActivityAttempt,
  syncSaveActivityMark,
  syncDeleteActivityAttempt,
  syncUpdateStudentExamTime,
  syncReleaseActivityResults,
} from '../utils/firestoreSync';
import { uid, round1, studentsOf, thisMonth, todayISO, processThumbnailImage, getDifficultyMeta, DIFFICULTY_LEVELS } from '../utils/helpers';
import { Modal } from '../components/Modal';
import { ActivityCardThumbnail } from '../components/ActivityCardThumbnail';

interface TeacherActivityViewProps {
  state: AppState;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_GRADING_SCALE: GradingScaleItem[] = [
  { grade: 'A', minPercent: 85, maxPercent: 100 },
  { grade: 'B', minPercent: 70, maxPercent: 84 },
  { grade: 'C', minPercent: 50, maxPercent: 69 },
  { grade: 'D', minPercent: 40, maxPercent: 49 },
  { grade: 'F', minPercent: 0, maxPercent: 39 },
];

export const TeacherActivityView: React.FC<TeacherActivityViewProps> = ({
  state,
  selectedClassId,
  onSelectClassId,
  onShowToast,
}) => {
  // Top 4 Section Tabs
  const [activeSection, setActiveSection] = useState<'homework' | 'quizzes' | 'achievement' | 'custom'>('homework');

  // New Activity Dropdown menu state
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  // Active activity/homework for Submissions / Grading view
  const [gradingHomeworkId, setGradingHomeworkId] = useState<string | null>(null);
  const [gradingActivityId, setGradingActivityId] = useState<string | null>(null);

  // Analytics modal for Exams / Quizzes
  const [analyticsActivityId, setAnalyticsActivityId] = useState<string | null>(null);

  // Main Creation Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createKind, setCreateKind] = useState<ActivityKind>('homework');
  const [createMode, setCreateMode] = useState<'upload' | 'form'>('form');

  // Reuse / Duplicate Modal state
  const [isReuseModalOpen, setIsReuseModalOpen] = useState(false);
  const [reuseSearch, setReuseSearch] = useState('');

  // Form Builder fields
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [itemInstructions, setItemInstructions] = useState('');
  const [itemClassIds, setItemClassIds] = useState<string[]>([]);
  const [itemMonth, setItemMonth] = useState<string>(thisMonth());
  const [itemDueDateTime, setItemDueDateTime] = useState('');
  const [itemOpensAt, setItemOpensAt] = useState('');
  const [itemClosesAt, setItemClosesAt] = useState('');
  const [itemDurationMinutes, setItemDurationMinutes] = useState<number>(30);
  const [itemMaxScore, setItemMaxScore] = useState<number>(100);
  const [itemAllowLate, setItemAllowLate] = useState(false);
  const [itemShuffleQuestions, setItemShuffleQuestions] = useState(false);
  const [itemShuffleChoices, setItemShuffleChoices] = useState(false);
  const [itemAttemptsAllowed, setItemAttemptsAllowed] = useState<number>(1);
  const [itemResultsRelease, setItemResultsRelease] = useState<'immediate' | 'manual'>('manual');
  const [itemPageMode, setItemPageMode] = useState<'one_per_page' | 'all_on_one_page'>('one_per_page');
  const [itemPassPercent, setItemPassPercent] = useState<number>(50);
  const [itemGradingScale, setItemGradingScale] = useState<GradingScaleItem[]>(DEFAULT_GRADING_SCALE);
  const [itemActivityTypeLabel, setItemActivityTypeLabel] = useState('Speaking practice');
  const [itemScoringColumn, setItemScoringColumn] = useState<'homework' | 'quiz' | 'exam' | 'participation'>('participation');
  const [itemBadgesEnabled, setItemBadgesEnabled] = useState(true);
  const [itemPublished, setItemPublished] = useState(true);
  const [itemThumbnail, setItemThumbnail] = useState<string | undefined>();
  const [itemDifficulty, setItemDifficulty] = useState<number>(3); // 1 to 5, default 3 (Medium)
  const [isProcessingThumbnail, setIsProcessingThumbnail] = useState(false);

  // Upload attachments
  const [attachmentData, setAttachmentData] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [attachmentType, setAttachmentType] = useState<string | undefined>();
  const [externalLink, setExternalLink] = useState('');
  const [docFilePayload, setDocFilePayload] = useState<{ base64: string; size: number; name: string; type: string } | null>(null);
  const [fileUploadError, setFileUploadError] = useState('');

  // Exam Sections
  const [examSections, setExamSections] = useState<ExamSection[]>([
    { id: 'sec_1', title: 'Part 1: Reading Comprehension', instructions: 'Read carefully and answer all questions.' },
    { id: 'sec_2', title: 'Part 2: Grammar & Vocabulary', instructions: 'Choose the correct form.' },
  ]);

  // Form Questions & Answer Keys
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, string | string[] | boolean>>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Submissions grading modal
  const [selectedSubmissionStudent, setSelectedSubmissionStudent] = useState<StudentItem | null>(null);
  const [activeAnswerKey, setActiveAnswerKey] = useState<Record<string, any> | null>(null);
  const [awardedMarks, setAwardedMarks] = useState<Record<string, number>>({});
  const [questionComments, setQuestionComments] = useState<Record<string, string>>({});
  const [overallTeacherNote, setOverallTeacherNote] = useState('');
  const [overallScoreOverride, setOverallScoreOverride] = useState<number | ''>('');
  const [isMarkingLoading, setIsMarkingLoading] = useState(false);

  // Redo / Delete confirm modals
  const [redoModalOpen, setRedoModalOpen] = useState(false);
  const [redoReason, setRedoReason] = useState('');
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; title: string; kind: string } | null>(null);
  const [deleteSubConfirm, setDeleteSubConfirm] = useState<{ id: string; activityId: string; studentId: string } | null>(null);

  // Time extension modal
  const [extendTimeModalStudent, setExtendTimeModalStudent] = useState<{ attemptId: string; studentName: string } | null>(null);
  const [extendMinutes, setExtendMinutes] = useState<number>(10);

  // Filters for lists
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [subFilter, setSubFilter] = useState<'all' | 'unsubmitted' | 'submitted' | 'late' | 'marked'>('all');

  // Lists from state
  const homeworkList = state.homework || [];
  const submissionsList = state.homeworkSubmissions || [];
  const activitiesList = state.activities || [];
  const attemptsList = state.activityAttempts || [];

  // Active items for grading
  const currentGradingHw = useMemo(() => {
    if (!gradingHomeworkId) return null;
    return homeworkList.find(h => h.id === gradingHomeworkId) || null;
  }, [gradingHomeworkId, homeworkList]);

  const currentGradingAct = useMemo(() => {
    if (!gradingActivityId) return null;
    return activitiesList.find(a => a.id === gradingActivityId) || null;
  }, [gradingActivityId, activitiesList]);

  const analyticsActivity = useMemo(() => {
    if (!analyticsActivityId) return null;
    return activitiesList.find(a => a.id === analyticsActivityId) || null;
  }, [analyticsActivityId, activitiesList]);

  // Unread badge count
  const unreadHomeworkCount = useMemo(() => {
    return (state.teacherNotifications || []).filter(n => !n.read).length;
  }, [state.teacherNotifications]);

  // Init class selection
  useEffect(() => {
    if (selectedClassId && itemClassIds.length === 0) {
      setItemClassIds([selectedClassId]);
    }
  }, [selectedClassId]);

  // Open Creator for specific kind
  const handleOpenCreateModal = (kind: ActivityKind) => {
    setIsNewMenuOpen(false);
    setEditingItemId(null);
    setCreateKind(kind);
    setCreateMode(kind === 'homework' || kind === 'custom' ? 'form' : 'form');
    setItemTitle('');
    setItemInstructions('');
    setItemClassIds(selectedClassId ? [selectedClassId] : state.classes.length > 0 ? [state.classes[0].id] : []);
    setItemMonth(thisMonth());
    setItemDueDateTime('');
    setItemOpensAt('');
    setItemClosesAt('');
    setItemDurationMinutes(kind === 'exam' ? 60 : 30);
    setItemMaxScore(100);
    setItemAllowLate(false);
    setItemShuffleQuestions(false);
    setItemShuffleChoices(false);
    setItemAttemptsAllowed(1);
    setItemResultsRelease('manual');
    setItemPageMode(kind === 'exam' ? 'one_per_page' : 'all_on_one_page');
    setItemPassPercent(50);
    setItemGradingScale(DEFAULT_GRADING_SCALE);
    setItemActivityTypeLabel(kind === 'quiz' ? 'Monthly Quiz' : kind === 'exam' ? 'Final Examination' : 'Speaking practice');
    setItemScoringColumn(kind === 'quiz' ? 'quiz' : kind === 'exam' ? 'exam' : 'participation');
    setItemBadgesEnabled(true);
    setItemPublished(true);
    setItemThumbnail(undefined);
    setItemDifficulty(3);
    setAttachmentData(undefined);
    setAttachmentName(undefined);
    setAttachmentType(undefined);
    setExternalLink('');
    setDocFilePayload(null);
    setFileUploadError('');
    setQuestions([
      {
        id: uid('q'),
        title: kind === 'exam' ? 'Reading Comprehension Question 1' : 'Question 1',
        type: 'choice',
        points: 10,
        required: true,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        sectionId: kind === 'exam' ? 'sec_1' : undefined,
      },
    ]);
    setAnswerKeys({});
    setExamSections([
      { id: 'sec_1', title: 'Part 1: Reading Comprehension', instructions: 'Read carefully and answer all questions.' },
      { id: 'sec_2', title: 'Part 2: Grammar & Writing', instructions: 'Answer in complete sentences.' },
    ]);
    setIsCreateModalOpen(true);
  };

  // Thumbnail file upload and 16:9 crop handler
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingThumbnail(true);
      const base64 = await processThumbnailImage(file);
      setItemThumbnail(base64);
      onShowToast('Thumbnail cropped to 16:9 (640x360) and saved', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to process thumbnail', 'error');
    } finally {
      setIsProcessingThumbnail(false);
      // Reset input value so same file can be re-uploaded if replaced
      e.target.value = '';
    }
  };

  // Open Edit for existing item
  const handleOpenEditItem = async (item: ActivityItem | HomeworkItem, kind: ActivityKind) => {
    setEditingItemId(item.id);
    setCreateKind(kind);
    setItemTitle(item.title);
    setItemInstructions(item.instructions || '');
    setItemClassIds(item.classIds || []);
    setItemMonth((item as any).month || thisMonth());
    setItemDueDateTime(item.dueDateTime || '');
    setItemOpensAt((item as any).opensAt || '');
    setItemClosesAt((item as any).closesAt || '');
    setItemDurationMinutes((item as any).durationMinutes || 30);
    setItemMaxScore(item.maxScore || 100);
    setItemAllowLate(item.allowLate || false);
    setItemShuffleQuestions((item as any).shuffleQuestions || false);
    setItemShuffleChoices((item as any).shuffleChoices || false);
    setItemAttemptsAllowed((item as any).attemptsAllowed || 1);
    setItemResultsRelease((item as any).resultsRelease || 'manual');
    setItemPageMode((item as any).pageMode || 'one_per_page');
    setItemPassPercent((item as any).passPercent || 50);
    setItemGradingScale((item as any).gradingScale || DEFAULT_GRADING_SCALE);
    setItemActivityTypeLabel((item as any).activityTypeLabel || 'Speaking practice');
    setItemScoringColumn((item as any).scoringColumn || 'participation');
    setItemBadgesEnabled((item as any).badgesEnabled !== false);
    setItemPublished(item.published !== false);
    setItemThumbnail(item.thumbnail);
    setItemDifficulty(item.difficulty || 3);
    setAttachmentData(item.attachmentData);
    setAttachmentName(item.attachmentName);
    setAttachmentType(item.attachmentType);
    setExternalLink(item.externalLink || '');
    setDocFilePayload(null);
    setFileUploadError('');

    // Fetch questions and answer keys
    if (kind === 'homework') {
      setQuestions((item as HomeworkItem).questions || []);
      const keySnap = await syncFetchHomeworkAnswerKey(item.id);
      setAnswerKeys(keySnap?.keys || {});
    } else {
      const qList = await syncFetchActivityQuestions(item.id);
      setQuestions(qList || (item as ActivityItem).questions || []);
      const keySnap = await syncFetchActivityAnswerKey(item.id);
      setAnswerKeys(keySnap || {});
      setExamSections((item as ActivityItem).sections || []);
    }
    setIsCreateModalOpen(true);
  };

  // Duplicate / Reuse existing activity
  const handleDuplicateItem = (source: ActivityItem | HomeworkItem) => {
    setIsReuseModalOpen(false);
    setEditingItemId(null);
    const kind = (source as any).kind || 'homework';
    setCreateKind(kind);
    setItemTitle(`${source.title} (Copy)`);
    setItemInstructions(source.instructions || '');
    setItemClassIds(selectedClassId ? [selectedClassId] : source.classIds || []);
    setItemMonth(thisMonth());
    setItemDueDateTime('');
    setItemOpensAt('');
    setItemClosesAt('');
    setItemDurationMinutes((source as any).durationMinutes || 30);
    setItemMaxScore(source.maxScore || 100);
    setItemAllowLate(source.allowLate || false);
    setItemShuffleQuestions((source as any).shuffleQuestions || false);
    setItemShuffleChoices((source as any).shuffleChoices || false);
    setItemAttemptsAllowed((source as any).attemptsAllowed || 1);
    setItemResultsRelease((source as any).resultsRelease || 'manual');
    setItemPageMode((source as any).pageMode || 'one_per_page');
    setItemPassPercent((source as any).passPercent || 50);
    setItemGradingScale((source as any).gradingScale || DEFAULT_GRADING_SCALE);
    setItemActivityTypeLabel((source as any).activityTypeLabel || 'Speaking practice');
    setItemScoringColumn((source as any).scoringColumn || 'participation');
    setItemBadgesEnabled((source as any).badgesEnabled !== false);
    setItemPublished(false); // Default draft for cloned
    setItemThumbnail(source.thumbnail);
    setItemDifficulty(source.difficulty || 3);
    setAttachmentData(source.attachmentData);
    setAttachmentName(source.attachmentName);
    setAttachmentType(source.attachmentType);
    setExternalLink(source.externalLink || '');
    setDocFilePayload(null);

    // Deep clone questions with new IDs
    const clonedQuestions = (source.questions || []).map(q => ({
      ...q,
      id: uid('q'),
    }));
    setQuestions(clonedQuestions);
    setExamSections((source as any).sections || []);
    setIsCreateModalOpen(true);
    onShowToast('Activity duplicated. Please set new dates and publish.', 'info');
  };

  // Question manipulation helpers
  const handleAddQuestion = () => {
    const newQ: HomeworkQuestion = {
      id: uid('q'),
      title: `Question ${questions.length + 1}`,
      type: 'choice',
      points: 10,
      required: true,
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      sectionId: createKind === 'exam' && examSections.length > 0 ? examSections[0].id : undefined,
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleUpdateQuestion = (qId: string, updates: Partial<HomeworkQuestion>) => {
    setQuestions(prev => prev.map(q => (q.id === qId ? { ...q, ...updates } : q)));
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== qId));
    setAnswerKeys(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleDuplicateQuestion = (qId: string) => {
    const target = questions.find(q => q.id === qId);
    if (!target) return;
    const duplicated: HomeworkQuestion = {
      ...target,
      id: uid('q'),
      title: `${target.title} (Copy)`,
    };
    const targetIdx = questions.findIndex(q => q.id === qId);
    setQuestions(prev => [
      ...prev.slice(0, targetIdx + 1),
      duplicated,
      ...prev.slice(targetIdx + 1),
    ]);
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    setQuestions(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Choice Option helpers
  const handleAddOption = (qId: string) => {
    const q = questions.find(item => item.id === qId);
    if (!q) return;
    const currentOpts = q.options || [];
    handleUpdateQuestion(qId, {
      options: [...currentOpts, `Option ${currentOpts.length + 1}`],
    });
  };

  const handleUpdateOption = (qId: string, optIdx: number, val: string) => {
    const q = questions.find(item => item.id === qId);
    if (!q || !q.options) return;
    const updated = [...q.options];
    updated[optIdx] = val;
    handleUpdateQuestion(qId, { options: updated });
  };

  const handleDeleteOption = (qId: string, optIdx: number) => {
    const q = questions.find(item => item.id === qId);
    if (!q || !q.options || q.options.length <= 2) return;
    const updated = q.options.filter((_, i) => i !== optIdx);
    handleUpdateQuestion(qId, { options: updated });
  };

  // Image Upload for Question
  const handleQuestionImageUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageForHomework(file, 1600);
      handleUpdateQuestion(qId, { image: compressed });
      onShowToast('Question image attached', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to compress image', 'error');
    }
  };

  // Image Upload for Choice Option
  const handleOptionImageUpload = async (qId: string, optIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageForHomework(file, 800);
      const q = questions.find(item => item.id === qId);
      const optImages = { ...(q?.optionImages || {}) };
      optImages[optIdx] = compressed;
      handleUpdateQuestion(qId, { optionImages: optImages });
      onShowToast('Option image attached', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to compress image', 'error');
    }
  };

  // File Upload handler for attached documents
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileUploadError('');
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const compressedBase64 = await compressImageForHomework(file, 1600);
        setAttachmentData(compressedBase64);
        setAttachmentName(file.name);
        setAttachmentType(file.type);
        setDocFilePayload(null);
        onShowToast(`Image compressed (${Math.round(compressedBase64.length / 1024)} KB)`, 'success');
      } catch (err: any) {
        setFileUploadError(err.message || 'Failed to compress image.');
      }
    } else {
      const MAX_DOC_BYTES = 700 * 1024;
      if (file.size > MAX_DOC_BYTES) {
        setFileUploadError(
          `Document is ${(file.size / 1024).toFixed(0)} KB (Limit: 700 KB). Please compress it or paste a cloud link below.`
        );
        return;
      }
      try {
        const docRes = await readDocAsBase64(file);
        setAttachmentData(undefined);
        setAttachmentName(file.name);
        setAttachmentType(file.type);
        setDocFilePayload({
          base64: docRes.base64,
          size: docRes.size,
          name: file.name,
          type: file.type,
        });
        onShowToast(`Document prepared: ${file.name}`, 'success');
      } catch (err: any) {
        setFileUploadError('Failed to read file: ' + err.message);
      }
    }
  };

  // Save Activity / Homework
  const handleSaveActivity = async () => {
    if (!itemTitle.trim()) {
      onShowToast('Please provide a title', 'error');
      return;
    }
    if (itemClassIds.length === 0) {
      onShowToast('Please assign to at least one class', 'error');
      return;
    }

    const calculatedMax = createMode === 'form' && questions.length > 0
      ? questions.reduce((a, b) => a + (Number(b.points) || 0), 0)
      : itemMaxScore;

    const itemId = editingItemId || (
      createKind === 'homework'
        ? uid('hw')
        : createKind === 'quiz'
        ? uid('qz')
        : createKind === 'exam'
        ? uid('ex')
        : uid('act')
    );

    try {
      if (createKind === 'homework') {
        const fileDocId = docFilePayload ? `hw_file_${itemId}` : undefined;
        const fileDoc: HomeworkFileDoc | undefined = docFilePayload
          ? {
              id: fileDocId!,
              homeworkId: itemId,
              fileName: docFilePayload.name,
              fileType: docFilePayload.type,
              base64Data: docFilePayload.base64,
              size: docFilePayload.size,
              uploadedAt: new Date().toISOString(),
            }
          : undefined;

        const hwObj: HomeworkItem = {
          id: itemId,
          title: itemTitle.trim(),
          instructions: itemInstructions.trim(),
          type: createMode,
          classIds: itemClassIds,
          dueDateTime: itemDueDateTime || new Date(Date.now() + 7 * 86400000).toISOString(),
          maxScore: calculatedMax || 100,
          allowLate: itemAllowLate,
          published: itemPublished,
          thumbnail: itemThumbnail,
          difficulty: itemDifficulty,
          attachmentName: attachmentName,
          attachmentType: attachmentType,
          attachmentData: attachmentData,
          externalLink: externalLink.trim() || undefined,
          hasSubcollectionFile: !!fileDoc,
          subcollectionFileId: fileDocId,
          questions: createMode === 'form' ? questions : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const keyObj: HomeworkAnswerKey | undefined = Object.keys(answerKeys).length > 0
          ? { homeworkId: itemId, keys: answerKeys }
          : undefined;

        await syncSaveHomework(hwObj, keyObj, fileDoc);
        onShowToast(`Homework "${hwObj.title}" saved successfully!`, 'success');
      } else {
        // Save as Activity (Quiz, Exam, Custom)
        const actObj: ActivityItem = {
          id: itemId,
          kind: createKind,
          title: itemTitle.trim(),
          instructions: itemInstructions.trim(),
          classIds: itemClassIds,
          month: itemMonth,
          dueDateTime: itemDueDateTime || undefined,
          opensAt: itemOpensAt || undefined,
          closesAt: itemClosesAt || undefined,
          durationMinutes: Number(itemDurationMinutes) || 30,
          maxScore: calculatedMax || 100,
          allowLate: itemAllowLate,
          shuffleQuestions: itemShuffleQuestions,
          shuffleChoices: itemShuffleChoices,
          attemptsAllowed: Number(itemAttemptsAllowed) || 1,
          resultsRelease: itemResultsRelease,
          pageMode: itemPageMode,
          sections: createKind === 'exam' ? examSections : undefined,
          passPercent: itemPassPercent,
          gradingScale: itemGradingScale,
          activityTypeLabel: itemActivityTypeLabel,
          scoringColumn: itemScoringColumn,
          badgesEnabled: itemBadgesEnabled,
          thumbnail: itemThumbnail,
          difficulty: itemDifficulty,
          attachmentName,
          attachmentType,
          attachmentData,
          externalLink: externalLink.trim() || undefined,
          questionsCount: questions.length,
          questions: questions,
          published: itemPublished,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await syncSaveActivity(actObj, answerKeys, questions);
        onShowToast(`${createKind.toUpperCase()} "${actObj.title}" saved successfully!`, 'success');
      }

      setIsCreateModalOpen(false);
    } catch (err: any) {
      onShowToast('Failed to save: ' + (err.message || String(err)), 'error');
    }
  };

  // Auto-mark choice, checkbox, dropdown, and boolean questions
  const handleAutoMarkAll = async () => {
    if (!currentGradingAct) return;
    setIsMarkingLoading(true);
    try {
      const storedKey = await syncFetchActivityAnswerKey(currentGradingAct.id);
      if (!storedKey || Object.keys(storedKey).length === 0) {
        onShowToast('No answer key found for this activity.', 'info');
        setIsMarkingLoading(false);
        return;
      }

      const qList = await syncFetchActivityQuestions(currentGradingAct.id) || currentGradingAct.questions || [];
      const actAttempts = attemptsList.filter(a => a.activityId === currentGradingAct.id && (a.status === 'submitted' || a.status === 'auto_submitted' || a.status === 'marked'));

      let autoMarkedCount = 0;
      for (const attempt of actAttempts) {
        let totalScore = 0;
        const marks: Record<string, number> = { ...(attempt.questionMarks || {}) };
        const comments: Record<string, string> = { ...(attempt.questionComments || {}) };
        const sectionScores: Record<string, number> = {};

        qList.forEach(q => {
          const studentAns = (attempt.answers || {})[q.id];
          const correctAns = storedKey[q.id];
          const qPoints = Number(q.points) || 0;

          if (q.type === 'choice' || q.type === 'dropdown' || q.type === 'boolean') {
            if (studentAns !== undefined && String(studentAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
              marks[q.id] = qPoints;
              comments[q.id] = 'Correct';
            } else {
              marks[q.id] = 0;
              comments[q.id] = 'Incorrect';
            }
          } else if (q.type === 'checkbox') {
            const stuArr: string[] = Array.isArray(studentAns) ? studentAns : [];
            const corrArr: string[] = Array.isArray(correctAns) ? correctAns : [];
            const sortedStu = [...stuArr].sort().join('|');
            const sortedCorr = [...corrArr].sort().join('|');
            if (sortedStu === sortedCorr && sortedCorr.length > 0) {
              marks[q.id] = qPoints;
              comments[q.id] = 'All correct options selected';
            } else {
              marks[q.id] = 0;
              comments[q.id] = 'Incorrect options';
            }
          }

          const qScore = marks[q.id] || 0;
          totalScore += qScore;
          if (q.sectionId) {
            sectionScores[q.sectionId] = (sectionScores[q.sectionId] || 0) + qScore;
          }
        });

        // Determine grade and pass/fail
        const pct = currentGradingAct.maxScore > 0 ? (totalScore / currentGradingAct.maxScore) * 100 : 0;
        let grade = 'F';
        for (const g of (currentGradingAct.gradingScale || DEFAULT_GRADING_SCALE)) {
          if (pct >= g.minPercent && pct <= g.maxPercent) {
            grade = g.grade;
            break;
          }
        }
        const passed = pct >= (currentGradingAct.passPercent || 50);

        const updatedAttempt: ActivityAttempt = {
          ...attempt,
          status: 'marked',
          score: round1(totalScore),
          sectionScores,
          grade,
          passed,
          questionMarks: marks,
          questionComments: comments,
          markedAt: new Date().toISOString(),
          markedBy: state.profile.name || 'Teacher',
        };

        await syncSaveActivityMark(updatedAttempt, currentGradingAct, true);
        autoMarkedCount++;
      }

      onShowToast(`Auto-marked ${autoMarkedCount} student submission(s)!`, 'success');
    } catch (err: any) {
      onShowToast('Auto-marking failed: ' + (err.message || String(err)), 'error');
    } finally {
      setIsMarkingLoading(false);
    }
  };

  // Submit mark for individual student submission
  const handleSubmitIndividualMark = async () => {
    if (!selectedSubmissionStudent) return;

    if (currentGradingHw) {
      const sub = submissionsList.find(
        s => s.homeworkId === currentGradingHw.id && s.studentId === selectedSubmissionStudent.id
      );
      if (!sub) return;

      const sumMarks = Object.values(awardedMarks).reduce((a, b) => a + Number(b), 0);
      const finalScore = overallScoreOverride !== '' ? Number(overallScoreOverride) : sumMarks;

      const updatedSub: HomeworkSubmission = {
        ...sub,
        status: 'marked',
        score: finalScore,
        questionMarks: awardedMarks,
        questionComments: questionComments,
        teacherNote: overallTeacherNote.trim() || undefined,
        markedAt: new Date().toISOString(),
        markedBy: state.profile.name || 'Teacher',
        updatedAt: new Date().toISOString(),
      };

      try {
        await syncSaveHomeworkMark(updatedSub, currentGradingHw, true);
        onShowToast(`Mark saved (${finalScore}/${currentGradingHw.maxScore}) & synced to Scoring tab!`, 'success');
        setSelectedSubmissionStudent(null);
      } catch (err: any) {
        onShowToast('Failed to save mark: ' + (err.message || String(err)), 'error');
      }
    } else if (currentGradingAct) {
      const attempt = attemptsList.find(
        a => a.activityId === currentGradingAct.id && a.studentId === selectedSubmissionStudent.id
      );
      if (!attempt) return;

      const sumMarks = Object.values(awardedMarks).reduce((a, b) => a + Number(b), 0);
      const finalScore = overallScoreOverride !== '' ? Number(overallScoreOverride) : sumMarks;

      const pct = currentGradingAct.maxScore > 0 ? (finalScore / currentGradingAct.maxScore) * 100 : 0;
      let grade = 'F';
      for (const g of (currentGradingAct.gradingScale || DEFAULT_GRADING_SCALE)) {
        if (pct >= g.minPercent && pct <= g.maxPercent) {
          grade = g.grade;
          break;
        }
      }
      const passed = pct >= (currentGradingAct.passPercent || 50);

      const updatedAttempt: ActivityAttempt = {
        ...attempt,
        status: 'marked',
        score: round1(finalScore),
        grade,
        passed,
        questionMarks: awardedMarks,
        questionComments: questionComments,
        teacherNote: overallTeacherNote.trim() || undefined,
        markedAt: new Date().toISOString(),
        markedBy: state.profile.name || 'Teacher',
        updatedAt: new Date().toISOString(),
      };

      try {
        await syncSaveActivityMark(updatedAttempt, currentGradingAct, true);
        onShowToast(`Mark saved (${finalScore}/${currentGradingAct.maxScore}) & synced to Scoring tab!`, 'success');
        setSelectedSubmissionStudent(null);
      } catch (err: any) {
        onShowToast('Failed to save mark: ' + (err.message || String(err)), 'error');
      }
    }
  };

  // Reopen / Redo submission
  const handleConfirmRedo = async () => {
    if (!selectedSubmissionStudent) return;

    if (currentGradingHw) {
      const sub = submissionsList.find(
        s => s.homeworkId === currentGradingHw.id && s.studentId === selectedSubmissionStudent.id
      );
      if (!sub) return;

      const previousHistory = sub.history || [];
      const archived = {
        archivedAt: new Date().toISOString(),
        reason: redoReason.trim() || 'Teacher requested revision',
        score: sub.score,
        answers: sub.answers,
        files: sub.files,
        submittedAt: sub.submittedAt,
      };

      const updatedSub: HomeworkSubmission = {
        ...sub,
        status: 'resubmit_requested',
        teacherNote: redoReason.trim() ? `Revision Requested: ${redoReason.trim()}` : sub.teacherNote,
        history: [...previousHistory, archived],
        updatedAt: new Date().toISOString(),
      };

      try {
        await syncSaveHomeworkMark(updatedSub, currentGradingHw, false);
        onShowToast('Submission reopened for student revision', 'info');
        setRedoModalOpen(false);
        setRedoReason('');
        setSelectedSubmissionStudent(null);
      } catch (err: any) {
        onShowToast('Failed to reopen: ' + err.message, 'error');
      }
    } else if (currentGradingAct) {
      const attempt = attemptsList.find(
        a => a.activityId === currentGradingAct.id && a.studentId === selectedSubmissionStudent.id
      );
      if (!attempt) return;

      const previousHistory = attempt.history || [];
      const archived = {
        archivedAt: new Date().toISOString(),
        reason: redoReason.trim() || 'Teacher requested retake',
        score: attempt.score,
        answers: attempt.answers,
        submittedAt: attempt.submittedAt,
      };

      const updatedAttempt: ActivityAttempt = {
        ...attempt,
        status: 'resubmit_requested',
        retakeAllowed: true,
        teacherNote: redoReason.trim() ? `Retake Requested: ${redoReason.trim()}` : attempt.teacherNote,
        history: [...previousHistory, archived],
        updatedAt: new Date().toISOString(),
      };

      try {
        await syncSaveActivityMark(updatedAttempt, currentGradingAct, false);
        onShowToast('Attempt reopened for student retake', 'info');
        setRedoModalOpen(false);
        setRedoReason('');
        setSelectedSubmissionStudent(null);
      } catch (err: any) {
        onShowToast('Failed to reopen: ' + err.message, 'error');
      }
    }
  };

  // Delete item handler
  const handleConfirmDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    try {
      if (deleteConfirmItem.kind === 'homework') {
        await syncDeleteHomework(deleteConfirmItem.id);
      } else {
        await syncDeleteActivity(deleteConfirmItem.id, deleteConfirmItem.kind as ActivityKind);
      }
      onShowToast(`Deleted ${deleteConfirmItem.title}`, 'info');
      setDeleteConfirmItem(null);
      setGradingHomeworkId(null);
      setGradingActivityId(null);
    } catch (err: any) {
      onShowToast('Failed to delete: ' + err.message, 'error');
    }
  };

  // Export Exam Analytics to CSV
  const handleExportAnalyticsCSV = () => {
    if (!analyticsActivity) return;
    const targetStudents: StudentItem[] = [];
    analyticsActivity.classIds.forEach(cId => {
      studentsOf(cId, state).forEach(s => {
        if (!targetStudents.some(x => x.id === s.id)) targetStudents.push(s);
      });
    });

    const headers = ['Student ID', 'Student Name', 'Class', 'Status', 'Score', 'Max Score', 'Percentage', 'Grade', 'Pass/Fail', 'Tab Switches', 'Submitted At'];
    const rows = targetStudents.map(st => {
      const att = attemptsList.find(a => a.activityId === analyticsActivity.id && a.studentId === st.id);
      const studentClass = state.classes.find(c => st.classIds.includes(c.id))?.name || 'Class';
      const pct = att?.score !== undefined && analyticsActivity.maxScore > 0 ? ((att.score / analyticsActivity.maxScore) * 100).toFixed(1) : 'N/A';
      return [
        st.id,
        `"${st.name}"`,
        `"${studentClass}"`,
        att?.status || 'not_started',
        att?.score !== undefined ? att.score : '',
        analyticsActivity.maxScore,
        pct,
        att?.grade || '',
        att?.passed ? 'Pass' : att?.passed === false ? 'Fail' : '',
        att?.tabSwitchesCount || 0,
        att?.submittedAt || '',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${analyticsActivity.title.replace(/\s+/g, '_')}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Exported results to CSV', 'success');
  };

  // Enrolled students for current grading view
  const enrolledGradingStudents = useMemo(() => {
    const targetClasses = currentGradingHw?.classIds || currentGradingAct?.classIds || [];
    const sMap = new Map<string, StudentItem>();
    targetClasses.forEach(cId => {
      studentsOf(cId, state).forEach(s => sMap.set(s.id, s));
    });
    return Array.from(sMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentGradingHw, currentGradingAct, state]);

  // Combined stats for grading view
  const gradingStats = useMemo(() => {
    const total = enrolledGradingStudents.length;
    let submitted = 0;
    let late = 0;
    let marked = 0;
    let totalScore = 0;
    let markedCount = 0;

    if (currentGradingHw) {
      const subs = submissionsList.filter(s => s.homeworkId === currentGradingHw.id);
      subs.forEach(s => {
        if (s.status === 'submitted') submitted++;
        else if (s.status === 'late') late++;
        else if (s.status === 'marked') {
          marked++;
          if (s.score !== undefined) {
            totalScore += s.score;
            markedCount++;
          }
        }
      });
    } else if (currentGradingAct) {
      const atts = attemptsList.filter(a => a.activityId === currentGradingAct.id);
      atts.forEach(a => {
        if (a.status === 'submitted') submitted++;
        else if (a.status === 'auto_submitted') late++;
        else if (a.status === 'marked') {
          marked++;
          if (a.score !== undefined) {
            totalScore += a.score;
            markedCount++;
          }
        }
      });
    }

    const unsubmitted = Math.max(0, total - (submitted + late + marked));
    const avg = markedCount > 0 ? round1(totalScore / markedCount) : 0;
    return { total, submitted, late, marked, unsubmitted, avg };
  }, [currentGradingHw, currentGradingAct, submissionsList, attemptsList, enrolledGradingStudents]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* =================================================================== */}
      {/* HEADER BAR & CONTROLS */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>Class Activity Center</span>
                {unreadHomeworkCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                    {unreadHomeworkCount} New
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create homework, interactive quizzes, examinations & grade student submissions
              </p>
            </div>
          </div>

          {/* Action Button with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNewMenuOpen(prev => !prev)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Activity</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isNewMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-30 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('homework')}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2.5"
                >
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="block font-bold">Homework</span>
                    <span className="text-[10px] text-slate-400 font-normal">Assignment & document forms</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('quiz')}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2.5"
                >
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="block font-bold">Monthly Quiz</span>
                    <span className="text-[10px] text-slate-400 font-normal">Timed interactive quiz form</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('exam')}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2.5"
                >
                  <Award className="w-4 h-4 text-rose-600" />
                  <div>
                    <span className="block font-bold">Achievement & Final Exam</span>
                    <span className="text-[10px] text-slate-400 font-normal">Sections, grading scale & analytics</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('custom')}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="block font-bold">Custom Activity</span>
                    <span className="text-[10px] text-slate-400 font-normal">Speaking, project, discussion</span>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    setIsReuseModalOpen(true);
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-2.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Reuse / Duplicate Existing</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveSection('homework');
              setGradingHomeworkId(null);
              setGradingActivityId(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'homework'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Homework</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-black">
              {homeworkList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('quizzes');
              setGradingHomeworkId(null);
              setGradingActivityId(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'quizzes'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Quizzes</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-black">
              {activitiesList.filter(a => a.kind === 'quiz').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('achievement');
              setGradingHomeworkId(null);
              setGradingActivityId(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'achievement'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Achievement & Exams</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-black">
              {activitiesList.filter(a => a.kind === 'exam').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('custom');
              setGradingHomeworkId(null);
              setGradingActivityId(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'custom'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Activities</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-black">
              {activitiesList.filter(a => a.kind === 'custom').length}
            </span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION VIEW RENDERERS */}
      {/* =================================================================== */}

      {/* A. HOMEWORK SECTION */}
      {activeSection === 'homework' && !currentGradingHw && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {homeworkList.map(hw => {
              const subs = submissionsList.filter(s => s.homeworkId === hw.id);
              const submittedCount = subs.filter(s => s.status === 'submitted' || s.status === 'late' || s.status === 'marked' || (s.status as string) === 'auto_submitted').length;
              const markedCount = subs.filter(s => s.status === 'marked').length;
              
              const uniqueEnrolled = new Set<string>();
              hw.classIds.forEach(cId => {
                studentsOf(cId, state).forEach(st => uniqueEnrolled.add(st.id));
              });
              const totalStudents = uniqueEnrolled.size;

              return (
                <div
                  key={hw.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <ActivityCardThumbnail
                    thumbnail={hw.thumbnail}
                    kind="homework"
                    difficulty={hw.difficulty}
                    label={hw.type === 'form' ? 'Interactive Form' : 'Document'}
                  />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        {hw.type === 'form' ? 'Interactive Form' : 'Document'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(hw, 'homework')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Homework"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem({ id: hw.id, title: hw.title, kind: 'homework' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Homework"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {hw.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {hw.instructions || 'No instructions provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <span className="font-black text-purple-600 dark:text-purple-400">{submittedCount}</span>
                      <span className="text-slate-400"> / {totalStudents} submitted</span>
                      {markedCount > 0 && (
                        <span className="text-emerald-600 font-bold block text-[10px]">
                          {markedCount} marked
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setGradingHomeworkId(hw.id)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Submissions</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* B. QUIZZES SECTION */}
      {activeSection === 'quizzes' && !currentGradingAct && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activitiesList.filter(a => a.kind === 'quiz').map(quiz => {
              const atts = attemptsList.filter(a => a.activityId === quiz.id);
              const submittedCount = atts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted' || a.status === 'marked').length;
              const markedCount = atts.filter(a => a.status === 'marked').length;
              
              const uniqueEnrolled = new Set<string>();
              quiz.classIds.forEach(cId => {
                studentsOf(cId, state).forEach(st => uniqueEnrolled.add(st.id));
              });
              const totalStudents = uniqueEnrolled.size;

              return (
                <div
                  key={quiz.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <ActivityCardThumbnail
                    thumbnail={quiz.thumbnail}
                    kind="quiz"
                    difficulty={quiz.difficulty}
                    label="Quiz"
                  />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        <span>{quiz.durationMinutes} Mins</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(quiz, 'quiz')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Quiz"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem({ id: quiz.id, title: quiz.title, kind: 'quiz' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {quiz.instructions || 'Interactive timed monthly quiz.'}
                    </p>

                    <div className="text-[10px] text-slate-400 space-y-1 font-mono">
                      {quiz.opensAt && <div>Opens: {quiz.opensAt.replace('T', ' ')}</div>}
                      {quiz.closesAt && <div>Closes: {quiz.closesAt.replace('T', ' ')}</div>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">{submittedCount}</span>
                      <span className="text-slate-400"> / {totalStudents} attempts</span>
                      {markedCount > 0 && (
                        <span className="text-emerald-600 font-bold block text-[10px]">
                          {markedCount} graded
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setGradingActivityId(quiz.id)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Submissions</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* C. ACHIEVEMENT & FINAL EXAM SECTION */}
      {activeSection === 'achievement' && !currentGradingAct && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activitiesList.filter(a => a.kind === 'exam').map(exam => {
              const atts = attemptsList.filter(a => a.activityId === exam.id);
              const submittedCount = atts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted' || a.status === 'marked').length;
              const markedCount = atts.filter(a => a.status === 'marked').length;

              const uniqueEnrolled = new Set<string>();
              exam.classIds.forEach(cId => {
                studentsOf(cId, state).forEach(st => uniqueEnrolled.add(st.id));
              });
              const totalStudents = uniqueEnrolled.size;

              return (
                <div
                  key={exam.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <ActivityCardThumbnail
                    thumbnail={exam.thumbnail}
                    kind="exam"
                    difficulty={exam.difficulty}
                    label="Final Exam"
                  />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{(exam.sections || []).length} Sections &middot; {exam.durationMinutes}m</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAnalyticsActivityId(exam.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Exam Analytics"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(exam, 'exam')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Exam"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem({ id: exam.id, title: exam.title, kind: 'exam' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Exam"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {exam.instructions || 'Comprehensive Achievement & Final Examination.'}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Pass: {exam.passPercent || 50}%</span>
                      <span>&middot;</span>
                      <span>Max: {exam.maxScore} pts</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <span className="font-black text-rose-600 dark:text-rose-400">{submittedCount}</span>
                      <span className="text-slate-400"> / {totalStudents}</span>
                      {markedCount > 0 && (
                        <span className="text-emerald-600 font-bold block text-[10px]">
                          {markedCount} graded
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAnalyticsActivityId(exam.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Analytics</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGradingActivityId(exam.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Grade</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* D. CUSTOM ACTIVITIES SECTION */}
      {activeSection === 'custom' && !currentGradingAct && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activitiesList.filter(a => a.kind === 'custom').map(act => {
              const atts = attemptsList.filter(a => a.activityId === act.id);
              const submittedCount = atts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted' || a.status === 'marked').length;
              const markedCount = atts.filter(a => a.status === 'marked').length;

              const uniqueEnrolled = new Set<string>();
              act.classIds.forEach(cId => {
                studentsOf(cId, state).forEach(st => uniqueEnrolled.add(st.id));
              });
              const totalStudents = uniqueEnrolled.size;

              return (
                <div
                  key={act.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <ActivityCardThumbnail
                    thumbnail={act.thumbnail}
                    kind="custom"
                    difficulty={act.difficulty}
                    label={act.activityTypeLabel || 'Task'}
                  />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {act.activityTypeLabel || 'Custom Task'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(act, 'custom')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Activity"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem({ id: act.id, title: act.title, kind: 'custom' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Activity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {act.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {act.instructions || 'Custom class activity.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <span className="font-black text-amber-600 dark:text-amber-400">{submittedCount}</span>
                      <span className="text-slate-400"> / {totalStudents}</span>
                      {markedCount > 0 && (
                        <span className="text-emerald-600 font-bold block text-[10px]">
                          {markedCount} graded
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setGradingActivityId(act.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Submissions</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUBMISSIONS & GRADING VIEW (FOR HOMEWORK OR ACTIVITY) */}
      {/* =================================================================== */}
      {(currentGradingHw || currentGradingAct) && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => {
                  setGradingHomeworkId(null);
                  setGradingActivityId(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Activities</span>
              </button>

              <div className="flex items-center gap-2">
                {currentGradingAct && (
                  <>
                    <button
                      type="button"
                      onClick={handleAutoMarkAll}
                      disabled={isMarkingLoading}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-mark All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => syncReleaseActivityResults(currentGradingAct.id)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Release All Results</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Enrolled</span>
                <span className="text-xl font-black text-slate-900 dark:text-white block">{gradingStats.total}</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Submitted</span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300 block">{gradingStats.submitted}</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Late / Overtime</span>
                <span className="text-xl font-black text-amber-700 dark:text-amber-300 block">{gradingStats.late}</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Marked</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 block">{gradingStats.marked}</span>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/40 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-purple-600 uppercase">Average Score</span>
                <span className="text-xl font-black text-purple-700 dark:text-purple-300 block">{gradingStats.avg}</span>
              </div>
            </div>

            {/* Student List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Student Submissions</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {enrolledGradingStudents.map(student => {
                  const sub = currentGradingHw
                    ? submissionsList.find(s => s.homeworkId === currentGradingHw.id && s.studentId === student.id)
                    : null;
                  const att = currentGradingAct
                    ? attemptsList.find(a => a.activityId === currentGradingAct.id && a.studentId === student.id)
                    : null;
                  const status = sub?.status || att?.status || 'not_started';
                  const score = sub?.score !== undefined ? sub.score : att?.score !== undefined ? att.score : null;

                  return (
                    <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm block">{student.name}</span>
                        <span className="text-xs font-mono text-slate-400">{student.studentNo || student.id}</span>
                        {att?.tabSwitchesCount && att.tabSwitchesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold ml-2">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Tab switched: {att.tabSwitchesCount}x</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          status === 'marked'
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : status === 'submitted'
                            ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                            : status === 'auto_submitted'
                            ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                            : status === 'resubmit_requested'
                            ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {status === 'marked'
                            ? `Marked: ${score} pts`
                            : status === 'auto_submitted'
                            ? 'Auto-submitted'
                            : status === 'submitted'
                            ? 'Ready to mark'
                            : status === 'resubmit_requested'
                            ? 'Redo Requested'
                            : 'Not submitted'}
                        </span>

                        {status !== 'not_started' && (
                          <button
                            type="button"
                            onClick={async () => {
                              setSelectedSubmissionStudent(student);
                              setAwardedMarks(sub?.questionMarks || att?.questionMarks || {});
                              setQuestionComments(sub?.questionComments || att?.questionComments || {});
                              setOverallTeacherNote(sub?.teacherNote || att?.teacherNote || '');
                              setOverallScoreOverride(score !== null ? score : '');
                              if (currentGradingHw) {
                                const key = await syncFetchHomeworkAnswerKey(currentGradingHw.id);
                                setActiveAnswerKey(key?.keys || null);
                              } else if (currentGradingAct) {
                                const key = await syncFetchActivityAnswerKey(currentGradingAct.id);
                                setActiveAnswerKey(key || null);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Grade / Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT FORM BUILDER */}
      {/* =================================================================== */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={editingItemId ? `Edit ${createKind.toUpperCase()}` : `Create New ${createKind.toUpperCase()}`}
          size="xl"
        >
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={itemTitle}
                  onChange={e => setItemTitle(e.target.value)}
                  placeholder="e.g. Mid-Term Examination / Chapter 5 Quiz"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions
                </label>
                <textarea
                  rows={2}
                  value={itemInstructions}
                  onChange={e => setItemInstructions(e.target.value)}
                  placeholder="Instructions for students..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              {/* Assign Classes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to Classes *
                </label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-slate-800">
                  {state.classes.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemClassIds.includes(c.id)}
                        onChange={e => {
                          if (e.target.checked) setItemClassIds(prev => [...prev, c.id]);
                          else setItemClassIds(prev => prev.filter(x => x !== c.id));
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Timing & Duration */}
              <div className="space-y-2">
                {createKind === 'quiz' || createKind === 'exam' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Opens At</label>
                      <input
                        type="datetime-local"
                        value={itemOpensAt}
                        onChange={e => setItemOpensAt(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closes At</label>
                      <input
                        type="datetime-local"
                        value={itemClosesAt}
                        onChange={e => setItemClosesAt(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Duration (Minutes)</label>
                      <input
                        type="number"
                        min={1}
                        max={360}
                        value={itemDurationMinutes}
                        onChange={e => setItemDurationMinutes(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date & Time</label>
                    <input
                      type="datetime-local"
                      value={itemDueDateTime}
                      onChange={e => setItemDueDateTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Activity Thumbnail & Difficulty Level Configuration */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                {/* 16:9 Thumbnail Builder */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Thumbnail Image (16:9)
                    </label>
                    {itemThumbnail && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Custom 16:9 set</span>
                    )}
                  </div>

                  {itemThumbnail ? (
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 group shadow-sm">
                        <img src={itemThumbnail} alt="Thumbnail preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="px-3 py-1.5 rounded-lg bg-white/95 text-slate-800 text-xs font-bold cursor-pointer hover:bg-white flex items-center gap-1 shadow">
                            <Upload className="w-3.5 h-3.5 text-purple-600" />
                            <span>Replace</span>
                            <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={() => setItemThumbnail(undefined)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <label className="font-bold text-purple-600 hover:text-purple-500 cursor-pointer inline-flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>Replace</span>
                          <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
                        </label>
                        <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                        <button
                          type="button"
                          onClick={() => setItemThumbnail(undefined)}
                          className="font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                          Remove (Use Default)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center transition-all bg-white dark:bg-slate-900/40">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">No Custom Thumbnail</span>
                      <span className="text-[10px] text-slate-400 mb-2">Default {createKind} banner will be shown</span>
                      <label className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isProcessingThumbnail ? 'Processing...' : 'Set Thumbnail'}</span>
                        <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={isProcessingThumbnail} />
                      </label>
                    </div>
                  )}
                </div>

                {/* Difficulty Rating (1 to 5) */}
                <div className="space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Difficulty Rating (1 to 5)
                      </label>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getDifficultyMeta(itemDifficulty).badgeClass}`}>
                        {getDifficultyMeta(itemDifficulty).stars} {getDifficultyMeta(itemDifficulty).label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Indicates challenge level to students (from beginner to advanced exam prep).
                    </p>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 pt-2">
                    {[1, 2, 3, 4, 5].map((lvl) => {
                      const meta = DIFFICULTY_LEVELS[lvl];
                      const isSelected = itemDifficulty === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setItemDifficulty(lvl)}
                          className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? `${meta.badgeClass} ring-2 ring-purple-500/50 font-black shadow-xs scale-102`
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 font-semibold'
                          }`}
                        >
                          <span className="text-xs font-black">{lvl}</span>
                          <span className="text-[9px] leading-tight truncate w-full text-center mt-0.5">{meta.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
                    <span>1 = Very Easy</span>
                    <span>3 = Medium</span>
                    <span>5 = Very Hard</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Questions ({questions.length}) &middot; Total: {questions.reduce((a, b) => a + (Number(b.points) || 0), 0)} pts</span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={q.title}
                          onChange={e => handleUpdateQuestion(q.id, { title: e.target.value })}
                          placeholder="Question text..."
                          className="bg-transparent font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-b border-purple-500 w-48 sm:w-80"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleMoveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleMoveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDuplicateQuestion(q.id)} className="p-1 text-slate-400 hover:text-purple-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteQuestion(q.id)} className="p-1 text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Question Type & Points */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                        <select
                          value={q.type}
                          onChange={e => {
                            const newType = e.target.value as HomeworkQuestionType;
                            handleUpdateQuestion(q.id, {
                              type: newType,
                              options: newType === 'choice' || newType === 'checkbox' || newType === 'dropdown'
                                ? q.options || ['Option 1', 'Option 2', 'Option 3', 'Option 4']
                                : undefined,
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                        >
                          <option value="choice">Multiple Choice</option>
                          <option value="checkbox">Checkboxes</option>
                          <option value="short">Short Answer</option>
                          <option value="long">Long Answer</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="boolean">True / False</option>
                          <option value="photo">Photo Upload</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Points</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={q.points}
                          onChange={e => handleUpdateQuestion(q.id, { points: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono"
                        />
                      </div>

                      {/* Question Image Attachment */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Question Image</label>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                          <span>{q.image ? 'Change Image' : 'Attach Image'}</span>
                          <input type="file" accept="image/*" onChange={e => handleQuestionImageUpload(q.id, e)} className="hidden" />
                        </label>
                        {q.image && (
                          <div className="mt-1 relative inline-block">
                            <img src={q.image} alt="Question" className="w-16 h-12 object-cover rounded-lg border" />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(q.id, { image: undefined })}
                              className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Options list for choice / checkbox */}
                    {(q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') && (
                      <div className="space-y-2 pt-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Answer Options & Key</label>
                        {(q.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type={q.type === 'checkbox' ? 'checkbox' : 'radio'}
                              name={`key_${q.id}`}
                              checked={
                                q.type === 'checkbox'
                                  ? Array.isArray(answerKeys[q.id]) && (answerKeys[q.id] as string[]).includes(opt)
                                  : answerKeys[q.id] === opt
                              }
                              onChange={e => {
                                if (q.type === 'checkbox') {
                                  const currentArr = Array.isArray(answerKeys[q.id]) ? (answerKeys[q.id] as string[]) : [];
                                  const nextArr = e.target.checked
                                    ? [...currentArr, opt]
                                    : currentArr.filter(x => x !== opt);
                                  setAnswerKeys(prev => ({ ...prev, [q.id]: nextArr }));
                                } else {
                                  setAnswerKeys(prev => ({ ...prev, [q.id]: opt }));
                                }
                              }}
                              className="rounded text-purple-600 cursor-pointer"
                              title="Set as correct answer key"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={e => handleUpdateOption(q.id, optIdx, e.target.value)}
                              className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(q.id, optIdx)}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddOption(q.id)}
                          className="text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Option</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveActivity}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:opacity-90 cursor-pointer"
              >
                Save & Publish
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: EXAM ANALYTICS */}
      {/* =================================================================== */}
      {analyticsActivity && (
        <Modal
          isOpen={!!analyticsActivity}
          onClose={() => setAnalyticsActivityId(null)}
          title={`Analytics: ${analyticsActivity.title}`}
          size="xl"
        >
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExportAnalyticsCSV}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Results to CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-purple-50 dark:bg-purple-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-purple-600 uppercase">Average Score</span>
                <span className="text-xl font-black text-purple-700 dark:text-purple-300 block">{gradingStats.avg} pts</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Passed</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 block">{gradingStats.marked}</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Max Possible</span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300 block">{analyticsActivity.maxScore}</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Pass Benchmark</span>
                <span className="text-xl font-black text-amber-700 dark:text-amber-300 block">{analyticsActivity.passPercent || 50}%</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: REUSE / DUPLICATE */}
      {/* =================================================================== */}
      {isReuseModalOpen && (
        <Modal
          isOpen={isReuseModalOpen}
          onClose={() => setIsReuseModalOpen(false)}
          title="Reuse / Duplicate Past Activity"
          size="lg"
        >
          <div className="space-y-4">
            <input
              type="text"
              value={reuseSearch}
              onChange={e => setReuseSearch(e.target.value)}
              placeholder="Search past activities or homework..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />

            <div className="max-h-72 overflow-y-auto space-y-2">
              {[...homeworkList, ...activitiesList]
                .filter(item => item.title.toLowerCase().includes(reuseSearch.toLowerCase()))
                .map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{item.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {(item as any).kind || 'Homework'} &middot; Max: {item.maxScore} pts
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(item as any)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Duplicate
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* CONFIRM DELETE MODAL */}
      {/* =================================================================== */}
      {deleteConfirmItem && (
        <Modal
          isOpen={!!deleteConfirmItem}
          onClose={() => setDeleteConfirmItem(null)}
          title="Delete Activity"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <strong>{deleteConfirmItem.title}</strong>? All student submissions and grades will also be permanently deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
