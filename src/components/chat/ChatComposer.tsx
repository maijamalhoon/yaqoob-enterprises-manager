import React, { useState, useRef, useEffect } from 'react';
import { Send, CornerDownLeft, Sparkles } from 'lucide-react';

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type e.g. "PRINT 300" or "PAPER - 2000"...',
  autoFocus = true,
}) => {
  const [text, setText] = useState('');
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
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow up to 120px
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
    <div className="bg-white border-t border-gray-200 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg">
      {/* Quick Category Chips for Fast 1-Tap Entry */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => insertChip('PRINT')}
          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors shrink-0"
        >
          + PRINT
        </button>
        <button
          type="button"
          onClick={() => insertChip('STAMP')}
          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors shrink-0"
        >
          + STAMP
        </button>
        <button
          type="button"
          onClick={() => insertChip('LAMINATION')}
          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors shrink-0"
        >
          + LAMINATION
        </button>
        <button
          type="button"
          onClick={() => insertChip('PAPER - ')}
          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-medium hover:bg-rose-100 transition-colors shrink-0"
        >
          - PAPER
        </button>
        <button
          type="button"
          onClick={() => insertChip('BILL - ')}
          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-medium hover:bg-rose-100 transition-colors shrink-0"
        >
          - BILL
        </button>
        <button
          type="button"
          onClick={() => insertChip('yesterday')}
          className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors shrink-0"
        >
          📅 yesterday
        </button>
      </div>

      {/* Input Row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 min-w-0 relative rounded-2xl border border-gray-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-gray-50/70 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none max-h-32 min-h-[44px]"
          />
        </div>

        {/* Send Button (48px Touch Target for Mobile Ergonomics) */}
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="w-12 h-11 sm:h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center shadow-xs transition-all active:scale-95 shrink-0"
          title="Send (Enter)"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
