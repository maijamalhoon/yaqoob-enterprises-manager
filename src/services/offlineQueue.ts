/**
 * IndexedDB Offline Queue with Idempotency
 * Stores pending transactions locally when network is unavailable or flaky,
 * auto-flushes on reconnect without duplication.
 */

export interface QueuedTransaction {
  id: string; // client uuid
  idempotencyKey: string;
  type: string;
  amountPaisa: number;
  categoryId: string | null;
  categoryName?: string;
  businessDate: string;
  deviceEntryTime: string; // ISO UTC
  note?: string | null;
  rawText: string;
  createdByName: string;
  adjustmentDir?: 'in' | 'out' | null;
  status: 'queued' | 'sending' | 'failed';
  attempts: number;
  createdAt: number;
}

const DB_NAME = 'yaqoob_ledger_offline';
const STORE_NAME = 'offline_transactions';
const DB_VERSION = 1;

// In-memory fallback if IndexedDB is not supported (e.g. some node/test environments)
const memoryStore = new Map<string, QueuedTransaction>();

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

async function openDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      }
    };
  });
}

/**
 * Enqueue a transaction for offline storage
 */
export async function enqueueOfflineTransaction(item: QueuedTransaction): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryStore.set(item.idempotencyKey, item);
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all pending transactions in queue
 */
export async function getOfflineQueue(): Promise<QueuedTransaction[]> {
  const db = await openDB();
  if (!db) {
    return Array.from(memoryStore.values());
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove an item from the queue after successful cloud sync
 */
export async function dequeueOfflineTransaction(idempotencyKey: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryStore.delete(idempotencyKey);
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(idempotencyKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark item as failed with error
 */
export async function markOfflineTransactionFailed(idempotencyKey: string): Promise<void> {
  const items = await getOfflineQueue();
  const target = items.find((i) => i.idempotencyKey === idempotencyKey);
  if (target) {
    target.status = 'failed';
    target.attempts += 1;
    await enqueueOfflineTransaction(target);
  }
}
