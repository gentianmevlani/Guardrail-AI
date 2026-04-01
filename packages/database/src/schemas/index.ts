/**
 * Zod Validation Schemas for Prisma Json Fields
 *
 * These schemas provide runtime validation for Json fields in the Prisma schema.
 * Use them when reading/writing Json data to ensure type safety.
 */

import { z } from "zod";

// ==========================================
// COMPLIANCE SCHEMAS
// ==========================================

export const ComplianceEvidenceSchema = z.object({
  files: z.array(z.string()).default([]),
  screenshots: z.array(z.string().url()).default([]),
  notes: z.string().optional(),
  collectedAt: z.string().datetime().optional(),
  collectedBy: z.string().optional(),
});

export const ComplianceSummarySchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(["compliant", "non-compliant", "partial", "not-assessed"]),
  controlsPassed: z.number().int().min(0),
  controlsFailed: z.number().int().min(0),
  controlsTotal: z.number().int().min(0),
  lastAssessedAt: z.string().datetime().optional(),
});

export const ComplianceControlSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pass", "fail", "partial", "not-applicable"]),
  score: z.number().min(0).max(100).optional(),
  evidence: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ComplianceGapsSchema = z.array(
  z.object({
    controlId: z.string(),
    description: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    recommendation: z.string().optional(),
    dueDate: z.string().datetime().optional(),
  }),
);

// ==========================================
// AGENT SCHEMAS
// ==========================================

export const AgentPermissionsSchema = z.object({
  fileRead: z.boolean().default(true),
  fileWrite: z.boolean().default(false),
  execute: z.boolean().default(false),
  networkAccess: z.boolean().default(false),
  allowedPaths: z.array(z.string()).default([]),
  blockedPaths: z.array(z.string()).default([]),
  maxTokens: z.number().int().positive().optional(),
  rateLimit: z.number().int().positive().optional(),
});

export const AgentMetadataSchema = z.object({
  version: z.string().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const AgentActionMetadataSchema = z.object({
  duration: z.number().int().min(0).optional(),
  inputSize: z.number().int().min(0).optional(),
  outputSize: z.number().int().min(0).optional(),
  error: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

// ==========================================
// USAGE & ANALYTICS SCHEMAS
// ==========================================

export const UsageMetadataSchema = z.object({
  endpoint: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.number().int().optional(),
  duration: z.number().int().min(0).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  model: z.string().optional(),
});

export const AnalyticsPropertiesSchema = z.record(z.unknown());

// ==========================================
// CODE EVOLUTION SCHEMAS
// ==========================================

export const CodePatternSchema = z.object({
  name: z.string(),
  count: z.number().int().min(0),
  files: z.array(z.string()).default([]),
  trend: z.enum(["increasing", "decreasing", "stable"]).optional(),
});

export const CodeMetricsSchema = z.object({
  totalFiles: z.number().int().min(0),
  totalLines: z.number().int().min(0),
  complexity: z.number().min(0).optional(),
  coverage: z.number().min(0).max(100).optional(),
  duplication: z.number().min(0).max(100).optional(),
});

export const CodeChangesSchema = z.object({
  added: z.number().int().min(0),
  removed: z.number().int().min(0),
  modified: z.number().int().min(0),
  files: z.array(z.string()).default([]),
});

// ==========================================
// DESIGN SYSTEM SCHEMAS
// ==========================================

export const DesignTokensSchema = z.object({
  colors: z.record(z.string()).default({}),
  spacing: z.record(z.string()).default({}),
  typography: z.record(z.unknown()).default({}),
  shadows: z.record(z.string()).default({}),
  breakpoints: z.record(z.string()).default({}),
});

export const DesignComponentSchema = z.object({
  name: z.string(),
  path: z.string(),
  props: z.array(z.string()).default([]),
  variants: z.array(z.string()).default([]),
  usageCount: z.number().int().min(0).default(0),
});

// ==========================================
// TENANT SCHEMAS
// ==========================================

export const TenantSettingsSchema = z.object({
  branding: z
    .object({
      logo: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
  features: z.record(z.boolean()).default({}),
  notifications: z
    .object({
      email: z.boolean().default(true),
      slack: z.boolean().default(false),
      webhookUrl: z.string().url().optional(),
    })
    .optional(),
});

export const TenantLimitsSchema = z.object({
  maxUsers: z.number().int().positive().default(5),
  maxProjects: z.number().int().positive().default(10),
  maxScansPerMonth: z.number().int().positive().default(100),
  maxStorageGB: z.number().positive().default(10),
});

export const TenantUsageSchema = z.object({
  users: z.number().int().min(0).default(0),
  projects: z.number().int().min(0).default(0),
  scansThisMonth: z.number().int().min(0).default(0),
  storageUsedGB: z.number().min(0).default(0),
  lastUpdated: z.string().datetime().optional(),
});

// ==========================================
// SECURITY SCHEMAS
// ==========================================

export const AttackPathSchema = z.object({
  id: z.string(),
  name: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  steps: z.array(z.string()),
  mitigations: z.array(z.string()).default([]),
});

export const ThreatSchema = z.object({
  type: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  description: z.string(),
  cve: z.string().optional(),
  fixVersion: z.string().optional(),
});

export const SBOMComponentSchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.enum(["library", "framework", "application", "file", "container"]),
  purl: z.string().optional(),
  licenses: z.array(z.string()).default([]),
  hashes: z.record(z.string()).default({}),
});

// ==========================================
// ALERT SCHEMAS
// ==========================================

export const AlertRecipientsSchema = z.object({
  emails: z.array(z.string().email()).default([]),
  slackChannels: z.array(z.string()).default([]),
  webhooks: z.array(z.string().url()).default([]),
});

export const AlertConditionsSchema = z.object({
  threshold: z.number().optional(),
  operator: z.enum(["gt", "lt", "eq", "gte", "lte"]).optional(),
  timeWindow: z.number().int().positive().optional(),
  cooldown: z.number().int().positive().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type ComplianceEvidence = z.infer<typeof ComplianceEvidenceSchema>;
export type ComplianceSummary = z.infer<typeof ComplianceSummarySchema>;
export type ComplianceControl = z.infer<typeof ComplianceControlSchema>;
export type ComplianceGaps = z.infer<typeof ComplianceGapsSchema>;
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;
export type AgentActionMetadata = z.infer<typeof AgentActionMetadataSchema>;
export type UsageMetadata = z.infer<typeof UsageMetadataSchema>;
export type AnalyticsProperties = z.infer<typeof AnalyticsPropertiesSchema>;
export type CodePattern = z.infer<typeof CodePatternSchema>;
export type CodeMetrics = z.infer<typeof CodeMetricsSchema>;
export type CodeChanges = z.infer<typeof CodeChangesSchema>;
export type DesignTokens = z.infer<typeof DesignTokensSchema>;
export type DesignComponent = z.infer<typeof DesignComponentSchema>;
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
export type TenantLimits = z.infer<typeof TenantLimitsSchema>;
export type TenantUsage = z.infer<typeof TenantUsageSchema>;
export type AttackPath = z.infer<typeof AttackPathSchema>;
export type Threat = z.infer<typeof ThreatSchema>;
export type SBOMComponent = z.infer<typeof SBOMComponentSchema>;
export type AlertRecipients = z.infer<typeof AlertRecipientsSchema>;
export type AlertConditions = z.infer<typeof AlertConditionsSchema>;

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Safely parse JSON data with a Zod schema
 * Returns the validated data or null if validation fails
 */
export function safeParseJson<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse JSON data with a Zod schema, throwing on validation errors
 */
export function parseJson<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate JSON data against a schema without parsing
 * Returns true if valid, false otherwise
 */
export function validateJson<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): boolean {
  return schema.safeParse(data).success;
}
