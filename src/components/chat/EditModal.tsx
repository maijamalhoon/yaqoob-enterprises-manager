import React, { useState } from 'react';
import { Transaction } from '../../types/ledger';
import { parseInputToPaisa, formatPaisa } from '../../lib/money';
import { Edit3, AlertCircle, X, Check } from 'lucide-react';

interface EditModalProps {
  transaction: Transaction | null;
  onConfirmEdit: (
    id: string,
    updates: { amount_paisa?: number; note?: string | null },
    currentUpdatedAt: string
  ) => Promise<void>;
  onClose: () => void;
}

export const EditModal: React.FC<EditModalProps> = ({ transaction, onConfirmEdit, onClose }) => {
  const [amountStr, setAmountStr] = useState(
    transaction ? (transaction.amount_paisa / 100).toString() : ''
  );
  const [note, setNote] = useState(transaction?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInputToPaisa(amountStr);
    if (!parsed.isValid || parsed.paisa <= 0) {
      setError(parsed.error || 'Amount must be greater than zero.');
      return;
    }
    const newAmountPaisa = parsed.paisa;

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmEdit(
        transaction.id,
        {
          amount_paisa: newAmountPaisa,
          note: note.trim() || null,
        },
        transaction.updated_at
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to edit transaction. It may have been updated concurrently.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-base">Edit Transaction</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-gray-500">
            Editing {transaction.category_name || transaction.type.toUpperCase()} from {transaction.business_date}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Amount (Rs) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 500"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add extra context"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
