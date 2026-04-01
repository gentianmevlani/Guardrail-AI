/**
 * Usage Tracking & Metered Billing API Routes
 *
 * Endpoints for tracking and reporting usage for metered billing:
 * - Track scan usage
 * - Track Reality Mode runs
 * - Track AI Agent runs
 * - Get usage summary
 * - Report overage for billing
 */

import { pool } from "@guardrail/database";
import { PrismaClient } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { usageEnforcement } from "../services/usage-enforcement";
import { authMiddleware, AuthenticatedRequest } from "../middleware/fastify-auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Schemas
const TrackUsageSchema = z.object({
  type: z.enum(["scan", "reality_run", "ai_agent_run", "gate_run", "fix_run"]),
  count: z.number().min(1).default(1),
  metadata: z.record(z.any()).optional(),
});

const UsageSummaryQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

interface StripeOverageReportRow {
  type: string;
  overage: number;
  reported: boolean;
  usageRecordId?: string;
  error?: string;
}

// Auth middleware - use the proper auth middleware
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  await authMiddleware(request as AuthenticatedRequest, reply);
}

// Helper to get current billing period
function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

// Helper to get tier limits
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
      scans: -1, // -1 = unlimited
      reality_runs: -1,
      ai_agent_runs: -1,
    },
  };

  return limits[tier] || limits.free;
}

export async function usageRoutes(fastify: FastifyInstance) {
  // Use proper auth middleware for all routes
  fastify.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
  });

  /**
   * POST /api/usage/track - Track a usage event
   */
  fastify.post(
    "/track",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const body = TrackUsageSchema.parse(request.body);
        const { start: periodStart, end: periodEnd } =
          getCurrentBillingPeriod();

        // Find existing usage record for this period
        const existingUsage = await prisma.usageRecord.findFirst({
          where: {
            userId,
            type: body.type,
            createdAt: {
              gte: periodStart,
              lt: periodEnd,
            },
          },
        });

        let currentCount: number;
        if (existingUsage) {
          // Update existing record
          const updated = await prisma.usageRecord.update({
            where: { id: existingUsage.id },
            data: {
              count: existingUsage.count + body.count,
              metadata: body.metadata || {},
            },
          });
          currentCount = updated.count;
        } else {
          // Create new record
          const created = await prisma.usageRecord.create({
            data: {
              userId,
              type: body.type,
              count: body.count,
              metadata: body.metadata || {},
            },
          });
          currentCount = created.count;
        }

        // Get user's tier to check limits
        const subscription = await prisma.subscription.findFirst({
          where: { userId },
          select: { tier: true },
        });
        const tier = subscription?.tier || "free";
        const limits = getTierLimits(tier);

        // Map usage type to limit key
        const limitKeyMap: Record<string, string> = {
          scan: "scans",
          reality_run: "reality_runs",
          ai_agent_run: "ai_agent_runs",
        };
        const limitKey = limitKeyMap[body.type] || body.type;
        const limit = limits[limitKey] || 0;

        // Check if over limit
        const isOverLimit = limit !== -1 && currentCount > limit;
        const overage = isOverLimit ? currentCount - limit : 0;

        return reply.send({
          success: true,
          usage: {
            type: body.type,
            count: currentCount,
            limit: limit === -1 ? "unlimited" : limit,
            remaining:
              limit === -1 ? "unlimited" : Math.max(0, limit - currentCount),
            overage,
            isOverLimit,
          },
          period: {
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
          },
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to track usage");
        return reply.status(500).send({ error: "Failed to track usage" });
      }
    },
  );

  /**
   * GET /api/v1/usage - Get usage summary for current period (source of truth)
   * Uses UsageCounter model for accurate, tenant-scoped usage tracking
   */
  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as AuthenticatedRequest).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Get query params for time window
        const query = request.query as { 
          startDate?: string; 
          endDate?: string;
          period?: 'current' | 'last' | 'custom';
        };

        let periodStart: Date;
        let periodEnd: Date;

        if (query.period === 'custom' && query.startDate && query.endDate) {
          periodStart = new Date(query.startDate);
          periodEnd = new Date(query.endDate);
        } else {
          // Default to current billing period
          const period = getCurrentBillingPeriod();
          periodStart = period.start;
          periodEnd = period.end;
        }

        // Use UsageEnforcementService for accurate usage data
        const summary = await usageEnforcement.getUsageSummary(userId);
        
        // Get subscription for renewal date
        const subscription = await prisma.subscription.findFirst({
          where: {
            userId,
            status: { in: ['active', 'trialing'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Map UsageCounter to API response format
        const usage = {
          scans: {
            used: summary.usage.scanCount,
            limit: summary.limits.scans === -1 ? null : summary.limits.scans,
            remaining: summary.limits.scans === -1 ? null : Math.max(0, summary.limits.scans - summary.usage.scanCount),
          },
          reality: {
            used: summary.usage.realityCount,
            limit: summary.limits.reality === -1 ? null : summary.limits.reality,
            remaining: summary.limits.reality === -1 ? null : Math.max(0, summary.limits.reality - summary.usage.realityCount),
          },
          agent: {
            used: summary.usage.agentCount,
            limit: summary.limits.agent === -1 ? null : summary.limits.agent,
            remaining: summary.limits.agent === -1 ? null : Math.max(0, summary.limits.agent - summary.usage.agentCount),
          },
          gate: {
            used: summary.usage.gateCount,
            limit: summary.limits.gate === -1 ? null : summary.limits.gate,
            remaining: summary.limits.gate === -1 ? null : Math.max(0, summary.limits.gate - summary.usage.gateCount),
          },
          fix: {
            used: summary.usage.fixCount,
            limit: summary.limits.fix === -1 ? null : summary.limits.fix,
            remaining: summary.limits.fix === -1 ? null : Math.max(0, summary.limits.fix - summary.usage.fixCount),
          },
        };

        // Get seat count
        const seatCount = await (prisma as any).teamSeat.count({
          where: {
            userId,
            isActive: true,
            expiresAt: null,
          },
        });

        // Get project count
        const projectCount = await prisma.project.count({
          where: { userId },
        });

        return reply.send({
          success: true,
          tier: summary.tier,
          period: {
            start: summary.usage.periodStart.toISOString(),
            end: summary.usage.periodEnd.toISOString(),
          },
          usage,
          seats: {
            used: seatCount,
            limit: (subscription as any)?.quantity || 1,
          },
          projects: {
            used: projectCount,
            limit: null, // No project limit currently
          },
          subscription: subscription ? {
            status: subscription.status,
            renewalDate: subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          } : null,
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error), stack: getErrorStack(error) },
          "Failed to get usage",
        );
        return reply.status(500).send({ error: "Failed to get usage" });
      }
    },
  );

  /**
   * GET /api/usage/summary - Get usage summary for current period (legacy endpoint)
   */
  fastify.get(
    "/summary",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as AuthenticatedRequest).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const summary = await usageEnforcement.getUsageSummary(userId);
        const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();
        const limits = getTierLimits(summary.tier);

        // Build usage summary in legacy format
        const usageByType: Record<string, unknown> = {
          scan: {
            count: summary.usage.scanCount,
            limit: limits.scans === -1 ? "unlimited" : limits.scans,
            remaining: limits.scans === -1 ? "unlimited" : Math.max(0, limits.scans - summary.usage.scanCount),
            percentage: limits.scans === -1 ? 0 : Math.round((summary.usage.scanCount / limits.scans) * 100),
            isOverLimit: limits.scans !== -1 && summary.usage.scanCount > limits.scans,
          },
          reality_run: {
            count: summary.usage.realityCount,
            limit: limits.reality_runs === -1 ? "unlimited" : limits.reality_runs,
            remaining: limits.reality_runs === -1 ? "unlimited" : Math.max(0, limits.reality_runs - summary.usage.realityCount),
            percentage: limits.reality_runs === -1 ? 0 : Math.round((summary.usage.realityCount / limits.reality_runs) * 100),
            isOverLimit: limits.reality_runs !== -1 && summary.usage.realityCount > limits.reality_runs,
          },
          ai_agent_run: {
            count: summary.usage.agentCount,
            limit: limits.ai_agent_runs === -1 ? "unlimited" : limits.ai_agent_runs,
            remaining: limits.ai_agent_runs === -1 ? "unlimited" : Math.max(0, limits.ai_agent_runs - summary.usage.agentCount),
            percentage: limits.ai_agent_runs === -1 ? 0 : Math.round((summary.usage.agentCount / limits.ai_agent_runs) * 100),
            isOverLimit: limits.ai_agent_runs !== -1 && summary.usage.agentCount > limits.ai_agent_runs,
          },
        };

        return reply.send({
          success: true,
          tier: summary.tier,
          period: {
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
          },
          usage: usageByType,
          totalOverage: Object.values(usageByType).reduce(
            (sum: number, u: any) =>
              sum +
              (u.isOverLimit
                ? u.count - (typeof u.limit === "number" ? u.limit : 0)
                : 0),
            0,
          ),
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to get usage summary",
        );
        return reply.status(500).send({ error: "Failed to get usage summary" });
      }
    },
  );

  /**
   * GET /api/usage/history - Get usage history across billing periods
   */
  fastify.get(
    "/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Get last 6 months of usage
        const result = await pool.query(
          `SELECT type, count, period_start, period_end 
         FROM usage_records 
         WHERE user_id = $1 
         ORDER BY period_start DESC
         LIMIT 100`,
          [userId],
        );

        // Group by period
        type PeriodBucket = {
          periodStart: Date;
          periodEnd: Date;
          usage: Record<string, number>;
        };
        const byPeriod: Record<string, PeriodBucket> = {};
        for (const row of result.rows) {
          const periodKey = row.period_start.toISOString().split("T")[0];
          if (!byPeriod[periodKey]) {
            byPeriod[periodKey] = {
              periodStart: row.period_start,
              periodEnd: row.period_end,
              usage: {},
            };
          }
          byPeriod[periodKey].usage[row.type] = row.count;
        }

        return reply.send({
          success: true,
          history: Object.values(byPeriod),
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to get usage history",
        );
        return reply.status(500).send({ error: "Failed to get usage history" });
      }
    },
  );

  /**
   * POST /api/usage/report-overage - Report overage for metered billing
   * Called by webhook or scheduled job to report overage to Stripe
   */
  fastify.post(
    "/report-overage",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { start: periodStart } = getCurrentBillingPeriod();

        // Get all usage for this period
        const usageResult = await pool.query(
          `SELECT type, count FROM usage_records 
         WHERE user_id = $1 AND period_start = $2`,
          [userId, periodStart],
        );

        // Get user's subscription
        const subResult = await pool.query(
          `SELECT tier, "stripeSubscriptionId" FROM subscriptions WHERE "userId" = $1`,
          [userId],
        );

        if (!subResult.rows[0]?.stripeSubscriptionId) {
          return reply.send({
            success: true,
            message: "No subscription to report overage to",
            overage: {},
          });
        }

        const tier = subResult.rows[0]?.tier || "free";
        const limits = getTierLimits(tier);

        // Calculate overage
        const overage: Record<string, number> = {};
        for (const row of usageResult.rows) {
          const limitKeyMap: Record<string, string> = {
            scan: "scans",
            reality_run: "reality_runs",
            ai_agent_run: "ai_agent_runs",
          };
          const limitKey = limitKeyMap[row.type] || row.type;
          const limit = limits[limitKey] || 0;

          if (limit !== -1 && row.count > limit) {
            overage[row.type] = row.count - limit;
          }
        }

        // Report overage to Stripe metered billing
        let stripeReports: StripeOverageReportRow[] = [];
        if (process.env.STRIPE_SECRET_KEY && Object.keys(overage).length > 0) {
          try {
            const { reportOverage } = await import("../services/stripe-metered-billing");
            const { start: pStart, end: pEnd } = getCurrentBillingPeriod();
            stripeReports = (await reportOverage(
              userId,
              pStart,
              pEnd,
            )) as StripeOverageReportRow[];
            fastify.log.info(
              { userId, overage, reportsCount: stripeReports.length },
              "Overage reported to Stripe"
            );
          } catch (stripeError: any) {
            fastify.log.error({ error: stripeError.message }, "Failed to report to Stripe");
          }
        }

        return reply.send({
          success: true,
          message: stripeReports.length > 0 
            ? `Overage reported to Stripe (${stripeReports.filter((r: StripeOverageReportRow) => r.reported).length}/${stripeReports.length} successful)`
            : "Overage calculated",
          overage,
          tier,
          stripeReports: stripeReports.map((r: StripeOverageReportRow) => ({
            type: r.type,
            overage: r.overage,
            reported: r.reported,
            usageRecordId: r.usageRecordId,
            error: r.error,
          })),
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to report overage");
        return reply.status(500).send({ error: "Failed to report overage" });
      }
    },
  );

  /**
   * GET /api/usage/limits - Get current tier limits
   */
  fastify.get(
    "/limits",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Get user's tier
        const subResult = await pool.query(
          `SELECT tier FROM subscriptions WHERE "userId" = $1`,
          [userId],
        );
        const tier = subResult.rows[0]?.tier || "free";
        const limits = getTierLimits(tier);

        // Get all tier limits for comparison
        const allTiers = ["free", "starter", "pro", "compliance", "enterprise"];
        const allLimits: Record<string, unknown> = {};
        for (const t of allTiers) {
          allLimits[t] = getTierLimits(t);
        }

        return reply.send({
          success: true,
          currentTier: tier,
          limits,
          allTiers: allLimits,
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to get limits");
        return reply.status(500).send({ error: "Failed to get limits" });
      }
    },
  );
}
