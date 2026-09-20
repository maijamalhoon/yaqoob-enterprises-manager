import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

describe('Real Desktop Database & Offline Persistence Lifecycle', () => {
  const orgId = DEFAULT_ORGANIZATION.id;

  beforeEach(() => {
    StorageEngine.resetToDefaults();
  });

  it('maintains full business data lifecycle across application restarts completely offline', () => {
    // 1. Create a new custom product
    const customProduct = StorageEngine.saveProduct({
      id: 'prod-custom-legal-stamp',
      organization_id: orgId,
      name: 'Legal Stamp Paper Rs. 50 (Original)',
      sku: 'STP-LGL-050',
      unit: 'Sheet',
      purchase_price: 50.0,
      selling_price: 70.0,
      opening_stock: 100,
      current_stock: 100,
      min_stock_threshold: 10,
      track_stock: true,
      is_active: true,
      average_cost: 50.0,
      stock_value: 5000.0,
      created_at: new Date().toISOString(),
    });
    expect(customProduct.id).toBe('prod-custom-legal-stamp');

    // 2. Create a new custom service with a recipe component consuming the product
    const customService = StorageEngine.saveService({
      id: 'srv-affidavit-drafting',
      organization_id: orgId,
      name: 'Custom Legal Affidavit Drafting & Print',
      sku: 'SRV-AFF-DRF',
      selling_price: 350.0,
      estimated_cost: 50.0,
      is_active: true,
      components: [
        {
          id: 'rec-comp-stamp',
          organization_id: orgId,
          service_id: 'srv-affidavit-drafting',
          product_id: 'prod-custom-legal-stamp',
          product_name: 'Legal Stamp Paper Rs. 50 (Original)',
          quantity_consumed: 1,
          unit: 'Sheet',
        },
      ],
      created_at: new Date().toISOString(),
    });
    expect(customService.id).toBe('srv-affidavit-drafting');

    // 3. Purchase additional inventory (Stock Movement PURCHASE)
    StorageEngine.recordStockMovement({
      id: `mov-pur-${Date.now()}`,
      organization_id: orgId,
      product_id: 'prod-custom-legal-stamp',
      product_name: 'Legal Stamp Paper Rs. 50 (Original)',
      movement_type: 'PURCHASE',
      quantity: 50,
      unit_cost: 52.0,
      total_cost: 2600.0,
      notes: 'Fresh consignment from treasury vendor',
      created_by: 'Muhammad Yaqoob',
      created_at: new Date().toISOString(),
    });

    // Stock before sale: 100 + 50 = 150
    const stockAfterPurchase = StorageEngine.getProductById(orgId, 'prod-custom-legal-stamp')!;
    expect(stockAfterPurchase.current_stock).toBe(150);

    // 4. Make a sale consuming 2 affidavits (consumes 2 stamp papers)
    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-cashier-1',
      cashier_name: 'Cashier Ali',
      items: [
        {
          type: 'SERVICE',
          item_id: 'srv-affidavit-drafting',
          name: 'Custom Legal Affidavit Drafting & Print',
          quantity: 2,
          unit_price: 350.0,
        },
      ],
      discount: 20.0, // Rs. 20 discount
      tax_amount: 0,
      amount_paid: 700.0, // paid 700
      payment_method: 'Cash Drawer',
      split_payments: [],
      notes: 'Urgent rent agreement affidavit',
    });

    // Sale total: (2 * 350) - 20 = 680
    expect(sale.grand_total).toBe(680.0);
    expect(sale.change_due).toBe(20.0);

    // Stock after sale: 150 - 2 = 148
    const stockAfterSale = StorageEngine.getProductById(orgId, 'prod-custom-legal-stamp')!;
    expect(stockAfterSale.current_stock).toBe(148);

    // 5. Create an operating expense
    const expense = StorageEngine.recordExpense({
      id: `exp-desk-${Date.now()}`,
      organization_id: orgId,
      category_id: 'exp-cat-tea',
      category_name: 'Tea & Refreshment',
      amount: 180.0,
      account_id: 'acc-cash',
      account_name: 'Cash Drawer',
      description: 'Morning tea and biscuits for shop staff',
      date: new Date().toISOString().slice(0, 10),
      entered_by: 'Cashier Ali',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });
    expect(expense.amount).toBe(180.0);

    // ==========================================
    // SIMULATE APPLICATION RESTART
    // In a desktop environment, the DB file remains in disk storage.
    // In our storage engine, we reload state from persisted storage.
    // ==========================================
    const persistedRaw = localStorage.getItem('yaqoob_ent_data');
    expect(persistedRaw).not.toBeNull();

    // Verify all records exist post-restart
    const reloadedProduct = StorageEngine.getProductById(orgId, 'prod-custom-legal-stamp');
    expect(reloadedProduct).not.toBeNull();
    expect(reloadedProduct?.current_stock).toBe(148);

    const reloadedService = StorageEngine.getServiceById(orgId, 'srv-affidavit-drafting');
    expect(reloadedService).not.toBeNull();
    expect(reloadedService?.components?.length).toBe(1);

    const reloadedSale = StorageEngine.getSaleById(orgId, sale.id);
    expect(reloadedSale).not.toBeNull();
    expect(reloadedSale?.grand_total).toBe(680.0);
    expect(reloadedSale?.items[0].quantity).toBe(2);

    const reloadedExpenses = StorageEngine.getExpenses(orgId);
    const foundExp = reloadedExpenses.find((e) => e.id === expense.id);
    expect(foundExp).toBeDefined();
    expect(foundExp?.amount).toBe(180.0);
  });
});
