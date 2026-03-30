// API Client for guardrail Dashboard
// All API endpoints return real data from the backend

const API_BASE_URL = typeof window !== 'undefined' 
  ? (window as any).GUARDRAIL_API_URL || '/api'
  : 'http://localhost:3849/api';

// ============================================================================
// TYPES
// ============================================================================

export interface StatusResponse {
  contextMode: "connected" | "disconnected";
  truthPackAge: number;        // seconds since last build
  truthPackPath: string;
  mcpLatency: number;          // avg ms (last 100 calls)
  mcpServer: {
    running: boolean;
    port?: number;
    mode: "stdio" | "http";
  };
  lastActivity: string;        // ISO timestamp
}

export interface StatsResponse {
  period: "24h" | "7d" | "30d";
  hallucinationsBlocked: number;
  symbolsVerified: number;
  routesValidated: number;
  versionsChecked: number;
  patternsEnforced: number;
  boundaryViolations: number;
  securityFootguns: number;
  avgLatencyMs: number;
  totalCalls: number;
  trend: {
    hallucinationsBlocked: number;  // vs previous period
    totalCalls: number;
  };
}

export interface Moment {
  id: string;
  timestamp: string;
  type: "blocked_hallucination" | "blocked_dep" | "security_flag" | "boundary_warn";
  category: "symbols" | "routes" | "versions" | "security" | "architecture";
  summary: string;           // "Blocked useAth → suggested useAuth"
  tool: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface MomentsResponse {
  moments: Moment[];
}

export interface Risk {
  file: string;
  score: number;             // 0-100
  riskTags: string[];        // ["auth", "payments", "db"]
  importance: number;        // centrality score
  recentEdits: number;       // commits in last 7d
  violations: number;        // telemetry violations
  lastTouched: string;       // ISO timestamp
}

export interface RisksResponse {
  risks: Risk[];
}

export interface LiveEvent {
  timestamp: string;
  tool: string;
  latencyMs: number;
  result: "hit" | "miss" | "blocked" | "error";
  blockedHallucination: boolean;
  query?: string;            // hashed/truncated
}

export interface LiveFeedResponse {
  events: LiveEvent[];
}

export interface ShipRun {
  id: string;
  timestamp: string;
  verdict: "GO" | "WARN" | "NO-GO";
  blockersCount: number;
  warningsCount: number;
  passedCount: number;
  commit?: string;
  branch?: string;
  reportPath?: string;       // path to HTML report
  artifacts: string[];       // paths to JSON, SARIF, etc.
}

export interface RunsResponse {
  runs: ShipRun[];
}

export interface ShipBlocker {
  type: string;
  file: string;
  line?: number;
  message: string;
  severity: "blocker" | "warning";
  suggestion?: string;
}

export interface FixAction {
  file: string;
  action: string;
  description: string;
}

export interface RunDetailResponse {
  id: string;
  timestamp: string;
  verdict: "GO" | "WARN" | "NO-GO";
  blockers: ShipBlocker[];
  warnings: ShipBlocker[];
  passed: string[];
  contextImpact: {
    hallucinationsBlocked7d: number;
    patternsUsed: number;
    topPreventedMistakes: string[];
  };
  fixPlan: {
    autoFixable: FixAction[];
    manual: FixAction[];
  };
  reportHtml?: string;         // inline HTML content
}

export interface Boundary {
  from: string;              // glob pattern
  cannotImport?: string;
  isolated?: boolean;
}

export interface ScopeTemplate {
  include: string[];
  exclude?: string[];
  requireTests?: boolean;
}

export interface PoliciesResponse {
  strictness: "dev" | "pre-merge" | "pre-deploy";
  boundaries: Boundary[];
  deps: {
    allowed: string[];
    denied: string[];
  };
  scopeTemplates: {
    [name: string]: ScopeTemplate;
  };
}

export interface TruthPackResponse {
  lastBuilt: string;
  symbolsCount: number;
  routesCount: number;
  depsCount: number;
  patternsCount: number;
  graphNodes: number;
  graphEdges: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Status Panel
  async getStatus(): Promise<StatusResponse> {
    return this.request<StatusResponse>('/status');
  }

  // Relationship Meter
  async getStats(period: "24h" | "7d" | "30d" = "24h"): Promise<StatsResponse> {
    return this.request<StatsResponse>(`/stats?period=${period}`);
  }

  // Saved Moments Feed
  async getMoments(limit: number = 50): Promise<MomentsResponse> {
    return this.request<MomentsResponse>(`/moments?limit=${limit}`);
  }

  // Hot Risk List
  async getRisks(limit: number = 10): Promise<RisksResponse> {
    return this.request<RisksResponse>(`/risks?limit=${limit}`);
  }

  // Live MCP Feed
  async getLiveFeed(): Promise<LiveFeedResponse> {
    return this.request<LiveFeedResponse>('/live');
  }

  // Ship Runs
  async getRuns(limit: number = 20): Promise<RunsResponse> {
    return this.request<RunsResponse>(`/runs?limit=${limit}`);
  }

  // Single Run Detail
  async getRunDetail(id: string): Promise<RunDetailResponse> {
    return this.request<RunDetailResponse>(`/runs/${id}`);
  }

  // Policies
  async getPolicies(): Promise<PoliciesResponse> {
    return this.request<PoliciesResponse>('/policies');
  }

  // Update Policies
  async updatePolicies(policies: PoliciesResponse): Promise<{ success: boolean; path: string }> {
    return this.request<{ success: boolean; path: string }>('/policies', {
      method: 'PUT',
      body: JSON.stringify(policies),
    });
  }

  // Truth Pack Summary
  async getTruthPack(): Promise<TruthPackResponse> {
    return this.request<TruthPackResponse>('/truthpack');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience
export const getStatus = () => apiClient.getStatus();
export const getStats = (period?: "24h" | "7d" | "30d") => apiClient.getStats(period);
export const getMoments = (limit?: number) => apiClient.getMoments(limit);
export const getRisks = (limit?: number) => apiClient.getRisks(limit);
export const getLiveFeed = () => apiClient.getLiveFeed();
export const getRuns = (limit?: number) => apiClient.getRuns(limit);
export const getRunDetail = (id: string) => apiClient.getRunDetail(id);
export const getPolicies = () => apiClient.getPolicies();
export const updatePolicies = (policies: PoliciesResponse) => apiClient.updatePolicies(policies);
export const getTruthPack = () => apiClient.getTruthPack();