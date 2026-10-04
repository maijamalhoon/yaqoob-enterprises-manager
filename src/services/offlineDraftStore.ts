import { TransactionDraft } from '../types/ledger';

const DB_NAME = 'shop-pro-offline-drafts';
const DB_VERSION = 1;
const DRAFT_STORE = 'drafts';
const memoryDrafts = new Map<string, TransactionDraft>();

async function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
        request.result.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineDrafts(organizationId: string): Promise<TransactionDraft[]> {
  const db = await openDB();
  if (!db) {
    return [...memoryDrafts.values()]
      .filter((draft) => draft.organization_id === organizationId)
      .sort((left, right) => right.device_entry_time.localeCompare(left.device_entry_time));
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).getAll();
    request.onsuccess = () => resolve((request.result || [])
      .filter((draft: TransactionDraft) => draft.organization_id === organizationId)
      .sort((left: TransactionDraft, right: TransactionDraft) =>
        right.device_entry_time.localeCompare(left.device_entry_time),
      ));
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineDraft(draft: TransactionDraft): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryDrafts.set(draft.id, draft);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DRAFT_STORE, 'readwrite');
    transaction.objectStore(DRAFT_STORE).put(draft);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function removeOfflineDraft(id: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryDrafts.delete(id);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DRAFT_STORE, 'readwrite');
    transaction.objectStore(DRAFT_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
