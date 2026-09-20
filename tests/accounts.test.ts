import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

describe('Payment Accounts & Fund Transfers', () => {
  const orgId = DEFAULT_ORGANIZATION.id;

  beforeEach(() => {
    StorageEngine.resetToDefaults();
  });

  it('transfers money between accounts, updating balances and preserving total capital', () => {
    const fromAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const toAcc = StorageEngine.getAccountById(orgId, 'acc-easypaisa')!;

    const initialFromBal = fromAcc.current_balance;
    const initialToBal = toAcc.current_balance;
    const totalBefore = StorageEngine.getAccounts(orgId).reduce((s, a) => s + a.current_balance, 0);

    const transferAmount = 5000;
    const transfer = StorageEngine.transferFunds({
      id: `tf-${Date.now()}`,
      organization_id: orgId,
      from_account_id: fromAcc.id,
      from_account_name: fromAcc.name,
      to_account_id: toAcc.id,
      to_account_name: toAcc.name,
      amount: transferAmount,
      date: new Date().toISOString().slice(0, 10),
      notes: 'Transfer cash drawer excess to Easypaisa merchant wallet',
      created_by: 'Muhammad Yaqoob',
      created_at: new Date().toISOString(),
    });

    expect(transfer.amount).toBe(transferAmount);

    const updatedFrom = StorageEngine.getAccountById(orgId, fromAcc.id)!;
    const updatedTo = StorageEngine.getAccountById(orgId, toAcc.id)!;

    expect(updatedFrom.current_balance).toBe(initialFromBal - transferAmount);
    expect(updatedTo.current_balance).toBe(initialToBal + transferAmount);

    // Total money across all accounts must remain invariant
    const totalAfter = StorageEngine.getAccounts(orgId).reduce((s, a) => s + a.current_balance, 0);
    expect(totalAfter).toBe(totalBefore);
  });

  it('records double-entry TRANSFER_OUT and TRANSFER_IN transaction records in ledger', () => {
    const fromAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const toAcc = StorageEngine.getAccountById(orgId, 'acc-hbl')!;

    const transfer = StorageEngine.transferFunds({
      id: `tf-double-entry-${Date.now()}`,
      organization_id: orgId,
      from_account_id: fromAcc.id,
      from_account_name: fromAcc.name,
      to_account_id: toAcc.id,
      to_account_name: toAcc.name,
      amount: 3500,
      date: new Date().toISOString().slice(0, 10),
      notes: 'Bank deposit',
      created_by: 'Cashier Ali',
      created_at: new Date().toISOString(),
    });

    const transactions = StorageEngine.getTransactions(orgId);
    const outTx = transactions.find(
      (t) => t.reference_id === transfer.id && t.type === 'TRANSFER_OUT'
    );
    const inTx = transactions.find(
      (t) => t.reference_id === transfer.id && t.type === 'TRANSFER_IN'
    );

    expect(outTx).toBeDefined();
    expect(outTx?.account_id).toBe(fromAcc.id);
    expect(outTx?.amount).toBe(3500);

    expect(inTx).toBeDefined();
    expect(inTx?.account_id).toBe(toAcc.id);
    expect(inTx?.amount).toBe(3500);
  });

  it('ensures fund transfers do NOT count as sales revenue or business expenses', () => {
    const salesBefore = StorageEngine.getSales(orgId);
    const expensesBefore = StorageEngine.getExpenses(orgId);

    StorageEngine.transferFunds({
      id: `tf-segregation-${Date.now()}`,
      organization_id: orgId,
      from_account_id: 'acc-cash',
      from_account_name: 'Cash Drawer',
      to_account_id: 'acc-hbl',
      to_account_name: 'HBL Business Account',
      amount: 1000,
      date: new Date().toISOString().slice(0, 10),
      notes: 'Cash to Bank test',
      created_by: 'Cashier Ali',
      created_at: new Date().toISOString(),
    });

    const salesAfter = StorageEngine.getSales(orgId);
    const expensesAfter = StorageEngine.getExpenses(orgId);

    expect(salesAfter.length).toBe(salesBefore.length);
    expect(expensesAfter.length).toBe(expensesBefore.length);
  });

  it('throws an error if attempting to transfer between invalid accounts', () => {
    expect(() => {
      StorageEngine.transferFunds({
        id: `tf-invalid-${Date.now()}`,
        organization_id: orgId,
        from_account_id: 'non-existent-1',
        from_account_name: 'Ghost Account',
        to_account_id: 'acc-cash',
        to_account_name: 'Cash Drawer',
        amount: 500,
        date: new Date().toISOString().slice(0, 10),
        notes: 'Invalid',
        created_by: 'Cashier Ali',
        created_at: new Date().toISOString(),
      });
    }).toThrow('Invalid from/to account for fund transfer');
  });
});
