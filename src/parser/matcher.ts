/**
 * Category & Keyword Matcher
 * Matches normalized tokens against system categories, known aliases,
 * length-scaled fuzzy distance, and phonetic heuristics.
 */

import { getAllowedFuzzyDistance, levenshteinDistance } from './distance';
import { isPhoneticMatch } from './phonetic';
import { CategoryKind, TransactionType } from '../types/ledger';

export interface SeedCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  aliases: string[];
  unusualLimitPaisa: number;
}

export interface SystemActionKeyword {
  type: TransactionType; // capital_in, withdrawal, adjustment
  name: string;
  aliases: string[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: 'cat-printing',
    name: 'Printing',
    kind: 'income',
    aliases: ['PRINT', 'PRNT', 'PRINTING', 'PHOTOCOPY', 'COPY', 'PHOTOSTATE', 'XEROX'],
    unusualLimitPaisa: 5000000, // Rs 50,000
  },
  {
    id: 'cat-stamp-income',
    name: 'Legal Stamp Paper',
    kind: 'income',
    // STAMP amounts are recorded EXACTLY as typed, as income.
    aliases: ['STAMP', 'STMP', 'STAMPS', 'LEGAL STAMP', 'STAMP PAPER'],
    unusualLimitPaisa: 5000000,
  },
  {
    id: 'cat-lamination',
    name: 'Lamination',
    kind: 'income',
    aliases: ['LAMINATION', 'LMNYON', 'LMNATION', 'LAM', 'LAMNATION'],
    unusualLimitPaisa: 5000000,
  },
  {
    id: 'cat-paper-stock',
    name: 'Paper Stock',
    kind: 'expense',
    aliases: ['PAPER', 'PAPR', 'A4 PAPER', 'RIM', 'REAMS', 'PAPER STOCK'],
    unusualLimitPaisa: 5000000,
  },
  {
    id: 'cat-shop-supplies',
    name: 'Shop Supplies & Bills',
    kind: 'expense',
    aliases: ['BILL', 'SUPPLIES', 'ELECTRICITY', 'BIJLI', 'CHAI', 'TEA', 'CLEANING', 'SNACKS'],
    unusualLimitPaisa: 5000000,
  },
  {
    id: 'cat-stamp-purchase',
    name: 'Stamp Paper Purchase',
    kind: 'expense',
    aliases: ['STAMP PURCHASE', 'STAMP BUY', 'BUY STAMP', 'PURCHASE STAMP'],
    unusualLimitPaisa: 5000000,
  },
];

export const SYSTEM_KEYWORDS: SystemActionKeyword[] = [
  {
    type: 'capital_in',
    name: 'Capital In',
    aliases: ['CAPITAL', 'INVESTMENT', 'CASH IN', 'OWNER CAPITAL'],
  },
  {
    type: 'withdrawal',
    name: 'Withdrawal',
    aliases: ['WITHDRAW', 'WITHDRAWAL', 'DRAW', 'OWNER DRAW', 'KHARCHA', 'PERSONAL'],
  },
  {
    type: 'adjustment',
    name: 'Adjustment',
    aliases: ['ADJUST', 'ADJUSTMENT', 'CORRECTION', 'DIFF', 'ERROR ADJUST'],
  },
];

export type MatchQuality = 'exact' | 'fuzzy' | 'phonetic' | 'none';

export interface MatchResult {
  quality: MatchQuality;
  isExact: boolean;
  category?: SeedCategory;
  systemAction?: SystemActionKeyword;
  matchedAlias?: string;
  queryText: string;
}

/**
 * Searches for a matching category or system action from words/phrase
 */
export function matchCategoryOrAction(
  phrase: string,
  categories: SeedCategory[] = SEED_CATEGORIES,
  systemActions: SystemActionKeyword[] = SYSTEM_KEYWORDS
): MatchResult {
  const query = phrase.trim().toUpperCase();
  if (!query) {
    return { quality: 'none', isExact: false, queryText: '' };
  }

  // 1. Check exact matches for system actions first
  for (const sys of systemActions) {
    for (const alias of sys.aliases) {
      if (query === alias || query.startsWith(alias + ' ') || query.endsWith(' ' + alias)) {
        return {
          quality: 'exact',
          isExact: true,
          systemAction: sys,
          matchedAlias: alias,
          queryText: query,
        };
      }
    }
  }

  // 2. Check multi-word exact matches for categories (e.g. "STAMP PURCHASE")
  for (const cat of categories) {
    for (const alias of cat.aliases) {
      if (query === alias) {
        return {
          quality: 'exact',
          isExact: true,
          category: cat,
          matchedAlias: alias,
          queryText: query,
        };
      }
    }
  }

  // Check if any alias is contained as a distinct word in the query
  const words = query.split(/\s+/);
  for (const cat of categories) {
    for (const alias of cat.aliases) {
      if (!alias.includes(' ')) {
        if (words.includes(alias)) {
          return {
            quality: 'exact',
            isExact: true,
            category: cat,
            matchedAlias: alias,
            queryText: query,
          };
        }
      }
    }
  }

  // 3. Length-scaled Fuzzy Matching
  // Rule: length <= 3: exact only (0 edits)
  // 4 - 6: max 1 edit
  // > 6: max 2 edits
  let bestFuzzyMatch: { cat?: SeedCategory; sys?: SystemActionKeyword; alias: string; distance: number } | null = null;

  for (const w of words) {
    const allowedDist = getAllowedFuzzyDistance(w.length);
    if (allowedDist === 0) continue; // Words <= 3 do not participate in fuzzy edits

    for (const cat of categories) {
      for (const alias of cat.aliases) {
        if (alias.includes(' ')) continue;
        const dist = levenshteinDistance(w, alias);
        if (dist <= allowedDist && (!bestFuzzyMatch || dist < bestFuzzyMatch.distance)) {
          bestFuzzyMatch = { cat, alias, distance: dist };
        }
      }
    }

    for (const sys of systemActions) {
      for (const alias of sys.aliases) {
        if (alias.includes(' ')) continue;
        const dist = levenshteinDistance(w, alias);
        if (dist <= allowedDist && (!bestFuzzyMatch || dist < bestFuzzyMatch.distance)) {
          bestFuzzyMatch = { sys, alias, distance: dist };
        }
      }
    }
  }

  if (bestFuzzyMatch) {
    return {
      quality: 'fuzzy',
      isExact: false,
      category: bestFuzzyMatch.cat,
      systemAction: bestFuzzyMatch.sys,
      matchedAlias: bestFuzzyMatch.alias,
      queryText: query,
    };
  }

  // 4. Phonetic Matching (Soundex / Metaphone)
  for (const w of words) {
    if (w.length < 3) continue;
    for (const cat of categories) {
      for (const alias of cat.aliases) {
        if (isPhoneticMatch(w, alias)) {
          return {
            quality: 'phonetic',
            isExact: false,
            category: cat,
            matchedAlias: alias,
            queryText: query,
          };
        }
      }
    }
  }

  return { quality: 'none', isExact: false, queryText: query };
}
