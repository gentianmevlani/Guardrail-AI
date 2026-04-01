import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { attackSurfaceAnalyzer } from 'guardrail-security';
import { z } from 'zod';

const AnalyzeProjectSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
});

export async function attackSurfaceRoutes(fastify: FastifyInstance) {
  // POST /api/attack-surface/analyze - Analyze project
  fastify.post('/analyze', async (request: FastifyRequest) => {
    const body = AnalyzeProjectSchema.parse(request.body);

    const analysis = await attackSurfaceAnalyzer.analyzeProject(
      body.projectPath,
      body.projectId
    );

    return analysis;
  });

  // GET /api/attack-surface/project/:projectId - Get analysis
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = request.params;

    const analysis = await (await import('@guardrail/database')).prisma.attackSurfaceAnalysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      return reply.status(404).send({ error: 'Attack surface analysis not found' });
    }

    return analysis;
  });

  // GET /api/attack-surface/visualization/:projectId - Get Mermaid diagram
  fastify.get('/visualization/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = request.params;

    const analysis = await (await import('@guardrail/database')).prisma.attackSurfaceAnalysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      return reply.status(404).send({ error: 'Attack surface analysis not found' });
    }

    const mermaid = await attackSurfaceAnalyzer.generateVisualization(analysis as any);

    return { mermaid };
  });
}
