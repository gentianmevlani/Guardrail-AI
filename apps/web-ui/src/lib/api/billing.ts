/**
 * Billing API
 *
 * Handles billing operations, usage tracking, payment methods, and Stripe integration
 */

import { apiGet, apiPost } from "./core";

// Types
export interface BillingUsage {
  scansUsed: number;
  scansLimit: number | null;
  realityRunsUsed: number;
  realityRunsLimit: number | null;
  aiAgentRunsUsed: number;
  aiAgentRunsLimit: number | null;
  teamMembersUsed: number;
  teamMembersLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  tier?: string;
  subscription?: {
    status: string;
    renewalDate: string;
    cancelAtPeriodEnd: boolean;
  };
}

export interface UsageTrendPoint {
  date: string;
  scans: number;
  realityRuns: number;
  aiAgentRuns: number;
}

export interface UsageBreakdown {
  category: string;
  value: number;
  color: string;
}

export interface ExtendedBillingUsage extends BillingUsage {
  projectsUsed: number;
  projectsLimit: number | null;
  daysRemaining: number;
  dailyUsageRate: {
    scans: number;
    realityRuns: number;
    aiAgentRuns: number;
  };
  projectedUsage: {
    scans: number;
    realityRuns: number;
    aiAgentRuns: number;
  };
  usageTrend: UsageTrendPoint[];
  breakdown: {
    scans: UsageBreakdown[];
    realityRuns: UsageBreakdown[];
  };
}

export interface BillingHistory {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: "paid" | "pending" | "failed";
  invoiceUrl?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

// API Functions
export async function fetchBillingUsage(): Promise<BillingUsage> {
  // Use new v1 usage endpoint for accurate data
  const response = await apiGet<{
    success: boolean;
    tier: string;
    period: { start: string; end: string };
    usage: {
      scans: { used: number; limit: number | null; remaining: number | null };
      reality: { used: number; limit: number | null; remaining: number | null };
      agent: { used: number; limit: number | null; remaining: number | null };
      gate: { used: number; limit: number | null; remaining: number | null };
      fix: { used: number; limit: number | null; remaining: number | null };
    };
    seats: { used: number; limit: number };
    projects: { used: number; limit: number | null };
    subscription: {
      status: string;
      renewalDate: string;
      cancelAtPeriodEnd: boolean;
    } | null;
  }>("/api/v1/usage");
  
  if (!response.data) {
    throw new Error("Failed to fetch billing usage");
  }

  const data = response.data;
  
  // Map to legacy format for backwards compatibility
  return {
    scansUsed: data.usage.scans.used,
    scansLimit: data.usage.scans.limit,
    realityRunsUsed: data.usage.reality.used,
    realityRunsLimit: data.usage.reality.limit,
    aiAgentRunsUsed: data.usage.agent.used,
    aiAgentRunsLimit: data.usage.agent.limit,
    teamMembersUsed: data.seats.used,
    teamMembersLimit: data.seats.limit,
    currentPeriodStart: data.period.start,
    currentPeriodEnd: data.period.end,
    tier: data.tier,
    subscription: data.subscription || undefined,
  };
}

export async function fetchBillingHistory(): Promise<BillingHistory[]> {
  const response = await apiGet<BillingHistory[]>("/api/billing/history");
  if (!response.data) {
    throw new Error("Failed to fetch billing history");
  }
  return response.data;
}

export async function downloadInvoice(invoiceId: string): Promise<Blob> {
  const response = await fetch(`/api/billing/invoice/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to download invoice");
  }

  return response.blob();
}

export async function createCustomerPortalSession(): Promise<{ url: string }> {
  const response = await apiPost<{ url: string }>("/api/billing/portal");
  if (!response.data) {
    throw new Error("Failed to create customer portal session");
  }
  return response.data;
}

export async function fetchExtendedBillingUsage(): Promise<ExtendedBillingUsage> {
  const response = await apiGet<{ success: boolean; data: ExtendedBillingUsage }>(
    "/api/billing/usage/extended",
  );
  if (!response.data?.data) {
    throw new Error("Failed to fetch extended billing usage");
  }
  return response.data.data;
}
