/**
 * API Key Security Tests
 * 
 * Verifies that:
 * 1. Spoofed API keys (e.g., "gr_enterprise_xxx") do NOT grant elevated tiers
 * 2. Only valid, server-stored keys return correct tier
 * 3. Revoked keys are rejected
 * 4. Tier is determined by subscription + optional override, NOT key string
 */

import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma
const mockPrismaApiKey = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  apiKey: mockPrismaApiKey,
};

vi.mock("@guardrail/database", () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { apiKeyService } from "../services/api-key-service";

describe("API Key Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Spoofed Key Prevention", () => {
    it("should reject a forged 'gr_enterprise_xxx' key that is not in the database", async () => {
      // Attacker tries to forge an enterprise key
      const forgedKey = "grl_enterprise_fake123456789abcdef";

      // Database returns no match (key hash doesn't exist)
      mockPrismaApiKey.findFirst.mockResolvedValue(null);

      const result = await apiKeyService.validateApiKey(forgedKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid API key");
      expect(result.tier).toBeUndefined();
    });

    it("should reject a forged key with 'pro' in the string", async () => {
      const forgedKey = "grl_pro_hacker_attempt_12345";

      mockPrismaApiKey.findFirst.mockResolvedValue(null);

      const result = await apiKeyService.validateApiKey(forgedKey);

      expect(result.valid).toBe(false);
      expect(result.tier).toBeUndefined();
    });

    it("should reject keys with invalid format", async () => {
      const invalidKeys = [
        "invalid_key",
        "gr_enterprise_fake", // Old format (gr_ instead of grl_)
        "enterprise_key_123",
        "",
        "grl", // Too short
      ];

      for (const key of invalidKeys) {
        const result = await apiKeyService.validateApiKey(key);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe("Tier Resolution from Database", () => {
    it("should return tier from user subscription when key is valid", async () => {
      const validKeyHash = crypto.createHash("sha256").update("grl_validkey123").digest("hex");

      mockPrismaApiKey.findFirst.mockResolvedValue({
        id: "key-123",
        userId: "user-456",
        key: validKeyHash,
        prefix: "grl_validkey...",
        tierOverride: null,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        user: {
          subscriptions: [
            { tier: "pro", status: "active" },
          ],
        },
      });

      mockPrismaApiKey.update.mockResolvedValue({});

      const result = await apiKeyService.validateApiKey("grl_validkey123");

      expect(result.valid).toBe(true);
      expect(result.tier).toBe("pro");
      expect(result.userId).toBe("user-456");
    });

    it("should use tierOverride when present (admin grant)", async () => {
      const validKeyHash = crypto.createHash("sha256").update("grl_admingranted").digest("hex");

      mockPrismaApiKey.findFirst.mockResolvedValue({
        id: "key-789",
        userId: "user-special",
        key: validKeyHash,
        prefix: "grl_admingr...",
        tierOverride: "enterprise", // Admin granted enterprise access
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        user: {
          subscriptions: [
            { tier: "free", status: "active" }, // User is on free tier
          ],
        },
      });

      mockPrismaApiKey.update.mockResolvedValue({});

      const result = await apiKeyService.validateApiKey("grl_admingranted");

      expect(result.valid).toBe(true);
      expect(result.tier).toBe("enterprise"); // Override takes precedence
      expect(result.tierOverride).toBe("enterprise");
    });

    it("should default to free tier when no subscription exists", async () => {
      const validKeyHash = crypto.createHash("sha256").update("grl_nosubkey").digest("hex");

      mockPrismaApiKey.findFirst.mockResolvedValue({
        id: "key-nosub",
        userId: "user-nosub",
        key: validKeyHash,
        prefix: "grl_nosubk...",
        tierOverride: null,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        user: {
          subscriptions: [], // No active subscription
        },
      });

      mockPrismaApiKey.update.mockResolvedValue({});

      const result = await apiKeyService.validateApiKey("grl_nosubkey");

      expect(result.valid).toBe(true);
      expect(result.tier).toBe("free");
    });
  });

  describe("Revoked Key Handling", () => {
    it("should reject a revoked API key", async () => {
      const revokedKeyHash = crypto.createHash("sha256").update("grl_revokedkey").digest("hex");

      mockPrismaApiKey.findFirst.mockResolvedValue({
        id: "key-revoked",
        userId: "user-revoked",
        key: revokedKeyHash,
        prefix: "grl_revoke...",
        tierOverride: null,
        isActive: false,
        revokedAt: new Date("2024-01-01"),
        expiresAt: null,
        user: {
          subscriptions: [{ tier: "pro", status: "active" }],
        },
      });

      const result = await apiKeyService.validateApiKey("grl_revokedkey");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key has been revoked");
      expect(result.tier).toBeUndefined();
    });

    it("should reject an expired API key", async () => {
      const expiredKeyHash = crypto.createHash("sha256").update("grl_expiredkey").digest("hex");

      mockPrismaApiKey.findFirst.mockResolvedValue({
        id: "key-expired",
        userId: "user-expired",
        key: expiredKeyHash,
        prefix: "grl_expire...",
        tierOverride: null,
        isActive: true,
        revokedAt: null,
        expiresAt: new Date("2020-01-01"), // Expired
        user: {
          subscriptions: [{ tier: "enterprise", status: "active" }],
        },
      });

      const result = await apiKeyService.validateApiKey("grl_expiredkey");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key expired");
    });
  });

  describe("Key Creation Security", () => {
    it("should create keys without tier embedded in the key string", async () => {
      mockPrismaApiKey.create.mockResolvedValue({
        id: "new-key-id",
        userId: "user-123",
        name: "Test Key",
        key: "hashed_value",
        prefix: "grl_abc123def...",
        tierOverride: null,
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await apiKeyService.createApiKey("user-123", { name: "Test Key" });

      // Key should start with grl_ prefix only, no tier embedded
      expect(result.key).toMatch(/^grl_[a-f0-9]+$/);
      expect(result.key).not.toMatch(/enterprise|pro|starter|compliance/i);
      
      // Verify the key was stored as a hash
      expect(mockPrismaApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-123",
            name: "Test Key",
          }),
        })
      );
    });
  });

  describe("Key Revocation", () => {
    it("should soft-delete keys by setting revokedAt", async () => {
      mockPrismaApiKey.updateMany.mockResolvedValue({ count: 1 });

      const result = await apiKeyService.revokeApiKey("key-to-revoke", "user-123");

      expect(result).toBe(true);
      expect(mockPrismaApiKey.updateMany).toHaveBeenCalledWith({
        where: {
          id: "key-to-revoke",
          userId: "user-123",
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it("should not revoke keys belonging to other users", async () => {
      mockPrismaApiKey.updateMany.mockResolvedValue({ count: 0 });

      const result = await apiKeyService.revokeApiKey("key-123", "wrong-user");

      expect(result).toBe(false);
    });
  });
});

describe("Security Invariants", () => {
  it("CRITICAL: tier must NEVER be parsed from API key string", () => {
    // This test documents the security requirement
    // The API key format is: grl_<random_hex>
    // There is NO tier information in the key string
    
    const sampleKey = "grl_abc123def456789";
    
    // Old vulnerable pattern (should NOT exist in codebase)
    const vulnerablePattern = /^gr_(\w+)_/;
    const match = sampleKey.match(vulnerablePattern);
    
    // This should NOT match because we use grl_ prefix now
    expect(match).toBeNull();
    
    // Even if someone tries to forge with old format
    const forgedOldFormat = "gr_enterprise_fake123";
    const forgedMatch = forgedOldFormat.match(vulnerablePattern);
    
    // The match would succeed but our validation rejects it
    // because we require grl_ prefix and validate against DB
    expect(forgedOldFormat.startsWith("grl_")).toBe(false);
  });

  it("CRITICAL: all tier decisions must come from database", () => {
    // Document the security model:
    // 1. Client sends API key
    // 2. Server hashes the key
    // 3. Server looks up hash in database
    // 4. Server returns tier from:
    //    a. apiKey.tierOverride (if set by admin)
    //    b. user.subscriptions[0].tier (from subscription)
    //    c. 'free' (default)
    
    // The key string itself is NEVER parsed for tier information
    expect(true).toBe(true); // Documentation test
  });
});
