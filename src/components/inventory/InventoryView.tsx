import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { inventoryRepo } from "../../services";
import {
  Product,
  Service,
  Category,
  StockMovement,
  ServiceRecipeComponent,
} from "../../types";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { formatCurrency, roundMoney } from "../../lib/utils";
import {
  Boxes,
  Zap,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  Trash2,
  PackagePlus,
  Check,
  TrendingUp,
  Wallet,
  Download,
  Info,
  X,
  Layers,
} from "lucide-react";

export const InventoryView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<
    "PRODUCTS" | "SERVICES" | "MOVEMENTS"
  >("PRODUCTS");
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showLowStockBanner, setShowLowStockBanner] = useState(true);

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: "",
    sku: "",
    category_id: "",
    category_name: "",
    unit: "Pcs",
    purchase_price: 0,
    selling_price: 0,
    opening_stock: 0,
    min_stock_threshold: 5,
    track_stock: true,
  });

  // Service Modal State
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [servForm, setServForm] = useState({
    name: "",
    sku: "",
    category_id: "",
    category_name: "",
    selling_price: 0,
    estimated_cost: 0,
    notes: "",
  });
  const [servComponents, setServComponents] = useState<
    Array<{ product_id: string; quantity_consumed: number }>
  >([]);

  // Stock Adjustment / Purchase Movement Modal
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementForm, setMovementForm] = useState<{
    movement_type: StockMovement["movement_type"];
    quantity: number;
    unit_cost: number;
    notes: string;
  }>({
    movement_type: "PURCHASE",
    quantity: 10,
    unit_cost: 0,
    notes: "",
  });

  useEffect(() => {
    async function loadData() {
      const [prods, servs, cats, movs] = await Promise.all([
        inventoryRepo.getProducts(organization.id),
        inventoryRepo.getServices(organization.id),
        inventoryRepo.getCategories(organization.id),
        inventoryRepo.getStockMovements(organization.id),
      ]);
      setProducts(prods);
      setServices(servs);
      setCategories(cats);
      setMovements(movs);
    }
    loadData();
  }, [organization.id, dataVersion]);

  // Derived Metrics for Top Strips
  const totalSkus = products.length;
  const assetValuation = useMemo(() => {
    return products.reduce(
      (acc, p) => acc + p.current_stock * (p.average_cost || p.purchase_price),
      0,
    );
  }, [products]);

  const lowStockItems = useMemo(() => {
    return products.filter(
      (p) => p.track_stock && p.current_stock <= p.min_stock_threshold,
    );
  }, [products]);

  const avgMargin = useMemo(() => {
    const priced = products.filter((p) => p.selling_price > 0);
    if (!priced.length) return 0;
    const totalMargin = priced.reduce((acc, p) => {
      const cost = p.average_cost || p.purchase_price;
      return acc + ((p.selling_price - cost) / p.selling_price) * 100;
    }, 0);
    return Math.round((totalMargin / priced.length) * 10) / 10;
  }, [products]);

  // Product Add / Edit Handler
  const handleOpenProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProdForm({
        name: product.name,
        sku: product.sku || "",
        category_id: product.category_id || "",
        category_name: product.category_name || "",
        unit: product.unit,
        purchase_price: product.purchase_price,
        selling_price: product.selling_price,
        opening_stock: product.opening_stock,
        min_stock_threshold: product.min_stock_threshold,
        track_stock: product.track_stock,
      });
    } else {
      setEditingProduct(null);
      setProdForm({
        name: "",
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        category_id: categories[0]?.id || "",
        category_name: categories[0]?.name || "",
        unit: "Pcs",
        purchase_price: 0,
        selling_price: 0,
        opening_stock: 10,
        min_stock_threshold: 5,
        track_stock: true,
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim()) return;

    try {
      const cat = categories.find((c) => c.id === prodForm.category_id);
      await inventoryRepo.saveProduct(organization.id, {
        id: editingProduct ? editingProduct.id : undefined,
        name: prodForm.name.trim(),
        sku: prodForm.sku.trim() || undefined,
        category_id: prodForm.category_id || undefined,
        category_name: cat ? cat.name : undefined,
        unit: prodForm.unit,
        purchase_price: Number(prodForm.purchase_price) || 0,
        selling_price: Number(prodForm.selling_price) || 0,
        opening_stock: Number(prodForm.opening_stock) || 0,
        current_stock:
          editingProduct ?
            editingProduct.current_stock
          : Number(prodForm.opening_stock) || 0,
        min_stock_threshold: Number(prodForm.min_stock_threshold) || 5,
        track_stock: prodForm.track_stock,
      });

      showToast(
        "success",
        editingProduct ? "Product Updated" : "Product Added",
        `${prodForm.name} saved to catalog`,
      );
      setIsProductModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast("error", "Failed to Save", err.message);
    }
  };

  // Computed Recipe Cost
  const computedRecipeCost = useMemo(() => {
    return roundMoney(
      servComponents.reduce((sum, comp) => {
        const prod = products.find((p) => p.id === comp.product_id);
        return (
          sum + (prod ? prod.average_cost * (comp.quantity_consumed || 0) : 0)
        );
      }, 0),
    );
  }, [servComponents, products]);

  const handleAddRecipeComponent = () => {
    const unusedProduct = products.find(
      (p) => !servComponents.some((c) => c.product_id === p.id),
    );
    setServComponents((prev) => [
      ...prev,
      {
        product_id: unusedProduct ? unusedProduct.id : products[0]?.id || "",
        quantity_consumed: 1,
      },
    ]);
  };

  const handleUpdateRecipeComponent = (
    index: number,
    field: "product_id" | "quantity_consumed",
    value: string | number,
  ) => {
    setServComponents((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleRemoveRecipeComponent = (index: number) => {
    setServComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Service Add / Edit Handler
  const handleOpenServiceModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServForm({
        name: service.name,
        sku: service.sku || "",
        category_id: service.category_id || "",
        category_name: service.category_name || "",
        selling_price: service.selling_price,
        estimated_cost: service.estimated_cost,
        notes: service.notes || "",
      });
      setServComponents(
        (service.components || []).map((c) => ({
          product_id: c.product_id,
          quantity_consumed: c.quantity_consumed,
        })),
      );
    } else {
      setEditingService(null);
      setServForm({
        name: "",
        sku: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
        category_id: categories[0]?.id || "",
        category_name: categories[0]?.name || "",
        selling_price: 0,
        estimated_cost: 0,
        notes: "",
      });
      setServComponents([]);
    }
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servForm.name.trim()) return;

    try {
      const cat = categories.find((c) => c.id === servForm.category_id);
      const formattedComponents: ServiceRecipeComponent[] = servComponents
        .filter((c) => c.product_id && c.quantity_consumed > 0)
        .map((c) => {
          const prod = products.find((p) => p.id === c.product_id);
          return {
            id: `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            organization_id: organization.id,
            service_id: editingService ? editingService.id : "",
            product_id: c.product_id,
            product_name: prod ? prod.name : "",
            quantity_consumed: Number(c.quantity_consumed),
            unit: prod ? prod.unit : "Unit",
          };
        });

      await inventoryRepo.saveService(organization.id, {
        id: editingService ? editingService.id : undefined,
        name: servForm.name.trim(),
        sku: servForm.sku.trim() || undefined,
        category_id: servForm.category_id || undefined,
        category_name: cat ? cat.name : undefined,
        selling_price: Number(servForm.selling_price) || 0,
        estimated_cost:
          computedRecipeCost > 0 ? computedRecipeCost : (
            Number(servForm.estimated_cost) || 0
          ),
        notes: servForm.notes.trim() || undefined,
        components: formattedComponents,
      });

      showToast(
        "success",
        editingService ? "Service Updated" : "Service Added",
        `${servForm.name} saved to catalog with ${formattedComponents.length} recipe component(s)`,
      );
      setIsServiceModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast("error", "Failed to Save", err.message);
    }
  };

  // Stock Movement / Restock execution
  const handleOpenStockMovement = (product: Product) => {
    setMovementProduct(product);
    setMovementForm({
      movement_type: "PURCHASE",
      quantity: 10,
      unit_cost: product.average_cost || product.purchase_price,
      notes: "",
    });
    setIsMovementModalOpen(true);
  };

  const handleExecuteStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct || movementForm.quantity <= 0) return;

    try {
      const totalCost = roundMoney(
        movementForm.quantity * movementForm.unit_cost,
      );
      await inventoryRepo.recordStockMovement(organization.id, {
        organization_id: organization.id,
        product_id: movementProduct.id,
        movement_type: movementForm.movement_type,
        quantity: movementForm.quantity,
        unit_cost: movementForm.unit_cost,
        total_cost: totalCost,
        notes: movementForm.notes,
        created_by: "Inventory Manager",
      });

      showToast(
        "success",
        "Stock Movement Recorded",
        `${movementForm.movement_type}: ${movementForm.quantity} ${movementProduct.unit} for ${movementProduct.name}`,
      );
      setIsMovementModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast("error", "Stock Movement Failed", err.message);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "SKU",
      "Category",
      "Unit",
      "Purchase Cost",
      "Selling Price",
      "Current Stock",
      "Stock Value",
    ];
    const rows = products.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.sku || ""}"`,
      `"${p.category_name || "General"}"`,
      `"${p.unit}"`,
      p.average_cost || p.purchase_price,
      p.selling_price,
      p.current_stock,
      (p.current_stock * (p.average_cost || p.purchase_price)).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      const matchesCat =
        categoryFilter === "ALL" || p.category_name === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [products, searchQuery, categoryFilter]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return services.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.sku && s.sku.toLowerCase().includes(q));
      const matchesCat =
        categoryFilter === "ALL" || s.category_name === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [services, searchQuery, categoryFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 select-none text-[#14181f] min-h-0 bg-[#f8f9fb]">
      {/* Metric & Status Quick Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
              Total SKUs
            </span>
            <span className="text-2xl font-bold text-[#14181f] mt-1">
              {totalSkus}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#4f46e5]">
            <Boxes className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
              Asset Valuation
            </span>
            <span className="text-2xl font-mono font-bold text-[#14181f] mt-1">
              {formatCurrency(assetValuation, organization.currency_symbol)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#16a34a]">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
              Reorder Attention
            </span>
            <span className="text-2xl font-bold text-[#dc2626] mt-1">
              {lowStockItems.length}{" "}
              <span className="text-xs font-normal text-[#667085]">items</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#fef2f2] border border-[#fee2e2] flex items-center justify-center text-[#dc2626]">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
              Avg Margin
            </span>
            <span className="text-2xl font-mono font-bold text-[#14181f] mt-1">
              {avgMargin}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#4f46e5]">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Low Stock Calm Banner */}
      {showLowStockBanner && lowStockItems.length > 0 && (
        <div className="bg-[#fffbeb] p-4 rounded-xl border border-[#fef3c7] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[#14181f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#fef3c7] flex items-center justify-center text-[#d97706] shrink-0">
              <Info className="h-4 w-4" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-sm font-semibold text-[#92400e]">
                Low Stock Alert:
              </span>
              <span className="text-xs text-[#78350f]">
                {lowStockItems.length} items are below reorder threshold:{" "}
                {lowStockItems
                  .slice(0, 3)
                  .map((i) => i.name)
                  .join(", ")}
                {lowStockItems.length > 3 ?
                  ` +${lowStockItems.length - 3} more`
                : ""}
                .
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-11 md:pl-0">
            <button
              onClick={() => {
                setCategoryFilter("ALL");
                setSearchQuery("");
                setActiveTab("PRODUCTS");
              }}
              className="text-xs font-semibold text-[#b45309] hover:text-[#78350f] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Review Inventory</span>
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Dismiss alert"
              onClick={() => setShowLowStockBanner(false)}
              className="text-[#b45309] hover:text-[#78350f] p-1 rounded transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Workspace Card */}
      <div className="bg-white rounded-xl border border-[#e6e8ec] shadow-sm overflow-hidden flex flex-col">
        {/* Navigation Sub-Tabs */}
        <div className="flex border-b border-[#e6e8ec] px-5 pt-3 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab("PRODUCTS")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "PRODUCTS" ?
                "border-[#4f46e5] text-[#4f46e5] font-semibold"
              : "border-transparent text-[#667085] hover:text-[#14181f]"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Physical Inventory ({products.length})</span>
          </button>

          <button onClick={() => setActiveTab("SERVICES")} className="hidden">
            <Zap className="h-4 w-4" />
            <span>Services & Jobs ({services.length})</span>
          </button>

          <button onClick={() => setActiveTab("MOVEMENTS")} className="hidden">
            <ArrowUpDown className="h-4 w-4" />
            <span>Stock Movement Ledger ({movements.length})</span>
          </button>
        </div>

        {/* Top Action & Filter Toolbar */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e6e8ec]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold text-[#14181f] tracking-tight">
                {activeTab === "PRODUCTS" ?
                  "Inventory Items"
                : activeTab === "SERVICES" ?
                  "Service Offerings"
                : "Stock Movements"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085] font-medium">
                {activeTab === "PRODUCTS" ?
                  `${filteredProducts.length} items`
                : activeTab === "SERVICES" ?
                  `${filteredServices.length} services`
                : `${movements.length} logs`}
              </span>
            </div>

            {activeTab !== "MOVEMENTS" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
                  <input
                    type="text"
                    id="itemSearch"
                    placeholder="Search SKU, name, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] placeholder:text-[#667085] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-9 px-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] focus:outline-none focus:bg-white focus:border-[#4f46e5] transition-all cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {activeTab === "PRODUCTS" && (
              <>
                <Button variant="secondary" size="sm" onClick={exportCSV}>
                  <Download className="h-4 w-4 text-[#667085]" />
                  <span>Export CSV</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenProductModal()}
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Item</span>
                </Button>
              </>
            )}

            {activeTab === "SERVICES" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenServiceModal()}
              >
                <Plus className="h-4 w-4" />
                <span>Add New Service</span>
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          {activeTab === "PRODUCTS" && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                  <th className="py-3 px-4">Item & SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Stock Qty</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Retail Price</th>
                  <th className="py-3 px-3 text-right">Margin</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec] text-xs">
                {filteredProducts.length === 0 ?
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#667085]">
                      No products matching your search criteria.
                    </td>
                  </tr>
                : filteredProducts.map((p) => {
                    const cost = p.average_cost || p.purchase_price;
                    const margin =
                      p.selling_price > 0 ?
                        Math.round(
                          ((p.selling_price - cost) / p.selling_price) * 100,
                        )
                      : 0;
                    const isLow =
                      p.track_stock && p.current_stock <= p.min_stock_threshold;
                    const isOut = p.track_stock && p.current_stock <= 0;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#f8f9fb] transition-colors group ${
                          isOut ? "bg-[#fef2f2]/30"
                          : isLow ? "bg-[#fffbeb]/40"
                          : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#14181f] group-hover:text-[#4f46e5] transition-colors">
                              {p.name}
                            </span>
                            <span className="font-mono text-[11px] text-[#667085] mt-0.5">
                              {p.sku || "NO-SKU"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#667085]">
                          {p.category_name || "General"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-[#14181f]">
                          <span
                            className={
                              isOut ? "text-[#dc2626] font-bold"
                              : isLow ?
                                "text-[#d97706] font-bold"
                              : ""
                            }
                          >
                            {p.current_stock}
                          </span>
                          <span className="text-[#667085] text-[11px] ml-1">
                            {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#667085]">
                          {formatCurrency(cost, organization.currency_symbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-[#14181f]">
                          {formatCurrency(
                            p.selling_price,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium">
                          <span
                            className={
                              margin >= 30 ? "text-[#16a34a]" : "text-[#d97706]"
                            }
                          >
                            {margin}%
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              isOut ? "rose"
                              : isLow ?
                                "amber"
                              : "emerald"
                            }
                            size="sm"
                          >
                            {isOut ?
                              "Out of Stock"
                            : isLow ?
                              "Low Stock"
                            : "Normal"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenStockMovement(p)}
                              className="w-8 h-8 rounded-lg hover:bg-[#f8f9fb] border border-transparent hover:border-[#e6e8ec] flex items-center justify-center text-[#667085] hover:text-[#14181f] transition-colors cursor-pointer"
                              title="Quick Adjust Stock"
                            >
                              <PackagePlus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenProductModal(p)}
                              className="w-8 h-8 rounded-lg hover:bg-[#f8f9fb] border border-transparent hover:border-[#e6e8ec] flex items-center justify-center text-[#667085] hover:text-[#14181f] transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          )}

          {activeTab === "SERVICES" && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                  <th className="py-3 px-4">Service Name & SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Rate / Selling Price</th>
                  <th className="py-3 px-3 text-right">
                    Est. Labor / Consumable Cost
                  </th>
                  <th className="py-3 px-3">Recipe / Components</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec] text-xs">
                {filteredServices.length === 0 ?
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#667085]">
                      No services found in this catalog.
                    </td>
                  </tr>
                : filteredServices.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-[#f8f9fb] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#14181f] group-hover:text-[#4f46e5] transition-colors">
                          {s.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#667085]">
                          {s.sku || "SRV"}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-[#667085]">
                        {s.category_name || "Service"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#14181f]">
                        {formatCurrency(
                          s.selling_price,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#667085]">
                        {formatCurrency(
                          s.estimated_cost,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#667085]">
                        {s.components && s.components.length > 0 ?
                          <span className="text-[11px] font-mono text-[#4f46e5]">
                            {s.components.length} ingredients linked
                          </span>
                        : <span className="text-[11px] text-[#667085]">
                            Pure Service
                          </span>
                        }
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenServiceModal(s)}
                          title="Edit Service"
                          className="w-8 h-8 rounded-lg hover:bg-[#f8f9fb] border border-transparent hover:border-[#e6e8ec] flex items-center justify-center text-[#667085] hover:text-[#14181f] transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}

          {activeTab === "MOVEMENTS" && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Total Cost</th>
                  <th className="py-3 px-4">Notes / User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec] text-xs">
                {movements.length === 0 ?
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#667085]">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                : movements.map((m) => {
                    const prod = products.find((p) => p.id === m.product_id);
                    const isPositive = [
                      "PURCHASE",
                      "ADJUSTMENT_INCREASE",
                      "CUSTOMER_RETURN",
                      "OPENING_STOCK",
                    ].includes(m.movement_type);

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-[#f8f9fb] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[#667085]">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#14181f]">
                          {prod ? prod.name : "Unknown Product"}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              m.movement_type === "PURCHASE" ? "primary"
                              : m.movement_type === "SALE" ?
                                "neutral"
                              : (
                                m.movement_type.includes("DECREASE") ||
                                m.movement_type.includes("DAMAGE")
                              ) ?
                                "rose"
                              : "emerald"
                            }
                            size="sm"
                          >
                            {m.movement_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              isPositive ? "text-[#16a34a]" : "text-[#dc2626]"
                            }
                          >
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#667085]">
                          {formatCurrency(
                            m.unit_cost,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#14181f] font-medium">
                          {formatCurrency(
                            m.total_cost,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#667085] text-[11px]">
                          {m.notes || "Automated movement"} •{" "}
                          {m.created_by || "System"}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={
          editingProduct ?
            "Edit Inventory Product"
          : "Add New Inventory Product"
        }
        description="Configure pricing, SKU, and stock tracking parameters."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 py-1">
          <Input
            label="Product Name"
            required
            autoFocus
            value={prodForm.name}
            onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
            placeholder="e.g. A4 Paper Ream (70gsm AA)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`Sale Price (${organization.currency_symbol})`}
              type="number"
              step="any"
              required
              value={prodForm.selling_price}
              onChange={(e) =>
                setProdForm({
                  ...prodForm,
                  selling_price: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          {!editingProduct && (
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Starting Quantity (optional)"
                type="number"
                value={prodForm.opening_stock}
                onChange={(e) =>
                  setProdForm({
                    ...prodForm,
                    opening_stock: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsProductModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              <span>Save Product</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Service Add / Edit Modal */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={editingService ? "Edit Service" : "Add New Service Job"}
        description="Configure printing, photocopy, binding, or typing service offerings."
        maxWidth="md"
      >
        <form onSubmit={handleSaveService} className="space-y-4 py-1">
          <Input
            label="Service Name"
            required
            autoFocus
            value={servForm.name}
            onChange={(e) => setServForm({ ...servForm, name: e.target.value })}
            placeholder="e.g. B&W Photocopy (Legal / Both Sides)"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Service Code"
              value={servForm.sku}
              onChange={(e) =>
                setServForm({ ...servForm, sku: e.target.value })
              }
            />

            <div>
              <label className="block text-xs font-semibold text-[#14181f] mb-1.5">
                Category
              </label>
              <select
                value={servForm.category_id}
                onChange={(e) =>
                  setServForm({ ...servForm, category_id: e.target.value })
                }
                className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Rate / Price (${organization.currency_symbol})`}
              type="number"
              step="any"
              required
              value={servForm.selling_price}
              onChange={(e) =>
                setServForm({
                  ...servForm,
                  selling_price: parseFloat(e.target.value) || 0,
                })
              }
            />

            <Input
              label={`Estimated Labor / Cost (${organization.currency_symbol})`}
              type="number"
              step="any"
              value={servForm.estimated_cost}
              onChange={(e) =>
                setServForm({
                  ...servForm,
                  estimated_cost: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <Input
            label="Internal Notes"
            placeholder="e.g. Standard laser printer drum rate"
            value={servForm.notes}
            onChange={(e) =>
              setServForm({ ...servForm, notes: e.target.value })
            }
          />

          {/* Recipe Components Builder */}
          <div className="p-3.5 rounded-xl bg-[#f8f9fb] border border-[#e6e8ec] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#14181f]">
                  Raw Material Consumption (Recipe)
                </p>
                <p className="text-[11px] text-[#667085]">
                  Deduct physical stock items when this service is sold (e.g. 1
                  A4 Paper per Photocopy).
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRecipeComponent}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Material</span>
              </Button>
            </div>

            {servComponents.length === 0 ?
              <p className="text-[11px] text-[#667085] italic py-1">
                No inventory consumption linked. This service will be sold as
                pure service/labor.
              </p>
            : <div className="space-y-2">
                {servComponents.map((comp, idx) => {
                  const prod = products.find((p) => p.id === comp.product_id);
                  const lineCost =
                    prod ?
                      roundMoney(prod.average_cost * comp.quantity_consumed)
                    : 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#e6e8ec] text-xs"
                    >
                      <div className="flex-1">
                        <select
                          value={comp.product_id}
                          onChange={(e) =>
                            handleUpdateRecipeComponent(
                              idx,
                              "product_id",
                              e.target.value,
                            )
                          }
                          className="w-full h-9 rounded-lg bg-white border border-[#e6e8ec] px-2 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.current_stock} {p.unit}, Avg:{" "}
                              {formatCurrency(
                                p.average_cost,
                                organization.currency_symbol,
                              )}
                              )
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={comp.quantity_consumed}
                          onChange={(e) =>
                            handleUpdateRecipeComponent(
                              idx,
                              "quantity_consumed",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="Qty"
                          className="w-full h-9 rounded-lg bg-white border border-[#e6e8ec] px-2 text-xs text-[#14181f] text-right font-mono focus:border-[#4f46e5] focus:outline-none"
                        />
                      </div>

                      <span className="text-xs font-mono text-[#14181f] font-medium w-24 text-right shrink-0">
                        {formatCurrency(lineCost, organization.currency_symbol)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeComponent(idx)}
                        className="p-1 rounded text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer transition-colors"
                        title="Remove component"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex justify-between items-center text-xs font-semibold pt-2 border-t border-[#e6e8ec]">
                  <span className="text-[#667085]">
                    Total Material Cost per Job:
                  </span>
                  <span className="font-mono font-bold text-[#14181f]">
                    {formatCurrency(
                      computedRecipeCost,
                      organization.currency_symbol,
                    )}
                  </span>
                </div>
              </div>
            }
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsServiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              <span>Save Service</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Movement / Purchase Restock Modal */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title={`Stock Adjustment: ${movementProduct?.name || ""}`}
        description="Record supplier purchase or stock write-off with Weighted Average Cost calculation."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteStockMovement} className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-semibold text-[#14181f] mb-1.5">
              Movement Reason / Type
            </label>
            <select
              value={movementForm.movement_type}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  movement_type: e.target
                    .value as StockMovement["movement_type"],
                })
              }
              className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
            >
              <option value="PURCHASE">
                Supplier Purchase / Stock In (Updates WAC)
              </option>
              <option value="ADJUSTMENT_INCREASE">
                Stock Audit Increase (+)
              </option>
              <option value="ADJUSTMENT_DECREASE">
                Stock Audit Decrease (-)
              </option>
              <option value="DAMAGE_WASTAGE">
                Damage / Wastage / Spoiled Material (-)
              </option>
              <option value="SUPPLIER_RETURN">Return to Supplier (-)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Quantity (${movementProduct?.unit || "Pcs"})`}
              type="number"
              step="any"
              required
              value={movementForm.quantity}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  quantity: parseFloat(e.target.value) || 0,
                })
              }
            />

            <Input
              label={`Unit Cost (${organization.currency_symbol})`}
              type="number"
              step="any"
              required
              value={movementForm.unit_cost}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  unit_cost: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] text-xs flex justify-between font-mono">
            <span className="text-[#667085]">Total Valuation Impact:</span>
            <span className="font-bold text-[#14181f]">
              {formatCurrency(
                roundMoney(movementForm.quantity * movementForm.unit_cost),
                organization.currency_symbol,
              )}
            </span>
          </div>

          <Input
            label="Supplier / Bill Ref / Notes"
            placeholder="e.g. Urdu Bazaar Supplier Invoice #5402"
            value={movementForm.notes}
            onChange={(e) =>
              setMovementForm({ ...movementForm, notes: e.target.value })
            }
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsMovementModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Check className="h-4 w-4" />
              <span>Record Stock Flow</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
