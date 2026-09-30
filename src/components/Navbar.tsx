import React from 'react';
import { QuizStage, UserRole } from '../types/quiz';
import { 
  BookOpen, Sparkles, RefreshCw, Layers, ArrowRight, 
  CheckCircle2, GraduationCap, User, Sun, Moon 
} from 'lucide-react';

interface NavbarProps {
  currentStage: QuizStage;
  homeTab: 'upload' | 'my-exams';
  userRole: UserRole;
  theme: 'light' | 'dark';
  onToggleTheme: (theme: 'light' | 'dark') => void;
  onSelectRole: (role: UserRole) => void;
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
  userRole,
  theme,
  onToggleTheme,
  onSelectRole,
  onSelectHomeTab,
  publishedExamsCount,
  examTitle,
  totalQuestions,
  onNavigateStage,
  onReset
}) => {
  const isFirstPage = currentStage === 'upload';

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#151c2c]/95 backdrop-blur-md border-b border-[#e2e8f0] dark:border-slate-800 shadow-[0_2px_10px_rgba(18,38,63,0.03)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Right Area (Back button on non-first stages, or empty spacer to keep center balanced) */}
          <div className="w-auto sm:min-w-[120px] flex items-center">
            {!isFirstPage && (
              <button
                type="button"
                onClick={() => onNavigateStage('upload')}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-[#3b4cb8] dark:hover:text-indigo-400 bg-[#f8fafc] dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer font-medium shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة للرئيسية</span>
              </button>
            )}
          </div>

          {/* Center Area: Centered Tabs or Stage Title */}
          <div className="flex-1 flex items-center justify-center">
            {isFirstPage ? (
              userRole === 'teacher' ? (
                /* Teacher tabs: رفع واستخراج / اختباراتي */
                <nav className="flex items-center bg-[#f1f5f9] dark:bg-[#1e293b] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-750 shadow-xs">
                  <button
                    type="button"
                    onClick={() => onSelectHomeTab('upload')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      homeTab === 'upload'
                        ? 'bg-white dark:bg-[#151c2c] text-[#3b4cb8] dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BookOpen className={`w-4 h-4 ${homeTab === 'upload' ? 'text-[#3b4cb8] dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span>رفع واستخراج</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectHomeTab('my-exams')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      homeTab === 'my-exams'
                        ? 'bg-white dark:bg-[#151c2c] text-[#3b4cb8] dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${homeTab === 'my-exams' ? 'text-[#3b4cb8] dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span>اختباراتي</span>
                    {publishedExamsCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        homeTab === 'my-exams' 
                          ? 'bg-[#eef2ff] dark:bg-indigo-950/80 text-[#3b4cb8] dark:text-indigo-300' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {publishedExamsCount}
                      </span>
                    )}
                  </button>
                </nav>
              ) : (
                /* Student: Shows clean student portal indicator */
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-xs">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>بوابة الطالب • جلسات الاختبارات المتاحة</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
              )
            ) : (
              /* Inside Review / Results: Stage Indicator */
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{examTitle}</span>
                <span className="text-xs text-slate-400">({totalQuestions} مسألة)</span>
              </div>
            )}
          </div>

          {/* Left Area (فوق يسار): Theme Switcher + Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5 justify-end">
            
            {/* Theme Toggle: [نمط ساطع | نمط داكن] */}
            <div className="flex items-center bg-[#f1f5f9] dark:bg-[#1e293b] p-1 rounded-2xl border border-slate-200/80 dark:border-slate-750 shadow-xs">
              <button
                type="button"
                onClick={() => onToggleTheme('light')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="نمط ساطع"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">نمط ساطع</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleTheme('dark')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#3b4cb8] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="نمط داكن"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden md:inline">نمط داكن</span>
              </button>
            </div>

            {/* Role Switcher: [معلم | طالب] */}
            <div className="flex items-center bg-[#f1f5f9] dark:bg-[#1e293b] p-1 rounded-2xl border border-slate-200/80 dark:border-slate-750 shadow-xs">
              <button
                type="button"
                onClick={() => onSelectRole('teacher')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userRole === 'teacher'
                    ? 'bg-[#3b4cb8] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="واجهة المعلم (رفع وتعديل ونشر)"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>معلم</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectRole('student')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userRole === 'student'
                    ? 'bg-[#3b4cb8] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="واجهة الطالب (حل الاختبارات المتاحة فقط)"
              >
                <User className="w-3.5 h-3.5" />
                <span>طالب</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
