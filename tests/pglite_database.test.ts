// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Real PostgreSQL Engine & RLS Security Tests (PGlite)', () => {
  let pg: PGlite;

  const brother1Id = '11111111-1111-1111-1111-111111111111';
  const brother2Id = '22222222-2222-2222-2222-222222222222';
  const brother3Id = '33333333-3333-3333-3333-333333333333';
  const strangerId = '99999999-9999-9999-9999-999999999999';

  beforeAll(async () => {
    pg = new PGlite();

    // 1. Stub Supabase auth schema and helper functions
    await pg.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb
      );

      -- auth.uid() function returning session user
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
      $$ LANGUAGE sql STABLE;

      -- Create roles
      DO $$ BEGIN
        CREATE ROLE anon;
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE ROLE authenticated;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 2. Read and execute the real migration
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261004000000_shop_ledger_foundation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pg.exec(sql);

    // 3. Register the 3 shop brothers in auth and shop_members
    await pg.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('${brother1Id}', 'yaqoob@yaqoob.shop', '{"full_name": "Yaqoob"}'::jsonb),
        ('${brother2Id}', 'ali@yaqoob.shop', '{"full_name": "Ali"}'::jsonb),
        ('${brother3Id}', 'usman@yaqoob.shop', '{"full_name": "Usman"}'::jsonb),
        ('${strangerId}', 'stranger@example.com', '{"full_name": "Stranger"}'::jsonb);

      INSERT INTO public.shop_members (user_id, full_name, email) VALUES
        ('${brother1Id}', 'Yaqoob', 'yaqoob@yaqoob.shop'),
        ('${brother2Id}', 'Ali', 'ali@yaqoob.shop'),
        ('${brother3Id}', 'Usman', 'usman@yaqoob.shop');
    `);
  });

  const setAuthContext = async (userId: string | null, role: 'authenticated' | 'anon') => {
    await pg.exec(`
      RESET ROLE;
      SET "request.jwt.claim.sub" = '${userId || ''}';
      SET "request.jwt.claim.role" = '${role}';
      SET ROLE ${role};
    `);
  };

  it('anon blocked on all tables, views and functions', async () => {
    await setAuthContext(null, 'anon');

    // Attempt select on tables
    await expect(pg.exec(`SELECT * FROM public.transactions;`)).rejects.toThrow(/permission denied/);
    await expect(pg.exec(`SELECT * FROM public.categories;`)).rejects.toThrow(/permission denied/);
    await expect(pg.exec(`SELECT * FROM public.shop_members;`)).rejects.toThrow(/permission denied/);
    await expect(pg.exec(`SELECT * FROM public.audit_log;`)).rejects.toThrow(/permission denied/);

    // Attempt select on shared views
    await expect(pg.exec(`SELECT * FROM public.view_daily_summary;`)).rejects.toThrow(/permission denied/);
    await expect(pg.exec(`SELECT * FROM public.view_monthly_summary;`)).rejects.toThrow(/permission denied/);

    // Attempt calling functions
    await expect(pg.exec(`SELECT public.is_active_shop_member();`)).rejects.toThrow(/permission denied/);
  });

  it('non-member sees and writes nothing under RLS', async () => {
    // Authenticated stranger (not in shop_members)
    await setAuthContext(strangerId, 'authenticated');

    const res = await pg.query<{ count: number }>(`SELECT COUNT(*)::int as count FROM public.categories;`);
    expect(res.rows[0].count).toBe(0); // RLS returns 0 rows to non-member

    // Attempt insert by non-member
    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-stranger-1', '${strangerId}', 'Stranger'
        );
      `)
    ).rejects.toThrow();
  });

  it('created_by cannot be spoofed by shop members', async () => {
    // Authenticated as Brother 1
    await setAuthContext(brother1Id, 'authenticated');

    // Attempt to spoof created_by as Brother 2 or Stranger
    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-spoof-1', '${brother2Id}', 'Spoofed Ali'
        );
      `)
    ).rejects.toThrow();
  });

  it('proves authorized shop members can insert and read transactions', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await pg.exec(`
      INSERT INTO public.transactions (
        type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-brother1-1', '${brother1Id}', 'Yaqoob'
      );
    `);

    const res = await pg.query<{ amount_paisa: number; raw_text: string; created_by_name: string }>(
      `SELECT amount_paisa::int, raw_text, created_by_name FROM public.transactions WHERE idempotency_key = 'idemp-brother1-1';`
    );
    expect(res.rows[0].amount_paisa).toBe(30000);
    expect(res.rows[0].created_by_name).toBe('Yaqoob');
  });

  it('proves hard DELETE is blocked at database level by trigger and permission revocation', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await expect(
      pg.exec(`DELETE FROM public.transactions WHERE idempotency_key = 'idemp-brother1-1';`)
    ).rejects.toThrow();
  });

  it('proves TRUNCATE is blocked at database level by trigger and role revocation', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await expect(pg.exec(`TRUNCATE public.transactions;`)).rejects.toThrow();
  });

  it('proves income pointing to expense category is rejected in database', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    // c1000000-0000-0000-0000-000000000004 is 'Paper Stock Purchase' (kind = 'expense')
    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          'income', 30000, 'c1000000-0000-0000-0000-000000000004', '2026-10-04', 'PAPER 300', 'idemp-mismatch-1', '${brother1Id}', 'Yaqoob'
        );
      `)
    ).rejects.toThrow(/Transaction type \(income\) does not match category kind \(expense\)/);
  });

  it('proves void without a reason is rejected by check constraint', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await expect(
      pg.exec(`
        UPDATE public.transactions
        SET status = 'voided', void_reason = '', voided_by = '${brother1Id}', voided_at = NOW()
        WHERE idempotency_key = 'idemp-brother1-1';
      `)
    ).rejects.toThrow();
  });

  it('audit trigger works under RLS when voiding or updating transactions', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    // Fetch current updated_at formatted in ISO string for optimistic concurrency
    const cur = await pg.query<{ updated_at: string }>(
      `SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at FROM public.transactions WHERE idempotency_key = 'idemp-brother1-1';`
    );
    const originalUpdatedAt = cur.rows[0].updated_at;

    await pg.exec(`
      UPDATE public.transactions
      SET status = 'voided',
          void_reason = 'Mistyped item',
          voided_by = '${brother1Id}',
          voided_at = NOW(),
          updated_at = '${originalUpdatedAt}'::timestamptz
      WHERE idempotency_key = 'idemp-brother1-1';
    `);

    // Verify audit_log row was written automatically
    const auditRes = await pg.query<{ action: string; changed_by_name: string }>(
      `SELECT action, changed_by_name FROM public.audit_log WHERE action = 'void';`
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);
    expect(auditRes.rows[0].action).toBe('void');
    expect(auditRes.rows[0].changed_by_name).toBe('Yaqoob');
  });

  it('client cannot insert, update, or delete audit_log', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await expect(
      pg.exec(`
        INSERT INTO public.audit_log (transaction_id, action, changed_by, changed_by_name)
        VALUES (gen_random_uuid(), 'create', '${brother1Id}', 'Hacker');
      `)
    ).rejects.toThrow();

    await expect(pg.exec(`DELETE FROM public.audit_log;`)).rejects.toThrow();
  });

  it('proves stale edit is rejected in database (optimistic concurrency)', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    // Intentionally pass an outdated updated_at
    await expect(
      pg.exec(`
        UPDATE public.transactions
        SET amount_paisa = 40000,
            updated_at = '2020-01-01T00:00:00Z'::timestamptz
        WHERE idempotency_key = 'idemp-brother1-1';
      `)
    ).rejects.toThrow(/Stale update: transaction has been modified concurrently/);
  });

  it('proves future date drift is rejected in database', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2099-01-01', 'PRINT 300', 'idemp-future-1', '${brother1Id}', 'Yaqoob'
        );
      `)
    ).rejects.toThrow(/Future business dates are prohibited/);
  });

  it('proves adjustments require note and direction', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    // Missing direction & note
    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          type, amount_paisa, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          'adjustment', 50000, '2026-10-04', 'ADJUST 500', 'idemp-adj-fail', '${brother1Id}', 'Yaqoob'
        );
      `)
    ).rejects.toThrow();

    // Valid adjustment with note and direction
    await pg.exec(`
      INSERT INTO public.transactions (
        type, amount_paisa, adjustment_dir, note, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        'adjustment', 50000, 'in', 'Till float reconciliation', '2026-10-04', 'ADJUST 500 FLOAT', 'idemp-adj-pass', '${brother1Id}', 'Yaqoob'
      );
    `);

    const adj = await pg.query<{ amount_paisa: number; adjustment_dir: string }>(
      `SELECT amount_paisa::int, adjustment_dir FROM public.transactions WHERE idempotency_key = 'idemp-adj-pass';`
    );
    expect(adj.rows[0].amount_paisa).toBe(50000);
    expect(adj.rows[0].adjustment_dir).toBe('in');
  });

  it('proves shared SQL view view_daily_summary aggregates correctly and excludes voided records', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    // Insert active income: Lamination 200
    await pg.exec(`
      INSERT INTO public.transactions (
        type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        'income', 20000, 'c1000000-0000-0000-0000-000000000003', '2026-10-04', 'LAMINATION 200', 'idemp-lam-1', '${brother1Id}', 'Yaqoob'
      );
    `);

    // Insert active expense: Paper -2000
    await pg.exec(`
      INSERT INTO public.transactions (
        type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        'expense', 200000, 'c1000000-0000-0000-0000-000000000004', '2026-10-04', 'PAPER -2000', 'idemp-pap-1', '${brother1Id}', 'Yaqoob'
      );
    `);

    const summary = await pg.query<{
      income_paisa: number;
      expense_paisa: number;
      net_profit_paisa: number;
      adjustment_in_paisa: number;
    }>(`SELECT income_paisa::int, expense_paisa::int, net_profit_paisa::int, adjustment_in_paisa::int FROM public.view_daily_summary WHERE business_date = '2026-10-04';`);

    expect(summary.rows.length).toBe(1);
    // Active income: 20000 paisa (Rs 200) because the 30000 entry was voided in test 8!
    expect(summary.rows[0].income_paisa).toBe(20000);
    expect(summary.rows[0].expense_paisa).toBe(200000); // Rs 2,000
    expect(summary.rows[0].net_profit_paisa).toBe(-180000); // Rs -1,800
    expect(summary.rows[0].adjustment_in_paisa).toBe(50000); // Rs 500
  });
});
