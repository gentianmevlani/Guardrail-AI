"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, CheckCircle2, FileText, Download, Code } from "lucide-react";
import type { FixPack } from "@/lib/mappers/run-detail-mapper";
import { useState } from "react";

interface FixPacksProps {
  packs: FixPack[];
  isLoading?: boolean;
  onApplyFix?: (packId: string) => void;
  onViewDiff?: (packId: string) => void;
}

export function FixPacks({ packs, isLoading, onApplyFix, onViewDiff }: FixPacksProps) {
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());

  const togglePack = (packId: string) => {
    const newExpanded = new Set(expandedPacks);
    if (newExpanded.has(packId)) {
      newExpanded.delete(packId);
    } else {
      newExpanded.add(packId);
    }
    setExpandedPacks(newExpanded);
  };

  if (isLoading) {
    return (
      <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const fixablePacks = packs.filter((p) => p.fixable);
  const nonFixablePacks = packs.filter((p) => !p.fixable);

  if (packs.length === 0) {
    return (
      <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Fix Packs</CardTitle>
          <CardDescription className="text-zinc-400">
            Grouped fixes and patches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
            <p className="text-lg font-medium text-zinc-300">No fix packs available</p>
            <p className="text-sm text-zinc-500 mt-1">
              No findings require fixes or patches are not yet supported
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (confidence >= 0.6) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (confidence >= 0.4) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  const renderPack = (pack: FixPack) => {
    const isExpanded = expandedPacks.has(pack.id);
    const hasPatchSupport = pack.fixable && onApplyFix !== undefined;

    return (
      <div
        key={pack.id}
        className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-zinc-500" />
              <code className="text-sm font-mono text-zinc-200">{pack.rule}</code>
              <Badge className={getSeverityColor(pack.severity)}>
                {pack.severity}
              </Badge>
              <Badge className={getConfidenceColor(pack.confidence)}>
                {(pack.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span>{pack.findings.length} finding{pack.findings.length !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {pack.fileCount} file{pack.fileCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasPatchSupport ? (
              <>
                {onViewDiff && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewDiff(pack.id)}
                    className="text-xs"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    View Diff
                  </Button>
                )}
                {onApplyFix && (
                  <Button
                    size="sm"
                    onClick={() => onApplyFix(pack.id)}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Apply Fix
                  </Button>
                )}
              </>
            ) : (
              <Badge variant="outline" className="text-xs text-zinc-500">
                Patch not available
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => togglePack(pack.id)}
              className="text-xs"
            >
              {isExpanded ? "Hide" : "Show"} Details
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
            {pack.findings.map((finding, idx) => (
              <div
                key={finding.id || idx}
                className="p-2 rounded bg-zinc-950/50 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300">{finding.message}</p>
                    <code className="text-zinc-500 mt-1">
                      {finding.file}:{finding.line}
                    </code>
                  </div>
                  <Badge className={getConfidenceColor(finding.confidence)}>
                    {(finding.confidence * 100).toFixed(0)}%
                    {finding.confidenceSource === "derived" && " (derived)"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">Fix Packs</CardTitle>
        <CardDescription className="text-zinc-400">
          Grouped fixes and patches ({packs.length} pack{packs.length !== 1 ? "s" : ""})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fixablePacks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Fixable ({fixablePacks.length})
              </h3>
              <div className="space-y-3">
                {fixablePacks.map(renderPack)}
              </div>
            </div>
          )}

          {nonFixablePacks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Manual Review Required ({nonFixablePacks.length})
              </h3>
              <div className="space-y-3">
                {nonFixablePacks.map(renderPack)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
