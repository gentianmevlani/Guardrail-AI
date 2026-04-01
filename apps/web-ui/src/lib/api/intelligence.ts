/**
 * Intelligence Suite API
 *
 * API functions for the Intelligence Suite dashboard including
 * AI analysis, security scanning, architecture health, supply chain,
 * team intelligence, and predictive analytics.
 */

import { API_BASE, ApiResponse, logger } from "./core";

// Types
export interface IntelligenceSuiteData {
  score: number;
  findings: number;
  lastRun: string | null;
  trend: "up" | "down" | "stable";
}

export interface IntelligenceOverview {
  ai: IntelligenceSuiteData;
  security: IntelligenceSuiteData;
  architecture: IntelligenceSuiteData;
  supplyChain: IntelligenceSuiteData;
  team: IntelligenceSuiteData;
  predictive: IntelligenceSuiteData;
  overallScore: number;
  totalFindings: number;
  criticalIssues: number;
  bugPredictions: number;
}

export interface IntelligenceFinding {
  id: string;
  type: "security" | "bug" | "architecture" | "supply" | "team" | "predictive";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  file: string;
  line?: number;
  suite: string;
  createdAt: string;
}

export interface AIAnalysisResult {
  score: number;
  codeQuality: number;
  bugPredictions: Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    file: string;
    probability: number;
  }>;
  recommendations: string[];
  issues: Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    file: string;
  }>;
}

export interface SecurityAnalysisResult {
  score: number;
  secretsScore: number;
  vulnerabilitiesScore: number;
  complianceScore: number;
  compliance: Array<{
    name: string;
    compliant: boolean;
  }>;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ArchitectureAnalysisResult {
  score: number;
  modularity: number;
  coupling: number;
  cohesion: number;
  complexity: number;
  maintainability: number;
  codeSmells: Array<{
    type: string;
    count: number;
    severity: "critical" | "high" | "medium" | "low";
  }>;
  circularDependencies: string[];
}

export interface SupplyChainResult {
  score: number;
  totalDependencies: number;
  outdated: number;
  vulnerabilities: number;
  licenseIssues: number;
  vulnerableDeps: Array<{
    package: string;
    version: string;
    severity: "critical" | "high" | "medium" | "low";
    cve: string;
  }>;
}

export interface TeamIntelligenceResult {
  score: number;
  contributors: number;
  activeContributors: number;
  busFactor: number;
  knowledgeSilos: number;
  experts: Array<{
    name: string;
    commits: number;
    areas: string;
  }>;
  riskAreas: Array<{
    area: string;
    contributors: number;
    risk: "high" | "medium" | "low";
  }>;
}

export interface PredictiveAnalyticsResult {
  score: number;
  qualityTrend: "improving" | "stable" | "declining";
  riskLevel: "low" | "medium" | "high";
  predictions: Array<{
    type: string;
    probability: number;
    impact: "critical" | "high" | "medium" | "low";
    description: string;
  }>;
  recommendations: string[];
}

// API Functions

/**
 * Fetch intelligence suite overview with all suite scores
 */
export async function fetchIntelligenceOverview(
  projectId?: string,
): Promise<IntelligenceOverview | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(`${API_BASE}/api/intelligence/overview${params}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<IntelligenceOverview> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for intelligence overview");
    return null;
  }
}

/**
 * Fetch recent findings across all intelligence suites
 */
export async function fetchIntelligenceFindings(options?: {
  limit?: number;
  suite?: string;
  severity?: string;
}): Promise<IntelligenceFinding[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.suite) params.append("suite", options.suite);
    if (options?.severity) params.append("severity", options.severity);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(
      `${API_BASE}/api/intelligence/findings${queryString}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return [];
    const json: ApiResponse<{ findings: IntelligenceFinding[] }> =
      await res.json();
    return json.data?.findings || [];
  } catch (error) {
    logger.debug("API unavailable for intelligence findings");
    return [];
  }
}

/**
 * Run a specific intelligence suite analysis
 */
export async function runIntelligenceSuite(
  suite: string,
  projectId?: string,
): Promise<{ success: boolean; runId?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/intelligence/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ suite, projectId }),
    });
    if (!res.ok) return { success: false };
    const json: ApiResponse<{ runId: string }> = await res.json();
    return { success: json.success, runId: json.data?.runId };
  } catch (error) {
    logger.debug(`Failed to run ${suite} intelligence suite`);
    return { success: false };
  }
}

/**
 * Run all intelligence suites
 */
export async function runAllIntelligenceSuites(
  projectId?: string,
): Promise<{ success: boolean; runIds?: Record<string, string> }> {
  try {
    const res = await fetch(`${API_BASE}/api/intelligence/run-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) return { success: false };
    const json: ApiResponse<{ runIds: Record<string, string> }> =
      await res.json();
    return { success: json.success, runIds: json.data?.runIds };
  } catch (error) {
    logger.debug("Failed to run all intelligence suites");
    return { success: false };
  }
}

/**
 * Fetch AI analysis results
 */
export async function fetchAIAnalysis(
  projectId?: string,
): Promise<AIAnalysisResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(`${API_BASE}/api/intelligence/ai${params}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<AIAnalysisResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for AI analysis");
    return null;
  }
}

/**
 * Fetch security analysis results
 */
export async function fetchSecurityIntelligence(
  projectId?: string,
): Promise<SecurityAnalysisResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(`${API_BASE}/api/intelligence/security${params}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<SecurityAnalysisResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for security intelligence");
    return null;
  }
}

/**
 * Fetch architecture analysis results
 */
export async function fetchArchitectureAnalysis(
  projectId?: string,
): Promise<ArchitectureAnalysisResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(
      `${API_BASE}/api/intelligence/architecture${params}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    const json: ApiResponse<ArchitectureAnalysisResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for architecture analysis");
    return null;
  }
}

/**
 * Fetch supply chain analysis results
 */
export async function fetchSupplyChainAnalysis(
  projectId?: string,
): Promise<SupplyChainResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(
      `${API_BASE}/api/intelligence/supply-chain${params}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    const json: ApiResponse<SupplyChainResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for supply chain analysis");
    return null;
  }
}

/**
 * Fetch team intelligence results
 */
export async function fetchTeamIntelligence(
  projectId?: string,
): Promise<TeamIntelligenceResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(`${API_BASE}/api/intelligence/team${params}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<TeamIntelligenceResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for team intelligence");
    return null;
  }
}

/**
 * Fetch predictive analytics results
 */
export async function fetchPredictiveAnalytics(
  projectId?: string,
): Promise<PredictiveAnalyticsResult | null> {
  try {
    const params = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(
      `${API_BASE}/api/intelligence/predictive${params}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    const json: ApiResponse<PredictiveAnalyticsResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for predictive analytics");
    return null;
  }
}

/**
 * Fetch MCP server status
 */
export interface MCPStatus {
  connected: boolean;
  version: string;
  tools: number;
  lastPing: string | null;
  uptime: string;
}

export async function fetchMCPStatus(): Promise<MCPStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/status`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json: ApiResponse<MCPStatus> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug("API unavailable for MCP status");
    return null;
  }
}
