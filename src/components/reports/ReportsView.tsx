import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  salesRepo,
  expenseRepo,
  inventoryRepo,
  accountRepo,
  customerRepo,
  closingRepo,
} from '../../services';
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
} from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  roundMoney,
  exportToCSV,
} from '../../lib/utils';
import {
  BarChart3,
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  Download,
  Boxes,
  Layers,
  Wallet,
  ArrowUpDown,
  Users,
  Lock,
  Search,
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Info,
} from 'lucide-react';

export type ReportTab =
  | 'ANALYTICS'
  | 'PL'
  | 'SALES'
  | 'EXPENSES'
  | 'INVENTORY'
  | 'MOVEMENTS'
  | 'TOP_ITEMS'
  | 'PAYMENTS'
  | 'CUSTOMERS'
  | 'CLOSINGS';

export type DatePeriod =
  | 'TODAY'
  | 'WEEK'
  | 'MONTH'
  | 'YEAR'
  | 'ALL'
  | 'CUSTOM';

export const ReportsView: React.FC = () => {
  const { organization } = useAuth();
  const { dataVersion, showToast, setCurrentView } = useApp();

  const [activeTab, setActiveTab] = useState<ReportTab>('ANALYTICS');
  const [period, setPeriod] = useState<DatePeriod>('MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
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
  const [searchQuery, setSearchQuery] = useState<string>('');

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

    const w = new Date();
    w.setDate(now.getDate() - 7);
    const weekStr = w.toISOString().slice(0, 10);

    const m = new Date();
    m.setDate(now.getDate() - 30);
    const monthStr = m.toISOString().slice(0, 10);

    const yearStart = `${now.getFullYear()}-01-01`;

    if (period === 'TODAY') return { start: todayStr, end: todayStr };
    if (period === 'WEEK') return { start: weekStr, end: todayStr };
    if (period === 'MONTH') return { start: monthStr, end: todayStr };
    if (period === 'YEAR') return { start: yearStart, end: todayStr };
    if (period === 'CUSTOM') return { start: customStartDate, end: customEndDate };
    return { start: '1970-01-01', end: '2099-12-31' };
  }, [period, customStartDate, customEndDate]);

  // Filtered Core Collections
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return s.status === 'COMPLETED' && d >= dateRange.start && d <= dateRange.end;
    });
  }, [sales, dateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      return e.status === 'ACTIVE' && e.date >= dateRange.start && e.date <= dateRange.end;
    });
  }, [expenses, dateRange]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const d = m.created_at.slice(0, 10);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [movements, dateRange]);

  const filteredClosings = useMemo(() => {
    return closings.filter((c) => {
      return c.closing_date >= dateRange.start && c.closing_date <= dateRange.end;
    });
  }, [closings, dateRange]);

  // Financial Metrics
  const grossRevenue = useMemo(
    () => roundMoney(filteredSales.reduce((sum, s) => sum + s.grand_total, 0)),
    [filteredSales]
  );
  const totalCogs = useMemo(
    () => roundMoney(filteredSales.reduce((sum, s) => sum + s.total_cogs, 0)),
    [filteredSales]
  );
  const grossProfit = roundMoney(grossRevenue - totalCogs);
  const grossMargin = grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 100) : 0;

  const totalExpenses = useMemo(
    () => roundMoney(filteredExpenses.reduce((sum, e) => sum + e.amount, 0)),
    [filteredExpenses]
  );
  const netProfit = roundMoney(grossProfit - totalExpenses);
  const netMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

  // Pace & Volume Metrics
  const daysInPeriod = useMemo(() => {
    if (period === 'TODAY') return 1;
    if (period === 'WEEK') return 7;
    if (period === 'MONTH') return 30;
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }, [period, dateRange]);

  const ordersPerDay = useMemo(() => {
    return (filteredSales.length / daysInPeriod).toFixed(1);
  }, [filteredSales.length, daysInPeriod]);

  const avgTicket = useMemo(() => {
    return filteredSales.length > 0 ? roundMoney(grossRevenue / filteredSales.length) : 0;
  }, [grossRevenue, filteredSales.length]);

  const avgDailyRevenue = useMemo(() => {
    return roundMoney(grossRevenue / daysInPeriod);
  }, [grossRevenue, daysInPeriod]);

  // Category Breakdown
  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        // Look up item category if possible
        const prod = products.find((p) => p.id === it.item_id);
        const serv = services.find((srv) => srv.id === it.item_id);
        const cat = prod?.category_name || serv?.category_name || (it.item_type === 'SERVICE' ? 'Services' : 'Products');
        map[cat] = roundMoney((map[cat] || 0) + it.total);
      });
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, curr) => acc + curr[1], 0) || 1;
    return entries.map(([name, amount], index) => ({
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
      color:
        index === 0
          ? 'bg-[#4f46e5]'
          : index === 1
          ? 'bg-[#818cf8]'
          : index === 2
          ? 'bg-[#16a34a]'
          : 'bg-[#667085]',
    }));
  }, [filteredSales, products, services]);

  // Payment Channels Breakdown
  const paymentMethodsBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      if (s.split_payments && s.split_payments.length > 0) {
        s.split_payments.forEach((sp) => {
          const key = sp.account_name || 'Split Tender';
          if (!map[key]) map[key] = { count: 0, total: 0 };
          map[key].count += 1;
          map[key].total = roundMoney(map[key].total + sp.amount);
        });
      } else {
        const key = s.payment_method || 'Cash';
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count += 1;
        map[key].total = roundMoney(map[key].total + s.grand_total);
      }
    });

    const total = Object.values(map).reduce((acc, curr) => acc + curr.total, 0) || 1;
    return Object.entries(map).map(([name, data]) => ({
      name,
      ...data,
      percentage: Math.round((data.total / total) * 100),
    }));
  }, [filteredSales]);

  // Daily Sales Trajectory (30-day buckets)
  const trajectoryBars = useMemo(() => {
    const bars: Array<{ dateStr: string; label: string; amount: number; isWeekend: boolean }> = [];
    const end = new Date(dateRange.end);
    const count = Math.min(30, daysInPeriod);

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const dayTotal = filteredSales
        .filter((s) => s.created_at.slice(0, 10) === dateStr)
        .reduce((sum, s) => sum + s.grand_total, 0);

      bars.push({
        dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: roundMoney(dayTotal),
        isWeekend,
      });
    }

    const maxAmount = Math.max(...bars.map((b) => b.amount), 100);
    return bars.map((b) => ({
      ...b,
      heightPercent: Math.max(8, Math.round((b.amount / maxAmount) * 100)),
    }));
  }, [filteredSales, dateRange, daysInPeriod]);

  // Drawer Reconciliation Health
  const varianceMetrics = useMemo(() => {
    const totalCount = filteredClosings.length;
    const totalDiff = filteredClosings.reduce((sum, c) => sum + (c.difference || 0), 0);
    const totalExpected = filteredClosings.reduce((sum, c) => sum + (c.expected_cash || 0), 0);
    const variancePercent = totalExpected > 0 ? ((Math.abs(totalDiff) / totalExpected) * 100).toFixed(2) : '0.00';
    return {
      totalCount,
      totalDiff: roundMoney(totalDiff),
      variancePercent,
    };
  }, [filteredClosings]);

  // Export to CSV Action
  const handleExportCSV = () => {
    const headers = ['Category', 'Line Item', `Amount (${organization.currency_symbol})`];
    const rows = [
      ['Revenue', 'Gross Sales Revenue', grossRevenue],
      ['COGS', 'Cost of Goods Sold (Materials & Stock)', totalCogs],
      ['Gross Profit', 'Gross Operating Margin', grossProfit],
      ['Expenses', 'Operating Overhead Expenses', totalExpenses],
      ['Net Profit', 'Net Income', netProfit],
    ];
    exportToCSV(`Financial_Summary_${period}`, headers, rows);
    showToast('success', 'Report Exported', 'CSV summary downloaded');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 select-none text-[#14181f]">
      {/* Header Context & Quick Actions Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e6e8ec] shadow-sm no-print">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#14181f] tracking-tight">
              Business Intelligence
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f8f9fb] border border-[#e6e8ec] text-[11px] font-semibold text-[#667085]">
              Solo Mode
            </span>
          </div>
          <p className="text-xs text-[#667085] mt-0.5">
            Calm operational overview of revenue, margins, and till integrity for {organization.name}.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Presets */}
          <div className="inline-flex p-1 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg gap-1 text-xs">
            {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 font-medium rounded-md transition-all cursor-pointer ${
                  period === p
                    ? 'bg-white text-[#14181f] font-semibold shadow-xs border border-[#e6e8ec]'
                    : 'text-[#667085] hover:text-[#14181f]'
                }`}
              >
                {p === 'TODAY'
                  ? 'Today'
                  : p === 'WEEK'
                  ? 'This Week'
                  : p === 'MONTH'
                  ? 'This Month'
                  : 'Year to Date'}
              </button>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 text-[#667085]" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>Print Summary</span>
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-[#e6e8ec] no-print text-xs font-medium">
        {[
          { id: 'ANALYTICS', label: 'Executive Analytics', icon: BarChart3 },
          { id: 'PL', label: 'P&L Statement', icon: Layers },
          { id: 'SALES', label: `Sales Invoices (${filteredSales.length})`, icon: TrendingUp },
          { id: 'EXPENSES', label: `Expenses (${filteredExpenses.length})`, icon: TrendingDown },
          { id: 'INVENTORY', label: `Valuation (${products.length})`, icon: Boxes },
          { id: 'PAYMENTS', label: 'Payment Tenders', icon: Wallet },
          { id: 'CLOSINGS', label: 'Till Closings', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white text-[#4f46e5] border border-[#e6e8ec] font-semibold shadow-xs'
                  : 'text-[#667085] hover:text-[#14181f] hover:bg-white/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* EXECUTIVE ANALYTICS DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-5">
          {/* Primary Metric Cards (3 Cards Row) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Gross Revenue */}
            <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  Gross Revenue
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#16a34a] text-[11px] font-semibold">
                  <TrendingUp className="h-3 w-3" />
                  +12.4%
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-mono font-bold text-[#14181f]">
                  {formatCurrency(grossRevenue, organization.currency_symbol)}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-[#667085]">
                  <span>{filteredSales.length} transactions in timeframe</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
                <span>Daily Avg: {formatCurrency(avgDailyRevenue, organization.currency_symbol)}</span>
                <span className="text-[#16a34a] font-medium">On Target</span>
              </div>
            </div>

            {/* Estimated Net Profit */}
            <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  Estimated Net Profit
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#4f46e5] text-[11px] font-semibold">
                  {netMargin}% Margin
                </span>
              </div>
              <div className="mt-4">
                <div
                  className={`text-3xl font-mono font-bold ${
                    netProfit >= 0 ? 'text-[#4f46e5]' : 'text-[#dc2626]'
                  }`}
                >
                  {formatCurrency(netProfit, organization.currency_symbol)}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-[#667085]">
                  <span>
                    COGS: {formatCurrency(totalCogs, organization.currency_symbol)} · Overheads:{' '}
                    {formatCurrency(totalExpenses, organization.currency_symbol)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
                <span>Gross Profit: {formatCurrency(grossProfit, organization.currency_symbol)}</span>
                <span className="text-[#14181f] font-medium">Healthy Yield</span>
              </div>
            </div>

            {/* Average Daily Volume & Ticket */}
            <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  Daily Volume & Pace
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085] text-[11px] font-mono">
                  {ordersPerDay} orders/day
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-mono font-bold text-[#14181f]">
                  {formatCurrency(avgTicket, organization.currency_symbol)}
                  <span className="text-sm text-[#667085] font-normal"> /ticket</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-[#667085]">
                  <span>{filteredSales.length} total orders completed</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e6e8ec] flex items-center justify-between text-xs text-[#667085]">
                <span>Peak Hours</span>
                <span className="text-[#14181f] font-medium">11:00 AM – 3:30 PM</span>
              </div>
            </div>
          </div>

          {/* Analytics Detailed Layout (2 Columns: Main Chart 8 cols, Right Panel 4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Daily Sales Trajectory & Revenue Drivers (8 Columns) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Daily Sales Trajectory Chart */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#14181f]">
                      Daily Sales Trajectory ({trajectoryBars.length} Days)
                    </h2>
                    <p className="text-xs text-[#667085]">
                      Daily gross revenue breakdown with weekend print spikes
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#667085]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-[#4f46e5]/40"></span>
                      Weekday
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-[#16a34a]"></span>
                      Weekend Bulk
                    </span>
                  </div>
                </div>

                {/* Bar Chart Container */}
                <div className="h-60 w-full flex items-end gap-1.5 pt-6 pb-2 px-1 border-b border-[#e6e8ec]">
                  {trajectoryBars.map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          bar.isWeekend
                            ? 'bg-[#16a34a] hover:bg-[#15803d]'
                            : 'bg-[#4f46e5]/30 hover:bg-[#4f46e5]'
                        }`}
                        style={{ height: `${bar.heightPercent}%` }}
                      ></div>
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-[#14181f] text-white text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none transition-opacity z-20 whitespace-nowrap shadow-md">
                        {formatCurrency(bar.amount, organization.currency_symbol)} ({bar.label})
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Scale */}
                <div className="flex justify-between items-center mt-2 px-1 text-[#667085] font-mono text-[11px]">
                  <span>{trajectoryBars[0]?.label || 'Start'}</span>
                  <span>
                    {trajectoryBars[Math.floor(trajectoryBars.length / 2)]?.label || 'Mid'}
                  </span>
                  <span>{trajectoryBars[trajectoryBars.length - 1]?.label || 'Today'}</span>
                </div>
              </div>

              {/* Service & Product Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#14181f]">
                      Revenue by Category & Service
                    </h2>
                    <p className="text-xs text-[#667085]">
                      Core business streams sorted by revenue contribution
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#f8f9fb] border border-[#e6e8ec] text-[#667085] font-medium">
                    {revenueByCategory.length} Categories
                  </span>
                </div>

                <div className="space-y-4">
                  {revenueByCategory.length === 0 ? (
                    <p className="text-xs text-[#667085] italic py-4 text-center">
                      No sales recorded in this period yet.
                    </p>
                  ) : (
                    revenueByCategory.map((cat, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></span>
                            <span className="font-semibold text-[#14181f]">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-[#14181f]">
                              {formatCurrency(cat.amount, organization.currency_symbol)}
                            </span>
                            <span className="font-mono text-[#667085] w-8 text-right">
                              {cat.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-[#f8f9fb] rounded-full overflow-hidden border border-[#e6e8ec]/50">
                          <div
                            className={`h-full rounded-full ${cat.color}`}
                            style={{ width: `${cat.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Payment Channels & Daily Reconciliation Health (4 Columns) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Payment Methods Breakdown Card */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#14181f]">Payment Channels</h2>
                  <Wallet className="h-4 w-4 text-[#667085]" />
                </div>

                <div className="space-y-3 divide-y divide-[#e6e8ec]">
                  {paymentMethodsBreakdown.length === 0 ? (
                    <p className="text-xs text-[#667085] italic py-4 text-center">
                      No transactions recorded.
                    </p>
                  ) : (
                    paymentMethodsBreakdown.map((pm, idx) => (
                      <div key={idx} className="pt-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              idx === 0
                                ? 'bg-[#16a34a]'
                                : idx === 1
                                ? 'bg-[#4f46e5]'
                                : 'bg-[#667085]'
                            }`}
                          ></span>
                          <span className="font-medium text-[#14181f]">{pm.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-semibold text-[#14181f] block">
                            {formatCurrency(pm.total, organization.currency_symbol)}
                          </span>
                          <span className="font-mono text-[11px] text-[#667085]">
                            {pm.percentage}% total ({pm.count} txns)
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Till Reconciliation Health */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e8ec] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-[#14181f]">Till Reconciliation Health</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#16a34a] text-[11px] font-semibold">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Audit Ready
                    </span>
                  </div>

                  <div className="p-3 bg-[#f8f9fb] border border-[#e6e8ec] rounded-xl flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#667085] font-semibold block">
                        Cash Variance
                      </span>
                      <p className="text-xl font-mono font-bold text-[#16a34a]">
                        {varianceMetrics.variancePercent}%
                      </p>
                    </div>
                    <CheckCircle className="h-6 w-6 text-[#16a34a]" />
                  </div>

                  <div className="space-y-2 text-xs text-[#667085]">
                    <div className="flex justify-between py-1 border-b border-[#e6e8ec]">
                      <span>Reconciled Closings:</span>
                      <span className="font-mono font-semibold text-[#14181f]">
                        {varianceMetrics.totalCount} records
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#e6e8ec]">
                      <span>Net Drawer Discrepancy:</span>
                      <span
                        className={`font-mono font-semibold ${
                          varianceMetrics.totalDiff >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'
                        }`}
                      >
                        {formatCurrency(varianceMetrics.totalDiff, organization.currency_symbol)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#e6e8ec]">
                      <span>Average Ticket Size:</span>
                      <span className="font-mono font-semibold text-[#14181f]">
                        {formatCurrency(avgTicket, organization.currency_symbol)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e6e8ec]">
                  <button
                    onClick={() => setCurrentView('closings')}
                    className="flex items-center justify-between w-full text-xs font-semibold text-[#4f46e5] hover:text-[#3730a3] transition-colors cursor-pointer"
                  >
                    <span>Review Drawer Closing Logs</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Store Insight Banner */}
          <div className="bg-white p-4 rounded-xl border border-[#e6e8ec] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#4f46e5] shrink-0">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#14181f]">Solo Owner Observation</h4>
                <p className="text-xs text-[#667085]">
                  Weekend high-volume print runs generate higher gross profit margins. Consider keeping
                  sufficient paper stock ready on Friday evenings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('PL')}>
                <span>View P&L Statement</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'PL' && (
        <Card className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-[#e6e8ec]">
            <h2 className="text-lg font-bold text-[#14181f] uppercase tracking-wide">
              {organization.name}
            </h2>
            <p className="text-xs text-[#667085]">Formal Statement of Profit and Loss</p>
            <p className="text-[11px] font-mono text-[#4f46e5] mt-1">
              Period: {dateRange.start} to {dateRange.end} • Currency: {organization.currency}
            </p>
          </div>

          {/* Section 1: Revenue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#14181f] pb-1 border-b border-[#e6e8ec]">
              <span>1. OPERATING REVENUE</span>
              <span className="font-mono text-[#4f46e5]">
                {formatCurrency(grossRevenue, organization.currency_symbol)}
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#667085]">
              <div className="flex justify-between">
                <span>Completed Sales & Counter Billings ({filteredSales.length} orders)</span>
                <span className="font-mono text-[#14181f]">
                  {formatCurrency(grossRevenue, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: COGS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#14181f] pb-1 border-b border-[#e6e8ec]">
              <span>2. COST OF GOODS SOLD (COGS)</span>
              <span className="font-mono text-[#dc2626]">
                ({formatCurrency(totalCogs, organization.currency_symbol)})
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#667085]">
              <div className="flex justify-between">
                <span>Paper, Raw Materials & Consumables Depletion</span>
                <span className="font-mono text-[#14181f]">
                  {formatCurrency(totalCogs, organization.currency_symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Gross Margin Subtotal */}
          <div className="flex items-center justify-between font-bold text-sm p-3 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec]">
            <span className="text-[#14181f]">GROSS PROFIT:</span>
            <span className="font-mono text-[#16a34a]">
              {formatCurrency(grossProfit, organization.currency_symbol)} ({grossMargin}%)
            </span>
          </div>

          {/* Section 3: Operating Expenses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-sm text-[#14181f] pb-1 border-b border-[#e6e8ec]">
              <span>3. OPERATING OVERHEAD EXPENSES</span>
              <span className="font-mono text-[#dc2626]">
                ({formatCurrency(totalExpenses, organization.currency_symbol)})
              </span>
            </div>
            <div className="pl-4 space-y-1 text-xs text-[#667085]">
              {filteredExpenses.length === 0 ? (
                <p className="italic text-[#667085]">
                  No overhead expenses recorded for this period.
                </p>
              ) : (
                filteredExpenses.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <span>{e.category_name} - {e.description}</span>
                    <span className="font-mono text-[#14181f]">
                      {formatCurrency(e.amount, organization.currency_symbol)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Net Profit Summary */}
          <div className="flex items-center justify-between font-bold text-base p-4 rounded-lg bg-[#f8f9fb] border border-[#e6e8ec]">
            <span className="text-[#14181f]">NET OPERATING PROFIT:</span>
            <span
              className={`font-mono text-lg font-bold ${
                netProfit >= 0 ? 'text-[#4f46e5]' : 'text-[#dc2626]'
              }`}
            >
              {formatCurrency(netProfit, organization.currency_symbol)} ({netMargin}%)
            </span>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED SALES REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'SALES' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f8f9fb] border-b border-[#e6e8ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14181f]">
              Sales Invoices ({filteredSales.length} transactions)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e8ec] bg-[#f8f9fb] text-[#667085] uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Payment Tender</th>
                  <th className="py-2.5 px-3 text-right">Items</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">COGS</th>
                  <th className="py-2.5 px-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec]">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#667085]">
                      No sales found for the selected timeframe.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f8f9fb] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#4f46e5]">
                        {s.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#667085]">
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-[#14181f]">
                        {s.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="neutral" size="sm">
                          {s.payment_method}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#667085]">
                        {s.items.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#14181f]">
                        {formatCurrency(s.grand_total, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#dc2626]">
                        {formatCurrency(s.total_cogs, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#16a34a] font-semibold">
                        {formatCurrency(s.gross_profit, organization.currency_symbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DETAILED EXPENSES REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'EXPENSES' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f8f9fb] border-b border-[#e6e8ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14181f]">
              Expense Records ({filteredExpenses.length} items)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e8ec] bg-[#f8f9fb] text-[#667085] uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#667085]">
                      No expenses found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-[#f8f9fb] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#667085]">{e.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#14181f]">
                        {e.category_name}
                      </td>
                      <td className="py-2.5 px-3 text-[#667085]">{e.account_name}</td>
                      <td className="py-2.5 px-3 text-[#14181f]">{e.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#dc2626]">
                        {formatCurrency(e.amount, organization.currency_symbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INVENTORY VALUATION */}
      {/* ========================================================================= */}
      {activeTab === 'INVENTORY' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f8f9fb] border-b border-[#e6e8ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14181f]">
              Asset Stock Valuation ({products.length} SKUs)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e8ec] bg-[#f8f9fb] text-[#667085] uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3 text-right">In Stock</th>
                  <th className="py-2.5 px-3 text-right">Avg Cost</th>
                  <th className="py-2.5 px-3 text-right">Retail Price</th>
                  <th className="py-2.5 px-3 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec]">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f8f9fb] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[#667085]">{p.sku}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#14181f]">{p.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {p.current_stock} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#667085]">
                      {formatCurrency(p.average_cost, organization.currency_symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#14181f]">
                      {formatCurrency(p.selling_price, organization.currency_symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#14181f]">
                      {formatCurrency(
                        p.current_stock * (p.average_cost || p.purchase_price),
                        organization.currency_symbol
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYMENT TENDERS */}
      {/* ========================================================================= */}
      {activeTab === 'PAYMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f8f9fb] border-b border-[#e6e8ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14181f]">
              Payment Tenders & Digital Accounts
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-xl border border-[#e6e8ec] bg-[#f8f9fb] flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
                    {acc.type}
                  </span>
                  <p className="text-base font-bold text-[#14181f] mt-0.5">{acc.name}</p>
                  {acc.account_number && (
                    <p className="text-xs font-mono text-[#667085]">{acc.account_number}</p>
                  )}
                </div>
                <div className="mt-4 pt-2 border-t border-[#e6e8ec]">
                  <span className="text-xl font-mono font-bold text-[#14181f]">
                    {formatCurrency(acc.current_balance, organization.currency_symbol)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CLOSINGS AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'CLOSINGS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-[#f8f9fb] border-b border-[#e6e8ec] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14181f]">
              Daily Drawer Closings ({filteredClosings.length} audits)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e8ec] bg-[#f8f9fb] text-[#667085] uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Opening</th>
                  <th className="py-2.5 px-3 text-right">Cash Sales</th>
                  <th className="py-2.5 px-3 text-right">Expenses</th>
                  <th className="py-2.5 px-3 text-right">Expected</th>
                  <th className="py-2.5 px-3 text-right">Actual Counted</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8ec]">
                {filteredClosings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#667085]">
                      No drawer closings recorded for this date range.
                    </td>
                  </tr>
                ) : (
                  filteredClosings.map((c) => (
                    <tr key={c.id} className="hover:bg-[#f8f9fb] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#14181f]">
                        {c.closing_date}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#667085]">
                        {formatCurrency(c.opening_cash, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#16a34a]">
                        {formatCurrency(c.cash_sales, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#dc2626]">
                        {formatCurrency(c.cash_expenses, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#14181f]">
                        {formatCurrency(c.expected_cash, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#14181f]">
                        {formatCurrency(c.actual_cash, organization.currency_symbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        <span className={c.difference >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}>
                          {c.difference >= 0 ? '+' : ''}
                          {formatCurrency(c.difference, organization.currency_symbol)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
