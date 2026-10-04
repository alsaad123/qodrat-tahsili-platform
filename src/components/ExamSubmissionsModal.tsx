import React, { useState } from 'react';
import { PublishedExam, ExamSubmission } from '../types/quiz';
import { 
  X, Users, Award, Clock, Calendar, CheckCircle2, 
  XCircle, AlertCircle, ArrowLeft, Eye, Trash2, 
  BarChart3, Sparkles, UserCheck, Search, BookOpen
} from 'lucide-react';

interface ExamSubmissionsModalProps {
  isOpen: boolean;
  exam: PublishedExam | null;
  submissions: ExamSubmission[];
  onClose: () => void;
  onViewSubmission: (submission: ExamSubmission, exam: PublishedExam) => void;
  onDeleteSubmission?: (submissionId: string) => void;
  onTakeExamAsStudent?: (exam: PublishedExam) => void;
}

export const ExamSubmissionsModal: React.FC<ExamSubmissionsModalProps> = ({
  isOpen,
  exam,
  submissions,
  onClose,
  onViewSubmission,
  onDeleteSubmission,
  onTakeExamAsStudent
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !exam) return null;

  const examSubmissions = submissions.filter(s => s.examId === exam.id);

  const filteredSubmissions = examSubmissions.filter(s => 
    s.examineeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const totalExaminees = examSubmissions.length;
  const avgPercentage = totalExaminees > 0 
    ? Math.round(examSubmissions.reduce((acc, curr) => acc + curr.percentage, 0) / totalExaminees)
    : 0;
  const maxScore = totalExaminees > 0 
    ? Math.max(...examSubmissions.map(s => s.percentage))
    : 0;

  const formatDate = (dateStr: string) => {
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins === 0) return `${remSecs} ثانية`;
    return `${mins} دقيقة و ${remSecs} ثانية`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#171b26] border border-slate-200 dark:border-[#262a35] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp text-slate-900 dark:text-[#dfe2f1]"
        dir="rtl"
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#262a35] bg-[#f8fafc] dark:bg-[#171b26]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-[#262a35] border border-indigo-100 dark:border-[#313540] flex items-center justify-center text-[#4f46e5] dark:text-[#c0c1ff]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#dfe2f1] flex items-center gap-2">
                <span>نتائج المختبرين</span>
                <span className="text-xs font-normal text-slate-400 dark:text-[#908fa0]">({exam.title})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#c7c4d7] mt-0.5">
                عرض تقارير إجابات ودرجات الطلاب الذين قدموا هذا الاختبار
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-[#dfe2f1] hover:bg-slate-200/50 dark:hover:bg-[#262a35] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        {totalExaminees > 0 && (
          <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-white dark:bg-[#171b26] border-b border-slate-100 dark:border-[#262a35]">
            <div className="bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-2xl p-3 text-center">
              <span className="text-xs font-bold text-slate-500 dark:text-[#c7c4d7] block mb-0.5">إجمالي المختبرين</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#dfe2f1]">{totalExaminees}</span>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 text-center">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">متوسط الدرجات</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{avgPercentage}٪</span>
            </div>

            <div className="bg-indigo-50/60 dark:bg-[#262a35] border border-indigo-200 dark:border-[#313540] rounded-2xl p-3 text-center">
              <span className="text-xs font-bold text-[#4f46e5] dark:text-[#c0c1ff] block mb-0.5">أعلى نتيجة</span>
              <span className="text-xl sm:text-2xl font-black text-[#4f46e5] dark:text-[#c0c1ff]">{maxScore}٪</span>
            </div>
          </div>
        )}

        {/* Submissions List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {totalExaminees > 0 ? (
            <>
              {totalExaminees > 3 && (
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-slate-400 dark:text-[#908fa0] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن مختبر..."
                    className="w-full bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 dark:text-[#dfe2f1] focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>
              )}

              {filteredSubmissions.map((sub, idx) => {
                const isPassed = sub.percentage >= 60;

                return (
                  <div
                    key={sub.id}
                    className="bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 dark:hover:border-[#6366f1] transition-all shadow-xs"
                  >
                    {/* Left: Examinee Identity & Details */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-[#262a35] border border-slate-200 dark:border-[#313540] flex items-center justify-center font-black text-slate-700 dark:text-[#dfe2f1] shadow-xs shrink-0">
                        <UserCheck className="w-5 h-5 text-[#4f46e5] dark:text-[#c0c1ff]" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-[#dfe2f1]">
                            {sub.examineeName}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#c7c4d7] bg-white dark:bg-[#262a35] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#313540]">
                            المحاولة ({sub.attemptNumber})
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#c7c4d7] mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#908fa0]" />
                            <span>{formatDate(sub.submittedAt)}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#908fa0]" />
                            <span>{formatTime(sub.timeSpentSeconds)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Score and View Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-[#313540]">
                      
                      {/* Score Badge */}
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#dfe2f1]">
                            {sub.correctCount}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-[#908fa0] font-semibold">
                            / {sub.totalQuestions}
                          </span>
                        </div>
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isPassed 
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        }`}>
                          {sub.percentage}٪
                        </span>
                      </div>

                      {/* View Results Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onViewSubmission(sub, exam);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_12px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
                        title="عرض ورقة الإجابة بالتفصيل"
                      >
                        <Eye className="w-4 h-4" />
                        <span>عرض الإجابات</span>
                      </button>

                      {/* Delete submission button (optional) */}
                      {onDeleteSubmission && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف نتيجة (${sub.examineeName})؟`)) {
                              onDeleteSubmission(sub.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذه المحاولة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-[#262a35] border border-indigo-100 dark:border-[#313540] flex items-center justify-center text-[#4f46e5] dark:text-[#c0c1ff] mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#dfe2f1] mb-1.5">
                لا توجد نتائج مسجلة لهذا الاختبار بعد
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#c7c4d7] max-w-md mx-auto mb-6 leading-relaxed">
                بمجرد أن يقوم الطلاب بفتح الاختبار وحل الأسئلة وتسليمها، ستظهر تقاريرهم ودرجاتهم وتفاصيل إجاباتهم هنا تلقائياً لتقييم أدائهم.
              </p>

              {onTakeExamAsStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTakeExamAsStudent(exam);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_12px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>دخول تجريبي كطالب لحل الاختبار</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-[#262a35] bg-[#f8fafc] dark:bg-[#171b26]">
          <span className="text-xs text-slate-500 dark:text-[#c7c4d7]">
            {totalExaminees > 0 ? `تم تسجيل ${totalExaminees} جلسة اختبار` : 'في انتظار أول مختبر'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-[#262a35] hover:bg-slate-300 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] border border-slate-200 dark:border-[#313540] text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
