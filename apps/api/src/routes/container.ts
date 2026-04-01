import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { containerScanner, kubernetesScanner } from '@guardrail/compliance';
import { z } from 'zod';

const ScanImageSchema = z.object({
  imageName: z.string(),
  tag: z.string(),
  projectId: z.string(),
});

const ScanDockerfileSchema = z.object({
  dockerfilePath: z.string(),
});

const ScanK8sSchema = z.object({
  projectPath: z.string(),
  projectId: z.string(),
});

export async function containerRoutes(fastify: FastifyInstance) {
  // POST /api/container/scan - Scan container image
  fastify.post('/scan', async (request: FastifyRequest) => {
    const body = ScanImageSchema.parse(request.body);

    const result = await containerScanner.scanImage(
      body.imageName,
      body.tag,
      body.projectId
    );

    return result;
  });

  // POST /api/container/dockerfile - Scan Dockerfile
  fastify.post('/dockerfile', async (request: FastifyRequest) => {
    const body = ScanDockerfileSchema.parse(request.body);

    const findings = await containerScanner.scanDockerfile(body.dockerfilePath);

    return {
      dockerfilePath: body.dockerfilePath,
      findings,
      count: findings.length,
      summary: {
        critical: findings.filter((f: any) => f.severity === 'critical').length,
        high: findings.filter((f: any) => f.severity === 'high').length,
        medium: findings.filter((f: any) => f.severity === 'medium').length,
        low: findings.filter((f: any) => f.severity === 'low').length,
      },
    };
  });

  // GET /api/container/project/:projectId - Get container scans
  fastify.get('/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const scans = await (await import('@guardrail/database')).prisma.containerScan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      scans,
      count: scans.length,
    };
  });

  // POST /api/kubernetes/scan - Scan K8s manifests
  fastify.post('/kubernetes/scan', async (request: FastifyRequest) => {
    const body = ScanK8sSchema.parse(request.body);

    const result = await kubernetesScanner.scanManifests(body.projectPath, body.projectId);

    return result;
  });

  // GET /api/kubernetes/project/:projectId - Get K8s scan
  fastify.get('/kubernetes/project/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>
  ) => {
    const { projectId } = request.params;

    const scans = await (await import('@guardrail/database')).prisma.kubernetesScan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      scans,
      count: scans.length,
    };
  });

  // GET /api/kubernetes/rbac/:projectId - Get RBAC analysis
  fastify.get('/kubernetes/rbac/:projectId', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = request.params;

    const scan = await (await import('@guardrail/database')).prisma.kubernetesScan.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!scan) {
      return reply.status(404).send({
        error: 'No Kubernetes scan found for project',
      });
    }

    return {
      projectId,
      rbacAnalysis: (scan as any).rbacAnalysis || null,
    };
  });
}
