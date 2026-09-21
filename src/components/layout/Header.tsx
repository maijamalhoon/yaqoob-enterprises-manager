import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { Search, Receipt, HelpCircle, LockKeyhole, Settings, LogOut, ChevronDown } from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";

export const Header: React.FC = () => {
  const { organization, user, lock, signOut } = useAuth();
  const {
    setIsQuickExpenseOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsHelpOpen,
    setCurrentView,
  } = useApp();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        {/* Quick Expense Shortcut */}
        <button
          onClick={() => setIsQuickExpenseOpen(true)}
          title="Quick Expense (Ctrl+Shift+E)"
          className="h-9 px-3 rounded-lg border border-[#e6e8ec] bg-white hover:bg-[#f2f4f6] text-xs font-medium text-[#14181f] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Receipt className="h-3.5 w-3.5 text-[#d97706]" />
          <span className="hidden sm:inline">Expense</span>
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

        {/* Lock Register Shortcut Button */}
        <button
          onClick={lock}
          title="Lock register (4-digit PIN required to resume)"
          aria-label="Lock register"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555f73] transition-colors hover:bg-[#f2f4f6] hover:text-[#191c1e] cursor-pointer"
        >
          <LockKeyhole className="h-4 w-4" />
        </button>

        {/* User Profile Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-[#f2f4f6] transition cursor-pointer"
          >
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name || organization.owner_name || "Owner"}
              size="sm"
            />
            <div className="flex flex-col text-left leading-tight hidden sm:flex">
              <span className="text-xs font-semibold text-[#191c1e] max-w-[130px] truncate">
                {user?.full_name || organization.owner_name || "Owner"}
              </span>
              <span className="text-[11px] text-[#667085] truncate">
                {organization.name || "Store"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[#98a2b3] hidden sm:inline" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#e6e8ec] bg-white p-1.5 shadow-[0_12px_32px_rgba(25,28,30,0.08)] z-50">
              <div className="px-3 py-2 border-b border-[#f2f4f6]">
                <p className="text-xs font-bold text-[#191c1e] truncate">
                  {user?.full_name || organization.owner_name || "Owner"}
                </p>
                <p className="text-[11px] text-[#667085] truncate">
                  {user?.email || organization.email || ""}
                </p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setCurrentView("settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#191c1e] rounded-lg hover:bg-[#f8f9fb] transition cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-[#777587]" />
                  <span>Profile & Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    lock();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#191c1e] rounded-lg hover:bg-[#f8f9fb] transition cursor-pointer"
                >
                  <LockKeyhole className="h-3.5 w-3.5 text-[#777587]" />
                  <span>Lock Register</span>
                </button>
              </div>

              <div className="pt-1 border-t border-[#f2f4f6]">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#dc2626] rounded-lg hover:bg-[#fef2f2] transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-[#dc2626]" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
