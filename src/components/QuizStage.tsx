import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Question, StudentAnswers, StudentScratchpads, StudentFlags, OPTION_LABELS, ExamSettings, UserRole } from '../types/quiz';
import { 
  ArrowLeft, ArrowRight, Bookmark, CheckCircle2, 
  Clock, Edit3, Trash2, Check, Lightbulb,
  Eraser, PenTool, Undo2, GripVertical, ListOrdered, Sparkles, RotateCcw,
  ChevronUp, ChevronDown, Plus, X, Sun, Moon
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
  theme?: 'light' | 'dark';
  onToggleTheme?: (theme: 'light' | 'dark') => void;
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
  theme = 'light',
  onToggleTheme,
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

  // Mobile responsive views
  const [mobileTab, setMobileTab] = useState<'question' | 'scratchpad'>('question');
  const [showPaletteModal, setShowPaletteModal] = useState<boolean>(false);

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

  // Resizable split state for Question Text vs Image (horizontal drag)
  const [questionTextPercent, setQuestionTextPercent] = useState<number>(50);
  const [isDraggingQuestionSplitter, setIsDraggingQuestionSplitter] = useState<boolean>(false);
  const questionSplitContainerRef = useRef<HTMLDivElement | null>(null);

  // Vertical resize & collapse state for Question Box
  const [questionHeight, setQuestionHeight] = useState<number | null>(null);
  const [isQuestionCollapsed, setIsQuestionCollapsed] = useState<boolean>(false);
  const [isDraggingQuestionHeight, setIsDraggingQuestionHeight] = useState<boolean>(false);
  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const hasDraggedQuestionHeightRef = useRef<boolean>(false);

  // Dragging event listeners for split between Question Text and Image
  useEffect(() => {
    if (!isDraggingQuestionSplitter) return;

    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (questionSplitContainerRef.current) {
        const rect = questionSplitContainerRef.current.getBoundingClientRect();
        // In RTL: question text is on the right side
        const distFromRight = rect.right - e.clientX;
        const pct = Math.min(Math.max((distFromRight / rect.width) * 100, 0), 100);
        setQuestionTextPercent(Math.round(pct));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      if (questionSplitContainerRef.current) {
        const rect = questionSplitContainerRef.current.getBoundingClientRect();
        const distFromRight = rect.right - e.touches[0].clientX;
        const pct = Math.min(Math.max((distFromRight / rect.width) * 100, 0), 100);
        setQuestionTextPercent(Math.round(pct));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingQuestionSplitter(false);
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
  }, [isDraggingQuestionSplitter]);

  const handleQuestionSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingQuestionSplitter(true);
  };

  const handleQuestionSplitterTouchStart = () => {
    setIsDraggingQuestionSplitter(true);
  };

  // Dragging event listeners for vertical Question Box resizing & collapse
  useEffect(() => {
    if (!isDraggingQuestionHeight) return;

    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartYRef.current;
      if (Math.abs(deltaY) > 4) {
        hasDraggedQuestionHeightRef.current = true;
      }
      const newHeight = startHeightRef.current + deltaY;
      if (newHeight < 35) {
        // Dragged all the way up: collapse question
        setIsQuestionCollapsed(true);
        setQuestionHeight(0);
      } else {
        setIsQuestionCollapsed(false);
        setQuestionHeight(Math.min(Math.max(newHeight, 50), 450));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const deltaY = e.touches[0].clientY - dragStartYRef.current;
      if (Math.abs(deltaY) > 4) {
        hasDraggedQuestionHeightRef.current = true;
      }
      const newHeight = startHeightRef.current + deltaY;
      if (newHeight < 35) {
        setIsQuestionCollapsed(true);
        setQuestionHeight(0);
      } else {
        setIsQuestionCollapsed(false);
        setQuestionHeight(Math.min(Math.max(newHeight, 50), 450));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingQuestionHeight(false);
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
  }, [isDraggingQuestionHeight]);

  const handleStartDragQuestionHeight = (clientY: number) => {
    dragStartYRef.current = clientY;
    hasDraggedQuestionHeightRef.current = false;
    if (questionCardRef.current && !isQuestionCollapsed) {
      startHeightRef.current = questionCardRef.current.getBoundingClientRect().height;
    } else {
      startHeightRef.current = 0;
    }
    setIsDraggingQuestionHeight(true);
  };

  const handleToggleQuestionCollapse = () => {
    if (hasDraggedQuestionHeightRef.current) return;
    if (isQuestionCollapsed) {
      setIsQuestionCollapsed(false);
      if (!questionHeight || questionHeight < 50) {
        setQuestionHeight(null);
      }
    } else {
      setIsQuestionCollapsed(true);
    }
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

  // Reset hint state, mobile tab, and uncollapse on question change
  useEffect(() => {
    setShowHint(false);
    setMobileTab('question');
    setIsQuestionCollapsed(false);
    if (questionHeight !== null && questionHeight < 50) {
      setQuestionHeight(null);
    }
    setQuestionTextPercent(50);
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

    // 5. Reset question/media split to 50/50
    setQuestionTextPercent(50);
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
    <div className="h-full w-full max-h-[100dvh] flex flex-col p-2 sm:p-3 overflow-hidden select-none" dir="rtl">
      
      {/* Two-Column App Layout: Right/Center = Quiz Area, Left = Vertical Status & Palette */}
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* Right / Main Quiz Area */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          
          {/* Mobile Tab Switcher: [السؤال والخيارات] | [مسودة الرسم ✍️] */}
          <div className="flex md:hidden items-center bg-[#f1f5f9] dark:bg-[#1c1f2a] p-1 rounded-xl mb-2 border border-slate-200 dark:border-[#313540] text-xs shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab('question')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mobileTab === 'question'
                  ? 'bg-white dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-[#c7c4d7]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>السؤال والخيارات</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('scratchpad')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                mobileTab === 'scratchpad'
                  ? 'bg-white dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-[#c7c4d7]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>مسودة الرسم</span>
              {undoStack[currentQ.id]?.length ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] dark:bg-[#c0c1ff] animate-pulse"></span>
              ) : null}
            </button>

            {/* Mobile Timer Badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-mono font-bold shrink-0 ${
              isTimeCritical
                ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 animate-pulse'
                : 'bg-white dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] border-slate-200 dark:border-[#313540]'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{formatTime(hasTimeLimit ? remainingSeconds : secondsElapsed)}</span>
            </div>

            {/* Mobile Theme Toggle Button */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={() => onToggleTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-1 rounded-lg bg-white dark:bg-[#262a35] border border-slate-200 dark:border-[#313540] text-slate-700 dark:text-[#dfe2f1] shrink-0 cursor-pointer shadow-2xs"
                title={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الساطع'}
              >
                {theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
            )}
          </div>

          {/* Compact Question Card (Hidden on mobile if scratchpad tab is active, or if collapsed) */}
          {!isQuestionCollapsed && (
            <div 
              className={`relative mb-2 shrink-0 ${
                mobileTab === 'scratchpad' ? 'hidden md:block' : 'block'
              }`}
            >
              {/* Question Card */}
              <div 
                ref={questionCardRef}
                style={questionHeight !== null ? { height: `${questionHeight}px` } : undefined}
                className="bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-3 sm:p-3.5 shadow-stitch-card overflow-hidden flex flex-col"
              >
                {/* Question Content: If question has image/diagram, show 2-column resizable layout */}
                {Boolean(currentQ.imageUrl || currentQ.diagramSvg) ? (
                  <div 
                    ref={questionSplitContainerRef}
                    className={`relative flex items-stretch min-h-0 w-full overflow-hidden select-none ${
                      questionHeight !== null ? 'flex-1 h-full' : 'h-28 sm:h-32'
                    }`}
                  >
                    {/* Right Side: Question Text & Inline Hint */}
                    <div 
                      style={{ width: `${questionTextPercent}%` }}
                      className="h-full overflow-y-auto pr-1 flex flex-col justify-start shrink-0 min-w-0"
                    >
                      <div className="leading-relaxed">
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#dfe2f1] inline">
                          <MathFormulaRenderer text={currentQ.question} />
                        </h2>

                        {currentQ.hint && currentQ.hint.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowHint(!showHint)}
                            className="inline-flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-300 hover:text-amber-900 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded-full transition-colors cursor-pointer font-medium mr-1.5 align-middle shadow-2xs"
                          >
                            <Lightbulb className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                            <span>{showHint ? 'إخفاء التلميح' : 'تلميح الحل'}</span>
                          </button>
                        )}
                      </div>

                      {showHint && currentQ.hint && (
                        <div className="mt-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-fadeIn">
                          <p className="font-bold flex items-center gap-1 mb-0.5 text-[10px]">
                            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" /> طريقة الحل:
                          </p>
                          <div className="whitespace-pre-line font-sans text-[11px]">
                            <MathFormulaRenderer text={currentQ.hint} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Draggable Splitter Handle between Question & Image */}
                    <div
                      onMouseDown={handleQuestionSplitterMouseDown}
                      onTouchStart={handleQuestionSplitterTouchStart}
                      title="اسحب لتكبير جهة السؤال أو جهة الصورة"
                      className="relative z-10 w-4 -mx-1.5 shrink-0 flex items-center justify-center cursor-col-resize group select-none touch-none"
                    >
                      <div className="w-1.5 h-10 rounded-full bg-slate-300 dark:bg-[#313540] group-hover:bg-[#4f46e5] transition-colors flex items-center justify-center shadow-xs">
                        <span className="text-[7px] text-slate-500 group-hover:text-white font-bold select-none leading-none">‹›</span>
                      </div>
                    </div>

                    {/* Left Side: Image or Diagram */}
                    <div 
                      style={{ width: `${100 - questionTextPercent}%` }}
                      className="h-full flex items-center justify-center p-1 bg-[#f8fafc] dark:bg-[#1c1f2a] rounded-xl border border-slate-200 dark:border-[#313540] overflow-hidden shrink-0 min-w-0"
                    >
                      {currentQ.imageUrl ? (
                        <img 
                          src={currentQ.imageUrl} 
                          alt="رسمة السؤال التوضيحية" 
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : currentQ.diagramSvg ? (
                        <div 
                          className="max-h-full max-w-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: currentQ.diagramSvg }}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  /* No media: Normal full width text with inline hint */
                  <div className={`overflow-y-auto ${questionHeight !== null ? 'flex-1 min-h-0' : ''}`}>
                    <div className="leading-relaxed">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#dfe2f1] inline">
                        <MathFormulaRenderer text={currentQ.question} />
                      </h2>

                      {currentQ.hint && currentQ.hint.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowHint(!showHint)}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300 hover:text-amber-900 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/80 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer font-medium mr-2 align-middle shadow-2xs"
                        >
                          <Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{showHint ? 'إخفاء التلميح' : 'تلميح الحل'}</span>
                        </button>
                      )}
                    </div>

                    {showHint && currentQ.hint && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-fadeIn">
                        <p className="font-bold flex items-center gap-1 mb-0.5 text-[11px]">
                          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" /> طريقة الحل المقترحة:
                        </p>
                        <div className="whitespace-pre-line font-sans text-xs">
                          <MathFormulaRenderer text={currentQ.hint} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Connected Bottom Drag Handle Line sitting right on the bottom border (as in blue drawing) */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleStartDragQuestionHeight(e.clientY);
                }}
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    handleStartDragQuestionHeight(e.touches[0].clientY);
                  }
                }}
                onClick={handleToggleQuestionCollapse}
                title="اسحب لتعديل ارتفاع السؤال أو انقر للإخفاء"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center cursor-row-resize py-0.5 px-4 group select-none"
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-[#313540] group-hover:bg-[#4f46e5] transition-colors shadow-2xs" />
              </div>
            </div>
          )}

          {/* When collapsed: Thin bar at top with just the line so user can pull it back */}
          {isQuestionCollapsed && (
            <div
              className={`w-full flex items-center justify-center mb-2 shrink-0 select-none ${
                mobileTab === 'scratchpad' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div
                onClick={handleToggleQuestionCollapse}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleStartDragQuestionHeight(e.clientY);
                }}
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    handleStartDragQuestionHeight(e.touches[0].clientY);
                  }
                }}
                title="اسحب لأسفل أو انقر لإظهار السؤال"
                className="w-full max-w-[120px] py-1 bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-full shadow-2xs hover:border-[#4f46e5] flex items-center justify-center cursor-row-resize group transition-all"
              >
                <div className="w-10 h-1.5 rounded-full bg-[#4f46e5] group-hover:bg-indigo-500 transition-colors" />
              </div>
            </div>
          )}

          {/* Split Row: Separate Answers Box & Notes Box with Width Dragging */}
          <div 
            ref={splitContainerRef}
            className="flex-1 min-h-0 flex gap-2.5 items-stretch relative overflow-hidden"
          >
            {/* 1. Answers Box (Full width on mobile, resizable on desktop) */}
            <div
              style={{
                width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${optionsWidthPercent}%`
              }}
              className={`bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-3 sm:p-3.5 shadow-stitch-card flex flex-col h-fit max-h-full shrink-0 relative overflow-hidden ${
                mobileTab === 'question' ? 'w-full flex' : 'hidden md:flex'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#262a35] shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-[#eef2ff] dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] flex items-center justify-center font-bold text-[10px]">
                    ✓
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-[#dfe2f1] text-xs">خيارات الإجابة</h3>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-[#908fa0]">حدد إجابة</span>
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
                      className={`w-full text-right p-2.5 sm:p-3 rounded-xl border transition-all flex items-center gap-2 group cursor-pointer ${
                        isSelected
                          ? 'bg-[#eef2ff] dark:bg-[#4f46e5]/15 border-[#4f46e5] dark:border-[#6366f1] shadow-xs ring-2 ring-[#4f46e5]/20 dark:ring-[#6366f1]/20 text-[#4f46e5] dark:text-[#c0c1ff] font-bold'
                          : 'bg-[#f8fafc] dark:bg-[#1c1f2a] hover:bg-white dark:hover:bg-[#262a35] border-slate-200 dark:border-[#313540] hover:border-slate-300 dark:hover:border-[#6366f1]/40 text-slate-800 dark:text-[#dfe2f1]'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#4f46e5] text-white shadow-xs'
                          : 'bg-white dark:bg-[#262a35] text-slate-600 dark:text-[#c7c4d7] border border-slate-200 dark:border-[#313540] group-hover:border-[#4f46e5]'
                      }`}>
                        {label}
                      </span>

                      <span className="text-xs sm:text-sm flex-1 font-medium leading-relaxed">
                        <MathFormulaRenderer text={optText} />
                      </span>

                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                          : 'border-slate-300 dark:border-[#313540] bg-white dark:bg-[#262a35] group-hover:border-slate-400'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}

                {/* Quick switch to Scratchpad on mobile */}
                <button
                  type="button"
                  onClick={() => setMobileTab('scratchpad')}
                  className="md:hidden mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-[#4f46e5] dark:text-[#c0c1ff] bg-[#eef2ff] dark:bg-[#262a35] border border-indigo-200 dark:border-[#313540] hover:bg-indigo-100 dark:hover:bg-[#313540] transition-colors shadow-2xs"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>فتح مسودة الرسم والحل الرياضي ✍️</span>
                </button>
              </div>

              {/* Drag Handle on Answers Box */}
              <div
                onMouseDown={handleSplitterMouseDown}
                onTouchStart={handleSplitterTouchStart}
                title="اسحب لتكبير أو تصغير عرض مربع الخيارات"
                className="hidden md:flex absolute left-0 top-0 bottom-0 w-3 hover:w-4 bg-transparent hover:bg-indigo-500/10 cursor-col-resize items-center justify-center group z-10"
              >
                <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-[#4f46e5] transition-colors flex items-center justify-center">
                  <span className="text-[8px] text-slate-400 group-hover:text-white font-bold select-none">›</span>
                </div>
              </div>
            </div>

            {/* 2. Notes Box (Full width on mobile, resizable on desktop) */}
            <div
              style={{
                width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `calc(${100 - optionsWidthPercent}% - 10px)`
              }}
              className={`bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-2.5 sm:p-3 shadow-stitch-card flex flex-col flex-1 h-full min-h-0 relative overflow-hidden ${
                mobileTab === 'scratchpad' ? 'w-full flex' : 'hidden md:flex'
              }`}
            >
              {/* Drawing Toolbar - Compact and unified on right */}
              <div className="mb-2 p-1 bg-[#f8fafc] dark:bg-[#1c1f2a] rounded-xl border border-slate-200 dark:border-[#313540] flex items-center gap-1.5 text-xs shrink-0 overflow-x-auto">
                {/* 1. Pen / Eraser tool switch */}
                <div className="flex items-center gap-1 bg-white dark:bg-[#262a35] p-0.5 rounded-lg border border-slate-200 dark:border-[#313540] shrink-0">
                  <button
                    type="button"
                    onClick={() => setDrawTool('pen')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      drawTool === 'pen'
                        ? 'bg-[#4f46e5] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-[#c7c4d7]'
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
                        : 'text-slate-500 hover:text-slate-800 dark:text-[#c7c4d7]'
                    }`}
                    title="ممحاة"
                  >
                    <Eraser className="w-3 h-3" />
                    <span className="text-[10px]">ممحاة</span>
                  </button>
                </div>

                {/* 2. Colors */}
                {drawTool === 'pen' && (
                  <div className="flex items-center gap-2 px-1 shrink-0">
                    {[
                      { color: '#6366f1', name: 'نيلي' },
                      { color: '#10b981', name: 'أخضر' },
                      { color: '#f59e0b', name: 'برتقالي' },
                      { color: '#ef4444', name: 'أحمر' }
                    ].map((item) => (
                      <button
                        key={item.color}
                        type="button"
                        onClick={() => setPenColor(item.color)}
                        className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                          penColor === item.color
                            ? 'scale-110 ring-2 ring-offset-1 ring-[#4f46e5] dark:ring-[#c0c1ff] shadow-xs'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: item.color }}
                        title={item.name}
                      />
                    ))}
                  </div>
                )}

                {/* Divider between tools and actions */}
                <div className="h-4 w-px bg-slate-200 dark:bg-[#313540] mx-0.5 shrink-0" />

                {/* 3. Undo and Clear buttons grouped on the right beside tools (Icons only) */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-[#c7c4d7] dark:hover:text-[#dfe2f1] hover:bg-slate-100 dark:hover:bg-[#262a35] rounded-lg transition-colors cursor-pointer"
                    title="تراجع"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                    title="مسح اللوحة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick switch to question on mobile */}
                <button
                  type="button"
                  onClick={() => setMobileTab('question')}
                  className="md:hidden mr-auto flex items-center gap-1 text-[10px] font-bold text-[#4f46e5] dark:text-[#c0c1ff] bg-[#eef2ff] dark:bg-[#262a35] px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-[#313540] shrink-0"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>الخيارات</span>
                </button>
              </div>

              {/* Scrollable Canvas Viewport */}
              <div 
                ref={canvasContainerRef}
                onScroll={(e) => setScrollPos(e.currentTarget.scrollTop)}
                className="relative flex-1 min-h-0 bg-white dark:bg-[#0f131d] border border-slate-200 dark:border-[#262a35] rounded-xl overflow-y-auto overflow-x-hidden scroll-smooth"
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
                  
                  {/* Floating return-to-top button when scrolled down */}
                  {scrollPos > 120 && (
                    <button
                      type="button"
                      onClick={handleScrollTop}
                      className="sticky bottom-3 left-3 float-left ml-3 mb-3 z-20 flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#4f46e5] dark:text-[#c0c1ff] bg-white/95 dark:bg-[#171b26]/95 backdrop-blur-xs border border-indigo-200 dark:border-[#313540] rounded-full shadow-md hover:bg-indigo-50 dark:hover:bg-[#262a35] transition-all cursor-pointer"
                      title="العودة لأعلى المسودة"
                    >
                      <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>العودة للأعلى</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Drag Handle on Notes Box */}
              <div
                onMouseDown={handleSplitterMouseDown}
                onTouchStart={handleSplitterTouchStart}
                title="اسحب لتكبير أو تصغير عرض مربع النوتات"
                className="hidden md:flex absolute right-0 top-0 bottom-0 w-3 hover:w-4 bg-transparent hover:bg-indigo-500/10 cursor-col-resize items-center justify-center group z-10"
              >
                <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-[#3b4cb8] transition-colors flex items-center justify-center">
                  <span className="text-[8px] text-slate-400 group-hover:text-white font-bold select-none">‹</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Left Side: Vertical Status & Question Palette (Desktop Only) */}
        <aside className="hidden md:flex w-60 sm:w-68 shrink-0 h-full flex-col bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-3 shadow-stitch-card overflow-hidden">
          {/* Theme Toggle Pill (النمط الساطع والداكن) */}
          {onToggleTheme && (
            <div className="flex items-center justify-between bg-[#f8fafc] dark:bg-[#1c1f2a] p-1 rounded-xl border border-slate-200 dark:border-[#313540] mb-2 shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => onToggleTheme('light')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-700 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-500 dark:text-[#c7c4d7] hover:text-slate-800 dark:hover:text-white'
                }`}
                title="نمط ساطع"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>نمط ساطع</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#4f46e5] text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-[#c7c4d7] hover:text-slate-800 dark:hover:text-white'
                }`}
                title="نمط داكن"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-200" />
                <span>نمط داكن</span>
              </button>
            </div>
          )}

          {/* Timer Card */}
          <div className="bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl p-2.5 mb-2 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#c7c4d7]">
                <Clock className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-red-500 animate-pulse' : 'text-[#4f46e5] dark:text-[#c0c1ff]'}`} />
                <span>{hasTimeLimit ? 'الوقت المتبقي:' : 'الوقت:'}</span>
              </div>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border transition-colors ${
                isTimeCritical
                  ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 animate-pulse'
                  : 'bg-white dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] border-slate-200 dark:border-[#313540] shadow-xs'
              }`}>
                {formatTime(hasTimeLimit ? remainingSeconds : secondsElapsed)}
              </span>
            </div>

            {/* Attempt badge if applicable */}
            {Boolean(attemptNumber > 1 || ((settings?.maxAttempts ?? 0) > 0)) && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-[#c7c4d7] pt-1 border-t border-slate-200 dark:border-[#313540]">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-[#4f46e5] dark:text-[#c0c1ff]" /> المحاولة:
                </span>
                <span className="font-bold text-[#4f46e5] dark:text-[#c0c1ff]">
                  {attemptNumber} {settings?.maxAttempts && settings.maxAttempts > 0 ? `من ${settings.maxAttempts}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Question Status Card */}
          <div className="bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl p-2.5 mb-2 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-[#dfe2f1]">
                السؤال {currentIndex + 1} من {questions.length}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#c7c4d7] font-semibold">
                {progressPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-[#313540] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#4f46e5] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Flag Button */}
            <button
              type="button"
              onClick={() => onToggleFlag(currentQ.id)}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1 rounded-lg transition-colors cursor-pointer border ${
                flags[currentQ.id]
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-xs'
                  : 'bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-600 dark:text-[#c7c4d7] border-slate-200 dark:border-[#313540]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${flags[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{flags[currentQ.id] ? 'تم التمييز للمراجعة' : 'تمييز السؤال'}</span>
            </button>
          </div>

          {/* Question Selector Palette (Grid) */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl p-2.5 overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 dark:border-[#313540] shrink-0">
              <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-[#dfe2f1]">
                <ListOrdered className="w-3.5 h-3.5 text-slate-400 dark:text-[#908fa0]" />
                <span>قائمة الأسئلة</span>
              </div>
              <span className="text-[10px] text-[#4f46e5] dark:text-[#c0c1ff] font-semibold">
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
                        ? 'bg-[#4f46e5] text-white ring-2 ring-[#4f46e5]/30 shadow-[0_0_12px_rgba(192,193,255,0.25)] font-black'
                        : isAnswered
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 font-bold'
                        : 'bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-600 dark:text-[#dfe2f1] border border-slate-200 dark:border-[#313540]'
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
            <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-[#313540] flex items-center justify-around text-[9px] text-slate-500 dark:text-[#c7c4d7] shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>مجاب</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>مميز</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-[#313540]"></span>
                <span>متبقي</span>
              </div>
            </div>

            {/* التالي والسابق تحت قائمة الأسئلة */}
            <div className="pt-2.5 mt-2 border-t border-slate-200 dark:border-[#313540] flex items-center gap-2 shrink-0">
              {/* السابق (يمين) */}
              <button
                type="button"
                disabled={isFirstQuestion}
                onClick={handlePrev}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isFirstQuestion
                    ? 'border-slate-200 dark:border-[#313540] text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-[#171b26]'
                    : 'border-slate-200 dark:border-[#313540] bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] shadow-xs'
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
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-[0_0_12px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
                >
                  <span>التالي</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </aside>

      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <div className="md:hidden mt-2 p-2 bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl shadow-stitch-card flex items-center justify-between gap-2 shrink-0 z-20">
        {/* Previous */}
        <button
          type="button"
          disabled={isFirstQuestion}
          onClick={handlePrev}
          className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            isFirstQuestion
              ? 'border-slate-200 dark:border-[#313540] text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-[#171b26] cursor-not-allowed'
              : 'border-slate-200 dark:border-[#313540] bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] shadow-2xs'
          }`}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>السابق</span>
        </button>

        {/* Flag Button */}
        <button
          type="button"
          onClick={() => onToggleFlag(currentQ.id)}
          className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
            flags[currentQ.id]
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-xs'
              : 'bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-600 dark:text-[#c7c4d7] border-slate-200 dark:border-[#313540]'
          }`}
          title={flags[currentQ.id] ? 'تم التمييز' : 'تمييز السؤال'}
        >
          <Bookmark className={`w-4 h-4 ${flags[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
        </button>

        {/* Question Palette Trigger Modal */}
        <button
          type="button"
          onClick={() => setShowPaletteModal(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold bg-[#f1f5f9] dark:bg-[#262a35] hover:bg-indigo-50 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] border border-slate-200 dark:border-[#313540] transition-colors shadow-2xs cursor-pointer"
        >
          <ListOrdered className="w-3.5 h-3.5 text-[#4f46e5] dark:text-[#c0c1ff]" />
          <span>الأسئلة ({currentIndex + 1}/{questions.length})</span>
        </button>

        {/* Next / Finish */}
        {isLastQuestion ? (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center justify-center gap-1 py-2 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <span>إنهاء</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center justify-center gap-1 py-2 px-3.5 rounded-xl text-xs font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-[0_0_12px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
          >
            <span>التالي</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mobile Question Palette Modal / Bottom Sheet */}
      {showPaletteModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-fadeIn"
          onClick={() => setShowPaletteModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#171b26] border border-slate-200 dark:border-[#262a35] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#262a35] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#eef2ff] dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] flex items-center justify-center">
                  <ListOrdered className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-[#dfe2f1]">قائمة الأسئلة</h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#c7c4d7]">
                    تمت الإجابة على {answeredCount} من أصل {questions.length} سؤال
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaletteModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#262a35] text-slate-500 hover:text-slate-900 dark:text-[#c7c4d7] dark:hover:text-[#dfe2f1] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Theme Toggle Pill inside palette */}
            {onToggleTheme && (
              <div className="flex items-center justify-between bg-[#f8fafc] dark:bg-[#1c1f2a] p-1 rounded-xl border border-slate-200 dark:border-[#313540] my-2 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onToggleTheme('light')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white text-amber-700 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-500 dark:text-[#c7c4d7]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>نمط ساطع</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTheme('dark')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[#4f46e5] text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-[#c7c4d7]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-200" />
                  <span>نمط داكن</span>
                </button>
              </div>
            )}

            {/* Progress bar */}
            <div className="py-2.5 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#c7c4d7] mb-1">
                <span>التقدم في الاختبار</span>
                <span className="font-bold font-mono text-[#4f46e5] dark:text-[#c0c1ff]">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#313540] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#4f46e5] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Questions Grid */}
            <div className="flex-1 overflow-y-auto py-2 grid grid-cols-5 sm:grid-cols-6 gap-2 content-start">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                const isFlagged = flags[q.id];

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobileTab('question');
                      setShowPaletteModal(false);
                    }}
                    className={`h-11 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                      isCurrent
                        ? 'bg-[#4f46e5] text-white ring-2 ring-[#4f46e5]/40 shadow-[0_0_12px_rgba(192,193,255,0.25)] font-black scale-105'
                        : isAnswered
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold'
                        : 'bg-[#f8fafc] dark:bg-[#1c1f2a] hover:bg-white dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] border border-slate-200 dark:border-[#313540]'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend & Close Button */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#262a35] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-[#c7c4d7]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>مجاب ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>مميز ({Object.values(flags).filter(Boolean).length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-[#313540]"></span>
                  <span>متبقي ({questions.length - answeredCount})</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPaletteModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#262a35] hover:bg-slate-200 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Expired Modal */}
      {timeExpiredModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl w-full max-w-md p-6 text-center shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 border border-red-200 dark:border-red-900">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#dfe2f1] mb-2">انتهى وقت الاختبار المحدد!</h3>
            <p className="text-xs text-slate-500 dark:text-[#c7c4d7] mb-4">
              تم استنفاد وقت الاختبار المحدد. جاري تسليم إجاباتك وعرض النتيجة والتحليل المفصل الآن...
            </p>
            <div className="w-6 h-6 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}

      {/* Confirmation Finish Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fadeIn">
            
            <div className="w-12 h-12 rounded-2xl bg-[#eef2ff] dark:bg-[#262a35] text-[#4f46e5] dark:text-[#c0c1ff] flex items-center justify-center mx-auto mb-4 border border-[#c7d2fe] dark:border-[#313540]">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-[#dfe2f1] text-center mb-2">
              تأكيد إنهاء الاختبار
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#c7c4d7] text-center mb-6 leading-relaxed">
              هل أنت متأكد من رغبتك في تسليم الاختبار الآن وعرض النتيجة والتحليل المفصل؟
            </p>

            <div className="bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl p-4 mb-6 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-[#c7c4d7]">
                <span>إجمالي الأسئلة:</span>
                <span className="font-bold text-slate-900 dark:text-[#dfe2f1]">{questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>الأسئلة المجابة:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>الأسئلة المتبقية بدون إجابة:</span>
                <span className="font-bold">{questions.length - answeredCount}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[#c7c4d7]">
                <span>الوقت المستغرق:</span>
                <span className="font-mono text-[#4f46e5] dark:text-[#c0c1ff] font-bold">{formatTime(secondsElapsed)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#262a35] hover:bg-slate-50 dark:hover:bg-[#313540] text-slate-700 dark:text-[#dfe2f1] text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-[#313540] transition-colors cursor-pointer"
              >
                العودة للمتابعة
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  onFinishQuiz(secondsElapsed);
                }}
                className="flex-1 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_14px_rgba(192,193,255,0.25)] transition-all cursor-pointer"
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
          className="fixed bottom-16 md:bottom-5 right-4 md:right-5 z-30 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/95 dark:bg-[#171b26]/95 hover:bg-white dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] hover:text-[#4f46e5] dark:hover:text-[#c0c1ff] rounded-full border border-[#e2e8f0] dark:border-[#262a35] shadow-md hover:shadow-[0_0_16px_rgba(192,193,255,0.2)] transition-all cursor-pointer font-bold text-xs sm:text-sm group"
          title="الرجوع لصفحة التعديل والمراجعة"
        >
          <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#4f46e5] dark:text-[#c0c1ff] group-hover:-translate-x-0.5 transition-transform" />
          <span>الرجوع للتعديل</span>
        </button>
      )}

    </div>
  );
};

