import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { formatPaisa } from '../../lib/money';

interface UndoToastProps {
  transactionId: string;
  categoryName: string;
  amountPaisa: number;
  type: string;
  onUndo: (id: string) => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  transactionId,
  categoryName,
  amountPaisa,
  type,
  onUndo,
  onDismiss,
  durationMs = 6000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remainingPct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationMs, onDismiss]);

  const isExpense = type === 'expense';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="truncate text-sm">
            <span className="font-semibold text-gray-100">{categoryName}</span>{' '}
            <span className={isExpense ? 'text-rose-400 font-mono font-bold' : 'text-emerald-400 font-mono font-bold'}>
              {formatPaisa(amountPaisa)}
            </span>{' '}
            <span className="text-gray-400 text-xs">saved</span>
          </div>
        </div>

        <button
          onClick={() => onUndo(transactionId)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold text-xs rounded-lg border border-gray-600 transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>

      {/* Progress Bar (6-second countdown) */}
      <div className="h-1 bg-gray-800 w-full">
        <div
          className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
