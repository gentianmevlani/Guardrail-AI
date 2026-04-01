/**
 * Enterprise Auth Utilities
 * - Key masking for secure display
 * - Expiry warning calculations
 * - Cache validity checks
 */

/**
 * Mask an API key for secure display
 * Keeps prefix and last 4 characters: gr_pro_****abcd
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '****';
  }
  
  // Find the prefix pattern (gr_tier_)
  const prefixMatch = apiKey.match(/^(gr_[a-z]+_)/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
<<<<<<< HEAD
    if (prefix === undefined) {
      return '****';
    }
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    const suffix = apiKey.slice(-4);
    const maskedLength = apiKey.length - prefix.length - 4;
    // Use exactly 8 asterisks for keys of this length, or actual length if different
    // This provides consistent masking regardless of actual secret length
    const asteriskCount = maskedLength >= 8 ? 8 : Math.max(4, maskedLength);
    return `${prefix}${'*'.repeat(asteriskCount)}${suffix}`;
  }
  
  // Fallback: show first 3 and last 4
  const prefix = apiKey.slice(0, 3);
  const suffix = apiKey.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Calculate hours until expiry
 * Returns null if no expiry or already expired
 */
export function hoursUntilExpiry(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  
  const expiry = new Date(expiresAt);
  const now = new Date();
  
  if (expiry <= now) return 0;
  
  const diffMs = expiry.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Check if expiry is within warning threshold (72 hours)
 */
export function isExpiryWarning(expiresAt: string | undefined, thresholdHours: number = 72): boolean {
  const hours = hoursUntilExpiry(expiresAt);
  if (hours === null) return false;
  return hours > 0 && hours <= thresholdHours;
}

/**
 * Format expiry for display
 */
export function formatExpiry(expiresAt: string | undefined): string {
  const hours = hoursUntilExpiry(expiresAt);
  
  if (hours === null) return 'No expiry set';
  if (hours === 0) return 'Expired';
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (days === 1) return `1 day ${remainingHours}h`;
  return `${days} days ${remainingHours}h`;
}

/**
 * Check if cached entitlements should be reused
 * Returns true if cache is valid and has > 5 minutes remaining
 */
export function shouldUseCachedEntitlements(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  
  const expiry = new Date(expiresAt);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  return expiry > fiveMinutesFromNow;
}

/**
 * Get client metadata for API requests
 */
export function getClientMetadata(): { version: string; os: string; arch: string } {
  let version = '1.0.0';
  try {
    const pkg = require('../../package.json');
    version = pkg.version || '1.0.0';
  } catch {
    // Use default version
  }
  
  return {
    version,
    os: process.platform,
    arch: process.arch,
  };
}

/**
 * Validate API key format
 * Returns error message or null if valid
 */
export function validateApiKeyFormat(apiKey: string): string | null {
  if (!apiKey) {
    return 'API key is required';
  }
  
  if (!apiKey.startsWith('gr_')) {
    return 'API key must start with "gr_"';
  }
  
  // Check format before length to give more specific error
  if (!/^gr_[a-z]+_[a-zA-Z0-9]+$/.test(apiKey)) {
    return 'API key format is invalid';
  }
  
  if (apiKey.length < 20) {
    return 'API key is too short';
  }
  
  return null;
}
