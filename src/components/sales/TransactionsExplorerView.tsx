import React, { useState, useEffect } from "react";
import { ledgerService } from "../../services/ledgerService";
import { Transaction, Category } from "../../types/ledger";
import { formatPaisa } from "../../lib/money";
import { formatKarachiTime, getKarachiBusinessDate } from "../../lib/dates";
import { exportToCSV as downloadCSV } from "../../lib/utils";
import {
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Ban,
  Trash2,
} from "lucide-react";
import { VoidModal } from "../chat/VoidModal";

const getTransactionDisplayDetails = (transaction: Transaction) => {
  const testDataMatch = transaction.raw_text.match(
    /^SHOP_PRO_PAGINATION_TEST \| (income|expense) \| (\d{4})$/,
  );
  if (!testDataMatch) {
    return {
      isTestData: false,
      rawText: transaction.raw_text,
      note: transaction.note,
    };
  }

  return {
    isTestData: true,
    rawText: `Pagination test entry #${testDataMatch[2]}`,
    note: "Generated test data",
  };
};

export const TransactionsExplorerView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<
    "active" | "voided" | "all"
  >("all");

  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);

  const getCurrentFilter = () => ({
    searchQuery: searchQuery.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    type: selectedType,
    categoryId: selectedCategory,
    status: selectedStatus,
  });

  const loadData = async (requestedPage = page) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const cats = await ledgerService.getCategories();
      setCategories(cats);

      const res = await ledgerService.getFilteredTransactions({
        ...getCurrentFilter(),
        limit: pageSize,
        offset: requestedPage * pageSize,
      });

      setTransactions(res.transactions);
      setTotalCount(res.count);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactions([]);
      setTotalCount(0);
      setLoadError(
        "Transactions could not be loaded. Please refresh and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    page,
    selectedType,
    selectedCategory,
    selectedStatus,
    startDate,
    endDate,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    void loadData(0);
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    setExportError("");
    const headers = [
      "ID",
      "Business Date",
      "Device Time",
      "Type",
      "Category",
      "Amount (Rs)",
      "Raw Text",
      "Status",
      "Void Reason",
      "Created By",
    ];

    try {
      const exportedTransactions =
        await ledgerService.getAllFilteredTransactions(getCurrentFilter());

      if (exportedTransactions.length === 0) return;

      const rows = exportedTransactions.map((transaction) => [
        transaction.id,
        transaction.business_date,
        transaction.device_entry_time,
        transaction.type,
        transaction.category_name || "",
        (transaction.amount_paisa / 100).toFixed(2),
        transaction.raw_text || "",
        transaction.status,
        transaction.void_reason || "",
        transaction.created_by_name || "",
      ]);

      downloadCSV(
        "shop_pro_ledger_export",
        headers,
        rows,
        getKarachiBusinessDate(),
      );
    } catch (err) {
      console.error("Error exporting transactions:", err);
      setExportError("The CSV export could not be completed. Please retry.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="workspace-page flex-1 overflow-y-auto space-y-4 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="workspace-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Find and review ledger entries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={isExporting || totalCount === 0}
            className="flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Export filtered transactions as CSV"
          >
            <Download className="w-3.5 h-3.5" />{" "}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => void loadData()}
            aria-label="Refresh transactions"
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border-standard text-secondary transition-colors hover:bg-surface-container-low"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {exportError && (
        <p role="alert" className="text-xs text-rose-700">
          {exportError}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-xs text-rose-700">
          {loadError}
        </p>
      )}

      {/* Filters Bar */}
      <div className="workspace-panel space-y-3 p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search raw text, note, or ID..."
              aria-label="Search transactions"
              className="w-full rounded-md border border-border-standard py-2 pl-9 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="submit"
            className="min-h-10 rounded-md bg-on-surface px-4 text-xs font-semibold text-white transition-colors hover:bg-secondary"
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
              aria-label="Start date"
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
              aria-label="End date"
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
            className="min-w-0 rounded-md border border-border-standard bg-white px-2 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
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
            className="min-w-0 rounded-md border border-border-standard bg-white px-2 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
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
              setSelectedStatus(e.target.value as "active" | "voided" | "all");
              setPage(0);
            }}
            className="min-w-0 rounded-md border border-border-standard bg-white px-2 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="voided">Voided Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="workspace-panel">
        <div className="hidden overflow-x-auto lg:block">
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
              {transactions.length === 0 ?
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No transactions match the selected filters.
                  </td>
                </tr>
              : transactions.map((tx) => {
                  const isVoided = tx.status === "voided";
                  const isIncome = tx.type === "income";
                  const isExpense = tx.type === "expense";
                  const details = getTransactionDisplayDetails(tx);

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isVoided ? "bg-gray-50/50 text-gray-400" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                        <div>{tx.business_date}</div>
                        <div className="text-gray-400">
                          {formatKarachiTime(tx.device_entry_time)}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isIncome ? "bg-emerald-100 text-emerald-800"
                            : isExpense ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isIncome && (
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                          )}
                          {isExpense && (
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          )}
                          {tx.type.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {tx.category_name || "-"}
                        </div>
                        <div className="flex max-w-xs items-center gap-1.5 truncate text-[11px] text-gray-500">
                          {details.isTestData && (
                            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                              Test data
                            </span>
                          )}
                          <span className="truncate">{details.rawText}</span>
                        </div>
                        {details.note && (
                          <div className="text-[11px] text-gray-500 italic">
                            Note: {details.note}
                          </div>
                        )}
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
                          isVoided ? "line-through text-gray-400"
                          : isIncome ? "text-emerald-700"
                          : isExpense ? "text-rose-700"
                          : "text-gray-900"
                        }`}
                      >
                        {isExpense ? "-" : ""}
                        {formatPaisa(tx.amount_paisa)}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isVoided ?
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px] border border-rose-200">
                            Voided
                          </span>
                        : <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                            Active
                          </span>
                        }
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {!isVoided && (
                          <button
                            onClick={() => setVoidingTx(tx)}
                            aria-label={`Void ${tx.category_name || tx.type} transaction`}
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
              }
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border-standard lg:hidden">
          {transactions.length === 0 ?
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              No transactions match the selected filters.
            </p>
          : transactions.map((tx) => {
              const isVoided = tx.status === "voided";
              const isIncome = tx.type === "income";
              const isExpense = tx.type === "expense";
              const details = getTransactionDisplayDetails(tx);

              return (
                <article
                  key={tx.id}
                  className={`px-3 py-3 ${isVoided ? "bg-surface-container-low/60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-on-surface">
                        {tx.category_name || tx.type.replace("_", " ")}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {tx.business_date} ·{" "}
                        {formatKarachiTime(tx.device_entry_time)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                        isVoided ? "line-through text-text-muted"
                        : isIncome ? "text-primary"
                        : isExpense ? "text-rose-700"
                        : "text-on-surface"
                      }`}
                    >
                      {isExpense ? "-" : ""}
                      {formatPaisa(tx.amount_paisa)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        isIncome ? "bg-primary/10 text-primary"
                        : isExpense ? "bg-rose-50 text-rose-700"
                        : "bg-surface-container-low text-secondary"
                      }`}
                    >
                      {tx.type.replace("_", " ")}
                    </span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                        isVoided ?
                          "bg-rose-50 text-rose-700"
                        : "bg-surface-container-low text-secondary"
                      }`}
                    >
                      {isVoided ? "Voided" : "Active"}
                    </span>
                    {tx.created_by_name && (
                      <span className="text-[11px] text-text-muted">
                        {tx.created_by_name}
                      </span>
                    )}
                  </div>

                  {details.rawText && details.rawText !== tx.category_name && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {details.isTestData && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                          Test data
                        </span>
                      )}
                      <p className="truncate text-xs text-secondary">
                        {details.rawText}
                      </p>
                    </div>
                  )}
                  {details.note && (
                    <p className="mt-1 text-xs text-text-muted">{details.note}</p>
                  )}
                  {isVoided && tx.void_reason && (
                    <p className="mt-1 text-xs text-rose-700">
                      Reason: {tx.void_reason}
                    </p>
                  )}
                  {!isVoided && (
                    <button
                      type="button"
                      onClick={() => setVoidingTx(tx)}
                      aria-label={`Void ${tx.category_name || tx.type} transaction`}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-standard bg-white px-2.5 text-xs font-medium text-secondary transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Void
                    </button>
                  )}
                </article>
              );
            })
          }
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing {transactions.length > 0 ? page * pageSize + 1 : 0} to{" "}
            {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}{" "}
            records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount || isLoading}
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
