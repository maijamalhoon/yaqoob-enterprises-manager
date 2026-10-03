/**
 * Ledger Service
 * High-performance data client for modern Yaqoob Enterprises Ledger.
 * Integrates with Supabase, handles RLS, Realtime broadcasts, and IndexedDB offline fallback.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  Transaction,
  DailySummary,
  MonthlySummary,
  CategoryBreakdown,
  ReviewQueueItem,
  Category,
} from '../types/ledger';
import { getKarachiBusinessDate } from '../lib/dates';
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  dequeueOfflineTransaction,
  QueuedTransaction,
} from './offlineQueue';

export interface CreateTransactionPayload {
  type: 'income' | 'expense' | 'capital_in' | 'withdrawal' | 'adjustment';
  amountPaisa: number;
  categoryId: string | null;
  categoryName?: string;
  adjustmentDir?: 'in' | 'out' | null;
  businessDate?: string;
  note?: string | null;
  rawText: string;
  createdByName: string;
  device?: string;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
  searchQuery?: string;
  status?: 'active' | 'voided' | 'all';
  limit?: number;
  offset?: number;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class LedgerService {
  private static instance: LedgerService;

  public static getInstance(): LedgerService {
    if (!LedgerService.instance) {
      LedgerService.instance = new LedgerService();
    }
    return LedgerService.instance;
  }

  /**
   * Records a new transaction. If offline or Supabase fails, enqueues to IndexedDB.
   */
  async recordTransaction(
    payload: CreateTransactionPayload,
    userId: string
  ): Promise<{ transaction: Partial<Transaction>; isQueuedOffline: boolean }> {
    const supabase = getSupabaseClient();
    const id = generateUUID();
    const idempotencyKey = `tx-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const businessDate = payload.businessDate || getKarachiBusinessDate();
    const deviceEntryTime = new Date().toISOString();

    const record = {
      id,
      type: payload.type,
      amount_paisa: payload.amountPaisa,
      category_id: payload.categoryId,
      adjustment_dir: payload.adjustmentDir || null,
      business_date: businessDate,
      device_entry_time: deviceEntryTime,
      note: payload.note || null,
      raw_text: payload.rawText,
      status: 'active' as const,
      idempotency_key: idempotencyKey,
      created_by: userId,
      created_by_name: payload.createdByName,
      device: payload.device || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'web'),
    };

    // If offline or Supabase not configured, enqueue immediately
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline || !isSupabaseConfigured()) {
      await enqueueOfflineTransaction({
        id,
        idempotencyKey,
        type: payload.type,
        amountPaisa: payload.amountPaisa,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        businessDate,
        deviceEntryTime,
        note: payload.note,
        rawText: payload.rawText,
        createdByName: payload.createdByName,
        adjustmentDir: payload.adjustmentDir,
        status: 'queued',
        attempts: 0,
        createdAt: Date.now(),
      });
      return { transaction: record, isQueuedOffline: true };
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(record)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return { transaction: data, isQueuedOffline: false };
    } catch (err) {
      console.warn('Network error recording transaction, falling back to offline queue:', err);
      await enqueueOfflineTransaction({
        id,
        idempotencyKey,
        type: payload.type,
        amountPaisa: payload.amountPaisa,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        businessDate,
        deviceEntryTime,
        note: payload.note,
        rawText: payload.rawText,
        createdByName: payload.createdByName,
        adjustmentDir: payload.adjustmentDir,
        status: 'queued',
        attempts: 1,
        createdAt: Date.now(),
      });
      return { transaction: record, isQueuedOffline: true };
    }
  }

  /**
   * Flushes queued transactions from IndexedDB to Supabase
   */
  async flushOfflineQueue(): Promise<{ syncedCount: number; errors: any[] }> {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: [] };

    const supabase = getSupabaseClient();
    let syncedCount = 0;
    const errors: any[] = [];

    for (const item of queue) {
      try {
        const payload = {
          id: item.id,
          type: item.type,
          amount_paisa: item.amountPaisa,
          category_id: item.categoryId,
          adjustment_dir: item.adjustmentDir || null,
          business_date: item.businessDate,
          device_entry_time: item.deviceEntryTime,
          note: item.note || null,
          raw_text: item.rawText,
          status: 'active',
          idempotency_key: item.idempotencyKey,
          created_by_name: item.createdByName,
        };

        const { error } = await supabase
          .from('transactions')
          .upsert(payload, { onConflict: 'idempotency_key' });

        if (error) {
          throw error;
        }

        await dequeueOfflineTransaction(item.idempotencyKey);
        syncedCount++;
      } catch (err) {
        console.error(`Failed to flush queued transaction ${item.idempotencyKey}:`, err);
        errors.push(err);
      }
    }

    return { syncedCount, errors };
  }

  /**
   * Fetches transactions for a specific business date (defaults to today Karachi)
   */
  async getTransactionsForDate(dateStr: string = getKarachiBusinessDate()): Promise<Transaction[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('business_date', dateStr)
      .order('device_entry_time', { ascending: true });

    if (error) {
      console.error('Error fetching transactions for date:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      category_name: row.categories?.name || undefined,
    }));
  }

  /**
   * Fetches daily summary from security_invoker view
   */
  async getDailySummary(dateStr: string = getKarachiBusinessDate()): Promise<DailySummary> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('view_daily_summary')
      .select('*')
      .eq('business_date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('Error fetching daily summary:', error);
    }

    if (!data) {
      return {
        business_date: dateStr,
        income_paisa: 0,
        expense_paisa: 0,
        net_profit_paisa: 0,
        capital_in_paisa: 0,
        withdrawal_paisa: 0,
        adjustment_in_paisa: 0,
        adjustment_out_paisa: 0,
        transaction_count: 0,
      };
    }

    return {
      business_date: data.business_date,
      income_paisa: Number(data.income_paisa || 0),
      expense_paisa: Number(data.expense_paisa || 0),
      net_profit_paisa: Number(data.net_profit_paisa || 0),
      capital_in_paisa: Number(data.capital_in_paisa || 0),
      withdrawal_paisa: Number(data.withdrawal_paisa || 0),
      adjustment_in_paisa: Number(data.adjustment_in_paisa || 0),
      adjustment_out_paisa: Number(data.adjustment_out_paisa || 0),
      transaction_count: Number(data.transaction_count || 0),
    };
  }

  /**
   * Fetches historical transactions with filtering and pagination
   */
  async getFilteredTransactions(filter: TransactionFilter = {}): Promise<{ transactions: Transaction[]; count: number }> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('transactions')
      .select('*, categories(name)', { count: 'exact' });

    if (filter.startDate) {
      query = query.gte('business_date', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('business_date', filter.endDate);
    }
    if (filter.type && filter.type !== 'all') {
      query = query.eq('type', filter.type);
    }
    if (filter.categoryId && filter.categoryId !== 'all') {
      query = query.eq('category_id', filter.categoryId);
    }
    if (filter.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter.searchQuery) {
      query = query.ilike('raw_text', `%${filter.searchQuery}%`);
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    query = query
      .order('device_entry_time', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching filtered transactions:', error);
      return { transactions: [], count: 0 };
    }

    const transactions = (data || []).map((row: any) => ({
      ...row,
      category_name: row.categories?.name || undefined,
    }));

    return { transactions, count: count || 0 };
  }

  /**
   * Voids an active transaction (requires a non-empty reason)
   */
  async voidTransaction(id: string, reason: string, currentUpdatedAt: string): Promise<boolean> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Void reason is mandatory');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'voided',
        void_reason: reason.trim(),
        voided_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt);

    if (error) {
      console.error('Error voiding transaction:', error);
      throw error;
    }

    return true;
  }

  /**
   * Restores a previously voided transaction
   */
  async restoreTransaction(id: string, currentUpdatedAt: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'active',
        void_reason: null,
        voided_at: null,
        voided_by: null,
      })
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt);

    if (error) {
      console.error('Error restoring transaction:', error);
      throw error;
    }

    return true;
  }

  /**
   * Updates an editable transaction with optimistic concurrency
   */
  async editTransaction(
    id: string,
    updates: { amount_paisa?: number; note?: string | null; category_id?: string | null },
    currentUpdatedAt: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt);

    if (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }

    return true;
  }

  /**
   * Review Queue: Parks unhandled or skipped entry
   */
  async parkInReviewQueue(
    rawText: string,
    reason: string,
    userId: string,
    suggested?: { categoryId?: string; categoryName?: string; amountPaisa?: number }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('review_queue').insert({
      id: generateUUID(),
      raw_text: rawText,
      reason,
      suggested_category_id: suggested?.categoryId || null,
      suggested_category_name: suggested?.categoryName || null,
      suggested_amount_paisa: suggested?.amountPaisa || null,
      created_by: userId,
      status: 'pending',
    });
  }

  /**
   * Review Queue: Fetch pending items
   */
  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('review_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching review queue:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Review Queue: Resolve or dismiss item
   */
  async updateReviewQueueStatus(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('review_queue')
      .update({ status })
      .eq('id', id);
  }

  /**
   * Categories: Fetch all active categories
   */
  async getCategories(): Promise<Category[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Categories: Learn / save new alias
   */
  async learnAlias(categoryId: string, alias: string): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('category_aliases').insert({
      id: generateUUID(),
      category_id: categoryId,
      alias: alias.trim().toUpperCase(),
      match_count: 1,
    });
  }

  /**
   * Realtime: Subscribe to live transaction events across all 3 brothers
   */
  subscribeToLiveTransactions(onPayload: (payload: any) => void): () => void {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('public:transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          onPayload(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const ledgerService = LedgerService.getInstance();
