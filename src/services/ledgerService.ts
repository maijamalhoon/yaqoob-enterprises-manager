/**
 * Ledger Service
 * High-performance data client for modern Yaqoob Enterprises Ledger.
 * Integrates with Supabase, handles RLS, Realtime broadcasts, and IndexedDB offline fallback.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getSecurityPrincipal, requirePermission } from '../lib/security';
import {
  Transaction,
  DailySummary,
  MonthlySummary,
  CategoryBreakdown,
  ReviewQueueItem,
  Category,
  AccountLedgerEntry,
  LedgerAccount,
  TransactionDraft,
} from '../types/ledger';
import { getKarachiBusinessDate } from '../lib/dates';
import { SEED_CATEGORIES, SeedCategory } from '../parser/matcher';
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  dequeueOfflineTransaction,
  markOfflineTransactionFailed,
  QueuedTransaction,
} from './offlineQueue';
import {
  cacheAccounts,
  enqueueOfflineAccountOperation,
  getCachedAccounts,
  getOfflineAccountOperations,
  OfflineAccountOperation,
  replaceCachedAccounts,
  removeOfflineAccountOperation,
} from './offlineAccountStore';
import {
  getOfflineDrafts,
  removeOfflineDraft,
  saveOfflineDraft,
} from './offlineDraftStore';
import { sqliteRepository } from './sqliteRepository';

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

export type CreateTransactionDraftPayload = Omit<CreateTransactionPayload, 'accountId' | 'device'>;

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

export const OFFLINE_SYNC_COMPLETE_EVENT = 'shop-pro:offline-sync-complete';

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

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error || '');
  return !isOnline() || /failed to fetch|fetch failed|network|load failed/i.test(message);
}

export function isPermissionOrAuthError(error: unknown): boolean {
  if (!error) return false;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as any).status) : 0;
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as any).message)
      : String(error || '');
  return (
    code === '42501' ||
    status === 401 ||
    status === 403 ||
    /permission denied|not authenticated|jwt|unauthorized|insufficient privilege|grant the required privileges/i.test(message)
  );
}

export function isUnavailableOrUnauthorized(error: unknown): boolean {
  return isNetworkFailure(error) || isPermissionOrAuthError(error);
}

function normalizeAccount(account: any): LedgerAccount {
  return {
    ...account,
    balance_paisa: Number(account.balance_paisa ?? Math.round(Number(account.current_balance || 0) * 100)),
    current_balance: Number(account.current_balance || 0),
    opening_balance: Number(account.opening_balance || 0),
    is_default: Boolean(account.is_default),
    is_active: Boolean(account.is_active),
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

  async createTransactionDraft(
    payload: CreateTransactionDraftPayload,
    userId: string,
  ): Promise<TransactionDraft> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to a shop before saving this entry.');
    if (!Number.isSafeInteger(payload.amountPaisa) || payload.amountPaisa <= 0) {
      throw new Error('Enter an amount greater than zero.');
    }

    const id = generateUUID();
    const draft: TransactionDraft = {
      id,
      organization_id: principal.organizationId,
      type: payload.type,
      amount_paisa: payload.amountPaisa,
      category_id: payload.categoryId,
      category_name: payload.categoryName,
      adjustment_dir: payload.adjustmentDir || null,
      business_date: payload.businessDate || getKarachiBusinessDate(),
      device_entry_time: new Date().toISOString(),
      note: payload.note || null,
      raw_text: payload.rawText,
      created_by: principal.id || userId,
      created_by_name: payload.createdByName,
      idempotency_key: `draft-${id}`,
      created_at: new Date().toISOString(),
    };
    await saveOfflineDraft(draft);

    if (!isOnline() || !isSupabaseConfigured()) return draft;
    try {
      const syncedDraft = await this.syncDraftToCloud(draft);
      await removeOfflineDraft(draft.id);
      return syncedDraft;
    } catch (error) {
      if (isUnavailableOrUnauthorized(error)) return draft;
      await removeOfflineDraft(draft.id);
      throw error;
    }
  }

  async getTransactionDrafts(dateStr: string): Promise<TransactionDraft[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];
    const localDrafts = (await getOfflineDrafts(principal.organizationId))
      .filter((draft) => draft.business_date === dateStr);
    if (!isOnline() || !isSupabaseConfigured()) return localDrafts;

    try {
      const { data, error } = await getSupabaseClient()
        .from('transaction_drafts')
        .select('*, categories(name)')
        .eq('organization_id', principal.organizationId)
        .eq('business_date', dateStr)
        .order('device_entry_time', { ascending: false });
      if (error) {
        if (isUnavailableOrUnauthorized(error)) {
          return localDrafts;
        }
        throw error;
      }

      const cloudDrafts: TransactionDraft[] = (data || []).map((draft: any) => ({
        ...draft,
        amount_paisa: Number(draft.amount_paisa),
        category_name: draft.categories?.name || undefined,
      }));
      const draftsById = new Map(cloudDrafts.map((draft) => [draft.id, draft]));
      for (const draft of localDrafts) {
        const cloudDraft = draftsById.get(draft.id);
        draftsById.set(draft.id, cloudDraft
          ? { ...cloudDraft, pending_account_id: draft.pending_account_id }
          : draft);
      }
      const mergedDrafts = [...draftsById.values()]
        .sort((left, right) => right.device_entry_time.localeCompare(left.device_entry_time));
      await Promise.all(mergedDrafts.map((draft) => saveOfflineDraft(draft)));
      return mergedDrafts;
    } catch (error) {
      if (isUnavailableOrUnauthorized(error)) return localDrafts;
      throw error;
    }
  }

  async postTransactionDraft(
    draftId: string,
    accountId: string,
  ): Promise<{ transaction?: Transaction; isQueuedOffline: boolean }> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to post this transaction.');
    if (!accountId) throw new Error('Choose an account before posting this transaction.');
    const localDraft = (await getOfflineDrafts(principal.organizationId))
      .find((draft) => draft.id === draftId);

    if (!isOnline() || !isSupabaseConfigured()) {
      const accounts = await getCachedAccounts(principal.organizationId);
      if (!accounts.some((account) => account.id === accountId && account.is_active)) {
        throw new Error('Choose an active account loaded for this shop before posting offline.');
      }
      if (!localDraft) {
        throw new Error('Reconnect to load this shared draft before selecting an account.');
      }
      await saveOfflineDraft({ ...localDraft, pending_account_id: accountId });
      return { isQueuedOffline: true };
    }

    try {
      if (localDraft) await this.syncDraftToCloud(localDraft);
      const { data, error } = await getSupabaseClient().rpc('post_transaction_draft', {
        draft_id: draftId,
        selected_account_id: accountId,
      });
      if (error) throw error;
      const postedTransaction = Array.isArray(data) ? data[0] : data;
      if (!postedTransaction) throw new Error('Transaction could not be posted. Refresh and try again.');
      await removeOfflineDraft(draftId);
      return { transaction: postedTransaction as Transaction, isQueuedOffline: false };
    } catch (error) {
      if (!isUnavailableOrUnauthorized(error) || !localDraft) throw error;
      const accounts = await getCachedAccounts(principal.organizationId);
      if (!accounts.some((account) => account.id === accountId && account.is_active)) throw error;
      await saveOfflineDraft({ ...localDraft, pending_account_id: accountId });
      return { isQueuedOffline: true };
    }
  }

  private async syncDraftToCloud(draft: TransactionDraft): Promise<TransactionDraft> {
    const { data, error } = await getSupabaseClient()
      .from('transaction_drafts')
      .upsert({
        id: draft.id,
        organization_id: draft.organization_id,
        type: draft.type,
        amount_paisa: draft.amount_paisa,
        category_id: draft.category_id,
        adjustment_dir: draft.adjustment_dir,
        business_date: draft.business_date,
        device_entry_time: draft.device_entry_time,
        note: draft.note,
        raw_text: draft.raw_text,
        created_by: draft.created_by,
        created_by_name: draft.created_by_name,
        idempotency_key: draft.idempotency_key,
      }, { onConflict: 'id' })
      .select('*, categories(name)')
      .single();
    if (error) throw error;
    return {
      ...data,
      amount_paisa: Number(data.amount_paisa),
      category_name: data.categories?.name || draft.category_name,
      pending_account_id: draft.pending_account_id,
    };
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

    const isQueued = !isOnline() || !isSupabaseConfigured();
    if (isQueued) {
      const accounts = await getCachedAccounts(principal.organizationId);
      if (!accounts.some((account) => account.id === payload.accountId && account.is_active)) {
        throw new Error('Choose an active account loaded for this shop before saving offline.');
      }
    }

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
    if (isQueued) {
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
      if (!isUnavailableOrUnauthorized(err)) throw err;
      const accounts = await getCachedAccounts(principal.organizationId);
      if (!accounts.some((account) => account.id === payload.accountId && account.is_active)) {
        console.warn('Network or auth error recording transaction; refusing to queue without a cached active account:', err);
        throw new Error('Choose an active account loaded for this shop before saving offline.');
      }
      console.warn('Error recording transaction, falling back to offline queue:', err);
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
  async flushOfflineQueue(): Promise<{ syncedCount: number; errors: unknown[] }> {
    if (!isOnline() || !isSupabaseConfigured()) return { syncedCount: 0, errors: [] };

    const principal = getSecurityPrincipal();
    if (!principal) return { syncedCount: 0, errors: [] };

    const [accountOperations, queue] = await Promise.all([
      getOfflineAccountOperations(principal.organizationId),
      getOfflineQueue(),
    ]);
    const drafts = await getOfflineDrafts(principal.organizationId);
    const transactions = queue.filter((item) =>
      (!item.organizationId || item.organizationId === principal.organizationId) &&
      (!item.createdBy || item.createdBy === principal.id),
    );
    const accounts = queue.some((item) => !item.accountId)
      ? await this.getPaymentAccounts()
      : [];
    const defaultAccountId = accounts.find((account) => account.is_default)?.id;
    const tasks: Array<
      | { kind: 'ACCOUNT'; operation: OfflineAccountOperation; timestamp: number; priority: number }
      | { kind: 'DRAFT'; draft: TransactionDraft; timestamp: number; priority: number }
      | { kind: 'TRANSACTION'; transaction: QueuedTransaction; timestamp: number; priority: number }
    > = [
      ...accountOperations.map((operation) => ({
        kind: 'ACCOUNT' as const,
        operation,
        timestamp: Date.parse(operation.createdAt),
        priority: operation.kind === 'CREATE' ? 0 : operation.kind === 'TRANSFER' ? 2 : 3,
      })),
      ...drafts.map((draft) => ({
        kind: 'DRAFT' as const,
        draft,
        timestamp: Date.parse(draft.device_entry_time),
        priority: 1,
      })),
      ...transactions.map((transaction) => ({
        kind: 'TRANSACTION' as const,
        transaction,
        timestamp: transaction.createdAt,
        priority: 2,
      })),
    ];
    tasks.sort((left, right) =>
      left.timestamp - right.timestamp ||
      left.priority - right.priority ||
      (left.kind === 'ACCOUNT' ? left.operation.id : left.kind === 'DRAFT' ? left.draft.id : left.transaction.id)
        .localeCompare(right.kind === 'ACCOUNT' ? right.operation.id : right.kind === 'DRAFT' ? right.draft.id : right.transaction.id),
    );

    let syncedCount = 0;
    let accountsChanged = false;
    const errors: unknown[] = [];

    for (const task of tasks) {
      try {
        if (task.kind === 'ACCOUNT') {
          if (task.operation.organizationId !== principal.organizationId) {
            throw new Error('Queued account operation belongs to a different shop.');
          }
          await this.syncOfflineAccountOperation(task.operation);
          await removeOfflineAccountOperation(task.operation.id);
          accountsChanged = true;
        } else if (task.kind === 'DRAFT') {
          const syncedDraft = await this.syncDraftToCloud(task.draft);
          if (syncedDraft.pending_account_id) {
            const { error } = await getSupabaseClient().rpc('post_transaction_draft', {
              draft_id: syncedDraft.id,
              selected_account_id: syncedDraft.pending_account_id,
            });
            if (error) throw error;
            accountsChanged = true;
          }
          await removeOfflineDraft(task.draft.id);
        } else {
          const item = task.transaction;
          const organizationId = item.organizationId || principal.organizationId;
          const createdBy = item.createdBy || principal.id;
          const accountId = item.accountId || defaultAccountId;
          if (!organizationId || !createdBy || !accountId) {
            throw new Error('Queued transaction is missing its original shop, creator, or account and cannot be synced safely.');
          }
          if (organizationId !== principal.organizationId || createdBy !== principal.id) {
            throw new Error('Queued transaction belongs to a different shop or creator and cannot be synced safely.');
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

          const { error } = await getSupabaseClient()
            .from('transactions')
            .upsert(payload, { onConflict: 'idempotency_key' });
          if (error) throw error;
          await dequeueOfflineTransaction(item.idempotencyKey);
        }
        syncedCount++;
      } catch (err) {
        if (task.kind === 'ACCOUNT') {
          console.error(`Failed to flush queued account operation ${task.operation.id}:`, err);
          await enqueueOfflineAccountOperation({
            ...task.operation,
            attempts: task.operation.attempts + 1,
          });
        } else if (task.kind === 'DRAFT') {
          console.error(`Failed to flush transaction draft ${task.draft.id}:`, err);
        } else {
          console.error(`Failed to flush queued transaction ${task.transaction.idempotencyKey}:`, err);
          await markOfflineTransactionFailed(task.transaction.idempotencyKey);
        }
        errors.push(err);
        break;
      }
    }

    if (accountsChanged) {
      try {
        await this.getPaymentAccounts();
      } catch (error) {
        console.error('Offline operations synced, but authoritative account balances could not be refreshed:', error);
        errors.push(error);
      }
    }

    return { syncedCount, errors };
  }

  private async syncOfflineAccountOperation(operation: OfflineAccountOperation): Promise<void> {
    const supabase = getSupabaseClient();
    if (operation.kind === 'CREATE') {
      const account = operation.account;
      const { data, error } = await supabase
        .from('payment_accounts')
        .upsert({
          id: account.id,
          organization_id: operation.organizationId,
          name: account.name,
          type: account.type,
          opening_balance: account.opening_balance,
          is_active: account.is_active,
          is_default: account.is_default,
        }, { onConflict: 'id', ignoreDuplicates: true })
        .select('*')
        .maybeSingle();
      if (error) throw error;

      let serverAccount = data;
      if (!serverAccount) {
        const existing = await supabase
          .from('payment_accounts')
          .select('*')
          .eq('id', account.id)
          .eq('organization_id', operation.organizationId)
          .maybeSingle();
        if (existing.error) throw existing.error;
        serverAccount = existing.data;
      }
      if (
        !serverAccount ||
        serverAccount.name !== account.name ||
        serverAccount.type !== account.type ||
        Number(serverAccount.opening_balance || 0) !== account.opening_balance
      ) {
        throw new Error('The account could not be verified after synchronization.');
      }
      await cacheAccounts([normalizeAccount(serverAccount)]);
      return;
    }

    if (operation.kind === 'UPDATE') {
      const { data, error } = await supabase
        .from('payment_accounts')
        .update(operation.changes)
        .eq('id', operation.accountId)
        .eq('organization_id', operation.organizationId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The account update could not be verified.');
      return;
    }

    const { data, error } = await supabase
      .from('account_transfers')
      .upsert({
        id: operation.id,
        idempotency_key: operation.id,
        organization_id: operation.organizationId,
        from_account_id: operation.fromAccountId,
        to_account_id: operation.toAccountId,
        amount: operation.amountPaisa / 100,
        date: operation.businessDate,
        notes: operation.notes || null,
        created_by: operation.createdBy,
      }, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data) return;

    const existing = await supabase
      .from('account_transfers')
      .select('id, organization_id, from_account_id, to_account_id, amount, notes, created_by')
      .eq('id', operation.id)
      .eq('organization_id', operation.organizationId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (
      !existing.data ||
      existing.data.from_account_id !== operation.fromAccountId ||
      existing.data.to_account_id !== operation.toAccountId ||
      Number(existing.data.amount) !== operation.amountPaisa / 100 ||
      existing.data.created_by !== operation.createdBy
    ) {
      throw new Error('The transfer could not be verified after synchronization.');
    }
  }

  /**
   * Fetches transactions for a specific business date (defaults to today Karachi)
   */
  async getTransactionsForDate(dateStr: string = getKarachiBusinessDate()): Promise<Transaction[]> {
    const supabase = getSupabaseClient();
    let accounts: LedgerAccount[] = [];
    try {
      accounts = await this.getPaymentAccounts();
    } catch (error) {
      console.warn('Could not load account names while fetching ledger transactions:', error);
    }

    let cloudTransactions: any[] = [];
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*, categories(name)')
          .eq('business_date', dateStr)
          .order('device_entry_time', { ascending: true });

        if (error) {
          if (!isUnavailableOrUnauthorized(error)) {
            console.error('Error fetching transactions for date:', error);
          }
        } else if (data) {
          cloudTransactions = data.map((row: any) => ({
            ...row,
            category_name: row.categories?.name || undefined,
            account_name: accounts.find((account) => account.id === row.account_id)?.name,
          }));
        }
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.error('Error fetching transactions for date:', err);
        }
      }
    }

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

    if (!isOnline() || !isSupabaseConfigured()) {
      return this.getLocalPaymentAccounts(principal.organizationId);
    }

    try {
      const { data, error } = await getSupabaseClient()
        .from('payment_accounts')
        .select('*')
        .eq('organization_id', principal.organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        if (isUnavailableOrUnauthorized(error)) {
          return this.getLocalPaymentAccounts(principal.organizationId);
        }
        throw error;
      }

      const serverAccounts = (data || []).map(normalizeAccount);
      await replaceCachedAccounts(principal.organizationId, serverAccounts);
      return this.mergeWithOfflineAccountOperations(principal.organizationId, serverAccounts);
    } catch (err) {
      if (isUnavailableOrUnauthorized(err)) {
        return this.getLocalPaymentAccounts(principal.organizationId);
      }
      throw err;
    }
  }

  private async getLocalPaymentAccounts(organizationId: string): Promise<LedgerAccount[]> {
    let cachedAccounts = await getCachedAccounts(organizationId);
    if (!cachedAccounts.length) {
      try {
        const sqliteAccounts = await sqliteRepository.getAccounts(organizationId);
        if (sqliteAccounts && sqliteAccounts.length) {
          cachedAccounts = sqliteAccounts.map((a) => ({
            id: a.id,
            organization_id: a.organization_id,
            name: a.name,
            type: a.type as LedgerAccount['type'],
            balance_paisa: Math.round(Number(a.current_balance || 0) * 100),
            current_balance: Number(a.current_balance || 0),
            opening_balance: Number(a.opening_balance || 0),
            is_active: Boolean(a.is_active),
            is_default: Boolean(a.is_default),
            created_at: a.created_at,
          }));
          await cacheAccounts(cachedAccounts);
        }
      } catch (error) {
        console.warn('Could not load local shop accounts:', error);
      }
    }

    if (!cachedAccounts.length) {
      return [];
    }

    return this.mergeWithOfflineAccountOperations(organizationId, cachedAccounts);
  }

  private async mergeWithOfflineAccountOperations(
    organizationId: string,
    baseAccounts: LedgerAccount[],
  ): Promise<LedgerAccount[]> {
    const accountMap = new Map(baseAccounts.map((account) => [account.id, account]));
    const operations = await getOfflineAccountOperations(organizationId);
    const cachedAccounts = await getCachedAccounts(organizationId);
    for (const operation of operations) {
      if (operation.kind === 'CREATE' && !accountMap.has(operation.account.id)) {
        accountMap.set(operation.account.id, operation.account);
      } else if (operation.kind === 'UPDATE') {
        const cached = cachedAccounts.find((account) => account.id === operation.accountId);
        const current = accountMap.get(operation.accountId) || cached;
        if (current) accountMap.set(operation.accountId, { ...current, ...operation.changes });
      }
    }
    await cacheAccounts([...accountMap.values()]);
    return [...accountMap.values()].filter((account) => account.is_active);
  }

  async createPaymentAccount(input: {
    name: string;
    type: LedgerAccount['type'];
    openingBalancePaisa: number;
  }): Promise<{ account: LedgerAccount; isQueuedOffline: boolean }> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to manage shop accounts.');
    if (!input.name.trim()) throw new Error('Enter an account name.');
    if (!Number.isSafeInteger(input.openingBalancePaisa) || input.openingBalancePaisa < 0) {
      throw new Error('Enter a valid opening balance.');
    }

    const now = new Date().toISOString();
    const account: LedgerAccount = {
      id: generateUUID(),
      organization_id: principal.organizationId,
      name: input.name.trim(),
      type: input.type,
      balance_paisa: input.openingBalancePaisa,
      current_balance: input.openingBalancePaisa / 100,
      opening_balance: input.openingBalancePaisa / 100,
      is_active: true,
      is_default: false,
      created_at: now,
    };
    const operation: OfflineAccountOperation = {
      id: account.id,
      kind: 'CREATE',
      organizationId: principal.organizationId,
      createdBy: principal.id,
      createdAt: now,
      attempts: 0,
      account,
    };

    if (!isOnline() || !isSupabaseConfigured()) {
      await enqueueOfflineAccountOperation(operation, account);
      return { account, isQueuedOffline: true };
    }

    try {
      await this.syncOfflineAccountOperation(operation);
      return { account, isQueuedOffline: false };
    } catch (error) {
      if (!isUnavailableOrUnauthorized(error)) throw error;
      await enqueueOfflineAccountOperation(operation, account);
      return { account, isQueuedOffline: true };
    }
  }

  async updatePaymentAccount(
    accountId: string,
    changes: { name?: string; is_active?: boolean },
  ): Promise<boolean> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to manage shop accounts.');
    if (changes.name !== undefined && !changes.name.trim()) {
      throw new Error('Account name cannot be empty.');
    }

    const normalizedChanges = { ...changes, name: changes.name?.trim() };
    const operation: OfflineAccountOperation = {
      id: generateUUID(),
      kind: 'UPDATE',
      organizationId: principal.organizationId,
      createdBy: principal.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
      accountId,
      changes: normalizedChanges,
    };
    if (!isOnline() || !isSupabaseConfigured()) {
      const accounts = await getCachedAccounts(principal.organizationId);
      const account = accounts.find((item) => item.id === accountId);
      if (!account) throw new Error('Load this shop account before changing it offline.');
      await enqueueOfflineAccountOperation(operation, { ...account, ...normalizedChanges });
      return true;
    }

    try {
      await this.syncOfflineAccountOperation(operation);
      return false;
    } catch (error) {
      if (!isUnavailableOrUnauthorized(error)) throw error;
      const accounts = await getCachedAccounts(principal.organizationId);
      const account = accounts.find((item) => item.id === accountId);
      if (!account) throw new Error('Load this shop account before changing it offline.');
      await enqueueOfflineAccountOperation(operation, { ...account, ...normalizedChanges });
      return true;
    }
  }

  async transferBetweenAccounts(input: {
    fromAccountId: string;
    toAccountId: string;
    amountPaisa: number;
    notes?: string;
  }): Promise<boolean> {
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to transfer shop funds.');
    if (!input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId) {
      throw new Error('Choose different source and destination accounts.');
    }
    if (!Number.isSafeInteger(input.amountPaisa) || input.amountPaisa <= 0) {
      throw new Error('Enter a valid transfer amount.');
    }

    const operation: OfflineAccountOperation = {
      id: generateUUID(),
      kind: 'TRANSFER',
      organizationId: principal.organizationId,
      createdBy: principal.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountPaisa: input.amountPaisa,
      businessDate: getKarachiBusinessDate(),
      notes: input.notes?.trim() || undefined,
    };
    if (!isOnline() || !isSupabaseConfigured()) {
      const accounts = await getCachedAccounts(principal.organizationId);
      const activeAccountIds = new Set(accounts
        .filter((account) => account.is_active)
        .map((account) => account.id));
      if (!activeAccountIds.has(input.fromAccountId) || !activeAccountIds.has(input.toAccountId)) {
        throw new Error('Load both active shop accounts before recording an offline transfer.');
      }
      await enqueueOfflineAccountOperation(operation);
      return true;
    }

    try {
      await this.syncOfflineAccountOperation(operation);
      return false;
    } catch (error) {
      if (!isUnavailableOrUnauthorized(error)) throw error;
      const accounts = await getCachedAccounts(principal.organizationId);
      const activeAccountIds = new Set(accounts
        .filter((account) => account.is_active)
        .map((account) => account.id));
      if (!activeAccountIds.has(input.fromAccountId) || !activeAccountIds.has(input.toAccountId)) {
        throw new Error('Load both active shop accounts before queuing an offline transfer.');
      }
      await enqueueOfflineAccountOperation(operation);
      return true;
    }
  }

  async getAccountLedger(accountId: string): Promise<AccountLedgerEntry[]> {
    const principal = getSecurityPrincipal();
    if (!principal) return [];
    if (!isOnline() || !isSupabaseConfigured()) return [];
    try {
      const { data, error } = await getSupabaseClient()
        .from('account_ledger_entries')
        .select('*')
        .eq('organization_id', principal.organizationId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isUnavailableOrUnauthorized(error)) return [];
        throw error;
      }
      return (data || []).map((entry: any) => ({
        ...entry,
        amount_paisa: Number(entry.amount_paisa),
        balance_after_paisa: Number(entry.balance_after_paisa),
      }));
    } catch (err) {
      if (isUnavailableOrUnauthorized(err)) return [];
      throw err;
    }
  }

  /**
   * Fetches daily summary from security_invoker view
   */
  async getDailySummary(dateStr: string = getKarachiBusinessDate()): Promise<DailySummary> {
    const supabase = getSupabaseClient();
    let data: any = null;

    if (isOnline() && isSupabaseConfigured()) {
      try {
        const res = await supabase
          .from('view_daily_summary')
          .select('*')
          .eq('business_date', dateStr)
          .maybeSingle();

        if (res.error) {
          if (!isUnavailableOrUnauthorized(res.error)) {
            console.error('Error fetching daily summary:', res.error);
          }
        } else {
          data = res.data;
        }
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.error('Error fetching daily summary:', err);
        }
      }
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

  async getCategoryBreakdown(dateStr: string = getKarachiBusinessDate()): Promise<CategoryBreakdown[]> {
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('view_category_breakdown')
          .select('*')
          .eq('business_date', dateStr);
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch {
        // Fall back to local calculation
      }
    }

    const txs = await this.getTransactionsForDate(dateStr);
    const catMap = new Map<string, { category_id: string; category_name: string; type: Transaction['type']; total_paisa: number; entry_count: number }>();
    for (const tx of txs) {
      if (tx.status === 'voided') continue;
      const catId = tx.category_id || 'uncategorized';
      const catName = tx.category_name || (tx.type === 'income' ? 'General Income' : 'General Expense');
      const type = tx.type;
      const existing = catMap.get(catId) || {
        category_id: catId,
        category_name: catName,
        type,
        total_paisa: 0,
        entry_count: 0,
      };
      existing.total_paisa += tx.amount_paisa;
      existing.entry_count += 1;
      catMap.set(catId, existing);
    }
    return [...catMap.values()].map((c) => ({
      business_date: dateStr,
      category_id: c.category_id,
      category_name: c.category_name,
      type: c.type,
      total_paisa: c.total_paisa,
      entry_count: c.entry_count,
    }));
  }

  async getMonthlySummary(year: number, month: number): Promise<MonthlySummary | null> {
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('view_monthly_summary')
          .select('*')
          .eq('year', year)
          .eq('month', month)
          .maybeSingle();
        if (!error && data) {
          return {
            month_start: data.month_start,
            year: data.year,
            month: data.month,
            income_paisa: Number(data.income_paisa || 0),
            expense_paisa: Number(data.expense_paisa || 0),
            net_profit_paisa: Number(data.net_profit_paisa || 0),
            capital_in_paisa: Number(data.capital_in_paisa || 0),
            withdrawal_paisa: Number(data.withdrawal_paisa || 0),
            adjustment_in_paisa: Number(data.adjustment_in_paisa || 0),
            adjustment_out_paisa: Number(data.adjustment_out_paisa || 0),
          };
        }
      } catch {
        // Fall back
      }
    }

    const queue = await getOfflineQueue();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthlyTxs = queue.filter((tx) => tx.businessDate.startsWith(prefix));
    if (!monthlyTxs.length) return null;

    let income = 0;
    let expense = 0;
    let capitalIn = 0;
    let withdrawal = 0;
    let adjIn = 0;
    let adjOut = 0;
    for (const tx of monthlyTxs) {
      if (tx.type === 'income') income += tx.amountPaisa;
      else if (tx.type === 'expense') expense += tx.amountPaisa;
      else if (tx.type === 'capital_in') capitalIn += tx.amountPaisa;
      else if (tx.type === 'withdrawal') withdrawal += tx.amountPaisa;
      else if (tx.type === 'adjustment' && tx.adjustmentDir === 'in') adjIn += tx.amountPaisa;
      else if (tx.type === 'adjustment' && tx.adjustmentDir === 'out') adjOut += tx.amountPaisa;
    }
    return {
      month_start: `${prefix}-01`,
      year,
      month,
      income_paisa: income,
      expense_paisa: expense,
      net_profit_paisa: income - expense,
      capital_in_paisa: capitalIn,
      withdrawal_paisa: withdrawal,
      adjustment_in_paisa: adjIn,
      adjustment_out_paisa: adjOut,
    };
  }

  async getMonthlyReport(year: number): Promise<MonthlySummary[]> {
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('view_monthly_summary')
          .select('*')
          .eq('year', year)
          .order('month', { ascending: true });
        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            month_start: row.month_start,
            year: row.year,
            month: row.month,
            income_paisa: Number(row.income_paisa || 0),
            expense_paisa: Number(row.expense_paisa || 0),
            net_profit_paisa: Number(row.net_profit_paisa || 0),
            capital_in_paisa: Number(row.capital_in_paisa || 0),
            withdrawal_paisa: Number(row.withdrawal_paisa || 0),
            adjustment_in_paisa: Number(row.adjustment_in_paisa || 0),
            adjustment_out_paisa: Number(row.adjustment_out_paisa || 0),
          }));
        }
      } catch {
        // Fall back
      }
    }
    return [];
  }

  /**
   * Fetches historical transactions with filtering and pagination
   */
  async getFilteredTransactions(filter: TransactionFilter = {}): Promise<{ transactions: Transaction[]; count: number }> {
    if (isOnline() && isSupabaseConfigured()) {
      try {
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
          if (!isUnavailableOrUnauthorized(error)) {
            console.error('Error fetching filtered transactions:', error);
            throw error;
          }
        } else {
          const transactions = (data || []).map((row: any) => ({
            ...row,
            category_name: row.categories?.name || undefined,
          }));

          return { transactions, count: count || 0 };
        }
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.error('Error fetching filtered transactions:', err);
          throw err;
        }
      }
    }

    const queue = await getOfflineQueue();
    const principal = getSecurityPrincipal();
    let localItems = queue
      .filter((item) => !principal || !item.organizationId || item.organizationId === principal.organizationId)
      .map(queuedTransactionToLedgerTransaction);

    if (filter.startDate) localItems = localItems.filter((tx) => tx.business_date >= filter.startDate!);
    if (filter.endDate) localItems = localItems.filter((tx) => tx.business_date <= filter.endDate!);
    if (filter.type && filter.type !== 'all') localItems = localItems.filter((tx) => tx.type === filter.type);
    if (filter.categoryId && filter.categoryId !== 'all') localItems = localItems.filter((tx) => tx.category_id === filter.categoryId);
    if (filter.status && filter.status !== 'all') localItems = localItems.filter((tx) => tx.status === filter.status);
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      localItems = localItems.filter((tx) => tx.raw_text.toLowerCase().includes(q));
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    const paged = localItems.slice(offset, offset + limit);
    return { transactions: paged, count: localItems.length };
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
    if (!isOnline() || !isSupabaseConfigured()) {
      throw new Error('Voiding transactions requires a connection. No changes were made; reconnect and try again.');
    }
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to this shop before voiding a transaction.');
    requirePermission(principal.organizationId, 'VOID_EXPENSE');

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'voided',
        void_reason: reason.trim(),
        voided_by: principal.id,
        voided_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', principal.organizationId)
      .eq('status', 'active')
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
    if (!isOnline() || !isSupabaseConfigured()) {
      throw new Error('Restoring transactions requires a connection. No changes were made; reconnect and try again.');
    }
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to this shop before restoring a transaction.');
    requirePermission(principal.organizationId, 'VOID_EXPENSE');

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
      .eq('organization_id', principal.organizationId)
      .eq('status', 'voided')
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
    if (!isOnline() || !isSupabaseConfigured()) {
      throw new Error('Editing transactions requires a connection. No changes were made; reconnect and try again.');
    }
    const principal = getSecurityPrincipal();
    if (!principal) throw new Error('Sign in to this shop before editing a transaction.');
    requirePermission(principal.organizationId, 'VOID_EXPENSE');

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', principal.organizationId)
      .eq('status', 'active')
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
    const item: ReviewQueueItem = {
      id: generateUUID(),
      raw_text: rawText,
      reason,
      suggested_category_id: suggested?.categoryId || null,
      suggested_category_name: suggested?.categoryName || null,
      suggested_amount_paisa: suggested?.amountPaisa || null,
      created_by: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.saveLocalReviewQueueItem(item);

    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        await supabase.from('review_queue').insert({
          id: item.id,
          raw_text: item.raw_text,
          reason: item.reason,
          suggested_category_id: item.suggested_category_id,
          suggested_category_name: item.suggested_category_name,
          suggested_amount_paisa: item.suggested_amount_paisa,
          created_by: item.created_by,
          status: item.status,
        });
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.warn('Could not sync review queue item to cloud:', err);
        }
      }
    }
  }

  /**
   * Review Queue: Fetch pending items
   */
  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    if (!isOnline() || !isSupabaseConfigured()) {
      return this.getLocalReviewQueue();
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('review_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        if (!isUnavailableOrUnauthorized(error)) {
          console.error('Error fetching review queue:', error);
        }
        return this.getLocalReviewQueue();
      }
      return data || [];
    } catch (err) {
      if (!isUnavailableOrUnauthorized(err)) {
        console.error('Error fetching review queue:', err);
      }
      return this.getLocalReviewQueue();
    }
  }

  /**
   * Review Queue: Resolve or dismiss item
   */
  async updateReviewQueueStatus(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
    this.updateLocalReviewQueueStatus(id, status);
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('review_queue')
          .update({ status })
          .eq('id', id);
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.warn('Could not sync review queue status to cloud:', err);
        }
      }
    }
  }

  private getLocalReviewQueue(): ReviewQueueItem[] {
    try {
      const raw = localStorage.getItem('shop-pro:local-review-queue');
      if (!raw) return [];
      const items: ReviewQueueItem[] = JSON.parse(raw);
      return (items || []).filter((item) => item.status === 'pending');
    } catch {
      return [];
    }
  }

  private saveLocalReviewQueueItem(item: ReviewQueueItem): void {
    try {
      const raw = localStorage.getItem('shop-pro:local-review-queue');
      const items: ReviewQueueItem[] = raw ? JSON.parse(raw) : [];
      items.push(item);
      localStorage.setItem('shop-pro:local-review-queue', JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  private updateLocalReviewQueueStatus(id: string, status: 'resolved' | 'dismissed'): void {
    try {
      const raw = localStorage.getItem('shop-pro:local-review-queue');
      if (!raw) return;
      const items: ReviewQueueItem[] = JSON.parse(raw);
      const updated = items.map((i) => (i.id === id ? { ...i, status } : i));
      localStorage.setItem('shop-pro:local-review-queue', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  /**
   * Categories: Fetch all active categories
   */
  async getCategories(): Promise<Category[]> {
    if (isOnline() && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) {
          if (!isUnavailableOrUnauthorized(error)) {
            console.error('Error fetching categories:', error);
          }
        } else if (data && data.length > 0) {
          return data;
        }
      } catch (err) {
        if (!isUnavailableOrUnauthorized(err)) {
          console.error('Error fetching categories:', err);
        }
      }
    }
    return SEED_CATEGORIES.map((seed, idx) => ({
      id: seed.id,
      organization_id: '',
      name: seed.name,
      kind: seed.kind,
      unusual_amount_limit_paisa: seed.unusualLimitPaisa,
      is_default: idx === 0,
      is_active: true,
      display_order: idx + 1,
      created_at: new Date().toISOString(),
    }));
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
