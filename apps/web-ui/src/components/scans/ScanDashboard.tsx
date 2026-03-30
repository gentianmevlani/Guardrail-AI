"use client";

/**
 * Scan Dashboard Component
 *
 * Displays:
 * - Scan history with status
 * - Issue list with severity
 * - Code snippet preview
 * - One-click "explain this issue"
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Loader2,
  FileCode,
  GitBranch,
  ChevronRight,
  Search,
  Filter,
  Download,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

interface Scan {
  id: string;
  repositoryId?: string;
  projectPath?: string;
  branch: string;
  commitSha?: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  verdict?: "pass" | "fail" | "review";
  score?: number;
  metrics: {
    filesScanned: number;
    linesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    durationMs?: number;
  };
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
}

interface Finding {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  category: string;
  file: string;
  line: number;
  column?: number;
  title: string;
  message: string;
  codeSnippet?: string;
  suggestion?: string;
  confidence: number;
  aiExplanation?: string;
  aiGenerated: boolean;
  status: string;
  ruleId?: string;
}

interface ScanDashboardProps {
  initialScanId?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ScanDashboard({ initialScanId }: ScanDashboardProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [explaining, setExplaining] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch scans
  const fetchScans = useCallback(async () => {
    try {
      const response = await fetch("/api/scans");
      const data = await response.json();
      if (data.success) {
        setScans(data.data.scans);
        if (initialScanId) {
          const scan = data.data.scans.find(
            (s: Scan) => s.id === initialScanId,
          );
          if (scan) setSelectedScan(scan);
        }
      }
    } catch (error) {
      logger.error("Failed to fetch scans", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "ScanDashboard"
      });
    } finally {
      setLoading(false);
    }
  }, [initialScanId]);

  // Fetch findings for selected scan
  const fetchFindings = useCallback(
    async (scanId: string) => {
      try {
        const params = new URLSearchParams();
        if (severityFilter !== "all") params.set("severity", severityFilter);

        const response = await fetch(`/api/scans/${scanId}/findings?${params}`);
        const data = await response.json();
        if (data.success) {
          setFindings(data.data.findings);
        }
      } catch (error) {
        logger.error("Failed to fetch findings", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          component: "ScanDashboard",
          scanId
        });
      }
    },
    [severityFilter],
  );

  // Explain finding with AI
  const explainFinding = async (finding: Finding) => {
    if (finding.aiExplanation) {
      setSelectedFinding(finding);
      return;
    }

    setExplaining(true);
    try {
      const response = await fetch(`/api/scans/${selectedScan?.id}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const data = await response.json();
      if (data.success) {
        const updatedFinding = {
          ...finding,
          aiExplanation: data.data.explanation,
        };
        setFindings((prev) =>
          prev.map((f) => (f.id === finding.id ? updatedFinding : f)),
        );
        setSelectedFinding(updatedFinding);
      }
    } catch (error) {
      logger.error("Failed to explain finding", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "ScanDashboard",
        findingId: finding.id
      });
    } finally {
      setExplaining(false);
    }
  };

  // Export findings to JSON
  const exportFindings = () => {
    const data = JSON.stringify({ scan: selectedScan, findings }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-${selectedScan?.id}-findings.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  useEffect(() => {
    if (selectedScan) {
      fetchFindings(selectedScan.id);
    }
  }, [selectedScan, fetchFindings]);

  // Filter findings by search
  const filteredFindings = findings.filter((f) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      f.title.toLowerCase().includes(query) ||
      f.file.toLowerCase().includes(query) ||
      f.message.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading scans...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Scan List Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scan History
          </h2>
          <button
            onClick={fetchScans}
            className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {scans.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No scans yet. Start a new scan to see results.
            </div>
          ) : (
            scans.map((scan) => (
              <ScanListItem
                key={scan.id}
                scan={scan}
                isSelected={selectedScan?.id === scan.id}
                onClick={() => setSelectedScan(scan)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedScan ? (
          <>
            {/* Scan Header */}
            <ScanHeader scan={selectedScan} onExport={exportFindings} />

            {/* Filters */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search findings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>

            {/* Findings List */}
            <div className="flex-1 overflow-y-auto">
              {filteredFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No issues found!</p>
                  <p className="text-sm">Your code looks good.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredFindings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      isSelected={selectedFinding?.id === finding.id}
                      onSelect={() => setSelectedFinding(finding)}
                      onExplain={() => explainFinding(finding)}
                      explaining={
                        explaining && selectedFinding?.id === finding.id
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">
                Select a scan to view results
              </p>
              <p className="text-sm">
                Or start a new scan from the GitHub integration
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Finding Detail Panel */}
      {selectedFinding && (
        <FindingDetailPanel
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================

function ScanListItem({
  scan,
  isSelected,
  onClick,
}: {
  scan: Scan;
  isSelected: boolean;
  onClick: () => void;
}) {
  const getStatusIcon = () => {
    switch (scan.status) {
      case "queued":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return scan.verdict === "pass" ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : scan.verdict === "fail" ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
        );
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getScoreColor = () => {
    if (!scan.score) return "text-gray-400";
    if (scan.score >= 80) return "text-green-500";
    if (scan.score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
            {scan.projectPath || "Unknown"}
          </span>
        </div>
        {scan.score !== undefined && (
          <span className={`font-bold ${getScoreColor()}`}>{scan.score}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <GitBranch className="w-3 h-3" />
        <span>{scan.branch}</span>
        <span>•</span>
        <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
      </div>

      {scan.status === "running" && (
        <div className="mt-2">
          <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${scan.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{scan.progress}%</span>
        </div>
      )}

      {scan.status === "completed" && scan.metrics && (
        <div className="flex items-center gap-3 mt-2 text-xs">
          {scan.metrics.criticalCount > 0 && (
            <span className="flex items-center text-red-500">
              <AlertCircle className="w-3 h-3 mr-1" />
              {scan.metrics.criticalCount}
            </span>
          )}
          {scan.metrics.warningCount > 0 && (
            <span className="flex items-center text-yellow-500">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {scan.metrics.warningCount}
            </span>
          )}
          {scan.metrics.infoCount > 0 && (
            <span className="flex items-center text-blue-500">
              <Info className="w-3 h-3 mr-1" />
              {scan.metrics.infoCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ScanHeader({ scan, onExport }: { scan: Scan; onExport: () => void }) {
  const getVerdictBadge = () => {
    if (!scan.verdict) return null;

    const badges = {
      pass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      fail: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      review:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${badges[scan.verdict]}`}
      >
        {scan.verdict.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {scan.projectPath || "Scan Results"}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span className="flex items-center">
              <GitBranch className="w-4 h-4 mr-1" />
              {scan.branch}
            </span>
            {scan.commitSha && (
              <span className="font-mono">{scan.commitSha.slice(0, 7)}</span>
            )}
            {scan.completedAt && (
              <span>
                Completed {new Date(scan.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {getVerdictBadge()}

          {scan.score !== undefined && (
            <div className="text-center">
              <div
                className={`text-3xl font-bold ${
                  scan.score >= 80
                    ? "text-green-500"
                    : scan.score >= 50
                      ? "text-yellow-500"
                      : "text-red-500"
                }`}
              >
                {scan.score}
              </div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
          )}

          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics */}
      {scan.metrics && (
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="text-gray-500">
            <span className="font-medium text-gray-900 dark:text-white">
              {scan.metrics.filesScanned}
            </span>{" "}
            files
          </div>
          <div className="text-gray-500">
            <span className="font-medium text-gray-900 dark:text-white">
              {scan.metrics.linesScanned.toLocaleString()}
            </span>{" "}
            lines
          </div>
          <div className="text-gray-500">
            <span className="font-medium text-gray-900 dark:text-white">
              {scan.metrics.issuesFound}
            </span>{" "}
            issues
          </div>
          {scan.metrics.durationMs && (
            <div className="text-gray-500">
              <span className="font-medium text-gray-900 dark:text-white">
                {(scan.metrics.durationMs / 1000).toFixed(1)}s
              </span>{" "}
              duration
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding,
  isSelected,
  onSelect,
  onExplain,
  explaining,
}: {
  finding: Finding;
  isSelected: boolean;
  onSelect: () => void;
  onExplain: () => void;
  explaining: boolean;
}) {
  const getSeverityIcon = () => {
    switch (finding.severity) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBg = () => {
    switch (finding.severity) {
      case "critical":
        return "border-l-4 border-red-500";
      case "warning":
        return "border-l-4 border-yellow-500";
      case "info":
        return "border-l-4 border-blue-500";
    }
  };

  return (
    <div
      className={`p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${getSeverityBg()} ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getSeverityIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {finding.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {finding.message}
            </p>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span className="flex items-center">
                <FileCode className="w-3 h-3 mr-1" />
                {finding.file}:{finding.line}
              </span>
              <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {finding.type.replace(/_/g, " ")}
              </span>
              <span>{Math.round(finding.confidence * 100)}% confidence</span>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExplain();
          }}
          disabled={explaining}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
        >
          {explaining ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {finding.aiExplanation ? "View" : "Explain"}
        </button>
      </div>

      {finding.codeSnippet && (
        <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto">
          <code>{finding.codeSnippet}</code>
        </pre>
      )}
    </div>
  );
}

function FindingDetailPanel({
  finding,
  onClose,
}: {
  finding: Finding;
  onClose: () => void;
}) {
  return (
    <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Finding Details
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Title
          </h4>
          <p className="mt-1 text-gray-900 dark:text-white">{finding.title}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Location
          </h4>
          <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
            {finding.file}:{finding.line}
            {finding.column && `:${finding.column}`}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Description
          </h4>
          <p className="mt-1 text-gray-700 dark:text-gray-300">
            {finding.message}
          </p>
        </div>

        {finding.suggestion && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Suggestion
            </h4>
            <p className="mt-1 text-green-700 dark:text-green-400">
              {finding.suggestion}
            </p>
          </div>
        )}

        {finding.aiExplanation && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-400">
                AI Explanation
              </h4>
            </div>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              {finding.aiExplanation}
            </p>
          </div>
        )}

        {finding.codeSnippet && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Code Snippet
            </h4>
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto">
              <code>{finding.codeSnippet}</code>
            </pre>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-gray-500 dark:text-gray-400">Type</h4>
            <p className="text-gray-900 dark:text-white">
              {finding.type.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <h4 className="text-gray-500 dark:text-gray-400">Severity</h4>
            <p
              className={`font-medium ${
                finding.severity === "critical"
                  ? "text-red-500"
                  : finding.severity === "warning"
                    ? "text-yellow-500"
                    : "text-blue-500"
              }`}
            >
              {finding.severity}
            </p>
          </div>
          <div>
            <h4 className="text-gray-500 dark:text-gray-400">Confidence</h4>
            <p className="text-gray-900 dark:text-white">
              {Math.round(finding.confidence * 100)}%
            </p>
          </div>
          <div>
            <h4 className="text-gray-500 dark:text-gray-400">Rule</h4>
            <p className="text-gray-900 dark:text-white">
              {finding.ruleId || "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanDashboard;
