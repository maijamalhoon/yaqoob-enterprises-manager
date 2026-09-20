import React, { useState, useEffect } from "react";
import { useApp, AppView } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Landmark,
  Receipt,
  Users,
  BarChart3,
  PiggyBank,
  Settings,
  Lock,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();
  const { lock } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  interface NavItem {
    id: AppView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "pos", label: "POS", icon: ShoppingCart },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "accounts", label: "Accounts", icon: Landmark },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "customers", label: "Customers", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "closings", label: "Closings", icon: PiggyBank },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#e6e8ec] flex flex-col justify-between select-none shrink-0 h-full z-40">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Top Header / Brand */}
        <div className="h-16 px-4 border-b border-[#e6e8ec] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/logo.svg"
              alt="Yaqoob Enterprises Logo"
              className="h-8 w-8 object-contain rounded-lg shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "./assets/logo.svg";
              }}
            />
            <div className="flex flex-col leading-tight truncate">
              <span className="font-semibold text-sm text-[#191c1e] tracking-tight truncate">
                Yaqoob Enterprises
              </span>
              <span className="text-[11px] text-[#464555] truncate">
                Store & Services
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer text-left",
                  isActive
                    ? "bg-[#4f46e5] text-white font-medium shadow-xs"
                    : "text-[#464555] hover:bg-[#f2f4f6] hover:text-[#191c1e]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0",
                    isActive ? "text-white" : "text-[#777587]",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Session bar */}
      <div className="p-3 border-t border-[#e6e8ec] space-y-2 bg-[#f8f9fb]">
        {/* Status indicator */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border border-[#e6e8ec] rounded-lg shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
            <span className="text-xs font-medium text-[#191c1e]">
              Register Open
            </span>
          </div>
          <span className="font-mono text-xs text-[#555f73]">
            {currentTime || "Active"}
          </span>
        </div>

        {/* Lock Terminal Button */}
        <button
          onClick={lock}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[#555f73] hover:text-[#191c1e] hover:bg-white hover:border-[#e6e8ec] border border-transparent rounded-lg transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-[#777587]" />
            <span>Lock Register</span>
          </span>
          <span className="font-mono text-[10px] text-[#777587] bg-[#edeef0] px-1.5 py-0.5 rounded">
            ⌥L
          </span>
        </button>
      </div>
    </aside>
  );
};
