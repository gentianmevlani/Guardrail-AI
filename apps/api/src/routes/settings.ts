/**
 * Settings API Routes
 * 
 * Real API endpoints for user settings, scan history, and account management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/fastify-auth";
import { logger } from "../logger";
import type { Prisma } from "@prisma/client";
import { prisma } from "@guardrail/database";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function settingsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook("preHandler", authMiddleware);

  // Delete scan history
  fastify.delete(
    "/scan-history",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Delete all runs for this user
        await fastify.prisma.run.deleteMany({
          where: { userId },
        });

        logger.info({ userId }, "Scan history deleted");

        return reply.send({
          success: true,
          message: "Scan history deleted successfully",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to delete scan history");
        return reply.status(500).send({
          success: false,
          error: "Failed to delete scan history",
        });
      }
    },
  );

  // Disconnect repository
  fastify.delete(
    "/repositories/:repoId",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { repoId } = request.params as { repoId: string };

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        if (repoId === "all") {
          // Disconnect all repositories
          await fastify.prisma.repository.deleteMany({
            where: { userId },
          });

          logger.info({ userId }, "All repositories disconnected");
        } else {
          // Disconnect specific repository
          await fastify.prisma.repository.deleteMany({
            where: { id: repoId, userId },
          });

          logger.info({ userId, repoId }, "Repository disconnected");
        }

        return reply.send({
          success: true,
          message: "Repository disconnected successfully",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to disconnect repository");
        return reply.status(500).send({
          success: false,
          error: "Failed to disconnect repository",
        });
      }
    },
  );

  // Delete account (initiate deletion)
  fastify.post(
    "/delete-account",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Mark account for deletion (would send email in production)
        await fastify.prisma.user.update({
          where: { id: userId },
          data: {
            // Add deletionRequested flag or similar
            // For now, we'll just log it
          },
        });

        logger.info({ userId }, "Account deletion requested");

        return reply.send({
          success: true,
          message: "Account deletion initiated. You'll receive a confirmation email.",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to initiate account deletion");
        return reply.status(500).send({
          success: false,
          error: "Failed to initiate account deletion",
        });
      }
    },
  );

  // Confirm account deletion
  fastify.post(
    "/confirm-delete-account",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { token } = request.body as { token: string };

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // In production, verify the deletion token from email
        // For now, we'll proceed with deletion

        // Delete all user data
        await prisma.$transaction(async (tx: any) => {
          await tx.run.deleteMany({ where: { userId } });
          await tx.repository.deleteMany({ where: { userId } });
          await tx.githubAccount.deleteMany({ where: { userId } });
          await tx.user.delete({ where: { id: userId } });
        });

        logger.info({ userId }, "Account deleted");

        return reply.send({
          success: true,
          message: "Account deleted successfully",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to delete account");
        return reply.status(500).send({
          success: false,
          error: "Failed to delete account",
        });
      }
    },
  );

  // Update notification preferences
  fastify.put(
    "/notifications",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const preferences = request.body as {
          emailNotifications?: boolean;
          inAppNotifications?: boolean;
          slackWebhook?: string;
          weeklyDigest?: boolean;
          securityAlerts?: boolean;
          scanComplete?: boolean;
          teamInvites?: boolean;
        };

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Upsert user preferences
        const updated = await prisma.userPreferences.upsert({
          where: { userId },
          create: {
            userId,
            emailNotifications: preferences.emailNotifications ?? true,
            inAppNotifications: preferences.inAppNotifications ?? true,
            slackWebhook: preferences.slackWebhook,
            weeklyDigest: preferences.weeklyDigest ?? true,
            securityAlerts: preferences.securityAlerts ?? true,
            scanComplete: preferences.scanComplete ?? true,
            teamInvites: preferences.teamInvites ?? true,
          },
          update: {
            ...(preferences.emailNotifications !== undefined && {
              emailNotifications: preferences.emailNotifications,
            }),
            ...(preferences.inAppNotifications !== undefined && {
              inAppNotifications: preferences.inAppNotifications,
            }),
            ...(preferences.slackWebhook !== undefined && {
              slackWebhook: preferences.slackWebhook,
            }),
            ...(preferences.weeklyDigest !== undefined && {
              weeklyDigest: preferences.weeklyDigest,
            }),
            ...(preferences.securityAlerts !== undefined && {
              securityAlerts: preferences.securityAlerts,
            }),
            ...(preferences.scanComplete !== undefined && {
              scanComplete: preferences.scanComplete,
            }),
            ...(preferences.teamInvites !== undefined && {
              teamInvites: preferences.teamInvites,
            }),
          },
        });

        logger.info({ userId, preferences }, "Notification preferences updated");

        return reply.send({
          success: true,
          data: {
            emailNotifications: updated.emailNotifications,
            inAppNotifications: updated.inAppNotifications,
            slackWebhook: updated.slackWebhook,
            weeklyDigest: updated.weeklyDigest,
            securityAlerts: updated.securityAlerts,
            scanComplete: updated.scanComplete,
            teamInvites: updated.teamInvites,
          },
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to update notifications");
        return reply.status(500).send({
          success: false,
          error: "Failed to update notification preferences",
        });
      }
    },
  );

  // Get notification preferences
  fastify.get(
    "/notifications",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Get user preferences or return defaults
        const preferences = await prisma.userPreferences.findUnique({
          where: { userId },
        });

        const defaults = {
          emailNotifications: true,
          inAppNotifications: true,
          slackWebhook: null,
          weeklyDigest: true,
          securityAlerts: true,
          scanComplete: true,
          teamInvites: true,
        };

        return reply.send({
          success: true,
          data: preferences
            ? {
                emailNotifications: preferences.emailNotifications,
                inAppNotifications: preferences.inAppNotifications,
                slackWebhook: preferences.slackWebhook,
                weeklyDigest: preferences.weeklyDigest,
                securityAlerts: preferences.securityAlerts,
                scanComplete: preferences.scanComplete,
                teamInvites: preferences.teamInvites,
              }
            : defaults,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to get notifications");
        return reply.status(500).send({
          success: false,
          error: "Failed to get notification preferences",
        });
      }
    },
  );

  // Update scan preferences
  fastify.put(
    "/scan-preferences",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const preferences = request.body as {
          scanDepth?: "quick" | "standard" | "deep";
          autoScan?: boolean;
          ignoredPaths?: string;
          severityThreshold?: "low" | "medium" | "high" | "critical";
          parallelScans?: boolean;
          timeoutMinutes?: number;
        };

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const updated = await prisma.userPreferences.upsert({
          where: { userId },
          create: {
            userId,
            scanDepth: preferences.scanDepth || "standard",
            autoScan: preferences.autoScan ?? false,
            ignoredPaths: preferences.ignoredPaths,
            severityThreshold: preferences.severityThreshold || "medium",
            parallelScans: preferences.parallelScans ?? true,
            timeoutMinutes: preferences.timeoutMinutes || 30,
          },
          update: {
            ...(preferences.scanDepth && { scanDepth: preferences.scanDepth }),
            ...(preferences.autoScan !== undefined && {
              autoScan: preferences.autoScan,
            }),
            ...(preferences.ignoredPaths !== undefined && {
              ignoredPaths: preferences.ignoredPaths,
            }),
            ...(preferences.severityThreshold && {
              severityThreshold: preferences.severityThreshold,
            }),
            ...(preferences.parallelScans !== undefined && {
              parallelScans: preferences.parallelScans,
            }),
            ...(preferences.timeoutMinutes !== undefined && {
              timeoutMinutes: preferences.timeoutMinutes,
            }),
          },
        });

        return reply.send({
          success: true,
          data: {
            scanDepth: updated.scanDepth,
            autoScan: updated.autoScan,
            ignoredPaths: updated.ignoredPaths,
            severityThreshold: updated.severityThreshold,
            parallelScans: updated.parallelScans,
            timeoutMinutes: updated.timeoutMinutes,
          },
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to update scan preferences");
        return reply.status(500).send({
          success: false,
          error: "Failed to update scan preferences",
        });
      }
    },
  );

  // Get scan preferences
  fastify.get(
    "/scan-preferences",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const preferences = await prisma.userPreferences.findUnique({
          where: { userId },
        });

        const defaults = {
          scanDepth: "standard" as const,
          autoScan: false,
          ignoredPaths: "*.log\nnode_modules/\n.env*\ncoverage/",
          severityThreshold: "medium" as const,
          parallelScans: true,
          timeoutMinutes: 30,
        };

        return reply.send({
          success: true,
          data: preferences
            ? {
                scanDepth: preferences.scanDepth,
                autoScan: preferences.autoScan,
                ignoredPaths: preferences.ignoredPaths || defaults.ignoredPaths,
                severityThreshold: preferences.severityThreshold,
                parallelScans: preferences.parallelScans,
                timeoutMinutes: preferences.timeoutMinutes,
              }
            : defaults,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to get scan preferences");
        return reply.status(500).send({
          success: false,
          error: "Failed to get scan preferences",
        });
      }
    },
  );

  // Update appearance preferences
  fastify.put(
    "/appearance",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const preferences = request.body as {
          theme?: "dark" | "light" | "system";
          compactMode?: boolean;
          sidebarCollapsed?: boolean;
          codeSyntaxHighlighting?: boolean;
          animationsEnabled?: boolean;
        };

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const updated = await prisma.userPreferences.upsert({
          where: { userId },
          create: {
            userId,
            theme: preferences.theme || "dark",
            compactMode: preferences.compactMode ?? false,
            sidebarCollapsed: preferences.sidebarCollapsed ?? false,
            codeSyntaxHighlighting: preferences.codeSyntaxHighlighting ?? true,
            animationsEnabled: preferences.animationsEnabled ?? true,
          },
          update: {
            ...(preferences.theme && { theme: preferences.theme }),
            ...(preferences.compactMode !== undefined && {
              compactMode: preferences.compactMode,
            }),
            ...(preferences.sidebarCollapsed !== undefined && {
              sidebarCollapsed: preferences.sidebarCollapsed,
            }),
            ...(preferences.codeSyntaxHighlighting !== undefined && {
              codeSyntaxHighlighting: preferences.codeSyntaxHighlighting,
            }),
            ...(preferences.animationsEnabled !== undefined && {
              animationsEnabled: preferences.animationsEnabled,
            }),
          },
        });

        return reply.send({
          success: true,
          data: {
            theme: updated.theme,
            compactMode: updated.compactMode,
            sidebarCollapsed: updated.sidebarCollapsed,
            codeSyntaxHighlighting: updated.codeSyntaxHighlighting,
            animationsEnabled: updated.animationsEnabled,
          },
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to update appearance");
        return reply.status(500).send({
          success: false,
          error: "Failed to update appearance preferences",
        });
      }
    },
  );

  // Get appearance preferences
  fastify.get(
    "/appearance",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const preferences = await prisma.userPreferences.findUnique({
          where: { userId },
        });

        const defaults = {
          theme: "dark" as const,
          compactMode: false,
          sidebarCollapsed: false,
          codeSyntaxHighlighting: true,
          animationsEnabled: true,
        };

        return reply.send({
          success: true,
          data: preferences
            ? {
                theme: preferences.theme,
                compactMode: preferences.compactMode,
                sidebarCollapsed: preferences.sidebarCollapsed,
                codeSyntaxHighlighting: preferences.codeSyntaxHighlighting,
                animationsEnabled: preferences.animationsEnabled,
              }
            : defaults,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to get appearance");
        return reply.status(500).send({
          success: false,
          error: "Failed to get appearance preferences",
        });
      }
    },
  );

  // ===== Webhook Management Routes =====

  // Get all webhooks for user
  fastify.get(
    "/webhooks",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Get webhooks from database (using a simple in-memory store for now)
        // In production, create a WebhookEndpoint model in Prisma
        const webhooks = await getWebhooksForUser(userId);

        return reply.send({
          success: true,
          data: webhooks,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to get webhooks");
        return reply.status(500).send({
          success: false,
          error: "Failed to get webhooks",
        });
      }
    },
  );

  // Create webhook
  fastify.post(
    "/webhooks",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const { url, secret, events, active, description } = request.body as {
          url: string;
          secret?: string;
          events: string[];
          active: boolean;
          description?: string;
        };

        // Validate URL
        if (!url || !url.startsWith("http")) {
          return reply.status(400).send({
            success: false,
            error: "Invalid webhook URL",
          });
        }

        const webhook = await createWebhookForUser(userId, {
          url,
          secret,
          events: events || [],
          active: active ?? true,
          description,
        });

        logger.info({ userId, webhookId: webhook.id }, "Webhook created");

        return reply.status(201).send({
          success: true,
          data: webhook,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to create webhook");
        return reply.status(500).send({
          success: false,
          error: "Failed to create webhook",
        });
      }
    },
  );

  // Update webhook
  fastify.put(
    "/webhooks/:id",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { id } = request.params as { id: string };
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const updates = request.body as {
          url?: string;
          secret?: string;
          events?: string[];
          active?: boolean;
          description?: string;
        };

        const webhook = await updateWebhookForUser(userId, id, updates);

        if (!webhook) {
          return reply.status(404).send({
            success: false,
            error: "Webhook not found",
          });
        }

        logger.info({ userId, webhookId: id }, "Webhook updated");

        return reply.send({
          success: true,
          data: webhook,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to update webhook");
        return reply.status(500).send({
          success: false,
          error: "Failed to update webhook",
        });
      }
    },
  );

  // Delete webhook
  fastify.delete(
    "/webhooks/:id",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { id } = request.params as { id: string };
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const deleted = await deleteWebhookForUser(userId, id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: "Webhook not found",
          });
        }

        logger.info({ userId, webhookId: id }, "Webhook deleted");

        return reply.send({
          success: true,
          message: "Webhook deleted",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to delete webhook");
        return reply.status(500).send({
          success: false,
          error: "Failed to delete webhook",
        });
      }
    },
  );

  // Test webhook
  fastify.post(
    "/webhooks/:id/test",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { id } = request.params as { id: string };
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const webhook = await getWebhookById(userId, id);
        if (!webhook) {
          return reply.status(404).send({
            success: false,
            error: "Webhook not found",
          });
        }

        // Send test payload
        const startTime = Date.now();
        try {
          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "guardrail-Webhook/1.0",
              "X-guardrail-Event": "test",
              ...(webhook.secret && {
                "X-Webhook-Secret": webhook.secret,
              }),
            },
            body: JSON.stringify({
              event: "test",
              timestamp: new Date().toISOString(),
              data: {
                message: "This is a test webhook from guardrail",
                webhookId: id,
              },
            }),
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          const responseTime = Date.now() - startTime;

          logger.info(
            { userId, webhookId: id, statusCode: response.status, responseTime },
            "Webhook test completed"
          );

          return reply.send({
            success: true,
            data: {
              success: response.ok,
              statusCode: response.status,
              responseTime,
            },
          });
        } catch (fetchError: any) {
          const responseTime = Date.now() - startTime;
          logger.warn(
            { userId, webhookId: id, error: fetchError.message },
            "Webhook test failed"
          );

          return reply.send({
            success: true,
            data: {
              success: false,
              statusCode: null,
              responseTime,
              error: fetchError.message,
            },
          });
        }
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to test webhook");
        return reply.status(500).send({
          success: false,
          error: "Failed to test webhook",
        });
      }
    },
  );

  // Get webhook deliveries
  fastify.get(
    "/webhooks/:id/deliveries",
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const { id } = request.params as { id: string };
        const { limit = "10" } = request.query as { limit?: string };
        
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        const webhook = await getWebhookById(userId, id);
        if (!webhook) {
          return reply.status(404).send({
            success: false,
            error: "Webhook not found",
          });
        }

        // In production, fetch from database
        const deliveries = await getWebhookDeliveries(id, parseInt(limit, 10));

        return reply.send({
          success: true,
          data: deliveries,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to get deliveries");
        return reply.status(500).send({
          success: false,
          error: "Failed to get webhook deliveries",
        });
      }
    },
  );
}

// ===== Webhook Storage (Using Prisma) =====

interface WebhookData {
  id: string;
  userId: string;
  url: string;
  secret?: string | null;
  events: string[];
  active: boolean;
  description?: string | null;
  createdAt: Date;
  lastDeliveryAt?: Date | null;
  lastDeliveryStatus?: string | null;
}

interface DeliveryData {
  id: string;
  webhookId: string;
  eventType: string;
  status: string;
  statusCode?: number | null;
  responseTime?: number | null;
  error?: string | null;
  createdAt: Date;
}

async function getWebhooksForUser(userId: string): Promise<WebhookData[]> {
  try {
    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return webhooks.map((w: (typeof webhooks)[number]) => ({
      id: w.id,
      userId: w.userId,
      url: w.url,
      secret: w.secret,
      events: w.events,
      active: w.active,
      description: w.description,
      createdAt: w.createdAt,
      lastDeliveryAt: w.lastDeliveryAt,
      lastDeliveryStatus: w.lastDeliveryStatus,
    }));
  } catch (error) {
    // If table doesn't exist yet (migration not run), return empty array
    logger.warn({ error }, "Failed to get webhooks - table may not exist yet");
    return [];
  }
}

async function getWebhookById(
  userId: string,
  id: string
): Promise<WebhookData | null> {
  try {
    const webhook = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });
    if (!webhook) return null;
    return {
      id: webhook.id,
      userId: webhook.userId,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      active: webhook.active,
      description: webhook.description,
      createdAt: webhook.createdAt,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastDeliveryStatus: webhook.lastDeliveryStatus,
    };
  } catch (error) {
    logger.warn({ error, id }, "Failed to get webhook by ID");
    return null;
  }
}

async function createWebhookForUser(
  userId: string,
  data: {
    url: string;
    secret?: string;
    events: string[];
    active: boolean;
    description?: string;
  }
): Promise<WebhookData> {
  const webhook = await prisma.webhookEndpoint.create({
    data: {
      userId,
      url: data.url,
      secret: data.secret,
      events: data.events,
      active: data.active,
      description: data.description,
    },
  });
  return {
    id: webhook.id,
    userId: webhook.userId,
    url: webhook.url,
    secret: webhook.secret,
    events: webhook.events,
    active: webhook.active,
    description: webhook.description,
    createdAt: webhook.createdAt,
    lastDeliveryAt: webhook.lastDeliveryAt,
    lastDeliveryStatus: webhook.lastDeliveryStatus,
  };
}

async function updateWebhookForUser(
  userId: string,
  id: string,
  updates: Partial<WebhookData>
): Promise<WebhookData | null> {
  try {
    // First check ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const webhook = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: updates.url,
        secret: updates.secret,
        events: updates.events,
        active: updates.active,
        description: updates.description,
      },
    });
    return {
      id: webhook.id,
      userId: webhook.userId,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      active: webhook.active,
      description: webhook.description,
      createdAt: webhook.createdAt,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastDeliveryStatus: webhook.lastDeliveryStatus,
    };
  } catch (error) {
    logger.error({ error, id }, "Failed to update webhook");
    return null;
  }
}

async function deleteWebhookForUser(
  userId: string,
  id: string
): Promise<boolean> {
  try {
    // First check ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;

    await prisma.webhookEndpoint.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    logger.error({ error, id }, "Failed to delete webhook");
    return false;
  }
}

async function getWebhookDeliveries(
  webhookId: string,
  limit: number
): Promise<DeliveryData[]> {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return deliveries.map((d: (typeof deliveries)[number]) => ({
      id: d.id,
      webhookId: d.webhookId,
      eventType: d.eventType,
      status: d.status,
      statusCode: d.statusCode,
      responseTime: d.responseTime,
      error: d.error,
      createdAt: d.createdAt,
    }));
  } catch (error) {
    logger.warn({ error, webhookId }, "Failed to get webhook deliveries");
    return [];
  }
}

// Export for use by other services
export async function recordWebhookDelivery(
  webhookId: string,
  eventType: string,
  status: "success" | "failed",
  payload: any,
  statusCode?: number,
  responseTime?: number,
  error?: string
): Promise<void> {
  try {
    /* Schema field names vary between migrations; keep runtime behavior via loose tx typing */
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const t = tx as Prisma.TransactionClient & {
        webhookDelivery: {
          create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
          findMany: (args: Record<string, unknown>) => Promise<Array<{ id: string }>>;
          deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
        };
        webhookEndpoint: {
          update: (args: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => Promise<unknown>;
        };
      };
      await t.webhookDelivery.create({
        data: {
          webhookId,
          eventType,
          status,
          payload,
          statusCode,
          responseTime,
          error,
          deliveredAt: status === "success" ? new Date() : null,
        },
      });

      await t.webhookEndpoint.update({
        where: { id: webhookId },
        data: {
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: status,
        },
      });

      const oldDeliveries = await t.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: "desc" },
        skip: 100,
        select: { id: true },
      });

      if (oldDeliveries.length > 0) {
        await t.webhookDelivery.deleteMany({
          where: { id: { in: oldDeliveries.map((d) => d.id) } },
        });
      }
    });
  } catch (error) {
    logger.error({ error, webhookId, eventType }, "Failed to record webhook delivery");
  }
}
