import React, { useState, useEffect, useRef } from "react";
import { Send, CornerDownLeft, X } from "lucide-react";
import { ledgerService } from "../../services/ledgerService";
import { parseMessage, ParseResult, ClarificationOption } from "../../parser";
import { LedgerAccount } from "../../types/ledger";
import { useAuth } from "../../context/AuthContext";
import { UndoToast } from "./UndoToast";
import { ConfirmationModal } from "./ConfirmationModal";

interface QuickEntryBarProps {
  onTransactionSaved?: () => void;
}

export const QuickEntryBar: React.FC<QuickEntryBarProps> = ({
  onTransactionSaved,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id || "offline-user";
  const currentUserName =
    user?.full_name || user?.email?.split("@")[0] || "Shop Brother";

  const [text, setText] = useState("");
  const [activeClarification, setActiveClarification] =
    useState<ParseResult | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [undoState, setUndoState] = useState<{
    transactionId: string;
    categoryName: string;
    amountPaisa: number;
    type: string;
    updatedAt: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ledgerService
      .getPaymentAccounts()
      .then(setAccounts)
      .catch((err) =>
        console.error("Could not load quick-entry accounts:", err),
      );
  }, []);

  // Keyboard shortcut listener: "/" focuses input, "Esc" clears it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input or textarea
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) &&
        target !== inputRef.current
      ) {
        return;
      }

      if (e.key === "/" && target !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && target === inputRef.current) {
        e.preventDefault();
        setText("");
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const executeSave = async (
    entry: ParseResult,
    chosenOption?: ClarificationOption,
    accountId = selectedAccountId,
  ) => {
    if (!accountId) return;
    const type = chosenOption ? chosenOption.type : entry.type;
    const categoryId =
      chosenOption ? chosenOption.categoryId : entry.categoryId;
    const categoryName =
      chosenOption ?
        chosenOption.categoryName || entry.categoryName || type
      : entry.categoryName || type;
    const amountPaisa =
      chosenOption ? chosenOption.amountPaisa : entry.amountPaisa!;

    try {
      const res = await ledgerService.recordTransaction(
        {
          type,
          categoryId,
          categoryName,
          accountId,
          amountPaisa,
          businessDate: entry.businessDate,
          rawText: entry.raw,
          createdByName: currentUserName,
          note: entry.note,
        },
        currentUserId,
      );

      setText("");
      if (res.transaction.id) {
        setUndoState({
          transactionId: res.transaction.id,
          categoryName,
          amountPaisa,
          type,
          updatedAt: res.transaction.updated_at || new Date().toISOString(),
        });
      }
      onTransactionSaved?.();
    } catch (err) {
      console.error("Quick entry save error:", err);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedAccountId) return;

    const categories = await ledgerService.getParserCategories();
    if (categories.length === 0) return;
    const parsed = parseMessage(trimmed, [], new Date(), categories);
    if (parsed.entries.length > 0) {
      const entry = parsed.entries[0];
      if (entry.canAutoSave) {
        executeSave(entry);
      } else {
        setActiveClarification(entry);
      }
    }
  };

  return (
    <>
      <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs w-full max-w-lg transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10">
        <span className="text-gray-400 text-xs font-mono font-medium bg-gray-200/70 px-1.5 py-0.5 rounded border border-gray-300">
          /
        </span>
        <select
          aria-label="Quick entry account"
          value={selectedAccountId}
          onChange={(event) => setSelectedAccountId(event.target.value)}
          className="max-w-32 min-w-20 rounded border border-border-standard bg-white px-1.5 py-1 text-[11px] text-secondary"
        >
          <option value="">Account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Quick entry"
          aria-label="Quick ledger entry"
          className="flex-1 bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        {text && (
          <button
            onClick={() => setText("")}
            className="text-gray-400 hover:text-gray-600 p-0.5"
            title="Clear (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!text.trim() || !selectedAccountId}
          className="px-2 py-1 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1"
        >
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Undo Toast */}
      {undoState && (
        <UndoToast
          transactionId={undoState.transactionId}
          categoryName={undoState.categoryName}
          amountPaisa={undoState.amountPaisa}
          type={undoState.type}
          onUndo={async (id) => {
            await ledgerService.voidTransaction(
              id,
              "Quick entry undo",
              undoState.updatedAt,
            );
            setUndoState(null);
            onTransactionSaved?.();
          }}
          onDismiss={() => setUndoState(null)}
        />
      )}

      {/* Confirmation Modal */}
      {activeClarification && (
        <ConfirmationModal
          result={activeClarification}
          onConfirmSingle={(entry, opt) => {
            setActiveClarification(null);
            executeSave(entry, opt);
          }}
          onConfirmBatch={() => {}}
          onSkipToReview={async (raw, reason) => {
            setActiveClarification(null);
            await ledgerService.parkInReviewQueue(raw, reason, currentUserId);
            setText("");
          }}
          onCancel={() => setActiveClarification(null)}
        />
      )}
    </>
  );
};
