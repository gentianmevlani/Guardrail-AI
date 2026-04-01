"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    LocalScanResult,
    ScanProgress,
    ScanSummary,
    WorkerMessage,
    WorkerResponse
} from './types';

export interface UseScannerWorkerReturn {
  isScanning: boolean;
  progress: ScanProgress | null;
  results: LocalScanResult[];
  summary: ScanSummary | null;
  error: string | null;
  startScan: (files: { name: string; content: string; relativePath: string }[]) => void;
  cancelScan: () => void;
  reset: () => void;
}

export function useScannerWorker(): UseScannerWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<LocalScanResult[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const startScan = useCallback((files: { name: string; content: string; relativePath: string }[]) => {
    setIsScanning(true);
    setProgress({ 
      phase: 'parsing', 
      currentFile: '', 
      filesProcessed: 0, 
      totalFiles: files.length,
      issuesFound: 0,
      percentage: 0 
    });
    setResults([]);
    setSummary(null);
    setError(null);

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    try {
      workerRef.current = new Worker(
        new URL('../../workers/scanner.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, progress: prog, result, summary: sum, error: err } = event.data;

        switch (type) {
          case 'progress':
            if (prog) setProgress(prog);
            break;
          case 'result':
            if (result) {
              setResults(prev => [...prev, result]);
            }
            break;
          case 'complete':
            if (sum) setSummary(sum);
            if (prog) setProgress(prog);
            setIsScanning(false);
            break;
          case 'error':
            setError(err || 'Unknown error occurred');
            setIsScanning(false);
            break;
        }
      };

      workerRef.current.onerror = (e) => {
        setError(`Worker error: ${e.message}`);
        setIsScanning(false);
      };

      const message: WorkerMessage = { type: 'scan', files };
      workerRef.current.postMessage(message);
    } catch (e) {
      setError(`Failed to start scanner: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setIsScanning(false);
    }
  }, []);

  const cancelScan = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' } as WorkerMessage);
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsScanning(false);
    setProgress(prev => prev ? { ...prev, phase: 'complete' } : null);
  }, []);

  const reset = useCallback(() => {
    cancelScan();
    setProgress(null);
    setResults([]);
    setSummary(null);
    setError(null);
  }, [cancelScan]);

  return {
    isScanning,
    progress,
    results,
    summary,
    error,
    startScan,
    cancelScan,
    reset
  };
}
