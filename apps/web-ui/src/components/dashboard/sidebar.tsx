"use client";

import { useDashboardQueryContext } from "@/context/dashboard-query-context";
import { useGitHub } from "@/context/github-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "@/hooks/useHaptic";
import { listContainerVariants, listItemVariants, hoverLift } from "@/lib/animations";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Building2,
  Check,
  ChevronDown,
  Code,
  Cpu,
  CreditCard,
  FileText,
  GitBranch,
  History,
  Key,
  LayoutDashboard,
  LineChart,
  Monitor,
  Package,
  Plug,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  Terminal,
  Users,
  Wand2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Ship Check", href: "/ship", icon: Rocket },
      {
        title: "Intelligence",
        href: "/intelligence",
        icon: Brain,
        badge: "NEW",
      },
      { title: "Runs", href: "/runs", icon: History },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { 
        title: "Organization", 
        href: "/organization", 
        icon: Building2,
      },
      { 
        title: "System Health", 
        href: "/system-health", 
        icon: Monitor,
      },
      { 
        title: "Advanced Analytics", 
        href: "/analytics", 
        icon: BarChart3,
        badge: "PRO",
      },
      { 
        title: "Incident Management", 
        href: "/incidents", 
        icon: AlertTriangle,
      },
      { 
        title: "API Usage", 
        href: "/api-usage", 
        icon: Code,
      },
      { 
        title: "Security Events", 
        href: "/security-events", 
        icon: Shield,
      },
    ],
  },
  {
    title: "Intelligence Suites",
    items: [
      { title: "AI Analysis", href: "/intelligence/ai", icon: Brain },
      { title: "Security", href: "/intelligence/security", icon: Shield },
      {
        title: "Architecture",
        href: "/intelligence/architecture",
        icon: Building2,
      },
      {
        title: "Supply Chain",
        href: "/intelligence/supply-chain",
        icon: Package,
      },
      { title: "Team", href: "/intelligence/team", icon: Users },
      {
        title: "Predictive",
        href: "/intelligence/predictive",
        icon: LineChart,
      },
    ],
  },
  {
    title: "Governance",
    items: [
      { title: "Guardrails", href: "/guardrails", icon: Wand2 },
      { title: "Policies", href: "/policies", icon: ScrollText },
      { title: "Compliance", href: "/compliance", icon: FileText },
    ],
  },
  {
    title: "Tools",
    items: [
      { title: "Integrations", href: "/integrations", icon: Plug },
      { title: "CLI", href: "/cli", icon: Terminal },
      { title: "MCP Plugin", href: "/mcp", icon: Cpu },
      { title: "API Key", href: "/api-key", icon: Key },
    ],
  },
  {
    title: "Account",
    items: [
      { title: "Billing", href: "/billing", icon: CreditCard },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];


export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [repoSelectorOpen, setRepoSelectorOpen] = useState(false);
  const [statusPulse, setStatusPulse] = useState(false);
  const lastStatusRef = useRef<string | null>(null);

  // Haptic feedback
  const haptic = useHaptic();

  // Get real-time data from dashboard context
  const { summary, findings, lastUpdated, isScanning } =
    useDashboardQueryContext();

  // Get GitHub repositories
  const { repositories, connected } = useGitHub();
  const [selectedRepo, setSelectedRepo] = useState(repositories[0] || null);

  // Helper function to format relative time
  const formatDistanceToNow = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Determine status from real data
  const getGateStatus = () => {
    if (isScanning) {
      return {
        text: "Scanning...",
        color: "text-warning",
        bgColor: "bg-warning",
      };
    }

    if (!summary || !findings) {
      return {
        text: "No data",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      };
    }

    const criticalFindings = summary.security.criticalCount || 0;
    const highFindings = summary.security.highCount || 0;
    const totalFindings = summary.security.totalFindings || 0;

    if (criticalFindings > 0) {
      return {
        text: "Critical issues",
        color: "text-destructive",
        bgColor: "bg-destructive",
      };
    }

    if (highFindings > 0) {
      return {
        text: "Warnings present",
        color: "text-warning",
        bgColor: "bg-warning",
      };
    }

    if (totalFindings > 0) {
      return {
        text: "Minor issues",
        color: "text-warning",
        bgColor: "bg-warning",
      };
    }

    return {
      text: "All gates passing",
      color: "text-success",
      bgColor: "bg-success",
    };
  };

  // Get most relevant navigation target
  const getNavigationTarget = () => {
    if (!summary || !findings) return "/dashboard";

    const criticalFindings = summary.security.criticalCount || 0;
    const highFindings = summary.security.highCount || 0;

    if (criticalFindings > 0 || highFindings > 0) {
      return "/intelligence?tab=security";
    }

    return "/runs";
  };

  const status = getGateStatus();
  const navigationTarget = getNavigationTarget();

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
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <nav
      id="navigation"
      role="navigation"
      aria-label="Main navigation"
      className="hidden border-r border-border/50 sidebar-nav md:block sticky top-0 h-screen"
    >
      <div className="flex h-full max-h-screen flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-border/50 px-4 lg:h-[60px]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold hover-scale-sm transition-smooth"
          >
            <Image
              src="/guardrail-logo.svg"
              alt="guardrail"
              width={160}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Repo Selector - Pinned at top */}
        <div className="px-3 py-3 border-b border-border/50">
          <motion.button
            onClick={() => {
              setRepoSelectorOpen(!repoSelectorOpen);
              haptic.trigger('selection');
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && repoSelectorOpen) {
                setRepoSelectorOpen(false);
              }
            }}
            aria-expanded={repoSelectorOpen}
            aria-haspopup="listbox"
            aria-label={`Select repository: ${selectedRepo?.name || 'No repository'}`}
            className="repo-selector glow-teal-hover"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-white truncate">
                {selectedRepo?.name || 'No repository'}
              </span>
            </div>
            <motion.div
              animate={{ rotate: repoSelectorOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </motion.div>
          </motion.button>
          <AnimatePresence>
            {repoSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="repo-dropdown overflow-hidden"
                role="listbox"
                aria-label="Repository list"
              >
                {connected && repositories.map((repo: any, index: number) => (
                  <motion.button
                    key={repo.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 4, backgroundColor: 'rgba(20, 184, 166, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedRepo(repo);
                      setRepoSelectorOpen(false);
                      haptic.trigger('selection');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setRepoSelectorOpen(false);
                      }
                    }}
                    role="option"
                    aria-selected={selectedRepo?.id === repo.id}
                    className="repo-item"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground/80 truncate">
                        {repo.fullName}
                      </span>
                    </div>
                    {selectedRepo?.id === repo.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <Check
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      </motion.div>
                    )}
                    <span className="sr-only">
                      {selectedRepo?.id === repo.id ? "(selected)" : ""}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation with sections */}
        <div className="flex-1 overflow-auto py-2">
          <nav className="px-3 space-y-4">
            {sidebarSections.map((section, sectionIndex) => (
              <motion.div
                key={section.title}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: sectionIndex * 0.05, duration: 0.3 }}
              >
                {/* Section divider */}
                <div className="sidebar-section-title">{section.title}</div>
                {/* Section items */}
                <motion.div
                  className="space-y-0.5"
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <motion.div
                        key={item.href}
                        variants={listItemVariants}
                        whileHover={{ x: 4, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => haptic.trigger('light')}
                          className={cn(
                            "sidebar-item transition-all duration-200 relative overflow-hidden",
                            active && "sidebar-item-active",
                          )}
                        >
                          {/* Active indicator */}
                          {active && (
                            <motion.div
                              layoutId="activeTab"
                              className="absolute inset-0 bg-teal-500/10 rounded-lg"
                              initial={false}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          <motion.div
                            className="relative flex items-center gap-2 z-10"
                            animate={active ? { scale: 1.02 } : { scale: 1 }}
                          >
                            <item.icon
                              className={cn(
                                "sidebar-icon transition-all duration-200",
                                active && "text-teal-400",
                              )}
                            />
                            <span className="truncate">{item.title}</span>
                            {item.badge && (
                              <motion.span
                                className="sidebar-badge"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                whileHover={{ scale: 1.1 }}
                              >
                                {item.badge}
                              </motion.span>
                            )}
                          </motion.div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.div>
            ))}
          </nav>
        </div>

        {/* Status footer */}
        <motion.div
          className="status-footer"
          role="status"
          aria-live="polite"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <motion.button
            onClick={() => {
              router.push(navigationTarget);
              haptic.trigger('medium');
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="status-card group"
          >
            <div className="flex items-center justify-between">
              <div className="health-indicator">
                <motion.div
                  className={cn(
                    "health-dot",
                    status.bgColor === "bg-success" && "health-dot-success",
                    status.bgColor === "bg-warning" && "health-dot-warning",
                    status.bgColor === "bg-destructive" && "health-dot-error",
                  )}
                  animate={statusPulse ? {
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.7, 1],
                  } : {}}
                  transition={{ duration: 0.6 }}
                  aria-hidden="true"
                />
                <motion.span
                  className={`text-xs font-medium ${status.color} group-hover:text-foreground transition-colors`}
                  animate={statusPulse ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {status.text}
                </motion.span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                {selectedRepo?.name || 'No repository'}
              </span>
            </div>
            <motion.p
              className="activity-time"
              key={lastUpdated}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {lastUpdated ? formatDistanceToNow(lastUpdated) : "No updates"}
            </motion.p>
          </motion.button>
        </motion.div>

        {/* Keyboard hint */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/70">
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">K</kbd>
            <span className="ml-1">Command palette</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
