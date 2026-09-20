import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
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
} from 'lucide-react';

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
    <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between z-20 select-none">
      {/* Left: Organization Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-cyan-950">
            YE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 tracking-tight">
                {organization.name}
              </span>
              <Badge variant="cyan" size="sm">
                Shop Terminal
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-none mt-0.5">
              Multi-Tenant Cloud • {organization.currency}
            </p>
          </div>
        </div>
      </div>

      {/* Center: Command Palette Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-300 transition-colors shadow-inner cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span>Search products, services, invoices, customers...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right: Quick POS Action, Expense, Supabase status & Cashier */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCurrentView('pos')}
          className="font-semibold shadow-xs"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Quick Sale</span>
          <kbd className="hidden lg:inline text-[10px] opacity-75 font-mono ml-1">Ctrl+N</kbd>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsQuickExpenseOpen(true)}
          className="text-slate-200"
        >
          <Receipt className="h-4 w-4 text-amber-400" />
          <span className="hidden sm:inline">Quick Expense</span>
        </Button>

        {/* Supabase Status Toggle */}
        <button
          onClick={() => setIsSupabaseConfigOpen(true)}
          title={
            isSupabaseReady
              ? 'Supabase Cloud Database Connected & Active'
              : 'Running in Local Storage Engine. Click to configure Supabase'
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-300 hover:border-slate-700 transition-colors cursor-pointer"
        >
          {isSupabaseReady ? (
            <Cloud className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Database className="h-3.5 w-3.5 text-cyan-400" />
          )}
          <span className="hidden lg:inline text-[11px]">
            {isSupabaseReady ? 'Cloud Synced' : 'Local DB Active'}
          </span>
        </button>

        {/* Shortcuts Help */}
        <button
          onClick={() => setIsShortcutsHelpOpen(true)}
          title="Keyboard Shortcuts"
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Cashier / User Profile badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.full_name || 'Staff Cashier'}
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
