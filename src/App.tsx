import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { Header } from "./components/layout/Header";
import { ToastContainer } from "./components/common/ToastContainer";
import { CommandPalette } from "./components/layout/CommandPalette";
import { ShortcutsHelpModal } from "./components/layout/ShortcutsHelpModal";
import { QuickExpenseModal } from "./components/expenses/QuickExpenseModal";
import { AuthScreen, LockScreen } from "./components/auth/LockScreen";

// Modern Shop Ledger Views
import { ChatView } from "./components/chat/ChatView";
import { LedgerDashboardView } from "./components/dashboard/LedgerDashboardView";
import { TransactionsExplorerView } from "./components/sales/TransactionsExplorerView";
import { LedgerReportsView } from "./components/reports/LedgerReportsView";
import { ReviewQueueView } from "./components/closings/ReviewQueueView";
import { LedgerSettingsView } from "./components/settings/LedgerSettingsView";
import { AccountsView } from "./components/accounts/AccountsView";
import {
  ledgerService,
  OFFLINE_SYNC_COMPLETE_EVENT,
} from "./services/ledgerService";

const MainShell: React.FC = () => {
  const { currentView } = useApp();

  useEffect(() => {
    let syncInFlight: Promise<void> | undefined;
    const synchronizeOfflineWork = () => {
      if (syncInFlight) return;
      syncInFlight = ledgerService
        .flushOfflineQueue()
        .then((result) => {
          window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_COMPLETE_EVENT, {
            detail: result,
          }));
        })
        .catch((error: unknown) => {
          console.error("Could not synchronize offline ledger work:", error);
        })
        .finally(() => {
          syncInFlight = undefined;
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") synchronizeOfflineWork();
    };

    synchronizeOfflineWork();
    window.addEventListener("online", synchronizeOfflineWork);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", synchronizeOfflineWork);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const renderActiveView = () => {
    switch (currentView) {
      case "chat":
        return <ChatView />;
      case "dashboard":
        return <LedgerDashboardView />;
      case "sales":
        return <TransactionsExplorerView />;
      case "reports":
        return <LedgerReportsView />;
      case "closings":
        return <ReviewQueueView />;
      case "settings":
        return <LedgerSettingsView />;
      case "accounts":
        return <AccountsView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="app-shell flex h-dvh w-full min-w-0 overflow-hidden font-sans text-on-surface">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary shadow-level-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {renderActiveView()}
        </main>
      </div>

      <MobileNav />

      {/* Global Modals & Overlays */}
      <QuickExpenseModal />
      <CommandPalette />
      <ShortcutsHelpModal />
      <ToastContainer />
    </div>
  );
};

const WorkspaceGate: React.FC = () => {
  const { isLoading, isLocked, user, hasLocalAccount } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center text-text-muted">
        Loading workspace...
      </div>
    );
  }

  // If no user profile or local shop account is configured, show single unified AuthScreen
  if (!user && !hasLocalAccount) {
    return <AuthScreen />;
  }

  // PIN unlock remains optional for accounts that configured it.
  if (isLocked) {
    return <LockScreen />;
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
