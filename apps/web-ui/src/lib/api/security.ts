/**
 * Security API - Vulnerabilities, Findings, Analytics
 */
import { API_BASE, ApiResponse, logger } from './core';

export interface SecurityAnalytics {
  overview: {
    totalScans: number;
    criticalIssues: number;
    highIssues: number;
    resolvedIssues: number;
    riskScore: number;
  };
  trends: {
    scans: Array<{ date: string; value: number }>;
    vulnerabilities: Array<{ date: string; value: number }>;
    riskScore: Array<{ date: string; value: number }>;
  };
  topVulnerabilities: Array<{ type: string; count: number; severity: string }>;
  compliance: {
    owasp: number;
    gdpr: number;
    pci: number;
    hipaa: number;
    soc2?: number;
    iso27001?: number;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceType: string;
  userId: string;
  timestamp: string;
  outcome: "success" | "failure";
  details?: {
    ip?: string;
    userAgent?: string;
    changes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

export interface Vulnerability {
  id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  name: string;
  file: string;
  status: "Open" | "Fixed" | "In Progress" | "Ignored";
  detected: string;
  description?: string;
}

export interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  message: string;
  file: string;
  line: number;
  repo: string;
  branch: string;
  status: "open" | "fixed" | "suppressed" | "accepted_risk";
  fixable: boolean;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

export interface FindingsResponse {
  findings: Finding[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  summary: {
    total: number;
    open: number;
    fixed: number;
    suppressed: number;
    accepted_risk: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

export async function fetchSecurityAnalytics(
  projectId: string,
): Promise<SecurityAnalytics | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/advanced/dashboard/${projectId}/analytics`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    const json: ApiResponse<SecurityAnalytics> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for security analytics');
    return null;
  }
}

export async function fetchAuditLogs(projectId: string): Promise<AuditLog[]> {
  try {
    const res = await fetch(`${API_BASE}/api/audit/query?limit=10`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const json: ApiResponse<{ logs: AuditLog[] }> = await res.json();
    return json.data?.logs || [];
  } catch (error) {
    logger.debug('API unavailable for audit logs');
    return [];
  }
}

export async function fetchVulnerabilities(
  projectId: string,
): Promise<Vulnerability[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/security/vulnerabilities?projectId=${projectId}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return [];
    const json: ApiResponse<{ vulnerabilities: Vulnerability[] }> =
      await res.json();
    return json.data?.vulnerabilities || [];
  } catch (error) {
    logger.debug('API unavailable for vulnerabilities');
    return [];
  }
}

export async function fetchFindings(params?: {
  status?: string;
  severity?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<FindingsResponse | null> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.severity) searchParams.set("severity", params.severity);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const queryString = searchParams.toString();
    const url = `${API_BASE}/api/findings${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<FindingsResponse> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for findings');
    return null;
  }
}

export async function updateFindingStatus(
  id: string,
  status: "open" | "fixed" | "suppressed" | "accepted_risk"
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function triggerDeepScan(): Promise<{ scanId: string; status: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/findings/scan`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<{ scanId: string; status: string }> = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}
