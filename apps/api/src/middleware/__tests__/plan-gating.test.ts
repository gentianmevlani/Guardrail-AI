/**
 * Plan Gating Middleware Tests
 * 
 * Tests for subscription plan enforcement at the API level
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock prisma
vi.mock('@guardrail/database', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
  },
}));

import { requirePlan, checkPlanAccess } from '../plan-gating';
import { prisma } from '@guardrail/database';

// Helper to create mock request
function createMockRequest(user?: { id: string }): FastifyRequest {
  return {
    user,
  } as any as FastifyRequest;
}

// Helper to create mock reply
function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as any as FastifyReply;
}

describe('Plan Gating Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requirePlan', () => {
    it('should return 401 if no user in request', async () => {
      const middleware = requirePlan({ minTierLevel: 2 });
      const request = createMockRequest();
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    });

    it('should allow access for users with sufficient tier level', async () => {
      const middleware = requirePlan({ minTierLevel: 2, featureName: 'Test Feature' });
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      // Mock subscription with pro tier (level 2)
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'pro',
        status: 'active',
        id: 'sub-123',
      } as any);

      await middleware(request, reply);

      // Should not call reply methods (access allowed)
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should block access for users with insufficient tier level', async () => {
      const middleware = requirePlan({ minTierLevel: 2, featureName: 'Pro Feature' });
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      // Mock subscription with free tier (level 0)
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'free',
        status: 'active',
        id: 'sub-123',
      } as any);

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        currentTier: 'free',
      }));
    });

    it('should block access for inactive subscriptions', async () => {
      const middleware = requirePlan({ minTierLevel: 1 });
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      // Mock subscription with canceled status
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        code: 'SUBSCRIPTION_INACTIVE',
      }));
    });

    it('should allow access for unlimited tier regardless of minTierLevel', async () => {
      const middleware = requirePlan({ minTierLevel: 4 }); // Enterprise level
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'unlimited',
        status: 'active',
        id: 'sub-123',
      } as any);

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should check requiredTier for exact match', async () => {
      const middleware = requirePlan({ requiredTier: 'enterprise' });
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'pro',
        status: 'active',
        id: 'sub-123',
      } as any);

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredTier: 'enterprise',
      }));
    });

    it('should handle trialing status as active', async () => {
      const middleware = requirePlan({ minTierLevel: 2 });
      const request = createMockRequest({ id: 'user-123' });
      const reply = createMockReply();

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'pro',
        status: 'trialing',
        id: 'sub-123',
      } as any);

      await middleware(request, reply);

      // Should allow access (trialing counts as active)
      expect(reply.status).not.toHaveBeenCalled();
    });
  });

  describe('checkPlanAccess', () => {
    it('should return allowed: true for sufficient tier', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'pro',
        status: 'active',
        id: 'sub-123',
      } as any);

      const result = await checkPlanAccess('user-123', { minTierLevel: 2 });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('pro');
    });

    it('should return allowed: false for insufficient tier', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier: 'starter',
        status: 'active',
        id: 'sub-123',
      } as any);

      const result = await checkPlanAccess('user-123', { minTierLevel: 3 });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('compliance');
    });

    it('should work with requireActive: false', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const result = await checkPlanAccess('user-123', { 
        minTierLevel: 0, 
        requireActive: false 
      });

      // Should allow access even without active subscription
      expect(result.allowed).toBe(true);
    });
  });

  describe('Tier Level Mapping', () => {
    const tierLevels = [
      { tier: 'free', level: 0 },
      { tier: 'starter', level: 1 },
      { tier: 'pro', level: 2 },
      { tier: 'compliance', level: 3 },
      { tier: 'enterprise', level: 4 },
      { tier: 'unlimited', level: 5 },
    ];

    it.each(tierLevels)('should correctly map $tier tier to level $level', async ({ tier, level }) => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tier,
        status: 'active',
        id: 'sub-123',
      } as any);

      // Should allow access for minTierLevel <= current tier level
      const result = await checkPlanAccess('user-123', { minTierLevel: level });
      expect(result.allowed).toBe(true);

      // Should block access for minTierLevel > current tier level (except unlimited)
      if (tier !== 'unlimited' && level < 4) {
        const resultBlocked = await checkPlanAccess('user-123', { minTierLevel: level + 1 });
        expect(resultBlocked.allowed).toBe(false);
      }
    });
  });
});
