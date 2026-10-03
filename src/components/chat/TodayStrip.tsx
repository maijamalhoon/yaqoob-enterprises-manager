import React from 'react';
import { DailySummary } from '../../types/ledger';
import { formatPaisa } from '../../lib/money';
import { formatDisplayDate, getKarachiBusinessDate } from '../../lib/dates';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wifi, WifiOff } from 'lucide-react';

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
    <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-xs">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">Today ({displayDate})</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <Wifi className="w-3 h-3 text-emerald-600" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                Offline ({queuedCount} queued)
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {reviewCount > 0 && onOpenReviewQueue && (
            <button
              onClick={onOpenReviewQueue}
              className="flex items-center gap-1 text-[11px] px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-medium hover:bg-amber-100 transition-colors"
            >
              Review queue: <span className="font-bold">{reviewCount}</span>
            </button>
          )}

          <button
            onClick={onOpenInstallHelp}
            className="text-[11px] px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium transition-colors"
            title="Install App as PWA"
          >
            📲 Install
          </button>
        </div>
      </div>

      {/* 3 Metric Cards: Income, Expense, Net Profit */}
      <div className="grid grid-cols-3 gap-2">
        {/* Income Card */}
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>Income</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-emerald-900 tracking-tight font-mono">
            {formatPaisa(summary.income_paisa)}
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 text-xs font-medium">
            <span>Expenses</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-rose-900 tracking-tight font-mono">
            {formatPaisa(summary.expense_paisa)}
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
            <span>Net Profit</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div
            className={`mt-1 text-base sm:text-lg font-bold tracking-tight font-mono ${
              summary.net_profit_paisa >= 0 ? 'text-blue-900' : 'text-rose-900'
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
            Capital In: <span className="font-semibold text-gray-700 font-mono">{formatPaisa(summary.capital_in_paisa)}</span>
          </div>
          <div>
            Withdrawals: <span className="font-semibold text-gray-700 font-mono">{formatPaisa(summary.withdrawal_paisa)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
