import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { getSqliteDatabase } from './sqliteEngine';

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

class SyncEngineService {
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private syncInterval: any = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      this.lastSyncTime = localStorage.getItem('yaqoob_last_sync_time');
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
      pendingCount: 0,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  private handleNetworkChange(online: boolean) {
    this.notify();
    if (online) {
      this.syncNow();
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
    try {
      const db = await getSqliteDatabase();
      const id = `sq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nowIso = new Date().toISOString();

      await db.execute(
        `INSERT INTO sync_queue (id, table_name, record_id, operation, payload, attempts, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tableName, recordId, operation, JSON.stringify(payload), 0, 'pending', nowIso, nowIso]
      );

      this.notify();

      // If online, immediately trigger a background drain
      if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
        this.syncNow().catch(() => {});
      }
    } catch (err) {
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

    try {
      const db = await getSqliteDatabase();
      const queue = await db.select<{
        id: string;
        table_name: string;
        record_id: string;
        operation: string;
        payload: string;
        attempts: number;
      }>(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC;`);

      // 1. PUSH QUEUE
      for (const item of queue) {
        try {
          const payload = JSON.parse(item.payload);
          // Delete sync metadata from payload before pushing to cloud
          const cleanPayload = { ...payload };
          delete cleanPayload.sync_status;

          if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
            const { error: upsertErr } = await supabase
              .from(item.table_name)
              .upsert(cleanPayload, { onConflict: 'id' });

            if (upsertErr) throw upsertErr;
          } else if (item.operation === 'DELETE') {
            const { error: delErr } = await supabase
              .from(item.table_name)
              .delete()
              .eq('id', item.record_id);

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
          await db.execute(
            `UPDATE sync_queue SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`,
            [errMsg, new Date().toISOString(), item.id]
          );
        }
      }

      this.lastSyncTime = new Date().toISOString();
      if (typeof window !== 'undefined') {
        localStorage.setItem('yaqoob_last_sync_time', this.lastSyncTime);
      }

      // Log sync execution
      await db.execute(
        `INSERT INTO sync_logs (id, sync_type, status, records_pushed, records_pulled, created_at)
         VALUES (?, 'BIDIRECTIONAL', 'SUCCESS', ?, ?, ?)`,
        [`slog-${Date.now()}`, pushed, pulled, this.lastSyncTime]
      );
    } catch (err: any) {
      this.lastError = err?.message || 'Sync failed';
      console.warn('Sync engine exception:', err);
    } finally {
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
      return {
        pendingCount: pending[0]?.count || 0,
        logs: logs.slice(0, 20),
      };
    } catch {
      return { pendingCount: 0, logs: [] };
    }
  }
}

export const syncEngine = new SyncEngineService();
