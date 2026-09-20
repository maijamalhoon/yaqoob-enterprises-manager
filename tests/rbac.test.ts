import { describe, it, expect } from 'vitest';
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

describe('Single-Owner Permission Model', () => {
  describe('All permissions are unrestricted regardless of role parameter', () => {
    const roles = ['OWNER', 'MANAGER', 'CASHIER', undefined, 'UNKNOWN'] as const;

    for (const role of roles) {
      it(`grants all operational permissions when role=${String(role)}`, () => {
        expect(canPerformQuickSale(role as any)).toBe(true);
        expect(canRecordExpense(role as any)).toBe(true);
        expect(canSubmitDailyClosing(role as any)).toBe(true);
        expect(canVoidSale(role as any)).toBe(true);
        expect(canVoidExpense(role as any)).toBe(true);
        expect(canManageInventory(role as any)).toBe(true);
        expect(canTransferFunds(role as any)).toBe(true);
        expect(canViewReports(role as any)).toBe(true);
        expect(canManageBusinessConfig(role as any)).toBe(true);
        expect(canManageStaff(role as any)).toBe(true);
        expect(canRestoreDatabase(role as any)).toBe(true);
      });
    }
  });

  describe('Generic Permission Evaluator', () => {
    it('always returns true for any role/permission combination', () => {
      expect(hasPermission('OWNER', 'RESTORE_DATABASE')).toBe(true);
      expect(hasPermission('MANAGER', 'RESTORE_DATABASE')).toBe(true);
      expect(hasPermission('CASHIER', 'RESTORE_DATABASE')).toBe(true);
      expect(hasPermission(undefined, 'VOID_SALE')).toBe(true);
    });
  });
});
