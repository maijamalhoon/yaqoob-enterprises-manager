import { describe, expect, it } from 'vitest';
import { sqliteRepository } from '@/services/sqliteRepository';
import { setSecurityPrincipal } from '@/lib/security';

const organizationId = '6d7b5c7e-2f55-4ca7-aaf2-4a8a4fb32e50';
const ownerId = '79f4c9f5-2018-4e72-8e35-5cfa9e4c6be2';

describe('SQLite transactional business repository', () => {
  it('rolls back inventory changes when sale validation fails', async () => {
    setSecurityPrincipal({
      id: ownerId,
      email: 'owner@example.test',
      full_name: 'SQLite Test Owner',
      role: 'OWNER',
      organization_id: organizationId,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    await sqliteRepository.createLocalOwnerAccount({
      id: organizationId,
      name: 'SQLite Test Shop',
      owner_name: 'SQLite Test Owner',
      currency: 'PKR',
      currency_symbol: 'Rs.',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
      business_category: 'Retail',
      tax_rate: 0,
      tax_enabled: false,
      invoice_prefix: 'TEST-',
      next_invoice_number: 1001,
      created_at: new Date().toISOString(),
    }, {
      id: ownerId,
      email: 'owner@example.test',
      full_name: 'SQLite Test Owner',
      role: 'OWNER',
      organization_id: organizationId,
      is_active: true,
      password_hash: 'test',
      created_at: new Date().toISOString(),
    });
    const product = await sqliteRepository.saveProduct(organizationId, {
      id: '1b45d1db-65f4-4d85-9d2e-3b1ddde2cc37',
      name: 'Transactional Product',
      unit: 'Pcs',
      selling_price: 100,
      purchase_price: 40,
      opening_stock: 10,
      current_stock: 10,
      average_cost: 40,
      stock_value: 400,
      track_stock: true,
    });
    await expect(sqliteRepository.createSale(organizationId, {
      items: [{ type: 'PRODUCT', item_id: '1b45d1db-65f4-4d85-9d2e-3b1ddde2cc37', name: product.name, quantity: 2, unit_price: 100 }],
      discount: 0,
      tax_amount: 0,
      amount_paid: 200,
      payment_method: 'Cash',
      split_payments: [],
      customer_id: 'missing-customer',
      cashier_id: ownerId,
      cashier_name: 'spoofed name',
    })).rejects.toThrow(/customer/);
    expect((await sqliteRepository.getProductById(organizationId, product.id))?.current_stock).toBe(10);
  });
});
