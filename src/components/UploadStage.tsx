import React, { useState, useRef } from 'react';
import { Question } from '../types/quiz';
import { 
  extractTextFromPDF, parseExamText, parseJSONExam, parseCSVExam,
  readFileAsDataURL, renderPDFPageToImage, scanExamWithAI, extractTextWithLocalOCR,
  getPDFPageCount, analyzePDFDocument
} from '../utils/fileParsers';
import { 
  Upload, FileText, FileSpreadsheet, FileCode, CheckCircle2, 
  AlertTriangle, Sparkles, Loader2, ArrowLeft, HelpCircle, Layers,
  Calculator, BookOpen, RotateCcw, Image, Scan, RefreshCw, Cpu, Check
} from 'lucide-react';
import { fixReversedArabicText } from '../utils/arabicUtils';

interface UploadStageProps {
  onExamLoaded: (
    questions: Question[], 
    rawText: string, 
    title: string, 
    fallbackTriggered: boolean,
    sourceImage?: string,
    sourceImages?: string[]
  ) => void;
}

export const UploadStage: React.FC<UploadStageProps> = ({ onExamLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [is503Error, setIs503Error] = useState(false);
  const [cachedImageForRetry, setCachedImageForRetry] = useState<{ dataUrl: string; name: string } | null>(null);
  const [cachedPagesForRetry, setCachedPagesForRetry] = useState<{ images: string[]; name: string } | null>(null);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [manualTitle, setManualTitle] = useState('اختبار يدوي');
  const [forceReverseArabic, setForceReverseArabic] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processUploadedFiles(Array.from(files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFiles(Array.from(files));
    }
  };

  const processUploadedFiles = async (files: File[]) => {
    setErrorMessage(null);
    setIs503Error(false);
    setIsLoading(true);
    setProgressPercent(null);

    try {
      const firstFile = files[0];
      const extension = firstFile.name.split('.').pop()?.toLowerCase();

      // CASE A: PDF File (Single or Multi-Page)
      if (extension === 'pdf') {
        setLoadingMessage('جاري فحص ملف الـ PDF وحساب عدد الصفحات...');
        let totalPages = 1;
        try {
          totalPages = await getPDFPageCount(firstFile);
        } catch {
          totalPages = 1;
        }

        // Check if PDF has genuine digital text across all pages
        let pdfAnalysis = { fullText: '', numPages: totalPages, allPagesHaveDigitalText: false, pageCharCounts: [] as number[] };
        try {
          pdfAnalysis = await analyzePDFDocument(firstFile, (percent) => {
            setProgressPercent(Math.round(percent * 0.25));
            setLoadingMessage(`جاري فحص صفحات الـ PDF (${percent}%)...`);
          });
        } catch (e) {
          console.warn('Text layer analysis failed:', e);
        }

        // If ALL pages have substantial selectable text (e.g. pure Word/PDF export)
        if (pdfAnalysis.allPagesHaveDigitalText && pdfAnalysis.fullText.trim().length > 100) {
          setLoadingMessage('جاري تحليل الأسئلة النصية وهيكلة الخيارات...');
          let textToParse = pdfAnalysis.fullText;
          if (forceReverseArabic) {
            textToParse = fixReversedArabicText(textToParse);
          }

          const parseRes = parseExamText(textToParse, firstFile.name);
          // Only accept text parsing if it found sufficient questions covering the pages
          if (parseRes.questions.length >= Math.max(1, totalPages)) {
            const title = firstFile.name.replace(/\.[^/.]+$/, '');
            onExamLoaded(parseRes.questions, parseRes.rawText, title, parseRes.fallbackTriggered);
            return;
          }
        }

        // Scanned or Hybrid PDF: Run high-precision AI Vision OCR for ALL pages (Page 1 AND Page 2...)
        setLoadingMessage(`جاري المسح الضوئي الذكي لكافة صفحات الاختبار (${totalPages} ${totalPages > 1 ? 'صفحات' : 'صفحة'})...`);
        
        const allQuestions: Question[] = [];
        const allRawTexts: string[] = [];
        const allPageImages: string[] = [];

        let lastScanError = '';
        for (let p = 1; p <= totalPages; p++) {
          setProgressPercent(Math.round(((p - 0.5) / totalPages) * 100));
          setLoadingMessage(`جاري قراءة واستخراج الصفحة (${p} من ${totalPages}) بالمسح الذكي المتقدم...`);

          const pageImg = await renderPDFPageToImage(firstFile, p);
          allPageImages.push(pageImg);

          if (p === 1) {
            setCachedImageForRetry({ dataUrl: pageImg, name: `${firstFile.name} (صفحة ${p})` });
          }

          try {
            // scanExamWithAI has 3 built-in retries with backoff for cloud busy states (503)
            const pageRes = await scanExamWithAI(pageImg, 'image/jpeg', `${firstFile.name} - صفحة ${p}`, 3);
            
            // Re-index questions to ensure unique IDs and clean numbering continuity
            const reindexed = pageRes.questions.map((q, idx) => ({
              ...q,
              id: `q-p${p}-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
            }));

            allQuestions.push(...reindexed);
            if (pageRes.rawText) {
              allRawTexts.push(`--- أسئلة الصفحة ${p} ---\n${pageRes.rawText}`);
            }
          } catch (pageErr: any) {
            console.warn(`Page ${p} scan error:`, pageErr);
            lastScanError = pageErr?.message || '';
            // If previous page(s) succeeded, do not abort; record notice
            allRawTexts.push(`--- تعذر قراءة بعض أسئلة الصفحة ${p} آلياً ---`);
          }

          // Gentle cooldown between pages to respect API limits
          if (p < totalPages) {
            await new Promise(r => setTimeout(r, 900));
          }
        }

        setCachedPagesForRetry({ images: allPageImages, name: firstFile.name });

        if (allQuestions.length === 0) {
          throw new Error(lastScanError || 'لم يتم العثور على أسئلة واضحة في صفحات الملف. يرجى التأكد من وضوح الصفحات أو استخدام خيار اللصق المباشر.');
        }

        const title = firstFile.name.replace(/\.[^/.]+$/, '');
        const combinedRaw = allRawTexts.join('\n\n');
        onExamLoaded(allQuestions, combinedRaw, title, false, allPageImages[0], allPageImages);

      // CASE B: Multiple or Single Image Files (PNG, JPG, JPEG, WEBP)
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension || '')) {
        const imageFiles = files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '');
        });

        const allQuestions: Question[] = [];
        const allRawTexts: string[] = [];
        const allImageUrls: string[] = [];

        for (let i = 0; i < imageFiles.length; i++) {
          const currentImgFile = imageFiles[i];
          const imgIndex = i + 1;
          const totalImgs = imageFiles.length;

          if (totalImgs > 1) {
            setLoadingMessage(`جاري مسح واستخراج الصورة (${imgIndex} من ${totalImgs}) بالذكاء الاصطناعي...`);
            setProgressPercent(Math.round((imgIndex / totalImgs) * 100));
          } else {
            setLoadingMessage('جاري قراءة ورقة الأسئلة المصورة وتحليلها بالمسح الضوئي الذكي (AI Vision OCR)...');
          }

          const dataUrl = await readFileAsDataURL(currentImgFile);
          allImageUrls.push(dataUrl);

          if (i === 0) {
            setCachedImageForRetry({ dataUrl, name: currentImgFile.name });
          }

          const mime = currentImgFile.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
          const pageRes = await scanExamWithAI(dataUrl, mime, currentImgFile.name, 3);

          const reindexed = pageRes.questions.map((q, idx) => ({
            ...q,
            id: `q-img${imgIndex}-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
          }));

          allQuestions.push(...reindexed);
          if (pageRes.rawText) {
            allRawTexts.push(`--- محتوى صورة (${currentImgFile.name}) ---\n${pageRes.rawText}`);
          }

          if (i < imageFiles.length - 1) {
            await new Promise(r => setTimeout(r, 900));
          }
        }

        setCachedPagesForRetry({ images: allImageUrls, name: firstFile.name });

        const title = imageFiles.length === 1 
          ? imageFiles[0].name.replace(/\.[^/.]+$/, '') 
          : `تجميعات مصورة (${imageFiles.length} صفحات)`;

        onExamLoaded(allQuestions, allRawTexts.join('\n\n'), title, allQuestions.length === 0, allImageUrls[0], allImageUrls);

      // CASE C: JSON Files
      } else if (extension === 'json') {
        setLoadingMessage('جاري قراءة ملف JSON وهيكلة الأسئلة...');
        const content = await firstFile.text();
        const parseRes = parseJSONExam(content, firstFile.name);
        const title = firstFile.name.replace(/\.[^/.]+$/, '');
        onExamLoaded(parseRes.questions, parseRes.rawText, title, parseRes.fallbackTriggered);

      // CASE D: CSV Files
      } else if (extension === 'csv') {
        setLoadingMessage('جاري قراءة جدول الأسئلة CSV...');
        const content = await firstFile.text();
        const parseRes = parseCSVExam(content, firstFile.name);
        const title = firstFile.name.replace(/\.[^/.]+$/, '');
        onExamLoaded(parseRes.questions, parseRes.rawText, title, parseRes.fallbackTriggered);

      // CASE E: TXT Files
      } else if (extension === 'txt') {
        setLoadingMessage('جاري تحليل الملف النصي واستخراج الأسئلة...');
        const content = await firstFile.text();
        let textToParse = content;
        if (forceReverseArabic) {
          textToParse = fixReversedArabicText(textToParse);
        }
        const parseRes = parseExamText(textToParse, firstFile.name);
        const title = firstFile.name.replace(/\.[^/.]+$/, '');
        onExamLoaded(parseRes.questions, parseRes.rawText, title, parseRes.fallbackTriggered);

      } else {
        throw new Error('نوع الملف غير مدعوم. يرجى اختيار ملف من نوع (PDF, PNG, JPG, JSON, CSV, TXT).');
      }

    } catch (err: any) {
      console.error('File parsing error:', err);
      const msg = err.message || 'حدث خطأ غير متوقع أثناء معالجة الملف.';
      const is503 = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
      setIs503Error(is503);
      setErrorMessage(
        is503
          ? 'خوادم نموذج الذكاء الاصطناعي تشهد ضغطاً مؤقتاً عالياً (كود 503). تتوفر أدناه حلول بديلة ومباشرة لتخطي هذا الضغط فوراً.'
          : msg
      );
    } finally {
      setIsLoading(false);
      setProgressPercent(null);
    }
  };

  // Option 1: Retry AI with new multi-model chain across all uploaded pages
  const handleRetryAI = async () => {
    const imagesToProcess = cachedPagesForRetry?.images?.length 
      ? cachedPagesForRetry.images 
      : (cachedImageForRetry ? [cachedImageForRetry.dataUrl] : []);
    
    if (imagesToProcess.length === 0) return;

    setErrorMessage(null);
    setIs503Error(false);
    setIsLoading(true);
    setLoadingMessage('جاري إعادة المحاولة والمسح الذكي لكافة صفحات الاختبار...');

    try {
      const allQuestions: Question[] = [];
      const allRawTexts: string[] = [];

      for (let i = 0; i < imagesToProcess.length; i++) {
        const imgUrl = imagesToProcess[i];
        const pageNum = i + 1;
        setLoadingMessage(`جاري إعادة مسح الصفحة (${pageNum} من ${imagesToProcess.length}) بالذكاء الاصطناعي...`);
        setProgressPercent(Math.round(((i + 1) / imagesToProcess.length) * 100));

        const pageRes = await scanExamWithAI(imgUrl, 'image/jpeg', `${cachedPagesForRetry?.name || 'صفحة'}-${pageNum}`, 3);
        const reindexed = pageRes.questions.map((q, idx) => ({
          ...q,
          id: `q-retry-${pageNum}-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        }));
        allQuestions.push(...reindexed);
        if (pageRes.rawText) {
          allRawTexts.push(`--- أسئلة الصفحة ${pageNum} ---\n${pageRes.rawText}`);
        }

        if (i < imagesToProcess.length - 1) {
          await new Promise(r => setTimeout(r, 900));
        }
      }

      const title = (cachedPagesForRetry?.name || cachedImageForRetry?.name || 'اختبار ورقي').replace(/\.[^/.]+$/, '');
      onExamLoaded(allQuestions, allRawTexts.join('\n\n'), title, allQuestions.length === 0, imagesToProcess[0], imagesToProcess);
    } catch (err: any) {
      console.error('Retry failed:', err);
      const msg = err.message || '';
      const is503 = msg.includes('503') || msg.includes('high demand');
      setIs503Error(is503);
      setErrorMessage('لا تزال خوادم السحابة تشهد ضغطاً مؤقتاً. يمكنك الضغط على زر إعادة المحاولة مرة أخرى أو لصق النص يدوياً.');
      setIsLoading(false);
    }
  };

  // Option 2: Run Local In-Browser OCR (Tesseract.js) - 100% offline client-side
  const handleRunLocalOCR = async () => {
    if (!cachedImageForRetry) return;
    setErrorMessage(null);
    setIs503Error(false);
    setIsLoading(true);
    setLoadingMessage('جاري تجهيز محرك المتصفح الداخلي (Offline OCR)...');

    try {
      const text = await extractTextWithLocalOCR(cachedImageForRetry.dataUrl, (p) => {
        setProgressPercent(p);
        setLoadingMessage(`جاري المسح الضوئي بمحرك المتصفح المحلي: ${p}%`);
      });

      setLoadingMessage('جاري ترتيب الأسئلة المستخرجة...');
      const parseRes = parseExamText(text, cachedImageForRetry.name);
      const title = cachedImageForRetry.name.replace(/\.[^/.]+$/, '');
      onExamLoaded(parseRes.questions, parseRes.rawText, title, true, cachedImageForRetry.dataUrl);
    } catch (err: any) {
      console.error('Local OCR error:', err);
      setErrorMessage('تعذر قراءة المستند تلقائياً، يمكنك لصق الأسئلة أو إدخالها وترتيبها يدوياً.');
      setIsLoading(false);
    }
  };

  // Open manual draft
  const handleManualDraft = () => {
    const draftQuestions: Question[] = [
      {
        id: 'q-manual-1',
        question: 'اكتب نص السؤال هنا...',
        options: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'],
        answer: 0,
        hint: '',
        category: 'عام'
      }
    ];
    onExamLoaded(draftQuestions, '', cachedImageForRetry?.name || 'اختبار جديد', true);
  };

  const handleManualParse = () => {
    if (!pastedText.trim()) {
      setErrorMessage('يرجى لصق نصوص الأسئلة أولاً.');
      return;
    }
    let textToParse = pastedText;
    if (forceReverseArabic) {
      textToParse = fixReversedArabicText(textToParse);
    }
    const parseRes = parseExamText(textToParse, `${manualTitle}.txt`);
    onExamLoaded(parseRes.questions, parseRes.rawText, manualTitle, parseRes.fallbackTriggered);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      
      {/* Clean Minimal Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef2ff] dark:bg-[#8083ff]/15 text-[#3b4cb8] dark:text-[#c0c1ff] border border-[#c7d2fe] dark:border-[#8083ff]/30 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>منشئ ومحلل محتوى القدرات والتحصيلي</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#dfe2f1] tracking-tight">
          رفع وتجهيز نماذج الاختبار
        </h1>
        <p className="mt-2 text-slate-500 dark:text-[#c7c4d7] text-sm">
          ارفع ملف الأسئلة أو صور الاختبار الممسوحة ضوئياً للبدء فوراً بالذكاء الاصطناعي
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="relative mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.json,.csv,.txt"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer relative overflow-hidden bg-white dark:bg-[#171b26] shadow-stitch-card ${
            isDragging
              ? 'border-[#3b4cb8] dark:border-[#c0c1ff] bg-[#eef2ff]/50 dark:bg-[#8083ff]/10 ring-4 ring-[#3b4cb8]/10'
              : 'border-slate-200 dark:border-[#262a35] hover:border-[#3b4cb8] dark:hover:border-[#c0c1ff] hover:bg-[#f8faff] dark:hover:bg-[#1c1f2a]'
          }`}
        >
          {/* Loading Overlay */}
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <Loader2 className="w-10 h-10 text-[#3b4cb8] dark:text-[#c0c1ff] animate-spin" />
                <div className="absolute inset-0 rounded-full blur-sm bg-indigo-500/20 -z-10" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-[#dfe2f1] mb-2">{loadingMessage}</h3>
              {progressPercent !== null && (
                <div className="w-64 max-w-full bg-slate-100 dark:bg-[#1c1f2a] rounded-full h-2 mt-3 overflow-hidden border border-slate-200 dark:border-[#313540]">
                  <div
                    className="bg-[#3b4cb8] dark:bg-[#c0c1ff] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] dark:bg-[#1c1f2a] flex items-center justify-center mb-4 border border-[#c7d2fe] dark:border-[#313540] text-[#3b4cb8] dark:text-[#c0c1ff] shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#dfe2f1] mb-1.5">
                اختر ملف الاختبار أو اسحبه هنا
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#c7c4d7] mb-5">
                يدعم مستندات PDF وصور الأسئلة والمذكرات التعليمية (PNG / JPG / PDF)
              </p>

              {/* Supported formats minimal tags */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-[#c7c4d7]">
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] font-medium">PDF</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] font-medium">صور (PNG/JPG)</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] font-medium">JSON</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] font-medium">TXT</span>
              </div>
            </div>
          )}
        </div>

        {/* Extra helper toggles */}
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-[#c7c4d7] px-2">
          <label className="flex items-center gap-2 cursor-pointer hover:text-slate-700 dark:hover:text-[#dfe2f1] select-none">
            <input
              type="checkbox"
              checked={forceReverseArabic}
              onChange={(e) => setForceReverseArabic(e.target.checked)}
              className="rounded bg-white dark:bg-[#1c1f2a] border-slate-300 dark:border-[#313540] text-[#3b4cb8] focus:ring-[#3b4cb8] cursor-pointer"
            />
            <span>عكس اتجاه النصوص (إذا ظهرت الحروف مقلوبة في ملف PDF)</span>
          </label>

          <button
            type="button"
            onClick={() => setShowManualPaste(!showManualPaste)}
            className="text-[#3b4cb8] dark:text-[#c0c1ff] hover:text-[#312e81] dark:hover:text-white cursor-pointer font-semibold"
          >
            {showManualPaste ? 'إخفاء اللصق اليدوي' : 'لصق نص يدوي'}
          </button>
        </div>
      </div>

      {/* Manual Paste Section (Collapsible) */}
      {showManualPaste && (
        <div className="bg-white dark:bg-[#171b26] border border-[#e2e8f0] dark:border-[#262a35] rounded-2xl p-6 mb-8 shadow-stitch-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3b4cb8] dark:text-[#c0c1ff]" />
              <h3 className="font-bold text-slate-900 dark:text-[#dfe2f1] text-sm">لصق نص الأسئلة والمذكرات</h3>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-slate-500 dark:text-[#c7c4d7] mb-1">عنوان الاختبار:</label>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="w-full bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#dfe2f1] focus:outline-none focus:border-[#3b4cb8] focus:bg-white dark:focus:bg-[#171b26] transition-colors"
              placeholder="عنوان الاختبار..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-slate-500 dark:text-[#c7c4d7] mb-1">نص الأسئلة:</label>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`س1: ما ناتج 25% من 400؟\nأ) 50\nب) 100\nج) 150\nد) 200\nالجواب: ب`}
              className="w-full bg-[#f8fafc] dark:bg-[#1c1f2a] border border-slate-200 dark:border-[#313540] rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-[#dfe2f1] font-mono focus:outline-none focus:border-[#3b4cb8] focus:bg-white dark:focus:bg-[#171b26] transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleManualParse}
            className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_rgba(192,193,255,0.25)] transition-all"
          >
            <span>استخراج والذهاب للمراجعة</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error & Solution Notification Banner */}
      {errorMessage && (
        <div className="mb-8 rounded-2xl bg-red-50 dark:bg-[#93000a]/20 border border-red-200 dark:border-[#ffb4ab]/30 p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-[#ffb4ab] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-[#ffb4ab] text-sm mb-1">
                تنبيه أثناء معالجة الملف
              </h3>
              <p className="text-xs text-red-700 dark:text-[#ffdad6] leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>

          {/* Actionable Solutions */}
          <div className="mt-3 pt-3 border-t border-red-200 dark:border-[#ffb4ab]/20 flex flex-wrap gap-2">
            {(cachedPagesForRetry || cachedImageForRetry) && (
              <button
                type="button"
                onClick={handleRetryAI}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة عبر الذكاء الاصطناعي</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setShowManualPaste(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-[#1c1f2a] hover:bg-slate-50 dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#313540] transition-colors cursor-pointer shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>لصق نص يدوي</span>
            </button>

            <button
              type="button"
              onClick={handleManualDraft}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-[#1c1f2a] hover:bg-slate-50 dark:hover:bg-[#262a35] text-slate-700 dark:text-[#dfe2f1] text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#313540] transition-colors cursor-pointer shadow-sm"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>إدخال يدوي</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
