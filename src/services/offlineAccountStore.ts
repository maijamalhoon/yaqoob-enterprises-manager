import { LedgerAccount } from '../types/ledger';

interface BaseAccountOperation {
  id: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  attempts: number;
}

export type OfflineAccountOperation =
  | (BaseAccountOperation & { kind: 'CREATE'; account: LedgerAccount })
  | (BaseAccountOperation & { kind: 'UPDATE'; accountId: string; changes: { name?: string; is_active?: boolean } })
  | (BaseAccountOperation & { kind: 'TRANSFER'; fromAccountId: string; toAccountId: string; amountPaisa: number; businessDate: string; notes?: string });

const DB_NAME = 'shop-pro-offline-accounts';
const DB_VERSION = 1;
const ACCOUNT_STORE = 'accounts';
const OPERATION_STORE = 'operations';

const memoryAccounts = new Map<string, LedgerAccount>();
const memoryOperations = new Map<string, OfflineAccountOperation>();

async function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACCOUNT_STORE)) {
        db.createObjectStore(ACCOUNT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OPERATION_STORE)) {
        db.createObjectStore(OPERATION_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedAccounts(organizationId: string): Promise<LedgerAccount[]> {
  const db = await openDB();
  if (!db) {
    return [...memoryAccounts.values()].filter((account) => account.organization_id === organizationId);
  }

  return new Promise((resolve, reject) => {
    const request = db.transaction(ACCOUNT_STORE, 'readonly').objectStore(ACCOUNT_STORE).getAll();
    request.onsuccess = () => resolve((request.result || []).filter(
      (account: LedgerAccount) => account.organization_id === organizationId,
    ));
    request.onerror = () => reject(request.error);
  });
}

export async function cacheAccounts(accounts: LedgerAccount[]): Promise<void> {
  const db = await openDB();
  if (!db) {
    for (const account of accounts) memoryAccounts.set(account.id, account);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ACCOUNT_STORE, 'readwrite');
    const store = transaction.objectStore(ACCOUNT_STORE);
    for (const account of accounts) store.put(account);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getOfflineAccountOperations(
  organizationId: string,
): Promise<OfflineAccountOperation[]> {
  const db = await openDB();
  if (!db) {
    return [...memoryOperations.values()]
      .filter((operation) => operation.organizationId === organizationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  return new Promise((resolve, reject) => {
    const request = db.transaction(OPERATION_STORE, 'readonly').objectStore(OPERATION_STORE).getAll();
    request.onsuccess = () => resolve((request.result || [])
      .filter((operation: OfflineAccountOperation) => operation.organizationId === organizationId)
      .sort((left: OfflineAccountOperation, right: OfflineAccountOperation) => left.createdAt.localeCompare(right.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineAccountOperation(
  operation: OfflineAccountOperation,
  accountToCache?: LedgerAccount,
): Promise<void> {
  const db = await openDB();
  if (!db) {
    if (accountToCache) memoryAccounts.set(accountToCache.id, accountToCache);
    memoryOperations.set(operation.id, operation);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      accountToCache ? [ACCOUNT_STORE, OPERATION_STORE] : [OPERATION_STORE],
      'readwrite',
    );
    if (accountToCache) transaction.objectStore(ACCOUNT_STORE).put(accountToCache);
    transaction.objectStore(OPERATION_STORE).put(operation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function removeOfflineAccountOperation(id: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryOperations.delete(id);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OPERATION_STORE, 'readwrite');
    const request = transaction.objectStore(OPERATION_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}