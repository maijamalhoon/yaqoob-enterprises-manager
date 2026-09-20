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
import {
  DEFAULT_ORGANIZATION,
  STARTER_CATEGORIES,
  STARTER_PRODUCTS,
  STARTER_SERVICES,
  STARTER_PAYMENT_ACCOUNTS,
  STARTER_EXPENSE_CATEGORIES,
  STARTER_CUSTOMERS,
} from '../lib/mockData';
import { roundMoney, calculateWeightedAverageCost } from '../lib/utils';
import { syncEngine } from './syncEngine';
import { requireOrganization, requirePermission } from '../lib/security';

const STORAGE_PREFIX = 'yaqoob_ent_';
const SESSION_KEY = 'yaqoob_auth_session';

interface StorageSchema {
  organizations: Organization[];
  profiles: UserProfile[];
  categories: Category[];
  products: Product[];
  services: Service[];
  customers: Customer[];
  accounts: PaymentAccount[];
  transfers: AccountTransfer[];
  transactions: AccountTransaction[];
  sales: Sale[];
  expenses: Expense[];
  expense_categories: ExpenseCategory[];
  daily_closings: DailyClosing[];
  audit_logs: AuditLog[];
  stock_movements: StockMovement[];
}

function loadStorage(): StorageSchema {
  if (typeof window === 'undefined') {
    return {
      organizations: [DEFAULT_ORGANIZATION],
      profiles: [],
      categories: STARTER_CATEGORIES,
      products: STARTER_PRODUCTS,
      services: STARTER_SERVICES,
      customers: STARTER_CUSTOMERS,
      accounts: STARTER_PAYMENT_ACCOUNTS,
      transfers: [],
      transactions: [],
      sales: [],
      expenses: [],
      expense_categories: STARTER_EXPENSE_CATEGORIES,
      daily_closings: [],
      audit_logs: [],
      stock_movements: [],
    };
  }

  const raw = localStorage.getItem(`${STORAGE_PREFIX}data`);
  if (!raw) {
    const initial: StorageSchema = {
      organizations: [DEFAULT_ORGANIZATION],
      profiles: [
        {
          id: 'usr-owner-1',
          email: 'yaqoobenterprisesofficial@gmail.com',
          full_name: 'Muhammad Yaqoob',
          role: 'OWNER',
          organization_id: DEFAULT_ORGANIZATION.id,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
      categories: STARTER_CATEGORIES,
      products: STARTER_PRODUCTS,
      services: STARTER_SERVICES,
      customers: STARTER_CUSTOMERS,
      accounts: STARTER_PAYMENT_ACCOUNTS,
      transfers: [],
      transactions: [],
      sales: [],
      expenses: [],
      expense_categories: STARTER_EXPENSE_CATEGORIES,
      daily_closings: [],
      audit_logs: [
        {
          id: 'log-init-1',
          organization_id: DEFAULT_ORGANIZATION.id,
          user_id: 'usr-owner-1',
          user_name: 'System',
          action: 'SYSTEM_INITIALIZED',
          entity: 'ORGANIZATION',
          entity_id: DEFAULT_ORGANIZATION.id,
          details: 'Yaqoob Enterprises Manager initialized with starter inventory and services',
          created_at: new Date().toISOString(),
        },
      ],
      stock_movements: STARTER_PRODUCTS.map((p) => ({
        id: `mov-init-${p.id}`,
        organization_id: p.organization_id,
        product_id: p.id,
        product_name: p.name,
        movement_type: 'OPENING_STOCK',
        quantity: p.opening_stock,
        unit_cost: p.average_cost,
        total_cost: p.stock_value,
        notes: 'Initial opening stock balance',
        created_at: new Date().toISOString(),
      })),
    };
    localStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse storage data:', e);
    return {
      organizations: [DEFAULT_ORGANIZATION],
      profiles: [],
      categories: STARTER_CATEGORIES,
      products: STARTER_PRODUCTS,
      services: STARTER_SERVICES,
      customers: STARTER_CUSTOMERS,
      accounts: STARTER_PAYMENT_ACCOUNTS,
      transfers: [],
      transactions: [],
      sales: [],
      expenses: [],
      expense_categories: STARTER_EXPENSE_CATEGORIES,
      daily_closings: [],
      audit_logs: [],
      stock_movements: [],
    };
  }
}

function saveStorage(data: StorageSchema) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify(data));
  }
}

export class StorageEngine {
  private static getDB(): StorageSchema {
    return loadStorage();
  }

  private static setDB(data: StorageSchema) {
    saveStorage(data);
  }

  static async hashPassword(password: string): Promise<string> {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  static async verifyPassword(password: string, expectedHash: string): Promise<boolean> {
    return (await this.hashPassword(password)) === expectedHash;
  }

  static saveSession(profileId: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, profileId);
    }
  }

  static clearSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  static getSessionProfile(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    const profileId = sessionStorage.getItem(SESSION_KEY);
    if (!profileId) return null;
    const profile = this.getDB().profiles.find((candidate) => candidate.id === profileId);
    return profile?.is_active ? profile : null;
  }

  static findLocalProfileByEmail(email: string): UserProfile | null {
    return this.getDB().profiles.find(
      (profile) => profile.email.toLowerCase() === email.trim().toLowerCase()
    ) || null;
  }

  static createLocalOwnerAccount(org: Organization, profile: UserProfile): void {
    const db = this.getDB();
    if (db.profiles.some((candidate) => candidate.email.toLowerCase() === profile.email.toLowerCase())) {
      throw new Error('A local account with this email already exists');
    }
    db.organizations.push(org);
    db.profiles.push(profile);
    this.setDB(db);
  }

  // --- ORGANIZATIONS & PROFILES ---
  static getOrganization(orgId: string): Organization | null {
    const db = this.getDB();
    return db.organizations.find((o) => o.id === orgId) || db.organizations[0] || null;
  }

  static updateOrganization(org: Organization): Organization {
    requirePermission(org.id, 'MANAGE_BUSINESS_CONFIG');
    const db = this.getDB();
    const idx = db.organizations.findIndex((o) => o.id === org.id);
    if (idx >= 0) {
      db.organizations[idx] = { ...org, updated_at: new Date().toISOString() };
    } else {
      db.organizations.push(org);
    }
    this.setDB(db);
    return org;
  }

  static getProfiles(orgId: string): UserProfile[] {
    requirePermission(orgId, 'MANAGE_STAFF');
    const db = this.getDB();
    return db.profiles.filter((p) => p.organization_id === orgId);
  }

  static saveProfile(profile: UserProfile): UserProfile {
    const principal = requirePermission(profile.organization_id, 'MANAGE_STAFF');
    const db = this.getDB();
    const idx = db.profiles.findIndex(
      (p) => p.organization_id === profile.organization_id && p.id === profile.id
    );
    if (idx >= 0 && db.profiles[idx].role !== profile.role && principal.id !== db.profiles[idx].id) {
      throw new Error('Only the owner may change another member role');
    }
    if (idx >= 0 && principal.id === db.profiles[idx].id && db.profiles[idx].role !== profile.role) {
      throw new Error('Users cannot change their own role');
    }
    if (idx >= 0) {
      db.profiles[idx] = profile;
    } else {
      db.profiles.push(profile);
    }
    this.setDB(db);
    return profile;
  }

  // --- CATEGORIES ---
  static getCategories(orgId: string): Category[] {
    return this.getDB().categories.filter((c) => c.organization_id === orgId);
  }

  static saveCategory(category: Category): Category {
    requirePermission(category.organization_id, 'MANAGE_INVENTORY');
    const db = this.getDB();
    const idx = db.categories.findIndex(
      (c) => c.organization_id === category.organization_id && c.id === category.id
    );
    if (idx >= 0) {
      db.categories[idx] = category;
    } else {
      db.categories.push(category);
    }
    this.setDB(db);
    return category;
  }

  // --- PRODUCTS / INVENTORY ---
  static getProducts(orgId: string): Product[] {
    return this.getDB().products.filter((p) => p.organization_id === orgId);
  }

  static getProductById(orgId: string, id: string): Product | null {
    return this.getDB().products.find((p) => p.organization_id === orgId && p.id === id) || null;
  }

  static saveProduct(product: Product): Product {
    requirePermission(product.organization_id, 'MANAGE_INVENTORY');
    const db = this.getDB();
    const idx = db.products.findIndex(
      (p) => p.organization_id === product.organization_id && p.id === product.id
    );
    if (idx >= 0) {
      db.products[idx] = { ...product, updated_at: new Date().toISOString() };
    } else {
      db.products.push(product);
    }
    this.setDB(db);
    syncEngine.enqueue('products', product.id, 'UPDATE', product as any);
    return product;
  }

  static deleteProduct(orgId: string, id: string): boolean {
    requirePermission(orgId, 'MANAGE_INVENTORY');
    const db = this.getDB();
    const idx = db.products.findIndex((p) => p.organization_id === orgId && p.id === id);
    if (idx >= 0) {
      db.products.splice(idx, 1);
      this.setDB(db);
      syncEngine.enqueue('products', id, 'DELETE', { id, organization_id: orgId });
      return true;
    }
    return false;
  }

  // --- SERVICES ---
  static getServices(orgId: string): Service[] {
    return this.getDB().services.filter((s) => s.organization_id === orgId);
  }

  static getServiceById(orgId: string, id: string): Service | null {
    return this.getDB().services.find((s) => s.organization_id === orgId && s.id === id) || null;
  }

  static saveService(service: Service): Service {
    requirePermission(service.organization_id, 'MANAGE_INVENTORY');
    const db = this.getDB();
    const idx = db.services.findIndex(
      (s) => s.organization_id === service.organization_id && s.id === service.id
    );
    if (idx >= 0) {
      db.services[idx] = { ...service, updated_at: new Date().toISOString() };
    } else {
      db.services.push(service);
    }
    this.setDB(db);
    syncEngine.enqueue('services', service.id, 'UPDATE', service as any);
    return service;
  }

  static deleteService(orgId: string, id: string): boolean {
    requirePermission(orgId, 'MANAGE_INVENTORY');
    const db = this.getDB();
    const idx = db.services.findIndex((s) => s.organization_id === orgId && s.id === id);
    if (idx >= 0) {
      db.services.splice(idx, 1);
      this.setDB(db);
      syncEngine.enqueue('services', id, 'DELETE', { id, organization_id: orgId });
      return true;
    }
    return false;
  }

  // --- STOCK MOVEMENTS ---
  static recordStockMovement(movement: StockMovement): StockMovement {
    const principal = requirePermission(movement.organization_id, 'MANAGE_INVENTORY');
    if (!Number.isFinite(movement.quantity) || movement.quantity === 0) {
      throw new Error('Stock movement quantity must be a non-zero finite number');
    }
    if (!Number.isFinite(movement.unit_cost) || movement.unit_cost < 0) {
      throw new Error('Stock movement cost is invalid');
    }
    movement.created_by = principal.fullName;
    const db = this.getDB();
    db.stock_movements.unshift(movement);

    // Apply change to product current stock and recalculate value
    const product = db.products.find(
      (p) => p.organization_id === movement.organization_id && p.id === movement.product_id
    );
    if (!product) throw new Error('Stock movement product does not belong to this organization');
    if (product) {
      if (movement.movement_type === 'PURCHASE') {
        // Recalculate Weighted Average Cost
        const wac = calculateWeightedAverageCost(
          product.current_stock,
          product.average_cost,
          movement.quantity,
          movement.unit_cost
        );
        product.current_stock = wac.newStock;
        product.average_cost = wac.newAvgCost;
        product.stock_value = wac.newStockValue;
      } else {
        product.current_stock = roundMoney(product.current_stock + movement.quantity);
        product.stock_value = roundMoney(product.current_stock * product.average_cost);
      }
      syncEngine.enqueue('products', product.id, 'UPDATE', product as any);
    }

    this.setDB(db);
    syncEngine.enqueue('stock_movements', movement.id, 'INSERT', movement as any);
    return movement;
  }

  static getStockMovements(orgId: string, productId?: string): StockMovement[] {
    const movements = this.getDB().stock_movements.filter((m) => m.organization_id === orgId);
    if (productId) {
      return movements.filter((m) => m.product_id === productId);
    }
    return movements;
  }

  // --- CUSTOMERS ---
  static getCustomers(orgId: string, query?: string): Customer[] {
    const list = this.getDB().customers.filter((c) => c.organization_id === orgId);
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }

  static getCustomerById(orgId: string, id: string): Customer | null {
    return this.getDB().customers.find((c) => c.organization_id === orgId && c.id === id) || null;
  }

  static saveCustomer(customer: Customer): Customer {
    requireOrganization(customer.organization_id);
    const db = this.getDB();
    const idx = db.customers.findIndex(
      (c) => c.organization_id === customer.organization_id && c.id === customer.id
    );
    if (idx >= 0) {
      db.customers[idx] = customer;
    } else {
      db.customers.push(customer);
    }
    this.setDB(db);
    syncEngine.enqueue('customers', customer.id, 'UPDATE', customer as any);
    return customer;
  }

  // --- ACCOUNTS & TRANSFERS ---
  static getAccounts(orgId: string): PaymentAccount[] {
    return this.getDB().accounts.filter((a) => a.organization_id === orgId);
  }

  static getAccountById(orgId: string, id: string): PaymentAccount | null {
    return this.getDB().accounts.find((a) => a.organization_id === orgId && a.id === id) || null;
  }

  static saveAccount(account: PaymentAccount): PaymentAccount {
    requirePermission(account.organization_id, 'MANAGE_BUSINESS_CONFIG');
    const db = this.getDB();
    const idx = db.accounts.findIndex(
      (a) => a.organization_id === account.organization_id && a.id === account.id
    );
    if (idx >= 0) {
      db.accounts[idx] = account;
    } else {
      db.accounts.push(account);
    }
    this.setDB(db);
    syncEngine.enqueue('payment_accounts', account.id, 'UPDATE', account as any);
    return account;
  }

  static transferFunds(transfer: AccountTransfer): AccountTransfer {
    const principal = requirePermission(transfer.organization_id, 'ACCOUNT_TRANSFER');
    if (!Number.isFinite(transfer.amount) || transfer.amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }
    if (transfer.from_account_id === transfer.to_account_id) {
      throw new Error('Source and destination accounts must be different');
    }
    const db = this.getDB();
    const fromAcc = db.accounts.find(
      (a) => a.organization_id === transfer.organization_id && a.id === transfer.from_account_id
    );
    const toAcc = db.accounts.find(
      (a) => a.organization_id === transfer.organization_id && a.id === transfer.to_account_id
    );

    if (!fromAcc || !toAcc) {
      throw new Error('Invalid from/to account for fund transfer');
    }
    if (fromAcc.current_balance < transfer.amount) {
      throw new Error('Insufficient funds for transfer');
    }

    fromAcc.current_balance = roundMoney(fromAcc.current_balance - transfer.amount);
    toAcc.current_balance = roundMoney(toAcc.current_balance + transfer.amount);

    db.transfers.unshift(transfer);

    // Record both transaction ledger records
    db.transactions.unshift({
      id: `tx-tf-out-${Date.now()}`,
      organization_id: transfer.organization_id,
      account_id: fromAcc.id,
      account_name: fromAcc.name,
      type: 'TRANSFER_OUT',
      amount: transfer.amount,
      balance_after: fromAcc.current_balance,
      reference_type: 'TRANSFER',
      reference_id: transfer.id,
      description: `Transfer to ${toAcc.name}: ${transfer.notes || 'Fund re-allocation'}`,
      date: transfer.date,
      created_at: new Date().toISOString(),
    });

    db.transactions.unshift({
      id: `tx-tf-in-${Date.now()}`,
      organization_id: transfer.organization_id,
      account_id: toAcc.id,
      account_name: toAcc.name,
      type: 'TRANSFER_IN',
      amount: transfer.amount,
      balance_after: toAcc.current_balance,
      reference_type: 'TRANSFER',
      reference_id: transfer.id,
      description: `Transfer received from ${fromAcc.name}: ${transfer.notes || 'Fund re-allocation'}`,
      date: transfer.date,
      created_at: new Date().toISOString(),
    });

    // Audit log
    db.audit_logs.unshift({
      id: `log-${Date.now()}`,
      organization_id: transfer.organization_id,
      user_id: principal.id,
      user_name: principal.fullName,
      action: 'ACCOUNT_TRANSFER',
      entity: 'PAYMENT_ACCOUNT',
      entity_id: transfer.id,
      details: `Transferred Rs. ${transfer.amount} from ${fromAcc.name} to ${toAcc.name}`,
      created_at: new Date().toISOString(),
    });

    this.setDB(db);
    syncEngine.enqueue('account_transfers', transfer.id, 'INSERT', transfer as any);
    return transfer;
  }

  static getTransactions(orgId: string, accountId?: string): AccountTransaction[] {
    const list = this.getDB().transactions.filter((t) => t.organization_id === orgId);
    if (accountId) {
      return list.filter((t) => t.account_id === accountId);
    }
    return list;
  }

  // --- EXPENSES ---
  static getExpenseCategories(orgId: string): ExpenseCategory[] {
    return this.getDB().expense_categories.filter((c) => c.organization_id === orgId);
  }

  static saveExpenseCategory(cat: ExpenseCategory): ExpenseCategory {
    const db = this.getDB();
    const idx = db.expense_categories.findIndex((c) => c.id === cat.id);
    if (idx >= 0) {
      db.expense_categories[idx] = cat;
    } else {
      db.expense_categories.push(cat);
    }
    this.setDB(db);
    return cat;
  }

  static getExpenses(
    orgId: string,
    options?: { startDate?: string; endDate?: string; categoryId?: string }
  ): Expense[] {
    let list = this.getDB().expenses.filter((e) => e.organization_id === orgId);
    if (options?.categoryId) {
      list = list.filter((e) => e.category_id === options.categoryId);
    }
    if (options?.startDate) {
      list = list.filter((e) => e.date >= options.startDate!);
    }
    if (options?.endDate) {
      list = list.filter((e) => e.date <= options.endDate!);
    }
    return list;
  }

  static recordExpense(expense: Expense): Expense {
    const principal = requirePermission(expense.organization_id, 'RECORD_EXPENSES');
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }
    const db = this.getDB();
    const account = db.accounts.find(
      (a) => a.organization_id === expense.organization_id && a.id === expense.account_id
    );
    const category = db.expense_categories.find(
      (candidate) => candidate.organization_id === expense.organization_id && candidate.id === expense.category_id
    );
    if (!account || !category) throw new Error('Expense references an invalid organization record');
    if (account) {
      account.current_balance = roundMoney(account.current_balance - expense.amount);

      // Ledger entry
      db.transactions.unshift({
        id: `tx-exp-${expense.id}`,
        organization_id: expense.organization_id,
        account_id: account.id,
        account_name: account.name,
        type: 'EXPENSE',
        amount: expense.amount,
        balance_after: account.current_balance,
        reference_type: 'EXPENSE',
        reference_id: expense.id,
        description: `Expense: ${expense.category_name} - ${expense.description}`,
        date: expense.date,
        created_at: new Date().toISOString(),
      });
    }

    db.expenses.unshift(expense);

    // Audit log
    db.audit_logs.unshift({
      id: `log-exp-${Date.now()}`,
      organization_id: expense.organization_id,
      user_id: principal.id,
      user_name: principal.fullName,
      action: 'EXPENSE_RECORDED',
      entity: 'EXPENSE',
      entity_id: expense.id,
      details: `Recorded expense of Rs. ${expense.amount} under ${expense.category_name} (${expense.description})`,
      created_at: new Date().toISOString(),
    });

    this.setDB(db);
    syncEngine.enqueue('expenses', expense.id, 'INSERT', expense as any);
    return expense;
  }

  static voidExpense(orgId: string, expenseId: string, userId: string, userName: string): Expense {
    const principal = requirePermission(orgId, 'VOID_EXPENSE');
    const db = this.getDB();
    const expense = db.expenses.find((e) => e.organization_id === orgId && e.id === expenseId);
    if (!expense) throw new Error('Expense not found');
    if (expense.status === 'VOIDED') throw new Error('Expense is already voided');

    expense.status = 'VOIDED';

    // Reverse account balance
    const account = db.accounts.find(
      (a) => a.organization_id === orgId && a.id === expense.account_id
    );
    if (account) {
      account.current_balance = roundMoney(account.current_balance + expense.amount);
      db.transactions.unshift({
        id: `tx-exp-void-${Date.now()}`,
        organization_id: orgId,
        account_id: account.id,
        account_name: account.name,
        type: 'ADJUSTMENT',
        amount: expense.amount,
        balance_after: account.current_balance,
        reference_type: 'EXPENSE',
        reference_id: expense.id,
        description: `Voided expense reversal: ${expense.category_name} (${expense.description})`,
        date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
      });
    }

    db.audit_logs.unshift({
      id: `log-void-exp-${Date.now()}`,
      organization_id: orgId,
      user_id: principal.id,
      user_name: principal.fullName,
      action: 'EXPENSE_VOIDED',
      entity: 'EXPENSE',
      entity_id: expense.id,
      details: `Voided expense of Rs. ${expense.amount} under ${expense.category_name}`,
      created_at: new Date().toISOString(),
    });

    this.setDB(db);
    syncEngine.enqueue('expenses', expense.id, 'UPDATE', expense as any);
    return expense;
  }

  // --- ATOMIC QUICK SALE TRANSACTION ---
  static createSaleTransaction(
    orgId: string,
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
  ): Sale {
    const principal = requirePermission(orgId, 'FAST_POS_CHECKOUT');
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('A sale must contain at least one item');
    }
    for (const item of payload.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error('Sale quantity must be greater than zero');
      }
      if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
        throw new Error('Sale price is invalid');
      }
      const itemSubtotal = roundMoney(item.quantity * item.unit_price);
      const itemDiscount = roundMoney(item.discount || 0);
      if (!Number.isFinite(itemDiscount) || itemDiscount < 0 || itemDiscount > itemSubtotal) {
        throw new Error('Sale item discount is invalid');
      }
    }
    if (!Number.isFinite(payload.discount) || payload.discount < 0) {
      throw new Error('Sale discount is invalid');
    }
    if (!Number.isFinite(payload.tax_amount) || payload.tax_amount < 0) {
      throw new Error('Sale tax is invalid');
    }
    if (!Number.isFinite(payload.amount_paid) || payload.amount_paid < 0) {
      throw new Error('Payment amount is invalid');
    }
    const db = this.getDB();
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found');

    let nextInvoiceNumber = org.next_invoice_number || 1001;
    let invoiceNumber = `${org.invoice_prefix || 'YE-'}${nextInvoiceNumber}`;
    while (db.sales.some((sale) => sale.organization_id === orgId && sale.invoice_number === invoiceNumber)) {
      nextInvoiceNumber += 1;
      invoiceNumber = `${org.invoice_prefix || 'YE-'}${nextInvoiceNumber}`;
    }
    org.next_invoice_number = nextInvoiceNumber + 1;

    const saleId = `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    let subtotal = 0;
    let itemsDiscountTotal = 0;
    let totalCogs = 0;
    const saleItems: SaleItem[] = [];

    // 1. Process items, calculate prices, COGS, and deduct inventory/recipes
    for (const item of payload.items) {
      const itemSubtotal = roundMoney(item.quantity * item.unit_price);
      const itemDiscount = roundMoney(item.discount || 0);
      const itemTotal = roundMoney(Math.max(0, itemSubtotal - itemDiscount));
      itemsDiscountTotal = roundMoney(itemsDiscountTotal + itemDiscount);
      subtotal = roundMoney(subtotal + itemSubtotal);

      let unitCost = 0;

      if (item.type === 'PRODUCT') {
        const product = db.products.find((p) => p.organization_id === orgId && p.id === item.item_id);
        if (!product) throw new Error('Sale product does not belong to this organization');
        if (product) {
          unitCost = product.average_cost;
          if (product.track_stock) {
            // Deduct stock
            product.current_stock = roundMoney(product.current_stock - item.quantity);
            product.stock_value = roundMoney(product.current_stock * product.average_cost);

            // Record stock movement
            db.stock_movements.unshift({
              id: `mov-sale-${Date.now()}-${item.item_id}`,
              organization_id: orgId,
              product_id: product.id,
              product_name: product.name,
              movement_type: 'SALE',
              quantity: -item.quantity,
              unit_cost: product.average_cost,
              total_cost: roundMoney(item.quantity * product.average_cost),
              reference_id: saleId,
              reference_type: 'SALE',
              notes: `Sold on invoice #${invoiceNumber}`,
              created_by: principal.fullName,
              created_at: nowIso,
            });
          }
        }
      } else if (item.type === 'SERVICE') {
        const service = db.services.find((s) => s.organization_id === orgId && s.id === item.item_id);
        if (!service) throw new Error('Sale service does not belong to this organization');
        if (service) {
          // Check recipes / components consumed
          let serviceRecipeCost = 0;
          if (service.components && service.components.length > 0) {
            for (const comp of service.components) {
              const consumedProduct = db.products.find(
                (p) => p.organization_id === orgId && p.id === comp.product_id
              );
              if (consumedProduct) {
                const totalConsumedQty = roundMoney(comp.quantity_consumed * item.quantity);
                if (consumedProduct.track_stock) {
                  consumedProduct.current_stock = roundMoney(
                    consumedProduct.current_stock - totalConsumedQty
                  );
                  consumedProduct.stock_value = roundMoney(
                    consumedProduct.current_stock * consumedProduct.average_cost
                  );

                  // Record recipe consumption movement
                  db.stock_movements.unshift({
                    id: `mov-rec-${Date.now()}-${consumedProduct.id}`,
                    organization_id: orgId,
                    product_id: consumedProduct.id,
                    product_name: consumedProduct.name,
                    movement_type: 'SALE',
                    quantity: -totalConsumedQty,
                    unit_cost: consumedProduct.average_cost,
                    total_cost: roundMoney(totalConsumedQty * consumedProduct.average_cost),
                    reference_id: saleId,
                    reference_type: 'SERVICE_CONSUMPTION',
                    notes: `Consumed for ${item.name} on #${invoiceNumber}`,
                    created_by: principal.fullName,
                    created_at: nowIso,
                  });
                }
                serviceRecipeCost = roundMoney(
                  serviceRecipeCost + comp.quantity_consumed * consumedProduct.average_cost
                );
              }
            }
          }
          unitCost = serviceRecipeCost > 0 ? serviceRecipeCost : service.estimated_cost;
        }
      }

      const itemCogs = roundMoney(item.quantity * unitCost);
      const itemProfit = roundMoney(itemTotal - itemCogs);
      totalCogs = roundMoney(totalCogs + itemCogs);

      saleItems.push({
        id: `sitem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        organization_id: orgId,
        sale_id: saleId,
        item_type: item.type,
        item_id: item.item_id,
        item_name: item.name,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: unitCost,
        discount: itemDiscount,
        subtotal: itemSubtotal,
        total: itemTotal,
        cogs: itemCogs,
        gross_profit: itemProfit,
      });
    }

    const totalDiscount = roundMoney(itemsDiscountTotal + (payload.discount || 0));
    const grandTotal = roundMoney(
      Math.max(0, subtotal - totalDiscount + (payload.tax_amount || 0))
    );
    if (payload.discount > subtotal || totalDiscount > subtotal) {
      throw new Error('Sale discount exceeds subtotal');
    }
    if (payload.split_payments?.length) {
      const splitTotal = roundMoney(payload.split_payments.reduce((sum, split) => sum + split.amount, 0));
      if (payload.split_payments.some((split) => !Number.isFinite(split.amount) || split.amount <= 0)) {
        throw new Error('Split payments must contain positive amounts');
      }
      if (splitTotal !== roundMoney(Math.min(payload.amount_paid, grandTotal))) {
        throw new Error('Split payments do not match the received sale payment');
      }
    }
    const grossProfit = roundMoney(grandTotal - (payload.tax_amount || 0) - totalCogs);
    const changeDue = roundMoney(Math.max(0, payload.amount_paid - grandTotal));

    // 2. Handle Payment Accounts updates & ledger transactions
    if (payload.split_payments && payload.split_payments.length > 0) {
      for (const split of payload.split_payments) {
        if (split.amount > 0) {
          const acc = db.accounts.find(
            (a) => a.organization_id === orgId && a.id === split.account_id
          );
          if (!acc) throw new Error('Split payment account does not belong to this organization');
          if (acc) {
            acc.current_balance = roundMoney(acc.current_balance + split.amount);
            db.transactions.unshift({
              id: `tx-sale-${Date.now()}-${acc.id}`,
              organization_id: orgId,
              account_id: acc.id,
              account_name: acc.name,
              type: 'INCOME',
              amount: split.amount,
              balance_after: acc.current_balance,
              reference_type: 'SALE',
              reference_id: saleId,
              description: `Payment for Sale #${invoiceNumber} (${split.account_name})`,
              date: nowIso.slice(0, 10),
              created_at: nowIso,
            });
          }
        }
      }
    } else {
      // Default to primary cash account or selected account
      const primaryAcc =
        db.accounts.find(
          (a) => a.organization_id === orgId && a.name.toLowerCase().includes(payload.payment_method.toLowerCase())
        ) ||
        db.accounts.find((a) => a.organization_id === orgId && a.type === 'CASH') ||
        db.accounts.find((a) => a.organization_id === orgId);

      if (primaryAcc) {
        const netReceived = roundMoney(payload.amount_paid - changeDue);
        primaryAcc.current_balance = roundMoney(primaryAcc.current_balance + netReceived);
        db.transactions.unshift({
          id: `tx-sale-${Date.now()}-${primaryAcc.id}`,
          organization_id: orgId,
          account_id: primaryAcc.id,
          account_name: primaryAcc.name,
          type: 'INCOME',
          amount: netReceived,
          balance_after: primaryAcc.current_balance,
          reference_type: 'SALE',
          reference_id: saleId,
          description: `Payment for Sale #${invoiceNumber} via ${payload.payment_method}`,
          date: nowIso.slice(0, 10),
          created_at: nowIso,
        });
      }
    }

    // 3. Customer update if customer selected
    if (payload.customer_id) {
      const customer = db.customers.find(
        (c) => c.organization_id === orgId && c.id === payload.customer_id
      );
      if (!customer) throw new Error('Sale customer does not belong to this organization');
      if (customer) {
        customer.total_purchases = roundMoney(customer.total_purchases + grandTotal);
        customer.last_purchase_date = nowIso;
        if (payload.amount_paid < grandTotal) {
          customer.outstanding_balance = roundMoney(
            customer.outstanding_balance + (grandTotal - payload.amount_paid)
          );
        }
      }
    }

    // 4. Create Sale Record
    const saleRecord: Sale = {
      id: saleId,
      organization_id: orgId,
      invoice_number: invoiceNumber,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone,
      cashier_id: principal.id,
      cashier_name: principal.fullName,
      items: saleItems,
      subtotal,
      discount: totalDiscount,
      tax_amount: payload.tax_amount || 0,
      grand_total: grandTotal,
      amount_paid: payload.amount_paid,
      change_due: changeDue,
      payment_method: payload.payment_method,
      split_payments: payload.split_payments || [],
      total_cogs: totalCogs,
      gross_profit: grossProfit,
      status: 'COMPLETED',
      notes: payload.notes,
      created_at: nowIso,
    };

    db.sales.unshift(saleRecord);

    // 5. Audit Log
    db.audit_logs.unshift({
      id: `log-sale-${Date.now()}`,
      organization_id: orgId,
      user_id: principal.id,
      user_name: principal.fullName,
      action: 'SALE_CREATED',
      entity: 'SALE',
      entity_id: saleId,
      details: `Generated Invoice #${invoiceNumber} for Rs. ${grandTotal} (${saleItems.length} items)`,
      created_at: nowIso,
    });

    this.setDB(db);
    syncEngine.enqueue('sales', saleRecord.id, 'INSERT', saleRecord as any);
    saleItems.forEach((item) => syncEngine.enqueue('sale_items', item.id, 'INSERT', item as any));
    return saleRecord;
  }

  static voidSaleTransaction(
    orgId: string,
    saleId: string,
    cashierId: string,
    cashierName: string,
    reason: string
  ): Sale {
    const principal = requirePermission(orgId, 'VOID_SALE');
    const db = this.getDB();
    const sale = db.sales.find((s) => s.organization_id === orgId && s.id === saleId);
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'VOIDED') throw new Error('Sale is already voided');

    sale.status = 'VOIDED';
    sale.void_reason = reason;
    sale.voided_by = principal.fullName;
    sale.voided_at = new Date().toISOString();

    // 1. Revert product stocks and recipe consumptions
    for (const item of sale.items) {
      if (item.item_type === 'PRODUCT') {
        const product = db.products.find(
          (p) => p.organization_id === orgId && p.id === item.item_id
        );
        if (product && product.track_stock) {
          product.current_stock = roundMoney(product.current_stock + item.quantity);
          product.stock_value = roundMoney(product.current_stock * product.average_cost);

          db.stock_movements.unshift({
            id: `mov-void-${Date.now()}-${product.id}`,
            organization_id: orgId,
            product_id: product.id,
            product_name: product.name,
            movement_type: 'CUSTOMER_RETURN',
            quantity: item.quantity,
            unit_cost: product.average_cost,
            total_cost: roundMoney(item.quantity * product.average_cost),
            reference_id: sale.id,
            reference_type: 'SALE_VOID',
            notes: `Stock restocked from voided invoice #${sale.invoice_number} (${reason})`,
            created_by: principal.fullName,
            created_at: new Date().toISOString(),
          });
        }
      } else if (item.item_type === 'SERVICE') {
        const service = db.services.find(
          (s) => s.organization_id === orgId && s.id === item.item_id
        );
        if (service && service.components && service.components.length > 0) {
          for (const comp of service.components) {
            const consumedProduct = db.products.find(
              (p) => p.organization_id === orgId && p.id === comp.product_id
            );
            if (consumedProduct && consumedProduct.track_stock) {
              const totalConsumedQty = roundMoney(comp.quantity_consumed * item.quantity);
              consumedProduct.current_stock = roundMoney(consumedProduct.current_stock + totalConsumedQty);
              consumedProduct.stock_value = roundMoney(consumedProduct.current_stock * consumedProduct.average_cost);

              db.stock_movements.unshift({
                id: `mov-void-srv-${Date.now()}-${consumedProduct.id}`,
                organization_id: orgId,
                product_id: consumedProduct.id,
                product_name: consumedProduct.name,
                movement_type: 'CUSTOMER_RETURN',
                quantity: totalConsumedQty,
                unit_cost: consumedProduct.average_cost,
                total_cost: roundMoney(totalConsumedQty * consumedProduct.average_cost),
                reference_id: sale.id,
                reference_type: 'SALE_VOID',
                notes: `Material restocked from voided service on #${sale.invoice_number} (${reason})`,
                created_by: principal.fullName,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 2. Revert account balances
    if (sale.split_payments && sale.split_payments.length > 0) {
      for (const split of sale.split_payments) {
        const acc = db.accounts.find(
          (a) => a.organization_id === orgId && a.id === split.account_id
        );
        if (acc) {
          acc.current_balance = roundMoney(acc.current_balance - split.amount);
          db.transactions.unshift({
            id: `tx-void-${Date.now()}-${acc.id}`,
            organization_id: orgId,
            account_id: acc.id,
            account_name: acc.name,
            type: 'ADJUSTMENT',
            amount: -split.amount,
            balance_after: acc.current_balance,
            reference_type: 'SALE',
            reference_id: sale.id,
            description: `Voided Sale #${sale.invoice_number} reversal`,
            date: new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
          });
        }
      }
    } else {
      const primaryAcc =
        db.accounts.find(
          (a) => a.organization_id === orgId && a.name.toLowerCase().includes(sale.payment_method.toLowerCase())
        ) ||
        db.accounts.find((a) => a.organization_id === orgId);
      if (primaryAcc) {
        const refundAmt = roundMoney(sale.amount_paid - sale.change_due);
        primaryAcc.current_balance = roundMoney(primaryAcc.current_balance - refundAmt);
        db.transactions.unshift({
          id: `tx-void-${Date.now()}-${primaryAcc.id}`,
          organization_id: orgId,
          account_id: primaryAcc.id,
          account_name: primaryAcc.name,
          type: 'ADJUSTMENT',
          amount: -refundAmt,
          balance_after: primaryAcc.current_balance,
          reference_type: 'SALE',
          reference_id: sale.id,
          description: `Voided Sale #${sale.invoice_number} reversal`,
          date: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        });
      }
    }

    // 3. Customer total purchase reduction
    if (sale.customer_id) {
      const customer = db.customers.find(
        (c) => c.organization_id === orgId && c.id === sale.customer_id
      );
      if (customer) {
        customer.total_purchases = roundMoney(
          Math.max(0, customer.total_purchases - sale.grand_total)
        );
      }
    }

    // 4. Audit Log
    db.audit_logs.unshift({
      id: `log-void-${Date.now()}`,
      organization_id: orgId,
      user_id: principal.id,
      user_name: principal.fullName,
      action: 'SALE_VOIDED',
      entity: 'SALE',
      entity_id: sale.id,
      details: `Voided invoice #${sale.invoice_number}. Reason: ${reason}`,
      created_at: new Date().toISOString(),
    });

    this.setDB(db);
    syncEngine.enqueue('sales', sale.id, 'UPDATE', sale as any);
    return sale;
  }

  static getSales(
    orgId: string,
    options?: { startDate?: string; endDate?: string; customerId?: string; status?: string }
  ): Sale[] {
    let list = this.getDB().sales.filter((s) => s.organization_id === orgId);
    if (options?.customerId) {
      list = list.filter((s) => s.customer_id === options.customerId);
    }
    if (options?.status) {
      list = list.filter((s) => s.status === options.status);
    }
    if (options?.startDate) {
      list = list.filter((s) => s.created_at.slice(0, 10) >= options.startDate!);
    }
    if (options?.endDate) {
      list = list.filter((s) => s.created_at.slice(0, 10) <= options.endDate!);
    }
    return list;
  }

  static getSaleById(orgId: string, id: string): Sale | null {
    return this.getDB().sales.find((s) => s.organization_id === orgId && s.id === id) || null;
  }

  // --- DAILY CASH CLOSING ---
  static getDailyClosingSummary(orgId: string, date: string) {
    const db = this.getDB();
    const cashAccount =
      db.accounts.find((a) => a.organization_id === orgId && a.type === 'CASH') ||
      db.accounts[0];

    const openingCash = cashAccount ? cashAccount.opening_balance : 10000;

    // Sales made in cash today
    const daySales = db.sales.filter(
      (s) =>
        s.organization_id === orgId &&
        s.status === 'COMPLETED' &&
        s.created_at.slice(0, 10) === date
    );

    let cashSales = 0;
    for (const sale of daySales) {
      if (sale.split_payments && sale.split_payments.length > 0) {
        for (const sp of sale.split_payments) {
          if (sp.account_name.toLowerCase().includes('cash')) {
            cashSales = roundMoney(cashSales + sp.amount);
          }
        }
      } else if (sale.payment_method.toLowerCase().includes('cash')) {
        cashSales = roundMoney(cashSales + (sale.amount_paid - sale.change_due));
      }
    }

    // Cash expenses today
    const dayExpenses = db.expenses.filter(
      (e) =>
        e.organization_id === orgId &&
        e.status === 'ACTIVE' &&
        e.date === date &&
        e.account_name.toLowerCase().includes('cash')
    );
    const cashExpenses = roundMoney(
      dayExpenses.reduce((sum, e) => sum + e.amount, 0)
    );

    // Cash transfers
    const transfersIn = db.transfers
      .filter(
        (t) =>
          t.organization_id === orgId &&
          t.date === date &&
          t.to_account_name.toLowerCase().includes('cash')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = db.transfers
      .filter(
        (t) =>
          t.organization_id === orgId &&
          t.date === date &&
          t.from_account_name.toLowerCase().includes('cash')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const expectedCash = roundMoney(
      openingCash + cashSales - cashExpenses + transfersIn - transfersOut
    );

    return {
      openingCash,
      cashSales,
      cashExpenses,
      cashTransfersIn: transfersIn,
      cashTransfersOut: transfersOut,
      expectedCash,
    };
  }

  static recordDailyClosing(
    orgId: string,
    payload: {
      closing_date: string;
      actual_cash: number;
      notes?: string;
      closed_by: string;
    }
  ): DailyClosing {
    const principal = requirePermission(orgId, 'SUBMIT_DAILY_CLOSING');
    if (!Number.isFinite(payload.actual_cash) || payload.actual_cash < 0) {
      throw new Error('Actual cash must be a non-negative finite number');
    }
    const existingClosing = this.getDB().daily_closings.find(
      (closing) => closing.organization_id === orgId && closing.closing_date === payload.closing_date
    );
    if (existingClosing) throw new Error('Daily closing already exists for this date');
    const summary = this.getDailyClosingSummary(orgId, payload.closing_date);
    const difference = roundMoney(payload.actual_cash - summary.expectedCash);

    const closing: DailyClosing = {
      id: `closing-${Date.now()}`,
      organization_id: orgId,
      closing_date: payload.closing_date,
      opening_cash: summary.openingCash,
      cash_sales: summary.cashSales,
      cash_expenses: summary.cashExpenses,
      cash_transfers_in: summary.cashTransfersIn,
      cash_transfers_out: summary.cashTransfersOut,
      expected_cash: summary.expectedCash,
      actual_cash: payload.actual_cash,
      difference,
      notes: payload.notes,
      closed_by: principal.id,
      closed_at: new Date().toISOString(),
    };

    const db = this.getDB();
    db.daily_closings.unshift(closing);

    db.audit_logs.unshift({
      id: `log-close-${Date.now()}`,
      organization_id: orgId,
      user_id: payload.closed_by,
      user_name: payload.closed_by,
      action: 'DAILY_CLOSING_RECORDED',
      entity: 'DAILY_CLOSING',
      entity_id: closing.id,
      details: `Daily cash closed for ${payload.closing_date}. Expected: Rs. ${summary.expectedCash}, Counted: Rs. ${payload.actual_cash}, Diff: Rs. ${difference}`,
      created_at: new Date().toISOString(),
    });

    this.setDB(db);
    syncEngine.enqueue('daily_closings', closing.id, 'INSERT', closing as any);
    return closing;
  }

  static getDailyClosings(orgId: string): DailyClosing[] {
    return this.getDB().daily_closings.filter((c) => c.organization_id === orgId);
  }

  // --- AUDIT LOGS ---
  static getAuditLogs(orgId: string, limit = 100): AuditLog[] {
    return this.getDB().audit_logs.filter((l) => l.organization_id === orgId).slice(0, limit);
  }

  static logAction(log: AuditLog): AuditLog {
    const db = this.getDB();
    db.audit_logs.unshift(log);
    this.setDB(db);
    syncEngine.enqueue('audit_logs', log.id, 'INSERT', log as any);
    return log;
  }

  // --- BACKUP & RESTORE UTILITIES ---
  static exportData(): string {
    const db = this.getDB();
    const org = db.organizations[0] || DEFAULT_ORGANIZATION;
    const archive = {
      format: 'YAQOOB_ENTERPRISES_BACKUP_V1',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      organization_id: org.id,
      organization_name: org.name,
      counts: {
        products: db.products?.length || 0,
        services: db.services?.length || 0,
        sales: db.sales?.length || 0,
        expenses: db.expenses?.length || 0,
        accounts: db.accounts?.length || 0,
        customers: db.customers?.length || 0,
        closings: db.daily_closings?.length || 0,
      },
      data: db,
    };
    return JSON.stringify(archive, null, 2);
  }

  static validateBackup(jsonString: string): {
    valid: boolean;
    archive?: {
      format: string;
      version: string;
      exported_at: string;
      organization_name: string;
      counts: Record<string, number>;
      data: StorageSchema;
    };
    error?: string;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      // Support both wrapped archive and raw schema
      if (parsed && parsed.format === 'YAQOOB_ENTERPRISES_BACKUP_V1' && parsed.data) {
        const validationError = this.validateBackupData(parsed.data, parsed.organization_id);
        if (validationError) return { valid: false, error: validationError };
        return { valid: true, archive: parsed };
      } else if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
        // Raw schema legacy backup
        const org = parsed.organizations?.[0] || DEFAULT_ORGANIZATION;
        const validationError = this.validateBackupData(parsed, org.id);
        if (validationError) return { valid: false, error: validationError };
        return {
          valid: true,
          archive: {
            format: 'YAQOOB_ENTERPRISES_BACKUP_LEGACY',
            version: '1.0.0',
            exported_at: new Date().toISOString(),
            organization_name: org.name,
            counts: {
              products: parsed.products.length,
              services: parsed.services?.length || 0,
              sales: parsed.sales.length,
              expenses: parsed.expenses?.length || 0,
              accounts: parsed.accounts?.length || 0,
              customers: parsed.customers?.length || 0,
              closings: parsed.daily_closings?.length || 0,
            },
            data: parsed,
          },
        };
      }
      return { valid: false, error: 'File is not a valid Yaqoob Enterprises Manager database backup' };
    } catch (e: any) {
      return { valid: false, error: `Corrupt JSON backup file: ${e.message}` };
    }
  }

  private static validateBackupData(data: any, archiveOrganizationId?: string): string | null {
    const collections = [
      'organizations', 'profiles', 'categories', 'products', 'services', 'customers',
      'accounts', 'transfers', 'transactions', 'sales', 'expenses', 'expense_categories',
      'daily_closings', 'audit_logs', 'stock_movements',
    ];
    if (!collections.every((collection) => Array.isArray(data?.[collection]))) {
      return 'Backup is missing one or more required collections';
    }
    if (data.organizations.length !== 1) return 'Backup must contain exactly one organization';
    const organizationId = data.organizations[0]?.id;
    if (!organizationId || (archiveOrganizationId && archiveOrganizationId !== organizationId)) {
      return 'Backup organization identity is invalid';
    }
    const allRecords = collections.slice(1).flatMap((collection) => data[collection]);
    if (allRecords.some((record: any) => record.organization_id && record.organization_id !== organizationId)) {
      return 'Backup contains cross-organization records';
    }
    const ids = new Set<string>();
    for (const record of allRecords) {
      if (!record.id || ids.has(`${record.organization_id || organizationId}:${record.id}`)) {
        return 'Backup contains missing or duplicate record IDs';
      }
      ids.add(`${record.organization_id || organizationId}:${record.id}`);
      for (const key of ['amount', 'current_balance', 'grand_total', 'actual_cash', 'quantity']) {
        if (key in record && (!Number.isFinite(record[key]) || record[key] < 0)) {
          return `Backup contains invalid numeric value: ${key}`;
        }
      }
    }
    const accountIds = new Set(data.accounts.map((account: PaymentAccount) => account.id));
    if (data.expenses.some((expense: Expense) => !accountIds.has(expense.account_id))) {
      return 'Backup contains an expense with an invalid account reference';
    }
    return null;
  }

  static importData(archiveOrJson: string | Record<string, any>): boolean {
    try {
      const currentOrganization = this.getDB().organizations[0];
      if (!currentOrganization) throw new Error('Current organization not found');
      requirePermission(currentOrganization.id, 'RESTORE_DATABASE');
      let dataToRestore: StorageSchema;
      if (typeof archiveOrJson === 'string') {
        const validation = this.validateBackup(archiveOrJson);
        if (!validation.valid || !validation.archive) return false;
        dataToRestore = validation.archive.data;
      } else if (archiveOrJson.data) {
        dataToRestore = archiveOrJson.data;
      } else {
        dataToRestore = archiveOrJson as StorageSchema;
      }

      const validationError = this.validateBackupData(dataToRestore, currentOrganization.id);
      if (validationError) throw new Error(validationError);

      this.setDB(dataToRestore);

      // Audit log restore
      const org = dataToRestore.organizations?.[0] || DEFAULT_ORGANIZATION;
      this.logAction({
        id: `log-restore-${Date.now()}`,
        organization_id: org.id,
        user_id: requirePermission(currentOrganization.id, 'RESTORE_DATABASE').id,
        user_name: requirePermission(currentOrganization.id, 'RESTORE_DATABASE').fullName,
        action: 'BACKUP_RESTORED',
        entity: 'DATABASE',
        details: 'Business database restored successfully from verified archive',
        created_at: new Date().toISOString(),
      });

      return true;
    } catch {
      return false;
    }
  }

  static resetToDefaults(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}data`);
    }
    this.setDB({
      organizations: [DEFAULT_ORGANIZATION],
      profiles: [
        {
          id: 'usr-owner-1',
          email: 'yaqoobenterprisesofficial@gmail.com',
          full_name: 'Muhammad Yaqoob',
          role: 'OWNER',
          organization_id: DEFAULT_ORGANIZATION.id,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
      categories: STARTER_CATEGORIES,
      products: STARTER_PRODUCTS,
      services: STARTER_SERVICES,
      customers: STARTER_CUSTOMERS,
      accounts: STARTER_PAYMENT_ACCOUNTS,
      transfers: [],
      transactions: [],
      sales: [],
      expenses: [],
      expense_categories: STARTER_EXPENSE_CATEGORIES,
      daily_closings: [],
      audit_logs: [],
      stock_movements: [],
    });
  }
}
