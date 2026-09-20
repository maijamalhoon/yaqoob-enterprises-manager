import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import {
  salesRepo,
  inventoryRepo,
  customerRepo,
  accountRepo,
} from "../../services";
import {
  Product,
  Service,
  Customer,
  PaymentAccount,
  CartItem,
  Sale,
  SplitPayment,
} from "../../types";
import { CartItemRow } from "./CartItemRow";
import { PaymentModal } from "./PaymentModal";
import { PrintReceiptModal } from "./PrintReceiptModal";
import { roundMoney, formatCurrency } from "../../lib/utils";
import {
  Search,
  ScanBarcode,
  ShoppingBag,
  Trash2,
  Tag,
  PlusCircle,
  Clock,
  User,
  ArrowRight,
  Boxes,
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"ALL" | "SERVICES" | "PRODUCTS">("ALL");

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
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Add Item to Cart
  const handleAddItem = (item: Product | Service, type: "PRODUCT" | "SERVICE") => {
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
          unit: "unit" in item ? item.unit : "Job",
          quantity: 1,
          unit_price: item.selling_price,
          unit_cost:
            "average_cost" in item
              ? item.average_cost
              : "estimated_cost" in item
              ? item.estimated_cost
              : 0,
          discount: 0,
          current_stock:
            "current_stock" in item ? item.current_stock : undefined,
          track_stock: "track_stock" in item ? item.track_stock : false,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: newQty } : item,
      ),
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, unit_price: newPrice } : item,
      ),
    );
  };

  const handleUpdateDiscount = (id: string, newDiscount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, discount: newDiscount } : item,
      ),
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
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const exactProduct = products.find(
        (p) => p.sku?.toLowerCase() === q || p.name.toLowerCase() === q,
      );
      if (exactProduct) {
        handleAddItem(exactProduct, "PRODUCT");
        setSearchQuery("");
        return;
      }
      const exactService = services.find(
        (s) => s.sku?.toLowerCase() === q || s.name.toLowerCase() === q,
      );
      if (exactService) {
        handleAddItem(exactService, "SERVICE");
        setSearchQuery("");
        return;
      }
    }
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return roundMoney(
      cart.reduce(
        (sum, item) =>
          sum + item.quantity * item.unit_price - (item.discount || 0),
        0,
      ),
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
        customer_name: selectedCustomer
          ? selectedCustomer.name
          : "Walk-in Customer",
        customer_phone: selectedCustomer?.phone,
        cashier_id: user?.id || "usr-owner-1",
        cashier_name: user?.full_name || "Muhammad Yaqoob",
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
        "success",
        `Sale Completed #${sale.invoice_number}`,
        `${formatCurrency(sale.grand_total, organization.currency_symbol)} paid via ${paymentMethod}`,
      );

      setIsPaymentModalOpen(false);
      handleClearCart();
      refreshData();

      if (printReceipt) {
        setPrintedSale(sale);
      }
    } catch (err: any) {
      showToast(
        "error",
        "Sale Failed",
        err.message || "Could not complete transaction",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list: Array<
      (Product | Service) & {
        itemType: "PRODUCT" | "SERVICE";
        categoryName?: string;
      }
    > = [];

    if (activeTab === "ALL" || activeTab === "PRODUCTS") {
      const prods = products
        .filter((p) => p.is_active)
        .map((p) => ({
          ...p,
          itemType: "PRODUCT" as const,
          categoryName: p.category_name,
        }));
      list = [...list, ...prods];
    }

    if (activeTab === "ALL" || activeTab === "SERVICES") {
      const srvs = services
        .filter((s) => s.is_active)
        .map((s) => ({
          ...s,
          itemType: "SERVICE" as const,
          categoryName: s.category_name,
        }));
      list = [...list, ...srvs];
    }

    if (selectedCategory !== "ALL") {
      list = list.filter((item) => item.category_name === selectedCategory);
    }

    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.sku && item.sku.toLowerCase().includes(q)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [products, services, activeTab, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col xl:flex-row h-full overflow-hidden bg-[#f8f9fb] select-none p-6 gap-6">
      {/* ========================================================================= */}
      {/* LEFT PANEL: Catalog, Search, Categories & Quick Add */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
        {/* Search Header Bar */}
        <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shrink-0">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#777587]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode or search item... [F2]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full h-11 pl-11 pr-14 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-sm text-[#191c1e] placeholder:text-[#777587] focus:outline-none focus:bg-white focus:border-[#4f46e5] focus:ring-3 focus:ring-[#4f46e5]/12 transition-all font-sans"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-[#e6e8ec] rounded text-[#555f73] shadow-xs">
                F2
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-[#e6e8ec] bg-[#f8f9fb] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "ALL"
                    ? "bg-[#4f46e5] text-white shadow-xs"
                    : "text-[#555f73] hover:text-[#191c1e]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SERVICES")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "SERVICES"
                    ? "bg-[#4f46e5] text-white shadow-xs"
                    : "text-[#555f73] hover:text-[#191c1e]"
                }`}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PRODUCTS")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "PRODUCTS"
                    ? "bg-[#4f46e5] text-white shadow-xs"
                    : "text-[#555f73] hover:text-[#191c1e]"
                }`}
              >
                Products
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-[#4f46e5] text-white shadow-xs"
                : "bg-white border border-[#e6e8ec] text-[#555f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.name
                  ? "bg-[#4f46e5] text-white shadow-xs"
                  : "bg-white border border-[#e6e8ec] text-[#555f73] hover:text-[#191c1e] hover:bg-[#f2f4f6]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Item Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#777587] text-center bg-white rounded-xl border border-[#e6e8ec]">
              <Boxes className="h-10 w-10 text-[#c7c4d8] mb-2" />
              <p className="text-sm font-medium text-[#191c1e]">
                No items match your query
              </p>
              <p className="text-xs text-[#777587] mt-1">
                Try scanning another barcode or clear the search query.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => {
                const isService = item.itemType === "SERVICE";
                const hasStock =
                  !isService && "track_stock" in item && item.track_stock
                    ? (item.current_stock ?? 0)
                    : null;

                const isLow =
                  hasStock !== null &&
                  hasStock <= (item as Product).min_stock_threshold;
                const isOut = hasStock !== null && hasStock <= 0;

                return (
                  <button
                    key={`${item.itemType}-${item.id}`}
                    onClick={() => handleAddItem(item, item.itemType)}
                    className="flex flex-col justify-between p-3.5 rounded-xl border border-[#e6e8ec] bg-white hover:border-[#c7c4d8] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] text-left transition-all group cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span
                          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                            isService
                              ? "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]"
                              : "bg-[#f2f4f6] text-[#555f73] border-[#e6e8ec]"
                          }`}
                        >
                          {isService ? "SERVICE" : "PRODUCT"}
                        </span>
                        {item.sku && (
                          <span className="text-[10px] font-mono text-[#777587] truncate">
                            {item.sku}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-[#191c1e] group-hover:text-[#4f46e5] line-clamp-2 leading-snug">
                        {item.name}
                      </h4>
                    </div>

                    <div className="pt-2.5 mt-3 border-t border-[#f2f4f6] flex items-end justify-between">
                      <div>
                        <span className="text-sm font-mono font-semibold text-[#191c1e] group-hover:text-[#4f46e5]">
                          {formatCurrency(item.selling_price, organization.currency_symbol)}
                        </span>
                        {"unit" in item && (
                          <span className="text-[10px] text-[#777587] ml-1">
                            /{item.unit}
                          </span>
                        )}
                      </div>

                      {hasStock !== null && (
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                            isOut
                              ? "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]"
                              : isLow
                              ? "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]"
                              : "bg-[#f8f9fb] text-[#555f73] border-[#e6e8ec]"
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
      {/* RIGHT PANEL: Order Cart & Checkout Dock (~410px fixed width) */}
      {/* ========================================================================= */}
      <div className="w-full xl:w-[410px] shrink-0 flex flex-col gap-4">
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#e6e8ec] p-5 flex flex-col h-full">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e8ec]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e2dfff] flex items-center justify-center text-[#4f46e5]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#191c1e]">
                  Current Sale
                </h2>
                <span className="font-mono text-xs text-[#555f73]">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item(s)
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="flex items-center gap-1 text-xs font-medium text-[#dc2626] hover:bg-[#fef2f2] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Customer Tag bar */}
          <div className="my-3 p-2.5 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-[#555f73] shrink-0" />
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => {
                  const found = customers.find((c) => c.id === e.target.value) || null;
                  setSelectedCustomer(found);
                }}
                className="bg-transparent text-xs font-medium text-[#191c1e] focus:outline-none truncate cursor-pointer"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedCustomer && (
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[11px] text-[#4f46e5] hover:underline cursor-pointer ml-2 shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Cart Items Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px] max-h-[380px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#777587] py-12 text-center">
                <ShoppingBag className="h-8 w-8 text-[#c7c4d8] mb-2" />
                <p className="text-xs font-medium text-[#191c1e]">
                  Cart is empty
                </p>
                <p className="text-[11px] text-[#777587] mt-0.5">
                  Click items on the left or scan barcodes to start sale.
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

          {/* Calculations Breakdown */}
          <div className="mt-4 pt-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#555f73]">
              <span>Subtotal</span>
              <span className="font-mono text-[#191c1e] font-medium">
                {formatCurrency(cartSubtotal, organization.currency_symbol)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#555f73]">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-[#4f46e5]" />
                <span>Order Discount</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono text-[#777587]">
                  {organization.currency_symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount || ""}
                  placeholder="0"
                  onChange={(e) =>
                    setOrderDiscount(
                      Math.max(0, parseFloat(e.target.value) || 0),
                    )
                  }
                  className="w-16 px-1.5 py-0.5 rounded-md bg-white border border-[#e6e8ec] text-xs font-mono text-[#191c1e] text-right focus:border-[#4f46e5] focus:outline-none"
                />
              </div>
            </div>

            {organization.tax_enabled && (
              <div className="flex items-center justify-between text-xs text-[#555f73]">
                <span>Tax ({organization.tax_rate}%)</span>
                <span className="font-mono text-[#191c1e]">
                  {formatCurrency(taxAmount, organization.currency_symbol)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-[#e6e8ec] flex items-baseline justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-[#555f73] uppercase tracking-wider">
                  Total Due
                </span>
                <span className="text-[10px] text-[#777587]">
                  All inclusive
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-bold text-[#191c1e] tracking-tight">
                  {formatCurrency(grandTotal, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Tender Commit Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full mt-4 h-12 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-base shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="h-4 w-4" />
          </button>
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
      <PrintReceiptModal
        sale={printedSale}
        onClose={() => setPrintedSale(null)}
      />
    </div>
  );
};
