"use client";

import { logger } from "@/lib/logger";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  getGitHubStatus,
  syncGitHubRepos,
  disconnectGitHub,
  connectGitHub,
  type GitHubRepository,
  type GitHubStatus,
  resilientFetch,
} from "@/lib/api";

interface GitHubUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

interface GitHubContextType {
  // Connection state
  connected: boolean;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  
  // User and repos
  user: GitHubUser | null;
  repositories: GitHubRepository[];
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<boolean>;
  sync: () => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
  
  // Helpers
  getRepoByName: (fullName: string) => GitHubRepository | undefined;
  getRepoById: (id: string) => GitHubRepository | undefined;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);

  // Load GitHub status on mount
  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const status = await getGitHubStatus();
      setConnected(status.connected);
      
      if (status.connected) {
        if (status.username) {
          setUser({ login: status.username });
        }
        if (status.repositories) {
          setRepositories(status.repositories);
        }
      } else {
        setUser(null);
        setRepositories([]);
      }
    } catch (err: unknown) {
      logger.error('Failed to load GitHub status:', err);
      setError("Failed to check GitHub connection");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Connect to GitHub
  const connect = useCallback(async () => {
    setError(null);
    try {
      const result = await connectGitHub();
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError("Failed to initiate GitHub connection");
    }
  }, []);

  // Disconnect from GitHub
  const disconnect = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const result = await disconnectGitHub();
      if (result.success) {
        setConnected(false);
        setUser(null);
        setRepositories([]);
        return true;
      } else {
        setError(result.error || "Failed to disconnect");
        return false;
      }
    } catch (err: unknown) {
      setError("Failed to disconnect GitHub");
      return false;
    }
  }, []);

  // Sync repositories
  const sync = useCallback(async (): Promise<boolean> => {
    setSyncing(true);
    setError(null);
    
    try {
      const result = await syncGitHubRepos();
      if (result.success && result.repositories) {
        setRepositories(result.repositories);
        return true;
      } else {
        setError(result.error || "Failed to sync repositories");
        return false;
      }
    } catch (err: unknown) {
      setError("Failed to sync repositories");
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  // Refresh status
  const refresh = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Helper: get repo by full name
  const getRepoByName = useCallback(
    (fullName: string) => {
      return repositories.find((r) => r.fullName === fullName);
    },
    [repositories]
  );

  // Helper: get repo by ID
  const getRepoById = useCallback(
    (id: string) => {
      return repositories.find((r) => r.id === id);
    },
    [repositories]
  );

  const value: GitHubContextType = {
    connected,
    loading,
    syncing,
    error,
    user,
    repositories,
    connect,
    disconnect,
    sync,
    refresh,
    clearError,
    getRepoByName,
    getRepoById,
  };

  return (
    <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>
  );
}

export function useGitHub() {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error("useGitHub must be used within a GitHubProvider");
  }
  return context;
}

export default GitHubContext;
