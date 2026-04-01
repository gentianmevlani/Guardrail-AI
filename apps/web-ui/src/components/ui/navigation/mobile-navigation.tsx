"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronRight,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

interface MobileNavProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  notifications?: number;
  onThemeToggle?: () => void;
  theme?: "light" | "dark";
}

export function MobileNavigation({
  user,
  notifications = 0,
  onThemeToggle,
  theme = "dark",
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const navigationItems = [
    {
      section: "Main",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: Home },
        { label: "Ship Check", href: "/ship", icon: Shield },
        {
          label: "Intelligence",
          href: "/intelligence",
          icon: Search,
          badge: "NEW",
        },
        { label: "Runs", href: "/runs", icon: ChevronRight },
      ],
    },
    {
      section: "Tools",
      items: [
        { label: "Integrations", href: "/integrations", icon: ChevronRight },
        { label: "CLI", href: "/cli", icon: ChevronRight },
        { label: "MCP Plugin", href: "/mcp", icon: ChevronRight },
        { label: "API Key", href: "/api-key", icon: ChevronRight },
      ],
    },
    {
      section: "Account",
      items: [
        { label: "Billing", href: "/billing", icon: ChevronRight },
        { label: "Settings", href: "/settings", icon: Settings },
        { label: "Help", href: "/help", icon: HelpCircle },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Button
              ref={buttonRef}
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2"
              aria-label="Toggle navigation menu"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-charcoal-900" />
              </div>
              <span className="text-foreground font-semibold">guardrail</span>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            {onThemeToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onThemeToggle}
                className="p-2"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                /* Handle notifications */
              }}
              className="p-2 relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifications > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {notifications > 99 ? "99+" : notifications}
                </Badge>
              )}
            </Button>

            {/* User Avatar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                /* Handle user menu */
              }}
              className="p-1"
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/50 backdrop-blur-sm">
          <div
            ref={menuRef}
            className="fixed left-0 top-0 bottom-0 w-80 bg-background border-r border-border overflow-y-auto"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                    <Shield className="h-4 w-4 text-charcoal-900" />
                  </div>
                  <span className="text-foreground font-semibold">
                    guardrail
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="p-2"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* User Info */}
              {user && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-card">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground font-medium truncate">
                      {user.name}
                    </div>
                    <div className="text-muted-foreground text-sm truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Items */}
            <div className="p-4 space-y-6">
              {navigationItems.map((section) => (
                <div key={section.section}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    {section.section}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Button
                          key={item.href}
                          variant="ghost"
                          className={cn(
                            "w-full justify-start gap-3 h-12",
                            active
                              ? "text-foreground bg-muted"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          )}
                          onClick={() => {
                            // Close menu first for better UX
                            setIsOpen(false);
                            // Navigate using Next.js router (no full reload)
                            router.push(item.href);
                          }}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {item.badge}
                            </Badge>
                          )}
                          {active && (
                            <div className="w-0.5 h-6 bg-teal-500 rounded-full" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => {
                  /* Handle help */
                }}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help & Support</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => {
                  /* Handle logout */
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>

            {/* App Info */}
            <div className="p-4 border-t border-border">
              <div className="text-center text-xs text-muted-foreground/70">
                <div>guardrail v1.0.0</div>
                <div className="mt-1">© 2026 guardrail Inc.</div>
                <div className="mt-2 space-y-1">
                  <a
                    href="/terms"
                    className="block hover:text-muted-foreground"
                  >
                    Terms of Service
                  </a>
                  <a
                    href="/privacy"
                    className="block hover:text-muted-foreground"
                  >
                    Privacy Policy
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for mobile header */}
      <div className="md:hidden h-16" />
    </>
  );
}

// Mobile Search Component
export function MobileSearch({
  onSearch,
  placeholder = "Search...",
}: {
  onSearch: (query: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setIsOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="md:hidden">
      {/* Search Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="p-2"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Search Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 bg-black border-b border-zinc-800">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 p-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-2"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
            </form>
          </div>
          <div onClick={() => setIsOpen(false)} className="absolute inset-0" />
        </div>
      )}
    </div>
  );
}

// Touch-friendly Bottom Navigation for Mobile
export function BottomNavigation({
  items,
  activeItem,
}: {
  items: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: number;
  }>;
  activeItem: string;
}) {
  const router = useRouter();
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-zinc-800 z-40">
      <div className="flex items-center justify-around py-2">
        {items.map((item) => {
          const isActive = item.href === activeItem;
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-lg",
                isActive ? "text-blue-400" : "text-zinc-400 hover:text-white",
              )}
              onClick={() => {
                router.push(item.href);
              }}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
