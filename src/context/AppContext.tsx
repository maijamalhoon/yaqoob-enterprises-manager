import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Sale } from "../types";

export type AppView =
  | "pos"
  | "dashboard"
  | "inventory"
  | "sales"
  | "expenses"
  | "accounts"
  | "customers"
  | "closings"
  | "reports"
  | "settings";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
}

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  dataVersion: number;
  refreshData: () => void;
  toasts: ToastMessage[];
  showToast: (
    type: ToastMessage["type"],
    title: string,
    message?: string,
  ) => void;
  removeToast: (id: string) => void;
  isQuickExpenseOpen: boolean;
  setIsQuickExpenseOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isShortcutsHelpOpen: boolean;
  setIsShortcutsHelpOpen: (open: boolean) => void;
  activeReceiptSale: Sale | null;
  setActiveReceiptSale: (sale: Sale | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentView, setCurrentView] = useState<AppView>("pos"); // Default to Quick Sale as highest priority
  const [dataVersion, setDataVersion] = useState<number>(1);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] =
    useState<boolean>(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] =
    useState<boolean>(false);
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const showToast = useCallback(
    (type: ToastMessage["type"], title: string, message?: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+N, Ctrl+Shift+E, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+N -> New Sale (Switch to Quick Sale view)
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        setCurrentView("pos");
        showToast("info", "Quick Sale Mode", "Switched to POS terminal");
        return;
      }

      // Ctrl+Shift+E -> New Quick Expense
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "e"
      ) {
        e.preventDefault();
        setIsQuickExpenseOpen(true);
        return;
      }

      // Escape -> close dialogs
      if (e.key === "Escape") {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isQuickExpenseOpen) setIsQuickExpenseOpen(false);
        if (isShortcutsHelpOpen) setIsShortcutsHelpOpen(false);
        if (activeReceiptSale) setActiveReceiptSale(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isQuickExpenseOpen,
    isShortcutsHelpOpen,
    activeReceiptSale,
    showToast,
  ]);

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        dataVersion,
        refreshData,
        toasts,
        showToast,
        removeToast,
        isQuickExpenseOpen,
        setIsQuickExpenseOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isShortcutsHelpOpen,
        setIsShortcutsHelpOpen,
        activeReceiptSale,
        setActiveReceiptSale,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
