"use client";

/**
 * Hook for realtime scan/run progress updates via WebSocket
 * 
 * Features:
 * - Automatic subscription/unsubscription
 * - Reconnection on page reload
 * - Event batching for performance
 * - Type-safe event handling
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type RunStatus = "queued" | "running" | "complete" | "error" | "cancelled";

export interface RealtimeScanEvent {
  type: "run.status" | "run.progress" | "run.log" | "run.finding" | "subscribed" | "unsubscribed";
  runId: string;
  scanId?: string;
  userId: string;
  timestamp: string;
  data: {
    status?: RunStatus;
    progress?: number; // 0-100
    log?: string | string[]; // Single line or batched lines
    finding?: {
      id: string;
      type: string;
      severity: string;
      file: string;
      line: number;
      message: string;
    };
    findingsCount?: number;
    error?: string;
  };
}

export interface UseRealtimeScanOptions {
  runId: string;
  scanId?: string;
  enabled?: boolean;
  onStatusChange?: (status: RunStatus, error?: string) => void;
  onProgress?: (progress: number) => void;
  onLog?: (logs: string[]) => void;
  onFinding?: (finding: RealtimeScanEvent["data"]["finding"], count: number) => void;
}

export interface UseRealtimeScanReturn {
  status: RunStatus | null;
  progress: number;
  logs: string[];
  findingsCount: number;
  isConnected: boolean;
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRealtimeScan(
  options: UseRealtimeScanOptions,
): UseRealtimeScanReturn {
  const {
    runId,
    scanId,
    enabled = true,
    onStatusChange,
    onProgress,
    onLog,
    onFinding,
  } = options;

  const [status, setStatus] = useState<RunStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [findingsCount, setFindingsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const logsRef = useRef<string[]>([]);
  const maxLogs = 1000; // Keep last 1000 log lines

  // Get auth token from localStorage or cookies
  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    
    // Try localStorage first
    const token = localStorage.getItem("auth_token") || 
                  localStorage.getItem("token") ||
                  sessionStorage.getItem("auth_token");
    
    if (token) return token;

    // Try to extract from cookies
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "auth_token" || name === "token") {
        return decodeURIComponent(value);
      }
    }

    return null;
  }, []);

  // WebSocket connection
  const { status: wsStatus, sendMessage, connect, disconnect } = useWebSocket({
    token: getAuthToken() || undefined,
    autoConnect: enabled,
    reconnect: true,
    onMessage: useCallback((message: any) => {
      // Handle subscription confirmations (new format with roomId)
      if (message.type === "subscribed") {
        const msgRunId = message.runId || message.data?.runId;
        if (msgRunId === runId) {
          setIsSubscribed(true);
          logger.debug("Subscribed to run", { runId, roomId: message.roomId });
          return;
        }
      }

      if (message.type === "unsubscribed") {
        const msgRunId = message.runId || message.data?.runId;
        if (msgRunId === runId) {
          setIsSubscribed(false);
          logger.debug("Unsubscribed from run", { runId });
          return;
        }
      }

      // Handle realtime events
      const event = message as RealtimeScanEvent;
      const eventRunId = (event as any).runId || (event as any).data?.runId;
      const eventScanId = (event as any).scanId || (event as any).data?.scanId;
      if (eventRunId !== runId && eventScanId !== scanId) {
        return; // Not for this run/scan
      }

      switch (event.type) {
        case "run.status":
          if (event.data.status) {
            setStatus(event.data.status);
            setError(event.data.error || null);
            onStatusChange?.(event.data.status, event.data.error);
            
            // Clear logs on completion/error
            if (event.data.status === "complete" || event.data.status === "error") {
              setIsSubscribed(false);
            }
          }
          break;

        case "run.progress":
          if (event.data.progress !== undefined) {
            setProgress(event.data.progress);
            onProgress?.(event.data.progress);
          }
          break;

        case "run.log":
          if (event.data.log) {
            const newLogs = Array.isArray(event.data.log) 
              ? event.data.log 
              : [event.data.log];
            
            // Append to logs
            logsRef.current = [...logsRef.current, ...newLogs];
            
            // Trim to maxLogs
            if (logsRef.current.length > maxLogs) {
              logsRef.current = logsRef.current.slice(-maxLogs);
            }
            
            setLogs([...logsRef.current]);
            onLog?.(newLogs);
          }
          break;

        case "run.finding":
          if (event.data.finding && event.data.findingsCount !== undefined) {
            setFindingsCount(event.data.findingsCount);
            onFinding?.(event.data.finding, event.data.findingsCount);
          }
          break;
      }
    }, [runId, scanId, onStatusChange, onProgress, onLog, onFinding]),
  });

  const subscribe = useCallback(() => {
    if (wsStatus === "connected" && !isSubscribed) {
      sendMessage({
        type: "subscribe",
        runId, // New format: runId at top level
        scanId,
      });
    }
  }, [wsStatus, isSubscribed, runId, scanId, sendMessage]);

  const unsubscribe = useCallback(() => {
    if (wsStatus === "connected" && isSubscribed) {
      sendMessage({
        type: "unsubscribe",
        runId, // New format: runId at top level
        scanId,
      });
    }
  }, [wsStatus, isSubscribed, runId, scanId, sendMessage]);

  // Auto-subscribe when connected
  useEffect(() => {
    if (enabled && wsStatus === "connected" && !isSubscribed) {
      // Small delay to ensure connection is ready
      const timer = setTimeout(() => {
        subscribe();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enabled, wsStatus, isSubscribed, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribe();
      }
    };
  }, [isSubscribed, unsubscribe]);

  // Re-subscribe on page reload if run is still active
  useEffect(() => {
    if (enabled && wsStatus === "connected" && (status === "queued" || status === "running")) {
      subscribe();
    }
  }, [enabled, wsStatus, status, subscribe]);

  const isConnected = wsStatus === "connected" && isSubscribed;

  return {
    status,
    progress,
    logs,
    findingsCount,
    isConnected,
    error,
    subscribe,
    unsubscribe,
  };
}

export default useRealtimeScan;
