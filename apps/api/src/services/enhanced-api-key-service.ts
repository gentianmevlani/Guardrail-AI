/**
 * Enhanced API Key Service with Security Policies
 *
 * Manages API key generation, validation, and security policy enforcement including:
 * - IP allowlisting
 * - Time-based restrictions
 * - Country restrictions
 * - Usage quotas
 * - Fingerprinting
 * - Key rotation
 */

import { prisma } from "@guardrail/database";
import * as crypto from "crypto";
import { createHash } from "crypto";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ==========================================
// TYPES
// ==========================================

export interface ApiKeySecurityPolicy {
  allowedIpCidrs?: string[];
  allowedCountries?: string[];
  allowedHoursUtc?: { start: number; end: number };
  sensitiveScopes?: string[];
  requestsPerDay?: number;
  expensivePerDay?: number;
  rotationOverlapDays?: number;
}

export interface ApiKeyUsageContext {
  ipAddress: string;
  userAgent?: string;
  country?: string;
  requestedScopes: string[];
  isExpensive?: boolean;
}

export interface SecurityPolicyResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
  quotaRemaining?: {
    requests: number;
    expensive: number;
  };
}

export interface EnhancedApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  tier?: string;
  tierOverride?: string | null;
  error?: string;
  securityPolicy?: SecurityPolicyResult;
}

export interface CreateEnhancedApiKeyOptions {
  name?: string;
  expiresInDays?: number;
  tierOverride?: string;
  securityPolicy?: ApiKeySecurityPolicy;
}

export interface EnhancedApiKeyInfo {
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
  securityPolicy: ApiKeySecurityPolicy;
  rotationOverlapDays: number;
}

export interface CreateEnhancedApiKeyResult {
  key: string;
  apiKey: EnhancedApiKeyInfo;
}

// ==========================================
// CONSTANTS
// ==========================================

const API_KEY_PREFIX = "grl_";
const KEY_BYTES = 32;
const PREFIX_LENGTH = 12;
const SERVER_PEPPER = process.env.API_KEY_PEPPER || "default-pepper-change-in-production";

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if an IP address is in a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const net = require('net').isIP(ip) === 4 ? require('ipaddr').IPv4 : require('ipaddr').IPv6;
    const addr = net.parse(ip);
    const networkAddr = net.parse(network);
    const subnet = networkAddr.createSubnet(parseInt(prefixLength));
    return subnet.contains(addr);
  } catch {
    return false;
  }
}

/**
 * Check if current hour is within allowed time window
 */
function isWithinTimeWindow(currentHour: number, allowedHours?: { start: number; end: number }): boolean {
  if (!allowedHours) return true;
  
  const { start, end } = allowedHours;
  
  if (start <= end) {
    // Same day window (e.g., 9-17)
    return currentHour >= start && currentHour <= end;
  } else {
    // Overnight window (e.g., 22-6)
    return currentHour >= start || currentHour <= end;
  }
}

/**
 * Create fingerprint hash for IP + User-Agent
 */
function createFingerprint(ip: string, userAgent?: string): string {
  const data = `${ip}|${userAgent || ''}|${SERVER_PEPPER}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Check if daily counters need reset
 */
function needsReset(lastReset: Date): boolean {
  const now = new Date();
  const lastResetDate = new Date(lastReset);
  return now.toDateString() !== lastResetDate.toDateString();
}

// ==========================================
// ENHANCED API KEY SERVICE
// ==========================================

class EnhancedApiKeyService {
  private log = logger.child({ service: "enhanced-api-key-service" });

  /**
   * Create a new API key with security policy
   */
  async createApiKey(
    userId: string,
    options: CreateEnhancedApiKeyOptions = {},
  ): Promise<CreateEnhancedApiKeyResult> {
    const {
      name = "Default",
      expiresInDays,
      tierOverride,
      securityPolicy = {},
    } = options;

    // Generate random key
    const keyBytes = crypto.randomBytes(KEY_BYTES);
    const fullKey = `${API_KEY_PREFIX}${keyBytes.toString("hex")}`;
    const prefix = fullKey.substring(0, API_KEY_PREFIX.length + PREFIX_LENGTH);

    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Hash the key for secure storage
    const keyHash = this.hashKey(fullKey);

    // Prepare security policy defaults
    const {
      allowedIpCidrs = [],
      allowedCountries = [],
      allowedHoursUtc,
      sensitiveScopes = [],
      requestsPerDay = -1,
      expensivePerDay = -1,
      rotationOverlapDays = 0,
    } = securityPolicy;

    try {
      // Store in database using raw query to bypass TypeScript issues
      const apiKey = await (prisma as any).$queryRaw`
        INSERT INTO "api_keys" (
          "id", "userId", "name", "key", "prefix", "tierOverride", 
          "expiresAt", "allowedIpCidrs", "allowedCountries", "allowedHoursUtc",
          "sensitiveScopes", "requestsPerDay", "expensivePerDay", 
          "rotationOverlapDays", "lastDayReset", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${userId}, ${name}, ${keyHash}, ${prefix + "..."}, ${tierOverride},
          ${expiresAt}, ${JSON.stringify(allowedIpCidrs)}, ${JSON.stringify(allowedCountries)},
          ${allowedHoursUtc ? JSON.stringify(allowedHoursUtc) : null}, ${JSON.stringify(sensitiveScopes)},
          ${requestsPerDay}, ${expensivePerDay}, ${rotationOverlapDays}, ${new Date()}, ${new Date()}, ${new Date()}
        )
        RETURNING *
      `;

      const createdKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;

      this.log.info({ userId, keyId: createdKey.id, name }, "Enhanced API key created");

      return {
        key: fullKey,
        apiKey: {
          id: createdKey.id,
          userId: createdKey.userId,
          name: createdKey.name,
          prefix: createdKey.prefix,
          tierOverride: createdKey.tierOverride,
          lastUsedAt: createdKey.lastUsedAt,
          expiresAt: createdKey.expiresAt,
          revokedAt: createdKey.revokedAt,
          createdAt: createdKey.createdAt,
          isActive: createdKey.isActive && !createdKey.revokedAt,
          securityPolicy: {
            allowedIpCidrs: createdKey.allowedIpCidrs || [],
            allowedCountries: createdKey.allowedCountries || [],
            allowedHoursUtc: createdKey.allowedHoursUtc,
            sensitiveScopes: createdKey.sensitiveScopes || [],
            requestsPerDay: createdKey.requestsPerDay,
            expensivePerDay: createdKey.expensivePerDay,
            rotationOverlapDays: createdKey.rotationOverlapDays,
          },
          rotationOverlapDays: createdKey.rotationOverlapDays,
        },
      };
    } catch (error: unknown) {
      this.log.error({ error: toErrorMessage(error), userId }, "Failed to create enhanced API key");
      throw new Error("Failed to create API key");
    }
  }

  /**
   * Validate API key with security policy enforcement
   */
  async validateApiKeyWithPolicy(
    key: string,
    context: ApiKeyUsageContext,
  ): Promise<EnhancedApiKeyValidationResult> {
    // Basic format check
    if (!key.startsWith(API_KEY_PREFIX)) {
      return { valid: false, error: "Invalid key format" };
    }

    const keyHash = this.hashKey(key);

    try {
      // Look up API key with user data
      const apiKey = await (prisma as any).$queryRaw`
        SELECT 
          ak.*,
          u."subscriptions" as user_subscriptions
        FROM "api_keys" ak
        JOIN "users" u ON ak."userId" = u.id
        WHERE ak.key = ${keyHash}
        AND ak."isActive" = true
        AND (ak."revokedAt" IS NULL)
        AND (ak."expiresAt" IS NULL OR ak."expiresAt" > NOW())
        LIMIT 1
      `;

      if (!Array.isArray(apiKey) || apiKey.length === 0) {
        return { valid: false, error: "Invalid API key" };
      }

      const keyData = apiKey[0];

      // Check expiry
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return { valid: false, error: "API key expired" };
      }

      // Determine effective tier
      const subscriptionTier = keyData.user_subscriptions?.[0]?.tier || "free";
      const effectiveTier = keyData.tierOverride || subscriptionTier;

      // Check security policy
      const securityPolicy = await this.checkSecurityPolicy(keyData, context);

      if (!securityPolicy.allowed) {
        return {
          valid: false,
          error: securityPolicy.reason,
          securityPolicy,
        };
      }

      // Update usage counters (fire and forget)
      this.updateUsageCounters(keyData.id, context.isExpensive || false)
        .catch(err => this.log.warn({ error: err.message }, "Failed to update usage counters"));

      // Update last used timestamp
      this.updateLastUsed(keyData.id).catch(err => 
        this.log.warn({ error: err.message }, "Failed to update lastUsedAt")
      );

      return {
        valid: true,
        userId: keyData.userId,
        tier: effectiveTier,
        tierOverride: keyData.tierOverride,
        securityPolicy,
      };
    } catch (error: unknown) {
      this.log.error({ error: toErrorMessage(error) }, "API key validation failed");
      return { valid: false, error: "Validation failed" };
    }
  }

  /**
   * Check security policy for API key
   */
  private async checkSecurityPolicy(
    apiKey: any,
    context: ApiKeyUsageContext,
  ): Promise<SecurityPolicyResult> {
    const warnings: string[] = [];
    let allowed = true;
    let reason = "";

    // Reset daily counters if needed
    if (needsReset(apiKey.lastDayReset)) {
      await this.resetDailyCounters(apiKey.id);
    }

    // IP allowlist check
    if (apiKey.allowedIpCidrs && apiKey.allowedIpCidrs.length > 0) {
      const ipAllowed = apiKey.allowedIpCidrs.some((cidr: string) => 
        isIpInCidr(context.ipAddress, cidr)
      );
      
      if (!ipAllowed) {
        allowed = false;
        reason = "IP address not in allowlist";
      }
    }

    // Country restriction check
    if (allowed && apiKey.allowedCountries && apiKey.allowedCountries.length > 0) {
      if (!context.country || !apiKey.allowedCountries.includes(context.country)) {
        allowed = false;
        reason = "Country not allowed";
      }
    }

    // Time window check
    if (allowed && apiKey.allowedHoursUtc) {
      const currentHour = new Date().getUTCHours();
      if (!isWithinTimeWindow(currentHour, apiKey.allowedHoursUtc)) {
        allowed = false;
        reason = "Access outside allowed time window";
      }
    }

    // Fingerprinting check for sensitive scopes
    if (allowed && apiKey.sensitiveScopes && apiKey.sensitiveScopes.length > 0) {
      const hasSensitiveScope = context.requestedScopes.some(scope =>
        apiKey.sensitiveScopes.includes(scope)
      );

      if (hasSensitiveScope) {
        const currentFingerprint = createFingerprint(context.ipAddress, context.userAgent);
        
        if (apiKey.lastFingerprint && apiKey.lastFingerprint !== currentFingerprint) {
          warnings.push("Fingerprint change detected for sensitive scope access");
          
          // Optional: Block on fingerprint change for sensitive scopes
          // allowed = false;
          // reason = "Fingerprint mismatch for sensitive scope";
        }

        // Update fingerprint
        await this.updateFingerprint(apiKey.id, currentFingerprint);
      }
    }

    // Quota check
    if (allowed) {
      const requestsRemaining = Math.max(0, 
        (apiKey.requestsPerDay === -1 ? Infinity : apiKey.requestsPerDay) - apiKey.currentDayRequests
      );
      const expensiveRemaining = Math.max(0,
        (apiKey.expensivePerDay === -1 ? Infinity : apiKey.expensivePerDay) - apiKey.currentDayExpensive
      );

      if (context.isExpensive && expensiveRemaining <= 0) {
        allowed = false;
        reason = "Expensive operations quota exceeded";
      } else if (requestsRemaining <= 0) {
        allowed = false;
        reason = "Daily request quota exceeded";
      }

      return {
        allowed,
        reason: allowed ? undefined : reason,
        warnings: warnings.length > 0 ? warnings : undefined,
        quotaRemaining: {
          requests: requestsRemaining,
          expensive: expensiveRemaining,
        },
      };
    }

    return { allowed, reason, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Rotate API key with overlap window
   */
  async rotateApiKey(
    keyId: string,
    userId: string,
    options: {
      expiresInDays?: number;
      preservePolicy?: boolean;
    } = {},
  ): Promise<CreateEnhancedApiKeyResult> {
    // Get existing key
    const existingKey = await (prisma as any).apiKey.findUnique({
      where: { id: keyId, userId },
    });

    if (!existingKey) {
      throw new Error("API key not found");
    }

    const {
      expiresInDays,
      preservePolicy = true,
    } = options;

    // Create new key with same policy
    const newKeyResult = await this.createApiKey(userId, {
      name: `${existingKey.name} (rotated)`,
      expiresInDays: expiresInDays || this.calculateDaysUntilExpiry(existingKey.expiresAt),
      tierOverride: existingKey.tierOverride || undefined,
      securityPolicy: preservePolicy ? {
        allowedIpCidrs: existingKey.allowedIpCidrs || [],
        allowedCountries: existingKey.allowedCountries || [],
        allowedHoursUtc: existingKey.allowedHoursUtc,
        sensitiveScopes: existingKey.sensitiveScopes || [],
        requestsPerDay: existingKey.requestsPerDay,
        expensivePerDay: existingKey.expensivePerDay,
        rotationOverlapDays: existingKey.rotationOverlapDays,
      } : undefined,
    });

    // Link rotation
    await (prisma as any).apiKey.update({
      where: { id: newKeyResult.apiKey.id },
      data: { rotatedFromId: keyId },
    });

    // Set expiry on old key if overlap period specified
    if (existingKey.rotationOverlapDays > 0) {
      const overlapExpiry = new Date(Date.now() + existingKey.rotationOverlapDays * 24 * 60 * 60 * 1000);
      await (prisma as any).apiKey.update({
        where: { id: keyId },
        data: { expiresAt: overlapExpiry },
      });
    } else {
      // Revoke old key immediately
      await (prisma as any).apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date(), isActive: false },
      });
    }

    this.log.info({ 
      oldKeyId: keyId, 
      newKeyId: newKeyResult.apiKey.id, 
      userId 
    }, "API key rotated");

    return newKeyResult;
  }

  /**
   * List API keys with security policies
   */
  async listUserApiKeys(userId: string, includeRevoked = false): Promise<EnhancedApiKeyInfo[]> {
    const keys = await (prisma as any).$queryRaw`
      SELECT * FROM "api_keys"
      WHERE "userId" = ${userId}
      ${includeRevoked ? '' : 'AND "revokedAt" IS NULL'}
      ORDER BY "createdAt" DESC
    `;

    return (Array.isArray(keys) ? keys : []).map((k: any) => ({
      id: k.id,
      userId: k.userId,
      name: k.name,
      prefix: k.prefix || k.key.substring(0, 12) + "...",
      tierOverride: k.tierOverride,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
      isActive: k.isActive && !k.revokedAt,
      securityPolicy: {
        allowedIpCidrs: k.allowedIpCidrs || [],
        allowedCountries: k.allowedCountries || [],
        allowedHoursUtc: k.allowedHoursUtc,
        sensitiveScopes: k.sensitiveScopes || [],
        requestsPerDay: k.requestsPerDay,
        expensivePerDay: k.expensivePerDay,
        rotationOverlapDays: k.rotationOverlapDays,
      },
      rotationOverlapDays: k.rotationOverlapDays,
    }));
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    await (prisma as any).apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  private async updateUsageCounters(keyId: string, isExpensive: boolean): Promise<void> {
    const query = isExpensive
      ? `UPDATE "api_keys" SET "currentDayRequests" = "currentDayRequests" + 1, "currentDayExpensive" = "currentDayExpensive" + 1 WHERE id = ${keyId}`
      : `UPDATE "api_keys" SET "currentDayRequests" = "currentDayRequests" + 1 WHERE id = ${keyId}`;
    
    await (prisma as any).$queryRaw(query);
  }

  private async resetDailyCounters(keyId: string): Promise<void> {
    await (prisma as any).apiKey.update({
      where: { id: keyId },
      data: {
        currentDayRequests: 0,
        currentDayExpensive: 0,
        lastDayReset: new Date(),
      },
    });
  }

  private async updateFingerprint(keyId: string, fingerprint: string): Promise<void> {
    await (prisma as any).apiKey.update({
      where: { id: keyId },
      data: {
        fingerprintHash: fingerprint,
        lastFingerprint: fingerprint,
      },
    });
  }

  private calculateDaysUntilExpiry(expiresAt: Date | null): number {
    if (!expiresAt) return 365;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = Math.abs(expiry.getTime() - now.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton
export const enhancedApiKeyService = new EnhancedApiKeyService();
