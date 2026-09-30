import React, { useState } from 'react';
import { Question } from '../types/quiz';
import { printExamAsPDF } from '../utils/pdfExporter';
import { downloadQuestionsAsJSON } from '../utils/fileParsers';
import { FileText, Printer, Check, X, Download, Sparkles, BookOpen, User } from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  examTitle: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  questions,
  examTitle
}) => {
  const [includeHints, setIncludeHints] = useState<boolean>(true);
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(true);
  const [studentName, setStudentName] = useState<string>('');
  const [exportMode, setExportMode] = useState<'study' | 'test'>('study');

  if (!isOpen) return null;

  const handleExportPDF = () => {
    printExamAsPDF({
      questions,
      title: examTitle || 'اختبار تدريب القدرات والتحصيلي',
      includeHints: exportMode === 'study' ? includeHints : false,
      includeAnswerKey: includeAnswerKey,
      studentName: studentName.trim() || undefined
    });
    onClose();
  };

  const handleExportJSON = () => {
    downloadQuestionsAsJSON(questions, examTitle || 'اختبار-قدرات-وتحصيلي');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#3b4cb8] border border-indigo-100 flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">تصدير واستخراج الاختبار كملف PDF</h3>
              <p className="text-xs text-slate-500">جاهز للحفظ بتنسيق PDF عالي الدقة أو الطباعة الورقية</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Options */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          
          {/* Exam Mode Toggle */}
          <div>
            <label className="font-bold text-slate-700 block mb-2">نوع ملف الـ PDF المراد استخراجه:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setExportMode('study');
                  setIncludeHints(true);
                }}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                  exportMode === 'study'
                    ? 'bg-indigo-50/70 border-[#3b4cb8] ring-1 ring-[#3b4cb8]/30 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-[#3b4cb8]">
                    <BookOpen className="w-4 h-4" /> نموذج المذاكرة والشرح
                  </span>
                  {exportMode === 'study' && <Check className="w-4 h-4 text-[#3b4cb8]" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يحتوي على الأسئلة، تمييز الإجابات الصحيحة، وطرق الحل والتفسيرات المفصلة.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportMode('test');
                  setIncludeHints(false);
                }}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                  exportMode === 'test'
                    ? 'bg-indigo-50/70 border-[#3b4cb8] ring-1 ring-[#3b4cb8]/30 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-emerald-600">
                    <Sparkles className="w-4 h-4" /> ورقة اختبار للطالب
                  </span>
                  {exportMode === 'test' && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  ورقة اختبار خام بدون حلول ليقوم الطالب باختبار نفسه وحلها ورقياً.
                </p>
              </button>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            
            {/* Answer Key Toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 font-medium">تضمين جدول مفاتيح الإجابات في نهاية الملف:</span>
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="w-4 h-4 rounded text-[#3b4cb8] accent-[#3b4cb8] cursor-pointer"
              />
            </label>

            {/* If Study Mode: Hints Toggle */}
            {exportMode === 'study' && (
              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">إظهار مربعات طريقة الحل والتفسير (Hints):</span>
                <input
                  type="checkbox"
                  checked={includeHints}
                  onChange={(e) => setIncludeHints(e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b4cb8] accent-[#3b4cb8] cursor-pointer"
                />
              </label>
            )}

            {/* Optional Student Name */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> اسم الطالب (اختياري لكتابته في ترويسة الورقة):
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="مثال: محمد بن خالد..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#3b4cb8] focus:ring-1 focus:ring-[#3b4cb8]"
              />
            </div>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
            💡 <strong>ملاحظة:</strong> عند الضغط على زر الاستخراج، ستفتح لك نافذة الطباعة الخاصة بالمتصفح، اختر منها الوجهة: <strong>«حفظ بتنسيق PDF» (Save as PDF)</strong> لحفظ الملف على جهازك، مع الحفاظ الكامل على الرسوم الهندسية واتجاه الخط العربي.
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="text-xs text-slate-500 hover:text-[#3b4cb8] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            title="تصدير كملف بيانات برمجية JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير JSON كبديل</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>استخراج وحفظ ملف PDF 📄</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
