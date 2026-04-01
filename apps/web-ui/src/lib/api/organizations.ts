/**
 * Organizations & Teams API
 *
 * Handles team/organization management and billing
 */

import { apiGet, apiPost, apiPut, apiDelete, FetchResult } from "./core";
import type {
  Organization,
  OrganizationMember,
  UsageLimits,
  UsageRecord,
} from "./types";

// ============ Organization Management ============

export async function getOrganizations(): Promise<FetchResult<Organization[]>> {
  return apiGet<Organization[]>("/api/organizations", { requireAuth: true });
}

export async function getOrganization(
  orgId: string,
): Promise<FetchResult<Organization & { members: OrganizationMember[] }>> {
  return apiGet(`/api/organizations/${orgId}`, { requireAuth: true });
}

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

export async function createOrganization(
  request: CreateOrganizationRequest,
): Promise<FetchResult<Organization>> {
  return apiPost<Organization>("/api/organizations", request, {
    requireAuth: true,
  });
}

export async function updateOrganization(
  orgId: string,
  data: Partial<{ name: string; slug: string }>,
): Promise<FetchResult<Organization>> {
  return apiPut<Organization>(`/api/organizations/${orgId}`, data, {
    requireAuth: true,
  });
}

export async function deleteOrganization(
  orgId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiDelete(`/api/organizations/${orgId}`, { requireAuth: true });
}

// ============ Member Management ============

export async function getOrganizationMembers(
  orgId: string,
): Promise<FetchResult<OrganizationMember[]>> {
  return apiGet<OrganizationMember[]>(`/api/organizations/${orgId}/members`, {
    requireAuth: true,
  });
}

export interface InviteMemberRequest {
  email: string;
  role: "admin" | "member";
}

export async function inviteMember(
  orgId: string,
  request: InviteMemberRequest,
): Promise<FetchResult<{ inviteId: string; inviteUrl: string }>> {
  return apiPost(`/api/organizations/${orgId}/members/invite`, request, {
    requireAuth: true,
  });
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  role: "admin" | "member",
): Promise<FetchResult<OrganizationMember>> {
  return apiPut<OrganizationMember>(
    `/api/organizations/${orgId}/members/${memberId}`,
    { role },
    { requireAuth: true },
  );
}

export async function removeMember(
  orgId: string,
  memberId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiDelete(`/api/organizations/${orgId}/members/${memberId}`, {
    requireAuth: true,
  });
}

export async function leaveOrganization(
  orgId: string,
): Promise<FetchResult<{ success: boolean }>> {
  return apiPost(
    `/api/organizations/${orgId}/leave`,
    {},
    { requireAuth: true },
  );
}

// ============ Usage & Limits ============

export async function getUsageLimits(): Promise<FetchResult<UsageLimits>> {
  return apiGet<UsageLimits>("/api/usage/limits", { requireAuth: true });
}

export async function getUsageHistory(
  options: { type?: string; period?: string; limit?: number } = {},
): Promise<FetchResult<UsageRecord[]>> {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.period) params.set("period", options.period);
  if (options.limit) params.set("limit", options.limit.toString());

  return apiGet<UsageRecord[]>(`/api/usage/history?${params}`, {
    requireAuth: true,
  });
}

export async function recordUsage(
  type: "scan" | "reality_run" | "ai_agent_run",
): Promise<FetchResult<{ success: boolean; remaining: number }>> {
  return apiPost("/api/usage/record", { type }, { requireAuth: true });
}

// ============ Organization Billing ============

export async function getOrganizationBilling(orgId: string): Promise<
  FetchResult<{
    subscription: { plan: string; status: string; currentPeriodEnd: string };
    usage: UsageLimits;
    invoices: Array<{
      id: string;
      amount: number;
      date: string;
      status: string;
    }>;
  }>
> {
  return apiGet(`/api/organizations/${orgId}/billing`, { requireAuth: true });
}

export async function upgradeOrganization(
  orgId: string,
  plan: string,
): Promise<FetchResult<{ checkoutUrl: string }>> {
  return apiPost(
    `/api/organizations/${orgId}/billing/upgrade`,
    { plan },
    { requireAuth: true },
  );
}
