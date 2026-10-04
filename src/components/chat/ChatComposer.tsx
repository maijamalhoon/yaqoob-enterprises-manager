import React, { useState, useRef, useEffect } from "react";
import { CalendarDays, Minus, Plus, Send } from "lucide-react";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSend,
  disabled = false,
  placeholder = "Amount and item",
  autoFocus = true,
}) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow up to 120px
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const insertChip = (chipText: string) => {
    setText((prev) => (prev ? `${prev} ${chipText}` : chipText));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="ledger-composer border-t border-border-standard px-3 py-2.5 sm:px-5 sm:py-3">
      {/* Quick Category Chips for Fast 1-Tap Entry */}
      <div className="no-scrollbar mx-auto mb-2 flex w-full max-w-4xl items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => insertChip("PRINT")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Print
        </button>
        <button
          type="button"
          onClick={() => insertChip("STAMP")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Stamp
        </button>
        <button
          type="button"
          onClick={() => insertChip("LAMINATION")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{" "}
          Lamination
        </button>
        <button
          type="button"
          onClick={() => insertChip("PAPER - ")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Minus className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />{" "}
          Paper
        </button>
        <button
          type="button"
          onClick={() => insertChip("BILL - ")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Minus className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />{" "}
          Bill
        </button>
        <button
          type="button"
          onClick={() => insertChip("yesterday")}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-standard bg-white px-3 text-secondary transition-colors hover:bg-surface-container-low"
        >
          <CalendarDays
            className="h-3.5 w-3.5 text-text-muted"
            aria-hidden="true"
          />{" "}
          Yesterday
        </button>
      </div>

      {/* Input Row */}
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-4xl items-end gap-2"
      >
        <div className="ledger-composer__input relative min-w-0 flex-1 rounded-lg border border-border-standard bg-white transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            ref={textareaRef}
            id="ledger-entry"
            aria-describedby="ledger-entry-hint"
            aria-keyshortcuts="Enter Shift+Enter"
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            aria-label="Ledger entry"
            className="max-h-32 min-h-12 w-full resize-none bg-transparent px-3.5 py-3 text-sm text-on-surface placeholder:text-text-muted focus:outline-none sm:text-base"
          />
        </div>

        {/* Send Button (48px Touch Target for Mobile Ergonomics) */}
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-xs transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          title="Send (Enter)"
          aria-label="Send entry"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
      <div
        id="ledger-entry-hint"
        className="mx-auto mt-2 flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-text-muted"
      >
        <span>
          <span className="font-semibold text-secondary">Saved as a draft.</span>{" "}
          Choose an account when you’re ready to update its balance.
        </span>
        <span className="hidden sm:inline">Enter to save · Shift + Enter for a new line</span>
      </div>
    </div>
  );
};
