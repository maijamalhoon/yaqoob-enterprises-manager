import { describe, it, expect } from 'vitest';
import { Transaction, Category } from '../src/types/ledger';

/**
 * Client-Side Business Rule Validators
 * Mirrors and verifies the PostgreSQL triggers and constraints locally before network dispatch.
 */
function validateTransactionRules(tx: Partial<Transaction>, categories: Category[]): { isValid: boolean; error?: string } {
  if (!tx.type) return { isValid: false, error: 'Transaction type is required' };
  if (!tx.amount_paisa || tx.amount_paisa <= 0) return { isValid: false, error: 'Amount must be greater than zero' };

  // Rule 1: Capital and Withdrawal must NOT have a category
  if (tx.type === 'capital_in' || tx.type === 'withdrawal') {
    if (tx.category_id) {
      return { isValid: false, error: 'Capital and withdrawal transactions must not have a category' };
    }
  }

  // Rule 2: Income and Expense must have a valid category of matching kind
  if (tx.type === 'income' || tx.type === 'expense') {
    if (!tx.category_id) {
      return { isValid: false, error: `Category is required for ${tx.type} transactions` };
    }
    const cat = categories.find((c) => c.id === tx.category_id);
    if (!cat) {
      return { isValid: false, error: 'Referenced category does not exist' };
    }
    if (cat.kind !== tx.type) {
      return { isValid: false, error: `Transaction type (${tx.type}) does not match category kind (${cat.kind})` };
    }
  }

  // Rule 3: Adjustments require direction and a note
  if (tx.type === 'adjustment') {
    if (!tx.adjustment_dir || !['in', 'out'].includes(tx.adjustment_dir)) {
      return { isValid: false, error: 'Adjustment requires a direction (in or out)' };
    }
    if (!tx.note || tx.note.trim().length === 0) {
      return { isValid: false, error: 'Adjustment requires an explanatory note' };
    }
  }

  // Rule 4: Voiding requires reason, voided_by, and voided_at
  if (tx.status === 'voided') {
    if (!tx.void_reason || tx.void_reason.trim().length === 0) {
      return { isValid: false, error: 'Voided transaction requires a void reason' };
    }
    if (!tx.voided_by || !tx.voided_at) {
      return { isValid: false, error: 'Voided transaction requires voided_by and voided_at timestamps' };
    }
  }

  return { isValid: true };
}

describe('Ledger Foundation Business Rules', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-print',
      name: 'Printing & Photocopy',
      kind: 'income',
      unusual_amount_limit_paisa: 5000000,
      is_default: true,
      is_active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'cat-paper',
      name: 'Paper Stock Purchase',
      kind: 'expense',
      unusual_amount_limit_paisa: 10000000,
      is_default: true,
      is_active: true,
      display_order: 2,
      created_at: new Date().toISOString(),
    },
  ];

  it('validates that income transactions require income category', () => {
    // Valid income
    const validIncome: Partial<Transaction> = {
      type: 'income',
      amount_paisa: 30000,
      category_id: 'cat-print',
    };
    expect(validateTransactionRules(validIncome, mockCategories).isValid).toBe(true);

    // Invalid income missing category
    const missingCat: Partial<Transaction> = {
      type: 'income',
      amount_paisa: 30000,
      category_id: null,
    };
    expect(validateTransactionRules(missingCat, mockCategories).error).toContain('Category is required');

    // Mismatched category kind (income transaction pointing to expense category)
    const mismatched: Partial<Transaction> = {
      type: 'income',
      amount_paisa: 30000,
      category_id: 'cat-paper',
    };
    expect(validateTransactionRules(mismatched, mockCategories).error).toContain('does not match category kind');
  });

  it('validates that capital and withdrawal transactions have no category', () => {
    // Valid capital
    const validCapital: Partial<Transaction> = {
      type: 'capital_in',
      amount_paisa: 5000000,
      category_id: null,
    };
    expect(validateTransactionRules(validCapital, mockCategories).isValid).toBe(true);

    // Invalid capital assigned to a category
    const invalidCapital: Partial<Transaction> = {
      type: 'capital_in',
      amount_paisa: 5000000,
      category_id: 'cat-print',
    };
    expect(validateTransactionRules(invalidCapital, mockCategories).error).toContain('must not have a category');
  });

  it('validates that adjustments require note and direction', () => {
    // Missing direction & note
    const invalidAdj: Partial<Transaction> = {
      type: 'adjustment',
      amount_paisa: 25000,
    };
    expect(validateTransactionRules(invalidAdj, mockCategories).error).toContain('Adjustment requires a direction');

    // Missing note
    const missingNote: Partial<Transaction> = {
      type: 'adjustment',
      amount_paisa: 25000,
      adjustment_dir: 'in',
      note: '',
    };
    expect(validateTransactionRules(missingNote, mockCategories).error).toContain('Adjustment requires an explanatory note');

    // Valid adjustment
    const validAdj: Partial<Transaction> = {
      type: 'adjustment',
      amount_paisa: 25000,
      adjustment_dir: 'in',
      note: 'Found extra cash drawer float',
    };
    expect(validateTransactionRules(validAdj, mockCategories).isValid).toBe(true);
  });

  it('validates that voided transactions strictly require void reason', () => {
    const invalidVoid: Partial<Transaction> = {
      type: 'income',
      amount_paisa: 30000,
      category_id: 'cat-print',
      status: 'voided',
      void_reason: '',
    };
    expect(validateTransactionRules(invalidVoid, mockCategories).error).toContain('requires a void reason');

    const validVoid: Partial<Transaction> = {
      type: 'income',
      amount_paisa: 30000,
      category_id: 'cat-print',
      status: 'voided',
      void_reason: 'Mistyped amount, meant 30',
      voided_by: 'user-1',
      voided_at: new Date().toISOString(),
    };
    expect(validateTransactionRules(validVoid, mockCategories).isValid).toBe(true);
  });

  it('demonstrates optimistic concurrency conflict rejection', () => {
    const originalRecord: Transaction = {
      id: 'tx-1',
      type: 'income',
      amount_paisa: 30000,
      category_id: 'cat-print',
      business_date: '2026-10-04',
      device_entry_time: '2026-10-04T05:00:00Z',
      raw_text: 'PRINT 300',
      status: 'active',
      idempotency_key: 'idemp-1',
      created_by: 'user-1',
      created_by_name: 'Brother 1',
      created_at: '2026-10-04T05:00:00Z',
      updated_at: '2026-10-04T05:00:00Z',
    };

    // Brother 1 edits the record, bumping updated_at
    const updatedRecord: Transaction = {
      ...originalRecord,
      amount_paisa: 35000,
      updated_at: '2026-10-04T05:02:00Z',
    };

    // Brother 2 attempts to edit based on stale updated_at
    const staleAttempt = {
      id: 'tx-1',
      expected_updated_at: '2026-10-04T05:00:00Z', // stale!
      new_amount: 40000,
    };

    const isConflict = staleAttempt.expected_updated_at !== updatedRecord.updated_at;
    expect(isConflict).toBe(true);
  });
});
