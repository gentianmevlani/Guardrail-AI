"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code, FileText, Copy, Download, X } from "lucide-react";
import { useState } from "react";
import type { FixDiff } from "@/lib/api/fixes";

interface DiffViewerProps {
  diffs: FixDiff[];
  onClose?: () => void;
}

export function DiffViewer({ diffs, onClose }: DiffViewerProps) {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const copyToClipboard = (text: string, file: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(file);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const downloadDiff = (diff: FixDiff) => {
    const content = diff.hunks.map(h => h.content).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diff.file.replace(/\//g, "_")}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderHunk = (hunk: FixDiff["hunks"][0], file: string) => {
    const lines = hunk.content.split("\n");
    
    return (
      <div key={`${hunk.oldStart}-${hunk.newStart}`} className="mb-4">
        <div className="text-xs text-zinc-500 mb-2 font-mono">
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </div>
        <div className="bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
          {lines.map((line, idx) => {
            const isRemoved = line.startsWith("-");
            const isAdded = line.startsWith("+");
            const isContext = !isRemoved && !isAdded;
            
            return (
              <div
                key={idx}
                className={`flex items-start font-mono text-sm ${
                  isRemoved
                    ? "bg-red-950/30 text-red-300"
                    : isAdded
                      ? "bg-emerald-950/30 text-emerald-300"
                      : "text-zinc-400 bg-zinc-900"
                }`}
              >
                <span className="w-8 text-right pr-2 text-zinc-600 select-none">
                  {isRemoved || isContext ? hunk.oldStart + idx : ""}
                </span>
                <span className="w-8 text-right pr-2 text-zinc-600 select-none">
                  {isAdded || isContext ? hunk.newStart + idx : ""}
                </span>
                <span className="w-4 text-center select-none">
                  {isRemoved ? "-" : isAdded ? "+" : " "}
                </span>
                <span className="flex-1">{line.substring(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="w-5 h-5" />
              Diff Preview
            </CardTitle>
            <CardDescription className="text-zinc-400">
              {diffs.length} file{diffs.length !== 1 ? "s" : ""} modified
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {diffs.map((diff) => (
            <div key={diff.file} className="border-b border-zinc-800 pb-6 last:border-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <code className="text-sm font-mono text-zinc-200">{diff.file}</code>
                  <Badge variant="outline" className="text-xs">
                    {diff.hunks.length} hunk{diff.hunks.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(
                      diff.hunks.map(h => h.content).join("\n"),
                      diff.file
                    )}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copiedFile === diff.file ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadDiff(diff)}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              
              {diff.hunks.map((hunk) => renderHunk(hunk, diff.file))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
