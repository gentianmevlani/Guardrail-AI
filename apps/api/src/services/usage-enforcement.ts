/**
 * Server-Authoritative Usage Enforcement Service
 * 
 * This service is the SINGLE SOURCE OF TRUTH for usage limits.
 * Local ~/.guardrail/usage.json is only a cache - never authoritative.
 * 
 * Features:
 * - Server-side usage counters per user per billing period
 * - HMAC-signed usage tokens for anti-tamper caching
 * - Offline allowance with sync requirement
 * - Atomic increment operations
 */

import { pool } from '@guardrail/database';
import crypto from 'crypto';
import * as usageQueries from '../db/queries/usage-queries';

// ============================================================================
// TYPES
// ============================================================================

export type UsageActionType = 'scan' | 'reality' | 'agent' | 'gate' | 'fix';

export interface UsageCounter {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  scanCount: number;
  realityCount: number;
  agentCount: number;
  gateCount: number;
  fixCount: number;
  updatedAt: Date;
}

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  reason?: string;
}

export interface SignedUsageToken {
  token: string;
  signature: string;
  expiresAt: Date;
  payload: UsageTokenPayload;
}

export interface UsageTokenPayload {
  userId: string;
  periodStart: string;
  scanCount: number;
  realityCount: number;
  agentCount: number;
  gateCount: number;
  fixCount: number;
  tier: string;
  limits: TierLimits;
  issuedAt: string;
  expiresAt: string;
}

export interface TierLimits {
  scans: number;
  reality: number;
  agent: number;
  gate: number;
  fix: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HMAC_SECRET = process.env.USAGE_HMAC_SECRET || process.env.JWT_SECRET || 'guardrail-usage-secret-change-in-production';
const TOKEN_TTL_SECONDS = 300; // 5 minutes - short TTL for security
const OFFLINE_ALLOWANCE = 1; // Max 1 action allowed offline before sync required

const TIER_LIMITS: Record<string, TierLimits> = {
  free: { scans: 10, reality: 0, agent: 0, gate: 10, fix: 0 },
  starter: { scans: 100, reality: 20, agent: 0, gate: 100, fix: 20 },
  pro: { scans: 500, reality: 100, agent: 50, gate: 500, fix: 100 },
  compliance: { scans: 1000, reality: 200, agent: 100, gate: 1000, fix: 200 },
  enterprise: { scans: 5000, reality: 1000, agent: 500, gate: 5000, fix: 1000 },
  unlimited: { scans: -1, reality: -1, agent: -1, gate: -1, fix: -1 }, // -1 = unlimited
};

const ACTION_TO_COLUMN: Record<UsageActionType, string> = {
  scan: 'scan_count',
  reality: 'reality_count',
  agent: 'agent_count',
  gate: 'gate_count',
  fix: 'fix_count',
};

const ACTION_TO_LIMIT_KEY: Record<UsageActionType, keyof TierLimits> = {
  scan: 'scans',
  reality: 'reality',
  agent: 'agent',
  gate: 'gate',
  fix: 'fix',
};

// ============================================================================
// BILLING PERIOD HELPERS
// ============================================================================

export function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

// ============================================================================
// HMAC SIGNING
// ============================================================================

function signPayload(payload: object): string {
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

function verifySignature(payload: object, signature: string): boolean {
  const expected = signPayload(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// USAGE ENFORCEMENT SERVICE
// ============================================================================

export class UsageEnforcementService {
  /**
   * Get or create usage counter for current billing period
   */
  async getOrCreateCounter(userId: string): Promise<UsageCounter> {
    const { start, end } = getCurrentBillingPeriod();
    
    // Use DAL function for atomic get-or-create
    const counter = await usageQueries.getOrCreateUsageCounter(userId, start, end);
    
    return {
      userId: counter.userId,
      periodStart: counter.periodStart,
      periodEnd: counter.periodEnd,
      scanCount: counter.scanCount,
      realityCount: counter.realityCount,
      agentCount: counter.agentCount,
      gateCount: counter.gateCount,
      fixCount: counter.fixCount,
      updatedAt: counter.updatedAt,
    };
  }
  
  /**
   * Get user's tier from subscription
   */
  async getUserTier(userId: string): Promise<string> {
    const result = await pool.query(
      `SELECT tier FROM subscriptions WHERE "userId" = $1 AND status = 'active' ORDER BY "createdAt" DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.tier || 'free';
  }
  
  /**
   * Check if an action is allowed (does NOT increment)
   */
  async checkUsage(userId: string, actionType: UsageActionType): Promise<UsageCheckResult> {
    const counter = await this.getOrCreateCounter(userId);
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    
    const limitKey = ACTION_TO_LIMIT_KEY[actionType];
    const limit = limits[limitKey];
    
    const countMap: Record<UsageActionType, number> = {
      scan: counter.scanCount,
      reality: counter.realityCount,
      agent: counter.agentCount,
      gate: counter.gateCount,
      fix: counter.fixCount,
    };
    const current = countMap[actionType];
    
    // -1 means unlimited
    const isUnlimited = limit === -1;
    const allowed = isUnlimited || current < limit;
    const remaining = isUnlimited ? -1 : Math.max(0, limit - current);
    
    return {
      allowed,
      current,
      limit,
      remaining,
      periodStart: counter.periodStart.toISOString(),
      periodEnd: counter.periodEnd.toISOString(),
      reason: allowed ? undefined : `Monthly ${actionType} limit reached (${current}/${limit})`,
    };
  }
  
  /**
   * Increment usage counter atomically (server-authoritative)
   * Returns the new count and whether the action was allowed
   */
  async incrementUsage(userId: string, actionType: UsageActionType, count: number = 1): Promise<UsageCheckResult> {
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const limitKey = ACTION_TO_LIMIT_KEY[actionType];
    const limit = limits[limitKey];
    
    const { start, end } = getCurrentBillingPeriod();
    const column = ACTION_TO_COLUMN[actionType];
    
    // Use DAL function for atomic increment
    const result = await usageQueries.incrementUsageCounter(userId, start, column as any, count);
    
    const isUnlimited = limit === -1;
    const allowed = isUnlimited || result.currentCount <= limit;
    const remaining = isUnlimited ? -1 : Math.max(0, limit - result.currentCount);
    
    return {
      allowed,
      current: result.currentCount,
      limit,
      remaining,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      reason: allowed ? undefined : `Monthly ${actionType} limit exceeded (${result.currentCount}/${limit})`,
    };
  }
  
  /**
   * Issue a signed usage token for client-side caching
   * Token is short-lived and HMAC-signed to prevent tampering
   */
  async issueSignedToken(userId: string): Promise<SignedUsageToken> {
    const counter = await this.getOrCreateCounter(userId);
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_SECONDS * 1000);
    
    const payload: UsageTokenPayload = {
      userId,
      periodStart: counter.periodStart.toISOString(),
      scanCount: counter.scanCount,
      realityCount: counter.realityCount,
      agentCount: counter.agentCount,
      gateCount: counter.gateCount,
      fixCount: counter.fixCount,
      tier,
      limits,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    const signature = signPayload(payload);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    
    // Store token in database for verification
    await usageQueries.storeUsageToken(userId, tokenHash, signature, payload, now, expiresAt);
    
    return { token, signature, expiresAt, payload };
  }
  
  /**
   * Verify a signed usage token
   * Returns null if invalid/expired/tampered
   */
  async verifyToken(token: string, signature: string): Promise<UsageTokenPayload | null> {
    const tokenHash = hashToken(token);
    
    // Look up token in database
    const tokenData = await usageQueries.verifyUsageToken(tokenHash);
    
    if (!tokenData) {
      return null;
    }
    
    // Verify HMAC signature
    if (!verifySignature(tokenData.payload, signature)) {
      // Signature mismatch - potential tampering, revoke token
      await usageQueries.revokeUsageToken(tokenHash);
      return null;
    }
    
    return tokenData.payload as UsageTokenPayload;
  }
  
  /**
   * Revoke all tokens for a user (e.g., on logout or suspicious activity)
   */
  async revokeUserTokens(userId: string): Promise<void> {
    await usageQueries.revokeAllUserTokens(userId);
  }
  
  /**
   * Queue offline usage for later sync
   */
  async queueOfflineUsage(userId: string, actionType: UsageActionType, machineId?: string): Promise<{ queued: boolean; offlineCount: number }> {
    // Check current queue size
    const currentCount = await usageQueries.getPendingOfflineCount(userId);
    
    if (currentCount >= OFFLINE_ALLOWANCE) {
      return { queued: false, offlineCount: currentCount };
    }
    
    // Queue the action
    const result = await usageQueries.queueOfflineUsage(userId, actionType, machineId);
    
    return { queued: result.queued, offlineCount: result.offlineCount };
  }
  
  /**
   * Sync offline usage to server counters
   */
  async syncOfflineUsage(userId: string): Promise<{ synced: number; failed: number }> {
    // Get all unsynced actions
    const pendingActions = await usageQueries.getPendingOfflineUsage(userId);
    
    let synced = 0;
    let failed = 0;
    
    for (const action of pendingActions) {
      try {
        await this.incrementUsage(userId, action.actionType as UsageActionType, action.count);
        await usageQueries.markOfflineUsageSynced(action.id);
        synced++;
      } catch {
        failed++;
      }
    }
    
    return { synced, failed };
  }
  
  /**
   * Get pending offline usage count
   */
  async getPendingOfflineCount(userId: string): Promise<number> {
    return await usageQueries.getPendingOfflineCount(userId);
  }
  
  /**
   * Get full usage summary for a user
   */
  async getUsageSummary(userId: string): Promise<{
    tier: string;
    limits: TierLimits;
    usage: UsageCounter;
    pendingOffline: number;
  }> {
    const counter = await this.getOrCreateCounter(userId);
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const pendingOffline = await this.getPendingOfflineCount(userId);
    
    return { tier, limits, usage: counter, pendingOffline };
  }
  
  /**
   * Clean up expired tokens (call periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    return await usageQueries.cleanupExpiredTokens();
  }
}

// Singleton export
export const usageEnforcement = new UsageEnforcementService();
