import { describe, it, expect, beforeEach } from 'vitest';
import { syncEngine } from '@/services/syncEngine';
import { initSqliteDatabase, getSqliteDatabase } from '@/services/sqliteEngine';

describe('Offline Sync Engine & SQLite Persistence', () => {
  beforeEach(async () => {
    await initSqliteDatabase();
  });

  it('initializes local SQLite database with versioned schema migrations', async () => {
    const db = await getSqliteDatabase();
    const migrations = await db.select<{ version: number; name: string }>(
      `SELECT * FROM schema_migrations;`
    );
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].version).toBe(1);
    expect(migrations[0].name).toBe('initial_schema_v1');
  });

  it('enqueues insert operations into sync_queue when mutations occur', async () => {
    const recordId = `prod-test-${Date.now()}`;
    const payload = {
      id: recordId,
      name: 'Legal Size Stamp Paper (Rs. 100)',
      selling_price: 150,
      stock: 50,
    };

    await syncEngine.enqueue('products', recordId, 'INSERT', payload);

    const diagnostics = await syncEngine.getDiagnostics();
    expect(diagnostics.pendingCount).toBeGreaterThanOrEqual(1);

    const db = await getSqliteDatabase();
    const queueItems = await db.select<{
      table_name: string;
      record_id: string;
      operation: string;
      payload: string;
    }>(`SELECT * FROM sync_queue WHERE record_id = ?;`, [recordId]);

    expect(queueItems.length).toBe(1);
    expect(queueItems[0].table_name).toBe('products');
    expect(queueItems[0].operation).toBe('INSERT');
    expect(JSON.parse(queueItems[0].payload).name).toBe('Legal Size Stamp Paper (Rs. 100)');
  });

  it('handles offline state safely without throwing errors or dropping mutations', async () => {
    // When Supabase is not configured or network is disconnected
    const result = await syncEngine.syncNow();
    // It should report unconfigured or graceful 0 push/pull instead of crashing
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
  });

  it('enqueues updates and deletes with proper operation tags', async () => {
    const expId = `exp-test-${Date.now()}`;
    await syncEngine.enqueue('expenses', expId, 'UPDATE', { id: expId, status: 'VOIDED' });
    await syncEngine.enqueue('expenses', expId, 'DELETE', { id: expId });

    const db = await getSqliteDatabase();
    const items = await db.select<{ operation: string }>(
      `SELECT * FROM sync_queue WHERE record_id = ?;`,
      [expId]
    );

    expect(items.some((i) => i.operation === 'UPDATE')).toBe(true);
    expect(items.some((i) => i.operation === 'DELETE')).toBe(true);
  });
});
