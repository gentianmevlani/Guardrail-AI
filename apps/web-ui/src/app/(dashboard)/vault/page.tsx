"use client";

/**
 * Receipt Vault - Overview Page
 * The "money page" showing Context Mode value
 */
import { useEffect, useState } from "react";
import type { TruthPackInfo } from "@/lib/guardrail/data-layer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Zap,
  TrendingUp,
  Activity,
  FileCode
} from "lucide-react";

interface TelemetryStats {
  period: string;
  totalCalls: number;
  hallucinationsBlocked: number;
  symbolsVerified: number;
  routesVerified: number;
  patternsUsed: number;
  versionChecks: number;
  avgLatencyMs: number;
  byTool: Record<string, number>;
  savedMoments: Array<{ timestamp: string; tool: string; description: string }>;
}

interface GuardrailStatus {
  connected: boolean;
  pid?: number;
  mode?: string;
  uptime?: number;
}

export default function VaultOverviewPage() {
  const [status, setStatus] = useState<GuardrailStatus>({ connected: false });
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [truthpack, setTruthpack] = useState<TruthPackInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, statsRes, truthpackRes] = await Promise.all([
          fetch("/api/guardrail/status"),
          fetch("/api/guardrail/telemetry?period=24h"),
          fetch("/api/guardrail/truthpack"),
        ]);
        
        setStatus(await statusRes.json());
        setStats(await statsRes.json());
        setTruthpack(await truthpackRes.json());
      } catch {
        // Network or parse error — leave prior state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Receipt Vault</h1>
            <p className="text-muted-foreground">Context Mode intelligence</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Above the fold - Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Hallucinations Blocked"
          value={stats?.hallucinationsBlocked || 0}
          icon={<Shield className="h-4 w-4" />}
          trend={stats?.hallucinationsBlocked ? "+12" : undefined}
          highlight
        />
        <StatCard
          title="Symbols Verified"
          value={stats?.symbolsVerified || 0}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          title="Patterns Suggested"
          value={stats?.patternsUsed || 0}
          icon={<FileCode className="h-4 w-4" />}
        />
        <StatCard
          title="Avg Latency"
          value={`${stats?.avgLatencyMs || 0}ms`}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* Truth Pack Status — same `.guardrail-context/` as CLI + guardrail-context */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Truth Pack (Context Engine)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {truthpack?.exists ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {truthpack.symbolCount?.toLocaleString() ?? 0}
                    </span>{" "}
                    symbols ·{" "}
                    <span className="font-medium text-foreground">
                      {truthpack.routeCount?.toLocaleString() ?? 0}
                    </span>{" "}
                    routes ·{" "}
                    <span className="font-medium text-foreground">
                      {truthpack.dependencyCount?.toLocaleString() ?? 0}
                    </span>{" "}
                    deps
                  </p>
                  {truthpack.fileCount != null && truthpack.fileCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{truthpack.fileCount.toLocaleString()} files in index metadata
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Index age:{" "}
                    {formatAge(
                      truthpack.generatedAt ??
                        truthpack.lastUpdated ??
                        undefined,
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {truthpack.framework && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {truthpack.framework}
                    </Badge>
                  )}
                  {truthpack.language && (
                    <Badge variant="outline" className="text-xs">
                      {truthpack.language}
                    </Badge>
                  )}
                  {truthpack.packageManager && truthpack.packageManager !== "unknown" && (
                    <Badge variant="outline" className="text-xs">
                      {truthpack.packageManager}
                    </Badge>
                  )}
                </div>
              </div>
              {truthpack.lastRealityScan && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Last Reality scan: </span>
                  <Badge
                    variant={
                      truthpack.lastRealityScan.verdict === "FAIL"
                        ? "destructive"
                        : truthpack.lastRealityScan.verdict === "WARN"
                          ? "secondary"
                          : "default"
                    }
                    className="text-xs"
                  >
                    {truthpack.lastRealityScan.verdict}
                  </Badge>
                  {truthpack.lastRealityScan.totalScore != null && (
                    <span className="text-muted-foreground ml-2">
                      score {truthpack.lastRealityScan.totalScore}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatAge(truthpack.lastRealityScan.timestamp)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>No Truth Pack in this repo yet. Build the same index the CLI and MCP use:</p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-xs">
                <li>
                  <code className="bg-muted px-1 rounded">guardrail scan --path . --with-context</code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">guardrail-context index</code>{" "}
                  <span className="font-sans text-muted-foreground">(Context Engine package)</span>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">guardrail init</code>{" "}
                  <span className="font-sans text-muted-foreground">(full project setup)</span>
                </li>
              </ul>
              {truthpack?.error && (
                <p className="text-xs text-destructive">Could not read index: {truthpack.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Moments Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Saved Moments
            <span className="text-muted-foreground font-normal">(AI mistakes we caught)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.savedMoments && stats.savedMoments.length > 0 ? (
            <div className="space-y-2">
              {stats.savedMoments.slice(0, 10).map((moment, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Shield className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                  <div>
                    <span>{moment.description}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatAge(moment.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved moments yet. Run <code className="bg-muted px-1 rounded">guardrail on</code> to start.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Most Used Tools */}
      {stats?.byTool && Object.keys(stats.byTool).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Most Used Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byTool)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([tool, count]) => (
                  <div key={tool} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{tool}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: GuardrailStatus }) {
  if (status.connected) {
    return (
      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Not Running
    </Badge>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  trend,
  highlight 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-red-500/30 bg-red-500/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-green-500 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {trend} vs yesterday
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatAge(timestamp?: string): string {
  if (!timestamp) return "Unknown";
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
