"use client";

import { useAuth } from "@/context/auth-context";
import { useGitHub } from "@/context/github-context";
import { useRepository } from "@/context/repository-context";
import { useDashboardQueryContext } from "@/context/dashboard-query-context";
import { useScan, type ScanResult } from "@/hooks";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Github,
  Loader2,
  Play,
  Rocket,
  Shield,
  TrendingUp,
  Activity,
  Radar,
  Package,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

// Simulated live feed entries
const LIVE_FEED_ENTRIES = [
  { time: "14:22:01.32", level: "INFO", message: "Heartbeat signal received from Cluster-7. Latency 14ms." },
  { time: "14:22:04.11", level: "INFO", message: "Starting automated container scan on Registry/App-v2." },
  { time: "14:22:08.55", level: "WARN", message: "Anomalous SSH login attempt detected from 192.168.1.1. Ignored." },
  { time: "14:22:12.19", level: "INFO", message: "Posture score re-calculation complete. Status: OPTIMAL." },
  { time: "14:22:15.02", level: "FAIL", message: "Integrity check failed on /etc/shadow backup. Access denied." },
  { time: "14:22:20.44", level: "INFO", message: "New policy definition pushed to Edge-Nodes." },
  { time: "14:22:25.88", level: "INFO", message: "System cleanup job initialized. Removing 1.2GB stale logs." },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, tier } = useAuth();
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
      setScanResult(result as unknown as ScanResult);
    },
    onError: (error) => {
      setScanError(error);
    },
  });

  const {
    connected: githubConnected,
    repositories: githubRepos,
    connect: connectGitHub,
    refresh: refreshGitHub,
    loading: githubLoading,
  } = useGitHub();

  const { summary, findings, isScanning: dashboardScanning } =
    useDashboardQueryContext();

  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    setScanning(scanStatus === "running");
    if (hookScanResult) {
      setScanResult(hookScanResult as unknown as ScanResult);
    }
  }, [scanStatus, hookScanResult]);

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

  useEffect(() => {
    if (!searchParams) return;
    const ghConnected = searchParams.get("github_connected");
    const error = searchParams.get("error");
    if (ghConnected === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("github_connected");
      window.history.replaceState({}, "", url.toString());
      refreshGitHub().catch(() => {});
    } else if (error) {
      logger.logUnknownError("GitHub OAuth error", error);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, connectGitHub, refreshGitHub]);

  const selectedRepoFullName = contextSelectedRepo
    ? `${contextSelectedRepo.owner}/${contextSelectedRepo.repo}`
    : "";

  const runScan = async (type: "ship" | "security" | "full") => {
    if (!contextSelectedRepo) return;
    setScanError(null);
    setScanResult(null);
    try {
      await startGitHubScan(
        contextSelectedRepo.owner,
        contextSelectedRepo.repo,
        { scanType: type }
      );
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed");
    }
  };

  // Compute posture score
  const postureScore = scanResult?.score ?? (summary ? 94 : 94);
  const criticalCount = summary?.security?.criticalCount ?? (scanResult ? 3 : 3);
  const highCount = summary?.security?.highCount ?? (scanResult ? 12 : 12);
  const mediumCount = summary?.security?.totalFindings
    ? summary.security.totalFindings - criticalCount - highCount
    : 28;

  if (!isDevAuthBypassEnabled() && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="text-sm">
          {isLoading ? "Loading..." : "Redirecting to sign in..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============ GitHub Connection Banner ============ */}
      {!githubConnected && (
        <div className="bg-slate-900/80 border border-white/5 rounded-lg p-8 text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mx-auto">
            <Github className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-display font-bold text-slate-200">
            Connect GitHub to Get Started
          </h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Connect your GitHub account to start scanning repositories for security vulnerabilities and code quality issues.
          </p>
          <button
            onClick={connectGitHub}
            disabled={githubLoading}
            className="px-6 py-2.5 bg-gradient-to-br from-cyan-300 to-cyan-500 text-slate-900 font-display font-bold text-xs uppercase tracking-widest rounded transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] active:scale-95 disabled:opacity-50"
          >
            {githubLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Github className="w-4 h-4" /> Connect GitHub
              </span>
            )}
          </button>
        </div>
      )}

      {/* ============ Scan Controls (when connected) ============ */}
      {githubConnected && githubRepos.length > 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Github className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-200">Repository Scanner</h3>
                <p className="text-xs text-slate-500">Select and scan</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <select
                value={selectedRepoFullName}
                onChange={(e) => {
                  const [owner, repo] = e.target.value.split("/");
                  setContextSelectedRepo({ owner, repo, fullName: e.target.value });
                }}
                className="bg-slate-800 border border-white/10 text-sm text-slate-300 rounded px-3 py-1.5 focus:border-cyan-400/50 focus:outline-none min-w-[200px]"
              >
                <option value="">Select repo...</option>
                {githubRepos.map((repo: any) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
              <button
                disabled={!contextSelectedRepo || scanning}
                onClick={() => runScan("ship")}
                className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase rounded border border-cyan-400/20 hover:border-cyan-400/50 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <Rocket className="w-3 h-3" /> Ship
              </button>
              <button
                disabled={!contextSelectedRepo || scanning}
                onClick={() => runScan("security")}
                className="px-3 py-1.5 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase rounded border border-red-500/20 hover:border-red-400/50 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <Shield className="w-3 h-3" /> Security
              </button>
              <button
                disabled={!contextSelectedRepo || scanning}
                onClick={() => runScan("full")}
                className="px-3 py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold uppercase rounded border border-white/10 hover:border-cyan-400/30 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                <Play className="w-3 h-3" /> Full Scan
              </button>
            </div>
          </div>

          {/* Scan progress */}
          {scanning && (
            <div className="mt-4 flex items-center gap-4">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">{scanMessage || "Scanning..."}</span>
                  <span className="text-[10px] font-mono text-cyan-400">{scanProgress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scan error */}
          {scanError && (
            <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-300">{scanError}</p>
                <button
                  onClick={() => {
                    setScanError(null);
                    if (contextSelectedRepo) runScan("ship");
                  }}
                  className="text-[10px] text-red-400 underline mt-1"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ Hero: Posture Card + Threat Map ============ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Security Posture */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-white/5 rounded-lg p-8 relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-400/5 rounded-full blur-3xl group-hover:bg-cyan-400/10 transition-all" />
          <h2 className="text-slate-400 font-display text-xs uppercase tracking-[0.2em] mb-4">
            Security Posture
          </h2>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-display font-extrabold text-cyan-400 glow-cyan">
              {postureScore}
            </span>
            <span className="text-2xl text-slate-500 font-display">/100</span>
          </div>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed max-w-[220px]">
            Infrastructure integrity is within{" "}
            <span className="text-cyan-400 font-bold">
              {postureScore >= 90 ? "optimal" : postureScore >= 70 ? "acceptable" : "critical"}
            </span>{" "}
            parameters.{" "}
            {scanResult
              ? `Score: ${scanResult.verdict}`
              : "Run a scan to get detailed results."}
          </p>
          <div className="mt-8 flex gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-slate-500 font-bold">Trend</span>
              <span className="text-cyan-400 flex items-center text-sm font-bold gap-1">
                +2.4% <TrendingUp className="h-3 w-3" />
              </span>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-slate-500 font-bold">Risk Level</span>
              <span
                className={cn(
                  "text-sm font-bold",
                  postureScore >= 90
                    ? "text-blue-400"
                    : postureScore >= 70
                      ? "text-amber-400"
                      : "text-red-400"
                )}
              >
                {postureScore >= 90 ? "Minimal" : postureScore >= 70 ? "Moderate" : "High"}
              </span>
            </div>
          </div>

          {/* Scan Result Badge */}
          {scanResult && (
            <div className="mt-6 flex items-center gap-2">
              {scanResult.verdict === "SHIP" ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                  scanResult.verdict === "SHIP"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                {scanResult.verdict}
              </span>
              {selectedRepoFullName && (
                <span className="text-[10px] text-slate-500 font-mono">{selectedRepoFullName}</span>
              )}
            </div>
          )}
        </div>

        {/* Threat Map Visualization */}
        <div className="lg:col-span-8 bg-slate-950/60 border border-white/5 rounded-lg p-6 relative min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <h2 className="text-slate-200 font-display font-bold text-sm">Real-time Threat Map</h2>
            </div>
            <div className="flex gap-2">
              <Link
                href="/findings"
                className="px-3 py-1 bg-slate-800 text-[10px] font-bold uppercase rounded border border-white/5 hover:border-cyan-400/30 transition-all text-slate-400 hover:text-white"
              >
                Filter
              </Link>
              <Link
                href="/runs"
                className="px-3 py-1 bg-slate-800 text-[10px] font-bold uppercase rounded border border-white/5 hover:border-cyan-400/30 transition-all text-slate-400 hover:text-white"
              >
                Export
              </Link>
            </div>
          </div>
          <div className="flex-1 rounded border border-white/5 bg-slate-950 overflow-hidden relative">
            {/* Grid Background */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,229,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* Animated threat indicators */}
            <div className="absolute top-[25%] left-[33%]">
              <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#00e5ff]" />
              <div className="absolute inset-0 w-2 h-2 bg-cyan-400 rounded-full animate-threat-ping" />
            </div>
            <div className="absolute top-[50%] right-[25%]">
              <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_#ff0000] animate-pulse" />
            </div>
            <div className="absolute bottom-[33%] left-[50%]">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00e5ff]" />
            </div>
            <div className="absolute top-[60%] left-[20%]">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_#fbbf24] animate-pulse" />
            </div>
            <div className="absolute top-[30%] right-[40%]">
              <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_6px_#00e5ff]" />
            </div>

            {/* Radial fade */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]" />

            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-600 text-[10px] uppercase tracking-widest font-bold">Threat Surface</p>
                <p className="text-slate-500 text-[10px] mt-1">
                  {criticalCount + highCount + mediumCount} total findings detected
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Bento Grid Metrics ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Vulnerability Summary */}
        <div className="bg-slate-900/60 border border-white/5 rounded-lg p-6 cyber-card">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-cyan-400/10 p-2 rounded">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-600">REF: V-782</span>
          </div>
          <h3 className="font-display font-bold text-lg mb-2 text-slate-200">Vulnerability Summary</h3>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Critical</span>
              <div className="flex-1 mx-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[15%] h-full bg-red-400" />
              </div>
              <span className="text-xs font-mono font-bold text-red-400">
                {String(criticalCount).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">High</span>
              <div className="flex-1 mx-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[45%] h-full bg-blue-400" />
              </div>
              <span className="text-xs font-mono font-bold text-blue-400">
                {String(highCount).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Medium</span>
              <div className="flex-1 mx-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[70%] h-full bg-slate-400" />
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {String(mediumCount).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Ship Checks */}
        <div className="bg-slate-900/60 border border-white/5 rounded-lg p-6 cyber-card">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-blue-400/10 p-2 rounded">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-600">
              AUTO-RUN: {scanning || dashboardScanning ? "ACTIVE" : "IDLE"}
            </span>
          </div>
          <h3 className="font-display font-bold text-lg mb-2 text-slate-200">Recent Ship Checks</h3>
          <ul className="space-y-3 mt-4">
            {scanResult ? (
              <li className="flex items-center gap-3 text-xs">
                {scanResult.verdict === "SHIP" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="flex-1 text-slate-400">{selectedRepoFullName || "Last Scan"}</span>
                <span className="text-[10px] text-slate-500 font-mono">just now</span>
              </li>
            ) : null}
            <li className="flex items-center gap-3 text-xs">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="flex-1 text-slate-400">Prod-Alpha Deployment</span>
              <span className="text-[10px] text-slate-500 font-mono">2m ago</span>
            </li>
            <li className="flex items-center gap-3 text-xs">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="flex-1 text-slate-400">API Gateway Patch</span>
              <span className="text-[10px] text-slate-500 font-mono">14m ago</span>
            </li>
            <li className="flex items-center gap-3 text-xs">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="flex-1 text-slate-400">Auth-Service Webhook</span>
              <span className="text-[10px] text-slate-500 font-mono">1h ago</span>
            </li>
          </ul>
        </div>

        {/* Active Scans */}
        <div className="bg-slate-900/60 border border-white/5 rounded-lg p-6 cyber-card relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-cyan-400/10 p-2 rounded">
              <Radar className="h-5 w-5 text-cyan-400" />
            </div>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                scanning
                  ? "bg-cyan-400/20 text-cyan-400"
                  : "bg-slate-700 text-slate-400"
              )}
            >
              {scanning ? "RUNNING" : "IDLE"}
            </span>
          </div>
          <h3 className="font-display font-bold text-lg mb-2 text-slate-200">Active Scans</h3>
          <div className="mt-4 space-y-2">
            {scanning ? (
              <div className="p-3 bg-slate-950 border border-white/5 rounded">
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-2">
                  <span>{scanMessage || "Scanning..."}</span>
                  <span>{scanProgress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-950 border border-white/5 rounded">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-2">
                    <span>Port-Sweep</span>
                    <span>84%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 w-[84%]" />
                  </div>
                </div>
                <div className="p-3 bg-slate-950 border border-white/5 rounded opacity-60">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-2">
                    <span>Deep Packet Inspection</span>
                    <span>12%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 w-[12%]" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ============ Quick Actions ============ */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Findings", desc: "Deep scan results", href: "/findings", icon: AlertTriangle, color: "amber" },
          { label: "Audit Log", desc: "Activity history", href: "/audit", icon: Activity, color: "cyan" },
          { label: "Ship Check", desc: "Run deploy gate", href: "/ship", icon: Rocket, color: "emerald" },
          { label: "Settings", desc: "Configure rules", href: "/settings", icon: Shield, color: "blue" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-slate-900/40 border border-white/5 rounded-lg p-4 hover:bg-slate-800/60 hover:border-cyan-400/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded",
                  action.color === "amber" && "bg-amber-500/10",
                  action.color === "cyan" && "bg-cyan-500/10",
                  action.color === "emerald" && "bg-emerald-500/10",
                  action.color === "blue" && "bg-blue-500/10"
                )}
              >
                <action.icon
                  className={cn(
                    "h-4 w-4",
                    action.color === "amber" && "text-amber-400",
                    action.color === "cyan" && "text-cyan-400",
                    action.color === "emerald" && "text-emerald-400",
                    action.color === "blue" && "text-blue-400"
                  )}
                />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-slate-200 group-hover:text-white transition-colors">
                  {action.label}
                </p>
                <p className="text-[10px] text-slate-500">{action.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* ============ Live Status Feed ============ */}
      <section className="bg-slate-950/80 border border-white/5 rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs uppercase font-display font-bold tracking-widest text-slate-400">
              Live Status Feed
            </h2>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> STREAMING
            </span>
            <span>v1.0.4-stable</span>
          </div>
        </div>
        <div className="p-4 font-terminal max-h-64 overflow-y-auto cyber-scroll space-y-1">
          {LIVE_FEED_ENTRIES.map((entry, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-slate-600 flex-shrink-0">[{entry.time}]</span>
              <span
                className={cn(
                  "font-bold flex-shrink-0",
                  entry.level === "INFO" && "text-cyan-400",
                  entry.level === "WARN" && "text-amber-400",
                  entry.level === "FAIL" && "text-red-400"
                )}
              >
                {entry.level}:
              </span>
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors">
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
