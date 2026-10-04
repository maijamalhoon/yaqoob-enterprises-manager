import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../lib/supabase";
import { getKarachiBusinessDate } from "../../lib/dates";
import { formatPaisa } from "../../lib/money";
import {
  DailySummary,
  MonthlySummary,
  CategoryBreakdown,
} from "../../types/ledger";
import {
  Calendar,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Wallet,
  Scale,
  RefreshCw,
  PieChart,
} from "lucide-react";

export const LedgerDashboardView: React.FC = () => {
  const [period, setPeriod] = useState<"day" | "month" | "year">("day");
  const [currentDate, setCurrentDate] = useState(getKarachiBusinessDate());
  const [isLoading, setIsLoading] = useState(true);

  const [dailyData, setDailyData] = useState<DailySummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary | null>(null);
  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();
    try {
      if (period === "day") {
        const { data } = await supabase
          .from("view_daily_summary")
          .select("*")
          .eq("business_date", currentDate)
          .maybeSingle();

        if (data) {
          setDailyData({
            business_date: data.business_date,
            income_paisa: Number(data.income_paisa || 0),
            expense_paisa: Number(data.expense_paisa || 0),
            net_profit_paisa: Number(data.net_profit_paisa || 0),
            capital_in_paisa: Number(data.capital_in_paisa || 0),
            withdrawal_paisa: Number(data.withdrawal_paisa || 0),
            adjustment_in_paisa: Number(data.adjustment_in_paisa || 0),
            adjustment_out_paisa: Number(data.adjustment_out_paisa || 0),
            transaction_count: Number(data.transaction_count || 0),
          });
        } else {
          setDailyData(null);
        }

        const { data: bData } = await supabase
          .from("view_category_breakdown")
          .select("*")
          .eq("business_date", currentDate);
        setBreakdowns(bData || []);
      } else {
        const year = parseInt(currentDate.split("-")[0], 10);
        const month = parseInt(currentDate.split("-")[1], 10);

        const { data } = await supabase
          .from("view_monthly_summary")
          .select("*")
          .eq("year", year)
          .eq("month", month)
          .maybeSingle();

        if (data) {
          setMonthlyData({
            month_start: data.month_start,
            year: data.year,
            month: data.month,
            income_paisa: Number(data.income_paisa || 0),
            expense_paisa: Number(data.expense_paisa || 0),
            net_profit_paisa: Number(data.net_profit_paisa || 0),
            capital_in_paisa: Number(data.capital_in_paisa || 0),
            withdrawal_paisa: Number(data.withdrawal_paisa || 0),
            adjustment_in_paisa: Number(data.adjustment_in_paisa || 0),
            adjustment_out_paisa: Number(data.adjustment_out_paisa || 0),
          });
        } else {
          setMonthlyData(null);
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard summary views:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, currentDate]);

  const activeIncome =
    period === "day" ?
      dailyData?.income_paisa || 0
    : monthlyData?.income_paisa || 0;
  const activeExpense =
    period === "day" ?
      dailyData?.expense_paisa || 0
    : monthlyData?.expense_paisa || 0;
  const activeProfit =
    period === "day" ?
      dailyData?.net_profit_paisa || 0
    : monthlyData?.net_profit_paisa || 0;

  const activeCapital =
    period === "day" ?
      dailyData?.capital_in_paisa || 0
    : monthlyData?.capital_in_paisa || 0;
  const activeWithdrawal =
    period === "day" ?
      dailyData?.withdrawal_paisa || 0
    : monthlyData?.withdrawal_paisa || 0;
  const activeAdjIn =
    period === "day" ?
      dailyData?.adjustment_in_paisa || 0
    : monthlyData?.adjustment_in_paisa || 0;
  const activeAdjOut =
    period === "day" ?
      dailyData?.adjustment_out_paisa || 0
    : monthlyData?.adjustment_out_paisa || 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header / Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Ledger Overview
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Income, expenses and owner cash flows for the selected period.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              onClick={() => setPeriod("day")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "day" ?
                  "bg-white text-gray-900 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === "month" ?
                  "bg-white text-gray-900 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <input
              type={period === "day" ? "date" : "month"}
              value={period === "day" ? currentDate : currentDate.slice(0, 7)}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(
                    period === "day" ? e.target.value : `${e.target.value}-01`,
                  );
                }
              }}
              className="focus:outline-none text-gray-800 font-medium"
            />
          </div>

          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main Financial Cards: Income, Expense, Net Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Income
            </span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-mono tracking-tight">
              {formatPaisa(activeIncome)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              From printing, stamp papers, & services
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Expenses
            </span>
            <ArrowUpRight className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-950 font-mono tracking-tight">
              {formatPaisa(activeExpense)}
            </div>
            <div className="text-[11px] text-rose-700 mt-1">
              Paper stock, supplies, bills & stamps
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Net Profit
            </span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                activeProfit >= 0 ? "text-blue-950" : "text-rose-900"
              }`}
            >
              {formatPaisa(activeProfit)}
            </div>
            <div className="text-[11px] text-blue-700 mt-1">
              Profit = Income - Expense (P&L Invariant)
            </div>
          </div>
        </div>
      </div>

      {/* Non-Operating Activities (Capital, Withdrawals, Adjustments) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Non-Operating Cash Flows
            </h3>
            <p className="text-xs text-gray-400">
              Owner funds and adjustments are shown separately from operating
              profit.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
              <Landmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Capital In</span>
            </div>
            <div className="mt-2 text-base font-bold text-gray-900 font-mono">
              {formatPaisa(activeCapital)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              <span>Withdrawals</span>
            </div>
            <div className="mt-2 text-base font-bold text-gray-900 font-mono">
              {formatPaisa(activeWithdrawal)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
              <Scale className="w-3.5 h-3.5 text-purple-600" />
              <span>Adjustment (+)</span>
            </div>
            <div className="mt-2 text-base font-bold text-gray-900 font-mono">
              {formatPaisa(activeAdjIn)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
              <Scale className="w-3.5 h-3.5 text-purple-600" />
              <span>Adjustment (-)</span>
            </div>
            <div className="mt-2 text-base font-bold text-gray-900 font-mono">
              {formatPaisa(activeAdjOut)}
            </div>
          </div>
        </div>
      </div>

      {/* Service-wise Breakdown (For Day period) */}
      {period === "day" && breakdowns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Service-wise Breakdown
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {breakdowns.map((b, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-gray-800">
                    {b.category_name}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {b.entry_count} entries •{" "}
                    <span className="uppercase">{b.type}</span>
                  </div>
                </div>
                <div className="font-mono font-bold text-sm text-gray-900">
                  {formatPaisa(Number(b.total_paisa || 0))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
