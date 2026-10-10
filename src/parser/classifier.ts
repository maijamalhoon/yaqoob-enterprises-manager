/**
 * Deterministic Transaction Classifier
 * Applies business logic, conflict detection, confirmation triggers,
 * and safety policies to normalized input.
 */

import { NormalizedLine } from './normalizer';
import { MatchResult, matchCategoryOrAction, SeedCategory, SEED_CATEGORIES } from './matcher';
import { TransactionType } from '../types/ledger';

export type ClassificationAction =
  | 'auto_save'
  | 'needs_confirmation'
  | 'ask_clarification'
  | 'review_queue';

export interface ClarificationOption {
  label: string;
  type: TransactionType;
  categoryId?: string | null;
  categoryName?: string;
  amountPaisa: number;
  note?: string;
  isExpense?: boolean;
}

export interface ParseResult {
  raw: string;
  action: ClassificationAction;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  amountPaisa: number | null;
  businessDate: string;
  note: string | null;
  adjustmentDir?: 'in' | 'out' | null;
  reason?: string;
  clarificationPrompt?: string;
  options?: ClarificationOption[];
  isFuzzyOrPhonetic?: boolean;
  suggestedAlias?: string;
  isDuplicate?: boolean;
  isUnusualAmount?: boolean;
  isConflict?: boolean;
  canAutoSave: boolean;
}

export interface RecentTransactionContext {
  categoryId?: string | null;
  amountPaisa: number;
  entryTimeUtc: string; // ISO 8601
  type: TransactionType;
}

/**
 * Classifies a normalized line into an actionable ParseResult.
 */
export function classifyNormalizedLine(
  norm: NormalizedLine,
  recentTransactions: RecentTransactionContext[] = [],
  currentTime: Date = new Date(),
  categories: SeedCategory[] = SEED_CATEGORIES
): ParseResult {
  const raw = norm.raw;
  const businessDate = norm.dateChip!;
  const amountPaisa = norm.amountPaisa;

  // 1. Missing amount guard
  if (amountPaisa === null || amountPaisa <= 0) {
    return {
      raw,
      action: 'ask_clarification',
      type: 'income',
      categoryId: null,
      categoryName: null,
      amountPaisa: null,
      businessDate,
      note: norm.cleanedText || null,
      clarificationPrompt: 'No valid amount found. Please enter an amount (e.g. PRINT 300).',
      canAutoSave: false,
    };
  }

  // 2. Ambiguous "kal" guard: user prompt specifically commands: NO "kal" (ambiguous)
  if (norm.hasAmbiguousKal) {
    return {
      raw,
      action: 'ask_clarification',
      type: 'income',
      categoryId: null,
      categoryName: null,
      amountPaisa,
      businessDate,
      note: raw,
      clarificationPrompt: '"kal" is ambiguous (can mean yesterday or tomorrow). Did you mean yesterday or today?',
      options: [
        {
          label: 'Yesterday',
          type: 'income',
          amountPaisa,
          note: norm.cleanedText,
        },
        {
          label: 'Today',
          type: 'income',
          amountPaisa,
          note: norm.cleanedText,
        },
      ],
      canAutoSave: false,
    };
  }

  // 3. Bare numbers: e.g. "10000" or "Rs 500" with no category word
  if (norm.isBareNumber || norm.words.length === 0) {
    return {
      raw,
      action: 'ask_clarification',
      type: norm.explicitSign === '-' ? 'expense' : 'income',
      categoryId: null,
      categoryName: null,
      amountPaisa,
      businessDate,
      note: null,
      clarificationPrompt: `Bare number entered. What is this Rs ${(amountPaisa / 100).toLocaleString()} for?`,
      options: [
        { label: 'Income', type: 'income', amountPaisa },
        { label: 'Expense', type: 'expense', amountPaisa },
        { label: 'Capital In', type: 'capital_in', amountPaisa },
        { label: 'Withdrawal', type: 'withdrawal', amountPaisa },
        { label: 'Adjustment', type: 'adjustment', amountPaisa },
      ],
      canAutoSave: false,
    };
  }

  // 4. Match against categories and system actions
  const match: MatchResult = matchCategoryOrAction(norm.cleanedText, categories);

  // 5. System Action Handling (Capital In, Withdrawal, Adjustment)
  // RULE: Capital, withdrawal and adjustment entries ALWAYS show a confirmation card.
  if (match.systemAction) {
    const sys = match.systemAction;
    return {
      raw,
      action: 'needs_confirmation',
      type: sys.type,
      categoryId: null,
      categoryName: sys.name,
      amountPaisa,
      businessDate,
      note: norm.cleanedText,
      reason: `${sys.name} entry requires confirmation before saving.`,
      canAutoSave: false,
    };
  }

  // 6. Unknown Category Words
  if (match.quality === 'none' || !match.category) {
    return {
      raw,
      action: 'ask_clarification',
      type: norm.explicitSign === '-' ? 'expense' : 'income',
      categoryId: null,
      categoryName: null,
      amountPaisa,
      businessDate,
      note: norm.cleanedText,
      clarificationPrompt: `Unknown category "${norm.cleanedText}". How should we record Rs ${(amountPaisa / 100).toLocaleString()}?`,
      options: [
        {
          label: `Income (${norm.cleanedText})`,
          type: 'income',
          amountPaisa,
          note: norm.cleanedText,
        },
        {
          label: `Expense (${norm.cleanedText})`,
          type: 'expense',
          amountPaisa,
          note: norm.cleanedText,
        },
        {
          label: 'Capital In',
          type: 'capital_in',
          amountPaisa,
          note: norm.cleanedText,
        },
        {
          label: 'Withdrawal',
          type: 'withdrawal',
          amountPaisa,
          note: norm.cleanedText,
        },
      ],
      canAutoSave: false,
    };
  }

  const category = match.category;

  // 7. Fuzzy or Phonetic Match
  // RULE: "EVERY fuzzy/phonetic match asks 'Did you mean?' first, then the confirmed alias is learned."
  if (!match.isExact) {
    const suggestedType: TransactionType = category.kind;
    return {
      raw,
      action: 'ask_clarification',
      type: suggestedType,
      categoryId: category.id,
      categoryName: category.name,
      amountPaisa,
      businessDate,
      note: norm.cleanedText,
      isFuzzyOrPhonetic: true,
      suggestedAlias: match.matchedAlias,
      clarificationPrompt: `Did you mean "${category.name}" (${match.quality} match for "${norm.cleanedText}")?`,
      options: [
        {
          label: `Yes, ${category.name} (${category.kind})`,
          type: category.kind,
          categoryId: category.id,
          categoryName: category.name,
          amountPaisa,
        },
        {
          label: 'Different Category',
          type: 'income',
          amountPaisa,
        },
      ],
      canAutoSave: false,
    };
  }

  // 8. Sign vs Category Conflict Detection
  // RULE: "Always ask: sign vs category conflicts ('PAPER 2000')"
  // If category is expense (e.g. Paper Stock, Shop Supplies, Stamp Purchase),
  // but user typed it without an explicit minus sign (e.g. "PAPER 2000" or "+PAPER 2000"),
  // or if category is income (Printing, Stamp, Lamination) and typed with a minus sign ("-PRINT 300").
  if (category.kind === 'expense') {
    if (norm.explicitSign !== '-') {
      // Conflict: Expense category typed without a minus sign or with a plus sign
      return {
        raw,
        action: 'ask_clarification',
        type: 'expense',
        categoryId: category.id,
        categoryName: category.name,
        amountPaisa,
        businessDate,
        note: norm.cleanedText,
        isConflict: true,
        clarificationPrompt: `"${category.name}" is an expense category, but was typed without a minus sign. Is this an expense or a refund/income?`,
        options: [
          {
            label: `Expense: Rs ${(amountPaisa / 100).toLocaleString()}`,
            type: 'expense',
            categoryId: category.id,
            categoryName: category.name,
            amountPaisa,
            isExpense: true,
          },
          {
            label: `Income: Rs ${(amountPaisa / 100).toLocaleString()}`,
            type: 'income',
            categoryId: category.id,
            categoryName: category.name,
            amountPaisa,
            isExpense: false,
          },
        ],
        canAutoSave: false,
      };
    }
  } else if (category.kind === 'income') {
    if (norm.explicitSign === '-') {
      // Conflict: Income category typed with a minus sign
      return {
        raw,
        action: 'ask_clarification',
        type: 'expense',
        categoryId: category.id,
        categoryName: category.name,
        amountPaisa,
        businessDate,
        note: norm.cleanedText,
        isConflict: true,
        clarificationPrompt: `"${category.name}" is an income category, but was typed with a minus sign (-). Is this an expense/refund or income?`,
        options: [
          {
            label: `Expense / Refund: Rs ${(amountPaisa / 100).toLocaleString()}`,
            type: 'expense',
            categoryId: category.id,
            categoryName: category.name,
            amountPaisa,
          },
          {
            label: `Income: Rs ${(amountPaisa / 100).toLocaleString()}`,
            type: 'income',
            categoryId: category.id,
            categoryName: category.name,
            amountPaisa,
          },
        ],
        canAutoSave: false,
      };
    }
  }

  // 9. Unusual Amount Check
  // RULE: "unusual amounts (per-category editable limit, default Rs 50,000)"
  const unusualLimit = category.unusualLimitPaisa || 5000000;
  if (amountPaisa > unusualLimit) {
    return {
      raw,
      action: 'needs_confirmation',
      type: category.kind,
      categoryId: category.id,
      categoryName: category.name,
      amountPaisa,
      businessDate,
      note: norm.cleanedText,
      isUnusualAmount: true,
      reason: `Amount Rs ${(amountPaisa / 100).toLocaleString()} exceeds the usual limit of Rs ${(unusualLimit / 100).toLocaleString()} for ${category.name}.`,
      canAutoSave: false,
    };
  }

  // 10. Duplicate Check within ~3 minutes
  // RULE: "possible duplicates within ~3 minutes (including entries by another user)"
  const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;
  const currentMs = currentTime.getTime();
  const isDuplicate = recentTransactions.some((tx) => {
    const txMs = new Date(tx.entryTimeUtc).getTime();
    return (
      Math.abs(currentMs - txMs) <= DUPLICATE_WINDOW_MS &&
      tx.amountPaisa === amountPaisa &&
      (tx.categoryId === category.id || (!tx.categoryId && tx.type === category.kind))
    );
  });

  if (isDuplicate) {
    return {
      raw,
      action: 'needs_confirmation',
      type: category.kind,
      categoryId: category.id,
      categoryName: category.name,
      amountPaisa,
      businessDate,
      note: norm.cleanedText,
      isDuplicate: true,
      reason: `Possible duplicate entry: Another Rs ${(amountPaisa / 100).toLocaleString()} ${category.name} was entered in the last 3 minutes.`,
      canAutoSave: false,
    };
  }

  // 11. Exact Known Alias + Consistent Type = Auto-Save with 6-second Undo Toast
  return {
    raw,
    action: 'auto_save',
    type: category.kind,
    categoryId: category.id,
    categoryName: category.name,
    amountPaisa,
    businessDate,
    note: norm.cleanedText,
    canAutoSave: true,
  };
}
