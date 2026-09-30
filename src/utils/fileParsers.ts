import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { Question } from '../types/quiz';
import { fixReversedArabicText, isArabicLikelyReversed, normalizeArabicDigits, parseOptionLetterToIndex } from './arabicUtils';

// Configure pdfjs worker to use CDN matching version
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
} catch {
  // Ignore worker setup failure if already initialized
}

export interface ParseResult {
  questions: Question[];
  rawText: string;
  sourceFileName: string;
  fallbackTriggered: boolean;
  warnings: string[];
}

/**
 * Reads any File as base64 Data URL
 */
export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Returns the total number of pages in a PDF file
 */
export async function getPDFPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

/**
 * Renders the specified page of a PDF to an image canvas Data URL
 */
export async function renderPDFPageToImage(file: File, pageNum: number = 1): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.75 }); // 1.75x is fast, crisp and token-friendly
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تجهيز مساحة معالجة صور الـ PDF.');

  // @ts-ignore
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Renders all pages of a PDF into an array of image Data URLs efficiently
 */
export async function renderAllPDFPagesToImages(
  file: File, 
  onProgress?: (page: number, total: number) => void
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const images: string[] = [];

  for (let p = 1; p <= total; p++) {
    if (onProgress) onProgress(p, total);
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.75 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // @ts-ignore
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.88));
    }
  }

  return images;
}

/**
 * Crops an exact rectangular region from a base64 image using normalized coordinates [ymin, xmin, ymax, xmax] (0-1000)
 */
export async function cropImageFromBox(
  base64Image: string,
  box?: number[] | null
): Promise<string> {
  if (!box || !Array.isArray(box) || box.length < 4) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const [ymin, xmin, ymax, xmax] = box;
        const padX = 8;
        const padY = 8;
        const sx = Math.max(0, (xmin / 1000) * img.naturalWidth - padX);
        const sy = Math.max(0, (ymin / 1000) * img.naturalHeight - padY);
        const sw = Math.min(img.naturalWidth - sx, ((xmax - xmin) / 1000) * img.naturalWidth + padX * 2);
        const sh = Math.min(img.naturalHeight - sy, ((ymax - ymin) / 1000) * img.naturalHeight + padY * 2);

        if (sw <= 10 || sh <= 10) {
          resolve('');
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 0.95));
      } catch (err) {
        console.error('Error cropping image from box:', err);
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = base64Image;
  });
}

/**
 * Sends image data to backend Gemini OCR endpoint to extract structured questions
 * With built-in exponential retry to overcome transient cloud server busy states (503)
 */
export async function scanExamWithAI(
  imageBase64: string, 
  mimeType: string = 'image/jpeg', 
  fileName: string = 'ورقة-ممسوحة.png',
  maxRetries: number = 3
): Promise<ParseResult> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('/api/scan-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || 'فشلت معالجة الصورة عبر المسح الضوئي الذكي.';
        const is503 = res.status === 503 || errMsg.includes('503') || errMsg.includes('high demand');
        
        if (is503 && attempt < maxRetries) {
          console.warn(`Transient 503 on scanExamWithAI (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 1200}ms...`);
          await new Promise(r => setTimeout(r, attempt * 1200));
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const rawQuestions: any[] = data.questions || [];

      // Automatically crop images for questions that have diagrams/imageBox
      const questions: Question[] = await Promise.all(
        rawQuestions.map(async (q, idx) => {
          let croppedImage = '';
          if (q.imageBox && Array.isArray(q.imageBox) && q.imageBox.length === 4) {
            croppedImage = await cropImageFromBox(imageBase64, q.imageBox);
          }

          return {
            id: `q-ocr-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
            question: q.question || `سؤال ${idx + 1}`,
            options: [
              q.options?.[0] || 'الخيار (أ)',
              q.options?.[1] || 'الخيار (ب)',
              q.options?.[2] || 'الخيار (ج)',
              q.options?.[3] || 'الخيار (د)',
            ],
            answer: typeof q.answer === 'number' && q.answer >= 0 && q.answer <= 3 ? q.answer : 0,
            hint: q.hint || undefined,
            category: q.category || 'قدرات',
            imageUrl: croppedImage || q.imageUrl || undefined,
            diagramSvg: q.diagramSvg || undefined
          };
        })
      );

      const rawTextRepresentation = questions.map((q, i) => 
        `${i + 1}) ${q.question}\nأ) ${q.options[0]}  ب) ${q.options[1]}  ج) ${q.options[2]}  د) ${q.options[3]}\nالجواب: ${['أ','ب','ج','د'][q.answer]}\nطريقة الحل: ${q.hint || ''}`
      ).join('\n\n');

      return {
        questions,
        rawText: rawTextRepresentation,
        sourceFileName: fileName,
        fallbackTriggered: questions.length === 0,
        warnings: questions.length === 0 ? ['لم يتم العثور على أسئلة واضحة في الصورة.'] : []
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`Scan attempt ${attempt} failed, retrying in ${attempt * 1000}ms:`, err.message || err);
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw lastError || new Error('فشلت معالجة ورقة الاختبار بالمسح الذكي بعد عدة محاولات.');
}

/**
 * Extracts text from an image locally using Tesseract.js (Offline Browser OCR)
 * Runs 100% in the user's browser without requiring any external APIs or cloud models
 */
export async function extractTextWithLocalOCR(imageUrl: string, onProgress?: (p: number) => void): Promise<string> {
  const worker = await createWorker('ara+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });
  const ret = await worker.recognize(imageUrl);
  await worker.terminate();
  return ret.data.text || '';
}

export interface PDFAnalysisResult {
  fullText: string;
  numPages: number;
  allPagesHaveDigitalText: boolean;
  pageCharCounts: number[];
}

/**
 * Analyzes whether all pages of a PDF have actual selectable digital text or if it's a scanned/hybrid PDF
 */
export async function analyzePDFDocument(
  file: File, 
  onProgress?: (percent: number) => void
): Promise<PDFAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  let fullText = '';
  const pageCharCounts: number[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const items = textContent.items as Array<{ str?: string; transform?: number[] }>;
    let lastY: number | null = null;
    let pageText = '';

    for (const item of items) {
      if (!item.str) continue;
      const currentY = item.transform ? Math.round(item.transform[5]) : 0;
      if (lastY !== null && Math.abs(currentY - lastY) > 6) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' ';
      }
      pageText += item.str;
      lastY = currentY;
    }

    const trimmed = pageText.trim();
    pageCharCounts.push(trimmed.length);
    fullText += pageText + '\n\n';

    if (onProgress) {
      onProgress(Math.round((pageNum / numPages) * 100));
    }
  }

  if (isArabicLikelyReversed(fullText)) {
    fullText = fixReversedArabicText(fullText);
  }

  // All pages must have at least 80 characters of digital text to be considered a fully digital text exam
  const allPagesHaveDigitalText = pageCharCounts.length > 0 && pageCharCounts.every(count => count >= 80);

  return {
    fullText,
    numPages,
    allPagesHaveDigitalText,
    pageCharCounts
  };
}

/**
 * Extracts raw text from an uploaded PDF file in the browser
 */
export async function extractTextFromPDF(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const analysis = await analyzePDFDocument(file, onProgress);
  return analysis.fullText;
}

/**
 * Parses raw Arabic/Qudurat text into structured questions
 */
export function parseExamText(rawText: string, fileName: string = 'اختبار.txt'): ParseResult {
  const warnings: string[] = [];
  const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Attempt pattern 1: Split by explicit question identifiers:
  // e.g.: "س 1", "سؤال 1", "السؤال 1", "1-", "1.", "(1)", "سؤال (1)"
  const questionSplitRegex = /(?:^|\n)(?=(?:س\s*[\d١-٩]+|سؤال\s*[\d١-٩]+|السؤال\s*[\d١-٩]+|\(?[\d١-٩]+\)?\s*[\.\-\)]\s*|[Qq]\d+[\.\:\-]))/g;
  
  let chunks = normalizedText.split(questionSplitRegex).map(c => c.trim()).filter(Boolean);

  // If no chunks found with strict header, try splitting by question mark followed by newline or double newlines
  if (chunks.length <= 1) {
    const doubleNewlineChunks = normalizedText.split(/\n{2,}/).map(c => c.trim()).filter(c => c.length > 20);
    if (doubleNewlineChunks.length > 1) {
      chunks = doubleNewlineChunks;
    }
  }

  const parsedQuestions: Question[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const qObj = parseQuestionBlock(chunk, i + 1);
    if (qObj) {
      parsedQuestions.push(qObj);
    }
  }

  // Fallback check: If regex identified 0 questions or structure was unrecognized
  const fallbackTriggered = parsedQuestions.length === 0;

  if (fallbackTriggered) {
    warnings.push('لم نتمكن من استخراج بنية الأسئلة آلياً بنسبة كاملة. تم نقل النص الخام إلى صفحة المعالجة للترتيب اليدوي السهل.');
    // Create at least one draft starter question with the initial lines so student can edit immediately
    const firstLines = normalizedText.split('\n').filter(l => l.trim().length > 0);
    parsedQuestions.push({
      id: `draft-q-1`,
      question: firstLines[0] || 'سؤال مستخرج من الملف (قم بالتعديل)',
      options: [
        firstLines[1] || 'الخيار (أ)',
        firstLines[2] || 'الخيار (ب)',
        firstLines[3] || 'الخيار (ج)',
        firstLines[4] || 'الخيار (د)'
      ],
      answer: 0,
      hint: '',
      category: 'عام'
    });
  }

  return {
    questions: parsedQuestions,
    rawText: normalizedText,
    sourceFileName: fileName,
    fallbackTriggered,
    warnings
  };
}

/**
 * Parses an individual text block into a Question object
 */
function parseQuestionBlock(block: string, fallbackIndex: number): Question | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let questionText = '';
  let optionA = '';
  let optionB = '';
  let optionC = '';
  let optionD = '';
  let answerIndex = 0;
  let hint = '';

  // Extract Hint / Solution first if present
  const hintMatch = block.match(/(?:طريقة الحل|التلميح|الشرح|التفسير|توضيح|فكرة الحل|خطوات الحل|Hint|Explanation)\s*[:\-\=]\s*([\s\S]+?)(?=$|\n(?:الجواب|الإجابة|الخيار))/i);
  if (hintMatch) {
    hint = hintMatch[1].trim();
  }

  // Extract Correct Answer if present
  const answerMatch = block.match(/(?:الإجابة الصحيحة|الجواب الصحيح|الجواب|الحل|الإجابة|الخيار الصحيح|Answer|Correct)\s*[:\-\=]?\s*([أابجدABCD1-4\(\)\[\]]+)/i);
  if (answerMatch) {
    const rawAns = answerMatch[1].replace(/[\(\)\[\]]/g, '').trim();
    const parsedIdx = parseOptionLetterToIndex(rawAns);
    if (parsedIdx !== null) {
      answerIndex = parsedIdx;
    }
  }

  // Clean lines: Remove hint and answer lines from the search space for question & options
  const cleanLines = lines.filter(line => {
    return !line.match(/^(?:طريقة الحل|التلميح|الشرح|التفسير|توضيح|فكرة الحل|خطوات الحل|Hint|Explanation)\s*[:\-\=]/i) &&
           !line.match(/^(?:الإجابة الصحيحة|الجواب الصحيح|الجواب|الحل|الإجابة|الخيار الصحيح|Answer|Correct)\s*[:\-\=]?\s*[أابجدABCD1-4]/i);
  });

  if (cleanLines.length === 0) return null;

  // Question header cleanup: remove initial "س 1:" or "1-"
  let firstLine = cleanLines[0];
  firstLine = firstLine.replace(/^(?:س\s*[\d١-٩]+|سؤال\s*[\d١-٩]+|السؤال\s*[\d١-٩]+|\(?[\d١-٩]+\)?\s*[\.\-\)]|[Qq]\d+[\.\:\-])\s*[:\.\-]?\s*/, '').trim();
  questionText = firstLine;

  // Check for inline options within a single line or subsequent lines:
  // e.g. "أ) 12  ب) 24  ج) 36  د) 48"
  const fullRemainingText = cleanLines.slice(1).join(' \n ');

  const optAPattern = /(?:^|\s)(?:[أاA1١]\s*[\)\.\-\:]|\([أاA1١]\)|\[[أاA1١]\])\s*([\s\S]+?)(?=(?:[بB2٢]\s*[\)\.\-\:]|\([بB2٢]\)|\[[بB2٢]\])|$)/;
  const optBPattern = /(?:^|\s)(?:[بB2٢]\s*[\)\.\-\:]|\([بB2٢]\)|\[[بB2٢]\])\s*([\s\S]+?)(?=(?:[جC3٣]\s*[\)\.\-\:]|\([جC3٣]\)|\[[جC3٣]\])|$)/;
  const optCPattern = /(?:^|\s)(?:[جC3٣]\s*[\)\.\-\:]|\([جC3٣]\)|\[[جC3٣]\])\s*([\s\S]+?)(?=(?:[دD4٤]\s*[\)\.\-\:]|\([دD4٤]\)|\[[دD4٤]\])|$)/;
  const optDPattern = /(?:^|\s)(?:[دD4٤]\s*[\)\.\-\:]|\([دD4٤]\)|\[[دD4٤]\])\s*([\s\S]+?)(?=$|\n(?:طريقة|الجواب|الإجابة))/;

  const matchA = fullRemainingText.match(optAPattern);
  const matchB = fullRemainingText.match(optBPattern);
  const matchC = fullRemainingText.match(optCPattern);
  const matchD = fullRemainingText.match(optDPattern);

  if (matchA && matchB) {
    optionA = matchA[1].trim();
    optionB = matchB[1].trim();
    optionC = matchC ? matchC[1].trim() : 'خيار ج';
    optionD = matchD ? matchD[1].trim() : 'خيار د';
  } else {
    // If not matching letter patterns, try line-by-line assignment
    if (cleanLines.length >= 5) {
      optionA = cleanLines[1];
      optionB = cleanLines[2];
      optionC = cleanLines[3];
      optionD = cleanLines[4];
    } else {
      // Gather whatever lines we have
      const remaining = cleanLines.slice(1);
      optionA = remaining[0] || 'الخيار (أ)';
      optionB = remaining[1] || 'الخيار (ب)';
      optionC = remaining[2] || 'الخيار (ج)';
      optionD = remaining[3] || 'الخيار (د)';
    }
  }

  // Clean trailing punctuation or newlines
  const cleanOpt = (opt: string) => opt.replace(/[\n\r]+/g, ' ').trim();

  return {
    id: `q-${Date.now()}-${fallbackIndex}-${Math.random().toString(36).substring(2, 6)}`,
    question: questionText || `سؤال ${fallbackIndex}`,
    options: [
      cleanOpt(optionA) || 'الخيار (أ)',
      cleanOpt(optionB) || 'الخيار (ب)',
      cleanOpt(optionC) || 'الخيار (ج)',
      cleanOpt(optionD) || 'الخيار (د)'
    ],
    answer: answerIndex >= 0 && answerIndex <= 3 ? answerIndex : 0,
    hint: hint ? hint.trim() : undefined,
    category: detectCategory(questionText)
  };
}

/**
 * Categorizes questions based on Arabic keywords (كمي، لفظي، تحصيلي)
 */
function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/(تناظر|إكمال|مفردة|سياقي|استيعاب|معنى|ضد|مرادف)/)) {
    return 'قدرات لفظي';
  }
  if (lower.match(/(إذا كان|أوجد قيمة|مثلث|دائرة|مربع|نسبة|سرعة|عمر|س²|ص²|مجموع|ضرب|قسمة|زاوية|متوسط|احتمال)/)) {
    return 'قدرات كمي';
  }
  if (lower.match(/(تسارع|سرعة متجهة|قوة|نيوتن|طاقة|تيار|مقاومة|فولت|كتلة|احتكاك|عدسة)/)) {
    return 'تحصيلي فيزياء';
  }
  if (lower.match(/(مركب|تفاعل|عنصر|حمض|قاعدة|مول|إلكترون|رابطة|كهروسالبية|كيمياء|ذرة)/)) {
    return 'تحصيلي كيمياء';
  }
  if (lower.match(/(خلية|ميتوكوندريا|ريبوسوم|وراثة|كروموسوم|إنزيم|نبات|حيوان|تنفس خلوي|بناء ضوئي)/)) {
    return 'تحصيلي أحياء';
  }
  if (lower.match(/(مشتقة|تكامل|نهاية|مصفوفة|لوغاريتم|دالة|متتابعة)/)) {
    return 'تحصيلي رياضيات';
  }
  return 'عام';
}

/**
 * Parses JSON format exams
 */
export function parseJSONExam(content: string, fileName: string = 'اختبار.json'): ParseResult {
  const warnings: string[] = [];
  try {
    const data = JSON.parse(content);
    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray(data.questions)) {
      items = data.questions;
    } else if (Array.isArray(data.items)) {
      items = data.items;
    } else {
      throw new Error('الملف لا يحتوي على مصفوفة أسئلة معتمدة.');
    }

    const questions: Question[] = items.map((item, index) => {
      // Find question text
      const qText = item.question || item.text || item.title || item.السؤال || `سؤال ${index + 1}`;
      
      // Find options
      let rawOptions: any[] = item.options || item.choices || item.الخيارات || [];
      if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
        rawOptions = [
          item.optionA || item.a || item['أ'] || 'الخيار (أ)',
          item.optionB || item.b || item['ب'] || 'الخيار (ب)',
          item.optionC || item.c || item['ج'] || 'الخيار (ج)',
          item.optionD || item.d || item['د'] || 'الخيار (د)',
        ];
      }

      const options: [string, string, string, string] = [
        String(rawOptions[0] || 'الخيار (أ)'),
        String(rawOptions[1] || 'الخيار (ب)'),
        String(rawOptions[2] || 'الخيار (ج)'),
        String(rawOptions[3] || 'الخيار (د)')
      ];

      // Parse answer
      let answerIdx = 0;
      if (typeof item.answer === 'number' && item.answer >= 0 && item.answer <= 3) {
        answerIdx = item.answer;
      } else if (item.answer !== undefined || item.correct !== undefined || item.الجواب !== undefined || item.الإجابة !== undefined) {
        const rawAns = String(item.answer ?? item.correct ?? item.الجواب ?? item.الإجابة);
        const parsed = parseOptionLetterToIndex(rawAns);
        if (parsed !== null) answerIdx = parsed;
      }

      // Hint / Solution
      const hint = item.hint || item.explanation || item.طريقة_الحل || item['طريقة الحل'] || item.التلميح || undefined;
      const category = item.category || item.التصنيف || detectCategory(qText);

      return {
        id: item.id || `q-json-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
        question: qText,
        options,
        answer: answerIdx,
        hint: hint ? String(hint) : undefined,
        category: category ? String(category) : 'عام'
      };
    });

    return {
      questions,
      rawText: content,
      sourceFileName: fileName,
      fallbackTriggered: questions.length === 0,
      warnings
    };
  } catch (err: any) {
    warnings.push(`تعذر قراءة ملف JSON: ${err.message}. تم تحويله إلى المعالجة النصية.`);
    return parseExamText(content, fileName);
  }
}

/**
 * Parses CSV format exams
 */
export function parseCSVExam(content: string, fileName: string = 'اختبار.csv'): ParseResult {
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return {
      questions: [],
      rawText: content,
      sourceFileName: fileName,
      fallbackTriggered: true,
      warnings: ['ملف CSV فارغ.']
    };
  }

  // Parse lines considering quotes
  const rows: string[][] = lines.map(line => parseCSVLine(line));
  
  // Check if first line is header
  let startIndex = 0;
  const firstRow = rows[0].join(' ').toLowerCase();
  if (firstRow.includes('سؤال') || firstRow.includes('question') || firstRow.includes('خيار') || firstRow.includes('option')) {
    startIndex = 1;
  }

  const questions: Question[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const qText = row[0] || `سؤال ${i}`;
    const optA = row[1] || 'الخيار (أ)';
    const optB = row[2] || 'الخيار (ب)';
    const optC = row[3] || 'الخيار (ج)';
    const optD = row[4] || 'الخيار (د)';
    
    let answerIdx = 0;
    if (row[5]) {
      const parsed = parseOptionLetterToIndex(row[5]);
      if (parsed !== null) answerIdx = parsed;
    }

    const hint = row[6] ? row[6].trim() : undefined;
    const category = row[7] ? row[7].trim() : detectCategory(qText);

    questions.push({
      id: `q-csv-${i}-${Math.random().toString(36).substring(2, 6)}`,
      question: qText,
      options: [optA, optB, optC, optD],
      answer: answerIdx,
      hint,
      category
    });
  }

  return {
    questions,
    rawText: content,
    sourceFileName: fileName,
    fallbackTriggered: questions.length === 0,
    warnings
  };
}

/**
 * Helper to parse a single CSV line with quote escaping
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const separator = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Exports questions as a clean formatted JSON download
 */
export function downloadQuestionsAsJSON(questions: Question[], examTitle: string = 'اختبار-قدرات-وتحصيلي') {
  const exportData = {
    title: examTitle,
    exportedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    questions: questions.map((q, idx) => ({
      index: idx + 1,
      id: q.id,
      question: q.question,
      options: q.options,
      answer: q.answer,
      answerLetter: ['أ', 'ب', 'ج', 'د'][q.answer] || 'أ',
      hint: q.hint || '',
      category: q.category || 'عام'
    }))
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const safeName = examTitle.replace(/[\/\?<>\\:\*\|":]/g, '_');
  downloadAnchor.setAttribute('download', `${safeName}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
