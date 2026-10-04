import React from "react";
import { DailySummary } from "../../types/ledger";
import { formatPaisa } from "../../lib/money";
import { formatDisplayDate, getKarachiBusinessDate } from "../../lib/dates";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CloudUpload,
  Download,
  TrendingUp,
  WifiOff,
} from "lucide-react";

interface TodayStripProps {
  summary: DailySummary;
  isOnline: boolean;
  queuedCount: number;
  onOpenInstallHelp: () => void;
  onOpenReviewQueue?: () => void;
  reviewCount?: number;
}

export const TodayStrip: React.FC<TodayStripProps> = ({
  summary,
  isOnline,
  queuedCount,
  onOpenInstallHelp,
  onOpenReviewQueue,
  reviewCount = 0,
}) => {
  const todayStr = getKarachiBusinessDate();
  const displayDate = formatDisplayDate(todayStr);

  return (
    <div className="border-b border-border-standard bg-white px-3 py-3 sm:px-5">
      {/* Top Meta Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-on-surface">
            Today ({displayDate})
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-semibold text-secondary">
            {isOnline ?
              queuedCount > 0 ?
                <>
                  <CloudUpload className="h-3 w-3 text-amber-700" />
                  Sync pending ({queuedCount})
                </>
              : <>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Online
                </>

            : <>
                <WifiOff className="h-3 w-3 text-amber-700" />
                Offline ({queuedCount} queued)
              </>
            }
          </span>
        </div>

        <div className="flex items-center gap-2">
          {reviewCount > 0 && onOpenReviewQueue && (
            <button
              onClick={onOpenReviewQueue}
              className="flex min-h-9 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              Review queue: <span className="font-bold">{reviewCount}</span>
            </button>
          )}

          <button
            onClick={onOpenInstallHelp}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-standard bg-white px-2 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-container-low"
            title="Install App as PWA"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Install
          </button>
        </div>
      </div>

      {/* 3 Metric Cards: Income, Expense, Net Profit */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Income Card */}
        <div className="summary-metric flex flex-col justify-between">
          <div className="summary-metric__label flex items-center justify-between">
            <span>Income</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <div className="summary-metric__value font-mono tabular-nums">
            {formatPaisa(summary.income_paisa)}
          </div>
        </div>

        {/* Expense Card */}
        <div className="summary-metric flex flex-col justify-between">
          <div className="summary-metric__label flex items-center justify-between">
            <span>Expenses</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <div className="summary-metric__value font-mono tabular-nums">
            {formatPaisa(summary.expense_paisa)}
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="summary-metric flex flex-col justify-between">
          <div className="summary-metric__label flex items-center justify-between">
            <span>Net Profit</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div
            className={`summary-metric__value font-mono tabular-nums ${
              summary.net_profit_paisa < 0 ? "text-danger" : ""
            }`}
          >
            {formatPaisa(summary.net_profit_paisa)}
          </div>
        </div>
      </div>

      {/* Capital / Withdrawal Strip (if any exists today) */}
      {(summary.capital_in_paisa > 0 || summary.withdrawal_paisa > 0) && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <div>
            Capital In:{" "}
            <span className="font-semibold text-gray-700 font-mono">
              {formatPaisa(summary.capital_in_paisa)}
            </span>
          </div>
          <div>
            Withdrawals:{" "}
            <span className="font-semibold text-gray-700 font-mono">
              {formatPaisa(summary.withdrawal_paisa)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
