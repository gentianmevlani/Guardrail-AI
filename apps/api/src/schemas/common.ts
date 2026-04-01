/**
 * Common API schemas for OpenAPI documentation
 * 
 * This file contains reusable schemas that can be used across all routes
 * to ensure consistent API documentation and validation.
 */

import { z } from "zod";

// ============================================================================
// COMMON RESPONSE SCHEMAS
// ============================================================================

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any().optional(),
  message: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
  code: z.string().optional(),
});

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0),
  pages: z.number().int().min(0),
});

export const PaginatedResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    items: z.array(z.any()),
    pagination: PaginationSchema,
  }),
});

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const AuthResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    token: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      createdAt: z.string(),
    }),
  }),
});

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  path: z.string().optional(),
  repositoryUrl: z.string().url().optional().or(z.literal("")),
});

export const UpdateProjectRequestSchema = CreateProjectRequestSchema.partial();

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  path: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProjectStatsSchema = z.object({
  totalScans: z.number(),
  lastScanAt: z.string().nullable(),
  issuesFound: z.number(),
  criticalIssues: z.number(),
});

// ============================================================================
// SCAN SCHEMAS
// ============================================================================

export const CreateScanRequestSchema = z.object({
  repositoryId: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
  localPath: z.string().optional(),
  branch: z.string().default("main"),
  enableLLM: z.boolean().default(false),
  llmProvider: z.enum(["openai", "anthropic"]).optional(),
  llmApiKey: z.string().optional(),
}).refine(
  (data) => data.repositoryId || data.repositoryUrl || data.localPath,
  "Either repositoryId, repositoryUrl, or localPath is required",
);

export const ScanSchema = z.object({
  id: z.string(),
  repositoryId: z.string().nullable(),
  projectPath: z.string().nullable(),
  branch: z.string(),
  commitSha: z.string().nullable(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  progress: z.number().min(0).max(100),
  verdict: z.enum(["pass", "fail", "review"]).nullable(),
  score: z.number().min(0).max(100).nullable(),
  metrics: z.object({
    filesScanned: z.number(),
    linesScanned: z.number(),
    issuesFound: z.number(),
    criticalCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
    durationMs: z.number().nullable(),
  }),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FindingSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  category: z.string(),
  file: z.string(),
  line: z.number(),
  column: z.number().nullable(),
  endLine: z.number().nullable(),
  endColumn: z.number().nullable(),
  title: z.string(),
  message: z.string(),
  codeSnippet: z.string().nullable(),
  suggestion: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  aiExplanation: z.string().nullable(),
  aiGenerated: z.boolean(),
  status: z.string(),
  ruleId: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string(),
});

// ============================================================================
// BILLING SCHEMAS
// ============================================================================

export const PricingTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  features: z.array(z.string()),
  limits: z.object({
    scans: z.number(),
    realityRuns: z.number(),
    aiAgentRuns: z.number(),
  }),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tier: z.string(),
  status: z.enum(["active", "canceled", "past_due", "unpaid"]),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
});

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  memberCount: z.number(),
});

export const OrganizationMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.enum(["owner", "admin", "member"]),
  joinedAt: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()),
  expiresIn: z.number().optional(), // Duration in seconds
});

export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(), // Only shown on creation
  keyPreview: z.string(), // Last 4 characters
  permissions: z.array(z.string()),
  userId: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

// ============================================================================
// USAGE SCHEMAS
// ============================================================================

export const UsageStatsSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  metrics: z.object({
    scans: z.object({
      used: z.number(),
      limit: z.number(),
    }),
    realityRuns: z.object({
      used: z.number(),
      limit: z.number(),
    }),
    aiAgentRuns: z.object({
      used: z.number(),
      limit: z.number(),
    }),
  }),
});

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

export const PaginationQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n >= 1, "Page must be >= 1").default("1"),
  limit: z.string().transform(Number).refine(n => n >= 1 && n <= 100, "Limit must be between 1 and 100").default("20"),
});

export const DateRangeQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const SortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================================
// OPENAPI CONFIGURATION
// ============================================================================

export const getOpenApiSchemas = () => ({
  SuccessResponse: SuccessResponseSchema,
  ErrorResponse: ErrorResponseSchema,
  Pagination: PaginationSchema,
  PaginatedResponse: PaginatedResponseSchema,
  
  // Auth
  LoginRequest: LoginRequestSchema,
  RegisterRequest: RegisterRequestSchema,
  AuthResponse: AuthResponseSchema,
  
  // Projects
  CreateProjectRequest: CreateProjectRequestSchema,
  UpdateProjectRequest: UpdateProjectRequestSchema,
  Project: ProjectSchema,
  ProjectStats: ProjectStatsSchema,
  
  // Scans
  CreateScanRequest: CreateScanRequestSchema,
  Scan: ScanSchema,
  Finding: FindingSchema,
  
  // Billing
  PricingTier: PricingTierSchema,
  Subscription: SubscriptionSchema,
  
  // Organizations
  CreateOrganizationRequest: CreateOrganizationRequestSchema,
  Organization: OrganizationSchema,
  OrganizationMember: OrganizationMemberSchema,
  
  // API Keys
  CreateApiKeyRequest: CreateApiKeyRequestSchema,
  ApiKey: ApiKeySchema,
  
  // Usage
  UsageStats: UsageStatsSchema,
  
  // Query Parameters
  PaginationQuery: PaginationQuerySchema,
  DateRangeQuery: DateRangeQuerySchema,
  SortQuery: SortQuerySchema,
});

// ============================================================================
// FASTIFY SCHEMA HELPERS
// ============================================================================

export const createRouteSchema = (routeConfig: {
  tags?: string[];
  summary?: string;
  description?: string;
  params?: z.ZodSchema;
  querystring?: z.ZodSchema;
  body?: z.ZodSchema;
  response?: Record<number, z.ZodSchema>;
  security?: unknown[];
}) => ({
  tags: routeConfig.tags || [],
  summary: routeConfig.summary || "",
  description: routeConfig.description || "",
  params: routeConfig.params ? { schema: routeConfig.params } : undefined,
  querystring: routeConfig.querystring ? { schema: routeConfig.querystring } : undefined,
  body: routeConfig.body ? { schema: routeConfig.body } : undefined,
  response: routeConfig.response ? Object.fromEntries(
    Object.entries(routeConfig.response).map(([code, schema]) => [code, { schema }])
  ) : undefined,
  security: routeConfig.security || [{ Bearer: [] }],
});

export const createPaginatedRouteSchema = (itemSchema: z.ZodSchema, routeConfig: any = {}) => 
  createRouteSchema({
    ...routeConfig,
    querystring: PaginationQuerySchema.merge(routeConfig.querystring || {}),
    response: {
      200: PaginatedResponseSchema.extend({
        data: z.object({
          items: z.array(itemSchema),
          pagination: PaginationSchema,
        }),
      }),
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  });
