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
  const { role, signOut, organization } = useAuth();

  interface NavItem {
    id: AppView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiredRole?: 'OWNER' | 'MANAGER';
    badge?: string;
  }

  const sections: Array<{
    title: string;
    items: NavItem[];
  }> = [
    {
      title: 'Operations',
      items: [
        { id: 'pos', label: 'Quick Sale (POS)', icon: Zap, badge: 'Fast' },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inventory', label: 'Products & Services', icon: Boxes },
        { id: 'sales', label: 'Sales History', icon: History },
      ],
    },
    {
      title: 'Financials',
      items: [
        { id: 'expenses', label: 'Expense Ledger', icon: ReceiptText },
        { id: 'accounts', label: 'Accounts & Cash', icon: Landmark },
        { id: 'closings', label: 'Daily Cash Closing', icon: Lock },
        { id: 'reports', label: 'Reports & P&L', icon: BarChart3 },
      ],
    },
    {
      title: 'Management',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'audit', label: 'Audit Trail', icon: FileCheck2 },
        { id: 'users', label: 'Staff & Roles', icon: UserCheck, requiredRole: 'OWNER' },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-60 bg-slate-950/95 border-r border-slate-800/80 flex flex-col justify-between select-none shrink-0 h-full">
      {/* Top Header / Brand in Sidebar */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-indigo-950/60 shrink-0">
          YE
        </div>
        <div className="truncate">
          <p className="font-semibold text-xs text-slate-100 tracking-tight truncate leading-tight">
            {organization.name}
          </p>
          <p className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">
            Enterprise Manager
          </p>
        </div>
      </div>

      {/* Nav List with categorized sections */}
      <div className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {sections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !(item.requiredRole === 'OWNER' && role !== 'OWNER')
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                const isPos = item.id === 'pos';

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left',
                      isActive
                        ? isPos
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'bg-slate-800/90 text-white font-semibold border border-slate-700/60 shadow-2xs'
                        : 'text-slate-300 hover:bg-slate-900/80 hover:text-slate-100',
                      isPos && !isActive && 'text-indigo-400 hover:bg-indigo-950/20'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-current' : 'text-slate-400'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold tracking-tight border',
                          isActive
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom Session bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
        <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/80 mb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="font-medium">Workstation</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-emerald-400 text-[10px] font-semibold">ACTIVE</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Tauri 2 Desktop • Local & Cloud Sync
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};
