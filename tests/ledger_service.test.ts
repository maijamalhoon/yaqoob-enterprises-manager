import { afterEach, describe, expect, it, vi } from 'vitest';
import * as supabaseLib from '../src/lib/supabase';
import { ledgerService } from '../src/services/ledgerService';
import { LedgerAccount, Transaction } from '../src/types/ledger';
import { setSecurityPrincipal } from '../src/lib/security';
import {
  cacheAccounts,
  enqueueOfflineAccountOperation,
  getCachedAccounts,
  getOfflineAccountOperations,
  replaceCachedAccounts,
  removeOfflineAccountOperation,
} from '../src/services/offlineAccountStore';
import {
  getOfflineDrafts,
  removeOfflineDraft,
} from '../src/services/offlineDraftStore';
import {
  dequeueOfflineTransaction,
  enqueueOfflineTransaction,
  QueuedTransaction,
} from '../src/services/offlineQueue';

const timestamp = '2026-10-04T05:00:00Z';
const organizationId = 'org-yaqoob-001';
const creatorId = 'test-owner';
const queueKeys: string[] = [];
const accountOperationIds: string[] = [];
const draftIds: string[] = [];

const mutations = [
  {
    name: 'void',
    run: () => ledgerService.voidTransaction('tx-1', 'Correction', timestamp),
  },
  {
    name: 'restore',
    run: () => ledgerService.restoreTransaction('tx-1', timestamp),
  },
  {
    name: 'edit',
    run: () => ledgerService.editTransaction('tx-1', { amount_paisa: 5000 }, timestamp),
  },
];

function mockUpdateResult(data: { id: string } | null) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);

  const mockClient = {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue(query),
    }),
  };

  vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);
}

afterEach(async () => {
  for (const key of queueKeys.splice(0)) {
    await dequeueOfflineTransaction(key);
  }
  for (const id of accountOperationIds.splice(0)) {
    await removeOfflineAccountOperation(id);
  }
  for (const id of draftIds.splice(0)) {
    await removeOfflineDraft(id);
  }
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

function makeQueuedTransaction(
  overrides: Partial<QueuedTransaction> = {},
): QueuedTransaction {
  return {
    id: 'queued-tx-1',
    idempotencyKey: 'queued-key-1',
    organizationId,
    createdBy: creatorId,
    accountId: 'account-1',
    type: 'income',
    amountPaisa: 3000,
    categoryId: 'category-print',
    categoryName: 'Printing',
    businessDate: '2026-10-04',
    deviceEntryTime: timestamp,
    note: null,
    rawText: 'PRINT 30',
    createdByName: 'Test Owner',
    adjustmentDir: null,
    status: 'queued',
    attempts: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

async function enqueueForTest(item: QueuedTransaction) {
  queueKeys.push(item.idempotencyKey);
  await enqueueOfflineTransaction(item);
}

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
}

describe('ledger mutation concurrency', () => {
  it.each(mutations)('$name rejects when the transaction was changed or removed', async ({ run }) => {
    mockUpdateResult(null);

    await expect(run()).rejects.toThrow(/not found or has changed/i);
  });

  it.each(mutations)('$name reports success when the transaction was updated', async ({ run }) => {
    mockUpdateResult({ id: 'tx-1' });

    await expect(run()).resolves.toBe(true);
  });

  it('attributes a void to the authenticated actor and scopes the optimistic update to the active shop', async () => {
    const query = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null }),
    };
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const update = vi.fn().mockReturnValue(query);
    const mockClient = {
      from: vi.fn().mockReturnValue({ update }),
    };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    await ledgerService.voidTransaction('tx-1', 'Correction', timestamp);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'voided',
      void_reason: 'Correction',
      voided_by: creatorId,
      voided_at: expect.any(String),
    }));
    expect(query.eq).toHaveBeenCalledWith('organization_id', organizationId);
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('updated_at', timestamp);
  });

  it('rejects a cashier void before making a database request', async () => {
    setSecurityPrincipal({
      id: 'test-cashier',
      organizationId,
      role: 'CASHIER',
      fullName: 'Test Cashier',
    });
    const getClient = vi.spyOn(supabaseLib, 'getSupabaseClient');

    await expect(
      ledgerService.voidTransaction('tx-1', 'Correction', timestamp),
    ).rejects.toThrow(/permission denied/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('does not claim an offline void succeeded or queue a partial mutation', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const getClient = vi.spyOn(supabaseLib, 'getSupabaseClient');

    await expect(
      ledgerService.voidTransaction('tx-1', 'Correction', timestamp),
    ).rejects.toThrow(/requires a connection/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('does not invent Cash or Bank accounts when an offline shop has no cached setup', async () => {
    setSecurityPrincipal({
      id: creatorId,
      organizationId: 'shop-with-no-cached-accounts',
      role: 'OWNER',
      fullName: 'Test Owner',
    });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await expect(ledgerService.getPaymentAccounts()).resolves.toEqual([]);
  });

  it('loads all filtered transaction pages for export', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `tx-${index}` }) as Transaction);
    const finalPage = [{ id: 'tx-1000' }, { id: 'tx-1001' }] as Transaction[];
    const getPage = vi
      .spyOn(ledgerService, 'getFilteredTransactions')
      .mockResolvedValueOnce({ transactions: firstPage, count: 1002 })
      .mockResolvedValueOnce({ transactions: finalPage, count: 1002 });

    const transactions = await ledgerService.getAllFilteredTransactions({ type: 'income' });

    expect(transactions).toHaveLength(1002);
    expect(getPage).toHaveBeenNthCalledWith(1, { type: 'income', limit: 1000, offset: 0 });
    expect(getPage).toHaveBeenNthCalledWith(2, { type: 'income', limit: 1000, offset: 1000 });
  });

  it('rejects incomplete exports instead of returning partial results', async () => {
    vi.spyOn(ledgerService, 'getFilteredTransactions').mockResolvedValue({
      transactions: [],
      count: 1001,
    });

    await expect(ledgerService.getAllFilteredTransactions()).rejects.toThrow(/export stopped/i);
  });

  it('writes chat transactions with the authenticated organization and creator', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);
    const transaction = { id: 'online-tx-1', updated_at: timestamp };
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
    };
    const mockClient = { from: vi.fn().mockReturnValue(query) };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    await ledgerService.recordTransaction(
      {
        type: 'income',
        amountPaisa: 3000,
        categoryId: 'category-print',
        categoryName: 'Printing',
        accountId: 'account-1',
        businessDate: '2026-10-04',
        rawText: 'PRINT 30',
        createdByName: 'Test Owner',
      },
      creatorId,
    );

    const inserted = query.insert.mock.calls[0][0];
    expect(inserted.organization_id).toBe(organizationId);
    expect(inserted.created_by).toBe(creatorId);
    expect(inserted.account_id).toBe('account-1');
  });

  it('shows queued chat transactions immediately in the feed and daily totals', async () => {
    const pendingIncome = makeQueuedTransaction();
    const pendingExpense = makeQueuedTransaction({
      id: 'queued-tx-2',
      idempotencyKey: 'queued-key-2',
      type: 'expense',
      amountPaisa: 1500,
      categoryId: 'category-paper',
      categoryName: 'Paper',
      rawText: 'PAPER - 15',
    });
    await enqueueForTest(pendingIncome);
    await enqueueForTest(pendingExpense);
    expect(await ledgerService.getPendingTransactionCount()).toBe(2);

    vi.spyOn(ledgerService, 'getPaymentAccounts').mockResolvedValue([
      {
        id: 'account-1',
        organization_id: organizationId,
        name: 'Cash Wallet',
        type: 'CASH',
        balance_paisa: 0,
        current_balance: 0,
        opening_balance: 0,
        is_active: true,
        is_default: true,
        created_at: timestamp,
      },
    ]);

    const cloudTransaction = {
      id: 'cloud-tx-1',
      type: 'income',
      amount_paisa: 10000,
      category_id: 'category-print',
      account_id: 'account-1',
      categories: { name: 'Printing' },
      business_date: '2026-10-04',
      device_entry_time: timestamp,
      raw_text: 'PRINT 100',
      status: 'active',
      idempotency_key: 'cloud-key-1',
      created_by: creatorId,
      created_by_name: 'Test Owner',
      created_at: timestamp,
      updated_at: timestamp,
    };
    const transactionQuery = createQuery({ data: [cloudTransaction], error: null });
    const summaryQuery = createQuery({
      data: {
        business_date: '2026-10-04',
        income_paisa: 10000,
        expense_paisa: 0,
        net_profit_paisa: 10000,
        capital_in_paisa: 0,
        withdrawal_paisa: 0,
        adjustment_in_paisa: 0,
        adjustment_out_paisa: 0,
        transaction_count: 1,
      },
      error: null,
    });
    const mockClient = {
      from: vi.fn((table: string) =>
        table === 'transactions' ? transactionQuery : summaryQuery,
      ),
    };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    const transactions = await ledgerService.getTransactionsForDate('2026-10-04');
    const summary = await ledgerService.getDailySummary('2026-10-04');

    expect(transactions.map((item) => item.id)).toEqual([
      'cloud-tx-1',
      'queued-tx-1',
      'queued-tx-2',
    ]);
    expect(transactionQuery.select).toHaveBeenCalledWith('*, categories(name)');
    expect(transactions[0].account_name).toBe('Cash Wallet');
    expect(transactions[1].created_at).toBe('');
    expect(summary.income_paisa).toBe(13000);
    expect(summary.expense_paisa).toBe(1500);
    expect(summary.net_profit_paisa).toBe(11500);
    expect(summary.transaction_count).toBe(3);
  });

  it('flushes queued transactions with their original organization and creator', async () => {
    const pending = makeQueuedTransaction({
      id: 'queued-flush-1',
      idempotencyKey: 'queued-flush-key-1',
    });
    await enqueueForTest(pending);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const mockClient = { from: vi.fn().mockReturnValue({ upsert }) };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    const result = await ledgerService.flushOfflineQueue();

    expect(result.syncedCount).toBe(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      organization_id: organizationId,
      created_by: creatorId,
    });
  });

  it('persists offline accounts and transfers, then replays them before linked transactions exactly once', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);

    const firstAccountResult = await ledgerService.createPaymentAccount({
      name: 'Offline Cash',
      type: 'CASH',
      openingBalancePaisa: 12000,
    });
    const secondAccountResult = await ledgerService.createPaymentAccount({
      name: 'Offline Bank',
      type: 'BANK',
      openingBalancePaisa: 3000,
    });
    const firstAccount = firstAccountResult.account;
    const secondAccount = secondAccountResult.account;
    expect(firstAccountResult.isQueuedOffline).toBe(true);
    expect(secondAccountResult.isQueuedOffline).toBe(true);

    expect(await ledgerService.transferBetweenAccounts({
      fromAccountId: firstAccount.id,
      toAccountId: secondAccount.id,
      amountPaisa: 1000,
      notes: 'Offline transfer',
    })).toBe(true);

    await ledgerService.recordTransaction({
      type: 'income',
      amountPaisa: 500,
      categoryId: 'category-print',
      accountId: firstAccount.id,
      rawText: 'PRINT 5',
      createdByName: 'Test Owner',
    }, creatorId);

    const operations = await getOfflineAccountOperations(organizationId);
    accountOperationIds.push(...operations.map((operation) => operation.id));
    expect(operations.map((operation) => operation.kind)).toEqual(['CREATE', 'CREATE', 'TRANSFER']);

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const accountRows = new Map<string, Record<string, unknown>>();
    const transferRows = new Map<string, Record<string, unknown>>();
    const transactionRows = new Map<string, Record<string, unknown>>();
    const replayOrder: string[] = [];
    const failedAfterCommit = new Set<string>();
    const mockClient = {
      from: vi.fn((table: string) => {
        let pendingUpsert: Record<string, unknown> | undefined;
        let filters: Record<string, unknown> = {};
        let query: Record<string, any>;
        query = {
          upsert: vi.fn((value: Record<string, unknown>) => {
            pendingUpsert = value;
            replayOrder.push(table);
            return query;
          }),
          insert: vi.fn((value: Record<string, unknown>) => {
            pendingUpsert = value;
            replayOrder.push(table);
            return query;
          }),
          select: vi.fn(() => query),
          eq: vi.fn((key: string, value: unknown) => {
            filters[key] = value;
            return query;
          }),
          order: vi.fn(() => query),
          maybeSingle: vi.fn(async () => {
            const rows = table === 'payment_accounts' ? accountRows
              : table === 'account_transfers' ? transferRows
              : transactionRows;
            if (pendingUpsert) {
              const pending = pendingUpsert;
              pendingUpsert = undefined;
              const row = { ...pending };
              if (table === 'payment_accounts') {
                row.current_balance = Number(row.opening_balance || 0);
                row.balance_paisa = Math.round(Number(row.opening_balance || 0) * 100);
              }
              const key = String(row.id);
              if (rows.has(key)) return { data: null, error: null };
              rows.set(key, row);
              const failureKey = `${table}:${key}`;
              if (
                (table === 'account_transfers' || (table === 'payment_accounts' && accountRows.size === 1)) &&
                !failedAfterCommit.has(failureKey)
              ) {
                failedAfterCommit.add(failureKey);
                return { data: null, error: new TypeError('Failed to fetch') };
              }
              return { data: row, error: null };
            }
            const found = [...rows.values()].find((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value),
            );
            return { data: found || null, error: null };
          }),
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
            const rows = table === 'payment_accounts' ? accountRows
              : table === 'account_transfers' ? transferRows
              : transactionRows;
            if (pendingUpsert) rows.set(String(pendingUpsert.id), { ...pendingUpsert });
            const result = [...rows.values()].filter((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value),
            );
            return Promise.resolve({ data: result, error: null }).then(resolve, reject);
          },
        };
        return query;
      }),
    };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    const result = await ledgerService.flushOfflineQueue();
    expect(result.syncedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(accountRows.size).toBe(1);
    expect(transferRows.size).toBe(0);
    expect(transactionRows.size).toBe(0);

    const retry = await ledgerService.flushOfflineQueue();
    expect(retry.syncedCount).toBe(2);
    expect(retry.errors).toHaveLength(1);
    expect([...accountRows.values()]
      .map((account) => account.current_balance)
      .sort((left, right) => Number(left) - Number(right))).toEqual([30, 120]);
    expect(transferRows.size).toBe(1);
    expect(transactionRows.size).toBe(0);

    const finalAttempt = await ledgerService.flushOfflineQueue();
    expect(finalAttempt.syncedCount).toBe(2);
    expect(finalAttempt.errors).toEqual([]);
    expect(replayOrder).toEqual([
      'payment_accounts',
      'payment_accounts',
      'payment_accounts',
      'account_transfers',
      'account_transfers',
      'transactions',
    ]);
    expect(transferRows.size).toBe(1);
    expect(transactionRows.size).toBe(1);
  });

  it('rejects a new offline transaction when its account is not cached for the active shop', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);

    await expect(ledgerService.recordTransaction({
      type: 'income',
      amountPaisa: 500,
      categoryId: 'category-print',
      accountId: 'uncached-account',
      rawText: 'PRINT 5',
      createdByName: 'Test Owner',
    }, creatorId)).rejects.toThrow(/active account loaded for this shop/i);
  });

  it('replaces stale account snapshots without dropping accounts still pending creation', async () => {
    const makeAccount = (id: string): LedgerAccount => ({
      id,
      organization_id: organizationId,
      name: id,
      type: 'CASH',
      balance_paisa: 0,
      current_balance: 0,
      opening_balance: 0,
      is_active: true,
      is_default: false,
      created_at: timestamp,
    });
    const activeAccount = makeAccount('cached-active-account');
    const staleAccount = makeAccount('cached-stale-account');
    const pendingAccount = makeAccount('pending-local-account');
    await cacheAccounts([activeAccount, staleAccount]);
    await replaceCachedAccounts(organizationId, [activeAccount]);
    expect((await getCachedAccounts(organizationId)).map((account) => account.id))
      .not.toContain(staleAccount.id);

    const operationId = 'offline-pending-create-operation';
    accountOperationIds.push(operationId);
    await enqueueOfflineAccountOperation({
      id: operationId,
      kind: 'CREATE',
      organizationId,
      createdBy: creatorId,
      createdAt: timestamp,
      attempts: 0,
      account: pendingAccount,
    }, pendingAccount);
    await replaceCachedAccounts(organizationId, [activeAccount]);

    expect((await getCachedAccounts(organizationId)).map((account) => account.id))
      .toContain(pendingAccount.id);
  });

  it('saves entries as unposted drafts first, then posts the chosen account exactly once', async () => {
    const account: LedgerAccount = {
      id: 'draft-test-account',
      organization_id: organizationId,
      name: 'Draft Test Wallet',
      type: 'CASH',
      balance_paisa: 9000,
      current_balance: 90,
      opening_balance: 90,
      is_active: true,
      is_default: false,
      created_at: timestamp,
    };
    await cacheAccounts([account]);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);

    const draft = await ledgerService.createTransactionDraft({
      type: 'income',
      amountPaisa: 2500,
      categoryId: 'category-print',
      categoryName: 'Printing',
      businessDate: '2026-10-04',
      rawText: 'PRINT 25',
      createdByName: 'Test Owner',
    }, creatorId);
    draftIds.push(draft.id);
    expect((await ledgerService.getTransactionDrafts('2026-10-04')).map((item) => item.id))
      .toContain(draft.id);
    expect((await getCachedAccounts(organizationId)).find((item) => item.id === account.id)?.balance_paisa)
      .toBe(9000);

    const queuedPost = await ledgerService.postTransactionDraft(draft.id, account.id);
    expect(queuedPost.isQueuedOffline).toBe(true);
    expect((await getOfflineDrafts(organizationId)).find((item) => item.id === draft.id)?.pending_account_id)
      .toBe(account.id);
    expect((await getCachedAccounts(organizationId)).find((item) => item.id === account.id)?.balance_paisa)
      .toBe(9000);

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const postedTransaction = { id: 'draft-posted-tx', account_id: account.id, amount_paisa: 2500 };
    const draftQuery = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...draft, categories: { name: 'Printing' } },
        error: null,
      }),
    };
    const rpc = vi.fn().mockResolvedValue({ data: postedTransaction, error: null });
    const mockClient = {
      from: vi.fn().mockReturnValue(draftQuery),
      rpc,
    };
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockClient as never);

    const result = await ledgerService.postTransactionDraft(draft.id, account.id);
    expect(result.transaction).toMatchObject(postedTransaction);
    expect(rpc).toHaveBeenCalledWith('post_transaction_draft', {
      draft_id: draft.id,
      selected_account_id: account.id,
    });
    expect(await getOfflineDrafts(organizationId)).toEqual([]);
    expect((await getCachedAccounts(organizationId)).find((item) => item.id === account.id)?.balance_paisa)
      .toBe(9000);
  });
});