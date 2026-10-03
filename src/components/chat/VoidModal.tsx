import React, { useState } from 'react';
import { Transaction } from '../../types/ledger';
import { formatPaisa } from '../../lib/money';
import { Trash2, AlertCircle, X } from 'lucide-react';

interface VoidModalProps {
  transaction: Transaction | null;
  onConfirmVoid: (id: string, reason: string, currentUpdatedAt: string) => Promise<void>;
  onClose: () => void;
}

export const VoidModal: React.FC<VoidModalProps> = ({ transaction, onConfirmVoid, onClose }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A void reason is required by shop policy.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmVoid(transaction.id, reason.trim(), transaction.updated_at);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to void transaction. Check if it was modified concurrently.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100">
        <div className="px-5 py-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <Trash2 className="w-5 h-5" />
            <h3 className="font-semibold text-base">Void Transaction</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="text-xs text-gray-500">Transaction to void:</div>
            <div className="font-semibold text-gray-900 mt-0.5">
              {transaction.category_name || transaction.type.toUpperCase()}{' '}
              <span className="font-mono text-emerald-800">{formatPaisa(transaction.amount_paisa)}</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1 font-mono">
              Entered: {new Date(transaction.device_entry_time).toLocaleTimeString()} by {transaction.created_by_name}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason for Voiding <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Typo in amount, customer cancelled, test"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
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
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Voiding...' : 'Confirm Void'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
