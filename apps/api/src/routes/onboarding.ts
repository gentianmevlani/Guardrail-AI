import { prisma } from "@guardrail/database";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface OnboardingParams {
  userId: string;
}

interface UpdateOnboardingBody {
  completedStep?: string;
  currentStep?: number;
  githubConnected?: boolean;
  firstScanCompleted?: boolean;
  firstRepoId?: string;
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ success: false, error: "Authentication required" });
  }
}

export async function onboardingRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: OnboardingParams }>(
    "/onboarding/:userId",
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest<{ Params: OnboardingParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      try {
        const onboarding = await prisma.userOnboarding.findUnique({
          where: { userId },
        });

        if (!onboarding) {
          return reply.status(404).send({ error: "Onboarding state not found" });
        }

        return reply.send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch onboarding state" });
      }
    }
  );

  fastify.post(
    "/onboarding",
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest<{ Body: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = request.body;

      try {
        const existing = await prisma.userOnboarding.findUnique({
          where: { userId },
        });

        if (existing) {
          return reply.send(existing);
        }

        const onboarding = await prisma.userOnboarding.create({
          data: {
            userId,
            completedSteps: [],
            currentStep: 0,
            githubConnected: false,
            firstScanCompleted: false,
          },
        });

        return reply.status(201).send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to create onboarding state" });
      }
    }
  );

  fastify.patch<{ Params: OnboardingParams; Body: UpdateOnboardingBody }>(
    "/onboarding/:userId",
    {
      preHandler: [requireAuth],
    },
    async (
      request: FastifyRequest<{ Params: OnboardingParams; Body: UpdateOnboardingBody }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const { completedStep, currentStep, githubConnected, firstScanCompleted, firstRepoId } =
        request.body;

      try {
        const existing = await prisma.userOnboarding.findUnique({
          where: { userId },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Onboarding state not found" });
        }

        const updatedSteps = completedStep
          ? [...new Set([...existing.completedSteps, completedStep])]
          : existing.completedSteps;

        const onboarding = await prisma.userOnboarding.update({
          where: { userId },
          data: {
            completedSteps: updatedSteps,
            currentStep: currentStep ?? existing.currentStep,
            githubConnected: githubConnected ?? existing.githubConnected,
            firstScanCompleted: firstScanCompleted ?? existing.firstScanCompleted,
            firstRepoId: firstRepoId ?? existing.firstRepoId,
          },
        });

        return reply.send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to update onboarding state" });
      }
    }
  );

  fastify.post<{ Params: OnboardingParams }>(
    "/onboarding/:userId/skip",
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest<{ Params: OnboardingParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      try {
        const onboarding = await prisma.userOnboarding.update({
          where: { userId },
          data: {
            skippedAt: new Date(),
          },
        });

        return reply.send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to skip onboarding" });
      }
    }
  );

  fastify.post<{ Params: OnboardingParams }>(
    "/onboarding/:userId/complete",
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest<{ Params: OnboardingParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      try {
        const onboarding = await prisma.userOnboarding.update({
          where: { userId },
          data: {
            completedAt: new Date(),
            completedSteps: ["welcome", "connect-source", "first-scan", "results"],
            currentStep: 4,
          },
        });

        await prisma.analytics.create({
          data: {
            userId,
            event: "onboarding_completed",
            properties: {
              completedAt: new Date().toISOString(),
            },
          },
        });

        return reply.send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to complete onboarding" });
      }
    }
  );

  fastify.post<{ Params: OnboardingParams }>(
    "/onboarding/:userId/reset",
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest<{ Params: OnboardingParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      try {
        const onboarding = await prisma.userOnboarding.update({
          where: { userId },
          data: {
            completedSteps: [],
            currentStep: 0,
            githubConnected: false,
            firstScanCompleted: false,
            firstRepoId: null,
            skippedAt: null,
            completedAt: null,
          },
        });

        return reply.send(onboarding);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to reset onboarding" });
      }
    }
  );

  fastify.get(
    "/onboarding/analytics/completion-rate",
    {
      preHandler: [requireAuth],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const total = await prisma.userOnboarding.count();
        const completed = await prisma.userOnboarding.count({
          where: { completedAt: { not: null } },
        });
        const skipped = await prisma.userOnboarding.count({
          where: { skippedAt: { not: null } },
        });

        const completionRate = total > 0 ? (completed / total) * 100 : 0;
        const skipRate = total > 0 ? (skipped / total) * 100 : 0;

        return reply.send({
          total,
          completed,
          skipped,
          inProgress: total - completed - skipped,
          completionRate: Math.round(completionRate * 100) / 100,
          skipRate: Math.round(skipRate * 100) / 100,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch analytics" });
      }
    }
  );
}

export default onboardingRoutes;
