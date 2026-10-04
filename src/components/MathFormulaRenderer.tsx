import React, { useMemo } from 'react';
import katex from 'katex';

interface MathFormulaRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

/**
 * Checks if a string contains KaTeX/LaTeX delimiters like $...$ or \frac
 */
function hasLatex(text: string): boolean {
  return (
    text.includes('$') ||
    text.includes('\\frac') ||
    text.includes('\\sqrt') ||
    text.includes('\\times') ||
    text.includes('\\pm') ||
    text.includes('\\approx')
  );
}

/**
 * Renders LaTeX blocks using KaTeX with fallback
 */
function renderKaTeX(formula: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false
    });
  } catch {
    return formula;
  }
}

/**
 * Parses and renders Chemical Formulas with subscripts & superscripts
 * e.g. H2O -> H₂O, CO2 -> CO₂, Ca(OH)2 -> Ca(OH)₂, SO4^2- -> SO₄²⁻
 */
function renderChemicalFormula(token: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /([A-Z][a-z]?|\(|\)|\[|\])|(\d+)|(\^[+\-\d]+|[+\-]{1,2})/g;
  let match;
  let key = 0;

  while ((match = regex.exec(token)) !== null) {
    if (match[1]) {
      // Element symbol or bracket
      parts.push(<span key={key++}>{match[1]}</span>);
    } else if (match[2]) {
      // Subscript number (e.g. 2 in H2O)
      parts.push(
        <sub key={key++} className="text-[0.75em] leading-none font-semibold px-0.2">
          {match[2]}
        </sub>
      );
    } else if (match[3]) {
      // Charge or superscript (e.g. 2- or +)
      const charge = match[3].replace('^', '');
      parts.push(
        <sup key={key++} className="text-[0.72em] leading-none font-bold text-indigo-600 dark:text-indigo-400">
          {charge}
        </sup>
      );
    }
  }

  return <span className="font-mono tracking-tight font-medium inline-block" dir="ltr">{parts}</span>;
}

/**
 * Replace common physics and math textual abbreviations with clean symbols
 */
function normalizeMathSymbols(str: string): string {
  return str
    .replace(/\bدلتا\b/g, 'Δ')
    .replace(/\bأوم\b/g, 'Ω')
    .replace(/\bباي\b/g, 'π')
    .replace(/\bمايكرو\b/g, 'μ')
    .replace(/\bميكرو\b/g, 'μ')
    .replace(/<=\b/g, '≤')
    .replace(/>=\b/g, '≥')
    .replace(/!=\b/g, '≠')
    .replace(/\+-/g, '±');
}

/**
 * Smart Arabic Math & Science Formatter:
 * 1. True vertical stacked fractions:
 *    - (num) / (den)
 *    - (num) / den (e.g. (٤^٤ + ٤^٤) / ٤)
 *    - num / (den)
 *    - num / den (e.g. 3/4, ٤/٥, س/ص)
 * 2. Exponents: س^2, ب^3, ٤^٤, 10^-3, (س+1)^2
 * 3. Roots: √(x), جذر(x), \sqrt{x}
 * 4. Chemistry: H2O, CO2, H2SO4, Ca(OH)2
 * 5. KaTeX LaTeX blocks: $...$ or $$...$$
 */
export const MathFormulaRenderer: React.FC<MathFormulaRendererProps> = ({
  text,
  className = '',
  inline: _inline = false
}) => {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return null;

    let processedText = normalizeMathSymbols(text);

    // Auto-wrap standalone \frac{...}{...} or \sqrt{...} if not wrapped in $
    if (!processedText.includes('$') && (processedText.includes('\\frac') || processedText.includes('\\sqrt'))) {
      processedText = processedText.replace(/(\\(?:frac|sqrt)\{[^{}]+\}(?:\{[^{}]+\})?)/g, '$$$1$$');
    }

    // 1. If text contains explicit KaTeX/LaTeX ($...$ or $$...$$)
    if (hasLatex(processedText)) {
      const segments = processedText.split(/(\$\$[\s\S]+?\$\$|\$.+?\$)/g);
      return (
        <span className={className}>
          {segments.map((seg, idx) => {
            if (seg.startsWith('$$') && seg.endsWith('$$')) {
              const raw = seg.slice(2, -2).trim();
              const html = renderKaTeX(raw, true);
              return (
                <span
                  key={idx}
                  className="block my-2 text-center"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } else if (seg.startsWith('$') && seg.endsWith('$')) {
              const raw = seg.slice(1, -1).trim();
              const html = renderKaTeX(raw, false);
              return (
                <span
                  key={idx}
                  className="inline-block mx-1"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            }
            // Normal text part inside LaTeX segment
            return <React.Fragment key={idx}>{renderSmartArabicMath(seg)}</React.Fragment>;
          })}
        </span>
      );
    }

    // 2. Otherwise: parse using Smart Arabic Math & Science Parser
    return renderSmartArabicMath(processedText);
  }, [text, className]);

  return <span className={`math-formula-container inline ${className}`}>{renderedContent}</span>;
};

/**
 * Parse and render Arabic Math Fractions, Exponents, Roots, and Chemistry
 */
function renderSmartArabicMath(str: string): React.ReactNode {
  if (!str) return null;

  // Unified Fraction Regex:
  // Matches:
  // - (Numerator) / (Denominator)
  // - (Numerator) / Denominator   <-- e.g. (٤^٤ + ٤^٤) / ٤
  // - Numerator / (Denominator)   <-- e.g. 1 / (س + 1)
  // - Numerator / Denominator     <-- e.g. 3/4, ٤/٥, س/ص
  const fractionRegex = /(?:\(([^)]+)\)|([٠-٩0-9a-zA-Zأ-ي]+(?:\^[٠-٩0-9a-zA-Zأ-ي]+)?))\s*[\/÷]\s*(?:\(([^)]+)\)|([٠-٩0-9a-zA-Zأ-ي]+(?:\^[٠-٩0-9a-zA-Zأ-ي]+)?))/g;

  if (fractionRegex.test(str)) {
    fractionRegex.lastIndex = 0;
    const pieces: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let counter = 0;

    while ((match = fractionRegex.exec(str)) !== null) {
      // Exclude dates like 2024/10/05
      const isDate = Boolean(
        match[2] &&
        match[4] &&
        /^\d{4}$/.test(match[2]) &&
        /^\/\d+/.test(str.slice(match.index + match[0].length))
      );
      if (isDate) {
        continue;
      }

      if (match.index > lastIndex) {
        pieces.push(
          <React.Fragment key={`text-${counter++}`}>
            {renderSubFormulas(str.substring(lastIndex, match.index))}
          </React.Fragment>
        );
      }

      const num = (match[1] || match[2]).trim();
      const den = (match[3] || match[4]).trim();

      pieces.push(
        <span
          key={`frac-${counter++}`}
          className="inline-flex flex-col items-center justify-center align-middle mx-1.5 my-0.5 text-center font-bold select-none text-[0.95em] leading-none group"
          style={{ verticalAlign: 'middle' }}
        >
          {/* Numerator (البسط) */}
          <span className="px-1.5 py-0.5 leading-tight text-slate-900 dark:text-slate-100">
            {renderSubFormulas(num)}
          </span>
          {/* Solid Fraction Line */}
          <span className="w-full min-w-[18px] h-[1.5px] bg-slate-700 dark:bg-slate-300 rounded-[1px]" />
          {/* Denominator (المقام) */}
          <span className="px-1.5 py-0.5 leading-tight text-slate-800 dark:text-slate-200">
            {renderSubFormulas(den)}
          </span>
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < str.length) {
      pieces.push(
        <React.Fragment key={`text-${counter++}`}>
          {renderSubFormulas(str.substring(lastIndex))}
        </React.Fragment>
      );
    }

    return pieces;
  }

  return renderSubFormulas(str);
}

/**
 * Handles:
 * - Exponents: س^2, ب^3, ٤^٤, 10^5, (س+1)^2, x^2
 * - Roots: √(x), √16, جذر(x), جذر(25)
 * - Chemistry formulas: H2O, CO2, H2SO4, Ca(OH)2
 */
function renderSubFormulas(str: string): React.ReactNode {
  if (!str) return null;

  // Split text by exponent patterns, root patterns, or chemistry formulas
  const tokenRegex = /((?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\))\^\-?(?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\))|√(?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\))|جذر(?:[٠-٩0-9a-zA-Zأ-ي]+|\([^)]+\))|\b[A-Z][a-z]?(?:[A-Za-z0-9]|\([A-Za-z0-9]+\)\d*)*\d+[A-Za-z0-9]*\b)/g;

  const parts = str.split(tokenRegex);

  let keyCounter = 0;
  return parts.map((part) => {
    keyCounter++;
    if (!part) return null;

    // A) Exponents (e.g. ٤^٤, س^2, ب^3, (س+ص)^2)
    if (part.includes('^')) {
      const [base, exp] = part.split('^');
      return (
        <span key={keyCounter} className="inline-block mx-0.5 font-bold">
          <span>{base}</span>
          <sup className="text-[0.72em] font-extrabold text-[#3b4cb8] dark:text-indigo-400 mx-0.5 leading-none">
            {exp}
          </sup>
        </span>
      );
    }

    // B) Square root: √(x), √16, جذر(x), جذر(25)
    if (part.startsWith('√(') && part.endsWith(')')) {
      const inner = part.slice(2, -1);
      return (
        <span key={keyCounter} className="inline-flex items-center align-middle mx-1 font-bold">
          <span className="text-base text-[#3b4cb8] dark:text-indigo-400">√</span>
          <span className="border-t-2 border-current px-1 text-[0.95em]">{inner}</span>
        </span>
      );
    } else if (part.startsWith('√')) {
      const inner = part.slice(1);
      return (
        <span key={keyCounter} className="inline-flex items-center align-middle mx-1 font-bold">
          <span className="text-base text-[#3b4cb8] dark:text-indigo-400">√</span>
          <span className="border-t-2 border-current px-1 text-[0.95em]">{inner}</span>
        </span>
      );
    } else if (part.startsWith('جذر(') && part.endsWith(')')) {
      const inner = part.slice(4, -1);
      return (
        <span key={keyCounter} className="inline-flex items-center align-middle mx-1 font-bold">
          <span className="text-base text-[#3b4cb8] dark:text-indigo-400">√</span>
          <span className="border-t-2 border-current px-1 text-[0.95em]">{inner}</span>
        </span>
      );
    } else if (part.startsWith('جذر')) {
      const inner = part.slice(3);
      return (
        <span key={keyCounter} className="inline-flex items-center align-middle mx-1 font-bold">
          <span className="text-base text-[#3b4cb8] dark:text-indigo-400">√</span>
          <span className="border-t-2 border-current px-1 text-[0.95em]">{inner}</span>
        </span>
      );
    }

    // C) Chemical Formula (e.g. H2O, CO2, H2SO4, Ca(OH)2)
    if (/^[A-Z][a-z]?/.test(part) && /\d/.test(part)) {
      return <React.Fragment key={keyCounter}>{renderChemicalFormula(part)}</React.Fragment>;
    }

    // D) Regular text
    return (
      <span key={keyCounter}>
        {part}
      </span>
    );
  });
}
