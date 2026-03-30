"use client";

import { Button } from "@/components/ui/button";
import { generateDiff, generateFixes } from "@/lib/scanner/autofix";
import type { ScanIssue } from "@/lib/scanner/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useMemo, useState } from "react";

interface AutoFixPreviewProps {
  fileContent: string;
  fileName: string;
  issues: ScanIssue[];
  onApply: (fixedContent: string) => void;
  onCancel: () => void;
}

export function AutoFixPreview({
  fileContent,
  fileName,
  issues,
  onApply,
  onCancel,
}: AutoFixPreviewProps) {
  const fixResult = useMemo(() => {
    return generateFixes(fileContent, issues);
  }, [fileContent, issues]);

  const diff = useMemo(() => {
    return generateDiff(fileContent, fixResult.fixedContent);
  }, [fileContent, fixResult.fixedContent]);

  const [currentFixIndex, setCurrentFixIndex] = useState(0);

  const hasChanges = fixResult.appliedFixes.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Auto-Fix Preview</h3>
          <p className="text-sm text-slate-400">{fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            {fixResult.appliedFixes.length} fix{fixResult.appliedFixes.length !== 1 ? "es" : ""} available
          </span>
          {fixResult.skippedFixes.length > 0 && (
            <span className="text-sm text-amber-400">
              ({fixResult.skippedFixes.length} skipped)
            </span>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentFixIndex === 0}
            onClick={() => setCurrentFixIndex((i) => i - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-400">
            Fix {currentFixIndex + 1} of {fixResult.appliedFixes.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentFixIndex >= fixResult.appliedFixes.length - 1}
            onClick={() => setCurrentFixIndex((i) => i + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 border-b border-slate-700 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/50" />
            <span className="text-slate-400">Removed</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500/50" />
            <span className="text-slate-400">Added</span>
          </span>
        </div>

        <div className="max-h-[400px] overflow-auto">
          <pre className="text-sm p-4">
            <code>
              {diff.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    "px-2 -mx-2 font-mono",
                    line.type === "removed" && "bg-red-500/10 text-red-400",
                    line.type === "added" && "bg-green-500/10 text-green-400",
                    line.type === "unchanged" && "text-slate-400"
                  )}
                >
                  <span className="inline-block w-8 text-slate-600 select-none">
                    {line.lineNumber}
                  </span>
                  <span className="inline-block w-4 text-slate-600 select-none">
                    {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
                  </span>
                  {line.content}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>

      {fixResult.skippedFixes.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-400 mb-2">Skipped Fixes</h4>
          <ul className="space-y-1">
            {fixResult.skippedFixes.map((skip, index) => (
              <li key={index} className="text-sm text-slate-400">
                Line {skip.issue.line}: {skip.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
        <Button variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          disabled={!hasChanges}
          onClick={() => onApply(fixResult.fixedContent)}
          className="gap-2"
        >
          <Check className="w-4 h-4" />
          Apply {fixResult.appliedFixes.length} Fix{fixResult.appliedFixes.length !== 1 ? "es" : ""}
        </Button>
      </div>
    </div>
  );
}

interface FixedFilesDownloadProps {
  fixedFiles: Map<string, { original: string; fixed: string }>;
  onClose: () => void;
}

export function FixedFilesDownload({ fixedFiles, onClose }: FixedFilesDownloadProps) {
  const handleDownload = () => {
    const content: string[] = [];
    
    fixedFiles.forEach((data, filename) => {
      content.push(`${"=".repeat(60)}`);
      content.push(`FILE: ${filename}`);
      content.push(`${"=".repeat(60)}`);
      content.push(data.fixed);
      content.push("");
    });

    const blob = new Blob([content.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guardrail-fixed-files-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-800 rounded-lg border border-slate-700 p-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Fixes Applied!</h3>
        <p className="text-sm text-slate-400 mb-6">
          {fixedFiles.size} file{fixedFiles.size !== 1 ? "s" : ""} have been fixed.
          Download the fixed files below.
        </p>

        <div className="bg-slate-900/50 rounded-lg p-4 mb-6 text-left">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Fixed Files:</h4>
          <ul className="space-y-1">
            {Array.from(fixedFiles.keys()).map((filename) => (
              <li key={filename} className="text-sm text-slate-400 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                {filename}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download Fixed Files
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
