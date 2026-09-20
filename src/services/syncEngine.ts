import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getSqliteDatabase, SqlDatabase } from './sqliteEngine';
import { getSecurityPrincipal } from '../lib/security';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

export interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  records_pushed: number;
  records_pulled: number;
  error_message?: string;
  created_at: string;
}

export const TABLE_ALLOWED_COLUMNS: Record<string, string[]> = {
  organizations: [
    'id', 'name', 'owner_name', 'currency', 'currency_symbol', 'country', 'timezone',
    'business_category', 'phone', 'email', 'address', 'tax_rate', 'tax_enabled',
    'receipt_footer', 'invoice_prefix', 'next_invoice_number', 'created_at', 'updated_at'
  ],
  profiles: [
    'id', 'email', 'full_name', 'role', 'organization_id', 'is_active', 'created_at', 'updated_at'
  ],
  categories: [
    'id', 'organization_id', 'name', 'type', 'color', 'created_at', 'updated_at'
  ],
  products: [
    'id', 'organization_id', 'category_id', 'name', 'sku', 'unit', 'purchase_price',
    'selling_price', 'opening_stock', 'current_stock', 'min_stock_threshold', 'track_stock',
    'is_active', 'supplier', 'notes', 'average_cost', 'stock_value', 'created_at', 'updated_at'
  ],
  services: [
    'id', 'organization_id', 'category_id', 'name', 'sku', 'selling_price',
    'estimated_cost', 'is_active', 'notes', 'created_at', 'updated_at'
  ],
  service_components: [
    'id', 'organization_id', 'service_id', 'product_id', 'quantity_consumed', 'created_at'
  ],
  stock_movements: [
    'id', 'organization_id', 'product_id', 'movement_type', 'quantity', 'unit_cost',
    'total_cost', 'reference_id', 'reference_type', 'notes', 'created_by', 'created_at'
  ],
  customers: [
    'id', 'organization_id', 'name', 'phone', 'email', 'address', 'notes',
    'total_purchases', 'last_purchase_date', 'outstanding_balance', 'created_at', 'updated_at'
  ],
  payment_accounts: [
    'id', 'organization_id', 'name', 'type', 'account_number', 'current_balance',
    'opening_balance', 'is_active', 'is_default', 'created_at', 'updated_at'
  ],
  account_transfers: [
    'id', 'organization_id', 'from_account_id', 'to_account_id', 'amount', 'date',
    'notes', 'created_by', 'created_at'
  ],
  account_transactions: [
    'id', 'organization_id', 'account_id', 'type', 'amount', 'balance_after',
    'reference_type', 'reference_id', 'description', 'date', 'created_at'
  ],
  expense_categories: [
    'id', 'organization_id', 'name', 'description', 'is_active', 'created_at'
  ],
  expenses: [
    'id', 'organization_id', 'category_id', 'account_id', 'amount', 'description',
    'reference_number', 'date', 'notes', 'entered_by', 'status', 'created_at'
  ],
  sales: [
    'id', 'organization_id', 'invoice_number', 'customer_id', 'customer_name',
    'customer_phone', 'cashier_id', 'cashier_name', 'subtotal', 'discount',
    'tax_amount', 'grand_total', 'amount_paid', 'change_due', 'payment_method',
    'split_payments', 'total_cogs', 'gross_profit', 'status', 'notes',
    'void_reason', 'voided_by', 'voided_at', 'created_at'
  ],
  sale_items: [
    'id', 'organization_id', 'sale_id', 'item_type', 'item_id', 'item_name',
    'sku', 'unit', 'quantity', 'unit_price', 'unit_cost', 'discount',
    'subtotal', 'total', 'cogs', 'gross_profit', 'created_at'
  ],
  daily_closings: [
    'id', 'organization_id', 'closing_date', 'opening_cash', 'cash_sales',
    'cash_expenses', 'cash_transfers_in', 'cash_transfers_out', 'expected_cash',
    'actual_cash', 'difference', 'notes', 'closed_by', 'closed_at', 'created_at'
  ],
  audit_logs: [
    'id', 'organization_id', 'user_id', 'user_name', 'action', 'entity',
    'entity_id', 'details', 'metadata', 'created_at'
  ],
};

export function sanitizePayloadForCloud(tableName: string, payload: Record<string, unknown>): Record<string, unknown> {
  const allowed = TABLE_ALLOWED_COLUMNS[tableName];
  if (!allowed) {
    const clean = { ...payload };
    delete clean.sync_status;
    return clean;
  }
  const result: Record<string, unknown> = {};
  for (const col of allowed) {
    if (payload[col] !== undefined) {
      result[col] = payload[col];
    }
  }
  return result;
}

class SyncEngineService {
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private pendingCount = 0;
  private syncInterval: any = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      this.lastSyncTime = localStorage.getItem('yaqoob_last_sync_time');
      this.refreshPendingCount().catch(() => {});
      this.startBackgroundSync();
    }
  }

  public subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  public getStatus(): SyncStatus {
    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const db = await getSqliteDatabase();
      const rows = await db.select<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';`
      );
      this.pendingCount = rows[0]?.count ?? 0;
      this.notify();
      return this.pendingCount;
    } catch {
      return this.pendingCount;
    }
  }

  private handleNetworkChange(online: boolean) {
    this.notify();
    if (online) {
      this.syncNow().catch(() => {});
    }
  }

  public startBackgroundSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    // Automatically attempt sync every 30 seconds if online
    this.syncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
        this.syncNow().catch(() => {});
      }
    }, 30000);
  }

  public async enqueue(
    tableName: string,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown>
  ): Promise<void> {
    this.pendingCount += 1;
    this.notify();
    try {
      const db = await getSqliteDatabase();
      const id = `sq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nowIso = new Date().toISOString();
      const orgId =
        (payload.organization_id as string) ||
        getSecurityPrincipal()?.organizationId ||
        'org-yaqoob-001';

      await db.execute(
        `INSERT INTO sync_queue (id, organization_id, table_name, record_id, operation, payload, attempts, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, orgId, tableName, recordId, operation, JSON.stringify(payload), 0, 'pending', nowIso, nowIso]
      );

      await this.refreshPendingCount();
    } catch (err) {
      await this.refreshPendingCount();
      console.warn('Could not enqueue sync record:', err);
    }
  }

  public async syncNow(): Promise<{ pushed: number; pulled: number; error?: string }> {
    if (this.isSyncing) return { pushed: 0, pulled: 0 };
    if (!isSupabaseConfigured()) {
      return { pushed: 0, pulled: 0, error: 'Cloud Supabase is not configured' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { pushed: 0, pulled: 0, error: 'Supabase client unavailable' };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    let pushed = 0;
    let pulled = 0;
    const pushErrors: string[] = [];
    let db: SqlDatabase | null = null;
    let syncLogWritten = false;

    try {
      db = await getSqliteDatabase();
      const principal = getSecurityPrincipal();
      if (!principal) throw new Error('Authentication required before synchronization');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(principal.organizationId)) {
        throw new Error('Cloud synchronization requires a UUID-backed organization');
      }

      const queue = await db.select<{
        id: string;
        organization_id?: string;
        table_name: string;
        record_id: string;
        operation: string;
        payload: string;
        attempts: number;
      }>(`SELECT * FROM sync_queue WHERE status = 'pending' AND (organization_id = ? OR organization_id IS NULL) ORDER BY created_at ASC;`, [principal.organizationId]);

      // 1. PUSH QUEUE
      for (const item of queue) {
        try {
          const payload = JSON.parse(item.payload);
          if (payload.organization_id && payload.organization_id !== principal.organizationId) {
            throw new Error('Sync payload organization does not match authenticated session');
          }

          // Strip non-table properties and ensure valid payload
          const cleanPayload = sanitizePayloadForCloud(item.table_name, payload);
          cleanPayload.organization_id = principal.organizationId;

          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            const { error: upsertErr } = await supabase
              .from(item.table_name)
              .upsert(cleanPayload, { onConflict: 'id' });

            if (upsertErr) throw upsertErr;
          } else if (item.operation === 'DELETE') {
            const { error: delErr } = await supabase
              .from(item.table_name)
              .delete()
              .eq('id', item.record_id)
              .eq('organization_id', principal.organizationId);

            if (delErr) throw delErr;
          }

          // Mark queue item as synced
          await db.execute(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);

          // Update local record sync_status = 'synced'
          try {
            await db.execute(
              `UPDATE ${item.table_name} SET sync_status = 'synced' WHERE id = ?`,
              [item.record_id]
            );
          } catch {
            // ignore
          }

          pushed++;
        } catch (itemErr: any) {
          const errMsg = itemErr?.message || 'Push failed';
          pushErrors.push(`${item.table_name}/${item.record_id}: ${errMsg}`);
          await db.execute(
            `UPDATE sync_queue SET attempts = attempts + 1, status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
            [item.attempts + 1 >= 8 ? 'failed' : 'pending', errMsg, new Date().toISOString(), item.id]
          );
        }
      }

      // If any items failed to push, capture the error so it surfaces in header
      if (pushErrors.length > 0) {
        this.lastError = `Failed to sync ${pushErrors.length} record(s): ${pushErrors[0]}`;
      }

      // 2. PULL REMOTE CHANGES without overwriting local pending records.
      const pullTables = [
        'profiles', 'categories', 'products', 'services', 'service_components',
        'stock_movements', 'customers', 'payment_accounts', 'account_transfers',
        'account_transactions', 'expense_categories', 'expenses', 'sales', 'sale_items',
        'daily_closings', 'audit_logs',
      ];
      for (const tableName of pullTables) {
        const timestampColumn = ['profiles', 'products', 'services'].includes(tableName)
          ? 'updated_at'
          : 'created_at';
        const cursorRows = await db.select<{ cursor: string }>(
          `SELECT cursor FROM sync_cursors WHERE table_name = ? AND organization_id = ?`,
          [tableName, principal.organizationId]
        );
        const cursor = cursorRows[0]?.cursor || '1970-01-01T00:00:00.000Z';
        const { data, error: pullError } = await supabase
          .from(tableName)
          .select('*')
          .eq('organization_id', principal.organizationId)
          .gt(timestampColumn, cursor)
          .order(timestampColumn, { ascending: true });
        if (pullError) throw pullError;
        let latestCursor = cursor;
        for (const record of data || []) {
          if (record.organization_id !== principal.organizationId) {
            throw new Error(`Remote ${tableName} record failed organization validation`);
          }
          const conflict = queue.some(
            (item) => item.table_name === tableName && item.record_id === record.id
          );
          if (conflict) {
            await db.execute(
              `INSERT INTO sync_logs (id, sync_type, status, records_pushed, records_pulled, error_message, created_at)
               VALUES (?, 'CONFLICT', 'PENDING_REVIEW', 0, 0, ?, ?)`,
              [`conflict-${Date.now()}-${record.id}`, `Local pending change preserved for ${tableName}/${record.id}`, new Date().toISOString()]
            );
            continue;
          }
          const columns = Object.keys(record).filter((column) => column !== 'sync_status');
          const values = columns.map((column) => {
            const value = record[column];
            return value && typeof value === 'object' ? JSON.stringify(value) : value;
          });
          const updateColumns = columns.filter((column) => column !== 'id');
          await db.execute(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
             ON CONFLICT(id) DO UPDATE SET ${updateColumns.map((column) => `${column} = excluded.${column}`).join(', ')}`,
            values
          );
          pulled += 1;
          latestCursor = record[timestampColumn] || latestCursor;
        }
        if (latestCursor !== cursor) {
          await db.execute(`DELETE FROM sync_cursors WHERE table_name = ? AND organization_id = ?`, [tableName, principal.organizationId]);
          await db.execute(
            `INSERT INTO sync_cursors (table_name, organization_id, cursor, updated_at) VALUES (?, ?, ?, ?)`,
            [tableName, principal.organizationId, latestCursor, new Date().toISOString()]
          );
        }
      }

      const syncTime = new Date().toISOString();
      const finalStatus = pushErrors.length === 0 ? 'SUCCESS' : pushed > 0 ? 'PARTIAL_ERROR' : 'FAILED';

      // Only stamp lastSyncTime if no complete failure occurred
      if (pushErrors.length === 0 || pushed > 0) {
        this.lastSyncTime = syncTime;
        if (typeof window !== 'undefined') {
          localStorage.setItem('yaqoob_last_sync_time', this.lastSyncTime);
        }
      }

      // Log sync execution
      await db.execute(
        `INSERT INTO sync_logs (id, sync_type, status, records_pushed, records_pulled, error_message, created_at)
         VALUES (?, 'BIDIRECTIONAL', ?, ?, ?, ?, ?)`,
        [`slog-${Date.now()}`, finalStatus, pushed, pulled, this.lastError || null, syncTime]
      );
      syncLogWritten = true;
    } catch (err: any) {
      this.lastError = err?.message || 'Sync failed';
      console.warn('Sync engine exception:', err);
      if (db && !syncLogWritten) {
        try {
          await db.execute(
            `INSERT INTO sync_logs (id, sync_type, status, records_pushed, records_pulled, error_message, created_at)
             VALUES (?, 'BIDIRECTIONAL', 'FAILED', ?, ?, ?, ?)`,
            [`slog-${Date.now()}`, pushed, pulled, this.lastError, new Date().toISOString()]
          );
        } catch {
          // Preserve the original sync error when diagnostics logging also fails.
        }
      }
    } finally {
      await this.refreshPendingCount();
      this.isSyncing = false;
      this.notify();
    }

    return { pushed, pulled, error: this.lastError || undefined };
  }

  public async getDiagnostics() {
    try {
      const db = await getSqliteDatabase();
      const pending = await db.select<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';`
      );
      const logs = await db.select<SyncLogEntry>(
        `SELECT * FROM sync_logs ORDER BY created_at DESC;`
      );
      this.pendingCount = pending[0]?.count ?? 0;
      return {
        pendingCount: this.pendingCount,
        logs: logs.slice(0, 20),
      };
    } catch {
      return { pendingCount: 0, logs: [] };
    }
  }
}

export const syncEngine = new SyncEngineService();
