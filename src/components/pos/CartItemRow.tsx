import React from "react";
import { CartItem } from "../../types";
import { Minus, Plus, Trash2, AlertTriangle } from "lucide-react";
import { roundMoney, formatCurrency } from "../../lib/utils";

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
  onRemove,
}) => {
  const lineSubtotal = roundMoney(item.quantity * item.unit_price);
  const lineTotal = roundMoney(Math.max(0, lineSubtotal - (item.discount || 0)));
  const isLowStock =
    item.type === "PRODUCT" &&
    item.track_stock &&
    item.current_stock !== undefined &&
    item.quantity > item.current_stock;

  return (
    <div className="p-3 rounded-xl bg-white border border-[#e6e8ec] hover:border-[#c7c4d8] transition-all space-y-2 select-none shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Top: Name, Type Badge, and Remove button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 truncate">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                item.type === "SERVICE"
                  ? "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]"
                  : "bg-[#f2f4f6] text-[#555f73] border-[#e6e8ec]"
              }`}
            >
              {item.type === "SERVICE" ? "SRV" : "PRD"}
            </span>
            <p className="text-xs font-semibold text-[#14181f] truncate">
              {item.name}
            </p>
          </div>
          {isLowStock && (
            <div className="flex items-center gap-1 text-[11px] text-[#dc2626] font-medium mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Available stock: {item.current_stock}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-[#667085] hover:text-[#dc2626] p-1 rounded-md transition-colors cursor-pointer"
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Controls: Quantity (+ / -), Unit Price edit, Line Total */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f2f4f6]">
        {/* Quantity control */}
        <div className="flex items-center rounded-lg border border-[#e6e8ec] bg-[#f8f9fb] overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
            className="p-1.5 text-[#667085] hover:text-[#14181f] hover:bg-[#edeef0] transition-colors cursor-pointer"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) =>
              onUpdateQty(item.id, Math.max(1, parseFloat(e.target.value) || 1))
            }
            className="w-10 text-center text-xs font-mono font-semibold bg-transparent text-[#14181f] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.id, item.quantity + 1)}
            className="p-1.5 text-[#667085] hover:text-[#14181f] hover:bg-[#edeef0] transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Rate / Unit Price editable */}
        <div className="flex items-center gap-1 text-[11px] text-[#667085]">
          <span>@</span>
          <input
            type="number"
            step="any"
            value={item.unit_price}
            onChange={(e) =>
              onUpdatePrice(
                item.id,
                Math.max(0, parseFloat(e.target.value) || 0),
              )
            }
            className="w-16 px-1.5 py-1 rounded-md bg-white border border-[#e6e8ec] text-xs font-mono text-[#14181f] text-right focus:border-[#4f46e5] focus:outline-none"
            title="Unit Price / Rate"
          />
        </div>

        {/* Line Total */}
        <div className="text-right">
          <p className="text-xs font-mono font-semibold text-[#14181f]">
            {formatCurrency(lineTotal, currencySymbol)}
          </p>
        </div>
      </div>
    </div>
  );
};
