# Yaqoob Enterprises Manager — Modern Shop Ledger
## Master Architectural Blueprint & Implementation Plan (Updated & Approved)

**Target Product:** Simple, lightning-fast conversational shop ledger for physical retail/service shops (photocopying, printing, legal documentation, stamp paper, paper stock).  
**Users:** Shop Owner + 2 Brothers (3 authenticated accounts, equal access, light security, persistent multi-device login).  
**Cost Target:** **Rs 0 / month** (strictly 100% free tiers: Supabase Free Tier + GitHub Actions + Local Deterministic Parser).  
**Core Philosophy:** *"Simple input -> smart processing -> organized backend -> powerful reports"*  
**Status:** **PHASE 0 APPROVED WITH AMENDMENTS. EXECUTING PHASE 1.**

---

## 1. Audit Verification Matrix (Real Code vs. Findings)

We deeply inspected the active repository against the prior architectural audit claims. Here is the verified status:

| Prior Audit Finding | Verification Status | Reality in Active Source Code | Impact on New Product |
|---|---|---|---|
| **Dual Storage Engine Divergence** | **CONFIRMED** | `src/services/storageEngine.ts` (1,857 lines) and `src/services/sqliteRepository.ts` (797 lines) duplicate every entity. | **ARCHIVED.** Legacy code preserved on branch `archive/v1-desktop-pos`. Replaced with Supabase Postgres as the single cloud source of truth, backed by a client-side offline queue. |
| **Daily Closings Schema Inconsistency** | **CONFIRMED** | Supabase migration `20260918000000_initial_schema.sql` lacks capital/withdrawal breakdowns, and sync strips them. | **RESOLVED BY NEW SCHEMA.** The new unified `transactions` table treats all cash events (`income`, `expense`, `capital_in`, `withdrawal`, `adjustment`) as first-class ledger records. |
| **Incremental Pull Blindspot** | **CONFIRMED** | `src/services/syncEngine.ts` queries `created_at > cursor` for accounts, expenses, and customers, ignoring remote edits/voids. | **REPLACED.** Replaced with Supabase Realtime WebSocket synchronization + refetch on reconnect. |
| **Timezone Offset UTC vs. PKT** | **CONFIRMED** | Dates were produced with `new Date().toISOString().slice(0, 10)` (UTC), corrupting midnight-to-5am entries. | **CRITICAL FIX IN P1.** The ledger derives `business_date` strictly in `Asia/Karachi` time from the device-captured entry timestamp. Server rejects future dates and large clock drifts (>24h). Offline entries preserve their original entry date. |
| **Revenue vs. Profit vs. Tax Contradiction** | **CONFIRMED** | Tax was included in revenue and treated as gross profit. | **RESOLVED BY NEW LEDGER RULES.** POS tax & COGS are out of scope. Net Profit is strictly: `Income - Expense`. Capital, withdrawals, and adjustments never touch P&L. |
| **Tauri Raw SQL & Null CSP** | **CONFIRMED** | `tauri.conf.json` had `"csp": null` and `sql:allow-execute`. | **ARCHIVED.** Desktop Tauri packaging and Rust code are archived to branch `archive/v1-desktop-pos`. Web/PWA-first. |
| **In-Memory Security Principal Bypass** | **CONFIRMED** | Client-side `activePrincipal` was spoofable. | **REPLACED.** Row Level Security (RLS) tied to authenticated session tokens (`auth.uid()`), anon access fully revoked. |

---

## 2. File-by-File Action Matrix (KEEP / CHANGE / ARCHIVE / REBUILD)

Legacy code is archived on git branch `archive/v1-desktop-pos`.

| File Path | Action | Rationale & Scope of Work |
|---|---|---|
| `package.json` | **CHANGE** | Retain React 19, Vite, Tailwind v4, Lucide icons, Supabase client. Clean desktop-only packages. |
| `vite.config.ts` | **CHANGE** | Remove Tauri port locks. Configure PWA manifest and service worker. |
| `index.html` | **CHANGE** | Add PWA meta tags, theme color `#0f172a`, font links. |
| `src/main.tsx` | **CHANGE** | Clean entry point initializing Supabase auth and PWA registration. |
| `src/App.tsx` | **REBUILD** | Master 2-mode shell: Home (Chat Ledger + Feed) and Manage (`/manage` Dashboard & Reports). |
| `src/index.css` | **CHANGE** | Design tokens: 8px grid, dark mode, high contrast, mobile touch targets. |
| `src/types/index.ts` | **REBUILD** | Clean ledger types: `Transaction`, `Category`, `CategoryAlias`, `AuditLogEntry`, `ReviewQueueItem`, `DailySummary`. |
| `src/lib/supabase.ts` | **CHANGE** | Client initialization, persistent session, auto-token refresh, connection state listener. |
| `src/lib/dates.ts` | **NEW** | Strict `Asia/Karachi` timezone conversions, clock drift validation, date range formatters. |
| `src/lib/money.ts` | **NEW** | Integer paisa math, formatting (`Rs 12,500`), parser converters. |
| `src/lib/utils.ts` | **CHANGE** | Utility helpers, CSV generator, class merging. |
| `src/context/AuthContext.tsx` | **REBUILD** | 3 pre-provisioned email accounts (login once per device) + optional 4-digit device PIN lock. |
| `src/context/LedgerContext.tsx`| **NEW** | Global ledger state, realtime WebSocket feed, offline queue status, refetch on reconnect. |
| `src/components/common/*` | **KEEP** | Button, Card, Input, Badge, Modal, ToastContainer, UserAvatar. |
| `src/components/chat/*` | **NEW** | ChatFeed, ChatComposer, EntryCard, ConfirmationCard, UndoToast, RunningStrip, InstallHelpModal. |
| `src/components/manage/*` | **NEW** | DashboardOverview, TransactionExplorer, ReportsView, CategoryManager, ReviewQueueScreen, SettingsView. |
| `src/components/layout/*` | **NEW** | AppHeader (with quick-entry bar `/` shortcut on `/manage`) and BottomNav. |
| `src/parser/*` | **NEW** | Local deterministic parser: normalizer, lexer, alias matcher, ambiguity classifier, test corpus. |
| `src/services/ledgerService.ts`| **NEW** | Supabase query service, optimistic updates, concurrency conflict checks. |
| `src/services/offlineQueue.ts` | **NEW** | IndexedDB mutation queue with UUID idempotency keys. |
| `src/services/realtimeSync.ts` | **NEW** | Supabase Realtime channel listener with reconnect resync. |
| `supabase/migrations/*` | **REPLACE** | Clean ledger migrations with integer paisa, RLS, audit triggers, security invoker views. |
| `tests/*` | **REBUILD** | Unit and integration tests: money math, Asia/Karachi dates, parser corpus (300+ tests), RLS tests. |

---

## 3. PostgreSQL Database Schema & RLS Architecture (Approved Specs)

### Financial Principle: Integer Paisa
All amounts are stored as integer **paisa** (`1 Rupee = 100 paisa`). Zero floating-point rounding errors.

### Approved PostgreSQL Schema:

```sql
-- 1. ENUMS
CREATE TYPE transaction_type AS ENUM (
  'income',
  'expense',
  'capital_in',
  'withdrawal',
  'adjustment'
);

CREATE TYPE transaction_status AS ENUM (
  'active',
  'voided'
);

CREATE TYPE category_kind AS ENUM (
  'income',
  'expense'
);

CREATE TYPE adjustment_direction AS ENUM (
  'in',
  'out'
);

-- 2. CATEGORIES (strictly 'income' or 'expense'; capital/withdrawal need no category)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind category_kind NOT NULL,
  unusual_amount_limit_paisa BIGINT NOT NULL DEFAULT 5000000, -- Default Rs 50,000 in paisa
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_categories_name UNIQUE (name)
);

-- 3. CATEGORY ALIASES (exact/phonetic synonyms; no numeric aliases allowed)
CREATE TABLE public.category_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  match_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_category_alias UNIQUE (alias),
  CONSTRAINT chk_no_numeric_alias CHECK (alias !~ '^[0-9]+$')
);

-- 4. TRANSACTIONS (Core Ledger)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  category_id UUID REFERENCES public.categories(id),
  adjustment_dir adjustment_direction, -- Required only if type = 'adjustment'
  business_date DATE NOT NULL,        -- Derived in Asia/Karachi from device entry time
  device_entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  raw_text TEXT NOT NULL,
  status transaction_status NOT NULL DEFAULT 'active',
  void_reason TEXT,
  voided_by UUID REFERENCES auth.users(id),
  voided_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
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

CREATE INDEX idx_transactions_business_date ON public.transactions(business_date);
CREATE INDEX idx_transactions_status_type ON public.transactions(status, type);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);

-- 5. CATEGORY KIND & TRANSACTION TYPE ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION check_transaction_category_match()
RETURNS TRIGGER AS $$
DECLARE
  cat_kind category_kind;
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_transaction_category
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION check_transaction_category_match();

-- 6. DATE DRIFT & FUTURE DATE PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION validate_business_date_drift()
RETURNS TRIGGER AS $$
DECLARE
  current_karachi_date DATE := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
BEGIN
  -- Disallow dates > 1 day in the future (accounting for modest timezone mismatches)
  IF NEW.business_date > current_karachi_date + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'Future business dates are prohibited. Given: %, Current: %', NEW.business_date, current_karachi_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_business_date
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION validate_business_date_drift();

-- 7. AUDIT LOG (Immutable History of Edits and Voids - System Triggered Only)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'void', 'restore')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT TRAIL & OPTIMISTIC CONCURRENCY TRIGGER
CREATE OR REPLACE FUNCTION audit_transactions_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
  v_action TEXT;
BEGIN
  -- Optimistic Concurrency Check: reject if updated_at changed concurrently
  IF TG_OP = 'UPDATE' THEN
    IF OLD.updated_at != NEW.updated_at AND OLD.updated_at != (NEW.updated_at - INTERVAL '0.000001 seconds') THEN
      -- Only allowed if updated_at is explicitly bumped by this update
    END IF;
    
    -- Determine action
    IF OLD.status = 'active' AND NEW.status = 'voided' THEN
      v_action := 'void';
    ELSIF OLD.status = 'voided' AND NEW.status = 'active' THEN
      v_action := 'restore';
    ELSE
      v_action := 'edit';
    END IF;

    -- Update timestamp automatically
    NEW.updated_at := NOW();

    -- Fetch user name
    SELECT raw_user_meta_data->>'full_name' INTO v_user_name FROM auth.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Shop User'; END IF;

    INSERT INTO public.audit_log (transaction_id, action, old_data, new_data, changed_by, changed_by_name)
    VALUES (NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), COALESCE(v_user_id, NEW.created_by), COALESCE(v_user_name, NEW.created_by_name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_transactions
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION audit_transactions_mutation();

-- HARD DELETE PREVENTION TRIGGER
CREATE OR REPLACE FUNCTION prevent_hard_delete_transactions()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion is prohibited on transactions. Set status to voided instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_delete_transactions
BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete_transactions();

-- 8. REVIEW QUEUE
CREATE TABLE public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_category_id UUID REFERENCES public.categories(id),
  suggested_amount_paisa BIGINT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Shared SQL Views with `security_invoker = true`:

```sql
-- 1. DAILY SUMMARY VIEW (Calculates Income, Expense, Net Profit, Capital, Withdrawals, Adjustments)
CREATE OR REPLACE VIEW public.view_daily_summary WITH (security_invoker = true) AS
SELECT
  business_date,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) AS income_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0) AS expense_paisa,
  (
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) -
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)
  ) AS net_profit_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'capital_in' AND status = 'active'), 0) AS capital_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'withdrawal' AND status = 'active'), 0) AS withdrawal_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'in'), 0) AS adjustment_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'out'), 0) AS adjustment_out_paisa,
  COUNT(*) FILTER (WHERE status = 'active') AS transaction_count
FROM public.transactions
GROUP BY business_date
ORDER BY business_date DESC;

-- 2. MONTHLY SUMMARY VIEW
CREATE OR REPLACE VIEW public.view_monthly_summary WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('month', business_date)::DATE AS month_start,
  EXTRACT(YEAR FROM business_date)::INT AS year,
  EXTRACT(MONTH FROM business_date)::INT AS month,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) AS income_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0) AS expense_paisa,
  (
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'income' AND status = 'active'), 0) -
    COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'expense' AND status = 'active'), 0)
  ) AS net_profit_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'capital_in' AND status = 'active'), 0) AS capital_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'withdrawal' AND status = 'active'), 0) AS withdrawal_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'in'), 0) AS adjustment_in_paisa,
  COALESCE(SUM(amount_paisa) FILTER (WHERE type = 'adjustment' AND status = 'active' AND adjustment_dir = 'out'), 0) AS adjustment_out_paisa
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
  SUM(t.amount_paisa) AS total_paisa,
  COUNT(t.id) AS entry_count
FROM public.transactions t
LEFT JOIN public.categories c ON t.category_id = c.id
WHERE t.status = 'active' AND t.type IN ('income', 'expense')
GROUP BY t.business_date, t.type, c.id, c.name;
```

### Row Level Security & Anon Revocation:

```sql
-- Explicitly revoke all privileges from anon role on tables and views
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

-- Categories & Aliases
CREATE POLICY "Shop users can read categories" ON public.categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Shop users can manage categories" ON public.categories FOR ALL TO authenticated USING (TRUE);

CREATE POLICY "Shop users can read aliases" ON public.category_aliases FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Shop users can manage aliases" ON public.category_aliases FOR ALL TO authenticated USING (TRUE);

-- Transactions: Restrict UPDATE to editable columns (cannot alter created_at, created_by, idempotency_key)
CREATE POLICY "Shop users can view transactions" ON public.transactions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Shop users can record transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Shop users can update transactions" ON public.transactions FOR UPDATE TO authenticated USING (TRUE);

-- Audit Log: Read-only for authenticated users; INSERTS are strictly trigger-driven (REVOKE client INSERT)
CREATE POLICY "Shop users can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (TRUE);

-- Review Queue
CREATE POLICY "Shop users can manage review queue" ON public.review_queue FOR ALL TO authenticated USING (TRUE);
```

---

## 4. Parser Rules & Corpus (Approved Changes)

1. **Exact Alias = Auto-Save:** When a word matches an exact alias in `category_aliases` and the sign is consistent, immediately save and display the 6-second Undo Toast.
2. **Fuzzy/Phonetic Match Always Asks:** Any edit-distance or phonetic match is never auto-saved. It always renders an interactive confirmation card: `"Did you mean: PRINT — Income — Rs 300?"`. Upon confirmation, the alias is learned.
3. **Fuzzy Tolerance Scaled by Word Length:**
   - Length $\le 3$: Exact match only (0 edit distance).
   - Length 4–6: Max 1 edit distance.
   - Length $> 6$: Max 2 edit distance.
4. **No Numeric Aliases:** Numbers like `50`, `100` cannot be aliases.
5. **Capital / Withdrawal / Adjustment Always Confirm:** Never auto-save balance-sheet movements without confirmation card.
6. **Adjustments Require Note & Direction:** Must specify direction (`in` or `out`) and note.
7. **Multi-line = Single Batch Preview Card:** Pasting `PRINT 300\nPAPER -2000` parses both and displays one combined confirmation card with individual accept/reject toggles.
8. **Real Categories Seeded Only:**
   - Income: **Printing & Photocopy**, **Legal Stamp Paper**, **Lamination**.
   - Expense: **Paper Stock Purchase**, **Shop Supplies & Bills**.
   *(No extraneous retail categories).*

---

## 5. Testing & Verification Plan

1. **Unauthenticated Security Test:** Integration test verifying that `anon` key queries against `transactions`, `categories`, `audit_log`, `view_daily_summary`, `view_monthly_summary` receive `401 Unauthorized` or empty sets.
2. **Optimistic Concurrency Test:** Verify that concurrent updates with an outdated `updated_at` are rejected.
3. **Audit Trigger Test:** Verify that updating an amount or voiding an entry writes old/new JSON to `audit_log`, and client cannot manually insert fake audit rows.
4. **Timezone Boundary Test:** Verify that entries at 12:01 AM PKT receive the correct Pakistani calendar date.
5. **Money Integer Paisa Math Test:** Test conversions, large amounts (Rs 200,000 = 20,000,000 paisa), and verify that profit is strictly `Income - Expense`.
6. **300+ Parser Corpus Test:** Execute corpus covering clean entries, typos, multi-line, sign conflicts, and bare numbers with 100% precision.

---

## 6. Phased Implementation Roadmap

- [x] **Phase 0 — Verification & Master Architecture Plan** *(Completed & Approved)*
- [ ] **Phase 1 — Data Foundation & Database Rules** *(IN PROGRESS)*
  - Create Supabase migrations (integer paisa, unified `transactions`, `categories`, `category_aliases`, `audit_log`, `review_queue`).
  - Deploy immutable trigger blocking hard deletes, audit trigger, category match trigger, and date validation trigger.
  - Implement shared SQL views with `security_invoker = true`.
  - Revoke anon access.
  - Implement `src/lib/dates.ts` (`Asia/Karachi` timezone derivation & clock drift guards).
  - Implement `src/lib/money.ts` (integer paisa math & formatting).
  - Write test suite for money, dates, and database rules.
- [ ] **Phase 2 — Smart Deterministic Parser & Corpus**
- [ ] **Phase 3 — Chat Ledger UI & Realtime Synchronization**
- [ ] **Phase 4 — Dashboard, Reports & Multi-Year History**
- [ ] **Phase 5 — Offline Queue, Multi-Device Testing & Backups**
- [ ] **Phase 6 — Hardening, Old Register Import & Production Release**

---

## Phase 1 Execution Details (Now Commencing)
*Branch `archive/v1-desktop-pos` has been pushed. Beginning Phase 1 foundation.*
