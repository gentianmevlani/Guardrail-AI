/**
 * Secure Cookie Configuration
 * 
 * Use these utilities for setting cookies with proper security attributes.
 */

import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

// =============================================================================
// Cookie Security Configuration
// =============================================================================

export interface SecureCookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  sameSite?: 'strict' | 'lax' | 'none';
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get secure cookie options with sensible defaults
 */
export function getSecureCookieOptions(options: SecureCookieOptions = {}): ResponseCookie {
  return {
    name: '', // Set by caller
    value: '', // Set by caller
    httpOnly: true,
    secure: isProduction,
    sameSite: options.sameSite || 'lax',
    path: options.path || '/',
    maxAge: options.maxAge,
    domain: options.domain,
  };
}

/**
 * Session cookie configuration (expires when browser closes)
 */
export function getSessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * Persistent cookie configuration (with expiry)
 */
export function getPersistentCookieOptions(maxAgeDays = 7): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}

/**
 * Authentication token cookie configuration
 */
export function getAuthCookieOptions(expiresInSeconds = 15 * 60): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict', // Strict for auth cookies
    path: '/',
    maxAge: expiresInSeconds,
  };
}

/**
 * Refresh token cookie configuration (longer lived, stricter)
 */
export function getRefreshCookieOptions(expiresInDays = 7): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth', // Only sent to auth endpoints
    maxAge: expiresInDays * 24 * 60 * 60,
  };
}

/**
 * CSRF token cookie configuration
 */
export function getCsrfCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: false, // Must be readable by JavaScript
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  };
}

// =============================================================================
// Cookie Names (centralized)
// =============================================================================

export const COOKIE_NAMES = {
  SESSION: 'session',
  ACCESS_TOKEN: 'token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF: 'csrf_token',
  PREFERENCES: 'preferences',
  OAUTH_STATE: 'oauth_state',
} as const;

// =============================================================================
// Cookie Validation
// =============================================================================

/**
 * Validate a cookie value (basic security checks)
 */
export function isValidCookieValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Cookie values cannot contain certain characters
  if (/[,;\s]/.test(value)) return false;
  
  // Reasonable length limit
  if (value.length > 4096) return false;
  
  return true;
}

/**
 * Validate JWT format (basic structure check, not cryptographic)
 */
export function isValidJwtFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Each part should be base64url encoded
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64urlRegex.test(part));
}

// =============================================================================
// Cookie Utilities
// =============================================================================

/**
 * Parse cookie header string into object
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  if (!cookieHeader) return {};
  
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const trimmedName = name?.trim();
    if (trimmedName) {
      cookies[trimmedName] = rest.join('=').trim();
    }
  });
  
  return cookies;
}

/**
 * Serialize cookie for Set-Cookie header
 */
export function serializeCookie(
  name: string,
  value: string,
  options: Partial<ResponseCookie> = {}
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.sameSite && typeof options.sameSite === 'string') {
    parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`);
  }
  
  return parts.join('; ');
}

/**
 * Create a cookie deletion header value
 */
export function createDeleteCookieHeader(name: string, path = '/'): string {
  return serializeCookie(name, '', {
    maxAge: 0,
    path,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}
