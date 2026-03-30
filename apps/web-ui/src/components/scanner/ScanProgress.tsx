"use client";

import { Progress } from "@/components/ui/progress";
import type { ScanProgress as ScanProgressType } from "@/lib/scanner/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, Shield } from "lucide-react";

interface ScanProgressProps {
  progress: ScanProgressType;
  className?: string;
}

export function ScanProgress({ progress, className }: ScanProgressProps) {
  const { phase, currentFile, filesProcessed, totalFiles, issuesFound, percentage } = progress;

  const phaseConfig = {
    validating: {
      icon: FileSearch,
      label: "Validating files...",
      color: "text-blue-400",
    },
    parsing: {
      icon: Loader2,
      label: "Parsing files...",
      color: "text-cyan-400",
    },
    scanning: {
      icon: Shield,
      label: "Scanning for issues...",
      color: "text-cyan-400",
    },
    complete: {
      icon: CheckCircle2,
      label: "Scan complete",
      color: "text-green-400",
    },
    error: {
      icon: AlertTriangle,
      label: "Scan failed",
      color: "text-red-400",
    },
  };

  const config = phaseConfig[phase];
  const Icon = config.icon;
  const isAnimating = phase === "parsing" || phase === "scanning";

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col items-center justify-center py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <motion.div
            animate={isAnimating ? { rotate: 360 } : {}}
            transition={isAnimating ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
            className="relative"
          >
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-slate-800 to-slate-900",
              "border-2",
              phase === "complete" ? "border-green-500/50" : 
              phase === "error" ? "border-red-500/50" : "border-cyan-500/50"
            )}>
              <Icon className={cn("w-10 h-10", config.color, isAnimating && "animate-pulse")} />
            </div>
          </motion.div>

          {isAnimating && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mt-4 text-lg font-semibold", config.color)}
        >
          {config.label}
        </motion.h3>

        {currentFile && phase !== "complete" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-sm text-slate-400 max-w-md truncate text-center"
          >
            {currentFile}
          </motion.p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300 font-medium">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{filesProcessed}</div>
          <div className="text-xs text-slate-400 mt-1">Files Scanned</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{totalFiles}</div>
          <div className="text-xs text-slate-400 mt-1">Total Files</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
          <div className={cn(
            "text-2xl font-bold",
            issuesFound > 0 ? "text-amber-400" : "text-green-400"
          )}>
            {issuesFound}
          </div>
          <div className="text-xs text-slate-400 mt-1">Issues Found</div>
        </div>
      </div>

      {isAnimating && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-cyan-400"
          />
          <span>Scanning runs entirely in your browser - no data leaves your device</span>
        </div>
      )}
    </div>
  );
}
