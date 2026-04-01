import type { FastifyInstance } from 'fastify';
import type { Guardrail } from '../../sdk/guardrail.js';
import { analyzeRoutes } from './analyze.js';
import { metaRoutes } from './meta.js';

export async function registerRoutes(app: FastifyInstance, g: Guardrail): Promise<void> {
  await metaRoutes(app, g);
  await analyzeRoutes(app, g);
}
