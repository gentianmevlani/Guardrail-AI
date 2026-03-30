"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FileWithStats } from "@/lib/mappers/run-detail-mapper";

interface RealityMapProps {
  files: FileWithStats[];
  isLoading?: boolean;
}

export function RealityMap({ files, isLoading }: RealityMapProps) {
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

  if (!files || files.length === 0) {
    return (
      <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Reality Map</CardTitle>
          <CardDescription className="text-zinc-400">
            File-level analysis and confidence scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
            <p className="text-lg font-medium text-zinc-300">No files analyzed</p>
            <p className="text-sm text-zinc-500 mt-1">
              This run did not scan any files
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (confidence >= 0.6) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (confidence >= 0.4) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">Reality Map</CardTitle>
        <CardDescription className="text-zinc-400">
          File-level analysis and confidence scores ({files.length} file{files.length !== 1 ? "s" : ""})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.path}
              className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <code className="text-sm text-zinc-200 font-mono truncate">
                    {file.path}
                  </code>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-lg font-bold ${getScoreColor(file.score)}`}>
                    {file.score.toFixed(0)}
                  </span>
                  <Badge className={getConfidenceColor(file.confidence)}>
                    {(file.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>

              {file.findingsCount > 0 && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <AlertTriangle className="w-3 h-3" />
                    {file.findingsCount} finding{file.findingsCount !== 1 ? "s" : ""}
                  </div>
                  {file.criticalCount > 0 && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                      {file.criticalCount} critical
                    </Badge>
                  )}
                  {file.highCount > 0 && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                      {file.highCount} high
                    </Badge>
                  )}
                  {file.mediumCount > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                      {file.mediumCount} medium
                    </Badge>
                  )}
                  {file.lowCount > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                      {file.lowCount} low
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
