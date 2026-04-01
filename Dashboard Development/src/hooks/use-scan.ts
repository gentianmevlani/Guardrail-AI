import { useState } from "react";

export interface ScanResult {
  verdict: "SHIP" | "NO_SHIP" | "WARNING";
  score: number;
  mockproof?: {
    scannedFiles: number;
  };
  issues?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  coverage?: number;
  vulnerabilities?: number;
}

interface UseScanOptions {
  onComplete?: (result: ScanResult) => void;
  onError?: (error: string) => void;
}

export function useScan(options: UseScanOptions = {}) {
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const startGitHubScan = async (
    owner: string,
    repo: string,
    config: { scanType: "ship" | "security" | "full" }
  ) => {
    setStatus("running");
    setProgress(0);
    setResult(null);

    try {
      // Simulate scanning progress
      const steps = [
        { progress: 10, message: "Cloning repository..." },
        { progress: 25, message: "Analyzing dependencies..." },
        { progress: 45, message: "Running security checks..." },
        { progress: 65, message: "Checking code quality..." },
        { progress: 85, message: "Generating report..." },
        { progress: 100, message: "Scan complete!" },
      ];

      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setProgress(step.progress);
        setMessage(step.message);
      }

      // Generate mock result based on scan type
      const mockResult: ScanResult = {
        verdict: Math.random() > 0.3 ? "SHIP" : "NO_SHIP",
        score: Math.floor(Math.random() * 30) + 70,
        mockproof: {
          scannedFiles: Math.floor(Math.random() * 200) + 50,
        },
        issues: {
          critical: Math.floor(Math.random() * 3),
          high: Math.floor(Math.random() * 8),
          medium: Math.floor(Math.random() * 15),
          low: Math.floor(Math.random() * 25),
        },
        coverage: Math.floor(Math.random() * 30) + 65,
        vulnerabilities: Math.floor(Math.random() * 12),
      };

      setResult(mockResult);
      setStatus("complete");
      options.onComplete?.(mockResult);
    } catch (error) {
      setStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Scan failed";
      options.onError?.(errorMessage);
    }
  };

  const reset = () => {
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setResult(null);
  };

  return {
    status,
    progress,
    message,
    result,
    startGitHubScan,
    reset,
  };
}
