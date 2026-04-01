/**
 * Security Hardening Integration Tests
 *
 * Tests for:
 * - Rate limiting
 * - Input validation
 * - Body size limits
 * - SQL injection detection
 * - JSON depth limiting
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";
import {
  jsonDepthLimiter,
  contentTypeValidator,
  sqlInjectionDetector,
  enhancedSanitizer,
  getBodySizeLimit,
  containsSqlInjection,
  getJsonDepth,
} from "../../middleware/security-hardening";
import {
  createRateLimiter,
  initRateLimiter,
} from "../../middleware/redis-rate-limiter";
import {
  checkoutSchema,
  loginSchema,
  registerSchema,
} from "../../schemas/validation";

describe("Security Hardening", () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });

    // Initialize rate limiter without Redis (memory mode)
    await initRateLimiter();

    // Add test routes
    fastify.post(
      "/test/json-depth",
      {
        preHandler: jsonDepthLimiter,
      },
      async (request, reply) => {
        return { success: true, body: request.body };
      },
    );

    fastify.post(
      "/test/content-type",
      {
        preHandler: contentTypeValidator,
      },
      async (request, reply) => {
        return { success: true };
      },
    );

    fastify.post(
      "/test/sql-injection",
      {
        preHandler: sqlInjectionDetector,
      },
      async (request, reply) => {
        return { success: true, body: request.body };
      },
    );

    fastify.post(
      "/test/sanitize",
      {
        preHandler: enhancedSanitizer,
      },
      async (request, reply) => {
        return { success: true, body: request.body };
      },
    );

    fastify.post(
      "/test/rate-limit",
      {
        preHandler: createRateLimiter({ policy: "auth" }),
      },
      async (request, reply) => {
        return { success: true };
      },
    );

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe("JSON Depth Limiting", () => {
    it("should allow shallow JSON", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/json-depth",
        payload: { level1: { level2: { level3: "value" } } },
      });

      expect(response.statusCode).toBe(200);
    });

    it("should calculate JSON depth correctly", () => {
      expect(getJsonDepth({})).toBe(0);
      expect(getJsonDepth({ a: 1 })).toBe(1);
      expect(getJsonDepth({ a: { b: 1 } })).toBe(2);
      expect(getJsonDepth({ a: { b: { c: 1 } } })).toBe(3);
      expect(getJsonDepth([[[1]]])).toBe(3);
    });
  });

  describe("SQL Injection Detection", () => {
    it("should detect basic SQL injection", () => {
      expect(containsSqlInjection("' OR 1=1 --")).toBe(true);
      expect(containsSqlInjection("SELECT * FROM users")).toBe(true);
      expect(containsSqlInjection("'; DROP TABLE users; --")).toBe(true);
      expect(containsSqlInjection("1; DELETE FROM users")).toBe(true);
    });

    it("should allow normal input", () => {
      expect(containsSqlInjection("Hello World")).toBe(false);
      expect(containsSqlInjection("user@example.com")).toBe(false);
      expect(containsSqlInjection("My project name")).toBe(false);
    });

    it("should block SQL injection in request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/sql-injection",
        payload: { query: "'; DROP TABLE users; --" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).code).toBe("INVALID_INPUT");
    });

    it("should allow clean request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/sql-injection",
        payload: { name: "John Doe", email: "john@example.com" },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize XSS in request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/sanitize",
        payload: {
          name: '<script>alert("xss")</script>Hello',
          comment: 'onclick="evil()"',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.body.name).not.toContain("<script>");
      expect(body.body.comment).not.toContain("onclick");
    });
  });

  describe("Body Size Limits", () => {
    it("should return correct limits for different routes", () => {
      expect(getBodySizeLimit("/api/upload/file")).toBe(10 * 1024 * 1024); // 10MB
      expect(getBodySizeLimit("/api/billing/webhook")).toBe(5 * 1024 * 1024); // 5MB
      expect(getBodySizeLimit("/api/auth/login")).toBe(100 * 1024); // 100KB
      expect(getBodySizeLimit("/api/projects")).toBe(1 * 1024 * 1024); // 1MB default
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests under limit", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/rate-limit",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
    });

    it("should include rate limit headers", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/test/rate-limit",
        payload: {},
      });

      expect(response.headers["x-ratelimit-limit"]).toBe("10");
      expect(
        parseInt(response.headers["x-ratelimit-remaining"] as string),
      ).toBeLessThanOrEqual(10);
    });
  });
});

describe("Validation Schemas", () => {
  describe("Login Schema", () => {
    it("should validate correct login data", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Register Schema", () => {
    it("should validate correct registration data", () => {
      const result = registerSchema.safeParse({
        email: "newuser@example.com",
        password: "SecurePass123",
        name: "John Doe",
      });

      expect(result.success).toBe(true);
    });

    it("should reject weak password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "weak", // Too short, no uppercase, no number
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Checkout Schema", () => {
    it("should validate with plan", () => {
      const result = checkoutSchema.safeParse({
        plan: "pro",
      });

      expect(result.success).toBe(true);
    });

    it("should validate with priceId", () => {
      const result = checkoutSchema.safeParse({
        priceId: "price_1234567890",
      });

      expect(result.success).toBe(true);
    });

    it("should reject without plan or priceId", () => {
      const result = checkoutSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("should reject invalid plan", () => {
      const result = checkoutSchema.safeParse({
        plan: "invalid-plan",
      });

      expect(result.success).toBe(false);
    });
  });
});
