/**
 * Unit Tests for Enterprise Credential Store
 * Tests: cache reuse, expiry validation, shouldUseCachedEntitlements
 */

import {
  isCacheValid,
  shouldUseCachedEntitlements,
  type AuthState,
} from '../creds';

describe('isCacheValid', () => {
  it('should return false if tier is not set', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      cacheUntil: new Date(Date.now() + 60000).toISOString(),
    };
    expect(isCacheValid(state)).toBe(false);
  });

  it('should return false if cacheUntil is in the past', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() - 60000).toISOString(),
    };
    expect(isCacheValid(state)).toBe(false);
  });

  it('should return false if expiresAt is in the past', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    };
    expect(isCacheValid(state)).toBe(false);
  });

  it('should return true if cacheUntil is in the future', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 60000).toISOString(),
    };
    expect(isCacheValid(state)).toBe(true);
  });

  it('should return true if expiresAt is in the future', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    expect(isCacheValid(state)).toBe(true);
  });

  it('should use the shorter of cacheUntil and expiresAt', () => {
    // expiresAt in past, cacheUntil in future - should be invalid
    const state1: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 60000).toISOString(),
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    };
    expect(isCacheValid(state1)).toBe(false);

    // cacheUntil in past, expiresAt in future - should be invalid
    const state2: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    expect(isCacheValid(state2)).toBe(false);

    // Both in future - should be valid
    const state3: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 60000).toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };
    expect(isCacheValid(state3)).toBe(true);
  });
});

describe('shouldUseCachedEntitlements', () => {
  it('should return false if tier is not set', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      cacheUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    expect(shouldUseCachedEntitlements(state)).toBe(false);
  });

  it('should return false if cache expires within 5 minutes', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes
    };
    expect(shouldUseCachedEntitlements(state)).toBe(false);
  });

  it('should return true if cache expires beyond 5 minutes', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    };
    expect(shouldUseCachedEntitlements(state)).toBe(true);
  });

  it('should return false if server expiresAt is within 5 minutes', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes
    };
    expect(shouldUseCachedEntitlements(state)).toBe(false);
  });

  it('should return true if both cacheUntil and expiresAt are beyond 5 minutes', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      cacheUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };
    expect(shouldUseCachedEntitlements(state)).toBe(true);
  });

  it('should work with only expiresAt set', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123',
      tier: 'pro',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    expect(shouldUseCachedEntitlements(state)).toBe(true);
  });
});

describe('AuthState interface', () => {
  it('should support all required fields', () => {
    const state: AuthState = {
      apiKey: 'gr_pro_abc123xyz789',
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'refresh_token_value',
      tier: 'enterprise',
      email: 'user@company.com',
      entitlements: ['scan:secrets', 'scan:vulnerabilities', 'autopilot'],
      authenticatedAt: '2024-01-15T10:00:00.000Z',
      cacheUntil: '2024-01-15T10:15:00.000Z',
      expiresAt: '2024-01-22T10:00:00.000Z',
      issuedAt: '2024-01-15T10:00:00.000Z',
    };

    expect(state.apiKey).toBeDefined();
    expect(state.tier).toBe('enterprise');
    expect(state.entitlements).toHaveLength(3);
    expect(state.expiresAt).toBeDefined();
    expect(state.issuedAt).toBeDefined();
  });

  it('should support partial state', () => {
    const state: AuthState = {
      apiKey: 'gr_free_publickey123',
    };

    expect(state.apiKey).toBeDefined();
    expect(state.tier).toBeUndefined();
    expect(state.expiresAt).toBeUndefined();
  });
});
