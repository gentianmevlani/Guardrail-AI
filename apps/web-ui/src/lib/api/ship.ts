/**
 * Ship Check API - MockProof, Reality Mode, Airlock
 */
import { API_BASE, ApiResponse, logger } from './core';

export interface ShipCheckOptions {
  projectPath?: string;
  repositoryId?: string;
}

export interface ShipCheckGateResult {
  status: "pass" | "fail" | "skip" | "running";
  duration?: number;
  findings: number;
  message: string;
}

export interface MockProofViolation {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface BadgeCheck {
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
}

export interface ShipCheckResponse {
  success: boolean;
  verdict?: "SHIP" | "NO_SHIP";
  score?: number;
  timestamp?: string;
  policyHash?: string;
  mockproof?: {
    verdict: string;
    violations: MockProofViolation[];
    scannedFiles: number;
    entrypoints: string[];
  };
  badge?: {
    verdict: string;
    score: number;
    checks: BadgeCheck[];
    permalink?: string;
    embedCode?: string;
  };
  error?: string;
}

export interface RealityStep {
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  message?: string;
}

export interface AirlockDependency {
  package: string;
  version: string;
  vulnerability?: string;
  severity?: "critical" | "high" | "medium" | "low";
  status: "safe" | "vulnerable" | "outdated";
}

export interface ShipCheckResult {
  verdict: "SHIP" | "NO_SHIP" | "PENDING" | "ERROR";
  timestamp: string;
  duration: number;
  policyHash: string;
  gates: {
    mockproof: ShipCheckGateResult;
    reality: ShipCheckGateResult;
    airlock: ShipCheckGateResult;
  };
  badgeScore: number;
  badgeUrl: string;
  mockproofFindings: MockProofViolation[];
  realitySteps: RealityStep[];
  airlockDeps: AirlockDependency[];
  error?: string;
}

export interface ShipHistoryEntry {
  id: string;
  timestamp: string;
  verdict: "SHIP" | "NO_SHIP";
  score: number;
  duration: number;
  policyHash: string;
}

export async function runShipCheck(options: ShipCheckOptions = {}): Promise<ShipCheckResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/ship/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
      credentials: "include",
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      return {
        success: false,
        error: errorData.error || `Ship check failed with status ${res.status}`,
      };
    }
    
    const json = await res.json();
    return {
      success: json.success,
      verdict: json.verdict === "SHIP" ? "SHIP" : "NO_SHIP",
      score: json.score,
      timestamp: json.timestamp,
      policyHash: json.badge?.checks?.[0]?.id || `pol_${Date.now().toString(36)}`,
      mockproof: json.mockproof,
      badge: json.badge,
    };
  } catch (error) {
    logger.debug('API unavailable for ship check:', error);
    return {
      success: false,
      error: "Ship check API is unavailable. Please try again later.",
    };
  }
}

export async function runShipMockproof(projectPath?: string): Promise<{
  success: boolean;
  verdict?: string;
  violations?: MockProofViolation[];
  scannedFiles?: number;
  entrypoints?: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/ship/mockproof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
      credentials: "include",
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      return { success: false, error: errorData.error };
    }
    
    return await res.json();
  } catch (error) {
    return { success: false, error: "MockProof API unavailable" };
  }
}

export async function runShipRealityMode(projectPath: string, baseUrl: string): Promise<{
  success: boolean;
  verdict?: string;
  steps?: RealityStep[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/ship/reality-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, baseUrl }),
      credentials: "include",
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      return { success: false, error: errorData.error };
    }
    
    return await res.json();
  } catch (error) {
    return { success: false, error: "Reality Mode API unavailable" };
  }
}

export async function getShipCheckHistory(projectPath?: string, limit = 10): Promise<{
  success: boolean;
  history: ShipHistoryEntry[];
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (projectPath) params.set("projectPath", projectPath);
    params.set("limit", limit.toString());
    
    const res = await fetch(`${API_BASE}/api/ship/history?${params}`, {
      credentials: "include",
    });
    
    if (!res.ok) {
      return { success: false, history: [], error: "Failed to fetch history" };
    }
    
    const json = await res.json();
    return { success: true, history: json.history || [] };
  } catch (error) {
    return { success: false, history: [], error: "History API unavailable" };
  }
}
