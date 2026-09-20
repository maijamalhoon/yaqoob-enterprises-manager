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
    <header className="h-[68px] border-b border-[#d9e2ec] bg-white px-5 flex items-center justify-between z-20 select-none">
      {/* Left: Organization Branding & Terminal Mode */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#102a43] tracking-tight">
            {organization.name}
          </span>
          <Badge variant="teal" size="sm">
            POS Terminal
          </Badge>
          <span className="hidden sm:inline text-xs text-[#627d98]">
            {organization.currency} · {organization.currency_symbol}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-[#f5f7fa] border border-[#d9e2ec] text-xs text-[#627d98] hover:border-teal-400 hover:text-[#102a43] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[#627d98]" />
            <span>Search products, services, invoices, customers...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#d9e2ec] rounded text-[#627d98]">
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
          className="text-[#243b53]"
        >
          <Receipt className="h-3.5 w-3.5 text-amber-600" />
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
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-[10px] border border-[#d9e2ec] bg-white text-xs text-[#486581] hover:border-teal-400 transition-colors cursor-pointer"
        >
          {isSupabaseReady ?
            <Cloud className="h-3.5 w-3.5 text-emerald-600" />
          : <Database className="h-3.5 w-3.5 text-teal-700" />}
          <span className="hidden lg:inline text-[11px] font-medium">
            {isSupabaseReady ? "Cloud Synced" : "Local DB Active"}
          </span>
        </button>

        {/* Shortcuts Help */}
        <button
          onClick={() => setIsShortcutsHelpOpen(true)}
          title="Keyboard Shortcuts"
          className="p-2 rounded-[10px] text-[#627d98] hover:bg-[#eef2f6] hover:text-[#102a43] transition-colors cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Cashier / User Profile badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#d9e2ec]">
          <div className="h-8 w-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[11px] font-semibold text-teal-800 shrink-0">
            {(user?.full_name || "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-[#102a43] leading-tight">
              {user?.full_name || "Staff Cashier"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-600" />
              <span className="text-[10px] text-[#627d98] uppercase tracking-wider">
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
