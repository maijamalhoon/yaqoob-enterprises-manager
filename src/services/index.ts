import {
  ISalesRepository,
  IInventoryRepository,
  IExpenseRepository,
  ICustomerRepository,
  IAccountRepository,
  IClosingRepository,
  IAuditRepository,
} from './contracts';
import { StorageEngine } from './storageEngine';
import {
  Sale,
  Product,
  Service,
  Customer,
  PaymentAccount,
  AccountTransfer,
  Expense,
  ExpenseCategory,
  DailyClosing,
  AuditLog,
  StockMovement,
  Category,
  SplitPayment,
} from '../types';

export class SalesRepository implements ISalesRepository {
  async getSales(
    organizationId: string,
    options?: { startDate?: string; endDate?: string; customerId?: string; status?: string }
  ): Promise<Sale[]> {
    return StorageEngine.getSales(organizationId, options);
  }

  async getSaleById(organizationId: string, saleId: string): Promise<Sale | null> {
    return StorageEngine.getSaleById(organizationId, saleId);
  }

  async createSale(
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
  ): Promise<Sale> {
    return StorageEngine.createSaleTransaction(organizationId, payload);
  }

  async voidSale(
    organizationId: string,
    saleId: string,
    cashierId: string,
    cashierName: string,
    reason: string
  ): Promise<Sale> {
    return StorageEngine.voidSaleTransaction(organizationId, saleId, cashierId, cashierName, reason);
  }
}

export class InventoryRepository implements IInventoryRepository {
  async getProducts(organizationId: string): Promise<Product[]> {
    return StorageEngine.getProducts(organizationId);
  }

  async getProductById(organizationId: string, productId: string): Promise<Product | null> {
    return StorageEngine.getProductById(organizationId, productId);
  }

  async saveProduct(
    organizationId: string,
    product: Partial<Product> & { name: string; unit: string; selling_price: number }
  ): Promise<Product> {
    const fullProduct: Product = {
      id: product.id || `prod-${Date.now()}`,
      organization_id: organizationId,
      name: product.name,
      sku: product.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category_id: product.category_id,
      category_name: product.category_name,
      unit: product.unit,
      purchase_price: product.purchase_price || 0,
      selling_price: product.selling_price,
      opening_stock: product.opening_stock || 0,
      current_stock: product.current_stock ?? product.opening_stock ?? 0,
      min_stock_threshold: product.min_stock_threshold || 5,
      track_stock: product.track_stock ?? true,
      is_active: product.is_active ?? true,
      supplier: product.supplier,
      notes: product.notes,
      average_cost: product.average_cost ?? product.purchase_price ?? 0,
      stock_value: (product.current_stock ?? product.opening_stock ?? 0) * (product.average_cost ?? product.purchase_price ?? 0),
      created_at: product.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveProduct(fullProduct);
  }

  async deleteProduct(organizationId: string, productId: string): Promise<boolean> {
    return StorageEngine.deleteProduct(organizationId, productId);
  }

  async getServices(organizationId: string): Promise<Service[]> {
    return StorageEngine.getServices(organizationId);
  }

  async saveService(
    organizationId: string,
    service: Partial<Service> & { name: string; selling_price: number }
  ): Promise<Service> {
    const fullService: Service = {
      id: service.id || `srv-${Date.now()}`,
      organization_id: organizationId,
      name: service.name,
      sku: service.sku || `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      category_id: service.category_id,
      category_name: service.category_name,
      selling_price: service.selling_price,
      estimated_cost: service.estimated_cost || 0,
      is_active: service.is_active ?? true,
      notes: service.notes,
      components: service.components || [],
      created_at: service.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveService(fullService);
  }

  async deleteService(organizationId: string, serviceId: string): Promise<boolean> {
    return StorageEngine.deleteService(organizationId, serviceId);
  }

  async recordStockMovement(
    organizationId: string,
    movement: Omit<StockMovement, 'id' | 'created_at'>
  ): Promise<StockMovement> {
    const fullMovement: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    return StorageEngine.recordStockMovement(fullMovement);
  }

  async getStockMovements(organizationId: string, productId?: string): Promise<StockMovement[]> {
    return StorageEngine.getStockMovements(organizationId, productId);
  }

  async getCategories(organizationId: string): Promise<Category[]> {
    return StorageEngine.getCategories(organizationId);
  }

  async saveCategory(
    organizationId: string,
    category: Partial<Category> & { name: string; type: 'PRODUCT' | 'SERVICE' | 'BOTH' }
  ): Promise<Category> {
    const fullCategory: Category = {
      id: category.id || `cat-${Date.now()}`,
      organization_id: organizationId,
      name: category.name,
      type: category.type,
      color: category.color || '#06B6D4',
      created_at: category.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveCategory(fullCategory);
  }
}

export class ExpenseRepository implements IExpenseRepository {
  async getExpenses(
    organizationId: string,
    options?: { startDate?: string; endDate?: string; categoryId?: string }
  ): Promise<Expense[]> {
    return StorageEngine.getExpenses(organizationId, options);
  }

  async createExpense(
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
  ): Promise<Expense> {
    const categories = StorageEngine.getExpenseCategories(organizationId);
    const cat = categories.find((c) => c.id === payload.category_id);
    const accounts = StorageEngine.getAccounts(organizationId);
    const acc = accounts.find((a) => a.id === payload.account_id);

    const expense: Expense = {
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: organizationId,
      category_id: payload.category_id,
      category_name: cat ? cat.name : 'General Expense',
      amount: payload.amount,
      account_id: payload.account_id,
      account_name: acc ? acc.name : 'Cash Drawer',
      description: payload.description,
      reference_number: payload.reference_number,
      date: payload.date,
      notes: payload.notes,
      entered_by: payload.entered_by,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };
    return StorageEngine.recordExpense(expense);
  }

  async voidExpense(organizationId: string, expenseId: string, userId: string, userName: string): Promise<Expense> {
    return StorageEngine.voidExpense(organizationId, expenseId, userId, userName);
  }

  async getCategories(organizationId: string): Promise<ExpenseCategory[]> {
    return StorageEngine.getExpenseCategories(organizationId);
  }

  async saveCategory(
    organizationId: string,
    category: Partial<ExpenseCategory> & { name: string }
  ): Promise<ExpenseCategory> {
    const fullCat: ExpenseCategory = {
      id: category.id || `expcat-${Date.now()}`,
      organization_id: organizationId,
      name: category.name,
      description: category.description,
      is_active: category.is_active ?? true,
      created_at: category.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveExpenseCategory(fullCat);
  }
}

export class CustomerRepository implements ICustomerRepository {
  async getCustomers(organizationId: string, query?: string): Promise<Customer[]> {
    return StorageEngine.getCustomers(organizationId, query);
  }

  async getCustomerById(organizationId: string, id: string): Promise<Customer | null> {
    return StorageEngine.getCustomerById(organizationId, id);
  }

  async saveCustomer(
    organizationId: string,
    customer: Partial<Customer> & { name: string }
  ): Promise<Customer> {
    const fullCustomer: Customer = {
      id: customer.id || `cust-${Date.now()}`,
      organization_id: organizationId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      total_purchases: customer.total_purchases || 0,
      last_purchase_date: customer.last_purchase_date,
      outstanding_balance: customer.outstanding_balance || 0,
      created_at: customer.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveCustomer(fullCustomer);
  }
}

export class AccountRepository implements IAccountRepository {
  async getAccounts(organizationId: string): Promise<PaymentAccount[]> {
    return StorageEngine.getAccounts(organizationId);
  }

  async getAccountById(organizationId: string, id: string): Promise<PaymentAccount | null> {
    return StorageEngine.getAccountById(organizationId, id);
  }

  async saveAccount(
    organizationId: string,
    account: Partial<PaymentAccount> & { name: string; type: PaymentAccount['type'] }
  ): Promise<PaymentAccount> {
    const fullAccount: PaymentAccount = {
      id: account.id || `acc-${Date.now()}`,
      organization_id: organizationId,
      name: account.name,
      type: account.type,
      account_number: account.account_number,
      current_balance: account.current_balance ?? account.opening_balance ?? 0,
      opening_balance: account.opening_balance ?? 0,
      is_active: account.is_active ?? true,
      is_default: account.is_default ?? false,
      created_at: account.created_at || new Date().toISOString(),
    };
    return StorageEngine.saveAccount(fullAccount);
  }

  async transferFunds(
    organizationId: string,
    payload: {
      from_account_id: string;
      to_account_id: string;
      amount: number;
      notes?: string;
      date: string;
      created_by: string;
    }
  ): Promise<AccountTransfer> {
    const accounts = StorageEngine.getAccounts(organizationId);
    const fromAcc = accounts.find((a) => a.id === payload.from_account_id);
    const toAcc = accounts.find((a) => a.id === payload.to_account_id);

    const transfer: AccountTransfer = {
      id: `tf-${Date.now()}`,
      organization_id: organizationId,
      from_account_id: payload.from_account_id,
      from_account_name: fromAcc ? fromAcc.name : 'Source Account',
      to_account_id: payload.to_account_id,
      to_account_name: toAcc ? toAcc.name : 'Destination Account',
      amount: payload.amount,
      date: payload.date,
      notes: payload.notes,
      created_by: payload.created_by,
      created_at: new Date().toISOString(),
    };
    return StorageEngine.transferFunds(transfer);
  }

  async getTransactions(organizationId: string, accountId?: string) {
    return StorageEngine.getTransactions(organizationId, accountId);
  }
}

export class ClosingRepository implements IClosingRepository {
  async getClosings(organizationId: string): Promise<DailyClosing[]> {
    return StorageEngine.getDailyClosings(organizationId);
  }

  async getDailyClosingSummary(organizationId: string, date: string) {
    return StorageEngine.getDailyClosingSummary(organizationId, date);
  }

  async recordDailyClosing(
    organizationId: string,
    payload: {
      closing_date: string;
      actual_cash: number;
      notes?: string;
      closed_by: string;
    }
  ): Promise<DailyClosing> {
    return StorageEngine.recordDailyClosing(organizationId, payload);
  }
}

export class AuditRepository implements IAuditRepository {
  async getLogs(organizationId: string, limit = 100): Promise<AuditLog[]> {
    return StorageEngine.getAuditLogs(organizationId, limit);
  }

  async log(organizationId: string, log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const fullLog: AuditLog = {
      ...log,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    return StorageEngine.logAction(fullLog);
  }
}

export const salesRepo = new SalesRepository();
export const inventoryRepo = new InventoryRepository();
export const expenseRepo = new ExpenseRepository();
export const customerRepo = new CustomerRepository();
export const accountRepo = new AccountRepository();
export const closingRepo = new ClosingRepository();
export const auditRepo = new AuditRepository();
