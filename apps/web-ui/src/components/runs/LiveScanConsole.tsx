"use client";

/**
 * Live Scan Console Component
 * 
 * Displays real-time scan progress with:
 * - Live log streaming
 * - Progress bar with percentage
 * - Findings count as they're discovered
 * - Auto-scroll with manual override
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Terminal,
  Pause,
  Play,
  Download,
  ChevronDown,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunStatus } from "@/hooks/useRealtimeScan";

interface LiveScanConsoleProps {
  runId: string;
  status: RunStatus | null;
  progress: number;
  logs: string[];
  findingsCount: number;
  isConnected: boolean;
  error: string | null;
  onClose?: () => void;
}

export function LiveScanConsole({
  runId,
  status,
  progress,
  logs,
  findingsCount,
  isConnected,
  error,
  onClose,
}: LiveScanConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Filtered logs for display
  const displayLogs = isPaused ? logs.slice(0, -10) : logs;

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && consoleRef.current && !isPaused) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!consoleRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
  }, []);

  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  const downloadLogs = () => {
    const content = logs.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guardrail-scan-${runId}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    switch (status) {
      case "queued":
        return <Clock className="w-4 h-4 text-zinc-400" />;
      case "running":
        return <Zap className="w-4 h-4 text-blue-400 animate-pulse" />;
      case "complete":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "error":
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Terminal className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getStatusBadge = () => {
    const colors: Record<string, string> = {
      queued: "bg-zinc-500/20 text-zinc-400",
      running: "bg-blue-500/20 text-blue-400",
      complete: "bg-emerald-500/20 text-emerald-400",
      error: "bg-red-500/20 text-red-400",
      cancelled: "bg-orange-500/20 text-orange-400",
    };

    return (
      <Badge className={colors[status || "queued"] || colors.queued}>
        {status?.toUpperCase() || "UNKNOWN"}
      </Badge>
    );
  };

  const colorizeLog = (line: string): React.ReactNode => {
    // Colorize log lines based on content
    if (line.includes("[ERROR]") || line.includes("ERROR:")) {
      return <span className="text-red-400">{line}</span>;
    }
    if (line.includes("[WARN]") || line.includes("WARNING:")) {
      return <span className="text-yellow-400">{line}</span>;
    }
    if (line.includes("[INFO]") || line.includes("INFO:")) {
      return <span className="text-blue-400">{line}</span>;
    }
    if (line.includes("[SUCCESS]") || line.includes("✓") || line.includes("PASS")) {
      return <span className="text-emerald-400">{line}</span>;
    }
    if (line.includes("[FINDING]") || line.includes("CRITICAL") || line.includes("HIGH")) {
      return <span className="text-orange-400">{line}</span>;
    }
    if (line.startsWith(">>>") || line.startsWith("---")) {
      return <span className="text-zinc-500">{line}</span>;
    }
    return line;
  };

  return (
    <Card className="bg-black/60 border-zinc-800 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <CardTitle className="text-white text-lg">Live Scan Console</CardTitle>
            {getStatusBadge()}
            {isConnected && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-zinc-500">Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {findingsCount > 0 && (
              <Badge variant="outline" className="text-orange-400 border-orange-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {findingsCount} finding{findingsCount !== 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPaused(!isPaused)}
              className="text-zinc-400 hover:text-white"
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={downloadLogs}
              className="text-zinc-400 hover:text-white"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {status === "running" && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Scanning...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </CardHeader>

      <CardContent className="relative">
        {/* Console output */}
        <div
          ref={consoleRef}
          onScroll={handleScroll}
          className={cn(
            "bg-zinc-950 rounded-lg p-4 font-mono text-xs overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
            "max-h-[400px] min-h-[200px]"
          )}
        >
          {logs.length === 0 ? (
            <div className="text-zinc-500 italic">
              {status === "queued" 
                ? "Waiting for scan to start..."
                : "No logs yet..."}
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayLogs.map((line, i) => (
                <div key={i} className="text-zinc-300 whitespace-pre-wrap break-all">
                  {colorizeLog(line)}
                </div>
              ))}
            </div>
          )}

          {isPaused && (
            <div className="mt-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-center">
              Output paused - Click play to resume
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            size="sm"
            onClick={scrollToBottom}
            className="absolute bottom-8 right-8 bg-blue-600 hover:bg-blue-700 shadow-lg"
          >
            <ArrowDown className="w-4 h-4 mr-1" />
            Scroll to bottom
          </Button>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Completion message */}
        {status === "complete" && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">Scan Complete</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Found {findingsCount} issue{findingsCount !== 1 ? "s" : ""}. 
              View the findings tab for details.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveScanConsole;
