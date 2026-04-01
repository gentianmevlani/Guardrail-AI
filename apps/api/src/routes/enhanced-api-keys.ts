/**
 * Enhanced API Keys Routes
 *
 * Extends the original API key routes with security policy support:
 * - IP allowlisting
 * - Time-based restrictions
 * - Country restrictions
 * - Usage quotas
 * - Key rotation
 * - Fingerprinting
 *
 * SECURITY: All policy enforcement happens server-side. The API key string
 * contains NO tier or policy information.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/secrets";
import { logger } from "../logger";
import { ApiKeySecurityPolicy, enhancedApiKeyService } from "../services/enhanced-api-key-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const log = logger.child({ route: "enhanced-api-keys" });

/** User data from JWT token */
interface TokenUser {
  userId: string;
  id?: string;
  email?: string;
}

/** Authenticated request with user */
interface AuthenticatedRequest extends Omit<FastifyRequest, 'user'> {
  user?: TokenUser;
}

/**
 * Require authentication middleware
 */
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as TokenUser;

    (request as AuthenticatedRequest).user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

// ==========================================
// SCHEMAS
// ==========================================

const createEnhancedApiKeySchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      expiresInDays: { type: "number", minimum: 1, maximum: 365 },
      tierOverride: { type: "string", enum: ["free", "starter", "pro", "compliance", "enterprise"] },
      securityPolicy: {
        type: "object",
        properties: {
          allowedIpCidrs: { 
            type: "array", 
            items: { type: "string" },
            description: "Array of CIDR ranges (e.g., ['192.168.1.0/24', '10.0.0.0/8'])"
          },
          allowedCountries: { 
            type: "array", 
            items: { type: "string", pattern: "^[A-Z]{2}$" },
            description: "Array of ISO 3166-1 alpha-2 country codes"
          },
          allowedHoursUtc: {
            type: "object",
            properties: {
              start: { type: "number", minimum: 0, maximum: 23 },
              end: { type: "number", minimum: 0, maximum: 23 },
            },
            required: ["start", "end"],
            description: "UTC hour range when key is valid (e.g., {start: 9, end: 17})"
          },
          sensitiveScopes: {
            type: "array",
            items: { type: "string" },
            description: "Scopes requiring stricter security checks"
          },
          requestsPerDay: { 
            type: "number", 
            minimum: -1, 
            description: "Daily request limit (-1 for unlimited)"
          },
          expensivePerDay: { 
            type: "number", 
            minimum: -1, 
            description: "Daily expensive operations limit (-1 for unlimited)"
          },
          rotationOverlapDays: { 
            type: "number", 
            minimum: 0, 
            maximum: 30,
            description: "Overlap period in days when rotating keys"
          },
        },
      },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        key: { type: "string" },
        apiKey: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            prefix: { type: "string" },
            tierOverride: { type: ["string", "null"] },
            expiresAt: { type: ["string", "null"] },
            createdAt: { type: "string" },
            securityPolicy: { type: "object" },
            rotationOverlapDays: { type: "number" },
          },
        },
        warning: { type: "string" },
      },
    },
    401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    500: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
  },
};

const rotateApiKeySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      expiresInDays: { type: "number", minimum: 1, maximum: 365 },
      preservePolicy: { type: "boolean", default: true },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        oldKeyId: { type: "string" },
        newKey: { type: "string" },
        newApiKey: { type: "object" },
        overlapExpiresAt: { type: ["string", "null"] },
      },
    },
    404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    500: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
  },
};

const validateEnhancedApiKeySchema = {
  body: {
    type: "object",
    required: ["apiKey", "context"],
    properties: {
      apiKey: { type: "string" },
      context: {
        type: "object",
        properties: {
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
          country: { type: "string" },
          requestedScopes: { type: "array", items: { type: "string" } },
          isExpensive: { type: "boolean" },
        },
        required: ["ipAddress", "requestedScopes"],
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        userId: { type: "string" },
        tier: { type: "string" },
        tierOverride: { type: ["string", "null"] },
        securityPolicy: {
          type: "object",
          properties: {
            allowed: { type: "boolean" },
            reason: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
            quotaRemaining: {
              type: "object",
              properties: {
                requests: { type: "number" },
                expensive: { type: "number" },
              },
            },
          },
        },
        error: { type: "string" },
      },
    },
  },
};

// ==========================================
// ROUTES
// ==========================================

export async function enhancedApiKeysRoutes(fastify: FastifyInstance) {
  /**
   * POST /enhanced-api-keys
   * Create a new API key with security policy
   */
  fastify.post(
    "/enhanced-api-keys",
    {
      schema: createEnhancedApiKeySchema,
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { name, expiresInDays, tierOverride, securityPolicy } = request.body as {
        name?: string;
        expiresInDays?: number;
        tierOverride?: string;
        securityPolicy?: ApiKeySecurityPolicy;
      };

      try {
        const result = await enhancedApiKeyService.createApiKey(userId, {
          name,
          expiresInDays,
          tierOverride,
          securityPolicy,
        });

        log.info({ userId, keyId: result.apiKey.id }, "Enhanced API key created");

        return reply.status(201).send({
          success: true,
          key: result.key,
          apiKey: {
            id: result.apiKey.id,
            name: result.apiKey.name,
            prefix: result.apiKey.prefix,
            tierOverride: result.apiKey.tierOverride,
            expiresAt: result.apiKey.expiresAt?.toISOString() || null,
            createdAt: result.apiKey.createdAt.toISOString(),
            securityPolicy: result.apiKey.securityPolicy,
            rotationOverlapDays: result.apiKey.rotationOverlapDays,
          },
          warning: "Save this API key now. You won't be able to see it again!",
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId }, "Failed to create enhanced API key");
        return reply.status(500).send({
          success: false,
          error: "Failed to create API key",
        });
      }
    },
  );

  /**
   * GET /enhanced-api-keys
   * List all enhanced API keys for the authenticated user
   */
  fastify.get(
    "/enhanced-api-keys",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { includeRevoked = false } = (request.query as { includeRevoked?: boolean }) || {};

      try {
        const apiKeys = await enhancedApiKeyService.listUserApiKeys(userId, includeRevoked);

        return reply.send({
          success: true,
          apiKeys: apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            tierOverride: k.tierOverride,
            lastUsedAt: k.lastUsedAt?.toISOString() || null,
            expiresAt: k.expiresAt?.toISOString() || null,
            revokedAt: k.revokedAt?.toISOString() || null,
            createdAt: k.createdAt.toISOString(),
            isActive: k.isActive,
            securityPolicy: k.securityPolicy,
            rotationOverlapDays: k.rotationOverlapDays,
          })),
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId }, "Failed to list enhanced API keys");
        return reply.status(500).send({
          success: false,
          error: "Failed to list API keys",
        });
      }
    },
  );

  /**
   * POST /enhanced-api-keys/:id/rotate
   * Rotate an API key with overlap window
   */
  fastify.post(
    "/enhanced-api-keys/:id/rotate",
    {
      schema: rotateApiKeySchema,
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { id } = request.params as { id: string };
      const { expiresInDays, preservePolicy = true } = request.body as {
        expiresInDays?: number;
        preservePolicy?: boolean;
      };

      try {
        const result = await enhancedApiKeyService.rotateApiKey(id, userId, {
          expiresInDays,
          preservePolicy,
        });

        // Calculate overlap expiry if applicable
        const overlapExpiresAt = result.apiKey.rotationOverlapDays > 0
          ? new Date(Date.now() + result.apiKey.rotationOverlapDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        log.info({ userId, oldKeyId: id, newKeyId: result.apiKey.id }, "API key rotated");

        return reply.send({
          success: true,
          oldKeyId: id,
          newKey: result.key,
          newApiKey: {
            id: result.apiKey.id,
            name: result.apiKey.name,
            prefix: result.apiKey.prefix,
            tierOverride: result.apiKey.tierOverride,
            expiresAt: result.apiKey.expiresAt?.toISOString() || null,
            createdAt: result.apiKey.createdAt.toISOString(),
            securityPolicy: result.apiKey.securityPolicy,
            rotationOverlapDays: result.apiKey.rotationOverlapDays,
          },
          overlapExpiresAt,
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId, keyId: id }, "Failed to rotate API key");
        
        if (toErrorMessage(error) === "API key not found") {
          return reply.status(404).send({
            success: false,
            error: "API key not found",
          });
        }

        return reply.status(500).send({
          success: false,
          error: "Failed to rotate API key",
        });
      }
    },
  );

  /**
   * DELETE /enhanced-api-keys/:id
   * Revoke (soft delete) an enhanced API key
   */
  fastify.delete(
    "/enhanced-api-keys/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      try {
        // Use raw query for now since we can't update the original service
        const result = await (global as any).prisma.$queryRaw`
          UPDATE "api_keys" 
          SET "revokedAt" = ${new Date()}, "isActive" = false
          WHERE "id" = ${id} AND "userId" = ${userId} AND "revokedAt" IS NULL
        `;

        if (Array.isArray(result) && result.length > 0 && result[0].rowCount > 0) {
          log.info({ userId, keyId: id }, "Enhanced API key revoked");

          return reply.send({
            success: true,
            message: "API key revoked successfully",
          });
        } else {
          return reply.status(404).send({
            success: false,
            error: "API key not found or already revoked",
          });
        }
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId, keyId: id }, "Failed to revoke enhanced API key");
        return reply.status(500).send({
          success: false,
          error: "Failed to revoke API key",
        });
      }
    },
  );

  /**
   * POST /enhanced-api-keys/validate
   * Validate an API key with security policy context
   * 
   * This endpoint is for testing and debugging security policies
   */
  fastify.post(
    "/enhanced-api-keys/validate",
    {
      schema: validateEnhancedApiKeySchema,
    },
    async (request, reply) => {
      const { apiKey, context } = request.body as {
        apiKey: string;
        context: {
          ipAddress: string;
          userAgent?: string;
          country?: string;
          requestedScopes: string[];
          isExpensive?: boolean;
        };
      };

      try {
        const result = await enhancedApiKeyService.validateApiKeyWithPolicy(apiKey, context);

        if (!result.valid) {
          log.warn({ error: result.error, context }, "Enhanced API key validation failed");
        }

        return reply.send(result);
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error) }, "Failed to validate enhanced API key");
        return reply.status(500 as any).send({
          valid: false,
          error: "Validation failed",
        });
      }
    },
  );

  /**
   * GET /enhanced-api-keys/templates/security-policies
   * Get common security policy templates
   */
  fastify.get(
    "/enhanced-api-keys/templates/security-policies",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const templates = {
        development: {
          name: "Development Key",
          description: "For local development with relaxed restrictions",
          securityPolicy: {
            allowedIpCidrs: ["127.0.0.0/8", "::1/128", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
            allowedCountries: [],
            allowedHoursUtc: { start: 6, end: 22 },
            sensitiveScopes: ["write", "delete", "admin"],
            requestsPerDay: 1000,
            expensivePerDay: 100,
            rotationOverlapDays: 7,
          },
        },
        production: {
          name: "Production Key",
          description: "For production use with strict restrictions",
          securityPolicy: {
            allowedIpCidrs: [], // Must be explicitly set
            allowedCountries: ["US", "GB", "CA", "AU", "DE", "FR", "JP"],
            allowedHoursUtc: { start: 0, end: 23 }, // 24/7
            sensitiveScopes: ["write", "delete", "admin"],
            requestsPerDay: 10000,
            expensivePerDay: 1000,
            rotationOverlapDays: 30,
          },
        },
        readonly: {
          name: "Read-Only Key",
          description: "For third-party integrations with read-only access",
          securityPolicy: {
            allowedIpCidrs: [], // Must be explicitly set
            allowedCountries: ["US", "GB", "CA", "AU", "DE", "FR", "JP"],
            allowedHoursUtc: { start: 0, end: 23 },
            sensitiveScopes: [], // No sensitive scopes
            requestsPerDay: 5000,
            expensivePerDay: 0, // No expensive operations
            rotationOverlapDays: 90,
          },
        },
        "ci-cd": {
          name: "CI/CD Key",
          description: "For automated deployment pipelines",
          securityPolicy: {
            allowedIpCidrs: [], // Should be set to CI/CD provider IPs
            allowedCountries: [],
            allowedHoursUtc: { start: 0, end: 23 },
            sensitiveScopes: ["write", "deploy"],
            requestsPerDay: 500,
            expensivePerDay: 50,
            rotationOverlapDays: 0, // Immediate rotation
          },
        },
      };

      return reply.send({
        success: true,
        templates,
      });
    },
  );
}
