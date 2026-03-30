"use client";

import { ConnectedClientsCard } from "@/components/dashboard/connected-clients-card";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { useGitHub } from "@/context/github-context";
import { useRepository } from "@/context/repository-context";
import { useScan, type ScanResult } from "@/hooks";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCode,
  Github,
  Loader2,
  Play,
  Rocket,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, isPaid, tier } = useAuth();
  const {
    selectedRepo: contextSelectedRepo,
    setSelectedRepo: setContextSelectedRepo,
    scanResults,
    setScanResults,
  } = useRepository();

  // Use scan hook for GitHub scanning
  const {
    status: scanStatus,
    progress: scanProgress,
    message: scanMessage,
    result: hookScanResult,
    startGitHubScan,
    reset: resetScan,
  } = useScan({
    onComplete: (result) => {
      setScanResult(result as unknown as ScanResult);
    },
    onError: (error) => {
      setScanError(error);
    },
  });

  // Use centralized GitHub context
  const {
    connected: githubConnected,
    repositories: githubRepos,
    connect: connectGitHub,
    refresh: refreshGitHub,
    loading: githubLoading,
  } = useGitHub();

  // Local state
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Update scanning state based on scan hook
  useEffect(() => {
    setScanning(scanStatus === "running");
    if (hookScanResult) {
      setScanResult(hookScanResult as unknown as ScanResult);
    }
  }, [scanStatus, hookScanResult]);

  // Update scan result when context changes
  useEffect(() => {
    if (scanResults) {
      setScanResult(scanResults as unknown as ScanResult);
    }
  }, [scanResults]);

  useEffect(() => {
    if (isDevAuthBypassEnabled()) return;
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/auth?redirect=/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    if (!searchParams) return;

    const githubConnected = searchParams.get("github_connected");
    const error = searchParams.get("error");

    if (githubConnected === "true") {
      // Clear the URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete("github_connected");
      window.history.replaceState({}, "", url.toString());

      // Refresh GitHub context to update connection status
      refreshGitHub().catch(() => {
        // Handle silently - the context will update automatically
      });
    } else if (error) {
      // Handle OAuth error
      logger.logUnknownError("GitHub OAuth error", error);
      // Clear the error parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, connectGitHub, refreshGitHub]);

  const selectedRepoFullName = contextSelectedRepo
    ? `${contextSelectedRepo.owner}/${contextSelectedRepo.repo}`
    : "";

  const handleRepoChange = (value: string) => {
    const [owner, repo] = value.split("/");
    setContextSelectedRepo({ owner, repo, fullName: value });
  };

  const runScan = async (type: "ship" | "security" | "full") => {
    if (!contextSelectedRepo) return;

    setScanError(null);
    setScanResult(null);

    try {
      if (!contextSelectedRepo) {
        throw new Error("No repository selected");
      }
      await startGitHubScan(
        contextSelectedRepo.owner,
        contextSelectedRepo.repo,
        { scanType: type },
      );
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed");
    }
  };

  if (!isDevAuthBypassEnabled() && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm">
          {isLoading ? "Loading…" : "Redirecting to sign in…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Security scanning and code analysis
          </p>
        </div>
        {tier === "free" && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            Free Plan
          </Badge>
        )}
      </div>

      {/* GitHub Connection Empty State */}
      {!githubConnected && (
        <Card className="bg-card border-border glass-card">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mx-auto">
                <Github className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Connect GitHub to Get Started
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Connect your GitHub account to start scanning repositories for security vulnerabilities, code quality issues, and compliance checks.
                </p>
              </div>
              <div className="pt-4">
                <Button
                  onClick={connectGitHub}
                  disabled={githubLoading}
                  className="bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  {githubLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4 mr-2" />
                      Connect GitHub
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Your repositories will be securely accessed with read-only permissions
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repository Scanner Empty State */}
      {githubConnected && githubRepos.length === 0 && (
        <Card className="bg-card border-border glass-card">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mx-auto">
                <FileCode className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  No Repositories Found
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  We couldn't find any repositories in your GitHub account. Make sure you have repositories with content to scan.
                </p>
              </div>
              <div className="pt-4 flex gap-3 justify-center">
                <Button
                  onClick={refreshGitHub}
                  disabled={githubLoading}
                  variant="outline"
                >
                  {githubLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 mr-2" />
                      Refresh Repositories
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => window.open("https://github.com/new", "_blank")}
                  variant="outline"
                >
                  <Github className="w-4 h-4 mr-2" />
                  Create Repository
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repository Scanner */}
      {githubConnected && githubRepos.length > 0 && (
        <Card className="bg-card border-border glass-card">
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <Github className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">
                      Repository Scanner
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Select a repository and run security scans
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedRepoFullName}
                    onValueChange={handleRepoChange}
                  >
                    <SelectTrigger className="w-[250px] border-border bg-card text-foreground">
                      <SelectValue placeholder="Select repository" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {githubRepos.map((repo) => (
                        <SelectItem
                          key={repo.id}
                          value={repo.fullName}
                          className="text-foreground focus:bg-secondary"
                        >
                          {repo.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!contextSelectedRepo || scanning}
                    onClick={() => runScan("ship")}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {scanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4 mr-1" />
                    )}
                    Ship Check
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!contextSelectedRepo || scanning}
                    onClick={() => runScan("security")}
                    className="border-red-700 bg-red-900/30 hover:bg-red-800/50 text-red-400"
                  >
                    <Shield className="w-4 h-4 mr-1" />
                    Security
                  </Button>
                  <Button
                    size="sm"
                    disabled={!contextSelectedRepo || scanning}
                    onClick={() => runScan("full")}
                    className="bg-accent-cyan hover:bg-accent-cyan/90 text-charcoal-900"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Full Scan
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Progress */}
      {scanning && (
        <Card className="bg-teal-950/30 border-teal-800/50 glass-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-blue-300">
                    {scanMessage || "Scanning..."}
                  </span>
                  <span className="text-xs text-blue-400">{scanProgress}%</span>
                </div>
                <div className="w-full bg-blue-950 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Error */}
      {scanError && (
        <Card className="bg-red-950/50 border-red-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-red-400 font-medium mb-1">Scan Failed</h4>
                <p className="text-red-300 text-sm">{scanError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setScanError(null);
                    if (contextSelectedRepo) {
                      runScan("ship");
                    }
                  }}
                  className="mt-3 border-red-700 text-red-400 hover:bg-red-900/50"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanResult && (
        <Card
          className={cn(
            "border-l-4",
            scanResult.verdict === "SHIP"
              ? "bg-emerald-950/30 border-l-emerald-500 border-emerald-800/50"
              : scanResult.verdict === "NO_SHIP"
                ? "bg-red-950/30 border-l-red-500 border-red-800/50"
                : "bg-card/50 border-l-muted-foreground border",
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                Scan Results: {selectedRepoFullName}
                {scanResult.verdict && (
                  <Badge
                    className={
                      scanResult.verdict === "SHIP"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : scanResult.verdict === "NO_SHIP"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }
                  >
                    {scanResult.verdict}
                  </Badge>
                )}
              </CardTitle>
              {scanResult.score !== undefined && (
                <span className="text-2xl font-bold text-foreground/80">
                  {scanResult.score}/100
                </span>
              )}
            </div>
            <CardDescription className="text-muted-foreground">
              Scanned {scanResult.mockproof?.scannedFiles || 0} files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {scanResult.verdict === "SHIP" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span className="text-foreground/80">
                {scanResult.verdict === "SHIP"
                  ? "Ready to ship! 🚀"
                  : "Issues found that need to be addressed before shipping."}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/findings" className="group">
          <Card className="bg-card border-border hover:border-teal-500/30 transition-all duration-300 hover-lift h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Findings</p>
                <p className="text-xs text-muted-foreground">
                  Deep scan results
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/audit" className="group">
          <Card className="bg-card border-border hover:border-teal-500/30 transition-all duration-300 hover-lift h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                <Clock className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Audit Log</p>
                <p className="text-xs text-muted-foreground">
                  Activity history
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ship" className="group">
          <Card className="bg-card border-border hover:border-teal-500/30 transition-all duration-300 hover-lift h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <Rocket className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Ship Check</p>
                <p className="text-xs text-muted-foreground">Run deploy gate</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings" className="group">
          <Card className="bg-card border-border hover:border-teal-500/30 transition-all duration-300 hover-lift h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                <Settings className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Settings</p>
                <p className="text-xs text-muted-foreground">Configure rules</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <ConnectedClientsCard />

      {/* Analytics Charts */}
      <AnalyticsCharts />

      {/* Health Score Card */}
      {scanResult && (
        <HealthScoreCard
          score={scanResult.score || 0}
          lastScan={new Date().toISOString()}
          loading={false}
        />
      )}

      {/* Recent Activity */}
      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            Recent Activity
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Your latest security scans and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scanResult ? (
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      scanResult.verdict === "SHIP"
                        ? "bg-teal-500"
                        : "bg-red-500",
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedRepoFullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toISOString()}
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    scanResult.verdict === "SHIP"
                      ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30",
                  )}
                >
                  {scanResult.verdict}
                </Badge>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent scans</p>
                <p className="text-sm">Run a scan to see results here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
