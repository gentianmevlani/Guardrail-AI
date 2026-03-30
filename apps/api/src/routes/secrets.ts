import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { secretsGuardian, preCommitHook } from 'guardrail-security';
import { z } from 'zod';

const ScanContentSchema = z.object({
  content: z.string(),
  filePath: z.string(),
  excludeTests: z.boolean().optional(),
  minConfidence: z.number().optional(),
});

const ScanProjectSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
  excludeTests: z.boolean().optional(),
});

export async function secretsRoutes(fastify: FastifyInstance) {
  // POST /api/secrets/scan - Scan content for secrets
  fastify.post('/scan', async (request: FastifyRequest) => {
    const body = ScanContentSchema.parse(request.body);

    const rawDetections = await secretsGuardian.scanContent(body.content, body.filePath, 'api-scan', {
      excludeTests: body.excludeTests,
      minConfidence: body.minConfidence,
    });
    const detections = Array.isArray(rawDetections) ? rawDetections : [];

    return {
      detections,
      count: detections.length,
    };
  });

  // POST /api/secrets/scan-project - Scan entire project
  fastify.post('/scan-project', async (request: FastifyRequest) => {
    const body = ScanProjectSchema.parse(request.body);

    const report = await secretsGuardian.scanProject(body.projectPath, body.projectId, {
      excludeTests: body.excludeTests,
    });

    return report;
  });

  // GET /api/secrets/project/:projectId - Get project secrets report
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const rawDetections = await secretsGuardian.getProjectReport(projectId);
    const detections = Array.isArray(rawDetections) ? rawDetections : [];

    return {
      projectId,
      detections,
      count: detections.length,
    };
  });

  // POST /api/secrets/pre-commit - Generate pre-commit hook
  fastify.post('/pre-commit', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const hookScript = preCommitHook.generateHookScript();

    return {
      hookScript,
      instructions: 'Save this to .git/hooks/pre-commit and chmod +x',
    };
  });
}
