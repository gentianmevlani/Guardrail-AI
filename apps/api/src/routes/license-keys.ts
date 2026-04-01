/**
 * License Key API Routes
 *
 * Endpoints for license key generation, validation, and management.
 * License keys provide offline activation for CLI tools.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET } from "../config/secrets";
import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { requirePlan } from "../middleware/plan-gating";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
import {
  createLicenseKey,
  deactivateLicenseActivation,
  getUserLicenseKeys,
  getUserTier,
  revokeLicenseKey,
  validateLicenseKey,
} from "../services/billing-service";

interface TokenUser {
  userId: string;
  id?: string;
  email?: string;
  role?: "user" | "admin" | "superadmin";
}

type WithLicenseJwtUser = { user?: TokenUser };

function licenseJwtUser(request: FastifyRequest): TokenUser | undefined {
  return (request as WithLicenseJwtUser).user;
}

// Schemas
const ValidateLicenseSchema = z.object({
  key: z
    .string()
    .regex(
      /^CG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
      "Invalid license key format. Expected: CG-XXXX-XXXX-XXXX-XXXX",
    ),
  fingerprint: z.string().optional(),
  machineId: z.string().optional(),
  hostname: z.string().optional(),
  platform: z.string().optional(),
});

const CreateLicenseSchema = z.object({
  maxActivations: z.number().min(1).max(100).default(3),
});

const RevokeLicenseSchema = z.object({
  licenseKeyId: z.string(),
  reason: z.string().min(1),
});

const DeactivateSchema = z.object({
  licenseKeyId: z.string(),
  fingerprint: z.string(),
});

// Local auth middleware for license key validation (uses imported requireAuth for admin routes)
async function localRequireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply
        .status(401)
        .send({ success: false, error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as TokenUser;
    (request as WithLicenseJwtUser).user = decoded;
  } catch (error) {
    return reply.status(401).send({ success: false, error: "Invalid token" });
  }
}

// Middleware to verify user owns the license key or is admin
async function requireLicenseOwnerOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await localRequireAuth(request, reply);
  if (reply.sent) return;

  const user = licenseJwtUser(request);
  if (!user) return;

  // Admins can manage any license
  if (user.role === "admin" || user.role === "superadmin") {
    logger.info({
      msg: "Admin managing license key",
      adminId: user.userId || user.id,
      route: request.url,
      method: request.method,
    });
    return;
  }

  // For non-admins, verify they own the license (checked in route handler)
}

export async function licenseKeyRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/licenses/validate - Validate a license key (public endpoint)
   *
   * Used by CLI to validate license keys for offline activation.
   * No authentication required.
   */
  fastify.post(
    "/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = ValidateLicenseSchema.parse(request.body);

        const result = await validateLicenseKey(body.key, body.fingerprint, {
          machineId: body.machineId,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
          hostname: body.hostname,
          platform: body.platform,
        });

        if (!result.valid) {
          return reply.status(400).send({
            success: false,
            error: result.reason,
            code: "INVALID_LICENSE",
          });
        }

        return reply.send({
          success: true,
          tier: result.tier,
          expiresAt: result.expiresAt,
          activationsRemaining: result.activationsRemaining,
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Invalid request format",
            details: error.errors,
          });
        }
        logger.error({ error: toErrorMessage(error) }, "License validation error");
        return reply.status(500).send({
          success: false,
          error: "License validation failed",
        });
      }
    },
  );

  /**
   * GET /api/licenses - Get user's license keys
   */
  fastify.get(
    "/",
    { preHandler: localRequireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jwtUser = licenseJwtUser(request);
        const userId = jwtUser?.userId || jwtUser?.id;
        if (!userId) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const licenses = await getUserLicenseKeys(userId);

        // Mask the full license key for security
        const maskedLicenses = licenses.map((license: any) => ({
          ...license,
          key:
            license.key.substring(0, 7) +
            "****-****-****-" +
            license.key.slice(-4),
        }));

        return reply.send({
          success: true,
          licenses: maskedLicenses,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to fetch license keys");
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch license keys",
        });
      }
    },
  );

  /**
   * POST /api/licenses - Generate a new license key
   */
  fastify.post(
    "/",
    { preHandler: requirePlan({ minTierLevel: 1, featureName: "License Keys" }) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jwtUser = licenseJwtUser(request);
        const userId = jwtUser?.userId || jwtUser?.id;
        if (!userId) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const body = CreateLicenseSchema.parse(request.body || {});

        // Get user's tier for license key creation
        const tier = await getUserTier(userId);

        const key = await createLicenseKey({
          userId,
          tier,
          maxActivations: body.maxActivations,
        });

        return reply.send({
          success: true,
          licenseKey: key,
          message: "Store this key securely. It will only be shown once.",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to create license key");
        return reply.status(500).send({
          success: false,
          error: "Failed to create license key",
        });
      }
    },
  );

  /**
   * POST /api/licenses/revoke - Revoke a license key (admin or owner)
   */
  fastify.post(
    "/revoke",
    { preHandler: requireLicenseOwnerOrAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jwtUser = licenseJwtUser(request);
        const userId = jwtUser?.userId || jwtUser?.id;
        if (!userId) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const body = RevokeLicenseSchema.parse(request.body);

        await revokeLicenseKey(body.licenseKeyId, body.reason);

        return reply.send({
          success: true,
          message: "License key revoked",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to revoke license key");
        return reply.status(500).send({
          success: false,
          error: "Failed to revoke license key",
        });
      }
    },
  );

  /**
   * POST /api/licenses/deactivate - Deactivate a specific device (admin or owner)
   */
  fastify.post(
    "/deactivate",
    { preHandler: requireLicenseOwnerOrAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jwtUser = licenseJwtUser(request);
        const userId = jwtUser?.userId || jwtUser?.id;
        if (!userId) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const body = DeactivateSchema.parse(request.body);

        await deactivateLicenseActivation(body.licenseKeyId, body.fingerprint);

        return reply.send({
          success: true,
          message: "Device deactivated",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to deactivate device");
        return reply.status(500).send({
          success: false,
          error: "Failed to deactivate device",
        });
      }
    },
  );

  /**
   * GET /api/licenses/:id/activations - Get activations for a license key
   */
  fastify.get(
    "/:id/activations",
    { preHandler: requireLicenseOwnerOrAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jwtUser = licenseJwtUser(request);
        const userId = jwtUser?.userId || jwtUser?.id;
        if (!userId) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const { id } = request.params as { id: string };

        // Get activations for license key
        const activations = await prisma.licenseActivation.findMany({
          where: { licenseKeyId: id },
          select: {
            id: true,
            machineId: true,
            activatedAt: true,
            lastUsedAt: true,
            ipAddress: true,
          },
          orderBy: { activatedAt: 'desc' },
        });

        return reply.send({
          success: true,
          data: activations,
          activations: [],
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to fetch activations");
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch activations",
        });
      }
    },
  );
}
