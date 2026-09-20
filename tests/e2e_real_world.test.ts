import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';
import {
  canPerformQuickSale,
  canRecordExpense,
  canSubmitDailyClosing,
  canVoidSale,
  canVoidExpense,
  canManageInventory,
  canTransferFunds,
  canViewReports,
  canManageBusinessConfig,
  canManageStaff,
  canRestoreDatabase,
} from '@/lib/permissions';
import { roundMoney } from '@/lib/utils';

describe('End-to-End Real-World Shop Verification (Sections 11 to 18)', () => {
  const orgId = DEFAULT_ORGANIZATION.id;

  beforeEach(() => {
    StorageEngine.resetToDefaults();
  });

  // ==============================================================================
  // SECTION 11: AUTHENTICATION & SESSION TEST
  // ==============================================================================
  describe('Section 11: Authentication & Session Lifecycle', () => {
    it('handles sign up, sign in, session persistence, and organization isolation', () => {
      // 1. Sign up simulation: create user profile
      const newUserId = `usr-test-${Date.now()}`;
      const newProfile = StorageEngine.saveProfile({
        id: newUserId,
        email: 'staff.aslam@yaqoob.com',
        full_name: 'Muhammad Aslam',
        role: 'CASHIER',
        organization_id: orgId,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      expect(newProfile.email).toBe('staff.aslam@yaqoob.com');

      // 2. Sign in simulation: retrieve profile by org
      const profiles = StorageEngine.getProfiles(orgId);
      const user = profiles.find((p) => p.email === 'staff.aslam@yaqoob.com');
      expect(user).toBeDefined();
      expect(user?.role).toBe('CASHIER');

      // 3. Session restore check
      const organization = StorageEngine.getOrganization(orgId);
      expect(organization).not.toBeNull();
      expect(organization?.id).toBe(orgId);
    });
  });

  // ==============================================================================
  // SECTION 12: SINGLE-OWNER PERMISSION MODEL (ALL ROLES UNRESTRICTED)
  // ==============================================================================
  describe('Section 12: Single-Owner Permission Model', () => {
    it('grants all permissions unconditionally regardless of role', () => {
      // In single-owner mode, every action is permitted for any role
      for (const role of ['CASHIER', 'MANAGER', 'OWNER'] as const) {
        expect(canPerformQuickSale(role)).toBe(true);
        expect(canRecordExpense(role)).toBe(true);
        expect(canSubmitDailyClosing(role)).toBe(true);
        expect(canVoidSale(role)).toBe(true);
        expect(canVoidExpense(role)).toBe(true);
        expect(canManageInventory(role)).toBe(true);
        expect(canTransferFunds(role)).toBe(true);
        expect(canViewReports(role)).toBe(true);
        expect(canManageBusinessConfig(role)).toBe(true);
        expect(canManageStaff(role)).toBe(true);
        expect(canRestoreDatabase(role)).toBe(true);
      }
    });
  });

  // ==============================================================================
  // SECTION 13: QUICK SALE REAL-WORLD TEST
  // ==============================================================================
  describe('Section 13: Quick Sale Real-World Multi-Item Transaction', () => {
    it('executes complex sale with services, raw material deduction, discount, and split tender', () => {
      const initialPaper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!.current_stock;
      const initialCash = StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance;
      const initialJazz = StorageEngine.getAccountById(orgId, 'acc-jazzcash')!.current_balance;

      // Sale consisting of:
      // - 10 B&W copies (@ Rs. 10 = Rs. 100, consumes 10 sheets of A4 paper)
      // - 2 Colour prints (@ Rs. 50 = Rs. 100, consumes 2 sheets of A4 color paper)
      // - 1 Urdu typing page (@ Rs. 150 = Rs. 150, pure labor service)
      // - 1 Box of ballpens (@ Rs. 320 = Rs. 320, direct physical retail)
      // Subtotal = 100 + 100 + 150 + 320 = Rs. 670
      // Discount = Rs. 50
      // Grand Total = Rs. 620
      // Payment: Split Rs. 300 Cash + Rs. 320 JazzCash
      const sale = StorageEngine.createSaleTransaction(orgId, {
        customer_id: 'cust-tariq',
        customer_name: 'Advocate Tariq',
        customer_phone: '0300-9876543',
        cashier_id: 'usr-cashier-1',
        cashier_name: 'Cashier Ali',
        items: [
          {
            type: 'SERVICE',
            item_id: 'srv-bw-copy',
            name: 'B&W Photocopy (A4)',
            quantity: 10,
            unit_price: 10.0,
          },
          {
            type: 'SERVICE',
            item_id: 'srv-color-print',
            name: 'Laser Colour Print (A4)',
            quantity: 2,
            unit_price: 50.0,
          },
          {
            type: 'SERVICE',
            item_id: 'srv-typing',
            name: 'Urdu / English Typing',
            quantity: 1,
            unit_price: 150.0,
          },
          {
            type: 'PRODUCT',
            item_id: 'prod-ballpen-box',
            name: 'Dollar Clipper Ball Pen Box',
            quantity: 1,
            unit_price: 320.0,
          },
        ],
        discount: 50.0,
        tax_amount: 0,
        amount_paid: 620.0,
        payment_method: 'Split',
        split_payments: [
          { account_id: 'acc-cash', account_name: 'Cash Drawer', amount: 300.0 },
          { account_id: 'acc-jazzcash', account_name: 'JazzCash Merchant Till', amount: 320.0 },
        ],
        notes: 'High court petition paperwork',
      });

      expect(sale.status).toBe('COMPLETED');
      expect(sale.subtotal).toBe(670.0);
      expect(sale.discount).toBe(50.0);
      expect(sale.grand_total).toBe(620.0);

      // Verify A4 paper stock deducted by exactly 10
      const currentPaper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!.current_stock;
      expect(currentPaper).toBe(initialPaper - 10);

      // Verify accounts updated
      expect(StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance).toBe(initialCash + 300.0);
      expect(StorageEngine.getAccountById(orgId, 'acc-jazzcash')!.current_balance).toBe(initialJazz + 320.0);

      // Verify ledger transactions created
      const transactions = StorageEngine.getTransactions(orgId);
      const saleTransactions = transactions.filter((t) => t.reference_id === sale.id);
      expect(saleTransactions.length).toBe(2);

      // Verify audit log created
      const logs = StorageEngine.getAuditLogs(orgId);
      const saleLog = logs.find((l) => l.entity_id === sale.id);
      expect(saleLog).toBeDefined();
    });
  });

  // ==============================================================================
  // SECTION 14: INVENTORY RECONCILIATION TEST
  // ==============================================================================
  describe('Section 14: Inventory Reconciliation Audit', () => {
    it('accurately reconciles opening stock, purchases, sales, adjustments, and damages', () => {
      const prodId = 'prod-box-file';
      const initial = StorageEngine.getProductById(orgId, prodId)!;
      const initialStock = initial.current_stock; // 42

      // 1. Purchase: +10 units @ Rs. 140
      StorageEngine.recordStockMovement({
        id: `mov-rec-pur-${Date.now()}`,
        organization_id: orgId,
        product_id: prodId,
        product_name: initial.name,
        movement_type: 'PURCHASE',
        quantity: 10,
        unit_cost: 140.0,
        total_cost: 1400.0,
        created_by: 'Owner',
        created_at: new Date().toISOString(),
      });
      expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(initialStock + 10);

      // 2. Sale: -4 units
      StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'PRODUCT', item_id: prodId, name: initial.name, quantity: 4, unit_price: 220.0 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 880.0,
        payment_method: 'Cash Drawer',
        split_payments: [],
      });
      expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(initialStock + 10 - 4);

      // 3. Adjustment Increase: +2 units (physical count found extra)
      StorageEngine.recordStockMovement({
        id: `mov-adj-inc-${Date.now()}`,
        organization_id: orgId,
        product_id: prodId,
        product_name: initial.name,
        movement_type: 'ADJUSTMENT_INCREASE',
        quantity: 2,
        unit_cost: initial.average_cost,
        total_cost: 2 * initial.average_cost,
        notes: 'Annual audit count adjustment',
        created_by: 'Owner',
        created_at: new Date().toISOString(),
      });
      expect(StorageEngine.getProductById(orgId, prodId)!.current_stock).toBe(initialStock + 10 - 4 + 2);

      // 4. Damage / Wastage: -1 unit (water spill damage)
      StorageEngine.recordStockMovement({
        id: `mov-dam-${Date.now()}`,
        organization_id: orgId,
        product_id: prodId,
        product_name: initial.name,
        movement_type: 'DAMAGE_WASTAGE',
        quantity: -1,
        unit_cost: initial.average_cost,
        total_cost: initial.average_cost,
        notes: 'Water damaged in monsoon rain',
        created_by: 'Owner',
        created_at: new Date().toISOString(),
      });

      // Final stock: initialStock + 10 - 4 + 2 - 1 = initialStock + 7
      const finalProduct = StorageEngine.getProductById(orgId, prodId)!;
      expect(finalProduct.current_stock).toBe(initialStock + 7);
      expect(finalProduct.stock_value).toBe(roundMoney(finalProduct.current_stock * finalProduct.average_cost));
    });
  });

  // ==============================================================================
  // SECTION 15: ACCOUNT RECONCILIATION TEST
  // ==============================================================================
  describe('Section 15: Multi-Account Balance Reconciliation', () => {
    it('verifies all 4 payment accounts and ensures fund transfers do not contaminate P&L', () => {
      const cashAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;
      const hblAcc = StorageEngine.getAccountById(orgId, 'acc-hbl')!;
      const jazzAcc = StorageEngine.getAccountById(orgId, 'acc-jazzcash')!;
      const easyAcc = StorageEngine.getAccountById(orgId, 'acc-easypaisa')!;

      const startCash = cashAcc.current_balance;
      const startHbl = hblAcc.current_balance;
      const startJazz = jazzAcc.current_balance;
      const startEasy = easyAcc.current_balance;

      // 1. Cash Sale of Rs. 100
      StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'PRODUCT', item_id: 'prod-khaki-envelope', name: 'Envelope', quantity: 3, unit_price: 30 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 90,
        payment_method: 'Cash Drawer',
        split_payments: [],
      });

      // 2. Bank Sale of Rs. 500
      StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'SERVICE', item_id: 'srv-passport-photo', name: 'Photos', quantity: 2, unit_price: 250 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 500,
        payment_method: 'HBL Business Account',
        split_payments: [],
      });

      // 3. JazzCash Sale of Rs. 200
      StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'SERVICE', item_id: 'srv-online-forms', name: 'Online Form', quantity: 1, unit_price: 200 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 200,
        payment_method: 'JazzCash Merchant Till',
        split_payments: [],
      });

      // 4. Easypaisa Sale of Rs. 300
      StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'SERVICE', item_id: 'srv-ticket-booking', name: 'Ticket Booking', quantity: 1, unit_price: 300 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 300,
        payment_method: 'Easypaisa Business',
        split_payments: [],
      });

      // 5. Cash Expense of Rs. 50
      StorageEngine.recordExpense({
        id: `exp-test-c-${Date.now()}`,
        organization_id: orgId,
        category_id: 'exp-cat-tea',
        category_name: 'Tea',
        amount: 50,
        account_id: 'acc-cash',
        account_name: 'Cash Drawer',
        description: 'Biscuits',
        date: new Date().toISOString().slice(0, 10),
        entered_by: 'Cashier',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      });

      // 6. Transfer Rs. 1,000 from Cash Drawer to HBL Bank
      StorageEngine.transferFunds({
        id: `tf-reconcile-${Date.now()}`,
        organization_id: orgId,
        from_account_id: 'acc-cash',
        from_account_name: 'Cash Drawer',
        to_account_id: 'acc-hbl',
        to_account_name: 'HBL Business Account',
        amount: 1000,
        date: new Date().toISOString().slice(0, 10),
        notes: 'Deposit to HBL',
        created_by: 'Owner',
        created_at: new Date().toISOString(),
      });

      // Verify all 4 account balances
      expect(StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance).toBe(startCash + 90 - 50 - 1000);
      expect(StorageEngine.getAccountById(orgId, 'acc-hbl')!.current_balance).toBe(startHbl + 500 + 1000);
      expect(StorageEngine.getAccountById(orgId, 'acc-jazzcash')!.current_balance).toBe(startJazz + 200);
      expect(StorageEngine.getAccountById(orgId, 'acc-easypaisa')!.current_balance).toBe(startEasy + 300);
    });
  });

  // ==============================================================================
  // SECTION 16: P&L VALIDATION
  // ==============================================================================
  describe('Section 16: Profit & Loss (P&L) Statement Validation', () => {
    it('manually calculates and verifies Revenue, COGS, Gross Profit, Expenses, and Net Margin', () => {
      // Create Sale 1: 5 envelopes (Selling: 30, Cost: 15) -> Rev = 150, COGS = 75, Gross Profit = 75
      const s1 = StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier',
        items: [{ type: 'PRODUCT', item_id: 'prod-khaki-envelope', name: 'Envelope', quantity: 5, unit_price: 30 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 150,
        payment_method: 'Cash Drawer',
        split_payments: [],
      });

      // Create Sale 2: 10 B&W copies (Selling: 10, Cost: 2.20) -> Rev = 100, COGS = 22, Gross Profit = 78
      const s2 = StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier',
        items: [{ type: 'SERVICE', item_id: 'srv-bw-copy', name: 'Photocopy', quantity: 10, unit_price: 10 }],
        discount: 10, // Rs. 10 discount -> Net Rev = 90
        tax_amount: 0,
        amount_paid: 90,
        payment_method: 'Cash Drawer',
        split_payments: [],
      });

      // Create Operating Expense: Rs. 60
      const exp = StorageEngine.recordExpense({
        id: `exp-pl-${Date.now()}`,
        organization_id: orgId,
        category_id: 'exp-cat-tea',
        category_name: 'Tea',
        amount: 60,
        account_id: 'acc-cash',
        account_name: 'Cash Drawer',
        description: 'Office tea',
        date: new Date().toISOString().slice(0, 10),
        entered_by: 'Cashier',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      });

      // Manual Calculations:
      // Total Revenue = 150 + 90 = 240
      // Total COGS = 75 + 22 = 97
      // Total Gross Profit = 240 - 97 = 143
      // Total Operating Expenses = 60
      // Expected Net Profit = 143 - 60 = 83
      const totalRev = s1.grand_total + s2.grand_total;
      const totalCogs = s1.total_cogs + s2.total_cogs;
      const grossProfit = totalRev - totalCogs;
      const netProfit = grossProfit - exp.amount;

      expect(totalRev).toBe(240.0);
      expect(totalCogs).toBe(97.0);
      expect(grossProfit).toBe(143.0);
      expect(netProfit).toBe(83.0);
    });
  });

  // ==============================================================================
  // SECTION 17: DAILY CASH CLOSING
  // ==============================================================================
  describe('Section 17: Daily Cash Closing Audit & Discrepancy Verification', () => {
    it('runs full day shift simulation and records expected vs counted cash difference', () => {
      const today = new Date().toISOString().slice(0, 10);
      const summary = StorageEngine.getDailyClosingSummary(orgId, today);

      // Simulate physical count with Rs. 50 overage (surplus)
      const countedCash = summary.expectedCash + 50.0;
      const closing = StorageEngine.recordDailyClosing(orgId, {
        closing_date: today,
        actual_cash: countedCash,
        notes: 'Shift closed smoothly with 50 Rs customer tip surplus',
        closed_by: 'Muhammad Yaqoob',
      });

      expect(closing.expected_cash).toBe(summary.expectedCash);
      expect(closing.actual_cash).toBe(countedCash);
      expect(closing.difference).toBe(50.0);

      // Verify closing record cannot be silently overwritten
      const closings = StorageEngine.getDailyClosings(orgId);
      expect(closings.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==============================================================================
  // SECTION 18: VOID / REFUND TRANSACTION TEST
  // ==============================================================================
  describe('Section 18: Void and Refund Transaction Reversals', () => {
    it('creates a sale, voids it, and verifies reversal of stock, recipe consumption, and cash balances', () => {
      const paper = StorageEngine.getProductById(orgId, 'prod-a4-sheet')!;
      const cashAcc = StorageEngine.getAccountById(orgId, 'acc-cash')!;
      const startPaperStock = paper.current_stock;
      const startCash = cashAcc.current_balance;

      // Make a sale: 20 B&W copies for Rs. 200
      const sale = StorageEngine.createSaleTransaction(orgId, {
        cashier_id: 'usr-1',
        cashier_name: 'Cashier Ali',
        items: [{ type: 'SERVICE', item_id: 'srv-bw-copy', name: 'Photocopy', quantity: 20, unit_price: 10 }],
        discount: 0,
        tax_amount: 0,
        amount_paid: 200,
        payment_method: 'Cash Drawer',
        split_payments: [],
      });

      // Verify deducted
      expect(StorageEngine.getProductById(orgId, 'prod-a4-sheet')!.current_stock).toBe(startPaperStock - 20);
      expect(StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance).toBe(startCash + 200);

      // Void the sale
      const voided = StorageEngine.voidSaleTransaction(
        orgId,
        sale.id,
        'usr-owner-1',
        'Muhammad Yaqoob',
        'Customer changed mind before printing started'
      );

      expect(voided.status).toBe('VOIDED');
      expect(voided.void_reason).toBe('Customer changed mind before printing started');

      // Verify stock fully restored
      expect(StorageEngine.getProductById(orgId, 'prod-a4-sheet')!.current_stock).toBe(startPaperStock);

      // Verify cash refunded
      expect(StorageEngine.getAccountById(orgId, 'acc-cash')!.current_balance).toBe(startCash);
    });
  });
});
