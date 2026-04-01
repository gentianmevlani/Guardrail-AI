/**
 * Autopilot API
 *
 * Continuous monitoring and automated fixes
 */

import { apiGet, apiPost, apiPut, apiDelete, FetchResult } from "./core";
import type { AutopilotConfig, AutopilotRun, RunStatus } from "./types";

// ============ Autopilot Configuration ============

export async function getAutopilotConfig(
  projectId: string,
): Promise<FetchResult<AutopilotConfig>> {
  return apiGet<AutopilotConfig>(`/api/autopilot/config/${projectId}`, {
    requireAuth: true,
  });
}

export async function updateAutopilotConfig(
  projectId: string,
  config: Partial<AutopilotConfig>,
): Promise<FetchResult<AutopilotConfig>> {
  return apiPut<AutopilotConfig>(`/api/autopilot/config/${projectId}`, config, {
    requireAuth: true,
  });
}

export async function enableAutopilot(
  projectId: string,
): Promise<FetchResult<{ success: boolean; config: AutopilotConfig }>> {
  return apiPost(
    `/api/autopilot/enable/${projectId}`,
    {},
    { requireAuth: true },
  );
}

export async function disableAutopilot(
  projectId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiPost(
    `/api/autopilot/disable/${projectId}`,
    {},
    { requireAuth: true },
  );
}

// ============ Autopilot Runs ============

export async function getAutopilotRuns(
  projectId: string,
  options: { status?: RunStatus; limit?: number; offset?: number } = {},
): Promise<FetchResult<{ runs: AutopilotRun[]; total: number }>> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());

  return apiGet(`/api/autopilot/runs/${projectId}?${params}`, {
    requireAuth: true,
  });
}

export async function getAutopilotRun(runId: string): Promise<
  FetchResult<
    AutopilotRun & {
      findings: Array<{
        id: string;
        severity: string;
        message: string;
        fixed: boolean;
      }>;
      logs: Array<{ timestamp: string; level: string; message: string }>;
    }
  >
> {
  return apiGet(`/api/autopilot/run/${runId}`, { requireAuth: true });
}

export async function triggerAutopilotRun(
  projectId: string,
  options: { fix?: boolean; createPR?: boolean } = {},
): Promise<FetchResult<{ runId: string; status: string }>> {
  return apiPost(`/api/autopilot/trigger/${projectId}`, options, {
    requireAuth: true,
  });
}

export async function cancelAutopilotRun(
  runId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiPost(`/api/autopilot/cancel/${runId}`, {}, { requireAuth: true });
}

// ============ Autopilot Stats ============

export interface AutopilotStats {
  totalRuns: number;
  successfulRuns: number;
  findingsDetected: number;
  findingsFixed: number;
  prsCreated: number;
  lastRunAt?: string;
  averageRunTime: number;
}

export async function getAutopilotStats(
  projectId: string,
  period: "week" | "month" | "all" = "month",
): Promise<FetchResult<AutopilotStats>> {
  return apiGet<AutopilotStats>(
    `/api/autopilot/stats/${projectId}?period=${period}`,
    { requireAuth: true },
  );
}

// ============ Digest & Notifications ============

export interface DigestConfig {
  enabled: boolean;
  frequency: "daily" | "weekly";
  recipients: string[];
  includeMetrics: boolean;
  includeFindings: boolean;
}

export async function getDigestConfig(
  projectId: string,
): Promise<FetchResult<DigestConfig>> {
  return apiGet<DigestConfig>(`/api/autopilot/digest/${projectId}`, {
    requireAuth: true,
  });
}

export async function updateDigestConfig(
  projectId: string,
  config: Partial<DigestConfig>,
): Promise<FetchResult<DigestConfig>> {
  return apiPut<DigestConfig>(`/api/autopilot/digest/${projectId}`, config, {
    requireAuth: true,
  });
}

export async function sendTestDigest(
  projectId: string,
  email: string,
): Promise<FetchResult<{ success: boolean; message: string }>> {
  return apiPost(
    `/api/autopilot/digest/${projectId}/test`,
    { email },
    { requireAuth: true },
  );
}
