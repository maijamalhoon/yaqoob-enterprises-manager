# Changelog

All notable changes to **Shop Pro** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-phase3-6] - 2026-10-04

### Phase 3: Chat Interface, Auth, & Installable PWA
- **Added Conversational Chat Screen (`src/components/chat/`):**
  - Unified interface optimized for phone and PC counter screens.
  - Chat bubbles displaying who, time, type, category, and amounts.
  - Tap-to-edit and tap-to-void with mandatory void reasons and immediate restore capabilities.
  - Today summary strip with live income, expense, and net profit metric cards.
  - Supabase Realtime channel subscription providing live updates from brother accounts.
  - 6-second animated undo toast for immediate transaction cancellation.
  - Desktop quick-entry bar on `/manage` pages accessible via `/` hotkey with Enter-to-send and Esc-to-clear.
  - Installable PWA with web app manifest, service worker (`public/sw.js`), and in-app install modal for Android, iOS, and PC.

### Phase 4: Shared SQL View Dashboard & Historical Reports
- **Added Ledger Dashboard & Analytics Views:**
  - Day / Month / Year switcher reading directly from shared security_invoker SQL views.
  - Capital in, withdrawals, and adjustments strictly segregated from operating profit and loss.
  - Transactions Explorer with live search, date range, category, and type filters, pagination, and one-click CSV export.
  - Month-vs-month annual financial reports table reachable years into the future.
  - Hand-calculated sample month verification test in `tests/reports_sample_month.test.ts` verifying all figures to the exact paisa.

### Phase 5: Offline Resilience, Multi-Device Concurrency, & Automated Backups
- **Added Offline Engine & Disaster Recovery:**
  - IndexedDB local transaction queue capturing device entry time and client idempotency keys.
  - Automatic reconnection flusher with idempotent retry deduplication.
  - Multi-device concurrency test (`tests/offline_concurrency.test.ts`) validating simultaneous entries without data collision.
  - Empty database restore test validating 100% matching record counts and financial sums.
  - GitHub Actions CI & daily backup workflow (`.github/workflows/ci_and_backup.yml`) paginating beyond 1,000 rows with 90-day artifact retention.

### Phase 6: Hardening, Historical Paper Register Import, & Cleanup
- **Added Historical Paper Register Importer (`src/components/settings/PaperRegisterImportModal.tsx`):**
  - Paste CSV text with instant pre-commit preview table.
- **Strict Hard Stop Compliance:**
  - Preserved legacy desktop POS code on `origin/archive/v1-desktop-pos` (commit `dfde09d`).
  - No secret keys in client code or repository.
  - 145 automated tests running clean with 0 failures across 21 test suites.

## [2.0.0-phase2] - 2026-10-04

### Phase 2: Deterministic Local Parser Engine
- **Added Local Deterministic Parser (`src/parser/`):**
  - Zero AI / zero external API dependencies, 100% deterministic local TypeScript parsing pipeline.
  - Multi-line message splitter, normalizer (case, spaces, currency symbols `Rs.`, `PKR`, `/-`, `=/-`, comma-delimited numbers).
  - Length-scaled fuzzy matching Levenshtein distance (`<=3` exact, `4-6` max 1 edit, `>6` max 2 edits) and Metaphone/Soundex phonetic matching for Urdu/English shop slang.
  - Strict safety gates:
    - Minus sign = expense; exact known alias + consistent type = auto-save with 6-second undo toast.
    - Ask on bare numbers (5 distinct classification options).
    - Ask on sign vs category conflicts (e.g. `PAPER 2000`, `+PAPER 2000`, `-PRINT 300`).
    - Ask on unknown words or ambiguous "kal" keywords.
    - Ask confirmation on capital in, withdrawal, and adjustment entries.
    - Flag unusual amounts (> Rs 50,000 default per category limit).
    - Flag possible duplicates within ~3 minutes across users.
    - Batch preview cards for multi-line messages with blocking gates on flagged lines.
  - Backdating support via "yesterday" or ISO/DMY date chips, defaulting to Karachi business date.
  - 483-message realistic test corpus in `tests/parser_corpus.test.ts` running in CI with zero silent misclassifications.

## [2.0.0-phase1] - 2026-10-04

### Phase 1: Ledger Foundation & Real Postgres Verification
- **Hardened PostgreSQL Database (`supabase/migrations/20261004000000_shop_ledger_foundation.sql`):**
  - Integer paisa ledger with `shop_members` table and strict membership-based RLS on all tables and views (`security_invoker = true`).
  - Total anon lockout: all SELECT/INSERT/UPDATE/DELETE revoked from `anon`.
  - Database triggers: `prevent_hard_delete` (DELETE blocked), `prevent_truncate` (TRUNCATE blocked), `validate_category_and_kind`, `validate_adjustment_rules`, `prevent_stale_edit` (optimistic concurrency on `updated_at`), `prevent_future_business_date`.
  - `record_audit_log` trigger running as `SECURITY DEFINER` with fixed `search_path`, client direct write blocked on `audit_log`.
  - Shared views: `view_daily_summary`, `view_monthly_summary`, `view_category_breakdown`.
  - Real WASM Postgres test suite via `@electric-sql/pglite` (`tests/pglite_database.test.ts`) passing all 13 database constraint tests.

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
