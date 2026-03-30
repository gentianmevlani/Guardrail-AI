/**
 * Unified Tier-Aware Rate Limiter
 *
 * Single source of truth for all rate limiting in guardrail API.
 * Redis-backed with explicit degraded mode fallback to in-memory.
 *
 * Features:
 * - Tier-aware limits (free, starter, pro, compliance, enterprise)
 * - Redis primary with in-memory fallback (logged as DEGRADED MODE)
 * - Per-user (userId), per-API-key, or per-IP rate limiting
 * - Per-route policies: auth, api, public
 * - Metrics and observability
 */

import { createHash } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
// =============================================================================
// TYPES
// =============================================================================

export type Tier = "free" | "starter" | "pro" | "compliance" | "enterprise" | "unlimited";

export type RoutePolicy = "auth" | "api" | "public";

export interface TierRateLimits {
  /** Requests per minute for API endpoints */
  apiRequestsPerMinute: number;
  /** Requests per minute for expensive operations (scans, analysis) */
  expensiveRequestsPerMinute: number;
  /** Requests per minute for uploads */
  uploadsPerMinute: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
  degradedMode: boolean;
}

export interface RateLimiterConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Key prefix for Redis keys */
  keyPrefix?: string;
  /** If true, deny requests when Redis is down. If false, use in-memory fallback */
  failClosed?: boolean;
}

// =============================================================================
// TIER RATE LIMITS (from shared tier config)
// =============================================================================

export const TIER_RATE_LIMITS: Record<Tier, TierRateLimits> = {
  free: {
    apiRequestsPerMinute: 60,
    expensiveRequestsPerMinute: 5,
    uploadsPerMinute: 5,
  },
  starter: {
    apiRequestsPerMinute: 200,
    expensiveRequestsPerMinute: 20,
    uploadsPerMinute: 20,
  },
  pro: {
    apiRequestsPerMinute: 500,
    expensiveRequestsPerMinute: 50,
    uploadsPerMinute: 50,
  },
  compliance: {
    apiRequestsPerMinute: 1000,
    expensiveRequestsPerMinute: 100,
    uploadsPerMinute: 100,
  },
  enterprise: {
    apiRequestsPerMinute: 5000,
    expensiveRequestsPerMinute: 500,
    uploadsPerMinute: 500,
  },
  unlimited: {
    apiRequestsPerMinute: Infinity,
    expensiveRequestsPerMinute: Infinity,
    uploadsPerMinute: Infinity,
  },
};

/** Auth endpoint limits (IP-based, not tier-based) */
export const AUTH_RATE_LIMITS = {
  loginAttemptsPerMinute: 5,
  signupAttemptsPerMinute: 3,
  passwordResetPerHour: 3,
  tokenRefreshPerMinute: 10,
};

/** Public endpoint limits (IP-based, conservative) */
export const PUBLIC_RATE_LIMITS = {
  requestsPerMinute: 30,
};

// =============================================================================
// REDIS CLIENT
// =============================================================================

let redisClient: any = null;
let redisAvailable = false;
let degradedModeLogged = false;

// Circuit breaker for Redis flapping
let circuitBreakerOpen = false;
let circuitBreakerLastOpened = 0;
const CIRCUIT_BREAKER_COOLDOWN = 60000; // 1 minute cooldown
let redisDownLogged = false;

const rateLimitLogger = logger.child({ service: "rate-limiter" });

// =============================================================================
// UTILITIES
// =============================================================================

/** Generate a unique request ID for logging */
function generateRequestId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Determine if an operation is sensitive based on route patterns and metadata
 * 
 * Sensitive operations include:
 * - Billing operations (payments, subscriptions)
 * - Authentication operations (login, signup, password reset)
 * - API key management (create, delete, rotate)
 * - Expensive scans and operations
 * - Admin operations
 */
export function isSensitiveOperation(request: FastifyRequest): boolean {
  const route = request.routeOptions?.url || request.url;
  const method = request.method;
  
  // Route pattern allowlist for sensitive operations
  const sensitivePatterns = [
    // Billing routes
    /^\/billing\//,
    /^\/api\/billing\//,
    /^\/stripe\//,
    
    // Authentication routes
    /^\/auth\//,
    /^\/api\/auth\//,
    /^\/login/,
    /^\/signup/,
    /^\/password/,
    /^\/reset/,
    
    // API key management
    /^\/api-keys/,
    /^\/api\/api-keys/,
    
    // Expensive operations
    /^\/scans.*\/(start|run|execute)/,
    /^\/api\/scans.*\/(start|run|execute)/,
    /^\/ship/,
    /^\/api\/ship/,
    /^\/reality.*\/(run|execute)/,
    /^\/api\/reality.*\/(run|execute)/,
    
    // Admin operations
    /^\/admin/,
    /^\/api\/admin/,
    /^\/organizations/,
    /^\/api\/organizations/,
  ];
  
  // Check against route patterns
  for (const pattern of sensitivePatterns) {
    if (pattern.test(route)) {
      return true;
    }
  }
  
  // Check route metadata if available
  const routeConfig = (request.routeOptions as any)?.config;
  if (routeConfig?.sensitive === true) {
    return true;
  }
  
  // Check HTTP method for sensitive operations
  const sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (sensitiveMethods.includes(method) && (
    route.includes('/billing') ||
    route.includes('/auth') ||
    route.includes('/api-keys') ||
    route.includes('/admin')
  )) {
    return true;
  }
  
  return false;
}

async function initRedis(url: string): Promise<boolean> {
  try {
    const Redis = (await import("ioredis")).default;
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          rateLimitLogger.error(
            { attempts: times },
            "Redis connection failed after max retries"
          );
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    // Handle connection events
    redisClient.on("error", (err: Error) => {
      if (redisAvailable) {
        // Log Redis down with circuit breaker to prevent spam
        if (!circuitBreakerOpen || Date.now() - circuitBreakerLastOpened > CIRCUIT_BREAKER_COOLDOWN) {
          rateLimitLogger.error(
            { error: err.message, requestId: generateRequestId() },
            "rate_limiter.redis_down: Redis connection error - entering DEGRADED MODE"
          );
          redisDownLogged = true;
          circuitBreakerOpen = true;
          circuitBreakerLastOpened = Date.now();
        }
        redisAvailable = false;
        degradedModeLogged = false;
      }
    });

    redisClient.on("connect", () => {
      rateLimitLogger.info("Redis rate limiter connected");
      redisAvailable = true;
      degradedModeLogged = false;
      circuitBreakerOpen = false;
      redisDownLogged = false;
    });

    redisClient.on("reconnecting", () => {
      rateLimitLogger.warn("Redis rate limiter reconnecting...");
    });

    await redisClient.connect();
    redisAvailable = true;
    rateLimitLogger.info("Redis rate limiter initialized successfully");
    return true;
  } catch (error: unknown) {
    rateLimitLogger.warn(
      { error: toErrorMessage(error) },
      "Redis unavailable - rate limiter starting in DEGRADED MODE (in-memory fallback)"
    );
    redisAvailable = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function isDegradedMode(): boolean {
  return !redisAvailable;
}

// =============================================================================
// IN-MEMORY FALLBACK (DEGRADED MODE)
// =============================================================================

interface MemoryRecord {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, MemoryRecord>();

function cleanupMemoryStore(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of memoryStore.entries()) {
    // Remove records older than 2 hours
    if (now - record.windowStart > 7200000) {
      memoryStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    rateLimitLogger.debug(
      { cleaned, remaining: memoryStore.size },
      "Memory store cleanup (DEGRADED MODE)"
    );
  }
}

// Cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupMemoryStore, 300000);
cleanupInterval.unref();

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  // Log degraded mode warning once per degraded period
  if (!degradedModeLogged) {
    rateLimitLogger.warn(
      { store: "memory", keyCount: memoryStore.size },
      "⚠️ DEGRADED MODE: Rate limiting using in-memory fallback. Redis is unavailable."
    );
    degradedModeLogged = true;
  }

  // Handle unlimited tier
  if (limit === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      resetAt: Date.now() + windowMs,
      degradedMode: true,
    };
  }

  const now = Date.now();
  let record = memoryStore.get(key);

  // Reset window if expired
  if (!record || now - record.windowStart > windowMs) {
    record = { count: 0, windowStart: now };
    memoryStore.set(key, record);
  }

  record.count++;

  const resetAt = record.windowStart + windowMs;
  const remaining = Math.max(0, limit - record.count);
  const allowed = record.count <= limit;

  return {
    allowed,
    remaining,
    limit,
    resetAt,
    retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
    degradedMode: true,
  };
}

// =============================================================================
// REDIS RATE LIMIT CHECK
// =============================================================================

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  // Handle unlimited tier
  if (limit === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      resetAt: Date.now() + windowMs,
      degradedMode: false,
    };
  }

  if (!redisClient || !redisAvailable) {
    return checkRateLimitMemory(key, limit, windowMs);
  }

  try {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rl:${key}`;

    // Use Redis sorted set for sliding window
    const multi = redisClient.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(redisKey, 0, windowStart);

    // Add current request with unique identifier
    multi.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2)}`);

    // Count requests in window
    multi.zcard(redisKey);

    // Set expiry (slightly longer than window to handle edge cases)
    multi.pexpire(redisKey, windowMs + 1000);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) || 0;

    const resetAt = now + windowMs;
    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;

    return {
      allowed,
      remaining,
      limit,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
      degradedMode: false,
    };
  } catch (error: unknown) {
    rateLimitLogger.error(
      { error: toErrorMessage(error), key },
      "Redis rate limit check failed - falling back to DEGRADED MODE"
    );
    redisAvailable = false;
    degradedModeLogged = false;
    return checkRateLimitMemory(key, limit, windowMs);
  }
}

// =============================================================================
// KEY GENERATORS
// =============================================================================

export function getClientIP(request: FastifyRequest): string {
  // Check common proxy headers
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(",")[0].trim();
  }

  const realIp = request.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return request.ip || "unknown";
}

function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Generate rate limit key based on authentication state
 * Priority: userId > apiKeyId > IP
 */
export function generateRateLimitKey(
  request: FastifyRequest,
  prefix: string
): { key: string; identifier: string; type: "user" | "apiKey" | "ip" } {
  const user = (request as any).user;
  const apiKey = (request as any).apiKey;

  // Authenticated user
  if (user?.id) {
    return {
      key: `${prefix}:user:${user.id}`,
      identifier: user.id,
      type: "user",
    };
  }

  // API key authentication
  if (apiKey?.id) {
    return {
      key: `${prefix}:key:${apiKey.id}`,
      identifier: apiKey.id,
      type: "apiKey",
    };
  }

  // Fallback to IP
  const ip = getClientIP(request);
  return {
    key: `${prefix}:ip:${hashIP(ip)}`,
    identifier: ip,
    type: "ip",
  };
}

/**
 * Get user's tier from request
 */
export function getUserTier(request: FastifyRequest): Tier {
  const user = (request as any).user;
  const apiKey = (request as any).apiKey;

  // Check user's subscription tier
  if (user?.subscriptionTier && user.subscriptionTier in TIER_RATE_LIMITS) {
    return user.subscriptionTier as Tier;
  }

  // Check API key's tier
  if (apiKey?.tier && apiKey.tier in TIER_RATE_LIMITS) {
    return apiKey.tier as Tier;
  }

  // Default to free tier
  return "free";
}

// =============================================================================
// RATE LIMIT MIDDLEWARE FACTORY
// =============================================================================

export interface RateLimitOptions {
  /** Route policy type */
  policy: RoutePolicy;
  /** Override limit type for API policy */
  limitType?: "api" | "expensive" | "upload";
  /** Custom window in milliseconds (default: 60000 for 1 minute) */
  windowMs?: number;
  /** Skip rate limiting for certain requests */
  skip?: (request: FastifyRequest) => boolean;
  /** Mark this route as sensitive (fails closed when Redis is down) */
  sensitive?: boolean;
}

/**
 * Create tier-aware rate limit middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { policy, limitType = "api", windowMs = 60000, skip, sensitive = false } = options;

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    // Check skip condition
    if (skip && skip(request)) {
      return;
    }

    // Determine if this is a sensitive operation
    const isSensitive = sensitive || isSensitiveOperation(request);
    
    // If Redis is down and this is a sensitive operation, fail closed
    if (!redisAvailable && isSensitive) {
      const requestId = generateRequestId();
      const ip = getClientIP(request);
      const user = (request as any).user;
      const apiKey = (request as any).apiKey;
      
      rateLimitLogger.error(
        {
          event: "rate_limiter.redis_down",
          requestId,
          route: request.routeOptions?.url || request.url,
          method: request.method,
          ip,
          userId: user?.id,
          apiKeyId: apiKey?.id,
          sensitive: true,
        },
        "Sensitive operation rejected: Redis unavailable"
      );
      
      reply.status(503).send({
        success: false,
        error: "Service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
        message: "Rate limiting service is temporarily unavailable. Please try again later.",
        requestId,
      });
      return;
    }

    let limit: number;
    let keyInfo: { key: string; identifier: string; type: string };

    switch (policy) {
      case "auth":
        // Auth endpoints: IP-based, fixed limits
        const ip = getClientIP(request);
        keyInfo = {
          key: `auth:ip:${hashIP(ip)}`,
          identifier: ip,
          type: "ip",
        };
        limit = AUTH_RATE_LIMITS.loginAttemptsPerMinute;
        break;

      case "public":
        // Public endpoints: IP-based, conservative limits
        const publicIp = getClientIP(request);
        keyInfo = {
          key: `public:ip:${hashIP(publicIp)}`,
          identifier: publicIp,
          type: "ip",
        };
        limit = PUBLIC_RATE_LIMITS.requestsPerMinute;
        break;

      case "api":
      default:
        // API endpoints: tier-based limits
        const tier = getUserTier(request);
        const tierLimits = TIER_RATE_LIMITS[tier];
        keyInfo = generateRateLimitKey(request, `api:${limitType}`);

        switch (limitType) {
          case "expensive":
            limit = tierLimits.expensiveRequestsPerMinute;
            break;
          case "upload":
            limit = tierLimits.uploadsPerMinute;
            break;
          default:
            limit = tierLimits.apiRequestsPerMinute;
        }
        break;
    }

    // Check if Redis is available and apply appropriate rate limiting
    let result: RateLimitResult;
    
    if (redisAvailable) {
      // Use Redis rate limiting
      result = await checkRateLimitRedis(keyInfo.key, limit, windowMs);
    } else {
      // Redis is down - use in-memory fallback at 50% of normal limits for non-sensitive ops
      const fallbackLimit = isSensitive ? 0 : Math.floor(limit * 0.5);
      
      // Log fallback usage with circuit breaker
      if (!redisDownLogged || Date.now() - circuitBreakerLastOpened > CIRCUIT_BREAKER_COOLDOWN) {
        const requestId = generateRequestId();
        const ip = getClientIP(request);
        const user = (request as any).user;
        const apiKey = (request as any).apiKey;
        
        rateLimitLogger.warn(
          {
            event: "rate_limiter.fallback_used",
            requestId,
            route: request.routeOptions?.url || request.url,
            method: request.method,
            ip,
            userId: user?.id,
            apiKeyId: apiKey?.id,
            originalLimit: limit,
            fallbackLimit,
            sensitive,
          },
          "Using in-memory rate limiting fallback (50% of normal limits)"
        );
        
        redisDownLogged = true;
        circuitBreakerLastOpened = Date.now();
      }
      
      result = checkRateLimitMemory(keyInfo.key, fallbackLimit, windowMs);
    }

    // Set rate limit headers
    reply.header("X-RateLimit-Limit", result.limit === Infinity ? "unlimited" : result.limit);
    reply.header("X-RateLimit-Remaining", result.remaining === Infinity ? "unlimited" : result.remaining);
    reply.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    // Add degraded mode header if applicable
    if (result.degradedMode) {
      reply.header("X-RateLimit-Mode", "degraded");
    }

    if (!result.allowed) {
      rateLimitLogger.warn(
        {
          key: keyInfo.key,
          identifier: keyInfo.identifier,
          identifierType: keyInfo.type,
          policy,
          limit: result.limit,
          ip: getClientIP(request),
          path: request.url,
          method: request.method,
          degradedMode: result.degradedMode,
        },
        "Rate limit exceeded"
      );

      reply.header("Retry-After", result.retryAfter);
      reply.status(429).send({
        success: false,
        error: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: result.retryAfter,
        limit: result.limit,
        remaining: 0,
        ...(result.degradedMode && { mode: "degraded" }),
      });
    }
  };
}

// =============================================================================
// PRE-CONFIGURED MIDDLEWARE
// =============================================================================

/** Auth endpoints: 5 login attempts/min per IP (sensitive) */
export const authRateLimit = createRateLimiter({ policy: "auth", sensitive: true });

/** Public endpoints: 30 req/min per IP */
export const publicRateLimit = createRateLimiter({ policy: "public" });

/** API endpoints: tier-based limits */
export const apiRateLimit = createRateLimiter({ policy: "api", limitType: "api" });

/** Expensive operations (scans, analysis): tier-based limits (sensitive) */
export const expensiveRateLimit = createRateLimiter({ policy: "api", limitType: "expensive", sensitive: true });

/** Upload operations: tier-based limits */
export const uploadRateLimit = createRateLimiter({ policy: "api", limitType: "upload" });

/** Billing operations: sensitive, fail closed when Redis is down */
export const billingRateLimit = createRateLimiter({ policy: "api", limitType: "api", sensitive: true });

/** API key management: sensitive, fail closed when Redis is down */
export const apiKeyManagementRateLimit = createRateLimiter({ policy: "api", limitType: "api", sensitive: true });

/** Admin operations: sensitive, fail closed when Redis is down */
export const adminRateLimit = createRateLimiter({ policy: "api", limitType: "api", sensitive: true });

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

let initialized = false;

export async function initRateLimiter(config?: RateLimiterConfig): Promise<void> {
  if (initialized) {
    rateLimitLogger.debug("Rate limiter already initialized");
    return;
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL;

  if (redisUrl) {
    await initRedis(redisUrl);
  } else {
    rateLimitLogger.warn(
      "No REDIS_URL configured - rate limiter running in DEGRADED MODE (in-memory only)"
    );
  }

  initialized = true;

  rateLimitLogger.info(
    {
      redis: redisAvailable,
      degradedMode: !redisAvailable,
      tiers: Object.keys(TIER_RATE_LIMITS),
    },
    "Rate limiter initialized"
  );
}

/**
 * Fastify plugin for rate limiting
 * NOTE: This does NOT apply a global rate limit. Use per-route middleware instead.
 */
export async function rateLimitPlugin(
  fastify: FastifyInstance,
  options: RateLimiterConfig = {}
): Promise<void> {
  await initRateLimiter(options);

  // Decorate fastify with rate limit utilities
  fastify.decorate("rateLimiter", {
    createRateLimiter,
    authRateLimit,
    publicRateLimit,
    apiRateLimit,
    expensiveRateLimit,
    uploadRateLimit,
    billingRateLimit,
    apiKeyManagementRateLimit,
    adminRateLimit,
    isRedisAvailable,
    isDegradedMode,
    isSensitiveOperation,
  });

  rateLimitLogger.info(
    {
      redis: redisAvailable,
      degradedMode: !redisAvailable,
    },
    "Rate limit plugin registered (no global limit applied)"
  );
}

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/** Reset rate limiter state (for testing) */
export function resetRateLimiter(): void {
  memoryStore.clear();
  degradedModeLogged = false;
}

/** Get current memory store size (for testing/monitoring) */
export function getMemoryStoreSize(): number {
  return memoryStore.size;
}

/** Force degraded mode (for testing) */
export function forceDegradedMode(enabled: boolean): void {
  redisAvailable = !enabled;
  degradedModeLogged = false;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  checkRateLimitMemory,
  checkRateLimitRedis,
};

