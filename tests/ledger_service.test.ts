import { afterEach, describe, expect, it, vi } from 'vitest';
import * as supabaseLib from '../src/lib/supabase';
import { ledgerService } from '../src/services/ledgerService';
import { Transaction } from '../src/types/ledger';
import {
  dequeueOfflineTransaction,
  enqueueOfflineTransaction,
  QueuedTransaction,
} from '../src/services/offlineQueue';

const timestamp = '2026-10-04T05:00:00Z';
const organizationId = 'org-yaqoob-001';
const creatorId = 'test-owner';
const queueKeys: string[] = [];

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

afterEach(() => {
  for (const key of queueKeys.splice(0)) {
    void dequeueOfflineTransaction(key);
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
});