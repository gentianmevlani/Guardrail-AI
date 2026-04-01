/**
 * Project Routes for Fastify
 *
 * Thin adapters: Zod parse → project-api.service → response
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ErrorResponseSchema,
  ProjectSchema,
  ProjectStatsSchema,
  SuccessResponseSchema,
  createPaginatedRouteSchema,
  createRouteSchema,
} from "../schemas/common";
import * as projectApi from "../services/project-api.service";
import {
  CreateProjectRequestSchema,
  ProjectIdParamsSchema,
  ProjectScanBodySchema,
  ProjectStatsQuerySchema,
  QueryProjectsSchema,
  UpdateProjectRequestSchema,
} from "./projects.schema";

interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userEmail: string;
}

function sendZodError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    success: false,
    error: "Validation failed",
    details: error.errors,
  });
}

/**
 * POST /api/projects
 */
async function createProject(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  try {
    const validatedData = CreateProjectRequestSchema.parse(request.body);
    const project = await projectApi.createProjectForUser(
      request.userId,
      validatedData,
    );
    reply.status(201).send({ success: true, data: project });
  } catch (error: unknown) {
    request.log.error({ error }, "Create project error");
    if (error instanceof z.ZodError) {
      return sendZodError(reply, error);
    }
    const message = error instanceof Error ? error.message : "Failed to create project";
    reply.status(500).send({ success: false, error: message });
  }
}

/**
 * GET /api/projects
 */
async function getProjects(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const query = QueryProjectsSchema.parse(request.query);
    const data = await projectApi.listProjectsPaginated(request.userId, query);
    reply.send({ success: true, data });
  } catch (error: unknown) {
    request.log.error({ error }, "Get projects error");
    reply.status(500).send({
      success: false,
      error: "Failed to get projects",
    });
  }
}

/**
 * GET /api/projects/:id
 */
async function getProject(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const { id } = ProjectIdParamsSchema.parse(request.params);
    const project = await projectApi.getProjectForUser(id, request.userId);
    reply.send({ success: true, data: project });
  } catch (error: unknown) {
    request.log.error({ error }, "Get project error");
    if (error instanceof Error && error.message === "Project not found") {
      return reply.status(404).send({
        success: false,
        error: "Project not found",
      });
    }
    reply.status(500).send({
      success: false,
      error: "Failed to get project",
    });
  }
}

/**
 * PUT /api/projects/:id
 */
async function updateProject(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  try {
    const { id } = ProjectIdParamsSchema.parse(request.params);
    const validatedData = UpdateProjectRequestSchema.parse(request.body);
    const project = await projectApi.updateProjectForUser(
      id,
      request.userId,
      validatedData,
    );
    reply.send({ success: true, data: project });
  } catch (error: unknown) {
    request.log.error({ error }, "Update project error");
    const msg = error instanceof Error ? error.message : "";
    if (
      msg === "Project not found" ||
      msg === "Project not found or access denied"
    ) {
      return reply.status(404).send({
        success: false,
        error: "Project not found",
      });
    }
    if (error instanceof z.ZodError) {
      return sendZodError(reply, error);
    }
    reply.status(500).send({
      success: false,
      error: msg || "Failed to update project",
    });
  }
}

/**
 * DELETE /api/projects/:id
 */
async function deleteProject(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  try {
    const { id } = ProjectIdParamsSchema.parse(request.params);
    await projectApi.deleteProjectForUser(id, request.userId);
    reply.send({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Delete project error");
    const msg = error instanceof Error ? error.message : "";
    if (
      msg === "Project not found" ||
      msg === "Project not found or access denied"
    ) {
      return reply.status(404).send({
        success: false,
        error: "Project not found",
      });
    }
    reply.status(500).send({
      success: false,
      error: "Failed to delete project",
    });
  }
}

/**
 * POST /api/projects/:id/scan
 */
async function scanProject(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const { id } = ProjectIdParamsSchema.parse(request.params);
    const body = ProjectScanBodySchema.parse(request.body ?? {});
    const data = await projectApi.scanProjectForUser(id, request.userId, body);
    reply.send({ success: true, data });
  } catch (error: unknown) {
    request.log.error({ error }, "Scan project error");
    const err = error as Error & { code?: string };
    if (err.code === "MISSING_SCAN_PATH") {
      return reply.status(400).send({
        success: false,
        error: "Project path is required for scanning",
      });
    }
    if (error instanceof z.ZodError) {
      return sendZodError(reply, error);
    }
    if (error instanceof Error && error.message === "Project not found") {
      return reply.status(404).send({
        success: false,
        error: "Project not found",
      });
    }
    const message = error instanceof Error ? error.message : "Failed to scan project";
    reply.status(500).send({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/projects/:id/stats
 */
async function getProjectStats(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  try {
    const { id } = ProjectIdParamsSchema.parse(request.params);
    const query = ProjectStatsQuerySchema.parse(request.query);
    const stats = await projectApi.getProjectStatsForUser(
      id,
      request.userId,
      query,
    );
    reply.send({ success: true, data: stats });
  } catch (error: unknown) {
    request.log.error({ error }, "Get project stats error");
    if (error instanceof z.ZodError) {
      return sendZodError(reply, error);
    }
    if (error instanceof Error && error.message === "Project not found") {
      return reply.status(404).send({
        success: false,
        error: "Project not found",
      });
    }
    reply.status(500).send({
      success: false,
      error: "Failed to get project statistics",
    });
  }
}

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: "Access token required",
      });
    }

    try {
      const { authService } = await import("../services/auth-service.js");
      const decoded = await authService.verifyToken(token);
      (request as AuthenticatedRequest).userId = decoded.userId;
      (request as AuthenticatedRequest).userEmail = decoded.email;
    } catch {
      reply.status(401).send({
        success: false,
        error: "Invalid or expired token",
      });
    }
  });

  fastify.post(
    "/",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Create a new project",
      description: "Creates a new project for the authenticated user",
      body: CreateProjectRequestSchema,
      response: {
        201: SuccessResponseSchema.extend({ data: ProjectSchema }) as z.ZodTypeAny,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    createProject as any,
  );

  fastify.get(
    "/",
    createPaginatedRouteSchema(ProjectSchema, {
      tags: ["Projects"],
      summary: "List user's projects",
      description:
        "Retrieves a paginated list of projects for the authenticated user",
      querystring: QueryProjectsSchema,
    }) as any,
    getProjects as any,
  );

  fastify.get(
    "/:id",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Get a specific project",
      description: "Retrieves details of a specific project by ID",
      params: ProjectIdParamsSchema as z.ZodTypeAny,
      response: {
        200: SuccessResponseSchema.extend({ data: ProjectSchema }) as z.ZodTypeAny,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    getProject as any,
  );

  fastify.put(
    "/:id",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Update a project",
      description: "Updates project details",
      params: ProjectIdParamsSchema as z.ZodTypeAny,
      body: UpdateProjectRequestSchema,
      response: {
        200: SuccessResponseSchema.extend({ data: ProjectSchema }) as z.ZodTypeAny,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    updateProject as any,
  );

  fastify.delete(
    "/:id",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Delete a project",
      description: "Deletes a project and all associated data",
      params: ProjectIdParamsSchema as z.ZodTypeAny,
      response: {
        200: SuccessResponseSchema.extend({
          data: z.object({ deleted: z.literal(true) }),
        }) as z.ZodTypeAny,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    deleteProject as any,
  );

  fastify.post(
    "/:id/scan",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Scan a project",
      description: "Initiates a security scan on the project",
      params: ProjectIdParamsSchema as z.ZodTypeAny,
      body: ProjectScanBodySchema as z.ZodTypeAny,
      response: {
        200: SuccessResponseSchema.extend({
          data: z.object({
            stats: z.record(z.unknown()),
            message: z.string(),
          }),
        }) as z.ZodTypeAny,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    scanProject as any,
  );

  fastify.get(
    "/:id/stats",
    createRouteSchema({
      tags: ["Projects"],
      summary: "Get project statistics",
      description: "Retrieves usage and scan statistics for a project",
      params: ProjectIdParamsSchema as z.ZodTypeAny,
      querystring: z.object({
        days: z.string().transform(Number).default("30"),
      }) as z.ZodTypeAny,
      response: {
        200: SuccessResponseSchema.extend({ data: ProjectStatsSchema }) as z.ZodTypeAny,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    }) as any,
    getProjectStats as any,
  );
}
