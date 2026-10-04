import React from "react";
import { Transaction } from "../../types/ledger";
import { formatPaisa } from "../../lib/money";
import { formatKarachiTime } from "../../lib/dates";
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
  Ban,
  Receipt,
} from "lucide-react";

interface ChatFeedProps {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onVoid: (tx: Transaction) => void;
  onRestore: (tx: Transaction) => void;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  transactions,
  onEdit,
  onVoid,
  onRestore,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-secondary">
          <Receipt className="h-5 w-5" aria-hidden="true" />
        </div>
        <h4 className="text-sm font-semibold text-on-surface">
          No entries today
        </h4>
        <p className="mt-1 text-xs text-text-muted">Today’s ledger is clear.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl divide-y divide-border-standard">
        {transactions.map((tx) => {
          const isVoided = tx.status === "voided";
          const isQueued = !tx.created_at; // local queued entries don't have server created_at yet

          const isIncome = tx.type === "income";
          const isExpense = tx.type === "expense";
          const isCapital = tx.type === "capital_in";
          const isWithdrawal = tx.type === "withdrawal";
          const isAdjustment = tx.type === "adjustment";

          const timeStr = formatKarachiTime(tx.device_entry_time);

          const typeTone =
            isIncome ? "text-primary"
            : isExpense ? "text-rose-700"
            : isWithdrawal ? "text-amber-700"
            : isCapital ? "text-blue-700"
            : "text-purple-700";

          return (
            <article
              key={tx.id}
              className={`py-3.5 ${isVoided ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container-low ${typeTone}`}
                  >
                    {isIncome ?
                      <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                    : isExpense ?
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    : isCapital ?
                      <Landmark className="h-4 w-4" aria-hidden="true" />
                    : isWithdrawal ?
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                    : <Scale className="h-4 w-4" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-on-surface">
                        {tx.category_name || tx.type.replace("_", " ")}
                      </h3>
                      {isVoided && (
                        <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          Voided
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                      <span>{tx.created_by_name || "Staff"}</span>
                      <span aria-hidden="true">·</span>
                      <time>{timeStr}</time>
                      {isQueued && (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                          <CloudOff className="h-3 w-3" aria-hidden="true" />{" "}
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p
                  className={`shrink-0 font-mono text-sm font-semibold tabular-nums sm:text-base ${
                    isVoided ? "line-through text-text-muted"
                    : isIncome ? "text-primary"
                    : isExpense ? "text-rose-700"
                    : "text-on-surface"
                  }`}
                >
                  {isExpense ? "−" : ""}
                  {formatPaisa(tx.amount_paisa)}
                </p>
              </div>

              {tx.raw_text && tx.raw_text !== tx.category_name && (
                <p className="ml-12 mt-1 truncate text-xs text-text-muted">
                  {tx.raw_text}
                </p>
              )}
              {tx.note && (
                <p className="ml-12 mt-1 text-xs text-secondary">{tx.note}</p>
              )}

              {isVoided ?
                <div className="ml-12 mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-rose-700">
                    <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Voided: {tx.void_reason}
                  </p>
                  <button
                    onClick={() => onRestore(tx)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-standard bg-white px-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-container-low"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                    Restore
                  </button>
                </div>
              : <div className="ml-12 mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onEdit(tx)}
                    aria-label={`Edit ${tx.category_name || tx.type} transaction`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-standard bg-white px-2.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-container-low"
                  >
                    <Edit2 className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </button>
                  <button
                    onClick={() => onVoid(tx)}
                    aria-label={`Void ${tx.category_name || tx.type} transaction`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-standard bg-white px-2.5 text-xs font-medium text-secondary transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Void
                  </button>
                </div>
              }
            </article>
          );
        })}
      </div>
    </div>
  );
};
