import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

describe('Sales & Service Recipe Consumption Engine', () => {
  const orgId = DEFAULT_ORGANIZATION.id;

  beforeEach(() => {
    StorageEngine.resetToDefaults();
  });

  it('creates a product sale, deducts stock, calculates COGS & gross profit, and credits cash', () => {
    const product = StorageEngine.getProductById(orgId, 'prod-ballpen-box')!;
    const initialStock = product.current_stock;
    const initialValue = product.stock_value;
    const cashAccount = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const initialCash = cashAccount.current_balance;

    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-cashier-1',
      cashier_name: 'Cashier Ali',
      items: [
        {
          type: 'PRODUCT',
          item_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: 2,
          unit_price: product.selling_price, // 320
          discount: 20, // 20 off
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 1000,
      payment_method: 'Cash',
      split_payments: [],
      notes: 'Test ballpen sale',
    });

    // Calculations:
    // Subtotal: 2 * 320 = 640
    // Item discount: 20 -> Item total: 620
    // Grand total: 620
    // COGS: 2 * 220 = 440
    // Profit: 620 - 440 = 180
    // Change: 1000 - 620 = 380
    expect(sale.status).toBe('COMPLETED');
    expect(sale.subtotal).toBe(640);
    expect(sale.grand_total).toBe(620);
    expect(sale.total_cogs).toBe(440);
    expect(sale.gross_profit).toBe(180);
    expect(sale.change_due).toBe(380);

    // Verify stock deduction
    const updatedProduct = StorageEngine.getProductById(orgId, product.id)!;
    expect(updatedProduct.current_stock).toBe(initialStock - 2);
    expect(updatedProduct.stock_value).toBe(initialValue - 440);

    // Verify stock movement created
    const movements = StorageEngine.getStockMovements(orgId, product.id);
    const saleMov = movements.find((m) => m.reference_id === sale.id);
    expect(saleMov).toBeDefined();
    expect(saleMov?.quantity).toBe(-2);
    expect(saleMov?.movement_type).toBe('SALE');

    // Verify Cash account received the net paid (620)
    const updatedCash = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    expect(updatedCash.current_balance).toBe(initialCash + 620);
  });

  it('consumes service recipe components (raw materials) when a service is sold', () => {
    // Service 'srv-bw-copy' has a recipe component: 1 sheet of 'prod-a4-sheet'
    const paper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!;
    const initialPaperStock = paper.current_stock;
    const service = StorageEngine.getServiceById(orgId, 'srv-bw-copy')!;

    const saleQty = 15; // 15 photocopies
    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-cashier-1',
      cashier_name: 'Cashier Ali',
      items: [
        {
          type: 'SERVICE',
          item_id: service.id,
          name: service.name,
          quantity: saleQty,
          unit_price: service.selling_price, // 10
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 150,
      payment_method: 'Cash',
      split_payments: [],
    });

    expect(sale.grand_total).toBe(150);
    // Recipe unit cost = 1 * 2.2 = 2.2
    // Total COGS = 15 * 2.2 = 33
    expect(sale.total_cogs).toBe(33);
    expect(sale.gross_profit).toBe(117);

    // Check raw material inventory was deducted
    const updatedPaper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!;
    expect(updatedPaper.current_stock).toBe(initialPaperStock - saleQty);

    // Check recipe consumption stock movement was logged
    const movements = StorageEngine.getStockMovements(orgId, 'prod-a4-sheet');
    const recipeMov = movements.find(
      (m) => m.reference_id === sale.id && m.reference_type === 'SERVICE_CONSUMPTION'
    );
    expect(recipeMov).toBeDefined();
    expect(recipeMov?.quantity).toBe(-saleQty);
  });

  it('handles split payments across multiple accounts correctly', () => {
    const cashAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const bankAcc = StorageEngine.getAccountById(orgId, 'acc-hbl')!;
    const initialCash = cashAcc.current_balance;
    const initialBank = bankAcc.current_balance;

    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-owner-1',
      cashier_name: 'Muhammad Yaqoob',
      items: [
        {
          type: 'PRODUCT',
          item_id: 'prod-box-file',
          name: 'Executive Box File Legal Size',
          quantity: 4,
          unit_price: 220, // 880 total
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 880,
      payment_method: 'Split',
      split_payments: [
        { account_id: 'acc-cash', account_name: 'Cash Drawer', amount: 300 },
        { account_id: 'acc-hbl', account_name: 'HBL Business Account', amount: 580 },
      ],
    });

    expect(sale.grand_total).toBe(880);

    const updatedCash = StorageEngine.getAccountById(orgId, 'acc-cash')!;
    const updatedBank = StorageEngine.getAccountById(orgId, 'acc-hbl')!;

    expect(updatedCash.current_balance).toBe(initialCash + 300);
    expect(updatedBank.current_balance).toBe(initialBank + 580);
  });

  it('correctly voids a sale and restores product stock, recipe materials, and account balances', () => {
    const paper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!;
    const pen = StorageEngine.getProductById(orgId, 'prod-ballpen-box')!;
    const cashAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;

    const initialPaperStock = paper.current_stock;
    const initialPenStock = pen.current_stock;
    const initialCash = cashAcc.current_balance;

    // Make sale of 1 pen box and 10 photocopies
    const sale = StorageEngine.createSaleTransaction(orgId, {
      cashier_id: 'usr-cashier-1',
      cashier_name: 'Cashier Ali',
      items: [
        {
          type: 'PRODUCT',
          item_id: pen.id,
          name: pen.name,
          quantity: 1,
          unit_price: 320,
        },
        {
          type: 'SERVICE',
          item_id: 'srv-bw-copy',
          name: 'B&W Photocopy',
          quantity: 10,
          unit_price: 10,
        },
      ],
      discount: 0,
      tax_amount: 0,
      amount_paid: 420,
      payment_method: 'Cash',
      split_payments: [],
    });

    expect(sale.grand_total).toBe(420);

    // Verify stock decreased
    expect(StorageEngine.getProductById(orgId, pen.id)!.current_stock).toBe(initialPenStock - 1);
    expect(StorageEngine.getProductById(orgId, paper.id)!.current_stock).toBe(initialPaperStock - 10);
    expect(StorageEngine.getAccountById(orgId, cashAcc.id)!.current_balance).toBe(initialCash + 420);

    // Now void the sale
    const voided = StorageEngine.voidSaleTransaction(
      orgId,
      sale.id,
      'usr-owner-1',
      'Muhammad Yaqoob',
      'Customer entered wrong item count'
    );

    expect(voided.status).toBe('VOIDED');
    expect(voided.void_reason).toBe('Customer entered wrong item count');

    // Verify stocks fully restored
    expect(StorageEngine.getProductById(orgId, pen.id)!.current_stock).toBe(initialPenStock);
    expect(StorageEngine.getProductById(orgId, paper.id)!.current_stock).toBe(initialPaperStock);

    // Verify cash balance refunded
    expect(StorageEngine.getAccountById(orgId, cashAcc.id)!.current_balance).toBe(initialCash);

    // Verify customer return stock movements exist
    const movements = StorageEngine.getStockMovements(orgId);
    const returnMovs = movements.filter(
      (m) => m.reference_id === sale.id && m.movement_type === 'CUSTOMER_RETURN'
    );
    expect(returnMovs.length).toBe(2);
  });
});
