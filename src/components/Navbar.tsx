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
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#171b26]/95 backdrop-blur-md border-b border-[#e2e8f0] dark:border-[#262a35] shadow-[0_2px_10px_rgba(18,38,63,0.03)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.5)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Right Area (Back button on non-first stages) */}
          <div className="flex items-center shrink-0">
            {!isFirstPage && (
              <button
                type="button"
                onClick={() => onNavigateStage('upload')}
                className="flex items-center gap-1 text-xs text-slate-600 dark:text-[#dfe2f1] hover:text-[#3b4cb8] dark:hover:text-[#c0c1ff] bg-[#f8fafc] dark:bg-[#1c1f2a] hover:bg-slate-100 dark:hover:bg-[#262a35] border border-slate-200 dark:border-[#313540] px-2.5 sm:px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer font-medium shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">العودة للرئيسية</span>
                <span className="xs:hidden sm:hidden">الرئيسية</span>
              </button>
            )}
          </div>

          {/* Center Area: Centered Tabs or Stage Title */}
          <div className="flex-1 flex items-center justify-center px-1 sm:px-2">
            {isFirstPage ? (
              userRole === 'teacher' ? (
                /* Teacher tabs: رفع واستخراج / اختباراتي */
                <nav className="flex items-center bg-[#f1f5f9] dark:bg-[#1c1f2a] p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 dark:border-[#313540] shadow-xs max-w-full">
                  <button
                    type="button"
                    onClick={() => onSelectHomeTab('upload')}
                    className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-1 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      homeTab === 'upload'
                        ? 'bg-white dark:bg-[#262a35] text-[#3b4cb8] dark:text-[#c0c1ff] shadow-sm border border-slate-200/60 dark:border-[#313540]'
                        : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <BookOpen className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${homeTab === 'upload' ? 'text-[#3b4cb8] dark:text-[#c0c1ff]' : 'text-slate-400'}`} />
                    <span className="hidden sm:inline">رفع واستخراج</span>
                    <span className="sm:hidden text-[11px]">رفع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectHomeTab('my-exams')}
                    className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-1 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      homeTab === 'my-exams'
                        ? 'bg-white dark:bg-[#262a35] text-[#3b4cb8] dark:text-[#c0c1ff] shadow-sm border border-slate-200/60 dark:border-[#313540]'
                        : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${homeTab === 'my-exams' ? 'text-[#3b4cb8] dark:text-[#c0c1ff]' : 'text-slate-400'}`} />
                    <span className="text-[11px] sm:text-sm">اختباراتي</span>
                    {publishedExamsCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs font-bold ${
                        homeTab === 'my-exams' 
                          ? 'bg-[#eef2ff] dark:bg-[#8083ff]/20 text-[#3b4cb8] dark:text-[#c0c1ff]' 
                          : 'bg-slate-200 dark:bg-[#313540] text-slate-700 dark:text-[#dfe2f1]'
                      }`}>
                        {publishedExamsCount}
                      </span>
                    )}
                  </button>
                </nav>
              ) : (
                /* Student: Shows clean student portal indicator */
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-50/90 dark:bg-[#4edea3]/10 border border-emerald-200 dark:border-[#4edea3]/30 rounded-2xl text-[11px] sm:text-sm font-bold text-emerald-800 dark:text-[#4edea3] shadow-xs">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-[#4edea3]" />
                  <span className="hidden sm:inline">بوابة الطالب • جلسات الاختبارات المتاحة</span>
                  <span className="sm:hidden">بوابة الطالب</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
              )
            ) : (
              /* Inside Review / Results: Stage Indicator */
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#dfe2f1] truncate">{examTitle}</span>
                <span className="text-[10px] sm:text-xs text-slate-400 shrink-0">({totalQuestions} مسألة)</span>
              </div>
            )}
          </div>

          {/* Left Area: Theme Switcher + Role Switcher (Mobile Responsive) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 justify-end">
            
            {/* Theme Toggle - Single Button on Mobile, Dual Button on Desktop */}
            <div className="flex sm:hidden">
              <button
                type="button"
                onClick={() => onToggleTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-1.5 rounded-xl bg-[#f1f5f9] dark:bg-[#1c1f2a] border border-slate-200/80 dark:border-[#313540] text-slate-700 dark:text-[#dfe2f1] transition-colors shadow-2xs"
                title={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الساطع'}
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>
            </div>

            {/* Desktop Theme Segmented Pill */}
            <div className="hidden sm:flex items-center bg-[#f1f5f9] dark:bg-[#1c1f2a] p-1 rounded-2xl border border-slate-200/80 dark:border-[#313540] shadow-xs">
              <button
                type="button"
                onClick={() => onToggleTheme('light')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
                }`}
                title="نمط ساطع"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>نمط ساطع</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleTheme('dark')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#4f46e5] text-white shadow-[0_0_12px_rgba(192,193,255,0.25)]'
                    : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
                }`}
                title="نمط داكن"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-200" />
                <span>نمط داكن</span>
              </button>
            </div>

            {/* Role Switcher - Compact on Mobile, Dual Button on Desktop */}
            <div className="flex sm:hidden">
              <button
                type="button"
                onClick={() => onSelectRole(userRole === 'teacher' ? 'student' : 'teacher')}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold bg-[#f1f5f9] dark:bg-[#1c1f2a] border border-slate-200/80 dark:border-[#313540] text-[#3b4cb8] dark:text-[#c0c1ff] transition-colors shadow-2xs"
                title="تبديل الدور (معلم / طالب)"
              >
                {userRole === 'teacher' ? <GraduationCap className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{userRole === 'teacher' ? 'معلم' : 'طالب'}</span>
              </button>
            </div>

            {/* Desktop Role Segmented Pill */}
            <div className="hidden sm:flex items-center bg-[#f1f5f9] dark:bg-[#1c1f2a] p-1 rounded-2xl border border-slate-200/80 dark:border-[#313540] shadow-xs">
              <button
                type="button"
                onClick={() => onSelectRole('teacher')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userRole === 'teacher'
                    ? 'bg-[#4f46e5] text-white shadow-[0_0_12px_rgba(192,193,255,0.25)]'
                    : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
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
                    ? 'bg-[#4f46e5] text-white shadow-[0_0_12px_rgba(192,193,255,0.25)]'
                    : 'text-slate-600 dark:text-[#c7c4d7] hover:text-slate-900 dark:hover:text-white'
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
