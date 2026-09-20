import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  salesRepo,
  inventoryRepo,
  expenseRepo,
  accountRepo,
  customerRepo,
} from '../../services';
import { Sale, Product, Expense, PaymentAccount, Customer } from '../../types';
import { Card, CardHeader, CardTitle } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Lock,
  ArrowUpRight,
  Boxes,
  Users,
  Building2,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

export const DashboardView: React.FC = () => {
  const { organization, role } = useAuth();
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
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function loadData() {
      const [sList, pList, eList, aList, cList] = await Promise.all([
        salesRepo.getSales(organization.id),
        inventoryRepo.getProducts(organization.id),
        expenseRepo.getExpenses(organization.id),
        accountRepo.getAccounts(organization.id),
        customerRepo.getCustomers(organization.id),
      ]);
      setSales(sList);
      setProducts(pList);
      setExpenses(eList);
      setAccounts(aList);
      setCustomers(cList);
    }
    loadData();
  }, [organization.id, dataVersion]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculations for Today
  const todaySales = useMemo(() => {
    return sales.filter(
      (s) => s.status === 'COMPLETED' && s.created_at.startsWith(todayStr)
    );
  }, [sales, todayStr]);

  const todayRevenue = useMemo(
    () => todaySales.reduce((acc, s) => acc + s.grand_total, 0),
    [todaySales]
  );
  const todayGrossProfit = useMemo(
    () => todaySales.reduce((acc, s) => acc + s.gross_profit, 0),
    [todaySales]
  );
  const todayCOGS = useMemo(
    () => todaySales.reduce((acc, s) => acc + s.total_cogs, 0),
    [todaySales]
  );

  const todayExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.status === 'ACTIVE' && e.date === todayStr)
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses, todayStr]);

  const todayNetProfit = todayGrossProfit - todayExpenses;
  const grossMarginPercent =
    todayRevenue > 0 ? Math.round((todayGrossProfit / todayRevenue) * 100) : 0;

  // Account Balances
  const cashInDrawer = useMemo(() => {
    const cashAcc = accounts.find((a) => a.type === 'CASH');
    return cashAcc ? cashAcc.current_balance : 0;
  }, [accounts]);

  const totalLiquidBalances = useMemo(
    () => accounts.reduce((acc, a) => acc + a.current_balance, 0),
    [accounts]
  );

  const totalReceivables = useMemo(
    () => customers.reduce((acc, c) => acc + (c.outstanding_balance || 0), 0),
    [customers]
  );

  // Low-Stock Products Alert (where current_stock <= min_stock_threshold)
  const lowStockItems = useMemo(() => {
    return products.filter(
      (p) => p.track_stock && p.current_stock <= p.min_stock_threshold
    );
  }, [products]);

  // Fast-Moving Products calculation (total quantity sold in history)
  const topSellingItems = useMemo(() => {
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales
      .filter((s) => s.status === 'COMPLETED')
      .forEach((s) => {
        s.items.forEach((item) => {
          if (!itemMap[item.item_id]) {
            itemMap[item.item_id] = { name: item.item_name, qty: 0, revenue: 0 };
          }
          itemMap[item.item_id].qty += item.quantity;
          itemMap[item.item_id].revenue += item.total;
        });
      });
    return Object.values(itemMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  // Chart Data: Past 7 Days Revenue & Expenses
  const trendData = useMemo(() => {
    const days: { date: string; label: string; revenue: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayRev = sales
        .filter((s) => s.status === 'COMPLETED' && s.created_at.startsWith(ds))
        .reduce((sum, s) => sum + s.grand_total, 0);

      const dayExp = expenses
        .filter((e) => e.status === 'ACTIVE' && e.date === ds)
        .reduce((sum, e) => sum + e.amount, 0);

      days.push({
        date: ds,
        label: dayName,
        revenue: dayRev,
        expense: dayExp,
      });
    }
    return days;
  }, [sales, expenses]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950 select-none">
      {/* Top Header: Title & Quick Launch Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Executive Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time financial performance, inventory telemetry & cash drawer status.
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCurrentView('pos')}
            className="font-bold shadow-xs"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>New Sale</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsQuickExpenseOpen(true)}
            className="text-slate-200"
          >
            <Receipt className="h-4 w-4 text-amber-400" />
            <span>Expense</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('closings')}
            className="text-slate-300"
          >
            <Lock className="h-4 w-4 text-cyan-400" />
            <span>Daily Closing</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Today's Sales */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Today&rsquo;s Sales
          </span>
          <p className="text-lg sm:text-xl font-mono font-bold text-slate-100 mt-1">
            {formatCurrency(todayRevenue, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-cyan-400 font-mono mt-1 block">
            {todaySales.length} Transactions
          </span>
        </Card>

        {/* Gross Profit */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Gross Profit
          </span>
          <p className="text-lg sm:text-xl font-mono font-bold text-emerald-400 mt-1">
            {formatCurrency(todayGrossProfit, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-emerald-500 font-mono mt-1 block">
            Margin: {grossMarginPercent}%
          </span>
        </Card>

        {/* Net Profit Estimate */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Est. Net Profit
          </span>
          <p
            className={`text-lg sm:text-xl font-mono font-bold mt-1 ${
              todayNetProfit >= 0 ? 'text-teal-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(todayNetProfit, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            GP minus Expenses
          </span>
        </Card>

        {/* Expenses Today */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Today&rsquo;s Expenses
          </span>
          <p className="text-lg sm:text-xl font-mono font-bold text-amber-400 mt-1">
            {formatCurrency(todayExpenses, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-amber-500 font-mono mt-1 block">
            Recorded Ledger
          </span>
        </Card>

        {/* Cash in Drawer */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Cash in Drawer
          </span>
          <p className="text-lg sm:text-xl font-mono font-bold text-cyan-300 mt-1">
            {formatCurrency(cashInDrawer, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">Physical Drawer</span>
        </Card>

        {/* Total Liquid Balances */}
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Liquid Funds
          </span>
          <p className="text-lg sm:text-xl font-mono font-bold text-purple-300 mt-1">
            {formatCurrency(totalLiquidBalances, organization.currency_symbol)}
          </p>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">All Accounts</span>
        </Card>
      </div>

      {/* Financial Accounts Breakdown Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            onClick={() => setCurrentView('accounts')}
            className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-colors flex items-center justify-between cursor-pointer"
          >
            <div className="truncate pr-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                {acc.type}
              </span>
              <p className="text-xs font-semibold text-slate-200 truncate">{acc.name}</p>
            </div>
            <span className="text-sm font-mono font-bold text-cyan-300">
              {formatCurrency(acc.current_balance, organization.currency_symbol)}
            </span>
          </div>
        ))}
      </div>

      {/* Main Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Revenue & Expense Flow */}
        <Card className="lg:col-span-2 p-4">
          <CardHeader className="mb-3">
            <div>
              <CardTitle>Revenue & Expense Velocity (Last 7 Days)</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparison of completed sales against daily operating expenditures.
              </p>
            </div>
          </CardHeader>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [
                    formatCurrency(Number(val) || 0, organization.currency_symbol),
                    '',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Sales Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpense)"
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right Col: Top-Selling & Fast-Moving Items */}
        <Card className="p-4">
          <CardHeader className="mb-3">
            <div>
              <CardTitle>Fast-Moving Items</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Top performing items by volume.</p>
            </div>
          </CardHeader>

          <div className="space-y-2.5">
            {topSellingItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No completed sales recorded yet.
              </p>
            ) : (
              topSellingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Sold: {item.qty} units
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-cyan-300">
                    {formatCurrency(item.revenue, organization.currency_symbol)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row: Low-Stock Alerts & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low-Stock Inventory Alerts */}
        <Card className="p-4">
          <CardHeader className="mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle>Low Stock Alerts</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('inventory')}
              className="text-xs"
            >
              Manage Stock
            </Button>
          </CardHeader>

          <div className="space-y-2">
            {lowStockItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                All inventory items are currently above safety thresholds.
              </div>
            ) : (
              lowStockItems.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40"
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-200 truncate">{prod.name}</p>
                      {prod.sku && (
                        <span className="text-[10px] font-mono text-slate-400">{prod.sku}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Min threshold: {prod.min_stock_threshold} {prod.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={prod.current_stock <= 0 ? 'rose' : 'amber'} size="sm">
                      {prod.current_stock} {prod.unit} left
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Completed Sales */}
        <Card className="p-4">
          <CardHeader className="mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <CardTitle>Recent Sales Transactions</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('sales')}
              className="text-xs"
            >
              View All
            </Button>
          </CardHeader>

          <div className="space-y-2">
            {sales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                onClick={() => setActiveReceiptSale(sale)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-800/80 cursor-pointer transition-colors"
              >
                <div className="truncate pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      #{sale.invoice_number}
                    </span>
                    <span className="text-xs text-slate-300 truncate">
                      {sale.customer_name || 'Walk-in'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDateTime(sale.created_at)} • {sale.payment_method}
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-cyan-300">
                    {formatCurrency(sale.grand_total, organization.currency_symbol)}
                  </span>
                  <div className="mt-0.5">
                    <Badge
                      variant={sale.status === 'COMPLETED' ? 'emerald' : 'rose'}
                      size="sm"
                    >
                      {sale.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
