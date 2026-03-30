import { FastifyInstance, FastifyReply } from "fastify";
import { permissionManager } from "@guardrail/ai-guardrails";
import { prisma } from "@guardrail/database";
import { z } from "zod";

// Import middleware
import {
  authMiddleware,
  requireRole,
  requireOwner,
  standardRateLimit,
  authRateLimit,
} from "../middleware/fastify-auth";
import { commonSchemas } from "../middleware/validation";
import { asyncHandler, createError } from "../middleware/error-handler";
import { AuthenticatedRequest } from "../middleware/fastify-auth";

export async function agentRoutes(fastify: FastifyInstance) {
  // Add authentication pre-handler for all routes
  fastify.addHook("preHandler", authMiddleware);

  // POST /api/agents - Register new agent (admin only)
  fastify.post(
    "/",
    {
      preHandler: [requireRole(["admin"]), authRateLimit],
      schema: {
        body: { $ref: "registerAgent" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const body = request.body as any;

        await permissionManager.registerAgent(
          body.agentId,
          body.name,
          body.type,
          body.scope,
          body.model,
        );

        return {
          success: true,
          agentId: body.agentId,
          message: "Agent registered successfully",
        };
      },
    ),
  );

  // GET /api/agents/:id - Get agent details
  fastify.get(
    "/:id",
    {
      preHandler: [standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        const agent = await prisma.agent.findUnique({
          where: { id },
          include: {
            actions: true,
          },
        });

        if (!agent) {
          throw createError.notFound("Agent not found");
        }

        // Check if user owns the agent or is admin
        // Note: Agent model doesn't have userId field, so we need to check through project
        // For now, let admin access everything and restrict user access
        if (request.user?.role !== "admin") {
          throw createError.forbidden("Access denied - agent access requires admin role");
        }

        return agent;
      },
    ),
  );

  // PUT /api/agents/:id/permissions - Update permissions
  fastify.put(
    "/:id/permissions",
    {
      preHandler: [requireOwner, standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
        body: { $ref: "updatePermissions" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        await permissionManager.updatePermissions(id, body);

        return {
          success: true,
          message: "Permissions updated successfully",
        };
      },
    ),
  );

  // POST /api/agents/:id/suspend - Suspend agent
  fastify.post(
    "/:id/suspend",
    {
      preHandler: [requireOwner, standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        await permissionManager.suspendAgent(
          id,
          "Suspended via API",
          request.user?.id || "unknown",
        );

        return {
          success: true,
          message: "Agent suspended successfully",
        };
      },
    ),
  );

  // POST /api/agents/:id/reactivate - Reactivate agent
  fastify.post(
    "/:id/reactivate",
    {
      preHandler: [requireOwner, standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        await permissionManager.reactivateAgent(id);

        return {
          success: true,
          message: "Agent reactivated successfully",
        };
      },
    ),
  );

  // GET /api/agents/:id/actions - Query agent actions
  fastify.get(
    "/:id/actions",
    {
      preHandler: [requireOwner, standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
        querystring: { $ref: "pagination" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const query = request.query as any;
        const limit = query.limit || 50;
        const offset = query.offset || 0;

        const actions = await prisma.agentAction.findMany({
          where: { agentId: id },
          orderBy: { id: "desc" },
          take: limit,
          skip: offset,
        });

        const total = await prisma.agentAction.count({
          where: { agentId: id },
        });

        return {
          actions,
          total,
          limit,
          offset,
        };
      },
    ),
  );

  // GET /api/agents - List all agents (admin) or user's agents
  fastify.get(
    "/",
    {
      preHandler: [standardRateLimit],
      schema: {
        querystring: { $ref: "pagination" },
      },
    },
    asyncHandler(
      async (request: AuthenticatedRequest, _reply: FastifyReply) => {
        const query = request.query as any;
        const limit = query.limit || 20;
        const offset = query.offset || 0;

        // @ts-ignore
        const where =
          request.user?.role === "admin"
            ? ({} as any)
            : // @ts-ignore
              ({ userId: request.user?.id } as any);

        const agents = await prisma.agent.findMany({
          where,
          include: {
            actions: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        });

        const total = await prisma.agent.count({ where });

        return {
          agents,
          total,
          limit,
          offset,
        };
      },
    ),
  );
}
