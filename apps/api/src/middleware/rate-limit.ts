/**
 * Rate Limiting Middleware (DEPRECATED)
 *
 * @deprecated Use redis-rate-limiter.ts instead. This file is a thin wrapper
 * for backwards compatibility only.
 *
 * All rate limiting is now handled by the unified tier-aware rate limiter
 * in redis-rate-limiter.ts which provides:
 * - Redis-backed rate limiting with in-memory fallback
 * - Tier-aware limits (free, starter, pro, compliance, enterprise)
 * - Per-user, per-API-key, or per-IP rate limiting
 */

import { FastifyRequest } from "fastify";
import {
    createRateLimiter as createUnifiedRateLimiter,
    getUserTier,
    TIER_RATE_LIMITS,
    apiRateLimit as unifiedApiRateLimit,
    authRateLimit as unifiedAuthRateLimit,
    expensiveRateLimit as unifiedExpensiveRateLimit
} from "./redis-rate-limiter";

// Re-export the unified rate limiter
export { createUnifiedRateLimiter as createRateLimiter };

/**
 * @deprecated Use apiRateLimit from redis-rate-limiter.ts
 */
export const standardRateLimiter = unifiedApiRateLimit;

/**
 * @deprecated Use authRateLimit from redis-rate-limiter.ts
 */
export const authRateLimiter = unifiedAuthRateLimit;

/**
 * @deprecated Use expensiveRateLimit from redis-rate-limiter.ts
 */
export const strictRateLimiter = unifiedExpensiveRateLimit;

/**
 * @deprecated Use apiRateLimit from redis-rate-limiter.ts (tier-aware)
 */
export const readRateLimiter = unifiedApiRateLimit;

/**
 * @deprecated Tier-based limiting is now automatic via redis-rate-limiter.ts
 */
export function createTieredRateLimiter(
  _tierLimits: Record<string, number>,
  _windowSeconds = 3600
) {
  // Return the unified tier-aware rate limiter
  return createUnifiedRateLimiter({ policy: "api", limitType: "expensive" });
}

/**
 * Get current rate limit status for a request
 * @deprecated This is a simplified version for backwards compatibility
 */
export async function getRateLimitStatus(
  request: FastifyRequest,
  _prefix = "api"
): Promise<{
  limit: number;
  remaining: number;
  resetAt: Date;
  isLimited: boolean;
}> {
  const tier = getUserTier(request);
  const limits = TIER_RATE_LIMITS[tier];

  // Return tier-based limits (actual remaining would require Redis query)
  return {
    limit: limits.apiRequestsPerMinute,
    remaining: limits.apiRequestsPerMinute, // Approximation
    resetAt: new Date(Date.now() + 60000),
    isLimited: false,
  };
}
