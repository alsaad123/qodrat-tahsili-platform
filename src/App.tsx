import React, { useState, useEffect } from 'react';
import { Question, QuizStage, StudentAnswers, StudentScratchpads, StudentFlags, ExamSettings, PublishedExam } from './types/quiz';
import { UploadStage } from './components/UploadStage';
import { ReviewStage } from './components/ReviewStage';
import { QuizStage as QuizComponent } from './components/QuizStage';
import { ResultsStage } from './components/ResultsStage';
import { MyExamsStage } from './components/MyExamsStage';
import { Navbar } from './components/Navbar';
import { Sparkles } from 'lucide-react';

const STORAGE_KEY_QUESTIONS = 'qudurat_tahsili_questions';
const STORAGE_KEY_TITLE = 'qudurat_tahsili_title';
const STORAGE_KEY_RAW = 'qudurat_tahsili_raw_text';
const STORAGE_KEY_SETTINGS = 'qudurat_tahsili_settings';
const STORAGE_KEY_PUBLISHED = 'qudurat_published_exams';

export default function App() {
  const [currentStage, setCurrentStage] = useState<QuizStage>('upload');
  const [homeTab, setHomeTab] = useState<'upload' | 'my-exams'>('upload');

  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [examSettings, setExamSettings] = useState<ExamSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 };
    } catch {
      return { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 };
    }
  });

  const [attemptNumber, setAttemptNumber] = useState<number>(1);

  const [examTitle, setExamTitle] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TITLE) || 'اختبار تدريب القدرات والتحصيلي';
    } catch {
      return 'اختبار تدريب القدرات والتحصيلي';
    }
  });

  const [rawText, setRawText] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_RAW) || '';
    } catch {
      return '';
    }
  });

  // Published Exams Store
  const [publishedExams, setPublishedExams] = useState<PublishedExam[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PUBLISHED);
      if (saved) return JSON.parse(saved);
      
      // Seed initial test if questions already exist in user storage
      const savedQuestions = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      const savedTitle = localStorage.getItem(STORAGE_KEY_TITLE) || 'اختبار تدريب القدرات والتحصيلي';
      if (savedQuestions) {
        const parsedQ = JSON.parse(savedQuestions);
        if (Array.isArray(parsedQ) && parsedQ.length > 0) {
          const initialExam: PublishedExam = {
            id: `exam-${Date.now()}`,
            title: savedTitle,
            questions: parsedQ,
            settings: { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 },
            publishedAt: new Date().toISOString(),
            questionCount: parsedQ.length
          };
          localStorage.setItem(STORAGE_KEY_PUBLISHED, JSON.stringify([initialExam]));
          return [initialExam];
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [fallbackTriggered, setFallbackTriggered] = useState<boolean>(false);
  const [sourceImage, setSourceImage] = useState<string | undefined>();
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [scratchpads, setScratchpads] = useState<StudentScratchpads>({});
  const [flags, setFlags] = useState<StudentFlags>({});
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);

  // Sync questions to localStorage
  useEffect(() => {
    if (questions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(questions));
        localStorage.setItem(STORAGE_KEY_TITLE, examTitle);
        localStorage.setItem(STORAGE_KEY_RAW, rawText);
      } catch {
        // Ignore quota exceptions
      }
    }
  }, [questions, examTitle, rawText]);

  // Sync published exams to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PUBLISHED, JSON.stringify(publishedExams));
    } catch {
      // Ignore quota exceptions
    }
  }, [publishedExams]);

  // Stage 1 -> Stage 2: When an exam file or sample is loaded
  const handleExamLoaded = (
    loadedQuestions: Question[],
    extractedRawText: string,
    title: string,
    isFallback: boolean,
    uploadedImage?: string,
    uploadedImages?: string[]
  ) => {
    setQuestions(loadedQuestions);
    setRawText(extractedRawText);
    setExamTitle(title || 'اختبار قدرات وتحصيلي');
    setFallbackTriggered(isFallback);
    if (uploadedImages && uploadedImages.length > 0) {
      setSourceImages(uploadedImages);
      setSourceImage(uploadedImages[0]);
    } else if (uploadedImage) {
      setSourceImage(uploadedImage);
      setSourceImages([uploadedImage]);
    }
    setAnswers({});
    setScratchpads({});
    setFlags({});
    setCurrentStage('review');
  };

  // Stage 2 -> Stage 3: Start the quiz (preview or take)
  const handleStartQuiz = (settings: ExamSettings) => {
    if (settings.enableDateRange) {
      const now = new Date();
      if (settings.startDate && new Date(settings.startDate) > now) {
        const startFormatted = new Date(settings.startDate).toLocaleString('ar-SA');
        if (!window.confirm(`تنبيه: الاختبار مجدول للبدء في تاريخ (${startFormatted}). هل ترغب في الدخول ومعاينة الاختبار كمعلم/مشرف الآن؟`)) {
          return;
        }
      }
      if (settings.endDate && new Date(settings.endDate) < now) {
        const endFormatted = new Date(settings.endDate).toLocaleString('ar-SA');
        if (!window.confirm(`تنبيه: انتهت فترة إتاحة هذا الاختبار بتاريخ (${endFormatted}). هل ترغب في الدخول ومعاينة الاختبار الآن؟`)) {
          return;
        }
      }
    }

    setExamSettings(settings);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
    setAttemptNumber(1);
    setAnswers({});
    setScratchpads({});
    setFlags({});
    setTimeSpentSeconds(0);
    setCurrentStage('quiz');
  };

  // Publish Exam Handler
  const handlePublishExam = (settings: ExamSettings) => {
    const newExam: PublishedExam = {
      id: `exam-${Date.now()}`,
      title: examTitle || 'اختبار قدرات وتحصيلي',
      questions: [...questions],
      settings: { ...settings },
      publishedAt: new Date().toISOString(),
      questionCount: questions.length,
      rawText: rawText,
      sourceImage: sourceImage,
      sourceImages: sourceImages
    };

    setPublishedExams(prev => {
      const existingIdx = prev.findIndex(e => e.title.trim().toLowerCase() === newExam.title.trim().toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...newExam, id: prev[existingIdx].id };
        return updated;
      }
      return [newExam, ...prev];
    });
  };

  // Take exam as student from "اختباراتي"
  const handleTakePublishedExam = (exam: PublishedExam) => {
    setQuestions(exam.questions);
    setExamTitle(exam.title);
    setExamSettings(exam.settings || { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 });
    setRawText(exam.rawText || '');
    if (exam.sourceImages && exam.sourceImages.length > 0) {
      setSourceImages(exam.sourceImages);
      setSourceImage(exam.sourceImages[0]);
    } else if (exam.sourceImage) {
      setSourceImage(exam.sourceImage);
      setSourceImages([exam.sourceImage]);
    }
    setAnswers({});
    setScratchpads({});
    setFlags({});
    setTimeSpentSeconds(0);
    setAttemptNumber(1);
    setCurrentStage('quiz');
  };

  // Edit exam from "اختباراتي"
  const handleEditPublishedExam = (exam: PublishedExam) => {
    setQuestions(exam.questions);
    setExamTitle(exam.title);
    setExamSettings(exam.settings || { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 });
    setRawText(exam.rawText || '');
    if (exam.sourceImages && exam.sourceImages.length > 0) {
      setSourceImages(exam.sourceImages);
      setSourceImage(exam.sourceImages[0]);
    } else if (exam.sourceImage) {
      setSourceImage(exam.sourceImage);
      setSourceImages([exam.sourceImage]);
    }
    setAnswers({});
    setScratchpads({});
    setFlags({});
    setCurrentStage('review');
  };

  // Delete exam from "اختباراتي"
  const handleDeletePublishedExam = (id: string) => {
    setPublishedExams(prev => prev.filter(e => e.id !== id));
  };

  // Answer selection in quiz
  const handleAnswerChange = (questionId: string, answerIdx: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIdx
    }));
  };

  // Scratchpad edit in quiz
  const handleScratchpadChange = (questionId: string, text: string) => {
    setScratchpads(prev => ({
      ...prev,
      [questionId]: text
    }));
  };

  // Flag toggle in quiz
  const handleToggleFlag = (questionId: string) => {
    setFlags(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Stage 3 -> Stage 4: Finish Quiz
  const handleFinishQuiz = (totalSeconds: number) => {
    setTimeSpentSeconds(totalSeconds);
    setCurrentStage('results');
  };

  // Retake All from results
  const handleRetakeAll = () => {
    if (examSettings.maxAttempts > 0 && attemptNumber >= examSettings.maxAttempts) {
      alert(`عذراً، لقد استنفدت الحد الأقصى للمحاولات المسموحة (${examSettings.maxAttempts} من ${examSettings.maxAttempts}).`);
      return;
    }
    setAttemptNumber(prev => prev + 1);
    setAnswers({});
    setFlags({});
    setTimeSpentSeconds(0);
    setCurrentStage('quiz');
  };

  // Retake Incorrect Only from results
  const handleRetakeIncorrectOnly = (incorrectQuestions: Question[]) => {
    if (incorrectQuestions.length === 0) return;
    setQuestions(incorrectQuestions);
    setAnswers({});
    setFlags({});
    setTimeSpentSeconds(0);
    setExamTitle(`${examTitle} (إعادة الأخطاء)`);
    setCurrentStage('quiz');
  };

  // Reset entirely
  const handleReset = () => {
    if (window.confirm('هل تريد بدء اختبار جديد وحذف الأسئلة الحالية؟')) {
      localStorage.removeItem(STORAGE_KEY_QUESTIONS);
      localStorage.removeItem(STORAGE_KEY_TITLE);
      localStorage.removeItem(STORAGE_KEY_RAW);
      setQuestions([]);
      setRawText('');
      setExamTitle('اختبار تدريب القدرات والتحصيلي');
      setAnswers({});
      setScratchpads({});
      setFlags({});
      setHomeTab('upload');
      setCurrentStage('upload');
    }
  };

  return (
    <div className={`bg-[#f4f7fb] text-slate-900 flex flex-col selection:bg-[#3b4cb8] selection:text-white font-sans ${currentStage === 'quiz' ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'}`} dir="rtl">
      
      {/* Top Navbar */}
      {currentStage !== 'quiz' && (
        <Navbar
          currentStage={currentStage}
          homeTab={homeTab}
          onSelectHomeTab={(tab) => {
            setHomeTab(tab);
            setCurrentStage('upload');
          }}
          publishedExamsCount={publishedExams.length}
          examTitle={examTitle}
          totalQuestions={questions.length}
          onNavigateStage={(stage) => setCurrentStage(stage)}
          onReset={handleReset}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${currentStage === 'quiz' ? 'h-full overflow-hidden' : ''}`}>
        {currentStage === 'upload' && (
          homeTab === 'upload' ? (
            <UploadStage onExamLoaded={handleExamLoaded} />
          ) : (
            <MyExamsStage
              exams={publishedExams}
              onTakeExam={handleTakePublishedExam}
              onEditExam={handleEditPublishedExam}
              onDeleteExam={handleDeletePublishedExam}
              onGoToUpload={() => setHomeTab('upload')}
            />
          )
        )}

        {currentStage === 'review' && (
          <ReviewStage
            questions={questions}
            examTitle={examTitle}
            rawText={rawText}
            fallbackTriggered={fallbackTriggered}
            sourceImage={sourceImage}
            sourceImages={sourceImages}
            settings={examSettings}
            onUpdateQuestions={setQuestions}
            onStartQuiz={handleStartQuiz}
            onPublishExam={handlePublishExam}
            onGoToMyExams={() => {
              setHomeTab('my-exams');
              setCurrentStage('upload');
            }}
            onBackToUpload={() => {
              setHomeTab('upload');
              setCurrentStage('upload');
            }}
            onUpdateTitle={setExamTitle}
          />
        )}

        {currentStage === 'quiz' && (
          <QuizComponent
            questions={questions}
            examTitle={examTitle}
            answers={answers}
            scratchpads={scratchpads}
            flags={flags}
            settings={examSettings}
            attemptNumber={attemptNumber}
            onAnswerChange={handleAnswerChange}
            onScratchpadChange={handleScratchpadChange}
            onToggleFlag={handleToggleFlag}
            onFinishQuiz={handleFinishQuiz}
            onBackToReview={() => setCurrentStage('review')}
          />
        )}

        {currentStage === 'results' && (
          <ResultsStage
            questions={questions}
            examTitle={examTitle}
            answers={answers}
            scratchpads={scratchpads}
            timeSpentSeconds={timeSpentSeconds}
            settings={examSettings}
            attemptNumber={attemptNumber}
            onRetakeAll={handleRetakeAll}
            onRetakeIncorrectOnly={handleRetakeIncorrectOnly}
            onBackToReview={() => setCurrentStage('review')}
            onNewExam={() => {
              setHomeTab('upload');
              setCurrentStage('upload');
            }}
          />
        )}
      </main>

      {/* Floating AI Assistant Pill */}
      {currentStage !== 'quiz' && (
        <aside 
          aria-label="المساعد الذكي للقدرات"
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full border border-[#e2e8f0] shadow-[0_10px_25px_-5px_rgba(59,76,184,0.2)] hover:shadow-[0_12px_28px_-4px_rgba(59,76,184,0.28)] transition-all cursor-pointer group"
          onClick={() => {
            if (questions.length > 0) {
              alert(`المساعد الذكي نشط: لديك حالياً ${questions.length} مسألة محملة في النظام.`);
            } else {
              alert('المساعد الذكي: يمكنك رفع صور أو ملفات PDF لنماذج القدرات والتحصيلي وسأقوم باستخراجها وحلها آلياً.');
            }
          }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3b4cb8] to-[#6366f1] flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="flex flex-col text-right">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">مساعد قياس الذكي</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-[10px] text-slate-400 group-hover:text-[#3b4cb8] transition-colors">تحليل واستخراج النماذج</span>
          </div>
        </aside>
      )}

      {/* Modern EdTech Footer */}
      {currentStage !== 'quiz' && (
        <footer className="py-5 text-center text-xs text-slate-500 border-t border-[#e2e8f0] bg-white/50">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>منصة تدريب القدرات والتحصيلي • نظام التصميم العربي EdTech</span>
            <span className="text-slate-400">بيئة اختبارات قياس تفاعلية ومسودة حل رياضية</span>
          </div>
        </footer>
      )}

    </div>
  );
}
