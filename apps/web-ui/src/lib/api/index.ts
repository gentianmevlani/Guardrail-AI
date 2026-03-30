/**
 * guardrail Web UI API
 *
 * Centralized API client split by domain for better maintainability.
 * Import from '@/lib/api' for backwards compatibility.
 */

// Core utilities and helpers
export {
  API_BASE,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  // New typed helpers
  apiRequest,
  // Error class
  ApiRequestError,
  checkApiHealth,
  getAccessToken,
  getApiStatus,
  logger,
  refreshAccessToken,
  resilientFetch,
  // Token management
  setAccessToken,
} from "./core";
export type { ApiError, ApiResponse, FetchConfig, FetchResult } from "./core";

// Comprehensive shared types
export * from "./types";

// Authentication
export {
  fetchUserProfile,
  getCurrentUser,
  logout,
  updateUserProfile,
  type UserProfile,
} from "./auth";

// GitHub Integration
export {
  connectGitHub,
  disconnectGitHub,
  getGitHubStatus,
  syncGitHubRepos,
  type GitHubRepository,
  type GitHubStatus,
} from "./github";

// Dashboard, Metrics, Activity
export {
  fetchActivities,
  fetchDashboardMetrics,
  fetchDashboardSummary,
  fetchHealthScore,
  fetchNotifications,
  fetchPaymentMethods,
  fetchProjects,
  fetchRecentActivity,
  fetchSystemStatus,
  fetchTenants,
  markNotificationsRead,
  updateTenantPlan,
  type Activity,
  type ActivityEvent,
  type AppNotification,
  type DashboardMetrics,
  type DashboardSummary,
  type HealthScore,
  type NotificationsResponse,
  type PaymentMethod,
  type Project,
  type SystemStatus,
  type Tenant,
} from "./dashboard";

// Security, Vulnerabilities, Findings
export {
  fetchAuditLogs,
  fetchFindings,
  fetchSecurityAnalytics,
  fetchVulnerabilities,
  triggerDeepScan,
  updateFindingStatus,
  type AuditLog,
  type Finding,
  type FindingsResponse,
  type SecurityAnalytics,
  type Vulnerability,
} from "./security";

// Compliance
export {
  fetchComplianceDashboard,
  fetchComplianceReports,
  type ComplianceDashboard,
  type ComplianceReport,
} from "./compliance";

// Policies
export {
  fetchPolicies,
  updatePolicy,
  type PoliciesData,
  type PolicyAllowlistEntry,
  type PolicyProfile,
  type PolicyRule,
} from "./policies";

// Ship Check, MockProof, Reality Mode
export {
  getShipCheckHistory,
  runShipCheck,
  runShipMockproof,
  runShipRealityMode,
  type AirlockDependency,
  type BadgeCheck,
  type MockProofViolation,
  type RealityStep,
  type ShipCheckGateResult,
  type ShipCheckOptions,
  type ShipCheckResponse,
  type ShipCheckResult,
  type ShipHistoryEntry,
} from "./ship";

// Runs
export {
  fetchRunDetail,
  previewFixDiff,
  applyFixPack,
  type FixDiff,
  type ApplyFixResult,
  type RunDetail,
  type RunDetailAirlockResult,
  type RunDetailArtifact,
  type RunDetailFinding,
  type RunDetailGate,
  type RunDetailMockProofTrace,
} from "./runs";

// Settings
export {
  getNotificationPreferences,
  updateNotificationPreferences,
  getScanPreferences,
  updateScanPreferences,
  getAppearancePreferences,
  updateAppearancePreferences,
  // Webhooks
  getWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  testWebhookEndpoint,
  getWebhookDeliveries,
  // MFA
  getMFAStatus,
  setupMFA,
  verifyMFASetup,
  disableMFA,
  type NotificationPreferences,
  type ScanPreferences,
  type AppearancePreferences,
  type WebhookEndpoint,
  type WebhookDelivery,
  type WebhookTestResult,
  type MFAStatus,
  type MFASetupResponse,
} from "./settings";

// Advanced Security (Container, IaC, Supply Chain, PII, etc.)
export {
  // Attack Surface
  analyzeAttackSurface,
  checkLicenseCompliance,
  // Injection Detection
  detectInjection,
  // MCP
  executeMCPTool,
  // Sandbox
  executeSandbox,
  getContainerHistory,
  getDependencyDetails,
  getIaCPolicies,
  listMCPTools,
  // Container
  scanContainer,
  // IaC
  scanIaC,
  // PII
  scanPII,
  // Secrets
  scanSecrets,
  // Supply Chain
  scanSupplyChain,
  // Validation
  validateInput,
  type AttackSurfaceEndpoint,
  type AttackSurfaceRequest,
  type AttackSurfaceResult,
  type ContainerScanRequest,
  type IaCScanRequest,
  type IaCScanResult,
  type InjectionFinding,
  type InjectionScanRequest,
  type InjectionScanResult,
  type MCPToolRequest,
  type MCPToolResponse,
  type PIIFinding,
  type PIIScanRequest,
  type PIIScanResult,
  type SandboxRequest,
  type SandboxResult,
  type SecretFinding,
  type SecretsScanRequest,
  type SecretsScanResult,
  type SupplyChainScanRequest,
  type ValidationRequest,
  type ValidationResult,
} from "./advanced";

// Organizations & Teams
export {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizationBilling,
  getOrganizationMembers,
  getOrganizations,
  getUsageHistory,
  getUsageLimits,
  inviteMember,
  leaveOrganization,
  recordUsage,
  removeMember,
  updateMemberRole,
  updateOrganization,
  upgradeOrganization,
  type CreateOrganizationRequest,
  type InviteMemberRequest,
} from "./organizations";

// Autopilot
export {
  cancelAutopilotRun,
  disableAutopilot,
  enableAutopilot,
  getAutopilotConfig,
  getAutopilotRun,
  getAutopilotRuns,
  getAutopilotStats,
  getDigestConfig,
  sendTestDigest,
  triggerAutopilotRun,
  updateAutopilotConfig,
  updateDigestConfig,
  type AutopilotStats,
  type DigestConfig,
} from "./autopilot";

// Deploy Hooks
export {
  approveDeployEvent,
  blockDeployEvent,
  createDeployHook,
  deleteDeployHook,
  getDeployEvent,
  getDeployEvents,
  getDeployHook,
  getDeployHooks,
  getDeployHookStats,
  getProviderSetupInstructions,
  regenerateHookSecret,
  retryDeployEvent,
  testDeployHook,
  updateDeployHook,
  type CreateDeployHookRequest,
  type DeployHookStats,
  type ProviderSetupInstructions,
} from "./deploy-hooks";

// Billing
export {
  createCustomerPortalSession,
  downloadInvoice,
  fetchBillingHistory,
  fetchBillingUsage,
  fetchExtendedBillingUsage,
  type BillingHistory,
  type BillingUsage,
  type ExtendedBillingUsage,
  type UsageBreakdown,
  type UsageTrendPoint,
} from "./billing";

// Intelligence Suite
export {
  fetchAIAnalysis,
  fetchArchitectureAnalysis,
  fetchIntelligenceFindings,
  fetchIntelligenceOverview,
  fetchMCPStatus,
  fetchPredictiveAnalytics,
  fetchSecurityIntelligence,
  fetchSupplyChainAnalysis,
  fetchTeamIntelligence,
  runAllIntelligenceSuites,
  runIntelligenceSuite,
  type AIAnalysisResult,
  type ArchitectureAnalysisResult,
  type IntelligenceFinding,
  type IntelligenceOverview,
  type IntelligenceSuiteData,
  type MCPStatus,
  type PredictiveAnalyticsResult,
  type SecurityAnalysisResult,
  type SupplyChainResult,
  type TeamIntelligenceResult,
} from "./intelligence";
