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
    { id: "chat", label: "Ledger", icon: MessageSquare },
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "sales", label: "Entries", icon: Receipt },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "closings", label: "Review Queue", icon: Inbox },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col justify-between border-r border-border-standard bg-white md:flex">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Top Header / Brand */}
        <div className="flex h-[4.25rem] items-center border-b border-border-standard px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/assets/logo.svg"
              alt="Shop Pro"
              className="h-9 w-9 shrink-0 rounded-xl object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "./assets/logo.svg";
              }}
            />
            <div className="flex flex-col leading-tight truncate">
              <span className="truncate text-sm font-bold tracking-tight text-on-surface">
                Shop Pro
              </span>
              <span className="truncate pt-0.5 text-[11px] text-text-muted">
                {organization.name || "Business management"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 px-3 py-5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-[13px] transition-colors",
                  isActive ?
                    "border-primary/10 bg-primary/[0.07] font-semibold text-primary"
                  : "text-secondary hover:bg-surface-container-low hover:text-on-surface",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
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
        <div className="border-t border-border-standard p-3">
          <button
            onClick={lock}
            className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <Lock className="h-4 w-4 text-text-muted" aria-hidden="true" />
            Lock Register
          </button>
        </div>
      )}
    </aside>
  );
};
