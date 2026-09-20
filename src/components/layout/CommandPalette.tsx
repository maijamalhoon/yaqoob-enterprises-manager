import React, { useState, useEffect } from "react";
import { useApp, AppView } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { salesRepo, inventoryRepo, customerRepo } from "../../services";
import { Product, Service, Customer, Sale } from "../../types";
import {
  Search,
  Zap,
  LayoutDashboard,
  Boxes,
  History,
  ReceiptText,
  Landmark,
  Users,
  Settings,
  X,
  FileText,
  ArrowRight,
} from "lucide-react";

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setCurrentView,
    setActiveReceiptSale,
  } = useApp();
  const { organization } = useAuth();
  const [query, setQuery] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      Promise.all([
        inventoryRepo.getProducts(organization.id),
        inventoryRepo.getServices(organization.id),
        customerRepo.getCustomers(organization.id),
        salesRepo.getSales(organization.id),
      ]).then(([productList, serviceList, customerList, saleList]) => {
        setProducts(productList);
        setServices(serviceList);
        setCustomers(customerList);
        setSales(saleList.slice(0, 10));
      });
      setQuery("");
    }
  }, [isCommandPaletteOpen, organization.id]);

  if (!isCommandPaletteOpen) return null;

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    setIsCommandPaletteOpen(false);
  };

  const q = query.trim().toLowerCase();

  const filteredProducts =
    q ?
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q)),
        )
        .slice(0, 5)
    : [];

  const filteredServices =
    q ?
      services
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.sku && s.sku.toLowerCase().includes(q)),
        )
        .slice(0, 5)
    : [];

  const filteredCustomers =
    q ?
      customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)),
        )
        .slice(0, 4)
    : [];

  const filteredInvoices =
    q ?
      sales
        .filter(
          (s) =>
            s.invoice_number.toLowerCase().includes(q) ||
            (s.customer_name && s.customer_name.toLowerCase().includes(q)),
        )
        .slice(0, 4)
    : [];

  const quickPages = [
    { label: "Quick Sale Terminal", view: "pos" as AppView, icon: Zap },
    {
      label: "Executive Dashboard",
      view: "dashboard" as AppView,
      icon: LayoutDashboard,
    },
    {
      label: "Products & Inventory",
      view: "inventory" as AppView,
      icon: Boxes,
    },
    { label: "Sales History", view: "sales" as AppView, icon: History },
    { label: "Expense Ledger", view: "expenses" as AppView, icon: ReceiptText },
    {
      label: "Accounts & Cash Drawer",
      view: "accounts" as AppView,
      icon: Landmark,
    },
    { label: "Customer Directory", view: "customers" as AppView, icon: Users },
    { label: "System Settings", view: "settings" as AppView, icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#102a43]/40 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={() => setIsCommandPaletteOpen(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl rounded-[10px] border border-[#d9e2ec] bg-white shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-100">
        <div className="flex items-center px-4 border-b border-[#d9e2ec]">
          <Search className="h-4 w-4 text-teal-700 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, product, service, customer, or invoice..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent px-3 py-3.5 text-sm text-[#102a43] placeholder:text-[#627d98] focus:outline-none font-sans"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="p-1 text-[#627d98] hover:text-[#102a43] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[#e6edf3]">
          {/* Quick Page Navigation */}
          {!query && (
            <div className="p-2">
              <p className="text-[10px] font-semibold text-[#627d98] uppercase tracking-wider mb-2">
                Quick Navigation
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {quickPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.view}
                      onClick={() => navigateTo(page.view)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[#243b53] hover:bg-[#f5f7fa] hover:text-teal-800 transition-colors text-left cursor-pointer"
                    >
                      <Icon className="h-3.5 w-3.5 text-[#627d98]" />
                      <span>{page.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          {query && (
            <div className="space-y-3 p-1">
              {filteredProducts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#627d98] uppercase tracking-wider px-2 py-1">
                    Products
                  </p>
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigateTo("inventory")}
                      className="flex items-center justify-between px-3 py-2 rounded-[10px] text-xs hover:bg-[#f5f7fa] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Boxes className="h-3.5 w-3.5 text-teal-700" />
                        <span className="text-[#102a43] font-medium">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono text-[#627d98]">
                          {p.sku}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-teal-700">
                        {organization.currency_symbol} {p.selling_price}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {filteredServices.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#627d98] uppercase tracking-wider px-2 py-1">
                    Services
                  </p>
                  {filteredServices.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => navigateTo("pos")}
                      className="flex items-center justify-between px-3 py-2 rounded-[10px] text-xs hover:bg-[#f5f7fa] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-teal-700" />
                        <span className="text-[#102a43] font-medium">
                          {s.name}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-teal-700">
                        {organization.currency_symbol} {s.selling_price}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {filteredCustomers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#627d98] uppercase tracking-wider px-2 py-1">
                    Customers
                  </p>
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigateTo("customers")}
                      className="flex items-center justify-between px-3 py-2 rounded-[10px] text-xs hover:bg-[#f5f7fa] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-teal-700" />
                        <span className="text-[#102a43] font-medium">
                          {c.name}
                        </span>
                        {c.phone && (
                          <span className="text-[11px] text-[#627d98] font-mono">
                            {c.phone}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-[#627d98]" />
                    </div>
                  ))}
                </div>
              )}

              {filteredInvoices.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#627d98] uppercase tracking-wider px-2 py-1">
                    Invoices
                  </p>
                  {filteredInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setActiveReceiptSale(inv);
                        setIsCommandPaletteOpen(false);
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-[10px] text-xs hover:bg-[#f5f7fa] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-mono font-semibold text-[#102a43]">
                          #{inv.invoice_number}
                        </span>
                        <span className="text-[#627d98]">
                          {inv.customer_name}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-emerald-700">
                        {organization.currency_symbol} {inv.grand_total}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {filteredProducts.length === 0 &&
                filteredServices.length === 0 &&
                filteredCustomers.length === 0 &&
                filteredInvoices.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#627d98]">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="bg-[#f5f7fa] px-4 py-2 border-t border-[#d9e2ec] flex items-center justify-between text-[11px] text-[#627d98]">
          <span>Navigate with mouse or shortcuts</span>
          <div className="flex items-center gap-2 font-mono">
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
