import React from 'react';
import { QuizStage } from '../types/quiz';
import { BookOpen, Sparkles, RefreshCw, Layers, ArrowRight, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentStage: QuizStage;
  homeTab: 'upload' | 'my-exams';
  onSelectHomeTab: (tab: 'upload' | 'my-exams') => void;
  publishedExamsCount: number;
  examTitle: string;
  totalQuestions: number;
  onNavigateStage: (stage: QuizStage) => void;
  onReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStage,
  homeTab,
  onSelectHomeTab,
  publishedExamsCount,
  examTitle,
  totalQuestions,
  onNavigateStage,
  onReset
}) => {
  const isFirstPage = currentStage === 'upload';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] shadow-[0_2px_10px_rgba(18,38,63,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => {
              if (currentStage !== 'upload') {
                onNavigateStage('upload');
              }
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#3b4cb8] flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-bold">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  منصة تدريب القدرات والتحصيلي
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 animate-pulse"></span>
                  نظام ذكي متصل
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                {isFirstPage 
                  ? 'بيئة تدريب ومعالجة تعليمية تفاعلية'
                  : `${examTitle} (${totalQuestions} مسألة)`
                }
              </p>
            </div>
          </div>

          {/* Stepper / Tabs */}
          {isFirstPage ? (
            /* First page: Only "رفع واستخراج" and "اختباراتي" */
            <nav className="flex items-center bg-[#f1f5f9] p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => onSelectHomeTab('upload')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  homeTab === 'upload'
                    ? 'bg-white text-[#3b4cb8] shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 ${homeTab === 'upload' ? 'text-[#3b4cb8]' : 'text-slate-400'}`} />
                <span>رفع واستخراج</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectHomeTab('my-exams')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  homeTab === 'my-exams'
                    ? 'bg-white text-[#3b4cb8] shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${homeTab === 'my-exams' ? 'text-[#3b4cb8]' : 'text-slate-400'}`} />
                <span>اختباراتي</span>
                {publishedExamsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    homeTab === 'my-exams' ? 'bg-[#eef2ff] text-[#3b4cb8]' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {publishedExamsCount}
                  </span>
                )}
              </button>
            </nav>
          ) : (
            /* Other stages navigation */
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateStage('upload')}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#3b4cb8] bg-[#f8fafc] hover:bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer font-medium"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة للرئيسية</span>
              </button>

              {currentStage === 'review' && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-[#3b4cb8]">
                  <span>صفحة المراجعة والتعديل</span>
                </div>
              )}

              {currentStage === 'results' && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تقرير النتائج والتحليل</span>
                </div>
              )}
            </div>
          )}

          {/* Right Action */}
          <div className="flex items-center gap-2.5">
            {!isFirstPage && totalQuestions > 0 && (
              <button
                onClick={onReset}
                title="بدء اختبار جديد"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-[#e2e8f0] px-3.5 py-2 rounded-xl transition-all shadow-xs font-medium cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">إعادة ضبط</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
