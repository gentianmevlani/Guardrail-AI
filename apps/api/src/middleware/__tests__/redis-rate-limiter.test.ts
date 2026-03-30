/**
 * Tests for Unified Tier-Aware Rate Limiter
 *
 * Tests cover:
 * - Free vs Enterprise rate behavior
 * - Redis down -> fallback works + logs warning
 * - Per-route policies (auth, api, public)
 * - Key generation (userId, apiKeyId, IP)
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    apiRateLimit,
    AUTH_RATE_LIMITS,
    authRateLimit,
    billingRateLimit,
    checkRateLimitMemory,
    createRateLimiter,
    forceDegradedMode,
    generateRateLimitKey,
    getClientIP,
    getMemoryStoreSize,
    getUserTier,
    isDegradedMode,
    isSensitiveOperation,
    PUBLIC_RATE_LIMITS,
    resetRateLimiter,
    TIER_RATE_LIMITS,
} from "../redis-rate-limiter";

// Mock logger
vi.mock("../../logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to create mock request
function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    ip: "127.0.0.1",
    headers: {
      "user-agent": "test-agent",
      accept: "application/json",
      "accept-language": "en-US",
    },
    url: "/api/test",
    method: "GET",
    ...overrides,
  } as any as FastifyRequest;
}

// Helper to create mock reply
function createMockReply(): FastifyReply {
  const headers: Record<string, string> = {};
  const headerFn = vi.fn((key: string, value: string) => mockReply);
  const statusFn = vi.fn(() => mockReply);
  const sendFn = vi.fn();
  
  const mockReply: any = {
    header: headerFn,
    status: statusFn,
    send: sendFn,
    getHeaders: () => headers,
  };
  
  // Update header fn to store values
  headerFn.mockImplementation((key: string, value: string) => {
    headers[key] = value;
    return mockReply;
  });
  
  return mockReply as FastifyReply;
}

describe("Redis Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimiter();
    forceDegradedMode(true); // Use in-memory for tests
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe("Tier Rate Limits Configuration", () => {
    it("should have correct free tier limits", () => {
      expect(TIER_RATE_LIMITS.free).toEqual({
        apiRequestsPerMinute: 60,
        expensiveRequestsPerMinute: 5,
        uploadsPerMinute: 5,
      });
    });

    it("should have correct enterprise tier limits", () => {
      expect(TIER_RATE_LIMITS.enterprise).toEqual({
        apiRequestsPerMinute: 5000,
        expensiveRequestsPerMinute: 500,
        uploadsPerMinute: 500,
      });
    });

    it("should have unlimited tier with Infinity limits", () => {
      expect(TIER_RATE_LIMITS.unlimited.apiRequestsPerMinute).toBe(Infinity);
      expect(TIER_RATE_LIMITS.unlimited.expensiveRequestsPerMinute).toBe(Infinity);
      expect(TIER_RATE_LIMITS.unlimited.uploadsPerMinute).toBe(Infinity);
    });

    it("should have auth rate limits for IP-based limiting", () => {
      expect(AUTH_RATE_LIMITS.loginAttemptsPerMinute).toBe(5);
      expect(AUTH_RATE_LIMITS.signupAttemptsPerMinute).toBe(3);
    });

    it("should have conservative public rate limits", () => {
      expect(PUBLIC_RATE_LIMITS.requestsPerMinute).toBe(30);
    });
  });

  describe("Free vs Enterprise Rate Behavior", () => {
    it("should allow free tier user 60 requests per minute", async () => {
      const limiter = createRateLimiter({ policy: "api", limitType: "api" });
      const request = createMockRequest({
        user: { id: "free-user-1", subscriptionTier: "free" },
      } as any);

      // Make 60 requests - all should pass
      for (let i = 0; i < 60; i++) {
        const reply = createMockReply();
        await limiter(request, reply);
        expect(reply.status).not.toHaveBeenCalledWith(429);
      }

      // 61st request should be rate limited
      const reply = createMockReply();
      await limiter(request, reply);
      expect(reply.status).toHaveBeenCalledWith(429);
    });

    it("should allow enterprise tier user 5000 requests per minute", async () => {
      const limiter = createRateLimiter({ policy: "api", limitType: "api" });
      const request = createMockRequest({
        user: { id: "enterprise-user-1", subscriptionTier: "enterprise" },
      } as any);

      // Make 100 requests - all should pass (well under 5000 limit)
      for (let i = 0; i < 100; i++) {
        const reply = createMockReply();
        await limiter(request, reply);
        expect(reply.status).not.toHaveBeenCalledWith(429);
      }
    });

    it("should have different expensive operation limits per tier", async () => {
      const limiter = createRateLimiter({ policy: "api", limitType: "expensive" });

      // Free tier: 5 expensive ops/min
      const freeRequest = createMockRequest({
        user: { id: "free-user-2", subscriptionTier: "free" },
      } as any);

      for (let i = 0; i < 5; i++) {
        const reply = createMockReply();
        await limiter(freeRequest, reply);
        expect(reply.status).not.toHaveBeenCalledWith(429);
      }

      // 6th request should be rate limited
      const freeReply = createMockReply();
      await limiter(freeRequest, freeReply);
      expect(freeReply.status).toHaveBeenCalledWith(429);

      // Pro tier: 50 expensive ops/min
      const proRequest = createMockRequest({
        user: { id: "pro-user-1", subscriptionTier: "pro" },
      } as any);

      for (let i = 0; i < 50; i++) {
        const reply = createMockReply();
        await limiter(proRequest, reply);
        expect(reply.status).not.toHaveBeenCalledWith(429);
      }
    });

    it("should allow unlimited tier infinite requests", async () => {
      const result = checkRateLimitMemory("unlimited-test", Infinity, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
      expect(result.limit).toBe(Infinity);
    });
  });

  describe("Redis Down -> Fallback Behavior", () => {
    it("should report degraded mode when Redis is unavailable", () => {
      forceDegradedMode(true);
      expect(isDegradedMode()).toBe(true);
    });

    it("should work in degraded mode with in-memory fallback", async () => {
      forceDegradedMode(true);

      const limiter = createRateLimiter({ policy: "api", limitType: "api" });
      const request = createMockRequest({
        user: { id: "fallback-user", subscriptionTier: "free" },
      } as any);

      const reply = createMockReply();
      await limiter(request, reply);

      // Should still work
      expect(reply.status).not.toHaveBeenCalledWith(429);
      expect(getMemoryStoreSize()).toBeGreaterThan(0);
    });

    it("should include degraded mode in response when Redis is down", async () => {
      forceDegradedMode(true);

      const result = checkRateLimitMemory("test-key", 10, 60000);
      expect(result.degradedMode).toBe(true);
    });

    it("should set X-RateLimit-Mode header in degraded mode", async () => {
      forceDegradedMode(true);

      const limiter = createRateLimiter({ policy: "api" });
      const request = createMockRequest({
        user: { id: "header-test-user", subscriptionTier: "free" },
      } as any);

      const reply = createMockReply();
      await limiter(request, reply);

      expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Mode", "degraded");
    });
  });

  describe("Per-Route Policies", () => {
    describe("Auth Policy", () => {
      it("should use IP-based limiting for auth endpoints", async () => {
        const limiter = createRateLimiter({ policy: "auth" });
        const request = createMockRequest({ ip: "192.168.1.100" });

        // Auth allows 5 requests per minute
        for (let i = 0; i < 5; i++) {
          const reply = createMockReply();
          await limiter(request, reply);
          expect(reply.status).not.toHaveBeenCalledWith(429);
        }

        // 6th should be blocked
        const reply = createMockReply();
        await limiter(request, reply);
        expect(reply.status).toHaveBeenCalledWith(429);
      });

      it("should rate limit by IP even if user is authenticated", async () => {
        const limiter = createRateLimiter({ policy: "auth" });
        const request = createMockRequest({
          ip: "192.168.1.101",
          user: { id: "auth-user", subscriptionTier: "enterprise" },
        } as any);

        // Should still be limited to 5 requests (auth policy ignores tier)
        for (let i = 0; i < 5; i++) {
          const reply = createMockReply();
          await limiter(request, reply);
        }

        const reply = createMockReply();
        await limiter(request, reply);
        expect(reply.status).toHaveBeenCalledWith(429);
      });
    });

    describe("Public Policy", () => {
      it("should use conservative IP-based limiting for public endpoints", async () => {
        const limiter = createRateLimiter({ policy: "public" });
        const request = createMockRequest({ ip: "10.0.0.1" });

        // Public allows 30 requests per minute
        for (let i = 0; i < 30; i++) {
          const reply = createMockReply();
          await limiter(request, reply);
          expect(reply.status).not.toHaveBeenCalledWith(429);
        }

        // 31st should be blocked
        const reply = createMockReply();
        await limiter(request, reply);
        expect(reply.status).toHaveBeenCalledWith(429);
      });
    });

    describe("API Policy", () => {
      it("should use tier-based limiting for API endpoints", async () => {
        const limiter = createRateLimiter({ policy: "api" });

        // Starter tier: 200 req/min
        const starterRequest = createMockRequest({
          user: { id: "starter-user", subscriptionTier: "starter" },
        } as any);

        const reply = createMockReply();
        await limiter(starterRequest, reply);

        expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Limit", 200);
      });
    });
  });

  describe("Key Generation", () => {
    it("should generate key by userId when authenticated", () => {
      const request = createMockRequest({
        user: { id: "user-123" },
      } as any);

      const result = generateRateLimitKey(request, "test");
      expect(result.key).toBe("test:user:user-123");
      expect(result.type).toBe("user");
      expect(result.identifier).toBe("user-123");
    });

    it("should generate key by apiKeyId when using API key", () => {
      const request = createMockRequest({
        apiKey: { id: "key-456" },
      } as any);

      const result = generateRateLimitKey(request, "test");
      expect(result.key).toBe("test:key:key-456");
      expect(result.type).toBe("apiKey");
      expect(result.identifier).toBe("key-456");
    });

    it("should generate key by IP when unauthenticated", () => {
      const request = createMockRequest({ ip: "203.0.113.50" });

      const result = generateRateLimitKey(request, "test");
      expect(result.key).toMatch(/^test:ip:[a-f0-9]{16}$/);
      expect(result.type).toBe("ip");
      expect(result.identifier).toBe("203.0.113.50");
    });

    it("should prefer userId over apiKeyId", () => {
      const request = createMockRequest({
        user: { id: "user-789" },
        apiKey: { id: "key-789" },
      } as any);

      const result = generateRateLimitKey(request, "test");
      expect(result.type).toBe("user");
    });
  });

  describe("getUserTier", () => {
    it("should return user subscription tier", () => {
      const request = createMockRequest({
        user: { subscriptionTier: "pro" },
      } as any);

      expect(getUserTier(request)).toBe("pro");
    });

    it("should return API key tier if no user", () => {
      const request = createMockRequest({
        apiKey: { tier: "compliance" },
      } as any);

      expect(getUserTier(request)).toBe("compliance");
    });

    it("should default to free tier", () => {
      const request = createMockRequest();
      expect(getUserTier(request)).toBe("free");
    });
  });

  describe("getClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = createMockRequest({
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      } as any);

      expect(getClientIP(request)).toBe("203.0.113.195");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = createMockRequest({
        headers: { "x-real-ip": "198.51.100.178" },
      } as any);

      expect(getClientIP(request)).toBe("198.51.100.178");
    });

    it("should fallback to request.ip", () => {
      const request = createMockRequest({ ip: "192.0.2.1" });
      expect(getClientIP(request)).toBe("192.0.2.1");
    });
  });

  describe("Rate Limit Headers", () => {
    it("should set correct rate limit headers", async () => {
      const limiter = createRateLimiter({ policy: "api" });
      const request = createMockRequest({
        user: { id: "header-user", subscriptionTier: "starter" },
      } as any);

      const reply = createMockReply();
      await limiter(request, reply);

      expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Limit", 200);
      expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Remaining", expect.any(Number));
      expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(Number));
    });

    it("should set Retry-After header when rate limited", async () => {
      const limiter = createRateLimiter({ policy: "auth" });
      const request = createMockRequest({ ip: "10.10.10.10" });

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await limiter(request, createMockReply());
      }

      const reply = createMockReply();
      await limiter(request, reply);

      expect(reply.header).toHaveBeenCalledWith("Retry-After", expect.any(Number));
    });
  });

  describe("Skip Functionality", () => {
    it("should skip rate limiting when skip function returns true", async () => {
      const limiter = createRateLimiter({
        policy: "api",
        skip: (req) => req.url === "/health",
      });

      const request = createMockRequest({ url: "/health" });
      const reply = createMockReply();

      await limiter(request, reply);

      // Should not set rate limit headers when skipped
      expect(reply.header).not.toHaveBeenCalled();
    });
  });

  describe("Sensitive Operations - Enhanced Behavior", () => {
    describe("isSensitiveOperation", () => {
      it("should detect billing routes as sensitive", () => {
        const billingRequests = [
          { method: "POST", url: "/billing/subscribe" },
          { method: "PUT", url: "/api/billing/subscription" },
          { method: "POST", url: "/stripe/webhook" },
        ];

        for (const req of billingRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(true);
        }
      });

      it("should detect auth routes as sensitive", () => {
        const authRequests = [
          { method: "POST", url: "/auth/login" },
          { method: "POST", url: "/api/auth/signup" },
          { method: "POST", url: "/password/reset" },
        ];

        for (const req of authRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(true);
        }
      });

      it("should detect API key management routes as sensitive", () => {
        const apiKeyRequests = [
          { method: "POST", url: "/api-keys" },
          { method: "DELETE", url: "/api/api-keys/123" },
        ];

        for (const req of apiKeyRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(true);
        }
      });

      it("should detect expensive operations as sensitive", () => {
        const expensiveRequests = [
          { method: "POST", url: "/scans/start" },
          { method: "POST", url: "/api/ship" },
          { method: "POST", url: "/reality/run" },
        ];

        for (const req of expensiveRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(true);
        }
      });

      it("should detect admin routes as sensitive", () => {
        const adminRequests = [
          { method: "GET", url: "/admin/users" },
          { method: "PUT", url: "/api/organizations/123" },
        ];

        for (const req of adminRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(true);
        }
      });

      it("should respect route metadata sensitive flag", () => {
        const request = createMockRequest({
          url: "/api/normal",
          routeOptions: {
            url: "/api/normal",
            config: { sensitive: true },
          },
        } as any);

        expect(isSensitiveOperation(request)).toBe(true);
      });

      it("should not mark normal routes as sensitive", () => {
        const normalRequests = [
          { method: "GET", url: "/api/projects" },
          { method: "GET", url: "/dashboard" },
          { method: "GET", url: "/health" },
        ];

        for (const req of normalRequests) {
          expect(isSensitiveOperation(req as FastifyRequest)).toBe(false);
        }
      });
    });

    describe("Redis down - Sensitive operations fail closed", () => {
      it("should return 503 for sensitive operations when Redis is down", async () => {
        const sensitiveLimiter = createRateLimiter({
          policy: "api",
          limitType: "api",
          sensitive: true,
        });

        const billingRequest = createMockRequest({
          method: "POST",
          url: "/billing/subscribe",
          routeOptions: { url: "/billing/subscribe" },
        });

        const reply = createMockReply();
        await sensitiveLimiter(billingRequest, reply);

        expect(reply.status).toHaveBeenCalledWith(503);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: "Service temporarily unavailable",
            code: "SERVICE_UNAVAILABLE",
          })
        );
      });

      it("should return 503 for auth operations when Redis is down", async () => {
        const request = createMockRequest({ url: "/auth/login" });
        const reply = createMockReply();
        
        await authRateLimit(request, reply);

        expect(reply.status).toHaveBeenCalledWith(503);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "SERVICE_UNAVAILABLE",
          })
        );
      });

      it("should return 503 for billing operations when Redis is down", async () => {
        const billingRequest = createMockRequest({
          method: "POST",
          url: "/billing/subscribe",
          routeOptions: { url: "/billing/subscribe" },
        });
        const reply = createMockReply();

        await billingRateLimit(billingRequest, reply);

        expect(reply.status).toHaveBeenCalledWith(503);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "SERVICE_UNAVAILABLE",
          })
        );
      });
    });

    describe("Redis down - Non-sensitive operations use 50% limits", () => {
      it("should use 50% limits for non-sensitive operations when Redis is down", async () => {
        const normalLimiter = createRateLimiter({
          policy: "api",
          limitType: "api",
          sensitive: false,
        });

        const requestWithUser = createMockRequest({
          user: { id: "user123", subscriptionTier: "free" },
        } as any);

        // Make 30 requests (50% of free tier's 60 limit) - all should pass
        for (let i = 0; i < 30; i++) {
          const reply = createMockReply();
          await normalLimiter(requestWithUser, reply);
          expect(reply.status).not.toHaveBeenCalledWith(429);
        }

        // The 31st request should be rate limited
        const reply = createMockReply();
        await normalLimiter(requestWithUser, reply);
        expect(reply.status).toHaveBeenCalledWith(429);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: "Too many requests",
            code: "RATE_LIMIT_EXCEEDED",
          })
        );
      });

      it("should set degraded mode header when using fallback", async () => {
        const request = createMockRequest();
        const reply = createMockReply();
        
        await apiRateLimit(request, reply);

        expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Mode", "degraded");
      });

      it("should show reduced limit in headers when using fallback", async () => {
        const requestWithUser = createMockRequest({
          user: { id: "user123", subscriptionTier: "free" },
        } as any);
        const reply = createMockReply();

        await apiRateLimit(requestWithUser, reply);

        // Free tier normal limit is 60, reduced limit should be 30
        expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Limit", 30);
      });
    });

    describe("Circuit breaker behavior", () => {
      it("should not spam logs when Redis is flapping", async () => {
        const { logger } = require("../../logger");
        const mockLogger = logger.child();
        
        const sensitiveLimiter = createRateLimiter({
          policy: "api",
          sensitive: true,
        });

        const billingRequest = createMockRequest({
          method: "POST",
          url: "/billing/subscribe",
          routeOptions: { url: "/billing/subscribe" },
        });

        // Make multiple requests - should only log once due to circuit breaker
        for (let i = 0; i < 5; i++) {
          const reply = createMockReply();
          await sensitiveLimiter(billingRequest, reply);
        }

        // Should only log the first time due to circuit breaker
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
      });
    });

    describe("Structured logging", () => {
      it("should log structured events for Redis down", async () => {
        const { logger } = require("../../logger");
        const mockLogger = logger.child();
        
        const sensitiveLimiter = createRateLimiter({
          policy: "api",
          sensitive: true,
        });

        const billingRequest = createMockRequest({
          method: "POST",
          url: "/billing/subscribe",
          routeOptions: { url: "/billing/subscribe" },
          user: { id: "user123" },
        } as any);

        const reply = createMockReply();
        await sensitiveLimiter(billingRequest, reply);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "rate_limiter.redis_down",
            requestId: expect.any(String),
            route: "/billing/subscribe",
            method: "POST",
            ip: "127.0.0.1",
            userId: "user123",
            sensitive: true,
          }),
          "Sensitive operation rejected: Redis unavailable"
        );
      });

      it("should log structured events for fallback usage", async () => {
        const { logger } = require("../../logger");
        const mockLogger = logger.child();
        
        const requestWithUser = createMockRequest({
          user: { id: "user123", subscriptionTier: "free" },
        } as any);
        const reply = createMockReply();

        await apiRateLimit(requestWithUser, reply);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "rate_limiter.fallback_used",
            requestId: expect.any(String),
            route: "/api/test",
            method: "GET",
            ip: "127.0.0.1",
            userId: "user123",
            originalLimit: 60, // Free tier normal limit
            fallbackLimit: 30, // 50% of normal limit
            sensitive: false,
          }),
          "Using in-memory rate limiting fallback (50% of normal limits)"
        );
      });
    });
  });
});
