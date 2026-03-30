/**
 * Scheduled Scans API Routes
 * 
 * Endpoints for managing scheduled scans:
 * - POST /scheduled-scans - Create a scheduled scan
 * - GET /scheduled-scans - List user's scheduled scans
 * - GET /scheduled-scans/:id - Get scheduled scan details
 * - PUT /scheduled-scans/:id - Update a scheduled scan
 * - DELETE /scheduled-scans/:id - Delete a scheduled scan
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { scheduledScanService } from "../services/scheduled-scan-service";
import { logger } from "../logger";
import { authMiddleware } from "../middleware/fastify-auth";
import { getAuthUser } from "../types/auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ============================================================================
// SCHEMAS
// ============================================================================

const createScheduledScanSchema = z.object({
  repositoryId: z.string().nullable().optional(),
  schedule: z.string().regex(/^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: "Invalid cron expression. Format: minute hour day month dayOfWeek",
  }),
  enabled: z.boolean().optional().default(true),
});

const updateScheduledScanSchema = z.object({
  schedule: z.string().regex(/^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: "Invalid cron expression. Format: minute hour day month dayOfWeek",
  }).optional(),
  enabled: z.boolean().optional(),
  repositoryId: z.string().nullable().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function scheduledScanRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook("preHandler", authMiddleware);

  /**
   * POST /scheduled-scans - Create a new scheduled scan
   */
  fastify.post(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const body = createScheduledScanSchema.parse(request.body);

        const scheduledScan = await scheduledScanService.addScheduledScan({
          userId: user.id,
          repositoryId: body.repositoryId || null,
          schedule: body.schedule,
          enabled: body.enabled,
        });

        return reply.status(201).send({
          success: true,
          data: scheduledScan,
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            details: error.errors,
          });
        }

        logger.error(
          { error: toErrorMessage(error), userId: getAuthUser(request)?.id },
          "Failed to create scheduled scan",
        );

        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to create scheduled scan",
        });
      }
    },
  );

  /**
   * GET /scheduled-scans - List user's scheduled scans
   */
  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const scheduledScans =
          await scheduledScanService.getUserScheduledScans(user.id);

        return reply.send({
          success: true,
          data: scheduledScans,
          count: scheduledScans.length,
        });
      } catch (error: unknown) {
        logger.error(
          { error: toErrorMessage(error), userId: getAuthUser(request)?.id },
          "Failed to list scheduled scans",
        );

        return reply.status(500).send({
          success: false,
          error: "Failed to list scheduled scans",
        });
      }
    },
  );

  /**
   * GET /scheduled-scans/:id - Get scheduled scan details
   */
  fastify.get(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        const scheduledScans =
          await scheduledScanService.getUserScheduledScans(user.id);
        const scheduledScan = scheduledScans.find((s) => s.id === id);

        if (!scheduledScan) {
          return reply.status(404).send({
            success: false,
            error: "Scheduled scan not found",
          });
        }

        return reply.send({
          success: true,
          data: scheduledScan,
        });
      } catch (error: unknown) {
        logger.error(
          { error: toErrorMessage(error), userId: getAuthUser(request)?.id },
          "Failed to get scheduled scan",
        );

        return reply.status(500).send({
          success: false,
          error: "Failed to get scheduled scan",
        });
      }
    },
  );

  /**
   * PUT /scheduled-scans/:id - Update a scheduled scan
   */
  fastify.put(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };
        const body = updateScheduledScanSchema.parse(request.body);

        // Verify ownership
        const scheduledScans =
          await scheduledScanService.getUserScheduledScans(user.id);
        const existing = scheduledScans.find((s) => s.id === id);

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: "Scheduled scan not found",
          });
        }

        const updated = await scheduledScanService.updateScheduledScan(id, body);

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            details: error.errors,
          });
        }

        logger.error(
          { error: toErrorMessage(error), userId: getAuthUser(request)?.id },
          "Failed to update scheduled scan",
        );

        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to update scheduled scan",
        });
      }
    },
  );

  /**
   * DELETE /scheduled-scans/:id - Delete a scheduled scan
   */
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        // Verify ownership
        const scheduledScans =
          await scheduledScanService.getUserScheduledScans(user.id);
        const existing = scheduledScans.find((s) => s.id === id);

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: "Scheduled scan not found",
          });
        }

        await scheduledScanService.deleteScheduledScan(id);

        return reply.send({
          success: true,
          message: "Scheduled scan deleted",
        });
      } catch (error: unknown) {
        logger.error(
          { error: toErrorMessage(error), userId: getAuthUser(request)?.id },
          "Failed to delete scheduled scan",
        );

        return reply.status(500).send({
          success: false,
          error: "Failed to delete scheduled scan",
        });
      }
    },
  );
}
