-- =================================================================================
-- YAQOOB ENTERPRISES MANAGER: DATABASE SCHEMA & MULTI-TENANT RLS SPECIFICATION
-- =================================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    country VARCHAR(100) DEFAULT 'Pakistan',
    timezone VARCHAR(100) DEFAULT 'Asia/Karachi',
    business_category VARCHAR(150) DEFAULT 'Printing & Stationery',
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    tax_enabled BOOLEAN DEFAULT FALSE,
    receipt_footer TEXT,
    invoice_prefix VARCHAR(20) DEFAULT 'YE-',
    next_invoice_number BIGINT DEFAULT 1001,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORGANIZATION MEMBERS (Multi-tenant membership & RBAC)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'CASHIER' CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PRODUCT', 'SERVICE', 'BOTH')),
    color VARCHAR(20) DEFAULT '#06B6D4',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCTS / INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    unit VARCHAR(50) NOT NULL DEFAULT 'Pcs',
    purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    opening_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    min_stock_threshold NUMERIC(14,2) NOT NULL DEFAULT 5.00,
    track_stock BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    supplier VARCHAR(255),
    notes TEXT,
    average_cost NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    stock_value NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SERVICES
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    selling_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    estimated_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SERVICE COMPONENTS / RECIPES (Optional inventory consumption)
CREATE TABLE IF NOT EXISTS public.service_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_consumed NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. STOCK MOVEMENTS (Audit-traceable inventory flow)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (
        movement_type IN (
            'OPENING_STOCK', 'PURCHASE', 'SALE', 'ADJUSTMENT_INCREASE',
            'ADJUSTMENT_DECREASE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN',
            'DAMAGE_WASTAGE', 'CORRECTION'
        )
    ),
    quantity NUMERIC(14,2) NOT NULL,
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    total_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    total_purchases NUMERIC(14,2) DEFAULT 0.00,
    last_purchase_date TIMESTAMPTZ,
    outstanding_balance NUMERIC(14,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PAYMENT ACCOUNTS
CREATE TABLE IF NOT EXISTS public.payment_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER')),
    account_number VARCHAR(100),
    current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ACCOUNT TRANSFERS
CREATE TABLE IF NOT EXISTS public.account_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES public.payment_accounts(id),
    to_account_id UUID NOT NULL REFERENCES public.payment_accounts(id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    notes TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ACCOUNT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.payment_accounts(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT')),
    amount NUMERIC(14,2) NOT NULL,
    balance_after NUMERIC(14,2) NOT NULL,
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('SALE', 'EXPENSE', 'TRANSFER', 'CLOSING')),
    reference_id VARCHAR(100),
    description TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id),
    account_id UUID NOT NULL REFERENCES public.payment_accounts(id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    date DATE NOT NULL,
    notes TEXT,
    entered_by VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VOIDED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. SALES
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
    customer_phone VARCHAR(50),
    cashier_id VARCHAR(100) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    change_due NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    split_payments JSONB DEFAULT '[]'::jsonb,
    total_cogs NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    notes TEXT,
    void_reason TEXT,
    voided_by VARCHAR(255),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. SALE ITEMS
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('PRODUCT', 'SERVICE')),
    item_id UUID NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    unit VARCHAR(50),
    quantity NUMERIC(14,2) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(14,2) NOT NULL,
    total NUMERIC(14,2) NOT NULL,
    cogs NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00
);

-- 18. DAILY CLOSINGS
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL,
    opening_cash NUMERIC(14,2) NOT NULL,
    cash_sales NUMERIC(14,2) NOT NULL,
    cash_expenses NUMERIC(14,2) NOT NULL,
    cash_transfers_in NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    cash_transfers_out NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(14,2) NOT NULL,
    actual_cash NUMERIC(14,2) NOT NULL,
    difference NUMERIC(14,2) NOT NULL,
    notes TEXT,
    closed_by VARCHAR(255) NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, closing_date)
);

-- 19. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================================
-- INDEXES FOR HIGH PERFORMANCE
-- =================================================================================
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_services_org ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_prod ON public.stock_movements(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_org_date ON public.sales(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON public.sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON public.expenses(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_acc_date ON public.account_transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON public.audit_logs(organization_id, created_at);

-- =================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================================

-- Security helper: check user's associated organization IDs
CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid() AND is_active = TRUE
    UNION
    SELECT organization_id
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- Enable RLS on all business tables
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

-- Dynamic RLS Policies: Members only access their organization data
CREATE POLICY org_member_select ON public.organizations
    FOR SELECT USING (id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY org_member_update ON public.organizations
    FOR UPDATE USING (id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY products_isolation ON public.products
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY services_isolation ON public.services
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY stock_movements_isolation ON public.stock_movements
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY customers_isolation ON public.customers
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY accounts_isolation ON public.payment_accounts
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY transfers_isolation ON public.account_transfers
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY transactions_isolation ON public.account_transactions
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY expenses_isolation ON public.expenses
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY sales_isolation ON public.sales
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY sale_items_isolation ON public.sale_items
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY daily_closings_isolation ON public.daily_closings
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));

CREATE POLICY audit_logs_isolation ON public.audit_logs
    FOR ALL USING (organization_id IN (SELECT org_id FROM public.get_auth_user_org_ids()));
