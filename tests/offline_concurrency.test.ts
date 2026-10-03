// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  dequeueOfflineTransaction,
} from '../src/services/offlineQueue';

describe('Phase 5: Offline, Multi-Device Concurrency & Backup Restore Suite', () => {
  let db: PGlite;
  const ownerId = '11111111-1111-1111-1111-111111111111';
  const catPrinting = 'c1000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
          '11111111-1111-1111-1111-111111111111'::uuid
        );
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.role', true), ''),
          'authenticated'
        );
      $$ LANGUAGE sql STABLE;

      DO $$ BEGIN
        CREATE ROLE anon;
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE ROLE authenticated;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261004000000_shop_ledger_foundation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(sql);

    await db.query(`
      INSERT INTO shop_members (user_id, full_name, email)
      VALUES ('${ownerId}', 'Shop Owner', 'owner@yaqoob.local')
      ON CONFLICT (user_id) DO NOTHING;
    `);
  });

  describe('1. Two Devices Entering at Once (Concurrency)', () => {
    it('handles concurrent entries from Device 1 and Device 2 without collision or data loss', async () => {
      // Simulate two brother devices submitting transactions at the exact same millisecond
      const device1Promise = db.query(`
        INSERT INTO transactions (
          id, type, amount_paisa, category_id, business_date, device_entry_time,
          raw_text, status, idempotency_key, created_by, created_by_name, device
        ) VALUES (
          'd1000000-0000-0000-0000-000000000001', 'income', 30000, '${catPrinting}', '2026-10-04',
          '2026-10-04T12:00:00.123Z', 'PRINT 300', 'active', 'idemp-dev1-001', '${ownerId}', 'Brother 1', 'Mobile Android'
        );
      `);

      const device2Promise = db.query(`
        INSERT INTO transactions (
          id, type, amount_paisa, category_id, business_date, device_entry_time,
          raw_text, status, idempotency_key, created_by, created_by_name, device
        ) VALUES (
          'd2000000-0000-0000-0000-000000000002', 'income', 45000, '${catPrinting}', '2026-10-04',
          '2026-10-04T12:00:00.124Z', 'PRINT 450', 'active', 'idemp-dev2-001', '${ownerId}', 'Brother 2', 'PC Chrome'
        );
      `);

      await Promise.all([device1Promise, device2Promise]);

      const res = await db.query(`SELECT * FROM transactions WHERE idempotency_key IN ('idemp-dev1-001', 'idemp-dev2-001')`);
      expect(res.rows).toHaveLength(2);

      const sumRes = await db.query(`SELECT SUM(amount_paisa) as total FROM transactions WHERE idempotency_key IN ('idemp-dev1-001', 'idemp-dev2-001')`);
      expect(Number(sumRes.rows[0].total)).toBe(75000); // 30,000 + 45,000
    });
  });

  describe('2. Flaky Connection & Idempotent Retry', () => {
    it('enqueues offline transactions and deduplicates repeated retries on reconnect', async () => {
      const idempotencyKey = 'idemp-flaky-retry-099';

      // 1. Enqueue while disconnected
      await enqueueOfflineTransaction({
        id: 'f1000000-0000-0000-0000-000000000001',
        idempotencyKey,
        type: 'income',
        amountPaisa: 50000,
        categoryId: catPrinting,
        businessDate: '2026-10-04',
        deviceEntryTime: '2026-10-04T12:05:00Z',
        rawText: 'PRINT 500',
        createdByName: 'Brother 1',
        status: 'queued',
        attempts: 0,
        createdAt: Date.now(),
      });

      const queueBefore = await getOfflineQueue();
      const queuedItem = queueBefore.find((i) => i.idempotencyKey === idempotencyKey);
      expect(queuedItem).toBeDefined();

      // 2. Simulate flushes with network retry: First insertion
      await db.query(`
        INSERT INTO transactions (
          id, type, amount_paisa, category_id, business_date, device_entry_time,
          raw_text, status, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${queuedItem?.id}', 'income', 50000, '${catPrinting}', '2026-10-04',
          '${queuedItem?.deviceEntryTime}', 'PRINT 500', 'active', '${idempotencyKey}', '${ownerId}', 'Brother 1'
        ) ON CONFLICT (idempotency_key) DO NOTHING;
      `);

      // 3. Second flush attempt (simulating flaky network double-send)
      await db.query(`
        INSERT INTO transactions (
          id, type, amount_paisa, category_id, business_date, device_entry_time,
          raw_text, status, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${queuedItem?.id}', 'income', 50000, '${catPrinting}', '2026-10-04',
          '${queuedItem?.deviceEntryTime}', 'PRINT 500', 'active', '${idempotencyKey}', '${ownerId}', 'Brother 1'
        ) ON CONFLICT (idempotency_key) DO NOTHING;
      `);

      // Verify exactly one row exists in DB
      const dbRows = await db.query(`SELECT * FROM transactions WHERE idempotency_key = '${idempotencyKey}'`);
      expect(dbRows.rows).toHaveLength(1);

      // Dequeue after confirmed sync
      await dequeueOfflineTransaction(idempotencyKey);
      const queueAfter = await getOfflineQueue();
      expect(queueAfter.find((i) => i.idempotencyKey === idempotencyKey)).toBeUndefined();
    });
  });

  describe('3. Backup & Restore into EMPTY Database Verification', () => {
    it('exports all transactions and restores into a clean database with identical totals', async () => {
      // 1. Export all transactions from current DB
      const dumpRes = await db.query(`
        SELECT id, type, amount_paisa, category_id, adjustment_dir, note, business_date, device_entry_time, raw_text, status, void_reason, voided_by, voided_at, idempotency_key, created_by, created_by_name, device, created_at, updated_at
        FROM transactions
      `);
      const originalRows = dumpRes.rows;
      expect(originalRows.length).toBeGreaterThan(0);

      const originalTotalPaisa = originalRows.reduce((acc, r: any) => acc + Number(r.amount_paisa), 0);

      // 2. Spin up a brand new EMPTY database
      const emptyDb = new PGlite();

      // Setup auth and roles
      await emptyDb.exec(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid, '${ownerId}'::uuid);
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
          SELECT 'authenticated';
        $$ LANGUAGE sql STABLE;

        DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      // Run fresh migration
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261004000000_shop_ledger_foundation.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await emptyDb.exec(sql);

      // Ensure membership in restored DB
      await emptyDb.query(`
        INSERT INTO shop_members (user_id, full_name, email)
        VALUES ('${ownerId}', 'Shop Owner', 'owner@yaqoob.local');
      `);

      // 3. Restore dump rows into empty DB
      for (const row of originalRows as any[]) {
        const bDate = row.business_date instanceof Date
          ? row.business_date.toISOString().slice(0, 10)
          : String(row.business_date).slice(0, 10);

        const entryTime = row.device_entry_time instanceof Date 
          ? row.device_entry_time.toISOString() 
          : new Date(row.device_entry_time).toISOString();

        const voidedAt = row.voided_at
          ? (row.voided_at instanceof Date ? row.voided_at.toISOString() : new Date(row.voided_at).toISOString())
          : null;

        await emptyDb.query(`
          INSERT INTO transactions (
            id, type, amount_paisa, category_id, adjustment_dir, note, business_date,
            device_entry_time, raw_text, status, void_reason, voided_by, voided_at,
            idempotency_key, created_by, created_by_name, device
          ) VALUES (
            '${row.id}', '${row.type}', ${row.amount_paisa}, ${row.category_id ? `'${row.category_id}'` : 'NULL'},
            ${row.adjustment_dir ? `'${row.adjustment_dir}'` : 'NULL'}, ${row.note ? `'${row.note}'` : 'NULL'},
            '${bDate}', '${entryTime}', '${row.raw_text.replace(/'/g, "''")}',
            '${row.status}', ${row.void_reason ? `'${row.void_reason.replace(/'/g, "''")}'` : 'NULL'},
            ${row.voided_by ? `'${row.voided_by}'` : 'NULL'}, ${voidedAt ? `'${voidedAt}'` : 'NULL'},
            '${row.idempotency_key}', '${row.created_by}', '${row.created_by_name}',
            ${row.device ? `'${row.device}'` : 'NULL'}
          );
        `);
      }

      // 4. Verify restored totals and counts match 100%
      const restoredRes = await emptyDb.query(`SELECT COUNT(*) as count, SUM(amount_paisa) as total FROM transactions`);
      expect(Number(restoredRes.rows[0].count)).toBe(originalRows.length);
      expect(Number(restoredRes.rows[0].total)).toBe(originalTotalPaisa);
    });
  });
});
