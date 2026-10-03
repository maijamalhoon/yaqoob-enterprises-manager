import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { formatPaisa } from '../../lib/money';
import { getKarachiBusinessDate } from '../../lib/dates';
import { BarChart3, TrendingUp, Calendar, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';

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
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase
        .from('view_monthly_summary')
        .select('*')
        .eq('year', selectedYear)
        .order('month', { ascending: true });

      if (error) {
        console.error('Error fetching monthly report view:', error);
      }

      setMonthlyData(
        (data || []).map((row: any) => ({
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
        }))
      );
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const totalAnnualIncome = monthlyData.reduce((acc, m) => acc + m.income_paisa, 0);
  const totalAnnualExpense = monthlyData.reduce((acc, m) => acc + m.expense_paisa, 0);
  const totalAnnualProfit = totalAnnualIncome - totalAnnualExpense;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Month-vs-Month Financial Reports</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Full annual historical comparison directly queried from view_monthly_summary.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded-xl px-3 py-1.5 bg-white text-xs font-semibold focus:outline-none"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Annual Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Annual Income ({selectedYear})
          </div>
          <div className="text-2xl font-bold text-emerald-950 font-mono mt-2">
            {formatPaisa(totalAnnualIncome)}
          </div>
        </div>

        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
            Annual Expenses ({selectedYear})
          </div>
          <div className="text-2xl font-bold text-rose-950 font-mono mt-2">
            {formatPaisa(totalAnnualExpense)}
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
            Annual Net Profit ({selectedYear})
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              totalAnnualProfit >= 0 ? 'text-blue-950' : 'text-rose-950'
            }`}
          >
            {formatPaisa(totalAnnualProfit)}
          </div>
        </div>
      </div>

      {/* Month-by-Month Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Monthly Breakdown</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
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
              {monthlyData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-sans">
                    No transactions recorded for year {selectedYear}.
                  </td>
                </tr>
              ) : (
                monthlyData.map((row) => {
                  const mName = monthNames[row.month - 1] || `Month ${row.month}`;
                  const netAdj = row.adjustment_in_paisa - row.adjustment_out_paisa;

                  return (
                    <tr key={row.month} className="hover:bg-gray-50/60 transition-colors">
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
                          row.net_profit_paisa >= 0 ? 'text-blue-900' : 'text-rose-900'
                        }`}
                      >
                        {formatPaisa(row.net_profit_paisa)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.capital_in_paisa > 0 ? formatPaisa(row.capital_in_paisa) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.withdrawal_paisa > 0 ? formatPaisa(row.withdrawal_paisa) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {netAdj !== 0 ? formatPaisa(netAdj) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
