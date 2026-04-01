import type { FastifyInstance } from 'fastify';
import type { Guardrail } from '../../sdk/guardrail.js';
import type { GuardrailCategory } from '../../core/types.js';

const categories: GuardrailCategory[] = ['input', 'output', 'behavioral', 'process'];

export async function analyzeRoutes(app: FastifyInstance, g: Guardrail): Promise<void> {
  app.post<{
    Body: {
      category: GuardrailCategory;
      context: Record<string, unknown>;
    };
  }>('/analyze', async (request, reply) => {
    const body = request.body;
    if (!body?.category || !categories.includes(body.category)) {
      return reply.code(400).send({ error: 'Invalid or missing category' });
    }
    const ctx = body.context ?? {};

    switch (body.category) {
      case 'input':
        if (typeof ctx['input'] !== 'string') {
          return reply.code(400).send({ error: 'context.input (string) required for input category' });
        }
        return g.checkInput(ctx as Parameters<Guardrail['checkInput']>[0]);
      case 'output':
        if (typeof ctx['output'] !== 'string') {
          return reply.code(400).send({ error: 'context.output (string) required for output category' });
        }
        return g.checkOutput(ctx as Parameters<Guardrail['checkOutput']>[0]);
      case 'behavioral':
        return g.checkBehavior(ctx as Parameters<Guardrail['checkBehavior']>[0]);
      case 'process':
        return g.checkProcess(ctx as Parameters<Guardrail['checkProcess']>[0]);
      default:
        return reply.code(400).send({ error: 'Unsupported category' });
    }
  });
}
