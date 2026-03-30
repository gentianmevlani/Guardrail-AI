import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { piiDetector, dataFlowTracker } from '@guardrail/compliance';
import { z } from 'zod';

const DetectSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
});

export async function piiRoutes(fastify: FastifyInstance) {
  // POST /api/pii/detect - Detect PII in project
  fastify.post('/detect', async (request: FastifyRequest) => {
    const body = DetectSchema.parse(request.body);

    const result = await piiDetector.detectPII(body.projectPath, body.projectId);

    return result;
  });

  // GET /api/pii/project/:projectId - Get PII report
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const detections = await (await import('@guardrail/database')).prisma.pIIDetection.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      detections,
      count: detections.length,
    };
  });

  // GET /api/pii/data-flow/:projectId - Get data flow diagram
  fastify.get('/data-flow/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = request.params;

    // Get latest PII detection
    const detection = await (await import('@guardrail/database')).prisma.pIIDetection.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!detection) {
      return reply.status(404).send({
        error: 'No PII detection found for project',
      });
    }

    const dataFlows = (detection.findings as any)?.dataFlows || null;

    // Generate Mermaid diagram
    const diagram = dataFlowTracker.generateDiagram(dataFlows);

    return {
      projectId,
      diagram,
      dataFlows,
    };
  });
}
