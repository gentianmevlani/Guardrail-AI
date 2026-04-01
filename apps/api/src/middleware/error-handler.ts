/**
 * Centralized Error Handling Middleware for Fastify
 *
 * Provides consistent error responses and logging
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { logger } from "../logger";

export interface ApiError extends Error {
  statusCode?: number;
  code: string;
  details?: unknown;
  isOperational?: boolean;
  validation?: unknown;
}

/**
 * Custom API Error class
 */
export class CustomApiError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: unknown;
  isOperational?: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "CustomApiError";
    this.statusCode = statusCode;
    this.code = code || "INTERNAL_ERROR";
    this.details = details;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, CustomApiError);
  }
}

/**
 * Error handler middleware
 */
export async function errorHandler(
  error: ApiError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Log the error with structured logger
  const authRequest = request as FastifyRequest & { user?: { id?: string } };
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      userId: authRequest.user?.id,
      ip: request.ip,
      code: error.code,
    },
    "API Error",
  );

  // Get request ID for correlation
  const requestId = (request as any).requestId || 'unknown';

  // Handle different error types
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
    }));

    reply.status(400).send({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: validationErrors,
      requestId,
      nextSteps: [
        "Review the validation errors above",
        "Check that all required fields are provided",
        "Verify field types match the expected format",
        "See API documentation for correct request format",
      ],
    });
    return;
  }

  // Handle JWT errors
  if (error.name === "JsonWebTokenError") {
    reply.status(401).send({
      success: false,
      error: "Invalid token",
      code: "INVALID_TOKEN",
      requestId,
      nextSteps: [
        "Check that your authentication token is valid",
        "Re-authenticate by logging in again",
        "Verify token hasn't been revoked or expired",
        "Get a new token at https://guardrailai.dev/settings/keys",
      ],
    });
    return;
  }

  if (error.name === "TokenExpiredError") {
    reply.status(401).send({
      success: false,
      error: "Token expired",
      code: "TOKEN_EXPIRED",
      requestId,
      nextSteps: [
        "Your authentication token has expired",
        "Re-authenticate by logging in again",
        "Get a new token at https://guardrailai.dev/settings/keys",
        "For CI/CD, use a long-lived API key instead of JWT tokens",
      ],
    });
    return;
  }

  // Handle Prisma errors
  if (error.name === "PrismaClientKnownRequestError") {
    const prismaError = error as any;

    switch (prismaError.code) {
      case "P2002":
        reply.status(409).send({
          success: false,
          error: "Resource already exists",
          code: "RESOURCE_EXISTS",
          requestId,
          details: {
            field: prismaError.meta?.target?.[0],
          },
          nextSteps: [
            "The resource you're trying to create already exists",
            "Use a different identifier or update the existing resource",
            "Check for duplicate entries in your request",
          ],
        });
        return;

      case "P2025":
        reply.status(404).send({
          success: false,
          error: "Resource not found",
          code: "RESOURCE_NOT_FOUND",
          requestId,
          nextSteps: [
            "Verify the resource ID is correct",
            "Check that the resource hasn't been deleted",
            "Ensure you have access to this resource",
            "Try refreshing your data",
          ],
        });
        return;

      default:
        reply.status(500).send({
          success: false,
          error: "Database error",
          code: "DATABASE_ERROR",
          requestId,
          nextSteps: [
            "This appears to be a database issue",
            "Try your request again in a moment",
            "If the problem persists, contact support with this request ID",
          ],
        });
        return;
    }
  }

  // Handle custom API errors
  if (error instanceof CustomApiError) {
    const details = error.details;
    const detailsRecord =
      typeof details === 'object' && details !== null && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : undefined;
    const rawNext = detailsRecord?.['nextSteps'];
    const nextSteps = Array.isArray(rawNext)
      ? (rawNext as string[])
      : getDefaultNextSteps(error.code, error.statusCode);

    reply.status(error.statusCode).send({
      success: false,
      error: error.message,
      code: error.code,
      requestId,
      ...(detailsRecord !== undefined ? { details: error.details } : {}),
      ...(Array.isArray(nextSteps) && nextSteps.length > 0 ? { nextSteps } : {}),
    });
    return;
  }

  // Handle Fastify validation errors
  if (error.validation) {
    reply.status(400).send({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      requestId,
      details: error.validation,
      nextSteps: [
        "Review the validation errors above",
        "Check that all required fields are provided",
        "Verify field types match the expected format",
        "See API documentation for correct request format",
      ],
    });
    return;
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  // @ts-ignore
  const isDevelopment = process.env["NODE_ENV"] !== "production";

  reply.status(statusCode).send({
    success: false,
    error: isDevelopment ? error.message : "Internal server error",
    code: error.code || "INTERNAL_ERROR",
    requestId,
    nextSteps: getDefaultNextSteps(error.code || "INTERNAL_ERROR", statusCode),
    ...(isDevelopment && { stack: error.stack }),
  });
}

/**
 * Get default next steps for error codes
 */
function getDefaultNextSteps(code: string, statusCode: number): string[] {
  if (statusCode === 401) {
    return [
      "Check your authentication credentials",
      "Re-authenticate if your session expired",
      "Get a new API key at https://guardrailai.dev/settings/keys",
    ];
  }
  
  if (statusCode === 403) {
    return [
      "Verify you have permission to access this resource",
      "Check your subscription tier includes this feature",
      "Upgrade at https://guardrailai.dev/pricing if needed",
    ];
  }
  
  if (statusCode === 404) {
    return [
      "Verify the resource ID or path is correct",
      "Check that the resource hasn't been deleted",
      "Try listing available resources first",
    ];
  }
  
  if (statusCode === 429) {
    return [
      "You've exceeded the rate limit",
      "Wait a moment and try again",
      "Upgrade your plan for higher limits",
    ];
  }
  
  if (statusCode >= 500) {
    return [
      "This appears to be a server error",
      "Try your request again in a moment",
      "If the problem persists, contact support with the request ID",
    ];
  }
  
  return [
    "Review the error message above",
    "Check the API documentation for correct usage",
    "Contact support if you need assistance",
  ];
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends FastifyRequest = FastifyRequest>(
  fn: (request: T, reply: FastifyReply) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(request as T, reply);
    } catch (error) {
      errorHandler(error as ApiError, request, reply);
    }
  };
}

/**
 * Create typed error responses
 */
export const createError = {
  badRequest: (message: string, details?: unknown) =>
    new CustomApiError(message, 400, "BAD_REQUEST", details),

  unauthorized: (message: string = "Unauthorized") =>
    new CustomApiError(message, 401, "UNAUTHORIZED"),

  forbidden: (message: string = "Forbidden") =>
    new CustomApiError(message, 403, "FORBIDDEN"),

  notFound: (message: string = "Resource not found") =>
    new CustomApiError(message, 404, "NOT_FOUND"),

  conflict: (message: string, details?: unknown) =>
    new CustomApiError(message, 409, "CONFLICT", details),

  tooManyRequests: (message: string = "Too many requests") =>
    new CustomApiError(message, 429, "TOO_MANY_REQUESTS"),

  internal: (message: string = "Internal server error", details?: unknown) =>
    new CustomApiError(message, 500, "INTERNAL_ERROR", details),

  serviceUnavailable: (message: string = "Service unavailable") =>
    new CustomApiError(message, 503, "SERVICE_UNAVAILABLE"),
};

/**
 * Error monitoring integration with Sentry
 */
export function monitorError(error: Error, context: any): void {
  // Initialize Sentry if DSN is available
  if (process.env["SENTRY_DSN"]) {
    try {
      // Lazy load Sentry to avoid import overhead if not configured
      const Sentry = require("@sentry/node");

      // Configure Sentry if not already configured
      if (!Sentry.getCurrentHub().getClient()) {
        Sentry.init({
          dsn: process.env["SENTRY_DSN"],
          environment: process.env["NODE_ENV"] || "development",
          tracesSampleRate:
            process.env["NODE_ENV"] === "production" ? 0.1 : 0.0,
        });
      }

      // Capture exception with context
      Sentry.captureException(error, {
        extra: context,
        tags: {
          service: "guardrail-api",
        },
      });
    } catch (sentryError) {
      logger.error({ error: sentryError }, "Failed to initialize Sentry");
    }
  }

  if (process.env["NODE_ENV"] === "development") {
    logger.debug({ error, context }, "Error monitored");
  }
}

/**
 * Graceful shutdown handler
 */
export function handleGracefulShutdown(server: {
  close: (cb: (err?: Error) => void) => void;
}): void {
  const shutdown = (signal: string) => {
    logger.info(
      { signal },
      "Received shutdown signal, starting graceful shutdown",
    );

    server.close((err?: Error) => {
      if (err) {
        logger.error({ error: err }, "Error during server shutdown");
        process.exit(1);
      }

      logger.info("Server closed successfully");
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw createError.serviceUnavailable("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();

      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = "OPEN";
      }

      throw error;
    }
  }
}

/**
 * Retry mechanism for failed operations
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError!;
}
