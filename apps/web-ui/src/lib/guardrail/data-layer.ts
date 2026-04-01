/**
 * guardrail Data Layer
 * Reads telemetry, artifacts, and truthpack from local filesystem
 * For Receipt Vault dashboard
 */

export interface TelemetryEvent {
  timestamp: string;
  tool: string;
  repoId: string;
  latencyMs: number;
  resultType: "hit" | "miss" | "blocked" | "error";
  category: string;
  queryHash?: string;
  blockedHallucination: boolean;
  suggestionAccepted?: boolean;
}

export interface TelemetryStats {
  period: string;
  totalCalls: number;
  hallucinationsBlocked: number;
  symbolsVerified: number;
  routesVerified: number;
  patternsUsed: number;
  versionChecks: number;
  avgLatencyMs: number;
  byTool: Record<string, number>;
  byCategory: Record<string, number>;
  savedMoments: SavedMoment[];
}

export interface SavedMoment {
  timestamp: string;
  tool: string;
  category: string;
  description: string;
}

export interface ShipRun {
  id: string;
  timestamp: string;
  verdict: "GO" | "WARN" | "NO-GO";
  blockersCount: number;
  warningsCount: number;
  passedCount: number;
  reportPath?: string;
  duration?: number;
}

export interface TruthPackInfo {
  exists: boolean;
  lastUpdated?: string | null;
  generatedAt?: string | null;
  symbolCount?: number;
  routeCount?: number;
  dependencyCount?: number;
  fileCount?: number;
  lineCount?: number;
  /** Primary framework from Truth Pack stack (e.g. nextjs, react) */
  framework?: string | null;
  language?: string | null;
  packageManager?: string | null;
  /** @deprecated prefer `framework` — kept for older responses */
  frameworks?: string[];
  languages?: string[];
  lastRealityScan?: {
    verdict: string;
    timestamp: string;
    totalScore?: number;
  } | null;
  error?: string;
}

export interface GuardrailStatus {
  connected: boolean;
  pid?: number;
  mode?: "stdio" | "http";
  uptime?: number;
}

export interface PolicyConfig {
  strictness: "dev" | "pre-merge" | "pre-deploy";
  boundaries: ArchitectureBoundary[];
  allowedDeps?: string[];
  blockedDeps?: string[];
}

export interface ArchitectureBoundary {
  id: string;
  name: string;
  from: string;
  to: string;
  allowed: boolean;
  description?: string;
}

export interface Artifact {
  id: string;
  type: "html" | "json" | "sarif" | "video";
  name: string;
  path: string;
  timestamp: string;
  size: number;
  runId?: string;
}

// API functions - these call the backend API routes

export async function fetchTelemetryStats(period: string = "24h"): Promise<TelemetryStats> {
  const res = await fetch(`/api/guardrail/telemetry?period=${period}`);
  if (!res.ok) throw new Error("Failed to fetch telemetry");
  return res.json();
}

export async function fetchShipRuns(): Promise<ShipRun[]> {
  const res = await fetch("/api/guardrail/runs");
  if (!res.ok) throw new Error("Failed to fetch runs");
  return res.json();
}

export async function fetchShipRun(id: string): Promise<ShipRun & { blockers: any[]; warnings: any[] }> {
  const res = await fetch(`/api/guardrail/runs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch run");
  return res.json();
}

export async function fetchTruthPackInfo(): Promise<TruthPackInfo> {
  const res = await fetch("/api/guardrail/truthpack");
  if (!res.ok) throw new Error("Failed to fetch truthpack info");
  return res.json();
}

export async function fetchGuardrailStatus(): Promise<GuardrailStatus> {
  const res = await fetch("/api/guardrail/status");
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function fetchPolicies(): Promise<PolicyConfig> {
  const res = await fetch("/api/guardrail/policies");
  if (!res.ok) throw new Error("Failed to fetch policies");
  return res.json();
}

export async function savePolicies(config: PolicyConfig): Promise<{ success: boolean }> {
  const res = await fetch("/api/guardrail/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save policies");
  return res.json();
}

export async function fetchArtifacts(): Promise<Artifact[]> {
  const res = await fetch("/api/guardrail/artifacts");
  if (!res.ok) throw new Error("Failed to fetch artifacts");
  return res.json();
}

// Default/empty states for SSR
export const emptyTelemetryStats: TelemetryStats = {
  period: "24h",
  totalCalls: 0,
  hallucinationsBlocked: 0,
  symbolsVerified: 0,
  routesVerified: 0,
  patternsUsed: 0,
  versionChecks: 0,
  avgLatencyMs: 0,
  byTool: {},
  byCategory: {},
  savedMoments: [],
};

export const defaultPolicies: PolicyConfig = {
  strictness: "dev",
  boundaries: [
    { id: "1", name: "Client/Server", from: "client/**", to: "server/**", allowed: false, description: "No direct server imports in client" },
    { id: "2", name: "Components/Pages", from: "components/**", to: "pages/**", allowed: false, description: "Components should not import pages" },
    { id: "3", name: "Utils Pure", from: "utils/**", to: "components/**", allowed: false, description: "Utils should be pure, no UI imports" },
  ],
  allowedDeps: [],
  blockedDeps: [],
};
