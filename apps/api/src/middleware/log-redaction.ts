/**
 * Log Redaction Middleware
 * 
 * Prevents secrets from appearing in logs
 * Redacts sensitive information while maintaining useful debugging info
 */

import { FastifyRequest } from 'fastify';
import { logger } from '../logger';

// Patterns for sensitive information
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  { pattern: /Bearer\s+([A-Za-z0-9\-_\.]{20,})/gi, replacement: 'Bearer *****' },
  { pattern: /sk_[A-Za-z0-9]{24,}/gi, replacement: 'sk_*****' },
  { pattern: /ghp_[A-Za-z0-9]{36}/gi, replacement: 'ghp_*****' },
  { pattern: /gho_[A-Za-z0-9]{36}/gi, replacement: 'gho_*****' },
  { pattern: /ghu_[A-Za-z0-9]{36}/gi, replacement: 'ghu_*****' },
  { pattern: /ghs_[A-Za-z0-9]{36}/gi, replacement: 'ghs_*****' },
  { pattern: /ghr_[A-Za-z0-9]{36}/gi, replacement: 'ghr_*****' },
  { pattern: /xoxb-[0-9]{13}-[0-9]{13}-[A-Za-z0-9]{24}/gi, replacement: 'xoxb-*****' },
  { pattern: /xoxp-[0-9]{13}-[0-9]{13}-[0-9]{13}-[A-Za-z0-9]{24}/gi, replacement: 'xoxp-*****' },
  
  // JWT tokens (general pattern)
  { pattern: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, replacement: 'JWT_*****' },
  
  // Passwords in JSON/form data
  { pattern: /"password":\s*"[^"]+"/gi, replacement: '"password":"*****"' },
  { pattern: /"currentPassword":\s*"[^"]+"/gi, replacement: '"currentPassword":"*****"' },
  { pattern: /"newPassword":\s*"[^"]+"/gi, replacement: '"newPassword":"*****"' },
  { pattern: /"confirmPassword":\s*"[^"]+"/gi, replacement: '"confirmPassword":"*****"' },
  { pattern: /password=[^&\s]+/gi, replacement: 'password=*****' },
  
  // Secret keys and environment variables
  { pattern: /"secret":\s*"[^"]+"/gi, replacement: '"secret":"*****"' },
  { pattern: /"token":\s*"[^"]+"/gi, replacement: '"token":"*****"' },
  { pattern: /"apiKey":\s*"[^"]+"/gi, replacement: '"apiKey":"*****"' },
  { pattern: /"api_key":\s*"[^"]+"/gi, replacement: '"api_key":"*****"' },
  { pattern: /"accessToken":\s*"[^"]+"/gi, replacement: '"accessToken":"*****"' },
  { pattern: /"refreshToken":\s*"[^"]+"/gi, replacement: '"refreshToken":"*****"' },
  
  // Credit card numbers (basic patterns)
  { pattern: /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/gi, replacement: '****-****-****-****' },
  { pattern: /\b[0-9]{16}\b/gi, replacement: '****************' },
  
  // Social Security Numbers
  { pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/gi, replacement: '***-**-****' },
  { pattern: /\b[0-9]{9}\b/gi, replacement: '*********' },
  
  // Email addresses (optional - uncomment if needed)
  // { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, replacement: '*****@*****.***' },
];

// Headers that should always be redacted
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-csrf-token',
  'x-forwarded-for', // IP addresses - optional privacy
];

// Body fields that should never be logged
const NEVER_LOG_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'privateKey',
  'private_key',
  'creditCard',
  'credit_card',
  'ssn',
  'socialSecurity',
];

/**
 * Redact sensitive information from a string
 */
export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let redacted = input;

  // Apply all sensitive patterns
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Redact sensitive headers from request headers
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      // Redact entire header value
      if (typeof value === 'string' && value.length > 8) {
        redacted[key] = value.substring(0, 8) + '...';
      } else {
        redacted[key] = '*****';
      }
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Remove sensitive fields from object
 */
export function removeSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeSensitiveFields(item));
  }

  const cleaned: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (NEVER_LOG_FIELDS.includes(lowerKey)) {
      // Skip sensitive fields entirely
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      cleaned[key] = removeSensitiveFields(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Create a safe-to-log request object
 */
export function createSafeRequest(request: FastifyRequest): any {
  const safe: any = {
    method: request.method,
    url: request.url,
    query: request.query,
    headers: redactHeaders(request.headers as Record<string, unknown>),
  };

  // Add body only if it's not sensitive and not too large
  if (request.body) {
    const bodySize = JSON.stringify(request.body).length;
    if (bodySize < 1024) { // Only log bodies smaller than 1KB
      safe.body = removeSensitiveFields(request.body);
    } else {
      safe.body = '[BODY_TOO_LARGE]';
    }
  }

  // Add request ID if available
  if ((request as any).requestId) {
    safe.requestId = (request as any).requestId;
  }

  return safe;
}

/**
 * Middleware to enhance logging with redaction
 */
export function redactionMiddleware() {
  return async (request: FastifyRequest, reply: any) => {
    // Store original request log data
    const originalLog = (request as any).log;

    // Create enhanced logger with redaction
    const enhancedLog = {
      info: (obj: any, message?: string) => {
        if (obj && typeof obj === 'object') {
          // Redact sensitive data from log objects
          const cleaned = removeSensitiveFields(obj);
          originalLog?.info(cleaned, message);
        } else {
          originalLog?.info(obj, message);
        }
      },
      warn: (obj: any, message?: string) => {
        if (obj && typeof obj === 'object') {
          const cleaned = removeSensitiveFields(obj);
          originalLog?.warn(cleaned, message);
        } else {
          originalLog?.warn(obj, message);
        }
      },
      error: (obj: any, message?: string) => {
        if (obj && typeof obj === 'object') {
          const cleaned = removeSensitiveFields(obj);
          originalLog?.error(cleaned, message);
        } else {
          originalLog?.error(obj, message);
        }
      },
      debug: (obj: any, message?: string) => {
        if (obj && typeof obj === 'object') {
          const cleaned = removeSensitiveFields(obj);
          originalLog?.debug(cleaned, message);
        } else {
          originalLog?.debug(obj, message);
        }
      },
    };

    // Replace request logger with enhanced version
    (request as any).log = enhancedLog;

    // Store safe request data for error handling
    (request as any).safeRequest = createSafeRequest(request);
  };
}

/**
 * Helper function to safely log request details
 */
export function logRequestSafe(request: FastifyRequest, message?: string): void {
  const safeRequest = createSafeRequest(request);
  logger.info(safeRequest, message || 'Request received');
}

/**
 * Helper function to safely log response details
 */
export function logResponseSafe(request: FastifyRequest, reply: any, message?: string): void {
  const safeData = {
    requestId: (request as any).requestId,
    statusCode: reply.statusCode,
    responseTime: reply.getResponseTime?.() || 'unknown',
    contentLength: reply.getHeader('content-length'),
  };
  
  logger.info(safeData, message || 'Response sent');
}

/**
 * Developer-safe debug mode
 * Still redacts secrets but adds more structured fields
 */
export function createDebugLogger(request: FastifyRequest) {
  const safeRequest = createSafeRequest(request);
  
  return {
    request: safeRequest,
    debug: (data: any, message?: string) => {
      // In debug mode, we add more context but still redact secrets
      const debugData = {
        ...data,
        requestId: (request as any).requestId,
        timestamp: new Date().toISOString(),
        route: request.routeOptions?.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      };
      
      logger.debug(removeSensitiveFields(debugData), message);
    },
  };
}
