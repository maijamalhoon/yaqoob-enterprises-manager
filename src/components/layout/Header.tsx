import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import {
  Search,
  Receipt,
  HelpCircle,
  Database,
  Cloud,
  Wallet,
} from "lucide-react";

export const Header: React.FC = () => {
  const { organization, user, isSupabaseReady } = useAuth();
  const {
    setIsQuickExpenseOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsHelpOpen,
    setIsSupabaseConfigOpen,
  } = useApp();

  return (
    <header className="h-16 border-b border-[#e6e8ec] bg-white/95 backdrop-blur-md px-6 flex items-center justify-between z-30 select-none shrink-0">
      {/* Search Bar / Command Palette trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="relative flex items-center w-72 sm:w-80 h-10 pl-9 pr-4 bg-[#f2f4f6] hover:bg-[#edeef0] border border-[#e6e8ec] rounded-lg text-sm text-[#777587] transition-all cursor-pointer text-left"
        >
          <Search className="absolute left-3 h-4 w-4 text-[#777587]" />
          <span className="truncate">Search items, invoices, customers...</span>
          <kbd className="ml-auto text-[10px] font-mono bg-white border border-[#e6e8ec] px-1.5 py-0.5 rounded text-[#555f73]">
            /
          </kbd>
        </button>
      </div>

      {/* Right Utility & Profile Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick Drawer Balance indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] border border-[#e6e8ec] rounded-lg">
          <Wallet className="h-4 w-4 text-[#16a34a]" />
          <span className="font-mono text-xs font-medium text-[#191c1e]">
            Till #1 · Active
          </span>
        </div>

        {/* Quick Expense Shortcut */}
        <button
          onClick={() => setIsQuickExpenseOpen(true)}
          title="Quick Expense (Ctrl+Shift+E)"
          className="h-9 px-3 rounded-lg border border-[#e6e8ec] bg-white hover:bg-[#f2f4f6] text-xs font-medium text-[#14181f] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Receipt className="h-3.5 w-3.5 text-[#d97706]" />
          <span className="hidden sm:inline">Expense</span>
        </button>

        {/* Supabase Status Toggle */}
        <button
          onClick={() => setIsSupabaseConfigOpen(true)}
          title={
            isSupabaseReady
              ? "Supabase Cloud Database Connected & Active"
              : "Running in Local SQLite Store. Click to configure cloud sync."
          }
          className="h-9 px-2.5 rounded-lg border border-[#e6e8ec] bg-white hover:bg-[#f2f4f6] text-xs text-[#555f73] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isSupabaseReady ? (
            <Cloud className="h-3.5 w-3.5 text-[#16a34a]" />
          ) : (
            <Database className="h-3.5 w-3.5 text-[#4f46e5]" />
          )}
          <span className="hidden lg:inline text-[11px] font-medium">
            {isSupabaseReady ? "Cloud Sync" : "Local DB"}
          </span>
        </button>

        {/* Keyboard Shortcuts Help */}
        <button
          onClick={() => setIsShortcutsHelpOpen(true)}
          title="Keyboard Shortcuts"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#555f73] hover:bg-[#f2f4f6] hover:text-[#191c1e] transition-colors cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-[#e6e8ec]" />

        {/* Owner Profile & Portrait Avatar */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col text-right leading-tight hidden sm:flex">
            <span className="text-xs font-medium text-[#191c1e]">
              {user?.full_name || organization.owner_name || "Muhammad Yaqoob"}
            </span>
            <span className="text-[11px] text-[#555f73]">Owner</span>
          </div>
          <img
            src="/assets/owner-avatar.png"
            alt="Owner Avatar"
            className="w-8 h-8 rounded-full object-cover border border-[#e6e8ec] shadow-xs"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "./assets/owner-avatar.png";
            }}
          />
        </div>
      </div>
    </header>
  );
};
