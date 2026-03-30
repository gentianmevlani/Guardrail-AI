/**
 * Input Validation Middleware for Fastify
 *
 * Provides comprehensive request validation using Zod schemas
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodSchema, ZodError } from "zod";

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  files?: ZodSchema;
}

/**
 * Validation middleware factory
 */
export function validateInput(options: ValidationOptions) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      // Validate request body
      if (options.body) {
        const validatedBody = options.body.parse(request.body);
        request.body = validatedBody;
      }

      // Validate query parameters
      if (options.query) {
        const validatedQuery = options.query.parse(request.query);
        request.query = validatedQuery;
      }

      // Validate route parameters
      if (options.params) {
        const validatedParams = options.params.parse(request.params);
        request.params = validatedParams;
      }

      // Validate files if present
      if (options.files && (request as any).file) {
        // File validation handled by validateFileUpload middleware
      }

      // Validate headers
      if (options.headers) {
        const validatedHeaders = options.headers.parse(request.headers);
        request.headers = validatedHeaders;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        reply.status(400).send({
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: errors,
        });
        return;
      }

      reply.status(400).send({
        success: false,
        error: "Invalid input",
        code: "INVALID_INPUT",
      });
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID parameter validation
  uuidParam: z.object({
    id: z.string().uuid("Invalid ID format"),
  }),

  // Pagination query validation
  pagination: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => parseInt(val || "1", 10)),
    limit: z
      .string()
      .optional()
      .transform((val) => parseInt(val || "20", 10)),
    offset: z
      .string()
      .optional()
      .transform((val) => parseInt(val || "0", 10)),
  }),

  // Date range validation
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // Email validation
  email: z.string().email("Invalid email format"),

  // Password validation
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),

  // Project validation
  createProject: z.object({
    name: z
      .string()
      .min(1, "Project name is required")
      .max(100, "Project name too long"),
    description: z.string().max(500, "Description too long").optional(),
    path: z.string().optional(),
    repositoryUrl: z.string().url("Invalid repository URL").optional(),
  }),

  updateProject: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    path: z.string().optional(),
    repositoryUrl: z.string().url().optional(),
  }),

  // Agent validation
  registerAgent: z.object({
    agentId: z.string().min(1, "Agent ID is required"),
    name: z.string().min(1, "Agent name is required"),
    type: z.string().min(1, "Agent type is required"),
    model: z.string().optional(),
    scope: z.object({
      filesystem: z.any(),
      network: z.any(),
      shell: z.any(),
      resources: z.any(),
    }),
  }),

  updatePermissions: z.object({
    filesystem: z.any().optional(),
    network: z.any().optional(),
    shell: z.any().optional(),
    resources: z.any().optional(),
  }),

  // Authentication validation
  register: z.object({
    email: z.string().email("Invalid email format"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    name: z.string().min(1, "Name is required").max(100, "Name too long"),
  }),

  login: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),

  // Code analysis validation
  analyzeCode: z.object({
    code: z.string().min(1, "Code is required"),
    filename: z.string().optional(),
    experienceLevel: z
      .enum(["beginner", "intermediate", "advanced"])
      .optional(),
  }),

  askQuestion: z.object({
    code: z.string().min(1, "Code is required"),
    question: z.string().min(1, "Question is required"),
    provider: z.enum(["openai", "anthropic"]).optional(),
  }),

  // Search validation
  searchQuery: z.object({
    query: z.string().min(1, "Search query is required"),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),

  findSimilar: z.object({
    code: z.string().min(1, "Code snippet is required"),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),

  // Directory validation
  directoryPath: z.object({
    directory: z.string().min(1, "Directory path is required"),
  }),

  // Usage tracking validation
  trackUsage: z.object({
    type: z.string().min(1, "Usage type is required"),
    projectId: z.string().uuid().optional(),
    metadata: z.record(z.any()).optional(),
  }),
};

/**
 * Sanitization middleware
 */
export function sanitizeInput(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  // Sanitize string fields in body
  if (request.body && typeof request.body === "object") {
    sanitizeObject(request.body);
  }

  // Sanitize query parameters
  if (request.query && typeof request.query === "object") {
    sanitizeObject(request.query);
  }

  done();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      // Remove potential XSS attacks
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .trim();
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z
    .string()
    .regex(/^(image|text|application)\/(jpeg|png|gif|jpg|plain|pdf|json|xml)$/),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  content: z.any(), // Buffer or stream
});

/**
 * Validate file upload
 */
export function validateFileUpload() {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const file = await (request as any).file();

      if (!file) {
        reply.status(400).send({
          success: false,
          error: "No file uploaded",
          code: "NO_FILE",
        });
        return;
      }

      fileUploadSchema.parse({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.file.bytesRead,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          success: false,
          error: "Invalid file",
          code: "INVALID_FILE",
          details: error.errors,
        });
        return;
      }

      reply.status(400).send({
        success: false,
        error: "File validation failed",
        code: "FILE_VALIDATION_FAILED",
      });
    }
  };
}
