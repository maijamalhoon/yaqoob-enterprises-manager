import React, { useState } from "react";
import { ParseResult, ClarificationOption } from "../../parser";
import { formatPaisa } from "../../lib/money";
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Layers,
  X,
} from "lucide-react";

interface ConfirmationModalProps {
  result: ParseResult | null;
  batchEntries?: ParseResult[];
  onConfirmSingle: (
    entry: ParseResult,
    chosenOption?: ClarificationOption,
  ) => void;
  onConfirmBatch: (entries: ParseResult[]) => void;
  batchError?: string | null;
  isSavingBatch?: boolean;
  onSkipToReview: (rawText: string, reason: string) => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  result,
  batchEntries,
  onConfirmSingle,
  onConfirmBatch,
  batchError,
  isSavingBatch = false,
  onSkipToReview,
  onCancel,
}) => {
  const isBatch = Boolean(batchEntries && batchEntries.length > 1);
  const [selectedOption, setSelectedOption] =
    useState<ClarificationOption | null>(null);

  if (!result && !isBatch) return null;

  // Single Entry Clarification / Confirmation
  if (!isBatch && result) {
    const isConflict = result.isConflict;
    const isUnusual = result.isUnusualAmount;
    const isDuplicate = result.isDuplicate;
    const isFuzzy = result.isFuzzyOrPhonetic;
    const isBare = result.options && result.options.length === 5;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isUnusual || isDuplicate ?
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              : isConflict ?
                <AlertCircle className="w-5 h-5 text-rose-500" />
              : <HelpCircle className="w-5 h-5 text-blue-500" />}
              <h3 className="font-semibold text-gray-900 text-base">
                {isConflict ?
                  "Sign / Category Conflict"
                : isUnusual ?
                  "Unusual Amount Warning"
                : isDuplicate ?
                  "Duplicate Check"
                : isFuzzy ?
                  "Did You Mean?"
                : isBare ?
                  "Classify Bare Number"
                : "Confirm Transaction"}
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Raw Message Card */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 block mb-1">
                Typed Message
              </span>
              <div className="font-mono text-gray-800 font-semibold text-base">
                {result.raw}
              </div>
            </div>

            {/* Explanation or Prompt */}
            {result.clarificationPrompt && (
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                {result.clarificationPrompt}
              </p>
            )}

            {result.reason && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{result.reason}</span>
              </div>
            )}

            {/* Options List (if clarification needed) */}
            {result.options && result.options.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Select Classification:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {result.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(opt)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between text-sm ${
                        selectedOption === opt ?
                          "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-500/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800"
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono text-xs text-gray-500 font-semibold">
                        {formatPaisa(opt.amountPaisa)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            <button
              onClick={() =>
                onSkipToReview(
                  result.raw,
                  result.reason ||
                    result.clarificationPrompt ||
                    "Skipped by user",
                )
              }
              className="text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 px-3 py-2 rounded-lg transition-colors"
            >
              Skip for now
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  onConfirmSingle(result, selectedOption || undefined)
                }
                disabled={Boolean(
                  result.options &&
                  result.options.length > 0 &&
                  !selectedOption,
                )}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Batch Multi-Line Preview Card
  if (isBatch && batchEntries) {
    const hasIssues = batchEntries.some(
      (e) =>
        e.action === "ask_clarification" || e.action === "needs_confirmation",
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900 text-base">
                Batch Entry Preview ({batchEntries.length} entries)
              </h3>
            </div>
            <button
              onClick={onCancel}
              disabled={isSavingBatch}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of Entries */}
          <div className="p-5 overflow-y-auto space-y-2.5">
            {batchError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              >
                {batchError}
              </p>
            )}
            {batchEntries.map((e, idx) => {
              const isError = e.action === "ask_clarification";
              const isWarn = e.action === "needs_confirmation";
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-sm ${
                    isError ? "border-rose-300 bg-rose-50/50"
                    : isWarn ? "border-amber-300 bg-amber-50/50"
                    : "border-emerald-200 bg-emerald-50/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-gray-800 truncate">
                      {e.raw}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {isError ?
                        <span className="text-rose-600 font-medium">
                          Needs clarification
                        </span>
                      : isWarn ?
                        <span className="text-amber-600 font-medium">
                          {e.reason || "Needs confirmation"}
                        </span>
                      : <span className="text-emerald-700 font-medium">
                          {e.categoryName} ({e.type})
                        </span>
                      }
                    </div>
                  </div>

                  <div className="font-mono font-bold text-gray-900 shrink-0">
                    {e.amountPaisa ? formatPaisa(e.amountPaisa) : "-"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={onCancel}
              disabled={isSavingBatch}
              className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg"
            >
              Cancel
            </button>

            <button
              onClick={() => onConfirmBatch(batchEntries)}
              disabled={hasIssues || isSavingBatch}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              {isSavingBatch ?
                "Saving..."
              : hasIssues ?
                "Fix Flagged Lines First"
              : batchError ?
                `Retry ${batchEntries.length} Failed Entries`
              : "Save All Entries"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
