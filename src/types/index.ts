export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface Organization {
  id: string;
  name: string;
  owner_name: string;
  currency: string;
  currency_symbol: string;
  country: string;
  timezone: string;
  business_category: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_rate: number;
  tax_enabled: boolean;
  receipt_footer?: string;
  invoice_prefix: string;
  next_invoice_number: number;
  created_at: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
  is_active: boolean;
  password_hash?: string;
  last_login?: string;
  created_at: string;
}

export type ItemType = 'PRODUCT' | 'SERVICE';

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE' | 'BOTH';
  color?: string;
  created_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku: string;
  category_id?: string;
  category_name?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  opening_stock: number;
  current_stock: number;
  min_stock_threshold: number;
  track_stock: boolean;
  is_active: boolean;
  supplier?: string;
  notes?: string;
  average_cost: number;
  stock_value: number;
  created_at: string;
  updated_at?: string;
}

export interface ServiceRecipeComponent {
  id: string;
  organization_id: string;
  service_id: string;
  product_id: string;
  product_name?: string;
  quantity_consumed: number;
  unit?: string;
}

export interface Service {
  id: string;
  organization_id: string;
  name: string;
  sku?: string;
  category_id?: string;
  category_name?: string;
  selling_price: number;
  estimated_cost: number;
  is_active: boolean;
  notes?: string;
  components?: ServiceRecipeComponent[];
  created_at: string;
  updated_at?: string;
}

export type StockMovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'DAMAGE_WASTAGE'
  | 'CORRECTION';

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  product_name?: string;
  movement_type: StockMovementType;
  quantity: number; // positive or negative
  unit_cost: number;
  total_cost: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  total_purchases: number;
  last_purchase_date?: string;
  outstanding_balance: number;
  created_at: string;
}

export type AccountType = 'CASH' | 'BANK' | 'DIGITAL_WALLET' | 'OTHER';

export interface PaymentAccount {
  id: string;
  organization_id: string;
  name: string;
  type: AccountType;
  account_number?: string;
  current_balance: number;
  opening_balance: number;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
}

export interface AccountTransfer {
  id: string;
  organization_id: string;
  from_account_id: string;
  from_account_name: string;
  to_account_id: string;
  to_account_name: string;
  amount: number;
  date: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface AccountTransaction {
  id: string;
  organization_id: string;
  account_id: string;
  account_name: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  amount: number;
  balance_after: number;
  reference_type: 'SALE' | 'EXPENSE' | 'TRANSFER' | 'CLOSING';
  reference_id?: string;
  description: string;
  date: string;
  created_at: string;
}

export interface SplitPayment {
  account_id: string;
  account_name: string;
  amount: number;
}

export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface SaleItem {
  id: string;
  organization_id: string;
  sale_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  subtotal: number;
  total: number;
  cogs: number;
  gross_profit: number;
}

export interface Sale {
  id: string;
  organization_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_id: string;
  cashier_name: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  change_due: number;
  payment_method: string;
  split_payments: SplitPayment[];
  total_cogs: number;
  gross_profit: number;
  status: SaleStatus;
  notes?: string;
  void_reason?: string;
  voided_by?: string;
  voided_at?: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  category_id: string;
  category_name: string;
  amount: number;
  account_id: string;
  account_name: string;
  description: string;
  reference_number?: string;
  date: string;
  notes?: string;
  entered_by: string;
  status: 'ACTIVE' | 'VOIDED';
  created_at: string;
}

export interface DailyClosing {
  id: string;
  organization_id: string;
  closing_date: string;
  opening_cash: number;
  cash_sales: number;
  cash_expenses: number;
  cash_transfers_in: number;
  cash_transfers_out: number;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  notes?: string;
  closed_by: string;
  closed_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// POS Cart item in UI
export interface CartItem {
  id: string;
  type: ItemType;
  item_id: string;
  name: string;
  sku?: string;
  unit?: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  discount: number;
  current_stock?: number;
  track_stock?: boolean;
}
