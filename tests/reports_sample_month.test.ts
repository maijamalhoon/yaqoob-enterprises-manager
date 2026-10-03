// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4: Hand-Calculated Sample Month Verification Test', () => {
  let db: PGlite;
  const ownerId = '11111111-1111-1111-1111-111111111111';

  const catPrinting = 'c1000000-0000-0000-0000-000000000001';
  const catStamp = 'c1000000-0000-0000-0000-000000000002';
  const catLamination = 'c1000000-0000-0000-0000-000000000003';
  const catPaper = 'c1000000-0000-0000-0000-000000000004';
  const catSupplies = 'c1000000-0000-0000-0000-000000000005';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Stub auth schema & roles
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

    // 2. Run migration
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261004000000_shop_ledger_foundation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(sql);

    // 3. Ensure owner is member
    await db.query(`
      INSERT INTO shop_members (user_id, full_name, email)
      VALUES ('${ownerId}', 'Shop Owner', 'owner@yaqoob.local')
      ON CONFLICT (user_id) DO NOTHING;
    `);
  });

  it('accurately computes daily and monthly views for a hand-calculated month', async () => {
    // Hand-Calculated Entries for October 2026:
    // Day 1 (2026-10-01):
    // - PRINT 300 (Income: 30,000 paisa)
    // - STAMP 500 (Income: 50,000 paisa)
    // - PAPER - 2000 (Expense: 200,000 paisa)
    // - CAPITAL 10000 (Capital In: 1,000,000 paisa)
    // Day 1 Expected: Income=80,000; Expense=200,000; Net=-120,000; Capital=1,000,000

    await db.query(`
      INSERT INTO transactions (id, type, amount_paisa, category_id, business_date, device_entry_time, raw_text, status, idempotency_key, created_by, created_by_name)
      VALUES 
        ('e1000000-0000-0000-0000-000000000001', 'income', 30000, '${catPrinting}', '2026-10-01', '2026-10-01T09:00:00Z', 'PRINT 300', 'active', 'idemp-01', '${ownerId}', 'Brother 1'),
        ('e1000000-0000-0000-0000-000000000002', 'income', 50000, '${catStamp}', '2026-10-01', '2026-10-01T10:00:00Z', 'STAMP 500', 'active', 'idemp-02', '${ownerId}', 'Brother 2'),
        ('e1000000-0000-0000-0000-000000000003', 'expense', 200000, '${catPaper}', '2026-10-01', '2026-10-01T11:00:00Z', 'PAPER - 2000', 'active', 'idemp-03', '${ownerId}', 'Brother 1'),
        ('e1000000-0000-0000-0000-000000000004', 'capital_in', 1000000, NULL, '2026-10-01', '2026-10-01T12:00:00Z', 'CAPITAL 10000', 'active', 'idemp-04', '${ownerId}', 'Owner');
    `);

    // Day 2 (2026-10-02):
    // - LAMINATION 150 (Income: 15,000 paisa)
    // - PRINT 450 (Income: 45,000 paisa)
    // - ELECTRICITY - 3500 (Expense: 350,000 paisa)
    // - WITHDRAWAL 2000 (Withdrawal: 200,000 paisa)
    // Day 2 Expected: Income=60,000; Expense=350,000; Net=-290,000; Withdrawal=200,000

    await db.query(`
      INSERT INTO transactions (id, type, amount_paisa, category_id, business_date, device_entry_time, raw_text, status, idempotency_key, created_by, created_by_name)
      VALUES 
        ('e1000000-0000-0000-0000-000000000005', 'income', 15000, '${catLamination}', '2026-10-02', '2026-10-02T09:30:00Z', 'LAMINATION 150', 'active', 'idemp-05', '${ownerId}', 'Brother 1'),
        ('e1000000-0000-0000-0000-000000000006', 'income', 45000, '${catPrinting}', '2026-10-02', '2026-10-02T10:30:00Z', 'PRINT 450', 'active', 'idemp-06', '${ownerId}', 'Brother 2'),
        ('e1000000-0000-0000-0000-000000000007', 'expense', 350000, '${catSupplies}', '2026-10-02', '2026-10-02T14:00:00Z', '-BILL 3500', 'active', 'idemp-07', '${ownerId}', 'Brother 1'),
        ('e1000000-0000-0000-0000-000000000008', 'withdrawal', 200000, NULL, '2026-10-02', '2026-10-02T16:00:00Z', 'WITHDRAW 2000', 'active', 'idemp-08', '${ownerId}', 'Owner');
    `);

    // Day 3 (2026-10-03):
    // - PRINT 1200 (Income: 120,000 paisa)
    // - ADJUSTMENT IN 100 (Adjustment In: 10,000 paisa, note: "Cash drawer overage")
    // - PRINT 1000 VOIDED (Status: voided, reason: "Customer left without paying")
    // Day 3 Expected: Income=120,000; Expense=0; Net=120,000; AdjustmentIn=10,000; Voided=Excluded!

    await db.query(`
      INSERT INTO transactions (id, type, amount_paisa, category_id, adjustment_dir, note, business_date, device_entry_time, raw_text, status, void_reason, voided_by, voided_at, idempotency_key, created_by, created_by_name)
      VALUES 
        ('e1000000-0000-0000-0000-000000000009', 'income', 120000, '${catPrinting}', NULL, NULL, '2026-10-03', '2026-10-03T11:00:00Z', 'PRINT 1200', 'active', NULL, NULL, NULL, 'idemp-09', '${ownerId}', 'Brother 1'),
        ('e1000000-0000-0000-0000-000000000010', 'adjustment', 10000, NULL, 'in', 'Cash drawer overage', '2026-10-03', '2026-10-03T17:00:00Z', 'ADJUSTMENT 100', 'active', NULL, NULL, NULL, 'idemp-10', '${ownerId}', 'Brother 2'),
        ('e1000000-0000-0000-0000-000000000011', 'income', 100000, '${catPrinting}', NULL, NULL, '2026-10-03', '2026-10-03T18:00:00Z', 'PRINT 1000', 'voided', 'Customer left without paying', '${ownerId}', '2026-10-03T18:05:00Z', 'idemp-11', '${ownerId}', 'Brother 1');
    `);

    // 1. Verify Daily Summary for Day 1
    const day1Res = await db.query(`SELECT * FROM view_daily_summary WHERE business_date = '2026-10-01'`);
    expect(day1Res.rows).toHaveLength(1);
    const day1 = day1Res.rows[0];
    expect(Number(day1.income_paisa)).toBe(80000);
    expect(Number(day1.expense_paisa)).toBe(200000);
    expect(Number(day1.net_profit_paisa)).toBe(-120000);
    expect(Number(day1.capital_in_paisa)).toBe(1000000);
    expect(Number(day1.withdrawal_paisa)).toBe(0);

    // 2. Verify Daily Summary for Day 3 (Voided strictly excluded!)
    const day3Res = await db.query(`SELECT * FROM view_daily_summary WHERE business_date = '2026-10-03'`);
    const day3 = day3Res.rows[0];
    expect(Number(day3.income_paisa)).toBe(120000); // 100,000 voided is strictly excluded!
    expect(Number(day3.net_profit_paisa)).toBe(120000);
    expect(Number(day3.adjustment_in_paisa)).toBe(10000);

    // 3. Verify Monthly Summary for October 2026
    const monthRes = await db.query(`SELECT * FROM view_monthly_summary WHERE year = 2026 AND month = 10`);
    expect(monthRes.rows).toHaveLength(1);
    const month = monthRes.rows[0];

    // Total Hand-Calculated:
    // Income = 80,000 + 60,000 + 120,000 = 260,000 paisa (Rs 2,600.00)
    // Expense = 200,000 + 350,000 + 0 = 550,000 paisa (Rs 5,500.00)
    // Net Profit = 260,000 - 550,000 = -290,000 paisa (-Rs 2,900.00)
    // Capital In = 1,000,000 paisa (Rs 10,000.00)
    // Withdrawal = 200,000 paisa (Rs 2,000.00)
    // Adjustment In = 10,000 paisa (Rs 100.00)
    expect(Number(month.income_paisa)).toBe(260000);
    expect(Number(month.expense_paisa)).toBe(550000);
    expect(Number(month.net_profit_paisa)).toBe(-290000);
    expect(Number(month.capital_in_paisa)).toBe(1000000);
    expect(Number(month.withdrawal_paisa)).toBe(200000);
    expect(Number(month.adjustment_in_paisa)).toBe(10000);
    expect(Number(month.adjustment_out_paisa)).toBe(0);

    // Invariant verification: Net Profit MUST strictly equal Income - Expense
    expect(Number(month.net_profit_paisa)).toBe(Number(month.income_paisa) - Number(month.expense_paisa));
  });
});
