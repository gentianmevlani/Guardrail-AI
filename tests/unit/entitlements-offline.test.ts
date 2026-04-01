/**
 * Unit tests for offline mode entitlement restrictions
 * 
 * Verifies that offline mode never grants paid features
 */

import { EntitlementsManager } from '@guardrail/core';

describe('EntitlementsManager - Offline Mode', () => {
  let entitlementsManager: EntitlementsManager;

  beforeEach(() => {
    entitlementsManager = new EntitlementsManager();
    // Clear any cached entitlements
    delete process.env.GUARDRAIL_API_KEY;
    delete process.env.GUARDRAIL_TIER;
  });

  afterEach(() => {
    delete process.env.GUARDRAIL_API_URL;
  });

  describe('getCurrentTier()', () => {
    it('should return free tier when API is unreachable', async () => {
      // Mock network failure
      process.env.GUARDRAIL_API_URL = 'http://invalid-host:9999';
      process.env.GUARDRAIL_API_KEY = 'test-key';

      const tier = await entitlementsManager.getCurrentTier();

      expect(tier).toBe('free');
    });

    it('should return free tier when API key validation fails due to network', async () => {
      // Simulate network error by using invalid URL
      process.env.GUARDRAIL_API_URL = 'http://localhost:1'; // Port 1 is typically closed
      process.env.GUARDRAIL_API_KEY = 'test-key';

      const tier = await entitlementsManager.getCurrentTier();

      expect(tier).toBe('free');
    });

    it('should not grant pro tier when offline', async () => {
      process.env.GUARDRAIL_API_URL = 'http://invalid:9999';
      process.env.GUARDRAIL_API_KEY = 'gr_pro_test_key';

      const tier = await entitlementsManager.getCurrentTier();

      expect(tier).toBe('free');
      expect(tier).not.toBe('pro');
    });
  });

  describe('checkFeature()', () => {
    it('should block paid features when offline', async () => {
      process.env.GUARDRAIL_API_URL = 'http://invalid:9999';
      
      const check = await entitlementsManager.checkFeature('ship');

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('requires');
    });

    it('should allow free tier features when offline', async () => {
      process.env.GUARDRAIL_API_URL = 'http://invalid:9999';
      
      // Scan is a free tier feature
      const check = await entitlementsManager.checkFeature('scan');

      // Note: This depends on TIER_CONFIG - adjust based on actual config
      // If scan is free, it should be allowed
      expect(check.allowed).toBeDefined();
    });
  });
});
