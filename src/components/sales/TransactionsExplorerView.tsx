import React, { useState, useEffect } from 'react';
import { ledgerService } from '../../services/ledgerService';
import { Transaction, Category } from '../../types/ledger';
import { formatPaisa } from '../../lib/money';
import { formatKarachiTime, getKarachiBusinessDate } from '../../lib/dates';
import {
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Ban,
  Trash2,
} from 'lucide-react';
import { VoidModal } from '../chat/VoidModal';

export const TransactionsExplorerView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'voided' | 'all'>('all');

  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const cats = await ledgerService.getCategories();
      setCategories(cats);

      const res = await ledgerService.getFilteredTransactions({
        searchQuery: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: selectedType,
        categoryId: selectedCategory,
        status: selectedStatus,
        limit: pageSize,
        offset: page * pageSize,
      });

      setTransactions(res.transactions);
      setTotalCount(res.count);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, selectedType, selectedCategory, selectedStatus, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadData();
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = [
      'ID',
      'Business Date',
      'Device Time',
      'Type',
      'Category',
      'Amount (Rs)',
      'Raw Text',
      'Status',
      'Void Reason',
      'Created By',
    ];

    const rows = transactions.map((t) => [
      t.id,
      t.business_date,
      t.device_entry_time,
      t.type,
      t.category_name || '',
      (t.amount_paisa / 100).toFixed(2),
      `"${(t.raw_text || '').replace(/"/g, '""')}"`,
      t.status,
      `"${(t.void_reason || '').replace(/"/g, '""')}"`,
      `"${(t.created_by_name || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `yaqoob_ledger_export_${getKarachiBusinessDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Transactions Explorer</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Search, filter, paginate, and audit all ledger entries with immutable timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search raw text, note, or ID..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {/* Start Date */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-xl px-2 py-1.5 bg-gray-50/50">
            <Calendar className="w-3 h-3 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-[11px] focus:outline-none w-full"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-xl px-2 py-1.5 bg-gray-50/50">
            <Calendar className="w-3 h-3 text-gray-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-[11px] focus:outline-none w-full"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 rounded-xl px-2 py-1.5 bg-gray-50/50 text-gray-700 text-xs focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="capital_in">Capital In</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="adjustment">Adjustment</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 rounded-xl px-2 py-1.5 bg-gray-50/50 text-gray-700 text-xs focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as any);
              setPage(0);
            }}
            className="border border-gray-300 rounded-xl px-2 py-1.5 bg-gray-50/50 text-gray-700 text-xs focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="voided">Voided Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category / Details</th>
                <th className="px-4 py-3">Entered By</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isVoided = tx.status === 'voided';
                  const isIncome = tx.type === 'income';
                  const isExpense = tx.type === 'expense';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isVoided ? 'bg-gray-50/50 text-gray-400' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                        <div>{tx.business_date}</div>
                        <div className="text-gray-400">{formatKarachiTime(tx.device_entry_time)}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800'
                              : isExpense
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isIncome && <ArrowDownLeft className="w-2.5 h-2.5" />}
                          {isExpense && <ArrowUpRight className="w-2.5 h-2.5" />}
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {tx.category_name || '-'}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 truncate max-w-xs">
                          &ldquo;{tx.raw_text}&rdquo;
                        </div>
                        {tx.note && <div className="text-[11px] text-gray-500 italic">Note: {tx.note}</div>}
                        {isVoided && (
                          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                            Voided reason: {tx.void_reason}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {tx.created_by_name}
                      </td>

                      <td
                        className={`px-4 py-3 font-mono font-bold text-sm text-right whitespace-nowrap ${
                          isVoided
                            ? 'line-through text-gray-400'
                            : isIncome
                            ? 'text-emerald-700'
                            : isExpense
                            ? 'text-rose-700'
                            : 'text-gray-900'
                        }`}
                      >
                        {isExpense ? '-' : ''}
                        {formatPaisa(tx.amount_paisa)}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isVoided ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px] border border-rose-200">
                            Voided
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {!isVoided && (
                          <button
                            onClick={() => setVoidingTx(tx)}
                            className="p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600"
                            title="Void Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing {transactions.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Void Modal */}
      {voidingTx && (
        <VoidModal
          transaction={voidingTx}
          onConfirmVoid={async (id, reason, currentUpdatedAt) => {
            await ledgerService.voidTransaction(id, reason, currentUpdatedAt);
            setVoidingTx(null);
            loadData();
          }}
          onClose={() => setVoidingTx(null)}
        />
      )}
    </div>
  );
};
