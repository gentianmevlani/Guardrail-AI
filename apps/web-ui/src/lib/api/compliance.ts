/**
 * Compliance API - Frameworks, Reports
 */
import { API_BASE, ApiResponse, logger } from './core';

export interface ComplianceDashboard {
  frameworks: Array<{
    id: string;
    name: string;
    score: number;
    status: "compliant" | "non_compliant" | "in_progress";
  }>;
  overallScore: number;
}

export interface ComplianceReport {
  id: string;
  name: string;
  type: string;
  date: string;
  status: "Ready" | "Generating" | "Archived";
  downloadUrl?: string;
}

export async function fetchComplianceDashboard(
  projectId: string,
): Promise<ComplianceDashboard | null> {
  try {
    const res = await fetch(`${API_BASE}/api/compliance/dashboard`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<ComplianceDashboard> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for compliance dashboard');
    return null;
  }
}

export async function fetchComplianceReports(
  projectId: string,
): Promise<ComplianceReport[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/compliance/reports?projectId=${projectId}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return [];
    const json: ApiResponse<{ reports: ComplianceReport[] }> = await res.json();
    return json.data?.reports || [];
  } catch (error) {
    logger.debug('API unavailable for compliance reports');
    return [];
  }
}
