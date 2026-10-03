/**
 * Modern Shop Ledger Core Domain Types
 */

export type TransactionType = 'income' | 'expense' | 'capital_in' | 'withdrawal' | 'adjustment';

export type TransactionStatus = 'active' | 'voided';

export type CategoryKind = 'income' | 'expense';

export type AdjustmentDirection = 'in' | 'out';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  unusual_amount_limit_paisa: number; // in integer paisa (default 5,000,000 = Rs 50,000)
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface CategoryAlias {
  id: string;
  category_id: string;
  alias: string;
  match_count: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount_paisa: number; // BigInt in DB, number in JS (safe up to 90 trillion paisa / 900 billion rupees)
  category_id: string | null;
  category_name?: string;
  adjustment_dir?: AdjustmentDirection | null;
  business_date: string; // YYYY-MM-DD in Asia/Karachi
  device_entry_time: string; // ISO 8601 UTC
  note?: string | null;
  raw_text: string;
  status: TransactionStatus;
  void_reason?: string | null;
  voided_by?: string | null;
  voided_at?: string | null;
  idempotency_key: string;
  created_by: string;
  created_by_name: string;
  device?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  transaction_id: string;
  action: 'create' | 'edit' | 'void' | 'restore';
  old_data: Partial<Transaction> | null;
  new_data: Partial<Transaction> | null;
  changed_by: string;
  changed_by_name: string;
  created_at: string;
}

export interface ReviewQueueItem {
  id: string;
  raw_text: string;
  reason: string;
  suggested_category_id?: string | null;
  suggested_category_name?: string | null;
  suggested_amount_paisa?: number | null;
  created_by: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface DailySummary {
  business_date: string;
  income_paisa: number;
  expense_paisa: number;
  net_profit_paisa: number;
  capital_in_paisa: number;
  withdrawal_paisa: number;
  adjustment_in_paisa: number;
  adjustment_out_paisa: number;
  transaction_count: number;
}

export interface MonthlySummary {
  month_start: string;
  year: number;
  month: number;
  income_paisa: number;
  expense_paisa: number;
  net_profit_paisa: number;
  capital_in_paisa: number;
  withdrawal_paisa: number;
  adjustment_in_paisa: number;
  adjustment_out_paisa: number;
}

export interface CategoryBreakdown {
  business_date: string;
  type: TransactionType;
  category_id: string;
  category_name: string;
  total_paisa: number;
  entry_count: number;
}
