"use client";

import { logger } from "@/lib/logger";
import { useState, useCallback, useEffect, useRef } from "react";
import { useWebSocket, type WebSocketMessage } from "./useWebSocket";
import { useDashboardContext } from "@/context/dashboard-context";

export type ScanStatus =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "failed";

export interface MockProofViolation {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface SecurityFinding {
  id: string;
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  file: string;
  line: number;
  fixable: boolean;
}

export interface RealityIssue {
  id: string;
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ScanResult {
  scanId: string;
  verdict?: "SHIP" | "NO_SHIP" | "REVIEW";
  score?: number;
  mockproof?: {
    verdict: string;
    violations: MockProofViolation[];
    scannedFiles: number;
  };
  security?: {
    verdict: string;
    findings: SecurityFinding[];
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
  };
  reality?: {
    verdict: string;
    issues: RealityIssue[];
    scannedFiles: number;
  };
  checks?: Array<{
    id: string;
    name: string;
    status: "pass" | "fail" | "warning";
    message: string;
  }>;
  error?: string;
}

export interface UseScanOptions {
  onStart?: (scanId: string) => void;
  onProgress?: (progress: number, message: string) => void;
  onComplete?: (result: ScanResult) => void;
  onError?: (error: string) => void;
}

interface UseScanReturn {
  status: ScanStatus;
  progress: number;
  message: string;
  result: ScanResult | null;
  scanId: string | null;
  startScan: (options?: {
    projectPath?: string;
    scanType?: string;
  }) => Promise<string | null>;
  startGitHubScan: (
    owner: string,
    repo: string,
    options?: { branch?: string; scanType?: string },
  ) => Promise<ScanResult | null>;
  reset: () => void;
}

const API_BASE =
  typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL || "" : "";

export function useScan(options: UseScanOptions = {}): UseScanReturn {
  const { onStart, onProgress, onComplete, onError } = options;

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const { refreshFindings, refreshSummary } = useDashboardContext();

  // Type for WebSocket scan message data
  interface ScanMessageData {
    scanId?: string;
    progress?: number;
    status?: string;
    result?: Partial<ScanResult>;
  }

  // Handle WebSocket messages for scan updates
  const handleWebSocketMessage = useCallback(
    (wsMessage: WebSocketMessage) => {
      if (!mountedRef.current) return;
      const data = wsMessage.data as ScanMessageData | undefined;

      switch (wsMessage.type) {
        case "scan-started":
          if (data?.scanId === scanId) {
            setStatus("running");
            setProgress(10);
            setMessage("Scan started...");
          }
          break;

        case "scan-progress":
          if (data?.scanId === scanId) {
            setProgress(data.progress || 50);
            setMessage(data.status || "Scanning...");
            onProgress?.(
              data.progress || 50,
              data.status || "Scanning...",
            );
          }
          break;

        case "scan-complete":
          if (data?.scanId === scanId) {
            setStatus("completed");
            setProgress(100);
            setMessage("Scan completed");
            const scanResult: ScanResult = {
              scanId: data.scanId || "",
              ...(data.result || {}),
            };
            setResult(scanResult);
            onComplete?.(scanResult);
            // Refresh dashboard data
            refreshFindings();
            refreshSummary();
          }
          break;

        case "findings-update":
          // Refresh findings when new vulnerabilities are detected
          refreshFindings();
          break;

        default:
          break;
      }
    },
    [scanId, onProgress, onComplete, refreshFindings, refreshSummary],
  );

  // Connect to WebSocket for real-time updates
  useWebSocket({
    autoConnect: status === "running",
    onMessage: handleWebSocketMessage,
  });

  // Start a local/API scan
  const startScan = useCallback(
    async (scanOptions?: {
      projectPath?: string;
      scanType?: string;
    }): Promise<string | null> => {
      if (status === "running") {
        logger.debug('Scan already in progress');
        return null;
      }

      setStatus("starting");
      setProgress(5);
      setMessage("Initializing scan...");
      setResult(null);

      try {
        const response = await fetch(`${API_BASE}/api/findings/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectPath: scanOptions?.projectPath || ".",
            scanType: scanOptions?.scanType || "quick",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Scan failed with status ${response.status}`,
          );
        }

        const data = await response.json();

        if (data.success && data.data?.scanId) {
          setScanId(data.data.scanId);
          setStatus("running");
          setProgress(15);
          setMessage(data.data.message || "Scan in progress...");
          onStart?.(data.data.scanId);
          return data.data.scanId;
        } else {
          throw new Error(data.error || "Failed to start scan");
        }
      } catch (err: unknown) {
        const error = err as Error;
        setStatus("failed");
        setMessage(error.message || "Scan failed");
        onError?.(error.message || "Scan failed");
        return null;
      }
    },
    [status, onStart, onError],
  );

  // Start a GitHub repository scan
  const startGitHubScan = useCallback(
    async (
      owner: string,
      repo: string,
      scanOptions?: { branch?: string; scanType?: string },
    ): Promise<ScanResult | null> => {
      if (status === "running") {
        logger.debug('Scan already in progress');
        return null;
      }

      setStatus("starting");
      setProgress(5);
      setMessage(`Fetching repository ${owner}/${repo}...`);
      setResult(null);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/github/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            owner,
            repo,
            branch: scanOptions?.branch || "main",
            scanType: scanOptions?.scanType || "full",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.connected === false) {
            throw new Error(
              "GitHub not connected. Please connect your GitHub account first.",
            );
          }
          throw new Error(
            errorData.error || `Scan failed with status ${response.status}`,
          );
        }

        setProgress(30);
        setMessage("Analyzing repository...");

        const data = await response.json();

        if (data.success) {
          setProgress(100);
          setStatus("completed");
          setMessage("Scan completed");

          const scanResult: ScanResult = {
            scanId: `github-${owner}-${repo}-${Date.now()}`,
            verdict: data.verdict,
            score: data.score,
            mockproof: data.mockproof,
            security: data.security,
            reality: data.reality,
            checks: data.checks,
          };

          setResult(scanResult);
          setScanId(scanResult.scanId);
          onComplete?.(scanResult);

          // Refresh dashboard data
          refreshFindings();
          refreshSummary();

          return scanResult;
        } else {
          throw new Error(data.error || "GitHub scan failed");
        }
      } catch (err: unknown) {
        const error = err as Error;
        setStatus("failed");
        setMessage(error.message || "GitHub scan failed");
        onError?.(error.message || "GitHub scan failed");
        return null;
      }
    },
    [status, onComplete, onError, refreshFindings, refreshSummary],
  );

  // Reset scan state
  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setResult(null);
    setScanId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    status,
    progress,
    message,
    result,
    scanId,
    startScan,
    startGitHubScan,
    reset,
  };
}

export default useScan;
