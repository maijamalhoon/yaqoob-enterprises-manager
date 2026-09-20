import React, { useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Printer, X, Download } from 'lucide-react';

export interface PrintReceiptModalProps {
  sale?: Sale | null;
  onClose?: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({ sale: propSale, onClose: propOnClose }) => {
  const { organization } = useAuth();
  const { activeReceiptSale, setActiveReceiptSale } = useApp();
  const receiptRef = useRef<HTMLDivElement>(null);

  const sale = propSale !== undefined ? propSale : activeReceiptSale;
  const onClose = propOnClose || (() => setActiveReceiptSale(null));

  if (!sale) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={Boolean(sale)}
      onClose={onClose}
      title={`Receipt: #${sale.invoice_number}`}
      description="Thermal POS (80mm) & Standard A4 compatible invoice."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex items-center justify-between no-print pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleBrowserPrint}>
              <Printer className="h-4 w-4" />
              Print Receipt (Browser / Thermal)
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Receipt Container - Specially styled for thermal printers */}
        <div
          ref={receiptRef}
          className="receipt-print-area bg-white text-black p-6 rounded-lg shadow-inner max-w-[340px] mx-auto text-xs font-mono select-text"
          id="receipt-print-target"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-400">
            <h1 className="text-base font-bold uppercase tracking-wider">{organization.name}</h1>
            <p className="text-[11px] text-gray-700">{organization.business_category}</p>
            {organization.address && (
              <p className="text-[10px] text-gray-600 mt-0.5">{organization.address}</p>
            )}
            {organization.phone && (
              <p className="text-[10px] text-gray-600">Tel: {organization.phone}</p>
            )}
          </div>

          {/* Invoice Info */}
          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice #:</span>
              <span className="font-bold">{sale.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date/Time:</span>
              <span>{formatDateTime(sale.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cashier:</span>
              <span>{sale.cashier_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{sale.customer_name || 'Walk-in'}</span>
            </div>
            {sale.customer_phone && (
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>Phone:</span>
                <span>{sale.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b border-dashed border-gray-400">
            <div className="grid grid-cols-12 text-[10px] font-bold text-gray-700 pb-1 border-b border-gray-200">
              <span className="col-span-6">ITEM</span>
              <span className="col-span-2 text-right">QTY</span>
              <span className="col-span-2 text-right">RATE</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>
            <div className="divide-y divide-gray-100 py-1 space-y-1">
              {sale.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[11px] pt-1">
                  <div className="col-span-6 truncate pr-1">
                    <p className="font-medium truncate">{item.item_name}</p>
                    {item.discount > 0 && (
                      <p className="text-[9px] text-gray-500">Disc: -{item.discount}</p>
                    )}
                  </div>
                  <span className="col-span-2 text-right">{item.quantity}</span>
                  <span className="col-span-2 text-right">{item.unit_price}</span>
                  <span className="col-span-2 text-right font-semibold">{item.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Calculation */}
          <div className="py-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span>{formatCurrency(sale.subtotal, organization.currency_symbol)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount, organization.currency_symbol)}</span>
              </div>
            )}
            {sale.tax_amount > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Tax:</span>
                <span>+{formatCurrency(sale.tax_amount, organization.currency_symbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-300">
              <span>GRAND TOTAL:</span>
              <span>{formatCurrency(sale.grand_total, organization.currency_symbol)}</span>
            </div>
            <div className="flex justify-between text-gray-700 pt-1">
              <span>Payment Mode:</span>
              <span className="font-semibold">{sale.payment_method}</span>
            </div>
            {sale.split_payments && sale.split_payments.length > 0 && (
              <div className="text-[10px] text-gray-600 pl-2">
                {sale.split_payments.map((sp, i) => (
                  <div key={i} className="flex justify-between">
                    <span>• {sp.account_name}:</span>
                    <span>{formatCurrency(sp.amount, organization.currency_symbol)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>Amount Paid:</span>
              <span>{formatCurrency(sale.amount_paid, organization.currency_symbol)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900">
              <span>Change Returned:</span>
              <span>{formatCurrency(sale.change_due, organization.currency_symbol)}</span>
            </div>
          </div>

          {/* Footer & Barcode placeholder */}
          <div className="pt-3 border-t border-dashed border-gray-400 text-center space-y-1.5">
            <p className="text-[10px] text-gray-600 leading-tight">
              {organization.receipt_footer || 'Thank you for your business!'}
            </p>
            <div className="pt-1 text-[9px] text-gray-500 font-mono">
              *** System Powered by Yaqoob Enterprises Manager ***
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
