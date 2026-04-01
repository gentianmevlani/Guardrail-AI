/**
 * Comprehensive API Types
 *
 * Shared TypeScript definitions for frontend-backend integration.
 * These types mirror the backend response structures exactly.
 */

// ============ Common Types ============

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============ User & Auth Types ============

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  profileImageUrl?: string;
  role: "admin" | "member" | "viewer";
  emailVerified: boolean;
  provider?: "email" | "github" | "google";
  subscription: UserSubscription;
  apiKey?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserSubscription {
  plan: "free" | "starter" | "pro" | "compliance";
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// ============ Project Types ============

export interface Project {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultBranch: string;
  language?: string;
  framework?: string;
  lastScanAt?: string;
  healthScore: number;
  status: "active" | "archived" | "pending";
  createdAt: string;
  updatedAt: string;
}

// ============ Security & Findings Types ============

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "open" | "fixed" | "suppressed" | "accepted_risk";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  rule: string;
  message: string;
  file: string;
  line: number;
  column?: number;
  repo: string;
  branch: string;
  status: FindingStatus;
  fixable: boolean;
  recommendation?: string;
  codeSnippet?: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

export interface FindingsSummary {
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
}

export interface FindingsResponse {
  findings: Finding[];
  pagination: Pagination;
  summary: FindingsSummary;
}

export interface Vulnerability {
  id: string;
  packageName: string;
  version: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  cveId?: string;
  fixedIn?: string;
  publishedAt: string;
}

// ============ Run Types ============

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "canceled";
export type RunVerdict = "pass" | "fail" | "review" | "pending";

export interface Run {
  id: string;
  repo: string;
  branch: string;
  commitSha?: string;
  verdict: RunVerdict;
  score: number;
  status: RunStatus;
  progress: number;
  securityResult?: SecurityResult;
  realityResult?: RealityResult;
  guardrailResult?: GuardrailResult;
  traceUrl?: string;
  videoUrl?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface SecurityResult {
  verdict: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  scannedFiles: number;
  totalFiles: number;
  detections: unknown[];
  byType: Record<string, number>;
}

export interface RealityResult {
  verdict: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: unknown[];
}

export interface GuardrailResult {
  verdict: string;
  score: number;
  checks: Record<string, boolean>;
  violations: string[];
  findings: unknown[];
  filesScanned: number;
}

// ============ Ship Check Types ============

export interface ShipCheckRequest {
  projectPath?: string;
  repositoryId?: string;
}

export interface ShipCheckResult {
  success: boolean;
  verdict: "ship" | "no-ship" | "review";
  score: number;
  timestamp: string;
  mockproof: MockproofResult;
  badge: BadgeResult;
}

export interface MockproofResult {
  verdict: string;
  violations: MockproofViolation[];
  scannedFiles: number;
  entrypoints: string[];
}

export interface MockproofViolation {
  type: string;
  file: string;
  line: number;
  message: string;
  severity: FindingSeverity;
}

export interface BadgeResult {
  verdict: string;
  score: number;
  checks: Record<string, boolean>;
  permalink: string;
  embedCode: string;
}

export interface RealityModeRequest {
  projectPath: string;
  baseUrl: string;
}

export interface RealityModeResult {
  success: boolean;
  verdict: string;
  score: number;
  coverage: number;
  issues: RealityIssue[];
  screenshots: string[];
  videoUrl?: string;
  traceUrl?: string;
}

export interface RealityIssue {
  type: string;
  severity: FindingSeverity;
  message: string;
  url: string;
  screenshot?: string;
}

// ============ Dashboard Types ============

export interface DashboardSummary {
  security: {
    score: number;
    criticalFindings: number;
    highFindings: number;
    totalFindings: number;
    trend: "up" | "down" | "stable";
  };
  ship: {
    lastCheck: string;
    verdict: string;
    score: number;
  };
  compliance: {
    overallScore: number;
    frameworks: ComplianceFramework[];
  };
  activity: {
    recentRuns: number;
    lastRunAt: string;
  };
  performance: {
    avgScanTime: number;
    totalScans: number;
  };
}

export interface DashboardActivity {
  id: string;
  type: "scan" | "fix" | "deploy" | "alert" | "user";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HealthScore {
  overall: number;
  security: number;
  compliance: number;
  quality: number;
  trend: "improving" | "declining" | "stable";
  lastUpdated: string;
}

// ============ Compliance Types ============

export interface ComplianceFramework {
  id: string;
  name: string;
  shortName: string;
  score: number;
  status: "compliant" | "non_compliant" | "in_progress" | "not_started";
  controlsPassed: number;
  controlsTotal: number;
  lastAuditAt?: string;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  name: string;
  description: string;
  status: "passed" | "failed" | "not_applicable" | "pending";
  evidence: string[];
  lastCheckedAt: string;
}

export interface ComplianceReport {
  id: string;
  name: string;
  type: string;
  frameworkId: string;
  date: string;
  status: "Ready" | "Generating" | "Archived";
  downloadUrl?: string;
}

// ============ Billing Types ============

export interface PaymentMethod {
  id: string;
  type: "card" | "bank_account";
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  date: string;
  pdfUrl?: string;
  hostedUrl?: string;
  description?: string;
}

export interface Subscription {
  id: string;
  plan: UserSubscription["plan"];
  status: UserSubscription["status"];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

// ============ Notification Types ============

export type NotificationType = "security" | "compliance" | "system" | "billing";
export type NotificationSeverity = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// ============ Policy Types ============

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  gates: {
    mockproof: GateConfig;
    reality: GateConfig;
    airlock: GateConfig;
  };
}

export interface GateConfig {
  enabled: boolean;
  failOn: "off" | "warn" | "error";
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

// ============ Tenant & Organization Types ============

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: UserSubscription["plan"];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: UserSubscription["plan"];
  memberCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    email: string;
    name: string;
  };
  joinedAt: string;
}

// ============ GitHub Integration Types ============

export interface GitHubAccount {
  id: string;
  username: string;
  avatarUrl: string;
  isConnected: boolean;
  connectedAt: string;
}

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  defaultBranch: string;
  language?: string;
  lastPushAt?: string;
  isConnected: boolean;
}

export interface GitHubStatus {
  connected: boolean;
  account?: GitHubAccount;
  repositories: GitHubRepository[];
  lastSyncAt?: string;
}

// ============ Audit Types ============

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============ Advanced Security Types ============

export interface SecurityAnalytics {
  timeRange: string;
  trends: {
    findingsOverTime: Array<{ date: string; count: number }>;
    severityDistribution: Record<FindingSeverity, number>;
    topVulnerabilities: Array<{ rule: string; count: number }>;
  };
  metrics: {
    mttr: number; // Mean time to remediate
    openIssues: number;
    resolvedThisWeek: number;
    scanCoverage: number;
  };
}

// ============ Container & IaC Types ============

export interface ContainerScanResult {
  imageId: string;
  imageName: string;
  tag: string;
  vulnerabilities: Vulnerability[];
  layers: ContainerLayer[];
  scanDate: string;
}

export interface ContainerLayer {
  id: string;
  command: string;
  size: number;
  vulnerabilities: number;
}

export interface IaCFinding {
  id: string;
  resourceType: string;
  resourceName: string;
  rule: string;
  severity: FindingSeverity;
  message: string;
  file: string;
  line: number;
  remediation?: string;
}

// ============ Supply Chain Types ============

export interface DependencyInfo {
  name: string;
  version: string;
  type: "direct" | "transitive";
  license?: string;
  vulnerabilities: Vulnerability[];
  outdated: boolean;
  latestVersion?: string;
}

export interface SupplyChainReport {
  dependencies: DependencyInfo[];
  totalDependencies: number;
  vulnerableDependencies: number;
  outdatedDependencies: number;
  licenseIssues: number;
}

// ============ Usage & Metering Types ============

export interface UsageRecord {
  id: string;
  userId: string;
  type: "scan" | "reality_run" | "ai_agent_run";
  count: number;
  period: string;
  createdAt: string;
}

export interface UsageLimits {
  scans: { used: number; limit: number };
  realityRuns: { used: number; limit: number };
  aiAgentRuns: { used: number; limit: number };
}

// ============ guardrail Rules Types ============

export interface GuardrailRule {
  id: string;
  naturalLanguage: string;
  pattern: string;
  category: "security" | "quality" | "behavior" | "custom";
  severity: "block" | "warn" | "info";
  enabled: boolean;
  createdAt: string;
  userId?: string;
}

export interface ParsedRuleResponse {
  rule: GuardrailRule;
  parsedKeywords: string[];
  confidence: number;
}

export interface ValidationResult {
  id: string;
  passed: boolean;
  score: number;
  stages: ValidationStage[];
  findings: ValidationFinding[];
  timestamp: string;
}

export interface ValidationStage {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "warning";
  duration: number;
  message?: string;
}

export interface ValidationFinding {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  line?: number;
  column?: number;
  code?: string;
  suggestedFix?: string;
  confidence: number;
  ruleId: string;
}

// ============ Autopilot Types ============

export interface AutopilotConfig {
  enabled: boolean;
  schedule: "daily" | "weekly" | "on_push";
  notifications: {
    email: boolean;
    slack: boolean;
    slackWebhook?: string;
  };
  autoFix: boolean;
  autoPR: boolean;
}

export interface AutopilotRun {
  id: string;
  projectId: string;
  status: RunStatus;
  findings: number;
  fixed: number;
  prUrl?: string;
  startedAt: string;
  completedAt?: string;
}

// ============ Deploy Hooks Types ============

export interface DeployHook {
  id: string;
  projectId: string;
  provider: "vercel" | "netlify" | "railway" | "github";
  webhookUrl: string;
  secret: string;
  enabled: boolean;
  createdAt: string;
}

export interface DeployEvent {
  id: string;
  hookId: string;
  provider: string;
  status: "pending" | "approved" | "blocked";
  verdict: RunVerdict;
  score: number;
  commitSha?: string;
  branch?: string;
  timestamp: string;
}
