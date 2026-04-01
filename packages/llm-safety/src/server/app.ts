import Fastify from 'fastify';
import type { Guardrail } from '../sdk/guardrail.js';
import { createLogger } from '../utils/logger.js';
import { registerRoutes } from './routes/index.js';

export async function createServer(g: Guardrail, host = '0.0.0.0', port = 8787) {
  const log = createLogger('llm-guardrail-server');
  const app = Fastify({ logger: log });

  await registerRoutes(app, g);

  return { app, host, port };
}

export async function listenServer(g: Guardrail, host = '0.0.0.0', port = 8787) {
  const { app } = await createServer(g, host, port);
  await app.listen({ host, port });
  return app;
}
