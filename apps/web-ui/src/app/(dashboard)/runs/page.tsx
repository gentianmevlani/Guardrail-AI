"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyableText } from "@/components/ui/copy-button";
import { DetailsDrawer } from "@/components/ui/details-drawer";
import { Column, ProTable, SavedFilter } from "@/components/ui/pro-table";
import { RefreshIndicator } from "@/components/ui/refresh-indicator";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  History,
  Play,
  RefreshCw,
  Rocket,
  Share2,
  Terminal,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchRuns, Run, RunsData } from "@/lib/runs-reader";

// Saved filters for quick access

// Force dynamic rendering
export const dynamic = "force-dynamic";

const savedFilters: SavedFilter[] = [
  { id: "my-runs", name: "My Runs", filters: { author: "current-user" } },
  { id: "blocked-7d", name: "Blocked (7d)", filters: { verdict: "NO_SHIP" } },
  {
    id: "reality-failures",
    name: "Reality Failures",
    filters: { tools: "reality" },
  },
  { id: "main-branch", name: "Main Branch", filters: { branch: "main" } },
];

export default function RunsPage() {
  const router = useRouter();
  const [runsData, setRunsData] = useState<RunsData>({
    runs: [],
    loading: true,
    error: null,
    source: "none",
  });
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load runs on mount
  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    const data = await fetchRuns();
    setRunsData(data);
    setLastUpdated(new Date());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRuns();
    setIsRefreshing(false);
  };

  const { runs, loading, error, source } = runsData;

  // Show data source indicator
  const getSourceBadge = () => {
    if (source === "api")
      return (
        <Badge
          variant="outline"
          className="border-green-600 text-green-400 text-xs"
        >
          Live
        </Badge>
      );
    if (source === "local")
      return (
        <Badge
          variant="outline"
          className="border-blue-600 text-blue-400 text-xs"
        >
          Local
        </Badge>
      );
    return null;
  };

  const handleRowClick = (run: Run) => {
    setSelectedRun(run);
    setDrawerOpen(true);
  };

  const getVerdictBadge = (verdict: Run["verdict"]) => {
    switch (verdict) {
      case "SHIP":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            SHIP
          </Badge>
        );
      case "NO_SHIP":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            NO_SHIP
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            PENDING
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            ERROR
          </Badge>
        );
    }
  };

  // Table columns configuration
  const columns: Column<Run>[] = [
    {
      key: "timestamp",
      header: "Time",
      sortable: true,
      width: "120px",
      render: (val) => (
        <span className="text-muted-foreground text-xs">
          {new Date(val).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "repo",
      header: "Repository",
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span className="text-foreground/90 font-medium">{val}</span>
          {row.pr && (
            <Badge
              variant="outline"
              className="border text-muted-foreground text-xs"
            >
              PR #{row.pr}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <GitBranch className="w-3 h-3 text-muted-foreground" />
          <span className="text-foreground/80 text-sm">{val}</span>
        </div>
      ),
    },
    {
      key: "commit",
      header: "Commit",
      monospace: true,
      copyable: true,
      width: "100px",
      render: (val) => (
        <span className="text-muted-foreground">{val.slice(0, 7)}</span>
      ),
    },
    {
      key: "trigger",
      header: "Trigger",
      width: "80px",
      render: (val) => {
        const icons = { local: Terminal, ci: Play, mcp: Rocket };
        const colors = {
          local: "text-muted-foreground",
          ci: "text-blue-400",
          mcp: "text-purple-400",
        };
        const Icon = icons[val as keyof typeof icons];
        return (
          <Badge
            variant="outline"
            className={`border ${colors[val as keyof typeof colors]}`}
          >
            <Icon className="w-3 h-3 mr-1" />
            {val.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: "verdict",
      header: "Verdict",
      sortable: true,
      width: "100px",
      render: (val) => getVerdictBadge(val),
    },
    {
      key: "duration",
      header: "Duration",
      sortable: true,
      width: "80px",
      render: (val) => (
        <span className="text-muted-foreground font-mono text-xs">
          {val < 60 ? `${val}s` : `${Math.floor(val / 60)}m ${val % 60}s`}
        </span>
      ),
    },
    {
      key: "id",
      header: "",
      width: "40px",
      render: (val, row) => (
        <Link href={`/runs/${row.id}`} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-blue-500"
            aria-label={`View details for run ${row.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="h-6 w-6 text-blue-400" />
            Runs
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground text-sm">
              System of record for all guardrail runs
            </p>
            <RefreshIndicator
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Play className="w-4 h-4 mr-2" />
          New Run
        </Button>
      </div>

      {/* Pro Table with all features */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardContent className="pt-6">
          <ProTable
            data={runs}
            columns={columns}
            keyField="id"
            onRowClick={handleRowClick}
            savedFilters={savedFilters}
            loading={loading}
            pageSize={10}
            emptyState={{
              title: "No runs yet",
              description:
                "Run `guardrail ship` locally or connect GitHub to get started.",
              action: (
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Play className="w-4 h-4 mr-2" />
                  Run Ship Check
                </Button>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Run Details Drawer */}
      <DetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedRun ? `Run ${selectedRun.id}` : ""}
        subtitle={selectedRun?.repo}
        width="lg"
      >
        {selectedRun && (
          <div className="space-y-6">
            {/* Verdict Banner */}
            <div
              className={`p-4 rounded-lg border ${
                selectedRun.verdict === "SHIP"
                  ? "bg-emerald-950/30 border-emerald-800/50"
                  : selectedRun.verdict === "NO_SHIP"
                    ? "bg-red-950/30 border-red-800/50"
                    : "bg-card/50 border"
              }`}
            >
              <div className="flex items-center justify-between">
                {getVerdictBadge(selectedRun.verdict)}
                <span className="text-xs text-muted-foreground">
                  {selectedRun.duration}s • {selectedRun.profile} profile
                </span>
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Branch</span>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm text-foreground/90">
                    {selectedRun.branch}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Commit</span>
                <CopyableText value={selectedRun.commit} className="text-sm" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Run ID</span>
                <CopyableText value={selectedRun.id} className="text-sm" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Policy Hash
                </span>
                <CopyableText
                  value={selectedRun.policyHash || "—"}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Artifacts */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Artifacts
              </span>
              <div className="flex flex-wrap gap-2">
                {["Report", "Replay", "Trace", "SARIF"].map((artifact) => (
                  <Button
                    key={artifact}
                    variant="outline"
                    size="sm"
                    className="border text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    {artifact}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => router.push(`/runs/${selectedRun.id}`)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Full Details
              </Button>
              <Button variant="outline" className="border">
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-run
              </Button>
              <Button variant="outline" className="border">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DetailsDrawer>
    </div>
  );
}
