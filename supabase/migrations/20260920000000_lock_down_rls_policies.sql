-- =================================================================================
-- YAQOOB ENTERPRISES MANAGER: RLS LOCKDOWN & POLICY CHECK HARDENING
-- Migration: 20260920000000_lock_down_rls_policies.sql
-- =================================================================================

-- Keep helper functions callable only by signed-in users. RLS policies call this
-- helper for tenant membership checks, so anon should never execute it directly.
CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = (SELECT auth.uid()) AND is_active = TRUE
    UNION
    SELECT organization_id
    FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_active = TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_org_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user_registration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_registration() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_registration() FROM authenticated;

-- Data API access is granted to authenticated sessions only; RLS below decides rows.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Ensure all tenant tables remain protected.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_member_select ON public.organizations;
DROP POLICY IF EXISTS org_member_update ON public.organizations;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_manage ON public.organization_members;

DROP POLICY IF EXISTS categories_isolation ON public.categories;
DROP POLICY IF EXISTS products_isolation ON public.products;
DROP POLICY IF EXISTS services_isolation ON public.services;
DROP POLICY IF EXISTS service_components_isolation ON public.service_components;
DROP POLICY IF EXISTS stock_movements_isolation ON public.stock_movements;
DROP POLICY IF EXISTS customers_isolation ON public.customers;
DROP POLICY IF EXISTS accounts_isolation ON public.payment_accounts;
DROP POLICY IF EXISTS transfers_isolation ON public.account_transfers;
DROP POLICY IF EXISTS transactions_isolation ON public.account_transactions;
DROP POLICY IF EXISTS expense_categories_isolation ON public.expense_categories;
DROP POLICY IF EXISTS expenses_isolation ON public.expenses;
DROP POLICY IF EXISTS sales_isolation ON public.sales;
DROP POLICY IF EXISTS sale_items_isolation ON public.sale_items;
DROP POLICY IF EXISTS daily_closings_isolation ON public.daily_closings;
DROP POLICY IF EXISTS audit_logs_isolation ON public.audit_logs;

-- This migration is safe to rerun if a prior deployment applied statements
-- before failing. Remove the policy names created below before recreating them.
DROP POLICY IF EXISTS organizations_select ON public.organizations;
DROP POLICY IF EXISTS organizations_update ON public.organizations;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS organization_members_select ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_manage ON public.organization_members;
DROP POLICY IF EXISTS categories_tenant_access ON public.categories;
DROP POLICY IF EXISTS products_tenant_access ON public.products;
DROP POLICY IF EXISTS services_tenant_access ON public.services;
DROP POLICY IF EXISTS service_components_tenant_access ON public.service_components;
DROP POLICY IF EXISTS stock_movements_tenant_access ON public.stock_movements;
DROP POLICY IF EXISTS customers_tenant_access ON public.customers;
DROP POLICY IF EXISTS payment_accounts_tenant_access ON public.payment_accounts;
DROP POLICY IF EXISTS account_transfers_tenant_access ON public.account_transfers;
DROP POLICY IF EXISTS account_transactions_tenant_access ON public.account_transactions;
DROP POLICY IF EXISTS expense_categories_tenant_access ON public.expense_categories;
DROP POLICY IF EXISTS expenses_tenant_access ON public.expenses;
DROP POLICY IF EXISTS sales_tenant_access ON public.sales;
DROP POLICY IF EXISTS sale_items_tenant_access ON public.sale_items;
DROP POLICY IF EXISTS daily_closings_tenant_access ON public.daily_closings;
DROP POLICY IF EXISTS audit_logs_tenant_access ON public.audit_logs;

CREATE POLICY organizations_select ON public.organizations
    FOR SELECT TO authenticated
    USING (id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY organizations_update ON public.organizations
    FOR UPDATE TO authenticated
    USING (id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = (SELECT auth.uid()) OR
        organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids())
    );

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (
        id = (SELECT auth.uid()) AND
        organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids())
    );

CREATE POLICY organization_members_select ON public.organization_members
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid()) OR
        organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids())
    );

CREATE POLICY organization_members_owner_manage ON public.organization_members
    FOR ALL TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = (SELECT auth.uid()) AND role = 'OWNER' AND is_active = TRUE
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = (SELECT auth.uid()) AND role = 'OWNER' AND is_active = TRUE
        )
    );

CREATE POLICY categories_tenant_access ON public.categories
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY products_tenant_access ON public.products
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY services_tenant_access ON public.services
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY service_components_tenant_access ON public.service_components
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY stock_movements_tenant_access ON public.stock_movements
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY customers_tenant_access ON public.customers
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY payment_accounts_tenant_access ON public.payment_accounts
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY account_transfers_tenant_access ON public.account_transfers
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY account_transactions_tenant_access ON public.account_transactions
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY expense_categories_tenant_access ON public.expense_categories
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY expenses_tenant_access ON public.expenses
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY sales_tenant_access ON public.sales
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY sale_items_tenant_access ON public.sale_items
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY daily_closings_tenant_access ON public.daily_closings
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY audit_logs_tenant_access ON public.audit_logs
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));
