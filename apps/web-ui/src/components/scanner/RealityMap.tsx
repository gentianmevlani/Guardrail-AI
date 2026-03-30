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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Code2,
  Eye,
  FileCode,
  Folder,
  Ghost,
  Layers,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

// Types
interface Finding {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  file: string;
  line: number;
  title: string;
  message: string;
  confidence: number;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  findings?: Finding[];
  realityScore?: number;
  linesOfCode?: number;
}

interface RealityMapProps {
  scanId?: string;
  files: FileNode[];
  findings: Finding[];
  onFileSelect?: (file: FileNode) => void;
  onFindingSelect?: (finding: Finding) => void;
  className?: string;
}

type ViewMode = "tree" | "heatmap" | "sunburst";

// Calculate reality score for a file based on findings
function calculateRealityScore(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  const weights = {
    critical: 30,
    warning: 15,
    info: 5,
  };

  const totalPenalty = findings.reduce(
    (sum, f) => sum + weights[f.severity] * f.confidence,
    0
  );

  return Math.max(0, Math.round(100 - totalPenalty));
}

// Get color based on reality score
function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-teal-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-emerald-500/20";
  if (score >= 70) return "bg-teal-500/20";
  if (score >= 50) return "bg-yellow-500/20";
  if (score >= 30) return "bg-orange-500/20";
  return "bg-red-500/20";
}

function getScoreBorderColor(score: number): string {
  if (score >= 90) return "border-emerald-500/30";
  if (score >= 70) return "border-teal-500/30";
  if (score >= 50) return "border-yellow-500/30";
  if (score >= 30) return "border-orange-500/30";
  return "border-red-500/30";
}

// Build file tree from findings
function buildFileTree(findings: Finding[]): FileNode[] {
  const root: Record<string, FileNode> = {};

  findings.forEach((finding) => {
    const parts = finding.file.split("/");
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join("/");

      if (!current[part]) {
        current[part] = {
          name: part,
          path,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : {},
          findings: isFile ? [] : undefined,
        } as any;
      }

      if (isFile && current[part].findings) {
        current[part].findings!.push(finding);
        current[part].realityScore = calculateRealityScore(
          current[part].findings!
        );
      }

      if (!isFile) {
        current = (current[part] as any).children;
      }
    });
  });

  // Convert to array structure
  function toArray(obj: Record<string, FileNode>): FileNode[] {
    return Object.values(obj).map((node) => ({
      ...node,
      children: node.children ? toArray(node.children as any) : undefined,
    }));
  }

  return toArray(root);
}

// Tree View Component
function TreeView({
  nodes,
  onFileSelect,
  onFindingSelect,
  level = 0,
}: {
  nodes: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  onFindingSelect?: (finding: Finding) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const isExpanded = expanded[node.path];
        const score = node.realityScore ?? 100;
        const hasIssues = (node.findings?.length ?? 0) > 0;

        return (
          <div key={node.path}>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                "hover:bg-secondary/50",
                hasIssues && getScoreBgColor(score)
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => {
                if (node.type === "directory") {
                  toggleExpanded(node.path);
                } else {
                  onFileSelect?.(node);
                }
              }}
            >
              {node.type === "directory" ? (
                <>
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                  <Folder className="w-4 h-4 text-teal-400" />
                </>
              ) : (
                <>
                  <span className="w-4" />
                  <FileCode
                    className={cn("w-4 h-4", hasIssues ? getScoreColor(score) : "text-muted-foreground")}
                  />
                </>
              )}
              <span className="flex-1 text-sm text-foreground/90 truncate">
                {node.name}
              </span>
              {node.type === "file" && hasIssues && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          getScoreColor(score),
                          getScoreBorderColor(score)
                        )}
                      >
                        {score}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reality Score: {score}%</p>
                      <p className="text-xs text-muted-foreground">
                        {node.findings?.length} issue
                        {node.findings?.length !== 1 ? "s" : ""} found
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* File Findings */}
            {node.type === "file" && isExpanded && node.findings && (
              <div className="ml-8 mt-1 space-y-1">
                {node.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer",
                      "bg-card/50 border hover:border-primary/50 transition-colors",
                      finding.severity === "critical" && "border-red-500/30",
                      finding.severity === "warning" && "border-yellow-500/30",
                      finding.severity === "info" && "border-blue-500/30"
                    )}
                    onClick={() => onFindingSelect?.(finding)}
                  >
                    {finding.severity === "critical" && (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    {finding.severity === "warning" && (
                      <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                    )}
                    {finding.severity === "info" && (
                      <Ghost className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 truncate">
                        {finding.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Line {finding.line}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {Math.round(finding.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Directory Children */}
            {node.type === "directory" && isExpanded && node.children && (
              <TreeView
                nodes={node.children}
                onFileSelect={onFileSelect}
                onFindingSelect={onFindingSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Heatmap View Component
function HeatmapView({
  files,
  findings,
  onFileSelect,
}: {
  files: FileNode[];
  findings: Finding[];
  onFileSelect?: (file: FileNode) => void;
}) {
  // Group findings by file
  const fileMap = useMemo(() => {
    const map = new Map<string, Finding[]>();
    findings.forEach((f) => {
      const existing = map.get(f.file) || [];
      existing.push(f);
      map.set(f.file, existing);
    });
    return map;
  }, [findings]);

  // Get all files with scores
  const filesWithScores = useMemo(() => {
    return Array.from(fileMap.entries())
      .map(([file, fileFindings]) => ({
        path: file,
        name: file.split("/").pop() || file,
        findings: fileFindings,
        score: calculateRealityScore(fileFindings),
        criticalCount: fileFindings.filter((f) => f.severity === "critical")
          .length,
        warningCount: fileFindings.filter((f) => f.severity === "warning")
          .length,
      }))
      .sort((a, b) => a.score - b.score);
  }, [fileMap]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {filesWithScores.map((file) => (
        <TooltipProvider key={file.path}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all",
                  "hover:scale-105 hover:shadow-lg",
                  getScoreBgColor(file.score),
                  getScoreBorderColor(file.score)
                )}
                onClick={() =>
                  onFileSelect?.({
                    name: file.name,
                    path: file.path,
                    type: "file",
                    findings: file.findings,
                    realityScore: file.score,
                  })
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <FileCode
                    className={cn("w-5 h-5", getScoreColor(file.score))}
                  />
                  <span
                    className={cn(
                      "text-lg font-bold",
                      getScoreColor(file.score)
                    )}
                  >
                    {file.score}%
                  </span>
                </div>
                <p className="text-sm text-foreground/90 truncate font-medium">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {file.criticalCount > 0 && (
                    <span className="text-xs text-red-400">
                      {file.criticalCount} critical
                    </span>
                  )}
                  {file.warningCount > 0 && (
                    <span className="text-xs text-yellow-400">
                      {file.warningCount} warning
                    </span>
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{file.path}</p>
              <p className="text-sm text-muted-foreground">
                {file.findings.length} issue
                {file.findings.length !== 1 ? "s" : ""} detected
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// Summary Stats Component
function SummaryStats({ findings }: { findings: Finding[] }) {
  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    let critical = 0;
    let warning = 0;
    let info = 0;

    findings.forEach((f) => {
      byType.set(f.type, (byType.get(f.type) || 0) + 1);
      if (f.severity === "critical") critical++;
      else if (f.severity === "warning") warning++;
      else info++;
    });

    const uniqueFiles = new Set(findings.map((f) => f.file)).size;
    const avgConfidence =
      findings.length > 0
        ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
        : 0;

    return {
      total: findings.length,
      critical,
      warning,
      info,
      uniqueFiles,
      avgConfidence,
      topTypes: Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [findings]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-card/50 border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">
                {stats.warning}
              </p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <FileCode className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-teal-400">
                {stats.uniqueFiles}
              </p>
              <p className="text-xs text-muted-foreground">Files Affected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">
                {Math.round(stats.avgConfidence * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Avg Confidence</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Reality Map Component
export function RealityMap({
  scanId,
  files,
  findings,
  onFileSelect,
  onFindingSelect,
  className,
}: RealityMapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  // Build tree from findings if files not provided
  const fileTree = useMemo(() => {
    if (files.length > 0) return files;
    return buildFileTree(findings);
  }, [files, findings]);

  // Calculate overall reality score
  const overallScore = useMemo(() => {
    if (findings.length === 0) return 100;
    return calculateRealityScore(findings);
  }, [findings]);

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Overall Score */}
      <Card className="bg-gradient-to-r from-card to-card/50 border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  getScoreBgColor(overallScore),
                  "border",
                  getScoreBorderColor(overallScore)
                )}
              >
                {overallScore >= 70 ? (
                  <CheckCircle
                    className={cn("w-8 h-8", getScoreColor(overallScore))}
                  />
                ) : (
                  <Ghost
                    className={cn("w-8 h-8", getScoreColor(overallScore))}
                  />
                )}
              </div>
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  Reality Map
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-lg",
                      getScoreColor(overallScore),
                      getScoreBorderColor(overallScore)
                    )}
                  >
                    {overallScore}%
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {overallScore >= 90
                    ? "Your code looks production-ready!"
                    : overallScore >= 70
                      ? "Minor issues detected - review recommended"
                      : overallScore >= 50
                        ? "Significant issues found - fixes needed"
                        : "Critical problems detected - do not ship!"}
                </CardDescription>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "tree" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("tree")}
                className={viewMode === "tree" ? "bg-teal-600" : ""}
              >
                <Layers className="w-4 h-4 mr-1" />
                Tree
              </Button>
              <Button
                variant={viewMode === "heatmap" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("heatmap")}
                className={viewMode === "heatmap" ? "bg-teal-600" : ""}
              >
                <Zap className="w-4 h-4 mr-1" />
                Heatmap
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <SummaryStats findings={findings} />

      {/* Main Content */}
      <Card className="bg-card/50 border">
        <CardContent className="pt-6">
          {viewMode === "tree" && (
            <TreeView
              nodes={fileTree}
              onFileSelect={handleFileSelect}
              onFindingSelect={onFindingSelect}
            />
          )}
          {viewMode === "heatmap" && (
            <HeatmapView
              files={fileTree}
              findings={findings}
              onFileSelect={handleFileSelect}
            />
          )}
        </CardContent>
      </Card>

      {/* Selected File Details */}
      {selectedFile && selectedFile.findings && (
        <Card className="bg-card/50 border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-teal-400" />
              {selectedFile.name}
              <Badge
                variant="outline"
                className={cn(
                  getScoreColor(selectedFile.realityScore ?? 100),
                  getScoreBorderColor(selectedFile.realityScore ?? 100)
                )}
              >
                {selectedFile.realityScore ?? 100}% Real
              </Badge>
            </CardTitle>
            <CardDescription>{selectedFile.path}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedFile.findings.map((finding) => (
                <div
                  key={finding.id}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-colors",
                    "hover:border-primary/50",
                    finding.severity === "critical" &&
                      "bg-red-950/20 border-red-500/30",
                    finding.severity === "warning" &&
                      "bg-yellow-950/20 border-yellow-500/30",
                    finding.severity === "info" &&
                      "bg-blue-950/20 border-blue-500/30"
                  )}
                  onClick={() => onFindingSelect?.(finding)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {finding.severity === "critical" && (
                        <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                      )}
                      {finding.severity === "warning" && (
                        <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      )}
                      {finding.severity === "info" && (
                        <Ghost className="w-5 h-5 text-blue-400 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {finding.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {finding.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Line {finding.line} | Type: {finding.type}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {Math.round(finding.confidence * 100)}% confidence
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RealityMap;
