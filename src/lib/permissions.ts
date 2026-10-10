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

const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
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
  ],
  MANAGER: [
    'FAST_POS_CHECKOUT',
    'RECORD_EXPENSES',
    'SUBMIT_DAILY_CLOSING',
    'VOID_SALE',
    'VOID_EXPENSE',
    'MANAGE_INVENTORY',
    'ACCOUNT_TRANSFER',
    'VIEW_REPORTS_PL',
  ],
  CASHIER: [
    'FAST_POS_CHECKOUT',
    'RECORD_EXPENSES',
    'SUBMIT_DAILY_CLOSING',
  ],
};

export function hasPermission(role?: UserRole | string, permission?: Permission): boolean {
  if (!role || !permission || !Object.hasOwn(rolePermissions, role)) return false;
  return rolePermissions[role as UserRole].includes(permission);
}

export const canPerformQuickSale = (role?: UserRole | string): boolean => hasPermission(role, 'FAST_POS_CHECKOUT');
export const canRecordExpense = (role?: UserRole | string): boolean => hasPermission(role, 'RECORD_EXPENSES');
export const canSubmitDailyClosing = (role?: UserRole | string): boolean => hasPermission(role, 'SUBMIT_DAILY_CLOSING');
export const canVoidSale = (role?: UserRole | string): boolean => hasPermission(role, 'VOID_SALE');
export const canVoidExpense = (role?: UserRole | string): boolean => hasPermission(role, 'VOID_EXPENSE');
export const canManageInventory = (role?: UserRole | string): boolean => hasPermission(role, 'MANAGE_INVENTORY');
export const canTransferFunds = (role?: UserRole | string): boolean => hasPermission(role, 'ACCOUNT_TRANSFER');
export const canViewReports = (role?: UserRole | string): boolean => hasPermission(role, 'VIEW_REPORTS_PL');
export const canManageBusinessConfig = (role?: UserRole | string): boolean => hasPermission(role, 'MANAGE_BUSINESS_CONFIG');
export const canManageStaff = (role?: UserRole | string): boolean => hasPermission(role, 'MANAGE_STAFF');
export const canRestoreDatabase = (role?: UserRole | string): boolean => hasPermission(role, 'RESTORE_DATABASE');
