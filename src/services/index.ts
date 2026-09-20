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
import { isTauriEnvironment } from './sqliteEngine';
import { sqliteRepository } from './sqliteRepository';
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
  UserProfile,
} from '../types';

const desktopRepository = isTauriEnvironment() ? sqliteRepository : null;

export async function getProfiles(organizationId: string): Promise<UserProfile[]> {
  if (desktopRepository) return desktopRepository.getProfiles(organizationId);
  return StorageEngine.getProfiles(organizationId);
}

export class SalesRepository implements ISalesRepository {
  async getSales(
    organizationId: string,
    options?: { startDate?: string; endDate?: string; customerId?: string; status?: string }
  ): Promise<Sale[]> {
    if (desktopRepository) return desktopRepository.getSales(organizationId, options);
    return StorageEngine.getSales(organizationId, options);
  }

  async getSaleById(organizationId: string, saleId: string): Promise<Sale | null> {
    if (desktopRepository) return desktopRepository.getSaleById(organizationId, saleId);
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
    if (desktopRepository) return desktopRepository.createSale(organizationId, payload);
    return StorageEngine.createSaleTransaction(organizationId, payload);
  }

  async voidSale(
    organizationId: string,
    saleId: string,
    cashierId: string,
    cashierName: string,
    reason: string
  ): Promise<Sale> {
    if (desktopRepository) return desktopRepository.voidSale(organizationId, saleId, cashierId, cashierName, reason);
    return StorageEngine.voidSaleTransaction(organizationId, saleId, cashierId, cashierName, reason);
  }
}

export class InventoryRepository implements IInventoryRepository {
  async getProducts(organizationId: string): Promise<Product[]> {
    if (desktopRepository) return desktopRepository.getProducts(organizationId);
    return StorageEngine.getProducts(organizationId);
  }

  async getProductById(organizationId: string, productId: string): Promise<Product | null> {
    if (desktopRepository) return desktopRepository.getProductById(organizationId, productId);
    return StorageEngine.getProductById(organizationId, productId);
  }

  async saveProduct(
    organizationId: string,
    product: Partial<Product> & { name: string; unit: string; selling_price: number }
  ): Promise<Product> {
    if (desktopRepository) return desktopRepository.saveProduct(organizationId, product);
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
    if (desktopRepository) return desktopRepository.deleteProduct(organizationId, productId);
    return StorageEngine.deleteProduct(organizationId, productId);
  }

  async getServices(organizationId: string): Promise<Service[]> {
    if (desktopRepository) return desktopRepository.getServices(organizationId);
    return StorageEngine.getServices(organizationId);
  }

  async saveService(
    organizationId: string,
    service: Partial<Service> & { name: string; selling_price: number }
  ): Promise<Service> {
    if (desktopRepository) return desktopRepository.saveService(organizationId, service);
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
    if (desktopRepository) return desktopRepository.deleteService(organizationId, serviceId);
    return StorageEngine.deleteService(organizationId, serviceId);
  }

  async recordStockMovement(
    organizationId: string,
    movement: Omit<StockMovement, 'id' | 'created_at'>
  ): Promise<StockMovement> {
    if (desktopRepository) return desktopRepository.recordStockMovement(organizationId, movement);
    const fullMovement: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    return StorageEngine.recordStockMovement(fullMovement);
  }

  async getStockMovements(organizationId: string, productId?: string): Promise<StockMovement[]> {
    if (desktopRepository) return desktopRepository.getStockMovements(organizationId, productId);
    return StorageEngine.getStockMovements(organizationId, productId);
  }

  async getCategories(organizationId: string): Promise<Category[]> {
    if (desktopRepository) return desktopRepository.getCategories(organizationId);
    return StorageEngine.getCategories(organizationId);
  }

  async saveCategory(
    organizationId: string,
    category: Partial<Category> & { name: string; type: 'PRODUCT' | 'SERVICE' | 'BOTH' }
  ): Promise<Category> {
    if (desktopRepository) return desktopRepository.saveCategory(organizationId, category);
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
    if (desktopRepository) return desktopRepository.getExpenses(organizationId, options);
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
    if (desktopRepository) return desktopRepository.createExpense(organizationId, payload);
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
    if (desktopRepository) return desktopRepository.voidExpense(organizationId, expenseId, userId, userName);
    return StorageEngine.voidExpense(organizationId, expenseId, userId, userName);
  }

  async getCategories(organizationId: string): Promise<ExpenseCategory[]> {
    if (desktopRepository) return desktopRepository.getExpenseCategories(organizationId);
    return StorageEngine.getExpenseCategories(organizationId);
  }

  async saveCategory(
    organizationId: string,
    category: Partial<ExpenseCategory> & { name: string }
  ): Promise<ExpenseCategory> {
    if (desktopRepository) return desktopRepository.saveExpenseCategory(organizationId, category);
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
    if (desktopRepository) return desktopRepository.getCustomers(organizationId, query);
    return StorageEngine.getCustomers(organizationId, query);
  }

  async getCustomerById(organizationId: string, id: string): Promise<Customer | null> {
    if (desktopRepository) return desktopRepository.getCustomerById(organizationId, id);
    return StorageEngine.getCustomerById(organizationId, id);
  }

  async saveCustomer(
    organizationId: string,
    customer: Partial<Customer> & { name: string }
  ): Promise<Customer> {
    if (desktopRepository) return desktopRepository.saveCustomer(organizationId, customer);
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
    if (desktopRepository) return desktopRepository.getAccounts(organizationId);
    return StorageEngine.getAccounts(organizationId);
  }

  async getAccountById(organizationId: string, id: string): Promise<PaymentAccount | null> {
    if (desktopRepository) return desktopRepository.getAccountById(organizationId, id);
    return StorageEngine.getAccountById(organizationId, id);
  }

  async saveAccount(
    organizationId: string,
    account: Partial<PaymentAccount> & { name: string; type: PaymentAccount['type'] }
  ): Promise<PaymentAccount> {
    if (desktopRepository) return desktopRepository.saveAccount(organizationId, account);
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
    if (desktopRepository) return desktopRepository.transferFunds(organizationId, payload);
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
    if (desktopRepository) return desktopRepository.getTransactions(organizationId, accountId);
    return StorageEngine.getTransactions(organizationId, accountId);
  }
}

export class ClosingRepository implements IClosingRepository {
  async getClosings(organizationId: string): Promise<DailyClosing[]> {
    if (desktopRepository) return desktopRepository.getClosings(organizationId);
    return StorageEngine.getDailyClosings(organizationId);
  }

  async getDailyClosingSummary(organizationId: string, date: string) {
    if (desktopRepository) return desktopRepository.getDailyClosingSummary(organizationId, date);
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
    if (desktopRepository) return desktopRepository.recordDailyClosing(organizationId, payload);
    return StorageEngine.recordDailyClosing(organizationId, payload);
  }
}

export class AuditRepository implements IAuditRepository {
  async getLogs(organizationId: string, limit = 100): Promise<AuditLog[]> {
    if (desktopRepository) return desktopRepository.getLogs(organizationId, limit);
    return StorageEngine.getAuditLogs(organizationId, limit);
  }

  async log(organizationId: string, log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    if (desktopRepository) return desktopRepository.log(organizationId, log);
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
