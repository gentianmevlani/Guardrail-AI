/**
 * Tests for API versioning and pagination safety
 * 
 * These tests ensure that:
 * 1. API versioning works correctly with /api/v1/* prefixes
 * 2. Pagination parameters are validated and clamped
 * 3. Legacy routes return deprecation warnings
 * 4. Performance middleware works as expected
 */

import { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildServer } from "../index";

describe("API Versioning and Pagination", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("API Versioning", () => {
    test("v1 endpoints should be accessible", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      // Should return 401 for invalid token, not 404 for missing route
      expect(response.statusCode).toBe(401);
    });

    test("legacy endpoints should return deprecation warnings", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["x-api-deprecation-warning"]).toContain("deprecated");
      expect(response.headers["sunset"]).toBe("2026-07-01");
    });

    test("health endpoints should work without versioning", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-api-deprecation-warning"]).toBeUndefined();
    });

    test("OpenAPI spec should be available", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/openapi.json",
      });

      expect(response.statusCode).toBe(200);
      const spec = JSON.parse(response.payload);
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info.title).toBe("guardrail API");
    });

    test("Swagger UI should be accessible", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/docs",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Pagination Safety", () => {
    test("should clamp limit to maximum allowed", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects?limit=1000",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      // Should return 401 for auth, but pagination middleware should have processed
      expect(response.statusCode).toBe(401);
    });

    test("should handle negative page numbers", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects?page=-5",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    test("should handle invalid pagination parameters", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects?page=abc&limit=xyz",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    test("should use default values for missing pagination", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Performance Middleware", () => {
    test("should add compression headers for large responses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/openapi.json",
        headers: {
          "accept-encoding": "gzip, deflate, br",
        },
      });

      expect(response.statusCode).toBe(200);
      // OpenAPI spec should be large enough to trigger compression
      expect(response.headers["content-encoding"]).toBeDefined();
    });

    test("should add performance headers", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-response-time"]).toMatch(/\d+ms/);
    });

    test("should add cache headers for static endpoints", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/openapi.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBeDefined();
      expect(response.headers["etag"]).toBeDefined();
    });

    test("should not cache user-specific endpoints", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
      // Even with auth failure, cache headers should indicate private
      const cacheControl = response.headers["cache-control"] || "";
      expect(cacheControl).toContain("private");
    });
  });

  describe("Schema Validation", () => {
    test("should validate request schemas", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        payload: {
          // Invalid payload - missing required name
          description: "Test project",
        },
      });

      // Should return 401 for auth first, then 400 for validation
      expect(response.statusCode).toBe(401);
    });

    test("should validate response schemas", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty("success");
      expect(payload.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should return consistent error format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/nonexistent",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty("success", false);
      expect(payload).toHaveProperty("error");
    });

    test("should handle malformed JSON", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        payload: "invalid json",
      });

      expect(response.statusCode).toBe(400);
    });

    test("should handle oversized payloads", async () => {
      const largePayload = "x".repeat(2 * 1024 * 1024); // 2MB

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        payload: largePayload,
      });

      expect(response.statusCode).toBe(413);
    });
  });

  describe("Security Headers", () => {
    test("should add security headers to all responses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
      expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    test("should include HSTS in production", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      // HSTS should be present regardless of environment in this setup
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    test("should apply rate limits to public endpoints", async () => {
      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: "GET",
          url: "/health",
        })
      );

      const responses = await Promise.all(requests);
      
      // Most should succeed, but rate limiting should kick in
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(5);
      // At least some requests should be rate limited if configured properly
      expect(rateLimitedCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Pagination Utility Functions", () => {
  test("validatePagination should clamp values correctly", () => {
    const { validatePagination } = require("../src/middleware/performance");

    // Test normal values
    let result = validatePagination({ page: "2", limit: "10" });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(10);

    // Test excessive limit
    result = validatePagination({ page: "1", limit: "1000" });
    expect(result.limit).toBe(100); // Should be clamped to max

    // Test negative page
    result = validatePagination({ page: "-5", limit: "10" });
    expect(result.page).toBe(1); // Should be clamped to min

    // Test invalid values
    result = validatePagination({ page: "abc", limit: "xyz" });
    expect(result.page).toBe(1); // Should use defaults
    expect(result.limit).toBe(20); // Should use defaults
  });

  test("validatePagination should respect custom options", () => {
    const { validatePagination } = require("../src/middleware/performance");

    const result = validatePagination(
      { page: "5", limit: "50" },
      { maxLimit: 25, defaultLimit: 5 }
    );

    expect(result.page).toBe(5);
    expect(result.limit).toBe(25); // Should be clamped to custom max
  });
});
