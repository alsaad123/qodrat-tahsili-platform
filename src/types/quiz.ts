export interface Question {
  id: string;
  question: string;
  options: [string, string, string, string]; // [أ, ب, ج, د]
  answer: number; // 0: أ, 1: ب, 2: ج, 3: د
  hint?: string; // طريقة الحل / التلميح
  category?: string; // مثلاً: كمي, لفظي, تحصيلي رياضيات, فيزياء, etc.
  imageUrl?: string; // صورة السؤال أو الرسمة الهندسية (Base64 أو رابط)
  diagramSvg?: string; // رسم تخطيطي هندسي SVG
}

export interface ExamSettings {
  durationMinutes: number; // 0 for unlimited, or e.g. 15, 30, 45, 60
  enableDateRange: boolean;
  startDate?: string; // YYYY-MM-DDTHH:mm
  endDate?: string;   // YYYY-MM-DDTHH:mm
  maxAttempts: number; // 0 for unlimited, or 1, 2, 3...
}

export interface ExamMetadata {
  title: string;
  sourceFileName?: string;
  fileType?: string;
  rawText?: string;
  createdAt: string;
  settings?: ExamSettings;
}

export type QuizStage = 'upload' | 'review' | 'quiz' | 'results';
export type UserRole = 'teacher' | 'student';

export interface StudentAnswers {
  [questionId: string]: number | null;
}

export interface StudentScratchpads {
  [questionId: string]: string;
}

export interface StudentFlags {
  [questionId: string]: boolean;
}

export interface PublishedExam {
  id: string;
  title: string;
  questions: Question[];
  settings: ExamSettings;
  publishedAt: string;
  questionCount: number;
  rawText?: string;
  sourceImage?: string;
  sourceImages?: string[];
  attemptsCount?: number;
  bestScore?: number;
}

export const OPTION_LABELS = ['أ', 'ب', 'ج', 'د'] as const;
export type OptionLabel = typeof OPTION_LABELS[number];

export interface ExamSubmission {
  id: string;
  examId: string;
  examTitle: string;
  examineeName: string; // "أول مختبر", "المختبر الثاني", etc.
  examineeIndex: number;
  submittedAt: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: StudentAnswers;
  scratchpads: StudentScratchpads;
  attemptNumber: number;
}

export function getExamineeLabel(index: number): string {
  const ordinals = [
    'أول مختبر',
    'المختبر الثاني',
    'المختبر الثالث',
    'المختبر الرابع',
    'المختبر الخامس',
    'المختبر السادس',
    'المختبر السابع',
    'المختبر الثامن',
    'المختبر التاسع',
    'المختبر العاشر'
  ];
  if (index < ordinals.length) {
    return ordinals[index];
  }
  return `المختبر (${index + 1})`;
}

