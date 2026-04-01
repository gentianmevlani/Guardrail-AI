/**
 * Policies API - Rules, Profiles, Allowlists
 */
import { API_BASE, ApiResponse, logger } from './core';

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  gates: {
    mockproof: { enabled: boolean; failOn: "off" | "warn" | "error" };
    reality: { enabled: boolean; failOn: "off" | "warn" | "error" };
    airlock: { enabled: boolean; failOn: "off" | "warn" | "error" };
  };
}

export interface PolicyRule {
  id: string;
  name: string;
  category: string;
  severity: "off" | "warn" | "error";
  description: string;
}

export interface PolicyAllowlistEntry {
  type: "domain" | "endpoint" | "package";
  value: string;
  reason?: string;
  addedBy: string;
  addedAt: string;
}

export interface PoliciesData {
  profiles: PolicyProfile[];
  rules: PolicyRule[];
  allowlist: PolicyAllowlistEntry[];
  ignoreGlobs: string[];
}

export async function fetchPolicies(): Promise<PoliciesData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/policies`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<PoliciesData> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for policies');
    return null;
  }
}

export async function updatePolicy(
  id: string,
  data: Partial<PoliciesData>
): Promise<PoliciesData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/policies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<PoliciesData> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for policy update');
    return null;
  }
}
