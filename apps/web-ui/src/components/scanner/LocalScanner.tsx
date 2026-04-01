"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { hideIssueDetailsForTier, tierSupportsAutoFix } from "@/lib/tier-gates";
import { useScannerWorker } from "@/lib/scanner/use-scanner-worker";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock, Shield, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";
import { AutoFixPreview, FixedFilesDownload } from "./AutoFixPreview";
import { Dropzone, type SelectedFile } from "./Dropzone";
import { ResultsView } from "./ResultsView";
import { ScanProgress } from "./ScanProgress";

type ScannerState = "upload" | "scanning" | "results" | "autofix" | "fixed";

interface FileContents {
  [path: string]: string;
}

export function LocalScanner() {
  const { tier } = useAuth();
  const [state, setState] = useState<ScannerState>("upload");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileContents, setFileContents] = useState<FileContents>({});
  const [autoFixFile, setAutoFixFile] = useState<string | null>(null);
  const [fixedFiles, setFixedFiles] = useState<Map<string, { original: string; fixed: string }>>(new Map());

  const {
    isScanning,
    progress,
    results,
    summary,
    error,
    startScan,
    cancelScan,
    reset,
  } = useScannerWorker();

  const handleFilesSelected = useCallback((files: SelectedFile[]) => {
    setSelectedFiles(files);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setState("scanning");
    const contents: FileContents = {};
    const filesToScan: { name: string; content: string; relativePath: string }[] = [];

    for (const sf of selectedFiles) {
      try {
        const content = await sf.file.text();
        contents[sf.relativePath] = content;
        filesToScan.push({
          name: sf.file.name,
          content,
          relativePath: sf.relativePath,
        });
      } catch (e) {
        logger.error('Failed to read file', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          relativePath: sf.relativePath,
          component: 'LocalScanner'
        });
      }
    }

    setFileContents(contents);
    startScan(filesToScan);
  }, [selectedFiles, startScan]);

  const handleScanComplete = useCallback(() => {
    if (summary) {
      setState("results");
    }
  }, [summary]);

  if (progress?.phase === "complete" && state === "scanning") {
    handleScanComplete();
  }

  const handleAutoFix = useCallback((filePath: string, issueIndex: number) => {
    setAutoFixFile(filePath);
    setState("autofix");
  }, []);

  const handleApplyFix = useCallback((fixedContent: string) => {
    if (autoFixFile) {
      setFixedFiles((prev) => {
        const next = new Map(prev);
        next.set(autoFixFile, {
          original: fileContents[autoFixFile],
          fixed: fixedContent,
        });
        return next;
      });
      setFileContents((prev) => ({
        ...prev,
        [autoFixFile]: fixedContent,
      }));
    }
    setAutoFixFile(null);
    setState("results");
  }, [autoFixFile, fileContents]);

  const handleCancelFix = useCallback(() => {
    setAutoFixFile(null);
    setState("results");
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setSelectedFiles([]);
    setFileContents({});
    setAutoFixFile(null);
    setFixedFiles(new Map());
    setState("upload");
  }, [reset]);

  const handleRequestDeepScan = useCallback(() => {
    alert("Deep Scan feature coming soon! This will send your code to our secure API for advanced analysis.");
  }, []);

  const currentFileResult = autoFixFile
    ? results.find((r) => r.relativePath === autoFixFile)
    : null;

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Local File Scanner</CardTitle>
              <CardDescription>
                Scan your code for issues without uploading to the cloud
              </CardDescription>
            </div>
          </div>

          {state !== "upload" && (
            <Button variant="ghost" onClick={handleReset} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Start Over
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Lock className="w-4 h-4 text-green-400" />
            <span>Privacy Mode: All scanning happens in your browser</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Fast: Powered by Web Workers</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {state === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dropzone onFilesSelected={handleFilesSelected} />

              {selectedFiles.length > 0 && (
                <div className="mt-6 flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleStartScan}
                    className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    <Shield className="w-5 h-5" />
                    Scan {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {state === "scanning" && progress && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ScanProgress progress={progress} />

              {isScanning && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={cancelScan}>
                    Cancel Scan
                  </Button>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {state === "results" && summary && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ResultsView
                results={results}
                summary={summary}
                onAutoFix={handleAutoFix}
                onRequestDeepScan={handleRequestDeepScan}
                hideIssueDetails={hideIssueDetailsForTier(tier)}
                showAutoFix={tierSupportsAutoFix(tier)}
              />

              {fixedFiles.size > 0 && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-400">
                    {fixedFiles.size} file{fixedFiles.size !== 1 ? "s" : ""} have been fixed.
                    <Button
                      variant="link"
                      className="text-green-400 p-0 h-auto ml-2"
                      onClick={() => setState("fixed")}
                    >
                      Download fixed files →
                    </Button>
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {state === "autofix" && autoFixFile && currentFileResult && (
            <motion.div
              key="autofix"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AutoFixPreview
                fileContent={fileContents[autoFixFile]}
                fileName={autoFixFile}
                issues={currentFileResult.issues}
                onApply={handleApplyFix}
                onCancel={handleCancelFix}
              />
            </motion.div>
          )}

          {state === "fixed" && (
            <motion.div
              key="fixed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <FixedFilesDownload
                fixedFiles={fixedFiles}
                onClose={() => setState("results")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
