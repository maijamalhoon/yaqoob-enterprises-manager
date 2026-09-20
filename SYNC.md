# Yaqoob Enterprises Manager - Offline Sync Architecture & Protocol

## 1. Sync Architecture Overview

The **Offline Sync Engine** (`src/services/syncEngine.ts`) provides bidirectional synchronization between the local desktop SQLite database and cloud Supabase PostgreSQL.

The system is designed with a **Local-First, Append-Only Queue** approach:

```text
[Local UI Action] (Sale, Expense, Inventory Update)
       │
       ▼
[Atomic Local SQLite Write] ──> Instant UI Feedback (0ms latency)
       │
       ▼
[Enqueue to sync_queue] (operation: INSERT | UPDATE | DELETE)
       │
       ├── (If Offline) ──> Persist safely in SQLite; wait for connection
       │
       └── (If Online)  ──> Trigger Background Sync Pipeline
                                  │
                                  ▼
                         [Push Queue Items]
                                  │
                                  ▼
                         [Cloud Upsert (onConflict: 'id')]
                                  │
                         ┌────────┴────────┐
                         │                 │
                     [Success]         [Failure]
                         │                 │
                         ▼                 ▼
                 [Delete from Queue] [Increment attempts,
                 [Set local status    log error, retry]
                  to 'synced']
```

---

## 2. Queue Lifecycle & Operations

### Sync Queue Schema
Mutations are stored in the local SQLite `sync_queue`:
```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
  payload TEXT NOT NULL,   -- Complete JSON snapshot
  attempts INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Supported Operations
- **`INSERT`:** Pushes the complete record to Supabase using `.upsert(payload, { onConflict: 'id' })`.
- **`UPDATE`:** Updates existing record using `.upsert(payload, { onConflict: 'id' })`.
- **`DELETE`:** Removes the record from Supabase using `.delete().eq('id', record_id)`.

---

## 3. Idempotency & Deduplication

In distributed networks, requests can be lost, timed out, or delivered multiple times due to retries.

### Deterministic Primary Keys
Every entity created locally generates a deterministic unique identifier before insertion:
- Sales: `sale-{timestamp}-{random}`
- Sale Items: `sitem-{timestamp}-{random}`
- Stock Movements: `mov-{type}-{timestamp}-{id}`
- Expenses: `exp-{timestamp}-{random}`

### Cloud Upsert Guarantee
Because the primary key is fixed at the moment of local creation, pushing an insert multiple times will never generate duplicate rows in Supabase:
```typescript
await supabase
  .from(item.table_name)
  .upsert(cleanPayload, { onConflict: 'id' });
```
If an invoice is pushed twice (e.g. if the connection dropped before the client received the HTTP 200 acknowledgment), PostgreSQL executes an in-place idempotent update, keeping total revenue and sales count accurate.

---

## 4. Conflict Resolution Strategy

### Client-to-Cloud Priority (Last-Write-Wins)
1. **Financial Immutability:** Sales, Sale Items, Daily Closings, and Audit Logs are essentially append-only. They are never overwritten by cloud data.
2. **Catalog & Inventory Updates:** If a product's price or stock is modified on multiple terminals, the update with the latest `updated_at` timestamp takes precedence.
3. **Void Safeguards:** Once a sale or expense status is set to `'VOIDED'`, it cannot be un-voided or reverted by an older update.

---

## 5. Network Detection & Background Timer

The sync engine monitors connection state through dual mechanisms:

1. **Window Event Listeners:**
   ```typescript
   window.addEventListener('online', () => this.handleNetworkChange(true));
   window.addEventListener('offline', () => this.handleNetworkChange(false));
   ```
   When the desktop transitions from offline to online, an immediate queue drain is dispatched.
2. **Periodic Background Polling:**
   Every 30 seconds, if the network is online and no sync operation is actively in-flight, `syncNow()` executes automatically in the background.

---

## 6. Sync Diagnostics & Manual Controls

The desktop interface includes a dedicated **Cloud Sync Status & Diagnostics Center** accessible via the top navigation bar or settings:
- **Live Queue Counter:** Displays count of pending mutations (`pendingCount`).
- **Connection Indicator:** Live green/red indicator for online/offline status.
- **Last Sync Timestamp:** Localized display of when cloud data was last confirmed.
- **Sync History Log:** Table showing recent sync cycles, number of records pushed/pulled, and any error messages.
- **Manual "Sync Now" Button:** Allows managers to immediately trigger a sync cycle before shutting down a terminal.
