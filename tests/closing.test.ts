import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

describe('Daily Cash Closing & Drawer Reconciliation', () => {
  const orgId = DEFAULT_ORGANIZATION.id;
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(() => {
    StorageEngine.resetToDefaults();
  });

  it('correctly calculates expected cash drawer balance from sales, expenses, and transfers', () => {
    const cashAccount = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const openingCash = cashAccount.opening_balance; // 10000

    // 1. Perform a Cash Sale of Rs. 500
    StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-cashier-1',
      cashier_name: 'Cashier Ali',
      items: [
        {
          type: 'SERVICE',
          item_id: 'srv-bw-copy',
          name: 'B&W Photocopy',
          quantity: 50,
          unit_price: 10,
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 500,
      payment_method: 'Cash Drawer',
      split_payments: [],
    });

    // 2. Perform a Cash Expense of Rs. 150
    StorageEngine.recordExpense({
      id: `exp-test-${Date.now()}`,
      organization_id: orgId,
      category_id: 'exp-cat-tea',
      category_name: 'Tea & Refreshment',
      amount: 150,
      account_id: 'acc-cash',
      account_name: 'Cash Drawer',
      description: 'Tea for guests',
      date: today,
      entered_by: 'Cashier Ali',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });

    // 3. Perform a Transfer from Bank to Cash Drawer of Rs. 2000
    StorageEngine.transferFunds({
      id: `tf-test-${Date.now()}`,
      organization_id: orgId,
      from_account_id: 'acc-hbl',
      from_account_name: 'HBL Business Account',
      to_account_id: 'acc-cash',
      to_account_name: 'Cash Drawer',
      amount: 2000,
      date: today,
      notes: 'Petty cash top-up',
      created_by: 'Muhammad Yaqoob',
      created_at: new Date().toISOString(),
    });

    // Expected cash calculation:
    // openingCash (10000) + cashSales (500) - cashExpenses (150) + transfersIn (2000) - transfersOut (0)
    // = 12350
    const summary = StorageEngine.getDailyClosingSummary(orgId, today);
    expect(summary.openingCash).toBe(openingCash);
    expect(summary.cashSales).toBe(500);
    expect(summary.cashExpenses).toBe(150);
    expect(summary.cashTransfersIn).toBe(2000);
    expect(summary.cashTransfersOut).toBe(0);
    expect(summary.expectedCash).toBe(12350);
  });

  it('identifies cash surplus (overage) when actual counted cash exceeds expected', () => {
    const summary = StorageEngine.getDailyClosingSummary(orgId, today);
    const counted = summary.expectedCash + 200; // 200 surplus

    const closing = StorageEngine.recordDailyClosing(orgId, {
      closing_date: today,
      actual_cash: counted,
      notes: 'Customer left Rs 200 tip/extra change',
      closed_by: 'Muhammad Yaqoob',
    });

    expect(closing.expected_cash).toBe(summary.expectedCash);
    expect(closing.actual_cash).toBe(counted);
    expect(closing.difference).toBe(200); // positive difference = surplus
  });

  it('identifies cash shortage (deficit) when actual counted cash is less than expected', () => {
    const summary = StorageEngine.getDailyClosingSummary(orgId, today);
    const counted = summary.expectedCash - 120; // 120 deficit

    const closing = StorageEngine.recordDailyClosing(orgId, {
      closing_date: today,
      actual_cash: counted,
      notes: 'Shortage due to unrecorded minor coin difference',
      closed_by: 'Muhammad Yaqoob',
    });

    expect(closing.difference).toBe(-120); // negative difference = shortage
  });

  it('records zero difference when counted cash matches expected exactly', () => {
    const summary = StorageEngine.getDailyClosingSummary(orgId, today);
    const closing = StorageEngine.recordDailyClosing(orgId, {
      closing_date: today,
      actual_cash: summary.expectedCash,
      notes: 'Balanced perfectly',
      closed_by: 'Muhammad Yaqoob',
    });

    expect(closing.difference).toBe(0);
  });

  it('correctly includes owner capital and owner withdrawal in expected cash closing', () => {
    const summaryBefore = StorageEngine.getDailyClosingSummary(orgId, today);
    const expectedBefore = summaryBefore.expectedCash;

    // Inject Rs. 50,000 capital in Cash
    StorageEngine.recordCapital(orgId, {
      account_id: 'acc-cash',
      amount: 50000,
      date: today,
      description: 'Capital test',
      created_by: 'Owner Yaqoob',
    });

    // Withdraw Rs. 10,000 from Cash
    StorageEngine.recordWithdrawal(orgId, {
      account_id: 'acc-cash',
      amount: 10000,
      date: today,
      description: 'Drawings test',
      created_by: 'Owner Yaqoob',
    });

    const summaryAfter = StorageEngine.getDailyClosingSummary(orgId, today);
    expect(summaryAfter.cashCapital).toBe(50000);
    expect(summaryAfter.cashWithdrawals).toBe(10000);
    expect(summaryAfter.expectedCash).toBe(expectedBefore + 50000 - 10000);
  });

  it('carries forward previous verified closing cash to the next day opening cash', () => {
    const day1 = '2026-05-10';
    const day2 = '2026-05-11';

    // Day 1 closing with verified actual cash of 15,750
    StorageEngine.recordDailyClosing(orgId, {
      closing_date: day1,
      actual_cash: 15750,
      notes: 'Day 1 closed and verified',
      closed_by: 'Muhammad Yaqoob',
    });

    // Day 2 summary must pick up 15,750 as opening cash, NOT static 10,000
    const day2Summary = StorageEngine.getDailyClosingSummary(orgId, day2);
    expect(day2Summary.openingCash).toBe(15750);
  });
});
