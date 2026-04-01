/**
 * Enhanced API Key Security Tests
 *
 * Comprehensive test suite for API key security features:
 * - IP allowlisting
 * - Time-based restrictions
 * - Country restrictions
 * - Usage quotas
 * - Fingerprinting
 * - Key rotation
 */

import { prisma } from '@guardrail/database';
import { ApiKeySecurityPolicy, ApiKeyUsageContext, enhancedApiKeyService } from '../enhanced-api-key-service';

// Mock dependencies
jest.mock('@guardrail/database');
jest.mock('../logger', () => ({
  logger: {
    child: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Enhanced API Key Security', () => {
  const testUserId = 'test-user-id';
  const testApiKey = 'grl_1234567890abcdef1234567890abcdef12345678';
  const testKeyHash = 'hashed-key-value';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful database responses
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'key-id',
      userId: testUserId,
      name: 'Test Key',
      prefix: 'grl_12345678...',
      tierOverride: null,
      lastUsedAt: new Date(),
      expiresAt: null,
      revokedAt: null,
      isActive: true,
      allowedIpCidrs: ['192.168.1.0/24'],
      allowedCountries: ['US', 'CA'],
      allowedHoursUtc: { start: 9, end: 17 },
      sensitiveScopes: ['admin', 'delete'],
      requestsPerDay: 100,
      expensivePerDay: 10,
      currentDayRequests: 50,
      currentDayExpensive: 5,
      lastDayReset: new Date(),
      rotationOverlapDays: 7,
      user_subscriptions: [{ tier: 'pro' }],
    }]);
  });

  describe('API Key Creation with Security Policy', () => {
    it('should create API key with IP allowlist', async () => {
      const securityPolicy: ApiKeySecurityPolicy = {
        allowedIpCidrs: ['192.168.1.0/24', '10.0.0.0/8'],
        requestsPerDay: 1000,
      };

      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'new-key-id',
        userId: testUserId,
        name: 'Test Key',
        prefix: 'grl_abcdef12...',
        tierOverride: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const result = await enhancedApiKeyService.createApiKey(testUserId, {
        name: 'Test Key',
        securityPolicy,
      });

      expect(result.apiKey.securityPolicy.allowedIpCidrs).toEqual(['192.168.1.0/24', '10.0.0.0/8']);
      expect(result.apiKey.securityPolicy.requestsPerDay).toBe(1000);
      expect(result.key).toMatch(/^grl_/);
    });

    it('should create API key with time restrictions', async () => {
      const securityPolicy: ApiKeySecurityPolicy = {
        allowedHoursUtc: { start: 9, end: 17 },
        allowedCountries: ['US', 'GB', 'CA'],
      };

      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'new-key-id',
        userId: testUserId,
        name: 'Business Hours Key',
        prefix: 'grl_business...',
        tierOverride: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const result = await enhancedApiKeyService.createApiKey(testUserId, {
        name: 'Business Hours Key',
        securityPolicy,
      });

      expect(result.apiKey.securityPolicy.allowedHoursUtc).toEqual({ start: 9, end: 17 });
      expect(result.apiKey.securityPolicy.allowedCountries).toEqual(['US', 'GB', 'CA']);
    });

    it('should create API key with sensitive scopes', async () => {
      const securityPolicy: ApiKeySecurityPolicy = {
        sensitiveScopes: ['admin', 'delete', 'write'],
        rotationOverlapDays: 30,
      };

      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'new-key-id',
        userId: testUserId,
        name: 'Admin Key',
        prefix: 'grl_admin...',
        tierOverride: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const result = await enhancedApiKeyService.createApiKey(testUserId, {
        name: 'Admin Key',
        securityPolicy,
      });

      expect(result.apiKey.securityPolicy.sensitiveScopes).toEqual(['admin', 'delete', 'write']);
      expect(result.apiKey.rotationOverlapDays).toBe(30);
    });
  });

  describe('IP Allowlist Enforcement', () => {
    it('should allow requests from allowed IP ranges', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
    });

    it('should block requests from disallowed IP addresses', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '203.0.113.1', // External IP not in allowlist
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP address not in allowlist');
      expect(result.securityPolicy?.allowed).toBe(false);
    });

    it('should allow requests when no IP allowlist is configured', async () => {
      // Mock key without IP restrictions
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        allowedIpCidrs: [],
      }]);

      const context: ApiKeyUsageContext = {
        ipAddress: '203.0.113.1',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
    });
  });

  describe('Country Restrictions', () => {
    it('should allow requests from allowed countries', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        country: 'US',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
    });

    it('should block requests from disallowed countries', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        country: 'CN', // Not in allowed list
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Country not allowed');
      expect(result.securityPolicy?.allowed).toBe(false);
    });

    it('should block requests when country is not provided but restrictions exist', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        country: undefined,
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Country not allowed');
    });
  });

  describe('Time-Based Restrictions', () => {
    beforeEach(() => {
      // Mock current time to be 14:00 UTC (2 PM)
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T14:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow requests within allowed time window', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
    });

    it('should block requests outside allowed time window', async () => {
      // Mock time to be 2 AM UTC
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T02:00:00Z'));

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Access outside allowed time window');
    });

    it('should handle overnight time windows correctly', async () => {
      // Mock key with overnight window (22:00 - 06:00)
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        allowedHoursUtc: { start: 22, end: 6 },
      }]);

      // Test at 2 AM (should be allowed)
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T02:00:00Z'));

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
    });
  });

  describe('Usage Quotas', () => {
    it('should allow requests within quota limits', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
        isExpensive: false,
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.quotaRemaining?.requests).toBe(50); // 100 - 50 used
      expect(result.securityPolicy?.quotaRemaining?.expensive).toBe(5); // 10 - 5 used
    });

    it('should block requests when daily quota is exceeded', async () => {
      // Mock key with exhausted quota
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        currentDayRequests: 100,
        requestsPerDay: 100,
      }]);

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
        isExpensive: false,
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Daily request quota exceeded');
      expect(result.securityPolicy?.quotaRemaining?.requests).toBe(0);
    });

    it('should block expensive operations when expensive quota is exceeded', async () => {
      // Mock key with exhausted expensive quota
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        currentDayExpensive: 10,
        expensivePerDay: 10,
      }]);

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
        isExpensive: true,
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Expensive operations quota exceeded');
      expect(result.securityPolicy?.quotaRemaining?.expensive).toBe(0);
    });

    it('should handle unlimited quotas correctly', async () => {
      // Mock key with unlimited quotas
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        requestsPerDay: -1,
        expensivePerDay: -1,
        currentDayRequests: 999999,
        currentDayExpensive: 999999,
      }]);

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
        isExpensive: true,
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.quotaRemaining?.requests).toBe(Infinity);
      expect(result.securityPolicy?.quotaRemaining?.expensive).toBe(Infinity);
    });
  });

  describe('Fingerprinting', () => {
    it('should detect fingerprint changes for sensitive scopes', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        requestedScopes: ['admin'], // Sensitive scope
      };

      // First request - should succeed
      const result1 = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);
      expect(result1.valid).toBe(true);

      // Second request with different user agent - should warn but still succeed
      const context2 = {
        ...context,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      };

      const result2 = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context2);
      expect(result2.valid).toBe(true);
      expect(result2.securityPolicy?.warnings).toContain('Fingerprint change detected for sensitive scope access');
    });

    it('should not check fingerprint for non-sensitive scopes', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        requestedScopes: ['read'], // Non-sensitive scope
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.warnings).toBeUndefined();
    });
  });

  describe('Key Rotation', () => {
    it('should rotate API key with overlap window', async () => {
      const oldKeyId = 'old-key-id';
      
      // Mock existing key
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: oldKeyId,
        userId: testUserId,
        name: 'Old Key',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        rotationOverlapDays: 7,
        allowedIpCidrs: ['192.168.1.0/24'],
        allowedCountries: ['US'],
        allowedHoursUtc: { start: 9, end: 17 },
        sensitiveScopes: ['admin'],
        requestsPerDay: 100,
        expensivePerDay: 10,
      });

      // Mock new key creation
      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'new-key-id',
        userId: testUserId,
        name: 'Old Key (rotated)',
        prefix: 'grl_newkey...',
        tierOverride: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      // Mock rotation linking
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await enhancedApiKeyService.rotateApiKey(oldKeyId, testUserId, {
        preservePolicy: true,
      });

      expect(result.apiKey.name).toBe('Old Key (rotated)');
      expect(result.apiKey.securityPolicy.allowedIpCidrs).toEqual(['192.168.1.0/24']);
      expect(result.key).toMatch(/^grl_/);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: result.apiKey.id },
        data: { rotatedFromId: oldKeyId },
      });
    });

    it('should revoke old key immediately when no overlap period', async () => {
      const oldKeyId = 'old-key-id';
      
      // Mock existing key with no overlap
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: oldKeyId,
        userId: testUserId,
        name: 'Old Key',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        rotationOverlapDays: 0,
      });

      // Mock new key creation
      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'new-key-id',
        userId: testUserId,
        name: 'Old Key (rotated)',
        prefix: 'grl_newkey...',
        tierOverride: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      // Mock updates
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await enhancedApiKeyService.rotateApiKey(oldKeyId, testUserId);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: oldKeyId },
        data: { revokedAt: expect.any(Date), isActive: false },
      });
    });

    it('should throw error when key not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        enhancedApiKeyService.rotateApiKey('non-existent-id', testUserId)
      ).rejects.toThrow('API key not found');
    });
  });

  describe('Security Policy Integration', () => {
    it('should enforce multiple policy restrictions simultaneously', async () => {
      // Mock key with multiple restrictions
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        allowedIpCidrs: ['192.168.1.0/24'],
        allowedCountries: ['US'],
        allowedHoursUtc: { start: 9, end: 17 },
        currentDayRequests: 99, // Near limit
        requestsPerDay: 100,
      }]);

      // Test during business hours from allowed IP and country
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T14:00:00Z'));
      
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        country: 'US',
        requestedScopes: ['read'],
        isExpensive: false,
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(true);
      expect(result.securityPolicy?.allowed).toBe(true);
      expect(result.securityPolicy?.quotaRemaining?.requests).toBe(1);
    });

    it('should fail fast on first policy violation', async () => {
      // Test with disallowed IP (should fail before checking other policies)
      const context: ApiKeyUsageContext = {
        ipAddress: '203.0.113.1', // Disallowed IP
        country: 'CN', // Also disallowed country
        requestedScopes: ['admin'], // Sensitive scope
        isExpensive: true, // Expensive operation
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('IP address not in allowlist'); // First violation
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Validation failed');
    });

    it('should handle malformed API keys', async () => {
      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy('invalid-key', context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format');
    });

    it('should handle expired API keys', async () => {
      // Mock expired key
      mockPrisma.$queryRaw.mockResolvedValue([{
        ...mockPrisma.$queryRaw.mock.results[0].value[0],
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      }]);

      const context: ApiKeyUsageContext = {
        ipAddress: '192.168.1.100',
        requestedScopes: ['read'],
      };

      const result = await enhancedApiKeyService.validateApiKeyWithPolicy(testApiKey, context);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key expired');
    });
  });
});
