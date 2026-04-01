/**
 * Webhook Delivery Service with Retry Logic
 * 
 * Provides reliable webhook delivery with:
 * - Automatic retries with exponential backoff
 * - Dead-letter queue for permanently failed webhooks
 * - Idempotency guarantees
 * - Delivery status tracking
 */

import { logger } from "../logger";
import { prisma } from "@guardrail/database";
import { track } from "../middleware/telemetry";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
export interface WebhookDeliveryOptions {
  url: string;
  payload: any;
  secret?: string;
  timeout?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  idempotencyKey?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  subscriptionId: string;
  eventId: string;
  attempt: number;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  retryAt?: Date;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BACKOFF_MS = 1000; // Start with 1 second
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, baseMs: number): number {
  return baseMs * Math.pow(2, attempt - 1);
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Deliver webhook with retry logic
 */
export async function deliverWebhook(
  subscriptionId: string,
  eventId: string,
  options: WebhookDeliveryOptions,
): Promise<WebhookDeliveryResult> {
  const {
    url,
    payload,
    secret,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
    idempotencyKey,
  } = options;

  // Check if we've already delivered this webhook (idempotency)
  if (idempotencyKey) {
    const existing = await prisma.webhookDelivery.findFirst({
      where: {
        subscriptionId,
        eventId,
        status: "delivered",
      },
    });
    
    if (existing) {
      logger.info({ subscriptionId, eventId }, "Webhook already delivered (idempotency)");
      return {
        success: true,
        subscriptionId,
        eventId,
        attempt: existing.attempt,
        statusCode: existing.statusCode || undefined,
        responseTime: existing.responseTime || undefined,
      };
    }
  }

  // Get or create delivery record
  let delivery = await prisma.webhookDelivery.findFirst({
    where: {
      subscriptionId,
      eventId,
    },
    orderBy: { createdAt: "desc" },
  });

  const attempt = delivery ? delivery.attempt + 1 : 1;

  // Create new delivery record if needed
  if (!delivery) {
    delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId,
        eventId,
        attempt: 1,
        status: "pending",
      },
    });
  } else {
    // Update existing delivery for retry
    delivery = await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempt,
        status: "pending",
        retryAt: null,
      },
    });
  }

  track.webhook.deliveryStarted(subscriptionId, eventId, url);

  const deliveryStartTime = Date.now();
  try {
    const startTime = deliveryStartTime;
    const payloadString = JSON.stringify(payload);
    
    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "guardrail-Webhook/1.0",
    };

    // Add signature if secret provided
    if (secret) {
      const signature = generateSignature(payloadString, secret);
      headers["X-Signature"] = `sha256=${signature}`;
    }

    // Add idempotency key
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Make HTTP request
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Read response body (limit to 64KB)
    let responseBody = "";
    try {
      const text = await response.text();
      responseBody = text.slice(0, 65536);
    } catch {
      // Ignore body read errors
    }

    const success = response.status >= 200 && response.status < 300;

    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: success ? "delivered" : "failed",
        statusCode: response.status,
        responseTime,
        responseBody: responseBody || null,
        deliveredAt: success ? new Date() : null,
        error: success ? null : `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
      },
    });

    if (success) {
      track.webhook.deliveryCompleted(subscriptionId, eventId, responseTime, response.status);
      
      // Update subscription last delivery time
      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: {
          lastDeliveryAt: new Date(),
          failureCount: 0, // Reset on success
        },
      });

      return {
        success: true,
        subscriptionId,
        eventId,
        attempt,
        statusCode: response.status,
        responseTime,
      };
    } else {
      // Check if we should retry
      if (attempt < maxRetries) {
        const backoffMs = calculateBackoff(attempt, retryBackoffMs);
        const retryAt = new Date(Date.now() + backoffMs);

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            retryAt,
          },
        });

        track.webhook.retry(subscriptionId, eventId, attempt + 1);
        
        logger.warn(
          {
            subscriptionId,
            eventId,
            attempt,
            statusCode: response.status,
            retryAt,
          },
          "Webhook delivery failed, will retry",
        );

        return {
          success: false,
          subscriptionId,
          eventId,
          attempt,
          statusCode: response.status,
          responseTime,
          error: `HTTP ${response.status}`,
          retryAt,
        };
      } else {
        // Max retries reached, move to dead-letter queue
        track.webhook.deliveryFailed(subscriptionId, eventId, `HTTP ${response.status}`, attempt);
        
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "failed",
            error: `Max retries reached. Last status: HTTP ${response.status}`,
          },
        });

        // Increment failure count on subscription
        await prisma.webhookSubscription.update({
          where: { id: subscriptionId },
          data: {
            failureCount: { increment: 1 },
          },
        });

        logger.error(
          {
            subscriptionId,
            eventId,
            attempt,
            statusCode: response.status,
          },
          "Webhook delivery failed permanently (max retries reached)",
        );

        return {
          success: false,
          subscriptionId,
          eventId,
          attempt,
          statusCode: response.status,
          responseTime,
          error: `Max retries reached. Last status: HTTP ${response.status}`,
        };
      }
    }
  } catch (error: unknown) {
    const responseTime = Date.now() - deliveryStartTime;
    const errorMessage = toErrorMessage(error) || "Unknown error";

    // Check if we should retry
    if (attempt < maxRetries) {
      const backoffMs = calculateBackoff(attempt, retryBackoffMs);
      const retryAt = new Date(Date.now() + backoffMs);

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "pending",
          error: errorMessage,
          retryAt,
        },
      });

      track.webhook.retry(subscriptionId, eventId, attempt + 1);
      
      logger.warn(
        {
          subscriptionId,
          eventId,
          attempt,
          error: errorMessage,
          retryAt,
        },
        "Webhook delivery error, will retry",
      );

      return {
        success: false,
        subscriptionId,
        eventId,
        attempt,
        responseTime,
        error: errorMessage,
        retryAt,
      };
    } else {
      // Max retries reached
      track.webhook.deliveryFailed(subscriptionId, eventId, errorMessage, attempt);
      
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          error: `Max retries reached. Last error: ${errorMessage}`,
        },
      });

      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: {
          failureCount: { increment: 1 },
        },
      });

      logger.error(
        {
          subscriptionId,
          eventId,
          attempt,
          error: errorMessage,
        },
        "Webhook delivery failed permanently (max retries reached)",
      );

      return {
        success: false,
        subscriptionId,
        eventId,
        attempt,
        responseTime,
        error: `Max retries reached. Last error: ${errorMessage}`,
      };
    }
  }
}

/**
 * Process pending webhook retries
 * Should be called by a scheduled job
 */
export async function processPendingRetries(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();
  
  // Find deliveries that need retry
  const pendingDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "pending",
      retryAt: {
        lte: now,
      },
    },
    include: {
      subscription: true,
      event: true,
    },
    take: 100, // Process in batches
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const delivery of pendingDeliveries) {
    try {
      const subscription = delivery.subscription;
      const event = delivery.event;

      if (!subscription || !event || !subscription.isActive) {
        // Skip inactive subscriptions
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "failed",
            error: "Subscription inactive or event missing",
          },
        });
        failed++;
        continue;
      }

      const result = await deliverWebhook(
        delivery.subscriptionId,
        delivery.eventId,
        {
          url: subscription.url,
          payload: event.data,
          secret: subscription.secret || undefined,
          timeout: subscription.timeout || DEFAULT_TIMEOUT,
          maxRetries: (subscription.retryConfig as any)?.maxRetries || DEFAULT_MAX_RETRIES,
          idempotencyKey: `${delivery.subscriptionId}-${delivery.eventId}`,
        },
      );

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
      processed++;
    } catch (error: unknown) {
      logger.error(
        { deliveryId: delivery.id, error: toErrorMessage(error) },
        "Error processing webhook retry",
      );
      failed++;
      processed++;
    }
  }

  logger.info(
    { processed, succeeded, failed },
    "Processed webhook retries",
  );

  return { processed, succeeded, failed };
}
