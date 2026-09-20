import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { salesRepo } from '../../services';
import { Sale } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  History,
  Search,
  Printer,
  Ban,
  FileText,
  AlertTriangle,
  ArrowRight,
  Eye,
  Check,
} from 'lucide-react';

export const SalesHistoryView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast, setActiveReceiptSale } = useApp();

  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Sale for detail drawer
  const [inspectSale, setInspectSale] = useState<Sale | null>(null);

  // Void Modal State
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    async function loadSales() {
      const list = await salesRepo.getSales(organization.id);
      setSales(list);
    }
    loadSales();
  }, [organization.id, dataVersion]);

  const handleExecuteVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToVoid || !voidReason.trim()) return;

    setIsVoiding(true);
    try {
      await salesRepo.voidSale(
        organization.id,
        saleToVoid.id,
        user?.id || 'usr-void',
        user?.full_name || 'Authorized Manager',
        voidReason.trim()
      );

      showToast(
        'warning',
        `Invoice #${saleToVoid.invoice_number} Voided`,
        'Inventory restored and cash reversed.'
      );
      setSaleToVoid(null);
      setVoidReason('');
      setInspectSale(null);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Void Failed', err.message);
    } finally {
      setIsVoiding(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sales.filter((s) => {
      const matchesQ =
        !q ||
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.customer_phone && s.customer_phone.includes(q)) ||
        s.payment_method.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [sales, searchQuery, statusFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Sales & Invoice Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete transaction history, audit records, receipt reprints, and safe voids.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">All Transactions</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
      </div>

      {/* Sales Invoices Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Payment Method</th>
                <th className="py-3 px-3 text-right">Items</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-right">Gross Profit</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-900/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-200">
                    #{sale.invoice_number}
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                    {formatDateTime(sale.created_at)}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-slate-200">
                      {sale.customer_name || 'Walk-in'}
                    </p>
                    {sale.customer_phone && (
                      <p className="text-[10px] font-mono text-slate-500">{sale.customer_phone}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-400">{sale.cashier_name}</td>
                  <td className="py-3 px-3 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono">
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {sale.items.length} items
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                    {formatCurrency(sale.grand_total, organization.currency_symbol)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">
                    {formatCurrency(sale.gross_profit, organization.currency_symbol)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={sale.status === 'COMPLETED' ? 'emerald' : 'rose'} size="sm">
                      {sale.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectSale(sale)}
                        title="View Invoice Details"
                        className="p-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setActiveReceiptSale(sale)}
                        title="Print / Thermal Receipt"
                        className="p-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {sale.status === 'COMPLETED' && (
                        <button
                          onClick={() => setSaleToVoid(sale)}
                          title="Void Transaction (Revert Stock & Money)"
                          className="p-1.5 rounded text-slate-400 hover:bg-rose-950/60 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sale Detail Inspection Modal */}
      <Modal
        isOpen={Boolean(inspectSale)}
        onClose={() => setInspectSale(null)}
        title={`Invoice Details: #${inspectSale?.invoice_number || ''}`}
        description={`Created on ${inspectSale ? formatDateTime(inspectSale.created_at) : ''} by ${inspectSale?.cashier_name}`}
        maxWidth="xl"
      >
        {inspectSale && (
          <div className="space-y-4 py-1">
            {inspectSale.status === 'VOIDED' && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Transaction Voided by {inspectSale.voided_by} on{' '}
                  {formatDateTime(inspectSale.voided_at || '')}
                </p>
                <p>Reason: {inspectSale.void_reason}</p>
              </div>
            )}

            {/* Line items table */}
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5 text-right">Unit Rate</th>
                    <th className="p-2.5 text-right">Discount</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inspectSale.items.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-medium text-slate-200">
                        {it.item_name}
                        {it.sku && (
                          <span className="text-[10px] font-mono text-slate-500 ml-1">
                            ({it.sku})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatCurrency(it.unit_price, organization.currency_symbol)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-400">
                        {it.discount > 0
                          ? `-${formatCurrency(it.discount, organization.currency_symbol)}`
                          : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-cyan-300">
                        {formatCurrency(it.total, organization.currency_symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">
                  {formatCurrency(inspectSale.subtotal, organization.currency_symbol)}
                </span>
              </div>
              {inspectSale.discount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Order Discount:</span>
                  <span className="font-mono">
                    -{formatCurrency(inspectSale.discount, organization.currency_symbol)}
                  </span>
                </div>
              )}
              {inspectSale.tax_amount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Tax:</span>
                  <span className="font-mono">
                    +{formatCurrency(inspectSale.tax_amount, organization.currency_symbol)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-100 pt-1 border-t border-slate-800">
                <span>Grand Total:</span>
                <span className="font-mono text-cyan-300">
                  {formatCurrency(inspectSale.grand_total, organization.currency_symbol)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1">
                <span>Payment Method:</span>
                <span className="font-mono font-semibold text-slate-200">
                  {inspectSale.payment_method}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveReceiptSale(inspectSale);
                  setInspectSale(null);
                }}
              >
                <Printer className="h-4 w-4" />
                <span>Reprint Invoice</span>
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setInspectSale(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Void Transaction Reason Modal */}
      <Modal
        isOpen={Boolean(saleToVoid)}
        onClose={() => setSaleToVoid(null)}
        title={`Void Invoice #${saleToVoid?.invoice_number || ''}?`}
        description="This action will reverse inventory deductions, refund account balance, and log an audit record."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteVoid} className="space-y-4 py-1">
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/80 text-xs text-rose-300">
            <p className="font-bold mb-1">Warning: Transactional Reversal</p>
            <p>
              Voiding an invoice cannot be undone. All stock consumed by this sale will be returned
              to inventory.
            </p>
          </div>

          <Input
            label="Reason for Voiding (Required)"
            required
            autoFocus
            placeholder="e.g. Customer cancelled order, duplicate entry, cashier rate error"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSaleToVoid(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isVoiding}>
              <Ban className="h-4 w-4" />
              <span>Confirm Void</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
