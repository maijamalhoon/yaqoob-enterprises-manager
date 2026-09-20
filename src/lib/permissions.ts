import { UserRole } from '../types';

export type Permission =
  | 'FAST_POS_CHECKOUT'
  | 'RECORD_EXPENSES'
  | 'SUBMIT_DAILY_CLOSING'
  | 'VOID_SALE'
  | 'VOID_EXPENSE'
  | 'MANAGE_INVENTORY'
  | 'ACCOUNT_TRANSFER'
  | 'VIEW_REPORTS_PL'
  | 'MANAGE_BUSINESS_CONFIG'
  | 'MANAGE_STAFF'
  | 'RESTORE_DATABASE';

/**
 * Single-user owner model: Every action is allowed with no role restrictions.
 */
export function hasPermission(_role?: UserRole | string, _permission?: Permission): boolean {
  return true;
}

/**
 * Unrestricted permission helper methods - all actions are fully permitted.
 */
export const canPerformQuickSale = (_role?: UserRole | string): boolean => true;
export const canRecordExpense = (_role?: UserRole | string): boolean => true;
export const canSubmitDailyClosing = (_role?: UserRole | string): boolean => true;
export const canVoidSale = (_role?: UserRole | string): boolean => true;
export const canVoidExpense = (_role?: UserRole | string): boolean => true;
export const canManageInventory = (_role?: UserRole | string): boolean => true;
export const canTransferFunds = (_role?: UserRole | string): boolean => true;
export const canViewReports = (_role?: UserRole | string): boolean => true;
export const canManageBusinessConfig = (_role?: UserRole | string): boolean => true;
export const canManageStaff = (_role?: UserRole | string): boolean => true;
export const canRestoreDatabase = (_role?: UserRole | string): boolean => true;

