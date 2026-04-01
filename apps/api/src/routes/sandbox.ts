import { FastifyInstance, FastifyRequest } from "fastify";
import { actionInterceptor, checkpointManager } from "@guardrail/ai-guardrails";
import { z } from "zod";
import { authMiddleware, standardRateLimit } from "../middleware/fastify-auth";
import { asyncHandler } from "../middleware/error-handler";

const InterceptActionSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  actionType: z.string(),
  category: z.enum(["code", "file", "network", "shell"]),
  details: z.any().optional(),
  reasoning: z.string().optional(),
});

const CreateCheckpointSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  modifiedFiles: z.array(z.string()),
  reason: z.string(),
});

const RollbackSchema = z.object({
  agentId: z.string(),
  checkpointId: z.string(),
});

export async function sandboxRoutes(fastify: FastifyInstance) {
  // Add authentication pre-handler for all routes
  fastify.addHook("preHandler", authMiddleware);

  // POST /api/sandbox/intercept - Intercept and evaluate action
  fastify.post(
    "/intercept",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const body = InterceptActionSchema.parse(request.body);

      const decision = await actionInterceptor.intercept({
        agentId: body.agentId,
        taskId: body.taskId,
        actionType: body.actionType,
        category: body.category,
        details: body.details || {},
        reasoning: body.reasoning,
      });

      return {
        decision,
        timestamp: new Date().toISOString(),
      };
    }),
  );

  // POST /api/sandbox/checkpoint - Create checkpoint
  fastify.post(
    "/checkpoint",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const body = CreateCheckpointSchema.parse(request.body);

      const checkpoint = await checkpointManager.createCheckpoint(
        body.agentId,
        body.taskId,
        body.modifiedFiles,
        body.reason,
      );

      return {
        success: true,
        checkpoint,
      };
    }),
  );

  // POST /api/sandbox/rollback - Rollback to checkpoint
  fastify.post(
    "/rollback",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const body = RollbackSchema.parse(request.body);

      const result = await checkpointManager.rollback(
        body.agentId,
        body.checkpointId,
      );

      return {
        success: result.success,
        filesRestored: result.filesRestored,
        errors: result.errors,
      };
    }),
  );

  // GET /api/sandbox/checkpoints/:agentId/:taskId - Get checkpoints
  fastify.get(
    "/checkpoints/:agentId/:taskId",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const { agentId, taskId } = request.params as {
        agentId: string;
        taskId: string;
      };

      const checkpoints = await checkpointManager.getCheckpoints(
        agentId,
        taskId,
      );

      return {
        checkpoints,
        total: checkpoints.length,
      };
    }),
  );
}
