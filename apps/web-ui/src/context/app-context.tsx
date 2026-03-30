"use client";

import { logger } from "@/lib/logger";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Repository {
  id: string;
  name: string;
  active: boolean;
  status: "Secure" | "Warning" | "Critical";
  lastScan: string;
}

interface AppContextType {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string; name: string; avatar?: string } | null;

  // GitHub connection
  githubConnected: boolean;
  connectGithub: () => Promise<void>;
  disconnectGithub: () => Promise<void>;

  // Repositories
  repositories: Repository[];
  toggleRepository: (id: string) => void;
  refreshRepositories: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AppContextType["user"]>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`);
        if (res.ok) {
          const data = await res.json();
          if (data.user || data.data) {
            setIsAuthenticated(true);
            setUser(data.user || data.data);
            // Check real GitHub connection status
            await checkGithubStatus();
          }
        }
      } catch (error) {
        logger.debug("Auth check failed, user not logged in");
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load repositories when GitHub is connected
  useEffect(() => {
    if (githubConnected) {
      refreshRepositories();
    } else {
      setRepositories([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubConnected]);

  const checkGithubStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/github/status`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setGithubConnected(true);
          // Map GitHub repositories to our format
          if (data.repositories) {
            const mappedRepos: Repository[] = data.repositories.map(
              (repo: {
                id: string;
                name: string;
                fullName?: string;
                private?: boolean;
                defaultBranch?: string;
                language?: string | null;
                lastScan?: string;
              }) => ({
                id: repo.id,
                name: repo.name,
                active: true,
                status: "Secure" as const,
                lastScan: repo.lastScan || "Never",
              }),
            );
            setRepositories(mappedRepos);
          }
        } else {
          setGithubConnected(false);
          setRepositories([]);
        }
      }
    } catch (error) {
      logger.debug("Failed to check GitHub status", error);
      setGithubConnected(false);
      setRepositories([]);
    }
  }, []);

  const refreshRepositories = useCallback(async () => {
    // Refresh GitHub status and repositories
    await checkGithubStatus();
  }, [checkGithubStatus]);

  const connectGithub = async () => {
    try {
      // Initiate GitHub OAuth flow
      const res = await fetch(`${API_BASE}/api/auth/github/connect`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          // Redirect to GitHub OAuth
          window.location.href = data.redirectUrl;
          return;
        }
      }

      throw new Error("Failed to initiate GitHub OAuth");
    } catch (error) {
      logger.error("GitHub connection failed", error);
      // Show error to user
      alert("Failed to connect to GitHub. Please try again.");
    }
  };

  const disconnectGithub = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/github/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      // After successful disconnect, update state
      setGithubConnected(false);
      setRepositories([]);
    } catch (error) {
      logger.debug("GitHub disconnect API call failed", error);
      // Still update state even if API fails
      setGithubConnected(false);
      setRepositories([]);
    }
  };

  const toggleRepository = (id: string) => {
    setRepositories((prev) =>
      prev.map((repo) =>
        repo.id === id || repo.name === id
          ? { ...repo, active: !repo.active }
          : repo,
      ),
    );
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        githubConnected,
        connectGithub,
        disconnectGithub,
        repositories,
        toggleRepository,
        refreshRepositories,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

// Backwards compatibility alias
export const useMock = useApp;
export const MockProvider = AppProvider;
