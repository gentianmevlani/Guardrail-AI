/**
 * API Key Service
 *
 * Manages API key generation, validation, and revocation with Prisma persistence
 *
 * NOTE: Run `npx prisma generate` after schema changes to update the client types.
 */

import { prisma as prismaClient } from "@guardrail/database";
import * as crypto from "crypto";
import { logger } from "../logger";
import { toErrorMessage } from "../utils/toErrorMessage";

// Cast prisma to any to handle fields that may not be in generated client yet
// These fields exist in schema.prisma but client may need regeneration
const prisma = prismaClient as any;

// ==========================================
// TYPES
// ==========================================

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  tierOverride: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  isActive: boolean;
  // Security policy fields
  allowedIpCidrs: string[];
  allowedCountries: string[];
  allowedHoursUtc?: { start: number; end: number } | null;
  sensitiveScopes: string[];
  requestsPerDay: number;
  expensivePerDay: number;
  rotationOverlapDays: number;
}

export interface CreateApiKeyResult {
  /** The full API key (only shown once) */
  key: string;
  /** API key metadata */
  apiKey: ApiKeyInfo;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  tier?: string;
  tierOverride?: string | null;
  error?: string;
  // Security policy results
  securityPolicy?: {
    ipAllowed: boolean;
    timeAllowed: boolean;
    countryAllowed: boolean;
    fingerprintMatch: boolean;
    quotaRemaining: {
      requests: number;
      expensive: number;
    };
  };
}

export interface CreateApiKeyOptions {
  name?: string;
  expiresInDays?: number;
  tierOverride?: string;
  // Security policy options
  allowedIpCidrs?: string[];
  allowedCountries?: string[];
  allowedHoursUtc?: { start: number; end: number };
  sensitiveScopes?: string[];
  requestsPerDay?: number;
  expensivePerDay?: number;
  rotationOverlapDays?: number;
}

export interface SecurityPolicyCheck {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

export interface ApiKeyUsageContext {
  ipAddress: string;
  userAgent?: string;
  country?: string;
  requestedScopes: string[];
  isExpensive?: boolean;
}

// ==========================================
// CONSTANTS
// ==========================================

const API_KEY_PREFIX = "grl_";
const KEY_BYTES = 32;
const PREFIX_LENGTH = 12;

// ==========================================
// API KEY SERVICE
// ==========================================

class ApiKeyService {
  private log = logger.child({ service: "api-key-service" });

  /**
   * Generate a new API key for a user
   */
  async createApiKey(
    userId: string,
    options: CreateApiKeyOptions = {},
  ): Promise<CreateApiKeyResult> {
    const {
      name = "Default",
      expiresInDays,
      tierOverride,
      allowedIpCidrs = [],
      allowedCountries = [],
      allowedHoursUtc,
      sensitiveScopes = [],
      requestsPerDay = -1,
      expensivePerDay = -1,
      rotationOverlapDays = 0,
    } = options;

    // Generate random key (no tier embedded - tier comes from DB)
    const keyBytes = crypto.randomBytes(KEY_BYTES);
    const fullKey = `${API_KEY_PREFIX}${keyBytes.toString("hex")}`;

    // Create prefix for display (first ~12 chars after prefix)
    const prefix = fullKey.substring(0, API_KEY_PREFIX.length + PREFIX_LENGTH);

    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Hash the key for secure storage
    const keyHash = this.hashKey(fullKey);

    // Store in database - key field stores the hash (NOT the raw key)
    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name,
        key: keyHash, // Store hash, not the actual key
        prefix: prefix + "...", // Store prefix for display
        tierOverride: tierOverride || null,
        expiresAt,
        // Security policy fields
        allowedIpCidrs,
        allowedCountries,
        allowedHoursUtc,
        sensitiveScopes,
        requestsPerDay,
        expensivePerDay,
        rotationOverlapDays,
        lastDayReset: new Date(),
      },
    });

    this.log.info({ userId, keyId: apiKey.id, name }, "API key created");

    return {
      key: fullKey, // Return full key only once (user must save it)
      apiKey: {
        id: apiKey.id,
        userId: apiKey.userId,
        name: apiKey.name,
        prefix: prefix + "...",
        tierOverride: apiKey.tierOverride,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
        revokedAt: apiKey.revokedAt,
        createdAt: apiKey.createdAt,
        isActive: apiKey.isActive && !apiKey.revokedAt,
        // Security policy fields
        allowedIpCidrs: apiKey.allowedIpCidrs || [],
        allowedCountries: apiKey.allowedCountries || [],
        allowedHoursUtc: apiKey.allowedHoursUtc as { start: number; end: number } | undefined,
        sensitiveScopes: apiKey.sensitiveScopes || [],
        requestsPerDay: apiKey.requestsPerDay,
        expensivePerDay: apiKey.expensivePerDay,
        rotationOverlapDays: apiKey.rotationOverlapDays,
      },
    };
  }

  /**
   * Validate an API key and return user info with effective tier
   * 
   * SECURITY: Tier is determined server-side from:
   * 1. User's subscription tier (from DB)
   * 2. Optional tierOverride on the API key (for admin grants)
   * 
   * The API key string itself contains NO tier information.
   */
  async validateApiKey(key: string): Promise<ApiKeyValidationResult> {
    // Check format
    if (!key.startsWith(API_KEY_PREFIX)) {
      return { valid: false, error: "Invalid key format" };
    }

    // Hash the provided key
    const keyHash = this.hashKey(key);

    // Look up in database by hash, include user subscription
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        key: keyHash,
      },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: "active" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!apiKey) {
      return { valid: false, error: "Invalid API key" };
    }

    // Check if revoked
    if (apiKey.revokedAt || !apiKey.isActive) {
      return { valid: false, error: "API key has been revoked" };
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: "API key expired" };
    }

    // Determine effective tier:
    // 1. tierOverride on API key takes precedence (admin grants)
    // 2. Otherwise use subscription tier
    // 3. Default to 'free'
    const subscriptionTier = apiKey.user.subscriptions[0]?.tier || "free";
    const effectiveTier = apiKey.tierOverride || subscriptionTier;

    // Update last used timestamp (fire and forget)
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) => {
        this.log.warn(
          { error: toErrorMessage(err) },
          "Failed to update lastUsedAt",
        );
      });

    return {
      valid: true,
      userId: apiKey.userId,
      tier: effectiveTier,
      tierOverride: apiKey.tierOverride,
    };
  }

  /**
   * List all API keys for a user (without sensitive data)
   * Only returns active (non-revoked) keys by default
   */
  async listUserApiKeys(userId: string, includeRevoked = false): Promise<ApiKeyInfo[]> {
    const keys = await prisma.apiKey.findMany({
      where: {
        userId,
        ...(includeRevoked ? {} : { revokedAt: null }),
      },
      orderBy: { createdAt: "desc" },
    });

    return keys.map((k: any) => ({
      id: k.id,
      userId: k.userId,
      name: k.name,
      prefix: k.prefix || k.key.substring(0, 12) + "...", // Use stored prefix or fallback
      tierOverride: k.tierOverride,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
      isActive: k.isActive && !k.revokedAt,
      // Add missing security policy fields with defaults
      allowedIpCidrs: [],
      allowedCountries: [],
      allowedHoursUtc: null,
      sensitiveScopes: [],
      requestsPerDay: 1000,
      expensivePerDay: 100,
      rotationOverlapDays: 7,
    }));
  }

  /**
   * Revoke an API key (soft delete - sets revokedAt timestamp)
   */
  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId, // Ensure user owns the key
        revokedAt: null, // Only revoke if not already revoked
      },
      data: {
        revokedAt: new Date(),
        isActive: false,
      },
    });

    if (result.count > 0) {
      this.log.info({ keyId, userId }, "API key revoked");
      return true;
    }

    return false;
  }

  /**
   * Revoke all API keys for a user
   */
  async revokeAllUserKeys(userId: string): Promise<number> {
    const result = await prisma.apiKey.deleteMany({
      where: { userId },
    });

    this.log.info({ userId, count: result.count }, "All API keys revoked");
    return result.count;
  }

  /**
   * Clean up expired keys (run periodically)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.log.info({ count: result.count }, "Expired API keys cleaned up");
    }

    return result.count;
  }

  /**
   * Hash an API key for secure storage
   */
  private hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }
}

// Export singleton
export const apiKeyService = new ApiKeyService();
