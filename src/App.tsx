import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastContainer } from './components/common/ToastContainer';
import { CommandPalette } from './components/layout/CommandPalette';
import { ShortcutsHelpModal } from './components/layout/ShortcutsHelpModal';
import { SupabaseConfigModal } from './components/layout/SupabaseConfigModal';
import { QuickExpenseModal } from './components/expenses/QuickExpenseModal';
import { PrintReceiptModal } from './components/pos/PrintReceiptModal';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { QuickSaleView } from './components/pos/QuickSaleView';
import { InventoryView } from './components/inventory/InventoryView';
import { SalesHistoryView } from './components/sales/SalesHistoryView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { AccountsView } from './components/accounts/AccountsView';
import { CustomersView } from './components/customers/CustomersView';
import { DailyClosingView } from './components/closings/DailyClosingView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditView } from './components/audit/AuditView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';

const MainShell: React.FC = () => {
  const { currentView } = useApp();

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <QuickSaleView />;
      case 'inventory':
        return <InventoryView />;
      case 'sales':
        return <SalesHistoryView />;
      case 'expenses':
        return <ExpensesView />;
      case 'accounts':
        return <AccountsView />;
      case 'customers':
        return <CustomersView />;
      case 'closings':
        return <DailyClosingView />;
      case 'reports':
        return <ReportsView />;
      case 'audit':
        return <AuditView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-950">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Overlays */}
      <QuickExpenseModal />
      <PrintReceiptModal />
      <CommandPalette />
      <ShortcutsHelpModal />
      <SupabaseConfigModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </AuthProvider>
  );
}
