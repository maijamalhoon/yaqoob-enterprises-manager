import {
  AccountTransaction,
  AccountTransfer,
  AuditLog,
  Category,
  Customer,
  DailyClosing,
  Expense,
  ExpenseCategory,
  PaymentAccount,
  Product,
  Sale,
  SaleItem,
  Service,
  SplitPayment,
  StockMovement,
} from '../types';
import { getSqliteDatabase, SqlDatabase } from './sqliteEngine';
import { requireOrganization, requirePermission } from '../lib/security';
import { roundMoney } from '../lib/utils';
import { LocalAuthAccount, Organization, UserProfile } from '../types';
import type {
  IAccountRepository,
  IAuditRepository,
  IClosingRepository,
  ICustomerRepository,
  IExpenseRepository,
  IInventoryRepository,
  ISalesRepository,
} from './contracts';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function decode<T>(value: T, json = false): T {
  if (json && typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return value; }
  }
  return value;
}

export class SQLiteRepository {
  private async database(): Promise<SqlDatabase> {
    return getSqliteDatabase();
  }

  async getOrganization(organizationId: string): Promise<Organization | null> {
    const row = (await (await this.database()).select<Organization>('SELECT * FROM organizations WHERE id = ?', [organizationId]))[0];
    return row || null;
  }

  async getLocalAuthAccount(): Promise<LocalAuthAccount | null> {
    const row = (await (await this.database()).select<LocalAuthAccount>(
      'SELECT * FROM local_auth_accounts ORDER BY created_at LIMIT 1',
    ))[0];
    return row || null;
  }

  async createLocalAuthAccount(
    organization: Organization,
    profile: UserProfile,
    pinHash: string,
    pinSalt: string,
  ): Promise<void> {
    const existing = await this.getLocalAuthAccount();
    if (existing) throw new Error('A local shop account already exists');
    await this.transaction(async (transactionDb) => {
      await this.insert(transactionDb, 'organizations', {
        ...organization,
        next_invoice_number: organization.next_invoice_number || 1001,
        updated_at: organization.updated_at || now(),
      });
      await this.insert(transactionDb, 'profiles', { ...profile, updated_at: now(), is_active: 1 });
      await this.insert(transactionDb, 'organization_members', {
        id: id(), organization_id: organization.id, user_id: profile.id,
        role: 'OWNER', is_active: 1, created_at: now(), updated_at: now(),
      });
      await this.insert(transactionDb, 'local_auth_accounts', {
        id: id(), organization_id: organization.id, profile_id: profile.id,
        pin_hash: pinHash, pin_salt: pinSalt, created_at: now(), updated_at: now(),
      });
    });
  }

  async updateLocalAuthAccount(accountId: string, pinHash: string, pinSalt: string): Promise<void> {
    const now = () => new Date().toISOString();
    await (await this.database()).execute(
      'UPDATE local_auth_accounts SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?',
      [pinHash, pinSalt, now(), accountId],
    );
  }

  async findLocalProfileByEmail(email: string): Promise<UserProfile | null> {
    const row = (await (await this.database()).select<UserProfile>('SELECT * FROM profiles WHERE lower(email) = lower(?) AND is_active = 1', [email.trim()]))[0];
    return row || null;
  }

    async getProfiles(organizationId: string): Promise<UserProfile[]> {
      requirePermission(organizationId, 'MANAGE_STAFF');
      return (await (await this.database()).select<UserProfile>('SELECT id, email, full_name, role, organization_id, is_active, created_at FROM profiles WHERE organization_id = ? ORDER BY full_name', [organizationId]));
    }

  async getSessionProfile(profileId: string): Promise<UserProfile | null> {
    const row = (await (await this.database()).select<UserProfile>('SELECT * FROM profiles WHERE id = ? AND is_active = 1', [profileId]))[0];
    return row || null;
  }

  async createLocalOwnerAccount(organization: Organization, profile: UserProfile): Promise<void> {
    await this.transaction(async (db) => {
      await this.insert(db, 'organizations', { ...organization, next_invoice_number: 1001, updated_at: organization.updated_at || now() });
      await this.insert(db, 'profiles', { ...profile, updated_at: now(), is_active: 1 });
      await this.insert(db, 'organization_members', { id: id(), organization_id: organization.id, user_id: profile.id, role: 'OWNER', is_active: 1, created_at: now(), updated_at: now() });
      const accounts = [
        { name: 'Cash Drawer', type: 'CASH', balance: 10000 },
        { name: 'Business Bank Account', type: 'BANK', balance: 0 },
        { name: 'JazzCash Wallet', type: 'DIGITAL_WALLET', balance: 0 },
        { name: 'Easypaisa Wallet', type: 'DIGITAL_WALLET', balance: 0 },
      ];
      for (const account of accounts) {
        const accountId = id();
        await this.insert(db, 'payment_accounts', { id: accountId, organization_id: organization.id, name: account.name, type: account.type, current_balance: account.balance, opening_balance: account.balance, is_active: 1, is_default: account.type === 'CASH' ? 1 : 0, created_at: now(), updated_at: now() });
      }
    });
  }

  async updateOrganization(organization: Partial<Organization> & { id: string }): Promise<void> {
    requirePermission(organization.id, 'MANAGE_BUSINESS_CONFIG');
    const fields = Object.entries(organization).filter(([key]) => key !== 'id' && key !== 'created_at');
    if (!fields.length) return;
    const assignments = fields.map(([key]) => `${key} = ?`).join(', ');
    await (await this.database()).execute(`UPDATE organizations SET ${assignments}, updated_at = ? WHERE id = ?`, [...fields.map(([, value]) => value), now(), organization.id]);
  }

  async migrateLegacyLocalStorage(): Promise<{ migrated: boolean; records: number }> {
    if (typeof window === 'undefined') return { migrated: false, records: 0 };
    if (localStorage.getItem('yaqoob_sqlite_migration_v1') === 'complete') return { migrated: false, records: 0 };
    const raw = localStorage.getItem('yaqoob_ent_data');
    if (!raw) {
      localStorage.setItem('yaqoob_sqlite_migration_v1', 'complete');
      return { migrated: false, records: 0 };
    }
    const legacy = JSON.parse(raw);
    if (!legacy || !Array.isArray(legacy.organizations) || legacy.organizations.length !== 1) {
      throw new Error('Legacy business data has no single valid organization');
    }
    const organizationId = id();
    const maps = new Map<string, Map<string, string>>();
    const mapId = (table: string, value: unknown): string | null => {
      if (!value) return null;
      if (!maps.has(table)) maps.set(table, new Map());
      const tableMap = maps.get(table)!;
      if (!tableMap.has(String(value))) tableMap.set(String(value), id());
      return tableMap.get(String(value))!;
    };
    const mapped = (table: string, value: unknown): string | null => value ? maps.get(table)?.get(String(value)) || null : null;
    let records = 0;
    await this.transaction(async (db) => {
      const sourceOrganization = legacy.organizations[0];
      maps.set('organizations', new Map([[String(sourceOrganization.id), organizationId]]));
      await this.insert(db, 'organizations', { ...sourceOrganization, id: organizationId, updated_at: sourceOrganization.updated_at || now() }); records += 1;
      for (const profile of legacy.profiles || []) { const profileId = mapId('profiles', profile.id)!; await this.insert(db, 'profiles', { ...profile, id: profileId, organization_id: organizationId, updated_at: profile.updated_at || now() }); await this.insert(db, 'organization_members', { id: id(), organization_id: organizationId, user_id: profileId, role: profile.role, is_active: profile.is_active === false ? 0 : 1, created_at: profile.created_at || now(), updated_at: now() }); records += 2; }
      for (const category of legacy.categories || []) { const categoryId = mapId('categories', category.id)!; await this.insert(db, 'categories', { ...category, id: categoryId, organization_id: organizationId, created_at: category.created_at || now(), updated_at: now() }); records += 1; }
      for (const category of legacy.expense_categories || []) { const categoryId = mapId('expense_categories', category.id)!; await this.insert(db, 'expense_categories', { ...category, id: categoryId, organization_id: organizationId, created_at: category.created_at || now() }); records += 1; }
      for (const product of legacy.products || []) { const productId = mapId('products', product.id)!; await this.insert(db, 'products', { ...product, id: productId, organization_id: organizationId, category_id: mapped('categories', product.category_id), track_stock: product.track_stock === false ? 0 : 1, is_active: product.is_active === false ? 0 : 1, created_at: product.created_at || now(), updated_at: product.updated_at || now() }); records += 1; }
      for (const service of legacy.services || []) { const serviceId = mapId('services', service.id)!; const { components: _components, ...serviceRow } = service; await this.insert(db, 'services', { ...serviceRow, id: serviceId, organization_id: organizationId, category_id: mapped('categories', service.category_id), is_active: service.is_active === false ? 0 : 1, created_at: service.created_at || now(), updated_at: service.updated_at || now() }); for (const component of service.components || []) { await this.insert(db, 'service_components', { id: mapId('service_components', component.id) || id(), organization_id: organizationId, service_id: serviceId, product_id: mapped('products', component.product_id), quantity_consumed: component.quantity_consumed, created_at: now() }); records += 1; } records += 1; }
      for (const customer of legacy.customers || []) { const customerId = mapId('customers', customer.id)!; await this.insert(db, 'customers', { ...customer, id: customerId, organization_id: organizationId, created_at: customer.created_at || now(), updated_at: customer.updated_at || now() }); records += 1; }
      for (const account of legacy.accounts || []) { const accountId = mapId('accounts', account.id)!; await this.insert(db, 'payment_accounts', { ...account, id: accountId, organization_id: organizationId, is_active: account.is_active === false ? 0 : 1, is_default: account.is_default ? 1 : 0, created_at: account.created_at || now(), updated_at: account.updated_at || now() }); records += 1; }
      for (const sale of legacy.sales || []) { const saleId = mapId('sales', sale.id)!; const { items: saleItems, ...saleRow } = sale; const saleRecord = { ...saleRow, id: saleId, organization_id: organizationId, customer_id: mapped('customers', sale.customer_id), cashier_id: mapped('profiles', sale.cashier_id) || sale.cashier_id, split_payments: JSON.stringify((sale.split_payments || []).map((payment: SplitPayment) => ({ ...payment, account_id: mapped('accounts', payment.account_id) }))), created_at: sale.created_at || now() }; await this.insert(db, 'sales', saleRecord); for (const item of saleItems || []) { await this.insert(db, 'sale_items', { ...item, id: mapId('sale_items', item.id) || id(), organization_id: organizationId, sale_id: saleId, item_id: item.item_type === 'PRODUCT' ? mapped('products', item.item_id) : mapped('services', item.item_id) }); records += 1; } records += 1; }
      for (const expense of legacy.expenses || []) { const expenseId = mapId('expenses', expense.id)!; await this.insert(db, 'expenses', { ...expense, id: expenseId, organization_id: organizationId, category_id: mapped('expense_categories', expense.category_id), account_id: mapped('accounts', expense.account_id), entered_by: mapped('profiles', expense.entered_by) || expense.entered_by, created_at: expense.created_at || now() }); records += 1; }
      for (const transfer of legacy.transfers || []) { const transferId = mapId('transfers', transfer.id)!; await this.insert(db, 'account_transfers', { ...transfer, id: transferId, organization_id: organizationId, from_account_id: mapped('accounts', transfer.from_account_id), to_account_id: mapped('accounts', transfer.to_account_id), created_by: mapped('profiles', transfer.created_by) || transfer.created_by, created_at: transfer.created_at || now() }); records += 1; }
      for (const transaction of legacy.transactions || []) { await this.insert(db, 'account_transactions', { ...transaction, id: mapId('transactions', transaction.id) || id(), organization_id: organizationId, account_id: mapped('accounts', transaction.account_id), created_at: transaction.created_at || now() }); records += 1; }
      for (const movement of legacy.stock_movements || []) { await this.insert(db, 'stock_movements', { ...movement, id: mapId('stock_movements', movement.id) || id(), organization_id: organizationId, product_id: mapped('products', movement.product_id), created_at: movement.created_at || now() }); records += 1; }
      for (const closing of legacy.daily_closings || []) { await this.insert(db, 'daily_closings', { ...closing, id: mapId('daily_closings', closing.id) || id(), organization_id: organizationId, closed_by: mapped('profiles', closing.closed_by) || closing.closed_by, created_at: closing.created_at || now() }); records += 1; }
      for (const log of legacy.audit_logs || []) { await this.insert(db, 'audit_logs', { ...log, id: mapId('audit_logs', log.id) || id(), organization_id: organizationId, user_id: mapped('profiles', log.user_id) || log.user_id, created_at: log.created_at || now() }); records += 1; }
      const verified = await db.select<any>('SELECT id FROM organizations WHERE id = ?', [organizationId]);
      if (!verified.length) throw new Error('Legacy migration verification failed');
    });
    localStorage.removeItem('yaqoob_ent_data');
    localStorage.setItem('yaqoob_sqlite_migration_v1', 'complete');
    return { migrated: true, records };
  }

  async exportDatabaseBackup(organizationId: string): Promise<string> {
    requirePermission(organizationId, 'RESTORE_DATABASE');
    const db = await this.database();
    const tables = ['organizations', 'profiles', 'organization_members', 'categories', 'products', 'services', 'service_components', 'stock_movements', 'customers', 'payment_accounts', 'account_transfers', 'account_transactions', 'expense_categories', 'expenses', 'sales', 'sale_items', 'daily_closings', 'audit_logs', 'sync_queue', 'sync_cursors'];
    const data: Record<string, unknown[]> = {};
    for (const table of tables) data[table] = table === 'sync_cursors'
      ? await db.select(`SELECT * FROM ${table} WHERE organization_id = ?`, [organizationId])
      : await db.select(`SELECT * FROM ${table} WHERE organization_id = ?`, [organizationId]);
    data.organizations = await db.select(`SELECT * FROM organizations WHERE id = ?`, [organizationId]);
    return JSON.stringify({ format: 'YAQOOB_SQLITE_BACKUP_V1', schema_version: 4, exported_at: now(), organization_id: organizationId, data }, null, 2);
  }

  validateDatabaseBackup(json: string, organizationId: string): { valid: boolean; error?: string; archive?: any } {
    try {
      const archive = JSON.parse(json);
      if (archive?.format !== 'YAQOOB_SQLITE_BACKUP_V1' || archive.schema_version !== 4) return { valid: false, error: 'Unsupported SQLite backup schema' };
      if (archive.organization_id !== organizationId || !archive.data || !Array.isArray(archive.data.organizations) || archive.data.organizations.length !== 1) return { valid: false, error: 'Backup organization does not match the current workspace' };
      const required = ['profiles', 'organization_members', 'products', 'services', 'service_components', 'stock_movements', 'customers', 'payment_accounts', 'account_transfers', 'account_transactions', 'expense_categories', 'expenses', 'sales', 'sale_items', 'daily_closings', 'audit_logs', 'sync_queue', 'sync_cursors'];
      if (!required.every((table) => Array.isArray(archive.data[table]))) return { valid: false, error: 'Backup is missing required tables' };
      const ids = new Set<string>();
      for (const rows of Object.values(archive.data) as unknown[][]) for (const row of rows) {
        const record = row as Record<string, unknown>;
        if (record.id && ids.has(String(record.id))) return { valid: false, error: 'Backup contains duplicate IDs' };
        if (record.id) ids.add(String(record.id));
        for (const key of ['amount', 'current_balance', 'grand_total', 'quantity', 'tax_amount']) if (key in record && (!Number.isFinite(Number(record[key])) || Number(record[key]) < 0)) return { valid: false, error: `Invalid numeric value in ${key}` };
      }
      return { valid: true, archive };
    } catch (error) {
      return { valid: false, error: `Invalid SQLite backup: ${String(error)}` };
    }
  }

  async restoreDatabaseBackup(json: string, organizationId: string): Promise<void> {
    requirePermission(organizationId, 'RESTORE_DATABASE');
    const validation = this.validateDatabaseBackup(json, organizationId);
    if (!validation.valid || !validation.archive) throw new Error(validation.error || 'Invalid backup');
    const data = validation.archive.data as Record<string, any[]>;
    const deleteOrder = ['sync_queue', 'sync_cursors', 'audit_logs', 'daily_closings', 'sale_items', 'sales', 'expenses', 'expense_categories', 'account_transactions', 'account_transfers', 'payment_accounts', 'stock_movements', 'service_components', 'services', 'products', 'customers', 'categories', 'organization_members', 'profiles'];
    const insertOrder = [...deleteOrder].reverse();
    await this.transaction(async (db) => {
      for (const table of deleteOrder) {
        if (table === 'sync_cursors') await db.execute(`DELETE FROM ${table} WHERE organization_id = ?`, [organizationId]);
        else await db.execute(`DELETE FROM ${table} WHERE organization_id = ?`, [organizationId]);
      }
      for (const table of insertOrder) for (const row of data[table] || []) await this.insert(db, table, row);
      const foreignKeyErrors = await db.select<any>('PRAGMA foreign_key_check;');
      if (foreignKeyErrors.length) throw new Error('SQLite foreign-key validation failed during restore');
      await this.audit(db, organizationId, 'BACKUP_RESTORED', 'DATABASE', organizationId, 'SQLite backup restored transactionally');
    });
  }

  private async transaction<T>(callback: (db: SqlDatabase) => Promise<T>): Promise<T> {
    const db = await this.database();
    await db.execute('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = await callback(db);
      await db.execute('COMMIT;');
      return result;
    } catch (error) {
      await db.execute('ROLLBACK;');
      throw error;
    }
  }

  private async insert(db: SqlDatabase, table: string, record: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(record);
    const values = columns.map((column) => {
      const value = record[column];
      return value && typeof value === 'object' ? JSON.stringify(value) : value;
    });
    await db.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
  }

  private async queue(db: SqlDatabase, organizationId: string, tableName: string, recordId: string, operation: string, payload: Record<string, unknown>): Promise<void> {
    await this.insert(db, 'sync_queue', {
      id: id(), table_name: tableName, record_id: recordId, organization_id: organizationId,
      operation, payload: JSON.stringify(payload), attempts: 0, status: 'pending',
      created_at: now(), updated_at: now(),
    });
  }

  private async audit(db: SqlDatabase, organizationId: string, action: string, entity: string, entityId: string, details: string): Promise<void> {
    const principal = requireOrganization(organizationId);
    const record: AuditLog = {
      id: id(), organization_id: organizationId, user_id: principal.id, user_name: principal.fullName,
      action, entity, entity_id: entityId, details, created_at: now(),
    };
    await this.insert(db, 'audit_logs', record as unknown as Record<string, unknown>);
    await this.queue(db, organizationId, 'audit_logs', record.id, 'INSERT', record as unknown as Record<string, unknown>);
  }

  async getSales(organizationId: string, options?: { startDate?: string; endDate?: string; customerId?: string; status?: string }): Promise<Sale[]> {
    requireOrganization(organizationId);
    const db = await this.database();
    const rows = await db.select<any>('SELECT * FROM sales WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]);
    const result: Sale[] = [];
    for (const row of rows) {
      if (options?.status && row.status !== options.status) continue;
      if (options?.customerId && row.customer_id !== options.customerId) continue;
      if (options?.startDate && String(row.created_at).slice(0, 10) < options.startDate) continue;
      if (options?.endDate && String(row.created_at).slice(0, 10) > options.endDate) continue;
      const itemRows = await db.select<any>('SELECT * FROM sale_items WHERE organization_id = ? AND sale_id = ?', [organizationId, row.id]);
      result.push({
        ...row,
        split_payments: decode<SplitPayment[]>(row.split_payments, true) || [],
        items: itemRows,
      });
    }
    return result;
  }

  async getSaleById(organizationId: string, saleId: string): Promise<Sale | null> {
    const sales = await this.getSales(organizationId);
    return sales.find((sale) => sale.id === saleId) || null;
  }

  async createSale(organizationId: string, payload: Parameters<ISalesRepository['createSale']>[1]): Promise<Sale> {
    const principal = requirePermission(organizationId, 'FAST_POS_CHECKOUT');
    if (!payload.items.length) throw new Error('A sale must contain at least one item');
    return this.transaction(async (db) => {
      const organizations = await db.select<any>('SELECT * FROM organizations WHERE id = ?', [organizationId]);
      const organization = organizations[0];
      if (!organization) throw new Error('Organization not found');
      const existing = await db.select<any>('SELECT next_invoice_number, invoice_prefix FROM organizations WHERE id = ?', [organizationId]);
      let invoiceNumberValue = Number(existing[0]?.next_invoice_number || 1001);
      let invoiceNumber = `${existing[0]?.invoice_prefix || 'YE-'}${invoiceNumberValue}`;
      while ((await db.select<any>('SELECT id FROM sales WHERE organization_id = ? AND invoice_number = ?', [organizationId, invoiceNumber])).length) {
        invoiceNumberValue += 1;
        invoiceNumber = `${existing[0]?.invoice_prefix || 'YE-'}${invoiceNumberValue}`;
      }
      await db.execute('UPDATE organizations SET next_invoice_number = ?, updated_at = ? WHERE id = ?', [invoiceNumberValue + 1, now(), organizationId]);

      let subtotal = 0;
      let totalCogs = 0;
      let itemDiscounts = 0;
      const saleItems: SaleItem[] = [];
      for (const item of payload.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Sale quantity must be greater than zero');
        if (!Number.isFinite(item.unit_price) || item.unit_price < 0) throw new Error('Sale price is invalid');
        const itemSubtotal = roundMoney(item.quantity * item.unit_price);
        const discount = roundMoney(item.discount || 0);
        if (discount < 0 || discount > itemSubtotal) throw new Error('Sale item discount is invalid');
        let unitCost = 0;
        if (item.type === 'PRODUCT') {
          const products = await db.select<any>('SELECT * FROM products WHERE organization_id = ? AND id = ?', [organizationId, item.item_id]);
          const product = products[0];
          if (!product) throw new Error('Sale product does not belong to this organization');
          unitCost = Number(product.average_cost || 0);
          if (product.track_stock) {
            await db.execute('UPDATE products SET current_stock = current_stock - ?, stock_value = (current_stock - ?) * average_cost, updated_at = ? WHERE organization_id = ? AND id = ?', [item.quantity, item.quantity, now(), organizationId, item.item_id]);
            const movement: StockMovement = { id: id(), organization_id: organizationId, product_id: item.item_id, product_name: product.name, movement_type: 'SALE', quantity: -item.quantity, unit_cost: unitCost, total_cost: roundMoney(item.quantity * unitCost), reference_id: '', reference_type: 'SALE', created_by: principal.fullName, created_at: now() };
            await this.insert(db, 'stock_movements', movement as unknown as Record<string, unknown>);
          }
        } else {
          const services = await db.select<any>('SELECT * FROM services WHERE organization_id = ? AND id = ?', [organizationId, item.item_id]);
          const service = services[0];
          if (!service) throw new Error('Sale service does not belong to this organization');
          const components = await db.select<any>('SELECT * FROM service_components WHERE organization_id = ? AND service_id = ?', [organizationId, item.item_id]);
          for (const component of components) {
            const products = await db.select<any>('SELECT * FROM products WHERE organization_id = ? AND id = ?', [organizationId, component.product_id]);
            const product = products[0];
            if (!product) throw new Error('Service component product is invalid');
            const consumed = roundMoney(Number(component.quantity_consumed) * item.quantity);
            unitCost += Number(component.quantity_consumed) * Number(product.average_cost || 0);
            if (product.track_stock) {
              await db.execute('UPDATE products SET current_stock = current_stock - ?, stock_value = (current_stock - ?) * average_cost, updated_at = ? WHERE organization_id = ? AND id = ?', [consumed, consumed, now(), organizationId, product.id]);
              const movement: StockMovement = { id: id(), organization_id: organizationId, product_id: product.id, product_name: product.name, movement_type: 'SALE', quantity: -consumed, unit_cost: Number(product.average_cost || 0), total_cost: roundMoney(consumed * Number(product.average_cost || 0)), reference_id: '', reference_type: 'SERVICE_CONSUMPTION', created_by: principal.fullName, created_at: now() };
              await this.insert(db, 'stock_movements', movement as unknown as Record<string, unknown>);
            }
          }
          if (!unitCost) unitCost = Number(service.estimated_cost || 0);
        }
        const total = roundMoney(itemSubtotal - discount);
        const cogs = roundMoney(item.quantity * unitCost);
        subtotal = roundMoney(subtotal + itemSubtotal);
        itemDiscounts = roundMoney(itemDiscounts + discount);
        totalCogs = roundMoney(totalCogs + cogs);
        saleItems.push({ id: id(), organization_id: organizationId, sale_id: '', item_type: item.type, item_id: item.item_id, item_name: item.name, sku: item.sku, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, unit_cost: unitCost, discount, subtotal: itemSubtotal, total, cogs, gross_profit: roundMoney(total - cogs) });
      }
      const totalDiscount = roundMoney(itemDiscounts + payload.discount);
      if (payload.discount < 0 || totalDiscount > subtotal) throw new Error('Sale discount exceeds subtotal');
      if (payload.tax_amount < 0 || !Number.isFinite(payload.tax_amount)) throw new Error('Sale tax is invalid');
      if (payload.amount_paid < 0 || !Number.isFinite(payload.amount_paid)) throw new Error('Payment amount is invalid');
      const grandTotal = roundMoney(Math.max(0, subtotal - totalDiscount + payload.tax_amount));
      const changeDue = roundMoney(Math.max(0, payload.amount_paid - grandTotal));
      const received = roundMoney(payload.amount_paid - changeDue);
      const splits = payload.split_payments || [];
      if (splits.length && roundMoney(splits.reduce((sum, split) => sum + split.amount, 0)) !== received) throw new Error('Split payments do not match the received sale payment');
      const saleId = id();
      const sale: Sale = { id: saleId, organization_id: organizationId, invoice_number: invoiceNumber, customer_id: payload.customer_id, customer_name: payload.customer_name || 'Walk-in Customer', customer_phone: payload.customer_phone, cashier_id: principal.id, cashier_name: principal.fullName, items: saleItems.map((item) => ({ ...item, sale_id: saleId })), subtotal, discount: totalDiscount, tax_amount: payload.tax_amount, grand_total: grandTotal, amount_paid: payload.amount_paid, change_due: changeDue, payment_method: payload.payment_method, split_payments: splits, total_cogs: totalCogs, gross_profit: roundMoney(grandTotal - payload.tax_amount - totalCogs), status: 'COMPLETED', notes: payload.notes, created_at: now() };
      if (sale.customer_id) {
        const customers = await db.select<any>('SELECT id FROM customers WHERE organization_id = ? AND id = ?', [organizationId, sale.customer_id]);
        if (!customers.length) throw new Error('Sale customer does not belong to this organization');
        await db.execute('UPDATE customers SET total_purchases = total_purchases + ?, last_purchase_date = ? WHERE organization_id = ? AND id = ?', [grandTotal, now(), organizationId, sale.customer_id]);
      }
      const { items: _saleItems, ...saleRow } = sale;
      await this.insert(db, 'sales', { ...saleRow, split_payments: JSON.stringify(sale.split_payments) });
      for (const item of sale.items) await this.insert(db, 'sale_items', item as unknown as Record<string, unknown>);
      const payments = splits.length ? splits : [{ account_id: '', account_name: '', amount: received }];
      for (const payment of payments) {
        const accounts = await db.select<any>('SELECT * FROM payment_accounts WHERE organization_id = ? AND (id = ? OR (id = (SELECT id FROM payment_accounts WHERE organization_id = ? AND type = \'CASH\' LIMIT 1) AND ? = \'\'))', [organizationId, payment.account_id, organizationId, payment.account_id]);
        const account = accounts[0];
        if (!account) throw new Error('Sale payment account is invalid');
        await db.execute('UPDATE payment_accounts SET current_balance = current_balance + ?, updated_at = ? WHERE organization_id = ? AND id = ?', [payment.amount, now(), organizationId, account.id]);
        await this.insert(db, 'account_transactions', { id: id(), organization_id: organizationId, account_id: account.id, account_name: account.name, type: 'INCOME', amount: payment.amount, balance_after: Number(account.current_balance) + payment.amount, reference_type: 'SALE', reference_id: saleId, description: `Payment for Sale #${invoiceNumber}`, date: now().slice(0, 10), created_at: now() });
      }
      await this.audit(db, organizationId, 'SALE_CREATED', 'SALE', saleId, `Generated invoice #${invoiceNumber}`);
      await this.queue(db, organizationId, 'sales', saleId, 'INSERT', sale as unknown as Record<string, unknown>);
      for (const item of sale.items) await this.queue(db, organizationId, 'sale_items', item.id, 'INSERT', item as unknown as Record<string, unknown>);
      return sale;
    });
  }

  async voidSale(organizationId: string, saleId: string, _cashierId: string, _cashierName: string, reason: string): Promise<Sale> {
    const principal = requirePermission(organizationId, 'VOID_SALE');
    return this.transaction(async (db) => {
      const rows = await db.select<any>('SELECT * FROM sales WHERE organization_id = ? AND id = ?', [organizationId, saleId]);
      const sale = rows[0];
      if (!sale || sale.status === 'VOIDED') throw new Error('Sale not found or already voided');
      await db.execute('UPDATE sales SET status = ?, void_reason = ?, voided_by = ?, voided_at = ? WHERE organization_id = ? AND id = ?', ['VOIDED', reason, principal.fullName, now(), organizationId, saleId]);
      const items = await db.select<any>('SELECT * FROM sale_items WHERE organization_id = ? AND sale_id = ?', [organizationId, saleId]);
      for (const item of items) {
        if (item.item_type === 'PRODUCT') {
          await db.execute('UPDATE products SET current_stock = current_stock + ?, stock_value = current_stock * average_cost, updated_at = ? WHERE organization_id = ? AND id = ?', [item.quantity, now(), organizationId, item.item_id]);
        } else {
          const components = await db.select<any>('SELECT * FROM service_components WHERE organization_id = ? AND service_id = ?', [organizationId, item.item_id]);
          for (const component of components) {
            const quantity = roundMoney(Number(component.quantity_consumed) * Number(item.quantity));
            await db.execute('UPDATE products SET current_stock = current_stock + ?, stock_value = current_stock * average_cost, updated_at = ? WHERE organization_id = ? AND id = ?', [quantity, now(), organizationId, component.product_id]);
          }
        }
      }
      const splitPayments = decode<SplitPayment[]>(sale.split_payments, true) || [];
      const payments = splitPayments.length ? splitPayments : [{ account_id: '', amount: roundMoney(Number(sale.amount_paid) - Number(sale.change_due)) }];
      for (const payment of payments) {
        const account = payment.account_id
          ? (await db.select<any>('SELECT * FROM payment_accounts WHERE organization_id = ? AND id = ?', [organizationId, payment.account_id]))[0]
          : (await db.select<any>("SELECT * FROM payment_accounts WHERE organization_id = ? AND type = 'CASH' LIMIT 1", [organizationId]))[0];
        if (!account) throw new Error('Sale reversal account is invalid');
        await db.execute('UPDATE payment_accounts SET current_balance = current_balance - ?, updated_at = ? WHERE organization_id = ? AND id = ?', [payment.amount, now(), organizationId, account.id]);
        await this.insert(db, 'account_transactions', { id: id(), organization_id: organizationId, account_id: account.id, account_name: account.name, type: 'ADJUSTMENT', amount: -payment.amount, balance_after: Number(account.current_balance) - payment.amount, reference_type: 'SALE', reference_id: saleId, description: `Voided Sale #${sale.invoice_number}`, date: now().slice(0, 10), created_at: now() });
      }
      await this.audit(db, organizationId, 'SALE_VOIDED', 'SALE', saleId, reason);
      await this.queue(db, organizationId, 'sales', saleId, 'UPDATE', { ...sale, status: 'VOIDED', void_reason: reason });
      const updated = { ...sale, status: 'VOIDED', void_reason: reason, voided_by: principal.fullName } as Sale;
      updated.items = items;
      updated.split_payments = decode<SplitPayment[]>(sale.split_payments, true) || [];
      return updated;
    });
  }

  async getProducts(organizationId: string): Promise<Product[]> { requireOrganization(organizationId); return (await (await this.database()).select<Product>('SELECT * FROM products WHERE organization_id = ? ORDER BY name', [organizationId])).filter((product) => product.is_active !== false && (product.is_active as unknown) !== 0); }
  async getProductById(organizationId: string, productId: string): Promise<Product | null> { requireOrganization(organizationId); return (await (await this.database()).select<Product>('SELECT * FROM products WHERE organization_id = ? AND id = ?', [organizationId, productId]))[0] || null; }
  async saveProduct(organizationId: string, product: Partial<Product> & { name: string; unit: string; selling_price: number }): Promise<Product> { requirePermission(organizationId, 'MANAGE_INVENTORY'); const record: Product = { id: product.id || id(), organization_id: organizationId, name: product.name, sku: product.sku || '', unit: product.unit, purchase_price: product.purchase_price || 0, selling_price: product.selling_price, opening_stock: product.opening_stock || 0, current_stock: product.current_stock ?? product.opening_stock ?? 0, min_stock_threshold: product.min_stock_threshold || 5, track_stock: product.track_stock ?? true, is_active: product.is_active ?? true, average_cost: product.average_cost ?? product.purchase_price ?? 0, stock_value: product.stock_value ?? 0, category_id: product.category_id, category_name: product.category_name, supplier: product.supplier, notes: product.notes, created_at: product.created_at || now() }; await this.transaction(async (db) => { await this.insert(db, 'products', { ...record, track_stock: record.track_stock ? 1 : 0, is_active: record.is_active ? 1 : 0, updated_at: now() }); await this.queue(db, organizationId, 'products', record.id, product.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }
  async deleteProduct(organizationId: string, productId: string): Promise<boolean> { requirePermission(organizationId, 'MANAGE_INVENTORY'); return this.transaction(async (db) => { const result = await db.execute('UPDATE products SET is_active = 0, updated_at = ? WHERE organization_id = ? AND id = ?', [now(), organizationId, productId]); await this.queue(db, organizationId, 'products', productId, 'UPDATE', { id: productId, organization_id: organizationId, is_active: false }); return result.rowsAffected > 0; }); }
  async getServices(organizationId: string): Promise<Service[]> { requireOrganization(organizationId); const rows = await (await this.database()).select<any>('SELECT * FROM services WHERE organization_id = ? ORDER BY name', [organizationId]); return rows.filter((service) => service.is_active !== false && service.is_active !== 0); }
  async saveService(organizationId: string, service: Partial<Service> & { name: string; selling_price: number }): Promise<Service> { requirePermission(organizationId, 'MANAGE_INVENTORY'); const record: Service = { id: service.id || id(), organization_id: organizationId, name: service.name, sku: service.sku, category_id: service.category_id, category_name: service.category_name, selling_price: service.selling_price, estimated_cost: service.estimated_cost || 0, is_active: service.is_active ?? true, notes: service.notes, components: service.components || [], created_at: service.created_at || now() }; await this.transaction(async (db) => { const { components: _components, ...serviceRow } = record; await this.insert(db, 'services', { ...serviceRow, is_active: record.is_active ? 1 : 0, updated_at: now() }); for (const component of record.components || []) { const { product_name: _productName, unit: _unit, ...componentRow } = component; await this.insert(db, 'service_components', { ...componentRow, created_at: now() }); } await this.queue(db, organizationId, 'services', record.id, service.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }
  async deleteService(organizationId: string, serviceId: string): Promise<boolean> { requirePermission(organizationId, 'MANAGE_INVENTORY'); return this.transaction(async (db) => (await db.execute('UPDATE services SET is_active = 0, updated_at = ? WHERE organization_id = ? AND id = ?', [now(), organizationId, serviceId])).rowsAffected > 0); }
  async recordStockMovement(organizationId: string, movement: Omit<StockMovement, 'id' | 'created_at'>): Promise<StockMovement> { const principal = requirePermission(organizationId, 'MANAGE_INVENTORY'); if (!Number.isFinite(movement.quantity) || movement.quantity === 0) throw new Error('Stock movement quantity must be non-zero'); const record: StockMovement = { ...movement, id: id(), created_at: now(), organization_id: organizationId, created_by: principal.fullName }; return this.transaction(async (db) => { const product = (await db.select<any>('SELECT * FROM products WHERE organization_id = ? AND id = ?', [organizationId, record.product_id]))[0]; if (!product) throw new Error('Product not found'); await db.execute('UPDATE products SET current_stock = current_stock + ?, stock_value = (current_stock + ?) * average_cost, updated_at = ? WHERE organization_id = ? AND id = ?', [record.quantity, record.quantity, now(), organizationId, record.product_id]); await this.insert(db, 'stock_movements', record as unknown as Record<string, unknown>); await this.queue(db, organizationId, 'stock_movements', record.id, 'INSERT', record as unknown as Record<string, unknown>); return record; }); }
  async getStockMovements(organizationId: string, productId?: string): Promise<StockMovement[]> { requireOrganization(organizationId); const db = await this.database(); return productId ? db.select<StockMovement>('SELECT * FROM stock_movements WHERE organization_id = ? AND product_id = ? ORDER BY created_at DESC', [organizationId, productId]) : db.select<StockMovement>('SELECT * FROM stock_movements WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]); }
  async getCategories(organizationId: string): Promise<Category[]> { requireOrganization(organizationId); return (await (await this.database()).select<Category>('SELECT * FROM categories WHERE organization_id = ? ORDER BY name', [organizationId])); }
  async saveCategory(organizationId: string, category: Partial<Category> & { name: string; type: Category['type'] }): Promise<Category> { requirePermission(organizationId, 'MANAGE_INVENTORY'); const record: Category = { id: category.id || id(), organization_id: organizationId, name: category.name, type: category.type, color: category.color, created_at: category.created_at || now() }; await this.transaction(async (db) => { await this.insert(db, 'categories', record as unknown as Record<string, unknown>); await this.queue(db, organizationId, 'categories', record.id, category.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }

  async getExpenses(organizationId: string, options?: { startDate?: string; endDate?: string; categoryId?: string }): Promise<Expense[]> { requireOrganization(organizationId); const rows = await (await this.database()).select<Expense>('SELECT * FROM expenses WHERE organization_id = ? ORDER BY date DESC, created_at DESC', [organizationId]); return rows.filter((row) => (!options?.startDate || row.date >= options.startDate) && (!options?.endDate || row.date <= options.endDate) && (!options?.categoryId || row.category_id === options.categoryId)); }
  async createExpense(organizationId: string, payload: Parameters<IExpenseRepository['createExpense']>[1]): Promise<Expense> { const principal = requirePermission(organizationId, 'RECORD_EXPENSES'); if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('Expense amount must be greater than zero'); return this.transaction(async (db) => { const category = (await db.select<any>('SELECT * FROM expense_categories WHERE organization_id = ? AND id = ?', [organizationId, payload.category_id]))[0]; const account = (await db.select<any>('SELECT * FROM payment_accounts WHERE organization_id = ? AND id = ?', [organizationId, payload.account_id]))[0]; if (!category || !account) throw new Error('Expense reference is invalid'); const expense: Expense = { id: id(), organization_id: organizationId, category_id: payload.category_id, category_name: category.name, amount: payload.amount, account_id: payload.account_id, account_name: account.name, description: payload.description, reference_number: payload.reference_number, date: payload.date, notes: payload.notes, entered_by: principal.id, status: 'ACTIVE', created_at: now() }; await this.insert(db, 'expenses', expense as unknown as Record<string, unknown>); await db.execute('UPDATE payment_accounts SET current_balance = current_balance - ?, updated_at = ? WHERE organization_id = ? AND id = ?', [expense.amount, now(), organizationId, expense.account_id]); await this.insert(db, 'account_transactions', { id: id(), organization_id: organizationId, account_id: account.id, account_name: account.name, type: 'EXPENSE', amount: expense.amount, balance_after: Number(account.current_balance) - expense.amount, reference_type: 'EXPENSE', reference_id: expense.id, description: expense.description, date: expense.date, created_at: now() }); await this.audit(db, organizationId, 'EXPENSE_RECORDED', 'EXPENSE', expense.id, expense.description); await this.queue(db, organizationId, 'expenses', expense.id, 'INSERT', expense as unknown as Record<string, unknown>); return expense; }); }
  async voidExpense(organizationId: string, expenseId: string, _userId: string, _userName: string): Promise<Expense> { const principal = requirePermission(organizationId, 'VOID_EXPENSE'); return this.transaction(async (db) => { const expense = (await db.select<any>('SELECT * FROM expenses WHERE organization_id = ? AND id = ?', [organizationId, expenseId]))[0]; if (!expense || expense.status === 'VOIDED') throw new Error('Expense not found or already voided'); await db.execute('UPDATE expenses SET status = ? WHERE organization_id = ? AND id = ?', ['VOIDED', organizationId, expenseId]); await db.execute('UPDATE payment_accounts SET current_balance = current_balance + ?, updated_at = ? WHERE organization_id = ? AND id = ?', [expense.amount, now(), organizationId, expense.account_id]); await this.audit(db, organizationId, 'EXPENSE_VOIDED', 'EXPENSE', expenseId, `Voided by ${principal.fullName}`); await this.queue(db, organizationId, 'expenses', expenseId, 'UPDATE', { ...expense, status: 'VOIDED' }); return { ...expense, status: 'VOIDED' } as Expense; }); }
  async getExpenseCategories(organizationId: string): Promise<ExpenseCategory[]> { requireOrganization(organizationId); return (await (await this.database()).select<ExpenseCategory>('SELECT * FROM expense_categories WHERE organization_id = ? ORDER BY name', [organizationId])); }
  async saveExpenseCategory(organizationId: string, category: Partial<ExpenseCategory> & { name: string }): Promise<ExpenseCategory> { requirePermission(organizationId, 'MANAGE_BUSINESS_CONFIG'); const record: ExpenseCategory = { id: category.id || id(), organization_id: organizationId, name: category.name, description: category.description, is_active: category.is_active ?? true, created_at: category.created_at || now() }; await this.transaction(async (db) => { await this.insert(db, 'expense_categories', record as unknown as Record<string, unknown>); await this.queue(db, organizationId, 'expense_categories', record.id, category.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }

  async getCustomers(organizationId: string, query?: string): Promise<Customer[]> { requireOrganization(organizationId); const rows = await (await this.database()).select<Customer>('SELECT * FROM customers WHERE organization_id = ? ORDER BY name', [organizationId]); if (!query) return rows; const q = query.toLowerCase(); return rows.filter((row) => row.name.toLowerCase().includes(q) || row.phone?.includes(q) || row.email?.toLowerCase().includes(q)); }
  async getCustomerById(organizationId: string, customerId: string): Promise<Customer | null> { return (await this.getCustomers(organizationId)).find((customer) => customer.id === customerId) || null; }
  async saveCustomer(organizationId: string, customer: Partial<Customer> & { name: string }): Promise<Customer> { requireOrganization(organizationId); const record: Customer = { id: customer.id || id(), organization_id: organizationId, name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, notes: customer.notes, total_purchases: customer.total_purchases || 0, last_purchase_date: customer.last_purchase_date, outstanding_balance: customer.outstanding_balance || 0, created_at: customer.created_at || now() }; await this.transaction(async (db) => { await this.insert(db, 'customers', record as unknown as Record<string, unknown>); await this.queue(db, organizationId, 'customers', record.id, customer.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }

  async getAccounts(organizationId: string): Promise<PaymentAccount[]> { requireOrganization(organizationId); return (await (await this.database()).select<PaymentAccount>('SELECT * FROM payment_accounts WHERE organization_id = ? ORDER BY name', [organizationId])); }
  async getAccountById(organizationId: string, accountId: string): Promise<PaymentAccount | null> { return (await this.getAccounts(organizationId)).find((account) => account.id === accountId) || null; }
  async saveAccount(organizationId: string, account: Partial<PaymentAccount> & { name: string; type: PaymentAccount['type'] }): Promise<PaymentAccount> { requirePermission(organizationId, 'MANAGE_BUSINESS_CONFIG'); const record: PaymentAccount = { id: account.id || id(), organization_id: organizationId, name: account.name, type: account.type, account_number: account.account_number, current_balance: account.current_balance ?? account.opening_balance ?? 0, opening_balance: account.opening_balance ?? 0, is_active: account.is_active ?? true, is_default: account.is_default ?? false, created_at: account.created_at || now() }; await this.transaction(async (db) => { await this.insert(db, 'payment_accounts', { ...record, is_active: record.is_active ? 1 : 0, is_default: record.is_default ? 1 : 0, updated_at: now() }); await this.queue(db, organizationId, 'payment_accounts', record.id, account.id ? 'UPDATE' : 'INSERT', record as unknown as Record<string, unknown>); }); return record; }
  async transferFunds(organizationId: string, payload: Parameters<IAccountRepository['transferFunds']>[1]): Promise<AccountTransfer> { const principal = requirePermission(organizationId, 'ACCOUNT_TRANSFER'); if (!Number.isFinite(payload.amount) || payload.amount <= 0 || payload.from_account_id === payload.to_account_id) throw new Error('Invalid transfer'); return this.transaction(async (db) => { const accounts = await db.select<any>('SELECT * FROM payment_accounts WHERE organization_id = ? AND id IN (?, ?)', [organizationId, payload.from_account_id, payload.to_account_id]); const from = accounts.find((account) => account.id === payload.from_account_id); const to = accounts.find((account) => account.id === payload.to_account_id); if (!from || !to || Number(from.current_balance) < payload.amount) throw new Error('Invalid accounts or insufficient funds'); const transfer: AccountTransfer = { id: id(), organization_id: organizationId, from_account_id: from.id, from_account_name: from.name, to_account_id: to.id, to_account_name: to.name, amount: payload.amount, date: payload.date, notes: payload.notes, created_by: principal.id, created_at: now() }; await db.execute('UPDATE payment_accounts SET current_balance = current_balance - ?, updated_at = ? WHERE organization_id = ? AND id = ?', [payload.amount, now(), organizationId, from.id]); await db.execute('UPDATE payment_accounts SET current_balance = current_balance + ?, updated_at = ? WHERE organization_id = ? AND id = ?', [payload.amount, now(), organizationId, to.id]); await this.insert(db, 'account_transfers', transfer as unknown as Record<string, unknown>); await this.audit(db, organizationId, 'ACCOUNT_TRANSFER', 'PAYMENT_ACCOUNT', transfer.id, `Transferred ${payload.amount}`); await this.queue(db, organizationId, 'account_transfers', transfer.id, 'INSERT', transfer as unknown as Record<string, unknown>); return transfer; }); }
  async getTransactions(organizationId: string, accountId?: string): Promise<AccountTransaction[]> { requireOrganization(organizationId); const db = await this.database(); return accountId ? db.select<AccountTransaction>('SELECT * FROM account_transactions WHERE organization_id = ? AND account_id = ? ORDER BY created_at DESC', [organizationId, accountId]) : db.select<AccountTransaction>('SELECT * FROM account_transactions WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]); }

  async getClosings(organizationId: string): Promise<DailyClosing[]> { requireOrganization(organizationId); return (await (await this.database()).select<DailyClosing>('SELECT * FROM daily_closings WHERE organization_id = ? ORDER BY closing_date DESC', [organizationId])); }
  async getDailyClosingSummary(organizationId: string, date: string) { requireOrganization(organizationId); const [accounts, sales, expenses, transfers] = await Promise.all([this.getAccounts(organizationId), this.getSales(organizationId, { startDate: date, endDate: date }), this.getExpenses(organizationId, { startDate: date, endDate: date }), (await this.database()).select<any>('SELECT * FROM account_transfers WHERE organization_id = ? AND date = ?', [organizationId, date])]); const cash = accounts.find((account) => account.type === 'CASH'); const cashSales = sales.filter((sale) => sale.status === 'COMPLETED').reduce((sum, sale) => sum + (sale.split_payments.length ? sale.split_payments.filter((payment) => payment.account_id === cash?.id).reduce((s, p) => s + p.amount, 0) : sale.payment_method.toLowerCase().includes('cash') ? sale.amount_paid - sale.change_due : 0), 0); const cashExpenses = expenses.filter((expense) => expense.account_id === cash?.id && expense.status === 'ACTIVE').reduce((sum, expense) => sum + expense.amount, 0); const cashTransfersIn = transfers.filter((transfer) => transfer.to_account_id === cash?.id).reduce((sum, transfer) => sum + transfer.amount, 0); const cashTransfersOut = transfers.filter((transfer) => transfer.from_account_id === cash?.id).reduce((sum, transfer) => sum + transfer.amount, 0); const openingCash = cash?.opening_balance || 0; return { openingCash, cashSales: roundMoney(cashSales), cashExpenses: roundMoney(cashExpenses), cashTransfersIn: roundMoney(cashTransfersIn), cashTransfersOut: roundMoney(cashTransfersOut), expectedCash: roundMoney(openingCash + cashSales - cashExpenses + cashTransfersIn - cashTransfersOut) }; }
  async recordDailyClosing(organizationId: string, payload: Parameters<IClosingRepository['recordDailyClosing']>[1]): Promise<DailyClosing> { const principal = requirePermission(organizationId, 'SUBMIT_DAILY_CLOSING'); return this.transaction(async (db) => { const duplicate = await db.select<any>('SELECT id FROM daily_closings WHERE organization_id = ? AND closing_date = ?', [organizationId, payload.closing_date]); if (duplicate.length) throw new Error('Daily closing already exists for this date'); const summary = await this.getDailyClosingSummary(organizationId, payload.closing_date); const closing: DailyClosing = { id: id(), organization_id: organizationId, closing_date: payload.closing_date, opening_cash: summary.openingCash, cash_sales: summary.cashSales, cash_expenses: summary.cashExpenses, cash_transfers_in: summary.cashTransfersIn, cash_transfers_out: summary.cashTransfersOut, expected_cash: summary.expectedCash, actual_cash: payload.actual_cash, difference: roundMoney(payload.actual_cash - summary.expectedCash), notes: payload.notes, closed_by: principal.id, closed_at: now() }; await this.insert(db, 'daily_closings', closing as unknown as Record<string, unknown>); await this.audit(db, organizationId, 'DAILY_CLOSING_RECORDED', 'DAILY_CLOSING', closing.id, `Closed ${closing.closing_date}`); await this.queue(db, organizationId, 'daily_closings', closing.id, 'INSERT', closing as unknown as Record<string, unknown>); return closing; }); }
  async getLogs(organizationId: string, limit = 100): Promise<AuditLog[]> { requireOrganization(organizationId); return (await (await this.database()).select<AuditLog>('SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC', [organizationId])).slice(0, limit); }
  async log(organizationId: string, log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> { requireOrganization(organizationId); return this.transaction(async (db) => { const principal = requireOrganization(organizationId); const record: AuditLog = { ...log, id: id(), organization_id: organizationId, user_id: principal.id, user_name: principal.fullName, created_at: now() }; await this.insert(db, 'audit_logs', record as unknown as Record<string, unknown>); await this.queue(db, organizationId, 'audit_logs', record.id, 'INSERT', record as unknown as Record<string, unknown>); return record; }); }
}

export const sqliteRepository = new SQLiteRepository();
