"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  FileText,
  Code,
  Share2,
  Archive,
  Eye,
  GitCommit,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../components/ui/utils";

// Mock data for ship runs
const shipRuns = [
  {
    id: "SHIP-5849",
    verdict: "GO",
    blockers: 0,
    timestamp: "12 minutes ago",
    user: "alex@example.com",
    commit: "a3f7d9c",
    repo: "guardiavault-oss/guardrail",
    branch: "main",
    artifacts: {
      htmlReport: true,
      summaryJson: true,
      sarif: true,
      evidenceBundle: true,
    },
    summary: {
      filesScanned: 247,
      hallucinationsBlocked: 3,
      boundaryViolations: 0,
      securityIssues: 0,
      timeSaved: "18m",
    },
  },
  {
    id: "SHIP-5848",
    verdict: "WARN",
    blockers: 2,
    timestamp: "1 hour ago",
    user: "sarah@example.com",
    commit: "b8e2c4f",
    repo: "guardiavault-oss/guardrail",
    branch: "feature/auth-refactor",
    artifacts: {
      htmlReport: true,
      summaryJson: true,
      sarif: true,
      evidenceBundle: false,
    },
    summary: {
      filesScanned: 89,
      hallucinationsBlocked: 5,
      boundaryViolations: 2,
      securityIssues: 0,
      timeSaved: "12m",
    },
  },
  {
    id: "SHIP-5847",
    verdict: "NO-GO",
    blockers: 7,
    timestamp: "3 hours ago",
    user: "mike@example.com",
    commit: "c9a1e2d",
    repo: "user/my-saas-app",
    branch: "develop",
    artifacts: {
      htmlReport: true,
      summaryJson: true,
      sarif: true,
      evidenceBundle: true,
    },
    summary: {
      filesScanned: 156,
      hallucinationsBlocked: 12,
      boundaryViolations: 4,
      securityIssues: 3,
      timeSaved: "22m",
    },
  },
  {
    id: "SHIP-5846",
    verdict: "GO",
    blockers: 0,
    timestamp: "5 hours ago",
    user: "alex@example.com",
    commit: "d4b3f1a",
    repo: "guardiavault-oss/guardrail",
    branch: "main",
    artifacts: {
      htmlReport: true,
      summaryJson: true,
      sarif: false,
      evidenceBundle: true,
    },
    summary: {
      filesScanned: 203,
      hallucinationsBlocked: 7,
      boundaryViolations: 0,
      securityIssues: 0,
      timeSaved: "15m",
    },
  },
  {
    id: "SHIP-5845",
    verdict: "WARN",
    blockers: 3,
    timestamp: "8 hours ago",
    user: "sarah@example.com",
    commit: "e7c6a2b",
    repo: "user/my-saas-app",
    branch: "feature/payments",
    artifacts: {
      htmlReport: true,
      summaryJson: true,
      sarif: true,
      evidenceBundle: true,
    },
    summary: {
      filesScanned: 124,
      hallucinationsBlocked: 9,
      boundaryViolations: 2,
      securityIssues: 1,
      timeSaved: "19m",
    },
  },
];

export function RunsProofPage() {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "GO":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold">
            ✓ GO
          </Badge>
        );
      case "WARN":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-semibold">
            ⚠ WARN
          </Badge>
        );
      case "NO-GO":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-semibold">
            ✕ NO-GO
          </Badge>
        );
      default:
        return null;
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "GO":
        return "border-l-emerald-500";
      case "WARN":
        return "border-l-yellow-500";
      case "NO-GO":
        return "border-l-red-500";
      default:
        return "border-l-zinc-500";
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRun(expandedRun === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Runs & Proof
            </h1>
            <p className="text-zinc-500 mt-2">
              Receipt vault for every ship decision with exportable artifacts
            </p>
          </div>
          <Button
            variant="outline"
            className="border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
          >
            <Archive className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total Ship Runs</p>
                  <p className="text-2xl font-bold text-white">{shipRuns.length}</p>
                </div>
                <History className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">GO Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {Math.round((shipRuns.filter((r) => r.verdict === "GO").length / shipRuns.length) * 100)}%
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total Blockers</p>
                  <p className="text-2xl font-bold text-red-400">
                    {shipRuns.reduce((sum, run) => sum + run.blockers, 0)}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Time Saved</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {shipRuns.reduce((sum, run) => sum + parseInt(run.summary.timeSaved), 0)}m
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Ship Runs Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <History className="w-5 h-5 text-blue-400" />
              Ship Runs Timeline
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Complete history of ship verdicts with downloadable artifacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shipRuns.map((run, index) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                >
                  <Card
                    className={cn(
                      "border-l-4 bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/50 transition-all cursor-pointer",
                      getVerdictColor(run.verdict)
                    )}
                    onClick={() => toggleExpand(run.id)}
                  >
                    <CardContent className="p-4">
                      {/* Main Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto hover:bg-transparent"
                          >
                            {expandedRun === run.id ? (
                              <ChevronDown className="w-5 h-5 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-zinc-400" />
                            )}
                          </Button>

                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <code className="font-mono font-semibold text-white">
                                {run.id}
                              </code>
                              {getVerdictBadge(run.verdict)}
                              {run.blockers > 0 && (
                                <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                                  {run.blockers} blocker{run.blockers > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-zinc-500">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {run.timestamp}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {run.user}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <GitCommit className="w-3.5 h-3.5" />
                                <code className="font-mono">{run.commit}</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedRun === run.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 pt-4 border-t border-zinc-800"
                          >
                            {/* Repository Info */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-zinc-500 mb-1">Repository</p>
                                <code className="text-sm text-blue-400 font-mono">
                                  {run.repo}
                                </code>
                              </div>
                              <div>
                                <p className="text-xs text-zinc-500 mb-1">Branch</p>
                                <code className="text-sm text-zinc-300 font-mono">
                                  {run.branch}
                                </code>
                              </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500">Files Scanned</p>
                                <p className="text-lg font-semibold text-white">
                                  {run.summary.filesScanned}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500">Hallucinations</p>
                                <p className="text-lg font-semibold text-orange-400">
                                  {run.summary.hallucinationsBlocked}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500">Boundary</p>
                                <p className="text-lg font-semibold text-yellow-400">
                                  {run.summary.boundaryViolations}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500">Security</p>
                                <p className="text-lg font-semibold text-red-400">
                                  {run.summary.securityIssues}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500">Time Saved</p>
                                <p className="text-lg font-semibold text-blue-400">
                                  {run.summary.timeSaved}
                                </p>
                              </div>
                            </div>

                            {/* Artifacts */}
                            <div>
                              <p className="text-sm text-zinc-400 mb-3 font-medium">
                                Available Artifacts
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!run.artifacts.htmlReport}
                                  className={cn(
                                    "justify-start border-zinc-700",
                                    run.artifacts.htmlReport &&
                                      "hover:border-blue-500/50 hover:bg-blue-500/10"
                                  )}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  HTML Report
                                  <ExternalLink className="w-3 h-3 ml-auto" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!run.artifacts.summaryJson}
                                  className={cn(
                                    "justify-start border-zinc-700",
                                    run.artifacts.summaryJson &&
                                      "hover:border-blue-500/50 hover:bg-blue-500/10"
                                  )}
                                >
                                  <Code className="w-4 h-4 mr-2" />
                                  summary.json
                                  <Download className="w-3 h-3 ml-auto" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!run.artifacts.sarif}
                                  className={cn(
                                    "justify-start border-zinc-700",
                                    run.artifacts.sarif &&
                                      "hover:border-blue-500/50 hover:bg-blue-500/10"
                                  )}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  SARIF
                                  <Download className="w-3 h-3 ml-auto" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!run.artifacts.evidenceBundle}
                                  className={cn(
                                    "justify-start border-zinc-700",
                                    run.artifacts.evidenceBundle &&
                                      "hover:border-blue-500/50 hover:bg-blue-500/10"
                                  )}
                                >
                                  <Archive className="w-4 h-4 mr-2" />
                                  Evidence Bundle
                                  <Download className="w-3 h-3 ml-auto" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
