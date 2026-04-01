/**
 * Per-User Rate Limiting Middleware (DEPRECATED)
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

import { logger } from "../logger";
import {
    getMemoryStoreSize,
    apiRateLimit as unifiedApiRateLimit,
    authRateLimit as unifiedAuthRateLimit,
    expensiveRateLimit as unifiedExpensiveRateLimit,
    uploadRateLimit as unifiedUploadRateLimit
} from "./redis-rate-limiter";

const rateLimitLogger = logger.child({ service: "rate-limiter-compat" });

/**
 * @deprecated Use the unified rate limiter from redis-rate-limiter.ts
 */
class RateLimiter {
  /**
   * @deprecated Use createRateLimiter from redis-rate-limiter.ts
   */
  middleware(_config: any = {}) {
    rateLimitLogger.warn(
      "Using deprecated RateLimiter.middleware() - migrate to redis-rate-limiter.ts"
    );
    return unifiedApiRateLimit;
  }

  /**
   * @deprecated No longer needed - cleanup is automatic
   */
  getStatus(_key: string): any {
    return undefined;
  }

  /**
   * @deprecated No longer needed
   */
  reset(_key: string): void {
    rateLimitLogger.warn("RateLimiter.reset() is deprecated and has no effect");
  }

  /**
   * Get statistics (compatibility shim)
   */
  getStats(): {
    totalKeys: number;
    blockedKeys: number;
    averageRequests: number;
  } {
    return {
      totalKeys: getMemoryStoreSize(),
      blockedKeys: 0,
      averageRequests: 0,
    };
  }
}

// Export singleton instance for backwards compatibility
export const rateLimiter = new RateLimiter();

/**
 * @deprecated Use createRateLimiter from redis-rate-limiter.ts
 */
export const createRateLimit = (_config?: unknown) => {
  rateLimitLogger.warn(
    "Using deprecated createRateLimit() - migrate to redis-rate-limiter.ts"
  );
  return unifiedApiRateLimit;
};

/**
 * @deprecated Use authRateLimit from redis-rate-limiter.ts
 */
export const authRateLimit = unifiedAuthRateLimit;

/**
 * @deprecated Use apiRateLimit from redis-rate-limiter.ts
 */
export const apiRateLimit = unifiedApiRateLimit;

/**
 * @deprecated Use uploadRateLimit from redis-rate-limiter.ts
 */
export const uploadRateLimit = unifiedUploadRateLimit;

/**
 * @deprecated Use expensiveRateLimit from redis-rate-limiter.ts
 */
export const scanRateLimit = unifiedExpensiveRateLimit;
