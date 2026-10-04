/**
 * Ledger Service
 * High-performance data client for modern Yaqoob Enterprises Ledger.
 * Integrates with Supabase, handles RLS, Realtime broadcasts, and IndexedDB offline fallback.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getSecurityPrincipal } from '../lib/security';
import {
  Transaction,
  DailySummary,
  MonthlySummary,
  CategoryBreakdown,
  ReviewQueueItem,
  Category,
  AccountLedgerEntry,
  LedgerAccount,
} from '../types/ledger';
import { getKarachiBusinessDate } from '../lib/dates';
import { SEED_CATEGORIES, SeedCategory } from '../parser/matcher';
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
  accountId: string;
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

function queuedTransactionToLedgerTransaction(item: QueuedTransaction): Transaction {
  return {
    id: item.id,
    type: item.type as Transaction['type'],
    amount_paisa: item.amountPaisa,
    category_id: item.categoryId,
    category_name: item.categoryName,
    account_id: item.accountId || '',
    adjustment_dir: item.adjustmentDir,
    business_date: item.businessDate,
    device_entry_time: item.deviceEntryTime,
    note: item.note || null,
    raw_text: item.rawText,
    status: 'active',
    idempotency_key: item.idempotencyKey,
    created_by: item.createdBy || '',
    created_by_name: item.createdByName,
    device: 'offline',
    created_at: '',
    updated_at: '',
  };
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
    const principal = getSecurityPrincipal();
    const createdBy = principal?.id || userId;
    if (!payload.accountId) throw new Error('Choose an account before saving this transaction.');
    if (!principal) throw new Error('Sign in to a shop before saving this transaction.');

    const record = {
      id,
      organization_id: principal.organizationId,
      type: payload.type,
      amount_paisa: payload.amountPaisa,
      category_id: payload.categoryId,
      account_id: payload.accountId,
      adjustment_dir: payload.adjustmentDir || null,
      business_date: businessDate,
      device_entry_time: deviceEntryTime,
      note: payload.note || null,
      raw_text: payload.rawText,
      status: 'active' as const,
      idempotency_key: idempotencyKey,
      created_by: createdBy,
      created_by_name: payload.createdByName,
      device: payload.device || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'web'),
    };

    // If offline or Supabase not configured, enqueue immediately
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline || !isSupabaseConfigured()) {
      await enqueueOfflineTransaction({
        id,
        idempotencyKey,
        organizationId: principal?.organizationId,
        createdBy,
        accountId: payload.accountId,
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
        organizationId: principal?.organizationId,
        createdBy,
        accountId: payload.accountId,
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
    const principal = getSecurityPrincipal();
    const accounts = queue.some((item) => !item.accountId)
      ? await this.getPaymentAccounts()
      : [];
    const defaultAccountId = accounts.find((account) => account.is_default)?.id;
    let syncedCount = 0;
    const errors: any[] = [];

    for (const item of queue) {
      try {
        const organizationId = item.organizationId || principal?.organizationId;
        const createdBy = item.createdBy || principal?.id;
        const accountId = item.accountId || defaultAccountId;
        if (!organizationId || !createdBy || !accountId || organizationId !== principal?.organizationId) {
          throw new Error('Queued transaction is missing its original shop or creator and cannot be synced safely.');
        }

        const payload = {
          id: item.id,
          organization_id: organizationId,
          account_id: accountId,
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
          created_by: createdBy,
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
    const accounts = await this.getPaymentAccounts().catch(() => []);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name), payment_accounts(name)')
      .eq('business_date', dateStr)
      .order('device_entry_time', { ascending: true });

    if (error) {
      console.error('Error fetching transactions for date:', error);
    }

    const cloudTransactions = (data || []).map((row: any) => ({
      ...row,
      category_name: row.categories?.name || undefined,
      account_name: row.payment_accounts?.name || undefined,
    }));
    const queuedTransactions = await this.getQueuedTransactionsForDate(dateStr);
    const cloudIds = new Set(cloudTransactions.map((transaction) => transaction.id));

    return [
      ...cloudTransactions,
      ...queuedTransactions
        .filter((item) => !cloudIds.has(item.id))
        .map((item) => ({
          ...queuedTransactionToLedgerTransaction(item),
          account_name: accounts.find((account) => account.id === item.accountId)?.name,
        })),
    ].sort((a, b) => a.device_entry_time.localeCompare(b.device_entry_time));
  }

  private async getQueuedTransactionsForDate(dateStr: string): Promise<QueuedTransaction[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];

    const queue = await getOfflineQueue();
    return queue.filter(
      (item) =>
        item.businessDate === dateStr &&
        item.organizationId === principal.organizationId &&
        item.createdBy === principal.id,
    );
  }

  async getPendingTransactionCount(): Promise<number> {
    const principal = getSecurityPrincipal();
    if (!principal) return 0;

    const queue = await getOfflineQueue();
    return queue.filter(
      (item) =>
        item.organizationId === principal.organizationId &&
        item.createdBy === principal.id,
    ).length;
  }

  async getPaymentAccounts(): Promise<LedgerAccount[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];

    const { data, error } = await getSupabaseClient()
      .from('payment_accounts')
      .select('*')
      .eq('organization_id', principal.organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((account: any) => ({
      ...account,
      balance_paisa: Number(account.balance_paisa ?? Math.round(Number(account.current_balance || 0) * 100)),
      current_balance: Number(account.current_balance || 0),
      opening_balance: Number(account.opening_balance || 0),
      is_default: Boolean(account.is_default),
      is_active: Boolean(account.is_active),
    }));
  }

  async createPaymentAccount(input: {
    name: string;
    type: LedgerAccount['type'];
    openingBalancePaisa: number;
  }): Promise<LedgerAccount> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to manage shop accounts.');
    if (!input.name.trim()) throw new Error('Enter an account name.');
    if (!Number.isSafeInteger(input.openingBalancePaisa) || input.openingBalancePaisa < 0) {
      throw new Error('Enter a valid opening balance.');
    }

    const openingBalance = input.openingBalancePaisa / 100;
    const { data, error } = await getSupabaseClient()
      .from('payment_accounts')
      .insert({
        organization_id: principal.organizationId,
        name: input.name.trim(),
        type: input.type,
        current_balance: openingBalance,
        opening_balance: openingBalance,
        is_active: true,
        is_default: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return {
      ...data,
      balance_paisa: Number(data.balance_paisa ?? input.openingBalancePaisa),
      current_balance: Number(data.current_balance || 0),
      opening_balance: Number(data.opening_balance || 0),
      is_active: Boolean(data.is_active),
      is_default: Boolean(data.is_default),
    };
  }

  async updatePaymentAccount(
    accountId: string,
    changes: { name?: string; is_active?: boolean },
  ): Promise<void> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to manage shop accounts.');
    if (changes.name !== undefined && !changes.name.trim()) {
      throw new Error('Account name cannot be empty.');
    }

    const { data, error } = await getSupabaseClient()
      .from('payment_accounts')
      .update({ ...changes, name: changes.name?.trim() })
      .eq('id', accountId)
      .eq('organization_id', principal.organizationId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Account could not be updated. Refresh and try again.');
  }

  async transferBetweenAccounts(input: {
    fromAccountId: string;
    toAccountId: string;
    amountPaisa: number;
    notes?: string;
  }): Promise<void> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to transfer shop funds.');
    if (!input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId) {
      throw new Error('Choose different source and destination accounts.');
    }
    if (!Number.isSafeInteger(input.amountPaisa) || input.amountPaisa <= 0) {
      throw new Error('Enter a valid transfer amount.');
    }

    const { error } = await getSupabaseClient()
      .from('account_transfers')
      .insert({
        id: generateUUID(),
        idempotency_key: generateUUID(),
        organization_id: principal.organizationId,
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId,
        amount: input.amountPaisa / 100,
        date: getKarachiBusinessDate(),
        notes: input.notes?.trim() || null,
        created_by: principal.id,
      });
    if (error) throw error;
  }

  async getAccountLedger(accountId: string): Promise<AccountLedgerEntry[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];
    const { data, error } = await getSupabaseClient()
      .from('account_ledger_entries')
      .select('*')
      .eq('organization_id', principal.organizationId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map((entry: any) => ({
      ...entry,
      amount_paisa: Number(entry.amount_paisa),
      balance_after_paisa: Number(entry.balance_after_paisa),
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

    const summary: DailySummary = {
      business_date: data?.business_date || dateStr,
      income_paisa: Number(data?.income_paisa || 0),
      expense_paisa: Number(data?.expense_paisa || 0),
      net_profit_paisa: Number(data?.net_profit_paisa || 0),
      capital_in_paisa: Number(data?.capital_in_paisa || 0),
      withdrawal_paisa: Number(data?.withdrawal_paisa || 0),
      adjustment_in_paisa: Number(data?.adjustment_in_paisa || 0),
      adjustment_out_paisa: Number(data?.adjustment_out_paisa || 0),
      transaction_count: Number(data?.transaction_count || 0),
    };

    const queuedTransactions = await this.getQueuedTransactionsForDate(dateStr);
    for (const transaction of queuedTransactions) {
      if (transaction.type === 'income') {
        summary.income_paisa += transaction.amountPaisa;
        summary.net_profit_paisa += transaction.amountPaisa;
      } else if (transaction.type === 'expense') {
        summary.expense_paisa += transaction.amountPaisa;
        summary.net_profit_paisa -= transaction.amountPaisa;
      } else if (transaction.type === 'capital_in') {
        summary.capital_in_paisa += transaction.amountPaisa;
      } else if (transaction.type === 'withdrawal') {
        summary.withdrawal_paisa += transaction.amountPaisa;
      } else if (transaction.type === 'adjustment' && transaction.adjustmentDir === 'in') {
        summary.adjustment_in_paisa += transaction.amountPaisa;
      } else if (transaction.type === 'adjustment' && transaction.adjustmentDir === 'out') {
        summary.adjustment_out_paisa += transaction.amountPaisa;
      }
      summary.transaction_count += 1;
    }

    return summary;
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
      throw error;
    }

    const transactions = (data || []).map((row: any) => ({
      ...row,
      category_name: row.categories?.name || undefined,
    }));

    return { transactions, count: count || 0 };
  }

  async getAllFilteredTransactions(
    filter: Omit<TransactionFilter, 'limit' | 'offset'> = {}
  ): Promise<Transaction[]> {
    const pageSize = 1000;
    const transactions: Transaction[] = [];
    let offset = 0;
    let count = 0;

    do {
      const page = await this.getFilteredTransactions({ ...filter, limit: pageSize, offset });
      count = page.count;
      if (page.transactions.length === 0 && offset < count) {
        throw new Error('The export stopped before all matching records were retrieved.');
      }
      transactions.push(...page.transactions);
      offset += page.transactions.length;
    } while (offset < count);

    return transactions;
  }

  /**
   * Voids an active transaction (requires a non-empty reason)
   */
  async voidTransaction(id: string, reason: string, currentUpdatedAt: string): Promise<boolean> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Void reason is mandatory');
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'voided',
        void_reason: reason.trim(),
        voided_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error voiding transaction:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Transaction was not found or has changed since it was loaded. Refresh and try again.');
    }

    return true;
  }

  /**
   * Restores a previously voided transaction
   */
  async restoreTransaction(id: string, currentUpdatedAt: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'active',
        void_reason: null,
        voided_at: null,
        voided_by: null,
      })
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error restoring transaction:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Transaction was not found or has changed since it was loaded. Refresh and try again.');
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
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('updated_at', currentUpdatedAt)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Transaction was not found or has changed since it was loaded. Refresh and try again.');
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

  async getParserCategories(): Promise<SeedCategory[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];

    const cacheKey = `shop-pro:parser-categories:${principal.organizationId}`;
    const readCache = (): SeedCategory[] => {
      try {
        const cached = localStorage.getItem(cacheKey);
        return cached ? JSON.parse(cached) as SeedCategory[] : [];
      } catch {
        return [];
      }
    };

    try {
      const supabase = getSupabaseClient();
      const [categoryResult, aliasResult] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, kind, unusual_amount_limit_paisa')
          .eq('organization_id', principal.organizationId)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('category_aliases')
          .select('category_id, alias')
          .eq('organization_id', principal.organizationId),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (aliasResult.error) throw aliasResult.error;

      const aliases = new Map<string, string[]>();
      for (const row of aliasResult.data || []) {
        const existing = aliases.get(row.category_id) || [];
        existing.push(row.alias);
        aliases.set(row.category_id, existing);
      }

      const categories = (categoryResult.data || []).map((category) => {
        const matchingSeed = SEED_CATEGORIES.find(
          (seed) => seed.name.toLowerCase() === category.name.toLowerCase(),
        );
        const categoryAliases = [
          category.name,
          ...(aliases.get(category.id) || []),
          ...(matchingSeed?.aliases || []),
        ];
        return {
          id: category.id,
          name: category.name,
          kind: category.kind,
          aliases: [...new Set(categoryAliases)],
          unusualLimitPaisa: Number(category.unusual_amount_limit_paisa || 5000000),
        } satisfies SeedCategory;
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify(categories));
      } catch {
        // The cloud category list remains available for this session.
      }
      return categories;
    } catch (error) {
      console.warn('Using cached shop categories for offline entry:', error);
      return readCache();
    }
  }

  /**
   * Categories: Learn / save new alias
   */
  async learnAlias(categoryId: string, alias: string): Promise<void> {
    const supabase = getSupabaseClient();
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('An active shop is required to save an alias.');
    await supabase.from('category_aliases').insert({
      id: generateUUID(),
      organization_id: principal.organizationId,
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
