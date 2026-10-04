import React, { useState } from 'react';
import { PublishedExam, UserRole, ExamSubmission } from '../types/quiz';
import { ExamSubmissionsModal } from './ExamSubmissionsModal';
import { 
  BookOpen, Clock, Calendar, ArrowLeft, Trash2, Edit3, 
  Sparkles, CheckCircle2, Plus, Search, AlertCircle, Lock,
  GraduationCap, User, ShieldAlert, Users, Award, Eye
} from 'lucide-react';

interface MyExamsStageProps {
  exams: PublishedExam[];
  userRole?: UserRole;
  studentAttempts?: { [examId: string]: number };
  submissions?: ExamSubmission[];
  onTakeExam: (exam: PublishedExam) => void;
  onEditExam: (exam: PublishedExam) => void;
  onDeleteExam: (id: string) => void;
  onGoToUpload: () => void;
  onViewSubmission?: (submission: ExamSubmission, exam: PublishedExam) => void;
  onDeleteSubmission?: (submissionId: string) => void;
}

export const MyExamsStage: React.FC<MyExamsStageProps> = ({
  exams,
  userRole = 'teacher',
  studentAttempts = {},
  submissions = [],
  onTakeExam,
  onEditExam,
  onDeleteExam,
  onGoToUpload,
  onViewSubmission = () => {},
  onDeleteSubmission
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamForSubmissions, setSelectedExamForSubmissions] = useState<PublishedExam | null>(null);

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const isStudent = userRole === 'student';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isStudent 
                ? 'bg-emerald-50 dark:bg-[#4edea3]/10 text-emerald-700 dark:text-[#4edea3] border border-emerald-200 dark:border-[#4edea3]/30' 
                : 'bg-indigo-50 dark:bg-[#8083ff]/15 text-[#3b4cb8] dark:text-[#c0c1ff] border border-indigo-100 dark:border-[#8083ff]/30'
            }`}>
              {isStudent ? <User className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
              <span>{isStudent ? 'بوابة الطالب • جلسات الاختبار' : 'إدارة الاختبارات المنشورة'}</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-[#dfe2f1] font-bold bg-white dark:bg-[#1c1f2a] px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#313540] shadow-xs">
              {exams.length} {exams.length === 1 ? 'اختبار' : 'اختبارات'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#dfe2f1] tracking-tight">
            {isStudent ? 'الاختبارات التدريبية المتاحة' : 'اختباراتي المنشورة'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#c7c4d7] mt-1">
            {isStudent 
              ? 'اختر الاختبار المطلوب لتقديمه وحله وفق المدة المحددة والمحاولات المسموحة' 
              : 'اختر أي اختبار للدخول ومعاينته من وجهة نظر الطالب، أو قم بتعديله وإدارته'}
          </p>
        </div>

        {/* Create new exam button (Teacher only) */}
        {!isStudent && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onGoToUpload}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_14px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>رفع واستخراج اختبار جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Bar (if at least 2 exams) */}
      {exams.length > 1 && (
        <div className="mb-6 relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#908fa0] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في قائمة الاختبارات..."
            className="w-full bg-white dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-[#dfe2f1] placeholder:text-slate-400 dark:placeholder:text-[#908fa0] focus:outline-none focus:border-[#3b4cb8] dark:focus:border-[#c0c1ff] shadow-xs"
          />
        </div>
      )}

      {/* Grid of Exams */}
      {filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const hasDuration = exam.settings?.durationMinutes && exam.settings.durationMinutes > 0;
            const maxAttempts = exam.settings?.maxAttempts ?? 1;
            const attemptsUsed = studentAttempts[exam.id] || 0;
            const hasAttemptLimit = maxAttempts > 0;
            const isAttemptsExceeded = isStudent && hasAttemptLimit && attemptsUsed >= maxAttempts;

            // Date validation for students
            const now = new Date();
            const hasDateRange = Boolean(exam.settings?.enableDateRange);
            const isBeforeStart = isStudent && hasDateRange && exam.settings?.startDate 
              ? new Date(exam.settings.startDate) > now 
              : false;
            const isAfterEnd = isStudent && hasDateRange && exam.settings?.endDate 
              ? new Date(exam.settings.endDate) < now 
              : false;

            const isStudentBlocked = isAttemptsExceeded || isBeforeStart || isAfterEnd;

            return (
              <div
                key={exam.id}
                className={`bg-white dark:bg-[#171b26] border rounded-2xl p-5 shadow-stitch-card hover:shadow-md transition-all flex flex-col justify-between group ${
                  isStudentBlocked ? 'border-slate-200 dark:border-[#262a35] bg-slate-50/50 dark:bg-[#0f131d]/60 opacity-90' : 'border-[#e2e8f0] dark:border-[#262a35] hover:border-[#cbd5e1] dark:hover:border-[#313540]'
                }`}
              >
                <div>
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-[#8083ff]/15 text-[#3b4cb8] dark:text-[#c0c1ff] border border-indigo-100 dark:border-[#8083ff]/30">
                      <BookOpen className="w-3 h-3" />
                      <span>{exam.questions.length} مسألة</span>
                    </span>

                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#908fa0] text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{formatDate(exam.publishedAt)}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#dfe2f1] group-hover:text-[#3b4cb8] dark:group-hover:text-[#c0c1ff] transition-colors mb-2 line-clamp-2">
                    {exam.title}
                  </h3>

                  {/* Settings summary */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#c7c4d7] mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#908fa0]" />
                      <span>{hasDuration ? `${exam.settings.durationMinutes} دقيقة` : 'بدون توقيت'}</span>
                    </div>

                    {hasAttemptLimit ? (
                      <span className="text-slate-500 dark:text-[#c7c4d7]">
                        • {maxAttempts} {maxAttempts === 1 ? 'محاولة مسموحة' : 'محاولات مسموحة'}
                      </span>
                    ) : (
                      <span>• محاولات غير محدودة</span>
                    )}
                  </div>

                  {/* Student Status Banners */}
                  {isStudent && (
                    <div className="mb-4 space-y-1.5">
                      {/* Attempts progress */}
                      {hasAttemptLimit && (
                        <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isAttemptsExceeded 
                            ? 'bg-red-50 dark:bg-[#93000a]/20 text-red-700 dark:text-[#ffb4ab] border border-red-200 dark:border-[#ffb4ab]/30' 
                            : 'bg-slate-100 dark:bg-[#1c1f2a] text-slate-700 dark:text-[#dfe2f1]'
                        }`}>
                          <span>محاولاتك:</span>
                          <span className="font-bold">{attemptsUsed} من {maxAttempts}</span>
                        </div>
                      )}

                      {/* Date Range Status */}
                      {hasDateRange && isBeforeStart && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>يبدأ في: {formatDate(exam.settings?.startDate)}</span>
                        </div>
                      )}

                      {hasDateRange && isAfterEnd && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 dark:bg-[#93000a]/20 text-red-800 dark:text-[#ffb4ab] border border-red-200 dark:border-[#ffb4ab]/30">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span>انتهت فترة الاختبار</span>
                        </div>
                      )}

                      {hasDateRange && !isBeforeStart && !isAfterEnd && exam.settings?.endDate && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] text-slate-500 dark:text-[#c7c4d7]">
                          <span>متاح حتى: {formatDate(exam.settings.endDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-[#262a35] space-y-2">
                  {!isStudent ? (
                    <>
                      {/* Preview Exam Button for Teacher */}
                      <button
                        type="button"
                        onClick={() => onTakeExam(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all bg-[#4f46e5] hover:bg-[#4338ca] text-white cursor-pointer shadow-[0_0_14px_rgba(192,193,255,0.2)]"
                        title="معاينة الاختبار كما يراه الطالب"
                      >
                        <Eye className="w-4 h-4" />
                        <span>معاينة الاختبار</span>
                      </button>

                      {/* Student Simulation Button */}
                      <button
                        type="button"
                        onClick={() => onTakeExam(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#313540] bg-slate-50 dark:bg-[#1c1f2a] hover:bg-slate-100 dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] transition-all cursor-pointer"
                        title="دخول وتجربة الاختبار كطالب"
                      >
                        <span>دخول الاختبار (طالب)</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isStudentBlocked}
                      onClick={() => onTakeExam(exam)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all ${
                        isStudentBlocked
                          ? 'bg-slate-200 dark:bg-[#1c1f2a] text-slate-400 dark:text-[#908fa0] cursor-not-allowed'
                          : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white cursor-pointer shadow-[0_0_14px_rgba(192,193,255,0.2)]'
                      }`}
                    >
                      {isAttemptsExceeded ? (
                        <span>استنفدت المحاولات ({attemptsUsed}/{maxAttempts})</span>
                      ) : isBeforeStart ? (
                        <span>غير متاح حالياً</span>
                      ) : isAfterEnd ? (
                        <span>انتهت فترة التقديم</span>
                      ) : (
                        <>
                          <span>دخول وبدء الاختبار</span>
                          <ArrowLeft className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {/* Teacher actions (Submissions, Edit & Delete) - Strictly hidden for students */}
                  {!isStudent && (
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedExamForSubmissions(exam)}
                        className="w-full flex items-center justify-between py-2 px-3.5 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-[#8083ff]/15 dark:hover:bg-[#8083ff]/25 text-[#3b4cb8] dark:text-[#c0c1ff] text-xs font-bold rounded-xl border border-indigo-200 dark:border-[#8083ff]/30 transition-all cursor-pointer shadow-2xs"
                        title="عرض نتائج ودرجات المختبرين لهذا الاختبار"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#3b4cb8] dark:text-[#c0c1ff]" />
                          <span>نتائج المختبرين</span>
                        </div>
                        <span className="bg-[#4f46e5] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                          {submissions.filter(s => s.examId === exam.id).length} مختبر
                        </span>
                      </button>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onEditExam(exam)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 dark:bg-[#1c1f2a] hover:bg-slate-100 dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] text-xs font-semibold rounded-lg border border-slate-200 dark:border-[#313540] transition-colors cursor-pointer"
                          title="تعديل الأسئلة والإعدادات"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-[#908fa0]" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف اختبار "${exam.title}" من اختباراتي؟`)) {
                              onDeleteExam(exam.id);
                            }
                          }}
                          className="p-2 text-slate-400 dark:text-[#908fa0] hover:text-red-600 dark:hover:text-[#ffb4ab] hover:bg-red-50 dark:hover:bg-[#93000a]/30 rounded-lg border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-colors cursor-pointer"
                          title="حذف الاختبار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (

        /* Empty State */
        <div className="bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-stitch-card">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-[#1c1f2a] border border-indigo-100 dark:border-[#313540] text-[#3b4cb8] dark:text-[#c0c1ff] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-[#dfe2f1] mb-2">
            {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : (isStudent ? 'لا توجد اختبارات متاحة حالياً' : 'لا توجد اختبارات منشورة حتى الآن')}
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#c7c4d7] mb-6 leading-relaxed">
            {searchQuery 
              ? 'جرّب البحث بكلمة أخرى أو مسح شريط البحث' 
              : isStudent 
              ? 'يرجى الانتظار حتى يقوم المعلم بنشر اختبار جديد ليظهر في هذه الصفحة.'
              : 'قم برفع ملف PDF أو صور لنماذج القدرات والتحصيلي، ثم راجع الأسئلة واضغط "نشر الاختبار" ليظهر هنا للطلاب.'
            }
          </p>

          {!isStudent && (
            <button
              type="button"
              onClick={onGoToUpload}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_14px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>رفع أول اختبار الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Submissions Modal for Teacher */}
      <ExamSubmissionsModal
        isOpen={Boolean(selectedExamForSubmissions)}
        exam={selectedExamForSubmissions}
        submissions={submissions}
        onClose={() => setSelectedExamForSubmissions(null)}
        onViewSubmission={onViewSubmission}
        onDeleteSubmission={onDeleteSubmission}
        onTakeExamAsStudent={onTakeExam}
      />

    </div>
  );
};

