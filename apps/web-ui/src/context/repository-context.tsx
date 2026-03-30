"use client";

import { logger } from "@/lib/logger";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface SelectedRepo {
  owner: string;
  repo: string;
  fullName: string;
}

interface ScanResults {
  verdict?: string;
  score?: number;
  mockproof?: {
    verdict: string;
    violations: Array<{ file: string; type: string; count?: number; pattern?: string }>;
    scannedFiles: number;
  };
  security?: {
    verdict: string;
    findings: Array<{ file: string; line: number; severity: string; type: string }>;
    summary: { critical: number; high: number; medium: number; low: number; total: number };
    scannedFiles: number;
  };
  reality?: {
    verdict: string;
    issues: Array<{ file?: string; type: string; message: string; count?: number }>;
    scannedFiles: number;
  };
}

interface RepositoryContextType {
  selectedRepo: SelectedRepo | null;
  setSelectedRepo: (repo: SelectedRepo | null) => void;
  scanResults: ScanResults | null;
  setScanResults: (results: ScanResults | null) => void;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

const STORAGE_KEY = "guardrail-selected-repo";

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const [selectedRepo, setSelectedRepoState] = useState<SelectedRepo | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.owner && parsed.repo && parsed.fullName) {
          setSelectedRepoState(parsed);
        }
      }
    } catch (error) {
      logger.debug('Failed to load selected repo from localStorage:', error);
    }
    setIsInitialized(true);
  }, []);

  const setSelectedRepo = useCallback((repo: SelectedRepo | null) => {
    setSelectedRepoState(repo);
    if (repo) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
      } catch (error) {
        logger.debug('Failed to save selected repo to localStorage:', error);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        logger.debug('Failed to remove selected repo from localStorage:', error);
      }
    }
  }, []);

  return (
    <RepositoryContext.Provider
      value={{
        selectedRepo,
        setSelectedRepo,
        scanResults,
        setScanResults,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository() {
  const context = useContext(RepositoryContext);
  if (context === undefined) {
    throw new Error("useRepository must be used within a RepositoryProvider");
  }
  return context;
}
