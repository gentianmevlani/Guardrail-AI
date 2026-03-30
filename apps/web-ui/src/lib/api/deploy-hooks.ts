/**
 * Deploy Hooks API
 *
 * CI/CD integration webhooks for Vercel, Netlify, Railway, GitHub
 */

import { apiGet, apiPost, apiPut, apiDelete, FetchResult } from "./core";
import type { DeployHook, DeployEvent, RunVerdict } from "./types";

// ============ Hook Management ============

export async function getDeployHooks(
  projectId: string,
): Promise<FetchResult<DeployHook[]>> {
  return apiGet<DeployHook[]>(`/api/deploy-hooks/${projectId}`, {
    requireAuth: true,
  });
}

export async function getDeployHook(
  hookId: string,
): Promise<FetchResult<DeployHook>> {
  return apiGet<DeployHook>(`/api/deploy-hooks/hook/${hookId}`, {
    requireAuth: true,
  });
}

export interface CreateDeployHookRequest {
  projectId: string;
  provider: "vercel" | "netlify" | "railway" | "github";
  name?: string;
}

export async function createDeployHook(
  request: CreateDeployHookRequest,
): Promise<FetchResult<DeployHook & { webhookUrl: string; secret: string }>> {
  return apiPost("/api/deploy-hooks", request, { requireAuth: true });
}

export async function updateDeployHook(
  hookId: string,
  data: Partial<{ enabled: boolean; name: string }>,
): Promise<FetchResult<DeployHook>> {
  return apiPut<DeployHook>(`/api/deploy-hooks/hook/${hookId}`, data, {
    requireAuth: true,
  });
}

export async function deleteDeployHook(
  hookId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiDelete(`/api/deploy-hooks/hook/${hookId}`, { requireAuth: true });
}

export async function regenerateHookSecret(
  hookId: string,
): Promise<FetchResult<{ secret: string }>> {
  return apiPost(
    `/api/deploy-hooks/hook/${hookId}/regenerate-secret`,
    {},
    { requireAuth: true },
  );
}

// ============ Deploy Events ============

export async function getDeployEvents(
  projectId: string,
  options: { status?: string; limit?: number; offset?: number } = {},
): Promise<FetchResult<{ events: DeployEvent[]; total: number }>> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());

  return apiGet(`/api/deploy-hooks/${projectId}/events?${params}`, {
    requireAuth: true,
  });
}

export async function getDeployEvent(eventId: string): Promise<
  FetchResult<
    DeployEvent & {
      scanResults: {
        security: { verdict: RunVerdict; findings: number };
        mockproof: { verdict: RunVerdict; violations: number };
        reality?: { verdict: RunVerdict; passed: number; failed: number };
      };
      metadata: Record<string, unknown>;
    }
  >
> {
  return apiGet(`/api/deploy-hooks/event/${eventId}`, { requireAuth: true });
}

// ============ Manual Actions ============

export async function approveDeployEvent(
  eventId: string,
  reason?: string,
): Promise<FetchResult<{ success: boolean; event: DeployEvent }>> {
  return apiPost(
    `/api/deploy-hooks/event/${eventId}/approve`,
    { reason },
    { requireAuth: true },
  );
}

export async function blockDeployEvent(
  eventId: string,
  reason: string,
): Promise<FetchResult<{ success: boolean; event: DeployEvent }>> {
  return apiPost(
    `/api/deploy-hooks/event/${eventId}/block`,
    { reason },
    { requireAuth: true },
  );
}

export async function retryDeployEvent(
  eventId: string,
): Promise<FetchResult<{ success: boolean; newEventId: string }>> {
  return apiPost(
    `/api/deploy-hooks/event/${eventId}/retry`,
    {},
    { requireAuth: true },
  );
}

// ============ Provider Setup ============

export interface ProviderSetupInstructions {
  provider: string;
  steps: Array<{ title: string; description: string; code?: string }>;
  webhookUrl: string;
  requiredEnvVars: Array<{ name: string; description: string }>;
}

export async function getProviderSetupInstructions(
  provider: "vercel" | "netlify" | "railway" | "github",
): Promise<FetchResult<ProviderSetupInstructions>> {
  return apiGet<ProviderSetupInstructions>(
    `/api/deploy-hooks/setup/${provider}`,
    { requireAuth: true },
  );
}

export async function testDeployHook(
  hookId: string,
): Promise<
  FetchResult<{ success: boolean; message: string; latency: number }>
> {
  return apiPost(
    `/api/deploy-hooks/hook/${hookId}/test`,
    {},
    { requireAuth: true },
  );
}

// ============ Stats ============

export interface DeployHookStats {
  totalDeploys: number;
  approved: number;
  blocked: number;
  pending: number;
  averageScanTime: number;
  blockRate: number;
}

export async function getDeployHookStats(
  projectId: string,
  period: "week" | "month" | "all" = "month",
): Promise<FetchResult<DeployHookStats>> {
  return apiGet<DeployHookStats>(
    `/api/deploy-hooks/${projectId}/stats?period=${period}`,
    { requireAuth: true },
  );
}
