import React, { useState, useEffect } from 'react';
import { Question, StudentAnswers, StudentScratchpads, OPTION_LABELS, ExamSettings, UserRole, ExamSubmission } from '../types/quiz';
import { downloadQuestionsAsJSON } from '../utils/fileParsers';
import { exportResultReportPDF } from '../utils/pdfExporter';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import confetti from 'canvas-confetti';
import { 
  Award, CheckCircle, XCircle, AlertCircle, RotateCcw,
  Download, ArrowRight, Lightbulb, Clock, Check, X,
  FileEdit, Sparkles, Filter, Edit3, Share2, FileDown, Lock, BookOpen, Loader2,
  User, ArrowLeft
} from 'lucide-react';

interface ResultsStageProps {
  questions: Question[];
  examTitle: string;
  answers: StudentAnswers;
  scratchpads: StudentScratchpads;
  timeSpentSeconds: number;
  settings?: ExamSettings;
  attemptNumber?: number;
  userRole?: UserRole;
  viewingSubmission?: ExamSubmission | null;
  onRetakeAll: () => void;
  onRetakeIncorrectOnly: (incorrectQuestions: Question[]) => void;
  onBackToReview: () => void;
  onNewExam: () => void;
  onBackToSubmissions?: () => void;
}

export const ResultsStage: React.FC<ResultsStageProps> = ({
  questions,
  examTitle,
  answers,
  scratchpads,
  timeSpentSeconds,
  settings,
  attemptNumber = 1,
  userRole = 'teacher',
  viewingSubmission = null,
  onRetakeAll,
  onRetakeIncorrectOnly,
  onBackToReview,
  onNewExam,
  onBackToSubmissions
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct' | 'unanswered'>('all');
  const [copiedShare, setCopiedShare] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isRetakeExhausted = Boolean(
    settings?.maxAttempts && settings.maxAttempts > 0 && attemptNumber >= settings.maxAttempts
  );

  // Calculate score
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const evaluatedQuestions = questions.map((q) => {
    const studentAns = answers[q.id];
    const isUnanswered = studentAns === null || studentAns === undefined;
    const isCorrect = studentAns === q.answer;

    if (isUnanswered) unansweredCount++;
    else if (isCorrect) correctCount++;
    else wrongCount++;

    return {
      question: q,
      studentAns,
      isCorrect,
      isUnanswered
    };
  });

  const percentage = Math.round((correctCount / questions.length) * 100);

  // Trigger celebration confetti on high scores
  useEffect(() => {
    if (percentage >= 75) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignore canvas error if any
      }
    }
  }, [percentage]);

  // Format time
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins} دقيقة و ${remSecs} ثانية`;
  };

  // Grade Assessment
  const getRating = () => {
    if (percentage >= 90) return { label: 'ممتاز مبهر!', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (percentage >= 80) return { label: 'مستوى متقدم وجيد جداً', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' };
    if (percentage >= 65) return { label: 'أداء جيد، مع فرصة للتحسين', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    return { label: 'بحاجة إلى تكثيف التدريب', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  };

  const rating = getRating();

  // Filtered list
  const filteredList = evaluatedQuestions.filter(item => {
    if (filterMode === 'correct') return item.isCorrect;
    if (filterMode === 'wrong') return !item.isCorrect && !item.isUnanswered;
    if (filterMode === 'unanswered') return item.isUnanswered;
    return true;
  });

  // Incorrect questions for retake
  const incorrectQuestions = evaluatedQuestions
    .filter(item => !item.isCorrect)
    .map(item => item.question);

  const handleShareResult = () => {
    const text = `أكملت تدريب (${examTitle}) وحققت ${correctCount} من ${questions.length} بنسبة ${percentage}% على منصة تدريب القدرات والتحصيلي.`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleDownloadResultPDF = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await exportResultReportPDF({
        title: viewingSubmission ? `${examTitle} - ${viewingSubmission.examineeName}` : (examTitle || 'اختبار تدريب القدرات والتحصيلي'),
        studentName: viewingSubmission ? viewingSubmission.examineeName : undefined,
        percentage,
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions: questions.length,
        timeSpentFormatted: formatTime(timeSpentSeconds),
        attemptNumber,
        ratingLabel: rating.label,
        questions,
        answers,
        scratchpads
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      
      {/* Teacher Examinee Review Mode Banner */}
      {viewingSubmission && (
        <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3b4cb8] text-white flex items-center justify-center font-black shrink-0 shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  لوحة المعلم • استعراض ورقة إجابة
                </span>
                <span className="text-xs text-slate-500">
                  المحاولة ({viewingSubmission.attemptNumber})
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                ورقة إجابة الطالب: {viewingSubmission.examineeName}
              </h3>
            </div>
          </div>

          {onBackToSubmissions && (
            <button
              type="button"
              onClick={onBackToSubmissions}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#3b4cb8] dark:text-indigo-300 text-xs sm:text-sm font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة لقائمة نتائج المختبرين</span>
            </button>
          )}
        </div>
      )}

      {/* Score Summary Card */}
      <div className="bg-white dark:bg-[#151c2c] border border-[#e2e8f0] dark:border-slate-800 rounded-3xl p-6 sm:p-10 mb-10 shadow-stitch-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-slate-100 dark:border-slate-800">
          
          {/* Main Score & Grade */}
          <div className="text-center md:text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${rating.bg} ${rating.color} ${rating.border} border`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{rating.label}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
              {viewingSubmission ? `نتيجة (${viewingSubmission.examineeName}) في: ${examTitle}` : `نتيجتك في: ${examTitle}`}
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>الوقت المستغرق: {formatTime(timeSpentSeconds)}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-[#3b4cb8] dark:text-indigo-400 font-medium">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>المحاولة {attemptNumber} {settings?.maxAttempts && settings.maxAttempts > 0 ? `من ${settings.maxAttempts}` : '(مفتوحة)'}</span>
              </span>
            </div>
          </div>

          {/* Big Score Circular / Number Display */}
          <div className="flex items-center gap-5">
            <div className="text-center bg-[#f8fafc] dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700 rounded-2xl p-5 min-w-[135px] shadow-xs">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                {correctCount} <span className="text-xl sm:text-2xl text-slate-400 font-normal">/ {questions.length}</span>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 block">
                النتيجة النهائية
              </span>
            </div>

            <div className="text-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 min-w-[130px] shadow-xs">
              <div className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {percentage}٪
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1 block">
                النسبة المئوية
              </span>
            </div>
          </div>

        </div>

        {/* Detailed Metrics row */}
        <div className="grid grid-cols-3 gap-3 pt-6 text-center text-xs">
          <div className="bg-[#f8fafc] dark:bg-[#1a2236] border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <span className="text-emerald-700 dark:text-emerald-400 font-black text-lg block">{correctCount}</span>
            <span className="text-slate-500 dark:text-slate-400">إجابة صحيحة</span>
          </div>

          <div className="bg-[#f8fafc] dark:bg-[#1a2236] border border-red-200 dark:border-red-800 rounded-xl p-3">
            <span className="text-red-600 dark:text-red-400 font-black text-lg block">{wrongCount}</span>
            <span className="text-slate-500 dark:text-slate-400">إجابة خاطئة</span>
          </div>

          <div className="bg-[#f8fafc] dark:bg-[#1a2236] border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <span className="text-amber-700 dark:text-amber-400 font-black text-lg block">{unansweredCount}</span>
            <span className="text-slate-500 dark:text-slate-400">لم يتم الإجابة عليها</span>
          </div>
        </div>

        {/* Action Buttons bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {viewingSubmission ? (
              onBackToSubmissions && (
                <button
                  type="button"
                  onClick={onBackToSubmissions}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>العودة لنتائج المختبرين</span>
                </button>
              )
            ) : isRetakeExhausted ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>تم استنفاد الحد الأقصى للمحاولات المسموحة ({settings?.maxAttempts} من {settings?.maxAttempts})</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRetakeAll}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة الاختبار كاملاً</span>
                </button>

                {incorrectQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onRetakeIncorrectOnly(incorrectQuestions)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>إعادة الأسئلة الخاطئة ({incorrectQuestions.length})</span>
                  </button>
                )}
              </>
            )}

            {userRole === 'teacher' ? (
              <button
                type="button"
                onClick={onBackToReview}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                <FileEdit className="w-4 h-4 text-slate-500" />
                <span>تعديل الأسئلة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNewExam}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                <BookOpen className="w-4 h-4 text-[#3b4cb8]" />
                <span>العودة للاختبارات</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadResultPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-75 disabled:cursor-wait text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="تحميل تقرير النتيجة كملف PDF على جهازك مباشرة"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تحميل ملف الـ PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>تحميل النتيجة (PDF)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Detailed Review Section */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>مراجعة الأسئلة بالتفصيل</span>
            <span className="text-xs font-normal text-slate-500">({questions.length} مسألة)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تفاصيل إجاباتك مع توضيح خطوات الحل والشرح المعتمد
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white text-[#3b4cb8] font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('wrong')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterMode === 'wrong'
                ? 'bg-white text-red-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأخطاء ({wrongCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('correct')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterMode === 'correct'
                ? 'bg-white text-emerald-700 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الصحيحة ({correctCount})
          </button>

          {unansweredCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterMode('unanswered')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'unanswered'
                  ? 'bg-white text-amber-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المتروكة ({unansweredCount})
            </button>
          )}
        </div>
      </div>

      {/* Questions Review Cards List */}
      <div className="space-y-6 mb-12">
        {filteredList.map((item, idx) => {
          const { question: q, studentAns, isCorrect, isUnanswered } = item;
          const scratchpadNote = scratchpads[q.id];

          return (
            <div
              key={q.id}
              className={`bg-white dark:bg-[#151c2c] rounded-2xl border p-5 sm:p-6 shadow-stitch-card transition-all ${
                isCorrect
                  ? 'border-emerald-200 dark:border-emerald-800'
                  : isUnanswered
                  ? 'border-amber-200 dark:border-amber-800'
                  : 'border-red-200 dark:border-red-800'
              }`}
            >
              {/* Question Card Header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isUnanswered
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}>
                    {idx + 1}
                  </span>

                  {q.category && (
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-[#f8fafc] dark:bg-[#1e293b] px-3 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                      {q.category}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {isCorrect ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>إجابة صحيحة</span>
                    </span>
                  ) : isUnanswered ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>لم تجب على السؤال</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                      <span>إجابة خاطئة</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text with Math/Formula Rendering */}
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-4">
                <MathFormulaRenderer text={q.question} />
              </h3>

              {/* Geometric Diagram or Question Image if available */}
              {q.diagramSvg && (
                <div 
                  className="my-3 p-3 bg-[#f8fafc] dark:bg-[#1a2236] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: q.diagramSvg }}
                />
              )}

              {q.imageUrl && (
                <div className="my-3 p-2 bg-[#f8fafc] dark:bg-[#1a2236] rounded-xl border border-slate-200 dark:border-slate-800 flex justify-center">
                  <img 
                    src={q.imageUrl} 
                    alt="رسمة السؤال التوضيحية" 
                    className="max-h-56 rounded-lg object-contain shadow-xs bg-white dark:bg-[#151c2c]"
                  />
                </div>
              )}

              {/* Options Grid (Indicating Student Answer & Correct Answer) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {q.options.map((optText, optIdx) => {
                  const label = OPTION_LABELS[optIdx];
                  const isThisCorrect = q.answer === optIdx;
                  const isThisStudentChoice = studentAns === optIdx;

                  let borderClass = 'border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-[#1a2236] text-slate-700 dark:text-slate-300';
                  let badge = null;

                  if (isThisCorrect) {
                    borderClass = 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/10';
                    badge = (
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                        الإجابة الصحيحة
                      </span>
                    );
                  } else if (isThisStudentChoice && !isCorrect) {
                    borderClass = 'border-red-300 dark:border-red-700 bg-red-50/80 dark:bg-red-950/40 text-red-950 dark:text-red-200 line-through';
                    badge = (
                      <span className="text-[11px] font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-700">
                        إجابتك
                      </span>
                    );
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${borderClass}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {label}
                        </span>
                        <span>
                          <MathFormulaRenderer text={optText} />
                        </span>
                      </div>
                      {badge}
                    </div>
                  );
                })}
              </div>

              {/* Scratchpad note display if student wrote any */}
              {scratchpadNote && scratchpadNote.trim().length > 0 && (
                <div className="mb-4 bg-[#f8fafc] dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                    <Edit3 className="w-3.5 h-3.5 text-[#3b4cb8] dark:text-indigo-400" />
                    <span>مسودتك وملاحظاتك أثناء حل هذا السؤال:</span>
                  </div>
                  <p className="font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line bg-white dark:bg-[#151c2c] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    {scratchpadNote}
                  </p>
                </div>
              )}

              {/* Hint / Explanation Box */}
              {q.hint && q.hint.trim().length > 0 ? (
                <div className="bg-[#fffbeb] dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>طريقة الحل والتوضيح المعتمدة:</span>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-[#151c2c] p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 font-sans">
                    <MathFormulaRenderer text={q.hint} />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-2">
                  (لا توجد طريقة حل مضافة لهذا السؤال في لوحة المراجعة)
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Bottom Floating Bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 py-6 border-t border-slate-800">
        {viewingSubmission ? (
          onBackToSubmissions && (
            <button
              type="button"
              onClick={onBackToSubmissions}
              className="px-6 py-3 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة لنتائج المختبرين</span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onRetakeAll}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة الاختبار الآن</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNewExam}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-2"
        >
          <span>{viewingSubmission ? 'العودة للاختبارات المنشورة' : 'اختبار جديد / رفع ملف آخر'}</span>
        </button>
      </div>

    </div>
  );
};
