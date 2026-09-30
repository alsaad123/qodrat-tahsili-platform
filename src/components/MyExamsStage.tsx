import React, { useState } from 'react';
import { PublishedExam } from '../types/quiz';
import { 
  BookOpen, Clock, Calendar, ArrowLeft, Trash2, Edit3, 
  Sparkles, CheckCircle2, Plus, Search, FileText
} from 'lucide-react';

interface MyExamsStageProps {
  exams: PublishedExam[];
  onTakeExam: (exam: PublishedExam) => void;
  onEditExam: (exam: PublishedExam) => void;
  onDeleteExam: (id: string) => void;
  onGoToUpload: () => void;
}

export const MyExamsStage: React.FC<MyExamsStageProps> = ({
  exams,
  onTakeExam,
  onEditExam,
  onDeleteExam,
  onGoToUpload
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-[#3b4cb8] border border-indigo-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الاختبارات الجاهزة والمتاحة للطلاب</span>
            </span>
            <span className="text-xs text-slate-500 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-xs">
              {exams.length} اختبار
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            اختباراتي المنشورة
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            اختر أي اختبار للدخول وحله مباشرة من وجهة نظر الطالب، أو قم بتعديله وإدارته
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onGoToUpload}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/15 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>رفع واستخراج اختبار جديد</span>
          </button>
        </div>
      </div>

      {/* Search Bar (if at least 2 exams) */}
      {exams.length > 1 && (
        <div className="mb-6 relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في اختباراتي..."
            className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#3b4cb8] shadow-xs"
          />
        </div>
      )}

      {/* Grid of Exams */}
      {filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const hasDuration = exam.settings?.durationMinutes && exam.settings.durationMinutes > 0;

            return (
              <div
                key={exam.id}
                className="bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] rounded-2xl p-5 shadow-stitch-card hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-[#3b4cb8] border border-indigo-100">
                      <BookOpen className="w-3 h-3" />
                      <span>{exam.questions.length} مسألة</span>
                    </span>

                    <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{formatDate(exam.publishedAt)}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#3b4cb8] transition-colors mb-2 line-clamp-2">
                    {exam.title}
                  </h3>

                  {/* Settings summary */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{hasDuration ? `${exam.settings.durationMinutes} دقيقة` : 'بدون توقيت'}</span>
                    </div>

                    {exam.settings?.maxAttempts ? (
                      <span>• {exam.settings.maxAttempts} محاولات مسموحة</span>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => onTakeExam(exam)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <span>دخول الاختبار (طالب)</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onEditExam(exam)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      title="تعديل الأسئلة والإعدادات"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`هل أنت متأكد من حذف اختبار "${exam.title}" من اختباراتي؟`)) {
                          onDeleteExam(exam.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                      title="حذف الاختبار"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-stitch-card">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#3b4cb8] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد اختبارات منشورة حتى الآن'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            {searchQuery 
              ? 'جرّب البحث بكلمة أخرى أو مسح شريط البحث' 
              : 'قم برفع ملف PDF أو صور لنماذج القدرات والتحصيلي، ثم راجع الأسئلة واضغط "نشر الاختبار" ليظهر هنا للطلاب.'
            }
          </p>

          <button
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>رفع أول اختبار الآن</span>
          </button>
        </div>
      )}

    </div>
  );
};
