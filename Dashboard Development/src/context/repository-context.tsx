import React, { createContext, useContext, useState } from "react";

interface SelectedRepo {
  owner: string;
  repo: string;
  fullName: string;
<<<<<<< HEAD
  /** "app" (GitHub App installation) or "oauth" (personal token) */
  source?: "app" | "oauth";
  installationId?: string;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
}

interface ScanResults {
  verdict: "SHIP" | "NO_SHIP" | "WARNING";
  score: number;
<<<<<<< HEAD
  scanId?: string;
  runId?: string;
  findings?: {
    total: number;
    critical: number;
    high: number;
  };
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  mockproof?: {
    scannedFiles: number;
  };
}

interface RepositoryContextValue {
  selectedRepo: SelectedRepo | null;
  setSelectedRepo: (repo: SelectedRepo | null) => void;
  scanResults: ScanResults | null;
  setScanResults: (results: ScanResults | null) => void;
}

const RepositoryContext = createContext<RepositoryContextValue | undefined>(undefined);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const [selectedRepo, setSelectedRepo] = useState<SelectedRepo | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);

  return (
    <RepositoryContext.Provider value={{ selectedRepo, setSelectedRepo, scanResults, setScanResults }}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository() {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error("useRepository must be used within RepositoryProvider");
  }
  return context;
}
