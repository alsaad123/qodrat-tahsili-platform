import React, { useState } from 'react';
import { Question, OPTION_LABELS, ExamSettings } from '../types/quiz';
import { downloadQuestionsAsJSON, readFileAsDataURL } from '../utils/fileParsers';
import { ImageCropperModal } from './ImageCropperModal';
import { PdfExportModal } from './PdfExportModal';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { 
  Download, Plus, Trash2, CheckCircle, ArrowLeft, ArrowRight,
  HelpCircle, AlertCircle, FileText, Sparkles, Copy, Lightbulb,
  Check, Tag, X, RefreshCw, Image as ImageIcon, Eye, Scissors, FileDown,
  Clock, Calendar, RotateCcw, Sliders, ChevronDown, ChevronUp
} from 'lucide-react';

interface ReviewStageProps {
  questions: Question[];
  examTitle: string;
  rawText: string;
  fallbackTriggered: boolean;
  sourceImage?: string;
  sourceImages?: string[];
  settings?: ExamSettings;
  onUpdateQuestions: (questions: Question[]) => void;
  onStartQuiz: (settings: ExamSettings) => void;
  onPublishExam: (settings: ExamSettings) => void;
  onGoToMyExams: () => void;
  onBackToUpload: () => void;
  onUpdateTitle: (title: string) => void;
}

export const ReviewStage: React.FC<ReviewStageProps> = ({
  questions,
  examTitle,
  rawText,
  fallbackTriggered,
  sourceImage,
  sourceImages,
  settings,
  onUpdateQuestions,
  onStartQuiz,
  onPublishExam,
  onGoToMyExams,
  onBackToUpload,
  onUpdateTitle
}) => {
  const [showRawTextModal, setShowRawTextModal] = useState(fallbackTriggered);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showPublishSuccessModal, setShowPublishSuccessModal] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Helper for formatting datetime-local
  const toDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const Y = date.getFullYear();
    const M = pad(date.getMonth() + 1);
    const D = pad(date.getDate());
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    return `${Y}-${M}-${D}T${h}:${m}`;
  };

  // Exam Configuration Settings State
  const [durationMinutes, setDurationMinutes] = useState<number>(settings?.durationMinutes ?? 30);
  const [enableDateRange, setEnableDateRange] = useState<boolean>(settings?.enableDateRange ?? false);
  const [startDate, setStartDate] = useState<string>(settings?.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(settings?.endDate ?? '');
  const [maxAttempts, setMaxAttempts] = useState<number>(settings?.maxAttempts ?? 1);
  const [showSettingsCard, setShowSettingsCard] = useState<boolean>(true);
  const [cropperModalState, setCropperModalState] = useState<{
    isOpen: boolean;
    questionId: string;
    questionIndex: number;
  }>({
    isOpen: false,
    questionId: '',
    questionIndex: 1
  });

  // Update question text
  const handleQuestionTextChange = (id: string, text: string) => {
    onUpdateQuestions(
      questions.map(q => q.id === id ? { ...q, question: text } : q)
    );
  };

  // Update option text
  const handleOptionChange = (id: string, optionIdx: number, text: string) => {
    onUpdateQuestions(
      questions.map(q => {
        if (q.id !== id) return q;
        const newOptions = [...q.options] as [string, string, string, string];
        newOptions[optionIdx] = text;
        return { ...q, options: newOptions };
      })
    );
  };

  // Update correct answer index (0 to 3)
  const handleAnswerSelect = (id: string, answerIdx: number) => {
    onUpdateQuestions(
      questions.map(q => q.id === id ? { ...q, answer: answerIdx } : q)
    );
  };

  // Update hint / solution
  const handleHintChange = (id: string, hintText: string) => {
    onUpdateQuestions(
      questions.map(q => q.id === id ? { ...q, hint: hintText } : q)
    );
  };

  // Update category
  const handleCategoryChange = (id: string, categoryText: string) => {
    onUpdateQuestions(
      questions.map(q => q.id === id ? { ...q, category: categoryText } : q)
    );
  };

  // Delete question
  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      setValidationError('يجب أن يحتوي الاختبار على سؤال واحد على الأقل.');
      return;
    }
    onUpdateQuestions(questions.filter(q => q.id !== id));
  };

  // Add new blank question
  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      question: `سؤال جديد رقم ${questions.length + 1}`,
      options: ['الخيار (أ)', 'الخيار (ب)', 'الخيار (ج)', 'الخيار (د)'],
      answer: 0,
      hint: '',
      category: 'عام'
    };
    onUpdateQuestions([...questions, newQ]);
  };

  // Duplicate question
  const handleDuplicateQuestion = (q: Question) => {
    const dup: Question = {
      ...q,
      id: `q-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      question: `${q.question} (نسخة)`
    };
    onUpdateQuestions([...questions, dup]);
  };

  // Image attachment handler
  const handleAttachImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      onUpdateQuestions(
        questions.map(q => q.id === id ? { ...q, imageUrl: dataUrl } : q)
      );
    } catch (err) {
      console.error('Failed to read image file:', err);
    }
  };

  // Remove attached image or diagram
  const handleRemoveImage = (id: string) => {
    onUpdateQuestions(
      questions.map(q => q.id === id ? { ...q, imageUrl: undefined, diagramSvg: undefined } : q)
    );
  };

  // Validate exam before preview or publish
  const validateExam = (): boolean => {
    setValidationError(null);
    if (questions.length === 0) {
      setValidationError('لا يوجد أي أسئلة في الاختبار. يرجى إضافة سؤال واحد على الأقل.');
      return false;
    }

    const emptyQuestions = questions.filter(q => !q.question.trim());
    if (emptyQuestions.length > 0) {
      setValidationError(`هناك ${emptyQuestions.length} سؤال بدون نص. يرجى كتابة نص السؤال أو حذفه.`);
      return false;
    }

    if (enableDateRange && startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        setValidationError('تاريخ بداية الاختبار يجب أن يكون قبل تاريخ انتهاء الاختبار.');
        return false;
      }
    }
    return true;
  };

  const getSettings = (): ExamSettings => ({
    durationMinutes,
    enableDateRange,
    startDate: enableDateRange ? startDate : undefined,
    endDate: enableDateRange ? endDate : undefined,
    maxAttempts
  });

  // Preview quiz from student perspective
  const handlePreviewQuiz = () => {
    if (!validateExam()) return;
    onStartQuiz(getSettings());
  };

  // Publish exam for students
  const handlePublish = () => {
    if (!validateExam()) return;
    onPublishExam(getSettings());
    setShowPublishSuccessModal(true);
  };

  // Export JSON handler
  const handleExport = () => {
    downloadQuestionsAsJSON(questions, examTitle || 'اختبار-قدرات-وتحصيلي');
  };

  // Copy raw text
  const handleCopyRawText = () => {
    navigator.clipboard.writeText(rawText);
    setCopiedRawText(true);
    setTimeout(() => setCopiedRawText(false), 2000);
  };

  const hintCount = questions.filter(q => q.hint && q.hint.trim().length > 0).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      
      {/* Top Banner / Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 sm:p-6 mb-6 shadow-stitch-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <button
                type="button"
                onClick={onBackToUpload}
                className="text-xs text-slate-500 hover:text-[#3b4cb8] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رفع ملف آخر</span>
              </button>
              {fallbackTriggered && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  مراجعة يدوية
                </span>
              )}
            </div>
            
            <input
              type="text"
              value={examTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="text-lg sm:text-xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#3b4cb8] focus:outline-none transition-colors px-0.5 py-0.5 max-w-md"
              placeholder="عنوان الاختبار..."
            />
            <p className="text-xs text-slate-500 mt-1">
              مراجعة الأسئلة وتحديد الإجابات الصحيحة والرسومات التوضيحية
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {rawText && (
              <button
                type="button"
                onClick={() => setShowRawTextModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-[#e2e8f0] transition-colors cursor-pointer shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>النص المستخرج</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-[#e2e8f0] transition-colors cursor-pointer shadow-sm"
            >
              <FileDown className="w-3.5 h-3.5 text-[#3b4cb8]" />
              <span>تصدير PDF</span>
            </button>

            {/* Preview Exam Button */}
            <button
              type="button"
              onClick={handlePreviewQuiz}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-[#3b4cb8] text-xs sm:text-sm font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer shadow-xs"
              title="معاينة الاختبار كما يراه الطالب قبل نشره"
            >
              <Eye className="w-4 h-4 text-[#3b4cb8]" />
              <span>معاينة الاختبار</span>
            </button>

            {/* Publish Exam Button */}
            <button
              type="button"
              onClick={handlePublish}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              title="نشر الاختبار وحفظه في قسم اختباراتي"
            >
              <Sparkles className="w-4 h-4" />
              <span>نشر الاختبار</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimal Stats Row */}
        <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>إجمالي المسائل: <strong className="text-slate-900 font-bold">{questions.length}</strong></span>
            <span>•</span>
            <span>مع خطوات الحل: <strong className="text-emerald-700 font-bold">{hintCount}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="text-xs font-semibold text-[#3b4cb8] hover:text-[#312e81] flex items-center gap-1 cursor-pointer bg-[#eef2ff] px-3 py-1.5 rounded-lg border border-[#c7d2fe]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سؤال جديد</span>
          </button>
        </div>
      </div>

      {/* Fallback Notice if triggered */}
      {fallbackTriggered && (
        <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>يرجى مراجعة وتعديل الأسئلة والخيارات أدناه قبل بدء الاختبار.</span>
        </div>
      )}

      {/* Validation Error banner */}
      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-red-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quiz Settings Card (Duration, Availability Dates, Max Attempts) */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 sm:p-6 mb-6 shadow-stitch-card">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eef2ff] text-[#3b4cb8] border border-[#c7d2fe] flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">إعدادات وقواعد الاختبار</h3>
              <p className="text-xs text-slate-500">حدد مدة الاختبار وتاريخ الإتاحة وعدد محاولات الإعادة</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsCard(!showSettingsCard)}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <span>{showSettingsCard ? 'طي الإعدادات' : 'تعديل الإعدادات'}</span>
            {showSettingsCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showSettingsCard ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            {/* 1. Time Limit / Duration */}
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-[#3b4cb8]" />
                  <span>مدة الاختبار (الوقت):</span>
                </div>
                <p className="text-slate-500 mb-3 text-[11px] leading-relaxed">
                  يظهر عداد تنازلي للطالب أثناء الحل وينهي الاختبار عند انتهاء الوقت.
                </p>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center text-xs ${
                        durationMinutes === mins
                          ? 'bg-[#3b4cb8] text-white shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {mins} دقيقة
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDurationMinutes(0)}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center text-xs col-span-2 ${
                      durationMinutes === 0
                        ? 'bg-[#3b4cb8] text-white shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    بدون توقيت (مفتوح)
                  </button>
                </div>

                {/* Custom Minutes Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500 text-[11px]">أو وقت مخصص:</span>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={durationMinutes > 0 ? durationMinutes : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setDurationMinutes(isNaN(val) ? 0 : Math.max(1, val));
                    }}
                    placeholder="دقائق..."
                    className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-center focus:border-[#3b4cb8] focus:outline-none"
                  />
                  <span className="text-slate-500 text-[11px]">دقيقة</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>الحالة:</span>
                <span className="font-bold text-[#3b4cb8]">
                  {durationMinutes === 0 ? 'مفتوح بدون حد زمني' : `${durationMinutes} دقيقة`}
                </span>
              </div>
            </div>

            {/* 2. Availability Dates */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Calendar className="w-4 h-4 text-teal-400" />
                    <span>فترة إتاحة الاختبار:</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={enableDateRange}
                      onChange={(e) => setEnableDateRange(e.target.checked)}
                      className="rounded accent-emerald-500 cursor-pointer"
                    />
                    <span>تحديد موعد</span>
                  </label>
                </div>
                <p className="text-slate-400 mb-3 text-[11px] leading-relaxed">
                  تحديد تاريخ ووقت بداية ونهاية السماح للطلاب بالدخول للاختبار.
                </p>

                {enableDateRange ? (
                  <div className="space-y-2">
                    {/* Quick Date Presets */}
                    <div className="flex flex-wrap items-center gap-1 pb-1 border-b border-slate-800/80">
                      <span className="text-[10px] text-slate-400">تحديد سريع:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const end = new Date();
                          end.setHours(23, 59, 0, 0);
                          setStartDate(toDateTimeLocal(now));
                          setEndDate(toDateTimeLocal(end));
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-teal-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        اليوم فقط
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                          setStartDate(toDateTimeLocal(now));
                          setEndDate(toDateTimeLocal(end));
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-teal-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        3 أيام
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                          setStartDate(toDateTimeLocal(now));
                          setEndDate(toDateTimeLocal(end));
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-teal-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        أسبوع كامل
                      </button>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">تاريخ ووقت البدء (متاح من):</label>
                      <input
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">تاريخ ووقت الانتهاء (متاح حتى):</label>
                      <input
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 text-center text-slate-400 text-[11px]">
                    الاختبار متاح دائماً بدون قيود زمنية للتاريخ.
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>الحالة:</span>
                <span className={`font-bold ${enableDateRange ? 'text-teal-400' : 'text-slate-400'}`}>
                  {enableDateRange ? 'محدد بفترة زمنية' : 'متاح دائماً'}
                </span>
              </div>
            </div>

            {/* 3. Retake Attempts */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 font-bold text-white">
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                  <span>عدد محاولات الإعادة:</span>
                </div>
                <p className="text-slate-400 mb-3 text-[11px] leading-relaxed">
                  كم مرة يستطيع الطالب إعادة خوض هذا الاختبار وتحسين درجته.
                </p>

                {/* Presets */}
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxAttempts(num)}
                      className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center text-xs ${
                        maxAttempts === num
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {num === 1 ? 'مرة واحدة' : num === 2 ? 'مرتان' : '3 مرات'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMaxAttempts(0)}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center text-xs col-span-3 ${
                      maxAttempts === 0
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    غير محدود (إعادة مفتوحة)
                  </button>
                </div>

                {/* Custom attempts input */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 text-[11px]">أو عدد محدد:</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxAttempts > 0 ? maxAttempts : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMaxAttempts(isNaN(val) ? 0 : Math.max(1, val));
                    }}
                    placeholder="عدد..."
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-center focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="text-slate-400 text-[11px]">محاولات</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>المحاولات:</span>
                <span className="font-bold text-cyan-400">
                  {maxAttempts === 0 ? 'غير محدود' : `${maxAttempts} محاولة`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Collapsed Summary Badge */
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>المدة: <strong className="text-white">{durationMinutes === 0 ? 'مفتوح' : `${durationMinutes} دقيقة`}</strong></span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>التاريخ: <strong className="text-white">{enableDateRange ? 'محدد بفترة' : 'متاح دائماً'}</strong></span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>المحاولات: <strong className="text-white">{maxAttempts === 0 ? 'غير محدود' : `${maxAttempts} محاولة`}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-6 mb-10">
        {questions.map((q, qIndex) => (
          <div
            key={q.id}
            className="bg-white dark:bg-[#151c2c] border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-stitch-card hover:border-[#3b4cb8]/40 dark:hover:border-indigo-500/40 transition-all"
          >
            {/* Question Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#eef2ff] dark:bg-indigo-950 text-[#3b4cb8] dark:text-indigo-400 border border-[#c7d2fe] dark:border-indigo-800 flex items-center justify-center font-black text-sm">
                  {qIndex + 1}
                </span>
                
                {/* Category selector / tag */}
                <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#1e293b] px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  <Tag className="w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    value={q.category || 'عام'}
                    onChange={(e) => handleCategoryChange(q.id, e.target.value)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-200 w-24 sm:w-28 focus:outline-none font-medium"
                    placeholder="التصنيف..."
                  />
                </div>
              </div>

              {/* Duplicate & Delete Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDuplicateQuestion(q)}
                  className="p-1.5 text-slate-400 hover:text-[#3b4cb8] hover:bg-[#eef2ff] rounded-lg transition-colors cursor-pointer"
                  title="تكرار هذا السؤال"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="حذف هذا السؤال"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Textarea */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  نص السؤال / المسألة:
                </label>
                
                {/* Tools to Attach / Crop Drawing or Image */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Snip from Sheet Button (Visual Cropper) */}
                  <button
                    type="button"
                    onClick={() => setCropperModalState({
                      isOpen: true,
                      questionId: q.id,
                      questionIndex: qIndex + 1
                    })}
                    className="flex items-center gap-1.5 text-[11px] text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-full cursor-pointer transition-colors font-medium shadow-xs"
                    title="قص وتحديد أي رسمة من ورقة الاختبار المرفوعة ولصقها هنا مباشرة"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-600" />
                    <span>قص رسمة من الورقة ✂️</span>
                  </button>

                  {/* Standard Image File Upload */}
                  <label className="flex items-center gap-1.5 text-[11px] text-[#3b4cb8] hover:text-[#312e81] bg-[#eef2ff] hover:bg-[#e0e7ff] border border-[#c7d2fe] px-3 py-1 rounded-full cursor-pointer transition-colors font-medium">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{q.imageUrl || q.diagramSvg ? 'تغيير الصورة' : 'رفع صورة من الجهاز'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAttachImage(q.id, e)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <textarea
                rows={2}
                value={q.question}
                onChange={(e) => handleQuestionTextChange(q.id, e.target.value)}
                className="w-full bg-[#f8fafc] dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#3b4cb8] focus:bg-white dark:focus:bg-[#151c2c] transition-colors leading-relaxed"
                placeholder="اكتب أو الصق نص السؤال هنا..."
              />

              {/* Live Formula & Equation Preview */}
              {q.question && q.question.trim().length > 0 && (
                <div className="mt-2.5 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>معاينة تنسيق السؤال والكسور والرموز التفاعلية (كيف سيظهر للطالب):</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                    <MathFormulaRenderer text={q.question} />
                  </div>
                </div>
              )}
            </div>

            {/* Display Diagram SVG or Attached Image in Review */}
            {(q.diagramSvg || q.imageUrl) && (
              <div className="mb-4 p-3.5 bg-[#f8fafc] dark:bg-[#1a2236] rounded-xl border border-slate-200 dark:border-slate-700 relative group">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-[#3b4cb8]" />
                    <span>رسمة السؤال التوضيحية (هندسية/صورة مقصوصة):</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCropperModalState({
                        isOpen: true,
                        questionId: q.id,
                        questionIndex: qIndex + 1
                      })}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      title="إعادة قص أو تعديل منطقة الرسمة"
                    >
                      <Scissors className="w-3 h-3" /> إعادة القص
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(q.id)}
                      className="text-[11px] text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Trash2 className="w-3 h-3" /> حذف الرسمة
                    </button>
                  </div>
                </div>

                {q.diagramSvg && (
                  <div 
                    className="flex justify-center my-2 overflow-hidden bg-white dark:bg-[#151c2c] p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                    dangerouslySetInnerHTML={{ __html: q.diagramSvg }}
                  />
                )}

                {q.imageUrl && (
                  <div className="flex justify-center my-2">
                    <img
                      src={q.imageUrl}
                      alt="رسمة السؤال"
                      className="max-h-56 rounded-lg object-contain border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-[#151c2c]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 4 Options Grid */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الخيارات الأربعة (حدد الإجابة الصحيحة بالضغط على الرمز أو الدائرة):
                </label>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  الإجابة الصحيحة: ({OPTION_LABELS[q.answer]})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((optText, optIdx) => {
                  const isCorrect = q.answer === optIdx;
                  const label = OPTION_LABELS[optIdx];

                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        isCorrect
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/10'
                          : 'bg-[#f8fafc] dark:bg-[#1a2236] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {/* Radio button to choose correct answer */}
                      <button
                        type="button"
                        onClick={() => handleAnswerSelect(q.id, optIdx)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                        }`}
                        title={isCorrect ? 'الإجابة الصحيحة' : 'اضغط لتعيينها كإجابة صحيحة'}
                      >
                        {label}
                      </button>

                      {/* Option text input */}
                      <input
                        type="text"
                        value={optText}
                        onChange={(e) => handleOptionChange(q.id, optIdx, e.target.value)}
                        className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 px-1 font-medium"
                        placeholder={`نص الخيار (${label})`}
                      />

                      {/* Live Formula Preview Badge if option contains math */}
                      {(optText.includes('/') || optText.includes('^') || optText.includes('√')) && (
                        <span className="shrink-0 px-2 py-0.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs font-bold text-[#3b4cb8] dark:text-indigo-400">
                          <MathFormulaRenderer text={optText} />
                        </span>
                      )}

                      {isCorrect && (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hint / Explanation field */}
            <div className="bg-[#fffbeb] dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>طريقة الحل / التلميح المعتمد للقدرات:</span>
                </label>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  {q.hint && q.hint.trim() ? 'خطوات الحل مضافة للطالب' : 'فارغ (بدون شرح)'}
                </span>
              </div>
              <textarea
                rows={2}
                value={q.hint || ''}
                onChange={(e) => handleHintChange(q.id, e.target.value)}
                placeholder="اكتب خطوات أو فكرة الحل هنا... ستظهر للطالب عند النقر على تلميح أو في صفحة النتائج لتوضيح الخطأ."
                className="w-full bg-white dark:bg-[#1a2236] border border-amber-200 dark:border-amber-900/60 rounded-lg p-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-amber-900/40 dark:placeholder-amber-400/40 focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
              />
              {q.hint && q.hint.trim().length > 0 && (
                <div className="mt-2 p-2 bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded-lg text-xs text-amber-950 dark:text-amber-200">
                  <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> معاينة خطوات الشرح والرموز:
                  </div>
                  <MathFormulaRenderer text={q.hint} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-[#151c2c]/95 backdrop-blur-md border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-4 shadow-stitch-float flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddQuestion}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f8fafc] dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#3b4cb8] dark:text-indigo-400" />
            <span>إضافة سؤال جديد</span>
          </button>
          
          <button
            type="button"
            onClick={onBackToUpload}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs rounded-xl transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رفع ملف آخر</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-[#e2e8f0] transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#3b4cb8]" />
            <span>تصدير JSON</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewQuiz}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#3b4cb8] text-xs sm:text-sm font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة كطالب</span>
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>نشر الاختبار ({questions.length} مسألة)</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Raw Extracted Text Modal */}
      {showRawTextModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#3b4cb8]" />
                <h3 className="font-bold text-slate-900 text-base">النص الكامل المستخرج من المستند</h3>
              </div>
              <button
                onClick={() => setShowRawTextModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-3">
                هذا هو النص الذي تم استخراجه حرفياً من ملف الـ PDF. يمكنك نسخه واستخدامه لتعديل الأسئلة وترتيبها يدوياً إذا كانت بعض الفقرات بحاجة لتعديل.
              </p>
              <textarea
                readOnly
                value={rawText}
                className="w-full h-80 bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-[#f8fafc]">
              <button
                type="button"
                onClick={handleCopyRawText}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                {copiedRawText ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>تم النسخ للحافظة!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>نسخ النص كاملاً</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowRawTextModal(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                إغلاق والعودة للمراجعة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Interactive Sheet Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperModalState.isOpen}
        onClose={() => setCropperModalState(prev => ({ ...prev, isOpen: false }))}
        sourceImage={sourceImage}
        sourceImages={sourceImages}
        questionId={cropperModalState.questionId}
        questionIndex={cropperModalState.questionIndex}
        onCropSaved={(qId, croppedDataUrl) => {
          onUpdateQuestions(
            questions.map(q => q.id === qId ? { ...q, imageUrl: croppedDataUrl } : q)
          );
        }}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        questions={questions}
        examTitle={examTitle}
      />

      {/* Publish Success Modal */}
      {showPublishSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
            
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              تم نشر الاختبار بنجاح! 🎉
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              أصبح اختبار <strong className="text-slate-900">"{examTitle}"</strong> متاحاً ومحفوظاً الآن في قسم <strong className="text-[#3b4cb8]">"اختباراتي"</strong> ليتمكن الطلاب من الدخول وتقديمه.
            </p>

            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 mb-6 text-xs text-slate-600 space-y-1.5 text-right">
              <div className="flex justify-between">
                <span>إجمالي الأسئلة:</span>
                <span className="font-bold text-slate-900">{questions.length} مسألة</span>
              </div>
              <div className="flex justify-between">
                <span>المدة الزمنية:</span>
                <span className="font-bold text-slate-900">
                  {durationMinutes > 0 ? `${durationMinutes} دقيقة` : 'بدون وقت محدد'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPublishSuccessModal(false);
                  onStartQuiz(getSettings());
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/15 transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة ودخول الاختبار الآن كطالب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPublishSuccessModal(false);
                  onGoToMyExams();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                <span>الذهاب إلى قسم "اختباراتي"</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPublishSuccessModal(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                البقاء والمتابعة في صفحة التعديل
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

