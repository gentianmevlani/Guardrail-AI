"use client";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchRunDetail,
  type RunDetailGate as Gate,
  type RunDetail,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  mapFilesWithStats,
  mapFindingsWithConfidence,
  mapFindingsToFixPacks,
  validateRunDetailSchema,
} from "@/lib/mappers/run-detail-mapper";
import { RealityMap } from "@/components/runs/RealityMap";
import { FixPacks } from "@/components/runs/FixPacks";
import { LiveScanConsole } from "@/components/runs/LiveScanConsole";
import { useRealtimeScan } from "@/hooks/useRealtimeScan";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  GitCommit,
  Lock,
  Play,
  RefreshCw,
  Shield,
  XCircle,
  Loader2,
  Terminal,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<any>(null);

  const runId = params?.id as string;

  // Real-time scan progress hook
  const {
    status: realtimeStatus,
    progress: realtimeProgress,
    logs: realtimeLogs,
    findingsCount: realtimeFindingsCount,
    isConnected,
    error: realtimeError,
  } = useRealtimeScan({
    runId: runId || "",
    enabled: !!runId && (run?.verdict === "PENDING" || !run),
    onStatusChange: (newStatus, error) => {
      logger.info("Scan status changed:", { newStatus, error });
      if (newStatus === "complete" || newStatus === "error") {
        // Refresh run data when scan completes
        loadRunDetail();
      }
    },
    onFinding: (finding, count) => {
      logger.debug("New finding discovered:", { finding, count });
    },
  });

  const loadRunDetail = useCallback(async () => {
    if (!runId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchRunDetail(runId);
      if (data) {
        // Validate schema to catch drift
        const validation = validateRunDetailSchema(data);
        if (!validation.valid) {
          logger.warn("Run detail schema validation failed:", validation.errors);
        }
        setRun(data);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      logger.error("Failed to fetch run detail:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRunDetail();
  }, [loadRunDetail]);

  // Fix application handlers
  const handleApplyFix = useCallback(async (packId: string) => {
    if (!run) return;

    setApplyingFix(packId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      // First do a dry run to preview changes
      const response = await fetch(`${apiUrl}/api/v1/fixes/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          runId: run.id,
          packId,
          dryRun: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to apply fix");
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Fix Applied Successfully",
          description: `Modified ${result.filesModified?.length || 0} file(s). ${
            result.rollbackAvailable ? "Rollback available." : ""
          }`,
        });

        // Refresh run data to show updated state
        await loadRunDetail();
      } else {
        throw new Error(result.error || "Fix application failed verification");
      }
    } catch (error: any) {
      logger.error("Fix application failed:", error);
      toast({
        title: "Fix Application Failed",
        description: error.message || "An error occurred while applying the fix",
        variant: "destructive",
      });
    } finally {
      setApplyingFix(null);
    }
  }, [run, loadRunDetail]);

  const handleViewDiff = useCallback(async (packId: string) => {
    if (!run) return;

    setViewingDiff(packId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const response = await fetch(`${apiUrl}/api/v1/fixes/diff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          runId: run.id,
          packId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate diff");
      }

      const result = await response.json();
      setDiffContent(result);
      setActiveTab("diff-preview");
    } catch (error: any) {
      logger.error("Diff generation failed:", error);
      toast({
        title: "Diff Generation Failed",
        description: error.message || "An error occurred while generating the diff",
        variant: "destructive",
      });
    } finally {
      setViewingDiff(null);
    }
  }, [run]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <h2 className="text-xl font-semibold text-white">Run not found</h2>
        <p className="text-zinc-400">
          The requested run could not be found or you don't have access to it.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/runs")}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Runs
        </Button>
      </div>
    );
  }

  const getVerdictBadge = (verdict: RunDetail["verdict"]) => {
    switch (verdict) {
      case "SHIP":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-lg px-4 py-1">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            SHIP ✓
          </Badge>
        );
      case "NO_SHIP":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-1">
            <XCircle className="w-4 h-4 mr-2" />
            NO_SHIP
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-1">
            <Clock className="w-4 h-4 mr-2" />
            PENDING
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-lg px-4 py-1">
            <XCircle className="w-4 h-4 mr-2" />
            ERROR
          </Badge>
        );
    }
  };

  const getGateStatusIcon = (status: Gate["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "skip":
        return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      case "high":
        return "text-orange-400 bg-orange-500/20 border-orange-500/30";
      case "medium":
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
      case "low":
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default:
        return "text-zinc-400 bg-zinc-500/20 border-zinc-500/30";
    }
  };

  // Map run data for Reality Map and Fix Packs
  const filesWithStats = run ? mapFilesWithStats(run.findings || []) : [];
  const findingsWithConfidence = run ? mapFindingsWithConfidence(run.findings || []) : [];
  const fixPacks = run ? mapFindingsToFixPacks(findingsWithConfidence) : [];

  // Determine if scan is in progress (for live console display)
  const isScanInProgress = 
    realtimeStatus === "queued" || 
    realtimeStatus === "running" || 
    run?.verdict === "PENDING";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/runs")}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Runs
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-zinc-700 text-zinc-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-run
          </Button>
          <Button variant="outline" className="border-zinc-700 text-zinc-300">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Run Summary Card */}
      <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{run.repo}</h1>
                {getVerdictBadge(run.verdict)}
              </div>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <div className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {run.branch}
                </div>
                <div className="flex items-center gap-1">
                  <GitCommit className="w-4 h-4" />
                  <code className="font-mono">{run.commit.slice(0, 7)}</code>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {run.duration}s
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-4 h-4" />
                  Policy:{" "}
                  <code className="font-mono text-xs">
                    {run.policyHash.slice(0, 12)}
                  </code>
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-zinc-500">
              <div>{new Date(run.timestamp).toLocaleString()}</div>
              <div className="mt-1">by {run.author}</div>
            </div>
          </div>

          {/* Gates Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {run.gates.map((gate) => (
              <div
                key={gate.name}
                className={`p-4 rounded-lg border ${
                  gate.status === "pass"
                    ? "bg-emerald-950/20 border-emerald-800/50"
                    : gate.status === "fail"
                      ? "bg-red-950/20 border-red-800/50"
                      : "bg-zinc-900/50 border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getGateStatusIcon(gate.status)}
                    <span className="font-medium text-white">{gate.name}</span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {gate.duration}s
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-2">{gate.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Console Banner when scan is in progress */}
      {isScanInProgress && (
        <Card className="bg-blue-950/30 border-blue-800/50 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-blue-400 font-medium">Scan in Progress</span>
                <span className="text-zinc-400 text-sm">
                  {realtimeProgress}% complete • {realtimeFindingsCount} finding{realtimeFindingsCount !== 1 ? "s" : ""} found
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-700 text-blue-400 hover:bg-blue-950"
                onClick={() => setActiveTab("live-console")}
              >
                <Terminal className="w-4 h-4 mr-2" />
                View Live Console
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap">
          {isScanInProgress && (
            <TabsTrigger
              value="live-console"
              className="data-[state=active]:bg-blue-900/50"
            >
              <Terminal className="w-4 h-4 mr-1" />
              Live Console
            </TabsTrigger>
          )}
          <TabsTrigger
            value="summary"
            className="data-[state=active]:bg-zinc-800"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="findings"
            className="data-[state=active]:bg-zinc-800"
          >
            Findings ({run.findings.length})
          </TabsTrigger>
          <TabsTrigger
            value="replay"
            className="data-[state=active]:bg-zinc-800"
          >
            Replay
          </TabsTrigger>
          <TabsTrigger
            value="mockproof"
            className="data-[state=active]:bg-zinc-800"
          >
            MockProof
          </TabsTrigger>
          <TabsTrigger
            value="airlock"
            className="data-[state=active]:bg-zinc-800"
          >
            Airlock
          </TabsTrigger>
          <TabsTrigger
            value="artifacts"
            className="data-[state=active]:bg-zinc-800"
          >
            Artifacts
          </TabsTrigger>
          <TabsTrigger
            value="policy"
            className="data-[state=active]:bg-zinc-800"
          >
            Policy
          </TabsTrigger>
          <TabsTrigger
            value="reality-map"
            className="data-[state=active]:bg-zinc-800"
          >
            Reality Map ({filesWithStats.length})
          </TabsTrigger>
          <TabsTrigger
            value="fix-packs"
            className="data-[state=active]:bg-zinc-800"
          >
            Fix Packs ({fixPacks.length})
          </TabsTrigger>
          {diffContent && (
            <TabsTrigger
              value="diff-preview"
              className="data-[state=active]:bg-zinc-800"
            >
              Diff Preview
            </TabsTrigger>
          )}
        </TabsList>

        {/* Live Console Tab */}
        <TabsContent value="live-console">
          <LiveScanConsole
            runId={runId}
            status={realtimeStatus}
            progress={realtimeProgress}
            logs={realtimeLogs}
            findingsCount={realtimeFindingsCount}
            isConnected={isConnected}
            error={realtimeError}
          />
        </TabsContent>

        {/* Diff Preview Tab */}
        {diffContent && (
          <TabsContent value="diff-preview">
            <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Diff Preview</CardTitle>
                <CardDescription className="text-zinc-400">
                  Changes that will be applied to {diffContent.filesModified?.length || 0} file(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {diffContent.diffs?.map((diff: any, idx: number) => (
                    <div key={idx} className="bg-zinc-900/50 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
                        <code className="text-sm text-zinc-300">{diff.file}</code>
                        <Badge variant="outline" className="text-xs">
                          {diff.hunks?.length || 0} change{(diff.hunks?.length || 0) !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="p-4 font-mono text-xs overflow-x-auto">
                        {diff.hunks?.map((hunk: any, hunkIdx: number) => (
                          <div key={hunkIdx} className="mb-4 last:mb-0">
                            <div className="text-zinc-500 mb-1">
                              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                            </div>
                            <pre className="whitespace-pre-wrap">
                              {hunk.content.split("\n").map((line: string, lineIdx: number) => (
                                <div
                                  key={lineIdx}
                                  className={
                                    line.startsWith("+")
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : line.startsWith("-")
                                        ? "bg-red-500/20 text-red-400"
                                        : "text-zinc-400"
                                  }
                                >
                                  {line}
                                </div>
                              ))}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDiffContent(null);
                      setActiveTab("fix-packs");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (diffContent.packId) {
                        handleApplyFix(diffContent.packId);
                      }
                    }}
                    disabled={!!applyingFix}
                  >
                    {applyingFix ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Apply Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Summary Tab */}
        <TabsContent value="summary">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Run Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Run ID</span>
                  <code className="text-zinc-200 font-mono text-sm">
                    {run.id}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Trigger</span>
                  <span className="text-zinc-200 capitalize">
                    {run.trigger}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Profile</span>
                  <span className="text-zinc-200 capitalize">
                    {run.profile}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tools Used</span>
                  <span className="text-zinc-200">{run.tools.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Findings</span>
                  <span className="text-zinc-200">{run.findings.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Report
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  Open Replay Viewer
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download SARIF
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Badge URL
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Findings</CardTitle>
              <CardDescription className="text-zinc-400">
                Issues detected during this run
              </CardDescription>
            </CardHeader>
            <CardContent>
              {run.findings.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
                  <p className="text-lg font-medium text-zinc-300">
                    No findings
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    This run passed all checks
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-zinc-400">Severity</TableHead>
                      <TableHead className="text-zinc-400">Rule</TableHead>
                      <TableHead className="text-zinc-400">Message</TableHead>
                      <TableHead className="text-zinc-400">Location</TableHead>
                      <TableHead className="text-zinc-400">Confidence</TableHead>
                      <TableHead className="text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findingsWithConfidence.map((finding) => (
                      <TableRow key={finding.id} className="border-zinc-800">
                        <TableCell>
                          <Badge className={getSeverityColor(finding.severity)}>
                            {finding.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-300">
                          {finding.rule}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {finding.message}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {finding.file}:{finding.line}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            title={
                              finding.confidenceSource === "derived"
                                ? "Confidence derived from severity and rule type"
                                : "Confidence from API"
                            }
                          >
                            {(finding.confidence * 100).toFixed(0)}%
                            {finding.confidenceSource === "derived" && (
                              <span className="ml-1 text-zinc-500">(derived)</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {finding.fixable && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                              >
                                Auto-fix
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                            >
                              Suppress
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replay Tab */}
        <TabsContent value="replay">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Reality Mode Replay</CardTitle>
              <CardDescription className="text-zinc-400">
                Visual replay of the verification flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!run.replayData ? (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 mx-auto mb-3 text-zinc-500/50" />
                  <p className="text-lg font-medium text-zinc-300">
                    No replay data available
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Run Reality Mode to generate replay data
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-4 min-h-[500px]">
                  {/* Timeline */}
                  <div className="col-span-3 border-r border-zinc-800 pr-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-4">
                      Timeline
                    </h3>
                    <div className="space-y-2">
                      {(run.replayData?.timeline || []).map(
                        (step: { action: string }, i: number) => (
                          <div
                            key={i}
                            className={`p-2 rounded text-sm cursor-pointer ${
                              i === 0
                                ? "bg-blue-500/20 text-blue-400"
                                : "text-zinc-400 hover:bg-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">
                                {i + 1}
                              </span>
                              {step.action}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Network Panel */}
                  <div className="col-span-5 border-r border-zinc-800 pr-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-4">
                      Network
                    </h3>
                    <div className="space-y-1">
                      {(run.replayData?.network || []).map(
                        (
                          req: { method: string; url: string; status: number },
                          i: number,
                        ) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs font-mono p-2 hover:bg-zinc-800 rounded"
                          >
                            <Badge variant="outline" className="text-xs">
                              {req.method}
                            </Badge>
                            <span className="text-zinc-400 flex-1 truncate">
                              {req.url}
                            </span>
                            <span
                              className={
                                req.status >= 200 && req.status < 300
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }
                            >
                              {req.status}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Evidence Panel */}
                  <div className="col-span-4">
                    <h3 className="text-sm font-medium text-zinc-300 mb-4">
                      Evidence
                    </h3>
                    <div className="bg-zinc-900 rounded-lg p-4 text-sm text-zinc-400">
                      <p>
                        {run.replayData?.evidence ||
                          "All network requests verified against production endpoints."}
                      </p>
                      <p className="mt-2">
                        No mock data detected in responses.
                      </p>
                    </div>
                    <Button className="w-full mt-4" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Playwright Trace
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MockProof Tab */}
        <TabsContent value="mockproof">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">MockProof Traces</CardTitle>
              <CardDescription className="text-zinc-400">
                Detection of mock data, test fixtures, and placeholder values
              </CardDescription>
            </CardHeader>
            <CardContent>
              {run.mockproofTraces.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
                  <p className="text-lg font-medium text-zinc-300">
                    No mock data detected
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Your code is production-ready
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-zinc-400">Pattern</TableHead>
                      <TableHead className="text-zinc-400">Location</TableHead>
                      <TableHead className="text-zinc-400">Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.mockproofTraces.map((trace) => (
                      <TableRow key={trace.id} className="border-zinc-800">
                        <TableCell className="font-mono text-sm text-yellow-400">
                          {trace.pattern}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {trace.file}:{trace.line}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {trace.evidence}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Airlock Tab */}
        <TabsContent value="airlock">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">
                Airlock - Supply Chain
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Dependency analysis and vulnerability scanning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Package</TableHead>
                    <TableHead className="text-zinc-400">Version</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">
                      Vulnerability
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.airlockResults.map((dep, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      <TableCell className="font-mono text-sm text-zinc-200">
                        {dep.package}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500">
                        {dep.version}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            dep.status === "safe"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : dep.status === "vulnerable"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                          }
                        >
                          {dep.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">
                        {dep.vulnerability || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Artifacts</CardTitle>
              <CardDescription className="text-zinc-400">
                Downloadable outputs from this run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {run.artifacts.map((artifact, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-zinc-500" />
                      <div>
                        <p className="font-medium text-zinc-200">
                          {artifact.name}
                        </p>
                        <p className="text-xs text-zinc-500">{artifact.size}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Tab */}
        <TabsContent value="policy">
          <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Policy Snapshot</CardTitle>
              <CardDescription className="text-zinc-400">
                The policy configuration used for this run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-200">Policy Hash</p>
                    <p className="text-xs text-zinc-500 font-mono">
                      {run.policyHash}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <p className="font-medium text-zinc-200 mb-2">
                    Profile: {run.profile}
                  </p>
                  <pre className="text-xs text-zinc-400 font-mono overflow-auto">
                    {`{
  "profile": "${run.profile}",
  "gates": {
    "mockproof": { "enabled": true, "failOn": "error" },
    "reality": { "enabled": true, "failOn": "error" },
    "airlock": { "enabled": true, "failOn": "error" }
  },
  "allowlist": {
    "domains": ["api.acme.com", "cdn.acme.com"],
    "packages": []
  }
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reality Map Tab */}
        <TabsContent value="reality-map">
          <RealityMap files={filesWithStats} isLoading={loading} />
        </TabsContent>

        {/* Fix Packs Tab */}
        <TabsContent value="fix-packs">
          <FixPacks
            packs={fixPacks}
            isLoading={loading || !!applyingFix || !!viewingDiff}
            onApplyFix={(packId) => {
              if (applyingFix) return;
              handleApplyFix(packId);
            }}
            onViewDiff={(packId) => {
              if (viewingDiff) return;
              handleViewDiff(packId);
            }}
          />
          {(applyingFix || viewingDiff) && (
            <div className="mt-4 p-4 bg-blue-950/30 border border-blue-800/50 rounded-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-blue-300">
                {applyingFix ? "Applying fix pack..." : "Generating diff preview..."}
              </span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
