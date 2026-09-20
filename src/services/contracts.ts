import {
  Organization,
  UserProfile,
  Category,
  Product,
  Service,
  Customer,
  PaymentAccount,
  AccountTransfer,
  AccountTransaction,
  Sale,
  SaleItem,
  Expense,
  ExpenseCategory,
  DailyClosing,
  AuditLog,
  StockMovement,
  SplitPayment,
} from '../types';

export interface ISalesRepository {
  getSales(organizationId: string, options?: { startDate?: string; endDate?: string; customerId?: string; status?: string }): Promise<Sale[]>;
  getSaleById(organizationId: string, saleId: string): Promise<Sale | null>;
  createSale(
    organizationId: string,
    payload: {
      customer_id?: string;
      customer_name?: string;
      customer_phone?: string;
      cashier_id: string;
      cashier_name: string;
      items: Array<{
        type: 'PRODUCT' | 'SERVICE';
        item_id: string;
        name: string;
        sku?: string;
        unit?: string;
        quantity: number;
        unit_price: number;
        discount?: number;
      }>;
      discount: number;
      tax_amount: number;
      amount_paid: number;
      payment_method: string;
      split_payments: SplitPayment[];
      notes?: string;
    }
  ): Promise<Sale>;
  voidSale(organizationId: string, saleId: string, cashierId: string, cashierName: string, reason: string): Promise<Sale>;
}

export interface IInventoryRepository {
  getProducts(organizationId: string): Promise<Product[]>;
  getProductById(organizationId: string, productId: string): Promise<Product | null>;
  saveProduct(organizationId: string, product: Partial<Product> & { name: string; unit: string; selling_price: number }): Promise<Product>;
  deleteProduct(organizationId: string, productId: string): Promise<boolean>;
  getServices(organizationId: string): Promise<Service[]>;
  saveService(organizationId: string, service: Partial<Service> & { name: string; selling_price: number }): Promise<Service>;
  deleteService(organizationId: string, service: string): Promise<boolean>;
  recordStockMovement(
    organizationId: string,
    movement: Omit<StockMovement, 'id' | 'created_at'>
  ): Promise<StockMovement>;
  getStockMovements(organizationId: string, productId?: string): Promise<StockMovement[]>;
  getCategories(organizationId: string): Promise<Category[]>;
  saveCategory(organizationId: string, category: Partial<Category> & { name: string; type: 'PRODUCT' | 'SERVICE' | 'BOTH' }): Promise<Category>;
}

export interface IExpenseRepository {
  getExpenses(organizationId: string, options?: { startDate?: string; endDate?: string; categoryId?: string }): Promise<Expense[]>;
  createExpense(
    organizationId: string,
    payload: {
      category_id: string;
      amount: number;
      account_id: string;
      description: string;
      reference_number?: string;
      date: string;
      notes?: string;
      entered_by: string;
    }
  ): Promise<Expense>;
  voidExpense(organizationId: string, expenseId: string, userId: string, userName: string): Promise<Expense>;
  getCategories(organizationId: string): Promise<ExpenseCategory[]>;
  saveCategory(organizationId: string, category: Partial<ExpenseCategory> & { name: string }): Promise<ExpenseCategory>;
}

export interface ICustomerRepository {
  getCustomers(organizationId: string, query?: string): Promise<Customer[]>;
  getCustomerById(organizationId: string, id: string): Promise<Customer | null>;
  saveCustomer(organizationId: string, customer: Partial<Customer> & { name: string }): Promise<Customer>;
}

export interface IAccountRepository {
  getAccounts(organizationId: string): Promise<PaymentAccount[]>;
  getAccountById(organizationId: string, id: string): Promise<PaymentAccount | null>;
  saveAccount(organizationId: string, account: Partial<PaymentAccount> & { name: string; type: PaymentAccount['type'] }): Promise<PaymentAccount>;
  transferFunds(
    organizationId: string,
    payload: {
      from_account_id: string;
      to_account_id: string;
      amount: number;
      notes?: string;
      date: string;
      created_by: string;
    }
  ): Promise<AccountTransfer>;
  getTransactions(organizationId: string, accountId?: string): Promise<AccountTransaction[]>;
}

export interface IClosingRepository {
  getClosings(organizationId: string): Promise<DailyClosing[]>;
  getDailyClosingSummary(organizationId: string, date: string): Promise<{
    openingCash: number;
    cashSales: number;
    cashExpenses: number;
    cashTransfersIn: number;
    cashTransfersOut: number;
    expectedCash: number;
  }>;
  recordDailyClosing(
    organizationId: string,
    payload: {
      closing_date: string;
      actual_cash: number;
      notes?: string;
      closed_by: string;
    }
  ): Promise<DailyClosing>;
}

export interface IAuditRepository {
  getLogs(organizationId: string, limit?: number): Promise<AuditLog[]>;
  log(organizationId: string, log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>;
}
