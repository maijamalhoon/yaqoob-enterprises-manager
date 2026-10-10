import React, { useState, useEffect, useRef } from "react";
import { CornerDownLeft, X } from "lucide-react";
import { ledgerService } from "../../services/ledgerService";
import { parseMessage, ParseResult, SeedCategory } from "../../parser";
import { LedgerAccount } from "../../types/ledger";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { ConfirmationModal } from "./ConfirmationModal";

interface QuickEntryBarProps {
  onTransactionSaved?: () => void;
}

export const QuickEntryBar: React.FC<QuickEntryBarProps> = ({
  onTransactionSaved,
}) => {
  const { user } = useAuth();
  const { showToast } = useApp();
  const currentUserId = user?.id || "offline-user";
  const currentUserName =
    user?.full_name || user?.email?.split("@")[0] || "Shop Brother";

  const [text, setText] = useState("");
  const [activeClarification, setActiveClarification] =
    useState<ParseResult | null>(null);
  const [batchEntries, setBatchEntries] = useState<ParseResult[] | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [categories, setCategories] = useState<SeedCategory[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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
    accountId: string,
  ) => {
    try {
      if (entry.amountPaisa === null) throw new Error("A valid amount is required.");
      const draft = await ledgerService.createTransactionDraft(
        {
          type: entry.type,
          categoryId: entry.categoryId,
          categoryName: entry.categoryName || entry.type,
          amountPaisa: entry.amountPaisa,
          adjustmentDir: entry.adjustmentDir,
          businessDate: entry.businessDate,
          rawText: entry.raw,
          createdByName: currentUserName,
          note: entry.note,
        },
        currentUserId,
      );
      const result = await ledgerService.postTransactionDraft(draft.id, accountId);

      if (result.isQueuedOffline) {
        showToast(
          "warning",
          "Posting queued offline",
          "Your entry is retained and will post to the selected account after synchronization.",
        );
      } else {
        showToast("success", "Transaction posted");
      }
      return true;
    } catch (err) {
      console.error("Quick entry posting error:", err);
      showToast(
        "error",
        "Transaction not posted",
        err instanceof Error ? err.message : "Check the entry and try again.",
      );
      return false;
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const categories = await ledgerService.getParserCategories();
    if (categories.length === 0) return;
    const parsed = parseMessage(trimmed, [], new Date(), categories);
    const availableAccounts = await ledgerService.getPaymentAccounts();
    setCategories(categories);
    setAccounts(availableAccounts);
    if (parsed.isBatch) {
      setBatchError(null);
      setBatchEntries(parsed.entries);
      return;
    }
    if (parsed.entries.length > 0) {
      setActiveClarification(parsed.entries[0]);
    }
  };

  return (
    <>
      <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs w-full max-w-lg transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10">
        <span className="text-gray-400 text-xs font-mono font-medium bg-gray-200/70 px-1.5 py-0.5 rounded border border-gray-300">
          /
        </span>
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
          disabled={!text.trim()}
          className="px-2 py-1 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1"
        >
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Confirmation Modal */}
      {(activeClarification || batchEntries) && (
        <ConfirmationModal
          result={activeClarification}
          batchEntries={batchEntries || undefined}
          accounts={accounts}
          categories={categories}
          batchError={batchError}
          isSavingBatch={isSavingBatch}
          onConfirmSingle={async (entry, accountId) => {
            if (await executeSave(entry, accountId)) {
              setActiveClarification(null);
              setText("");
              onTransactionSaved?.();
            } else {
              throw new Error("Quick entry could not be posted.");
            }
          }}
          onConfirmBatch={async (entries, accountIds) => {
            const failed: ParseResult[] = [];
            setIsSavingBatch(true);
            setBatchError(null);
            try {
              for (const [index, entry] of entries.entries()) {
                if (!(await executeSave(entry, accountIds[index]))) failed.push(entry);
              }
            } finally {
              setIsSavingBatch(false);
            }
            if (failed.length) {
              setBatchEntries(failed);
              setBatchError(`${entries.length - failed.length} saved; ${failed.length} failed. Only failed entries are shown for retry.`);
              return;
            }
            setBatchEntries(null);
            setText("");
            onTransactionSaved?.();
          }}
          onSkipToReview={async (raw, reason) => {
            setActiveClarification(null);
            await ledgerService.parkInReviewQueue(raw, reason, currentUserId);
            setText("");
          }}
          onCancel={() => {
            setActiveClarification(null);
            setBatchEntries(null);
          }}
        />
      )}
    </>
  );
};
