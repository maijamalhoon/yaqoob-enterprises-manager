import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Customer, PaymentAccount, SplitPayment } from "../../types";
import { roundMoney, formatCurrency } from "../../lib/utils";
import { Check, Printer } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  currencySymbol: string;
  accounts: PaymentAccount[];
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (cust: Customer | null) => void;
  onCompleteSale: (params: {
    paymentMethod: string;
    amountPaid: number;
    splitPayments: SplitPayment[];
    notes?: string;
    printReceipt: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  currencySymbol,
  accounts,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCompleteSale,
  isLoading,
}) => {
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<number>(grandTotal);
  const [notes, setNotes] = useState<string>("");

  const [splits, setSplits] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setAmountPaid(grandTotal);
      setPaymentMode("single");
      const defaultAcc = accounts.find((a) => a.is_default) || accounts[0];
      if (defaultAcc) {
        setSelectedAccountId(defaultAcc.id);
      }
      setSplits({});
      setNotes("");
    }
  }, [isOpen, grandTotal, accounts]);

  if (!isOpen) return null;

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const totalSplitAllocated = roundMoney(
    Object.values(splits).reduce((sum, val) => sum + (val || 0), 0),
  );
  const splitRemaining = roundMoney(grandTotal - totalSplitAllocated);

  const changeDue =
    paymentMode === "single"
      ? roundMoney(Math.max(0, amountPaid - grandTotal))
      : roundMoney(Math.max(0, totalSplitAllocated - grandTotal));

  const handleQuickCash = (amt: number) => {
    setAmountPaid(amt);
  };

  const handleSplitAmountChange = (accId: string, val: number) => {
    setSplits((prev) => ({
      ...prev,
      [accId]: Math.max(0, val),
    }));
  };

  const handleSubmit = async (printReceipt = false) => {
    if (paymentMode === "single") {
      await onCompleteSale({
        paymentMethod: activeAccount ? activeAccount.name : "Cash",
        amountPaid,
        splitPayments: [
          {
            account_id: activeAccount?.id || "",
            account_name: activeAccount?.name || "Cash",
            amount: roundMoney(amountPaid - changeDue),
          },
        ],
        notes,
        printReceipt,
      });
    } else {
      const splitList: SplitPayment[] = Object.entries(splits)
        .filter(([_, amt]) => amt > 0)
        .map(([accId, amt]) => {
          const acc = accounts.find((a) => a.id === accId);
          return {
            account_id: accId,
            account_name: acc ? acc.name : "Account",
            amount: amt,
          };
        });

      await onCompleteSale({
        paymentMethod: "Split Payment",
        amountPaid: totalSplitAllocated,
        splitPayments: splitList,
        notes,
        printReceipt,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Payment & Checkout"
      description="Select payment account, apply tender, and finalize transaction invoice."
      maxWidth="2xl"
    >
      <div onKeyDown={handleKeyDown} className="space-y-4 py-1 select-none">
        {/* Top: Grand Total Highlight Card */}
        <div className="p-4 rounded-xl bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div>
            <p className="text-xs font-semibold text-[#555f73] uppercase tracking-wider">
              Total Amount Payable
            </p>
            <h1 className="text-2xl sm:text-3xl font-mono font-bold text-[#4f46e5] mt-0.5">
              {formatCurrency(grandTotal, currencySymbol)}
            </h1>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#555f73] block">Customer</span>
            <span className="text-sm font-semibold text-[#14181f]">
              {selectedCustomer ? selectedCustomer.name : "Walk-in Customer"}
            </span>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#14181f] mb-1">
              Customer Account
            </label>
            <select
              value={selectedCustomer?.id || ""}
              onChange={(e) => {
                const found =
                  customers.find((c) => c.id === e.target.value) || null;
                onSelectCustomer(found);
              }}
              className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
            >
              <option value="">Walk-in Customer (General Counter)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switch: Single vs Split */}
          <div className="w-48">
            <label className="block text-xs font-semibold text-[#14181f] mb-1">
              Payment Structure
            </label>
            <div className="flex rounded-lg border border-[#e6e8ec] bg-[#f8f9fb] p-0.5 text-xs h-10 items-center">
              <button
                type="button"
                onClick={() => setPaymentMode("single")}
                className={`flex-1 h-8 rounded-md font-medium transition-colors cursor-pointer ${
                  paymentMode === "single"
                    ? "bg-[#4f46e5] text-white shadow-xs"
                    : "text-[#555f73] hover:text-[#14181f]"
                }`}
              >
                Single Account
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("split")}
                className={`flex-1 h-8 rounded-md font-medium transition-colors cursor-pointer ${
                  paymentMode === "split"
                    ? "bg-[#4f46e5] text-white shadow-xs"
                    : "text-[#555f73] hover:text-[#14181f]"
                }`}
              >
                Split Tender
              </button>
            </div>
          </div>
        </div>

        {/* Single Account Mode */}
        {paymentMode === "single" && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#14181f] mb-1.5">
                Select Receiving Account
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {accounts.map((acc) => {
                  const isSelected = acc.id === selectedAccountId;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5] shadow-xs"
                          : "border-[#e6e8ec] bg-white text-[#14181f] hover:border-[#c7c4d8] hover:bg-[#f8f9fb]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold truncate">
                          {acc.name}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-[#4f46e5] shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-[#555f73] font-mono">
                        Bal: {currencySymbol} {acc.current_balance}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Tendered and Quick Cash Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Input
                  label="Amount Received / Tendered"
                  type="number"
                  step="any"
                  value={amountPaid}
                  onChange={(e) =>
                    setAmountPaid(parseFloat(e.target.value) || 0)
                  }
                  className="font-mono text-base font-bold text-[#14181f]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(grandTotal)}
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-[#f8f9fb] hover:bg-[#edeef0] text-[#14181f] border border-[#e6e8ec] cursor-pointer"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickCash(Math.ceil(grandTotal / 50) * 50)
                    }
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-[#f8f9fb] hover:bg-[#edeef0] text-[#14181f] border border-[#e6e8ec] cursor-pointer"
                  >
                    Round 50
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickCash(Math.ceil(grandTotal / 100) * 100)
                    }
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-[#f8f9fb] hover:bg-[#edeef0] text-[#14181f] border border-[#e6e8ec] cursor-pointer"
                  >
                    Round 100
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickCash(Math.ceil(grandTotal / 500) * 500)
                    }
                    className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-[#f8f9fb] hover:bg-[#edeef0] text-[#14181f] border border-[#e6e8ec] cursor-pointer"
                  >
                    Round 500
                  </button>
                </div>
              </div>

              {/* Change calculation display */}
              <div className="p-3.5 rounded-xl bg-[#f8f9fb] border border-[#e6e8ec] flex flex-col justify-center">
                <span className="text-xs text-[#555f73]">
                  Change Due to Customer
                </span>
                <span
                  className={`text-xl sm:text-2xl font-mono font-bold mt-1 ${
                    changeDue > 0 ? "text-[#16a34a]" : "text-[#14181f]"
                  }`}
                >
                  {formatCurrency(changeDue, currencySymbol)}
                </span>
                <span className="text-[11px] text-[#555f73] mt-1">
                  {amountPaid < grandTotal
                    ? `⚠️ Short by ${formatCurrency(grandTotal - amountPaid, currencySymbol)}`
                    : "Full tender satisfied"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Split Payment Mode */}
        {paymentMode === "split" && (
          <div className="space-y-3 p-3.5 rounded-xl bg-[#f8f9fb] border border-[#e6e8ec]">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[#e6e8ec]">
              <span className="font-semibold text-[#14181f]">
                Allocate Split Tender
              </span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[#555f73]">Remaining:</span>
                <span
                  className={`font-bold ${
                    splitRemaining === 0
                      ? "text-[#16a34a]"
                      : splitRemaining > 0
                      ? "text-[#d97706]"
                      : "text-[#dc2626]"
                  }`}
                >
                  {formatCurrency(splitRemaining, currencySymbol)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#e6e8ec]"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-[#14181f] truncate">
                      {acc.name}
                    </p>
                    <p className="text-[10px] text-[#555f73] font-mono">
                      Bal: {currencySymbol} {acc.current_balance}
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={splits[acc.id] ?? ""}
                    onChange={(e) =>
                      handleSplitAmountChange(
                        acc.id,
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-24 px-2 py-1 rounded-md bg-white border border-[#e6e8ec] text-xs font-mono font-bold text-[#14181f] text-right focus:border-[#4f46e5] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#14181f] mb-1">
            Order Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Urgent custom order delivery, customer note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:outline-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#e6e8ec]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              isLoading={isLoading}
              onClick={() => handleSubmit(true)}
            >
              <Printer className="h-4 w-4 text-[#4f46e5]" />
              <span>Save & Print</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isLoading}
              onClick={() => handleSubmit(false)}
            >
              <Check className="h-4 w-4" />
              <span>Complete Sale</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
