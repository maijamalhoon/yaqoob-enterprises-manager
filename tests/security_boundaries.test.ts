import { describe, expect, it } from 'vitest';
import { StorageEngine } from '@/services/storageEngine';
import { setSecurityPrincipal } from '@/lib/security';
import { DEFAULT_ORGANIZATION } from '@/lib/mockData';

const orgId = DEFAULT_ORGANIZATION.id;
const owner = {
  id: 'owner-test',
  email: 'owner@test.local',
  full_name: 'Owner Test',
  role: 'OWNER' as const,
  organization_id: orgId,
  is_active: true,
  created_at: new Date().toISOString(),
};
const cashier = { ...owner, id: 'cashier-test', role: 'CASHIER' as const };

function salePayload(overrides: Record<string, unknown> = {}) {
  return {
    cashier_id: cashier.id,
    cashier_name: cashier.full_name,
    items: [{
      type: 'PRODUCT' as const,
      item_id: 'prod-ballpen-box',
      name: 'Ballpens',
      quantity: 1,
      unit_price: 320,
      discount: 0,
    }],
    discount: 0,
    tax_amount: 0,
    amount_paid: 320,
    payment_method: 'Cash',
    split_payments: [],
    ...overrides,
  };
}

describe('Security and data-integrity boundaries', () => {
  it('rejects arbitrary local login state through the business boundary', () => {
    setSecurityPrincipal(null);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload())).toThrow(/Authentication required/);
  });

  it('allows all roles to void and transfer (single-owner model)', () => {
    setSecurityPrincipal(owner);
    const sale = StorageEngine.createSaleTransaction(orgId, salePayload());
    setSecurityPrincipal(cashier);
    // In single-owner model, all permissions are granted — operations should succeed
    expect(() => StorageEngine.voidSaleTransaction(orgId, sale.id, cashier.id, cashier.full_name, 'test void')).not.toThrow();
    expect(() => StorageEngine.transferFunds({
      id: 'transfer-allowed', organization_id: orgId, from_account_id: 'acc-cash',
      from_account_name: 'Cash', to_account_id: 'acc-hbl', to_account_name: 'Bank',
      amount: 1, date: '2026-09-20', created_by: cashier.id, created_at: new Date().toISOString(),
    })).not.toThrow();
  });

  it('rejects invalid sale quantities, prices, discounts, and split payments', () => {
    setSecurityPrincipal(owner);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload({ items: [{ ...salePayload().items[0], quantity: -1 }] }))).toThrow(/quantity/);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload({ items: [{ ...salePayload().items[0], unit_price: -1 }] }))).toThrow(/price/);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload({ items: [{ ...salePayload().items[0], discount: 321 }] }))).toThrow(/discount/);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload({ split_payments: [{ account_id: 'acc-cash', account_name: 'Cash', amount: 1 }] }))).toThrow(/Split/);
  });

  it('rejects cross-tenant references and invalid transfers', () => {
    setSecurityPrincipal(owner);
    expect(() => StorageEngine.createSaleTransaction(orgId, salePayload({ customer_id: 'customer-from-other-org' }))).toThrow(/customer/);
    expect(() => StorageEngine.transferFunds({
      id: 'transfer-invalid', organization_id: orgId, from_account_id: 'acc-cash',
      from_account_name: 'Cash', to_account_id: 'acc-cash', to_account_name: 'Cash',
      amount: 10, date: '2026-09-20', created_by: owner.id, created_at: new Date().toISOString(),
    })).toThrow(/different/);
  });

  it('rejects duplicate closing and preserves unique invoice numbers', () => {
    setSecurityPrincipal(owner);
    const date = '2026-09-20';
    StorageEngine.recordDailyClosing(orgId, { closing_date: date, actual_cash: 10000, closed_by: owner.id });
    expect(() => StorageEngine.recordDailyClosing(orgId, { closing_date: date, actual_cash: 10000, closed_by: owner.id })).toThrow(/already exists/);
    const first = StorageEngine.createSaleTransaction(orgId, salePayload());
    const second = StorageEngine.createSaleTransaction(orgId, salePayload());
    expect(second.invoice_number).not.toBe(first.invoice_number);
  });

  it('rejects malformed or cross-organization backup data', () => {
    setSecurityPrincipal(owner);
    const malformed = JSON.stringify({ format: 'YAQOOB_ENTERPRISES_BACKUP_V1', organization_id: orgId, data: { products: [], sales: [] } });
    expect(StorageEngine.validateBackup(malformed).valid).toBe(false);
    const foreign = JSON.parse(StorageEngine.exportData());
    foreign.organization_id = 'foreign-org';
    expect(StorageEngine.validateBackup(JSON.stringify(foreign)).valid).toBe(false);
  });
});
