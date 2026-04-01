"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { API_BASE } from "@/lib/api/core";
import { logger } from "@/lib/logger";

interface ScanComparisonViewProps {
  projectId?: string;
  onClose?: () => void;
}

interface ComparisonData {
  scan1: {
    id: string;
    createdAt: string;
    score: number;
    verdict: string;
    metrics: {
      total: number;
      critical: number;
      high: number;
    };
  };
  scan2: {
    id: string;
    createdAt: string;
    score: number;
    verdict: string;
    metrics: {
      total: number;
      critical: number;
      high: number;
    };
  };
  comparison: {
    metrics: {
      diff: {
        new: number;
        fixed: number;
        unchanged: number;
        scoreDelta: number;
        totalDelta: number;
      };
    };
    trend: {
      improving: boolean;
      regressing: boolean;
      stable: boolean;
    };
    findings: {
      new: Array<{
        id: string;
        type: string;
        severity: string;
        file: string;
        line: number;
        message: string;
      }>;
      fixed: Array<{
        id: string;
        type: string;
        severity: string;
        file: string;
        line: number;
        message: string;
      }>;
      unchanged: number;
    };
  };
}

export function ScanComparisonView({
  projectId,
  onClose,
}: ScanComparisonViewProps) {
  const [scans, setScans] = useState<any[]>([]);
  const [scan1Id, setScan1Id] = useState<string>("");
  const [scan2Id, setScan2Id] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScans();
  }, [projectId]);

  const loadScans = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/scans?limit=50`,
        { credentials: "include" }
      );
      if (!response.ok) return;
      
      const data = await response.json();
      if (data?.data?.scans) {
        setScans(data.data.scans);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load scans", error);
    }
  };

  const handleCompare = async () => {
    if (!scan1Id || !scan2Id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/scans/${scan1Id}/compare/${scan2Id}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to compare scans");
      }

      const data = await response.json();
      setComparison(data.data);
    } catch (error) {
      logger.logUnknownError("Comparison failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (!comparison) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Compare Scans</CardTitle>
          <CardDescription>
            Select two scans to compare results and track improvements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Scan</label>
              <Select value={scan1Id} onValueChange={setScan1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scan" />
                </SelectTrigger>
                <SelectContent>
                  {scans.map((scan) => (
                    <SelectItem key={scan.id} value={scan.id}>
                      {new Date(scan.createdAt).toLocaleString()} - Score:{" "}
                      {scan.score || "N/A"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Second Scan</label>
              <Select value={scan2Id} onValueChange={setScan2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scan" />
                </SelectTrigger>
                <SelectContent>
                  {scans
                    .filter((s) => s.id !== scan1Id)
                    .map((scan) => (
                      <SelectItem key={scan.id} value={scan.id}>
                        {new Date(scan.createdAt).toLocaleString()} - Score:{" "}
                        {scan.score || "N/A"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCompare}
            disabled={!scan1Id || !scan2Id || loading}
            className="w-full"
          >
            {loading ? "Comparing..." : "Compare Scans"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { scan1, scan2, comparison: comp } = comparison;
  const { metrics, trend } = comp;
  const { diff } = metrics;

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Scan Comparison</span>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Comparing scans from {new Date(scan1.createdAt).toLocaleDateString()}{" "}
            and {new Date(scan2.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trend Indicator */}
          <div className="flex items-center gap-2">
            {trend.improving ? (
              <>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">
                  Improving: Score increased by {diff.scoreDelta} points
                </span>
              </>
            ) : trend.regressing ? (
              <>
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-medium">
                  Regressing: Score decreased by {Math.abs(diff.scoreDelta)} points
                </span>
              </>
            ) : (
              <>
                <Minus className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Stable</span>
              </>
            )}
          </div>

          {/* Metrics Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-muted/50 border-border">
              <CardHeader>
                <CardTitle className="text-sm">Scan 1</CardTitle>
                <CardDescription className="text-xs">
                  {new Date(scan1.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Score</span>
                    <Badge>{scan1.score}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Findings</span>
                    <span className="text-sm font-medium">{scan1.metrics.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Critical</span>
                    <Badge variant="destructive">{scan1.metrics.critical}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50 border-border">
              <CardHeader>
                <CardTitle className="text-sm">Scan 2</CardTitle>
                <CardDescription className="text-xs">
                  {new Date(scan2.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Score</span>
                    <Badge>{scan2.score}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Findings</span>
                    <span className="text-sm font-medium">{scan2.metrics.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Critical</span>
                    <Badge variant="destructive">{scan2.metrics.critical}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Changes Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {diff.fixed}
                    </div>
                    <div className="text-xs text-muted-foreground">Fixed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <div className="text-2xl font-bold text-red-400">
                      {diff.new}
                    </div>
                    <div className="text-xs text-muted-foreground">New</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50 border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Minus className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {comp.findings.unchanged}
                    </div>
                    <div className="text-xs text-muted-foreground">Unchanged</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* New Findings */}
          {comp.findings.new.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-400">
                New Findings ({comp.findings.new.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {comp.findings.new.map((finding) => (
                  <div
                    key={finding.id}
                    className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{finding.type}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {finding.message}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <FileCode className="w-3 h-3 text-muted-foreground" />
                          <code className="text-xs">
                            {finding.file}:{finding.line}
                          </code>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-red-500/30 text-red-400"
                      >
                        {finding.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fixed Findings */}
          {comp.findings.fixed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-400">
                Fixed Findings ({comp.findings.fixed.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {comp.findings.fixed.map((finding) => (
                  <div
                    key={finding.id}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{finding.type}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {finding.message}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <FileCode className="w-3 h-3 text-muted-foreground" />
                          <code className="text-xs">
                            {finding.file}:{finding.line}
                          </code>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400"
                      >
                        Fixed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
