import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { expenseRepo } from '../../services';
import { Expense, ExpenseCategory } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  ReceiptText,
  Plus,
  Search,
  Ban,
  Calendar,
  Wallet,
  AlertCircle,
  Tag,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { organization, user } = useAuth();
  const { dataVersion, refreshData, showToast, setIsQuickExpenseOpen } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Void Expense Modal
  const [expenseToVoid, setExpenseToVoid] = useState<Expense | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [eList, cList] = await Promise.all([
        expenseRepo.getExpenses(organization.id),
        expenseRepo.getCategories(organization.id),
      ]);
      setExpenses(eList);
      setCategories(cList);
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

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter((e) => {
      const matchesQ =
        !q ||
        e.description.toLowerCase().includes(q) ||
        (e.reference_number && e.reference_number.toLowerCase().includes(q)) ||
        e.account_name.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'ALL' || e.category_id === categoryFilter;
      return matchesQ && matchesCat;
    });
  }, [expenses, searchQuery, categoryFilter]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.status === 'ACTIVE')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f5f7fa] select-none text-[#102a43]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#d9e2ec]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102a43]">
            Expense Ledger
          </h1>
          <p className="text-xs text-[#627d98] mt-0.5">
            Track operational spending, ink/toner purchases, utility bills, rent, and petty cash.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsQuickExpenseOpen(true)}
          className="font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Record Expense</span>
        </Button>
      </div>

      {/* Summary Stat & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#829ab1]" />
          <input
            type="text"
            placeholder="Search description, reference #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-[8px] bg-white border border-[#d9e2ec] text-xs text-[#102a43] placeholder:text-[#829ab1] focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#627d98]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#d9e2ec] rounded-[8px] px-3 py-1.5 text-xs text-[#102a43] focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-3 py-1.5 rounded-[8px] bg-white border border-[#d9e2ec] text-xs font-mono">
            <span className="text-[#627d98] mr-1.5">Total:</span>
            <span className="font-bold text-amber-700">
              {formatCurrency(totalExpenseAmount, organization.currency_symbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Account Paid From</th>
                <th className="py-3 px-3">Reference #</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Entered By</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9e2ec] font-sans">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-[#f5f7fa] transition-colors">
                  <td className="py-3 px-4 font-mono text-[#627d98]">{exp.date}</td>
                  <td className="py-3 px-3">
                    <Badge variant="amber" size="sm">
                      {exp.category_name}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-[#102a43]">{exp.description}</p>
                    {exp.notes && <p className="text-[10px] text-[#627d98]">{exp.notes}</p>}
                  </td>
                  <td className="py-3 px-3 font-medium text-[#243b53]">{exp.account_name}</td>
                  <td className="py-3 px-3 font-mono text-[#627d98] text-[11px]">
                    {exp.reference_number || '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                    {formatCurrency(exp.amount, organization.currency_symbol)}
                  </td>
                  <td className="py-3 px-3 text-[#627d98]">{exp.entered_by}</td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={exp.status === 'ACTIVE' ? 'emerald' : 'rose'} size="sm">
                      {exp.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {exp.status === 'ACTIVE' && (
                      <button
                        onClick={() => setExpenseToVoid(exp)}
                        title="Void Expense"
                        className="p-1.5 rounded text-[#829ab1] hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Void Modal */}
      <Modal
        isOpen={Boolean(expenseToVoid)}
        onClose={() => setExpenseToVoid(null)}
        title="Void Expense Entry?"
        description="Refunding money to account ledger."
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-[#102a43]">
            Are you sure you want to void this expense of{' '}
            <strong className="text-amber-700">
              {formatCurrency(expenseToVoid?.amount || 0, organization.currency_symbol)}
            </strong>
            ? This will restore the balance of{' '}
            <strong className="text-[#102a43]">{expenseToVoid?.account_name}</strong>.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d9e2ec]">
            <Button variant="ghost" size="sm" onClick={() => setExpenseToVoid(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isVoiding}
              onClick={handleExecuteVoid}
            >
              <Ban className="h-4 w-4" />
              <span>Confirm Void</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
