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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f8f9fb] select-none text-[#14181f]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e6e8ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#14181f]">
            Sales & Invoice Ledger
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Complete transaction history, audit records, receipt reprints, and safe voids.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#777587]" />
          <input
            type="text"
            placeholder="Search invoice #, customer name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-[#e6e8ec] text-xs text-[#14181f] placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:outline-none focus:ring-3 focus:ring-[#4f46e5]/12"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#667085]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#e6e8ec] rounded-lg px-3 py-1.5 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none focus:ring-3 focus:ring-[#4f46e5]/12"
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
          <table className="data-table w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e6e8ec]">
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
            <tbody className="divide-y divide-[#e6e8ec] font-sans">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-[#f2f4f6] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#14181f]">
                    #{sale.invoice_number}
                  </td>
                  <td className="py-3 px-3 text-[#667085] font-mono text-[11px]">
                    {formatDateTime(sale.created_at)}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-[#14181f]">
                      {sale.customer_name || 'Walk-in'}
                    </p>
                    {sale.customer_phone && (
                      <p className="text-[10px] font-mono text-[#777587]">{sale.customer_phone}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#667085]">{sale.cashier_name}</td>
                  <td className="py-3 px-3 text-[#14181f]">
                    <span className="px-2 py-0.5 rounded-md bg-[#f2f4f6] border border-[#e6e8ec] text-[11px] font-mono">
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#667085]">
                    {sale.items.length} items
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[#3525cd]">
                    {formatCurrency(sale.grand_total, organization.currency_symbol)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#16a34a] font-semibold">
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
                        className="p-1.5 rounded-lg text-[#667085] hover:bg-[#f2f4f6] hover:text-[#14181f] transition-colors cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setActiveReceiptSale(sale)}
                        title="Print / Thermal Receipt"
                        className="p-1.5 rounded-lg text-[#667085] hover:bg-[#f2f4f6] hover:text-[#4f46e5] transition-colors cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {sale.status === 'COMPLETED' && (
                        <button
                          onClick={() => setSaleToVoid(sale)}
                          title="Void Transaction (Revert Stock & Money)"
                          className="p-1.5 rounded-lg text-[#667085] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors cursor-pointer"
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
              <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fee2e2] text-xs text-[#991b1b] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-[#dc2626]" />
                  Transaction Voided by {inspectSale.voided_by} on{' '}
                  {formatDateTime(inspectSale.voided_at || '')}
                </p>
                <p>Reason: {inspectSale.void_reason}</p>
              </div>
            )}

            {/* Line items table */}
            <div className="rounded-lg border border-[#e6e8ec] overflow-hidden">
              <table className="data-table w-full text-xs text-left">
                <thead>
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5 text-right">Unit Rate</th>
                    <th className="p-2.5 text-right">Discount</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e8ec]">
                  {inspectSale.items.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-medium text-[#14181f]">
                        {it.item_name}
                        {it.sku && (
                          <span className="text-[10px] font-mono text-[#777587] ml-1">
                            ({it.sku})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#14181f]">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono text-[#14181f]">
                        {formatCurrency(it.unit_price, organization.currency_symbol)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#667085]">
                        {it.discount > 0
                          ? `-${formatCurrency(it.discount, organization.currency_symbol)}`
                          : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-[#3525cd]">
                        {formatCurrency(it.total, organization.currency_symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="p-3 rounded-lg bg-[#f2f4f6] border border-[#e6e8ec] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#667085]">
                <span>Subtotal:</span>
                <span className="font-mono text-[#14181f]">
                  {formatCurrency(inspectSale.subtotal, organization.currency_symbol)}
                </span>
              </div>
              {inspectSale.discount > 0 && (
                <div className="flex justify-between text-[#667085]">
                  <span>Order Discount:</span>
                  <span className="font-mono text-[#14181f]">
                    -{formatCurrency(inspectSale.discount, organization.currency_symbol)}
                  </span>
                </div>
              )}
              {inspectSale.tax_amount > 0 && (
                <div className="flex justify-between text-[#667085]">
                  <span>Tax:</span>
                  <span className="font-mono text-[#14181f]">
                    +{formatCurrency(inspectSale.tax_amount, organization.currency_symbol)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#14181f] pt-1 border-t border-[#e6e8ec]">
                <span>Grand Total:</span>
                <span className="font-mono text-[#3525cd] font-bold">
                  {formatCurrency(inspectSale.grand_total, organization.currency_symbol)}
                </span>
              </div>
              <div className="flex justify-between text-[#667085] pt-1">
                <span>Payment Method:</span>
                <span className="font-mono font-semibold text-[#14181f]">
                  {inspectSale.payment_method}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#e6e8ec]">
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
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fee2e2] text-xs text-[#991b1b]">
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e6e8ec]">
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
