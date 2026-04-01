/**
 * Advanced Security API
 *
 * Covers previously unused backend routes:
 * - Container scanning
 * - Infrastructure as Code (IaC)
 * - Supply chain analysis
 * - PII detection
 * - Attack surface analysis
 * - License checking
 * - Sandbox execution
 * - Injection detection
 */

import { apiGet, apiPost, FetchResult } from "./core";
import type {
  ContainerScanResult,
  IaCFinding,
  SupplyChainReport,
  DependencyInfo,
  Vulnerability,
  FindingSeverity,
} from "./types";

// ============ Container Security ============

export interface ContainerScanRequest {
  imageName: string;
  tag?: string;
  registryUrl?: string;
}

export async function scanContainer(
  request: ContainerScanRequest,
): Promise<FetchResult<ContainerScanResult>> {
  return apiPost<ContainerScanResult>("/api/container/scan", request, {
    requireAuth: true,
  });
}

export async function getContainerHistory(
  limit = 10,
): Promise<FetchResult<ContainerScanResult[]>> {
  return apiGet<ContainerScanResult[]>(
    `/api/container/history?limit=${limit}`,
    { requireAuth: true },
  );
}

// ============ Infrastructure as Code ============

export interface IaCScanRequest {
  projectPath: string;
  provider?: "terraform" | "cloudformation" | "kubernetes" | "ansible";
}

export interface IaCScanResult {
  success: boolean;
  findings: IaCFinding[];
  summary: {
    total: number;
    bySeverity: Record<FindingSeverity, number>;
    byResourceType: Record<string, number>;
  };
  scannedFiles: number;
}

export async function scanIaC(
  request: IaCScanRequest,
): Promise<FetchResult<IaCScanResult>> {
  return apiPost<IaCScanResult>("/api/iac/scan", request, {
    requireAuth: true,
  });
}

export async function getIaCPolicies(): Promise<
  FetchResult<{
    policies: Array<{ id: string; name: string; enabled: boolean }>;
  }>
> {
  return apiGet("/api/iac/policies", { requireAuth: true });
}

// ============ Supply Chain Security ============

export interface SupplyChainScanRequest {
  projectPath: string;
  includeDev?: boolean;
  checkLicenses?: boolean;
}

export async function scanSupplyChain(
  request: SupplyChainScanRequest,
): Promise<FetchResult<SupplyChainReport>> {
  return apiPost<SupplyChainReport>("/api/supply-chain/scan", request, {
    requireAuth: true,
  });
}

export async function getDependencyDetails(
  packageName: string,
): Promise<FetchResult<DependencyInfo & { advisories: Vulnerability[] }>> {
  return apiGet(
    `/api/supply-chain/package/${encodeURIComponent(packageName)}`,
    { requireAuth: true },
  );
}

export async function checkLicenseCompliance(
  projectPath: string,
): Promise<
  FetchResult<{
    compliant: boolean;
    issues: Array<{ package: string; license: string; issue: string }>;
  }>
> {
  return apiPost("/api/license/check", { projectPath }, { requireAuth: true });
}

// ============ PII Detection ============

export interface PIIScanRequest {
  projectPath: string;
  filePatterns?: string[];
}

export interface PIIFinding {
  id: string;
  type:
    | "email"
    | "phone"
    | "ssn"
    | "credit_card"
    | "api_key"
    | "password"
    | "other";
  file: string;
  line: number;
  column: number;
  preview: string;
  confidence: number;
  recommendation: string;
}

export interface PIIScanResult {
  success: boolean;
  findings: PIIFinding[];
  summary: {
    total: number;
    byType: Record<string, number>;
  };
  scannedFiles: number;
}

export async function scanPII(
  request: PIIScanRequest,
): Promise<FetchResult<PIIScanResult>> {
  return apiPost<PIIScanResult>("/api/pii/scan", request, {
    requireAuth: true,
  });
}

// ============ Attack Surface Analysis ============

export interface AttackSurfaceRequest {
  projectPath: string;
  includeTests?: boolean;
}

export interface AttackSurfaceEndpoint {
  method: string;
  path: string;
  file: string;
  line: number;
  authentication: "none" | "optional" | "required" | "unknown";
  riskLevel: FindingSeverity;
  parameters: Array<{ name: string; type: string; source: string }>;
}

export interface AttackSurfaceResult {
  success: boolean;
  endpoints: AttackSurfaceEndpoint[];
  summary: {
    totalEndpoints: number;
    unauthenticated: number;
    highRisk: number;
    inputSources: Record<string, number>;
  };
  graphData?: {
    nodes: Array<{ id: string; type: string }>;
    edges: Array<{ source: string; target: string }>;
  };
}

export async function analyzeAttackSurface(
  request: AttackSurfaceRequest,
): Promise<FetchResult<AttackSurfaceResult>> {
  return apiPost<AttackSurfaceResult>("/api/attack-surface/analyze", request, {
    requireAuth: true,
  });
}

// ============ Injection Detection ============

export interface InjectionScanRequest {
  code: string;
  language?: string;
  context?: "sql" | "nosql" | "ldap" | "xpath" | "command" | "all";
}

export interface InjectionFinding {
  type: string;
  severity: FindingSeverity;
  line: number;
  column: number;
  message: string;
  sink: string;
  taintedSource?: string;
  recommendation: string;
}

export interface InjectionScanResult {
  success: boolean;
  findings: InjectionFinding[];
  safe: boolean;
}

export async function detectInjection(
  request: InjectionScanRequest,
): Promise<FetchResult<InjectionScanResult>> {
  return apiPost<InjectionScanResult>("/api/injection/detect", request, {
    requireAuth: true,
  });
}

// ============ Sandbox Execution ============

export interface SandboxRequest {
  code: string;
  language: "javascript" | "typescript" | "python";
  timeout?: number;
  memoryLimit?: number;
}

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  memoryUsed: number;
  syscalls: string[];
  networkRequests: Array<{ url: string; method: string; blocked: boolean }>;
}

export async function executeSandbox(
  request: SandboxRequest,
): Promise<FetchResult<SandboxResult>> {
  return apiPost<SandboxResult>("/api/sandbox/execute", request, {
    requireAuth: true,
    timeout: 30000,
  });
}

// ============ Secrets Scanning ============

export interface SecretsScanRequest {
  projectPath: string;
  includeHistory?: boolean;
}

export interface SecretFinding {
  id: string;
  type: string;
  file: string;
  line: number;
  secretType:
    | "api_key"
    | "password"
    | "token"
    | "certificate"
    | "private_key"
    | "other";
  provider?: string;
  isActive?: boolean;
  recommendation: string;
}

export interface SecretsScanResult {
  success: boolean;
  findings: SecretFinding[];
  summary: {
    total: number;
    byType: Record<string, number>;
    potentiallyActive: number;
  };
}

export async function scanSecrets(
  request: SecretsScanRequest,
): Promise<FetchResult<SecretsScanResult>> {
  return apiPost<SecretsScanResult>("/api/secrets/scan", request, {
    requireAuth: true,
  });
}

// ============ Validation ============

export interface ValidationRequest {
  input: string;
  schema?: object;
  rules?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string; rule: string }>;
  sanitized?: string;
}

export async function validateInput(
  request: ValidationRequest,
): Promise<FetchResult<ValidationResult>> {
  return apiPost<ValidationResult>("/api/validation/validate", request);
}

// ============ MCP Integration ============

export interface MCPToolRequest {
  tool: string;
  parameters: Record<string, unknown>;
}

export interface MCPToolResponse {
  success: boolean;
  result: unknown;
  error?: string;
}

export async function executeMCPTool(
  request: MCPToolRequest,
): Promise<FetchResult<MCPToolResponse>> {
  return apiPost<MCPToolResponse>("/api/mcp/execute", request, {
    requireAuth: true,
  });
}

export async function listMCPTools(): Promise<
  FetchResult<{
    tools: Array<{ name: string; description: string; parameters: object }>;
  }>
> {
  return apiGet("/api/mcp/tools", { requireAuth: true });
}
