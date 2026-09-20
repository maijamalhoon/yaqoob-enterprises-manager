import React from 'react';
import { useApp, AppView } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Zap,
  LayoutDashboard,
  Boxes,
  History,
  ReceiptText,
  Landmark,
  Users,
  Lock,
  BarChart3,
  FileCheck2,
  UserCheck,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();
  const { role, signOut } = useAuth();

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiredRole?: 'OWNER' | 'MANAGER';
    badge?: string;
  }> = [
    { id: 'pos', label: 'Quick Sale (POS)', icon: Zap, badge: 'Fast' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Products & Services', icon: Boxes },
    { id: 'sales', label: 'Sales History', icon: History },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'accounts', label: 'Accounts & Cash', icon: Landmark },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'closings', label: 'Daily Cash Closing', icon: Lock },
    { id: 'reports', label: 'Reports & P&L', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: FileCheck2 },
    { id: 'users', label: 'Staff & Roles', icon: UserCheck, requiredRole: 'OWNER' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col justify-between select-none shrink-0 h-[calc(100vh-3.5rem)]">
      <div className="py-3 px-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Workspace
          </p>
        </div>

        {navItems.map((item) => {
          if (item.requiredRole === 'OWNER' && role !== 'OWNER') {
            return null;
          }

          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isPos = item.id === 'pos';

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left',
                isActive
                  ? isPos
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-950 font-semibold'
                    : 'bg-slate-800 text-cyan-400 font-semibold border border-slate-700/60'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100',
                isPos && !isActive && 'text-cyan-400 hover:bg-cyan-950/40'
              )}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-current' : 'text-slate-400')} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded font-mono font-bold tracking-tight',
                    isActive ? 'bg-cyan-700 text-cyan-100' : 'bg-cyan-950/80 text-cyan-400'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Session bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800 mb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Terminal Mode</span>
            <span className="font-mono text-emerald-400 font-medium">ONLINE</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Tauri 2 Desktop Ready • PostgreSQL / SQLite Sync
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};
