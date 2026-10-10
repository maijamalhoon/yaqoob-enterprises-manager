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
  const outsiderId = '88888888-8888-8888-8888-888888888888';
  const provisionedUserId = '77777777-7777-7777-7777-777777777777';
  const cashierId = '66666666-6666-6666-6666-666666666666';
  const strangerOrgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let defaultAccountId = '';
  let strangerAccountId = '';

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
      GRANT USAGE ON SCHEMA auth TO authenticated;
    `);

    // 2. Read and execute the real migration
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261004000000_shop_ledger_foundation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pg.exec(sql);

    await pg.exec(`
      CREATE TABLE public.sale_items (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL
      );
    `);
    const saleItemMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004001000_sale_items_created_at.sql'
    );
    await pg.exec(fs.readFileSync(saleItemMigrationPath, 'utf8'));

    await pg.exec(`
      CREATE TABLE public.profiles (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'OWNER',
        organization_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.organization_members (
        organization_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (organization_id, user_id)
      );
      CREATE TABLE public.payment_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
        opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      GRANT SELECT, INSERT ON public.payment_accounts TO authenticated;
      CREATE TABLE public.account_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        from_account_id UUID NOT NULL,
        to_account_id UUID NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      GRANT SELECT, INSERT, UPDATE ON public.account_transfers TO authenticated;
      INSERT INTO public.organizations (id, name, owner_name)
      VALUES ('${strangerOrgId}', 'Stranger Shop', 'Stranger')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Register the 3 shop brothers in auth and shop_members
    await pg.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('${brother1Id}', 'yaqoob@yaqoob.shop', '{"full_name": "Yaqoob"}'::jsonb),
        ('${brother2Id}', 'ali@yaqoob.shop', '{"full_name": "Ali"}'::jsonb),
        ('${brother3Id}', 'usman@yaqoob.shop', '{"full_name": "Usman"}'::jsonb),
        ('${strangerId}', 'stranger@example.com', '{"full_name": "Stranger"}'::jsonb),
        ('${outsiderId}', 'outsider@example.com', '{"full_name": "Outsider"}'::jsonb),
        ('${provisionedUserId}', 'new-owner@example.com', '{"full_name": "New Owner", "shop_name": "New Owner Shop"}'::jsonb),
        ('${cashierId}', 'cashier@example.com', '{"full_name": "Cashier"}'::jsonb);

      INSERT INTO public.profiles (id, email, full_name, role, organization_id) VALUES
        ('${brother1Id}', 'yaqoob@yaqoob.shop', 'Yaqoob', 'OWNER', '00000000-0000-0000-0000-000000000001'),
        ('${brother2Id}', 'ali@yaqoob.shop', 'Ali', 'STAFF', '00000000-0000-0000-0000-000000000001'),
        ('${brother3Id}', 'usman@yaqoob.shop', 'Usman', 'STAFF', '00000000-0000-0000-0000-000000000001'),
        ('${strangerId}', 'stranger@example.com', 'Stranger', 'OWNER', '${strangerOrgId}');

      INSERT INTO public.shop_members (user_id, full_name, email) VALUES
        ('${brother1Id}', 'Yaqoob', 'yaqoob@yaqoob.shop'),
        ('${brother2Id}', 'Ali', 'ali@yaqoob.shop'),
        ('${brother3Id}', 'Usman', 'usman@yaqoob.shop');
    `);

    const membershipMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004002000_repair_shop_member_provisioning.sql'
    );
    await pg.exec(fs.readFileSync(membershipMigrationPath, 'utf8'));

    await pg.exec('CREATE SCHEMA IF NOT EXISTS private;');
    const accountMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004003000_account_balances_and_postings.sql'
    );
    await pg.exec(fs.readFileSync(accountMigrationPath, 'utf8'));
    const draftMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004004000_transaction_drafts.sql'
    );
    await pg.exec(fs.readFileSync(draftMigrationPath, 'utf8'));
    const aliasMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004005000_tenant_scoped_category_aliases.sql'
    );
    await pg.exec(fs.readFileSync(aliasMigrationPath, 'utf8'));
    const provisioningMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004006000_repair_shop_provisioning.sql'
    );
    await pg.exec(fs.readFileSync(provisioningMigrationPath, 'utf8'));
    const integrityMigrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261004007000_transaction_integrity_and_authorization.sql'
    );
    await pg.exec(fs.readFileSync(integrityMigrationPath, 'utf8'));
    await pg.exec(`
      INSERT INTO public.shop_members (user_id, organization_id, full_name, email, role)
      VALUES ('${cashierId}', '00000000-0000-0000-0000-000000000001', 'Cashier', 'cashier@example.com', 'CASHIER');
    `);

    const accountRows = await pg.query<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM public.payment_accounts WHERE is_default = TRUE;'
    );
    defaultAccountId = accountRows.rows.find(
      (account) => account.organization_id === '00000000-0000-0000-0000-000000000001',
    )!.id;
    strangerAccountId = accountRows.rows.find(
      (account) => account.organization_id === strangerOrgId,
    )!.id;
  });

  const setAuthContext = async (userId: string | null, role: 'authenticated' | 'anon') => {
    await pg.exec(`
      RESET ROLE;
      SET "request.jwt.claim.sub" = '${userId || ''}';
      SET "request.jwt.claim.role" = '${role}';
      SET ROLE ${role};
    `);
  };

  it('adds a server-generated created_at cursor to sale_items for offline sync', async () => {
    await pg.exec('RESET ROLE;');
    await pg.exec(`
      INSERT INTO public.sale_items (id, organization_id)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    `);

    const result = await pg.query<{ created_at: string }>(
      `SELECT created_at FROM public.sale_items WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';`
    );

    expect(result.rows[0].created_at).toBeTruthy();
  });

  it('backfills shop membership from the existing profile organization without cross-shop access', async () => {
    await setAuthContext(strangerId, 'authenticated');

    const membership = await pg.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.shop_members WHERE user_id = '${strangerId}';`
    );
    expect(membership.rows[0].organization_id).toBe(strangerOrgId);

    const strangerCategories = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.categories;`
    );
    expect(strangerCategories.rows[0].count).toBe(6);

    const crossShopCategories = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.categories WHERE organization_id = '00000000-0000-0000-0000-000000000001';`
    );
    expect(crossShopCategories.rows[0].count).toBe(0);

    const crossShopAliases = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.category_aliases WHERE organization_id = '00000000-0000-0000-0000-000000000001';`
    );
    expect(crossShopAliases.rows[0].count).toBe(0);

    await pg.exec(`
      INSERT INTO public.category_aliases (organization_id, category_id, alias)
      SELECT '${strangerOrgId}', id, 'STRANGER-PRINT'
      FROM public.categories
      WHERE organization_id = '${strangerOrgId}'
        AND name = 'Printing & Photocopy';
    `);
    const crossShopAliasInsert = await pg.exec(`
        INSERT INTO public.category_aliases (organization_id, category_id, alias)
        SELECT '00000000-0000-0000-0000-000000000001', id, 'CROSS-SHOP-PRINT'
        FROM public.categories
        WHERE organization_id = '00000000-0000-0000-0000-000000000001'
          AND name = 'Printing & Photocopy';
      `);
    expect(crossShopAliasInsert[0].affectedRows).toBe(0);

    await setAuthContext(outsiderId, 'authenticated');
    const outsiderTransactions = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.transactions;`
    );
    expect(outsiderTransactions.rows[0].count).toBe(0);
  });

  it('provisions one shop for a new authenticated user and is safe to call repeatedly', async () => {
    await setAuthContext(provisionedUserId, 'authenticated');
    await pg.query('SELECT public.ensure_my_profile();');
    const firstMembership = await pg.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.shop_members WHERE user_id = '${provisionedUserId}';`
    );

    await pg.query('SELECT public.ensure_my_profile();');
    const secondMembership = await pg.query<{ organization_id: string }>(
      `SELECT organization_id FROM public.shop_members WHERE user_id = '${provisionedUserId}';`
    );
    await pg.exec('RESET ROLE;');
    const account = await pg.query<{ current_balance: number }>(
      `SELECT current_balance FROM public.payment_accounts WHERE organization_id = '${firstMembership.rows[0].organization_id}' AND is_default = TRUE;`
    );
    const categories = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.categories WHERE organization_id = '${firstMembership.rows[0].organization_id}';`
    );

    expect(firstMembership.rows[0].organization_id).toBeTruthy();
    expect(secondMembership.rows[0].organization_id).toBe(firstMembership.rows[0].organization_id);
    expect(Number(account.rows[0].current_balance)).toBe(0);
    expect(categories.rows[0].count).toBe(6);
  });

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
    await setAuthContext(outsiderId, 'authenticated');

    const res = await pg.query<{ count: number }>(`SELECT COUNT(*)::int as count FROM public.categories;`);
    expect(res.rows[0].count).toBe(0); // RLS returns 0 rows to non-member

    // Attempt insert by non-member
    await expect(
      pg.exec(`
        INSERT INTO public.transactions (
          account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${defaultAccountId}', 'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-stranger-1', '${strangerId}', 'Stranger'
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
          account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${defaultAccountId}', 'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-spoof-1', '${brother2Id}', 'Spoofed Ali'
        );
      `)
    ).rejects.toThrow();
  });

  it('proves authorized shop members can insert and read transactions', async () => {
    await setAuthContext(brother1Id, 'authenticated');

    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2026-10-04', 'PRINT 300', 'idemp-brother1-1', '${brother1Id}', 'Yaqoob'
      );
    `);

    const res = await pg.query<{ amount_paisa: number; raw_text: string; created_by_name: string }>(
      `SELECT amount_paisa::int, raw_text, created_by_name FROM public.transactions WHERE idempotency_key = 'idemp-brother1-1';`
    );
    expect(res.rows[0].amount_paisa).toBe(30000);
    expect(res.rows[0].created_by_name).toBe('Yaqoob');
  });

  it('maintains account balances for 200 mixed entries, edit, void, and transfer reversal', async () => {
    await setAuthContext(brother1Id, 'authenticated');
    const startingBalance = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa FROM public.payment_accounts WHERE id = '${defaultAccountId}';`
    );

    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'capital_in', 1000000, '2026-10-04', 'CAPITAL 10000', 'mixed-capital', '${brother1Id}', 'Yaqoob'
      );

      INSERT INTO public.transactions (
        account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      )
      SELECT
        '${defaultAccountId}',
        CASE WHEN seq % 2 = 0 THEN 'income'::public.transaction_type ELSE 'expense'::public.transaction_type END,
        CASE WHEN seq % 2 = 0 THEN 10000 ELSE 3000 END,
        CASE WHEN seq % 2 = 0 THEN 'c1000000-0000-0000-0000-000000000001'::UUID ELSE 'c1000000-0000-0000-0000-000000000004'::UUID END,
        '2026-10-04',
        CASE WHEN seq % 2 = 0 THEN 'PRINT 100' ELSE 'PAPER - 30' END,
        'mixed-200-' || seq::TEXT,
        '${brother1Id}',
        'Yaqoob'
      FROM generate_series(1, 200) AS series(seq);

      INSERT INTO public.transactions (
        account_id, type, amount_paisa, adjustment_dir, note, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES
        ('${defaultAccountId}', 'investment', 15000, NULL, NULL, '2026-10-04', 'INVESTMENT 150', 'mixed-investment', '${brother1Id}', 'Yaqoob'),
        ('${defaultAccountId}', 'withdrawal', 5000, NULL, NULL, '2026-10-04', 'WITHDRAWAL 50', 'mixed-withdrawal', '${brother1Id}', 'Yaqoob'),
        ('${defaultAccountId}', 'adjustment', 3000, 'out', 'Reconciliation', '2026-10-04', 'ADJUST -30', 'mixed-adjustment', '${brother1Id}', 'Yaqoob');
    `);

    const incomeToVoid = await pg.query<{ id: string }>(
      `SELECT id FROM public.transactions WHERE idempotency_key = 'mixed-200-2';`
    );
    await pg.exec(`
      UPDATE public.transactions
      SET status = 'voided', void_reason = 'Duplicate', voided_by = '${brother1Id}', voided_at = NOW(), updated_at = updated_at
      WHERE id = '${incomeToVoid.rows[0].id}';
      UPDATE public.transactions
      SET amount_paisa = 5000, updated_at = updated_at
      WHERE idempotency_key = 'mixed-200-1';
    `);

    await pg.exec(`
      INSERT INTO public.payment_accounts (
        organization_id, name, type, current_balance, opening_balance, is_default, is_active
      ) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Bank', 'BANK', 100, 100, FALSE, TRUE);
      INSERT INTO public.account_transfers (
        organization_id, from_account_id, to_account_id, amount, date, created_by
      )
      SELECT '00000000-0000-0000-0000-000000000001', '${defaultAccountId}', id, 10, '2026-10-04', '${brother1Id}'
      FROM public.payment_accounts WHERE name = 'Test Bank';
    `);
    const transfer = await pg.query<{ id: string; to_account_id: string }>(
      `SELECT id, to_account_id FROM public.account_transfers WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND to_account_id <> '${defaultAccountId}' ORDER BY created_at DESC LIMIT 1;`
    );
    await pg.exec(`
      UPDATE public.account_transfers
      SET status = 'VOIDED', void_reason = 'Test reversal'
      WHERE id = '${transfer.rows[0].id}';
    `);

    const balances = await pg.query<{ id: string; balance_paisa: number }>(
      `SELECT id, balance_paisa FROM public.payment_accounts WHERE id IN ('${defaultAccountId}', '${transfer.rows[0].to_account_id}') ORDER BY id;`
    );
    const sourceBalance = balances.rows.find((row) => row.id === defaultAccountId)?.balance_paisa;
    const destinationBalance = balances.rows.find((row) => row.id === transfer.rows[0].to_account_id)?.balance_paisa;
    const expectedChange = 1000000 + (100 * 10000) - (100 * 3000) + 15000 - 5000 - 3000 - 10000 - 2000;

    expect(sourceBalance).toBe(Number(startingBalance.rows[0].balance_paisa) + expectedChange);
    expect(destinationBalance).toBe(10000);

    const ledgerCount = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.account_ledger_entries WHERE organization_id = '00000000-0000-0000-0000-000000000001';`
    );
    expect(ledgerCount.rows[0].count).toBeGreaterThanOrEqual(210);
  });

  it('attributes a void from auth context and reverses/restores its posting exactly once', async () => {
    await setAuthContext(brother1Id, 'authenticated');
    const before = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa FROM public.payment_accounts WHERE id = '${defaultAccountId}';`
    );
    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, business_date, raw_text,
        idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'capital_in', 12345, '2026-10-04',
        'CAPITAL 123.45', 'void-attribution-regression',
        '${brother1Id}', 'Yaqoob'
      );
    `);
    const posted = await pg.query<{ id: string }>(
      `SELECT id FROM public.transactions WHERE idempotency_key = 'void-attribution-regression';`
    );
    const afterPost = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa FROM public.payment_accounts WHERE id = '${defaultAccountId}';`
    );

    await pg.exec(`
      UPDATE public.transactions
      SET status = 'voided', void_reason = 'Duplicate', voided_by = '${strangerId}'
      WHERE id = '${posted.rows[0].id}';
      UPDATE public.transactions
      SET status = 'voided', void_reason = 'Repeated attempt'
      WHERE id = '${posted.rows[0].id}';
    `);
    const voided = await pg.query<{ voided_by: string; voided_at: string }>(
      `SELECT voided_by, voided_at FROM public.transactions WHERE id = '${posted.rows[0].id}';`
    );
    const afterVoid = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa FROM public.payment_accounts WHERE id = '${defaultAccountId}';`
    );
    const voidReversals = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.account_ledger_entries
       WHERE transaction_id = '${posted.rows[0].id}' AND entry_type = 'REVERSAL';`
    );

    await pg.exec(`
      UPDATE public.transactions
      SET status = 'active'
      WHERE id = '${posted.rows[0].id}';
      UPDATE public.transactions
      SET status = 'active'
      WHERE id = '${posted.rows[0].id}';
    `);
    const afterRestore = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa FROM public.payment_accounts WHERE id = '${defaultAccountId}';`
    );
    const lifecycleAudit = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.audit_log
       WHERE transaction_id = '${posted.rows[0].id}' AND action IN ('void', 'restore');`
    );

    expect(Number(afterPost.rows[0].balance_paisa) - Number(before.rows[0].balance_paisa))
      .toBe(12345);
    expect(voided.rows[0].voided_by).toBe(brother1Id);
    expect(voided.rows[0].voided_at).toBeTruthy();
    expect(Number(afterVoid.rows[0].balance_paisa)).toBe(Number(before.rows[0].balance_paisa));
    expect(voidReversals.rows[0].count).toBe(1);
    expect(Number(afterRestore.rows[0].balance_paisa)).toBe(Number(afterPost.rows[0].balance_paisa));
    expect(lifecycleAudit.rows[0].count).toBe(2);
  });

  it('denies a cashier transaction update through database row-level security', async () => {
    await setAuthContext(brother1Id, 'authenticated');
    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, business_date, raw_text,
        idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'capital_in', 500, '2026-10-04',
        'CAPITAL 5', 'cashier-update-denied',
        '${brother1Id}', 'Yaqoob'
      );
    `);

    await setAuthContext(cashierId, 'authenticated');
    const result = await pg.query<{ id: string }>(`
      UPDATE public.transactions
      SET status = 'voided', void_reason = 'Not allowed'
      WHERE idempotency_key = 'cashier-update-denied'
      RETURNING id;
    `);
    const unchanged = await pg.query<{ status: string }>(
      `SELECT status FROM public.transactions WHERE idempotency_key = 'cashier-update-denied';`
    );

    expect(result.rows).toHaveLength(0);
    expect(unchanged.rows[0].status).toBe('active');
  });

  it('rejects attaching a category from another shop to a transaction', async () => {
    await pg.exec('RESET ROLE;');
    const foreignCategory = await pg.query<{ id: string }>(
      `SELECT id FROM public.categories
       WHERE organization_id = '${strangerOrgId}'
       ORDER BY id LIMIT 1;`
    );
    expect(foreignCategory.rows).toHaveLength(1);
    await setAuthContext(brother1Id, 'authenticated');

    await expect(pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, category_id, business_date,
        raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'income', 100, '${foreignCategory.rows[0].id}',
        '2026-10-04', 'PRINT 1', 'cross-shop-category-rejected',
        '${brother1Id}', 'Yaqoob'
      );
    `)).rejects.toThrow();
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
          account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${defaultAccountId}', 'income', 30000, 'c1000000-0000-0000-0000-000000000004', '2026-10-04', 'PAPER 300', 'idemp-mismatch-1', '${brother1Id}', 'Yaqoob'
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
          account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${defaultAccountId}', 'income', 30000, 'c1000000-0000-0000-0000-000000000001', '2099-01-01', 'PRINT 300', 'idemp-future-1', '${brother1Id}', 'Yaqoob'
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
          account_id, type, amount_paisa, business_date, raw_text, idempotency_key, created_by, created_by_name
        ) VALUES (
          '${defaultAccountId}', 'adjustment', 50000, '2026-10-04', 'ADJUST 500', 'idemp-adj-fail', '${brother1Id}', 'Yaqoob'
        );
      `)
    ).rejects.toThrow();

    // Valid adjustment with note and direction
    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, adjustment_dir, note, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'adjustment', 50000, 'in', 'Till float reconciliation', '2026-10-04', 'ADJUST 500 FLOAT', 'idemp-adj-pass', '${brother1Id}', 'Yaqoob'
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
        account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'income', 20000, 'c1000000-0000-0000-0000-000000000003', '2026-10-04', 'LAMINATION 200', 'idemp-lam-1', '${brother1Id}', 'Yaqoob'
      );
    `);

    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'capital_in', 200000, '2026-10-04', 'CAPITAL 2000', 'idemp-report-capital', '${brother1Id}', 'Yaqoob'
      );
    `);

    // Insert active expense: Paper -2000
    await pg.exec(`
      INSERT INTO public.transactions (
        account_id, type, amount_paisa, category_id, business_date, raw_text, idempotency_key, created_by, created_by_name
      ) VALUES (
        '${defaultAccountId}', 'expense', 200000, 'c1000000-0000-0000-0000-000000000004', '2026-10-04', 'PAPER -2000', 'idemp-pap-1', '${brother1Id}', 'Yaqoob'
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
    expect(summary.rows[0].income_paisa).toBe(1010000);
    expect(summary.rows[0].expense_paisa).toBe(502000);
    expect(summary.rows[0].net_profit_paisa).toBe(508000);
    expect(summary.rows[0].adjustment_in_paisa).toBe(50000); // Rs 500
  });

  it('keeps transaction drafts off account balances until an atomic account post, then retries idempotently', async () => {
    await setAuthContext(brother1Id, 'authenticated');
    const before = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa::int FROM public.payment_accounts WHERE id = '${defaultAccountId}';`,
    );
    const draftId = '55000000-0000-0000-0000-000000000001';

    await pg.exec(`
      INSERT INTO public.transaction_drafts (
        id, organization_id, type, amount_paisa, category_id, business_date,
        device_entry_time, raw_text, created_by, created_by_name, idempotency_key
      ) VALUES (
        '${draftId}', '00000000-0000-0000-0000-000000000001', 'income', 12345,
        'c1000000-0000-0000-0000-000000000001', '2026-10-04', NOW(),
        'PAGINATION TEST DRAFT', '${brother1Id}', 'Yaqoob', 'draft-${draftId}'
      );
    `);
    const afterDraft = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa::int FROM public.payment_accounts WHERE id = '${defaultAccountId}';`,
    );
    expect(afterDraft.rows[0].balance_paisa).toBe(before.rows[0].balance_paisa);
    await setAuthContext(strangerId, 'authenticated');
    const hiddenDraft = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.transaction_drafts WHERE id = '${draftId}';`,
    );
    expect(hiddenDraft.rows[0].count).toBe(0);
    await setAuthContext(brother1Id, 'authenticated');

    const posted = await pg.query<{ id: string; account_id: string; amount_paisa: number }>(
      `SELECT id, account_id, amount_paisa::int FROM public.post_transaction_draft('${draftId}', '${defaultAccountId}');`,
    );
    expect(posted.rows).toHaveLength(1);
    expect(posted.rows[0].account_id).toBe(defaultAccountId);
    expect(posted.rows[0].amount_paisa).toBe(12345);

    const retry = await pg.query<{ id: string }>(
      `SELECT id FROM public.post_transaction_draft('${draftId}', '${defaultAccountId}');`,
    );
    expect(retry.rows[0].id).toBe(posted.rows[0].id);
    const finalBalance = await pg.query<{ balance_paisa: number }>(
      `SELECT balance_paisa::int FROM public.payment_accounts WHERE id = '${defaultAccountId}';`,
    );
    expect(finalBalance.rows[0].balance_paisa).toBe(before.rows[0].balance_paisa + 12345);

    const remainingDrafts = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.transaction_drafts WHERE id = '${draftId}';`,
    );
    expect(remainingDrafts.rows[0].count).toBe(0);
  });
});
