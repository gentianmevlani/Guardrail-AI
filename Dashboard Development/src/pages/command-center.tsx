"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Ban,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Command,
  Download,
  ExternalLink,
  FileCode,
  Filter,
  Flame,
  GitBranch,
  Keyboard,
  Layers,
  Loader2,
  Lock,
  PackageX,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
  AlertOctagon,
  Eye,
  BarChart3,
  Target,
  Gauge,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { cn } from "../components/ui/utils";
import { GitHubConnectWidget } from "../components/github-connect-widget";
import {
  getStatus,
  getStats,
  getMoments,
  getRisks,
  getLiveFeed,
  type StatusResponse,
  type StatsResponse,
  type Moment,
  type Risk,
  type LiveEvent,
} from "../lib/api-client";

// ============================================================================
// TYPES
// ============================================================================

interface ProtectionModule {
  name: string;
  status: "connected" | "degraded" | "offline";
  latency?: number;
  lastUpdate?: string;
  health: number;
}

interface SavedMoment {
  id: string;
  type:
    | "hallucination"
    | "dependency"
    | "security"
    | "boundary"
    | "pattern";
  title: string;
  file: string;
  line: number;
  timestamp: string;
  timestampMs: number;
  severity: "critical" | "high" | "medium" | "low";
  fix: string;
  blocked: boolean;
  context?: string;
}

interface HotRisk {
  id: string;
  file: string;
  importance: number;
  risk: "auth" | "payments" | "db" | "api" | "config";
  churn: number;
  violations: number;
  description: string;
  trend: "up" | "down" | "stable";
  lastViolation?: string;
}

interface ImpactMetrics {
  hallucinationsBlocked: number;
  wrongDepsBlocked: number;
  routesVerified: number;
  patternsEnforced: number;
  boundaryViolationsPrevented: number;
  securityFootgunsFlagged: number;
  timeSaved: number;
  aiReliabilityScore: number;
}

interface LiveEvent {
  id: string;
  timestamp: Date;
  type:
    | "tool_call"
    | "intercept"
    | "verify"
    | "block"
    | "allow";
  action: string;
  latency: number;
  result: "hit" | "miss" | "blocked" | "allowed";
  file?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const protectionModules: ProtectionModule[] = [
  {
    name: "Context Mode",
    status: "connected",
    latency: 12,
    health: 100,
  },
  {
    name: "Truth Pack",
    status: "connected",
    lastUpdate: "12s ago",
    health: 98,
  },
  {
    name: "MCP Bridge",
    status: "connected",
    latency: 11,
    health: 100,
  },
  { name: "Scope Guard", status: "connected", health: 100 },
];

const savedMoments: SavedMoment[] = [
  {
    id: "sm-1",
    type: "hallucination",
    title:
      "Blocked hallucinated symbol useAth → suggested useAuth",
    file: "src/auth/hooks.ts",
    line: 42,
    timestamp: "2m ago",
    timestampMs: Date.now() - 120000,
    severity: "high",
    fix: 'Change "useAth" to "useAuth"',
    blocked: true,
    context: "AI attempted to use non-existent hook",
  },
  {
    id: "sm-2",
    type: "dependency",
    title:
      "Blocked dependency suggestion axios (not installed)",
    file: "src/api/client.ts",
    line: 8,
    timestamp: "12m ago",
    timestampMs: Date.now() - 720000,
    severity: "medium",
    fix: "Use built-in fetch() or install axios first",
    blocked: true,
    context: "Package.json does not include axios",
  },
  {
    id: "sm-3",
    type: "security",
    title: "Flagged: Stripe test-mode secret pattern in production path",
    file: "src/config/stripe.ts",
    line: 15,
    timestamp: "1h ago",
    timestampMs: Date.now() - 3600000,
    severity: "critical",
    fix: "Move to environment variables",
    blocked: true,
    context: "Hardcoded API key detected in source",
  },
  {
    id: "sm-4",
    type: "boundary",
    title: "Boundary warning: client importing server util",
    file: "components/UserProfile.tsx",
    line: 3,
    timestamp: "2h ago",
    timestampMs: Date.now() - 7200000,
    severity: "medium",
    fix: "Move shared logic to /shared directory",
    blocked: false,
    context: "Server-only code in client bundle",
  },
  {
    id: "sm-5",
    type: "hallucination",
    title:
      "Blocked nonexistent API endpoint /api/getUserProfile",
    file: "src/hooks/useUser.ts",
    line: 28,
    timestamp: "3h ago",
    timestampMs: Date.now() - 10800000,
    severity: "high",
    fix: "Use /api/user/profile instead",
    blocked: true,
    context: "Route does not exist in pages/api",
  },
  {
    id: "sm-6",
    type: "pattern",
    title: "Enforced: useCallback missing dependency array",
    file: "src/hooks/useSearch.ts",
    line: 15,
    timestamp: "4h ago",
    timestampMs: Date.now() - 14400000,
    severity: "low",
    fix: "Add [query, debounceMs] to dependency array",
    blocked: false,
    context: "React hooks best practice violation",
  },
];

const hotRisks: HotRisk[] = [
  {
    id: "hr-1",
    file: "src/auth/session.ts",
    importance: 95,
    risk: "auth",
    churn: 12,
    violations: 3,
    description:
      "Authentication session handling with boundary violations",
    trend: "up",
    lastViolation: "5m ago",
  },
  {
    id: "hr-2",
    file: "src/payments/stripe.ts",
    importance: 92,
    risk: "payments",
    churn: 8,
    violations: 2,
    description: "Payment processing with exposed test keys",
    trend: "stable",
    lastViolation: "1h ago",
  },
  {
    id: "hr-3",
    file: "src/db/queries.ts",
    importance: 88,
    risk: "db",
    churn: 15,
    violations: 1,
    description: "Database queries with SQL injection risks",
    trend: "down",
    lastViolation: "3h ago",
  },
  {
    id: "hr-4",
    file: "src/api/webhooks.ts",
    importance: 85,
    risk: "api",
    churn: 5,
    violations: 2,
    description: "Webhook handlers with missing validation",
    trend: "up",
    lastViolation: "30m ago",
  },
  {
    id: "hr-5",
    file: "components/AdminPanel.tsx",
    importance: 82,
    risk: "auth",
    churn: 3,
    violations: 1,
    description:
      "Admin panel with insufficient access controls",
    trend: "stable",
    lastViolation: "6h ago",
  },
];

const impactMetrics24h: ImpactMetrics = {
  hallucinationsBlocked: 47,
  wrongDepsBlocked: 12,
  routesVerified: 234,
  patternsEnforced: 89,
  boundaryViolationsPrevented: 15,
  securityFootgunsFlagged: 8,
  timeSaved: 4.2,
  aiReliabilityScore: 94.7,
};

const impactMetrics7d: ImpactMetrics = {
  hallucinationsBlocked: 312,
  wrongDepsBlocked: 58,
  routesVerified: 1647,
  patternsEnforced: 523,
  boundaryViolationsPrevented: 94,
  securityFootgunsFlagged: 31,
  timeSaved: 28.5,
  aiReliabilityScore: 96.2,
};

const previousPeriodMetrics24h: ImpactMetrics = {
  hallucinationsBlocked: 38,
  wrongDepsBlocked: 15,
  routesVerified: 198,
  patternsEnforced: 72,
  boundaryViolationsPrevented: 11,
  securityFootgunsFlagged: 6,
  timeSaved: 3.1,
  aiReliabilityScore: 92.1,
};

const previousPeriodMetrics7d: ImpactMetrics = {
  hallucinationsBlocked: 287,
  wrongDepsBlocked: 62,
  routesVerified: 1423,
  patternsEnforced: 489,
  boundaryViolationsPrevented: 78,
  securityFootgunsFlagged: 28,
  timeSaved: 24.2,
  aiReliabilityScore: 94.8,
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Animated counter with easing
function AnimatedCounter({
  value,
  duration = 1500,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const current =
        startValue + (endValue - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// Sparkline chart component
function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#3b82f6",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2)}`;

  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity="0.3"
          />
          <stop
            offset="100%"
            stopColor={color}
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Delta indicator component
function DeltaIndicator({
  current,
  previous,
  inverted = false,
  showPercentage = true,
}: {
  current: number;
  previous: number;
  inverted?: boolean;
  showPercentage?: boolean;
}) {
  const delta = current - previous;
  const percentage =
    previous !== 0
      ? ((delta / previous) * 100).toFixed(1)
      : "0";
  const isPositive = delta > 0;
  const isGood = inverted ? !isPositive : isPositive;

  if (delta === 0) {
    return (
      <span className="text-xs text-zinc-500 flex items-center gap-1">
        <span className="w-3 h-3 flex items-center justify-center">
          ―
        </span>
        {showPercentage && "0%"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1",
        isGood ? "text-emerald-400" : "text-red-400",
      )}
    >
      {isPositive ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )}
      {showPercentage && `${Math.abs(Number(percentage))}%`}
    </span>
  );
}

// Pulse indicator for live status
function PulseIndicator({
  status,
  size = "sm",
}: {
  status: "connected" | "degraded" | "offline";
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  const colorClasses = {
    connected: "bg-emerald-500",
    degraded: "bg-yellow-500",
    offline: "bg-red-500",
  };

  return (
    <span className="relative flex">
      <span
        className={cn(
          "absolute inline-flex rounded-full opacity-75",
          sizeClasses[size],
          colorClasses[status],
          status === "connected" && "animate-ping",
        )}
      />
      <span
        className={cn(
          "relative inline-flex rounded-full",
          sizeClasses[size],
          colorClasses[status],
        )}
      />
    </span>
  );
}

// Health bar component
function HealthBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const getColor = (v: number) => {
    if (v >= 90) return "from-emerald-500 to-emerald-400";
    if (v >= 70) return "from-yellow-500 to-yellow-400";
    return "from-red-500 to-red-400";
  };

  return (
    <div
      className={cn(
        "h-1 bg-zinc-800 rounded-full overflow-hidden",
        className,
      )}
    >
      <motion.div
        className={cn(
          "h-full bg-gradient-to-r rounded-full",
          getColor(value),
        )}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

// Keyboard shortcut badge
function KbdShortcut({ keys }: { keys: string[] }) {
  return (
    <span className="hidden md:inline-flex items-center gap-0.5">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 border border-zinc-700 rounded text-zinc-400"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CommandCenterPage() {
  const [timeframe, setTimeframe] = useState<"24h" | "7d">("24h");
  const [liveModeEnabled, setLiveModeEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // API Data State
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data on mount and when timeframe changes
  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [statusData, statsData, momentsData, risksData, liveData] = await Promise.all([
        getStatus(),
        getStats(timeframe === "24h" ? "24h" : "7d"),
        getMoments(50),
        getRisks(10),
        getLiveFeed(),
      ]);
      
      setStatus(statusData);
      setStats(statsData);
      setMoments(momentsData.moments);
      setRisks(risksData.risks);
      setLiveEvents(liveData.events);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh when live mode is enabled
  useEffect(() => {
    if (!liveModeEnabled) return;
    
    const interval = setInterval(async () => {
      try {
        const liveData = await getLiveFeed();
        setLiveEvents(liveData.events);
      } catch (err) {
        console.error("Failed to fetch live feed:", err);
      }
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, [liveModeEnabled]);

  // Map API stats to component metrics format
  const metrics = useMemo(() => {
    if (!stats) {
      return {
        hallucinationsBlocked: 0,
        wrongDepsBlocked: 0,
        routesVerified: 0,
        patternsEnforced: 0,
        boundaryViolationsPrevented: 0,
        securityFootgunsFlagged: 0,
        timeSaved: 0,
        aiReliabilityScore: 0,
      };
    }
    
    // Map API fields to component expected fields
    const totalInterventions = stats.hallucinationsBlocked + stats.boundaryViolations + stats.securityFootguns;
    const timeSaved = (totalInterventions * 5) / 60; // ~5 min per intervention
    const reliabilityScore = Math.min(100, 85 + (stats.symbolsVerified / 100));
    
    return {
      hallucinationsBlocked: stats.hallucinationsBlocked,
      wrongDepsBlocked: stats.versionsChecked, // Use versionsChecked as wrong deps
      routesVerified: stats.routesValidated,
      patternsEnforced: stats.patternsEnforced,
      boundaryViolationsPrevented: stats.boundaryViolations,
      securityFootgunsFlagged: stats.securityFootguns,
      timeSaved: timeSaved,
      aiReliabilityScore: reliabilityScore,
    };
  }, [stats]);

  // Filter saved moments
  const filteredMoments = useMemo(() => {
    return moments.filter((moment) => {
      const matchesSearch =
        searchQuery === "" ||
        moment.summary
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (moment.file &&
          moment.file.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType =
        selectedType === null || moment.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [moments, searchQuery, selectedType]);

  // Calculate total impact
  const totalImpact =
    metrics.hallucinationsBlocked +
    metrics.boundaryViolationsPrevented +
    metrics.securityFootgunsFlagged;

  // Calculate previous values for trend (use trend from API)
  const impactTrend = stats?.trend.hallucinationsBlocked || 0;
  const previousTotalImpact = totalImpact - impactTrend;

  // Map API status to protection modules
  const protectionModules = useMemo(() => {
    if (!status) return [];
    
    const truthPackAge = status.truthPackAge;
    const truthPackStatus = truthPackAge < 300 ? "connected" : truthPackAge < 600 ? "degraded" : "offline";
    
    return [
      {
        name: "Context Mode",
        status: status.contextMode,
        health: status.contextMode === "connected" ? 100 : 0,
        latency: status.mcpLatency,
      },
      {
        name: "Truth Pack",
        status: truthPackStatus,
        health: truthPackAge < 300 ? 100 : truthPackAge < 600 ? 60 : 20,
        lastUpdate: `${Math.floor(truthPackAge / 60)}m ago`,
      },
      {
        name: "MCP Server",
        status: status.mcpServer.running ? "connected" : "offline",
        health: status.mcpServer.running ? 100 : 0,
        latency: status.mcpLatency,
      },
      {
        name: "Scope Guard",
        status: "connected",
        health: 100,
      },
    ];
  }, [status]);
    previousMetrics.wrongDepsBlocked +
    previousMetrics.boundaryViolationsPrevented +
    previousMetrics.securityFootgunsFlagged;

  // Live mode simulation
  useEffect(() => {
    if (!liveModeEnabled) return;

    const actions = [
      "context.read",
      "truth.verify",
      "scope.check",
      "pattern.enforce",
      "dep.validate",
    ];
    const results: LiveEvent["result"][] = [
      "hit",
      "hit",
      "hit",
      "allowed",
      "blocked",
    ];
    const types: LiveEvent["type"][] = [
      "tool_call",
      "verify",
      "intercept",
      "allow",
      "block",
    ];

    const interval = setInterval(() => {
      const newEvent: LiveEvent = {
        id: `live-${Date.now()}`,
        timestamp: new Date(),
        type: types[Math.floor(Math.random() * types.length)],
        action:
          actions[Math.floor(Math.random() * actions.length)],
        latency: Math.floor(Math.random() * 20) + 5,
        result:
          results[Math.floor(Math.random() * results.length)],
      };

      setLiveEvents((prev) => [newEvent, ...prev].slice(0, 50));
    }, 1500);

    return () => clearInterval(interval);
  }, [liveModeEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "k":
            e.preventDefault();
            // Trigger command palette (would integrate with external component)
            break;
          case "l":
            e.preventDefault();
            setLiveModeEnabled((prev) => !prev);
            break;
          case "f":
            e.preventDefault();
            setShowFilters((prev) => !prev);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Export handler
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    // Simulate export
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsExporting(false);
    // Would trigger download
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Utility functions
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "medium":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      default:
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "auth":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "payments":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "db":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "api":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "hallucination":
        return <Ban className="w-3.5 h-3.5" />;
      case "dependency":
        return <PackageX className="w-3.5 h-3.5" />;
      case "security":
        return <ShieldAlert className="w-3.5 h-3.5" />;
      case "boundary":
        return <Layers className="w-3.5 h-3.5" />;
      case "pattern":
        return <Target className="w-3.5 h-3.5" />;
      default:
        return <Eye className="w-3.5 h-3.5" />;
    }
  };

  // Sparkline data (mock trend data)
  const sparklineData = {
    hallucinations: [
      12, 15, 8, 22, 18, 25, 20, 32, 28, 35, 42, 47,
    ],
    deps: [3, 5, 2, 8, 6, 4, 9, 7, 10, 8, 11, 12],
    routes: [
      45, 52, 68, 75, 89, 102, 125, 148, 178, 195, 212, 234,
    ],
    reliability: [
      91.2, 92.1, 91.8, 93.2, 92.8, 94.1, 93.5, 94.8, 95.2,
      94.5, 95.1, 94.7,
    ],
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <Shield className="relative w-10 h-10 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Command Center
              </h1>
              <p className="text-zinc-500 text-sm md:text-base">
                Your AI is being kept honest. Here's the proof.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Live Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLiveModeEnabled(!liveModeEnabled)}
            className={cn(
              "border-zinc-700 transition-all duration-300",
              liveModeEnabled
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                : "text-zinc-400 hover:text-white hover:border-zinc-600",
            )}
          >
            {liveModeEnabled ? (
              <>
                <Activity className="w-4 h-4 mr-2 animate-pulse" />
                Live
                <span className="hidden sm:inline ml-1">
                  ON
                </span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Live
                <span className="hidden sm:inline ml-1">
                  OFF
                </span>
              </>
            )}
            <KbdShortcut keys={["⌘", "L"]} />
          </Button>

          {/* Command Palette Trigger */}
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
          >
            <Command className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline mr-2">
              Commands
            </span>
            <KbdShortcut keys={["⌘", "K"]} />
          </Button>
        </div>
      </motion.div>

      {/* ================================================================== */}
      {/* GITHUB CONNECT WIDGET */}
      {/* ================================================================== */}
      <GitHubConnectWidget />

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-zinc-400">Loading dashboard data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="bg-red-950/20 border-red-500/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <h3 className="text-red-400 font-semibold mb-1">Failed to load dashboard data</h3>
                <p className="text-zinc-400 text-sm mb-3">{error}</p>
                <Button
                  onClick={fetchAllData}
                  size="sm"
                  className="bg-red-600 hover:bg-red-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* PROTECTION STATUS GRID */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 opacity-50" />

          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Protection Status
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              >
                <PulseIndicator status="connected" size="sm" />
                <span className="ml-2">
                  All Systems Operational
                </span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {protectionModules.map((module, index) => (
                <motion.div
                  key={module.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="group p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-zinc-400">
                      {module.name}
                    </span>
                    <PulseIndicator status={module.status} />
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span
                      className={cn(
                        "text-lg font-semibold capitalize",
                        module.status === "connected" &&
                          "text-emerald-400",
                        module.status === "degraded" &&
                          "text-yellow-400",
                        module.status === "offline" &&
                          "text-red-400",
                      )}
                    >
                      {module.status}
                    </span>
                    {module.latency && (
                      <span className="text-xs text-zinc-500">
                        {module.latency}ms
                      </span>
                    )}
                  </div>
                  {module.lastUpdate && (
                    <div className="text-xs text-zinc-500">
                      Updated {module.lastUpdate}
                    </div>
                  )}
                  <HealthBar
                    value={module.health}
                    className="mt-3"
                  />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================== */}
      {/* AI RELIABILITY SCORE & IMPACT METRICS */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-blue-950/20 to-zinc-900 border-zinc-800 backdrop-blur-xl">
          {/* Animated background */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          <CardHeader className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-white">
                <Gauge className="w-5 h-5 text-blue-400" />
                guardrail Impact
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeframe("24h")}
                  className={cn(
                    "text-xs transition-all",
                    timeframe === "24h"
                      ? "bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  24h
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeframe("7d")}
                  className={cn(
                    "text-xs transition-all",
                    timeframe === "7d"
                      ? "bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  7d
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-6">
            {/* Hero Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* AI Reliability Score */}
              <div className="md:col-span-1 p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800 flex flex-col items-center justify-center">
                <div className="text-sm text-zinc-400 mb-2">
                  AI Reliability Score
                </div>
                <div className="relative">
                  <div className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    <AnimatedCounter
                      value={metrics.aiReliabilityScore}
                      decimals={1}
                      suffix="%"
                    />
                  </div>
                  <div className="absolute -right-8 top-0">
                    <DeltaIndicator
                      current={metrics.aiReliabilityScore}
                      previous={
                        previousMetrics.aiReliabilityScore
                      }
                    />
                  </div>
                </div>
                <Sparkline
                  data={sparklineData.reliability}
                  color="#10b981"
                  className="mt-4"
                  width={100}
                  height={32}
                />
              </div>

              {/* Total Interventions */}
              <div className="md:col-span-1 p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800 flex flex-col items-center justify-center">
                <div className="text-sm text-zinc-400 mb-2">
                  Total Interventions
                </div>
                <div className="relative">
                  <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    <AnimatedCounter value={totalImpact} />
                  </div>
                  <div className="absolute -right-8 top-0">
                    <DeltaIndicator
                      current={totalImpact}
                      previous={previousTotalImpact}
                    />
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  in last {timeframe}
                </div>
              </div>

              {/* Time Saved */}
              <div className="md:col-span-1 p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex flex-col items-center justify-center">
                <div className="text-sm text-zinc-400 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time Saved
                </div>
                <div className="relative">
                  <div className="text-5xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.timeSaved}
                      decimals={1}
                      suffix="h"
                    />
                  </div>
                  <div className="absolute -right-8 top-0">
                    <DeltaIndicator
                      current={metrics.timeSaved}
                      previous={previousMetrics.timeSaved}
                    />
                  </div>
                </div>
                <div className="text-xs text-blue-400 mt-2">
                  ≈ ${(metrics.timeSaved * 150).toFixed(0)}{" "}
                  saved
                </div>
              </div>
            </div>

            {/* Detailed Breakdown Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Hallucinations Blocked */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-red-500/30 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">
                    Hallucinations
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.hallucinationsBlocked}
                    />
                  </span>
                  <DeltaIndicator
                    current={metrics.hallucinationsBlocked}
                    previous={
                      previousMetrics.hallucinationsBlocked
                    }
                  />
                </div>
                <Sparkline
                  data={sparklineData.hallucinations}
                  color="#ef4444"
                  className="mt-2 opacity-50 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Wrong Deps Blocked */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-orange-500/30 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <PackageX className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-zinc-400">
                    Wrong Deps
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.wrongDepsBlocked}
                    />
                  </span>
                  <DeltaIndicator
                    current={metrics.wrongDepsBlocked}
                    previous={previousMetrics.wrongDepsBlocked}
                    inverted
                  />
                </div>
                <Sparkline
                  data={sparklineData.deps}
                  color="#f97316"
                  className="mt-2 opacity-50 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Routes Verified */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-emerald-500/30 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-zinc-400">
                    Routes Verified
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.routesVerified}
                    />
                  </span>
                  <DeltaIndicator
                    current={metrics.routesVerified}
                    previous={previousMetrics.routesVerified}
                  />
                </div>
                <Sparkline
                  data={sparklineData.routes}
                  color="#10b981"
                  className="mt-2 opacity-50 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Patterns Enforced */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-zinc-400">
                    Patterns
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.patternsEnforced}
                    />
                  </span>
                  <DeltaIndicator
                    current={metrics.patternsEnforced}
                    previous={previousMetrics.patternsEnforced}
                  />
                </div>
              </div>

              {/* Boundary Violations */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-yellow-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-zinc-400">
                    Boundaries
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={
                        metrics.boundaryViolationsPrevented
                      }
                    />
                  </span>
                  <DeltaIndicator
                    current={
                      metrics.boundaryViolationsPrevented
                    }
                    previous={
                      previousMetrics.boundaryViolationsPrevented
                    }
                  />
                </div>
              </div>

              {/* Security Footguns */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-red-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">
                    Security
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    <AnimatedCounter
                      value={metrics.securityFootgunsFlagged}
                    />
                  </span>
                  <DeltaIndicator
                    current={metrics.securityFootgunsFlagged}
                    previous={
                      previousMetrics.securityFootgunsFlagged
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================== */}
      {/* TWO COLUMN LAYOUT: SAVED MOMENTS & HOT RISKS */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SAVED MOMENTS FEED */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Saved Moments
                  <Badge
                    variant="outline"
                    className="ml-2 text-xs border-zinc-700"
                  >
                    {filteredMoments.length}
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "text-xs",
                    showFilters
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400",
                  )}
                >
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  Filters
                  <KbdShortcut keys={["⌘", "F"]} />
                </Button>
              </div>

              {/* Search & Filter Bar */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Search events..."
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQuery(e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Filter Chips */}
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-zinc-500">
                          Severity:
                        </span>
                        {[
                          "critical",
                          "high",
                          "medium",
                          "low",
                        ].map((sev) => (
                          <button
                            key={sev}
                            onClick={() =>
                              setSelectedSeverity(
                                selectedSeverity === sev
                                  ? null
                                  : sev,
                              )
                            }
                            className={cn(
                              "px-2 py-1 text-xs rounded-full border transition-all capitalize",
                              selectedSeverity === sev
                                ? getSeverityColor(sev)
                                : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
                            )}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-zinc-500">
                          Type:
                        </span>
                        {[
                          "hallucination",
                          "dependency",
                          "security",
                          "boundary",
                          "pattern",
                        ].map((type) => (
                          <button
                            key={type}
                            onClick={() =>
                              setSelectedType(
                                selectedType === type
                                  ? null
                                  : type,
                              )
                            }
                            className={cn(
                              "px-2 py-1 text-xs rounded-full border transition-all capitalize flex items-center gap-1",
                              selectedType === type
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
                            )}
                          >
                            {getTypeIcon(type)}
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <AnimatePresence mode="popLayout">
                  {filteredMoments.map((moment, index) => (
                    <motion.div
                      key={moment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.03 }}
                      layout
                      className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "p-1.5 rounded-lg",
                              getSeverityColor(moment.severity),
                            )}
                          >
                            {getSeverityIcon(moment.severity)}
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize border-zinc-700 flex items-center gap-1"
                          >
                            {getTypeIcon(moment.type)}
                            {moment.type}
                          </Badge>
                          {moment.blocked && (
                            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Blocked
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {moment.timestamp}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-200 mb-2 group-hover:text-white transition-colors">
                        {moment.title}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                        <FileCode className="w-3 h-3 flex-shrink-0" />
                        <code className="font-mono truncate">
                          {moment.file}:{moment.line}
                        </code>
                      </div>

                      {moment.context && (
                        <p className="text-xs text-zinc-500 mb-3 italic">
                          {moment.context}
                        </p>
                      )}

                      <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                          Recommended Fix
                        </div>
                        <code className="text-xs text-blue-400 break-all">
                          {moment.fix}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs h-8 text-zinc-400 hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3 mr-1.5" />
                          Open in Editor
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs h-8 text-zinc-400 hover:text-white"
                        >
                          <GitBranch className="w-3 h-3 mr-1.5" />
                          View Diff
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredMoments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <Search className="w-8 h-8 mb-3 opacity-50" />
                    <p className="text-sm">
                      No matching events found
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSeverity(null);
                        setSelectedType(null);
                      }}
                      className="text-xs text-blue-400 mt-2 hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* HOT RISK LIST */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Flame className="w-5 h-5 text-orange-400" />
                  Hot Risk List
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs border-zinc-700"
                >
                  Ranked by importance × violations
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Top risky files that need attention
              </p>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {hotRisks.map((risk, index) => (
                  <motion.div
                    key={risk.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="group"
                  >
                    <div
                      className={cn(
                        "p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer",
                        expandedRisk === risk.id &&
                          "border-zinc-700",
                      )}
                      onClick={() =>
                        setExpandedRisk(
                          expandedRisk === risk.id
                            ? null
                            : risk.id,
                        )
                      }
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold",
                              index === 0 &&
                                "bg-red-500/20 text-red-400",
                              index === 1 &&
                                "bg-orange-500/20 text-orange-400",
                              index === 2 &&
                                "bg-yellow-500/20 text-yellow-400",
                              index > 2 &&
                                "bg-zinc-800 text-zinc-400",
                            )}
                          >
                            {index + 1}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs capitalize",
                              getRiskBadgeColor(risk.risk),
                            )}
                          >
                            {risk.risk}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {risk.trend === "up" && (
                              <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                            )}
                            {risk.trend === "down" && (
                              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            {risk.trend === "stable" && (
                              <span className="text-zinc-500 text-xs">
                                ―
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Activity className="w-3 h-3" />
                            {risk.churn}
                          </div>
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {risk.violations}
                          </div>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-zinc-500 transition-transform",
                              expandedRisk === risk.id &&
                                "rotate-180",
                            )}
                          />
                        </div>
                      </div>

                      <code className="text-sm text-blue-400 font-mono block mb-2 truncate">
                        {risk.file}
                      </code>

                      <p className="text-xs text-zinc-400 mb-3">
                        {risk.description}
                      </p>

                      {/* Importance Bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              risk.importance >= 90 &&
                                "bg-gradient-to-r from-red-500 to-orange-500",
                              risk.importance >= 80 &&
                                risk.importance < 90 &&
                                "bg-gradient-to-r from-orange-500 to-yellow-500",
                              risk.importance < 80 &&
                                "bg-gradient-to-r from-yellow-500 to-emerald-500",
                            )}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${risk.importance}%`,
                            }}
                            transition={{
                              duration: 0.8,
                              delay: 0.3 + index * 0.1,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 w-8 text-right">
                          {risk.importance}
                        </span>
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {expandedRisk === risk.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{
                              opacity: 1,
                              height: "auto",
                            }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 mt-4 border-t border-zinc-800 space-y-3">
                              {risk.lastViolation && (
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  Last violation:{" "}
                                  {risk.lastViolation}
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
                                >
                                  <Play className="w-3 h-3 mr-1.5" />
                                  Run Check
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs border-zinc-700 hover:border-orange-500/50 hover:bg-orange-500/10"
                                >
                                  <ShieldAlert className="w-3 h-3 mr-1.5" />
                                  Ship Block
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs border-zinc-700 hover:border-purple-500/50 hover:bg-purple-500/10"
                                >
                                  <Lock className="w-3 h-3 mr-1.5" />
                                  Lock Scope
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ================================================================== */}
      {/* LIVE MODE FEED */}
      {/* ================================================================== */}
      <AnimatePresence>
        {liveModeEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 border-blue-500/30 backdrop-blur-xl">
              {/* Animated border glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 animate-pulse" />

              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                    Live MCP Feed
                    <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                      </span>
                      Streaming
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLiveEvents([])}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLiveModeEnabled(false)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      <Pause className="w-3 h-3 mr-1.5" />
                      Pause
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative">
                <div className="space-y-1 font-mono text-xs max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  <AnimatePresence mode="popLayout">
                    {liveEvents.map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        layout
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                          event.result === "blocked"
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-zinc-900/50 border-zinc-800",
                        )}
                      >
                        <span className="text-zinc-500 w-20 flex-shrink-0">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] w-16 justify-center border-zinc-700",
                            event.type === "block" &&
                              "border-red-500/30 text-red-400",
                            event.type === "allow" &&
                              "border-emerald-500/30 text-emerald-400",
                          )}
                        >
                          {event.type}
                        </Badge>
                        <span className="text-blue-400 w-32 truncate">
                          {event.action}
                        </span>
                        <span className="text-zinc-600">→</span>
                        <span className="text-emerald-400 w-12">
                          {event.latency}ms
                        </span>
                        <Badge
                          className={cn(
                            "ml-auto text-[10px]",
                            event.result === "hit" &&
                              "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                            event.result === "miss" &&
                              "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                            event.result === "blocked" &&
                              "bg-red-500/20 text-red-400 border-red-500/30",
                            event.result === "allowed" &&
                              "bg-blue-500/20 text-blue-400 border-blue-500/30",
                          )}
                        >
                          {event.result.toUpperCase()}
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {liveEvents.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-zinc-500">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Waiting for events...
                    </div>
                  )}
                </div>

                {/* Stats Bar */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
                  <div className="flex items-center gap-4">
                    <span>
                      Events:{" "}
                      <span className="text-white">
                        {liveEvents.length}
                      </span>
                    </span>
                    <span>
                      Avg latency:{" "}
                      <span className="text-emerald-400">
                        {liveEvents.length > 0
                          ? (
                              liveEvents.reduce(
                                (acc, e) => acc + e.latency,
                                0,
                              ) / liveEvents.length
                            ).toFixed(1)
                          : 0}
                        ms
                      </span>
                    </span>
                    <span>
                      Blocked:{" "}
                      <span className="text-red-400">
                        {
                          liveEvents.filter(
                            (e) => e.result === "blocked",
                          ).length
                        }
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">
                      Connected
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* KEYBOARD SHORTCUTS HINT */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="hidden md:flex items-center justify-center gap-6 py-4 text-xs text-zinc-600"
      >
        <div className="flex items-center gap-2">
          <KbdShortcut keys={["⌘", "K"]} />
          <span>Command palette</span>
        </div>
        <div className="flex items-center gap-2">
          <KbdShortcut keys={["⌘", "L"]} />
          <span>Toggle live mode</span>
        </div>
        <div className="flex items-center gap-2">
          <KbdShortcut keys={["⌘", "F"]} />
          <span>Filter events</span>
        </div>
      </motion.div>
    </div>
  );
}

export default CommandCenterPage;