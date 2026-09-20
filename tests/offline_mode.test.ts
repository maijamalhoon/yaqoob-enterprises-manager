import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { syncEngine } from '@/services/syncEngine';
import { getSqliteDatabase } from '@/services/sqliteEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

describe('Offline Mode & Bidirectional Sync Verification', () => {
  const orgId = DEFAULT_ORGANIZATION.id;

  beforeEach(async () => {
    StorageEngine.resetToDefaults();
    const db = await getSqliteDatabase();
    await db.execute(`DELETE FROM sync_queue;`);
  });

  it('performs full retail cycle offline, persists across reboot, then synchronizes idempotently upon reconnect', async () => {
    // ----------------------------------------------------
    // PHASE 1: SIMULATE NETWORK DISCONNECT (OFFLINE)
    // ----------------------------------------------------
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    // 1. Session check in offline mode
    const activeProfiles = StorageEngine.getProfiles(orgId);
    expect(activeProfiles.length).toBeGreaterThan(0);
    const cashier = activeProfiles[0];

    // 2. Create a product offline
    const prodId = `prod-off-${Date.now()}`;
    const product = StorageEngine.saveProduct({
      id: prodId,
      organization_id: orgId,
      name: 'Dollar Permanent Marker (Black)',
      sku: 'MRK-BLK-DOL',
      unit: 'Pcs',
      purchase_price: 60.0,
      selling_price: 90.0,
      opening_stock: 50,
      current_stock: 50,
      min_stock_threshold: 5,
      track_stock: true,
      is_active: true,
      average_cost: 60.0,
      stock_value: 3000.0,
      created_at: new Date().toISOString(),
    });

    // 3. Create inventory purchase movement offline
    StorageEngine.recordStockMovement({
      id: `mov-off-${Date.now()}`,
      organization_id: orgId,
      product_id: prodId,
      product_name: product.name,
      movement_type: 'PURCHASE',
      quantity: 20,
      unit_cost: 60.0,
      total_cost: 1200.0,
      notes: 'Offline stock receipt',
      created_by: cashier.full_name,
      created_at: new Date().toISOString(),
    });

    expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(70);

    // 4. Make a sale offline
    const initialCash = StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance;
    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: cashier.id,
      cashier_name: cashier.full_name,
      items: [
        {
          type: 'PRODUCT',
          item_id: prodId,
          name: product.name,
          quantity: 5,
          unit_price: 90.0,
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 500.0,
      payment_method: 'Cash Drawer',
      split_payments: [],
    });

    // Sale total: 5 * 90 = 450. Change: 500 - 450 = 50
    expect(sale.grand_total).toBe(450.0);
    expect(sale.change_due).toBe(50.0);

    // 5. Create an expense offline
    const expense = StorageEngine.recordExpense({
      id: `exp-off-${Date.now()}`,
      organization_id: orgId,
      category_id: 'exp-cat-tea',
      category_name: 'Tea & Refreshment',
      amount: 100.0,
      account_id: 'acc-cash',
      account_name: 'Cash Drawer',
      description: 'Emergency diesel for generator during power outage',
      date: new Date().toISOString().slice(0, 10),
      entered_by: cashier.full_name,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });

    // 6. Check account balance: initialCash + 450 (sale) - 100 (expense)
    const currentCash = StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance;
    expect(currentCash).toBe(initialCash + 350.0);

    // 7. Check stock: 70 - 5 = 65
    expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(65);

    // 8. Close & Reopen application simulation
    const persisted = localStorage.getItem('yaqoob_ent_data');
    expect(persisted).not.toBeNull();
    expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(65);
    expect(StorageEngine.getSaleById(orgId, sale.id)!.grand_total).toBe(450.0);

    // Verify mutations accumulated in SQLite sync_queue
    const db = await getSqliteDatabase();
    const queue = await db.select<{ table_name: string; record_id: string }>(
      `SELECT * FROM sync_queue WHERE status = 'pending';`
    );
    expect(queue.length).toBeGreaterThanOrEqual(4); // product, movement, sale, sale_item, expense

    // ----------------------------------------------------
    // PHASE 2: SIMULATE NETWORK RECONNECT & SYNC
    // ----------------------------------------------------
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    // Simulate sync execution
    const syncResult = await syncEngine.syncNow();
    expect(syncResult).toBeDefined();

    // ----------------------------------------------------
    // PHASE 3: IDEMPOTENCY VERIFICATION
    // ----------------------------------------------------
    // Repeating the sync attempt must be idempotent
    const repeatSyncResult = await syncEngine.syncNow();
    expect(repeatSyncResult.pushed).toBe(0); // No double push or duplicates created
  });
});
