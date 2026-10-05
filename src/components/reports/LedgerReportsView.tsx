import React, { useState, useEffect } from "react";
import { ledgerService } from "../../services/ledgerService";
import { formatPaisa } from "../../lib/money";
import { getKarachiBusinessDate } from "../../lib/dates";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

interface MonthlyReportRow {
  month_start: string;
  year: number;
  month: number;
  income_paisa: number;
  expense_paisa: number;
  net_profit_paisa: number;
  capital_in_paisa: number;
  withdrawal_paisa: number;
  adjustment_in_paisa: number;
  adjustment_out_paisa: number;
}

export const LedgerReportsView: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await ledgerService.getMonthlyReport(selectedYear);
      setMonthlyData(
        data.map((row) => ({
          month_start: row.month_start,
          year: row.year,
          month: row.month,
          income_paisa: Number(row.income_paisa || 0),
          expense_paisa: Number(row.expense_paisa || 0),
          net_profit_paisa: Number(row.net_profit_paisa || 0),
          capital_in_paisa: Number(row.capital_in_paisa || 0),
          withdrawal_paisa: Number(row.withdrawal_paisa || 0),
          adjustment_in_paisa: Number(row.adjustment_in_paisa || 0),
          adjustment_out_paisa: Number(row.adjustment_out_paisa || 0),
        })),
      );
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const totalAnnualIncome = monthlyData.reduce(
    (acc, m) => acc + m.income_paisa,
    0,
  );
  const totalAnnualExpense = monthlyData.reduce(
    (acc, m) => acc + m.expense_paisa,
    0,
  );
  const totalAnnualProfit = totalAnnualIncome - totalAnnualExpense;

  return (
    <div className="workspace-page flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="workspace-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Reports
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Monthly income, expenses, and cash flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="workspace-control bg-white px-3 py-2 text-xs font-semibold"
          >
            {[
              currentYear - 2,
              currentYear - 1,
              currentYear,
              currentYear + 1,
            ].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

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

      {/* Annual Summary Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="dashboard-metric dashboard-metric--income flex flex-col justify-between">
          <div className="dashboard-metric__label">
            Income · {selectedYear}
          </div>
          <div className="dashboard-metric__value mt-2 font-mono tabular-nums">
            {formatPaisa(totalAnnualIncome)}
          </div>
        </div>

        <div className="dashboard-metric dashboard-metric--expense flex flex-col justify-between">
          <div className="dashboard-metric__label">
            Expenses · {selectedYear}
          </div>
          <div className="dashboard-metric__value mt-2 font-mono tabular-nums">
            {formatPaisa(totalAnnualExpense)}
          </div>
        </div>

        <div className="dashboard-metric dashboard-metric--profit flex flex-col justify-between">
          <div className="dashboard-metric__label">
            Net profit · {selectedYear}
          </div>
          <div
            className={`dashboard-metric__value mt-2 font-mono tabular-nums ${
              totalAnnualProfit < 0 ? "text-danger" : ""
            }`}
          >
            {formatPaisa(totalAnnualProfit)}
          </div>
        </div>
      </div>

      {/* Month-by-Month Table */}
      <div className="workspace-panel">
        <div className="workspace-panel-heading flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-on-surface">
            Monthly Breakdown
          </h3>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="data-table w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Expenses</th>
                <th className="px-4 py-3 text-right">Net Profit</th>
                <th className="px-4 py-3 text-right">Capital In</th>
                <th className="px-4 py-3 text-right">Withdrawals</th>
                <th className="px-4 py-3 text-right">Net Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {monthlyData.length === 0 ?
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400 font-sans"
                  >
                    No transactions recorded for year {selectedYear}.
                  </td>
                </tr>
              : monthlyData.map((row) => {
                  const mName =
                    monthNames[row.month - 1] || `Month ${row.month}`;
                  const netAdj =
                    row.adjustment_in_paisa - row.adjustment_out_paisa;

                  return (
                    <tr
                      key={row.month}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-sans font-semibold text-gray-900">
                        {mName} {row.year}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                        {formatPaisa(row.income_paisa)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-700 font-bold">
                        {formatPaisa(row.expense_paisa)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-extrabold ${
                          row.net_profit_paisa >= 0 ?
                            "text-blue-900"
                          : "text-rose-900"
                        }`}
                      >
                        {formatPaisa(row.net_profit_paisa)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.capital_in_paisa > 0 ?
                          formatPaisa(row.capital_in_paisa)
                        : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.withdrawal_paisa > 0 ?
                          formatPaisa(row.withdrawal_paisa)
                        : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {netAdj !== 0 ? formatPaisa(netAdj) : "-"}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border-standard lg:hidden">
          {monthlyData.length === 0 ?
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              No transactions recorded for {selectedYear}.
            </p>
          : monthlyData.map((row) => {
              const monthName =
                monthNames[row.month - 1] || `Month ${row.month}`;
              const netAdjustment =
                row.adjustment_in_paisa - row.adjustment_out_paisa;

              return (
                <article key={row.month} className="px-3 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold text-on-surface">
                      {monthName} {row.year}
                    </h4>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase text-text-muted">
                        Net profit
                      </p>
                      <p
                        className={`font-mono text-sm font-bold tabular-nums ${row.net_profit_paisa >= 0 ? "text-blue-900" : "text-rose-900"}`}
                      >
                        {formatPaisa(row.net_profit_paisa)}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <dt className="text-[10px] font-medium text-text-muted">
                        Income
                      </dt>
                      <dd className="font-mono text-xs font-semibold text-primary">
                        {formatPaisa(row.income_paisa)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium text-text-muted">
                        Expenses
                      </dt>
                      <dd className="font-mono text-xs font-semibold text-rose-700">
                        {formatPaisa(row.expense_paisa)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium text-text-muted">
                        Capital in
                      </dt>
                      <dd className="font-mono text-xs text-secondary">
                        {row.capital_in_paisa > 0 ?
                          formatPaisa(row.capital_in_paisa)
                        : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium text-text-muted">
                        Withdrawals
                      </dt>
                      <dd className="font-mono text-xs text-secondary">
                        {row.withdrawal_paisa > 0 ?
                          formatPaisa(row.withdrawal_paisa)
                        : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium text-text-muted">
                        Net adjustment
                      </dt>
                      <dd className="font-mono text-xs text-secondary">
                        {netAdjustment !== 0 ? formatPaisa(netAdjustment) : "-"}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })
          }
        </div>
      </div>
    </div>
  );
};
