import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  authMiddlewareOrApiKey,
  standardRateLimit,
  type AuthenticatedRequest,
} from "../middleware/fastify-auth";
import { logger } from "../logger";
import * as runsService from "../services/runs.service";
import { getArtifactContentType } from "../services/run-execution.service";
import {
  ApplyFixesBodySchema,
  CreateRunSchema,
  SaveRunBodySchema,
} from "./runs.schema";

// Public routes - JWT or API key for all routes in this group
async function publicRunsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", async (request, reply) => {
    await authMiddlewareOrApiKey(request as AuthenticatedRequest, reply);
  });

  fastify.get(
    "/list",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as runsService.ListQueryParams;
        const result = await runsService.listRunsGlobal(query);
        return reply.send(result);
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching runs list");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.post(
    "/save",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = SaveRunBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: "Invalid request body",
            details: parsed.error.errors,
          });
        }
        const body = parsed.data;

        if (
          body.verdict === undefined ||
          body.verdict === null ||
          body.score === undefined ||
          body.score === null ||
          Number.isNaN(Number(body.score))
        ) {
          return reply.status(400).send({
            success: false,
            error: "verdict and score are required",
          });
        }

        const authReq = request as AuthenticatedRequest;
        const userId = authReq.user?.id;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required",
          });
        }

        const data = await runsService.saveRunRecord(userId, {
          ...body,
          verdict: String(body.verdict),
          score: Number(body.score),
        });

        return reply.send({
          success: true,
          data,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error saving run");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );
}

async function authenticatedRunsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authMiddlewareOrApiKey);

  fastify.post(
    "/",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authReq = request as AuthenticatedRequest;
        const user = authReq.user;

        const bodyValidation = CreateRunSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          return reply.status(400).send({
            success: false,
            error: "Invalid request body",
            details: bodyValidation.error.errors,
          });
        }
        const body = bodyValidation.data;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        if (!body.repo) {
          return reply.status(400).send({
            success: false,
            error: "repo is required",
          });
        }

        const { run, repo, branch } = await runsService.startRunAndScheduleExecution(
          user.id,
          body,
        );

        return reply.send({
          success: true,
          data: {
            id: run.id,
            repo: run.repo,
            branch: run.branch,
            commitSha: run.commit_sha,
            status: "running",
            verdict: "pending",
            progress: 0,
            startedAt: run.started_at?.toISOString(),
            createdAt: run.created_at?.toISOString(),
            message: `Run started for ${repo}@${branch}`,
          },
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error creating run");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.get(
    "/status",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authReq = request as AuthenticatedRequest;
        const user = authReq.user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const data = await runsService.fetchRunningRunsStatus(user.id);
        return reply.send({
          success: true,
          data,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching run status");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.get(
    "/",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as runsService.ListQueryParams;
        const authReq = request as AuthenticatedRequest;
        const user = authReq.user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const data = await runsService.listRunsForUser(user.id, query);
        return reply.send({
          success: true,
          data,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching runs");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.get(
    "/:id",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const detail = await runsService.getRunDetailForUser(id, user.id);
        if (!detail) {
          return reply.status(404).send({
            success: false,
            error: "Run not found",
          });
        }

        return reply.send({
          success: true,
          data: detail,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching run");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.get(
    "/:id/replay",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const replayData = await runsService.getReplayPayloadForUser(id, user.id);
        if (!replayData) {
          return reply.status(404).send({
            success: false,
            error: "Run not found",
          });
        }

        return reply.send({
          success: true,
          data: replayData,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching replay data");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.delete(
    "/:id",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const deleted = await runsService.deleteRunForUser(id, user.id);
        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: "Run not found or you don't have permission to delete it",
          });
        }

        return reply.send({
          success: true,
          data: deleted,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error deleting run");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.get(
    "/:id/artifacts/:filename",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, filename } = request.params as {
          id: string;
          filename: string;
        };
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const resolved = await runsService.resolveArtifactStreamPath(
          id,
          filename,
          user.id,
        );
        if (resolved.status === "no_run") {
          return reply.status(404).send({
            success: false,
            error: "Run not found",
          });
        }
        if (resolved.status === "no_artifact") {
          return reply.status(404).send({
            success: false,
            error: "Artifact file not found",
          });
        }

        const { stream, size } = runsService.createArtifactReadStream(resolved.filePath);
        const contentType = getArtifactContentType(filename);

        reply.header("Content-Type", contentType);
        reply.header("Content-Length", size);
        reply.header("Content-Disposition", `inline; filename="${filename}"`);
        reply.header("Cache-Control", "public, max-age=3600");

        return reply.send(stream);
      } catch (error: unknown) {
        logger.error({ error }, "Error streaming artifact");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.post(
    "/:id/fixes/:packId/diff",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, packId } = request.params as { id: string; packId: string };
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const ok = await runsService.assertRunOwnedByUser(id, user.id);
        if (!ok) {
          return reply.status(404).send({
            success: false,
            error: "Run not found",
          });
        }

        const diffResult = await runsService.previewFixPackDiff(id, packId);

        return reply.send({
          success: diffResult.success,
          data: diffResult,
        });
      } catch (error: unknown) {
        logger.error({ error, runId: id, packId }, "Error generating diff");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  fastify.post(
    "/:id/fixes/:packId/apply",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, packId } = request.params as { id: string; packId: string };
      try {
        const user = (request as AuthenticatedRequest).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const body = ApplyFixesBodySchema.parse(request.body ?? {});

        const ok = await runsService.assertRunOwnedByUser(id, user.id);
        if (!ok) {
          return reply.status(404).send({
            success: false,
            error: "Run not found",
          });
        }

        const applyResult = await runsService.applyFixPackForRun(
          id,
          packId,
          user.id,
          body.dryRun ?? false,
        );

        return reply.send({
          success: applyResult.success,
          data: applyResult,
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            details: error.errors,
          });
        }
        logger.error({ error, runId: id, packId }, "Error applying fixes");
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );
}

export async function runsRoutes(fastify: FastifyInstance) {
  await fastify.register(publicRunsRoutes);
  await fastify.register(authenticatedRunsRoutes);
}
