# Yaqoob Enterprises Manager - System Architecture

## 1. Architectural Philosophy & Overview

**Yaqoob Enterprises Manager** is an enterprise-grade, offline-first Windows desktop POS and ERP application. It adheres to Clean Architecture principles with decoupled boundaries between:
1. **Desktop Shell & Native Services (Tauri 2 / Rust 2021)**
2. **User Interface & Reactive State (React 19 / TypeScript 5.7)**
3. **Domain Business Logic & Financial Formulas (StorageEngine)**
4. **Local Database & Schema Migrations (Dual-Mode SQLite)**
5. **Resilient Offline Sync Engine (SyncEngine)**
6. **Multi-Tenant Cloud Backend (Supabase PostgreSQL with Hardened RLS)**

```mermaid
graph TD
    subgraph Windows Desktop Shell (Tauri 2 / Rust)
        RustCore[Rust Desktop Core]
        NativePrint[Native Receipt Printer Driver]
        BackupEngine[Local File Backup / Restore]
        SysInfo[Hardware Diagnostics]
    end

    subgraph Client Application Layer (React 19 + TypeScript)
        UI[POS, Inventory, Expenses, Reports, Cash Closing, Settings]
        Context[AuthContext + AppContext + Hotkeys]
        StorageEngine[Transactional StorageEngine]
        Permissions[RBAC Engine: Owner / Manager / Cashier]
    end

    subgraph Local Storage & Offline Persistence Layer
        DualSqlite[Dual-Mode SQLite Engine]
        SchemaMigrations[Versioned Schema Migrations v1]
        SyncQueue[SQLite sync_queue]
        SyncEngine[Bidirectional SyncEngine Worker]
    end

    subgraph Cloud Infrastructure (Supabase)
        SupabasePostgres[(Supabase PostgreSQL 15)]
        RLS[Hardened Row-Level Security]
        AuthTrigger[Auto-Provisioning Signup Trigger]
    end

    UI --> Context
    Context --> StorageEngine
    StorageEngine --> Permissions
    StorageEngine --> DualSqlite
    StorageEngine --> SyncQueue
    SyncQueue --> SyncEngine
    SyncEngine -.->|Idempotent Push / Pull| SupabasePostgres
    SupabasePostgres --> RLS
    AuthTrigger --> SupabasePostgres
    UI <==>|Tauri IPC / Events| RustCore
    RustCore --> NativePrint
    RustCore --> BackupEngine
    RustCore --> SysInfo
```

---

## 2. Desktop Shell Architecture (Tauri 2 & Rust)

The application runs inside a lightweight, sandboxed Windows Webview2 container powered by Tauri 2. Unlike resource-heavy Electron apps (which bundle an entire Chromium and Node.js runtime), Tauri utilizes the native Windows OS web engine and compiles a high-performance native Rust binary.

### Key Rust Subsystems (`src-tauri/src/lib.rs`)
- `get_system_info`: Inspects local OS version, CPU architecture, hostname, memory, and native app build string.
- `print_receipt_native`: Interfaces directly with local ESC/POS 80mm or 58mm thermal receipt printers over USB or local network.
- `backup_database`: Exports the active local database to an encrypted or plain verified JSON archive.
- `restore_database`: Validates archive signature, structure, and entity counts before atomically writing back to local storage.

### Security Capabilities (`src-tauri/capabilities/default.json`)
The desktop shell strictly specifies Tauri 2 permission boundaries:
- Core shell navigation and dialog window access
- Local file read/write confined to user-selected paths
- Embedded SQLite access via `@tauri-apps/plugin-sql`

---

## 3. Data Tier: Dual-Mode SQLite Engine

To guarantee zero dependencies during development and testing while delivering industrial SQLite reliability in desktop production, the data layer uses a **Dual-Mode SQLite Driver** (`src/services/sqliteEngine.ts`):

1. **Native Mode (Desktop / Tauri):** Dynamically loads `@tauri-apps/plugin-sql`, creating an embedded `yaqoob_manager.db` SQLite file with **Write-Ahead Logging (WAL)** enabled for concurrent reads and crash resilience.
2. **In-Memory / Web Mode (Browser Dev & Automated Unit Tests):** A high-performance mock SQLite engine providing table creation, parameterized inserts, updates, deletions, and select queries, backed by an isolated local cache.

### Versioned Database Migrations
Migrations are tracked in the `schema_migrations` table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```
Every application launch checks the current schema version and sequentially applies missing migrations inside an atomic transaction.

---

## 4. Offline-First Bidirectional Sync Engine

In Pakistani retail environments, internet outages and electrical load shedding are common operational realities. The system treats the network as an intermittent transport layer.

### Data Mutation Lifecycle
1. Cashier performs a sale or records an expense in the POS.
2. **Local Commit:** `StorageEngine` writes the transaction immediately to local SQLite.
3. **Sync Queue Enqueue:** `syncEngine.enqueue(tableName, recordId, operation, payload)` records the mutation into the durable `sync_queue` table with status `'pending'`.
4. **Network Evaluation:**
   - If **Offline:** The transaction completes instantly in 0ms with zero network blocking. The `sync_queue` preserves the mutation indefinitely.
   - If **Online:** The background sync worker immediately attempts an idempotent upsert to cloud Supabase.
5. **Resolution & Cleanup:** Upon successful cloud acknowledgment, the item is removed from `sync_queue` and the local record's `sync_status` is updated to `'synced'`.

### Idempotency & Deduplication
To prevent duplicate sales or ghost expenses if a network connection drops mid-flight, all cloud upserts utilize deterministic primary keys (`onConflict: 'id'`). If an identical record is delivered multiple times, PostgreSQL performs an idempotent in-place update without creating duplicates.

---

## 5. Domain Business Logic: Service Recipe Consumption & WAC

### Raw Material Recipe Consumption
In photocopying and printing services, selling a service job consumes physical raw materials:
- **B&W Photocopy (`srv-bw-copy`):** Consumes 1 unit of `prod-a4-sheet` (A4 70gsm Copy Paper).
- **Colour Photocopy / Scan (`srv-color-copy`):** Consumes 1 unit of `prod-a4-color-sheet`.
- **Passport Photos (`srv-passport-photo`):** Consumes 1 unit of `prod-photo-sheet`.

When a sale is completed in `StorageEngine.createSaleTransaction`:
1. Physical product quantities are deducted from `current_stock`.
2. Service line items inspect their configured recipe components (`ServiceRecipeComponent`).
3. For each component, the raw material inventory is automatically deducted (`quantity_consumed * item.quantity`).
4. A stock movement of type `SALE` with reference `SERVICE_CONSUMPTION` is logged.
5. In the event of a sale void, `StorageEngine.voidSaleTransaction` restores both direct product stocks and raw material recipe components with `CUSTOMER_RETURN` stock movements.

### Weighted Average Costing (WAC)
Every incoming purchase batch recalculates the moving average cost deterministically:
$$\text{Average Cost} = \frac{(\text{Stock}_{\text{current}} \times \text{Cost}_{\text{current}}) + (\text{Qty}_{\text{incoming}} \times \text{Cost}_{\text{incoming}})}{\text{Stock}_{\text{current}} + \text{Qty}_{\text{incoming}}}$$
All calculations utilize financial rounding (`roundMoney`) to eliminate IEEE-754 floating-point inaccuracies.

---

## 6. Financial Ledger & Cash Drawer Reconciliation

### Double-Entry Account Transfers
When funds are moved between accounts (e.g., depositing Rs. 10,000 from Cash Drawer to HBL Bank):
- Source account balance is debited.
- Destination account balance is credited.
- `TRANSFER_OUT` and `TRANSFER_IN` ledger records are created.
- Transfers are segregated from operational revenues and expenses, ensuring P&L statements reflect true business profit.

### Daily Cash Drawer Closing Formula
At the end of each shift or business day, the cashier counts physical cash in the drawer. The system computes expected cash:
$$\text{Expected Cash} = \text{Opening Balance} + \text{Cash Sales} - \text{Cash Expenses} + \text{Transfers In} - \text{Transfers Out}$$
The variance ($\text{Actual Cash} - \text{Expected Cash}$) is logged as either a surplus (overage) or deficit (shortage) with cashier explanations.

---

## 7. Role-Based Access Control (RBAC) Architecture

The application enforces a 3-tier permission hierarchy:
- **`CASHIER`:** Operational front-desk tasks (Quick Sale POS, cash receipts, petty expenses, shift closing count). Blocked from voiding transactions, viewing company margins, changing prices, or altering configuration.
- **`MANAGER`:** Store operations (Inventory reorders, stock adjustments, voiding sales, inter-account transfers, P&L reports). Blocked from user administration and database restoration.
- **`OWNER`:** Full sovereignty over business profile, staff accounts, tax rates, cloud synchronization keys, and database backup/restore.
