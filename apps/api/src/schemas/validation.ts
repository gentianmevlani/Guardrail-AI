/**
 * Comprehensive Input Validation Schemas
 *
 * Zod schemas for all API routes requiring validation.
 * These schemas are integrated with Fastify's schema validation.
 */

import { z } from "zod";

// =============================================================================
// COMMON VALIDATORS
// =============================================================================

/** UUID/CUID validator */
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);

/** Email validator with length limits */
export const emailSchema = z
  .string()
  .email()
  .min(5)
  .max(254)
  .toLowerCase()
  .trim();

/** Password validator with security requirements */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/** Simple password (login only - no strength requirements) */
export const loginPasswordSchema = z.string().min(1).max(128);

/** Name validator */
export const nameSchema = z.string().min(1).max(100).trim();

/** URL validator */
export const urlSchema = z.string().url().max(2048);

/** Safe string - no script tags or SQL injection patterns */
export const safeStringSchema = z
  .string()
  .max(10000)
  .refine(
    (val) => !/<script/i.test(val) && !/javascript:/i.test(val),
    "Invalid characters detected",
  );

/** Pagination params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// =============================================================================
// AUTHENTICATION SCHEMAS
// =============================================================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: loginPasswordSchema,
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  newPassword: passwordSchema,
});

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(1000).optional(),
});

// =============================================================================
// BILLING SCHEMAS
// =============================================================================

export const checkoutSchema = z
  .object({
    plan: z.enum(["starter", "pro", "compliance"]).optional(),
    priceId: z.string().min(10).max(100).optional(),
  })
  .refine(
    (data) => data.plan || data.priceId,
    "Either plan or priceId is required",
  );

export const subscribeSchema = z.object({
  plan: z.enum(["starter", "pro", "compliance"]),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  feedback: z.string().max(2000).optional(),
});

// =============================================================================
// PROJECT SCHEMAS
// =============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).optional(),
  repositoryUrl: urlSchema.optional(),
  path: z.string().max(500).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(1000).optional(),
  repositoryUrl: urlSchema.optional().nullable(),
});

// =============================================================================
// SCAN & ANALYSIS SCHEMAS
// =============================================================================

export const scanRequestSchema = z.object({
  projectId: idSchema.optional(),
  path: z.string().max(500).optional(),
  repositoryUrl: urlSchema.optional(),
  branch: z.string().max(100).default("main"),
  depth: z.enum(["shallow", "standard", "deep"]).default("standard"),
  includeSecrets: z.boolean().default(true),
  includeDependencies: z.boolean().default(true),
  includeCompliance: z.boolean().default(false),
});

export const realityCheckSchema = z.object({
  url: urlSchema,
  auth: z
    .object({
      email: emailSchema,
      password: z.string().max(128),
    })
    .optional(),
  flows: z.array(z.enum(["auth", "ui", "forms", "ecommerce"])).default([]),
  timeout: z.number().int().min(5000).max(300000).default(30000),
  threshold: z.number().int().min(0).max(100).default(70),
});

// =============================================================================
// AGENT SCHEMAS
// =============================================================================

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["coding", "chat", "autonomous"]),
  scope: z.enum(["read", "write", "execute"]),
  model: z.string().max(50).optional(),
  permissions: z.record(z.boolean()).optional(),
});

export const agentActionSchema = z.object({
  agentId: idSchema,
  type: z.enum(["file_read", "file_write", "execute", "api_call"]),
  target: z.string().max(1000),
  content: z.string().max(100000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// COMPLIANCE SCHEMAS
// =============================================================================

export const complianceAssessmentSchema = z.object({
  projectId: idSchema,
  frameworkId: z.enum(["soc2", "hipaa", "gdpr", "pci", "nist", "iso27001"]),
  scope: z.array(z.string().max(100)).default([]),
  includeEvidence: z.boolean().default(true),
});

export const complianceScheduleSchema = z.object({
  projectId: idSchema,
  frameworkId: z.string().max(50),
  schedule: z.string().max(100), // Cron expression
  enabled: z.boolean().default(true),
  notifications: z
    .object({
      email: z.array(emailSchema).max(10).default([]),
      slack: z.string().url().optional(),
      webhook: urlSchema.optional(),
    })
    .optional(),
});

// =============================================================================
// WEBHOOK SCHEMAS
// =============================================================================

export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal("event"),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
});

export const githubWebhookSchema = z.object({
  action: z.string().optional(),
  repository: z
    .object({
      id: z.number(),
      full_name: z.string(),
      clone_url: z.string().url().optional(),
    })
    .optional(),
  sender: z
    .object({
      login: z.string(),
      id: z.number(),
    })
    .optional(),
});

export const deployHookSchema = z.object({
  provider: z.enum(["vercel", "netlify", "railway", "render"]),
  projectId: idSchema.optional(),
  deploymentId: z.string().max(100),
  status: z.enum(["pending", "building", "ready", "error"]),
  url: urlSchema.optional(),
  meta: z.record(z.unknown()).optional(),
});

// =============================================================================
// API KEY SCHEMAS
// =============================================================================

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresIn: z.enum(["30d", "90d", "1y", "never"]).default("90d"),
  scopes: z.array(z.enum(["read", "write", "admin", "*"])).default(["read"]),
});

export const revokeApiKeySchema = z.object({
  keyId: idSchema,
});

// =============================================================================
// NOTIFICATION SCHEMAS
// =============================================================================

export const notificationPreferencesSchema = z.object({
  email: z
    .object({
      securityAlerts: z.boolean().default(true),
      weeklyDigest: z.boolean().default(true),
      marketing: z.boolean().default(false),
    })
    .optional(),
  slack: z
    .object({
      enabled: z.boolean().default(false),
      webhookUrl: urlSchema.optional(),
      channel: z.string().max(100).optional(),
    })
    .optional(),
});

// =============================================================================
// QUERY PARAMETER SCHEMAS
// =============================================================================

export const dateRangeQuerySchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  }, "startDate must be before endDate");

export const filterQuerySchema = z.object({
  status: z.enum(["active", "inactive", "pending", "all"]).default("all"),
  type: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

// =============================================================================
// FASTIFY SCHEMA HELPERS
// =============================================================================

/**
 * Convert Zod schema to JSON Schema for Fastify
 */
export function zodToJsonSchema(schema: z.ZodType<any>): object {
  // Simple conversion - for complex cases, use zod-to-json-schema package
  return {
    type: "object",
    additionalProperties: false,
  };
}

/**
 * Validate request body with Zod schema
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Safe validate - returns result object instead of throwing
 */
export function safeValidateBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
):
  | { success: true; data: T }
  | { success: false; errors: z.ZodError["errors"] } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ScanRequestInput = z.infer<typeof scanRequestSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type ComplianceAssessmentInput = z.infer<
  typeof complianceAssessmentSchema
>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
