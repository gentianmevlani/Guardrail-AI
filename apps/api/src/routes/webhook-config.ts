// @ts-nocheck — Webhook config merges service maps with ad-hoc JSON.
/**
 * Webhook Configuration API Routes
 * 
 * Real endpoints for managing webhook subscriptions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/fastify-auth";
import { logger } from "../logger";
import { WebhookIntegrationService } from "../services/webhook-integration-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface CreateWebhookRequest {
  url: string;
  secret?: string;
  events: string[];
  description?: string;
  active?: boolean;
}

interface UpdateWebhookRequest {
  id: string;
  url?: string;
  secret?: string;
  events?: string[];
  description?: string;
  active?: boolean;
}

interface TestWebhookRequest {
  url: string;
  secret?: string;
  payload?: unknown;
}

export async function webhookConfigRoutes(fastify: FastifyInstance) {
  const webhookService = new WebhookIntegrationService();

  // List webhooks
  fastify.get(
    "/subscriptions",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const subscriptions = await webhookService.listSubscriptions(userId);

        return reply.send({
          success: true,
          webhooks: subscriptions,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to list webhooks");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to list webhooks",
        });
      }
    }
  );

  // Create webhook
  fastify.post(
    "/subscriptions",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Body: CreateWebhookRequest }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { url, secret, events, description, active = true } = request.body;

        if (!url || !events || events.length === 0) {
          return reply.status(400).send({
            success: false,
            error: "URL and events are required",
          });
        }

        const subscription = await webhookService.createSubscription({
          userId,
          url,
          secret,
          events,
          description,
          active,
        });

        return reply.send({
          success: true,
          webhook: subscription,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to create webhook");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to create webhook",
        });
      }
    }
  );

  // Update webhook
  fastify.put(
    "/subscriptions/:id",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateWebhookRequest }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params;
        const updates = request.body;

        const subscription = await webhookService.updateSubscription(id, userId, updates);

        return reply.send({
          success: true,
          webhook: subscription,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to update webhook");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to update webhook",
        });
      }
    }
  );

  // Delete webhook
  fastify.delete(
    "/subscriptions/:id",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params;

        await webhookService.deleteSubscription(id, userId);

        return reply.send({
          success: true,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to delete webhook");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to delete webhook",
        });
      }
    }
  );

  // Test webhook
  fastify.post(
    "/test",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Body: TestWebhookRequest }>, reply: FastifyReply) => {
      try {
        const { url, secret, payload } = request.body;

        if (!url) {
          return reply.status(400).send({
            success: false,
            error: "URL is required",
          });
        }

        const testPayload = payload || {
          event: "test",
          data: { message: "Test webhook from guardrail" },
          timestamp: new Date().toISOString(),
        };

        // Send test webhook
        const result = await webhookService.sendTestWebhook(url, testPayload, secret);

        return reply.send({
          success: result.success,
          message: result.success
            ? "Webhook test successful"
            : result.error || "Webhook test failed",
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Webhook test failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Webhook test failed",
        });
      }
    }
  );

  // Bulk update webhooks
  fastify.put(
    "/subscriptions",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Body: { webhooks: unknown[] } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { webhooks } = request.body;

        // Update or create each webhook
        const results = [];
        for (const webhook of webhooks) {
          if (webhook.id) {
            // Update existing
            const updated = await webhookService.updateSubscription(
              webhook.id,
              userId,
              webhook
            );
            results.push(updated);
          } else {
            // Create new
            const created = await webhookService.createSubscription({
              userId,
              url: webhook.url,
              secret: webhook.secret,
              events: webhook.events,
              description: webhook.description,
              active: webhook.active !== false,
            });
            results.push(created);
          }
        }

        return reply.send({
          success: true,
          webhooks: results,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Failed to bulk update webhooks");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to update webhooks",
        });
      }
    }
  );
}
