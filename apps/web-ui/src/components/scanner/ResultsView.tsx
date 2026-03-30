"use client";

import { Button } from "@/components/ui/button";
import {
    copyToClipboard,
    downloadFile,
    exportToCsv,
    exportToJson,
    exportToSarif,
} from "@/lib/scanner/export";
import {
    type IssueSeverity,
    type IssueType,
    type LocalScanResult,
    type ScanSummary,
    getSeverityBgColor,
    getSeverityColor,
} from "@/lib/scanner/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    FileCode,
    Filter,
    Info,
    Lock,
    Wrench,
    X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ResultsViewProps {
  results: LocalScanResult[];
  summary: ScanSummary;
  onAutoFix?: (file: string, issueIndex: number) => void;
  onRequestDeepScan?: () => void;
  /** When true (e.g. free tier), only severity counts are readable; issue details are blurred until upgrade. */
  hideIssueDetails?: boolean;
  /** Pro & Compliance: show Auto-fix. Starter sees full issues but no auto-fix. */
  showAutoFix?: boolean;
}

const severityIcons: Record<IssueSeverity, typeof AlertCircle> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info,
};

const severityLabels: Record<IssueSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const typeLabels: Record<IssueType, string> = {
  mock_data: "Mock Data",
  placeholder_api: "Placeholder API",
  hardcoded_secret: "Hardcoded Secret",
  todo_fixme: "TODO/FIXME",
  console_log: "Console Log",
  debug_code: "Debug Code",
};

export function ResultsView({
  results,
  summary,
  onAutoFix,
  onRequestDeepScan,
  hideIssueDetails = false,
  showAutoFix = true,
}: ResultsViewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all");
  const [copied, setCopied] = useState(false);

  const filteredResults = useMemo(() => {
    return results
      .map((result) => ({
        ...result,
        issues: result.issues.filter((issue) => {
          if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
          if (typeFilter !== "all" && issue.type !== typeFilter) return false;
          return true;
        }),
      }))
      .filter((result) => result.issues.length > 0);
  }, [results, severityFilter, typeFilter]);

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFiles(new Set(filteredResults.map((r) => r.relativePath)));
  };

  const collapseAll = () => {
    setExpandedFiles(new Set());
  };

  const handleExport = (format: "json" | "sarif" | "csv") => {
    const timestamp = new Date().toISOString().split("T")[0];
    switch (format) {
      case "json":
        downloadFile(exportToJson(results, summary), `guardrail-scan-${timestamp}.json`, "application/json");
        break;
      case "sarif":
        downloadFile(exportToSarif(results, summary), `guardrail-scan-${timestamp}.sarif`, "application/json");
        break;
      case "csv":
        downloadFile(exportToCsv(results), `guardrail-scan-${timestamp}.csv`, "text/csv");
        break;
    }
  };

  const handleCopyJson = async () => {
    await copyToClipboard(exportToJson(results, summary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const issuesLocked = hideIssueDetails && summary.totalIssues > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-white">{summary.totalFiles}</div>
          <div className="text-sm text-slate-400 mt-1">Files Scanned</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className={cn(
            "text-3xl font-bold",
            summary.totalIssues > 0 ? "text-amber-400" : "text-green-400"
          )}>
            {summary.totalIssues}
          </div>
          <div className="text-sm text-slate-400 mt-1">Total Issues</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-red-400">{summary.bySeverity.critical}</div>
          <div className="text-sm text-slate-400 mt-1">Critical</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-orange-400">{summary.bySeverity.high}</div>
          <div className="text-sm text-slate-400 mt-1">High</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-yellow-400">{summary.bySeverity.medium}</div>
          <div className="text-sm text-slate-400 mt-1">Medium</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-blue-400">{summary.bySeverity.low}</div>
          <div className="text-sm text-slate-400 mt-1">Low</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 col-span-2 sm:col-span-1">
          <div className="text-sm text-slate-300">{summary.scanDuration.toFixed(0)}ms</div>
          <div className="text-sm text-slate-400 mt-1">Scan Time</div>
        </div>
      </div>

      {issuesLocked && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-wrap items-center gap-2 text-sm text-amber-200/90">
          <Lock className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Free plan shows severity counts only. Upgrade to see file paths, messages, and code snippets.
          </span>
          <Button
            asChild
            size="sm"
            className="bg-amber-500/20 text-amber-100 border border-amber-500/40 hover:bg-amber-500/30"
          >
            <Link href="/billing">View plans</Link>
          </Button>
        </div>
      )}

      <div
        className={cn(
          "relative rounded-xl border border-slate-700/40 overflow-hidden",
          issuesLocked && "min-h-[320px]",
        )}
      >
        {issuesLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-[2px]">
            <div className="max-w-md rounded-xl border border-slate-600/80 bg-slate-900/95 p-6 text-center shadow-xl">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
                <Lock className="h-6 w-6 text-amber-400" />
              </div>
              <p className="text-base font-semibold text-white">Issue details are hidden on the Free plan</p>
              <p className="mt-2 text-sm text-slate-400">
                Upgrade to unlock file paths, rule names, messages, snippets, filters, and exports.
              </p>
              <Button asChild className="mt-4 w-full sm:w-auto">
                <Link href="/billing">Upgrade to see issues</Link>
              </Button>
            </div>
          </div>
        )}

        <div
          className={cn(
            "space-y-6 p-1",
            issuesLocked && "pointer-events-none select-none blur-md",
          )}
        >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-400">Filter:</span>
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | "all")}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical ({summary.bySeverity.critical})</option>
          <option value="high">High ({summary.bySeverity.high})</option>
          <option value="medium">Medium ({summary.bySeverity.medium})</option>
          <option value="low">Low ({summary.bySeverity.low})</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as IssueType | "all")}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="all">All Types</option>
          {Object.entries(typeLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label} ({summary.byType[type as IssueType]})
            </option>
          ))}
        </select>

        {(severityFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeverityFilter("all");
              setTypeFilter("all");
            }}
            className="text-slate-400"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={expandAll} className="text-slate-400">
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll} className="text-slate-400">
          Collapse All
        </Button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {filteredResults.map((result) => (
            <motion.div
              key={result.relativePath}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden"
            >
              <button
                onClick={() => toggleFile(result.relativePath)}
                className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/30 transition-colors"
              >
                {expandedFiles.has(result.relativePath) ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
                <FileCode className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300 font-medium truncate flex-1 text-left">
                  {result.relativePath}
                </span>
                <div className="flex items-center gap-2">
                  {result.issues.some((i) => i.severity === "critical") && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                      {result.issues.filter((i) => i.severity === "critical").length} critical
                    </span>
                  )}
                  {result.issues.some((i) => i.severity === "high") && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400">
                      {result.issues.filter((i) => i.severity === "high").length} high
                    </span>
                  )}
                  <span className="text-sm text-slate-500">
                    {result.issues.length} issue{result.issues.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>

              <AnimatePresence>
                {expandedFiles.has(result.relativePath) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-700/50"
                  >
                    {result.issues.map((issue, index) => {
                      const Icon = severityIcons[issue.severity];
                      return (
                        <div
                          key={index}
                          className={cn(
                            "p-4 border-b border-slate-700/30 last:border-b-0",
                            getSeverityBgColor(issue.severity)
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={cn("w-5 h-5 mt-0.5", getSeverityColor(issue.severity))} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("font-medium", getSeverityColor(issue.severity))}>
                                  {severityLabels[issue.severity]}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                                  {typeLabels[issue.type]}
                                </span>
                                <span className="text-xs text-slate-500">
                                  Line {issue.line}:{issue.column}
                                </span>
                              </div>
                              <p className="text-sm text-slate-300 mt-1">{issue.message}</p>

                              <pre className="mt-3 p-3 bg-slate-900/80 rounded-md text-xs overflow-x-auto">
                                <code className="text-slate-400">
                                  {issue.snippet.split("\n").map((line, i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "px-2 -mx-2",
                                        i === 1 && "bg-amber-500/10 border-l-2 border-amber-500"
                                      )}
                                    >
                                      {line}
                                    </div>
                                  ))}
                                </code>
                              </pre>

                              {issue.autoFixAvailable && onAutoFix && showAutoFix && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-3 gap-2"
                                  onClick={() => onAutoFix(result.relativePath, index)}
                                >
                                  <Wrench className="w-3 h-3" />
                                  Auto-fix
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredResults.length === 0 && (
          <div className="text-center py-12">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No issues found!</h3>
            <p className="text-sm text-slate-400 mt-2">
              {severityFilter !== "all" || typeFilter !== "all"
                ? "No issues match your current filters"
                : "Your code looks clean"}
            </p>
          </div>
        )}
      </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-700/50">
        <span className="text-sm text-slate-400">Export:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("json")}
          className="gap-2"
          disabled={issuesLocked}
        >
          <Download className="w-4 h-4" />
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("sarif")}
          className="gap-2"
          disabled={issuesLocked}
        >
          <Download className="w-4 h-4" />
          SARIF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("csv")}
          className="gap-2"
          disabled={issuesLocked}
        >
          <Download className="w-4 h-4" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyJson}
          className="gap-2"
          disabled={issuesLocked}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy JSON"}
        </Button>

        {onRequestDeepScan && (
          <>
            <div className="flex-1" />
            <Button onClick={onRequestDeepScan} className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Request Deep Scan
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
