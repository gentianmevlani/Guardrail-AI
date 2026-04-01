<<<<<<< HEAD
/**
 * GitHub Context — Native GitHub App integration.
 *
 * Uses the Guardrail GitHub App for zero-config repo access:
 * - Install the GitHub App on your org/account (one click)
 * - Repos are automatically synced — no tokens to manage
 * - Scans use installation tokens (no personal access tokens)
 * - PR checks and commit annotations are handled natively
 *
 * Falls back to OAuth for users who haven't installed the app yet.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// ── Types ──

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  language: string | null;
  url?: string;
  defaultBranch?: string;
  /** Where this repo came from: "app" (GitHub App) or "oauth" (personal token) */
  source: "app" | "oauth";
  /** GitHub App installation ID (when source is "app") */
  installationId?: string;
  /** Account/org login that owns the installation */
  accountLogin?: string;
  /** Last scan timestamp */
  lastScanAt?: string | null;
}

export interface GitHubInstallation {
  installationId: string;
  accountLogin: string;
  accountType: string;
  repoCount: number;
}

export interface GitHubConnectionState {
  /** GitHub App is installed on at least one account */
  appInstalled: boolean;
  /** OAuth token is connected */
  oauthConnected: boolean;
  oauthUsername: string | null;
  installations: GitHubInstallation[];
  /** URL to install the GitHub App */
  installUrl: string;
}

interface ScanResult {
  scanId: string;
  runId: string;
  repo: string;
  branch: string;
  status: string;
  findings: {
    total: number;
    critical: number;
    high: number;
  };
}

interface GitHubContextValue {
  /** Overall connected state (app or oauth) */
  connected: boolean;
  /** Detailed connection state */
  connection: GitHubConnectionState;
  /** All repositories from both app and oauth */
  repositories: GitHubRepository[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Install the GitHub App (redirects to GitHub) */
  installApp: () => void;
  /** Connect via OAuth (legacy, redirects to GitHub) */
  connectOAuth: () => Promise<void>;
  /** Disconnect OAuth */
  disconnectOAuth: () => Promise<void>;
  /** Refresh repository list */
  syncRepos: () => Promise<void>;
  /** Trigger a scan on a repository */
  scanRepo: (repo: string, branch?: string) => Promise<ScanResult | null>;
  /** Currently scanning repo */
  scanningRepo: string | null;
=======
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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
}

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

<<<<<<< HEAD
// ── API helpers ──

const API_BASE = import.meta.env.VITE_API_URL || "https://api.guardrailai.dev";

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── Provider ──

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<GitHubConnectionState>({
    appInstalled: false,
    oauthConnected: false,
    oauthUsername: null,
    installations: [],
    installUrl: `https://github.com/apps/guardrail-app/installations/new`,
  });
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningRepo, setScanningRepo] = useState<string | null>(null);

  const connected = connection.appInstalled || connection.oauthConnected;

  // Fetch connection status on mount
  const fetchConnectionStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch<{
        success: boolean;
        data: {
          oauth: { connected: boolean; username: string | null };
          app: {
            installed: boolean;
            installations: GitHubInstallation[];
          };
          repositories: GitHubRepository[];
          installUrl: string;
        };
      }>("/api/github/app/connection");

      if (res.success && res.data) {
        setConnection({
          appInstalled: res.data.app.installed,
          oauthConnected: res.data.oauth.connected,
          oauthUsername: res.data.oauth.username,
          installations: res.data.app.installations,
          installUrl: res.data.installUrl,
        });
        setRepositories(res.data.repositories);
      }
    } catch (err) {
      console.warn("Failed to fetch GitHub connection:", err);
      // Don't set error for initial load — user may not be logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionStatus();

    // Check URL params for post-install callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_app_installed") === "true") {
      // Refresh after app installation
      setTimeout(fetchConnectionStatus, 500);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("github_app_installed");
      url.searchParams.delete("installation_id");
      window.history.replaceState({}, "", url.toString());
    }
    if (params.get("github_connected") === "true") {
      setTimeout(fetchConnectionStatus, 500);
      const url = new URL(window.location.href);
      url.searchParams.delete("github_connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchConnectionStatus]);

  // Install GitHub App — redirect to GitHub
  const installApp = useCallback(() => {
    window.location.href = `${API_BASE}/api/github/app/install`;
  }, []);

  // OAuth connect — redirect to GitHub
  const connectOAuth = useCallback(async () => {
    try {
      const res = await apiFetch<{ redirectUrl: string }>("/api/github/connect", {
        method: "POST",
      });
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      }
    } catch (err) {
      setError("Failed to initiate GitHub connection");
    }
  }, []);

  // OAuth disconnect
  const disconnectOAuth = useCallback(async () => {
    try {
      await apiFetch("/api/github/disconnect", { method: "POST" });
      await fetchConnectionStatus();
    } catch (err) {
      setError("Failed to disconnect GitHub");
    }
  }, [fetchConnectionStatus]);

  // Sync repos
  const syncRepos = useCallback(async () => {
    try {
      setLoading(true);
      if (connection.oauthConnected) {
        await apiFetch("/api/github/sync", { method: "POST" });
      }
      await fetchConnectionStatus();
    } catch (err) {
      setError("Failed to sync repositories");
    } finally {
      setLoading(false);
    }
  }, [connection.oauthConnected, fetchConnectionStatus]);

  // Scan a repo
  const scanRepo = useCallback(async (repo: string, branch?: string): Promise<ScanResult | null> => {
    try {
      setScanningRepo(repo);
      setError(null);

      // Prefer GitHub App scan if available
      const appRepo = repositories.find(
        (r) => r.fullName === repo && r.source === "app",
      );

      const endpoint = appRepo
        ? "/api/github/app/scan"
        : "/api/github/github/scan";

      const res = await apiFetch<{ success: boolean; data: ScanResult }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          repo,
          branch: branch || "main",
          installationId: appRepo?.installationId,
        }),
      });

      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      return null;
    } finally {
      setScanningRepo(null);
    }
  }, [repositories]);

  return (
    <GitHubContext.Provider
      value={{
        connected,
        connection,
        repositories,
        loading,
        error,
        installApp,
        connectOAuth,
        disconnectOAuth,
        syncRepos,
        scanRepo,
        scanningRepo,
      }}
    >
=======
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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
