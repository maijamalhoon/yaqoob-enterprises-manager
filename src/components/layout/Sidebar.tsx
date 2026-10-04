import React from "react";
import { useApp, AppView } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import {
  MessageSquare,
  LayoutDashboard,
  Receipt,
  BarChart3,
  Inbox,
  Settings,
  Lock,
  Wallet,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();
  const { lock, hasPinSetup, organization } = useAuth();

  interface NavItem {
    id: AppView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const navItems: NavItem[] = [
    { id: "chat", label: "Shop Ledger", icon: MessageSquare },
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "sales", label: "Transactions", icon: Receipt },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "closings", label: "Review Queue", icon: Inbox },
    { id: "settings", label: "Settings & Export", icon: Settings },
  ];

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col justify-between border-r border-border-standard bg-white md:flex xl:w-64">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Top Header / Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border-standard px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/logo.svg"
              alt="Shop Pro"
              className="h-8 w-8 object-contain rounded-lg shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "./assets/logo.svg";
              }}
            />
            <div className="flex flex-col leading-tight truncate">
              <span className="truncate text-sm font-semibold text-on-surface">
                Shop Pro
              </span>
              <span className="truncate text-[11px] text-text-muted">
                {organization.name || "Business management"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 px-3 py-4"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-left text-sm transition-colors",
                  isActive ?
                    "border-l-primary bg-primary/10 font-semibold text-primary"
                  : "text-secondary hover:bg-surface-container-low hover:text-on-surface",
                )}
              >
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0",
                    isActive ? "text-primary" : "text-text-muted",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Session bar */}
      {hasPinSetup && (
        <div className="border-t border-border-standard bg-surface p-3">
          <button
            onClick={lock}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm font-medium text-secondary transition-colors hover:bg-white hover:text-on-surface"
          >
            <Lock className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Lock Register
          </button>
        </div>
      )}
    </aside>
  );
};
