/**
 * Input Validation & Sanitization Utilities
 * 
 * Use these functions to validate and sanitize user input before processing.
 * Never trust client-side validation alone - always validate on the server.
 */

// =============================================================================
// Email Validation
// =============================================================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

// =============================================================================
// URL Validation
// =============================================================================

export function isValidUrl(url: string, allowedProtocols = ['https:', 'http:']): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidHttpsUrl(url: string): boolean {
  return isValidUrl(url, ['https:']);
}

// =============================================================================
// String Sanitization
// =============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

export function sanitizeString(str: string, maxLength = 1000): string {
  if (!str || typeof str !== 'string') return '';
  
  // Trim whitespace
  let sanitized = str.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}

export function sanitizeForLog(str: string, maxLength = 200): string {
  if (!str || typeof str !== 'string') return '[empty]';
  
  // Remove sensitive patterns
  let sanitized = str
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
    .replace(/api[_-]?key[=:]\s*\S+/gi, 'apiKey=[REDACTED]')
    .replace(/bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/secret[=:]\s*\S+/gi, 'secret=[REDACTED]');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '...';
  }
  
  return sanitized;
}

// =============================================================================
// ID Validation
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_REGEX = /^c[a-z0-9]{24}$/;
const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

export function isValidUuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

export function isValidCuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return CUID_REGEX.test(id);
}

export function isValidNanoId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return NANOID_REGEX.test(id);
}

export function isValidId(id: string): boolean {
  return isValidUuid(id) || isValidCuid(id) || isValidNanoId(id);
}

// =============================================================================
// Numeric Validation
// =============================================================================

export function isValidInteger(value: unknown, min?: number, max?: number): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (!Number.isInteger(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  
  return true;
}

export function parsePositiveInt(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
}

// =============================================================================
// Path Validation (prevent path traversal)
// =============================================================================

export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  
  // Reject path traversal attempts
  if (path.includes('..')) return false;
  if (path.includes('\0')) return false;
  
  // Reject absolute paths on Windows
  if (/^[a-zA-Z]:/.test(path)) return false;
  
  // Reject absolute Unix paths (unless explicitly needed)
  if (path.startsWith('/')) return false;
  
  return true;
}

export function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') return '';
  
  return path
    .replace(/\.\./g, '')
    .replace(/\0/g, '')
    .replace(/^\/+/, '')
    .replace(/^[a-zA-Z]:/, '');
}

// =============================================================================
// JSON Validation
// =============================================================================

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Request Body Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FieldValidator {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
}

export function validateRequestBody(
  body: Record<string, unknown>,
  validators: FieldValidator[]
): ValidationResult {
  const errors: string[] = [];
  
  for (const validator of validators) {
    const value = body[validator.field];
    
    // Check required
    if (validator.required && (value === undefined || value === null || value === '')) {
      errors.push(`${validator.field} is required`);
      continue;
    }
    
    // Skip optional empty fields
    if (value === undefined || value === null) continue;
    
    // Check type
    if (validator.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== validator.type) {
        errors.push(`${validator.field} must be a ${validator.type}`);
        continue;
      }
    }
    
    // String validations
    if (typeof value === 'string') {
      if (validator.minLength && value.length < validator.minLength) {
        errors.push(`${validator.field} must be at least ${validator.minLength} characters`);
      }
      if (validator.maxLength && value.length > validator.maxLength) {
        errors.push(`${validator.field} must be at most ${validator.maxLength} characters`);
      }
      if (validator.pattern && !validator.pattern.test(value)) {
        errors.push(`${validator.field} has invalid format`);
      }
    }
    
    // Number validations
    if (typeof value === 'number') {
      if (validator.min !== undefined && value < validator.min) {
        errors.push(`${validator.field} must be at least ${validator.min}`);
      }
      if (validator.max !== undefined && value > validator.max) {
        errors.push(`${validator.field} must be at most ${validator.max}`);
      }
    }
    
    // Custom validation
    if (validator.custom && !validator.custom(value)) {
      errors.push(`${validator.field} failed custom validation`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// SQL Injection Prevention
// =============================================================================

// These patterns are commonly used in SQL injection attacks
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(['";]--)/,
  /(\/\*.*\*\/)/,
  /(\bOR\b.*=.*)/i,
  /(\bAND\b.*=.*)/i,
];

export function containsSqlInjection(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

// =============================================================================
// XSS Prevention
// =============================================================================

const XSS_PATTERNS = [
  /<script[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe[^>]*>/i,
  /<object[^>]*>/i,
  /<embed[^>]*>/i,
  /expression\s*\(/i,
];

export function containsXss(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(str));
}

export function sanitizeUserInput(str: string, maxLength = 1000): string {
  if (!str || typeof str !== 'string') return '';
  
  let sanitized = sanitizeString(str, maxLength);
  
  // If it contains potential XSS, escape HTML
  if (containsXss(sanitized)) {
    sanitized = escapeHtml(sanitized);
  }
  
  return sanitized;
}
