-- =================================================================================
-- YAQOOB ENTERPRISES MANAGER: FK INDEXES & ORGANIZATION MEMBER POLICY SPLIT
-- Migration: 20260920001000_add_fk_indexes_and_split_member_policies.sql
-- =================================================================================

CREATE INDEX IF NOT EXISTS idx_account_transactions_org ON public.account_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_from_account ON public.account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_org ON public.account_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to_account ON public.account_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_org ON public.expense_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_org ON public.payment_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_org ON public.sale_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_components_org ON public.service_components(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_components_product ON public.service_components(product_id);
CREATE INDEX IF NOT EXISTS idx_service_components_service ON public.service_components(service_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);

DROP POLICY IF EXISTS organization_members_owner_manage ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_insert ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_update ON public.organization_members;
DROP POLICY IF EXISTS organization_members_owner_delete ON public.organization_members;

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
