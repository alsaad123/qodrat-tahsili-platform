import React, { useState, useEffect } from 'react';
import { Question, QuizStage, StudentAnswers, StudentScratchpads, StudentFlags, ExamSettings, PublishedExam, UserRole, ExamSubmission, getExamineeLabel } from './types/quiz';
import { UploadStage } from './components/UploadStage';
import { ReviewStage } from './components/ReviewStage';
import { QuizStage as QuizComponent } from './components/QuizStage';
import { ResultsStage } from './components/ResultsStage';
import { MyExamsStage } from './components/MyExamsStage';
import { Navbar } from './components/Navbar';
import {
  fetchPublishedExams,
  saveExamToSupabase,
  deleteExamFromSupabase,
  fetchSubmissions,
  saveSubmissionToSupabase,
  deleteSubmissionFromSupabase
} from './services/supabase';

const STORAGE_KEY_QUESTIONS = 'qudurat_tahsili_questions';
const STORAGE_KEY_TITLE = 'qudurat_tahsili_title';
const STORAGE_KEY_RAW = 'qudurat_tahsili_raw_text';
const STORAGE_KEY_SETTINGS = 'qudurat_tahsili_settings';
const STORAGE_KEY_PUBLISHED = 'qudurat_published_exams';
const STORAGE_KEY_ROLE = 'qudurat_user_role';
const STORAGE_KEY_ATTEMPTS = 'qudurat_student_attempts';
const STORAGE_KEY_THEME = 'qudurat_theme';
const STORAGE_KEY_SUBMISSIONS = 'qudurat_exam_submissions';

export default function App() {
  const [currentStage, setCurrentStage] = useState<QuizStage>('upload');
  const [homeTab, setHomeTab] = useState<'upload' | 'my-exams'>('upload');

  // Theme: 'light' (default) or 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch {
      return 'light';
    }
  });

  // Role: 'teacher' (default) or 'student'
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_ROLE) as UserRole) || 'teacher';
    } catch {
      return 'teacher';
    }
  });

  // Sync theme to document and localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // Ignore
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Student attempts record: { [examId: string]: number }
  const [studentAttempts, setStudentAttempts] = useState<{ [examId: string]: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeExamId, setActiveExamId] = useState<string | null>(null);

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

  // Examinee Submissions Store
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });

  const [viewingSubmission, setViewingSubmission] = useState<ExamSubmission | null>(null);

  // Sync submissions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
    } catch {
      // Ignore
    }
  }, [submissions]);

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

  // Sync role to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, userRole);
    } catch {
      // Ignore
    }
  }, [userRole]);

  // Sync attempts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(studentAttempts));
    } catch {
      // Ignore
    }
  }, [studentAttempts]);

  // Initial Sync with Supabase Database
  useEffect(() => {
    let isMounted = true;

    async function loadCloudData() {
      try {
        const [cloudExams, cloudSubs] = await Promise.all([
          fetchPublishedExams(),
          fetchSubmissions()
        ]);

        if (!isMounted) return;

        // Sync exams
        if (cloudExams && cloudExams.length > 0) {
          setPublishedExams(prev => {
            const cloudIds = new Set(cloudExams.map(e => e.id));
            const localOnly = prev.filter(e => !cloudIds.has(e.id));
            // Push any local-only exams to cloud
            localOnly.forEach(exam => saveExamToSupabase(exam));
            return [...cloudExams, ...localOnly];
          });
        } else {
          // If cloud has no exams yet, upload existing local ones
          setPublishedExams(prev => {
            if (prev.length > 0) {
              prev.forEach(exam => saveExamToSupabase(exam));
            }
            return prev;
          });
        }

        // Sync submissions
        if (cloudSubs && cloudSubs.length > 0) {
          setSubmissions(prev => {
            const cloudIds = new Set(cloudSubs.map(s => s.id));
            const localOnly = prev.filter(s => !cloudIds.has(s.id));
            // Push any local-only submissions to cloud
            localOnly.forEach(sub => saveSubmissionToSupabase(sub));
            return [...cloudSubs, ...localOnly];
          });
        } else {
          setSubmissions(prev => {
            if (prev.length > 0) {
              prev.forEach(sub => saveSubmissionToSupabase(sub));
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
      }
    }

    loadCloudData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Switch role handler
  const handleSelectRole = (newRole: UserRole) => {
    setUserRole(newRole);
    if (newRole === 'student') {
      // Student is restricted to exams view only
      setHomeTab('my-exams');
      if (currentStage === 'review') {
        setCurrentStage('upload');
      }
    }
  };

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
        const examToSave = { ...newExam, id: prev[existingIdx].id };
        updated[existingIdx] = examToSave;
        saveExamToSupabase(examToSave);
        return updated;
      }
      saveExamToSupabase(newExam);
      return [newExam, ...prev];
    });
  };

  // Take exam as student from "اختباراتي"
  const handleTakePublishedExam = (exam: PublishedExam) => {
    // If student, strictly enforce dates & attempt limits
    if (userRole === 'student') {
      const now = new Date();
      if (exam.settings?.enableDateRange) {
        if (exam.settings.startDate && new Date(exam.settings.startDate) > now) {
          alert(`هذا الاختبار غير متاح حالياً. يبدأ في تاريخ (${new Date(exam.settings.startDate).toLocaleString('ar-SA')}).`);
          return;
        }
        if (exam.settings.endDate && new Date(exam.settings.endDate) < now) {
          alert(`انتهت فترة تقديم هذا الاختبار بتاريخ (${new Date(exam.settings.endDate).toLocaleString('ar-SA')}).`);
          return;
        }
      }

      const usedAttempts = studentAttempts[exam.id] || 0;
      if (exam.settings?.maxAttempts && exam.settings.maxAttempts > 0 && usedAttempts >= exam.settings.maxAttempts) {
        alert(`لقد استنفدت الحد الأقصى للمحاولات المسموحة لهذا الاختبار (${usedAttempts} من ${exam.settings.maxAttempts}).`);
        return;
      }
    }

    setActiveExamId(exam.id);
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
    setAttemptNumber(userRole === 'student' ? (studentAttempts[exam.id] || 0) + 1 : 1);
    setCurrentStage('quiz');
  };

  // Edit exam from "اختباراتي" (Teacher only)
  const handleEditPublishedExam = (exam: PublishedExam) => {
    setActiveExamId(exam.id);
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

  // Delete exam from "اختباراتي" (Teacher only)
  const handleDeletePublishedExam = (id: string) => {
    deleteExamFromSupabase(id);
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
    setViewingSubmission(null);

    // Calculate score & statistics for submission record
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    questions.forEach(q => {
      const ans = answers[q.id];
      if (ans === null || ans === undefined) unansweredCount++;
      else if (ans === q.answer) correctCount++;
      else wrongCount++;
    });
    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

    // Track attempt if student
    if (userRole === 'student' && activeExamId) {
      setStudentAttempts(prev => ({
        ...prev,
        [activeExamId]: (prev[activeExamId] || 0) + 1
      }));
    }

    // Save Examinee Submission record
    const targetExamId = activeExamId || (publishedExams.length > 0 ? publishedExams[0].id : `exam-${Date.now()}`);
    const examSubmissionsCount = submissions.filter(s => s.examId === targetExamId).length;
    const examineeName = getExamineeLabel(examSubmissionsCount);

    const newSubmission: ExamSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      examId: targetExamId,
      examTitle: examTitle || 'اختبار تدريب القدرات والتحصيلي',
      examineeName,
      examineeIndex: examSubmissionsCount,
      submittedAt: new Date().toISOString(),
      correctCount,
      wrongCount,
      unansweredCount,
      totalQuestions: questions.length,
      percentage,
      timeSpentSeconds: totalSeconds,
      answers: { ...answers },
      scratchpads: { ...scratchpads },
      attemptNumber
    };

    saveSubmissionToSupabase(newSubmission);
    setSubmissions(prev => [newSubmission, ...prev]);

    setCurrentStage('results');
  };

  // View specific examinee submission (Teacher)
  const handleViewSubmission = (submission: ExamSubmission, exam: PublishedExam) => {
    setViewingSubmission(submission);
    setActiveExamId(exam.id);
    setQuestions(exam.questions);
    setExamTitle(exam.title);
    setAnswers(submission.answers);
    setScratchpads(submission.scratchpads);
    setTimeSpentSeconds(submission.timeSpentSeconds);
    setAttemptNumber(submission.attemptNumber);
    setExamSettings(exam.settings || { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 });
    setCurrentStage('results');
  };

  // Delete submission (Teacher)
  const handleDeleteSubmission = (submissionId: string) => {
    deleteSubmissionFromSupabase(submissionId);
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
  };

  // Retake All from results
  const handleRetakeAll = () => {
    if (userRole === 'student') {
      const usedAttempts = activeExamId ? studentAttempts[activeExamId] || 0 : attemptNumber;
      if (examSettings.maxAttempts > 0 && usedAttempts >= examSettings.maxAttempts) {
        alert(`عذراً، لقد استنفدت الحد الأقصى للمحاولات المسموحة (${examSettings.maxAttempts} من ${examSettings.maxAttempts}).`);
        return;
      }
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

  // Reset entirely (Teacher only)
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
    <div className={`bg-[#f4f7fb] dark:bg-nightfall-canvas text-slate-900 dark:text-nightfall-text flex flex-col selection:bg-[#3b4cb8] selection:text-white font-sans ${currentStage === 'quiz' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'}`} dir="rtl">
      
      {/* Top Navbar */}
      {currentStage !== 'quiz' && (
        <Navbar
          currentStage={currentStage}
          homeTab={homeTab}
          userRole={userRole}
          theme={theme}
          onToggleTheme={setTheme}
          onSelectRole={handleSelectRole}
          onSelectHomeTab={(tab) => {
            if (userRole === 'student') return;
            setHomeTab(tab);
            setCurrentStage('upload');
          }}
          publishedExamsCount={publishedExams.length}
          examTitle={examTitle}
          totalQuestions={questions.length}
          onNavigateStage={(stage) => {
            if (userRole === 'student') {
              setHomeTab('my-exams');
              setCurrentStage('upload');
              return;
            }
            setCurrentStage(stage);
          }}
          onReset={handleReset}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${currentStage === 'quiz' ? 'h-full overflow-hidden' : ''}`}>
        {currentStage === 'upload' && (
          (userRole === 'teacher' && homeTab === 'upload') ? (
            <UploadStage onExamLoaded={handleExamLoaded} />
          ) : (
            <MyExamsStage
              exams={publishedExams}
              userRole={userRole}
              studentAttempts={studentAttempts}
              submissions={submissions}
              onTakeExam={handleTakePublishedExam}
              onEditExam={handleEditPublishedExam}
              onDeleteExam={handleDeletePublishedExam}
              onGoToUpload={() => setHomeTab('upload')}
              onViewSubmission={handleViewSubmission}
              onDeleteSubmission={handleDeleteSubmission}
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
            userRole={userRole}
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
            userRole={userRole}
            viewingSubmission={viewingSubmission}
            onRetakeAll={handleRetakeAll}
            onRetakeIncorrectOnly={handleRetakeIncorrectOnly}
            onBackToReview={() => setCurrentStage('review')}
            onBackToSubmissions={() => {
              setViewingSubmission(null);
              setHomeTab('my-exams');
              setCurrentStage('upload');
            }}
            onNewExam={() => {
              setViewingSubmission(null);
              setHomeTab('my-exams');
              setCurrentStage('upload');
            }}
          />
        )}
      </main>

      {/* Modern EdTech Footer */}
      {currentStage !== 'quiz' && (
        <footer className="py-5 text-center text-xs text-slate-500 dark:text-nightfall-variant border-t border-[#e2e8f0] dark:border-nightfall-border bg-white/50 dark:bg-nightfall-card/50">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>منصة تدريب القدرات والتحصيلي • نظام التصميم العربي EdTech</span>
            <span className="text-slate-400 dark:text-nightfall-outline">بيئة اختبارات قياس تفاعلية ومسودة حل رياضية</span>
          </div>
        </footer>
      )}

    </div>
  );
}
