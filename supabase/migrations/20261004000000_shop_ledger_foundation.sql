-- ============================================================================
-- YAQUB ENTERPRISES MANAGER — MODERN MULTI-SHOP LEDGER FOUNDATION
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

-- 2. ORGANIZATIONS / SHOPS (Multi-Shop SaaS Foundation)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
  country TEXT DEFAULT 'Pakistan',
  timezone TEXT DEFAULT 'Asia/Karachi',
  business_category TEXT DEFAULT 'Physical Services & Documentation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.organizations (id, name, owner_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Yaqoob Enterprises', 'Jamal Yaqoob')
ON CONFLICT (id) DO NOTHING;

-- 3. SHOP MEMBERS (Team & Multi-User Collaboration within each Shop)
CREATE TABLE IF NOT EXISTS public.shop_members (
  user_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'OWNER';
CREATE INDEX IF NOT EXISTS idx_shop_members_org_user ON public.shop_members(organization_id, user_id);

-- 4. CATEGORIES (Per-Shop / Multi-Tenant Support)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL DEFAULT 'income',
  unusual_amount_limit_paisa BIGINT NOT NULL DEFAULT 5000000, -- Default Rs 50,000 in paisa
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kind public.category_kind DEFAULT 'income';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS unusual_amount_limit_paisa BIGINT DEFAULT 5000000;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.categories ALTER COLUMN type DROP NOT NULL;
EXCEPTION
  WHEN undefined_column THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.categories ADD CONSTRAINT ux_categories_name_org UNIQUE (organization_id, name);
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;

-- 5. CATEGORY ALIASES (exact/phonetic synonyms; no numeric aliases allowed)
CREATE TABLE IF NOT EXISTS public.category_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  match_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_category_alias UNIQUE (alias),
  CONSTRAINT chk_no_numeric_alias CHECK (alias !~ '^[0-9]+$')
);

-- 6. TRANSACTIONS (Core Ledger with Multi-Tenant & Multi-User Attribution)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
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

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

CREATE INDEX IF NOT EXISTS idx_transactions_org_date ON public.transactions(organization_id, business_date);
CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON public.transactions(business_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status_type ON public.transactions(status, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);

-- 7. AUDIT LOG (Immutable History of Edits and Voids - System Triggered Only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'void', 'restore')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL,
  changed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- 8. REVIEW QUEUE
CREATE TABLE IF NOT EXISTS public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  raw_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_category_id UUID REFERENCES public.categories(id),
  suggested_amount_paisa BIGINT,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.review_queue ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- HELPER FUNCTIONS FOR MULTI-SHOP ATTRIBUTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.shop_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_active_shop_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shop_members WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

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
    NEW.category_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.type = 'adjustment' THEN
    RETURN NEW;
  END IF;

  IF NEW.category_id IS NOT NULL THEN
    SELECT kind INTO cat_kind FROM public.categories WHERE id = NEW.category_id;
    IF cat_kind IS NOT NULL THEN
      IF NEW.type = 'income' AND cat_kind != 'income' THEN
        RAISE EXCEPTION 'Transaction type (%) does not match category kind (%)', NEW.type, cat_kind;
      ELSIF NEW.type = 'expense' AND cat_kind != 'expense' THEN
        RAISE EXCEPTION 'Transaction type (%) does not match category kind (%)', NEW.type, cat_kind;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_transaction_category ON public.transactions;
CREATE TRIGGER trg_check_transaction_category
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.check_transaction_category_match();

-- B. KARACHI BUSINESS DATE ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.set_karachi_business_date()
RETURNS TRIGGER AS $$
DECLARE
  today_karachi DATE := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
BEGIN
  IF NEW.business_date IS NULL THEN
    NEW.business_date := today_karachi;
  ELSIF NEW.business_date > today_karachi THEN
    RAISE EXCEPTION 'Future business dates are prohibited (% > %)', NEW.business_date, today_karachi;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_business_date ON public.transactions;
CREATE TRIGGER trg_set_business_date
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_karachi_business_date();

-- C. AUTO-POPULATE CREATED_BY, CREATED_BY_NAME & ORGANIZATION_ID ON INSERT
CREATE OR REPLACE FUNCTION public.enforce_transaction_insert_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member_name TEXT;
  v_org_id UUID;
BEGIN
  IF v_uid IS NOT NULL THEN
    NEW.created_by := v_uid;
    SELECT organization_id, full_name INTO v_org_id, v_member_name
    FROM public.shop_members
    WHERE user_id = v_uid
    LIMIT 1;

    IF v_org_id IS NOT NULL AND (NEW.organization_id IS NULL OR NEW.organization_id = '00000000-0000-0000-0000-000000000001'::UUID) THEN
      NEW.organization_id := v_org_id;
    END IF;

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
  IF OLD.updated_at != NEW.updated_at THEN
    RAISE EXCEPTION 'Stale update: transaction has been modified concurrently.';
  END IF;

  IF OLD.status = 'active' AND NEW.status = 'voided' THEN
    v_action := 'void';
  ELSIF OLD.status = 'voided' AND NEW.status = 'active' THEN
    v_action := 'restore';
  ELSE
    v_action := 'edit';
  END IF;

  NEW.updated_at := NOW();

  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.shop_members WHERE user_id = v_user_id;
  END IF;
  IF v_user_name IS NULL THEN v_user_name := COALESCE(NEW.created_by_name, 'Shop User'); END IF;

  INSERT INTO public.audit_log (transaction_id, organization_id, action, old_data, new_data, changed_by, changed_by_name)
  VALUES (NEW.id, NEW.organization_id, v_action, to_jsonb(OLD), to_jsonb(NEW), COALESCE(v_user_id, NEW.created_by), v_user_name);

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
-- PERMISSIONS, ROLE SECURITY & RLS POLICIES (MEMBER-ONLY & TENANT ISOLATION)
-- ============================================================================

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

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
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

-- Organizations Policy: Only shop members can see their own organization
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations FOR SELECT TO authenticated
USING (id IN (SELECT organization_id FROM public.shop_members WHERE user_id = auth.uid()));

-- Shop Members Policy
DROP POLICY IF EXISTS "Members can view membership" ON public.shop_members;
CREATE POLICY "Members can view membership" ON public.shop_members FOR SELECT TO authenticated
USING (public.is_active_shop_member() AND organization_id = public.get_auth_org_id());

-- Categories Policies (Tenant-Scoped)
DROP POLICY IF EXISTS "Members can read categories" ON public.categories;
CREATE POLICY "Members can read categories" ON public.categories FOR SELECT TO authenticated
USING (public.is_active_shop_member() AND (organization_id = public.get_auth_org_id() OR organization_id IS NULL));

DROP POLICY IF EXISTS "Members can insert categories" ON public.categories;
CREATE POLICY "Members can insert categories" ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.is_active_shop_member() AND (organization_id = public.get_auth_org_id() OR organization_id IS NULL));

DROP POLICY IF EXISTS "Members can update categories" ON public.categories;
CREATE POLICY "Members can update categories" ON public.categories FOR UPDATE TO authenticated
USING (public.is_active_shop_member() AND (organization_id = public.get_auth_org_id() OR organization_id IS NULL));

-- Category Aliases Policies
DROP POLICY IF EXISTS "Members can read aliases" ON public.category_aliases;
CREATE POLICY "Members can read aliases" ON public.category_aliases FOR SELECT TO authenticated
USING (public.is_active_shop_member());

DROP POLICY IF EXISTS "Members can manage aliases" ON public.category_aliases;
CREATE POLICY "Members can manage aliases" ON public.category_aliases FOR ALL TO authenticated
USING (public.is_active_shop_member());

-- Transactions Policies (Tenant-Scoped & Member-Only)
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT TO authenticated
USING (
  public.is_active_shop_member() AND
  (organization_id = public.get_auth_org_id() OR (organization_id IS NULL AND created_by = auth.uid()))
);

DROP POLICY IF EXISTS "Members can record transactions" ON public.transactions;
CREATE POLICY "Members can record transactions" ON public.transactions FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_shop_member() AND
  created_by = auth.uid() AND
  (organization_id = public.get_auth_org_id() OR organization_id IS NULL)
);

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions" ON public.transactions FOR UPDATE TO authenticated
USING (
  public.is_active_shop_member() AND
  (organization_id = public.get_auth_org_id() OR (organization_id IS NULL AND created_by = auth.uid()))
);

-- Audit Log Policy: Read-only for authenticated shop members in their organization
DROP POLICY IF EXISTS "Members can view audit log" ON public.audit_log;
CREATE POLICY "Members can view audit log" ON public.audit_log FOR SELECT TO authenticated
USING (public.is_active_shop_member() AND (organization_id = public.get_auth_org_id() OR organization_id IS NULL));

-- Review Queue Policy
DROP POLICY IF EXISTS "Members can manage review queue" ON public.review_queue;
CREATE POLICY "Members can manage review queue" ON public.review_queue FOR ALL TO authenticated
USING (public.is_active_shop_member() AND (organization_id = public.get_auth_org_id() OR organization_id IS NULL));

-- ============================================================================
-- AUTO-PROVISIONING ON SIGNUP (MULTI-SHOP SAAS SELF-SERVICE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_meta JSONB;
  v_org_id UUID;
  v_full_name TEXT;
  v_shop_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email, raw_user_meta_data
  INTO v_email, v_meta
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  -- Check if user is already a member of a shop
  IF EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = v_uid) THEN
    RETURN;
  END IF;

  v_full_name := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(v_meta->>'name', ''),
    split_part(v_email, '@', 1)
  );
  v_shop_name := COALESCE(
    NULLIF(v_meta->>'organization_name', ''),
    v_full_name || '''s Shop'
  );

  INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
  VALUES (v_shop_name, v_full_name, 'PKR', 'Rs.')
  RETURNING id INTO v_org_id;

  INSERT INTO public.shop_members (user_id, organization_id, full_name, email, role)
  VALUES (v_uid, v_org_id, v_full_name, v_email, 'OWNER')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.categories (organization_id, name, kind, unusual_amount_limit_paisa, is_default, display_order)
  VALUES
    (v_org_id, 'Printing & Photocopy', 'income', 5000000, TRUE, 1),
    (v_org_id, 'Legal Stamp Paper', 'income', 30000000, FALSE, 2),
    (v_org_id, 'Lamination', 'income', 2000000, FALSE, 3),
    (v_org_id, 'Paper Stock Purchase', 'expense', 10000000, TRUE, 4),
    (v_org_id, 'Shop Supplies & Bills', 'expense', 5000000, FALSE, 5),
    (v_org_id, 'Stamp Paper Purchase', 'expense', 30000000, FALSE, 6)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- INITIAL SEED (DEFAULT GLOBAL CATEGORIES)
-- ============================================================================

INSERT INTO public.categories (id, organization_id, name, kind, unusual_amount_limit_paisa, is_default, display_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Printing & Photocopy', 'income', 5000000, TRUE, 1),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Legal Stamp Paper', 'income', 30000000, FALSE, 2),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Lamination', 'income', 2000000, FALSE, 3),
  ('c1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Paper Stock Purchase', 'expense', 10000000, TRUE, 4),
  ('c1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Shop Supplies & Bills', 'expense', 5000000, FALSE, 5),
  ('c1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Stamp Paper Purchase', 'expense', 30000000, FALSE, 6)
ON CONFLICT DO NOTHING;

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
