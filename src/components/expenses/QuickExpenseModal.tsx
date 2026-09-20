import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { expenseRepo, accountRepo } from "../../services";
import { ExpenseCategory, PaymentAccount } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { Receipt, Check, AlertCircle } from "lucide-react";

export const QuickExpenseModal: React.FC = () => {
  const { organization, user } = useAuth();
  const { isQuickExpenseOpen, setIsQuickExpenseOpen, refreshData, showToast } =
    useApp();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isQuickExpenseOpen) {
      async function loadMeta() {
        const [cats, accs] = await Promise.all([
          expenseRepo.getCategories(organization.id),
          accountRepo.getAccounts(organization.id),
        ]);
        setCategories(cats);
        setAccounts(accs);
        if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
        if (accs.length > 0 && !accountId) {
          const def = accs.find((a) => a.is_default) || accs[0];
          setAccountId(def.id);
        }
      }
      loadMeta();
      setAmount("");
      setDescription("");
      setReferenceNumber("");
      setNotes("");
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, [isQuickExpenseOpen, organization.id]);

  if (!isQuickExpenseOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast(
        "error",
        "Invalid Amount",
        "Please enter a positive expense amount.",
      );
      return;
    }
    if (!description.trim()) {
      showToast(
        "error",
        "Description Required",
        "Please explain what this expense was for.",
      );
      return;
    }
    if (!categoryId || !accountId) {
      showToast(
        "error",
        "Missing Selection",
        "Please select both a category and payment account.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const exp = await expenseRepo.createExpense(organization.id, {
        category_id: categoryId,
        account_id: accountId,
        amount: numAmount,
        description: description.trim(),
        reference_number: referenceNumber.trim() || undefined,
        date,
        notes: notes.trim() || undefined,
        entered_by: user?.full_name || "Muhammad Yaqoob",
      });

      showToast(
        "success",
        "Expense Recorded",
        `${formatCurrency(exp.amount, organization.currency_symbol)} paid from ${exp.account_name}`,
      );
      setIsQuickExpenseOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(
        "error",
        "Expense Failed",
        err.message || "Could not record expense",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <Modal
      isOpen={isQuickExpenseOpen}
      onClose={() => setIsQuickExpenseOpen(false)}
      title="Log Business Expense"
      description="Record petty cash, toner, ink, electricity, rent, or supplies purchase."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1 select-none">
        <div className="hidden">
          {/* Expense Category */}
          <div>
            <label className="block text-xs font-semibold text-[#14181f] mb-1">
              Expense Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Paid From Account */}
          <div>
            <label className="block text-xs font-semibold text-[#14181f] mb-1">
              Paid From Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 text-xs text-[#14181f] focus:border-[#4f46e5] focus:outline-none"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (Bal: {organization.currency_symbol}{" "}
                  {a.current_balance})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <Input
              label={`Amount (${organization.currency_symbol})`}
              type="number"
              step="any"
              required
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-base font-bold text-[#dc2626]"
            />
          </div>

          <div>
            <Input
              label="Expense Date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <Input
          label="Description / Purpose"
          required
          placeholder="e.g. 5x Master Roll for Riso, Toner Powder, Courier Fee"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Optional bookkeeping details remain available in the full expense history. */}
        <div className="hidden">
          <Input
            label="Bill / Receipt Ref # (Optional)"
            placeholder="e.g. REC-8495 or Bill #12"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />

          <Input
            label="Additional Notes / Payee (Optional)"
            placeholder="e.g. Al-Rehman Paper Store"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Impact Notice */}
        <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] text-xs text-[#667085] flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-[#4f46e5] shrink-0 mt-0.5" />
          <span>
            Recording this expense will immediately deduct from{" "}
            <strong className="text-[#14181f]">
              {selectedAccount ? selectedAccount.name : "the selected account"}
            </strong>{" "}
            and update today&rsquo;s cash closing statement.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e6e8ec]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsQuickExpenseOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            <Check className="h-4 w-4" />
            <span>Save Expense</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
