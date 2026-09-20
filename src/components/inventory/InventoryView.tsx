import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { inventoryRepo } from '../../services';
import { Product, Service, Category, StockMovement, ServiceRecipeComponent } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { formatCurrency, roundMoney } from '../../lib/utils';
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
  Layers,
  Check,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'SERVICES' | 'MOVEMENTS'>('PRODUCTS');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    category_name: '',
    unit: 'Pcs',
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
    name: '',
    sku: '',
    category_id: '',
    category_name: '',
    selling_price: 0,
    estimated_cost: 0,
    notes: '',
  });
  const [servComponents, setServComponents] = useState<
    Array<{ product_id: string; quantity_consumed: number }>
  >([]);

  // Stock Adjustment / Purchase Movement Modal
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementForm, setMovementForm] = useState<{
    movement_type: StockMovement['movement_type'];
    quantity: number;
    unit_cost: number;
    notes: string;
  }>({
    movement_type: 'PURCHASE',
    quantity: 10,
    unit_cost: 0,
    notes: '',
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

  // Product Add / Edit Handler
  const handleOpenProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProdForm({
        name: product.name,
        sku: product.sku || '',
        category_id: product.category_id || '',
        category_name: product.category_name || '',
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
        name: '',
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        category_id: categories[0]?.id || '',
        category_name: categories[0]?.name || '',
        unit: 'Pcs',
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
        current_stock: editingProduct
          ? editingProduct.current_stock
          : Number(prodForm.opening_stock) || 0,
        min_stock_threshold: Number(prodForm.min_stock_threshold) || 5,
        track_stock: prodForm.track_stock,
      });

      showToast(
        'success',
        editingProduct ? 'Product Updated' : 'Product Added',
        `${prodForm.name} saved to catalog`
      );
      setIsProductModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Failed to Save', err.message);
    }
  };

  // Computed Recipe Cost
  const computedRecipeCost = useMemo(() => {
    return roundMoney(
      servComponents.reduce((sum, comp) => {
        const prod = products.find((p) => p.id === comp.product_id);
        return sum + (prod ? prod.average_cost * (comp.quantity_consumed || 0) : 0);
      }, 0)
    );
  }, [servComponents, products]);

  const handleAddRecipeComponent = () => {
    const unusedProduct = products.find((p) => !servComponents.some((c) => c.product_id === p.id));
    setServComponents((prev) => [
      ...prev,
      { product_id: unusedProduct ? unusedProduct.id : (products[0]?.id || ''), quantity_consumed: 1 },
    ]);
  };

  const handleUpdateRecipeComponent = (
    index: number,
    field: 'product_id' | 'quantity_consumed',
    value: string | number
  ) => {
    setServComponents((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
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
        sku: service.sku || '',
        category_id: service.category_id || '',
        category_name: service.category_name || '',
        selling_price: service.selling_price,
        estimated_cost: service.estimated_cost,
        notes: service.notes || '',
      });
      setServComponents(
        (service.components || []).map((c) => ({
          product_id: c.product_id,
          quantity_consumed: c.quantity_consumed,
        }))
      );
    } else {
      setEditingService(null);
      setServForm({
        name: '',
        sku: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
        category_id: categories[0]?.id || '',
        category_name: categories[0]?.name || '',
        selling_price: 0,
        estimated_cost: 0,
        notes: '',
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
            service_id: editingService ? editingService.id : '',
            product_id: c.product_id,
            product_name: prod ? prod.name : '',
            quantity_consumed: Number(c.quantity_consumed),
            unit: prod ? prod.unit : 'Unit',
          };
        });

      await inventoryRepo.saveService(organization.id, {
        id: editingService ? editingService.id : undefined,
        name: servForm.name.trim(),
        sku: servForm.sku.trim() || undefined,
        category_id: servForm.category_id || undefined,
        category_name: cat ? cat.name : undefined,
        selling_price: Number(servForm.selling_price) || 0,
        estimated_cost: computedRecipeCost > 0 ? computedRecipeCost : (Number(servForm.estimated_cost) || 0),
        notes: servForm.notes.trim() || undefined,
        components: formattedComponents,
      });

      showToast(
        'success',
        editingService ? 'Service Updated' : 'Service Added',
        `${servForm.name} saved to catalog with ${formattedComponents.length} recipe component(s)`
      );
      setIsServiceModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Failed to Save', err.message);
    }
  };

  // Stock Movement / Restock execution
  const handleOpenStockMovement = (product: Product) => {
    setMovementProduct(product);
    setMovementForm({
      movement_type: 'PURCHASE',
      quantity: 10,
      unit_cost: product.average_cost || product.purchase_price,
      notes: '',
    });
    setIsMovementModalOpen(true);
  };

  const handleExecuteStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct || movementForm.quantity <= 0) return;

    try {
      const totalCost = roundMoney(movementForm.quantity * movementForm.unit_cost);
      await inventoryRepo.recordStockMovement(organization.id, {
        organization_id: organization.id,
        product_id: movementProduct.id,
        movement_type: movementForm.movement_type,
        quantity: movementForm.quantity,
        unit_cost: movementForm.unit_cost,
        total_cost: totalCost,
        notes: movementForm.notes,
        created_by: 'Inventory Manager',
      });

      showToast(
        'success',
        'Stock Movement Recorded',
        `${movementForm.movement_type}: ${movementForm.quantity} ${movementProduct.unit} for ${movementProduct.name}`
      );
      setIsMovementModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Stock Movement Failed', err.message);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
      const matchesCat = categoryFilter === 'ALL' || p.category_name === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [products, searchQuery, categoryFilter]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return services.filter((s) => {
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || (s.sku && s.sku.toLowerCase().includes(q));
      const matchesCat = categoryFilter === 'ALL' || s.category_name === categoryFilter;
      return matchesQuery && matchesCat;
    });
  }, [services, searchQuery, categoryFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f5f7fa] select-none text-[#102a43]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#d9e2ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102a43]">
            Catalog & Inventory Management
          </h1>
          <p className="text-xs text-[#627d98] mt-0.5">
            Maintain physical products, WAC costing, recipes, and labor services.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'PRODUCTS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenProductModal()}
              className="font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </Button>
          )}

          {activeTab === 'SERVICES' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenServiceModal()}
              className="font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Add Service</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-[#d9e2ec] gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'PRODUCTS'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-[#627d98] hover:text-[#102a43]'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Physical Inventory ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SERVICES')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'SERVICES'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-[#627d98] hover:text-[#102a43]'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Services & Jobs ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'MOVEMENTS'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-[#627d98] hover:text-[#102a43]'
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span>Stock Movement Ledger ({movements.length})</span>
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      {activeTab !== 'MOVEMENTS' && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#627d98]" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-[8px] bg-white border border-[#d9e2ec] text-xs text-[#102a43] placeholder:text-[#627d98] focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#627d98]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#d9e2ec] rounded-[8px] px-3 py-1.5 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Products Table */}
      {activeTab === 'PRODUCTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-3 px-4">Item & SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Avg Cost (WAC)</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-right">Gross Margin</th>
                  <th className="py-3 px-3 text-center">Stock Level</th>
                  <th className="py-3 px-3 text-right">Stock Valuation</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredProducts.map((p) => {
                  const margin =
                    p.selling_price > 0
                      ? Math.round(
                          ((p.selling_price - (p.average_cost || p.purchase_price)) /
                            p.selling_price) *
                            100
                        )
                      : 0;
                  const isLow = p.track_stock && p.current_stock <= p.min_stock_threshold;
                  const isOut = p.track_stock && p.current_stock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#f5f7fa] transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#102a43]">{p.name}</p>
                        <p className="text-[10px] font-mono text-[#627d98]">{p.sku}</p>
                      </td>
                      <td className="py-3 px-3 text-[#627d98]">
                        {p.category_name || 'General'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#243b53]">
                        {formatCurrency(p.average_cost || p.purchase_price, organization.currency_symbol)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-teal-800">
                        {formatCurrency(p.selling_price, organization.currency_symbol)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={margin >= 30 ? 'text-emerald-700' : 'text-amber-700'}>
                          {margin}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={isOut ? 'rose' : isLow ? 'amber' : 'emerald'} size="sm">
                          {p.current_stock} {p.unit}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#243b53]">
                        {formatCurrency(
                          p.current_stock * (p.average_cost || p.purchase_price),
                          organization.currency_symbol
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenStockMovement(p)}
                            title="Restock or Adjust Inventory"
                            className="p-1.5 rounded text-teal-700 hover:bg-[#e4e7eb] transition-colors cursor-pointer"
                          >
                            <PackagePlus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenProductModal(p)}
                            title="Edit Product"
                            className="p-1.5 rounded text-[#627d98] hover:bg-[#e4e7eb] hover:text-[#102a43] transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Services Table */}
      {activeTab === 'SERVICES' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-3 px-4">Service Name & SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Rate / Selling Price</th>
                  <th className="py-3 px-3 text-right">Est. Labor / Consumable Cost</th>
                  <th className="py-3 px-3">Recipe / Components</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredServices.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f5f7fa] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#102a43]">{s.name}</p>
                      <p className="text-[10px] font-mono text-[#627d98]">{s.sku}</p>
                    </td>
                    <td className="py-3 px-3 text-[#627d98]">
                      {s.category_name || 'Service'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-teal-800">
                      {formatCurrency(s.selling_price, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#627d98]">
                      {formatCurrency(s.estimated_cost, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-[#627d98]">
                      {s.components && s.components.length > 0 ? (
                        <span className="text-[11px] font-mono text-teal-700">
                          {s.components.length} ingredients linked
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#627d98]">Pure Service</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenServiceModal(s)}
                        title="Edit Service"
                        className="p-1.5 rounded text-[#627d98] hover:bg-[#e4e7eb] hover:text-[#102a43] transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stock Movements Ledger Table */}
      {activeTab === 'MOVEMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Total Cost</th>
                  <th className="py-3 px-4">Notes / User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {movements.map((m) => {
                  const prod = products.find((p) => p.id === m.product_id);
                  const isPositive = ['PURCHASE', 'ADJUSTMENT_INCREASE', 'CUSTOMER_RETURN', 'OPENING_STOCK'].includes(
                    m.movement_type
                  );

                  return (
                    <tr key={m.id} className="hover:bg-[#f5f7fa] transition-colors">
                      <td className="py-3 px-4 font-mono text-[#627d98]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#102a43]">
                        {prod ? prod.name : 'Unknown Product'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            m.movement_type === 'PURCHASE'
                              ? 'teal'
                              : m.movement_type === 'SALE'
                              ? 'slate'
                              : m.movement_type.includes('DECREASE') || m.movement_type.includes('DAMAGE')
                              ? 'rose'
                              : 'emerald'
                          }
                          size="sm"
                        >
                          {m.movement_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                          {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#243b53]">
                        {formatCurrency(m.unit_cost, organization.currency_symbol)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#243b53]">
                        {formatCurrency(m.total_cost, organization.currency_symbol)}
                      </td>
                      <td className="py-3 px-4 text-[#627d98] text-[11px]">
                        {m.notes || 'Automated movement'} • {m.created_by || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Product Add / Edit Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Edit Inventory Product' : 'Add New Inventory Product'}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="SKU / Barcode"
              value={prodForm.sku}
              onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
                Category
              </label>
              <select
                value={prodForm.category_id}
                onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
                className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Stock Unit"
              value={prodForm.unit}
              onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
              placeholder="Pcs, Ream, Pack"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`Purchase Cost (${organization.currency_symbol})`}
              type="number"
              step="any"
              value={prodForm.purchase_price}
              onChange={(e) =>
                setProdForm({ ...prodForm, purchase_price: parseFloat(e.target.value) || 0 })
              }
            />

            <Input
              label={`Selling Price (${organization.currency_symbol})`}
              type="number"
              step="any"
              required
              value={prodForm.selling_price}
              onChange={(e) =>
                setProdForm({ ...prodForm, selling_price: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          {!editingProduct && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Opening Stock Count"
                type="number"
                value={prodForm.opening_stock}
                onChange={(e) =>
                  setProdForm({ ...prodForm, opening_stock: parseFloat(e.target.value) || 0 })
                }
              />

              <Input
                label="Low Stock Warning Level"
                type="number"
                value={prodForm.min_stock_threshold}
                onChange={(e) =>
                  setProdForm({
                    ...prodForm,
                    min_stock_threshold: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
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
        title={editingService ? 'Edit Service' : 'Add New Service Job'}
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
              onChange={(e) => setServForm({ ...servForm, sku: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
                Category
              </label>
              <select
                value={servForm.category_id}
                onChange={(e) => setServForm({ ...servForm, category_id: e.target.value })}
                className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
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
                setServForm({ ...servForm, selling_price: parseFloat(e.target.value) || 0 })
              }
            />

            <Input
              label={`Estimated Labor / Cost (${organization.currency_symbol})`}
              type="number"
              step="any"
              value={servForm.estimated_cost}
              onChange={(e) =>
                setServForm({ ...servForm, estimated_cost: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <Input
            label="Internal Notes"
            placeholder="e.g. Standard laser printer drum rate"
            value={servForm.notes}
            onChange={(e) => setServForm({ ...servForm, notes: e.target.value })}
          />

          {/* Recipe Components Builder */}
          <div className="p-3.5 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#102a43]">Raw Material Consumption (Recipe)</p>
                <p className="text-[10px] text-[#627d98]">
                  Deduct physical stock items when this service is sold (e.g. 1 A4 Paper per Photocopy).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddRecipeComponent}>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Material</span>
              </Button>
            </div>

            {servComponents.length === 0 ? (
              <p className="text-[11px] text-[#627d98] italic py-1">
                No inventory consumption linked. This service will be sold as pure service/labor.
              </p>
            ) : (
              <div className="space-y-2">
                {servComponents.map((comp, idx) => {
                  const prod = products.find((p) => p.id === comp.product_id);
                  const lineCost = prod ? roundMoney(prod.average_cost * comp.quantity_consumed) : 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white p-2 rounded-[8px] border border-[#d9e2ec] text-xs"
                    >
                      <div className="flex-1">
                        <select
                          value={comp.product_id}
                          onChange={(e) => handleUpdateRecipeComponent(idx, 'product_id', e.target.value)}
                          className="w-full rounded bg-white border border-[#d9e2ec] px-2 py-1 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.current_stock} {p.unit}, Avg: {formatCurrency(p.average_cost, organization.currency_symbol)})
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
                            handleUpdateRecipeComponent(idx, 'quantity_consumed', parseFloat(e.target.value) || 0)
                          }
                          placeholder="Qty"
                          className="w-full rounded bg-white border border-[#d9e2ec] px-2 py-1 text-xs text-[#102a43] text-right font-mono"
                        />
                      </div>

                      <span className="text-xs font-mono text-teal-800 w-24 text-right shrink-0">
                        {formatCurrency(lineCost, organization.currency_symbol)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeComponent(idx)}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Remove component"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-[#d9e2ec]">
                  <span className="text-[#627d98]">Total Material Cost per Job:</span>
                  <span className="font-mono text-teal-800">
                    {formatCurrency(computedRecipeCost, organization.currency_symbol)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
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
        title={`Stock Adjustment: ${movementProduct?.name || ''}`}
        description="Record supplier purchase or stock write-off with Weighted Average Cost calculation."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteStockMovement} className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-semibold text-[#102a43] mb-1.5">
              Movement Reason / Type
            </label>
            <select
              value={movementForm.movement_type}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  movement_type: e.target.value as StockMovement['movement_type'],
                })
              }
              className="w-full rounded-[8px] bg-white border border-[#d9e2ec] px-3 py-2 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
            >
              <option value="PURCHASE">Supplier Purchase / Stock In (Updates WAC)</option>
              <option value="ADJUSTMENT_INCREASE">Stock Audit Increase (+)</option>
              <option value="ADJUSTMENT_DECREASE">Stock Audit Decrease (-)</option>
              <option value="DAMAGE_WASTAGE">Damage / Wastage / Spoiled Material (-)</option>
              <option value="SUPPLIER_RETURN">Return to Supplier (-)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Quantity (${movementProduct?.unit || 'Pcs'})`}
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

          <div className="p-3 rounded-[8px] bg-[#f5f7fa] border border-[#d9e2ec] text-xs flex justify-between font-mono">
            <span className="text-[#627d98]">Total Valuation Impact:</span>
            <span className="font-bold text-teal-800">
              {formatCurrency(
                roundMoney(movementForm.quantity * movementForm.unit_cost),
                organization.currency_symbol
              )}
            </span>
          </div>

          <Input
            label="Supplier / Bill Ref / Notes"
            placeholder="e.g. Urdu Bazaar Supplier Invoice #5402"
            value={movementForm.notes}
            onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
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
