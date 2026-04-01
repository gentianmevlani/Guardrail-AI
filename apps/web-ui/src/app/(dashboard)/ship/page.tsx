"use client";

import { logger } from "@/lib/logger";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Rocket,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  Download,
  Share2,
  Copy,
  ExternalLink,
  ChevronRight,
  Lock,
  Github,
  GitBranch,
  Video,
  FileText,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGitHub } from "@/context/github-context";
import { GitHubIntegrationCard } from "@/components/dashboard/github-integration-card";

interface Run {
  id: string;
  repo: string;
  branch: string;
  commitSha?: string;
  verdict: string;
  score: number;
  status: string;
  progress: number;
  securityResult?: SecurityResult;
  realityResult?: RealityResult;
  guardrailResult?: GuardrailResult;
  traceUrl?: string;
  videoUrl?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface SecurityResult {
  verdict: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  error?: string;
}

interface RealityResult {
  verdict: string;
  totalTests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration?: number;
  failures?: TestFailure[];
  message?: string;
  error?: string;
}

interface TestFailure {
  title: string;
  file?: string;
  error?: string;
  expected?: string;
  actual?: string;
}

interface GuardrailResult {
  verdict: string;
  checks: {
    noMockData: boolean;
    noHardcodedSecrets: boolean;
    realApiCalls: boolean;
    properErrorHandling: boolean;
  };
  violations: string[];
  error?: string;
}

interface ReplayData {
  runId: string;
  repo: string;
  traceUrl?: string;
  videoUrl?: string;
  available: boolean;
  traceSize?: number;
  videoSize?: number;
  traceModified?: string;
  videoModified?: string;
  testSummary?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

interface ShipCheck {
  id: string;
  name: string;
  shortName: string;
  status: "pass" | "fail" | "warning" | "skip" | "pending";
  message: string;
  details?: string[];
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function ShipCheckPage() {
  // Use centralized GitHub context
  const {
    connected: githubConnected,
    loading: githubLoading,
    repositories: githubRepos,
    user: githubUser,
    sync: syncGitHub,
    syncing: githubSyncing,
  } = useGitHub();

  const [activeTab, setActiveTab] = useState("overview");
  const [isScanning, setIsScanning] = useState(false);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/runs?limit=10`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.runs) {
          setHistory(data.data.runs);
        } else if (data.runs) {
          setHistory(data.runs);
        }
      }
    } catch (err) {
      logger.debug('Failed to load history:', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const pollRunStatus = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch run status");
      }

      const data = await res.json();
      if (!data.success || !data.data?.run) {
        throw new Error("Invalid run response");
      }

      const run = data.data.run;
      setCurrentRun(run);

      if (run.status === "completed" || run.status === "failed") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsScanning(false);
        await loadHistory();

        if (run.status === "completed") {
          await loadReplayData(runId);
        }
      }
    } catch (err) {
      logger.error('Error polling run status:', { error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const loadReplayData = async (runId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/replay`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setReplayData(data.data);
        }
      }
    } catch (err) {
      logger.debug('Failed to load replay data:', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const runShipCheck = async (repoName?: string) => {
    setIsScanning(true);
    setError(null);
    setCurrentRun(null);
    setReplayData(null);

    try {
      const res = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          repo: repoName || selectedRepo || "local/project",
          branch: "main",
          projectPath: "/home/runner/workspace",
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to start run");
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error("Invalid run response");
      }

      const runId = data.data.id;
      setCurrentRun(data.data);

      pollIntervalRef.current = setInterval(() => {
        pollRunStatus(runId);
      }, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Ship check error:', error);
      setError(error.message || "Failed to run ship check");
      setIsScanning(false);
    }
  };

  const runGitHubScan = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    await runShipCheck(repoFullName);
  };

  // Use syncGitHub from context instead of local function
  const handleSyncRepositories = async () => {
    await syncGitHub();
  };

  const copyEmbedCode = () => {
    const embedCode = `[![guardrail](https://guardrailai.dev/badge/${currentRun?.repo || "project"})](https://guardrailai.dev)`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.run) {
          setCurrentRun(data.data.run);
          await loadReplayData(runId);
        }
      }
    } catch (err) {
      logger.error('Failed to load run details:', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const getVerdictFromRun = (): "ship" | "no-ship" | "review" => {
    if (!currentRun) return "review";
    const verdict = currentRun.verdict?.toLowerCase().replace(/_/g, "-");
    if (verdict === "pass" || verdict === "ship") return "ship";
    if (verdict === "fail" || verdict === "no-ship") return "no-ship";
    return "review";
  };

  const getVerdictBadge = () => {
    const verdict = getVerdictFromRun();

    const variants = {
      ship: {
        bg: "bg-emerald-500/20",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        icon: Rocket,
        label: "🚀 SHIP IT!",
      },
      "no-ship": {
        bg: "bg-red-500/20",
        text: "text-red-400",
        border: "border-red-500/30",
        icon: XCircle,
        label: "🛑 NO SHIP",
      },
      review: {
        bg: "bg-amber-500/20",
        text: "text-amber-400",
        border: "border-amber-500/30",
        icon: AlertTriangle,
        label: "⚠️ REVIEW",
      },
    };

    const variant = variants[verdict];
    const Icon = variant.icon;

    return (
      <Badge
        className={cn(
          "text-lg px-4 py-2",
          variant.bg,
          variant.text,
          variant.border,
        )}
      >
        <Icon className="w-5 h-5 mr-2" />
        {variant.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-400" />;
      case "skip":
        return <Clock className="h-5 w-5 text-zinc-500" />;
      default:
        return <Clock className="h-5 w-5 text-zinc-500" />;
    }
  };

  const generateChecksFromRun = (): ShipCheck[] => {
    if (!currentRun) return [];

    const checks: ShipCheck[] = [];
    const security = currentRun.securityResult;
    const reality = currentRun.realityResult;
    const guardrail = currentRun.guardrailResult;

    if (security) {
      checks.push({
        id: "security",
        name: "Security Scan",
        shortName: "Security",
        status:
          security.verdict === "pass"
            ? "pass"
            : security.verdict === "error"
              ? "warning"
              : "fail",
        message:
          security.error ||
          `${security.total} issues found (${security.critical} critical, ${security.high} high)`,
        details:
          security.critical > 0
            ? [`${security.critical} critical vulnerabilities detected`]
            : undefined,
      });
    }

    if (reality) {
      checks.push({
        id: "reality",
        name: "Reality Check",
        shortName: "Reality",
        status:
          reality.verdict === "pass"
            ? "pass"
            : reality.verdict === "skipped"
              ? "skip"
              : reality.verdict === "error"
                ? "warning"
                : "fail",
        message:
          reality.message ||
          reality.error ||
          `${reality.passed || 0}/${reality.totalTests || 0} tests passed`,
        details: reality.failures?.slice(0, 3).map((f) => f.title),
      });
    }

    if (guardrail) {
      checks.push({
        id: "guardrails",
        name: "guardrail Checks",
        shortName: "Guardrails",
        status:
          guardrail.verdict === "pass"
            ? "pass"
            : guardrail.verdict === "error"
              ? "warning"
              : "fail",
        message:
          guardrail.error ||
          (guardrail.violations.length > 0
            ? `${guardrail.violations.length} violations`
            : "All checks passed"),
        details: guardrail.violations.slice(0, 3),
      });
    }

    return checks;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Rocket className="h-7 w-7 text-blue-400" />
            Ship Check
          </h1>
          <p className="text-zinc-400 mt-1">
            Stop shipping pretend features. Run MockProof + Reality Mode + Badge
            in one click.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            disabled={!currentRun}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => runShipCheck()}
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Ship Check
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-red-950/20 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-red-400 hover:text-red-300"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {isScanning && currentRun && (
        <Card className="bg-blue-950/20 border-blue-500/30" role="status" aria-live="polite" aria-label="Ship check in progress">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" aria-hidden="true" />
                <span className="text-blue-400 font-medium">
                  Running Ship Check...
                </span>
              </div>
              <span className="text-sm text-zinc-500">
                {currentRun.progress}%
              </span>
            </div>
            <Progress value={currentRun.progress} className="h-2" />
            <p className="text-xs text-zinc-500 mt-2">
              Scanning {currentRun.repo}@{currentRun.branch}
            </p>
          </CardContent>
        </Card>
      )}

      {currentRun && currentRun.status === "completed" && (
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {getVerdictBadge()}
                <div>
                  <div className="text-4xl font-bold text-white">
                    {currentRun.score}/100
                  </div>
                  <div className="text-sm text-zinc-400">Ship Score</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {currentRun.securityResult && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">
                      {currentRun.securityResult.verdict === "pass"
                        ? "✓"
                        : currentRun.securityResult.total}
                    </div>
                    <div className="text-xs text-zinc-500">Security</div>
                  </div>
                )}
                {currentRun.realityResult && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {currentRun.realityResult.passed || 0}/
                      {currentRun.realityResult.totalTests || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Tests</div>
                  </div>
                )}
                {currentRun.guardrailResult && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">
                      {currentRun.guardrailResult.violations.length}
                    </div>
                    <div className="text-xs text-zinc-500">Violations</div>
                  </div>
                )}
              </div>
            </div>
            <Progress value={currentRun.score} className="mt-4 h-2" />
          </CardContent>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-zinc-800"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="github"
            className="data-[state=active]:bg-zinc-800"
          >
            <Github className="h-4 w-4 mr-2" />
            GitHub
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-zinc-800"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="reality"
            className="data-[state=active]:bg-zinc-800"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reality
          </TabsTrigger>
          <TabsTrigger
            value="guardrails"
            className="data-[state=active]:bg-zinc-800"
          >
            <Lock className="h-4 w-4 mr-2" />
            Guardrails
          </TabsTrigger>
          <TabsTrigger
            value="replay"
            className="data-[state=active]:bg-zinc-800"
          >
            <Play className="h-4 w-4 mr-2" />
            Replay
          </TabsTrigger>
          <TabsTrigger
            value="badge"
            className="data-[state=active]:bg-zinc-800"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Badge
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {!currentRun || currentRun.status === "pending" ? (
            <Card className="bg-black/40 border-zinc-800">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                  <Rocket className="h-10 w-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Ready to Ship Check?
                </h3>
                <p className="text-zinc-400 text-center max-w-md mb-6">
                  Run a comprehensive scan to detect mock data, fake endpoints,
                  and placeholder content.
                </p>
                <Button
                  onClick={() => runShipCheck()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Ship Check
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {generateChecksFromRun().map((check) => (
                <Card key={check.id} className="bg-black/40 border-zinc-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-zinc-300">
                        {check.name}
                      </CardTitle>
                      {getStatusIcon(check.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-zinc-400">{check.message}</p>
                    {check.details && check.details.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {check.details.slice(0, 3).map((detail, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-zinc-500 font-mono truncate"
                          >
                            {detail}
                          </div>
                        ))}
                        {check.details.length > 3 && (
                          <div className="text-xs text-blue-400">
                            +{check.details.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <Card className="bg-black/40 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Recent Runs</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadHistory}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 rounded bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-black"
                      onClick={() => loadRunDetails(run.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          loadRunDetails(run.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View run details for ${run.repo} on branch ${run.branch}, status: ${run.status}, score: ${run.score}`}
                    >
                      <div className="flex items-center gap-3">
                        {run.verdict === "pass" || run.verdict === "ship" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : run.verdict === "fail" ||
                          run.verdict === "no-ship" ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                        <div>
                          <span className="text-sm text-zinc-300">
                            {run.repo}
                          </span>
                          <span className="text-xs text-zinc-600 ml-2">
                            @{run.branch}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            run.status === "completed"
                              ? "border-emerald-500/30 text-emerald-400"
                              : run.status === "running"
                                ? "border-blue-500/30 text-blue-400"
                                : "border-red-500/30 text-red-400",
                          )}
                        >
                          {run.status}
                        </Badge>
                        <span className="text-xs text-zinc-500">
                          Score: {run.score}/100
                        </span>
                      </div>
                      <span className="text-xs text-zinc-600">
                        {run.createdAt
                          ? new Date(run.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="github" className="space-y-4">
          {/* Use centralized GitHub integration card */}
          <GitHubIntegrationCard
            variant="full"
            showRepos={true}
            maxRepos={20}
            onRepoSelect={(repoFullName) => runGitHubScan(repoFullName)}
            selectedRepo={selectedRepo}
          />
          
          {/* Quick scan action for selected repo */}
          {selectedRepo && githubConnected && (
            <Card className="bg-blue-950/30 border-blue-800/50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="font-medium text-white">{selectedRepo}</p>
                      <p className="text-xs text-zinc-400">Selected for Ship Check</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => runShipCheck(selectedRepo)}
                    disabled={isScanning}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    Run Ship Check
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="bg-black/40 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-400" />
                    Security Scan
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Detect vulnerabilities, secrets, and security issues
                  </CardDescription>
                </div>
                {currentRun?.securityResult && (
                  <Badge
                    className={cn(
                      currentRun.securityResult.verdict === "pass"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : currentRun.securityResult.verdict === "error"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30",
                    )}
                  >
                    {currentRun.securityResult.verdict === "pass"
                      ? "✅ SECURE"
                      : currentRun.securityResult.verdict === "error"
                        ? "⚠️ ERROR"
                        : "❌ ISSUES FOUND"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentRun?.securityResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-red-950/20 border border-red-500/20">
                      <div className="text-2xl font-bold text-red-400">
                        {currentRun.securityResult.critical}
                      </div>
                      <div className="text-xs text-zinc-500">Critical</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-orange-950/20 border border-orange-500/20">
                      <div className="text-2xl font-bold text-orange-400">
                        {currentRun.securityResult.high}
                      </div>
                      <div className="text-xs text-zinc-500">High</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-yellow-950/20 border border-yellow-500/20">
                      <div className="text-2xl font-bold text-yellow-400">
                        {currentRun.securityResult.medium}
                      </div>
                      <div className="text-xs text-zinc-500">Medium</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-950/20 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">
                        {currentRun.securityResult.low}
                      </div>
                      <div className="text-xs text-zinc-500">Low</div>
                    </div>
                  </div>

                  {currentRun.securityResult.total === 0 && (
                    <div className="text-center py-8" role="status" aria-live="polite">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" aria-hidden="true" />
                      <h3 className="text-lg font-medium text-white mb-1">
                        All Clear!
                      </h3>
                      <p className="text-zinc-400">
                        No security issues detected.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    Run a Ship Check to see security results
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reality" className="space-y-4">
          <Card className="bg-black/40 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    Reality Check
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Run tests and verify real functionality
                  </CardDescription>
                </div>
                {currentRun?.realityResult && (
                  <Badge
                    className={cn(
                      currentRun.realityResult.verdict === "pass"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : currentRun.realityResult.verdict === "skipped"
                          ? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30",
                    )}
                  >
                    {currentRun.realityResult.verdict === "pass"
                      ? "✅ TESTS PASS"
                      : currentRun.realityResult.verdict === "skipped"
                        ? "⏭️ SKIPPED"
                        : "⚠️ TESTS FAILED"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentRun?.realityResult ? (
                <div className="space-y-4">
                  {currentRun.realityResult.message && (
                    <p className="text-sm text-zinc-400">
                      {currentRun.realityResult.message}
                    </p>
                  )}

                  {currentRun.realityResult.totalTests !== undefined && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-blue-950/20 border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400">
                          {currentRun.realityResult.totalTests}
                        </div>
                        <div className="text-xs text-zinc-500">Total</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-400">
                          {currentRun.realityResult.passed || 0}
                        </div>
                        <div className="text-xs text-zinc-500">Passed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-950/20 border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400">
                          {currentRun.realityResult.failed || 0}
                        </div>
                        <div className="text-xs text-zinc-500">Failed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/20">
                        <div className="text-2xl font-bold text-zinc-400">
                          {currentRun.realityResult.skipped || 0}
                        </div>
                        <div className="text-xs text-zinc-500">Skipped</div>
                      </div>
                    </div>
                  )}

                  {currentRun.realityResult.failures &&
                    currentRun.realityResult.failures.length > 0 && (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        <h4 className="text-sm font-medium text-zinc-300">
                          Test Failures
                        </h4>
                        {currentRun.realityResult.failures.map(
                          (failure, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-red-950/20 border border-red-500/20"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-red-400">
                                    {failure.title}
                                  </div>
                                  {failure.file && (
                                    <div className="font-mono text-xs text-zinc-500 mt-1">
                                      {failure.file}
                                    </div>
                                  )}
                                  {failure.error && (
                                    <pre className="text-xs text-zinc-400 mt-2 whitespace-pre-wrap">
                                      {failure.error}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                  {currentRun.realityResult.verdict === "pass" && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-white mb-1">
                        All Tests Pass!
                      </h3>
                      <p className="text-zinc-400">
                        {currentRun.realityResult.passed} tests passed in{" "}
                        {(
                          (currentRun.realityResult.duration || 0) / 1000
                        ).toFixed(1)}
                        s
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    Run a Ship Check to see reality check results
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardrails" className="space-y-4">
          <Card className="bg-black/40 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lock className="h-5 w-5 text-orange-400" />
                    guardrail Checks
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Verify code quality and production readiness
                  </CardDescription>
                </div>
                {currentRun?.guardrailResult && (
                  <Badge
                    className={cn(
                      currentRun.guardrailResult.verdict === "pass"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30",
                    )}
                  >
                    {currentRun.guardrailResult.verdict === "pass"
                      ? "✅ PASS"
                      : "❌ FAIL"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentRun?.guardrailResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={cn(
                        "p-4 rounded-lg border",
                        currentRun.guardrailResult.checks.noMockData
                          ? "bg-emerald-950/20 border-emerald-500/20"
                          : "bg-red-950/20 border-red-500/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {currentRun.guardrailResult.checks.noMockData ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-sm text-zinc-300">
                          No Mock Data
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "p-4 rounded-lg border",
                        currentRun.guardrailResult.checks.noHardcodedSecrets
                          ? "bg-emerald-950/20 border-emerald-500/20"
                          : "bg-red-950/20 border-red-500/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {currentRun.guardrailResult.checks
                          .noHardcodedSecrets ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-sm text-zinc-300">
                          No Hardcoded Secrets
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "p-4 rounded-lg border",
                        currentRun.guardrailResult.checks.realApiCalls
                          ? "bg-emerald-950/20 border-emerald-500/20"
                          : "bg-amber-950/20 border-amber-500/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {currentRun.guardrailResult.checks.realApiCalls ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                        <span className="text-sm text-zinc-300">
                          Real API Calls
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "p-4 rounded-lg border",
                        currentRun.guardrailResult.checks.properErrorHandling
                          ? "bg-emerald-950/20 border-emerald-500/20"
                          : "bg-red-950/20 border-red-500/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {currentRun.guardrailResult.checks
                          .properErrorHandling ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-sm text-zinc-300">
                          Proper Error Handling
                        </span>
                      </div>
                    </div>
                  </div>

                  {currentRun.guardrailResult.violations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-zinc-300">
                        Violations
                      </h4>
                      {currentRun.guardrailResult.violations.map(
                        (violation, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg bg-red-950/20 border border-red-500/20"
                          >
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-400" />
                              <span className="text-sm text-red-400">
                                {violation}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {currentRun.guardrailResult.violations.length === 0 &&
                    currentRun.guardrailResult.verdict === "pass" && (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                        <p className="text-zinc-300">
                          All guardrail checks passed!
                        </p>
                        <p className="text-sm text-zinc-500">
                          Your code is production ready.
                        </p>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  Run a Ship Check to see guardrail results
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replay" className="space-y-4">
          <Card className="bg-black/40 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Play className="h-5 w-5 text-purple-400" />
                    Test Replay
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    View test recordings, traces, and timeline
                  </CardDescription>
                </div>
                {replayData?.available && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    📹 Recording Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {replayData?.available ? (
                <div className="space-y-6">
                  {replayData.testSummary && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-purple-950/20 border border-purple-500/20">
                        <div className="text-2xl font-bold text-purple-400">
                          {replayData.testSummary.totalTests}
                        </div>
                        <div className="text-xs text-zinc-500">Total Tests</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-400">
                          {replayData.testSummary.passed}
                        </div>
                        <div className="text-xs text-zinc-500">Passed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-950/20 border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400">
                          {replayData.testSummary.failed}
                        </div>
                        <div className="text-xs text-zinc-500">Failed</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-blue-950/20 border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400">
                          {(replayData.testSummary.duration / 1000).toFixed(1)}s
                        </div>
                        <div className="text-xs text-zinc-500">Duration</div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {replayData.traceUrl && (
                      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="h-5 w-5 text-blue-400" />
                          <div>
                            <div className="text-sm font-medium text-white">
                              Trace File
                            </div>
                            <div className="text-xs text-zinc-500">
                              {replayData.traceSize
                                ? `${(replayData.traceSize / 1024).toFixed(1)} KB`
                                : "Available"}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-zinc-700"
                          asChild
                        >
                          <a
                            href={replayData.traceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Trace
                          </a>
                        </Button>
                      </div>
                    )}

                    {replayData.videoUrl && (
                      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <div className="flex items-center gap-3 mb-3">
                          <Video className="h-5 w-5 text-purple-400" />
                          <div>
                            <div className="text-sm font-medium text-white">
                              Video Recording
                            </div>
                            <div className="text-xs text-zinc-500">
                              {replayData.videoSize
                                ? `${(replayData.videoSize / 1024 / 1024).toFixed(1)} MB`
                                : "Available"}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-zinc-700"
                          asChild
                        >
                          <a
                            href={replayData.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Watch Video
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>

                  {currentRun?.realityResult?.failures &&
                    currentRun.realityResult.failures.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-zinc-300">
                          Failed Tests Timeline
                        </h4>
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-800" />
                          {currentRun.realityResult.failures.map(
                            (failure, idx) => (
                              <div key={idx} className="relative pl-10 pb-4">
                                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-red-500 border-2 border-zinc-900" />
                                <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/20">
                                  <div className="font-medium text-red-400">
                                    {failure.title}
                                  </div>
                                  {failure.file && (
                                    <div className="font-mono text-xs text-zinc-500 mt-1">
                                      {failure.file}
                                    </div>
                                  )}
                                  {failure.error && (
                                    <pre className="text-xs text-zinc-400 mt-2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                      {failure.error}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    No Replay Available
                  </h3>
                  <p className="text-zinc-400 max-w-md mx-auto">
                    Run a Ship Check with reality tests enabled to generate
                    trace files and video recordings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badge" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-black/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-emerald-400" />
                  Ship Badge
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Shareable proof that your app is real
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentRun && currentRun.status === "completed" ? (
                  <div className="space-y-6">
                    <div className="p-8 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
                      <div className="flex flex-col items-center gap-4">
                        <div
                          className={cn(
                            "inline-flex items-center gap-3 px-6 py-3 rounded-lg",
                            "bg-gradient-to-br from-slate-800 to-slate-900",
                            "border shadow-lg",
                            getVerdictFromRun() === "ship"
                              ? "border-emerald-500/30 shadow-emerald-500/20"
                              : getVerdictFromRun() === "review"
                                ? "border-amber-500/30 shadow-amber-500/20"
                                : "border-red-500/30 shadow-red-500/20",
                          )}
                        >
                          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
                            <span className="text-blue-400 font-bold">⬡</span>
                            <span className="text-sm font-semibold text-white">
                              guardrail
                            </span>
                          </div>
                          <div
                            className={cn(
                              "px-4 py-1.5 rounded-md font-bold text-sm text-white",
                              getVerdictFromRun() === "ship"
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                                : getVerdictFromRun() === "review"
                                  ? "bg-gradient-to-r from-amber-500 to-amber-600"
                                  : "bg-gradient-to-r from-red-500 to-red-600",
                            )}
                          >
                            {getVerdictFromRun() === "ship"
                              ? "🚀 SHIP IT"
                              : getVerdictFromRun() === "review"
                                ? "⚠️ REVIEW"
                                : "⛔ NO SHIP"}
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">
                            {currentRun.score}/100
                          </div>
                          <div className="text-xs text-slate-500">
                            Ship Score
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Embed in README
                      </label>
                      <div className="relative group">
                        <pre className="p-4 rounded-lg bg-slate-900/80 border border-slate-700/50 text-xs text-slate-400 overflow-x-auto font-mono">
                          {`[![guardrail](https://guardrailai.dev/badge/${currentRun.repo})](https://guardrailai.dev)`}
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={copyEmbedCode}
                          aria-label={copied ? "Copied to clipboard" : "Copy embed code"}
                          aria-live="polite"
                        >
                          {copied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Share2 className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400">
                      Run a Ship Check to generate your badge
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Check Details</CardTitle>
              </CardHeader>
              <CardContent>
                {currentRun && currentRun.status === "completed" ? (
                  <div className="space-y-2">
                    {generateChecksFromRun().map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center justify-between p-3 rounded bg-zinc-900/50 border border-zinc-800"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(check.status)}
                          <span className="text-sm text-zinc-300">
                            {check.shortName}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            check.status === "pass"
                              ? "border-emerald-500/30 text-emerald-400"
                              : check.status === "fail"
                                ? "border-red-500/30 text-red-400"
                                : check.status === "warning"
                                  ? "border-amber-500/30 text-amber-400"
                                  : "border-zinc-700 text-zinc-500",
                          )}
                        >
                          {check.status.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    Run a Ship Check to see details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
