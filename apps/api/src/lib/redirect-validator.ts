/**
 * Redirect URL Validator
 * 
 * Prevents open redirect vulnerabilities by validating all redirect URLs
 * against an allowlist of permitted domains/paths.
 */

import { logger } from '../logger';

export interface RedirectValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Default allowed redirect paths (relative URLs)
 * These are safe because they're same-origin
 */
const DEFAULT_ALLOWED_PATHS = [
  '/dashboard',
  '/dashboard/settings',
  '/dashboard/findings',
  '/dashboard/scans',
  '/dashboard/compliance',
  '/dashboard/billing',
  '/dashboard/team',
  '/pricing',
  '/login',
  '/',
];

/**
 * Default allowed domains (for OAuth callbacks)
 */
const DEFAULT_ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  // Production domains should be added via environment variable
];

/**
 * Get allowed redirect domains from environment
 */
function getAllowedDomains(): string[] {
  const envDomains = process.env.ALLOWED_REDIRECT_DOMAINS?.split(',') || [];
  return [...DEFAULT_ALLOWED_DOMAINS, ...envDomains.map(d => d.trim())];
}

/**
 * Get allowed redirect paths from environment
 */
function getAllowedPaths(): string[] {
  const envPaths = process.env.ALLOWED_REDIRECT_PATHS?.split(',') || [];
  return [...DEFAULT_ALLOWED_PATHS, ...envPaths.map(p => p.trim())];
}

/**
 * Get the base URL of the application
 */
function getBaseUrl(): string {
  return process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Validate a redirect URL to prevent open redirect attacks
 * 
 * @param redirectUrl - The URL to validate
 * @param options - Validation options
 * @returns Validation result with sanitized URL if valid
 */
export function validateRedirectUrl(
  redirectUrl: string | null | undefined,
  options: {
    allowExternal?: boolean;
    allowedDomains?: string[];
    allowedPaths?: string[];
    defaultPath?: string;
  } = {}
): RedirectValidationResult {
  // If no redirect URL provided, use default
  if (!redirectUrl) {
    const defaultPath = options.defaultPath || '/dashboard';
    return {
      valid: true,
      sanitizedUrl: defaultPath,
    };
  }

  // Reject JavaScript: and data: URLs (XSS vectors)
  if (redirectUrl.startsWith('javascript:') || redirectUrl.startsWith('data:')) {
    return {
      valid: false,
      error: 'Invalid redirect URL scheme',
    };
  }

  // Reject URLs starting with // (protocol-relative)
  if (redirectUrl.startsWith('//')) {
    return {
      valid: false,
      error: 'Protocol-relative URLs are not allowed',
    };
  }

  try {
    const url = new URL(redirectUrl, getBaseUrl());
    const allowedDomains = options.allowedDomains || getAllowedDomains();
    const allowedPaths = options.allowedPaths || getAllowedPaths();

    // Check if it's a relative path (starts with /)
    if (redirectUrl.startsWith('/')) {
      // Validate relative path
      if (allowedPaths.includes(redirectUrl)) {
        return {
          valid: true,
          sanitizedUrl: redirectUrl,
        };
      }

      // Check if path starts with any allowed path (for nested routes)
      const isAllowed = allowedPaths.some(path => {
        return redirectUrl === path || redirectUrl.startsWith(path + '/');
      });

      if (isAllowed) {
        return {
          valid: true,
          sanitizedUrl: redirectUrl,
        };
      }

      return {
        valid: false,
        error: 'Redirect path not in allowlist',
      };
    }

    // Absolute URL - check domain
    const hostname = url.hostname.toLowerCase();
    const isAllowedDomain = allowedDomains.some(domain => {
      const domainLower = domain.toLowerCase();
      return hostname === domainLower || hostname.endsWith('.' + domainLower);
    });

    if (!isAllowedDomain) {
      return {
        valid: false,
        error: 'Redirect domain not in allowlist',
      };
    }

    // External URLs only allowed if explicitly permitted
    if (!options.allowExternal && hostname !== new URL(getBaseUrl()).hostname) {
      return {
        valid: false,
        error: 'External redirects are not allowed',
      };
    }

    // Ensure scheme is http or https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Invalid URL scheme',
      };
    }

    // Reject URLs with dangerous characters or fragments
    if (url.hash && url.hash.length > 1) {
      // Allow fragments but log warning
      logger.warn({ redirectUrl }, 'Redirect URL contains fragment');
    }

    return {
      valid: true,
      sanitizedUrl: url.toString(),
    };
  } catch (error) {
    // Invalid URL format
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Sanitize and return a safe redirect URL
 * Returns the default path if validation fails
 */
export function sanitizeRedirectUrl(
  redirectUrl: string | null | undefined,
  defaultPath: string = '/dashboard',
  options?: {
    allowExternal?: boolean;
    allowedDomains?: string[];
    allowedPaths?: string[];
  }
): string {
  const result = validateRedirectUrl(redirectUrl, {
    ...options,
    defaultPath,
  });

  if (result.valid && result.sanitizedUrl) {
    return result.sanitizedUrl;
  }

  return defaultPath;
}
