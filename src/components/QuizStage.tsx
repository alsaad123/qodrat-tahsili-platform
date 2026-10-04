import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Question, StudentAnswers, StudentScratchpads, StudentFlags, OPTION_LABELS, ExamSettings, UserRole } from '../types/quiz';
import { 
  ArrowLeft, ArrowRight, Bookmark, CheckCircle2, 
  Clock, Edit3, Trash2, Check, Lightbulb,
  Eraser, PenTool, Undo2, GripVertical, ListOrdered, Sparkles, RotateCcw,
  ChevronUp, ChevronDown, Plus
} from 'lucide-react';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface QuizStageProps {
  questions: Question[];
  examTitle: string;
  answers: StudentAnswers;
  scratchpads: StudentScratchpads;
  flags: StudentFlags;
  settings?: ExamSettings;
  attemptNumber?: number;
  userRole?: UserRole;
  onAnswerChange: (questionId: string, answerIdx: number) => void;
  onScratchpadChange: (questionId: string, text: string) => void;
  onToggleFlag: (questionId: string) => void;
  onFinishQuiz: (timeSpentSeconds: number) => void;
  onBackToReview: () => void;
}

export const QuizStage: React.FC<QuizStageProps> = ({
  questions,
  examTitle: _examTitle,
  answers,
  scratchpads,
  flags,
  settings,
  attemptNumber = 1,
  userRole = 'teacher',
  onAnswerChange,
  onScratchpadChange,
  onToggleFlag,
  onFinishQuiz,
  onBackToReview
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeExpiredModal, setTimeExpiredModal] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning] = useState(true);
  const [scratchpadMode, setScratchpadMode] = useState<'text' | 'draw'>('draw');

  // Time limit logic
  const hasTimeLimit = Boolean(settings?.durationMinutes && settings.durationMinutes > 0);
  const totalDurationSeconds = hasTimeLimit ? (settings!.durationMinutes * 60) : 0;
  const remainingSeconds = hasTimeLimit ? Math.max(0, totalDurationSeconds - secondsElapsed) : 0;
  const isTimeCritical = hasTimeLimit && remainingSeconds <= 180; // less than 3 minutes

  // Auto-finish if time limit reached
  useEffect(() => {
    if (hasTimeLimit && remainingSeconds === 0 && secondsElapsed > 0 && isTimerRunning && !timeExpiredModal) {
      setTimeExpiredModal(true);
      const timer = setTimeout(() => {
        onFinishQuiz(totalDurationSeconds);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [hasTimeLimit, remainingSeconds, secondsElapsed, isTimerRunning, timeExpiredModal, onFinishQuiz, totalDurationSeconds]);

  // Resizable split state for Options vs Notes (horizontal drag)
  const [optionsWidthPercent, setOptionsWidthPercent] = useState<number>(24);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Drawing tools state
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState<string>('#3b4cb8'); // Stitch Royal Indigo
  const [penSize, setPenSize] = useState<number>(3);
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [questionDrawings, setQuestionDrawings] = useState<{ [qId: string]: string }>({});
  const [undoStack, setUndoStack] = useState<{ [qId: string]: string[] }>({});
  const drawingsRef = useRef<{ [qId: string]: string }>({});
  const prevQIdRef = useRef<string>(questions[0]?.id || '');

  // Canvas vertical sizing and scrolling
  const [extraCanvasHeight, setExtraCanvasHeight] = useState<number>(0);
  const [canvasCalculatedHeight, setCanvasCalculatedHeight] = useState<number>(1200);
  const [scrollPos, setScrollPos] = useState<number>(0);

  // Drawing canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const isDrawing = useRef(false);

  // Dragging event listeners for horizontal split between Answers and Notes
  useEffect(() => {
    if (!isDraggingSplitter) return;

    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (splitContainerRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect();
        // In RTL: options is on the right side
        const distFromRight = rect.right - e.clientX;
        const pct = Math.min(Math.max((distFromRight / rect.width) * 100, 16), 55);
        setOptionsWidthPercent(Math.round(pct));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      if (splitContainerRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect();
        const distFromRight = rect.right - e.touches[0].clientX;
        const pct = Math.min(Math.max((distFromRight / rect.width) * 100, 16), 55);
        setOptionsWidthPercent(Math.round(pct));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
    };
  }, [isDraggingSplitter]);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  const handleSplitterTouchStart = () => {
    setIsDraggingSplitter(true);
  };

  // Timer counter
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Reset hint state on question change
  useEffect(() => {
    setShowHint(false);
  }, [currentIndex]);

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  // Answered count
  const answeredCount = Object.values(answers).filter(val => val !== null && val !== undefined).length;
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  // Restore drawing for a specific question (clears canvas if question has no drawing)
  const restoreDrawingForQuestion = useCallback((qId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Immediately clear canvas so previous question's drawing is never leaked
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const saved = drawingsRef.current[qId] || questionDrawings[qId];
    if (saved && saved.trim().length > 0) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = saved;
    }
  }, [questionDrawings]);

  // Synchronize and size canvas to parent container accurately
  const syncCanvasSize = useCallback((restoreDrawing: boolean = true) => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container || !currentQ) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const targetWidth = Math.round(container.clientWidth || rect.width);
    const containerHeight = Math.round(container.clientHeight || rect.height || 550);
    // Guarantee generous height: at least 2.2x the visible container height and minimum 1200px
    const targetHeight = Math.max(Math.round(containerHeight * 2.2), 1200) + extraCanvasHeight;

    setCanvasCalculatedHeight(targetHeight);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      // Preserve existing strokes if canvas already has content before resizing
      let currentData: string | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          currentData = canvas.toDataURL();
        } catch {
          // ignore
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      if (restoreDrawing) {
        if (currentData) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0);
          };
          img.src = currentData;
        } else {
          restoreDrawingForQuestion(currentQ.id);
        }
      }
    }
  }, [currentQ, extraCanvasHeight, restoreDrawingForQuestion]);

  // Sync canvas with ResizeObserver whenever dimensions change
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      syncCanvasSize(true);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [syncCanvasSize]);

  // Key effect: On question change, save current question drawing and restore new question drawing
  useEffect(() => {
    const prevQId = prevQIdRef.current;
    const newQId = currentQ?.id;

    // 1. If we are navigating away from a previous question, save whatever was on the canvas
    if (canvasRef.current && prevQId && prevQId !== newQId) {
      const canvas = canvasRef.current;
      // If there were strokes on the canvas for prevQId
      if (undoStack[prevQId] && undoStack[prevQId].length > 0) {
        const data = canvas.toDataURL();
        drawingsRef.current[prevQId] = data;
        setQuestionDrawings(prev => ({ ...prev, [prevQId]: data }));
      }
    }

    // 2. Update prev question reference
    if (newQId) {
      prevQIdRef.current = newQId;
    }

    // 3. Clear canvas and load drawing for the new question
    if (newQId) {
      restoreDrawingForQuestion(newQId);
    }

    // 4. Reset scroll of canvas container to top
    if (canvasContainerRef.current) {
      canvasContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex, currentQ, restoreDrawingForQuestion, undoStack]);

  // When switching to draw mode, ensure canvas is sized and drawing for current question is loaded
  useEffect(() => {
    if (scratchpadMode === 'draw' && currentQ) {
      const timer = setTimeout(() => {
        syncCanvasSize(true);
        restoreDrawingForQuestion(currentQ.id);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [scratchpadMode, currentQ, syncCanvasSize, restoreDrawingForQuestion]);

  // Navigation handlers
  const handleNext = () => {
    if (!isLastQuestion) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowConfirmModal(true);
    }
  };

  const handlePrev = () => {
    if (!isFirstQuestion) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Keyboard navigation (1, 2, 3, 4 for options)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

      if (e.key === '1' || e.key === '١') onAnswerChange(currentQ.id, 0);
      else if (e.key === '2' || e.key === '٢') onAnswerChange(currentQ.id, 1);
      else if (e.key === '3' || e.key === '٣') onAnswerChange(currentQ.id, 2);
      else if (e.key === '4' || e.key === '٤') onAnswerChange(currentQ.id, 3);
      else if (e.key === 'ArrowLeft' && !isLastQuestion) handleNext();
      else if (e.key === 'ArrowRight' && !isFirstQuestion) handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQ, currentIndex, isLastQuestion, isFirstQuestion]);

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Calculate accurate coordinates accounting for scroll
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Drawing canvas logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.touches.length > 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentData = canvas.toDataURL();
    setUndoStack(prev => ({
      ...prev,
      [currentQ.id]: [...(prev[currentQ.id] || []).slice(-10), currentData]
    }));

    isDrawing.current = true;
    const coords = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
    ctx.stroke();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && currentQ) {
      const dataUrl = canvas.toDataURL();
      drawingsRef.current[currentQ.id] = dataUrl;
      setQuestionDrawings(prev => ({
        ...prev,
        [currentQ.id]: dataUrl
      }));
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentQ) return;
    const stack = undoStack[currentQ.id];
    if (!stack || stack.length === 0) return;

    const previousState = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);
    setUndoStack(prev => ({ ...prev, [currentQ.id]: newStack }));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (previousState && previousState.trim().length > 0) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        drawingsRef.current[currentQ.id] = previousState;
        setQuestionDrawings(prev => ({ ...prev, [currentQ.id]: previousState }));
      };
      img.src = previousState;
    } else {
      drawingsRef.current[currentQ.id] = '';
      setQuestionDrawings(prev => ({ ...prev, [currentQ.id]: '' }));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentQ) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const currentData = canvas.toDataURL();
      setUndoStack(prev => ({
        ...prev,
        [currentQ.id]: [...(prev[currentQ.id] || []).slice(-10), currentData]
      }));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingsRef.current[currentQ.id] = '';
      setQuestionDrawings(prev => ({
        ...prev,
        [currentQ.id]: ''
      }));
    }
  };

  // Fast scrolling and canvas expansion helpers
  const handleScrollTop = () => {
    canvasContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollDown = () => {
    if (!canvasContainerRef.current) return;
    const current = canvasContainerRef.current.scrollTop;
    const clientHeight = canvasContainerRef.current.clientHeight || 500;
    canvasContainerRef.current.scrollTo({ top: current + clientHeight * 0.75, behavior: 'smooth' });
  };

  const handleScrollUp = () => {
    if (!canvasContainerRef.current) return;
    const current = canvasContainerRef.current.scrollTop;
    const clientHeight = canvasContainerRef.current.clientHeight || 500;
    canvasContainerRef.current.scrollTo({ top: Math.max(0, current - clientHeight * 0.75), behavior: 'smooth' });
  };

  const handleAddMoreSpace = () => {
    setExtraCanvasHeight(prev => prev + 500);
    setTimeout(() => {
      if (canvasContainerRef.current) {
        canvasContainerRef.current.scrollTo({
          top: canvasContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 80);
  };

  return (
    <div className="h-full w-full max-h-screen flex flex-col p-2.5 sm:p-3 overflow-hidden select-none" dir="rtl">
      
      {/* Two-Column App Layout: Right/Center = Quiz Area, Left = Vertical Status & Palette */}
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* Right / Main Quiz Area */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          
          {/* Top Bar: Question Details */}
          <div className="flex items-center justify-between pb-2 mb-2 shrink-0 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
                السؤال {currentIndex + 1} من {questions.length}
              </span>
              {currentQ.category && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#eef2ff] text-[#3b4cb8] border border-[#c7d2fe]">
                  {currentQ.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>المجاب:</span>
              <span className="font-bold text-[#3b4cb8] bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono shadow-xs">
                {answeredCount} / {questions.length}
              </span>
            </div>
          </div>

          {/* Compact Question Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 sm:p-4 mb-2.5 shadow-stitch-card shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-lg bg-[#eef2ff] text-[#3b4cb8] flex items-center justify-center font-bold text-[11px]">
                  س
                </span>
                <span className="text-xs font-bold text-slate-700">السؤال {currentIndex + 1}</span>
                {currentQ.category && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3b4cb8] border border-[#c7d2fe] sm:hidden">
                    {currentQ.category}
                  </span>
                )}
              </div>

              {currentQ.hint && currentQ.hint.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer font-medium"
                >
                  <Lightbulb className="w-3 h-3 text-amber-600" />
                  <span>{showHint ? 'إخفاء التلميح' : 'تلميح الحل'}</span>
                </button>
              )}
            </div>

            {/* Question Text with Math/Formula Rendering */}
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed whitespace-pre-line">
              <MathFormulaRenderer text={currentQ.question} />
            </h2>

            {/* Diagram SVG if available */}
            {currentQ.diagramSvg && (
              <div 
                className="my-1.5 p-2 bg-[#f8fafc] dark:bg-[#1a2236] rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center max-h-24 sm:max-h-28 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: currentQ.diagramSvg }}
              />
            )}

            {/* Image if available */}
            {currentQ.imageUrl && (
              <div className="my-1.5 p-1 bg-[#f8fafc] dark:bg-[#1a2236] rounded-xl border border-slate-200 dark:border-slate-800 flex justify-center">
                <img 
                  src={currentQ.imageUrl} 
                  alt="رسمة السؤال التوضيحية" 
                  className="max-h-24 sm:max-h-28 rounded-lg object-contain"
                />
              </div>
            )}

            {/* Collapsible Hint */}
            {showHint && currentQ.hint && (
              <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-fadeIn">
                <p className="font-bold flex items-center gap-1 mb-0.5 text-[11px]">
                  <Sparkles className="w-3 h-3 text-amber-600" /> طريقة الحل المقترحة:
                </p>
                <div className="whitespace-pre-line font-sans text-xs">
                  <MathFormulaRenderer text={currentQ.hint} />
                </div>
              </div>
            )}
          </div>

          {/* Split Row: Separate Answers Box & Notes Box with Width Dragging */}
          <div 
            ref={splitContainerRef}
            className="flex-1 min-h-0 flex gap-2.5 items-stretch relative overflow-hidden"
          >
            {/* 1. Answers Box (Separate Card, Compact Height, Resizable Width) */}
            <div
              style={{ width: `${optionsWidthPercent}%` }}
              className="bg-white dark:bg-[#151c2c] border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-3 shadow-stitch-card flex flex-col h-fit max-h-full shrink-0 relative overflow-hidden"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-[#eef2ff] dark:bg-indigo-950 text-[#3b4cb8] dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                    ✓
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs">خيارات الإجابة</h3>
                </div>
                <span className="text-[10px] text-slate-400">حدد إجابة</span>
              </div>

              <div className="space-y-1.5 overflow-y-auto pr-0.5">
                {currentQ.options.map((optText, optIdx) => {
                  const label = OPTION_LABELS[optIdx];
                  const isSelected = answers[currentQ.id] === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => onAnswerChange(currentQ.id, optIdx)}
                      className={`w-full text-right p-2 sm:p-2.5 rounded-xl border transition-all flex items-center gap-2 group cursor-pointer ${
                        isSelected
                          ? 'bg-[#eef2ff] dark:bg-indigo-950/60 border-[#3b4cb8] shadow-xs ring-2 ring-[#3b4cb8]/20 text-[#3b4cb8] dark:text-indigo-300 font-bold'
                          : 'bg-[#f8fafc] dark:bg-[#1a2236] hover:bg-white dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#3b4cb8] text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:border-[#3b4cb8]'
                      }`}>
                        {label}
                      </span>

                      <span className="text-xs sm:text-sm flex-1 font-medium leading-relaxed">
                        <MathFormulaRenderer text={optText} />
                      </span>

                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-[#3b4cb8] bg-[#3b4cb8] text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-slate-400'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Drag Handle on Answers Box */}
              <div
                onMouseDown={handleSplitterMouseDown}
                onTouchStart={handleSplitterTouchStart}
                title="اسحب لتكبير أو تصغير عرض مربع الخيارات"
                className="absolute left-0 top-0 bottom-0 w-3 hover:w-4 bg-transparent hover:bg-indigo-500/10 cursor-col-resize flex items-center justify-center group z-10"
              >
                <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-[#3b4cb8] transition-colors flex items-center justify-center">
                  <span className="text-[8px] text-slate-400 group-hover:text-white font-bold select-none">›</span>
                </div>
              </div>
            </div>

            {/* 2. Notes Box (Separate Card, Taller Height, Resizable Width) */}
            <div
              style={{ width: `calc(${100 - optionsWidthPercent}% - 10px)` }}
              className="bg-white border border-[#e2e8f0] rounded-2xl p-3 shadow-stitch-card flex flex-col flex-1 h-full min-h-0 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#3b4cb8]" />
                  <h3 className="font-bold text-slate-900 text-xs">مسودة الطالب الرياضية (رسم وتخطيط)</h3>
                </div>

                {/* Mode switch */}
                <div className="flex items-center gap-1 bg-[#f1f5f9] p-0.5 rounded-lg border border-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setScratchpadMode('draw')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                      scratchpadMode === 'draw'
                        ? 'bg-white text-[#3b4cb8] font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    رسم / تخطيط
                  </button>
                  <button
                    type="button"
                    onClick={() => setScratchpadMode('text')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                      scratchpadMode === 'text'
                        ? 'bg-white text-[#3b4cb8] font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    كتابة
                  </button>
                </div>
              </div>

              {/* Draw Mode */}
              {scratchpadMode === 'draw' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Drawing Toolbar */}
                  <div className="mb-1.5 p-1 bg-[#f8fafc] rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-1 text-xs shrink-0">
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setDrawTool('pen')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          drawTool === 'pen'
                            ? 'bg-[#3b4cb8] text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="قلم"
                      >
                        <PenTool className="w-3 h-3" />
                        <span className="text-[10px]">قلم</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDrawTool('eraser')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          drawTool === 'eraser'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="ممحاة"
                      >
                        <Eraser className="w-3 h-3" />
                        <span className="text-[10px]">ممحاة</span>
                      </button>
                    </div>

                    {drawTool === 'pen' ? (
                      <div className="flex items-center gap-1">
                        {[
                          { color: '#3b4cb8', name: 'أزرق نيلي' },
                          { color: '#0f172a', name: 'أسود' },
                          { color: '#10b981', name: 'أخضر' },
                          { color: '#ef4444', name: 'أحمر' },
                          { color: '#f59e0b', name: 'برتقالي' }
                        ].map((item) => (
                          <button
                            key={item.color}
                            type="button"
                            onClick={() => setPenColor(item.color)}
                            className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                              penColor === item.color ? 'scale-125 ring-2 ring-[#3b4cb8] shadow-xs' : 'opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: item.color }}
                            title={item.name}
                          />
                        ))}

                        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1 mr-0.5">
                          {[
                            { size: 2, label: 'رفيع' },
                            { size: 4, label: 'وسط' },
                            { size: 7, label: 'عريض' }
                          ].map((s) => (
                            <button
                              key={s.size}
                              type="button"
                              onClick={() => setPenSize(s.size)}
                              className={`px-1 py-0.5 text-[9px] rounded cursor-pointer ${
                                penSize === s.size ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-slate-200">
                        <span className="text-[9px] text-amber-700">الممحاة:</span>
                        {[
                          { size: 14, label: 'صغيرة' },
                          { size: 26, label: 'وسط' },
                          { size: 44, label: 'عريضة' }
                        ].map((s) => (
                          <button
                            key={s.size}
                            type="button"
                            onClick={() => setEraserSize(s.size)}
                            className={`px-1 py-0.5 text-[9px] rounded cursor-pointer transition-colors ${
                              eraserSize === s.size
                                ? 'bg-amber-500 text-white font-bold'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {/* Quick Scroll & Space Controls */}
                      <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={handleScrollUp}
                          className="p-1 text-slate-600 hover:text-[#3b4cb8] hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                          title="تمرير للأعلى"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span className="text-[10px] hidden sm:inline">أعلى</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleScrollDown}
                          className="p-1 text-slate-600 hover:text-[#3b4cb8] hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                          title="تمرير للأسفل"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span className="text-[10px] hidden sm:inline">أسفل</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAddMoreSpace}
                          className="p-1 text-slate-600 hover:text-[#3b4cb8] hover:bg-indigo-50 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                          title="إضافة مساحة رسم إضافية بالأسفل"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[10px] hidden md:inline">مساحة</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleUndo}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title="تراجع"
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="مسح اللوحة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Canvas Viewport */}
                  <div 
                    ref={canvasContainerRef}
                    onScroll={(e) => setScrollPos(e.currentTarget.scrollTop)}
                    className="relative flex-1 min-h-0 bg-white border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden scroll-smooth"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#94a3b8 #f1f5f9'
                    }}
                  >
                    <div className="relative" style={{ height: `${canvasCalculatedHeight}px`, width: '100%' }}>
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className={`w-full block touch-none ${
                          drawTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
                        }`}
                        style={{ width: '100%', height: `${canvasCalculatedHeight}px` }}
                      />
                      
                      {/* Top indicator badge */}
                      <div className="sticky top-2 left-2 float-left ml-2 mt-2 text-[10px] text-slate-500 pointer-events-none select-none flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2 py-1 rounded-md border border-slate-200 shadow-xs z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3b4cb8] animate-pulse"></span>
                        <span>مسودة رسم كاملة (مرر بالماوس أو الأسهم للمزيد ↓)</span>
                      </div>

                      {/* Floating return-to-top button when scrolled down */}
                      {scrollPos > 120 && (
                        <button
                          type="button"
                          onClick={handleScrollTop}
                          className="sticky bottom-3 left-3 float-left ml-3 mb-3 z-20 flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#3b4cb8] bg-white/95 backdrop-blur-xs border border-indigo-200 rounded-full shadow-md hover:bg-indigo-50 transition-all cursor-pointer"
                          title="العودة لأعلى المسودة"
                        >
                          <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>العودة للأعلى</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Text Mode */}
              {scratchpadMode === 'text' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <textarea
                    value={scratchpads[currentQ.id] || ''}
                    onChange={(e) => onScratchpadChange(currentQ.id, e.target.value)}
                    placeholder="اكتب معادلتك أو خطواتك الرياضية هنا..."
                    className="w-full flex-1 bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#3b4cb8] leading-relaxed resize-none"
                  />
                </div>
              )}

              {/* Drag Handle on Notes Box */}
              <div
                onMouseDown={handleSplitterMouseDown}
                onTouchStart={handleSplitterTouchStart}
                title="اسحب لتكبير أو تصغير عرض مربع النوتات"
                className="absolute right-0 top-0 bottom-0 w-3 hover:w-4 bg-transparent hover:bg-indigo-500/10 cursor-col-resize flex items-center justify-center group z-10"
              >
                <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-[#3b4cb8] transition-colors flex items-center justify-center">
                  <span className="text-[8px] text-slate-400 group-hover:text-white font-bold select-none">‹</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Left Side: Vertical Status & Question Palette */}
        <aside className="w-60 sm:w-68 shrink-0 h-full flex flex-col bg-white border border-[#e2e8f0] rounded-2xl p-3 shadow-stitch-card overflow-hidden">
          {/* Timer Card */}
          <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 mb-2 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-red-500 animate-pulse' : 'text-[#3b4cb8]'}`} />
                <span>{hasTimeLimit ? 'الوقت المتبقي:' : 'الوقت:'}</span>
              </div>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border transition-colors ${
                isTimeCritical
                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                  : 'bg-white text-[#3b4cb8] border-slate-200 shadow-xs'
              }`}>
                {formatTime(hasTimeLimit ? remainingSeconds : secondsElapsed)}
              </span>
            </div>

            {/* Attempt badge if applicable */}
            {(attemptNumber > 1 || (settings?.maxAttempts && settings.maxAttempts > 0)) && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-[#3b4cb8]" /> المحاولة:
                </span>
                <span className="font-bold text-[#3b4cb8]">
                  {attemptNumber} {settings?.maxAttempts && settings.maxAttempts > 0 ? `من ${settings.maxAttempts}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Question Status Card */}
          <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 mb-2 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                السؤال {currentIndex + 1} من {questions.length}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {progressPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#3b4cb8] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Flag Button */}
            <button
              type="button"
              onClick={() => onToggleFlag(currentQ.id)}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1 rounded-lg transition-colors cursor-pointer border ${
                flags[currentQ.id]
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${flags[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{flags[currentQ.id] ? 'تم التمييز للمراجعة' : 'تمييز السؤال'}</span>
            </button>
          </div>

          {/* Question Selector Palette (Grid) */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                <ListOrdered className="w-3.5 h-3.5 text-slate-400" />
                <span>قائمة الأسئلة</span>
              </div>
              <span className="text-[10px] text-[#3b4cb8] font-semibold">
                {answeredCount}/{questions.length} مجاب
              </span>
            </div>

            {/* Questions Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-1.5 pr-0.5 content-start">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                const isFlagged = flags[q.id];

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative cursor-pointer ${
                      isCurrent
                        ? 'bg-[#3b4cb8] text-white ring-2 ring-[#3b4cb8]/30 shadow-xs font-black'
                        : isAnswered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 font-bold'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-1.5 mt-1.5 border-t border-slate-200 flex items-center justify-around text-[9px] text-slate-500 shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>مجاب</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>مميز</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span>متبقي</span>
              </div>
            </div>

            {/* التالي والسابق تحت قائمة الأسئلة: السابق يمين والتالي يسار */}
            <div className="pt-2.5 mt-2 border-t border-slate-200 flex items-center gap-2 shrink-0">
              {/* السابق (يمين) */}
              <button
                type="button"
                disabled={isFirstQuestion}
                onClick={handlePrev}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isFirstQuestion
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>

              {/* التالي (يسار) */}
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <span>إنهاء</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-[#3b4cb8] hover:bg-[#312e81] text-white shadow-sm transition-all cursor-pointer"
                >
                  <span>التالي</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </aside>

      </div>

      {/* Time Expired Modal */}
      {timeExpiredModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-md p-6 text-center shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-200">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">انتهى وقت الاختبار المحدد!</h3>
            <p className="text-xs text-slate-500 mb-4">
              تم استنفاد وقت الاختبار المحدد. جاري تسليم إجاباتك وعرض النتيجة والتحليل المفصل الآن...
            </p>
            <div className="w-6 h-6 border-2 border-[#3b4cb8] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}

      {/* Confirmation Finish Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
            
            <div className="w-12 h-12 rounded-2xl bg-[#eef2ff] text-[#3b4cb8] flex items-center justify-center mx-auto mb-4 border border-[#c7d2fe]">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              تأكيد إنهاء الاختبار
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 text-center mb-6 leading-relaxed">
              هل أنت متأكد من رغبتك في تسليم الاختبار الآن وعرض النتيجة والتحليل المفصل؟
            </p>

            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 mb-6 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي الأسئلة:</span>
                <span className="font-bold text-slate-900">{questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>الأسئلة المجابة:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>الأسئلة المتبقية بدون إجابة:</span>
                <span className="font-bold">{questions.length - answeredCount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الوقت المستغرق:</span>
                <span className="font-mono text-[#3b4cb8] font-bold">{formatTime(secondsElapsed)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                العودة للمتابعة
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  onFinishQuiz(secondsElapsed);
                }}
                className="flex-1 px-4 py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                تأكيد وتسليم النتيجة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Return to Edit / Review page button (bottom-right) - Only for Teacher */}
      {userRole === 'teacher' && (
        <button
          type="button"
          onClick={onBackToReview}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-[#3b4cb8] rounded-full border border-[#e2e8f0] shadow-md hover:shadow-lg transition-all cursor-pointer font-bold text-xs sm:text-sm group"
          title="الرجوع لصفحة التعديل والمراجعة"
        >
          <ArrowRight className="w-4 h-4 text-[#3b4cb8] group-hover:-translate-x-0.5 transition-transform" />
          <span>الرجوع لصفحة التعديل</span>
        </button>
      )}

    </div>
  );
};

