/**
 * Security Utilities Index
 * 
 * Centralized exports for all security-related utilities.
 */

// Input Validation & Sanitization
export {
  isValidEmail,
  isValidUrl,
  isValidHttpsUrl,
  escapeHtml,
  sanitizeString,
  sanitizeForLog,
  isValidUuid,
  isValidCuid,
  isValidNanoId,
  isValidId,
  isValidInteger,
  parsePositiveInt,
  isValidPath,
  sanitizePath,
  safeJsonParse,
  isValidJson,
  validateRequestBody,
  containsSqlInjection,
  containsXss,
  sanitizeUserInput,
  type ValidationResult,
  type FieldValidator,
} from './validation';

// Cookie Security
export {
  getSecureCookieOptions,
  getSessionCookieOptions,
  getPersistentCookieOptions,
  getAuthCookieOptions,
  getRefreshCookieOptions,
  getCsrfCookieOptions,
  COOKIE_NAMES,
  isValidCookieValue,
  isValidJwtFormat,
  parseCookies,
  serializeCookie,
  createDeleteCookieHeader,
} from './cookies';

// Security Event Logging
export {
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailure,
  logRateLimitExceeded,
  logAccessDenied,
  logSuspiciousActivity,
  logXssAttempt,
  logSqlInjectionAttempt,
  logApiKeyCreated,
  logApiKeyRevoked,
  extractRequestContext,
  type SecurityEvent,
  type SecurityEventType,
  type SecurityEventSeverity,
} from './audit-log';
