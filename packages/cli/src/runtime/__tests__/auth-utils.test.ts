/**
 * Unit Tests for Enterprise Auth Utilities
 * Tests: key masking, cache reuse, refresh behavior, expiry warnings
 */

import {
  maskApiKey,
  hoursUntilExpiry,
  isExpiryWarning,
  formatExpiry,
  shouldUseCachedEntitlements,
  validateApiKeyFormat,
  getClientMetadata,
} from '../auth-utils';

describe('maskApiKey', () => {
  it('should mask a standard API key preserving prefix and last 4 chars', () => {
    const key = 'gr_pro_abc123xyz789abcd';
    const masked = maskApiKey(key);
    expect(masked).toBe('gr_pro_********abcd');
    expect(masked).not.toContain('abc123xyz789');
  });

  it('should mask enterprise tier keys correctly', () => {
    const key = 'gr_enterprise_secretkey1234abcd';
    const masked = maskApiKey(key);
    expect(masked).toMatch(/^gr_enterprise_\*+abcd$/);
    expect(masked).not.toContain('secretkey1234');
  });

  it('should mask starter tier keys correctly', () => {
    const key = 'gr_starter_mysecretapikey1234';
    const masked = maskApiKey(key);
    expect(masked).toMatch(/^gr_starter_\*+1234$/);
  });

  it('should mask free tier keys correctly', () => {
    const key = 'gr_free_publickey12345678';
    const masked = maskApiKey(key);
    expect(masked).toMatch(/^gr_free_\*+5678$/);
  });

  it('should handle short keys gracefully', () => {
    const key = 'gr_pro_ab';
    const masked = maskApiKey(key);
    expect(masked).toBe('****');
  });

  it('should handle empty or null keys', () => {
    expect(maskApiKey('')).toBe('****');
    expect(maskApiKey(null as any)).toBe('****');
    expect(maskApiKey(undefined as any)).toBe('****');
  });

  it('should never expose more than prefix and last 4 chars', () => {
    const sensitiveKey = 'gr_pro_supersecretpassword1234';
    const masked = maskApiKey(sensitiveKey);
    expect(masked).not.toContain('supersecret');
    expect(masked).not.toContain('password');
    expect(masked.endsWith('1234')).toBe(true);
  });
});

describe('hoursUntilExpiry', () => {
  it('should return null for undefined expiry', () => {
    expect(hoursUntilExpiry(undefined)).toBeNull();
  });

  it('should return 0 for expired timestamps', () => {
    const expired = new Date(Date.now() - 60000).toISOString();
    expect(hoursUntilExpiry(expired)).toBe(0);
  });

  it('should return correct hours for future timestamps', () => {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const hours = hoursUntilExpiry(twoHoursFromNow);
    expect(hours).toBeGreaterThanOrEqual(1);
    expect(hours).toBeLessThanOrEqual(2);
  });

  it('should return correct hours for 72 hours from now', () => {
    const seventyTwoHoursFromNow = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const hours = hoursUntilExpiry(seventyTwoHoursFromNow);
    expect(hours).toBeGreaterThanOrEqual(71);
    expect(hours).toBeLessThanOrEqual(72);
  });
});

describe('isExpiryWarning', () => {
  it('should return false for undefined expiry', () => {
    expect(isExpiryWarning(undefined)).toBe(false);
  });

  it('should return false for expired timestamps', () => {
    const expired = new Date(Date.now() - 60000).toISOString();
    expect(isExpiryWarning(expired)).toBe(false);
  });

  it('should return true for expiry within 72 hours', () => {
    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    expect(isExpiryWarning(fortyEightHoursFromNow, 72)).toBe(true);
  });

  it('should return false for expiry beyond threshold', () => {
    const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiryWarning(oneWeekFromNow, 72)).toBe(false);
  });

  it('should use custom threshold', () => {
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiryWarning(twentyFourHoursFromNow, 48)).toBe(true);
    expect(isExpiryWarning(twentyFourHoursFromNow, 12)).toBe(false);
  });
});

describe('formatExpiry', () => {
  it('should return "No expiry set" for undefined', () => {
    expect(formatExpiry(undefined)).toBe('No expiry set');
  });

  it('should return "Expired" for past timestamps', () => {
    const expired = new Date(Date.now() - 60000).toISOString();
    expect(formatExpiry(expired)).toBe('Expired');
  });

  it('should format hours correctly', () => {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30000).toISOString();
    const formatted = formatExpiry(twoHoursFromNow);
    expect(formatted).toMatch(/^\dh$/);
  });

  it('should format days and hours correctly', () => {
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
    const formatted = formatExpiry(twoDaysFromNow);
    expect(formatted).toMatch(/^2 days \dh$/);
  });

  it('should format single day correctly', () => {
    const oneDayFromNow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString();
    const formatted = formatExpiry(oneDayFromNow);
    expect(formatted).toMatch(/^1 day \dh$/);
  });
});

describe('shouldUseCachedEntitlements', () => {
  it('should return false for undefined expiry', () => {
    expect(shouldUseCachedEntitlements(undefined)).toBe(false);
  });

  it('should return false for expired timestamps', () => {
    const expired = new Date(Date.now() - 60000).toISOString();
    expect(shouldUseCachedEntitlements(expired)).toBe(false);
  });

  it('should return false if expiry is within 5 minutes', () => {
    const threeMinutesFromNow = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    expect(shouldUseCachedEntitlements(threeMinutesFromNow)).toBe(false);
  });

  it('should return true if expiry is beyond 5 minutes', () => {
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(shouldUseCachedEntitlements(tenMinutesFromNow)).toBe(true);
  });

  it('should return true for expiry exactly at 5 minute boundary', () => {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000 + 1000).toISOString();
    expect(shouldUseCachedEntitlements(fiveMinutesFromNow)).toBe(true);
  });
});

describe('validateApiKeyFormat', () => {
  it('should return null for valid API keys', () => {
    expect(validateApiKeyFormat('gr_pro_abc123xyz789abcd')).toBeNull();
    expect(validateApiKeyFormat('gr_starter_validkey12345')).toBeNull();
    expect(validateApiKeyFormat('gr_enterprise_longkey123456')).toBeNull();
    expect(validateApiKeyFormat('gr_free_publickey12345678')).toBeNull();
  });

  it('should return error for empty key', () => {
    expect(validateApiKeyFormat('')).toBe('API key is required');
  });

  it('should return error for key without gr_ prefix', () => {
    expect(validateApiKeyFormat('api_pro_abc123')).toBe('API key must start with "gr_"');
    expect(validateApiKeyFormat('pro_abc123xyz')).toBe('API key must start with "gr_"');
  });

  it('should return error for key that is too short', () => {
    expect(validateApiKeyFormat('gr_pro_abc')).toBe('API key is too short');
  });

  it('should return error for invalid format', () => {
    expect(validateApiKeyFormat('gr_pro_abc-123')).toBe('API key format is invalid');
    expect(validateApiKeyFormat('gr_pro_abc 123')).toBe('API key format is invalid');
    expect(validateApiKeyFormat('gr_PRO_abc123xyz')).toBe('API key format is invalid');
  });
});

describe('getClientMetadata', () => {
  it('should return version, os, and arch', () => {
    const meta = getClientMetadata();
    expect(meta).toHaveProperty('version');
    expect(meta).toHaveProperty('os');
    expect(meta).toHaveProperty('arch');
  });

  it('should return valid os value', () => {
    const meta = getClientMetadata();
    expect(['win32', 'darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix']).toContain(meta.os);
  });

  it('should return valid arch value', () => {
    const meta = getClientMetadata();
    expect(['x64', 'arm64', 'arm', 'ia32', 'x32', 'ppc64', 's390x']).toContain(meta.arch);
  });
});
