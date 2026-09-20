import React from "react";
import { useApp, AppView } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
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
} from "lucide-react";
import { cn } from "../../lib/utils";

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();
  const { role, signOut, organization } = useAuth();

  interface NavItem {
    id: AppView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiredRole?: "OWNER" | "MANAGER";
    badge?: string;
  }

  const sections: Array<{
    title: string;
    items: NavItem[];
  }> = [
    {
      title: "Operations",
      items: [
        { id: "pos", label: "Quick Sale (POS)", icon: Zap, badge: "Fast" },
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "inventory", label: "Products & Services", icon: Boxes },
        { id: "sales", label: "Sales History", icon: History },
      ],
    },
    {
      title: "Financials",
      items: [
        { id: "expenses", label: "Expense Ledger", icon: ReceiptText },
        { id: "accounts", label: "Accounts & Cash", icon: Landmark },
        { id: "closings", label: "Daily Cash Closing", icon: Lock },
        { id: "reports", label: "Reports & P&L", icon: BarChart3 },
      ],
    },
    {
      title: "Management",
      items: [
        { id: "customers", label: "Customers", icon: Users },
        { id: "audit", label: "Audit Trail", icon: FileCheck2 },
        {
          id: "users",
          label: "Staff & Roles",
          icon: UserCheck,
          requiredRole: "OWNER",
        },
        { id: "settings", label: "System Settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-[232px] bg-white border-r border-slate-200 flex flex-col justify-between select-none shrink-0 h-full">
      {/* Top Header / Brand in Sidebar */}
      <div className="p-4 border-b border-slate-200 flex items-center gap-3">
        <div className="h-9 w-9 rounded-[9px] bg-teal-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
          YE
        </div>
        <div className="truncate">
          <p className="font-semibold text-xs text-slate-900 tracking-tight truncate leading-tight">
            {organization.name}
          </p>
          <p className="text-[10px] text-slate-500 tracking-tight mt-0.5">
            Business workspace
          </p>
        </div>
      </div>

      {/* Nav List with categorized sections */}
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {sections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !(item.requiredRole === "OWNER" && role !== "OWNER"),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-2 pb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">
                  {section.title}
                </p>
              </div>

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                const isPos = item.id === "pos";

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] text-sm font-medium transition-colors cursor-pointer text-left",
                      isActive ?
                        isPos ? "bg-teal-700 text-white font-semibold"
                        : "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      isPos && !isActive && "text-teal-700 hover:bg-teal-50",
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-current" : "text-slate-400",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold tracking-tight border",
                          isActive ?
                            "bg-white/20 text-white border-white/30"
                          : "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
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
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="rounded-[8px] bg-white p-3 border border-slate-200 mb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span className="font-medium">Workstation</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-teal-700 text-[10px] font-semibold">
                ACTIVE
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Desktop workspace • Local & Cloud Sync
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[8px] text-xs font-semibold text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};
