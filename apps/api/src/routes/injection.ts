import { FastifyInstance, FastifyRequest } from "fastify";
import { promptInjectionDetector } from "@guardrail/ai-guardrails";
import { z } from "zod";
import { authMiddleware, standardRateLimit } from "../middleware/fastify-auth";
import { asyncHandler } from "../middleware/error-handler";

const ScanSchema = z.object({
  content: z.string(),
  contentType: z.enum(["user_input", "code", "data_source"]),
  context: z
    .object({
      source: z.string(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const BatchScanSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      contentType: z.enum(["user_input", "code", "data_source"]),
    }),
  ),
});

export async function injectionRoutes(fastify: FastifyInstance) {
  // Add authentication pre-handler for all routes
  fastify.addHook("preHandler", authMiddleware);

  // POST /api/injection/scan - Scan for prompt injection
  fastify.post(
    "/scan",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const body = ScanSchema.parse(request.body);

      const result = await promptInjectionDetector.scan({
        content: body.content,
        contentType: body.contentType,
        context: body.context
          ? {
              source: body.context.source!,
              metadata: body.context.metadata,
            }
          : undefined,
      });

      return {
        result,
        timestamp: new Date().toISOString(),
      };
    }),
  );

  // POST /api/injection/batch - Batch scan multiple inputs
  fastify.post(
    "/batch",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest) => {
      const body = BatchScanSchema.parse(request.body);

      const results = await Promise.all(
        body.items.map(async (item) => {
          const scanResult = await promptInjectionDetector.scan({
            content: item.content,
            contentType: item.contentType,
          });

          return {
            id: item.id,
            result: scanResult,
          };
        }),
      );

      return {
        results,
        total: results.length,
        timestamp: new Date().toISOString(),
      };
    }),
  );
}
