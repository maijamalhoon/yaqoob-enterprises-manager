import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { expenseRepo, accountRepo } from '../../services';
import { Expense, ExpenseCategory, PaymentAccount } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { formatCurrency, formatDateTime, exportToCSV } from '../../lib/utils';
import {
  Receipt,
  Plus,
  Search,
  Ban,
  Download,
  Zap,
  Boxes,
  Wrench,
  AlertCircle,
  Tag,
  Wallet,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast, setIsQuickExpenseOpen } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Void Expense Modal
  const [expenseToVoid, setExpenseToVoid] = useState<Expense | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [eList, cList, aList] = await Promise.all([
        expenseRepo.getExpenses(organization.id),
        expenseRepo.getCategories(organization.id),
        accountRepo.getAccounts(organization.id),
      ]);
      setExpenses(eList);
      setCategories(cList);
      setAccounts(aList);
    }
    loadData();
  }, [organization.id, dataVersion]);

  const handleExecuteVoid = async () => {
    if (!expenseToVoid) return;
    setIsVoiding(true);

    try {
      await expenseRepo.voidExpense(
        organization.id,
        expenseToVoid.id,
        user?.id || 'usr-void',
        user?.full_name || 'Staff'
      );

      showToast(
        'warning',
        'Expense Voided',
        `${formatCurrency(expenseToVoid.amount, organization.currency_symbol)} refunded back to ${expenseToVoid.account_name}.`
      );
      setExpenseToVoid(null);
      refreshData();
    } catch (err: any) {
      showToast('error', 'Void Failed', err.message);
    } finally {
      setIsVoiding(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Account Paid From', 'Description', 'Amount', 'Reference #', 'Status'];
    const rows = filteredExpenses.map((e) => [
      e.date,
      e.category_name,
      e.account_name,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.reference_number || '',
      e.status,
    ]);
    exportToCSV(`Expenses_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    showToast('success', 'Export Complete', 'Expense CSV ledger downloaded');
  };

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter((e) => {
      const matchesQ =
        !q ||
        e.description.toLowerCase().includes(q) ||
        (e.reference_number && e.reference_number.toLowerCase().includes(q)) ||
        e.account_name.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'ALL' || e.category_id === categoryFilter;
      const matchesAcc = accountFilter === 'ALL' || e.account_id === accountFilter;
      return matchesQ && matchesCat && matchesAcc;
    });
  }, [expenses, searchQuery, categoryFilter, accountFilter]);

  // Derived KPI Metrics
  const activeExpenses = useMemo(() => {
    return expenses.filter((e) => e.status === 'ACTIVE');
  }, [expenses]);

  const totalExpenseAmount = useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  const utilitiesAmount = useMemo(() => {
    return activeExpenses
      .filter((e) => e.category_name?.toLowerCase().includes('utilit') || e.category_name?.toLowerCase().includes('rent'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  const rawMaterialsAmount = useMemo(() => {
    return activeExpenses
      .filter((e) => e.category_name?.toLowerCase().includes('suppl') || e.category_name?.toLowerCase().includes('raw') || e.category_name?.toLowerCase().includes('paper'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  const maintenanceAmount = useMemo(() => {
    return activeExpenses
      .filter((e) => e.category_name?.toLowerCase().includes('maint') || e.category_name?.toLowerCase().includes('repair') || e.category_name?.toLowerCase().includes('tea') || e.category_name?.toLowerCase().includes('refresh'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 select-none text-[#14181f] min-h-0 bg-[#f8f9fb]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-[#14181f] tracking-tight">Business Expenses</h1>
          <p className="text-xs text-[#667085]">
            Track operational costs, utilities, inventory supplies, and cash pay-outs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={handleExportCSV}>
            <Download className="h-4 w-4 text-[#667085]" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsQuickExpenseOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>+ Log Expense</span>
          </Button>
        </div>
      </div>

      {/* Top Summary KPI Cards (4 in a row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#667085] font-semibold uppercase tracking-wider">
              Total Recorded
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#4f46e5]">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-mono font-bold text-[#14181f] tracking-tight">
              {formatCurrency(totalExpenseAmount, organization.currency_symbol)}
            </span>
            <span className="text-[11px] text-[#667085] mt-0.5">
              {activeExpenses.length} active entries
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#667085] font-semibold uppercase tracking-wider">
              Rent & Utilities
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#d97706]">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-mono font-bold text-[#14181f] tracking-tight">
              {formatCurrency(utilitiesAmount, organization.currency_symbol)}
            </span>
            <span className="text-[11px] text-[#667085] mt-0.5">Power & lease dues</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#667085] font-semibold uppercase tracking-wider">
              Supplies & Paper
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#16a34a]">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-mono font-bold text-[#14181f] tracking-tight">
              {formatCurrency(rawMaterialsAmount, organization.currency_symbol)}
            </span>
            <span className="text-[11px] text-[#667085] mt-0.5">Paper reams, toner, coils</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#667085] font-semibold uppercase tracking-wider">
              Repairs & Hospitality
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec] flex items-center justify-center text-[#667085]">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-mono font-bold text-[#14181f] tracking-tight">
              {formatCurrency(maintenanceAmount, organization.currency_symbol)}
            </span>
            <span className="text-[11px] text-[#667085] mt-0.5">Equipment care & staff tea</span>
          </div>
        </div>
      </div>

      {/* Main Content Card: Filter & Search + Data Table */}
      <div className="bg-white rounded-xl border border-[#e6e8ec] shadow-sm overflow-hidden flex flex-col">
        {/* Filter & Search Toolbar */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e6e8ec]">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
            <input
              type="text"
              id="expenseSearchInput"
              placeholder="Search expenses by vendor, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] placeholder:text-[#667085] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] focus:outline-none focus:bg-white focus:border-[#4f46e5] transition-all cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Payment Account Filter */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="h-9 px-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg text-xs text-[#14181f] focus:outline-none focus:bg-white focus:border-[#4f46e5] transition-all cursor-pointer"
            >
              <option value="ALL">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fb] text-[#667085] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e6e8ec]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Paid From</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Reference #</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8ec] text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#667085]">
                    No expense records matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#f8f9fb] transition-colors group">
                    <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085]">
                        {exp.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#14181f]">
                      <div className="flex flex-col">
                        <span className="font-semibold">{exp.description}</span>
                        {exp.notes && <span className="text-[11px] text-[#667085]">{exp.notes}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-[#14181f]">
                      {exp.account_name}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#dc2626] whitespace-nowrap">
                      {formatCurrency(exp.amount, organization.currency_symbol)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#667085] whitespace-nowrap">
                      {exp.reference_number || '-'}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <Badge variant={exp.status === 'ACTIVE' ? 'emerald' : 'rose'} size="sm">
                        {exp.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {exp.status === 'ACTIVE' && (
                        <button
                          onClick={() => setExpenseToVoid(exp)}
                          className="w-8 h-8 rounded-lg hover:bg-[#fef2f2] text-[#667085] hover:text-[#dc2626] transition-colors inline-flex items-center justify-center cursor-pointer"
                          title="Void Expense"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#f8f9fb] border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
          <span>
            Showing {filteredExpenses.length} of {expenses.length} records
          </span>
          <span className="font-mono font-bold text-[#14181f]">
            Filtered Total: {formatCurrency(
              filteredExpenses.filter((e) => e.status === 'ACTIVE').reduce((sum, e) => sum + e.amount, 0),
              organization.currency_symbol
            )}
          </span>
        </div>
      </div>

      {/* Void Modal */}
      <Modal
        isOpen={Boolean(expenseToVoid)}
        onClose={() => setExpenseToVoid(null)}
        title="Void Expense Entry"
        description="Are you sure you want to void this expense voucher?"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          {expenseToVoid && (
            <div className="p-3 bg-[#f8f9fb] rounded-lg border border-[#e6e8ec] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#667085]">Description:</span>
                <span className="font-semibold text-[#14181f]">{expenseToVoid.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Amount:</span>
                <span className="font-mono font-bold text-[#dc2626]">
                  {formatCurrency(expenseToVoid.amount, organization.currency_symbol)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Refund Account:</span>
                <span className="font-semibold text-[#14181f]">{expenseToVoid.account_name}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e6e8ec]">
            <Button variant="ghost" onClick={() => setExpenseToVoid(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={isVoiding} onClick={handleExecuteVoid}>
              Confirm Void
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
