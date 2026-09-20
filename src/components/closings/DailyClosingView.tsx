import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { closingRepo } from '../../services';
import { DailyClosing } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  Lock,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  History,
  Check,
} from 'lucide-react';

export const DailyClosingView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast } = useApp();

  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [closingDate, setClosingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [summary, setSummary] = useState<{
    opening_cash: number;
    cash_sales: number;
    cash_expenses: number;
    cash_transfers_in: number;
    cash_transfers_out: number;
    expected_cash: number;
  }>({
    opening_cash: 0,
    cash_sales: 0,
    cash_expenses: 0,
    cash_transfers_in: 0,
    cash_transfers_out: 0,
    expected_cash: 0,
  });

  const [actualCash, setActualCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const list = await closingRepo.getClosings(organization.id);
      setClosings(list);
      const summ = await closingRepo.getDailyClosingSummary(organization.id, closingDate);
      setSummary({
        opening_cash: summ.openingCash,
        cash_sales: summ.cashSales,
        cash_expenses: summ.cashExpenses,
        cash_transfers_in: summ.cashTransfersIn,
        cash_transfers_out: summ.cashTransfersOut,
        expected_cash: summ.expectedCash,
      });
      if (actualCash === '') {
        setActualCash(String(summ.expectedCash));
      }
    }
    loadData();
  }, [organization.id, closingDate, dataVersion]);

  const numActualCash = parseFloat(actualCash) || 0;
  const discrepancy = numActualCash - summary.expected_cash;

  const alreadyClosed = closings.some((c) => c.closing_date === closingDate);

  const handleExecuteClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await closingRepo.recordDailyClosing(organization.id, {
        closing_date: closingDate,
        actual_cash: numActualCash,
        notes: notes.trim() || undefined,
        closed_by: user?.full_name || 'Authorized Manager',
      });

      showToast(
        'success',
        `Day Closed: ${res.closing_date}`,
        `Actual cash: ${formatCurrency(res.actual_cash, organization.currency_symbol)}, Discrepancy: ${formatCurrency(res.difference, organization.currency_symbol)}`
      );
      refreshData();
    } catch (err: any) {
      showToast('error', 'Closing Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Daily Cash Drawer Reconciliation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            End-of-shift physical cash count, variance tracking, and register lockdown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-400" />
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {alreadyClosed && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Date Already Closed</p>
            <p className="text-amber-300/80 mt-0.5">
              A closing has already been registered for {closingDate}. Submitting again will update
              the closing audit log with the new physical count.
            </p>
          </div>
        </div>
      )}

      {/* Main Reconciliation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Cash Ledger Math Breakdown */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Computed Drawer Reconciliation
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">1. Opening Cash Balance:</span>
                <span className="font-mono font-semibold text-slate-200">
                  {formatCurrency(summary.opening_cash, organization.currency_symbol)}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-emerald-400 font-medium">(+) Cash Sales Received:</span>
                <span className="font-mono font-bold text-emerald-400">
                  +{formatCurrency(summary.cash_sales, organization.currency_symbol)}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-amber-400 font-medium">(-) Cash Expenses Paid Out:</span>
                <span className="font-mono font-bold text-amber-400">
                  -{formatCurrency(summary.cash_expenses, organization.currency_symbol)}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-indigo-400 font-medium">(+) Cash Transferred In:</span>
                <span className="font-mono text-indigo-300">
                  +{formatCurrency(summary.cash_transfers_in, organization.currency_symbol)}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">(-) Cash Deposited / Transferred Out:</span>
                <span className="font-mono text-slate-300">
                  -{formatCurrency(summary.cash_transfers_out, organization.currency_symbol)}
                </span>
              </div>

              {/* Expected Total */}
              <div className="flex items-baseline justify-between p-3.5 rounded-lg bg-slate-900/80 border border-indigo-500/30 mt-2">
                <div>
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide block">
                    Expected Drawer Cash:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Opening + Sales - Expenses + In - Out
                  </span>
                </div>
                <span className="text-xl font-mono font-extrabold text-emerald-400">
                  {formatCurrency(summary.expected_cash, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right 5 Cols: Physical Cash Input & Variance */}
        <div className="lg:col-span-5">
          <Card className="p-4 space-y-4 bg-slate-900/60 border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Physical Count & Verification
            </h3>

            <form onSubmit={handleExecuteClosing} className="space-y-4">
              <Input
                label={`Physical Cash Counted (${organization.currency_symbol})`}
                type="number"
                step="any"
                required
                autoFocus
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="font-mono text-xl font-bold text-slate-100"
              />

              {/* Discrepancy Status Badge */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between font-mono ${
                  discrepancy === 0
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : discrepancy > 0
                    ? 'bg-indigo-950/30 border-indigo-800/60 text-indigo-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider block">
                    Discrepancy (Counted vs Expected)
                  </span>
                  <span className="text-xs">
                    {discrepancy === 0
                      ? 'Perfect Match - No Variance'
                      : discrepancy > 0
                      ? 'Cash Overage (+)'
                      : 'Cash Shortage (-)'}
                  </span>
                </div>
                <span className="text-lg font-bold">
                  {discrepancy > 0 ? '+' : ''}
                  {formatCurrency(discrepancy, organization.currency_symbol)}
                </span>
              </div>

              <Input
                label="Closing Notes / Variance Explanation"
                placeholder="e.g. Exact cash balanced. 50 Rs rounding difference due to change shortage."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full font-bold shadow-xs"
                >
                  <Lock className="h-4 w-4" />
                  <span>Lock & Submit Daily Closing</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Historical Closings Table */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h2 className="text-sm font-bold text-slate-200">Previous Closings History</h2>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
                  <th className="py-3 px-4">Closing Date</th>
                  <th className="py-3 px-3 text-right">Opening Cash</th>
                  <th className="py-3 px-3 text-right">Cash Sales</th>
                  <th className="py-3 px-3 text-right">Cash Expenses</th>
                  <th className="py-3 px-3 text-right">Expected</th>
                  <th className="py-3 px-3 text-right">Actual Count</th>
                  <th className="py-3 px-3 text-right">Variance</th>
                  <th className="py-3 px-3">Closed By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {closings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {c.closing_date}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {formatCurrency(c.opening_cash, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                      {formatCurrency(c.cash_sales, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-400">
                      {formatCurrency(c.cash_expenses, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatCurrency(c.expected_cash, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                      {formatCurrency(c.actual_cash, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={
                          c.difference === 0
                            ? 'text-emerald-400'
                            : c.difference > 0
                            ? 'text-cyan-400'
                            : 'text-rose-400 font-bold'
                        }
                      >
                        {c.difference > 0 ? '+' : ''}
                        {formatCurrency(c.difference, organization.currency_symbol)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{c.closed_by}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                      {c.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
