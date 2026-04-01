/**
 * Fixes API - Apply fixes, generate diffs, rollback
 */
import { API_BASE, ApiResponse, logger } from "./core";

export interface FixDiff {
  file: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
  }>;
}

export interface FixApplicationResult {
  success: boolean;
  packId: string;
  filesModified: string[];
  diffs: FixDiff[];
  verification: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  };
  rollbackAvailable: boolean;
  rollbackId?: string;
}

export interface DiffResult {
  success: boolean;
  packId: string;
  diffs: FixDiff[];
  filesModified: string[];
}

export interface RollbackResult {
  success: boolean;
  message: string;
}

/**
 * Apply a fix pack
 */
export async function applyFix(
  runId: string,
  packId: string,
  dryRun: boolean = false,
  projectPath?: string
): Promise<FixApplicationResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/fixes/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        runId,
        packId,
        dryRun,
        projectPath,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Failed to apply fix" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    const json: ApiResponse<FixApplicationResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.error("Failed to apply fix:", error);
    throw error;
  }
}

/**
 * Generate diff for a fix pack
 */
export async function generateDiff(
  runId: string,
  packId: string,
  projectPath?: string
): Promise<DiffResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/fixes/diff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        runId,
        packId,
        projectPath,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Failed to generate diff" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    const json: ApiResponse<DiffResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.error("Failed to generate diff:", error);
    throw error;
  }
}

/**
 * Rollback a fix application
 */
export async function rollbackFix(
  rollbackId: string,
  projectPath?: string
): Promise<RollbackResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/fixes/rollback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        rollbackId,
        projectPath,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Failed to rollback fix" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    const json: ApiResponse<RollbackResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.error("Failed to rollback fix:", error);
    throw error;
  }
}
