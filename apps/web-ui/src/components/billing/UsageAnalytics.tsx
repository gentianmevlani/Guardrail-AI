"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Calendar,
  Clock,
  Flame,
  Gauge,
  Globe,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Design system colors
const COLORS = {
  teal: {
    500: "hsl(174, 72%, 46%)",
    400: "hsl(174, 72%, 52%)",
    300: "hsl(174, 72%, 63%)",
  },
  charcoal: {
    700: "hsl(220, 13%, 15%)",
    600: "hsl(220, 13%, 22%)",
    500: "hsl(220, 13%, 30%)",
    400: "hsl(220, 13%, 45%)",
  },
  accent: {
    cyan: "hsl(187, 85%, 53%)",
    emerald: "hsl(160, 84%, 39%)",
    amber: "hsl(38, 92%, 50%)",
    red: "hsl(0, 72%, 51%)",
    purple: "hsl(270, 70%, 60%)",
    blue: "hsl(210, 100%, 50%)",
  },
};

// Types for usage data
export interface UsageMetric {
  type: string;
  used: number;
  limit: number | null;
  percentage: number;
  trend: number;
  dailyAverage: number;
  projectedEndOfPeriod: number;
}

export interface UsageTrendPoint {
  date: string;
  scans: number;
  realityRuns: number;
  aiAgentRuns: number;
}

export interface UsageBreakdown {
  category: string;
  value: number;
  color: string;
}

export interface ExtendedBillingUsage {
  scansUsed: number;
  scansLimit: number | null;
  realityRunsUsed: number;
  realityRunsLimit: number | null;
  aiAgentRunsUsed: number;
  aiAgentRunsLimit: number | null;
  teamMembersUsed: number;
  teamMembersLimit: number | null;
  projectsUsed: number;
  projectsLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysRemaining: number;
  dailyUsageRate: {
    scans: number;
    realityRuns: number;
    aiAgentRuns: number;
  };
  projectedUsage: {
    scans: number;
    realityRuns: number;
    aiAgentRuns: number;
  };
  usageTrend: UsageTrendPoint[];
  breakdown: {
    scans: UsageBreakdown[];
    realityRuns: UsageBreakdown[];
  };
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color || COLORS.teal[400] }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Usage Rate Card
interface UsageRateCardProps {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number | null;
  dailyRate: number;
  projected: number;
  trend: number;
  color: string;
}

function UsageRateCard({
  title,
  icon,
  used,
  limit,
  dailyRate,
  projected,
  trend,
  color,
}: UsageRateCardProps) {
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 0;
  const projectedPercentage = limit
    ? Math.min((projected / limit) * 100, 100)
    : 0;
  const isOverProjected = limit && projected > limit;
  const isNearLimit = percentage >= 80;

  return (
    <Card className="bg-card/40 border backdrop-blur-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: `${color}20` }}
            >
              <div style={{ color }}>{icon}</div>
            </div>
            <div>
              <h4 className="font-medium text-white">{title}</h4>
              <p className="text-xs text-muted-foreground">
                {dailyRate.toFixed(1)}/day avg
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
              trend > 0
                ? "bg-emerald-500/10 text-emerald-400"
                : trend < 0
                  ? "bg-red-500/10 text-red-400"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {trend > 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : trend < 0 ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {Math.abs(trend)}%
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white">
              {used.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              / {limit === null ? "∞" : limit.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: isNearLimit ? COLORS.accent.amber : color,
                }}
              />
              {limit && (
                <div
                  className="absolute inset-y-0 rounded-full opacity-30"
                  style={{
                    left: `${percentage}%`,
                    width: `${Math.min(projectedPercentage - percentage, 100 - percentage)}%`,
                    backgroundColor: isOverProjected
                      ? COLORS.accent.red
                      : color,
                  }}
                />
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {percentage.toFixed(0)}% used
              </span>
              {limit && (
                <span
                  className={cn(
                    "flex items-center gap-1",
                    isOverProjected ? "text-red-400" : "text-muted-foreground",
                  )}
                >
                  <TrendingUp className="w-3 h-3" />
                  Projected: {projected.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {isNearLimit && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Approaching limit - consider upgrading</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Usage Trend Chart
interface UsageTrendChartProps {
  data: UsageTrendPoint[];
}

function UsageTrendChart({ data }: UsageTrendChartProps) {
  return (
    <Card className="bg-card/40 border backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-400" />
              Usage Trends
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Daily usage over the billing period
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="text-muted-foreground">Scans</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: COLORS.accent.purple }}
              />
              <span className="text-muted-foreground">Reality</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: COLORS.accent.cyan }}
              />
              <span className="text-muted-foreground">AI Agent</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.teal[500]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.teal[500]}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="realityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS.accent.purple}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.accent.purple}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.accent.cyan}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.accent.cyan}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.charcoal[600]}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke={COLORS.charcoal[500]}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={COLORS.charcoal[500]}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="scans"
                stroke={COLORS.teal[500]}
                strokeWidth={2}
                fill="url(#scanGradient)"
                name="Scans"
              />
              <Area
                type="monotone"
                dataKey="realityRuns"
                stroke={COLORS.accent.purple}
                strokeWidth={2}
                fill="url(#realityGradient)"
                name="Reality Runs"
              />
              <Area
                type="monotone"
                dataKey="aiAgentRuns"
                stroke={COLORS.accent.cyan}
                strokeWidth={2}
                fill="url(#aiGradient)"
                name="AI Agent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Usage Breakdown Pie Chart
interface UsageBreakdownChartProps {
  title: string;
  data: UsageBreakdown[];
  total: number;
}

function UsageBreakdownChart({ title, data, total }: UsageBreakdownChartProps) {
  return (
    <Card className="bg-card/40 border backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="w-[120px] h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{item.value}</span>
                  <span className="text-muted-foreground text-xs">
                    ({((item.value / total) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Billing Period Progress
interface BillingPeriodProgressProps {
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

function BillingPeriodProgress({
  startDate,
  endDate,
  daysRemaining,
}: BillingPeriodProgressProps) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const total = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const elapsed = total - daysRemaining;
  const percentage = (elapsed / total) * 100;

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Card className="bg-card/40 border backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-medium text-white">
              Billing Period
            </span>
          </div>
          <Badge variant="outline" className="border-teal-500/30 text-teal-400">
            <Clock className="w-3 h-3 mr-1" />
            {daysRemaining} days left
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(start)}</span>
            <span>
              {elapsed} of {total} days
            </span>
            <span>{formatDate(end)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Rate Limit Indicator
interface RateLimitIndicatorProps {
  tier: string;
  requestsPerMinute: number;
  currentRate: number;
}

function RateLimitIndicator({
  tier,
  requestsPerMinute,
  currentRate,
}: RateLimitIndicatorProps) {
  const percentage = (currentRate / requestsPerMinute) * 100;
  const status =
    percentage > 80 ? "warning" : percentage > 50 ? "moderate" : "healthy";

  return (
    <Card className="bg-card/40 border backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">
              API Rate Limit
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              status === "healthy" && "border-emerald-500/30 text-emerald-400",
              status === "moderate" && "border-amber-500/30 text-amber-400",
              status === "warning" && "border-red-500/30 text-red-400",
            )}
          >
            {status === "healthy"
              ? "Healthy"
              : status === "moderate"
                ? "Moderate"
                : "High"}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{currentRate}</span>
            <span className="text-muted-foreground text-sm">
              / {requestsPerMinute} req/min
            </span>
          </div>

          <Progress value={percentage} className="h-1.5" />

          <p className="text-xs text-muted-foreground">
            {tier.charAt(0).toUpperCase() + tier.slice(1)} tier rate limit
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Usage Analytics Component
interface UsageAnalyticsProps {
  usage: ExtendedBillingUsage;
  tier: string;
}

export function UsageAnalytics({ usage, tier }: UsageAnalyticsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card/40 border h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate trends (mock calculation - would come from API)
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Billing Period & Rate Limit */}
      <div className="grid gap-4 md:grid-cols-2">
        <BillingPeriodProgress
          startDate={usage.currentPeriodStart}
          endDate={usage.currentPeriodEnd}
          daysRemaining={usage.daysRemaining}
        />
        <RateLimitIndicator
          tier={tier}
          requestsPerMinute={
            tier === "free"
              ? 100
              : tier === "starter"
                ? 300
                : tier === "pro"
                  ? 1000
                  : 2000
          }
          currentRate={Math.floor(Math.random() * 50) + 10}
        />
      </div>

      {/* Usage Rate Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <UsageRateCard
          title="Code Scans"
          icon={<Activity className="w-5 h-5" />}
          used={usage.scansUsed}
          limit={usage.scansLimit}
          dailyRate={usage.dailyUsageRate.scans}
          projected={usage.projectedUsage.scans}
          trend={calculateTrend(
            usage.dailyUsageRate.scans,
            usage.dailyUsageRate.scans * 0.9,
          )}
          color={COLORS.teal[500]}
        />
        <UsageRateCard
          title="Reality Runs"
          icon={<Globe className="w-5 h-5" />}
          used={usage.realityRunsUsed}
          limit={usage.realityRunsLimit}
          dailyRate={usage.dailyUsageRate.realityRuns}
          projected={usage.projectedUsage.realityRuns}
          trend={calculateTrend(
            usage.dailyUsageRate.realityRuns,
            usage.dailyUsageRate.realityRuns * 0.85,
          )}
          color={COLORS.accent.purple}
        />
        <UsageRateCard
          title="AI Agent Runs"
          icon={<Bot className="w-5 h-5" />}
          used={usage.aiAgentRunsUsed}
          limit={usage.aiAgentRunsLimit}
          dailyRate={usage.dailyUsageRate.aiAgentRuns}
          projected={usage.projectedUsage.aiAgentRuns}
          trend={calculateTrend(
            usage.dailyUsageRate.aiAgentRuns,
            usage.dailyUsageRate.aiAgentRuns * 0.8,
          )}
          color={COLORS.accent.cyan}
        />
      </div>

      {/* Usage Trend Chart */}
      <UsageTrendChart data={usage.usageTrend} />

      {/* Breakdown Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <UsageBreakdownChart
          title="Scans by Source"
          data={usage.breakdown.scans}
          total={usage.scansUsed}
        />
        <UsageBreakdownChart
          title="Reality Runs by Type"
          data={usage.breakdown.realityRuns}
          total={usage.realityRunsUsed}
        />
      </div>

      {/* Resource Usage */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Resource Allocation
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Team members and projects usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-400" />
                  <span className="text-sm text-muted-foreground">
                    Team Members
                  </span>
                </div>
                <span className="text-sm font-medium text-white">
                  {usage.teamMembersUsed} /{" "}
                  {usage.teamMembersLimit === null
                    ? "∞"
                    : usage.teamMembersLimit}
                </span>
              </div>
              <Progress
                value={
                  usage.teamMembersLimit
                    ? (usage.teamMembersUsed / usage.teamMembersLimit) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-muted-foreground">
                    Projects
                  </span>
                </div>
                <span className="text-sm font-medium text-white">
                  {usage.projectsUsed} /{" "}
                  {usage.projectsLimit === null ? "∞" : usage.projectsLimit}
                </span>
              </div>
              <Progress
                value={
                  usage.projectsLimit
                    ? (usage.projectsUsed / usage.projectsLimit) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsageAnalytics;
