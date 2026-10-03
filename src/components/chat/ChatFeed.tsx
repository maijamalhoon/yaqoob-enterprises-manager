import React from 'react';
import { Transaction } from '../../types/ledger';
import { formatPaisa } from '../../lib/money';
import { formatKarachiTime } from '../../lib/dates';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Wallet,
  Scale,
  RotateCcw,
  Edit2,
  Trash2,
  CloudOff,
  Check,
  Ban,
} from 'lucide-react';

interface ChatFeedProps {
  transactions: Transaction[];
  currentUserId: string;
  onEdit: (tx: Transaction) => void;
  onVoid: (tx: Transaction) => void;
  onRestore: (tx: Transaction) => void;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  transactions,
  currentUserId,
  onEdit,
  onVoid,
  onRestore,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-2xl">
          🧾
        </div>
        <h4 className="font-semibold text-gray-700 text-sm">No transactions yet today</h4>
        <p className="text-xs text-gray-400 max-w-xs mt-1">
          Type a message below like <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">PRINT 300</code> or{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">PAPER - 2000</code> to start.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {transactions.map((tx) => {
        const isMine = tx.created_by === currentUserId;
        const isVoided = tx.status === 'voided';
        const isQueued = !tx.created_at; // local queued entries don't have server created_at yet

        const isIncome = tx.type === 'income';
        const isExpense = tx.type === 'expense';
        const isCapital = tx.type === 'capital_in';
        const isWithdrawal = tx.type === 'withdrawal';
        const isAdjustment = tx.type === 'adjustment';

        const timeStr = formatKarachiTime(tx.device_entry_time);

        return (
          <div
            key={tx.id}
            className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} transition-opacity duration-150 ${
              isVoided ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {/* Sender & Timestamp */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1 px-1">
              <span className="font-semibold text-gray-600">{tx.created_by_name || 'Brother'}</span>
              <span>•</span>
              <span>{timeStr}</span>
              {isQueued && (
                <span className="flex items-center gap-0.5 text-amber-600 font-medium ml-1">
                  <CloudOff className="w-3 h-3" /> Queued
                </span>
              )}
            </div>

            {/* Bubble Container */}
            <div
              className={`group relative max-w-[85%] sm:max-w-md rounded-2xl p-3.5 shadow-xs border transition-all ${
                isVoided
                  ? 'bg-gray-100 border-gray-300 text-gray-500 line-through'
                  : isIncome
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : isExpense
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                  : isCapital
                  ? 'bg-blue-50/90 border-blue-200 text-blue-950'
                  : isWithdrawal
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                  : 'bg-purple-50/90 border-purple-200 text-purple-950'
              }`}
            >
              {/* Header row: Category / Action & Icon */}
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide">
                  {isIncome && <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />}
                  {isExpense && <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
                  {isCapital && <Landmark className="w-3.5 h-3.5 text-blue-600" />}
                  {isWithdrawal && <Wallet className="w-3.5 h-3.5 text-amber-600" />}
                  {isAdjustment && <Scale className="w-3.5 h-3.5 text-purple-600" />}

                  <span>{tx.category_name || tx.type.replace('_', ' ')}</span>
                </div>

                {/* Amount display */}
                <div
                  className={`font-mono font-bold text-base sm:text-lg tracking-tight ${
                    isVoided
                      ? 'text-gray-400'
                      : isIncome
                      ? 'text-emerald-800'
                      : isExpense
                      ? 'text-rose-800'
                      : 'text-gray-900'
                  }`}
                >
                  {isExpense ? '-' : ''}
                  {formatPaisa(tx.amount_paisa)}
                </div>
              </div>

              {/* Raw message / Note */}
              {tx.raw_text && tx.raw_text !== tx.category_name && (
                <div className="text-[11px] font-mono text-gray-500 truncate mt-0.5">
                  &ldquo;{tx.raw_text}&rdquo;
                </div>
              )}

              {tx.note && (
                <div className="text-xs text-gray-600 mt-1 italic bg-white/40 px-2 py-0.5 rounded">
                  Note: {tx.note}
                </div>
              )}

              {/* Void Reason Banner */}
              {isVoided && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-rose-700 flex items-center justify-between no-underline">
                  <div className="flex items-center gap-1 font-sans">
                    <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Voided: {tx.void_reason}</span>
                  </div>
                  <button
                    onClick={() => onRestore(tx)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                </div>
              )}

              {/* Action Buttons (Tap to Edit / Void) */}
              {!isVoided && (
                <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-end gap-2 text-xs">
                  <button
                    onClick={() => onEdit(tx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-indigo-600 bg-white/70 hover:bg-white px-2 py-1 rounded-md transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => onVoid(tx)}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-rose-600 bg-white/70 hover:bg-white px-2 py-1 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Void
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
