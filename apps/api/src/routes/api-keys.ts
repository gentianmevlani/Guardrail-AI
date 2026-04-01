/**
 * API Keys Routes
 *
 * CRUD endpoints for API key management with secure server-side validation.
 * 
 * SECURITY: API keys do NOT contain tier information in the string.
 * Tier is determined server-side from:
 * 1. User's subscription tier
 * 2. Optional tierOverride on the API key (admin grants)
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/secrets";
import { logger } from "../logger";
import { apiKeyService } from "../services/api-key-service";
import type { AuthUser } from "../types/auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const log = logger.child({ route: "api-keys" });

type ApiKeysRequest = FastifyRequest & { user?: AuthUser };

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
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      userId?: string;
      email?: string;
    };
    const id =
      typeof decoded.userId === "string"
        ? decoded.userId
        : String(decoded.sub ?? "");
    (request as ApiKeysRequest).user = {
      id,
      userId: typeof decoded.userId === "string" ? decoded.userId : undefined,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
    };
  } catch (error) {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

// ==========================================
// SCHEMAS
// ==========================================

const createApiKeySchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      expiresInDays: { type: "number", minimum: 1, maximum: 365 },
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
          },
        },
        warning: { type: "string" },
      },
    },
    401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    500: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
  },
};

const listApiKeysSchema = {
  querystring: {
    type: "object",
    properties: {
      includeRevoked: { type: "boolean", default: false },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        apiKeys: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              prefix: { type: "string" },
              tierOverride: { type: ["string", "null"] },
              lastUsedAt: { type: ["string", "null"] },
              expiresAt: { type: ["string", "null"] },
              revokedAt: { type: ["string", "null"] },
              createdAt: { type: "string" },
              isActive: { type: "boolean" },
            },
          },
        },
      },
    },
    401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    500: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
  },
};

const revokeApiKeySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        error: { type: "string" },
      },
    },
    401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
    500: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
  },
};

const validateApiKeySchema = {
  body: {
    type: "object",
    required: ["apiKey"],
    properties: {
      apiKey: { type: "string" },
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
        error: { type: "string" },
      },
    },
  },
};

// ==========================================
// ROUTES
// ==========================================

export async function apiKeysRoutes(fastify: FastifyInstance) {
  /**
   * POST /api-keys
   * Create a new API key for the authenticated user
   */
  fastify.post(
    "/api-keys",
    {
      schema: createApiKeySchema,
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as ApiKeysRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { name, expiresInDays } = (request.body as { name?: string; expiresInDays?: number }) || {};

      try {
        const result = await apiKeyService.createApiKey(userId, {
          name,
          expiresInDays,
        });

        log.info({ userId, keyId: result.apiKey.id }, "API key created");

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
          },
          warning:
            "Save this API key now. You won't be able to see it again!",
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId }, "Failed to create API key");
        return reply.status(500).send({
          success: false,
          error: "Failed to create API key",
        });
      }
    },
  );

  /**
   * GET /api-keys
   * List all API keys for the authenticated user
   */
  fastify.get(
    "/api-keys",
    {
      schema: listApiKeysSchema,
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as ApiKeysRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { includeRevoked = false } = (request.query as { includeRevoked?: boolean }) || {};

      try {
        const apiKeys = await apiKeyService.listUserApiKeys(userId, includeRevoked);

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
          })),
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId }, "Failed to list API keys");
        return reply.status(500).send({
          success: false,
          error: "Failed to list API keys",
        });
      }
    },
  );

  /**
   * DELETE /api-keys/:id
   * Revoke (soft delete) an API key
   */
  fastify.delete(
    "/api-keys/:id",
    {
      schema: revokeApiKeySchema,
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = (request as ApiKeysRequest).user;
      const userId = user?.userId || user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      try {
        const revoked = await apiKeyService.revokeApiKey(id, userId);

        if (!revoked) {
          return reply.status(404).send({
            success: false,
            error: "API key not found or already revoked",
          });
        }

        log.info({ userId, keyId: id }, "API key revoked");

        return reply.send({
          success: true,
          message: "API key revoked successfully",
        });
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error), userId, keyId: id }, "Failed to revoke API key");
        return reply.status(500).send({
          success: false,
          error: "Failed to revoke API key",
        });
      }
    },
  );

  /**
   * POST /api-keys/validate
   * Validate an API key and return tier information
   * 
   * This is the endpoint CLI/clients should call to verify their API key
   * and get their effective tier. NO tier parsing from the key string!
   */
  fastify.post(
    "/api-keys/validate",
    {
      schema: validateApiKeySchema,
    },
    async (
      request: FastifyRequest<{
        Body: { apiKey: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { apiKey } = request.body;

      try {
        const result = await apiKeyService.validateApiKey(apiKey);

        if (!result.valid) {
          log.warn({ error: result.error }, "API key validation failed");
        }

        return reply.send(result);
      } catch (error: unknown) {
        log.error({ error: toErrorMessage(error) }, "Failed to validate API key");
        return reply.status(500).send({
          valid: false,
          error: "Validation failed",
        });
      }
    },
  );
}
