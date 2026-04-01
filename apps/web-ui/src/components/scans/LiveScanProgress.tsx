"use client";

/**
 * Live Scan Progress Component
 * 
 * Displays real-time progress for a running scan/run:
 * - Status indicator (queued/running/complete/error)
 * - Progress bar (0-100%)
 * - Live log stream
 * - Findings count
 */

import React, { useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Terminal,
  AlertCircle,
} from "lucide-react";
import { useRealtimeScan } from "@/hooks/useRealtimeScan";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface LiveScanProgressProps {
  runId: string;
  scanId?: string;
  className?: string;
  showLogs?: boolean;
  maxLogLines?: number;
  onComplete?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LiveScanProgress({
  runId,
  scanId,
  className,
  showLogs = true,
  maxLogLines = 100,
  onComplete,
}: LiveScanProgressProps) {
  const {
    status,
    progress,
    logs,
    findingsCount,
    isConnected,
    error,
  } = useRealtimeScan({
    runId,
    scanId,
    enabled: true,
    onStatusChange: (newStatus) => {
      if (newStatus === "complete" || newStatus === "error") {
        onComplete?.();
      }
    },
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case "queued":
        return {
          icon: Clock,
          color: "text-gray-500",
          bgColor: "bg-gray-100",
          label: "Queued",
        };
      case "running":
        return {
          icon: Loader2,
          color: "text-blue-500",
          bgColor: "bg-blue-100",
          label: "Running",
        };
      case "complete":
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bgColor: "bg-green-100",
          label: "Complete",
        };
      case "error":
        return {
          icon: XCircle,
          color: "text-red-500",
          bgColor: "bg-red-100",
          label: "Error",
        };
      case "cancelled":
        return {
          icon: XCircle,
          color: "text-gray-500",
          bgColor: "bg-gray-100",
          label: "Cancelled",
        };
      default:
        return {
          icon: Clock,
          color: "text-gray-400",
          bgColor: "bg-gray-50",
          label: "Unknown",
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;
  const displayLogs = logs.slice(-maxLogLines);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              statusDisplay.bgColor,
            )}
          >
            <StatusIcon
              className={cn(
                "w-5 h-5",
                statusDisplay.color,
                status === "running" && "animate-spin",
              )}
            />
          </div>
          <div>
            <div className="font-medium text-sm text-gray-900">
              {statusDisplay.label}
            </div>
            <div className="text-xs text-gray-500">
              {isConnected ? "Live updates" : "Connecting..."}
            </div>
          </div>
        </div>

        {findingsCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 rounded-full">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">
              {findingsCount} {findingsCount === 1 ? "finding" : "findings"}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {status === "running" || status === "queued" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : status === "complete" ? (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Scan completed successfully</span>
        </div>
      ) : status === "error" ? (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="w-4 h-4" />
          <span>{error || "Scan failed"}</span>
        </div>
      ) : null}

      {/* Live Logs */}
      {showLogs && displayLogs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <Terminal className="w-4 h-4" />
            <span>Live Logs</span>
            {!isConnected && (
              <span className="text-yellow-600">(Reconnecting...)</span>
            )}
          </div>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 max-h-64 overflow-y-auto">
            {displayLogs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{" "}
                <span>{log}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && status !== "complete" && status !== "error" && (
        <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Connecting to realtime updates...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Get current step description based on progress
 */
function getCurrentStep(progress: number): string {
  if (progress < 10) return "Initializing scan environment...";
  if (progress < 20) return "Scanning security patterns...";
  if (progress < 35) return "Checking for mock data and placeholders...";
  if (progress < 50) return "Validating API endpoints...";
  if (progress < 65) return "Analyzing code structure...";
  if (progress < 80) return "Detecting potential issues...";
  if (progress < 90) return "Processing findings...";
  if (progress < 95) return "Generating report...";
  return "Scan completed!";
}

export default LiveScanProgress;
