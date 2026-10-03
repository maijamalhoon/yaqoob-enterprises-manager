/**
 * Input Normalizer for Yaqoob Enterprises Ledger
 * Cleans user messages, extracts currency symbols, separators, and date chips.
 */

import { getKarachiBusinessDate, getYesterdayKarachiDate } from '../lib/dates';

export interface NormalizedLine {
  raw: string;
  cleanedText: string;
  amountPaisa: number | null;
  explicitSign: '+' | '-' | null;
  dateChip: string | null; // YYYY-MM-DD
  hasAmbiguousKal: boolean;
  isBareNumber: boolean;
  words: string[];
}

/**
 * Splits multi-line raw user input into non-empty lines
 */
export function splitLines(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Normalizes a single line of input:
 * - Identifies explicit sign (+ or -)
 * - Strips currency indicators (Rs., Rs, PKR, /-, =/-)
 * - Identifies and extracts numbers (handling commas like 12,500)
 * - Identifies date chips (yesterday, ISO date, DD/MM/YYYY)
 * - Detects ambiguous "kal"
 */
export function normalizeLine(rawLine: string, referenceDate: Date = new Date()): NormalizedLine {
  const original = rawLine.trim();
  let text = original;

  // 1. Detect explicit sign (+ or -)
  let explicitSign: '+' | '-' | null = null;
  // Match signs preceding numbers or standalone
  // e.g. "- 2000", "-2000", "+ 500", "PAPER - 2000", "PRINT +300"
  if (/(?:^|\s)-(\s*\d|\s+[a-zA-Z])/.test(text) || text.startsWith('-')) {
    explicitSign = '-';
  } else if (/(?:^|\s)\+(\s*\d|\s+[a-zA-Z])/.test(text) || text.startsWith('+')) {
    explicitSign = '+';
  }

  // 2. Detect ambiguous "kal"
  // If user typed "kal", prompt explicitly forbids it: "NO 'kal' (ambiguous)"
  const hasAmbiguousKal = /\bkal\b/i.test(text);

  // 3. Extract date chips ("yesterday", YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY)
  let dateChip: string | null = null;
  const yesterdayMatch = /\byesterday\b/i.test(text);
  if (yesterdayMatch) {
    dateChip = getYesterdayKarachiDate(referenceDate);
    text = text.replace(/\byesterday\b/gi, ' ');
  } else {
    // Check for explicit ISO date: 2026-10-02
    const isoDateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      dateChip = isoDateMatch[1];
      text = text.replace(isoDateMatch[0], ' ');
    } else {
      // Check for DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
      if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3];
        dateChip = `${y}-${m}-${d}`;
        text = text.replace(dmyMatch[0], ' ');
      }
    }
  }

  // If no date chip found, default is today in Karachi
  if (!dateChip) {
    dateChip = getKarachiBusinessDate(referenceDate);
  }

  // 4. Remove currency indicators & trailing symbols
  // Examples: Rs., Rs, RS, PKR, pkr, /- , =/-, =
  text = text.replace(/\b(rs\.?|pkr|rp)\b/gi, ' ');
  text = text.replace(/[=/]-/g, ' ');
  text = text.replace(/=/g, ' ');

  // 5. Extract amount
  // Clean commas inside numbers first: 12,500 -> 12500
  text = text.replace(/(\d+),(\d+)/g, '$1$2');

  // Find candidate numbers (possibly with decimals: 50.50, 100, 2000)
  // Look for numbers preceded optionally by a sign
  const numberRegex = /[+-]?\s*(\d+(?:\.\d{1,2})?)/g;
  let matches: RegExpExecArray[] | null = null;
  const numbers: { val: number; raw: string; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(text)) !== null) {
    const rawNum = match[0];
    const parsedVal = parseFloat(match[1]);
    if (!isNaN(parsedVal) && parsedVal > 0) {
      numbers.push({ val: parsedVal, raw: rawNum, index: match.index });
    }
  }

  let amountPaisa: number | null = null;
  if (numbers.length > 0) {
    // Usually the largest or last number is the amount if multiple, or the primary number
    // In shop logs like "PRINT 300", 300 is the amount.
    const chosen = numbers[numbers.length - 1];
    amountPaisa = Math.round(chosen.val * 100);
    // Remove the number from the remaining text
    text = text.slice(0, chosen.index) + ' ' + text.slice(chosen.index + chosen.raw.length);
  }

  // 6. Clean residual symbols and whitespace
  // Remove +, -, punctuation
  text = text.replace(/[+\-:;,/()]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  // Words list (uppercase for uniform matching)
  const words = text
    .split(' ')
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length > 0 && !['RS', 'PKR', 'RP'].includes(w));

  const isBareNumber = words.length === 0 && amountPaisa !== null;

  return {
    raw: original,
    cleanedText: words.join(' '),
    amountPaisa,
    explicitSign,
    dateChip,
    hasAmbiguousKal,
    isBareNumber,
    words,
  };
}
