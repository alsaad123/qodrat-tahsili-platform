/**
 * Utilities for Arabic text handling in Qudurat and Tahsili exams.
 * Includes bidirectional reversal fix, digits normalization, and cleaner regexes.
 */

// Common Arabic words that appear reversed in badly-encoded PDF text
const KNOWN_REVERSED_TOKENS = [
  'تارادق', // قدرات
  'ليصحت', // تحصيل
  'لاؤس', // سؤال
  'باوج', // جواب
  'رايخ', // خيار
  'ةباجا', // اجابة
  'ةلوطخ', // خطوة
  'لحلا', // الحل
  'دحاو', // واحد
  'نينثا', // اثنين
];

/**
 * Checks if the text likely has reversed Arabic words due to PDF extraction quirks
 */
export function isArabicLikelyReversed(text: string): boolean {
  if (!text) return false;
  let matches = 0;
  for (const token of KNOWN_REVERSED_TOKENS) {
    if (text.includes(token)) {
      matches++;
    }
  }
  return matches >= 2;
}

/**
 * Reverses a string correctly (respecting combining characters where feasible)
 */
export function reverseArabicString(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Reverses line-by-line or token-by-token if Arabic is inverted
 */
export function fixReversedArabicText(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => {
      // If line has predominantly Arabic characters, reverse it
      const arabicChars = (line.match(/[\u0600-\u06FF]/g) || []).length;
      if (arabicChars > line.length * 0.35) {
        // Reverse tokens or characters
        return reverseArabicString(line);
      }
      return line;
    })
    .join('\n');
}

/**
 * Normalize Arabic digits (١, ٢, ٣, ٤...) to western digits (1, 2, 3, 4...)
 */
export function normalizeArabicDigits(text: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = text;
  arabicDigits.forEach((d, i) => {
    res = res.replaceAll(d, i.toString());
  });
  return res;
}

/**
 * Normalize option letters (أ, ا, ب, ج, د)
 */
export function parseOptionLetterToIndex(letter: string): number | null {
  const clean = letter.trim().toLowerCase();
  if (clean === 'أ' || clean === 'ا' || clean === 'a' || clean === '1' || clean === '١') return 0;
  if (clean === 'ب' || clean === 'b' || clean === '2' || clean === '٢') return 1;
  if (clean === 'ج' || clean === 'c' || clean === '3' || clean === '٣') return 2;
  if (clean === 'د' || clean === 'd' || clean === '4' || clean === '٤') return 3;
  return null;
}
