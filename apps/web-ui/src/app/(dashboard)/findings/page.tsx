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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGitHub } from "@/context/github-context";
import {
  fetchFindings,
  triggerDeepScan,
  updateFindingStatus,
  type Finding,
  type FindingsResponse,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileCode,
  Filter,
  FolderOpen,
  Github,
  GitPullRequest,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Shield,
  Wrench,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { EnhancedEmptyState } from "@/components/findings/enhanced-empty-state";
import { FindingTriageWorkflow } from "@/components/findings/finding-triage-workflow";
import { FreeTierIssueDetailsLock } from "@/components/entitlements/FreeTierIssueDetailsLock";
import { useAuth } from "@/context/auth-context";
import { hideIssueDetailsForTier } from "@/lib/tier-gates";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function FindingsPage() {
  // Use centralized GitHub context
  const {
    connected: githubConnected,
    loading: githubLoading,
    repositories: githubRepos,
  } = useGitHub();
  const { tier } = useAuth();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<FindingsResponse["summary"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [showGitHubScanner, setShowGitHubScanner] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const loadFindings = async () => {
    setLoading(true);
    try {
      const data = await fetchFindings();
      if (data) {
        setFindings(data.findings);
        setSummary(data.summary);
      }
    } catch (error) {
      logger.error("Failed to load findings:", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFindings();
  }, []);

  const handleDeepScan = async () => {
    setScanning(true);
    toast.info("Starting local deep scan...", { duration: 3000 });
    try {
      await triggerDeepScan();
      await loadFindings();
      toast.success("Deep scan complete! Findings have been updated.", {
        duration: 5000,
      });
    } catch (error) {
      logger.error("Failed to trigger scan:", { error: error instanceof Error ? error.message : String(error) });
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to run deep scan. Please try again.",
        { duration: 5000 },
      );
    } finally {
      setScanning(false);
    }
  };

  const openGitHubScanner = () => {
    // GitHub status comes from context, just open the dialog
    setShowGitHubScanner(true);
  };

  const handleGitHubScan = async () => {
    if (!selectedRepo) return;

    const [owner, repo] = selectedRepo.split("/");
    if (!owner || !repo) return;

    setScanning(true);
    setShowGitHubScanner(false);
    toast.info(`Scanning ${selectedRepo}...`, { duration: 3000 });

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/github/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          owner,
          repo,
          scanType: "security",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Scan failed");
      }

      const result = await response.json();
      await loadFindings();

      toast.success(
        `Scan complete! Found ${result.security?.summary?.total || 0} security findings.`,
        {
          duration: 5000,
        },
      );
    } catch (error) {
      logger.error("Failed to trigger GitHub scan:", { error: error instanceof Error ? error.message : String(error) });
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to scan repository. Please try again.",
        { duration: 5000 },
      );
    } finally {
      setScanning(false);
      setSelectedRepo("");
    }
  };

  const handleStatusUpdate = async (
    id: string,
    status: "open" | "fixed" | "suppressed" | "accepted_risk",
  ) => {
    const success = await updateFindingStatus(id, status);
    if (success) {
      setFindings((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status } : f)),
      );
    }
  };

  const filteredFindings = findings.filter((finding) => {
    const matchesSearch =
      finding.rule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.file.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === "all" || finding.severity === severityFilter;

    const matchesStatus =
      statusFilter === "all" || finding.status === statusFilter;

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "open" && finding.status === "open") ||
      (activeTab === "fixed" && finding.status === "fixed") ||
      (activeTab === "suppressed" &&
        (finding.status === "suppressed" ||
          finding.status === "accepted_risk"));

    return matchesSearch && matchesSeverity && matchesStatus && matchesTab;
  });

  const getSeverityBadge = (severity: Finding["severity"]) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return <Badge className={colors[severity]}>{severity}</Badge>;
  };

  const getStatusBadge = (status: Finding["status"]) => {
    switch (status) {
      case "open":
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground border-border"
          >
            <Clock className="w-3 h-3 mr-1" />
            Open
          </Badge>
        );
      case "fixed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Fixed
          </Badge>
        );
      case "suppressed":
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            <XCircle className="w-3 h-3 mr-1" />
            Suppressed
          </Badge>
        );
      case "accepted_risk":
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Ban className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
    }
  };

  const openCount =
    summary?.open ?? findings.filter((f) => f.status === "open").length;
  const criticalCount =
    summary?.bySeverity?.critical ??
    findings.filter((f) => f.severity === "critical" && f.status === "open")
      .length;
  const highCount =
    summary?.bySeverity?.high ??
    findings.filter((f) => f.severity === "high" && f.status === "open").length;
  const mediumCount =
    summary?.bySeverity?.medium ??
    findings.filter((f) => f.severity === "medium" && f.status === "open").length;
  const lowCount =
    summary?.bySeverity?.low ??
    findings.filter((f) => f.severity === "low" && f.status === "open").length;
  const fixedCount =
    summary?.fixed ?? findings.filter((f) => f.status === "fixed").length;

  const findingsDetailLocked = hideIssueDetailsForTier(tier) && findings.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-teal-400 animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading findings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" theme="dark" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            Findings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deep scan results and ongoing hygiene — not the deploy gate
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Scan
                  <ChevronDown className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem onClick={handleDeepScan} disabled={scanning}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Scan Local Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openGitHubScanner} disabled={scanning}>
              <Github className="w-4 h-4 mr-2" />
              Scan GitHub Repository
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showGitHubScanner} onOpenChange={setShowGitHubScanner}>
        <DialogContent className="bg-background border">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Github className="w-5 h-5" />
              Scan GitHub Repository
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select a repository to scan for security issues
            </DialogDescription>
          </DialogHeader>

          {githubLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !githubConnected ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="p-4 rounded-full bg-muted border">
                <Github className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">GitHub Not Connected</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Connect your GitHub account to scan repositories
                </p>
              </div>
              <Button
                variant="outline"
                className="border"
                onClick={() =>
                  window.open(
                    "https://github.com/settings/tokens/new?scopes=repo&description=guardrail",
                    "_blank",
                  )
                }
              >
                <Github className="w-4 h-4 mr-2" />
                Create GitHub Token
              </Button>
            </div>
          ) : githubRepos.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <p className="text-muted-foreground">No repositories found</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger className="border bg-card text-foreground">
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {githubRepos.map((repo) => (
                    <SelectItem
                      key={repo.id}
                      value={repo.fullName}
                      className="text-foreground focus:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Github className="w-4 h-4 text-muted-foreground" />
                        {repo.fullName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGitHubScanner(false)}
                  className="border-border text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGitHubScan}
                  disabled={!selectedRepo}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Start Security Scan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Findings</p>
                <p className="text-2xl font-bold text-foreground">
                  {openCount}
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border glass-card hover-lift border-l-2 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-400">
                  {criticalCount}
                </p>
              </div>
              <div className="p-2 rounded-full bg-red-500/20">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-orange-400">
                  {highCount}
                </p>
              </div>
              <div className="p-2 rounded-full bg-orange-500/20">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Medium</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {mediumCount}
                </p>
              </div>
              <div className="p-2 rounded-full bg-yellow-500/20">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low</p>
                <p className="text-2xl font-bold text-blue-400">
                  {lowCount}
                </p>
              </div>
              <div className="p-2 rounded-full bg-blue-500/20">
                <AlertTriangle className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fixed (7d)</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {fixedCount}
                </p>
              </div>
              <div className="p-2 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FreeTierIssueDetailsLock
        active={findingsDetailLocked}
        bannerMessage="Free plan shows severity counts only. Upgrade to see rules, file paths, and triage actions."
        overlayTitle="Finding details are hidden on the Free plan"
        overlayDescription="Upgrade to unlock the full table, search, filters, and triage workflows."
      >
        <div className="flex flex-col gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border">
            <TabsTrigger value="all" className="data-[state=active]:bg-muted">
              All ({findings.length})
            </TabsTrigger>
            <TabsTrigger value="open" className="data-[state=active]:bg-muted">
              Open ({findings.filter((f) => f.status === "open").length})
            </TabsTrigger>
            <TabsTrigger value="fixed" className="data-[state=active]:bg-muted">
              Fixed ({findings.filter((f) => f.status === "fixed").length})
            </TabsTrigger>
            <TabsTrigger
              value="suppressed"
              className="data-[state=active]:bg-muted"
            >
              Suppressed (
              {
                findings.filter(
                  (f) =>
                    f.status === "suppressed" || f.status === "accepted_risk",
                ).length
              }
              )
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="bg-card border-border glass-card hover-lift">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search rules, messages, files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-card border text-foreground"
                  />
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Severity:{" "}
                    {severityFilter === "all" ? "All" : severityFilter}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border">
                  <DropdownMenuItem onClick={() => setSeverityFilter("all")}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSeverityFilter("critical")}
                  >
                    Critical
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("high")}>
                    High
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("medium")}>
                    Medium
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("low")}>
                    Low
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

      <Card className="bg-card border-border glass-card hover-lift">
        <CardHeader>
          <CardTitle className="text-foreground">Findings</CardTitle>
          <CardDescription className="text-muted-foreground">
            {filteredFindings.length} findings matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFindings.length === 0 ? (
            findings.length === 0 ? (
              <EnhancedEmptyState
                type="findings"
                onAction={handleDeepScan}
                actionLabel={scanning ? "Scanning..." : "Run Deep Scan"}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No matching findings"
                description="No findings match your current filters. Try adjusting your search or filter criteria."
                secondaryAction={{
                  label: "Clear Filters",
                  onClick: () => {
                    setSearchQuery("");
                    setSeverityFilter("all");
                    setStatusFilter("all");
                    setActiveTab("all");
                  },
                }}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">
                    Severity
                  </TableHead>
                  <TableHead className="text-muted-foreground">Rule</TableHead>
                  <TableHead className="text-muted-foreground">
                    Location
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Repository
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    First Seen
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFindings.map((finding) => (
                  <TableRow
                    key={finding.id}
                    className="border hover:bg-muted/50"
                  >
                    <TableCell>{getSeverityBadge(finding.severity)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm text-foreground/90">
                          {finding.rule}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[250px] truncate">
                          {finding.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground">
                          {finding.file}:{finding.line}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground/80 text-sm">
                          {finding.repo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {finding.branch}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(finding.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(finding.firstSeen).toLocaleDateString()}
                      {finding.occurrences > 1 && (
                        <span className="text-muted-foreground/70 ml-1">
                          ({finding.occurrences}x)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <FindingTriageWorkflow
                        finding={finding}
                        onStatusUpdate={handleStatusUpdate}
                        onViewCode={() => {
                          // TODO(#22): Implement view in code
                          toast.info("View in code feature coming soon");
                        }}
                        onCreateIssue={() => {
                          // TODO(#22): Implement create issue
                          toast.info("Create issue feature coming soon");
                        }}
                        onOpenPR={() => {
                          // TODO(#22): Implement open PR
                          toast.info("Open PR feature coming soon");
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </div>
      </FreeTierIssueDetailsLock>

      <Card className="bg-teal-950/20 border-teal-800/50 glass-card">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-teal-500/20">
              <AlertTriangle className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-teal-300 font-medium">
                This is not the deploy gate
              </p>
              <p className="text-xs text-teal-400/70 mt-1">
                Findings show deep scan results and ongoing code hygiene. For
                deploy readiness, use{" "}
                <a href="/ship-check" className="underline hover:text-teal-300">
                  Ship Check
                </a>{" "}
                — the actual gate that determines if your code can ship.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
