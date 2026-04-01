"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardContext } from "@/context/dashboard-context";
import { logout, type AppNotification as Notification } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  Loader2,
  LogOut,
  Search,
  Settings,
  User,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { GitHubIntegrationCard } from "./github-integration-card";

export function Header() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Use dashboard context for real-time notifications
  const {
    notifications: notificationsData,
    isLoading: loading,
    markAsRead,
  } = useDashboardContext();
  const notifications = notificationsData.notifications;
  const unreadCount = notificationsData.unreadCount;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      // In a Next.js app, this would use router.push("/")
      window.location.href = "/";
    } catch (error) {
      logger.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead([id]);
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "security":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "compliance":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "billing":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "system":
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-zinc-800 bg-black/50 px-6 lg:h-[60px] sticky top-0 z-50 backdrop-blur-md">
      <div className="w-full flex-1">
        <form role="search" aria-label="Search vulnerabilities">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <label htmlFor="vulnerability-search" className="sr-only">
              Search vulnerabilities
            </label>
            <input
              id="vulnerability-search"
              type="search"
              placeholder="Search vulnerabilities..."
              aria-label="Search vulnerabilities"
              className="w-full bg-zinc-900/50 shadow-none appearance-none pl-8 md:w-2/3 lg:w-1/3 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </form>
      </div>

      {/* GitHub Status (minimal) */}
      <GitHubIntegrationCard variant="minimal" />

      {/* Notifications Dropdown */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-blue-400"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 bg-zinc-900 border-zinc-800">
          <DropdownMenuLabel className="text-zinc-300 flex items-center justify-between">
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs text-zinc-500">{unreadCount} unread</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-sm">
              No notifications
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.slice(0, 10).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer focus:bg-zinc-800 ${
                    !notification.read ? "bg-zinc-800/50" : ""
                  }`}
                  onClick={() => handleMarkRead(notification.id)}
                >
                  <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-zinc-200">
                      {notification.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}

          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem asChild>
            <div className="w-full text-center text-sm text-blue-400 hover:text-blue-300 py-2 cursor-pointer focus:bg-zinc-800">
              View all notifications
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-blue-400"
          >
            <User className="h-5 w-5" />
            <span className="sr-only">Profile menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800">
          <DropdownMenuLabel className="text-zinc-300">My Account</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem asChild>
            <div className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white focus:bg-zinc-800">
              <UserCircle className="h-4 w-4" />
              Profile
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <div className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white focus:bg-zinc-800">
              <Settings className="h-4 w-4" />
              Settings
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 focus:bg-zinc-800 focus:text-red-300 disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {loggingOut ? "Logging out..." : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
