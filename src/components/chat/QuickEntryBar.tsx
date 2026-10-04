import React, { useState, useEffect, useRef } from "react";
import { CornerDownLeft, X } from "lucide-react";
import { ledgerService } from "../../services/ledgerService";
import { parseMessage, ParseResult, ClarificationOption } from "../../parser";
import { useAuth } from "../../context/AuthContext";
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
    chosenOption?: ClarificationOption,
  ) => {
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
      await ledgerService.createTransactionDraft(
        {
          type,
          categoryId,
          categoryName,
          amountPaisa,
          businessDate: entry.businessDate,
          rawText: entry.raw,
          createdByName: currentUserName,
          note: entry.note,
        },
        currentUserId,
      );

      setText("");
      onTransactionSaved?.();
    } catch (err) {
      console.error("Quick entry save error:", err);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

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
