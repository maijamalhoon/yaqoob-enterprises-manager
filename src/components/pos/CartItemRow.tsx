import React from 'react';
import { CartItem } from '../../types';
import { Minus, Plus, Trash2, Tag, AlertTriangle } from 'lucide-react';
import { roundMoney, formatCurrency } from '../../lib/utils';

interface CartItemRowProps {
  item: CartItem;
  currencySymbol: string;
  onUpdateQty: (id: string, newQty: number) => void;
  onUpdatePrice: (id: string, newPrice: number) => void;
  onUpdateDiscount: (id: string, newDiscount: number) => void;
  onRemove: (id: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  currencySymbol,
  onUpdateQty,
  onUpdatePrice,
  onUpdateDiscount,
  onRemove,
}) => {
  const lineSubtotal = roundMoney(item.quantity * item.unit_price);
  const lineTotal = roundMoney(Math.max(0, lineSubtotal - (item.discount || 0)));
  const isLowStock =
    item.type === 'PRODUCT' &&
    item.track_stock &&
    item.current_stock !== undefined &&
    item.quantity > item.current_stock;

  return (
    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-colors space-y-2 select-none">
      {/* Top: Name, Type Badge, and Remove button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 truncate">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                item.type === 'SERVICE'
                  ? 'bg-teal-950 text-teal-400 border border-teal-800/60'
                  : 'bg-cyan-950 text-cyan-400 border border-cyan-800/60'
              }`}
            >
              {item.type === 'SERVICE' ? 'SRV' : 'PRD'}
            </span>
            <p className="text-xs font-semibold text-slate-100 truncate">{item.name}</p>
          </div>
          {isLowStock && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Available stock: {item.current_stock}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Controls: Quantity (+ / -), Unit Price edit, Line Discount, Line Total */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
        {/* Quantity control */}
        <div className="flex items-center rounded-md border border-slate-700 bg-slate-950 overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdateQty(item.id, Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-10 text-center text-xs font-mono font-bold bg-transparent text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.id, item.quantity + 1)}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Rate / Unit Price editable */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>@</span>
          <input
            type="number"
            step="any"
            value={item.unit_price}
            onChange={(e) => onUpdatePrice(item.id, Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-14 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 text-right focus:border-cyan-500 focus:outline-none"
            title="Unit Price / Rate"
          />
        </div>

        {/* Line Total */}
        <div className="text-right">
          <p className="text-xs font-mono font-bold text-cyan-300">
            {formatCurrency(lineTotal, currencySymbol)}
          </p>
        </div>
      </div>
    </div>
  );
};
