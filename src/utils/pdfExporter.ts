import { Question, StudentAnswers, StudentScratchpads, OPTION_LABELS } from '../types/quiz';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFExportOptions {
  questions: Question[];
  title: string;
  includeHints?: boolean;
  includeAnswerKey?: boolean;
  studentName?: string;
}

export interface ResultReportPDFOptions {
  title: string;
  studentName?: string;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  timeSpentFormatted: string;
  attemptNumber: number;
  ratingLabel: string;
  questions: Question[];
  answers: StudentAnswers;
  scratchpads?: StudentScratchpads;
}

/**
 * Format math fractions and exponents in static HTML for printable documents
 */
function formatMathForPrint(text: string): string {
  if (!text) return '';

  let str = text;

  // 1. Normalize textual math symbols
  str = str
    .replace(/\bدلتا\b/g, 'Δ')
    .replace(/\bأوم\b/g, 'Ω')
    .replace(/\bباي\b/g, 'π')
    .replace(/\bمايكرو\b/g, 'μ')
    .replace(/\bميكرو\b/g, 'μ')
    .replace(/<=\b/g, '≤')
    .replace(/>=\b/g, '≥')
    .replace(/!=\b/g, '≠')
    .replace(/\+-/g, '±')
    .replace(/\*/g, '×');

  // Helper to format exponents, roots, and subformulas cleanly
  const formatSubFormulas = (subText: string): string => {
    if (!subText) return '';
    let res = subText;

    // A. Square roots: √(x), √16, جذر(x), جذر 225
    res = res.replace(/(?:√|جذر)\s*(?:\(([^)]+)\)|([٠-٩0-9a-zA-Zأ-ي]+))/g, (_m, p1, p2) => {
      const inner = (p1 || p2 || '').trim();
      return `<span style="display:inline-table; vertical-align:middle; border-collapse:collapse; margin:0 3px; font-weight:bold;"><span style="display:table-cell; vertical-align:middle; color:#3b4cb8; font-size:1.15em; padding-left:1px; line-height:1;">√</span><span style="display:table-cell; vertical-align:middle; border-top:1.5px solid #0f172a; padding:0 3px; font-size:0.95em; line-height:1.2;">${inner}</span></span>`;
    });

    // B. Exponents: base^exp e.g. س^2, 4^4, (س+1)^2, 10^-3
    const expRegex = /((?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\))\^\-?(?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\)))/g;
    res = res.replace(expRegex, (m) => {
      const [base, exp] = m.split('^');
      return `<span style="display:inline-block; margin:0 1px;"><span>${base}</span><sup style="font-size:0.72em; font-weight:800; color:#3b4cb8; line-height:0; vertical-align:0.45em; margin:0 1px;">${exp}</sup></span>`;
    });

    return res;
  };

  // 2. Vertical Stacked Fractions with independent divider bar (no strikethrough, perfectly centered):
  const renderFractionBlock = (rawNum: string, rawDen: string) => {
    const formattedNum = formatSubFormulas(rawNum);
    const formattedDen = formatSubFormulas(rawDen);

    return `<span class="math-fraction-wrapper" style="display:inline-flex; flex-direction:column; align-items:center; justify-content:center; vertical-align:-0.92em; margin:0 5px; text-align:center;"><span style="display:block; padding:0 4px 4px 4px; line-height:1.15; font-weight:bold; font-size:0.92em; text-align:center;">${formattedNum}</span><span style="display:block; width:100%; min-width:20px; height:2px; background-color:#0f172a; margin:0; border-radius:1px;"></span><span style="display:block; padding:4px 4px 0 4px; line-height:1.15; font-weight:bold; font-size:0.92em; text-align:center;">${formattedDen}</span></span>`;
  };

  // Support LaTeX \frac{num}{den}
  str = str.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
    return renderFractionBlock(num.trim(), den.trim());
  });

  // Support standard (num) / (den) or num / den
  const fractionRegex = /(?:\(([^)]+)\)|([٠-٩0-9a-zA-Zأ-ي]+(?:\^[٠-٩0-9a-zA-Zأ-ي]+)?))\s*[\/÷]\s*(?:\(([^)]+)\)|([٠-٩0-9a-zA-Zأ-ي]+(?:\^[٠-٩0-9a-zA-Zأ-ي]+)?))/g;

  str = str.replace(fractionRegex, (_match, p1, p2, p3, p4) => {
    const rawNum = (p1 || p2 || '').trim();
    const rawDen = (p3 || p4 || '').trim();
    return renderFractionBlock(rawNum, rawDen);
  });

  // 3. Format remaining subformulas (exponents, roots) in the rest of the text
  str = formatSubFormulas(str);

  return str;
}

/**
 * Generates an executive, official Student Exam Result Report and triggers direct browser PDF download
 */
export async function exportResultReportPDF({
  title,
  studentName,
  percentage,
  correctCount,
  wrongCount,
  unansweredCount,
  totalQuestions,
  timeSpentFormatted,
  attemptNumber,
  ratingLabel,
  questions,
  answers,
  scratchpads = {}
}: ResultReportPDFOptions) {
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const questionsHtml = questions.map((q, idx) => {
    const qNum = idx + 1;
    const studentAns = answers[q.id];
    const isUnanswered = studentAns === null || studentAns === undefined;
    const isCorrect = studentAns === q.answer;
    const scratchpad = scratchpads[q.id];

    let statusBadge = '';
    let statusClass = 'wrong';
    if (isCorrect) {
      statusClass = 'correct';
      statusBadge = '<span class="badge badge-correct">✔ إجابة صحيحة</span>';
    } else if (isUnanswered) {
      statusClass = 'unanswered';
      statusBadge = '<span class="badge badge-unanswered">⚠ لم تجب على السؤال</span>';
    } else {
      statusClass = 'wrong';
      statusBadge = '<span class="badge badge-wrong">✖ إجابة خاطئة</span>';
    }

    // Options HTML
    const optionsHtml = q.options.map((opt, optIdx) => {
      const label = OPTION_LABELS[optIdx];
      const isThisCorrect = q.answer === optIdx;
      const isThisStudentChoice = studentAns === optIdx;

      let optClass = 'opt-normal';
      let optBadge = '';

      if (isThisCorrect) {
        optClass = 'opt-correct';
        optBadge = '<span class="opt-tag tag-correct">الإجابة النموذجية الصحيحة</span>';
      } else if (isThisStudentChoice && !isCorrect) {
        optClass = 'opt-student-wrong';
        optBadge = '<span class="opt-tag tag-wrong">إجابتك (خاطئة)</span>';
      }

      return `
        <div class="option-item ${optClass}">
          <div class="option-content">
            <span class="option-label">(${label})</span>
            <span class="option-text">${formatMathForPrint(opt || '-')}</span>
          </div>
          ${optBadge}
        </div>
      `;
    }).join('');

    // Diagram / Image
    let mediaHtml = '';
    if (q.imageUrl) {
      mediaHtml = `
        <div class="media-container">
          <img src="${q.imageUrl}" alt="رسمة السؤال" class="question-image" />
        </div>
      `;
    } else if (q.diagramSvg) {
      mediaHtml = `
        <div class="media-container svg-container">
          ${q.diagramSvg}
        </div>
      `;
    }

    // Scratchpad
    let scratchpadHtml = '';
    if (scratchpad && scratchpad.trim().length > 0) {
      scratchpadHtml = `
        <div class="scratchpad-box">
          <div class="scratchpad-title">📝 مسودتك وملاحظاتك أثناء الحل:</div>
          <div class="scratchpad-content">${scratchpad.replace(/\n/g, '<br/>')}</div>
        </div>
      `;
    }

    // Hint / Solution
    let hintHtml = '';
    if (q.hint && q.hint.trim().length > 0) {
      hintHtml = `
        <div class="hint-box">
          <div class="hint-title">💡 طريقة وفكرة الحل والتوضيح المعتمدة:</div>
          <div class="hint-content">${formatMathForPrint(q.hint.replace(/\n/g, '<br/>'))}</div>
        </div>
      `;
    }

    return `
      <div class="question-card q-${statusClass}">
        <div class="question-header">
          <div class="header-right">
            <span class="q-number">السؤال (${qNum})</span>
            ${q.category ? `<span class="q-category">${q.category}</span>` : ''}
          </div>
          <div class="header-left">
            ${statusBadge}
          </div>
        </div>
        <div class="question-text">${formatMathForPrint(q.question)}</div>
        ${mediaHtml}
        <div class="options-grid">
          ${optionsHtml}
        </div>
        ${scratchpadHtml}
        ${hintHtml}
      </div>
    `;
  }).join('');

  // 1. Loading Overlay so user gets immediate visual feedback during render
  const overlay = document.createElement('div');
  overlay.id = 'pdf-render-overlay';
  overlay.setAttribute('dir', 'rtl');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
  overlay.style.backdropFilter = 'blur(6px)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 20px; padding: 28px 36px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); font-family: 'Cairo', system-ui, sans-serif; max-width: 420px; width: 90%;">
      <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top-color: #10b981; border-radius: 50%; margin: 0 auto 14px; animation: pdfSpin 1s linear infinite;"></div>
      <div style="font-weight: 800; font-size: 17px; color: #0f172a; margin-bottom: 6px;">جاري إعداد تقرير النتيجة وتنزيل الـ PDF...</div>
      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">سيتم تنزيل الملف على جهازك مباشرة وبأعلى جودة</div>
    </div>
    <style>
      @keyframes pdfSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  `;
  document.body.appendChild(overlay);

  // 2. High-fidelity rendering container attached to DOM with positive z-index
  const container = document.createElement('div');
  container.id = 'pdf-export-content-container';
  container.setAttribute('dir', 'rtl');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px'; // 210mm at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.zIndex = '999998';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = "'Cairo', system-ui, -apple-system, sans-serif";
  container.style.padding = '0';
  container.style.margin = '0';

  container.innerHTML = `
    <style>
      .report-box {
        width: 794px;
        background: #ffffff;
        color: #0f172a;
        padding: 24px 28px;
        box-sizing: border-box;
        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        font-size: 11pt;
        line-height: 1.5;
      }
      .report-header {
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 14px;
        margin-bottom: 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand-title {
        font-size: 18pt;
        font-weight: 900;
        color: #1e293b;
        margin: 0 0 4px 0;
      }
      .brand-sub {
        font-size: 9pt;
        color: #64748b;
        margin: 0;
      }
      .header-meta {
        text-align: left;
        font-size: 9pt;
        color: #64748b;
        line-height: 1.6;
      }
      .header-meta strong {
        color: #0f172a;
      }
      .score-box {
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-radius: 14px;
        padding: 16px 20px;
        margin-bottom: 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .score-main {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .score-circle {
        background: #10b981;
        color: #ffffff;
        width: 76px;
        height: 76px;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 19pt;
        line-height: 1;
      }
      .score-circle span {
        font-size: 8pt;
        font-weight: 600;
        margin-top: 3px;
      }
      .score-details h2 {
        font-size: 14pt;
        font-weight: 800;
        margin: 0 0 4px 0;
        color: #0f172a;
      }
      .score-rating {
        display: inline-block;
        font-size: 9.5pt;
        font-weight: 700;
        color: #047857;
        background: #d1fae5;
        padding: 2px 10px;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .score-meta {
        font-size: 8.5pt;
        color: #64748b;
      }
      .metrics-grid {
        display: flex;
        gap: 10px;
      }
      .metric-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 8px 14px;
        border-radius: 10px;
        text-align: center;
        min-width: 75px;
      }
      .metric-val {
        font-size: 14pt;
        font-weight: 800;
        display: block;
      }
      .metric-lbl {
        font-size: 7.5pt;
        color: #64748b;
        font-weight: 600;
      }
      .val-correct { color: #059669; }
      .val-wrong { color: #dc2626; }
      .val-unanswered { color: #d97706; }
      .section-title {
        font-size: 12pt;
        font-weight: 800;
        color: #1e293b;
        margin: 0 0 14px 0;
        padding-bottom: 6px;
        border-bottom: 1.5px solid #e2e8f0;
      }
      .question-card {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 14px;
        background: #ffffff;
        box-sizing: border-box;
      }
      .q-correct { border-right: 5px solid #10b981; }
      .q-wrong { border-right: 5px solid #ef4444; }
      .q-unanswered { border-right: 5px solid #f59e0b; }
      .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .q-number {
        font-weight: 800;
        font-size: 10.5pt;
        color: #1e293b;
      }
      .q-category {
        font-size: 8pt;
        background: #f1f5f9;
        color: #475569;
        padding: 2px 8px;
        border-radius: 4px;
        margin-right: 6px;
      }
      .badge {
        font-size: 8pt;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 6px;
      }
      .badge-correct { background: #d1fae5; color: #065f46; }
      .badge-wrong { background: #fee2e2; color: #991b1b; }
      .badge-unanswered { background: #fef3c7; color: #92400e; }
      .question-text {
        font-size: 11pt;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 12px;
        line-height: 2.3;
      }
      .media-container {
        text-align: center;
        margin: 8px 0;
      }
      .question-image {
        max-height: 140px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
      }
      .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 10px;
      }
      .option-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        border-radius: 8px;
        border: 1.5px solid #e2e8f0;
        font-size: 10pt;
        min-height: 44px;
        box-sizing: border-box;
      }
      .opt-normal { background: #f8fafc; color: #334155; }
      .opt-correct { background: #ecfdf5; border-color: #10b981; color: #065f46; font-weight: 700; }
      .opt-student-wrong { background: #fef2f2; border-color: #ef4444; color: #991b1b; text-decoration: line-through; }
      .option-content {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        line-height: 1.5;
      }
      .option-label {
        font-weight: 800;
        font-size: 10pt;
        color: #1e293b;
      }
      .option-text {
        font-weight: 700;
        color: inherit;
        line-height: 1.6;
      }
      .opt-tag {
        font-size: 8pt;
        font-weight: 800;
        padding: 4px 10px;
        border-radius: 6px;
        line-height: 1.3;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .tag-correct { background: #10b981; color: #ffffff; }
      .tag-wrong { background: #ef4444; color: #ffffff; }
      .scratchpad-box {
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        margin-top: 8px;
        font-size: 9pt;
        color: #475569;
        line-height: 1.8;
      }
      .scratchpad-title {
        font-weight: 700;
        color: #334155;
        margin-bottom: 2px;
      }
      .hint-box {
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 6px;
        padding: 9px 12px;
        margin-top: 8px;
        font-size: 9pt;
        color: #78350f;
      }
      .hint-title {
        font-weight: 800;
        color: #92400e;
        margin-bottom: 3px;
      }
      .hint-content {
        font-size: 9.5pt;
        line-height: 2.2;
        color: #78350f;
        margin-top: 4px;
      }
      .report-footer {
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
        margin-top: 24px;
        text-align: center;
        font-size: 8.5pt;
        color: #94a3b8;
      }
    </style>

    <div class="report-box">
      <!-- Header -->
      <div class="report-header">
        <div>
          <h1 class="brand-title">منصة تدريب القدرات والتحصيلي</h1>
          <p class="brand-sub">تقرير النتيجة الرسمية والتحليل التفصيلي للإجابات</p>
        </div>
        <div class="header-meta">
          <div><strong>الاختبار:</strong> ${title || 'اختبار تدريب'}</div>
          ${studentName ? `<div><strong>اسم الطالب:</strong> ${studentName}</div>` : ''}
          <div><strong>تاريخ الإجراء:</strong> ${currentDate}</div>
          <div><strong>المحاولة:</strong> رقم (${attemptNumber})</div>
        </div>
      </div>

      <!-- Score Summary Card -->
      <div class="score-box">
        <div class="score-main">
          <div class="score-circle">
            ${percentage}٪
            <span>النسبة</span>
          </div>
          <div class="score-details">
            <h2>${title}</h2>
            <div class="score-rating">${ratingLabel}</div>
            <div class="score-meta">الوقت المستغرق: ${timeSpentFormatted} • إجمالي الأسئلة: ${totalQuestions} مسألة</div>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-val val-correct">${correctCount}</span>
            <span class="metric-lbl">صحيحة</span>
          </div>
          <div class="metric-card">
            <span class="metric-val val-wrong">${wrongCount}</span>
            <span class="metric-lbl">خاطئة</span>
          </div>
          <div class="metric-card">
            <span class="metric-val val-unanswered">${unansweredCount}</span>
            <span class="metric-lbl">متروكة</span>
          </div>
        </div>
      </div>

      <!-- Detailed Questions Review -->
      <div class="section-title">
        مراجعة الأسئلة وتفاصيل الحل النموذجي (${totalQuestions} مسألة)
      </div>

      <div class="questions-list">
        ${questionsHtml}
      </div>

      <!-- Footer -->
      <div class="report-footer">
        تم استخراج هذا التقرير تلقائياً عبر منصة تدريب القدرات والتحصيلي • نتمنى لك دوام التفوق والنجاح
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // 3. Ensure fonts and layout reflow are 100% complete
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(resolve => setTimeout(resolve, 300));

    // 4. Render high-resolution canvas via html2canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas render returned empty dimensions');
    }

    // 5. Create multi-page A4 document with jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = 210; // mm
    const pageHeight = 297; // mm
    const pageCanvasHeight = Math.floor(canvas.width * (pageHeight / pageWidth));

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < canvas.height) {
      const currentChunkHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageCanvasHeight;

      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          canvas,
          0, renderedHeight, canvas.width, currentChunkHeight,
          0, 0, canvas.width, currentChunkHeight
        );
      }

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      if (pageIndex > 0) {
        pdf.addPage();
      }
      pdf.addImage(pageImgData, 'JPEG', 0, 0, pageWidth, pageHeight);

      renderedHeight += currentChunkHeight;
      pageIndex++;
    }

    const cleanFilename = `نتيجة-${(title || 'اختبار-قدرات').replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
    pdf.save(cleanFilename);
  } catch (err) {
    console.error('Direct PDF export error:', err);
    alert('حدث خطأ أثناء تحميل ملف PDF. يرجى المحاولة مرة أخرى.');
  } finally {
    // 6. Cleanup overlay and temporary container
    try {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    } catch {}
    try {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    } catch {}
  }
}

/**
 * Generates an official, print-ready A4 blank/study exam document and triggers browser Print-to-PDF
 */
export function printExamAsPDF({
  questions,
  title,
  includeHints = true,
  includeAnswerKey = true,
  studentName = ''
}: PDFExportOptions) {
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const questionsHtml = questions.map((q, idx) => {
    const qNum = idx + 1;
    
    // Options HTML in 2 columns
    const optionsHtml = q.options.map((opt, optIdx) => {
      const label = OPTION_LABELS[optIdx];
      const isCorrect = q.answer === optIdx;
      return `
        <div class="option-item ${includeHints && isCorrect ? 'correct-option' : ''}">
          <span class="option-label">(${label})</span>
          <span class="option-text">${formatMathForPrint(opt || '-')}</span>
          ${includeHints && isCorrect ? '<span class="correct-badge">✔ الإجابة الصحيحة</span>' : ''}
        </div>
      `;
    }).join('');

    // Diagram / Image HTML
    let mediaHtml = '';
    if (q.imageUrl) {
      mediaHtml = `
        <div class="media-container">
          <img src="${q.imageUrl}" alt="رسمة السؤال" class="question-image" />
        </div>
      `;
    } else if (q.diagramSvg) {
      mediaHtml = `
        <div class="media-container svg-container">
          ${q.diagramSvg}
        </div>
      `;
    }

    // Hint / Solution HTML
    let hintHtml = '';
    if (includeHints && q.hint && q.hint.trim().length > 0) {
      hintHtml = `
        <div class="hint-box">
          <div class="hint-title">💡 طريقة وفكرة الحل والتفسير:</div>
          <div class="hint-content">${formatMathForPrint(q.hint.replace(/\n/g, '<br/>'))}</div>
        </div>
      `;
    }

    return `
      <div class="question-card">
        <div class="question-header">
          <span class="q-number">السؤال (${qNum})</span>
          ${q.category ? `<span class="q-category">${q.category}</span>` : ''}
        </div>
        <div class="question-text">${formatMathForPrint(q.question)}</div>
        ${mediaHtml}
        <div class="options-grid">
          ${optionsHtml}
        </div>
        ${hintHtml}
      </div>
    `;
  }).join('');

  // Answer key section
  let answerKeyHtml = '';
  if (includeAnswerKey) {
    const keyRows = questions.map((q, idx) => {
      return `
        <div class="key-item">
          <span class="key-q">س (${idx + 1}):</span>
          <span class="key-a">${OPTION_LABELS[q.answer]}</span>
        </div>
      `;
    }).join('');

    answerKeyHtml = `
      <div class="answer-key-section">
        <div class="key-title">مفتاح الإجابات الصحيحة للنموذج:</div>
        <div class="key-grid">
          ${keyRows}
        </div>
      </div>
    `;
  }

  const printDocumentHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title || 'اختبار تدريب القدرات والتحصيلي'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm 15mm 15mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 10.5pt;
          line-height: 1.5;
        }

        .screen-toolbar {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #1e293b;
          color: #ffffff;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .screen-toolbar .btn-print {
          background: #10b981;
          color: #ffffff;
          border: none;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
        }

        @media print {
          .screen-toolbar {
            display: none !important;
          }
        }

        .exam-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .main-title {
          font-size: 16pt;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .sub-title {
          font-size: 9pt;
          color: #64748b;
          margin: 0;
        }

        .header-meta-box {
          text-align: left;
          font-size: 8.5pt;
          color: #475569;
        }

        .student-info-bar {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 14px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          font-size: 9pt;
          color: #334155;
          font-weight: 600;
        }

        .question-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 10px;
          page-break-inside: avoid;
          background: #ffffff;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .q-number {
          font-weight: 800;
          font-size: 9.5pt;
          color: #1e293b;
        }

        .q-category {
          font-size: 8pt;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .question-text {
          font-size: 11pt;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
          line-height: 2.3;
        }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .option-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1.5px solid #f1f5f9;
          background: #f8fafc;
          font-size: 10pt;
          min-height: 42px;
        }

        .correct-option {
          background: #ecfdf5;
          border-color: #a7f3d0;
          font-weight: 700;
        }

        .option-label {
          font-weight: 800;
          color: #0f172a;
        }

        .hint-box {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-radius: 6px;
          padding: 8px 12px;
          margin-top: 8px;
          font-size: 9pt;
          color: #78350f;
          line-height: 2.1;
        }

        .answer-key-section {
          margin-top: 20px;
          border-top: 2px dashed #cbd5e1;
          padding-top: 14px;
          page-break-before: auto;
        }

        .key-title {
          font-size: 10pt;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .key-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 4px;
        }

        .key-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 8.5pt;
          display: flex;
          justify-content: space-between;
        }

        .exam-footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="screen-toolbar">
        <button class="btn-print" onclick="window.print()">📥 حفظ كملف PDF / طباعة</button>
        <button class="btn-print" style="background:#475569;" onclick="window.close()">إغلاق ✖</button>
      </div>

      <div style="padding: 15px;">
        <div class="exam-header">
          <div>
            <h1 class="main-title">${title || 'اختبار تدريب القدرات والتحصيلي'}</h1>
            <p class="sub-title">منصة تدريب القدرات والتحصيلي • نموذج اختبار رسمي</p>
          </div>
          <div class="header-meta-box">
            <div><strong>عدد الأسئلة:</strong> ${questions.length} سؤال</div>
            <div><strong>تاريخ الاستخراج:</strong> ${currentDate}</div>
          </div>
        </div>

        <div class="student-info-bar">
          <div>اسم الطالب: ${studentName || '___________________________'}</div>
          <div>الدرجة: ________ / ${questions.length}</div>
          <div>زمن الإجابة: ____________ دقيقة</div>
        </div>

        <div class="questions-list">
          ${questionsHtml}
        </div>

        ${answerKeyHtml}

        <div class="exam-footer">
          تم استخراج هذا الاختبار عبر منصة تدريب القدرات والتحصيلي • بالتوفيق والدرجات العليا
        </div>
      </div>

      <script>
        window.addEventListener('DOMContentLoaded', function() {
          setTimeout(function() {
            try {
              window.focus();
              window.print();
            } catch(e) {}
          }, 350);
        });
      </script>
    </body>
    </html>
  `;

  // 1. Try window.open
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printDocumentHtml);
    printWindow.document.close();
    return;
  }

  // 2. Fallback iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100px';
  iframe.style.height = '100px';
  iframe.style.opacity = '0.01';
  iframe.style.zIndex = '-999';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(printDocumentHtml);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print error:', err);
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 60000);
    }
  }, 400);
}
