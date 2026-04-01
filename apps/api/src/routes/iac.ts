import { FastifyInstance, FastifyRequest } from 'fastify';
import { iacSecurityScanner, driftDetector, ALL_RULES } from '@guardrail/compliance';
import { z } from 'zod';

const ScanSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
});

const DriftSchema = z.object({
  projectPath: z.string(),
});

export async function iacRoutes(fastify: FastifyInstance) {
  // POST /api/iac/scan - Scan IaC files
  fastify.post('/scan', async (request: FastifyRequest) => {
    const body = ScanSchema.parse(request.body);

    const analysis = await iacSecurityScanner.scan(body.projectPath, body.projectId);

    return analysis;
  });

  // GET /api/iac/project/:projectId - Get IaC scan results
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const scans = await (await import('@guardrail/database')).prisma.iaCScan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      scans,
      count: scans.length,
    };
  });

  // POST /api/iac/drift - Detect drift
  fastify.post('/drift', async (request: FastifyRequest) => {
    const body = DriftSchema.parse(request.body);

    const driftReport = await driftDetector.detectDrift(body.projectPath);

    return driftReport;
  });

  // GET /api/iac/rules - Get available rules
  fastify.get('/rules', async (_request: FastifyRequest) => {
    const rulesByProvider: Record<string, unknown[]> = {};

    for (const rule of ALL_RULES) {
      if (!rule.provider) continue;
      if (!rulesByProvider[rule.provider]) {
        rulesByProvider[rule.provider] = [];
      }
      rulesByProvider[rule.provider]!.push({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        category: rule.category,
        resourceType: rule.resourceType,
      });
    }

    return {
      total: ALL_RULES.length,
      byProvider: rulesByProvider,
    };
  });
}
