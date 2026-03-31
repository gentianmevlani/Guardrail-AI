"use client";

import { useDashboardContext } from "@/context/dashboard-context";
import { logout } from "@/lib/api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  Bell,
  HelpCircle,
  LogOut,
  Search,
  Settings,
  User,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navTabs = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Security", href: "/security" },
  { label: "Logs", href: "/runs" },
  { label: "Compliance", href: "/compliance" },
  { label: "Assets", href: "/vault" },
];

export function CyberHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { notifications } = useDashboardContext();
  const unreadCount = notifications.unreadCount;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (error) {
      logger.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="w-full h-14 border-b border-white/5 sticky top-0 z-50 cyber-header-glass flex justify-between items-center px-6">
      {/* Left: Brand + Nav */}
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/guardrail-logo.svg"
            alt="guardrail"
            width={140}
            height={28}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "font-display tracking-tight text-sm uppercase transition-all duration-300",
                isActive(tab.href)
                  ? "text-cyan-400 border-b-2 border-cyan-400 pb-1"
                  : "text-slate-400 font-medium hover:text-white"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search (hidden on mobile) */}
        <button
          className="hidden md:flex text-slate-400 cursor-pointer hover:bg-white/5 p-2 rounded transition-all duration-300 hover:text-white"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <Link
          href="/activity"
          className="relative text-slate-400 cursor-pointer hover:bg-white/5 p-2 rounded transition-all duration-300 hover:text-white"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          )}
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className="text-slate-400 cursor-pointer hover:bg-white/5 p-2 rounded transition-all duration-300 hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* Help */}
        <Link
          href="/cli"
          className="text-slate-400 cursor-pointer hover:bg-white/5 p-2 rounded transition-all duration-300 hover:text-white"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="ml-2 w-8 h-8 rounded bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10 hover:border-cyan-400/30 transition-all"
          >
            <User className="h-4 w-4 text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <UserCircle className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <div className="border-t border-white/5" />
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
