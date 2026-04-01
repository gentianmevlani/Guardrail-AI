import crypto from 'crypto';

/**
 * Generate a unique correlation ID for tracking related actions
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Calculate SHA-256 hash of content
 */
export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate content entropy (randomness measure for secret detection)
 */
export function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies: Record<string, number> = {};

  for (let i = 0; i < len; i++) {
    const char = str[i];
    if (char) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
  }

  let entropy = 0;
  for (const char in frequencies) {
    const frequency = frequencies[char];
    if (frequency !== undefined) {
      const p = frequency / len;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Mask sensitive value for logging
 */
export function maskSensitiveValue(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

/**
 * Check if a path is within allowed paths
 */
export function isPathAllowed(
  path: string,
  allowedPaths: string[],
  deniedPaths: string[]
): boolean {
  const normalizedPath = path.replace(/\\/g, '/');

  // Check denied paths first (more restrictive)
  for (const deniedPath of deniedPaths) {
    if (normalizedPath.startsWith(deniedPath.replace(/\\/g, '/'))) {
      return false;
    }
  }

  // If no allowed paths specified, allow all (except denied)
  if (allowedPaths.length === 0) {
    return true;
  }

  // Check allowed paths
  for (const allowedPath of allowedPaths) {
    if (normalizedPath.startsWith(allowedPath.replace(/\\/g, '/'))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a domain is allowed
 */
export function isDomainAllowed(
  url: string,
  allowedDomains: string[],
  deniedDomains: string[]
): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check denied domains first
    for (const deniedDomain of deniedDomains) {
      if (hostname === deniedDomain || hostname.endsWith(`.${deniedDomain}`)) {
        return false;
      }
    }

    // If no allowed domains specified, allow all (except denied)
    if (allowedDomains.length === 0) {
      return true;
    }

    // Check allowed domains
    for (const allowedDomain of allowedDomains) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Sanitize error message for safe logging
 */
export function sanitizeError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return {
      message: error.message.replace(/\/[^\s:]+/g, '[path]'),
      code: (error as any).code,
    };
  }
  return { message: 'Unknown error occurred' };
}
