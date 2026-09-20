import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { salesRepo, inventoryRepo, customerRepo, accountRepo } from '../../services';
import { Product, Service, Customer, PaymentAccount, CartItem, Sale, SplitPayment } from '../../types';
import { CartItemRow } from './CartItemRow';
import { PaymentModal } from './PaymentModal';
import { PrintReceiptModal } from './PrintReceiptModal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { roundMoney, formatCurrency } from '../../lib/utils';
import {
  Search,
  Zap,
  Boxes,
  ShoppingCart,
  Trash2,
  Tag,
  Star,
  Plus,
  ArrowRight,
  Barcode,
  RotateCcw,
} from 'lucide-react';

export const QuickSaleView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'SERVICES' | 'PRODUCTS'>('ALL');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printedSale, setPrintedSale] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial catalog data
  useEffect(() => {
    async function loadCatalog() {
      const [prodList, srvList, catList, custList, accList] = await Promise.all([
        inventoryRepo.getProducts(organization.id),
        inventoryRepo.getServices(organization.id),
        inventoryRepo.getCategories(organization.id),
        customerRepo.getCustomers(organization.id),
        accountRepo.getAccounts(organization.id),
      ]);
      setProducts(prodList);
      setServices(srvList);
      setCategories(catList);
      setCustomers(custList);
      setAccounts(accList);
    }
    loadCatalog();
  }, [organization.id, dataVersion]);

  // Shortcut F2 focuses search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add Item to Cart
  const handleAddItem = (item: Product | Service, type: 'PRODUCT' | 'SERVICE') => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.id === item.id);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        return copy;
      } else {
        const newItem: CartItem = {
          id: item.id,
          item_id: item.id,
          type,
          name: item.name,
          sku: item.sku,
          unit: 'unit' in item ? item.unit : 'Job',
          quantity: 1,
          unit_price: item.selling_price,
          unit_cost: 'average_cost' in item ? item.average_cost : ('estimated_cost' in item ? item.estimated_cost : 0),
          discount: 0,
          current_stock: 'current_stock' in item ? item.current_stock : undefined,
          track_stock: 'track_stock' in item ? item.track_stock : false,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit_price: newPrice } : item))
    );
  };

  const handleUpdateDiscount = (id: string, newDiscount: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, discount: newDiscount } : item))
    );
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setOrderDiscount(0);
    setSelectedCustomer(null);
  };

  // Barcode / Exact SKU Enter handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // Look for exact SKU or name match
      const exactProduct = products.find(
        (p) => p.sku?.toLowerCase() === q || p.name.toLowerCase() === q
      );
      if (exactProduct) {
        handleAddItem(exactProduct, 'PRODUCT');
        setSearchQuery('');
        return;
      }
      const exactService = services.find(
        (s) => s.sku?.toLowerCase() === q || s.name.toLowerCase() === q
      );
      if (exactService) {
        handleAddItem(exactService, 'SERVICE');
        setSearchQuery('');
        return;
      }
    }
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return roundMoney(
      cart.reduce((sum, item) => sum + item.quantity * item.unit_price - (item.discount || 0), 0)
    );
  }, [cart]);

  const taxAmount = useMemo(() => {
    if (!organization.tax_enabled || !organization.tax_rate) return 0;
    const taxableAmount = Math.max(0, cartSubtotal - orderDiscount);
    return roundMoney((taxableAmount * organization.tax_rate) / 100);
  }, [cartSubtotal, orderDiscount, organization.tax_enabled, organization.tax_rate]);

  const grandTotal = useMemo(() => {
    return roundMoney(Math.max(0, cartSubtotal - orderDiscount + taxAmount));
  }, [cartSubtotal, orderDiscount, taxAmount]);

  // Complete Sale execution
  const handleExecuteSale = async ({
    paymentMethod,
    amountPaid,
    splitPayments,
    notes,
    printReceipt,
  }: {
    paymentMethod: string;
    amountPaid: number;
    splitPayments: SplitPayment[];
    notes?: string;
    printReceipt: boolean;
  }) => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const sale = await salesRepo.createSale(organization.id, {
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        customer_phone: selectedCustomer?.phone,
        cashier_id: user?.id || 'usr-cashier',
        cashier_name: user?.full_name || 'Staff Cashier',
        items: cart.map((ci) => ({
          type: ci.type,
          item_id: ci.id,
          name: ci.name,
          sku: ci.sku,
          unit: ci.unit,
          quantity: ci.quantity,
          unit_price: ci.unit_price,
          discount: ci.discount || 0,
        })),
        discount: orderDiscount,
        tax_amount: taxAmount,
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        split_payments: splitPayments,
        notes,
      });

      showToast(
        'success',
        `Sale Completed #${sale.invoice_number}`,
        `${formatCurrency(sale.grand_total, organization.currency_symbol)} paid via ${paymentMethod}`
      );

      setIsPaymentModalOpen(false);
      handleClearCart();
      refreshData();

      if (printReceipt) {
        setPrintedSale(sale);
      }
    } catch (err: any) {
      showToast('error', 'Sale Failed', err.message || 'Could not complete transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list: Array<
      (Product | Service) & { itemType: 'PRODUCT' | 'SERVICE'; categoryName?: string }
    > = [];

    if (activeTab === 'ALL' || activeTab === 'PRODUCTS') {
      const prods = products
        .filter((p) => p.is_active)
        .map((p) => ({ ...p, itemType: 'PRODUCT' as const, categoryName: p.category_name }));
      list = [...list, ...prods];
    }

    if (activeTab === 'ALL' || activeTab === 'SERVICES') {
      const srvs = services
        .filter((s) => s.is_active)
        .map((s) => ({ ...s, itemType: 'SERVICE' as const, categoryName: s.category_name }));
      list = [...list, ...srvs];
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => item.category_name === selectedCategory);
    }

    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.sku && item.sku.toLowerCase().includes(q)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, services, activeTab, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f5f7fa]">
      {/* ========================================================================= */}
      {/* LEFT AREA: Catalog Search, Category Tabs & Quick Add Grid */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col border-r border-[#d9e2ec] overflow-hidden">
        {/* Search Header Bar */}
        <div className="p-3 border-b border-[#d9e2ec] bg-white flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#627d98]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product / service name, SKU, or scan barcode... (Press F2 to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-14 py-2 rounded-[10px] bg-white border border-[#d9e2ec] text-xs sm:text-sm text-[#102a43] placeholder:text-[#627d98] focus:border-teal-600 focus:outline-none"
            />
            <div className="absolute right-2.5 top-2 flex items-center gap-1 pointer-events-none">
              <Barcode className="h-3.5 w-3.5 text-[#627d98]" />
              <kbd className="px-1 py-0.5 text-[9px] font-mono text-[#627d98] bg-[#f5f7fa] border border-[#d9e2ec] rounded">
                F2
              </kbd>
            </div>
          </div>

          {/* Tab Filter: ALL / SERVICES / PRODUCTS */}
          <div className="flex rounded-[10px] border border-[#d9e2ec] bg-[#f5f7fa] p-0.5 text-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-[8px] font-medium transition-colors cursor-pointer ${
                activeTab === 'ALL' ? 'bg-teal-700 text-white shadow-xs' : 'text-[#627d98] hover:text-[#102a43]'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setActiveTab('SERVICES')}
              className={`px-3 py-1 rounded-[8px] font-medium transition-colors cursor-pointer ${
                activeTab === 'SERVICES'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-[#627d98] hover:text-[#102a43]'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab('PRODUCTS')}
              className={`px-3 py-1 rounded-[8px] font-medium transition-colors cursor-pointer ${
                activeTab === 'PRODUCTS'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-[#627d98] hover:text-[#102a43]'
              }`}
            >
              Inventory
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-3 py-2 border-b border-[#d9e2ec] bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-[8px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'text-[#627d98] hover:bg-[#f5f7fa] hover:text-[#102a43]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.name
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-[#627d98] hover:bg-[#f5f7fa] hover:text-[#102a43]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Item Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#627d98] text-center">
              <Boxes className="h-10 w-10 text-[#9fb3c8] mb-2" />
              <p className="text-sm font-medium text-[#486581]">No items match your query</p>
              <p className="text-xs text-[#627d98] mt-1">Try another keyword or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredItems.map((item) => {
                const isService = item.itemType === 'SERVICE';
                const hasStock =
                  !isService && 'track_stock' in item && item.track_stock
                    ? (item.current_stock ?? 0)
                    : null;

                const isLow = hasStock !== null && hasStock <= (item as Product).min_stock_threshold;
                const isOut = hasStock !== null && hasStock <= 0;

                return (
                  <button
                    key={`${item.itemType}-${item.id}`}
                    onClick={() => handleAddItem(item, item.itemType)}
                    className="flex flex-col justify-between p-3 rounded-[10px] border border-[#d9e2ec] bg-white hover:border-teal-400 hover:shadow-sm text-left transition-all group cursor-pointer shadow-[0_1px_2px_rgba(16,42,67,0.04)] active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            isService
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : 'bg-[#eef2f6] text-[#243b53] border-[#d9e2ec]'
                          }`}
                        >
                          {isService ? 'SERVICE' : 'PRODUCT'}
                        </span>
                        {item.sku && (
                          <span className="text-[10px] font-mono text-[#627d98] truncate">
                            {item.sku}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-[#102a43] group-hover:text-teal-800 line-clamp-2 leading-snug">
                        {item.name}
                      </h4>
                    </div>

                    <div className="pt-2 mt-2 border-t border-[#d9e2ec] flex items-end justify-between">
                      <div>
                        <span className="text-sm font-mono font-bold text-[#102a43] group-hover:text-teal-800">
                          {formatCurrency(item.selling_price, organization.currency_symbol)}
                        </span>
                        {'unit' in item && (
                          <span className="text-[10px] text-[#627d98] ml-1">/{item.unit}</span>
                        )}
                      </div>

                      {hasStock !== null && (
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                            isOut
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-[#f5f7fa] text-[#627d98] border-[#d9e2ec]'
                          }`}
                        >
                          {hasStock} left
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT AREA: Current Cart / Order Summary */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-96 flex flex-col bg-white border-t lg:border-t-0 border-[#d9e2ec] shadow-sm">
        {/* Cart Header: Customer selector & clear */}
        <div className="p-3 border-b border-[#d9e2ec] bg-[#f5f7fa] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-teal-700" />
            <span className="text-xs font-bold text-[#102a43] uppercase tracking-wider">
              Current Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-[11px] text-[#627d98] hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Customer Selector Bar */}
        <div className="px-3 py-2 bg-white border-b border-[#d9e2ec] flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#627d98]">Customer:</span>
          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const found = customers.find((c) => c.id === e.target.value) || null;
              setSelectedCustomer(found);
            }}
            className="flex-1 bg-white border border-[#d9e2ec] rounded-[8px] px-2 py-1 text-xs text-[#102a43] focus:border-teal-600 focus:outline-none truncate"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f5f7fa]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#627d98] p-6 text-center">
              <div className="p-3 rounded-full bg-white border border-[#d9e2ec] mb-2">
                <ShoppingCart className="h-6 w-6 text-[#9fb3c8]" />
              </div>
              <p className="text-xs font-medium text-[#486581]">Your cart is empty</p>
              <p className="text-[11px] text-[#627d98] mt-1">
                Click any product or service on the left to add items to invoice.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                currencySymbol={organization.currency_symbol}
                onUpdateQty={handleUpdateQty}
                onUpdatePrice={handleUpdatePrice}
                onUpdateDiscount={handleUpdateDiscount}
                onRemove={handleRemoveFromCart}
              />
            ))
          )}
        </div>

        {/* Cart Totals & Checkout Trigger */}
        <div className="p-3.5 border-t border-[#d9e2ec] bg-white space-y-2.5">
          {/* Subtotal */}
          <div className="flex justify-between text-xs text-[#627d98]">
            <span>Subtotal:</span>
            <span className="font-mono text-[#102a43]">
              {formatCurrency(cartSubtotal, organization.currency_symbol)}
            </span>
          </div>

          {/* Discount input */}
          <div className="flex items-center justify-between text-xs text-[#627d98]">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3 text-teal-700" /> Order Discount:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono">{organization.currency_symbol}</span>
              <input
                type="number"
                min="0"
                value={orderDiscount || ''}
                placeholder="0"
                onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 px-1.5 py-0.5 rounded-[6px] bg-white border border-[#d9e2ec] text-xs font-mono text-[#102a43] text-right focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Tax (if configured) */}
          {organization.tax_enabled && (
            <div className="flex justify-between text-xs text-[#627d98]">
              <span>Tax ({organization.tax_rate}%):</span>
              <span className="font-mono text-[#102a43]">
                {formatCurrency(taxAmount, organization.currency_symbol)}
              </span>
            </div>
          )}

          {/* Grand Total */}
          <div className="pt-2 border-t border-[#d9e2ec] flex items-baseline justify-between">
            <span className="text-xs font-bold text-[#102a43] uppercase tracking-wider">
              Grand Total:
            </span>
            <span className="text-2xl font-mono font-extrabold text-teal-800">
              {formatCurrency(grandTotal, organization.currency_symbol)}
            </span>
          </div>

          {/* Checkout Button */}
          <Button
            variant="primary"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full text-base font-bold shadow-xs cursor-pointer"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        grandTotal={grandTotal}
        currencySymbol={organization.currency_symbol}
        accounts={accounts}
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
        onCompleteSale={handleExecuteSale}
        isLoading={isSubmitting}
      />

      {/* Instant Thermal / Browser Print Receipt Modal */}
      <PrintReceiptModal sale={printedSale} onClose={() => setPrintedSale(null)} />
    </div>
  );
};
