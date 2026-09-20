# Yaqoob Enterprises Manager

> **Production-Grade Offline-First Windows Desktop POS & Business ERP**  
> Engineered specifically for Pakistani retail, document centers, photocopying, high-speed digital printing, stationery, and public facilitation services.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.2-orange.svg)](https://v2.tauri.app/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://sqlite.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Hardened%20RLS-3ECF8E.svg)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Vitest-28%20Passed-green.svg)](https://vitest.dev/)

---

## 🌟 Executive Summary

**Yaqoob Enterprises Manager** transforms legacy browser-dependent point-of-sale systems into an uncompromising, high-velocity native Windows desktop application. Built with **Tauri 2 (Rust)**, **React 19**, **TypeScript**, local **SQLite** (with versioned schema migrations), and a resilient **Bidirectional Offline Sync Engine** connecting to cloud **Supabase PostgreSQL**.

The application never stops during internet outages, load shedding, or slow network connections. All sales, expenses, stock movements, and cash register closures are persisted locally and safely queued for background synchronization.

---

## 🚀 Core Features & Capabilities

### 1. High-Velocity POS & Service Recipe Engine
- **Instant Keyboard Counter Checkout:** Category filtering, live search by SKU or name, custom discounts, and one-key payment processing.
- **Service Raw Material Consumption (Recipes):** Photocopying, laser printing, and document binding automatically deduct underlying physical materials (e.g., 1 Photocopy consumes 1 sheet of 70gsm A4 paper; 1 Passport photo set consumes 1 4x6 glossy sheet).
- **Accurate Cost of Goods Sold (COGS):** Real-time gross margin calculation per item and per invoice.
- **Customer Returns & Void Restocking:** Voiding a sale automatically restocks both direct products and recipe-consumed materials back into inventory with `CUSTOMER_RETURN` stock movements.

### 2. Physical Inventory & Weighted Average Costing (WAC)
- **Automatic WAC Recalculation:** New purchase batches update item average costs deterministically:
  $$\text{New Cost} = \frac{(\text{Current Stock} \times \text{Current Avg Cost}) + (\text{Incoming Qty} \times \text{Incoming Unit Cost})}{\text{Current Stock} + \text{Incoming Qty}}$$
- **Stock Movements Ledger:** Full audit trail for purchases, sales, adjustments, damages/wastage, and corrections.
- **Low-Stock Alerting:** Visual indicators and dashboard warnings when items reach reorder thresholds.

### 3. Financial Accounts & Multi-Wallet Split Payments
- **Multi-Account Balance Tracking:** Cash Drawer, HBL Business Account, JazzCash Till, and Easypaisa Wallet.
- **Split Tender Checkout:** Customers can split an invoice across Cash, Bank, and Mobile Wallets simultaneously.
- **Inter-Account Money Transfers:** Double-entry ledger recording (`TRANSFER_IN` and `TRANSFER_OUT`) without contaminating Sales or Expense P&L reports.
- **Expense Categorization:** Petty cash expenses (tea/refreshments, electricity bills, shop rent, machine maintenance) tracked with void reversal support.

### 4. Shift & Daily Cash Drawer Reconciliation
- **Opening & Expected Cash Calculation:**
  $$\text{Expected Cash} = \text{Opening Cash} + \text{Cash Sales} - \text{Cash Expenses} + \text{Transfers In} - \text{Transfers Out}$$
- **Discrepancy Auditing:** Automatic surplus (overage) or deficit (shortage) logging with cashier notes and immutable audit trail.

### 5. Enterprise Reporting Center (9 Distinct Views)
- **Executive Accrual P&L Statement:** Revenue, COGS, Gross Profit, Operating Expenses, and Net Profit.
- **Sales Analytics:** Invoices, quantities, cashier performance, customer summaries.
- **Inventory Valuation:** Current quantities, average cost, retail value, and unrealized margin.
- **Stock Movement Ledger:** Complete chronological inventory audit.
- **Top Performing Items:** Revenue and volume rankings.
- **Payment Method Distribution:** Breakdown of Cash vs Bank vs Mobile Wallets.
- **Cash Flow History:** Real-time inflow and outflow velocity.
- **Customer Sales & Balances:** VIP customer tracking.
- **Closing Register History:** Shift closing audits.
- **Instant CSV Downloads & Clean Thermal Print Output.**

### 6. Offline-First Sync & Conflict Resolution
- **Zero Internet Dependency:** Desktop functions completely without active internet.
- **Local SQLite Persistence:** Atomic local transactions with WAL mode.
- **Offline Sync Queue (`sync_queue`):** Durable local queue logging all mutations while offline.
- **Background Auto-Drain:** Drains pending mutations with idempotent upserts once network connectivity is restored.
- **Hardened Supabase RLS:** Multi-tenant security with PostgreSQL row-level security and automated organization provisioning upon owner signup.

### 7. Verified Backup & Restore
- **Owner-Only Security Guard:** Only users with the `OWNER` role can create or restore backups.
- **Integrity Validation:** Validates JSON schema structure, version metadata, and displays record counts before prompting for explicit confirmation.

---

## 🛠 Technology Architecture

| Layer | Technologies Used |
| :--- | :--- |
| **Desktop Shell** | Tauri 2.2, Rust 2021 edition, Windows NSIS Installer (`perMachine`) |
| **Frontend Core** | React 19.0.0, TypeScript 5.7.3, Vite 6.2 |
| **Styling & Icons** | Tailwind CSS v4, Lucide React, JetBrains Mono |
| **Data Visualizations** | Recharts (Revenue velocity, margin trends) |
| **Local Database** | Embedded SQLite (`@tauri-apps/plugin-sql` / In-Memory Driver Fallback) |
| **Cloud Database** | Supabase PostgreSQL 15, Row-Level Security (RLS) |
| **Test Suite** | Vitest 3.0.7, JSDOM, `@testing-library/react` (28 unit tests) |

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + K` | Universal Command Palette | Global |
| `Ctrl + N` | Quick Sale (POS Terminal) | Global |
| `Ctrl + Shift + E` | Quick Expense Dialog | Global |
| `?` or `Shift + /` | Keyboard Shortcuts Cheatsheet | Global |
| `Esc` | Close Active Modal / Dialog | Global |

---

## 📂 Project Structure

```text
yaqoob-enterprises-manager/
├── src/
│   ├── components/
│   │   ├── accounts/          # Account balances, bank transfers, ledger
│   │   ├── audit/             # Immutable audit trail
│   │   ├── closings/          # Daily cash drawer reconciliation
│   │   ├── common/            # Button, Card, Modal, Badge, Toast, Form controls
│   │   ├── customers/         # Customer ledger and purchase records
│   │   ├── dashboard/         # KPI summary, velocity charts, low-stock warnings
│   │   ├── expenses/          # Expense entry, category breakdown, voiding
│   │   ├── inventory/         # Stock management, service recipe builder, WAC
│   │   ├── layout/            # Navigation sidebar, top header, status indicators
│   │   ├── pos/               # POS terminal, fast checkout, thermal receipt
│   │   ├── reports/           # 9-in-1 enterprise reporting center with CSV export
│   │   ├── settings/          # Business configuration, verified backup & restore
│   │   └── users/             # Staff directory & RBAC simulation matrix
│   ├── context/
│   │   ├── AppContext.tsx     # Global view router, notifications, hotkeys
│   │   └── AuthContext.tsx    # Multi-tenant session, Supabase auth, roles
│   ├── lib/
│   │   ├── mockData.ts        # Pakistani business domain starter data
│   │   ├── permissions.ts     # Centralized RBAC definitions
│   │   ├── supabase.ts        # Hardened Supabase client singleton
│   │   └── utils.ts           # Financial rounding, WAC formulas, CSV export
│   ├── services/
│   │   ├── sqliteEngine.ts    # Dual-mode SQLite engine & schema migrations
│   │   ├── storageEngine.ts   # Core transactional business logic & audit logs
│   │   └── syncEngine.ts      # Offline sync queue, auto-drain, diagnostics
│   ├── types/
│   │   └── index.ts           # Complete TypeScript domain contracts
│   └── App.tsx                # Application root
├── src-tauri/
│   ├── Cargo.toml             # Rust dependencies (Tauri 2, plugin-sql, serde)
│   ├── tauri.conf.json        # Desktop shell configuration & NSIS installer settings
│   ├── capabilities/          # Tauri 2 security permissions (core, sql)
│   ├── icons/                 # Multi-resolution Windows app icons (.ico, .png)
│   └── src/
│       ├── lib.rs             # Tauri commands (system info, backup, print)
│       └── main.rs            # Desktop entry point
├── supabase/
│   └── migrations/
│       ├── 20260918000000_initial_schema.sql       # Initial PostgreSQL tables & RLS
│       └── 20260919000000_harden_rls_and_auth.sql  # Sync metadata & auto-signup trigger
├── tests/
│   ├── setup.ts               # Test environment configuration
│   ├── wac.test.ts            # Weighted Average Costing & rounding tests
│   ├── rbac.test.ts           # Cashier vs Manager vs Owner boundaries
│   ├── sales.test.ts          # Sales, recipe consumption, split payment tests
│   ├── accounts.test.ts       # Fund transfers & ledger isolation tests
│   ├── closing.test.ts        # Drawer reconciliation & difference tests
│   └── sync.test.ts           # SQLite queue, schema migrations & offline tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vite.config.ts
```

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js 18+ (tested on Node.js v24.16.0)
- npm 9+
- Windows 10/11 (for native desktop bundling)
- Rust toolchain (`rustup` / `cargo`) installed for building native `.exe` installer

### 1. Installation
```powershell
# Clone or enter workspace
git clone <repo-url>
cd yaqoob-enterprises-manager

# Install npm dependencies
npm install
```

### 2. Run in Web Development Mode
```powershell
npm run dev
```
Open browser at `http://localhost:3000`.

### 3. Run Automated Tests
```powershell
npm test
```
Executes all 28 Vitest unit tests covering financial formulas, WAC calculations, recipe consumption, closing reconciliations, fund transfers, and RBAC permissions.

### 4. Build Desktop Assets
```powershell
npm run build
```
Type checks the codebase (`tsc --noEmit`) and creates optimized production bundles in `dist/`.

### 5. Run Native Tauri Desktop Application
```powershell
# Run in native Tauri desktop dev shell
npm run tauri dev

# Build standalone Windows installer (.exe setup)
npm run tauri build
```
The resulting Windows NSIS installer will be located in:
`src-tauri/target/release/bundle/nsis/Yaqoob Enterprises Manager_1.0.0_x64-setup.exe`

---

## 🔒 Security & RBAC Policies

| Action | Cashier | Manager | Owner |
| :--- | :---: | :---: | :---: |
| Fast POS Checkout | ✅ | ✅ | ✅ |
| Record Daily Expenses | ✅ | ✅ | ✅ |
| Submit Daily Cash Closing | ✅ | ✅ | ✅ |
| View Customer Directory | ✅ | ✅ | ✅ |
| Void Completed Sale | ❌ | ✅ | ✅ |
| Void Recorded Expense | ❌ | ✅ | ✅ |
| Stock Movement & Cost Adjustment | ❌ | ✅ | ✅ |
| Inter-Account Money Transfer | ❌ | ✅ | ✅ |
| Executive P&L & Margins Report | ❌ | ✅ | ✅ |
| Audit Trail Inspection | ❌ | ✅ | ✅ |
| Tenant Business Configuration | ❌ | ❌ | ✅ |
| Manage Staff Accounts | ❌ | ❌ | ✅ |
| Database Restore from Archive | ❌ | ❌ | ✅ |

---

## 📄 License & Ownership
Copyright © 2026 **Yaqoob Enterprises**. All rights reserved.  
Proprietary software developed for commercial physical shop operations.
