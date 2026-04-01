/**
 * API Response Types for CodeGuard Web Dashboard
 * Eliminates `any` types by providing specific interfaces
 */

// =============================================================================
// Base Types
// =============================================================================

export type Severity = "critical" | "high" | "medium" | "low";
export type SeverityCapitalized = "Critical" | "High" | "Medium" | "Low";

// =============================================================================
// Project & Stats
// =============================================================================

export interface ProjectStats {
  scans: number;
  findings: number;
  lastScanAt: string | null;
  healthScore: number;
}

// =============================================================================
// Audit Log
// =============================================================================

export interface AuditLogDetails {
  ip?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RawAuditLog {
  id: string;
  action: string;
  resource: string;
  resourceType: string;
  userId: string;
  timestamp: string;
  outcome: "success" | "failure";
  severity?: Severity;
  projectId?: string;
  details?: AuditLogDetails;
}

// =============================================================================
// Dashboard Metrics
// =============================================================================

export interface DashboardSecurityData {
  riskScore?: number;
  totalFindings?: number;
  findingsBySeverity?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
}

export interface DashboardShipData {
  verdict?: string;
  lastCheck?: string;
}

export interface DashboardMetricsResponse {
  security?: DashboardSecurityData;
  ship?: DashboardShipData;
  recentActivity?: RawAuditLog[];
}

// =============================================================================
// Run Detail Types
// =============================================================================

export interface RawRunData {
  id: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "failed";
  verdict?: "pass" | "fail";
  repo?: string;
  branch?: string;
  commitSha?: string;
  traceUrl?: string;
  videoUrl?: string;
  securityResult?: SecurityResultData;
  realityResult?: RealityResultData;
  guardrailResult?: GuardrailResultData;
}

export interface SecurityResultData {
  verdict?: "pass" | "fail" | "skip";
  total?: number;
  detections?: SecurityDetection[];
}

export interface SecurityDetection {
  secretType?: string;
  filePath?: string;
  line?: number;
  confidence?: number;
  recommendation?: string;
}

export interface RealityResultData {
  verdict?: "pass" | "fail" | "skip";
  duration?: number;
  message?: string;
}

export interface GuardrailResultData {
  verdict?: "pass" | "fail" | "skip";
  score?: number;
  findings?: GuardrailFinding[];
}

export interface GuardrailFinding {
  type?: string;
  file?: string;
  severity?: "error" | "warning" | "info";
}

export interface RunDetailResponse {
  run?: RawRunData;
  reportJson?: Record<string, unknown>;
}

// =============================================================================
// GitHub Repository Types
// =============================================================================

export interface RawGitHubRepo {
  id: number | string;
  name: string;
  full_name?: string;
  fullName?: string;
  description?: string | null;
  private?: boolean;
  html_url?: string;
  language?: string | null;
  lastScan?: string | null;
}

// =============================================================================
// Ship Check Types
// =============================================================================

export interface MockProofViolation {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: Severity;
}

export interface ShipCheckBadgeCheck {
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
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
  severity?: Severity;
  status: "safe" | "vulnerable" | "outdated";
}

export interface ShipHistoryEntry {
  id: string;
  timestamp: string;
  verdict: "SHIP" | "NO_SHIP";
  score: number;
  duration: number;
  policyHash: string;
}

// =============================================================================
// Scan Result Types
// =============================================================================

export interface MockProofResult {
  verdict: string;
  violations: MockProofViolation[];
  scannedFiles: number;
}

export interface SecurityFinding {
  id: string;
  rule: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  fixable: boolean;
}

export interface SecurityResult {
  verdict: string;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface RealityIssue {
  id: string;
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface RealityResult {
  verdict: string;
  issues: RealityIssue[];
  scannedFiles: number;
}

// =============================================================================
// SSE Event Types
// =============================================================================

export type SSEEventType =
  | "connected"
  | "dashboard-summary"
  | "dashboard-update"
  | "activity-event"
  | "activity-initial"
  | "health-update"
  | "notification"
  | "scan-started"
  | "scan-progress"
  | "scan-complete"
  | "findings-update"
  | "ping"
  | "message";

export interface SSEDashboardSummary {
  security: {
    riskScore: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  ship: {
    verdict: string;
    lastCheck: string | null;
  };
}

export interface SSEActivityEvent {
  id: string;
  type: string;
  action: string;
  resource: string;
  actor: string;
  timestamp: string;
  severity?: Severity;
}

export interface SSENotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  createdAt: string;
}

export interface SSEScanProgress {
  scanId: string;
  progress: number;
  status: string;
}

export interface SSEScanComplete {
  scanId: string;
  result: {
    verdict?: string;
    score?: number;
    findings?: SecurityFinding[];
  };
}

// Union type for SSE data based on event type
export type SSEEventData =
  | SSEDashboardSummary
  | SSEActivityEvent
  | SSENotification
  | SSEScanProgress
  | SSEScanComplete
  | Record<string, unknown>;

// =============================================================================
// Activity Event Metadata
// =============================================================================

export interface ActivityEventMetadata {
  scanId?: string;
  findingId?: string;
  projectId?: string;
  duration?: number;
  count?: number;
  [key: string]: unknown;
}

// =============================================================================
// Sidebar Types
// =============================================================================

export interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  disabled?: boolean;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

// =============================================================================
// GitHub Scan Types
// =============================================================================

export interface GitHubScanError {
  code?: string;
  message: string;
  details?: string;
}

export interface GitHubScanRequest {
  owner: string;
  repo: string;
  branch?: string;
  scanType?: "quick" | "full" | "deep";
}

export interface GitHubScanResponse {
  success: boolean;
  verdict?: "SHIP" | "NO_SHIP" | "REVIEW";
  score?: number;
  mockproof?: MockProofResult;
  security?: SecurityResult;
  reality?: RealityResult;
  checks?: Array<{
    id: string;
    name: string;
    status: "pass" | "fail" | "warning";
    message: string;
  }>;
  error?: string;
}
