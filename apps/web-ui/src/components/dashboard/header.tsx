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
import { useDashboardQueryContext } from "@/context/dashboard-query-context";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GitHubIntegrationCard } from "./github-integration-card";

export function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Use dashboard context for real-time notifications
  const {
    notifications: notificationsData,
    isLoading: loading,
    markAsRead,
  } = useDashboardQueryContext();
  const notifications = notificationsData.notifications;
  const unreadCount = notificationsData.unreadCount;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (error) {
      logger.error("Logout failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
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
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "compliance":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "billing":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "system":
      default:
        return <Info className="h-4 w-4 text-primary" />;
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
    <header className="dashboard-header hidden md:flex">
      <div className="w-full flex-1">
        <form role="search" aria-label="Search vulnerabilities">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="vulnerability-search" className="sr-only">
              Search vulnerabilities
            </label>
            <input
              id="vulnerability-search"
              type="search"
              placeholder="Search vulnerabilities..."
              aria-label="Search vulnerabilities"
              className="search-input md:w-2/3 lg:w-1/3"
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
            className="relative rounded-full hover:bg-muted text-muted-foreground hover:text-teal-400 transition-smooth"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-80 glass-card border-border/50"
        >
          <DropdownMenuLabel className="text-foreground/90 flex items-center justify-between">
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.slice(0, 10).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer focus:bg-muted ${
                    !notification.read ? "bg-muted/50" : ""
                  }`}
                  onClick={() => handleMarkRead(notification.id)}
                >
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}

          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem asChild>
            <Link
              href="/activity"
              className="w-full text-center text-sm text-primary hover:text-primary/80 py-2 cursor-pointer focus:bg-muted"
            >
              View all notifications
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted text-muted-foreground hover:text-teal-400 transition-smooth"
          >
            <User className="h-5 w-5" />
            <span className="sr-only">Profile menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 glass-card border-border/50"
        >
          <DropdownMenuLabel className="text-foreground/90">
            My Account
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem asChild>
            <Link
              href="/profile"
              className="flex items-center gap-2 cursor-pointer text-foreground/80 hover:text-foreground focus:bg-muted"
            >
              <UserCircle className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/settings"
              className="flex items-center gap-2 cursor-pointer text-foreground/80 hover:text-foreground focus:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 cursor-pointer text-destructive hover:text-destructive/80 focus:bg-muted focus:text-destructive/80 disabled:opacity-50"
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
