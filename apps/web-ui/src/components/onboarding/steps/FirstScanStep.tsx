"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    FileCode,
    FolderGit2,
    Upload
} from "lucide-react";
import { useCallback, useState } from "react";

interface FirstScanStepProps {
  githubConnected: boolean;
  onScanComplete: (results: {
    issuesFound: number;
    score: number;
    repoName?: string;
  }) => void;
  onBack: () => void;
}

type ScanPhase = "idle" | "selecting" | "scanning" | "complete" | "error";

interface ScanProgress {
  phase: string;
  progress: number;
  filesScanned: number;
  totalFiles: number;
  currentFile?: string;
}

export function FirstScanStep({
  githubConnected,
  onScanComplete,
  onBack,
}: FirstScanStepProps) {
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState<ScanProgress>({
    phase: "Initializing",
    progress: 0,
    filesScanned: 0,
    totalFiles: 0,
  });
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const simulateScan = useCallback(async (repoName?: string) => {
    setScanPhase("scanning");
    setError(null);

    const phases = [
      { phase: "Cloning repository", duration: 800 },
      { phase: "Analyzing structure", duration: 600 },
      { phase: "Scanning for vulnerabilities", duration: 1200 },
      { phase: "Running AI analysis", duration: 1000 },
      { phase: "Generating report", duration: 500 },
    ];

    const totalFiles = Math.floor(Math.random() * 150) + 50;
    let filesScanned = 0;

    for (let i = 0; i < phases.length; i++) {
      const { phase, duration } = phases[i];
      const startProgress = (i / phases.length) * 100;
      const endProgress = ((i + 1) / phases.length) * 100;

      const steps = 10;
      for (let step = 0; step <= steps; step++) {
        await new Promise((resolve) => setTimeout(resolve, duration / steps));
        const currentProgress = startProgress + ((endProgress - startProgress) * step) / steps;
        filesScanned = Math.min(
          Math.floor((currentProgress / 100) * totalFiles),
          totalFiles
        );

        setProgress({
          phase,
          progress: Math.round(currentProgress),
          filesScanned,
          totalFiles,
          currentFile:
            step < steps
              ? `src/${["components", "lib", "utils", "hooks"][Math.floor(Math.random() * 4)]}/file${filesScanned}.ts`
              : undefined,
        });
      }
    }

    setScanPhase("complete");

    const issuesFound = Math.floor(Math.random() * 8);
    const score = issuesFound === 0 ? 100 : Math.max(60, 100 - issuesFound * 5);

    setTimeout(() => {
      onScanComplete({ issuesFound, score, repoName });
    }, 1500);
  }, [onScanComplete]);

  const handleRepoSelect = useCallback(
    (repoName: string) => {
      setSelectedRepo(repoName);
      simulateScan(repoName);
    },
    [simulateScan]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        simulateScan("Uploaded Files");
      }
    },
    [simulateScan]
  );

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        simulateScan("Uploaded Files");
      }
    };
    input.click();
  }, [simulateScan]);

  if (scanPhase === "scanning" || scanPhase === "complete") {
    return (
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 rounded-full border-4 border-zinc-800 relative">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-zinc-800"
              />
              <motion.circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className={scanPhase === "complete" ? "text-green-500" : "text-blue-500"}
                strokeDasharray={276.46}
                initial={{ strokeDashoffset: 276.46 }}
                animate={{
                  strokeDashoffset: 276.46 - (276.46 * progress.progress) / 100,
                }}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {scanPhase === "complete" ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <span className="text-xl font-bold text-zinc-100">
                  {progress.progress}%
                </span>
              )}
            </div>
          </div>
        </motion.div>

        <motion.h3
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-lg font-medium text-zinc-100 mb-1"
        >
          {scanPhase === "complete" ? "Scan Complete!" : progress.phase}
        </motion.h3>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm text-zinc-500 mb-4"
        >
          {scanPhase === "complete"
            ? "Preparing your results..."
            : `${progress.filesScanned} of ${progress.totalFiles} files scanned`}
        </motion.p>

        {progress.currentFile && scanPhase === "scanning" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
          >
            <FileCode className="h-4 w-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">
              {progress.currentFile}
            </span>
          </motion.div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-zinc-100 mb-2">Scan Failed</h3>
        <p className="text-sm text-zinc-500 mb-6">{error}</p>
        <Button
          onClick={() => {
            setError(null);
            setScanPhase("idle");
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Run Your First Scan
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {githubConnected
            ? "Select a repository to scan, or upload files directly."
            : "Upload your code files to start scanning."}
        </p>
      </motion.div>

      {githubConnected && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Your Repositories
          </p>
          <div className="space-y-2 max-h-[140px] overflow-y-auto">
            {["my-awesome-app", "api-service", "frontend-ui"].map((repo) => (
              <button
                key={repo}
                onClick={() => handleRepoSelect(repo)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors text-left"
              >
                <FolderGit2 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-300">{repo}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-500/5"
            : "border-zinc-800 hover:border-zinc-700"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
      >
        <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
        <p className="text-sm text-zinc-400 mb-2">
          Drag & drop your project folder here
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFileSelect}
          className="border-zinc-700"
        >
          Browse Files
        </Button>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between mt-6"
      >
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </motion.div>
    </div>
  );
}
