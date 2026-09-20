# Changelog

All notable changes to the **Yaqoob Enterprises Manager** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-19

### Production Windows Desktop & Offline-First ERP Release

#### Added
- **Tauri 2 Desktop Shell (`src-tauri`):**
  - Native Rust 2021 desktop core with typed IPC commands (`get_system_info`, `print_receipt_native`, `backup_database`, `restore_database`).
  - Windows NSIS standalone `perMachine` installer configuration with high-resolution desktop and start menu icons.
  - Direct ESC/POS thermal receipt printing integration.
- **Dual-Mode SQLite Engine (`src/services/sqliteEngine.ts`):**
  - Native embedded SQLite support via `@tauri-apps/plugin-sql` with Write-Ahead Logging (WAL mode).
  - Versioned migration runner with `schema_migrations` tracking table.
  - Resilient in-memory/browser driver fallback for local web preview and automated unit testing.
- **Offline Sync Engine (`src/services/syncEngine.ts`):**
  - Persistent local `sync_queue` table buffering all database mutations while offline.
  - Idempotent upsert mechanics using deterministic entity IDs (`onConflict: 'id'`).
  - Background auto-drain timer (30-second interval) and network change event listeners (`online` / `offline`).
  - Cloud Sync Status & Diagnostics Center modal with live counters, connection indicator, and sync history logs.
- **Hardened Cloud PostgreSQL & RLS (`supabase/migrations/`):**
  - Added sync metadata columns (`sync_status`, `sync_version`) to all core tables.
  - Added Row-Level Security (RLS) policies for previously unprotected tables (`categories`, `expense_categories`, `service_components`, `profiles`).
  - Implemented `handle_new_user_registration` PostgreSQL trigger to auto-provision organizations and owner profiles without exposing `service_role` keys.
- **Service Recipe Components & Inventory Restocking:**
  - Interactive recipe builder in Products & Services management view for linking raw materials to service jobs.
  - Automatic inventory deduction when selling services (e.g. 1 B&W photocopy consumes 1 sheet of A4 70gsm paper).
  - Customer return restock logic when voiding sales, returning consumed raw materials back to inventory.
- **Enterprise Reporting Center (`src/components/reports/ReportsView.tsx`):**
  - 9 comprehensive operational reports: Accrual P&L, Sales Summary, Expense Analysis, Inventory Valuation, Stock Movement Audit, Top Selling Items, Payment Methods, Cash Flow Inflow/Outflow, Customer Sales, and Shift Closings.
  - Period filtering (Today, Yesterday, 7 Days, 30 Days, This Year, All Time, Custom Range).
  - One-click CSV exports and thermal print formatting.
- **Role-Based Access Control (RBAC) Module (`src/lib/permissions.ts`):**
  - Centralized permission definitions covering Cashier, Manager, and Owner roles.
  - Owner-only gate for sensitive actions (tenant business configuration, staff management, and database restoration).
- **Verified Backup & Restore System (`src/components/settings/SettingsView.tsx`):**
  - JSON archive integrity verification with format identifier and schema version checks.
  - Pre-restore confirmation modal displaying exact record counts before overwriting.
- **Comprehensive Automated Test Suite (`tests/`):**
  - 28 passing unit tests across 6 test suites (`wac.test.ts`, `rbac.test.ts`, `sales.test.ts`, `accounts.test.ts`, `closing.test.ts`, `sync.test.ts`).

#### Changed
- Upgraded project metadata to `yaqoob-enterprises-manager` v1.0.0.
- Normalized TypeScript dependency to `^5.7.3`.
- Upgraded financial rounding across all POS, inventory, and expense operations to use deterministic 2-decimal precision (`roundMoney`).

#### Removed
- Removed unused Google AI Studio prototype dependencies (`@google/genai`, `motion`, `zod`, `express`).
- Eliminated plain text secrets and unauthenticated mock endpoints.
