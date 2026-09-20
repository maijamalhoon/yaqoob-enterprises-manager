import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { hasPermission } from "../../lib/permissions";
import {
  salesRepo,
  expenseRepo,
  inventoryRepo,
  accountRepo,
  customerRepo,
  closingRepo,
} from "../../services";
import {
  Sale,
  Expense,
  Product,
  Service,
  StockMovement,
  PaymentAccount,
  AccountTransaction,
  Customer,
  DailyClosing,
} from "../../types";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  roundMoney,
  exportToCSV,
} from "../../lib/utils";
import {
  BarChart3,
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  Download,
  Boxes,
  FileSpreadsheet,
  Layers,
  Wallet,
  ArrowUpDown,
  Users,
  Lock,
  Search,
  Filter,
} from "lucide-react";

export type ReportTab =
  | "PL"
  | "SALES"
  | "EXPENSES"
  | "INVENTORY"
  | "MOVEMENTS"
  | "TOP_ITEMS"
  | "PAYMENTS"
  | "CUSTOMERS"
  | "CLOSINGS";

export type DatePeriod =
  | "TODAY"
  | "YESTERDAY"
  | "WEEK"
  | "MONTH"
  | "YEAR"
  | "ALL"
  | "CUSTOM";

export const ReportsView: React.FC = () => {
  const { organization, role } = useAuth();
  const { dataVersion, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<ReportTab>("PL");
  const [period, setPeriod] = useState<DatePeriod>("MONTH");
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  // Datasets
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Table Search Filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!role || !hasPermission(role, "VIEW_REPORTS_PL")) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f7fa] p-6">
        <div className="max-w-md rounded-[10px] border border-[#d9e2ec] bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-[#102a43]">
            Reports access required
          </h1>
          <p className="mt-2 text-sm text-[#627d98]">
            Your authenticated role does not have permission to view financial
            reports.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    async function loadAllData() {
      setIsLoading(true);
      try {
        const [
          sList,
          eList,
          pList,
          srvList,
          mList,
          aList,
          tList,
          cList,
          clList,
        ] = await Promise.all([
          salesRepo.getSales(organization.id),
          expenseRepo.getExpenses(organization.id),
          inventoryRepo.getProducts(organization.id),
          inventoryRepo.getServices(organization.id),
          inventoryRepo.getStockMovements(organization.id),
          accountRepo.getAccounts(organization.id),
          accountRepo.getTransactions(organization.id),
          customerRepo.getCustomers(organization.id),
          closingRepo.getClosings(organization.id),
        ]);

        setSales(sList);
        setExpenses(eList);
        setProducts(pList);
        setServices(srvList);
        setMovements(mList);
        setAccounts(aList);
        setTransactions(tList);
        setCustomers(cList);
        setClosings(clList);
      } finally {
        setIsLoading(false);
      }
    }
    loadAllData();
  }, [organization.id, dataVersion]);

  // Date Filtering Calculation
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const y = new Date();
    y.setDate(now.getDate() - 1);
    const yesterdayStr = y.toISOString().slice(0, 10);

    const w = new Date();
    w.setDate(now.getDate() - 7);
    const weekStr = w.toISOString().slice(0, 10);

    const m = new Date();
    m.setDate(now.getDate() - 30);
    const monthStr = m.toISOString().slice(0, 10);

    const yearStart = `${now.getFullYear()}-01-01`;

    if (period === "TODAY") return { start: todayStr, end: todayStr };
    if (period === "YESTERDAY")
      return { start: yesterdayStr, end: yesterdayStr };
    if (period === "WEEK") return { start: weekStr, end: todayStr };
    if (period === "MONTH") return { start: monthStr, end: todayStr };
    if (period === "YEAR") return { start: yearStart, end: todayStr };
    if (period === "CUSTOM")
      return { start: customStartDate, end: customEndDate };
    return { start: "1970-01-01", end: "2099-12-31" };
  }, [period, customStartDate, customEndDate]);

  // Filtered Core Collections
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return (
        s.status === "COMPLETED" && d >= dateRange.start && d <= dateRange.end
      );
    });
  }, [sales, dateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      return (
        e.status === "ACTIVE" &&
        e.date >= dateRange.start &&
        e.date <= dateRange.end
      );
    });
  }, [expenses, dateRange]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const d = m.created_at.slice(0, 10);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [movements, dateRange]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      return t.date >= dateRange.start && t.date <= dateRange.end;
    });
  }, [transactions, dateRange]);

  const filteredClosings = useMemo(() => {
    return closings.filter((c) => {
      return (
        c.closing_date >= dateRange.start && c.closing_date <= dateRange.end
      );
    });
  }, [closings, dateRange]);

  // Financial Metrics
  const grossRevenue = useMemo(
    () => roundMoney(filteredSales.reduce((sum, s) => sum + s.grand_total, 0)),
    [filteredSales],
  );
  const totalCogs = useMemo(
    () => roundMoney(filteredSales.reduce((sum, s) => sum + s.total_cogs, 0)),
    [filteredSales],
  );
  const grossProfit = roundMoney(grossRevenue - totalCogs);
  const grossMargin =
    grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 100) : 0;

  const totalExpenses = useMemo(
    () => roundMoney(filteredExpenses.reduce((sum, e) => sum + e.amount, 0)),
    [filteredExpenses],
  );
  const netProfit = roundMoney(grossProfit - totalExpenses);
  const netMargin =
    grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

  // Inventory Valuation Metrics
  const totalStockValuation = useMemo(
    () =>
      roundMoney(
        products.reduce(
          (sum, p) =>
            sum + (p.current_stock > 0 ? p.current_stock * p.average_cost : 0),
          0,
        ),
      ),
    [products],
  );
  const totalRetailPotential = useMemo(
    () =>
      roundMoney(
        products.reduce(
          (sum, p) =>
            sum + (p.current_stock > 0 ? p.current_stock * p.selling_price : 0),
          0,
        ),
      ),
    [products],
  );
  const lowStockItems = useMemo(
    () =>
      products.filter(
        (p) => p.track_stock && p.current_stock <= p.min_stock_threshold,
      ),
    [products],
  );

  // Top Products & Services Ranking
  const topItemsRanking = useMemo(() => {
    const itemMap: Record<
      string,
      {
        id: string;
        name: string;
        type: string;
        qty: number;
        revenue: number;
        profit: number;
      }
    > = {};
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        if (!itemMap[it.item_id]) {
          itemMap[it.item_id] = {
            id: it.item_id,
            name: it.item_name,
            type: it.item_type,
            qty: 0,
            revenue: 0,
            profit: 0,
          };
        }
        itemMap[it.item_id].qty += it.quantity;
        itemMap[it.item_id].revenue = roundMoney(
          itemMap[it.item_id].revenue + it.total,
        );
        itemMap[it.item_id].profit = roundMoney(
          itemMap[it.item_id].profit + it.gross_profit,
        );
      });
    });
    return Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Payment Methods Breakdown
  const paymentMethodsBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      if (s.split_payments && s.split_payments.length > 0) {
        s.split_payments.forEach((sp) => {
          const key = sp.account_name || "Split Tender";
          if (!map[key]) map[key] = { count: 0, total: 0 };
          map[key].count += 1;
          map[key].total = roundMoney(map[key].total + sp.amount);
        });
      } else {
        const key = s.payment_method || "Cash";
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count += 1;
        map[key].total = roundMoney(map[key].total + s.grand_total);
      }
    });
    return Object.entries(map).map(([name, data]) => ({ name, ...data }));
  }, [filteredSales]);

  // Expense by Category Breakdown
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      const cat = exp.category_name || "General Operations";
      map[cat] = roundMoney((map[cat] || 0) + exp.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  // Export to CSV Action
  const handleExportCSV = () => {
    const sym = organization.currency_symbol;
    if (activeTab === "PL") {
      const headers = ["Category", "Line Item", "Amount (PKR)"];
      const rows = [
        ["Revenue", "Gross Sales Revenue", grossRevenue],
        ["COGS", "Cost of Goods Sold (Materials & Stock)", totalCogs],
        ["Gross Profit", "Gross Operating Margin", grossProfit],
        ["Expenses", "Operating Overhead Expenses", totalExpenses],
        ["Net Profit", "Net Income", netProfit],
      ];
      exportToCSV("Profit_and_Loss_Report", headers, rows);
    } else if (activeTab === "SALES") {
      const headers = [
        "Invoice #",
        "Date Time",
        "Customer",
        "Cashier",
        "Payment Method",
        "Items Count",
        "Discount",
        "Tax",
        "Grand Total",
        "COGS",
        "Gross Profit",
      ];
      const rows = filteredSales.map((s) => [
        s.invoice_number,
        formatDateTime(s.created_at),
        s.customer_name || "Walk-in",
        s.cashier_name,
        s.payment_method,
        s.items.length,
        s.discount,
        s.tax_amount,
        s.grand_total,
        s.total_cogs,
        s.gross_profit,
      ]);
      exportToCSV("Sales_Ledger_Report", headers, rows);
    } else if (activeTab === "EXPENSES") {
      const headers = [
        "Date",
        "Category",
        "Account",
        "Description",
        "Reference #",
        "Entered By",
        "Amount",
      ];
      const rows = filteredExpenses.map((e) => [
        e.date,
        e.category_name,
        e.account_name,
        e.description,
        e.reference_number || "-",
        e.entered_by,
        e.amount,
      ]);
      exportToCSV("Expense_Ledger_Report", headers, rows);
    } else if (activeTab === "INVENTORY") {
      const headers = [
        "SKU",
        "Product Name",
        "Category",
        "Unit",
        "Purchase Cost",
        "Selling Price",
        "Current Stock",
        "Stock Value (WAC)",
        "Status",
      ];
      const rows = products.map((p) => [
        p.sku,
        p.name,
        p.category_name || "-",
        p.unit,
        p.average_cost,
        p.selling_price,
        p.current_stock,
        roundMoney(p.current_stock * p.average_cost),
        p.current_stock <= p.min_stock_threshold ? "LOW STOCK" : "IN STOCK",
      ]);
      exportToCSV("Inventory_Valuation_Report", headers, rows);
    } else if (activeTab === "CLOSINGS") {
      const headers = [
        "Closing Date",
        "Opening Cash",
        "Cash Sales",
        "Cash Expenses",
        "Transfers In",
        "Transfers Out",
        "Expected Cash",
        "Actual Counted",
        "Difference",
        "Closed By",
      ];
      const rows = filteredClosings.map((c) => [
        c.closing_date,
        c.opening_cash,
        c.cash_sales,
        c.cash_expenses,
        c.cash_transfers_in,
        c.cash_transfers_out,
        c.expected_cash,
        c.actual_cash,
        c.difference,
        c.closed_by,
      ]);
      exportToCSV("Daily_Closings_Report", headers, rows);
    } else {
      showToast("info", "Export CSV", "Generating tabular data...");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f5f7fa] select-none text-[#102a43]">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#d9e2ec] no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102a43]">
            Enterprise Financial & Operational Reports
          </h1>
          <p className="text-xs text-[#627d98] mt-0.5">
            Audit-reconciled statements, stock valuation, and cashier
            performance for {organization.name}.
          </p>
        </div>

        {/* Date Period Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex rounded-[10px] border border-[#d9e2ec] bg-[#f5f7fa] p-0.5 text-xs">
            {(["TODAY", "WEEK", "MONTH", "YEAR", "ALL", "CUSTOM"] as const).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-[8px] font-medium transition-colors cursor-pointer ${
                    period === p ?
                      "bg-teal-700 text-white shadow-xs font-semibold"
                    : "text-[#627d98] hover:text-[#102a43]"
                  }`}
                >
                  {p === "TODAY" ?
                    "Today"
                  : p === "WEEK" ?
                    "7 Days"
                  : p === "MONTH" ?
                    "30 Days"
                  : p === "YEAR" ?
                    "This Year"
                  : p === "ALL" ?
                    "All Time"
                  : "Custom"}
                </button>
              ),
            )}
          </div>

          {/* Custom Date Inputs if CUSTOM selected */}
          {period === "CUSTOM" && (
            <div className="flex items-center gap-1.5 text-xs bg-white px-2 py-1 rounded-[8px] border border-[#d9e2ec]">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent border-none text-[#102a43] text-xs focus:outline-none"
              />
              <span className="text-[#627d98]">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent border-none text-[#102a43] text-xs focus:outline-none"
              />
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* Primary Navigation Tabs for Reports */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-[#d9e2ec] no-print text-xs">
        {[
          { id: "PL", label: "Profit & Loss (P&L)", icon: BarChart3 },
          { id: "SALES", label: "Sales & Invoices", icon: TrendingUp },
          { id: "EXPENSES", label: "Operating Expenses", icon: TrendingDown },
          { id: "INVENTORY", label: "Stock Valuation", icon: Boxes },
          { id: "MOVEMENTS", label: "Stock Audit Flow", icon: ArrowUpDown },
          { id: "TOP_ITEMS", label: "Top Products & Services", icon: Layers },
          {
            id: "PAYMENTS",
            label: "Payment Tenders & Cash Flow",
            icon: Wallet,
          },
          { id: "CUSTOMERS", label: "Customer Receivables", icon: Users },
          { id: "CLOSINGS", label: "Daily Closings Audit", icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[8px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                isActive ?
                  "bg-teal-50 text-teal-800 border border-teal-200 font-semibold"
                : "text-[#627d98] hover:text-[#102a43] hover:bg-[#f5f7fa] border border-transparent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
            Gross Sales Revenue
          </span>
          <p className="text-xl font-mono font-bold text-[#102a43] mt-1">
            {formatCurrency(grossRevenue, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-teal-700 font-mono mt-0.5 block">
            {filteredSales.length} Invoices Completed
          </span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
            Cost of Goods (COGS)
          </span>
          <p className="text-xl font-mono font-bold text-rose-700 mt-1">
            {formatCurrency(totalCogs, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-[#627d98] font-mono mt-0.5 block">
            Weighted Average Cost Depleted
          </span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
            Gross Profit Margin
          </span>
          <p className="text-xl font-mono font-bold text-emerald-700 mt-1">
            {formatCurrency(grossProfit, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">
            Gross Margin: {grossMargin}%
          </span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
            Net Business Profit
          </span>
          <p
            className={`text-xl font-mono font-bold mt-1 ${
              netProfit >= 0 ? "text-teal-800" : "text-rose-700"
            }`}
          >
            {formatCurrency(netProfit, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-[#627d98] font-mono mt-0.5 block">
            After Rs. {totalExpenses} Overheads ({netMargin}%)
          </span>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* REPORT CONTENT BY TAB */}
      {/* ========================================================================= */}

      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {activeTab === "PL" && (
        <Card className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-[#d9e2ec]">
            <h2 className="text-lg font-bold text-[#102a43] uppercase tracking-wide">
              {organization.name}
            </h2>
            <p className="text-xs text-[#627d98]">
              Formal Statement of Profit and Loss
            </p>
            <p className="text-[11px] font-mono text-teal-800 mt-1">
              Period: {dateRange.start} to {dateRange.end} • Currency:{" "}
              {organization.currency}
            </p>
          </div>

          {/* Section 1: Revenue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#102a43] pb-1 border-b border-[#d9e2ec]">
              <span>1. OPERATING REVENUE</span>
              <span className="font-mono text-teal-800">
                {formatCurrency(grossRevenue, organization.currency_symbol)}
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#627d98]">
              <div className="flex justify-between">
                <span>Completed Sales & POS Counter Billings</span>
                <span className="font-mono text-[#102a43]">
                  {formatCurrency(grossRevenue, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: COGS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#102a43] pb-1 border-b border-[#d9e2ec]">
              <span>2. COST OF GOODS SOLD (COGS)</span>
              <span className="font-mono text-rose-700">
                ({formatCurrency(totalCogs, organization.currency_symbol)})
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#627d98]">
              <div className="flex justify-between">
                <span>Paper, Raw Materials & Consumables Depletion</span>
                <span className="font-mono text-[#102a43]">
                  {formatCurrency(totalCogs, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Gross Margin Subtotal */}
          <div className="flex items-center justify-between font-bold text-sm p-3 rounded-[8px] bg-[#f5f7fa] border border-[#d9e2ec]">
            <span className="text-[#102a43]">GROSS PROFIT:</span>
            <span className="font-mono text-emerald-700">
              {formatCurrency(grossProfit, organization.currency_symbol)} (
              {grossMargin}%)
            </span>
          </div>

          {/* Section 3: Operating Expenses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#102a43] pb-1 border-b border-[#d9e2ec]">
              <span>3. OPERATING OVERHEAD EXPENSES</span>
              <span className="font-mono text-rose-700">
                ({formatCurrency(totalExpenses, organization.currency_symbol)})
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#627d98]">
              {expenseByCategory.length === 0 ?
                <p className="italic text-[#627d98]">
                  No overhead expenses recorded for this period.
                </p>
              : expenseByCategory.map(([category, amt]) => (
                  <div key={category} className="flex justify-between">
                    <span>{category}</span>
                    <span className="font-mono text-[#102a43]">
                      {formatCurrency(amt, organization.currency_symbol)}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Net Profit Summary */}
          <div className="flex items-center justify-between font-bold text-base p-4 rounded-[8px] bg-[#f5f7fa] border border-[#d9e2ec]">
            <span className="text-[#102a43]">NET OPERATING PROFIT (EBIT):</span>
            <span
              className={`font-mono text-lg font-bold ${
                netProfit >= 0 ? "text-teal-800" : "text-rose-700"
              }`}
            >
              {formatCurrency(netProfit, organization.currency_symbol)}
            </span>
          </div>
        </Card>
      )}

      {/* TAB 2: DETAILED SALES REPORT */}
      {activeTab === "SALES" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#102a43]">
              Sales Invoices ({filteredSales.length} transactions)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Payment Tender</th>
                  <th className="py-2.5 px-3 text-right">Items</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">COGS</th>
                  <th className="py-2.5 px-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredSales.length === 0 ?
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#627d98]">
                      No sales found for the selected timeframe.
                    </td>
                  </tr>
                : filteredSales.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-[#f5f7fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-800">
                        {s.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#627d98]">
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-[#102a43]">
                        {s.customer_name || "Walk-in Customer"}
                      </td>
                      <td className="py-2.5 px-3 text-[#627d98]">
                        {s.cashier_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="slate" size="sm">
                          {s.payment_method}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#627d98]">
                        {s.items.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#102a43]">
                        {formatCurrency(
                          s.grand_total,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                        {formatCurrency(
                          s.total_cogs,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatCurrency(
                          s.gross_profit,
                          organization.currency_symbol,
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: OPERATING EXPENSES REPORT */}
      {activeTab === "EXPENSES" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#102a43]">
              Active Operating Expenses ({filteredExpenses.length} records)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Account Paid From</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Ref #</th>
                  <th className="py-2.5 px-3">Recorded By</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredExpenses.length === 0 ?
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#627d98]">
                      No expenses recorded for the selected timeframe.
                    </td>
                  </tr>
                : filteredExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-[#f5f7fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-[#627d98]">
                        {formatDate(e.date)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                        {e.category_name}
                      </td>
                      <td className="py-2.5 px-3 text-[#627d98]">
                        {e.account_name}
                      </td>
                      <td className="py-2.5 px-3 text-[#243b53]">
                        {e.description}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#627d98]">
                        {e.reference_number || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-[#627d98]">
                        {e.entered_by}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                        {formatCurrency(e.amount, organization.currency_symbol)}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: INVENTORY VALUATION & LOW STOCK */}
      {activeTab === "INVENTORY" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3.5">
              <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
                Total Stock Valuation (WAC Cost)
              </span>
              <p className="text-xl font-mono font-bold text-teal-800 mt-1">
                {formatCurrency(
                  totalStockValuation,
                  organization.currency_symbol,
                )}
              </p>
            </Card>

            <Card className="p-3.5">
              <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
                Total Potential Retail Value
              </span>
              <p className="text-xl font-mono font-bold text-emerald-700 mt-1">
                {formatCurrency(
                  totalRetailPotential,
                  organization.currency_symbol,
                )}
              </p>
            </Card>

            <Card className="p-3.5">
              <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
                Low Stock Warning Items
              </span>
              <p className="text-xl font-mono font-bold text-amber-700 mt-1">
                {lowStockItems.length} Products
              </p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec]">
              <span className="text-xs font-semibold text-[#102a43]">
                Complete Inventory Asset Valuation
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3 text-right">
                      Average Cost (WAC)
                    </th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3 text-right">In Stock</th>
                    <th className="py-2.5 px-3 text-right">
                      Total Asset Value
                    </th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d9e2ec] font-sans">
                  {products.map((p) => {
                    const isLow =
                      p.track_stock && p.current_stock <= p.min_stock_threshold;
                    const val = roundMoney(p.current_stock * p.average_cost);
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#f5f7fa] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[#627d98]">
                          {p.sku}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#627d98]">
                          {p.category_name || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-[#627d98]">{p.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#243b53]">
                          {formatCurrency(
                            p.average_cost,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-teal-800">
                          {formatCurrency(
                            p.selling_price,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              isLow ? "text-rose-700" : "text-[#102a43]"
                            }
                          >
                            {p.current_stock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                          {formatCurrency(val, organization.currency_symbol)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isLow ?
                            <Badge variant="rose" size="sm">
                              Low Stock
                            </Badge>
                          : <Badge variant="emerald" size="sm">
                              Normal
                            </Badge>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: STOCK MOVEMENTS AUDIT FLOW */}
      {activeTab === "MOVEMENTS" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#102a43]">
              Stock In & Out Audit Flow ({filteredMovements.length} events)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                  <th className="py-2.5 px-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredMovements.length === 0 ?
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#627d98]">
                      No stock movements recorded for this timeframe.
                    </td>
                  </tr>
                : filteredMovements.map((m) => {
                    const isPos = m.quantity > 0;
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-[#f5f7fa] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[#627d98]">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                          {m.product_name || "Item"}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="slate" size="sm">
                            {m.movement_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              isPos ? "text-emerald-700" : "text-rose-700"
                            }
                          >
                            {isPos ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#243b53]">
                          {formatCurrency(
                            m.unit_cost,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#243b53]">
                          {formatCurrency(
                            m.total_cost,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#627d98] text-[11px]">
                          {m.notes || "-"}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: TOP PRODUCTS & SERVICES */}
      {activeTab === "TOP_ITEMS" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec]">
            <span className="text-xs font-semibold text-[#102a43]">
              Fastest Moving Products & Services by Billing Volume
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">
                    Total Revenue Generated
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Gross Profit Contribution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {topItemsRanking.length === 0 ?
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#627d98]">
                      No sales data available to rank items.
                    </td>
                  </tr>
                : topItemsRanking.map((it, idx) => (
                    <tr
                      key={it.id}
                      className="hover:bg-[#f5f7fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-[#627d98]">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                        {it.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={it.type === "SERVICE" ? "cyan" : "emerald"}
                          size="sm"
                        >
                          {it.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#102a43]">
                        {it.qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                        {formatCurrency(
                          it.revenue,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                        {formatCurrency(
                          it.profit,
                          organization.currency_symbol,
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 7: PAYMENT TENDERS & CASH FLOW */}
      {activeTab === "PAYMENTS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {paymentMethodsBreakdown.map((pm) => (
              <Card
                key={pm.name}
                className="p-3.5"
              >
                <span className="text-[11px] font-semibold text-[#627d98] uppercase tracking-wider block">
                  {pm.name}
                </span>
                <p className="text-xl font-mono font-bold text-[#102a43] mt-1">
                  {formatCurrency(pm.total, organization.currency_symbol)}
                </p>
                <span className="text-[10px] text-teal-700 font-mono mt-0.5 block">
                  {pm.count} Invoices Collected
                </span>
              </Card>
            ))}
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec]">
              <span className="text-xs font-semibold text-[#102a43]">
                Account Balances & Liquid Funds
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Account #</th>
                    <th className="py-2.5 px-3 text-right">Opening Balance</th>
                    <th className="py-2.5 px-3 text-right">
                      Current Ledger Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d9e2ec] font-sans">
                  {accounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-[#f5f7fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                        {acc.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="slate" size="sm">
                          {acc.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#627d98]">
                        {acc.account_number || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#627d98]">
                        {formatCurrency(
                          acc.opening_balance,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                        {formatCurrency(
                          acc.current_balance,
                          organization.currency_symbol,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 8: CUSTOMER SALES & RECEIVABLES */}
      {activeTab === "CUSTOMERS" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#102a43]">
              Customer Ledger & Outstanding Receivables
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3 text-right">Lifetime Purchases</th>
                  <th className="py-2.5 px-3 text-right">
                    Outstanding Balance / Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {customers.length === 0 ?
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#627d98]">
                      No customer accounts registered.
                    </td>
                  </tr>
                : customers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#f5f7fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#102a43]">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#627d98]">
                        {c.phone || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-[#627d98] text-[11px]">
                        {c.address || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#102a43]">
                        {formatCurrency(
                          c.total_purchases,
                          organization.currency_symbol,
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                        {formatCurrency(
                          c.outstanding_balance,
                          organization.currency_symbol,
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 9: DAILY CLOSINGS AUDIT */}
      {activeTab === "CLOSINGS" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f5f7fa] border-b border-[#d9e2ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#102a43]">
              Daily Cash Register Closing Log ({filteredClosings.length} audits)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d9e2ec] bg-[#f5f7fa] text-[#627d98] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Opening Cash</th>
                  <th className="py-2.5 px-3 text-right">Cash Sales</th>
                  <th className="py-2.5 px-3 text-right">Cash Expenses</th>
                  <th className="py-2.5 px-3 text-right">
                    Expected Drawer Cash
                  </th>
                  <th className="py-2.5 px-3 text-right">Actual Counted</th>
                  <th className="py-2.5 px-3 text-right">
                    Variance / Difference
                  </th>
                  <th className="py-2.5 px-3">Closed By</th>
                  <th className="py-2.5 px-3">Audit Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9e2ec] font-sans">
                {filteredClosings.length === 0 ?
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#627d98]">
                      No daily closing records found for this timeframe.
                    </td>
                  </tr>
                : filteredClosings.map((cl) => {
                    const hasDiscrepancy = cl.difference !== 0;
                    return (
                      <tr
                        key={cl.id}
                        className="hover:bg-[#f5f7fa] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-[#102a43]">
                          {cl.closing_date}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#627d98]">
                          {formatCurrency(
                            cl.opening_cash,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {formatCurrency(
                            cl.cash_sales,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                          {formatCurrency(
                            cl.cash_expenses,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#102a43] font-semibold">
                          {formatCurrency(
                            cl.expected_cash,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-teal-800 font-bold">
                          {formatCurrency(
                            cl.actual_cash,
                            organization.currency_symbol,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              cl.difference === 0 ? "text-emerald-700"
                              : cl.difference > 0 ?
                                "text-teal-700"
                              : "text-rose-700"
                            }
                          >
                            {cl.difference > 0 ?
                              `+${cl.difference}`
                            : cl.difference}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#243b53]">
                          {cl.closed_by}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#627d98] text-[10px]">
                          {formatDateTime(cl.closed_at)}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
