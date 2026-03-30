/**
 * Security Hardening Middleware
 *
 * Production-ready security middleware including:
 * - Content-Type validation
 * - JSON depth limiting (DoS prevention)
 * - Request body size limits per route type
 * - Enhanced input sanitization
 * - SQL injection pattern detection
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { logger } from "../logger";

const securityLogger = logger.child({ service: "security" });

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface SecurityConfig {
  /** Maximum JSON nesting depth (default: 20) */
  maxJsonDepth: number;

  /** Body size limits in bytes */
  bodySizeLimits: {
    default: number; // 1MB
    upload: number; // 10MB
    webhook: number; // 5MB
    small: number; // 100KB
  };

  /** Allowed content types */
  allowedContentTypes: string[];

  /** Block requests with SQL injection patterns */
  blockSqlInjection: boolean;

  /** Log blocked requests */
  logBlocked: boolean;
}

const DEFAULT_CONFIG: SecurityConfig = {
  maxJsonDepth: 20,
  bodySizeLimits: {
    default: 1 * 1024 * 1024, // 1MB
    upload: 10 * 1024 * 1024, // 10MB
    webhook: 5 * 1024 * 1024, // 5MB
    small: 100 * 1024, // 100KB
  },
  allowedContentTypes: [
    "application/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
    "text/plain",
  ],
  blockSqlInjection: true,
  logBlocked: true,
};

let config: SecurityConfig = DEFAULT_CONFIG;

// =============================================================================
// JSON DEPTH LIMITER
// =============================================================================

/**
 * Calculate the depth of a JSON object/array
 */
function getJsonDepth(obj: unknown, currentDepth = 0): number {
  if (currentDepth > config.maxJsonDepth) {
    return currentDepth; // Early exit if already exceeded
  }

  if (obj === null || typeof obj !== "object") {
    return currentDepth;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return currentDepth;
    return Math.max(...obj.map((item) => getJsonDepth(item, currentDepth + 1)));
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return currentDepth;

  return Math.max(
    ...keys.map((key) =>
      getJsonDepth((obj as Record<string, unknown>)[key], currentDepth + 1),
    ),
  );
}

/**
 * Middleware to limit JSON depth (DoS prevention)
 */
export async function jsonDepthLimiter(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.body && typeof request.body === "object") {
    const depth = getJsonDepth(request.body);

    if (depth > config.maxJsonDepth) {
      if (config.logBlocked) {
        securityLogger.warn(
          {
            ip: request.ip,
            path: request.url,
            depth,
            maxDepth: config.maxJsonDepth,
          },
          "JSON depth limit exceeded",
        );
      }

      reply.status(400).send({
        success: false,
        error: "Request body exceeds maximum nesting depth",
        code: "JSON_DEPTH_EXCEEDED",
        maxDepth: config.maxJsonDepth,
      });
    }
  }
}

// =============================================================================
// CONTENT-TYPE VALIDATION
// =============================================================================

/**
 * Validate Content-Type header
 */
export async function contentTypeValidator(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip for GET, HEAD, OPTIONS, DELETE (typically no body)
  if (["GET", "HEAD", "OPTIONS", "DELETE"].includes(request.method)) {
    return;
  }

  const contentType = request.headers["content-type"];

  // If there's a body but no content-type
  if (request.body && !contentType) {
    if (config.logBlocked) {
      securityLogger.warn(
        {
          ip: request.ip,
          path: request.url,
          method: request.method,
        },
        "Missing Content-Type header",
      );
    }

    reply.status(415).send({
      success: false,
      error: "Content-Type header is required",
      code: "MISSING_CONTENT_TYPE",
    });
    return;
  }

  if (contentType) {
    const mainType = contentType.split(";")[0].trim().toLowerCase();
    const isAllowed = config.allowedContentTypes.some(
      (allowed) => mainType === allowed || mainType.startsWith(allowed),
    );

    if (!isAllowed) {
      if (config.logBlocked) {
        securityLogger.warn(
          {
            ip: request.ip,
            path: request.url,
            contentType,
          },
          "Unsupported Content-Type",
        );
      }

      reply.status(415).send({
        success: false,
        error: "Unsupported Content-Type",
        code: "UNSUPPORTED_CONTENT_TYPE",
        allowed: config.allowedContentTypes,
      });
    }
  }
}

// =============================================================================
// SQL INJECTION DETECTION
// =============================================================================

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i, // OR 1=1
  /(\bAND\b\s+\d+\s*=\s*\d+)/i, // AND 1=1
  /(--\s*$|;\s*--)/, // SQL comments
  /(\b(EXEC|EXECUTE)\s*\()/i, // Stored procedure execution
  /(\/\*.*\*\/)/, // Block comments
  /(\bWAITFOR\s+DELAY\b)/i, // Time-based injection
  /(\bBENCHMARK\s*\()/i, // MySQL benchmark
  /(\bSLEEP\s*\()/i, // Sleep function
  /(0x[0-9a-f]+)/i, // Hex encoding
  /(\bCONVERT\s*\()/i, // Type conversion
  /(\bCHAR\s*\(\d+\))/i, // Char function
];

/**
 * Check if a string contains SQL injection patterns
 */
function containsSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Recursively check object for SQL injection
 */
function checkObjectForSqlInjection(obj: unknown): boolean {
  if (typeof obj === "string") {
    return containsSqlInjection(obj);
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => checkObjectForSqlInjection(item));
  }

  if (obj !== null && typeof obj === "object") {
    return Object.values(obj).some((value) =>
      checkObjectForSqlInjection(value),
    );
  }

  return false;
}

/**
 * Middleware to detect SQL injection patterns
 */
export async function sqlInjectionDetector(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!config.blockSqlInjection) return;

  // Check query parameters
  if (request.query && checkObjectForSqlInjection(request.query)) {
    logSqlInjectionAttempt(request, "query");
    return sendSqlInjectionResponse(reply);
  }

  // Check body
  if (request.body && checkObjectForSqlInjection(request.body)) {
    logSqlInjectionAttempt(request, "body");
    return sendSqlInjectionResponse(reply);
  }

  // Check path parameters
  if (request.params && checkObjectForSqlInjection(request.params)) {
    logSqlInjectionAttempt(request, "params");
    return sendSqlInjectionResponse(reply);
  }
}

function logSqlInjectionAttempt(request: FastifyRequest, source: string): void {
  if (config.logBlocked) {
    securityLogger.warn(
      {
        ip: request.ip,
        path: request.url,
        method: request.method,
        source,
        userAgent: request.headers["user-agent"],
      },
      "SQL injection pattern detected",
    );
  }
}

function sendSqlInjectionResponse(reply: FastifyReply): void {
  reply.status(400).send({
    success: false,
    error: "Invalid input detected",
    code: "INVALID_INPUT",
  });
}

// =============================================================================
// ENHANCED INPUT SANITIZATION
// =============================================================================

const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi, // Script tags
  /\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, // Event handlers
  /javascript:\s*/gi, // JavaScript protocol
  /data:\s*text\/html/gi, // Data URI HTML
  /<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gi, // Iframe tags
  /<object\b[^>]*>([\s\S]*?)<\/object>/gi, // Object tags
  /<embed\b[^>]*>/gi, // Embed tags
  /<svg\b[^>]*\bon\w+/gi, // SVG with events
];

/**
 * Sanitize a string value
 */
function sanitizeString(value: string): string {
  let sanitized = value;

  // Remove XSS patterns
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // HTML encode special characters
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };

  sanitized = sanitized.replace(
    /[&<>"']/g,
    (match) => htmlEscapes[match] || match,
  );

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Also sanitize keys
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Enhanced input sanitization middleware
 */
export async function enhancedSanitizer(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (request.body) {
    request.body = sanitizeObject(request.body);
  }

  // Note: Query and params are handled by Fastify's built-in parsing
}

// =============================================================================
// BODY SIZE LIMIT HELPERS
// =============================================================================

/**
 * Route patterns for different body size limits
 */
const ROUTE_SIZE_PATTERNS: Array<{
  pattern: RegExp;
  limit: keyof SecurityConfig["bodySizeLimits"];
}> = [
  { pattern: /\/upload/i, limit: "upload" },
  { pattern: /\/webhook/i, limit: "webhook" },
  { pattern: /\/api\/billing\/webhook/i, limit: "webhook" },
  { pattern: /\/api\/deploy-hooks/i, limit: "webhook" },
  { pattern: /\/auth\//i, limit: "small" },
  { pattern: /\/login/i, limit: "small" },
  { pattern: /\/register/i, limit: "small" },
];

/**
 * Get the appropriate body size limit for a route
 */
export function getBodySizeLimit(path: string): number {
  for (const { pattern, limit } of ROUTE_SIZE_PATTERNS) {
    if (pattern.test(path)) {
      return config.bodySizeLimits[limit];
    }
  }
  return config.bodySizeLimits.default;
}

// =============================================================================
// PARAMETERIZED QUERY CHECK
// =============================================================================

/**
 * Utility to check if a query is properly parameterized
 * (For use in code reviews / static analysis)
 */
export function isParameterizedQuery(
  query: string,
  params: unknown[],
): boolean {
  // Count placeholders ($1, $2, etc. for PostgreSQL or ? for others)
  const pgPlaceholders = (query.match(/\$\d+/g) || []).length;
  const genericPlaceholders = (query.match(/\?/g) || []).length;
  const namedPlaceholders = (query.match(/:\w+/g) || []).length;

  const totalPlaceholders =
    pgPlaceholders + genericPlaceholders + namedPlaceholders;

  // Query should have at least as many placeholders as params
  return totalPlaceholders >= params.length && params.length > 0;
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

export async function securityHardeningPlugin(
  fastify: FastifyInstance,
  options: Partial<SecurityConfig> = {},
): Promise<void> {
  // Merge config
  config = { ...DEFAULT_CONFIG, ...options };

  // Set default body limit
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: config.bodySizeLimits.default },
    (req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Add security hooks
  fastify.addHook("preHandler", contentTypeValidator);
  fastify.addHook("preHandler", jsonDepthLimiter);
  fastify.addHook("preHandler", sqlInjectionDetector);
  fastify.addHook("preHandler", enhancedSanitizer);

  securityLogger.info(
    {
      maxJsonDepth: config.maxJsonDepth,
      defaultBodyLimit: config.bodySizeLimits.default,
      blockSqlInjection: config.blockSqlInjection,
    },
    "Security hardening initialized",
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  config as securityConfig,
  sanitizeString,
  sanitizeObject,
  containsSqlInjection,
  getJsonDepth,
};
