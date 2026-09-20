-- =================================================================================
-- YAQOOB ENTERPRISES MANAGER: RLS HARDENING, MULTI-TENANT PROVISIONING & SYNC COLUMNS
-- Migration: 20260919000000_harden_rls_and_auth.sql
-- =================================================================================

-- 1. ADD SYNC METADATA COLUMNS TO ALL CLOUD TABLES
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.service_components ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'synced';

-- 2. COMPLETE MISSING ROW LEVEL SECURITY (RLS) POLICIES

-- Policies for Categories
DROP POLICY IF EXISTS categories_isolation ON public.categories;
CREATE POLICY categories_isolation ON public.categories
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

-- Policies for Expense Categories
DROP POLICY IF EXISTS expense_categories_isolation ON public.expense_categories;
CREATE POLICY expense_categories_isolation ON public.expense_categories
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

-- Policies for Service Components
DROP POLICY IF EXISTS service_components_isolation ON public.service_components;
CREATE POLICY service_components_isolation ON public.service_components
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

-- Policies for User Profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR
        organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids())
    );

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Policies for Organization Members
DROP POLICY IF EXISTS members_select ON public.organization_members;
CREATE POLICY members_select ON public.organization_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids())
    );

DROP POLICY IF EXISTS members_manage ON public.organization_members;
CREATE POLICY members_manage ON public.organization_members
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role = 'OWNER'
        )
    );

-- 3. AUTOMATED SECURE TENANT & PROFILE INITIALIZATION TRIGGER
-- When a user signs up via Supabase Auth, securely create their organization and initial Owner profile.
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
    org_name_val TEXT;
    full_name_val TEXT;
BEGIN
    org_name_val := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Yaqoob Enterprises');
    full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

    -- 1. Create Organization
    INSERT INTO public.organizations (name, owner_name, currency, currency_symbol)
    VALUES (org_name_val, full_name_val, 'PKR', 'Rs.')
    RETURNING id INTO new_org_id;

    -- 2. Create User Profile
    INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_active)
    VALUES (NEW.id, NEW.email, full_name_val, 'OWNER', new_org_id, TRUE);

    -- 3. Create Organization Membership
    INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
    VALUES (new_org_id, NEW.id, 'OWNER', TRUE);

    -- 4. Seed Standard Default Payment Accounts
    INSERT INTO public.payment_accounts (organization_id, name, type, current_balance, opening_balance, is_default)
    VALUES
        (new_org_id, 'Cash Drawer (Shop Till)', 'CASH', 10000.00, 10000.00, TRUE),
        (new_org_id, 'Business Bank Account (HBL/Meezan)', 'BANK', 50000.00, 50000.00, FALSE),
        (new_org_id, 'JazzCash Merchant Wallet', 'DIGITAL_WALLET', 5000.00, 5000.00, FALSE),
        (new_org_id, 'Easypaisa Business Wallet', 'DIGITAL_WALLET', 5000.00, 5000.00, FALSE);

    -- 5. Seed Standard Categories
    INSERT INTO public.categories (organization_id, name, type, color)
    VALUES
        (new_org_id, 'Printing & Photocopying', 'SERVICE', '#06B6D4'),
        (new_org_id, 'Documentation & Legal Drafting', 'SERVICE', '#3B82F6'),
        (new_org_id, 'Paper & Consumables', 'PRODUCT', '#10B981'),
        (new_org_id, 'Office Stationery', 'PRODUCT', '#F59E0B');

    -- 6. Seed Standard Expense Categories
    INSERT INTO public.expense_categories (organization_id, name, description)
    VALUES
        (new_org_id, 'Paper & Ink Purchases', 'Direct raw material and consumables'),
        (new_org_id, 'Shop Electricity & Utilities', 'Commercial electricity and power backup'),
        (new_org_id, 'Shop Rent & Maintenance', 'Monthly shop rental and repairs'),
        (new_org_id, 'Tea, Refreshments & General', 'Daily staff tea and cleaning supplies');

    RETURN NEW;
END;
$$;

-- Register trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_registration();
