/**
 * Subscription Reconciliation Service
 * 
 * Syncs subscription state from Stripe to database to prevent drift.
 * Runs hourly to ensure database always reflects current Stripe state.
 * 
 * This is critical for data integrity - if webhooks fail or are delayed,
 * the database subscription state can become out of sync with Stripe.
 */

import Stripe from "stripe";
import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { getTierFromPriceId } from "../routes/billing-webhooks";
import { logAdminAction } from "./admin-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

interface ReconciliationResult {
  totalChecked: number;
  synced: number;
  errors: number;
  skipped: number;
  details: Array<{
    subscriptionId: string;
    userId: string;
    action: "synced" | "skipped" | "error";
    reason?: string;
  }>;
}

/**
 * Reconcile all active subscriptions from Stripe to database
 */
export async function reconcileSubscriptions(): Promise<ReconciliationResult> {
  if (!stripe) {
    logger.warn("Stripe not configured, skipping reconciliation");
    return {
      totalChecked: 0,
      synced: 0,
      errors: 0,
      skipped: 0,
      details: [],
    };
  }

  logger.info("Starting subscription reconciliation");

  const result: ReconciliationResult = {
    totalChecked: 0,
    synced: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  try {
    // Get all active subscriptions from database
    const dbSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["active", "trialing", "past_due", "canceled"] },
        stripeSubscriptionId: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    result.totalChecked = dbSubscriptions.length;
    logger.info(
      { count: dbSubscriptions.length },
      "Found subscriptions to reconcile"
    );

    // Process each subscription
    for (const dbSub of dbSubscriptions) {
      if (!dbSub.stripeSubscriptionId) {
        result.skipped++;
        result.details.push({
          subscriptionId: dbSub.id,
          userId: dbSub.userId,
          action: "skipped",
          reason: "No Stripe subscription ID",
        });
        continue;
      }

      try {
        // Fetch current state from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(
          dbSub.stripeSubscriptionId,
          { expand: ["customer"] }
        );

        // Check for terminal/problem states in Stripe (no "deleted" in Subscription.Status)
        if (stripeSub.status === "unpaid" || stripeSub.status === "canceled") {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              status: stripeSub.status === "canceled" ? "canceled" : "past_due",
              updatedAt: new Date(),
            },
          });

          result.synced++;
          result.details.push({
            subscriptionId: dbSub.id,
            userId: dbSub.userId,
            action: "synced",
            reason: `Status updated to ${stripeSub.status}`,
          });

          logger.info(
            {
              subscriptionId: dbSub.id,
              stripeSubscriptionId: dbSub.stripeSubscriptionId,
              oldStatus: dbSub.status,
              newStatus: stripeSub.status,
            },
            "Reconciled subscription status from Stripe"
          );
          continue;
        }

        // Get tier from price ID
        const priceId = stripeSub.items.data[0]?.price?.id;
        const tierResult = priceId
          ? getTierFromPriceId(priceId, {
              customerId:
                typeof stripeSub.customer === "string"
                  ? stripeSub.customer
                  : stripeSub.customer?.id || "",
              subscriptionId: stripeSub.id,
            })
          : { tier: dbSub.tier as any, billingTierUnknown: false };

        // Check if any fields need updating
        const needsUpdate =
          dbSub.status !== stripeSub.status ||
          dbSub.tier !== tierResult.tier ||
          dbSub.currentPeriodStart.getTime() !==
            stripeSub.current_period_start * 1000 ||
          dbSub.currentPeriodEnd.getTime() !==
            stripeSub.current_period_end * 1000 ||
          dbSub.cancelAtPeriodEnd !== stripeSub.cancel_at_period_end;

        if (needsUpdate) {
          // Update subscription in database
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              status: stripeSub.status,
              tier: tierResult.tier,
              currentPeriodStart: new Date(
                stripeSub.current_period_start * 1000
              ),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              trialEnd: stripeSub.trial_end
                ? new Date(stripeSub.trial_end * 1000)
                : null,
              updatedAt: new Date(),
            },
          });

          // Log reconciliation action
          await logAdminAction({
            actorUserId: "system", // System-initiated reconciliation
            action: "subscription_reconciled",
            targetUserId: dbSub.userId,
            metadata: {
              subscriptionId: dbSub.id,
              stripeSubscriptionId: dbSub.stripeSubscriptionId,
              changes: {
                status: { from: dbSub.status, to: stripeSub.status },
                tier: { from: dbSub.tier, to: tierResult.tier },
              },
            },
          });

          result.synced++;
          result.details.push({
            subscriptionId: dbSub.id,
            userId: dbSub.userId,
            action: "synced",
            reason: "Subscription state synced from Stripe",
          });

          logger.info(
            {
              subscriptionId: dbSub.id,
              userId: dbSub.userId,
              changes: {
                status: { from: dbSub.status, to: stripeSub.status },
                tier: { from: dbSub.tier, to: tierResult.tier },
              },
            },
            "Reconciled subscription from Stripe"
          );
        } else {
          result.skipped++;
          result.details.push({
            subscriptionId: dbSub.id,
            userId: dbSub.userId,
            action: "skipped",
            reason: "Already in sync",
          });
        }
      } catch (error: unknown) {
        result.errors++;
        result.details.push({
          subscriptionId: dbSub.id,
          userId: dbSub.userId,
          action: "error",
          reason: toErrorMessage(error) || "Unknown error",
        });

        logger.error(
          {
            subscriptionId: dbSub.id,
            stripeSubscriptionId: dbSub.stripeSubscriptionId,
            error: toErrorMessage(error),
          },
          "Failed to reconcile subscription"
        );
      }
    }

    logger.info(
      {
        totalChecked: result.totalChecked,
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors,
      },
      "Subscription reconciliation completed"
    );

    return result;
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error) }, "Subscription reconciliation failed");
    throw error;
  }
}

/**
 * Reconcile a single subscription by ID
 * Useful for manual reconciliation or webhook retry scenarios
 */
export async function reconcileSubscription(
  subscriptionId: string
): Promise<{ synced: boolean; changes?: unknown }> {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const dbSub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!dbSub || !dbSub.stripeSubscriptionId) {
    throw new Error("Subscription not found or missing Stripe ID");
  }

  const stripeSub = await stripe.subscriptions.retrieve(
    dbSub.stripeSubscriptionId
  );

  const priceId = stripeSub.items.data[0]?.price?.id;
  const tierResult = priceId
    ? getTierFromPriceId(priceId, {
        customerId:
          typeof stripeSub.customer === "string"
            ? stripeSub.customer
            : stripeSub.customer?.id || "",
        subscriptionId: stripeSub.id,
      })
    : { tier: dbSub.tier as any, billingTierUnknown: false };

  const changes: any = {};

  if (dbSub.status !== stripeSub.status) {
    changes.status = { from: dbSub.status, to: stripeSub.status };
  }
  if (dbSub.tier !== tierResult.tier) {
    changes.tier = { from: dbSub.tier, to: tierResult.tier };
  }

  if (Object.keys(changes).length > 0) {
    await prisma.subscription.update({
      where: { id: dbSub.id },
      data: {
        status: stripeSub.status,
        tier: tierResult.tier,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
        updatedAt: new Date(),
      },
    });

    await logAdminAction({
      actorUserId: "system",
      action: "subscription_reconciled",
      targetUserId: dbSub.userId,
      metadata: {
        subscriptionId: dbSub.id,
        stripeSubscriptionId: dbSub.stripeSubscriptionId,
        changes,
      },
    });

    return { synced: true, changes };
  }

  return { synced: false };
}
