/**
 * Plan Gating Middleware
 * 
 * Enforces subscription plan limits at the API level.
 * This ensures paid features are truly restricted, not just UI-hidden.
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticatedRequest } from "./fastify-auth";
import { logger } from "../logger";
import { prisma } from "@guardrail/database";
import { recordPlanGateCheck } from "../lib/feature-metrics";

export interface PlanGateOptions {
  /** Required tier (e.g., 'pro', 'enterprise') */
  requiredTier?: string;
  /** Minimum tier level (0=free, 1=starter, 2=pro, 3=compliance, 4=enterprise) */
  minTierLevel?: number;
  /** Feature name for error messages */
  featureName?: string;
  /** Check if subscription is active */
  requireActive?: boolean;
}

const TIER_LEVELS: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  compliance: 3,
  enterprise: 4,
  unlimited: 5,
};

/**
 * Get user's effective tier from subscription
 */
async function getUserTier(userId: string): Promise<{ tier: string; status: string; subscriptionId: string | null }> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      tier: true,
      status: true,
      id: true,
    },
  });

  return {
    tier: subscription?.tier || 'free',
    status: subscription?.status || 'none',
    subscriptionId: subscription?.id || null,
  };
}

/**
 * Check if user's tier meets requirements
 */
function tierMeetsRequirement(
  userTier: string,
  options: PlanGateOptions,
): { allowed: boolean; reason?: string } {
  // Check required tier (exact match)
  if (options.requiredTier) {
    if (userTier !== options.requiredTier && userTier !== 'unlimited') {
      return {
        allowed: false,
        reason: `This feature requires the ${options.requiredTier} plan. Your current plan is ${userTier}.`,
      };
    }
  }

  // Check minimum tier level
  if (options.minTierLevel !== undefined) {
    const userLevel = TIER_LEVELS[userTier] || 0;
    if (userLevel < options.minTierLevel && userTier !== 'unlimited') {
      const requiredTierName = Object.entries(TIER_LEVELS).find(
        ([_, level]) => level === options.minTierLevel,
      )?.[0] || 'upgraded';
      
      return {
        allowed: false,
        reason: `This feature requires at least the ${requiredTierName} plan. Your current plan is ${userTier}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Plan gating middleware factory
 */
export function requirePlan(options: PlanGateOptions = {}) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const userId = (request as AuthenticatedRequest).user?.id;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
        requestId: (request as any).requestId || 'unknown',
        nextSteps: [
          "Include a valid authentication token in your request",
          "Get your API key at https://guardrailai.dev/settings/keys",
          "For CLI: Run 'guardrail login' to authenticate",
        ],
      });
    }

    try {
      const { tier, status, subscriptionId } = await getUserTier(userId);

      // Check if subscription is active (if required)
      if (options.requireActive !== false) {
        if (status !== 'active' && status !== 'trialing') {
        return reply.status(403).send({
          success: false,
          error: "Active subscription required",
          code: "SUBSCRIPTION_INACTIVE",
          message: options.featureName
            ? `${options.featureName} requires an active subscription.`
            : "This feature requires an active subscription.",
          currentStatus: status,
          upgradeUrl: "/pricing",
          nextSteps: [
            "Reactivate your subscription at https://guardrailai.dev/settings/billing",
            status === 'past_due' ? "Update your payment method to restore access" : undefined,
            "Contact support if you need assistance",
          ].filter(Boolean),
        });
        }
      }

      // Check tier requirements
      const tierCheck = tierMeetsRequirement(tier, options);
      if (!tierCheck.allowed) {
        // Record metrics
        recordPlanGateCheck(tier, false);
        
        logger.info(
          {
            userId,
            userTier: tier,
            requiredTier: options.requiredTier,
            minTierLevel: options.minTierLevel,
            featureName: options.featureName,
          },
          "Plan gate blocked access",
        );

        return reply.status(403).send({
          success: false,
          error: "Plan upgrade required",
          code: "PLAN_UPGRADE_REQUIRED",
          message: tierCheck.reason,
          currentTier: tier,
          requiredTier: options.requiredTier,
          upgradeUrl: "/pricing",
        });
      }

      // Record successful gate check
      recordPlanGateCheck(tier, true);
      
      // Attach tier info to request for downstream use
      (request as any).userTier = tier;
      (request as any).subscriptionId = subscriptionId;
    } catch (error) {
      logger.error({ error, userId }, "Plan gate check failed");
      return reply.status(500).send({
        success: false,
        error: "Failed to verify subscription",
        code: "VERIFICATION_FAILED",
        message: "Unable to verify subscription status. Please try again.",
        nextSteps: [
          "Check your internet connection",
          "Verify your account status at https://guardrailai.dev/settings",
          "Contact support if the issue persists",
        ],
      });
    }
  };
}

/**
 * Check if user has access to a feature (non-blocking, returns boolean)
 */
export async function checkPlanAccess(
  userId: string,
  options: PlanGateOptions,
): Promise<{ allowed: boolean; reason?: string; tier?: string }> {
  try {
    const { tier, status } = await getUserTier(userId);

    if (options.requireActive !== false) {
      if (status !== 'active' && status !== 'trialing') {
        return {
          allowed: false,
          reason: "Active subscription required",
          tier,
        };
      }
    }

    const tierCheck = tierMeetsRequirement(tier, options);
    return {
      ...tierCheck,
      tier,
    };
  } catch (error) {
    logger.error({ error, userId }, "Plan access check failed");
    return {
      allowed: false,
      reason: "Failed to verify subscription",
    };
  }
}
