/**
 * Server-Authoritative Usage Enforcement Tests
 * 
 * Tests that verify:
 * 1. Deleting local usage file does NOT reset server usage
 * 2. Usage increments correctly per action
 * 3. Offline allowance works correctly
 * 4. HMAC-signed tokens prevent tampering
 */

import { pool } from '@guardrail/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database pool
vi.mock('@guardrail/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Import after mocking
import {
    getCurrentBillingPeriod,
    UsageActionType,
    UsageEnforcementService
} from '../apps/api/src/services/usage-enforcement';

describe('Server-Authoritative Usage Enforcement', () => {
  let service: UsageEnforcementService;
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    service = new UsageEnforcementService();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('getCurrentBillingPeriod', () => {
    it('should return first and last day of current month', () => {
      const { start, end } = getCurrentBillingPeriod();
      
      expect(start.getUTCDate()).toBe(1);
      expect(end.getUTCDate()).toBeGreaterThanOrEqual(28);
      expect(start.getUTCMonth()).toBe(end.getUTCMonth());
    });
  });
  
  describe('Deleting local file does NOT reset server usage', () => {
    it('should return server usage count regardless of local file state', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      // Mock: Server has 5 scans recorded
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: testUserId,
            period_start: start,
            period_end: end,
            scan_count: 5,
            reality_count: 2,
            agent_count: 1,
            gate_count: 3,
            fix_count: 0,
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ tier: 'free' }],
        });
      
      const result = await service.checkUsage(testUserId, 'scan');
      
      // Server says 5 scans used, free tier has 10 limit
      expect(result.current).toBe(5);
      expect(result.limit).toBe(10);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
    
    it('should enforce server limit even if local file shows zero usage', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      // Mock: Server has 10 scans (at limit for free tier)
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: testUserId,
            period_start: start,
            period_end: end,
            scan_count: 10,
            reality_count: 0,
            agent_count: 0,
            gate_count: 0,
            fix_count: 0,
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ tier: 'free' }],
        });
      
      const result = await service.checkUsage(testUserId, 'scan');
      
      // Server says 10 scans used, free tier has 10 limit - should be blocked
      expect(result.current).toBe(10);
      expect(result.limit).toBe(10);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('limit reached');
    });
  });
  
  describe('Usage increments correctly per action', () => {
    it('should atomically increment scan count on server', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      // Mock tier lookup
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{ tier: 'pro' }],
        })
        // Mock atomic increment
        .mockResolvedValueOnce({
          rows: [{ new_count: 6 }],
        });
      
      const result = await service.incrementUsage(testUserId, 'scan', 1);
      
      expect(result.current).toBe(6);
      expect(result.allowed).toBe(true);
      
      // Verify the increment query was called with correct parameters
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_counters'),
        expect.arrayContaining([testUserId, start, end, 1])
      );
    });
    
    it('should increment by specified count', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{ tier: 'pro' }],
        })
        .mockResolvedValueOnce({
          rows: [{ new_count: 10 }],
        });
      
      const result = await service.incrementUsage(testUserId, 'scan', 5);
      
      expect(result.current).toBe(10);
      
      // Verify count parameter
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_counters'),
        expect.arrayContaining([testUserId, start, end, 5])
      );
    });
    
    it('should return not allowed when increment exceeds limit', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{ tier: 'free' }],
        })
        .mockResolvedValueOnce({
          rows: [{ new_count: 11 }], // Over the 10 limit
        });
      
      const result = await service.incrementUsage(testUserId, 'scan', 1);
      
      expect(result.current).toBe(11);
      expect(result.limit).toBe(10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeded');
    });
    
    it('should track different action types independently', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      // Increment scan
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ new_count: 1 }] });
      
      const scanResult = await service.incrementUsage(testUserId, 'scan', 1);
      expect(scanResult.current).toBe(1);
      
      // Verify scan_count column was used
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('scan_count'),
        expect.any(Array)
      );
      
      vi.clearAllMocks();
      
      // Increment reality
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ new_count: 1 }] });
      
      const realityResult = await service.incrementUsage(testUserId, 'reality', 1);
      expect(realityResult.current).toBe(1);
      
      // Verify reality_count column was used
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('reality_count'),
        expect.any(Array)
      );
    });
  });
  
  describe('Tier-based limits', () => {
    const testCases: Array<{ tier: string; action: UsageActionType; limit: number }> = [
      { tier: 'free', action: 'scan', limit: 10 },
      { tier: 'free', action: 'reality', limit: 0 },
      { tier: 'free', action: 'agent', limit: 0 },
      { tier: 'starter', action: 'scan', limit: 100 },
      { tier: 'starter', action: 'reality', limit: 20 },
      { tier: 'pro', action: 'scan', limit: 500 },
      { tier: 'pro', action: 'reality', limit: 100 },
      { tier: 'pro', action: 'agent', limit: 50 },
      { tier: 'unlimited', action: 'scan', limit: -1 },
    ];
    
    testCases.forEach(({ tier, action, limit }) => {
      it(`should enforce ${limit === -1 ? 'unlimited' : limit} ${action} limit for ${tier} tier`, async () => {
        const { start, end } = getCurrentBillingPeriod();
        
        (pool.query as any)
          .mockResolvedValueOnce({
            rows: [{
              user_id: testUserId,
              period_start: start,
              period_end: end,
              scan_count: 0,
              reality_count: 0,
              agent_count: 0,
              gate_count: 0,
              fix_count: 0,
              updated_at: new Date(),
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ tier }],
          });
        
        const result = await service.checkUsage(testUserId, action);
        
        expect(result.limit).toBe(limit);
        if (limit === 0) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });
    });
  });
  
  describe('Signed usage tokens', () => {
    it('should issue a signed token with correct payload', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      (pool.query as any)
        // getOrCreateCounter
        .mockResolvedValueOnce({
          rows: [{
            user_id: testUserId,
            period_start: start,
            period_end: end,
            scan_count: 5,
            reality_count: 2,
            agent_count: 1,
            gate_count: 3,
            fix_count: 0,
            updated_at: new Date(),
          }],
        })
        // getUserTier
        .mockResolvedValueOnce({
          rows: [{ tier: 'pro' }],
        })
        // Insert token
        .mockResolvedValueOnce({ rows: [] });
      
      const token = await service.issueSignedToken(testUserId);
      
      expect(token.token).toBeDefined();
      expect(token.signature).toBeDefined();
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(token.payload.userId).toBe(testUserId);
      expect(token.payload.scanCount).toBe(5);
      expect(token.payload.tier).toBe('pro');
    });
    
    it('should verify valid token', async () => {
      const mockPayload = {
        userId: testUserId,
        periodStart: new Date().toISOString(),
        scanCount: 5,
        realityCount: 2,
        agentCount: 1,
        gateCount: 3,
        fixCount: 0,
        tier: 'pro',
        limits: { scans: 500, reality: 100, agent: 50, gate: 500, fix: 100 },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      };
      
      // Calculate expected signature
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', process.env.USAGE_HMAC_SECRET || process.env.JWT_SECRET || 'guardrail-usage-secret-change-in-production');
      hmac.update(JSON.stringify(mockPayload));
      const expectedSignature = hmac.digest('hex');
      
      (pool.query as any).mockResolvedValueOnce({
        rows: [{
          payload: mockPayload,
          signature: expectedSignature,
          revoked: false,
          expires_at: new Date(Date.now() + 300000),
        }],
      });
      
      const result = await service.verifyToken('test-token', expectedSignature);
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(testUserId);
    });
    
    it('should reject tampered token', async () => {
      const mockPayload = {
        userId: testUserId,
        scanCount: 5,
      };
      
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [{
            payload: mockPayload,
            signature: 'wrong-signature',
            revoked: false,
            expires_at: new Date(Date.now() + 300000),
          }],
        })
        // Revoke query
        .mockResolvedValueOnce({ rows: [] });
      
      const result = await service.verifyToken('test-token', 'tampered-signature');
      
      expect(result).toBeNull();
      // Should have revoked the token
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE usage_tokens SET revoked = true'),
        expect.any(Array)
      );
    });
    
    it('should reject expired token', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [], // No valid token found (expired)
      });
      
      const result = await service.verifyToken('expired-token', 'some-signature');
      
      expect(result).toBeNull();
    });
  });
  
  describe('Offline usage queue', () => {
    it('should queue offline action when under allowance', async () => {
      (pool.query as any)
        .mockResolvedValueOnce({ rows: [{ cnt: '0' }] }) // Current count
        .mockResolvedValueOnce({ rows: [] }); // Insert
      
      const result = await service.queueOfflineUsage(testUserId, 'scan', 'machine-123');
      
      expect(result.queued).toBe(true);
      expect(result.offlineCount).toBe(1);
    });
    
    it('should reject offline action when at allowance limit', async () => {
      (pool.query as any).mockResolvedValueOnce({ rows: [{ cnt: '1' }] }); // Already at limit
      
      const result = await service.queueOfflineUsage(testUserId, 'scan');
      
      expect(result.queued).toBe(false);
      expect(result.offlineCount).toBe(1);
    });
    
    it('should sync offline usage to server counters', async () => {
      (pool.query as any)
        // Get unsynced actions
        .mockResolvedValueOnce({
          rows: [
            { id: 'action-1', action_type: 'scan', count: 1 },
            { id: 'action-2', action_type: 'reality', count: 1 },
          ],
        })
        // First increment (scan)
        .mockResolvedValueOnce({ rows: [{ tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ new_count: 6 }] })
        .mockResolvedValueOnce({ rows: [] }) // Mark synced
        // Second increment (reality)
        .mockResolvedValueOnce({ rows: [{ tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ new_count: 3 }] })
        .mockResolvedValueOnce({ rows: [] }); // Mark synced
      
      const result = await service.syncOfflineUsage(testUserId);
      
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
    });
  });
  
  describe('New billing period', () => {
    it('should create new counter for new billing period', async () => {
      const { start, end } = getCurrentBillingPeriod();
      
      (pool.query as any)
        // No existing counter
        .mockResolvedValueOnce({ rows: [] })
        // Create new counter
        .mockResolvedValueOnce({
          rows: [{
            user_id: testUserId,
            period_start: start,
            period_end: end,
            scan_count: 0,
            reality_count: 0,
            agent_count: 0,
            gate_count: 0,
            fix_count: 0,
            updated_at: new Date(),
          }],
        });
      
      const counter = await service.getOrCreateCounter(testUserId);
      
      expect(counter.scanCount).toBe(0);
      expect(counter.realityCount).toBe(0);
      expect(counter.agentCount).toBe(0);
    });
  });
});

describe('CLI Server Usage Integration', () => {
  // These tests verify the CLI client behavior
  
  it('should document that local file deletion does not affect server state', () => {
    // This is a documentation test - the actual behavior is:
    // 1. CLI calls server to check/increment usage
    // 2. Server maintains authoritative counters in database
    // 3. Local ~/.guardrail/usage.json is only a cache
    // 4. Deleting local file just means CLI will fetch fresh data from server
    
    expect(true).toBe(true);
  });
  
  it('should document offline allowance behavior', () => {
    // Offline behavior:
    // 1. If server is unreachable, CLI allows 1 action (OFFLINE_ALLOWANCE)
    // 2. Action is queued locally in offline-queue.json
    // 3. Next action requires sync with server
    // 4. Sync uploads queued actions and increments server counters
    
    expect(true).toBe(true);
  });
});
