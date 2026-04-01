"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// Types for API responses
interface DashboardSummary {
  security: {
    riskScore: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    lastScanAt: string | null;
    trend: "improving" | "stable" | "declining";
  };
  ship: {
    verdict: "SHIP" | "NO_SHIP" | "UNKNOWN";
    lastCheck: string | null;
    blockers: number;
    warnings: number;
  };
  compliance: {
    overallScore: number;
    frameworksTracked: number;
    passedControls: number;
    totalControls: number;
  };
  activity: {
    totalScans: number;
    scansToday: number;
    scansThisWeek: number;
    activeProjects: number;
  };
}

interface SecurityStats {
  vulnerabilities: {
    total: number;
    byCategory: Record<string, number>;
  };
  scanHistory: Array<{
    id: string;
    repository: string;
    date: string;
    language: string;
  }>;
  riskTrend: Array<{
    date: string;
    count: number;
  }>;
}

interface HealthScore {
  overall: number;
  breakdown: {
    security: number;
    compliance: number;
    codeQuality: number;
    dependencies: number;
  };
  trend: "improving" | "stable" | "declining";
  lastUpdated: string;
}

// API fetch helpers
async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    const res = await fetch("/api/dashboard/summary", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

async function fetchSecurityStats(): Promise<SecurityStats | null> {
  try {
    const res = await fetch("/api/dashboard/stats/security", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

async function fetchHealthScore(): Promise<HealthScore | null> {
  try {
    const res = await fetch("/api/dashboard/health-score", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

// Loading skeleton
function ChartSkeleton({ height = "h-[280px]" }: { height?: string }) {
  return (
    <motion.div
      className={`${height} flex items-center justify-center`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <motion.div
          className="mb-4"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto">
            <motion.div
              className="w-8 h-8 bg-teal-500/40 rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>
        </motion.div>
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Loading data...
        </motion.p>
      </div>
    </motion.div>
  );
}

// Empty state component
function EmptyState({ message, action }: { message: string; action?: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <p className="text-xs text-muted-foreground mt-1">{action}</p>
      )}
    </div>
  );
}

// Mini bar chart component
function MiniBarChart({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
  if (data.length === 0) {
    return <EmptyState message="No data available" />;
  }
  
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${item.color}`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Trend indicator
function TrendIndicator({ trend }: { trend: "improving" | "stable" | "declining" }) {
  const config = {
    improving: { icon: "↑", color: "text-green-500", label: "Improving" },
    stable: { icon: "→", color: "text-yellow-500", label: "Stable" },
    declining: { icon: "↓", color: "text-red-500", label: "Declining" },
  };
  const { icon, color, label } = config[trend];
  
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <span className="font-bold">{icon}</span>
      {label}
    </span>
  );
}

// Scan Trend Chart
export function ScanTrendChart() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardSummary().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Scan Activity</CardTitle>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-teal-400" />
            <span className="text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-muted-foreground">Week</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-teal-400">{data.activity.scansToday}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-400">{data.activity.scansThisWeek}</div>
                <div className="text-xs text-muted-foreground">This Week</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-400">{data.activity.totalScans}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Projects</span>
                <span className="font-medium">{data.activity.activeProjects}</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState 
            message="No scan data yet" 
            action="Run your first scan to see activity"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Health Score Chart
export function HealthScoreChart() {
  const [data, setData] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthScore().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Health Score</span>
          {data && <TrendIndicator trend={data.trend} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton height="h-[200px]" />
        ) : data ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${data.overall * 2.51} 251.2`}
                    className={getScoreColor(data.overall)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(data.overall)}`}>
                    {data.overall}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(data.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className={`font-medium ${getScoreColor(value)}`}>{value}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState 
            message="No health data yet" 
            action="Complete a scan to see your health score"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Issue Breakdown Chart
export function IssueBreakdownChart() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardSummary().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Issue Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : data ? (
          <div className="space-y-4">
            <MiniBarChart
              data={[
                { label: "Critical", value: data.security.criticalCount, color: "bg-red-500" },
                { label: "High", value: data.security.highCount, color: "bg-orange-500" },
                { label: "Medium", value: data.security.mediumCount, color: "bg-yellow-500" },
                { label: "Low", value: data.security.lowCount, color: "bg-blue-500" },
              ]}
              maxValue={Math.max(
                data.security.criticalCount,
                data.security.highCount,
                data.security.mediumCount,
                data.security.lowCount,
                1
              )}
            />
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Findings</span>
              <span className="text-xl font-bold">{data.security.totalFindings}</span>
            </div>
          </div>
        ) : (
          <EmptyState 
            message="No issues found" 
            action="Your codebase is looking clean!"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Repository Activity Chart
export function RepoActivityChart() {
  const [data, setData] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityStats().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Recent Scans</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : data && data.scanHistory.length > 0 ? (
          <div className="space-y-3">
            {data.scanHistory.slice(0, 5).map((scan, i) => (
              <div
                key={scan.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-teal-400">
                      {scan.language?.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium truncate max-w-[150px]">
                      {scan.repository.split("/").pop() || scan.repository}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {scan.language || "Unknown"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(scan.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState 
            message="No scan history yet" 
            action="Scanned repositories will appear here"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Weekly Comparison Chart
export function WeeklyComparisonChart() {
  const [data, setData] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityStats().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">7-Day Risk Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton height="h-[250px]" />
        ) : data && data.riskTrend.length > 0 ? (
          <div className="h-[200px] flex items-end gap-1">
            {data.riskTrend.map((day, i) => {
              const maxCount = Math.max(...data.riskTrend.map((d) => d.count), 1);
              const height = (day.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: "160px" }}>
                    <div
                      className="w-full max-w-[40px] bg-gradient-to-t from-teal-500 to-cyan-400 rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" }).charAt(0)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState 
            message="No trend data yet" 
            action="Data will appear after a few days of scanning"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Ship Status Widget
export function ShipStatusWidget() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardSummary().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  const getVerdictConfig = (verdict: "SHIP" | "NO_SHIP" | "UNKNOWN") => {
    switch (verdict) {
      case "SHIP":
        return { bg: "bg-green-500/20", text: "text-green-500", icon: "✓", label: "Ready to Ship" };
      case "NO_SHIP":
        return { bg: "bg-red-500/20", text: "text-red-500", icon: "✗", label: "Not Ready" };
      default:
        return { bg: "bg-yellow-500/20", text: "text-yellow-500", icon: "?", label: "Unknown" };
    }
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Ship Status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton height="h-[150px]" />
        ) : data ? (
          <div className="space-y-4">
            {(() => {
              const config = getVerdictConfig(data.ship.verdict);
              return (
                <div className={`p-4 rounded-lg ${config.bg} flex items-center justify-center gap-3`}>
                  <span className={`text-4xl ${config.text}`}>{config.icon}</span>
                  <span className={`text-xl font-bold ${config.text}`}>{config.label}</span>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-400">{data.ship.blockers}</div>
                <div className="text-xs text-muted-foreground">Blockers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{data.ship.warnings}</div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState 
            message="No ship check yet" 
            action="Run 'guardrail ship' to check readiness"
          />
        )}
      </CardContent>
    </Card>
  );
}

// Main Analytics Charts Grid
export function AnalyticsCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ScanTrendChart />
      <HealthScoreChart />
      <IssueBreakdownChart />
      <RepoActivityChart />
      <WeeklyComparisonChart />
      <ShipStatusWidget />
    </div>
  );
}
