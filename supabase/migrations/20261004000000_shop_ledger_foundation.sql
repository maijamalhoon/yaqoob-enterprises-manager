-- ============================================================================
-- YAQUB ENTERPRISES MANAGER — MODERN SHOP LEDGER FOUNDATION
-- Migration: 20261004000000_shop_ledger_foundation.sql
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM (
    'income',
    'expense',
    'capital_in',
    'withdrawal',
    'adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM (
    'active',
    'voided'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.category_kind AS ENUM (
    'income',
    'expense'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.adjustment_direction AS ENUM (
    'in',
    'out'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. SHOP MEMBERS (The 3 authorized users for Yaqoob Enterprises)
CREATE TABLE IF NOT EXISTS public.shop_members (
  user_id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL,
  unusual_amount_limit_paisa BIGINT NOT NULL DEFAULT 5000000, -- Default Rs 50,000 in paisa
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_categories_name UNIQUE (name)
);

-- 4. CATEGORY ALIASES (exact/phonetic synonyms; no numeric aliases allowed)
CREATE TABLE IF NOT EXISTS public.category_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  match_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_category_alias UNIQUE (alias),
  CONSTRAINT chk_no_numeric_alias CHECK (alias !~ '^[0-9]+$')
);

-- 5. TRANSACTIONS (Core Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.transaction_type NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  category_id UUID REFERENCES public.categories(id),
  adjustment_dir public.adjustment_direction, -- Required only if type = 'adjustment'
  business_date DATE NOT NULL,                -- Derived in Asia/Karachi from device entry time
  device_entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  raw_text TEXT NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'active',
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_transactions_idempotency UNIQUE (idempotency_key),
  CONSTRAINT chk_adjustment_requires_note CHECK (
    type != 'adjustment' OR (note IS NOT NULL AND length(trim(note)) > 0 AND adjustment_dir IS NOT NULL)
  ),
  CONSTRAINT chk_void_requires_reason CHECK (
    status != 'voided' OR (void_reason IS NOT NULL AND length(trim(void_reason)) > 0 AND voided_by IS NOT NULL AND voided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON public.transactions(business_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status_type ON public.transactions(status, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);

-- 6. AUDIT LOG (Immutable History of Edits and Voids - System Triggered Only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'void', 'restore')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL,
  changed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. REVIEW QUEUE
CREATE TABLE IF NOT EXISTS public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_category_id UUID REFERENCES public.categories(id),
  suggested_amount_paisa BIGINT,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DATABASE TRIGGERS & CONSTRAINTS
-- ============================================================================

-- A. CATEGORY KIND & TRANSACTION TYPE ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.check_transaction_category_match()
RETURNS TRIGGER AS $$
DECLARE
  cat_kind public.category_kind;
BEGIN
  IF NEW.type IN ('capital_in', 'withdrawal') THEN
    NEW.category_id := NULL; -- Capital and withdrawal do not belong to categories
    RETURN NEW;
  END IF;

  IF NEW.type IN ('income', 'expense') THEN
    IF NEW.category_id IS NULL THEN
      RAISE EXCEPTION 'Category is required for income and expense transactions.';
    END IF;
    SELECT kind INTO cat_kind FROM public.categories WHERE id = NEW.category_id;
    IF cat_kind IS NULL THEN
      RAISE EXCEPTION 'Referenced category does not exist.';
    END IF;
    IF (NEW.type = 'income' AND cat_kind != 'income') OR (NEW.type = 'expense' AND cat_kind != 'expense') THEN
      RAISE EXCEPTION 'Transaction type (%) does not match category kind (%).', NEW.type, cat_kind;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_transaction_category ON public.transactions;
CREATE TRIGGER trg_validate_transaction_category
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.check_transaction_category_match();

-- B. DATE DRIFT & FUTURE DATE PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION public.validate_business_date_drift()
RETURNS TRIGGER AS $$
DECLARE
  current_karachi_date DATE := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
BEGIN
  -- Disallow dates > 1 day in the future
  IF NEW.business_date > current_karachi_date + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'Future business dates are prohibited. Given: %, Current: %', NEW.business_date, current_karachi_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_business_date ON public.transactions;
CREATE TRIGGER trg_validate_business_date
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_business_date_drift();

-- C. CREATED_BY ENFORCEMENT & CONCURRENCY TRIGGER ON INSERT
CREATE OR REPLACE FUNCTION public.enforce_transaction_insert_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member_name TEXT;
BEGIN
  -- If authenticated user is present, enforce created_by from auth.uid()
  IF v_uid IS NOT NULL THEN
    NEW.created_by := v_uid;
    SELECT full_name INTO v_member_name FROM public.shop_members WHERE user_id = v_uid;
    IF v_member_name IS NOT NULL THEN
      NEW.created_by_name := v_member_name;
    END IF;
  END IF;

  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Authentication required: created_by cannot be null.';
  END IF;

  NEW.created_at := NOW();
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_enforce_transaction_insert ON public.transactions;
CREATE TRIGGER trg_enforce_transaction_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_insert_defaults();

-- D. AUDIT TRAIL & OPTIMISTIC CONCURRENCY TRIGGER ON UPDATE
CREATE OR REPLACE FUNCTION public.audit_transactions_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
  v_action TEXT;
BEGIN
  -- Optimistic Concurrency Check: If client supplies updated_at different from OLD, reject
  IF OLD.updated_at != NEW.updated_at THEN
    RAISE EXCEPTION 'Stale update: transaction has been modified concurrently.';
  END IF;

  -- Determine action
  IF OLD.status = 'active' AND NEW.status = 'voided' THEN
    v_action := 'void';
  ELSIF OLD.status = 'voided' AND NEW.status = 'active' THEN
    v_action := 'restore';
  ELSE
    v_action := 'edit';
  END IF;

  -- Bump updated_at
  NEW.updated_at := NOW();

  -- Resolve author
  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.shop_members WHERE user_id = v_user_id;
  END IF;
  IF v_user_name IS NULL THEN v_user_name := COALESCE(NEW.created_by_name, 'Shop User'); END IF;

  -- Write audit log (under SECURITY DEFINER with fixed search_path)
  INSERT INTO public.audit_log (transaction_id, action, old_data, new_data, changed_by, changed_by_name)
  VALUES (NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), COALESCE(v_user_id, NEW.created_by), v_user_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_transactions_mutation();

-- E. HARD DELETE PREVENTION TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_hard_delete_transactions()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion is prohibited on transactions. Set status to voided instead.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_block_delete_transactions ON public.transactions;
CREATE TRIGGER trg_block_delete_transactions
BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete_transactions();

-- F. TRUNCATE PREVENTION TRIGGER ACROSS ALL LEDGER TABLES
CREATE OR REPLACE FUNCTION public.prevent_truncate_ledger()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE is prohibited on ledger tables.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_block_truncate_transactions ON public.transactions;
CREATE TRIGGER trg_block_truncate_transactions
BEFORE TRUNCATE ON public.transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_truncate_ledger();

DROP TRIGGER IF EXISTS trg_block_truncate_categories ON public.categories;
CREATE TRIGGER trg_block_truncate_categories
BEFORE TRUNCATE ON public.categories
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_truncate_ledger();

DROP TRIGGER IF EXISTS trg_block_truncate_audit ON public.audit_log;
CREATE TRIGGER trg_block_truncate_audit
BEFORE TRUNCATE ON public.audit_log
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_truncate_ledger();

-- ============================================================================
-- SHARED REPORTING SQL VIEWS (WITH security_invoker = true)
-- ============================================================================

-- 1. DAILY SUMMARY VIEW
CREATE OR REPLACE VIEW public.view_daily_summary WITH (security_invoker = true) AS
SELECT
  business_date,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0)::BIGINT AS income_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)::BIGINT AS expense_paisa,
  (
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) -
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)
  )::BIGINT AS net_profit_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'capital_in' AND status = 'active'), 0)::BIGINT AS capital_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'withdrawal' AND status = 'active'), 0)::BIGINT AS withdrawal_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'in'), 0)::BIGINT AS adjustment_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'out'), 0)::BIGINT AS adjustment_out_paisa,
  COUNT(*) FILTER (WHERE status = 'active')::INT AS transaction_count
FROM public.transactions
GROUP BY business_date
ORDER BY business_date DESC;

-- 2. MONTHLY SUMMARY VIEW
CREATE OR REPLACE VIEW public.view_monthly_summary WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('month', business_date)::DATE AS month_start,
  EXTRACT(YEAR FROM business_date)::INT AS year,
  EXTRACT(MONTH FROM business_date)::INT AS month,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0)::BIGINT AS income_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)::BIGINT AS expense_paisa,
  (
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) -
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)
  )::BIGINT AS net_profit_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'capital_in' AND status = 'active'), 0)::BIGINT AS capital_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'withdrawal' AND status = 'active'), 0)::BIGINT AS withdrawal_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'in'), 0)::BIGINT AS adjustment_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'out'), 0)::BIGINT AS adjustment_out_paisa
FROM public.transactions
GROUP BY DATE_TRUNC('month', business_date), EXTRACT(YEAR FROM business_date), EXTRACT(MONTH FROM business_date)
ORDER BY month_start DESC;

-- 3. CATEGORY BREAKDOWN VIEW
CREATE OR REPLACE VIEW public.view_category_breakdown WITH (security_invoker = true) AS
SELECT
  t.business_date,
  t.type,
  c.id AS category_id,
  COALESCE(c.name, 'Uncategorized') AS category_name,
  SUM(t.amount_paisa)::BIGINT AS total_paisa,
  COUNT(t.id)::INT AS entry_count
FROM public.transactions t
LEFT JOIN public.categories c ON t.category_id = c.id
WHERE t.status = 'active' AND t.type IN ('income', 'expense')
GROUP BY t.business_date, t.type, c.id, c.name;

-- ============================================================================
-- PERMISSIONS, ROLE SECURITY & RLS POLICIES (MEMBER-ONLY ACCESS)
-- ============================================================================

-- Grant schema usage to authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Explicitly revoke all privileges from anon role on tables, views, sequences, functions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Revoke DELETE and TRUNCATE from authenticated role
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated, anon, public;

-- Revoke direct INSERT, UPDATE, DELETE on audit_log from authenticated (audit trigger writes it)
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon, public;

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shop_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.category_aliases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue FORCE ROW LEVEL SECURITY;

-- Anti-Spoofing Trigger: Guarantees created_by strictly equals auth.uid()
CREATE OR REPLACE FUNCTION public.enforce_transaction_author()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.created_by != auth.uid() THEN
    RAISE EXCEPTION 'Transaction created_by (%) cannot be spoofed; must match auth.uid() (%)', NEW.created_by, auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_transaction_author ON public.transactions;
CREATE TRIGGER trg_enforce_transaction_author
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_author();

-- Helper to check active membership
CREATE OR REPLACE FUNCTION public.is_active_shop_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shop_members WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Shop Members Policy
DROP POLICY IF EXISTS "Members can view membership" ON public.shop_members;
CREATE POLICY "Members can view membership" ON public.shop_members FOR SELECT TO authenticated
USING (public.is_active_shop_member());

-- Categories Policies
DROP POLICY IF EXISTS "Members can read categories" ON public.categories;
CREATE POLICY "Members can read categories" ON public.categories FOR SELECT TO authenticated
USING (public.is_active_shop_member());

DROP POLICY IF EXISTS "Members can insert categories" ON public.categories;
CREATE POLICY "Members can insert categories" ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.is_active_shop_member());

DROP POLICY IF EXISTS "Members can update categories" ON public.categories;
CREATE POLICY "Members can update categories" ON public.categories FOR UPDATE TO authenticated
USING (public.is_active_shop_member());

-- Category Aliases Policies
DROP POLICY IF EXISTS "Members can read aliases" ON public.category_aliases;
CREATE POLICY "Members can read aliases" ON public.category_aliases FOR SELECT TO authenticated
USING (public.is_active_shop_member());

DROP POLICY IF EXISTS "Members can manage aliases" ON public.category_aliases;
CREATE POLICY "Members can manage aliases" ON public.category_aliases FOR ALL TO authenticated
USING (public.is_active_shop_member());

-- Transactions Policies (Member-Only)
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT TO authenticated
USING (public.is_active_shop_member());

DROP POLICY IF EXISTS "Members can record transactions" ON public.transactions;
CREATE POLICY "Members can record transactions" ON public.transactions FOR INSERT TO authenticated
WITH CHECK (public.is_active_shop_member() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions" ON public.transactions FOR UPDATE TO authenticated
USING (public.is_active_shop_member());

-- Audit Log Policy: Read-only for authenticated shop members
DROP POLICY IF EXISTS "Members can view audit log" ON public.audit_log;
CREATE POLICY "Members can view audit log" ON public.audit_log FOR SELECT TO authenticated
USING (public.is_active_shop_member());

-- Review Queue Policy
DROP POLICY IF EXISTS "Members can manage review queue" ON public.review_queue;
CREATE POLICY "Members can manage review queue" ON public.review_queue FOR ALL TO authenticated
USING (public.is_active_shop_member());

-- Revoke all function executions from anon
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- INITIAL SEED (REAL SERVICES ONLY)
-- ============================================================================

INSERT INTO public.categories (id, name, kind, unusual_amount_limit_paisa, is_default, display_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Printing & Photocopy', 'income', 5000000, TRUE, 1),
  ('c1000000-0000-0000-0000-000000000002', 'Legal Stamp Paper', 'income', 30000000, FALSE, 2),
  ('c1000000-0000-0000-0000-000000000003', 'Lamination', 'income', 2000000, FALSE, 3),
  ('c1000000-0000-0000-0000-000000000004', 'Paper Stock Purchase', 'expense', 10000000, TRUE, 4),
  ('c1000000-0000-0000-0000-000000000005', 'Shop Supplies & Bills', 'expense', 5000000, FALSE, 5),
  ('c1000000-0000-0000-0000-000000000006', 'Stamp Paper Purchase', 'expense', 30000000, FALSE, 6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.category_aliases (category_id, alias)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'print'),
  ('c1000000-0000-0000-0000-000000000001', 'prnt'),
  ('c1000000-0000-0000-0000-000000000001', 'printing'),
  ('c1000000-0000-0000-0000-000000000001', 'copy'),
  ('c1000000-0000-0000-0000-000000000001', 'photocopy'),
  ('c1000000-0000-0000-0000-000000000001', 'fotocopy'),
  ('c1000000-0000-0000-0000-000000000001', 'xerox'),

  ('c1000000-0000-0000-0000-000000000002', 'stamp'),
  ('c1000000-0000-0000-0000-000000000002', 'stmp'),
  ('c1000000-0000-0000-0000-000000000002', 'stamp paper'),
  ('c1000000-0000-0000-0000-000000000002', 'affidavit'),
  ('c1000000-0000-0000-0000-000000000002', 'bayan'),

  ('c1000000-0000-0000-0000-000000000003', 'lamination'),
  ('c1000000-0000-0000-0000-000000000003', 'lmnation'),
  ('c1000000-0000-0000-0000-000000000003', 'lmnyon'),
  ('c1000000-0000-0000-0000-000000000003', 'lam'),

  ('c1000000-0000-0000-0000-000000000004', 'paper'),
  ('c1000000-0000-0000-0000-000000000004', 'a4 paper'),
  ('c1000000-0000-0000-0000-000000000004', 'legal paper'),
  ('c1000000-0000-0000-0000-000000000004', 'rim'),
  ('c1000000-0000-0000-0000-000000000004', 'ream'),

  ('c1000000-0000-0000-0000-000000000005', 'bill'),
  ('c1000000-0000-0000-0000-000000000005', 'electricity'),
  ('c1000000-0000-0000-0000-000000000005', 'toner'),
  ('c1000000-0000-0000-0000-000000000005', 'ink')
ON CONFLICT (alias) DO NOTHING;
