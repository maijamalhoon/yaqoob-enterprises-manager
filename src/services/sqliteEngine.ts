import {
  DEFAULT_ORGANIZATION,
  STARTER_CATEGORIES,
  STARTER_PRODUCTS,
  STARTER_SERVICES,
  STARTER_PAYMENT_ACCOUNTS,
  STARTER_EXPENSE_CATEGORIES,
  STARTER_CUSTOMERS,
} from '../lib/mockData';

export interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T[]>;
}

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).__TAURI_METADATA__ !== undefined
  );
}

class InMemorySqliteDatabase implements SqlDatabase {
  private storageKey = 'yaqoob_sqlite_tables_v1';
  private tables: Record<string, any[]> = {};
  private transactionSnapshot: Record<string, any[]> | null = null;

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          this.tables = JSON.parse(raw);
          return;
        } catch {
          // ignore
        }
      }
    }
    this.tables = {};
  }

  private persist() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tables));
    }
  }

  async execute(query: string, bindValues: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const q = query.trim().toUpperCase();

    if (q.startsWith('BEGIN')) {
      this.transactionSnapshot = JSON.parse(JSON.stringify(this.tables));
      return { rowsAffected: 0, lastInsertId: 0 };
    }
    if (q.startsWith('COMMIT')) {
      this.transactionSnapshot = null;
      this.persist();
      return { rowsAffected: 0, lastInsertId: 0 };
    }
    if (q.startsWith('ROLLBACK')) {
      if (this.transactionSnapshot) this.tables = this.transactionSnapshot;
      this.transactionSnapshot = null;
      this.persist();
      return { rowsAffected: 0, lastInsertId: 0 };
    }

    // Table creation
    if (q.startsWith('CREATE TABLE')) {
      const match = query.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match) {
        const tbl = match[1].toLowerCase();
        if (!this.tables[tbl]) {
          this.tables[tbl] = [];
          this.persist();
        }
      }
      return { rowsAffected: 0, lastInsertId: 0 };
    }

    // Insert
    if (q.startsWith('INSERT INTO')) {
      const match = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const tbl = match[1].toLowerCase();
        const cols = match[2].split(',').map((c) => c.trim().toLowerCase());
        const valTokens = match[3].split(',').map((v) => v.trim());
        if (!this.tables[tbl]) this.tables[tbl] = [];

        const row: Record<string, any> = {};
        let bindIdx = 0;
        cols.forEach((col, idx) => {
          const token = valTokens[idx];
          if (token === '?') {
            row[col] = bindValues[bindIdx] !== undefined ? bindValues[bindIdx] : null;
            bindIdx++;
          } else if (token !== undefined) {
            if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
              row[col] = token.slice(1, -1);
            } else if (!isNaN(Number(token))) {
              row[col] = Number(token);
            } else {
              row[col] = token;
            }
          } else {
            row[col] = null;
          }
        });

        // If row with same id already exists, replace or ignore
        const existingIdx = row.id ? this.tables[tbl].findIndex((r) => r.id === row.id) : -1;
        if (existingIdx >= 0) {
          this.tables[tbl][existingIdx] = { ...this.tables[tbl][existingIdx], ...row };
        } else {
          this.tables[tbl].push(row);
        }

        this.persist();
        return { rowsAffected: 1, lastInsertId: this.tables[tbl].length };
      }
    }

    // Update
    if (q.startsWith('UPDATE')) {
      const match = query.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
      if (match) {
        const tbl = match[1].toLowerCase();
        if (this.tables[tbl]) {
          let updated = 0;
          this.tables[tbl] = this.tables[tbl].map((row) => {
            // Apply where clause check if present
            if (bindValues.length > 0) {
              const lastParam = bindValues[bindValues.length - 1];
              if (row.id === lastParam) {
                updated++;
                return { ...row, ...this.parseSetClause(match[2], bindValues) };
              }
            }
            return row;
          });
          this.persist();
          return { rowsAffected: updated, lastInsertId: 0 };
        }
      }
    }

    // Delete
    if (q.startsWith('DELETE FROM')) {
      const match = query.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?\s*;?$/i);
      if (match) {
        const tbl = match[1].toLowerCase();
        if (this.tables[tbl]) {
          const initialLen = this.tables[tbl].length;
          if (bindValues.length > 0) {
            const idVal = bindValues[bindValues.length - 1];
            this.tables[tbl] = this.tables[tbl].filter((r) => r.id !== idVal);
          } else {
            this.tables[tbl] = [];
          }
          this.persist();
          return { rowsAffected: initialLen - this.tables[tbl].length, lastInsertId: 0 };
        }
      }
    }

    return { rowsAffected: 0, lastInsertId: 0 };
  }

  private parseSetClause(setStr: string, params: unknown[]): Record<string, any> {
    const parts = setStr.split(',').map((p) => p.trim());
    const res: Record<string, any> = {};
    parts.forEach((part, i) => {
      const [col] = part.split('=').map((s) => s.trim().toLowerCase());
      if (col && params[i] !== undefined) {
        res[col] = params[i];
      }
    });
    return res;
  }

  async select<T = unknown>(query: string, bindValues: unknown[] = []): Promise<T[]> {
    const match = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!match) return [];
    const tbl = match[1].toLowerCase();
    const rows = this.tables[tbl] || [];

    let filtered = [...rows];

    // Filter WHERE status = 'pending'
    if (/WHERE\s+status\s*=\s*'pending'/i.test(query)) {
      filtered = filtered.filter((r) => r.status === 'pending');
    }

    // Parameterized equality conditions in query order.
    if (bindValues.length > 0) {
      const conditions = [...query.matchAll(/\b(record_id|organization_id|id|table_name|status)\s*=\s*\?/gi)];
      conditions.forEach((condition, index) => {
        const field = condition[1].toLowerCase();
        const value = bindValues[index];
        filtered = filtered.filter((row) => row[field] === value);
      });
    }

    // Sort if ORDER BY created_at DESC
    if (query.toUpperCase().includes('ORDER BY CREATED_AT DESC')) {
      filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }

    // Handle COUNT(*)
    if (/SELECT\s+COUNT\(\*\)\s+(?:as\s+count\s+)?FROM/i.test(query)) {
      return [{ count: filtered.length }] as T[];
    }

    return filtered as T[];
  }
}

let dbInstance: SqlDatabase | null = null;
let dbInitialization: Promise<SqlDatabase> | null = null;

export async function getSqliteDatabase(): Promise<SqlDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitialization) return dbInitialization;

  dbInitialization = (async () => {
    if (isTauriEnvironment()) {
      const DatabaseModule = await import('@tauri-apps/plugin-sql');
      const tauriDb = await DatabaseModule.default.load('sqlite:yaqoob_manager.db');
      dbInstance = tauriDb;
      await dbInstance.execute('PRAGMA busy_timeout = 15000;');
      await dbInstance.execute('PRAGMA foreign_keys = ON;');
      await runSqliteMigrations(dbInstance);
      return dbInstance;
    }

    dbInstance = new InMemorySqliteDatabase();
    await runSqliteMigrations(dbInstance);
    return dbInstance;
  })().catch((err) => {
    dbInstance = null;
    throw new Error(`SQLite database could not be opened: ${String(err)}`);
  }).finally(() => {
    dbInitialization = null;
  });

  return dbInitialization;
}

export async function initSqliteDatabase(): Promise<SqlDatabase> {
  return getSqliteDatabase();
}

export async function runSqliteMigrations(db: SqlDatabase): Promise<void> {
  // 1. Create migrations tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Check applied migrations
  const applied = await db.select<{ version: number }>('SELECT version FROM schema_migrations;');
  const appliedSet = new Set(applied.map((m) => m.version));

  // Migration 1: Initial schema
  if (!appliedSet.has(1)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        currency TEXT DEFAULT 'PKR',
        currency_symbol TEXT DEFAULT 'Rs.',
        country TEXT DEFAULT 'Pakistan',
        timezone TEXT DEFAULT 'Asia/Karachi',
        business_category TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        tax_rate REAL DEFAULT 0.0,
        tax_enabled INTEGER DEFAULT 0,
        receipt_footer TEXT,
        invoice_prefix TEXT DEFAULT 'YE-',
        next_invoice_number INTEGER DEFAULT 1001,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'OWNER',
        organization_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        avatar_url TEXT,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        color TEXT DEFAULT '#06B6D4',
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        category_id TEXT,
        category_name TEXT,
        unit TEXT NOT NULL DEFAULT 'Pcs',
        purchase_price REAL NOT NULL DEFAULT 0.0,
        selling_price REAL NOT NULL DEFAULT 0.0,
        opening_stock REAL NOT NULL DEFAULT 0.0,
        current_stock REAL NOT NULL DEFAULT 0.0,
        min_stock_threshold REAL NOT NULL DEFAULT 5.0,
        track_stock INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        supplier TEXT,
        notes TEXT,
        average_cost REAL NOT NULL DEFAULT 0.0,
        stock_value REAL NOT NULL DEFAULT 0.0,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        category_id TEXT,
        category_name TEXT,
        selling_price REAL NOT NULL DEFAULT 0.0,
        estimated_cost REAL NOT NULL DEFAULT 0.0,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS service_components (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity_consumed REAL NOT NULL DEFAULT 1.0,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        total_cost REAL NOT NULL DEFAULT 0.0,
        reference_id TEXT,
        reference_type TEXT,
        notes TEXT,
        created_by TEXT,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        total_purchases REAL DEFAULT 0.0,
        last_purchase_date TEXT,
        outstanding_balance REAL DEFAULT 0.0,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS payment_accounts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        account_number TEXT,
        current_balance REAL NOT NULL DEFAULT 0.0,
        opening_balance REAL NOT NULL DEFAULT 0.0,
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS account_transfers (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        from_account_id TEXT NOT NULL,
        from_account_name TEXT NOT NULL,
        to_account_id TEXT NOT NULL,
        to_account_name TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS account_transactions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id TEXT,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        category_name TEXT NOT NULL,
        amount REAL NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        description TEXT NOT NULL,
        reference_number TEXT,
        date TEXT NOT NULL,
        notes TEXT,
        entered_by TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        cashier_id TEXT NOT NULL,
        cashier_name TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0.0,
        discount REAL NOT NULL DEFAULT 0.0,
        tax_amount REAL NOT NULL DEFAULT 0.0,
        grand_total REAL NOT NULL DEFAULT 0.0,
        amount_paid REAL NOT NULL DEFAULT 0.0,
        change_due REAL NOT NULL DEFAULT 0.0,
        payment_method TEXT NOT NULL,
        split_payments TEXT,
        total_cogs REAL NOT NULL DEFAULT 0.0,
        gross_profit REAL NOT NULL DEFAULT 0.0,
        status TEXT DEFAULT 'COMPLETED',
        notes TEXT,
        void_reason TEXT,
        voided_by TEXT,
        voided_at TEXT,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        sale_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        sku TEXT,
        unit TEXT,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        discount REAL NOT NULL DEFAULT 0.0,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        cogs REAL NOT NULL DEFAULT 0.0,
        gross_profit REAL NOT NULL DEFAULT 0.0,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS daily_closings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        closing_date TEXT NOT NULL,
        opening_cash REAL NOT NULL,
        cash_sales REAL NOT NULL,
        cash_expenses REAL NOT NULL,
        cash_transfers_in REAL NOT NULL DEFAULT 0.0,
        cash_transfers_out REAL NOT NULL DEFAULT 0.0,
        expected_cash REAL NOT NULL,
        actual_cash REAL NOT NULL,
        difference REAL NOT NULL,
        notes TEXT,
        closed_by TEXT NOT NULL,
        closed_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        metadata TEXT,
        sync_status TEXT DEFAULT 'pending_insert',
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        records_pushed INTEGER DEFAULT 0,
        records_pulled INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_cursors (
        table_name TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_closings_org_date
      ON daily_closings(organization_id, closing_date);
    `);

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_org_invoice
      ON sales(organization_id, invoice_number);
    `);

    // Record migration 1
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [1, 'initial_schema_v1', new Date().toISOString()]
    );
  }

  if (!appliedSet.has(2)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_cursors (
        table_name TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_closings_org_date
      ON daily_closings(organization_id, closing_date);
    `);
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_org_invoice
      ON sales(organization_id, invoice_number);
    `);
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [2, 'integrity_indexes_and_sync_cursors', new Date().toISOString()]
    );
  }

  if (!appliedSet.has(3)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, user_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_members_org_user ON organization_members(organization_id, user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_org_created ON sales(organization_id, created_at);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(organization_id, date);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_movements_org_product ON stock_movements(organization_id, product_id);`);
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [3, 'organization_members_and_business_indexes', new Date().toISOString()]
    );
  }

  if (!appliedSet.has(4)) {
    await db.execute(`ALTER TABLE profiles ADD COLUMN password_hash TEXT;`);
    const syncQueueColumns = await db.select<{ name: string }>(`PRAGMA table_info(sync_queue);`);
    if (!syncQueueColumns.some((column) => column.name === 'organization_id')) {
      await db.execute(`ALTER TABLE sync_queue ADD COLUMN organization_id TEXT;`);
    }
    await db.execute(`ALTER TABLE sync_queue ADD COLUMN conflict_state TEXT;`);
    await db.execute(`ALTER TABLE sync_queue ADD COLUMN deleted_at TEXT;`);
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [4, 'session_and_sync_integrity_metadata', new Date().toISOString()]
    );
  }

  if (!appliedSet.has(5)) {
    await db.execute(`ALTER TABLE sync_cursors ADD COLUMN organization_id TEXT;`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sync_cursors_org_table ON sync_cursors(organization_id, table_name);`);
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [5, 'organization_scoped_sync_cursors', new Date().toISOString()]
    );
  }

  if (!appliedSet.has(6)) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS local_auth_accounts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id),
        UNIQUE (profile_id)
      );
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_local_auth_org ON local_auth_accounts(organization_id);`);
    await db.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
      [6, 'local_offline_auth_accounts', new Date().toISOString()]
    );
  }
}
