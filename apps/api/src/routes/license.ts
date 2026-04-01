import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { licenseComplianceEngine } from 'guardrail-security';
import { z } from 'zod';

const AnalyzeProjectSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
  projectLicense: z.string(),
});

const CompatibilitySchema = z.object({
  projectLicense: z.string(),
  dependencyLicense: z.string(),
});

export async function licenseRoutes(fastify: FastifyInstance) {
  // POST /api/license/analyze - Analyze project licenses
  fastify.post('/analyze', async (request: FastifyRequest) => {
    const body = AnalyzeProjectSchema.parse(request.body);

    const analysis = await licenseComplianceEngine.analyzeProject(
      body.projectPath,
      body.projectId,
      body.projectLicense
    );

    return analysis;
  });

  // GET /api/license/project/:projectId - Get license analysis
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = request.params;

    const analysis = await (await import('@guardrail/database')).prisma.licenseAnalysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      return reply.status(404).send({ error: 'License analysis not found' });
    }

    return analysis;
  });

  // GET /api/license/compatibility - Check license compatibility
  fastify.get('/compatibility', async (request: FastifyRequest) => {
    const body = CompatibilitySchema.parse(request.query);

    const result = licenseComplianceEngine.checkCompatibility(
      body.projectLicense,
      body.dependencyLicense
    );

    return result;
  });
}
