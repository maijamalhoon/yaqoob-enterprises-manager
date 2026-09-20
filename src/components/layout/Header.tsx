import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { syncEngine, SyncStatus } from "../../services/syncEngine";
import {
  Search,
  Receipt,
  HelpCircle,
  Database,
  Cloud,
  Wallet,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export const Header: React.FC = () => {
  const { organization, user, isSupabaseReady } = useAuth();
  const {
    setIsQuickExpenseOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsHelpOpen,
    setIsSupabaseConfigOpen,
  } = useApp();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

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
        {/* Register Status indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-[#f2f4f6] border border-[#e6e8ec] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
          <span className="text-xs font-medium text-[#191c1e]">
            Register Open
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

        {/* Supabase / Offline Sync Status Badge */}
        <button
          onClick={() => setIsSupabaseConfigOpen(true)}
          title={
            syncStatus.lastError
              ? `Sync Error: ${syncStatus.lastError} (Click to open Sync Center)`
              : syncStatus.isSyncing
              ? "Cloud synchronization in progress..."
              : syncStatus.pendingCount > 0
              ? `${syncStatus.pendingCount} mutation(s) pending offline queue drain`
              : isSupabaseReady
              ? `Cloud Synchronized. Last: ${syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}`
              : "Running in Local SQLite Store. Click to configure cloud sync."
          }
          className={`h-9 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
            syncStatus.lastError
              ? "bg-[#fef2f2] border-[#fee2e2] text-[#dc2626] hover:bg-[#fee2e2]"
              : syncStatus.isSyncing
              ? "bg-[#e2dfff]/40 border-[#c7d2fe] text-[#3525cd]"
              : syncStatus.pendingCount > 0
              ? "bg-[#fffbeb] border-[#fef3c7] text-[#d97706] hover:bg-[#fef3c7]"
              : "bg-white hover:bg-[#f2f4f6] border-[#e6e8ec] text-[#555f73]"
          }`}
        >
          {syncStatus.isSyncing ? (
            <RefreshCw className="h-3.5 w-3.5 text-[#3525cd] animate-spin" />
          ) : syncStatus.lastError ? (
            <AlertTriangle className="h-3.5 w-3.5 text-[#dc2626]" />
          ) : syncStatus.pendingCount > 0 ? (
            <Cloud className="h-3.5 w-3.5 text-[#d97706]" />
          ) : isSupabaseReady ? (
            <Cloud className="h-3.5 w-3.5 text-[#16a34a]" />
          ) : (
            <Database className="h-3.5 w-3.5 text-[#4f46e5]" />
          )}

          <span className="hidden lg:inline text-[11px] font-medium">
            {syncStatus.isSyncing
              ? "Syncing..."
              : syncStatus.lastError
              ? "Sync Failed"
              : syncStatus.pendingCount > 0
              ? `${syncStatus.pendingCount} Pending`
              : isSupabaseReady
              ? "Synced"
              : "Local DB"}
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
