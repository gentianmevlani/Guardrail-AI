"use client";

import { useDashboardContext } from "../context/dashboard-context";
import { useRoute } from "../context/route-context";
import { cn } from "./ui/utils";
import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Building2,
  Check,
  ChevronDown,
  Cpu,
  CreditCard,
  FileText,
  GitBranch,
  History,
  Key,
  LayoutDashboard,
  LineChart,
  Package,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  Terminal,
  Users,
  Wand2,
  Bell,
  Folder,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

// Sidebar sections with dividers - consolidated for cleaner navigation
const sidebarSections: SidebarSection[] = [
  {
    title: "Main",
    items: [
      { title: "Command Center", href: "/dashboard", icon: LayoutDashboard },
      { title: "Runs & Proof", href: "/runs", icon: History },
      { title: "Policies", href: "/policies", icon: ScrollText },
    ],
  },
  {
    title: "Tools",
    items: [
      { title: "CLI", href: "/cli", icon: Terminal },
      { title: "MCP Plugin", href: "/mcp", icon: Cpu },
      { title: "API Keys", href: "/api-key", icon: Key },
    ],
  },
  {
    title: "Team & Account",
    items: [
      { title: "Team Members", href: "/team", icon: Users },
      { title: "Billing", href: "/billing", icon: CreditCard },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Demo repos for repo selector
const demoRepos = [
  {
    id: "1",
    name: "guardrail",
    fullName: "guardiavault-oss/guardrail",
    isDefault: true,
  },
  {
    id: "2",
    name: "my-saas-app",
    fullName: "user/my-saas-app",
    isDefault: false,
  },
];

export function Sidebar() {
  const { currentRoute, navigate } = useRoute();
  const [repoSelectorOpen, setRepoSelectorOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(demoRepos[0]);
  const [statusPulse, setStatusPulse] = useState(false);
  const lastStatusRef = useRef<string | null>(null);

  // Get real-time data from dashboard context
  const { summary, findings, lastUpdated, isScanning } = useDashboardContext();

  // Helper function to format relative time
  const formatDistanceToNow = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Determine status from real data
  const getGateStatus = () => {
    if (isScanning) {
      return {
        text: "Scanning...",
        color: "text-yellow-300",
        bgColor: "bg-yellow-500",
      };
    }

    if (!summary || !findings) {
      return {
        text: "No data",
        color: "text-zinc-400",
        bgColor: "bg-zinc-500",
      };
    }

    const criticalFindings = summary.security.criticalCount || 0;
    const highFindings = summary.security.highCount || 0;
    const totalFindings = summary.security.totalFindings || 0;

    if (criticalFindings > 0) {
      return {
        text: "Critical issues",
        color: "text-red-300",
        bgColor: "bg-red-500",
      };
    }

    if (highFindings > 0) {
      return {
        text: "Warnings present",
        color: "text-yellow-300",
        bgColor: "bg-yellow-500",
      };
    }

    if (totalFindings > 0) {
      return {
        text: "Minor issues",
        color: "text-yellow-300",
        bgColor: "bg-yellow-500",
      };
    }

    return {
      text: "All gates passing",
      color: "text-emerald-300",
      bgColor: "bg-emerald-500",
    };
  };

  const status = getGateStatus();

  // Trigger pulse animation when status changes
  useEffect(() => {
    const currentStatus = `${status.text}-${isScanning}`;
    if (
      lastStatusRef.current !== null &&
      lastStatusRef.current !== currentStatus
    ) {
      setStatusPulse(true);
      setTimeout(() => setStatusPulse(false), 1000);
    }
    lastStatusRef.current = currentStatus;
  }, [status.text, isScanning]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return currentRoute === "/dashboard";
    return currentRoute?.startsWith(href);
  };

  return (
    <nav
      id="navigation"
      role="navigation"
      aria-label="Main navigation"
      className="border-r border-zinc-800 bg-black w-64 sticky top-0 h-screen z-20"
    >
      <div className="flex h-full max-h-screen flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-zinc-800 px-4 lg:h-[60px]">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="text-white text-lg">guardrail</span>
          </div>
        </div>

        {/* Repo Selector - Pinned at top */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <button
            onClick={() => setRepoSelectorOpen(!repoSelectorOpen)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && repoSelectorOpen) {
                setRepoSelectorOpen(false);
              }
            }}
            aria-expanded={repoSelectorOpen}
            aria-haspopup="listbox"
            aria-label={`Select repository: ${selectedRepo.name}`}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-4 w-4 text-zinc-500 flex-shrink-0" />
              <span className="text-sm font-medium text-white truncate">
                {selectedRepo.name}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-zinc-500 transition-transform flex-shrink-0",
                repoSelectorOpen && "rotate-180"
              )}
            />
          </button>
          {repoSelectorOpen && (
            <div
              className="mt-1 py-1 rounded-lg bg-zinc-900 border border-zinc-800 shadow-lg"
              role="listbox"
              aria-label="Repository list"
            >
              {demoRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    setSelectedRepo(repo);
                    setRepoSelectorOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setRepoSelectorOpen(false);
                    }
                  }}
                  role="option"
                  aria-selected={selectedRepo.id === repo.id}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-sm text-zinc-300 truncate">
                      {repo.fullName}
                    </span>
                  </div>
                  {selectedRepo.id === repo.id && (
                    <Check className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {selectedRepo.id === repo.id ? "(selected)" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation with sections */}
        <div className="flex-1 overflow-auto py-2">
          <nav className="px-3 space-y-4">
            {sidebarSections.map((section) => (
              <div key={section.title}>
                {/* Section divider */}
                <div className="px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    {section.title}
                  </span>
                </div>
                {/* Section items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <div
                        key={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer",
                          "relative",
                          active
                            ? "text-white bg-zinc-800/80"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                        )}
                        onClick={() => navigate(item.href)}
                      >
                        {/* Active indicator - left border */}
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />
                        )}
                        <item.icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            active ? "text-blue-400" : "text-zinc-500"
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Status footer */}
        <div className="p-3 border-t border-zinc-800" role="status" aria-live="polite">
          <div className="w-full rounded-lg bg-zinc-900/50 p-3 hover:bg-zinc-900/80 transition-colors group cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${status.bgColor} ${
                    statusPulse ? "animate-pulse" : ""
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`text-xs font-medium ${status.color} group-hover:text-white transition-colors`}
                >
                  {status.text}
                </span>
              </div>
              <span className="text-[10px] text-zinc-600">{selectedRepo.name}</span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              {lastUpdated ? formatDistanceToNow(lastUpdated) : "No updates"}
            </p>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-600">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
              ⌘
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
              K
            </kbd>
            <span className="ml-1">Command palette</span>
          </div>
        </div>
      </div>
    </nav>
  );
}