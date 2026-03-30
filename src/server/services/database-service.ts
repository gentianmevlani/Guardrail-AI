/**
 * Database Service
 *
 * Handles database operations for projects, usage tracking, and analytics.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreateProjectInput {
  userId: string;
  name: string;
  description?: string;
  path?: string;
  repositoryUrl?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  path?: string;
  repositoryUrl?: string;
}

export interface TrackUsageInput {
  userId: string;
  type: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalValidations: number;
  totalApiCalls: number;
  totalEmbeddings: number;
  projectCount: number;
  lastActivity: Date | null;
}

class DatabaseService {
  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput) {
    return prisma.project.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        path: input.path,
        repositoryUrl: input.repositoryUrl,
      },
    });
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Get a specific project
   */
  async getProject(projectId: string, userId: string) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });
  }

  /**
   * Update a project (atomic operation)
   */
  async updateProject(
    projectId: string,
    userId: string,
    input: UpdateProjectInput,
  ) {
    // Use updateMany with where clause for atomic ownership verification
    const result = await prisma.project.updateMany({
      where: { id: projectId, userId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.path !== undefined && { path: input.path }),
        ...(input.repositoryUrl !== undefined && {
          repositoryUrl: input.repositoryUrl,
        }),
      },
    });

    if (result.count === 0) {
      return null;
    }

    // Return the updated project
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  }

  /**
   * Delete a project (atomic operation)
   */
  async deleteProject(projectId: string, userId: string) {
    // Use deleteMany with where clause for atomic ownership verification
    const result = await prisma.project.deleteMany({
      where: { id: projectId, userId },
    });

    if (result.count === 0) {
      throw new Error("Project not found");
    }

    return { deleted: true, id: projectId };
  }

  /**
   * Update project metrics
   */
  async updateProjectMetrics(
    projectId: string,
    metrics: { fileCount?: number; lineCount?: number; sizeBytes?: bigint },
  ) {
    return prisma.project.update({
      where: { id: projectId },
      data: metrics,
    });
  }

  /**
   * Track usage
   */
  async trackUsage(input: TrackUsageInput) {
    return prisma.usageRecord.create({
      data: {
        userId: input.userId,
        type: input.type,
        projectId: input.projectId,
        metadata: input.metadata as Record<string, unknown> | undefined,
      },
    });
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const [validations, apiCalls, embeddings, projectCount, lastUsage] =
      await Promise.all([
        prisma.usageRecord.count({
          where: { userId, type: "validation" },
        }),
        prisma.usageRecord.count({
          where: { userId, type: "api_call" },
        }),
        prisma.usageRecord.count({
          where: { userId, type: "embedding" },
        }),
        prisma.project.count({
          where: { userId },
        }),
        prisma.usageRecord.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    return {
      totalValidations: validations,
      totalApiCalls: apiCalls,
      totalEmbeddings: embeddings,
      projectCount,
      lastActivity: lastUsage?.createdAt || null,
    };
  }

  /**
   * Get usage records for a user (with pagination)
   */
  async getUsageRecords(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const { limit = 50, offset = 0 } = options;

    return prisma.usageRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get user subscription
   */
  async getUserSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create or update subscription (transactional with retry)
   * Uses Prisma transaction with serializable isolation for race condition protection
   */
  async upsertSubscription(
    userId: string,
    data: {
      stripeSubscriptionId?: string;
      stripeCustomerId: string;
      tier: string;
      status: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
    },
  ) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Use interactive transaction for atomic upsert
        return await prisma.$transaction(
          async (tx) => {
            // If we have stripeSubscriptionId, use it for upsert (it's unique)
            if (data.stripeSubscriptionId) {
              return await tx.subscription.upsert({
                where: {
                  stripeSubscriptionId: data.stripeSubscriptionId,
                },
                create: {
                  userId,
                  ...data,
                },
                update: {
                  ...data,
                  updatedAt: new Date(),
                },
              });
            }

            // Otherwise, find existing by userId and update/create
            const existing = await tx.subscription.findFirst({
              where: { userId },
              orderBy: { createdAt: "desc" },
            });

            if (existing) {
              return await tx.subscription.update({
                where: { id: existing.id },
                data: {
                  ...data,
                  updatedAt: new Date(),
                },
              });
            }

            return await tx.subscription.create({
              data: {
                userId,
                ...data,
              },
            });
          },
          {
            isolationLevel: "Serializable",
            timeout: 10000,
          },
        );
      } catch (error: any) {
        attempt++;

        // Check if it's a retryable error
        const isRetryable =
          error.code === "P2002" || // Unique constraint
          error.code === "P2034" || // Transaction conflict
          error.code === "P2028" || // Transaction timeout
          error.message?.includes("deadlock") ||
          error.message?.includes("could not serialize");

        if (!isRetryable || attempt >= maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.pow(2, attempt) * 100 + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Failed to upsert subscription after max retries");
  }

  /**
   * Track analytics event
   */
  async trackAnalytics(
    event: string,
    properties?: Record<string, unknown>,
    userId?: string,
    projectId?: string,
  ) {
    return prisma.analytics.create({
      data: {
        event,
        properties: properties as Record<string, unknown> | undefined,
        userId,
        projectId,
      },
    });
  }

  /**
   * Get API keys for a user
   */
  async getUserApiKeys(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Create API key
   */
  async createApiKey(
    userId: string,
    name: string,
    key: string,
    expiresAt?: Date,
  ) {
    return prisma.apiKey.create({
      data: {
        userId,
        name,
        key,
        expiresAt,
      },
    });
  }

  /**
   * Verify API key
   */
  async verifyApiKey(key: string) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: { user: true },
    });

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey;
  }

  /**
   * Delete API key (atomic operation)
   */
  async deleteApiKey(keyId: string, userId: string) {
    // Use deleteMany with where clause for atomic ownership verification
    const result = await prisma.apiKey.deleteMany({
      where: { id: keyId, userId },
    });

    if (result.count === 0) {
      throw new Error("API key not found");
    }

    return { deleted: true, id: keyId };
  }

  /**
   * Health check - verify database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export const databaseService = new DatabaseService();
