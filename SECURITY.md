# Yaqoob Enterprises Manager - Security Architecture & Hardening

## 1. Zero-Trust Desktop Security Model

The desktop application is architected under the principle of **Least Privilege** and **Zero-Trust**:

1. **Client Isolation:** The Windows client application (whether running in Tauri or web preview) is treated as an untrusted client in multi-tenant environments.
2. **Strict Exclusion of `service_role`:** Under NO circumstances is the Supabase `service_role` secret key bundled into the frontend source code, desktop binaries, environment files, or installers. Only the public anonymous key (`VITE_SUPABASE_ANON_KEY`) is present.
3. **Database-Enforced Authorization:** All cloud queries operate under PostgreSQL **Row-Level Security (RLS)**. The client cannot elevate permissions or access cross-tenant records even if the client-side JavaScript code is modified or debugged.

---

## 2. Hardened Row-Level Security (RLS)

All cloud database tables have RLS enabled with `RESTRICTIVE` policies:

```sql
-- Helper function to fetch current authenticated tenant id
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Table Security Policies
- **`organizations`:** Users can only view and update their own organization where `id = current_user_org_id()`.
- **`products` & `services`:** Read/Write restricted to records where `organization_id = current_user_org_id()`.
- **`sales` & `sale_items`:** Insert and select permitted only for the user's organization.
- **`expenses` & `daily_closings`:** Partitioned strictly by `organization_id`.
- **`audit_logs`:** Append-only and readable only by users within the matching organization.

### Automated Tenant Provisioning Trigger
To prevent security holes where client code inserts tenant records directly:
- When an owner registers via Supabase Auth (`auth.users`), the `handle_new_user_registration` database trigger creates the organization and assigns the user profile with role `'OWNER'` in a trusted PostgreSQL transaction.

---

## 3. Role-Based Access Control (RBAC) Matrix

Permissions are verified in `src/lib/permissions.ts` and enforced across the navigation sidebar, POS checkout, reports, and settings:

| Action / Capability | Cashier | Manager | Owner |
| :--- | :---: | :---: | :---: |
| Fast POS Checkout & Receipts | ✅ | ✅ | ✅ |
| Record Daily Petty Expenses | ✅ | ✅ | ✅ |
| Submit Daily Cash Register Closing | ✅ | ✅ | ✅ |
| View Customer Directory | ✅ | ✅ | ✅ |
| Void Invoices / Refund Transactions | ❌ | ✅ | ✅ |
| Void Recorded Operating Expenses | ❌ | ✅ | ✅ |
| Adjust Inventory Quantities & Unit Costs | ❌ | ✅ | ✅ |
| Inter-Account Money Transfers | ❌ | ✅ | ✅ |
| View P&L Statements & Margin Analytics | ❌ | ✅ | ✅ |
| Inspect Immutable Audit Trail | ❌ | ✅ | ✅ |
| Modify Organization Profile & Tax Settings | ❌ | ❌ | ✅ |
| Manage Staff Accounts & Assign Roles | ❌ | ❌ | ✅ |
| Database Restore from Archive | ❌ | ❌ | ✅ |

---

## 4. Backup & Restore Validation

Database restoration is an inherently high-risk action that overwrites active local records. To prevent accidental data loss or corruption:

1. **Owner-Only Gate:** Only users with the `OWNER` role are permitted to initiate a database restore.
2. **Schema & Version Validation:**
   The restore engine inspects incoming archive files for:
   - Required format identifier (`"yaqoob_ent_backup"`).
   - Compatible schema version (`"1.0"`).
   - Valid organization metadata matching the active tenant.
3. **Pre-Restore Confirmation Modal:**
   Displays an exact breakdown of record counts to be restored (e.g. `Products: 45, Sales: 180, Expenses: 32`) before prompting for explicit confirmation.
4. **Local Database Protection:**
   The SQLite database file on Windows is located within the user's secure `%APPDATA%` directory, protected by Windows standard NTFS access control lists (ACLs).

---

## 5. Immutable Audit Trail

All critical transactions generate an immutable audit log entry in the `audit_logs` table:
- `SALE_CREATED`: Logs invoice number, total amount, and cashier.
- `SALE_VOIDED`: Mandates a reason for voiding and records the manager who authorized it.
- `EXPENSE_RECORDED` & `EXPENSE_VOIDED`: Tracks operational cash outflow adjustments.
- `ACCOUNT_TRANSFER`: Records sender and receiver accounts with amount moved.
- `DAILY_CLOSING_RECORDED`: Audits counted cash versus calculated expected cash.
