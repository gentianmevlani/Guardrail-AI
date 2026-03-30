/**
 * GitHub Integration API
 */
import { logger } from "./core";

export interface GitHubRepository {
  id: string;
  githubId: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  url: string;
  language: string | null;
  lastScan: string | null;
}

export interface GitHubStatus {
  connected: boolean;
  username?: string;
  repositories?: GitHubRepository[];
}

export async function connectGitHub(): Promise<{
  redirectUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/github/connect`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        error: errorData.error || "Failed to initiate GitHub connection",
      };
    }

    const data = await res.json();
    return { redirectUrl: data.redirectUrl };
  } catch (error) {
    logger.error("Failed to connect GitHub:", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Failed to initiate GitHub connection" };
  }
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/github/status`, {
      credentials: "include",
    });
    if (!res.ok) {
      return { connected: false };
    }
    const data = await res.json();

    let repositories: GitHubRepository[] = [];
    if (data.connected && data.repositories) {
      interface RawGitHubRepo {
        id: number | string;
        name: string;
        fullName?: string;
        description?: string | null;
        private?: boolean;
        html_url?: string;
        language?: string | null;
        lastScan?: string | null;
      }
      repositories = data.repositories.map((r: RawGitHubRepo) => ({
        id: String(r.id),
        githubId: String(r.id),
        name: r.name,
        fullName: r.fullName,
        description: r.description || null,
        isPrivate: r.private,
        url: r.html_url || `https://github.com/${r.fullName}`,
        language: r.language,
        lastScan: r.lastScan || null,
      }));
    }

    return {
      connected: data.connected,
      username: data.user?.login,
      repositories,
    };
  } catch (error) {
    logger.debug("Failed to get GitHub status:", { error: error instanceof Error ? error.message : String(error) });
    return { connected: false };
  }
}

export async function syncGitHubRepos(): Promise<{
  success: boolean;
  synced?: number;
  repositories?: GitHubRepository[];
  error?: string;
}> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/github/sync`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const errorData = await res.json();
      return {
        success: false,
        error: errorData.error || "Failed to sync repositories",
      };
    }
    const data = await res.json();

    // After successful sync, fetch updated status to get repositories
    const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/github/status`, {
      credentials: "include",
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.connected && statusData.repositories) {
        interface RawGitHubRepo {
          id: number | string;
          name: string;
          fullName?: string;
          description?: string | null;
          private?: boolean;
          html_url?: string;
          language?: string | null;
          lastScan?: string | null;
        }
        const repositories = statusData.repositories.map(
          (r: RawGitHubRepo) => ({
            id: String(r.id),
            githubId: String(r.id),
            name: r.name,
            fullName: r.fullName,
            description: r.description || null,
            isPrivate: r.private,
            url: r.html_url || `https://github.com/${r.fullName}`,
            language: r.language,
            lastScan: r.lastScan || null,
          }),
        );
        return { success: true, synced: data.synced, repositories };
      }
    }

    return { success: true, synced: data.synced };
  } catch (error) {
    logger.error("Failed to sync GitHub repos:", { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: "Failed to sync repositories" };
  }
}

export async function disconnectGitHub(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/github/disconnect`, { method: "POST" });
    return { success: res.ok };
  } catch {
    return { success: false, error: "Failed to disconnect GitHub" };
  }
}
