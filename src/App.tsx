import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ToastContainer } from "./components/common/ToastContainer";
import { CommandPalette } from "./components/layout/CommandPalette";
import { ShortcutsHelpModal } from "./components/layout/ShortcutsHelpModal";
import { SupabaseConfigModal } from "./components/layout/SupabaseConfigModal";
import { QuickExpenseModal } from "./components/expenses/QuickExpenseModal";
import { PrintReceiptModal } from "./components/pos/PrintReceiptModal";
import { Button } from "./components/common/Button";
import { Input } from "./components/common/Input";

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
import { AuditView } from "./components/audit/AuditView";
import { UsersView } from "./components/users/UsersView";
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
      case "audit":
        return <AuditView />;
      case "users":
        return <UsersView />;
      case "settings":
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

const AuthenticationGate: React.FC = () => {
  const { user, isLoading, error, signIn, signUp, clearError } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] =
    useState("Yaqoob Enterprises");
  const [busy, setBusy] = useState(false);

  if (isLoading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Loading secure session...
      </div>
    );
  if (user) return <MainShell />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setBusy(true);
    const result =
      isCreating ?
        await signUp(email, password, fullName, organizationName)
      : await signIn(email, password);
    if (result.error) setBusy(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Yaqoob Enterprises
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {isCreating ? "Create owner account" : "Sign in to your workspace"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Authentication is required before business data is available.
          </p>
        </div>
        {isCreating && (
          <Input
            label="Full name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        )}
        {isCreating && (
          <Input
            label="Organization name"
            required
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
          />
        )}
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={busy}>
          {isCreating ? "Create secure workspace" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setIsCreating((value) => !value);
            clearError();
          }}
          className="w-full text-sm text-cyan-700 hover:text-cyan-900"
        >
          {isCreating ?
            "Already have an account? Sign in"
          : "First setup? Create an owner account"}
        </button>
      </form>
    </main>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AuthenticationGate />
      </AppProvider>
    </AuthProvider>
  );
}
