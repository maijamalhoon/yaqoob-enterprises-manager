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
    <div className="workspace-page flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header / Switcher */}
      <div className="workspace-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Overview
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Your business at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-border-standard bg-surface-container-low p-1">
            <button
              onClick={() => setPeriod("day")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                period === "day" ?
                  "bg-white text-on-surface shadow-xs"
                : "text-secondary hover:text-on-surface"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                period === "month" ?
                  "bg-white text-on-surface shadow-xs"
                : "text-secondary hover:text-on-surface"
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Picker */}
          <div className="workspace-control flex items-center gap-1.5 bg-white px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
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
              className="bg-transparent font-medium text-on-surface focus:outline-none"
            />
          </div>

          <button
            onClick={loadData}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-standard bg-white text-secondary hover:bg-surface-container-low"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main Financial Cards: Income, Expense, Net Profit */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Income */}
        <div className="dashboard-metric dashboard-metric--income flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="dashboard-metric__label">Income</span>
            <ArrowDownLeft className="dashboard-metric__icon h-5 w-5" />
          </div>
          <div className="mt-4">
            <div className="dashboard-metric__value font-mono tabular-nums">
              {formatPaisa(activeIncome)}
            </div>
            <div className="dashboard-metric__note hidden sm:block">
              All recorded income
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="dashboard-metric dashboard-metric--expense flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="dashboard-metric__label">Expenses</span>
            <ArrowUpRight className="dashboard-metric__icon h-5 w-5" />
          </div>
          <div className="mt-4">
            <div className="dashboard-metric__value font-mono tabular-nums">
              {formatPaisa(activeExpense)}
            </div>
            <div className="dashboard-metric__note hidden sm:block">
              All recorded expenses
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="dashboard-metric dashboard-metric--profit flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="dashboard-metric__label">Net profit</span>
            <TrendingUp className="dashboard-metric__icon h-5 w-5" />
          </div>
          <div className="mt-4">
            <div
              className={`dashboard-metric__value font-mono tabular-nums ${
                activeProfit < 0 ? "text-danger" : ""
              }`}
            >
              {formatPaisa(activeProfit)}
            </div>
            <div className="dashboard-metric__note hidden sm:block">
              Income less expenses
            </div>
          </div>
        </div>
      </div>

      {/* Non-Operating Activities (Capital, Withdrawals, Adjustments) */}
      <div className="workspace-panel space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-border-standard pb-3">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">
              Other cash flows
            </h3>
            <p className="text-xs text-text-muted">
              Owner activity, shown separately from profit.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4 sm:gap-3">
          <div className="flex flex-col justify-between rounded-lg border border-border-standard bg-surface-container-low/60 p-3">
            <div className="flex items-center gap-1.5 font-medium text-secondary">
              <Landmark className="h-3.5 w-3.5 text-primary" />
              <span>Capital In</span>
            </div>
            <div className="mt-2 font-mono text-sm font-bold text-on-surface">
              {formatPaisa(activeCapital)}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border-standard bg-surface-container-low/60 p-3">
            <div className="flex items-center gap-1.5 font-medium text-secondary">
              <Wallet className="h-3.5 w-3.5 text-tertiary" />
              <span>Withdrawals</span>
            </div>
            <div className="mt-2 font-mono text-sm font-bold text-on-surface">
              {formatPaisa(activeWithdrawal)}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border-standard bg-surface-container-low/60 p-3">
            <div className="flex items-center gap-1.5 font-medium text-secondary">
              <Scale className="h-3.5 w-3.5 text-secondary" />
              <span>Adjustment (+)</span>
            </div>
            <div className="mt-2 font-mono text-sm font-bold text-on-surface">
              {formatPaisa(activeAdjIn)}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border-standard bg-surface-container-low/60 p-3">
            <div className="flex items-center gap-1.5 font-medium text-secondary">
              <Scale className="h-3.5 w-3.5 text-secondary" />
              <span>Adjustment (-)</span>
            </div>
            <div className="mt-2 font-mono text-sm font-bold text-on-surface">
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
