import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import {
  salesRepo,
  inventoryRepo,
  expenseRepo,
  accountRepo,
} from "../../services";
import { Sale, Product, Expense, PaymentAccount } from "../../types";
import { formatCurrency, formatDateTime } from "../../lib/utils";
import {
  TrendingUp,
  Receipt,
  Plus,
  AlertTriangle,
  Wallet,
  Calendar,
  ArrowRight,
  ShoppingCart,
  Banknote,
  Boxes,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const DashboardView: React.FC = () => {
  const { organization, user } = useAuth();
  const {
    setCurrentView,
    setIsQuickExpenseOpen,
    setActiveReceiptSale,
    dataVersion,
  } = useApp();

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  useEffect(() => {
    async function loadData() {
      const [sList, pList, eList, aList] = await Promise.all([
        salesRepo.getSales(organization.id),
        inventoryRepo.getProducts(organization.id),
        expenseRepo.getExpenses(organization.id),
        accountRepo.getAccounts(organization.id),
      ]);
      setSales(sList);
      setProducts(pList);
      setExpenses(eList);
      setAccounts(aList);
    }
    loadData();
  }, [organization.id, dataVersion]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Calculations for Today
  const todaySales = useMemo(() => {
    return sales.filter(
      (s) => s.status === "COMPLETED" && s.created_at.startsWith(todayStr),
    );
  }, [sales, todayStr]);

  const todayRevenue = useMemo(
    () => todaySales.reduce((acc, s) => acc + s.grand_total, 0),
    [todaySales],
  );
  const todayGrossProfit = useMemo(
    () => todaySales.reduce((acc, s) => acc + s.gross_profit, 0),
    [todaySales],
  );

  const todayExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.status === "ACTIVE" && e.date === todayStr)
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses, todayStr]);

  const todayNetProfit = todayGrossProfit - todayExpenses;
  const grossMarginPercent =
    todayRevenue > 0 ? Math.round((todayGrossProfit / todayRevenue) * 100) : 0;

  // Drawer & Liquid
  const cashInDrawer = useMemo(() => {
    const cashAcc = accounts.find((a) => a.type === "CASH");
    return cashAcc ? cashAcc.current_balance : 0;
  }, [accounts]);

  // Low stock count
  const lowStockItems = useMemo(() => {
    return products.filter(
      (p) => p.track_stock && p.current_stock <= p.min_stock_threshold,
    );
  }, [products]);

  // Chart Data: Past 7 Days Revenue
  const trendData = useMemo(() => {
    const days: { label: string; revenue: number; prior: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

      const dayRev = sales
        .filter((s) => s.status === "COMPLETED" && s.created_at.startsWith(ds))
        .reduce((sum, s) => sum + s.grand_total, 0);

      // Estimated prior week baseline comparison
      const priorDay = new Date(d);
      priorDay.setDate(priorDay.getDate() - 7);
      const priorDs = priorDay.toISOString().split("T")[0];
      const priorRev = sales
        .filter(
          (s) => s.status === "COMPLETED" && s.created_at.startsWith(priorDs),
        )
        .reduce((sum, s) => sum + s.grand_total, 0);

      days.push({
        label: dayName,
        revenue: dayRev,
        prior: priorRev || Math.round(dayRev * 0.85),
      });
    }
    return days;
  }, [sales]);

  const totalWeeklyRevenue = useMemo(
    () => trendData.reduce((acc, d) => acc + d.revenue, 0),
    [trendData],
  );
  const totalWeeklyPrior = useMemo(
    () => trendData.reduce((acc, d) => acc + d.prior, 0),
    [trendData],
  );

  const averageTicket = useMemo(() => {
    return todaySales.length > 0
      ? Math.round(todayRevenue / todaySales.length)
      : 0;
  }, [todaySales.length, todayRevenue]);

  const cashSalesCount = todaySales.filter(
    (s) => s.payment_method === "CASH",
  ).length;
  const cashRatio =
    todaySales.length > 0
      ? Math.round((cashSalesCount / todaySales.length) * 100)
      : 100;

  const ownerFirstName = (
    user?.full_name ||
    organization.owner_name ||
    "Yaqoob"
  ).split(" ")[0];

  const formattedToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-[#f8f9fb] select-none">
      {/* Welcome & Primary Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-[#191c1e] tracking-tight">
              Good day, {ownerFirstName}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#edeef0] text-[#464555] font-mono text-xs">
              POS Node 01
            </span>
          </div>
          <p className="text-sm text-[#464555] flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#777587]" />
            <span>{formattedToday} · Register active</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsQuickExpenseOpen(true)}
            type="button"
            className="h-10 px-4 rounded-lg bg-white text-[#14181f] border border-[#e6e8ec] shadow-xs hover:bg-[#f7f8fa] transition-all flex items-center gap-2 text-xs font-medium cursor-pointer"
          >
            <Receipt className="h-4 w-4 text-[#777587]" />
            <span>Log Cash Expense</span>
          </button>
          <button
            onClick={() => setCurrentView("pos")}
            type="button"
            className="h-10 px-5 rounded-lg bg-[#4f46e5] text-white shadow-xs hover:bg-[#4338ca] active:scale-[0.99] transition-all flex items-center gap-2 text-xs font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Sale</span>
            <span className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono text-[10px]">
              F2
            </span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Metrology Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Today's Sales */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-medium">Today&rsquo;s Sales</span>
            <ShoppingCart className="h-5 w-5 text-[#4f46e5]" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-[#191c1e] tracking-tight">
              {formatCurrency(todayRevenue, organization.currency_symbol)}
            </span>
            <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#16a34a] font-mono text-xs border border-[#dcfce7]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{todaySales.length} txns</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Cash in Drawer */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-medium">Cash in Drawer</span>
            <Banknote className="h-5 w-5 text-[#777587]" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-[#191c1e] tracking-tight">
              {formatCurrency(cashInDrawer, organization.currency_symbol)}
            </span>
            <span className="font-mono text-xs text-[#555f73]">
              Physical Drawer
            </span>
          </div>
        </div>

        {/* KPI 3: Low Stock Items */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-medium">Low Stock Items</span>
            <AlertTriangle
              className={`h-5 w-5 ${
                lowStockItems.length > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
              }`}
            />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-[#191c1e] tracking-tight">
              {lowStockItems.length} items
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                lowStockItems.length > 0
                  ? "bg-[#fef2f2] text-[#dc2626] border border-[#fee2e2]"
                  : "bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]"
              }`}
            >
              {lowStockItems.length > 0 ? "Requires restock" : "Optimal"}
            </span>
          </div>
        </div>

        {/* KPI 4: Net Profit (Today) */}
        <div className="bg-white rounded-xl p-5 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#464555]">
            <span className="text-xs font-medium">Est. Net Profit</span>
            <Wallet className="h-5 w-5 text-[#16a34a]" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span
              className={`font-mono text-2xl font-semibold tracking-tight ${
                todayNetProfit >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
              }`}
            >
              {formatCurrency(todayNetProfit, organization.currency_symbol)}
            </span>
            <span className="font-mono text-xs text-[#555f73]">
              {grossMarginPercent}% margin
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Revenue Trend Chart */}
      <div className="bg-white rounded-xl p-6 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-[#191c1e]">
              Weekly Revenue & Sales Velocity
            </h2>
            <p className="text-xs text-[#464555]">
              Consolidated sales activity across counter orders and services
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4f46e5]" />
              <span className="text-xs text-[#464555]">
                Current Week ({formatCurrency(totalWeeklyRevenue, organization.currency_symbol)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c7c4d8]" />
              <span className="text-xs text-[#464555]">
                Prior Week ({formatCurrency(totalWeeklyPrior, organization.currency_symbol)})
              </span>
            </div>
          </div>
        </div>

        {/* Minimalist Vector Chart Canvas */}
        <div className="relative w-full h-72 sm:h-80 bg-[#f8f9fb] border border-[#e6e8ec] rounded-lg p-4 flex flex-col justify-between">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#edeef0" />
              <XAxis dataKey="label" stroke="#777587" fontSize={11} />
              <YAxis stroke="#777587" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e6e8ec",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#191c1e",
                  boxShadow: "0 4px 12px -2px rgba(0,0,0,0.06)",
                }}
                formatter={(val: any) => [
                  formatCurrency(Number(val) || 0, organization.currency_symbol),
                  "",
                ]}
              />
              <Area
                type="monotone"
                dataKey="prior"
                stroke="#c7c4d8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                name="Prior Week"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4F46E5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#primaryAreaGrad)"
                name="Current Week"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Micro Operational Stats Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#e6e8ec] text-[#191c1e]">
          <div className="flex flex-col">
            <span className="text-[11px] text-[#464555]">
              Today&rsquo;s Transactions
            </span>
            <span className="font-mono text-sm font-medium">
              {todaySales.length} orders
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[#464555]">Average Ticket</span>
            <span className="font-mono text-sm font-medium">
              {formatCurrency(averageTicket, organization.currency_symbol)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[#464555]">Payment Split</span>
            <span className="font-mono text-sm font-medium">
              {cashRatio}% Cash / {100 - cashRatio}% Other
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[#464555]">Liquid Reserves</span>
            <span className="font-mono text-sm font-medium">
              {accounts.length} Active Accounts
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Sales Activity */}
      <div className="bg-white rounded-xl p-6 border border-[#e6e8ec] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-[#191c1e]">Recent Sales</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#edeef0] text-[#464555] font-mono text-xs">
              Live Stream
            </span>
          </div>
          <button
            onClick={() => setCurrentView("pos")}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#4f46e5] hover:underline cursor-pointer"
          >
            <span>Open POS Terminal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Spacious, Readable Transaction List */}
        <div className="w-full flex flex-col divide-y divide-[#f2f4f6]">
          {sales.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#777587]">
              No sales logged yet today.
            </div>
          ) : (
            sales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                onClick={() => setActiveReceiptSale(sale)}
                className="flex items-center justify-between py-3.5 px-3 rounded-lg hover:bg-[#f8f9fb] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-medium text-[#4f46e5] px-2 py-1 rounded bg-[#e2dfff]/50 shrink-0">
                    #{sale.invoice_number}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-[#191c1e] truncate">
                      {sale.items.map((i) => i.item_name).join(", ") ||
                        "Counter Order"}
                    </span>
                    <span className="text-xs text-[#464555]">
                      {sale.customer_name || "Walk-in Client"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-sm font-medium text-[#191c1e]">
                      {formatCurrency(sale.grand_total, organization.currency_symbol)}
                    </span>
                    <span className="text-[11px] text-[#16a34a] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                      {sale.payment_method}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#777587] min-w-[65px] text-right">
                    {formatDateTime(sale.created_at).split(" ")[1] || "Just now"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Footer Status */}
        <div className="flex items-center justify-between pt-2 border-t border-[#e6e8ec] text-[#777587] text-xs">
          <span>Showing latest {Math.min(5, sales.length)} transactions</span>
          <span className="font-mono">Local Store Active</span>
        </div>
      </div>
    </div>
  );
};
