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

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  OWNER: new Set<Permission>([
    'FAST_POS_CHECKOUT',
    'RECORD_EXPENSES',
    'SUBMIT_DAILY_CLOSING',
    'VOID_SALE',
    'VOID_EXPENSE',
    'MANAGE_INVENTORY',
    'ACCOUNT_TRANSFER',
    'VIEW_REPORTS_PL',
    'MANAGE_BUSINESS_CONFIG',
    'MANAGE_STAFF',
    'RESTORE_DATABASE',
  ]),
  MANAGER: new Set<Permission>([
    'FAST_POS_CHECKOUT',
    'RECORD_EXPENSES',
    'SUBMIT_DAILY_CLOSING',
    'VOID_SALE',
    'VOID_EXPENSE',
    'MANAGE_INVENTORY',
    'ACCOUNT_TRANSFER',
    'VIEW_REPORTS_PL',
  ]),
  CASHIER: new Set<Permission>([
    'FAST_POS_CHECKOUT',
    'RECORD_EXPENSES',
    'SUBMIT_DAILY_CLOSING',
  ]),
};

/**
 * Check whether a user role has a specific business permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(permission) : false;
}

/**
 * Convenient single-check helper methods
 */
export const canPerformQuickSale = (role: UserRole): boolean => hasPermission(role, 'FAST_POS_CHECKOUT');
export const canRecordExpense = (role: UserRole): boolean => hasPermission(role, 'RECORD_EXPENSES');
export const canSubmitDailyClosing = (role: UserRole): boolean => hasPermission(role, 'SUBMIT_DAILY_CLOSING');
export const canVoidSale = (role: UserRole): boolean => hasPermission(role, 'VOID_SALE');
export const canVoidExpense = (role: UserRole): boolean => hasPermission(role, 'VOID_EXPENSE');
export const canManageInventory = (role: UserRole): boolean => hasPermission(role, 'MANAGE_INVENTORY');
export const canTransferFunds = (role: UserRole): boolean => hasPermission(role, 'ACCOUNT_TRANSFER');
export const canViewReports = (role: UserRole): boolean => hasPermission(role, 'VIEW_REPORTS_PL');
export const canManageBusinessConfig = (role: UserRole): boolean => hasPermission(role, 'MANAGE_BUSINESS_CONFIG');
export const canManageStaff = (role: UserRole): boolean => hasPermission(role, 'MANAGE_STAFF');
export const canRestoreDatabase = (role: UserRole): boolean => hasPermission(role, 'RESTORE_DATABASE');
