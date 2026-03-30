/**
 * Stripe Metered Billing Service
 *
 * Reports usage to Stripe for metered billing.
 * Handles usage record creation and overage reporting.
 */

import Stripe from "stripe";
import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

// Metered price IDs for different usage types
const METERED_PRICE_IDS = {
  scan_overage: process.env.STRIPE_METERED_SCAN_PRICE_ID,
  reality_overage: process.env.STRIPE_METERED_REALITY_PRICE_ID,
  ai_agent_overage: process.env.STRIPE_METERED_AI_AGENT_PRICE_ID,
};

export interface UsageReportResult {
  success: boolean;
  usageRecordId?: string;
  quantity: number;
  timestamp: number;
  error?: string;
}

export interface OverageReport {
  userId: string;
  subscriptionId: string;
  type: string;
  usage: number;
  limit: number;
  overage: number;
  reported: boolean;
  usageRecordId?: string;
  error?: string;
}

/**
 * Get the subscription item ID for metered billing
 */
async function getMeteredSubscriptionItemId(
  subscriptionId: string,
  usageType: string
): Promise<string | null> {
  if (!stripe) {
    logger.warn("Stripe not configured, cannot get subscription item");
    return null;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data"],
    });

    // Find the metered price for this usage type
    const meteredPriceId = METERED_PRICE_IDS[usageType as keyof typeof METERED_PRICE_IDS];
    if (!meteredPriceId) {
      return null;
    }

    const meteredItem = subscription.items.data.find(
      (item) => item.price.id === meteredPriceId
    );

    return meteredItem?.id || null;
  } catch (error: unknown) {
    logger.error(
      { error: toErrorMessage(error), subscriptionId, usageType },
      "Failed to get metered subscription item"
    );
    return null;
  }
}

/**
 * Report usage to Stripe for metered billing
 */
export async function reportUsageToStripe(
  subscriptionItemId: string,
  quantity: number,
  options: {
    timestamp?: number;
    action?: "increment" | "set";
    idempotencyKey?: string;
  } = {}
): Promise<UsageReportResult> {
  if (!stripe) {
    logger.warn("Stripe not configured, skipping usage report");
    return {
      success: false,
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      error: "Stripe not configured",
    };
  }

  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  const action = options.action || "increment";

  try {
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp,
        action,
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined
    );

    logger.info(
      {
        subscriptionItemId,
        quantity,
        timestamp,
        action,
        usageRecordId: usageRecord.id,
      },
      "Usage reported to Stripe"
    );

    return {
      success: true,
      usageRecordId: usageRecord.id,
      quantity,
      timestamp,
    };
  } catch (error: unknown) {
    logger.error(
      { error: toErrorMessage(error), subscriptionItemId, quantity },
      "Failed to report usage to Stripe"
    );
    return {
      success: false,
      quantity,
      timestamp,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Calculate and report overage for a user
 */
export async function reportOverage(
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<OverageReport[]> {
  const reports: OverageReport[] = [];

  try {
    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing"] },
      },
      select: {
        id: true,
        stripeSubscriptionId: true,
        tier: true,
      },
    });

    if (!subscription?.stripeSubscriptionId) {
      logger.info({ userId }, "No active subscription for overage reporting");
      return [];
    }

    // Get tier limits
    const tierLimits = getTierLimits(subscription.tier || "free");

    // Get usage for the period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId,
        createdAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      select: {
        type: true,
        count: true,
      },
    });

    // Aggregate usage by type
    const usageByType: Record<string, number> = {};
    for (const record of usageRecords) {
      usageByType[record.type] = (usageByType[record.type] || 0) + record.count;
    }

    // Check each usage type for overage
    const overageTypes = [
      { usageType: "scan", limitKey: "scans", meteredKey: "scan_overage" },
      { usageType: "reality_run", limitKey: "reality_runs", meteredKey: "reality_overage" },
      { usageType: "ai_agent_run", limitKey: "ai_agent_runs", meteredKey: "ai_agent_overage" },
    ];

    for (const { usageType, limitKey, meteredKey } of overageTypes) {
      const usage = usageByType[usageType] || 0;
      const limit = tierLimits[limitKey] || 0;

      if (limit !== -1 && usage > limit) {
        const overage = usage - limit;

        const report: OverageReport = {
          userId,
          subscriptionId: subscription.stripeSubscriptionId,
          type: usageType,
          usage,
          limit,
          overage,
          reported: false,
        };

        // Get the metered subscription item
        const subscriptionItemId = await getMeteredSubscriptionItemId(
          subscription.stripeSubscriptionId,
          meteredKey
        );

        if (subscriptionItemId) {
          const result = await reportUsageToStripe(subscriptionItemId, overage, {
            idempotencyKey: `${userId}-${usageType}-${periodStart.toISOString().split("T")[0]}`,
          });

          report.reported = result.success;
          report.usageRecordId = result.usageRecordId;
          report.error = result.error;
        } else {
          report.error = `No metered item configured for ${meteredKey}`;
          logger.warn(
            { userId, usageType, meteredKey },
            "No metered subscription item found, skipping report"
          );
        }

        reports.push(report);

        // Log overage event
        await prisma.billingEvent.create({
          data: {
            userId,
            subscriptionId: subscription.id,
            eventType: "usage.overage",
            eventSource: "system",
            metadata: {
              type: usageType,
              usage,
              limit,
              overage,
              reported: report.reported,
              stripeUsageRecordId: report.usageRecordId,
            },
          },
        });
      }
    }

    if (reports.length > 0) {
      logger.info(
        {
          userId,
          reportCount: reports.length,
          totalOverage: reports.reduce((sum, r) => sum + r.overage, 0),
        },
        "Overage reported to Stripe"
      );
    }

    return reports;
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), userId }, "Failed to report overage");
    throw error;
  }
}

/**
 * Get tier limits (matches the route helper)
 */
function getTierLimits(tier: string): Record<string, number> {
  const limits: Record<string, Record<string, number>> = {
    free: {
      scans: 10,
      reality_runs: 0,
      ai_agent_runs: 0,
    },
    starter: {
      scans: 100,
      reality_runs: 20,
      ai_agent_runs: 0,
    },
    pro: {
      scans: 500,
      reality_runs: 100,
      ai_agent_runs: 50,
    },
    compliance: {
      scans: 1000,
      reality_runs: 200,
      ai_agent_runs: 100,
    },
    enterprise: {
      scans: 5000,
      reality_runs: 1000,
      ai_agent_runs: 500,
    },
    unlimited: {
      scans: -1,
      reality_runs: -1,
      ai_agent_runs: -1,
    },
  };

  return limits[tier] || limits.free;
}

/**
 * Scheduled job to report all users' overage at end of billing period
 * Should be called by a cron job or scheduled task
 */
export async function reportAllOverages(): Promise<{
  processed: number;
  reportsGenerated: number;
  errors: number;
}> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  logger.info(
    { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
    "Starting overage reporting for all users"
  );

  let processed = 0;
  let reportsGenerated = 0;
  let errors = 0;

  try {
    // Get all users with active subscriptions that have metered billing
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["active", "trialing"] },
        tier: { in: ["pro", "compliance", "enterprise"] }, // Only paid tiers with potential metered usage
      },
      select: {
        userId: true,
      },
    });

    for (const { userId } of subscriptions) {
      try {
        const reports = await reportOverage(userId, periodStart, periodEnd);
        processed++;
        reportsGenerated += reports.length;
      } catch (error: unknown) {
        errors++;
        logger.error(
          { error: toErrorMessage(error), userId },
          "Failed to report overage for user"
        );
      }
    }

    logger.info(
      { processed, reportsGenerated, errors },
      "Completed overage reporting"
    );

    return { processed, reportsGenerated, errors };
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error) }, "Failed to run overage reporting job");
    throw error;
  }
}

export const stripeMeteredBillingService = {
  reportUsageToStripe,
  reportOverage,
  reportAllOverages,
  getMeteredSubscriptionItemId,
};
