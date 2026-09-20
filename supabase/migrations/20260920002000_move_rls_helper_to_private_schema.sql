-- =================================================================================
-- YAQOOB ENTERPRISES MANAGER: MOVE RLS HELPER OUT OF EXPOSED PUBLIC SCHEMA
-- Migration: 20260920002000_move_rls_helper_to_private_schema.sql
-- =================================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.get_auth_user_org_ids()
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

REVOKE ALL ON FUNCTION private.get_auth_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_auth_user_org_ids() TO authenticated;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
DROP POLICY IF EXISTS organizations_update ON public.organizations;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS organization_members_select ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_insert ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_update ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_delete ON public.organization_members;
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
    USING (id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY organizations_update ON public.organizations
    FOR UPDATE TO authenticated
    USING (id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = (SELECT auth.uid()) OR
        organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids())
    );

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (
        id = (SELECT auth.uid()) AND
        organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids())
    );

CREATE POLICY organization_members_select ON public.organization_members
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid()) OR
        organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids())
    );

CREATE POLICY organization_members_owner_insert ON public.organization_members
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = (SELECT auth.uid()) AND role = 'OWNER' AND is_active = TRUE
        )
    );

CREATE POLICY organization_members_owner_update ON public.organization_members
    FOR UPDATE TO authenticated
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

CREATE POLICY organization_members_owner_delete ON public.organization_members
    FOR DELETE TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = (SELECT auth.uid()) AND role = 'OWNER' AND is_active = TRUE
        )
    );

CREATE POLICY categories_tenant_access ON public.categories
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY products_tenant_access ON public.products
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY services_tenant_access ON public.services
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY service_components_tenant_access ON public.service_components
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY stock_movements_tenant_access ON public.stock_movements
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY customers_tenant_access ON public.customers
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY payment_accounts_tenant_access ON public.payment_accounts
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY account_transfers_tenant_access ON public.account_transfers
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY account_transactions_tenant_access ON public.account_transactions
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY expense_categories_tenant_access ON public.expense_categories
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY expenses_tenant_access ON public.expenses
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY sales_tenant_access ON public.sales
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY sale_items_tenant_access ON public.sale_items
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY daily_closings_tenant_access ON public.daily_closings
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

CREATE POLICY audit_logs_tenant_access ON public.audit_logs
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()))
    WITH CHECK (organization_id IN (SELECT org_id FROM private.get_auth_user_org_ids()));

DROP FUNCTION IF EXISTS public.get_auth_user_org_ids();
