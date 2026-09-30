import { Question, OPTION_LABELS } from '../types/quiz';

export interface PDFExportOptions {
  questions: Question[];
  title: string;
  includeHints?: boolean;
  includeAnswerKey?: boolean;
  studentName?: string;
}

/**
 * Generates an official, print-ready A4 exam document and triggers browser Print-to-PDF
 */
export function printExamAsPDF({
  questions,
  title,
  includeHints = true,
  includeAnswerKey = true,
  studentName = ''
}: PDFExportOptions) {
  // Create hidden iframe to render the printable document
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Failed to create printing iframe');
    return;
  }

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
          <span class="option-text">${opt || '-'}</span>
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
          <div class="hint-content">${q.hint.replace(/\n/g, '<br/>')}</div>
        </div>
      `;
    }

    return `
      <div class="question-card">
        <div class="question-header">
          <span class="q-number">السؤال (${qNum})</span>
          ${q.category ? `<span class="q-category">${q.category}</span>` : ''}
        </div>
        <div class="question-text">${q.question}</div>
        ${mediaHtml}
        <div class="options-grid">
          ${optionsHtml}
        </div>
        ${hintHtml}
      </div>
    `;
  }).join('');

  // Answer key summary table HTML
  let answerKeyHtml = '';
  if (includeAnswerKey) {
    const keyRows = questions.map((q, idx) => `
      <div class="key-cell">
        <span class="key-q">س (${idx + 1}):</span>
        <span class="key-a">${OPTION_LABELS[q.answer]}</span>
      </div>
    `).join('');

    answerKeyHtml = `
      <div class="answer-key-section">
        <h3 class="section-title">جدول مفتاح الإجابات النموذجية</h3>
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
      <meta charset="UTF-8" />
      <title>${title || 'اختبار قدرات وتحصيلي'}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm 15mm 15mm;
          @bottom-center {
            content: counter(page) " / " counter(pages);
            font-size: 9pt;
            font-family: system-ui, sans-serif;
            color: #64748b;
          }
        }
        
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tahoma", sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          font-size: 10.5pt;
          direction: rtl;
        }

        /* Exam Header */
        .exam-header {
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title-box {
          flex: 1;
        }

        .main-title {
          font-size: 16pt;
          font-weight: 800;
          color: #047857;
          margin: 0 0 4px 0;
        }

        .sub-title {
          font-size: 9.5pt;
          color: #475569;
          margin: 0;
        }

        .header-meta-box {
          text-align: left;
          font-size: 9pt;
          color: #334155;
          min-width: 180px;
        }

        .student-info-bar {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 14px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          font-size: 9.5pt;
          font-weight: 600;
        }

        /* Question Cards */
        .question-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 14px;
          background: #ffffff;
          page-break-inside: avoid;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .q-number {
          font-weight: 800;
          font-size: 11pt;
          color: #065f46;
          background: #ecfdf5;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #a7f3d0;
        }

        .q-category {
          font-size: 8.5pt;
          color: #475569;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .question-text {
          font-size: 11pt;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 10px;
          white-space: pre-line;
        }

        /* Media / Diagrams */
        .media-container {
          text-align: center;
          margin: 10px 0;
          padding: 6px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
        }

        .question-image {
          max-height: 190px;
          max-width: 90%;
          object-contain: contain;
          border-radius: 4px;
        }

        .svg-container svg {
          max-height: 160px;
          max-width: 100%;
        }

        /* Options Grid */
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 12px;
          margin-top: 8px;
        }

        .option-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fafafa;
          font-size: 9.5pt;
        }

        .option-item.correct-option {
          border-color: #10b981;
          background: #ecfdf5;
          font-weight: 700;
          color: #065f46;
        }

        .option-label {
          font-weight: 800;
          color: #0f172a;
        }

        .correct-badge {
          margin-right: auto;
          font-size: 7.5pt;
          color: #059669;
          background: #d1fae5;
          padding: 1px 5px;
          border-radius: 3px;
        }

        /* Hint Box */
        .hint-box {
          margin-top: 10px;
          padding: 8px 10px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          font-size: 8.5pt;
          color: #78350f;
          page-break-inside: avoid;
        }

        .hint-title {
          font-weight: 700;
          margin-bottom: 2px;
          color: #b45309;
        }

        .hint-content {
          font-family: inherit;
        }

        /* Answer Key */
        .answer-key-section {
          margin-top: 24px;
          padding: 14px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          page-break-inside: avoid;
        }

        .section-title {
          font-size: 11pt;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 10px 0;
          text-align: center;
        }

        .key-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .key-cell {
          background: #ffffff;
          border: 1px solid #94a3b8;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 9pt;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .key-q {
          color: #475569;
        }

        .key-a {
          font-weight: 800;
          color: #059669;
        }

        /* Footer */
        .exam-footer {
          margin-top: 24px;
          text-align: center;
          font-size: 8.5pt;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="exam-header">
        <div class="header-title-box">
          <h1 class="main-title">${title || 'اختبار تدريب القدرات والتحصيلي'}</h1>
          <p class="sub-title">منصة تدريب القدرات والتحصيلي • نموذج اختبار رسمي جاهز للطباعة والحل</p>
        </div>
        <div class="header-meta-box">
          <div><strong>عدد الأسئلة:</strong> ${questions.length} سؤال</div>
          <div><strong>تاريخ الاستخراج:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="student-info-bar">
        <div>اسم الطالب: ___________________________</div>
        <div>الدرجة: ________ / ${questions.length}</div>
        <div>زمن الإجابة: ____________ دقيقة</div>
      </div>

      <div class="questions-list">
        ${questionsHtml}
      </div>

      ${answerKeyHtml}

      <div class="exam-footer">
        تم استخراج وتجهيز هذا الاختبار عبر منصة تدريب طلاب القدرات والتحصيلي • بالتوفيق والدرجات العليا إن شاء الله
      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(printDocumentHtml);
  doc.close();

  // Allow images and fonts to render, then open the print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print error:', err);
    } finally {
      // Remove iframe after user finishes printing or cancelling
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 60000);
    }
  }, 500);
}
