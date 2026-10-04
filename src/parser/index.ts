/**
 * Yaqoob Enterprises Deterministic Parser Orchestrator
 * Pure TypeScript, zero external AI APIs, 100% deterministic local parser.
 */

import { splitLines, normalizeLine, NormalizedLine } from './normalizer';
import {
  classifyNormalizedLine,
  ParseResult,
  RecentTransactionContext,
} from './classifier';
import { SeedCategory, SEED_CATEGORIES } from './matcher';

export interface BatchParseResult {
  isBatch: boolean;
  rawInput: string;
  entries: ParseResult[];
  canSaveAll: boolean;
  hasErrorsOrConflicts: boolean;
}

function splitCompoundLine(line: string, referenceDate: Date): string[] {
  const parts = line.split(/\s+(?:and|aur)\s+/i).map((part) => part.trim());
  if (parts.length < 2) return [line];

  const eachPartHasOneAmount = parts.every((part) => {
    const normalized = normalizeLine(part, referenceDate);
    return normalized.amountPaisa !== null && !/\d/.test(normalized.cleanedText);
  });

  return eachPartHasOneAmount ? parts : [line];
}

/**
 * Parses user message (single-line or multi-line) into classified entries.
 */
export function parseMessage(
  input: string,
  recentTransactions: RecentTransactionContext[] = [],
  referenceDate: Date = new Date(),
  categories: SeedCategory[] = SEED_CATEGORIES
): BatchParseResult {
  const lines = splitLines(input).flatMap((line) => splitCompoundLine(line, referenceDate));

  if (lines.length === 0) {
    return {
      isBatch: false,
      rawInput: input,
      entries: [],
      canSaveAll: false,
      hasErrorsOrConflicts: false,
    };
  }

  const entries: ParseResult[] = lines.map((line) => {
    const norm = normalizeLine(line, referenceDate);
    return classifyNormalizedLine(norm, recentTransactions, referenceDate, categories);
  });

  const isBatch = entries.length > 1;
  const hasErrorsOrConflicts = entries.some(
    (e) => e.action === 'ask_clarification' || e.action === 'needs_confirmation'
  );
  const canSaveAll = entries.every((e) => e.action === 'auto_save');

  return {
    isBatch,
    rawInput: input,
    entries,
    canSaveAll,
    hasErrorsOrConflicts,
  };
}

export * from './distance';
export * from './phonetic';
export * from './normalizer';
export * from './matcher';
export * from './classifier';
