/**
 * Organization & Team Billing API Routes
 *
 * Thin adapters: JWT → Zod → organization-service → response
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET } from "../config/secrets";
import { HttpError } from "../services/http-errors";
import * as organizationService from "../services/organization-service";
import {
  CreateOrgSchema,
  InviteMemberSchema,
  PurchaseSeatsBodySchema,
  ReduceSeatsBodySchema,
  UpdateMemberSchema,
  UpdateOrgSchema,
  UpgradeOrgBodySchema,
} from "./organizations.schema";

interface TokenUser {
  userId: string;
  id?: string;
  email?: string;
}

interface OrgAuthenticatedRequest extends FastifyRequest {
  user?: TokenUser & { id: string };
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply
        .status(401)
        .send({ success: false, error: "Authentication required" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as TokenUser;
    const id = decoded.id ?? decoded.userId;
    (request as OrgAuthenticatedRequest).user = {
      ...decoded,
      id,
    };
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

function getUserId(request: FastifyRequest): string | undefined {
  return (request as OrgAuthenticatedRequest).user?.id;
}

function handleServiceError(
  reply: FastifyReply,
  error: unknown,
  fastifyLog: FastifyInstance["log"],
  context: string,
) {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      error: "Validation failed",
      details: error.errors,
    });
  }
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send(error.body);
  }
  const message = error instanceof Error ? error.message : String(error);
  fastifyLog.error({ error: message }, context);
  return reply.status(500).send({ error: context });
}

export async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = CreateOrgSchema.parse(request.body);
      const result = await organizationService.createOrganization(
        getUserId(request),
        body,
      );
      return reply.status(result.status).send({
        success: true,
        organization: result.organization,
      });
    } catch (error: unknown) {
      return handleServiceError(
        reply,
        error,
        fastify.log,
        "Failed to create organization",
      );
    }
  });

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await organizationService.listOrganizations(
        getUserId(request),
      );
      return reply.send({ success: true, ...result });
    } catch (error: unknown) {
      return handleServiceError(
        reply,
        error,
        fastify.log,
        "Failed to list organizations",
      );
    }
  });

  fastify.post(
    "/accept-invite/:token",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } = request.params as { token: string };
        const result = await organizationService.acceptInvite(
          token,
          getUserId(request),
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to accept invite",
        );
      }
    },
  );

  fastify.get(
    "/:orgId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const result = await organizationService.getOrganization(
          orgId,
          getUserId(request),
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to get organization",
        );
      }
    },
  );

  fastify.patch(
    "/:orgId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const body = UpdateOrgSchema.parse(request.body);
        const result = await organizationService.updateOrganization(
          orgId,
          getUserId(request),
          body,
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to update organization",
        );
      }
    },
  );

  fastify.post(
    "/:orgId/invite",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const body = InviteMemberSchema.parse(request.body);
        const result = await organizationService.inviteMember(
          orgId,
          getUserId(request),
          body,
        );
        return reply.status(result.status).send({
          success: true,
          message: result.message,
          inviteUrl: result.inviteUrl,
          expiresAt: result.expiresAt,
        });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to invite member",
        );
      }
    },
  );

  fastify.delete(
    "/:orgId/members/:memberId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId, memberId } = request.params as {
          orgId: string;
          memberId: string;
        };
        const result = await organizationService.removeMember(
          orgId,
          memberId,
          getUserId(request),
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to remove member",
        );
      }
    },
  );

  fastify.patch(
    "/:orgId/members/:memberId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId, memberId } = request.params as {
          orgId: string;
          memberId: string;
        };
        const body = UpdateMemberSchema.parse(request.body);
        const result = await organizationService.updateMemberRole(
          orgId,
          memberId,
          getUserId(request),
          body,
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to update member",
        );
      }
    },
  );

  fastify.get(
    "/:orgId/seats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const result = await organizationService.getSeatInfo(
          orgId,
          getUserId(request),
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to get seat info",
        );
      }
    },
  );

  fastify.post(
    "/:orgId/seats/purchase",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const body = PurchaseSeatsBodySchema.parse(request.body);
        const result = await organizationService.purchaseSeats(
          orgId,
          getUserId(request),
          body,
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to purchase seats",
        );
      }
    },
  );

  fastify.post(
    "/:orgId/seats/reduce",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const body = ReduceSeatsBodySchema.parse(request.body);
        const result = await organizationService.reduceSeats(
          orgId,
          getUserId(request),
          body,
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to reduce seats",
        );
      }
    },
  );

  fastify.post(
    "/:orgId/upgrade",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const body = UpgradeOrgBodySchema.parse(request.body);
        const result = await organizationService.upgradeOrganization(
          orgId,
          getUserId(request),
          body,
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to initiate upgrade",
        );
      }
    },
  );

  fastify.get(
    "/:orgId/usage",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.params as { orgId: string };
        const result = await organizationService.getOrganizationUsage(
          orgId,
          getUserId(request),
        );
        return reply.send({ success: true, ...result });
      } catch (error: unknown) {
        return handleServiceError(
          reply,
          error,
          fastify.log,
          "Failed to get organization usage",
        );
      }
    },
  );
}
