import { FastifyInstance, FastifyRequest } from 'fastify';
import { supplyChainDetector } from 'guardrail-security';
import { z } from 'zod';

const AnalyzePackageSchema = z.object({
  packageName: z.string(),
  version: z.string(),
  projectId: z.string(),
});

const TyposquatSchema = z.object({
  packageName: z.string(),
});

const SBOMSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
});

export async function supplyChainRoutes(fastify: FastifyInstance) {
  // POST /api/supply-chain/analyze - Analyze package
  fastify.post('/analyze', async (request: FastifyRequest) => {
    const body = AnalyzePackageSchema.parse(request.body);

    const analysis = await supplyChainDetector.analyzePackage(
      body.packageName,
      body.version,
      body.projectId
    );

    return analysis;
  });

  // POST /api/supply-chain/typosquat - Check for typosquatting
  fastify.post('/typosquat', async (request: FastifyRequest) => {
    const body = TyposquatSchema.parse(request.body);

    const result = await supplyChainDetector.detectTyposquatting(body.packageName);

    return result;
  });

  // POST /api/supply-chain/sbom - Generate SBOM
  fastify.post('/sbom', async (request: FastifyRequest) => {
    const body = SBOMSchema.parse(request.body);

    const sbom = await supplyChainDetector.generateSBOM(body.projectPath, body.projectId);

    return sbom;
  });

  // GET /api/supply-chain/project/:projectId - Get project analysis
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const analyses = await (await import('@guardrail/database')).prisma.dependencyAnalysis.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      analyses,
      count: analyses.length,
    };
  });
}
