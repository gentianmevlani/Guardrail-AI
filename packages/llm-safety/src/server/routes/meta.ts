import type { FastifyInstance } from 'fastify';
import type { Guardrail } from '../../sdk/guardrail.js';

export async function metaRoutes(app: FastifyInstance, g: Guardrail): Promise<void> {
  app.get('/health', async () => ({ ok: true, service: '@guardrail/llm-safety' }));

  app.get('/engines', async () => {
    const manifests = g.getRegistry().listManifests();
    return {
      count: manifests.length,
      engines: manifests,
    };
  });

  app.get('/config', async () => g.config);
}
