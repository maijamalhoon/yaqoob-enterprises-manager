import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncEngine, sanitizePayloadForCloud } from '@/services/syncEngine';
import { initSqliteDatabase, getSqliteDatabase } from '@/services/sqliteEngine';
import { setSecurityPrincipal } from '@/lib/security';
import * as supabaseLib from '@/lib/supabase';

describe('Offline Sync Engine & SQLite Persistence', () => {
  const testOrgId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

  beforeEach(async () => {
    await initSqliteDatabase();
    const db = await getSqliteDatabase();
    await db.execute(`DELETE FROM sync_queue;`);
    await db.execute(`DELETE FROM sync_logs;`);
    setSecurityPrincipal({
      id: 'owner-test-1',
      email: 'owner@test.local',
      fullName: 'Owner Test',
      role: 'OWNER',
      organizationId: testOrgId,
    });
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

  it('enqueues insert operations into sync_queue with organization_id', async () => {
    const recordId = `prod-test-${Date.now()}`;
    const payload = {
      id: recordId,
      organization_id: testOrgId,
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
      organization_id: string;
      operation: string;
      payload: string;
    }>(`SELECT * FROM sync_queue WHERE record_id = ?;`, [recordId]);

    expect(queueItems.length).toBe(1);
    expect(queueItems[0].table_name).toBe('products');
    expect(queueItems[0].organization_id).toBe(testOrgId);
    expect(queueItems[0].operation).toBe('INSERT');
    expect(JSON.parse(queueItems[0].payload).name).toBe('Legal Size Stamp Paper (Rs. 100)');
  });

  it('sanitizes payloads by stripping denormalized and disallowed columns for Cloud PostgreSQL', () => {
    // 1. Sales: items and sync_status must be stripped
    const rawSale = {
      id: 'sale-1',
      organization_id: testOrgId,
      invoice_number: 'YE-1001',
      subtotal: 500,
      items: [{ item_id: 'prod-1', quantity: 2 }],
      sync_status: 'pending',
    };
    const cleanSale = sanitizePayloadForCloud('sales', rawSale as any);
    expect(cleanSale.invoice_number).toBe('YE-1001');
    expect('items' in cleanSale).toBe(false);
    expect('sync_status' in cleanSale).toBe(false);

    // 2. Expenses: category_name and account_name must be stripped
    const rawExpense = {
      id: 'exp-1',
      organization_id: testOrgId,
      category_id: 'cat-1',
      category_name: 'Tea & Refreshment',
      account_id: 'acc-1',
      account_name: 'Cash Drawer',
      amount: 120,
      description: 'Tea',
      date: '2026-09-20',
      entered_by: 'Ali',
    };
    const cleanExpense = sanitizePayloadForCloud('expenses', rawExpense as any);
    expect(cleanExpense.amount).toBe(120);
    expect('category_name' in cleanExpense).toBe(false);
    expect('account_name' in cleanExpense).toBe(false);

    // 3. Services: components must be stripped
    const rawService = {
      id: 'srv-1',
      organization_id: testOrgId,
      name: 'Photocopy',
      components: [{ product_id: 'paper-1' }],
    };
    const cleanService = sanitizePayloadForCloud('services', rawService as any);
    expect(cleanService.name).toBe('Photocopy');
    expect('components' in cleanService).toBe(false);
  });

  it('handles unconfigured cloud gracefully without throwing errors or dropping mutations', async () => {
    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(false);
    const result = await syncEngine.syncNow();
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
    expect(result.error).toBe('Cloud Supabase is not configured');
  });

  it('enqueues updates and deletes with proper operation tags', async () => {
    const expId = `exp-test-${Date.now()}`;
    await syncEngine.enqueue('expenses', expId, 'UPDATE', { id: expId, organization_id: testOrgId, status: 'VOIDED' });
    await syncEngine.enqueue('expenses', expId, 'DELETE', { id: expId, organization_id: testOrgId });

    const db = await getSqliteDatabase();
    const items = await db.select<{ operation: string }>(
      `SELECT * FROM sync_queue WHERE record_id = ?;`,
      [expId]
    );

    expect(items.some((i) => i.operation === 'UPDATE')).toBe(true);
    expect(items.some((i) => i.operation === 'DELETE')).toBe(true);
  });

  it('drains queued records upon reconnect and verifies idempotent upsert', async () => {
    // 1. Enqueue 2 items offline
    const prodId = `prod-sync-${Date.now()}`;
    await syncEngine.enqueue('products', prodId, 'INSERT', {
      id: prodId,
      organization_id: testOrgId,
      name: 'Legal Paper',
      selling_price: 100,
    });

    // 2. Mock Supabase client
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gt: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((_table: string) => ({
        upsert: upsertSpy,
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        select: selectSpy,
      })),
    } as any;

    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockSupabase);

    // 3. Trigger syncNow
    const syncRes = await syncEngine.syncNow();
    expect(syncRes.pushed).toBe(1);
    expect(syncRes.error).toBeUndefined();
    expect(upsertSpy).toHaveBeenCalled();

    // 4. Queue should now be drained (0 pending)
    const db = await getSqliteDatabase();
    const remaining = await db.select<{ id: string }>(
      `SELECT * FROM sync_queue WHERE status = 'pending';`
    );
    expect(remaining.length).toBe(0);

    // 5. Subsequent sync attempt is idempotent
    const repeatRes = await syncEngine.syncNow();
    expect(repeatRes.pushed).toBe(0);
  });

  it('surfaces swallowed push errors to lastError and logs FAILED status', async () => {
    const failId = `prod-fail-${Date.now()}`;
    await syncEngine.enqueue('products', failId, 'INSERT', {
      id: failId,
      organization_id: testOrgId,
      name: 'Failing Item',
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: { message: 'new row violates row-level security policy for table "products"' },
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })),
    } as any;

    vi.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(mockSupabase);

    const result = await syncEngine.syncNow();
    expect(result.pushed).toBe(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('violates row-level security');

    const status = syncEngine.getStatus();
    expect(status.lastError).toContain('violates row-level security');

    // Confirm error was recorded in sync_logs with non-SUCCESS status
    const db = await getSqliteDatabase();
    const logs = await db.select<{ status: string; error_message: string }>(
      `SELECT status, error_message FROM sync_logs ORDER BY created_at DESC LIMIT 1;`
    );
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('FAILED');
    expect(logs[0].error_message).toContain('violates row-level security');
  });
});
