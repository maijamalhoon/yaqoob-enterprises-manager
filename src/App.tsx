import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ToastContainer } from "./components/common/ToastContainer";
import { CommandPalette } from "./components/layout/CommandPalette";
import { ShortcutsHelpModal } from "./components/layout/ShortcutsHelpModal";
import { QuickExpenseModal } from "./components/expenses/QuickExpenseModal";
import { PrintReceiptModal } from "./components/pos/PrintReceiptModal";
import { LockScreen, SignUpScreen } from "./components/auth/LockScreen";

// Views
import { DashboardView } from "./components/dashboard/DashboardView";
import { QuickSaleView } from "./components/pos/QuickSaleView";
import { InventoryView } from "./components/inventory/InventoryView";
import { SalesHistoryView } from "./components/sales/SalesHistoryView";
import { ExpensesView } from "./components/expenses/ExpensesView";
import { AccountsView } from "./components/accounts/AccountsView";
import { CustomersView } from "./components/customers/CustomersView";
import { DailyClosingView } from "./components/closings/DailyClosingView";
import { ReportsView } from "./components/reports/ReportsView";
import { SettingsView } from "./components/settings/SettingsView";

const MainShell: React.FC = () => {
  const { currentView } = useApp();

  const renderActiveView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />;
      case "pos":
        return <QuickSaleView />;
      case "inventory":
        return <InventoryView />;
      case "sales":
        return <SalesHistoryView />;
      case "expenses":
        return <ExpensesView />;
      case "accounts":
        return <AccountsView />;
      case "customers":
        return <CustomersView />;
      case "closings":
        return <DailyClosingView />;
      case "reports":
        return <ReportsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden font-sans text-[#191c1e]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden bg-[#f8f9fb]">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Overlays */}
      <QuickExpenseModal />
      <PrintReceiptModal />
      <CommandPalette />
      <ShortcutsHelpModal />
      <ToastContainer />
    </div>
  );
};

const WorkspaceGate: React.FC = () => {
  const { isLoading, isLocked, hasLocalAccount } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center text-[#667085]">
        Loading workspace...
      </div>
    );
  }

  if (isLocked) {
    return hasLocalAccount ? <LockScreen /> : <SignUpScreen />;
  }

  return <MainShell />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <WorkspaceGate />
      </AppProvider>
    </AuthProvider>
  );
}
