"use client";

import { useAuth, AuthProvider } from "./context/auth-context";
import { useGitHub, GitHubProvider } from "./context/github-context";
import { useRepository, RepositoryProvider } from "./context/repository-context";
import { DashboardProvider } from "./context/dashboard-context";
import { RouteProvider, useRoute } from "./context/route-context";
import { ThemeProvider } from "./components/theme-provider";
import { useScan, type ScanResult } from "./hooks/use-scan";
import { cn } from "./components/ui/utils";
import { Header } from "./components/header";
import { Sidebar } from "./components/sidebar";
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
  TrendingUp,
  Zap,
  Eye,
  GitBranch,
  Star,
  Code,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { DotScreenShader } from "./components/ui/dot-shader-background";
import { HealthScoreCard } from "./components/dashboard/health-score-card";
import { StatsGrid } from "./components/dashboard/stats-grid";
import { ScanHistoryChart } from "./components/dashboard/scan-history-chart";
import { HealthGraph } from "./components/dashboard/health-graph";
import { SeverityChart } from "./components/dashboard/severity-chart";
import { QualityTrendChart } from "./components/dashboard/quality-trend-chart";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { ShipCheckPage } from "./pages/ship-check";
import { IntelligencePage } from "./pages/intelligence";
import { RunsPage } from "./pages/runs";
import { SettingsPage } from "./pages/settings";
import { GuardrailsPage } from "./pages/guardrails";
import { VulnerabilitiesPage } from "./pages/vulnerabilities";
import { RepositoriesPage } from "./pages/repositories";
import { ReportsPage } from "./pages/reports";
import { TeamPage } from "./pages/team";
import { AlertsPage } from "./pages/alerts";
import { PoliciesPage } from "./pages/policies";
import { CompliancePage } from "./pages/compliance";
import { CLIPage } from "./pages/cli";
import { MCPPage } from "./pages/mcp";
import { APIKeyPage } from "./pages/api-key";
import { BillingPage } from "./pages/billing";
import { CommandCenterPage } from "./pages/command-center";
import { RunsProofPage } from "./pages/runs-proof";
import { PoliciesNewPage } from "./pages/policies-new";

function DashboardPage() {
  const { tier } = useAuth();
  const {
    selectedRepo: contextSelectedRepo,
    setSelectedRepo: setContextSelectedRepo,
    scanResults,
    setScanResults,
  } = useRepository();

  const {
    status: scanStatus,
    progress: scanProgress,
    message: scanMessage,
    result: hookScanResult,
    startGitHubScan,
  } = useScan({
    onComplete: (result) => {
      setScanResult(result as ScanResult);
      setScanResults(result as any);
    },
    onError: (error) => {
      setScanError(error);
    },
  });

  const {
    connected: githubConnected,
    repositories: githubRepos,
    connect: connectGitHub,
    loading: githubLoading,
  } = useGitHub();

  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    setScanning(scanStatus === "running");
    if (hookScanResult) {
      setScanResult(hookScanResult as ScanResult);
    }
  }, [scanStatus, hookScanResult]);

  useEffect(() => {
    if (scanResults) {
      setScanResult(scanResults as ScanResult);
    }
  }, [scanResults]);

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
      await startGitHubScan(contextSelectedRepo.owner, contextSelectedRepo.repo, { scanType: type });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed");
    }
  };

  const selectedRepoData = githubRepos.find(r => r.fullName === selectedRepoFullName);

  return (
    <div className="space-y-8">
      {/* Header - Clean and Simple */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Security Dashboard
          </h1>
          <p className="text-zinc-500 mt-2">Monitor and analyze repository security posture</p>
        </div>
        {tier === "free" && (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-4 py-2">
            Free Plan
          </Badge>
        )}
      </motion.div>

      {/* Stats Grid - Consistent sizing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <StatsGrid />
      </motion.div>

      {/* GitHub Connection - Clean Card */}
      {!githubConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="py-12">
              <div className="text-center space-y-6 max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                  <Github className="w-10 h-10 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-white">Connect GitHub</h3>
                  <p className="text-zinc-400 mt-2">Connect your GitHub account to start scanning repositories</p>
                </div>
                <Button 
                  onClick={connectGitHub} 
                  disabled={githubLoading}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-0 shadow-lg shadow-blue-500/25"
                >
                  {githubLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Github className="w-5 h-5 mr-2" />
                  )}
                  Connect GitHub Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Repository Scanner */}
      {githubConnected && githubRepos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="py-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
                    <Shield className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">Repository Scanner</h3>
                    <p className="text-sm text-zinc-400">Select repository and run security analysis</p>
                  </div>
                </div>
                
                {/* Controls */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                  {/* Repository Selector */}
                  <div className="flex-1 w-full lg:w-auto">
                    <Select
                      value={selectedRepoFullName}
                      onValueChange={handleRepoChange}
                    >
                      <SelectTrigger className="w-full border-zinc-700 bg-zinc-900/80 text-zinc-200 backdrop-blur h-11">
                        <SelectValue placeholder="Select repository" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {githubRepos.map((repo) => (
                          <SelectItem
                            key={repo.id}
                            value={repo.fullName}
                            className="text-zinc-200 focus:bg-zinc-800"
                          >
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-3 h-3 text-zinc-500" />
                              {repo.fullName}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Scan Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={!contextSelectedRepo || scanning}
                      onClick={() => runScan("full")}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-0 shadow-lg shadow-blue-500/20 h-11"
                    >
                      {scanning ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Run Scan
                    </Button>
                    
                    <Button
                      variant="outline"
                      disabled={!contextSelectedRepo || scanning}
                      onClick={() => runScan("security")}
                      className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 h-11"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Security
                    </Button>
                    
                    <Button
                      variant="outline"
                      disabled={!contextSelectedRepo || scanning}
                      onClick={() => runScan("ship")}
                      className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 h-11"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      Ship
                    </Button>
                  </div>
                </div>

                {/* Repository Info */}
                {selectedRepoData && (
                  <div className="flex items-center gap-6 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Star className="w-4 h-4 text-blue-400" />
                      <span>{selectedRepoData.stars.toLocaleString()} stars</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span>{selectedRepoData.language}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <GitBranch className="w-4 h-4 text-blue-400" />
                      <span>main</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Scan Progress */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="bg-gradient-to-r from-blue-950/40 to-purple-950/40 border-blue-800/50 backdrop-blur">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5 text-blue-400" />
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-blue-300">
                      {scanMessage || "Scanning..."}
                    </span>
                    <span className="text-xs text-blue-400 font-mono">{scanProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-950/50 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Scan Error */}
      {scanError && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-red-950/30 border-red-800/50 backdrop-blur">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm">{scanError}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={cn(
            "border-l-4 overflow-hidden",
            scanResult.verdict === "SHIP"
              ? "bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border-l-emerald-500 border-emerald-800/50"
              : scanResult.verdict === "NO_SHIP"
                ? "bg-gradient-to-br from-red-950/40 to-red-900/20 border-l-red-500 border-red-800/50"
                : "bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border-l-zinc-500 border-zinc-800"
          )}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Scan Results: {selectedRepoFullName}
                  {scanResult.verdict && (
                    <Badge
                      className={cn(
                        "ml-2",
                        scanResult.verdict === "SHIP"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : scanResult.verdict === "NO_SHIP"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      )}
                    >
                      {scanResult.verdict}
                    </Badge>
                  )}
                </CardTitle>
                {scanResult.score !== undefined && (
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                      {scanResult.score}/100
                    </div>
                    <div className="text-xs text-zinc-400">Overall Score</div>
                  </div>
                )}
              </div>
              <CardDescription className="text-zinc-400">
                Scanned {scanResult.mockproof?.scannedFiles || 0} files • {scanResult.vulnerabilities || 0} vulnerabilities found
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50">
                {scanResult.verdict === "SHIP" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                <span className="text-zinc-300">
                  {scanResult.verdict === "SHIP"
                    ? "✨ Ready to ship! Your code meets all security standards."
                    : "⚠️ Issues found that need to be addressed before shipping."}
                </span>
              </div>

              {scanResult.issues && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/30">
                    <div className="text-2xl font-bold text-red-400">{scanResult.issues.critical}</div>
                    <div className="text-xs text-zinc-400 mt-1">Critical</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-950/30 border border-orange-800/30">
                    <div className="text-2xl font-bold text-orange-400">{scanResult.issues.high}</div>
                    <div className="text-xs text-zinc-400 mt-1">High</div>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-950/30 border border-yellow-800/30">
                    <div className="text-2xl font-bold text-yellow-400">{scanResult.issues.medium}</div>
                    <div className="text-xs text-zinc-400 mt-1">Medium</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/30">
                    <div className="text-2xl font-bold text-blue-400">{scanResult.issues.low}</div>
                    <div className="text-xs text-zinc-400 mt-1">Low</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Weekly Scan Activity - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ScanHistoryChart />
      </motion.div>

      {/* Three Column Layout - Quality Trend, Severity, Health Graph */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Code Quality Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <QualityTrendChart />
        </motion.div>

        {/* Severity Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <SeverityChart />
        </motion.div>

        {/* Health Graph */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <HealthGraph />
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-zinc-400">Common security analysis tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <button className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 hover:bg-zinc-900 transition-all group text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">View Findings</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Security scan results</p>
                  </div>
                </div>
              </button>

              <button className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 hover:bg-zinc-900 transition-all group text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">Audit Log</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Activity history</p>
                  </div>
                </div>
              </button>

              <button className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 hover:bg-zinc-900 transition-all group text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                    <Activity className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">Analytics</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Security metrics</p>
                  </div>
                </div>
              </button>

              <button className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 hover:bg-zinc-900 transition-all group text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                    <Settings className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">Settings</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Configure rules</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Your latest security scans and results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanResult ? (
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      scanResult.verdict === "SHIP" ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-red-500 shadow-lg shadow-red-500/50"
                    )} />
                    <div>
                      <p className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                        {selectedRepoFullName}
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date().toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      scanResult.verdict === "SHIP"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    )}
                  >
                    {scanResult.verdict}
                  </Badge>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No recent scans</p>
                  <p className="text-sm mt-1">Run a scan to see results here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function DashboardContent() {
  const { currentRoute } = useRoute();

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Header */}
        <Header />

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto bg-black text-white relative">
          {/* Animated Shader Background - Fixed to viewport */}
          <div className="fixed inset-0 pointer-events-none z-0" style={{ left: '256px' }}>
            <DotScreenShader />
          </div>
          
          <div className="relative z-10 p-8">
            <div className="max-w-7xl mx-auto">
              {/* Route to different pages */}
              {currentRoute === "/dashboard" && <CommandCenterPage />}
              {currentRoute === "/runs" && <RunsProofPage />}
              {currentRoute === "/policies" && <PoliciesNewPage />}
              
              {/* Legacy routes for backward compatibility */}
              {currentRoute === "/ship" && <ShipCheckPage />}
              {currentRoute === "/intelligence" && <IntelligencePage />}
              {currentRoute === "/guardrails" && <GuardrailsPage />}
              {currentRoute === "/settings" && <SettingsPage />}
              {currentRoute === "/vulnerabilities" && <VulnerabilitiesPage />}
              {currentRoute === "/repositories" && <RepositoriesPage />}
              {currentRoute === "/reports" && <ReportsPage />}
              {currentRoute === "/team" && <TeamPage />}
              {currentRoute === "/alerts" && <AlertsPage />}
              {currentRoute === "/compliance" && <CompliancePage />}
              {currentRoute === "/cli" && <CLIPage />}
              {currentRoute === "/mcp" && <MCPPage />}
              {currentRoute === "/api-key" && <APIKeyPage />}
              {currentRoute === "/billing" && <BillingPage />}
              
              {/* Placeholder for other routes */}
              {!["/dashboard", "/runs", "/policies", "/ship", "/intelligence", "/guardrails", "/settings", "/vulnerabilities", "/repositories", "/reports", "/team", "/alerts", "/compliance", "/cli", "/mcp", "/api-key", "/billing"].includes(currentRoute) && (
                <div className="text-center py-20">
                  <h2 className="text-2xl font-bold text-zinc-400">Coming Soon</h2>
                  <p className="text-zinc-500 mt-2">This page is under development</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GitHubProvider>
        <RepositoryProvider>
          <DashboardProvider>
            <RouteProvider>
              <ThemeProvider>
                <DashboardContent />
              </ThemeProvider>
            </RouteProvider>
          </DashboardProvider>
        </RepositoryProvider>
      </GitHubProvider>
    </AuthProvider>
  );
}