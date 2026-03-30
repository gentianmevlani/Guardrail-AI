import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiOutputValidator } from '@guardrail/ai-guardrails';
import type { ValidationRequest } from '@guardrail/core';
import { z } from 'zod';
import {
  validationPostValidateSchema,
  validationGetByIdSchema,
} from '../openapi/ai-guardrails-openapi';

const ValidateSchema = z.object({
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  output: z.object({
    code: z.string(),
    language: z.string(),
    outputType: z.enum(['code', 'config', 'documentation']),
    metadata: z.record(z.unknown()).optional(),
  }),
  context: z
    .object({
      projectPath: z.string().optional(),
      existingFiles: z.array(z.string()).optional(),
      dependencies: z.record(z.string()).optional(),
      framework: z.string().optional(),
    })
    .optional(),
  request: z.string().optional(),
});

export async function validationRoutes(fastify: FastifyInstance) {
  // POST /api/validation/validate - Validate AI output
  fastify.post('/validate', { schema: validationPostValidateSchema }, async (request: FastifyRequest) => {
    const body = ValidateSchema.parse(request.body);

    const validationRequest: ValidationRequest = {
      output: body.output,
      context: body.context,
      request: body.request,
    };

    const result = await aiOutputValidator.validate(validationRequest);

    return {
      result,
      timestamp: new Date().toISOString(),
    };
  });

  // GET /api/validation/:id - Get validation result
  fastify.get('/:id', { schema: validationGetByIdSchema }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const validation = await (await import('@guardrail/database')).prisma.outputValidation.findUnique({
      where: { id },
    });

    if (!validation) {
      return reply.status(404).send({ error: 'Validation not found' });
    }

    return validation;
  });
}
