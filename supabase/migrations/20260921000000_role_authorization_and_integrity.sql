-- Role-aware authorization and tenant-safe integrity policies.
CREATE OR REPLACE FUNCTION private.is_org_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org
      AND user_id = (SELECT auth.uid())
      AND is_active = TRUE
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE organization_id = target_org
      AND id = (SELECT auth.uid())
      AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION private.get_org_role(target_org UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = target_org AND user_id = (SELECT auth.uid()) AND is_active = TRUE
  UNION ALL
  SELECT role FROM public.profiles
  WHERE organization_id = target_org AND id = (SELECT auth.uid()) AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.is_org_owner(target_org UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT private.get_org_role(target_org) = 'OWNER';
$$;

CREATE OR REPLACE FUNCTION private.is_org_manager(target_org UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT private.get_org_role(target_org) IN ('OWNER', 'MANAGER');
$$;

CREATE OR REPLACE FUNCTION private.has_permission(target_org UUID, permission_name TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE private.get_org_role(target_org)
    WHEN 'OWNER' THEN TRUE
    WHEN 'MANAGER' THEN permission_name IN (
      'FAST_POS_CHECKOUT', 'RECORD_EXPENSES', 'SUBMIT_DAILY_CLOSING',
      'VOID_SALE', 'VOID_EXPENSE', 'MANAGE_INVENTORY', 'ACCOUNT_TRANSFER', 'VIEW_REPORTS_PL'
    )
    WHEN 'CASHIER' THEN permission_name IN (
      'FAST_POS_CHECKOUT', 'RECORD_EXPENSES', 'SUBMIT_DAILY_CLOSING'
    )
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION private.is_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_org_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_manager(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_permission(UUID, TEXT) TO authenticated;

-- Profiles cannot be used to self-promote or change organization ownership.
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- Remove tenant-only FOR ALL policies before adding role-aware policies.
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

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated USING (private.has_permission(organization_id, 'MANAGE_INVENTORY')) WITH CHECK (private.has_permission(organization_id, 'MANAGE_INVENTORY'));
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY products_write ON public.products FOR ALL TO authenticated USING (private.has_permission(organization_id, 'MANAGE_INVENTORY')) WITH CHECK (private.has_permission(organization_id, 'MANAGE_INVENTORY'));
CREATE POLICY services_select ON public.services FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY services_write ON public.services FOR ALL TO authenticated USING (private.has_permission(organization_id, 'MANAGE_INVENTORY')) WITH CHECK (private.has_permission(organization_id, 'MANAGE_INVENTORY'));
CREATE POLICY service_components_select ON public.service_components FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY service_components_write ON public.service_components FOR ALL TO authenticated USING (private.has_permission(organization_id, 'MANAGE_INVENTORY')) WITH CHECK (private.has_permission(organization_id, 'MANAGE_INVENTORY'));
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY stock_movements_write ON public.stock_movements FOR ALL TO authenticated USING (private.has_permission(organization_id, 'MANAGE_INVENTORY')) WITH CHECK (private.has_permission(organization_id, 'MANAGE_INVENTORY'));
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY customers_write ON public.customers FOR ALL TO authenticated USING (private.is_org_member(organization_id)) WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY accounts_select ON public.payment_accounts FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY accounts_write ON public.payment_accounts FOR ALL TO authenticated USING (private.is_org_owner(organization_id)) WITH CHECK (private.is_org_owner(organization_id));
CREATE POLICY transfers_select ON public.account_transfers FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY transfers_write ON public.account_transfers FOR ALL TO authenticated USING (private.has_permission(organization_id, 'ACCOUNT_TRANSFER')) WITH CHECK (private.has_permission(organization_id, 'ACCOUNT_TRANSFER'));
CREATE POLICY transactions_select ON public.account_transactions FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY transactions_write ON public.account_transactions FOR INSERT TO authenticated WITH CHECK (private.has_permission(organization_id, 'ACCOUNT_TRANSFER') OR private.has_permission(organization_id, 'FAST_POS_CHECKOUT') OR private.has_permission(organization_id, 'RECORD_EXPENSES'));
CREATE POLICY expense_categories_select ON public.expense_categories FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY expense_categories_write ON public.expense_categories FOR ALL TO authenticated USING (private.is_org_owner(organization_id)) WITH CHECK (private.is_org_owner(organization_id));
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (private.has_permission(organization_id, 'RECORD_EXPENSES'));
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated USING (private.has_permission(organization_id, 'VOID_EXPENSE')) WITH CHECK (private.has_permission(organization_id, 'VOID_EXPENSE'));
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY sales_insert ON public.sales FOR INSERT TO authenticated WITH CHECK (private.has_permission(organization_id, 'FAST_POS_CHECKOUT'));
CREATE POLICY sales_update ON public.sales FOR UPDATE TO authenticated USING (private.has_permission(organization_id, 'VOID_SALE')) WITH CHECK (private.has_permission(organization_id, 'VOID_SALE'));
CREATE POLICY sale_items_select ON public.sale_items FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY sale_items_insert ON public.sale_items FOR INSERT TO authenticated WITH CHECK (private.has_permission(organization_id, 'FAST_POS_CHECKOUT'));
CREATE POLICY closings_select ON public.daily_closings FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY closings_insert ON public.daily_closings FOR INSERT TO authenticated WITH CHECK (private.has_permission(organization_id, 'SUBMIT_DAILY_CLOSING'));
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (private.is_org_member(organization_id));

-- Cross-tenant references are rejected by validation triggers, not only by foreign keys.
CREATE OR REPLACE FUNCTION private.enforce_same_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'expenses' AND NOT EXISTS (
    SELECT 1 FROM public.payment_accounts a WHERE a.id = NEW.account_id AND a.organization_id = NEW.organization_id
  ) THEN RAISE EXCEPTION 'Expense account belongs to another organization'; END IF;
  IF TG_TABLE_NAME = 'sales' AND NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = NEW.customer_id AND c.organization_id = NEW.organization_id
  ) THEN RAISE EXCEPTION 'Sale customer belongs to another organization'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_same_org ON public.expenses;
CREATE TRIGGER expenses_same_org BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.enforce_same_organization();
DROP TRIGGER IF EXISTS sales_same_org ON public.sales;
CREATE TRIGGER sales_same_org BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION private.enforce_same_organization();
