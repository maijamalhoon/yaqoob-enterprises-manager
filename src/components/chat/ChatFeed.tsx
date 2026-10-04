import React, { useState } from "react";
import { LedgerAccount, Transaction, TransactionDraft } from "../../types/ledger";
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
  Check,
} from "lucide-react";

interface ChatFeedProps {
  transactions: Transaction[];
  drafts: TransactionDraft[];
  accounts: LedgerAccount[];
  onEdit: (tx: Transaction) => void;
  onVoid: (tx: Transaction) => void;
  onRestore: (tx: Transaction) => void;
  onAssignDraft: (draft: TransactionDraft, accountId: string) => Promise<void>;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  transactions,
  drafts,
  accounts,
  onEdit,
  onVoid,
  onRestore,
  onAssignDraft,
}) => {
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [savingDraftIds, setSavingDraftIds] = useState<Set<string>>(new Set());

  const assignDraft = async (draft: TransactionDraft) => {
    const accountId = selectedAccounts[draft.id] || draft.pending_account_id || "";
    if (!accountId || savingDraftIds.has(draft.id)) return;
    setSavingDraftIds((current) => new Set(current).add(draft.id));
    try {
      await onAssignDraft(draft, accountId);
    } finally {
      setSavingDraftIds((current) => {
        const next = new Set(current);
        next.delete(draft.id);
        return next;
      });
    }
  };

  if (transactions.length === 0 && drafts.length === 0) {
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
        {drafts.length > 0 && (
          <section className="space-y-2 py-4" aria-labelledby="drafts-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="drafts-heading" className="text-sm font-semibold text-on-surface">
                  Needs an account
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  These entries are saved, but have not changed any account balance yet.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {drafts.length} pending
              </span>
            </div>
            <div className="space-y-2">
              {drafts.map((draft) => {
                const isExpense = draft.type === "expense" || draft.type === "withdrawal";
                const selectedAccountId = selectedAccounts[draft.id] || draft.pending_account_id || "";
                const isSaving = savingDraftIds.has(draft.id);
                return (
                  <article
                    key={draft.id}
                    className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                            {draft.type.replace("_", " ")}
                          </span>
                          <span className="text-xs text-text-muted">
                            {draft.created_by_name} · {formatKarachiTime(draft.device_entry_time)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-on-surface">
                          {draft.category_name || draft.type.replace("_", " ")}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-secondary">
                          {draft.raw_text}
                        </p>
                        {draft.note && (
                          <p className="mt-1 text-xs text-text-muted">{draft.note}</p>
                        )}
                      </div>
                      <p className={`shrink-0 font-mono text-sm font-bold tabular-nums ${isExpense ? "text-rose-700" : "text-primary"}`}>
                        {isExpense ? "−" : "+"}{formatPaisa(draft.amount_paisa)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Account for ${draft.category_name || draft.type} entry`}
                        value={selectedAccountId}
                        onChange={(event) => setSelectedAccounts((current) => ({
                          ...current,
                          [draft.id]: event.target.value,
                        }))}
                        disabled={isSaving || accounts.length === 0}
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-border-standard bg-white px-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                      >
                        <option value="">Select account to post</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.type.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void assignDraft(draft)}
                        disabled={!selectedAccountId || isSaving}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {isSaving ? "Posting…" : "Post to account"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
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
