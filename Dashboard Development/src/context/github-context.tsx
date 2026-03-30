import React, { createContext, useContext, useState } from "react";

interface Repository {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  stars: number;
  language: string;
}

interface GitHubContextValue {
  connected: boolean;
  repositories: Repository[];
  connect: () => Promise<void>;
  loading: boolean;
}

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [repositories] = useState<Repository[]>([
    { id: "1", fullName: "acme/frontend", name: "frontend", owner: "acme", stars: 245, language: "TypeScript" },
    { id: "2", fullName: "acme/backend", name: "backend", owner: "acme", stars: 189, language: "Python" },
    { id: "3", fullName: "acme/mobile-app", name: "mobile-app", owner: "acme", stars: 312, language: "React Native" },
    { id: "4", fullName: "acme/api-gateway", name: "api-gateway", owner: "acme", stars: 98, language: "Go" },
  ]);

  const connect = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setConnected(true);
    setLoading(false);
  };

  return (
    <GitHubContext.Provider value={{ connected, repositories, connect, loading }}>
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  const context = useContext(GitHubContext);
  if (!context) {
    throw new Error("useGitHub must be used within GitHubProvider");
  }
  return context;
}
