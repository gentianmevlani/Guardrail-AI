// @ts-nocheck — Usage enforcement error paths use unknown catch values.
/**
 * Server-Authoritative Usage Enforcement API Routes
 * 
 * These endpoints are the ONLY source of truth for usage limits.
 * CLI must check these before allowing quota-limited actions.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { UsageActionType, usageEnforcement } from '../services/usage-enforcement';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ============================================================================
// SCHEMAS
// ============================================================================

const CheckUsageSchema = z.object({
  action: z.enum(['scan', 'reality', 'agent', 'gate', 'fix']),
});

const IncrementUsageSchema = z.object({
  action: z.enum(['scan', 'reality', 'agent', 'gate', 'fix']),
  count: z.number().min(1).max(100).default(1),
});

const VerifyTokenSchema = z.object({
  token: z.string().min(1),
  signature: z.string().min(1),
});

const QueueOfflineSchema = z.object({
  action: z.enum(['scan', 'reality', 'agent', 'gate', 'fix']),
  machineId: z.string().optional(),
});

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }
  
  // User should be set by auth middleware
  if (!(request as any).user?.id) {
    return reply.status(401).send({ 
      success: false, 
      error: 'Invalid authentication',
      code: 'AUTH_INVALID',
    });
  }
}

// ============================================================================
// ROUTES
// ============================================================================

export async function usageEnforcementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  /**
   * POST /api/usage/v2/check - Check if action is allowed (does NOT increment)
   * 
   * Use this before starting a potentially long operation to fail fast.
   */
  fastify.post('/check', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      const body = CheckUsageSchema.parse(request.body);
      
      const result = await usageEnforcement.checkUsage(userId, body.action as UsageActionType);
      
      return reply.send({
        success: true,
        ...result,
      });
    } catch (error: unknown) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid request', details: error.errors });
      }
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to check usage');
      return reply.status(500).send({ success: false, error: 'Failed to check usage' });
    }
  });

  /**
   * POST /api/usage/v2/increment - Increment usage counter (server-authoritative)
   * 
   * This is the ONLY way to record usage. Local files are just cache.
   * Returns whether the action was allowed and new counts.
   */
  fastify.post('/increment', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      const body = IncrementUsageSchema.parse(request.body);
      
      // First sync any pending offline usage
      const syncResult = await usageEnforcement.syncOfflineUsage(userId);
      
      // Then increment
      const result = await usageEnforcement.incrementUsage(userId, body.action as UsageActionType, body.count);
      
      // Issue a fresh signed token for caching
      const token = await usageEnforcement.issueSignedToken(userId);
      
      return reply.send({
        success: true,
        ...result,
        syncedOffline: syncResult.synced,
        signedToken: {
          token: token.token,
          signature: token.signature,
          expiresAt: token.expiresAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid request', details: error.errors });
      }
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to increment usage');
      return reply.status(500).send({ success: false, error: 'Failed to increment usage' });
    }
  });

  /**
   * GET /api/usage/v2/summary - Get full usage summary with signed token
   * 
   * Returns current usage, limits, and a signed token for caching.
   */
  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      
      const summary = await usageEnforcement.getUsageSummary(userId);
      const token = await usageEnforcement.issueSignedToken(userId);
      
      return reply.send({
        success: true,
        tier: summary.tier,
        limits: summary.limits,
        usage: {
          scan: summary.usage.scanCount,
          reality: summary.usage.realityCount,
          agent: summary.usage.agentCount,
          gate: summary.usage.gateCount,
          fix: summary.usage.fixCount,
        },
        period: {
          start: summary.usage.periodStart.toISOString(),
          end: summary.usage.periodEnd.toISOString(),
        },
        pendingOffline: summary.pendingOffline,
        signedToken: {
          token: token.token,
          signature: token.signature,
          expiresAt: token.expiresAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to get usage summary');
      return reply.status(500).send({ success: false, error: 'Failed to get usage summary' });
    }
  });

  /**
   * POST /api/usage/v2/verify-token - Verify a signed usage token
   * 
   * Used by CLI to verify cached tokens haven't been tampered with.
   */
  fastify.post('/verify-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = VerifyTokenSchema.parse(request.body);
      
      const payload = await usageEnforcement.verifyToken(body.token, body.signature);
      
      if (!payload) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID',
        });
      }
      
      return reply.send({
        success: true,
        valid: true,
        payload,
      });
    } catch (error: unknown) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid request', details: error.errors });
      }
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to verify token');
      return reply.status(500).send({ success: false, error: 'Failed to verify token' });
    }
  });

  /**
   * POST /api/usage/v2/queue-offline - Queue an offline action
   * 
   * Used when CLI is offline. Very limited allowance (1 action).
   */
  fastify.post('/queue-offline', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      const body = QueueOfflineSchema.parse(request.body);
      
      const result = await usageEnforcement.queueOfflineUsage(userId, body.action as UsageActionType, body.machineId);
      
      if (!result.queued) {
        return reply.status(429).send({
          success: false,
          error: 'Offline allowance exceeded. Please sync before continuing.',
          code: 'OFFLINE_LIMIT_EXCEEDED',
          offlineCount: result.offlineCount,
        });
      }
      
      return reply.send({
        success: true,
        queued: true,
        offlineCount: result.offlineCount,
        message: 'Action queued. Sync required before next action.',
      });
    } catch (error: unknown) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Invalid request', details: error.errors });
      }
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to queue offline usage');
      return reply.status(500).send({ success: false, error: 'Failed to queue offline usage' });
    }
  });

  /**
   * POST /api/usage/v2/sync - Sync offline usage to server
   * 
   * Must be called before any new actions if offline queue is not empty.
   */
  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      
      const result = await usageEnforcement.syncOfflineUsage(userId);
      const summary = await usageEnforcement.getUsageSummary(userId);
      const token = await usageEnforcement.issueSignedToken(userId);
      
      return reply.send({
        success: true,
        synced: result.synced,
        failed: result.failed,
        usage: {
          scan: summary.usage.scanCount,
          reality: summary.usage.realityCount,
          agent: summary.usage.agentCount,
          gate: summary.usage.gateCount,
          fix: summary.usage.fixCount,
        },
        signedToken: {
          token: token.token,
          signature: token.signature,
          expiresAt: token.expiresAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to sync usage');
      return reply.status(500).send({ success: false, error: 'Failed to sync usage' });
    }
  });

  /**
   * POST /api/usage/v2/revoke-tokens - Revoke all tokens for current user
   * 
   * Call on logout or if tampering is suspected.
   */
  fastify.post('/revoke-tokens', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      
      await usageEnforcement.revokeUserTokens(userId);
      
      return reply.send({
        success: true,
        message: 'All usage tokens revoked',
      });
    } catch (error: unknown) {
      fastify.log.error({ error: toErrorMessage(error) }, 'Failed to revoke tokens');
      return reply.status(500).send({ success: false, error: 'Failed to revoke tokens' });
    }
  });
}
