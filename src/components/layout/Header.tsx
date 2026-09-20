import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import {
  Search,
  ShoppingCart,
  Receipt,
  HelpCircle,
  Database,
  Cloud,
  ShieldCheck,
  Building2,
  ChevronDown,
} from "lucide-react";

export const Header: React.FC = () => {
  const { organization, user, role, isSupabaseReady } = useAuth();
  const {
    setCurrentView,
    setIsQuickExpenseOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsHelpOpen,
    setIsSupabaseConfigOpen,
  } = useApp();

  return (
    <header className="h-[68px] border-b border-slate-200 bg-white px-5 flex items-center justify-between z-20 select-none">
      {/* Left: Organization Branding & Terminal Mode */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-900 tracking-tight">
            {organization.name}
          </span>
          <Badge variant="indigo" size="sm">
            POS Terminal
          </Badge>
          <span className="hidden sm:inline text-xs text-slate-500">
            {organization.currency} · {organization.currency_symbol}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] bg-slate-50 border border-slate-200 text-xs text-slate-500 hover:border-teal-300 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span>Search products, services, invoices, customers...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-500">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right: Quick POS Action, Expense, Supabase status & Cashier */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCurrentView("pos")}
          className="font-medium shadow-xs"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quick Sale</span>
          <kbd className="hidden lg:inline text-[10px] opacity-75 font-mono ml-1">
            F1
          </kbd>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsQuickExpenseOpen(true)}
          className="text-slate-700"
        >
          <Receipt className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">Expense</span>
        </Button>

        {/* Supabase Status Toggle */}
        <button
          onClick={() => setIsSupabaseConfigOpen(true)}
          title={
            isSupabaseReady ?
              "Supabase Cloud Database Connected & Active"
            : "Running in Local Storage Engine. Click to configure Supabase"
          }
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] border border-slate-200 bg-white text-xs text-slate-600 hover:border-teal-300 transition-colors cursor-pointer"
        >
          {isSupabaseReady ?
            <Cloud className="h-3.5 w-3.5 text-emerald-400" />
          : <Database className="h-3.5 w-3.5 text-indigo-400" />}
          <span className="hidden lg:inline text-[11px] font-medium">
            {isSupabaseReady ? "Cloud Synced" : "Local DB Active"}
          </span>
        </button>

        {/* Shortcuts Help */}
        <button
          onClick={() => setIsShortcutsHelpOpen(true)}
          title="Keyboard Shortcuts"
          className="p-2 rounded-[8px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Cashier / User Profile badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
          <div className="h-8 w-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[11px] font-semibold text-teal-800 shrink-0">
            {(user?.full_name || "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {user?.full_name || "Staff Cashier"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
