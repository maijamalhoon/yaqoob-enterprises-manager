import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import {
  Search,
  Receipt,
  HelpCircle,
  LockKeyhole,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";
import { QuickEntryBar } from "../chat/QuickEntryBar";

export const Header: React.FC = () => {
  const { organization, user, lock, signOut, hasPinSetup } = useAuth();
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
    <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-standard bg-white/95 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <img src="/assets/logo.svg" alt="" className="h-8 w-8 rounded-lg" />
        <span className="truncate text-[13px] font-bold tracking-tight text-on-surface">
          {organization.name || "Shop Pro"}
        </span>
      </div>
      {/* Center Desktop Quick-Entry Bar ("/" shortcut) */}
      <div className="hidden lg:flex flex-1 max-w-xl mx-4">
        <QuickEntryBar />
      </div>

      {/* Right Utility & Profile Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Quick Expense Shortcut */}
        <button
          onClick={() => setIsQuickExpenseOpen(true)}
          title="Quick Expense (Ctrl+Shift+E)"
          aria-label="Quick expense"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-standard bg-white text-xs font-semibold text-on-surface shadow-xs transition-colors hover:border-primary/25 hover:bg-surface-container-low sm:w-auto sm:gap-2 sm:px-3"
        >
          <Receipt className="h-4 w-4 text-tertiary" />
          <span className="hidden sm:inline">Expense</span>
        </button>

        {/* Keyboard Shortcuts Help */}
        <button
          onClick={() => setIsShortcutsHelpOpen(true)}
          title="Keyboard Shortcuts"
          className="hidden h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface sm:flex"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <div className="hidden h-5 w-px bg-border-standard sm:block" />

        {/* Lock Register Shortcut Button */}
        {hasPinSetup && (
          <button
            onClick={lock}
            title="Lock register (4-digit PIN required to resume)"
            aria-label="Lock register"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface sm:flex"
          >
            <LockKeyhole className="h-4 w-4" />
          </button>
        )}

        {/* User Profile Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-controls="profile-menu"
            aria-label="Open account menu"
            className="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-container-low"
          >
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name || organization.owner_name || "Owner"}
              size="sm"
            />
            <div className="flex flex-col text-left leading-tight hidden sm:flex">
              <span className="max-w-[150px] truncate text-xs font-semibold text-on-surface">
                {user?.full_name || organization.owner_name || "Owner"}
              </span>
              <span className="truncate text-[11px] text-text-muted">
                {organization.name || "Store"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[#98a2b3] hidden sm:inline" />
          </button>

          {isMenuOpen && (
            <div
              id="profile-menu"
              className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border-standard bg-white p-1.5 shadow-level-2"
            >
              <div className="px-3 py-2 border-b border-[#f2f4f6]">
                <p className="text-xs font-bold text-[#191c1e] truncate">
                  {user?.full_name || organization.owner_name || "Owner"}
                </p>
                <p className="text-[11px] text-[#667085] truncate">
                  {user?.email || organization.email || ""}
                </p>
              </div>

              <div className="py-1">
                {hasPinSetup && (
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
                )}

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
