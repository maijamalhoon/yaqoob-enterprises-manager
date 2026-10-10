import { describe, expect, it } from 'vitest';
import {
  canPerformQuickSale,
  canRecordExpense,
  canSubmitDailyClosing,
  canVoidSale,
  canVoidExpense,
  canManageInventory,
  canTransferFunds,
  canViewReports,
  canManageBusinessConfig,
  canManageStaff,
  canRestoreDatabase,
  hasPermission,
} from '@/lib/permissions';

describe('Role-based permissions', () => {
  it('allows owners all operational and administrative actions', () => {
    for (const permission of [
      canPerformQuickSale,
      canRecordExpense,
      canSubmitDailyClosing,
      canVoidSale,
      canVoidExpense,
      canManageInventory,
      canTransferFunds,
      canViewReports,
      canManageBusinessConfig,
      canManageStaff,
      canRestoreDatabase,
    ]) {
      expect(permission('OWNER')).toBe(true);
    }
  });

  it('allows managers daily operations and transaction control but not administration', () => {
    expect(canPerformQuickSale('MANAGER')).toBe(true);
    expect(canRecordExpense('MANAGER')).toBe(true);
    expect(canSubmitDailyClosing('MANAGER')).toBe(true);
    expect(canVoidSale('MANAGER')).toBe(true);
    expect(canVoidExpense('MANAGER')).toBe(true);
    expect(canManageInventory('MANAGER')).toBe(true);
    expect(canTransferFunds('MANAGER')).toBe(true);
    expect(canViewReports('MANAGER')).toBe(true);
    expect(canManageBusinessConfig('MANAGER')).toBe(false);
    expect(canManageStaff('MANAGER')).toBe(false);
    expect(canRestoreDatabase('MANAGER')).toBe(false);
  });

  it('limits cashiers to sales, expenses, and daily closing', () => {
    expect(canPerformQuickSale('CASHIER')).toBe(true);
    expect(canRecordExpense('CASHIER')).toBe(true);
    expect(canSubmitDailyClosing('CASHIER')).toBe(true);
    expect(canVoidSale('CASHIER')).toBe(false);
    expect(canVoidExpense('CASHIER')).toBe(false);
    expect(canManageInventory('CASHIER')).toBe(false);
    expect(canTransferFunds('CASHIER')).toBe(false);
    expect(canViewReports('CASHIER')).toBe(false);
    expect(canManageBusinessConfig('CASHIER')).toBe(false);
    expect(canManageStaff('CASHIER')).toBe(false);
    expect(canRestoreDatabase('CASHIER')).toBe(false);
  });

  it('denies unknown roles and missing permission names', () => {
    expect(hasPermission('UNKNOWN', 'VOID_EXPENSE')).toBe(false);
    expect(hasPermission(undefined, 'VOID_SALE')).toBe(false);
    expect(hasPermission('OWNER')).toBe(false);
  });
});
