/**
 * API Response Utilities
 *
 * Standardized response helpers for consistent API responses
 */

import { FastifyReply } from "fastify";

// ==========================================
// RESPONSE TYPES
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  details?: unknown;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ==========================================
// ERROR CODES
// ==========================================

export const ErrorCodes = {
  // Authentication
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_EXISTS: "USER_EXISTS",

  // Authorization
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ==========================================
// RESPONSE HELPERS
// ==========================================

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
): FastifyReply {
  return reply.status(statusCode).send({
    success: true,
    data,
  });
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(reply: FastifyReply, data: T): FastifyReply {
  return reply.status(201).send({
    success: true,
    data,
  });
}

/**
 * Send a no-content response (204)
 */
export function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

/**
 * Send an error response
 */
export function sendError(
  reply: FastifyReply,
  error: string,
  statusCode = 500,
  code?: ErrorCode,
  details?: unknown,
): FastifyReply {
  const response: ApiResponse = {
    success: false,
    error,
  };

  if (code) response.code = code;
  if (details) response.details = details;

  return reply.status(statusCode).send(response);
}

/**
 * Send a validation error response
 */
export function sendValidationError(
  reply: FastifyReply,
  errors: unknown,
): FastifyReply {
  return reply.status(400).send({
    success: false,
    error: "Validation failed",
    code: ErrorCodes.VALIDATION_ERROR,
    details: errors,
  });
}

/**
 * Send an unauthorized response
 */
export function sendUnauthorized(
  reply: FastifyReply,
  message = "Authentication required",
  code: ErrorCode = ErrorCodes.AUTH_REQUIRED,
): FastifyReply {
  return reply.status(401).send({
    success: false,
    error: message,
    code,
  });
}

/**
 * Send a forbidden response
 */
export function sendForbidden(
  reply: FastifyReply,
  message = "Access denied",
  code: ErrorCode = ErrorCodes.FORBIDDEN,
): FastifyReply {
  return reply.status(403).send({
    success: false,
    error: message,
    code,
  });
}

/**
 * Send a not found response
 */
export function sendNotFound(
  reply: FastifyReply,
  resource = "Resource",
): FastifyReply {
  return reply.status(404).send({
    success: false,
    error: `${resource} not found`,
    code: ErrorCodes.NOT_FOUND,
  });
}

/**
 * Send a conflict response
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
): FastifyReply {
  return reply.status(409).send({
    success: false,
    error: message,
    code: ErrorCodes.CONFLICT,
  });
}

/**
 * Send a rate limit response
 */
export function sendRateLimited(
  reply: FastifyReply,
  retryAfter?: number,
): FastifyReply {
  if (retryAfter) {
    reply.header("Retry-After", retryAfter.toString());
  }
  return reply.status(429).send({
    success: false,
    error: "Too many requests",
    code: ErrorCodes.RATE_LIMITED,
  });
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  reply: FastifyReply,
  items: T[],
  total: number,
  limit: number,
  offset: number,
): FastifyReply {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return reply.send({
    success: true,
    data: {
      items,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
        hasMore: offset + items.length < total,
      },
    },
  });
}

// ==========================================
// ERROR HANDLER FACTORY
// ==========================================

interface ErrorMapping {
  pattern: string | RegExp;
  status: number;
  code: ErrorCode;
  message?: string;
}

const defaultErrorMappings: ErrorMapping[] = [
  { pattern: "already exists", status: 409, code: ErrorCodes.ALREADY_EXISTS },
  { pattern: "not found", status: 404, code: ErrorCodes.NOT_FOUND },
  {
    pattern: "Invalid email or password",
    status: 401,
    code: ErrorCodes.INVALID_CREDENTIALS,
  },
  {
    pattern: "Invalid or expired",
    status: 401,
    code: ErrorCodes.INVALID_TOKEN,
  },
  { pattern: "incorrect", status: 400, code: ErrorCodes.INVALID_INPUT },
  { pattern: "unauthorized", status: 401, code: ErrorCodes.AUTH_REQUIRED },
  { pattern: "forbidden", status: 403, code: ErrorCodes.FORBIDDEN },
];

/**
 * Handle errors with automatic mapping to appropriate responses
 */
export function handleError(
  reply: FastifyReply,
  error: unknown,
  customMappings?: ErrorMapping[],
): FastifyReply {
  const err = error as Error;
  const message = err.message || "An unexpected error occurred";
  const mappings = [...(customMappings || []), ...defaultErrorMappings];

  for (const mapping of mappings) {
    const matches =
      typeof mapping.pattern === "string"
        ? message.toLowerCase().includes(mapping.pattern.toLowerCase())
        : mapping.pattern.test(message);

    if (matches) {
      return sendError(
        reply,
        mapping.message || message,
        mapping.status,
        mapping.code,
      );
    }
  }

  // Default to internal server error
  return sendError(reply, message, 500, ErrorCodes.INTERNAL_ERROR);
}
