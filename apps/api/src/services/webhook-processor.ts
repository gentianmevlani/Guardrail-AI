/**
 * Stripe Webhook Processor with Retry Logic
 * 
 * Handles Stripe webhook events with robust retry mechanism and logging.
 * Ensures subscription updates are processed even if initial attempt fails.
 */

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import pool from "../lib/db";
import { logger } from "../logger";
import { mapStripePlanFromPriceId } from "../routes/billing";

const prisma = new PrismaClient();

interface WebhookRetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

const DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process webhook event with retry logic
 */
async function processWithRetry<T>(
  fn: () => Promise<T>,
  config: WebhookRetryConfig = DEFAULT_RETRY_CONFIG,
  context: { eventId?: string; eventType?: string } = {},
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.retryDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxRetries) {
        logger.warn(
          {
            attempt: attempt + 1,
            maxRetries: config.maxRetries,
            delay,
            eventId: context.eventId,
            eventType: context.eventType,
            error: lastError.message,
          },
          "Webhook processing failed, retrying...",
        );

        await sleep(delay);
        if (config.exponentialBackoff) {
          delay *= 2;
        }
      } else {
        logger.error(
          {
            attempts: attempt + 1,
            eventId: context.eventId,
            eventType: context.eventType,
            error: lastError.message,
            stack: lastError.stack,
          },
          "Webhook processing failed after all retries",
        );
      }
    }
  }

  throw lastError || new Error("Unknown error in retry logic");
}

/**
 * Get subscription by Stripe subscription ID
 */
async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<{ id: string; userId: string } | null> {
  const result = await pool.query<{ id: string; userId: string }>(
    'SELECT id, "userId" FROM subscriptions WHERE "stripeSubscriptionId" = $1 LIMIT 1',
    [stripeSubscriptionId],
  );
  return result.rows[0] || null;
}

/**
 * Upsert subscription (with retry)
 */
async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  plan: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}) {
  return processWithRetry(
    async () => {
      const existing = await getSubscriptionByStripeId(
        data.stripeSubscriptionId || "",
      );

      if (existing) {
        await pool.query(
          `UPDATE subscriptions SET
            "stripeCustomerId" = $1,
            "stripeSubscriptionId" = $2,
            "tier" = $3,
            "status" = $4,
            "currentPeriodStart" = $5,
            "currentPeriodEnd" = $6,
            "cancelAtPeriodEnd" = $7,
            "updatedAt" = NOW()
          WHERE "userId" = $8`,
          [
            data.stripeCustomerId,
            data.stripeSubscriptionId,
            data.plan,
            data.status,
            data.currentPeriodStart,
            data.currentPeriodEnd,
            data.cancelAtPeriodEnd || false,
            data.userId,
          ],
        );
      } else {
        await pool.query(
          `INSERT INTO subscriptions ("userId", "stripeCustomerId", "stripeSubscriptionId", "tier", "status", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            data.userId,
            data.stripeCustomerId,
            data.stripeSubscriptionId,
            data.plan,
            data.status,
            data.currentPeriodStart,
            data.currentPeriodEnd,
            data.cancelAtPeriodEnd || false,
          ],
        );
      }

      // Log billing event
      await (prisma as any).billingEvent.create({
        data: {
          userId: data.userId,
          subscriptionId: existing?.id,
          eventType: `subscription.${data.status}`,
          eventSource: "stripe",
          metadata: {
            stripeSubscriptionId: data.stripeSubscriptionId,
            tier: data.plan,
          },
        },
      });
    },
    DEFAULT_RETRY_CONFIG,
    { eventType: "subscription.upsert" },
  );
}

/**
 * Process checkout.session.completed event
 */
export async function processCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  await processWithRetry(
    async () => {
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId =
          typeof stripeSub.customer === "string"
            ? stripeSub.customer
            : stripeSub.customer?.id;

        if (customerId) {
          const customer = (await stripe.customers.retrieve(
            customerId,
          )) as Stripe.Customer;
          const userId = customer.metadata?.userId;

          if (userId) {
            const priceId = stripeSub.items.data[0]?.price?.id;
            const mappingResult = priceId
              ? mapStripePlanFromPriceId(priceId, { customerId, subscriptionId })
              : { tier: "pro" as const, billingTierUnknown: false };

            await upsertSubscription({
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: mappingResult.tier,
              status: stripeSub.status,
              currentPeriodStart: new Date(
                stripeSub.current_period_start * 1000,
              ),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            });

            logger.info(
              {
                userId,
                subscriptionId,
                tier: mappingResult.tier,
                eventId,
              },
              "Subscription created from checkout",
            );
          } else {
            logger.warn(
              { customerId, eventId },
              "Checkout completed but no userId in customer metadata",
            );
          }
        }
      }
    },
    DEFAULT_RETRY_CONFIG,
    { eventId, eventType: "checkout.session.completed" },
  );
}

/**
 * Process invoice.payment_succeeded event
 */
export async function processPaymentSucceeded(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  await processWithRetry(
    async () => {
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      if (subscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const existingSub = await getSubscriptionByStripeId(subscriptionId);

        if (existingSub) {
          await pool.query(
            `UPDATE subscriptions SET
              "status" = $1,
              "currentPeriodStart" = $2,
              "currentPeriodEnd" = $3,
              "updatedAt" = NOW()
            WHERE "stripeSubscriptionId" = $4`,
            [
              stripeSub.status,
              new Date(stripeSub.current_period_start * 1000),
              new Date(stripeSub.current_period_end * 1000),
              subscriptionId,
            ],
          );

          // Log billing event
          await (prisma as any).billingEvent.create({
            data: {
              userId: existingSub.userId,
              subscriptionId: existingSub.id,
              invoiceId: invoice.id,
              eventType: "invoice.payment_succeeded",
              eventSource: "stripe",
              stripeEventId: eventId,
              metadata: {
                amount: invoice.amount_paid,
                currency: invoice.currency,
              },
            },
          });

          logger.info(
            {
              userId: existingSub.userId,
              subscriptionId,
              invoiceId: invoice.id,
              eventId,
            },
            "Payment succeeded, subscription updated",
          );
        }
      }
    },
    DEFAULT_RETRY_CONFIG,
    { eventId, eventType: "invoice.payment_succeeded" },
  );
}

/**
 * Process invoice.payment_failed event
 */
export async function processPaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  await processWithRetry(
    async () => {
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      if (subscriptionId) {
        const existingSub = await getSubscriptionByStripeId(subscriptionId);

        if (existingSub) {
          // Update subscription status to past_due
          await pool.query(
            `UPDATE subscriptions SET
              "status" = 'past_due',
              "updatedAt" = NOW()
            WHERE "stripeSubscriptionId" = $1`,
            [subscriptionId],
          );

          // Log billing event
          await (prisma as any).billingEvent.create({
            data: {
              userId: existingSub.userId,
              subscriptionId: existingSub.id,
              invoiceId: invoice.id,
              eventType: "invoice.payment_failed",
              eventSource: "stripe",
              stripeEventId: eventId,
              metadata: {
                amount: invoice.amount_due,
                currency: invoice.currency,
                attemptCount: invoice.attempt_count,
              },
            },
          });

          logger.warn(
            {
              userId: existingSub.userId,
              subscriptionId,
              invoiceId: invoice.id,
              attemptCount: invoice.attempt_count,
              eventId,
            },
            "Payment failed, subscription marked as past_due",
          );
        }
      }
    },
    DEFAULT_RETRY_CONFIG,
    { eventId, eventType: "invoice.payment_failed" },
  );
}

/**
 * Process customer.subscription.updated event
 */
export async function processSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  await processWithRetry(
    async () => {
      const priceId = subscription.items.data[0]?.price?.id;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;
      const mappingResult = priceId
        ? mapStripePlanFromPriceId(priceId, {
            customerId,
            subscriptionId: subscription.id,
          })
        : undefined;

      const existingSub = await getSubscriptionByStripeId(subscription.id);
      if (existingSub) {
        await pool.query(
          `UPDATE subscriptions SET
            "status" = $1,
            "tier" = COALESCE($2, "tier"),
            "currentPeriodStart" = $3,
            "currentPeriodEnd" = $4,
            "cancelAtPeriodEnd" = $5,
            "updatedAt" = NOW()
          WHERE "stripeSubscriptionId" = $6`,
          [
            subscription.status,
            mappingResult?.tier,
            new Date(subscription.current_period_start * 1000),
            new Date(subscription.current_period_end * 1000),
            subscription.cancel_at_period_end,
            subscription.id,
          ],
        );

        // Log billing event
        await (prisma as any).billingEvent.create({
          data: {
            userId: existingSub.userId,
            subscriptionId: existingSub.id,
            eventType: "customer.subscription.updated",
            eventSource: "stripe",
            stripeEventId: eventId,
            metadata: {
              status: subscription.status,
              tier: mappingResult?.tier,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
          },
        });

        logger.info(
          {
            userId: existingSub.userId,
            subscriptionId: subscription.id,
            status: subscription.status,
            tier: mappingResult?.tier,
            eventId,
          },
          "Subscription updated",
        );
      }
    },
    DEFAULT_RETRY_CONFIG,
    { eventId, eventType: "customer.subscription.updated" },
  );
}

/**
 * Process customer.subscription.deleted event
 */
export async function processSubscriptionDeleted(
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  await processWithRetry(
    async () => {
      const existingSub = await getSubscriptionByStripeId(subscription.id);
      
      if (existingSub) {
        await pool.query(
          `UPDATE subscriptions SET
            "status" = 'canceled',
            "tier" = 'free',
            "updatedAt" = NOW()
          WHERE "stripeSubscriptionId" = $1`,
          [subscription.id],
        );

        // Log billing event
        await (prisma as any).billingEvent.create({
          data: {
            userId: existingSub.userId,
            subscriptionId: existingSub.id,
            eventType: "customer.subscription.deleted",
            eventSource: "stripe",
            stripeEventId: eventId,
            metadata: {
              canceledAt: new Date().toISOString(),
            },
          },
        });

        logger.info(
          {
            userId: existingSub.userId,
            subscriptionId: subscription.id,
            eventId,
          },
          "Subscription canceled",
        );
      }
    },
    DEFAULT_RETRY_CONFIG,
    { eventId, eventType: "customer.subscription.deleted" },
  );
}
