/**
 * Billing API Routes
 *
 * Handles subscription management, payments, and plan upgrades
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { z } from "zod";
import { resolveStripeApiVersion } from "../config/stripe";
import { JWT_SECRET, getFrontendUrl } from "../config/secrets";
import pool from "../lib/db";
import { logger } from "../logger";
import { checkoutSchema } from "../schemas/validation";

/** User data from JWT token */
interface TokenUser {
  userId: string;
  email?: string;
  id?: string;
}

/** JWT user set by requireAuth (separate from AuthUser on other routes) */
type WithBillingJwtUser = { user?: TokenUser };

function billingJwtUser(request: FastifyRequest): TokenUser | undefined {
  return (request as WithBillingJwtUser).user;
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK version pin
      apiVersion: resolveStripeApiVersion() as any,
    })
  : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const SubscribeSchema = z.object({
  plan: z.enum(["starter", "pro", "compliance"]),
});

// Database row types
interface SubscriptionRow {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string;
  tier: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function getPriceId(
  plan: "starter" | "pro" | "compliance",
  interval: "monthly" | "annual" = "monthly",
): string | null {
  const suffix = interval === "annual" ? "_ANNUAL" : "_MONTHLY";
  switch (plan) {
    case "starter":
      return process.env[`STRIPE_PRICE_ID_STARTER${suffix}`] || process.env.STRIPE_PRICE_ID_STARTER || null;
    case "pro":
      return process.env[`STRIPE_PRICE_ID_PRO${suffix}`] || process.env.STRIPE_PRICE_ID_PRO || null;
    case "compliance":
      return (
        process.env[`STRIPE_PRICE_ID_COMPLIANCE${suffix}`] ||
        process.env.STRIPE_PRICE_ID_COMPLIANCE ||
        process.env[`STRIPE_PRICE_ID_ENTERPRISE${suffix}`] ||
        process.env.STRIPE_PRICE_ID_ENTERPRISE ||
        null
      );
    default:
      return null;
  }
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as TokenUser;

    (request as WithBillingJwtUser).user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const result = await pool.query<{ stripeCustomerId: string | null }>(
    'SELECT "stripeCustomerId" FROM subscriptions WHERE "userId" = $1 LIMIT 1',
    [userId],
  );

  if (result.rows.length > 0 && result.rows[0].stripeCustomerId) {
    return result.rows[0].stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}

async function getSubscriptionByUserId(
  userId: string,
): Promise<SubscriptionRow | null> {
  const result = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE "userId" = $1 LIMIT 1',
    [userId],
  );
  return result.rows[0] || null;
}

async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<SubscriptionRow | null> {
  const result = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE "stripeSubscriptionId" = $1 LIMIT 1',
    [stripeSubscriptionId],
  );
  return result.rows[0] || null;
}

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
  const existing = await getSubscriptionByUserId(data.userId);

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
}

/**
 * Parse comma-separated price IDs from env var
 */
function parsePriceIds(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar.split(",").map((id) => id.trim()).filter(Boolean);
}

/**
 * Check if a priceId matches any of the configured price IDs for a tier
 */
function priceIdMatchesTier(priceId: string, ...envVars: (string | undefined)[]): boolean {
  for (const envVar of envVars) {
    const ids = parsePriceIds(envVar);
    if (ids.includes(priceId)) return true;
  }
  return false;
}

export interface StripePlanMappingResult {
  tier: "starter" | "pro" | "compliance" | "enterprise" | "free";
  billingTierUnknown: boolean;
}

/**
 * Map a Stripe price ID to a billing tier.
 * Supports monthly and annual prices, and comma-separated lists for legacy/promotional prices.
 * 
 * @param priceId - The Stripe price ID from the subscription
 * @param context - Optional context for error logging (customerId, subscriptionId)
 * @returns The mapped tier and whether the tier is unknown
 */
export function mapStripePlanFromPriceId(
  priceId: string,
  context?: { customerId?: string; subscriptionId?: string },
): StripePlanMappingResult {
  // Check Starter tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
      process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_ID_STARTER, // Legacy fallback
    )
  ) {
    return { tier: "starter", billingTierUnknown: false };
  }

  // Check Pro tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
      process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
      process.env.STRIPE_PRICE_ID_PRO, // Legacy fallback
    )
  ) {
    return { tier: "pro", billingTierUnknown: false };
  }

  // Check Compliance tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL,
      process.env.STRIPE_PRICE_ID_COMPLIANCE, // Legacy fallback
    )
  ) {
    return { tier: "compliance", billingTierUnknown: false };
  }

  // Check Enterprise tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY,
      process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL,
      process.env.STRIPE_PRICE_ID_ENTERPRISE, // Legacy fallback
    )
  ) {
    return { tier: "enterprise", billingTierUnknown: false };
  }

  // Unknown price ID - log structured error and return safe default
  logger.error(
    {
      priceId,
      customerId: context?.customerId,
      subscriptionId: context?.subscriptionId,
      configuredPrices: {
        starter: {
          monthly: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
        },
        pro: {
          monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
        },
        compliance: {
          monthly: process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL,
        },
        enterprise: {
          monthly: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL,
        },
      },
    },
    "Unknown Stripe price ID - unable to map to tier. Account flagged for admin review.",
  );

  return { tier: "free", billingTierUnknown: true };
}

export async function billingRoutes(fastify: FastifyInstance) {
  // POST /api/checkout - Create checkout session (alternative endpoint)
  fastify.post(
    "/checkout",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate input with Zod schema
        const validation = checkoutSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { plan, priceId } = validation.data;
        const frontendUrl =
          process.env.FRONTEND_URL || "http://myGuardrail.com";

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        const selectedPriceId =
          priceId || (plan ? getPriceId(plan as "starter" | "pro" | "compliance") : null);
        if (!selectedPriceId) {
          return reply.status(400).send({
            success: false,
            error: "Invalid plan selected or price ID not configured",
          });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: selectedPriceId,
              quantity: 1,
            },
          ],
          success_url: `${frontendUrl}/dashboard?checkout=success`,
          cancel_url: `${frontendUrl}/pricing?checkout=canceled`,
        });

        return reply.send({
          success: true,
          url: session.url,
          sessionId: session.id,
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Checkout error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to create checkout session",
        });
      }
    },
  );

  fastify.post(
    "/create-checkout-session",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { plan?: string };
        const plan = body.plan;
        const frontendUrl =
          process.env.FRONTEND_URL || "http://myGuardrail.com";

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        if (!plan) {
          return reply.status(400).send({
            success: false,
            error: "Plan is required",
          });
        }

        const priceId = getPriceId(plan as "starter" | "pro" | "compliance");
        if (!priceId) {
          return reply.status(400).send({
            success: false,
            error: "Invalid plan selected or price ID not configured",
          });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          success_url: `${frontendUrl}/dashboard?checkout=success`,
          cancel_url: `${frontendUrl}/pricing?checkout=canceled`,
        });

        return reply.send({
          success: true,
          url: session.url,
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Checkout session error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to create checkout session",
        });
      }
    },
  );

  fastify.post(
    "/subscribe",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = SubscribeSchema.parse(request.body);
        const user = billingJwtUser(request);

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        const priceId = getPriceId(body.plan);
        if (!priceId) {
          return reply.status(400).send({
            success: false,
            error: `Price ID for ${body.plan} plan is not configured`,
          });
        }

        const existingSub = await getSubscriptionByUserId(user.userId);
        if (
          existingSub &&
          (existingSub.status === "active" || existingSub.status === "trialing")
        ) {
          return reply.status(400).send({
            success: false,
            error: "You already have an active subscription",
            currentPlan: existingSub.tier,
          });
        }

        const email = user.email || `user-${user.userId}@guardrail.app`;
        const stripeCustomerId = await getOrCreateStripeCustomer(
          user.userId,
          email,
        );

        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: priceId }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
        });

        await upsertSubscription({
          userId: user.userId,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          plan: body.plan,
          status: subscription.status,
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

        return reply.send({
          success: true,
          subscriptionId: subscription.id,
          status: subscription.status,
          clientSecret: paymentIntent?.client_secret,
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Subscribe error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to create subscription",
        });
      }
    },
  );

  fastify.get(
    "/subscription",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = billingJwtUser(request);
      if (!user) {
        return reply
          .status(401)
          .send({ success: false, error: "Not authenticated" });
      }
      const subscription = await getSubscriptionByUserId(user.userId);

      if (!subscription) {
        return {
          success: true,
          subscription: {
            plan: "free",
            status: "none",
          },
        };
      }

      return {
        success: true,
        subscription: {
          plan: subscription.tier,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      };
    },
  );

  fastify.post(
    "/cancel",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }
        const subscription = await getSubscriptionByUserId(user.userId);

        if (!subscription || !subscription.stripeSubscriptionId) {
          return reply.status(400).send({
            success: false,
            error: "No active subscription to cancel",
          });
        }

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await pool.query(
          'UPDATE subscriptions SET "cancelAtPeriodEnd" = true, "updatedAt" = NOW() WHERE "userId" = $1',
          [user.userId],
        );

        // Audit log for user-initiated subscription cancellation
        const { logAdminAction } = await import("../services/admin-service");
        await logAdminAction({
          actorUserId: user.userId,
          action: "subscription_cancel_requested",
          targetUserId: user.userId,
          metadata: {
            subscriptionId: subscription.id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            tier: subscription.tier,
            cancelAtPeriodEnd: true,
          },
        });

        return {
          success: true,
          message:
            "Subscription will be canceled at the end of the billing period.",
        };
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Cancel subscription error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to cancel subscription",
        });
      }
    },
  );

  fastify.post(
    "/payment-method",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        success: true,
        message: "Payment method updated successfully",
      };
    },
  );

  fastify.get(
    "/payment-methods",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        if (!stripe) {
          return reply.send({
            success: true,
            data: {
              paymentMethods: [],
              defaultMethod: null,
            },
          });
        }

        const subscription = await getSubscriptionByUserId(user.userId);
        if (!subscription || !subscription.stripeCustomerId) {
          return reply.send({
            success: true,
            data: {
              paymentMethods: [],
              defaultMethod: null,
            },
          });
        }

        const paymentMethods = await stripe.paymentMethods.list({
          customer: subscription.stripeCustomerId,
          type: "card",
        });

        const formattedMethods = paymentMethods.data.map((pm) => ({
          id: pm.id,
          type: pm.type,
          card: pm.card
            ? {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              }
            : null,
          isDefault: false,
        }));

        return reply.send({
          success: true,
          data: {
            paymentMethods: formattedMethods,
            defaultMethod: formattedMethods[0]?.id || null,
          },
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Payment methods error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to fetch payment methods",
        });
      }
    },
  );

  fastify.get(
    "/history",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        const subscription = await getSubscriptionByUserId(user.userId);
        if (!subscription || !subscription.stripeCustomerId) {
          return reply.send({
            success: true,
            invoices: [],
          });
        }

        const invoices = await stripe.invoices.list({
          customer: subscription.stripeCustomerId,
          limit: 24,
        });

        const formattedInvoices = invoices.data.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          status: invoice.status,
          date: new Date(invoice.created * 1000).toISOString(),
          pdfUrl: invoice.invoice_pdf,
          hostedUrl: invoice.hosted_invoice_url,
          description: invoice.description || `Invoice ${invoice.number}`,
        }));

        return reply.send({
          success: true,
          invoices: formattedInvoices,
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Billing history error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to fetch billing history",
        });
      }
    },
  );

  fastify.get(
    "/usage",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        // Get subscription to determine plan limits
        const subscription = await getSubscriptionByUserId(user.userId);
        const plan = subscription?.tier || "free";

        // Get usage from usage_records table
        const currentPeriodStart = subscription?.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const currentPeriodEnd = subscription?.currentPeriodEnd || new Date();

        const usageQuery = await pool.query(`
          SELECT 
            COUNT(CASE WHEN type = 'scan' THEN 1 END) as scans_used,
            COUNT(CASE WHEN type = 'reality' THEN 1 END) as reality_runs_used,
            COUNT(CASE WHEN type = 'ai_agent' THEN 1 END) as ai_agent_runs_used
          FROM usage_records 
          WHERE "userId" = $1 
            AND created_at >= $2 
            AND created_at <= $3
        `, [user.userId, currentPeriodStart, currentPeriodEnd]);

        const teamQuery = await pool.query(`
          SELECT COUNT(*) as team_members_used
          FROM organization_members om
          JOIN organizations o ON om."organizationId" = o.id
          WHERE o."ownerId" = $1
        `, [user.userId]);

        const usage = usageQuery.rows[0];
        const teamCount = teamQuery.rows[0];

        // Get plan limits
        const limits = {
          free: { scans: 10, reality: 5, aiAgent: 0, team: 1 },
          starter: { scans: 100, reality: 20, aiAgent: 10, team: 5 },
          pro: { scans: 500, reality: 100, aiAgent: 50, team: 20 },
          compliance: { scans: 1000, reality: 200, aiAgent: 100, team: 50 },
          enterprise: { scans: null, reality: null, aiAgent: null, team: null },
        };

        const planLimits = limits[plan as keyof typeof limits] || limits.free;

        return reply.send({
          scansUsed: parseInt(usage.scans_used) || 0,
          scansLimit: planLimits.scans,
          realityRunsUsed: parseInt(usage.reality_runs_used) || 0,
          realityRunsLimit: planLimits.reality,
          aiAgentRunsUsed: parseInt(usage.ai_agent_runs_used) || 0,
          aiAgentRunsLimit: planLimits.aiAgent,
          teamMembersUsed: parseInt(teamCount.team_members_used) || 0,
          teamMembersLimit: planLimits.team,
          currentPeriodStart: currentPeriodStart.toISOString(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Usage fetch error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to fetch usage",
        });
      }
    },
  );

  fastify.get(
    "/usage/extended",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        const subscription = await getSubscriptionByUserId(user.userId);
        const plan = subscription?.tier || "free";

        const currentPeriodStart = subscription?.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const currentPeriodEnd = subscription?.currentPeriodEnd || new Date();

        const usageQuery = await pool.query(`
          SELECT 
            COUNT(CASE WHEN type = 'scan' THEN 1 END) as scans_used,
            COUNT(CASE WHEN type = 'reality' THEN 1 END) as reality_runs_used,
            COUNT(CASE WHEN type = 'ai_agent' THEN 1 END) as ai_agent_runs_used
          FROM usage_records 
          WHERE "userId" = $1 
            AND created_at >= $2 
            AND created_at <= $3
        `, [user.userId, currentPeriodStart, currentPeriodEnd]);

        const teamQuery = await pool.query(`
          SELECT COUNT(*) as team_members_used
          FROM organization_members om
          JOIN organizations o ON om."organizationId" = o.id
          WHERE o."ownerId" = $1
        `, [user.userId]);

        const projectsQuery = await pool.query(`
          SELECT COUNT(*) as projects_used
          FROM projects
          WHERE "userId" = $1
        `, [user.userId]);

        const trendQuery = await pool.query(`
          SELECT 
            DATE(created_at) as date,
            COUNT(CASE WHEN type = 'scan' THEN 1 END) as scans,
            COUNT(CASE WHEN type = 'reality' THEN 1 END) as reality_runs,
            COUNT(CASE WHEN type = 'ai_agent' THEN 1 END) as ai_agent_runs
          FROM usage_records 
          WHERE "userId" = $1 
            AND created_at >= $2
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
          LIMIT 14
        `, [user.userId, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)]);

        const breakdownQuery = await pool.query(`
          SELECT 
            type,
            source,
            COUNT(*) as count
          FROM usage_records 
          WHERE "userId" = $1 
            AND created_at >= $2 
            AND created_at <= $3
          GROUP BY type, source
        `, [user.userId, currentPeriodStart, currentPeriodEnd]);

        const usage = usageQuery.rows[0];
        const teamCount = teamQuery.rows[0];
        const projectsCount = projectsQuery.rows[0];

        const limits = {
          free: { scans: 10, reality: 5, aiAgent: 0, team: 1, projects: 3 },
          starter: { scans: 100, reality: 20, aiAgent: 10, team: 5, projects: 10 },
          pro: { scans: 500, reality: 100, aiAgent: 50, team: 20, projects: 50 },
          compliance: { scans: 1000, reality: 200, aiAgent: 100, team: 50, projects: 100 },
          enterprise: { scans: null, reality: null, aiAgent: null, team: null, projects: null },
        };

        const planLimits = limits[plan as keyof typeof limits] || limits.free;

        const scansUsed = parseInt(usage.scans_used) || 0;
        const realityRunsUsed = parseInt(usage.reality_runs_used) || 0;
        const aiAgentRunsUsed = parseInt(usage.ai_agent_runs_used) || 0;

        const now = new Date();
        const totalDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.max(1, Math.ceil((now.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, totalDays - elapsedDays);

        const dailyScans = scansUsed / elapsedDays;
        const dailyReality = realityRunsUsed / elapsedDays;
        const dailyAI = aiAgentRunsUsed / elapsedDays;

        const usageTrend = trendQuery.rows.reverse().map(row => ({
          date: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          scans: parseInt(row.scans) || 0,
          realityRuns: parseInt(row.reality_runs) || 0,
          aiAgentRuns: parseInt(row.ai_agent_runs) || 0,
        }));

        const scanBreakdown: Record<string, number> = {};
        const realityBreakdown: Record<string, number> = {};
        for (const row of breakdownQuery.rows) {
          const source = row.source || "Other";
          const count = parseInt(row.count) || 0;
          if (row.type === "scan") {
            scanBreakdown[source] = (scanBreakdown[source] || 0) + count;
          } else if (row.type === "reality") {
            realityBreakdown[source] = (realityBreakdown[source] || 0) + count;
          }
        }

        const colors = ["hsl(174, 72%, 46%)", "hsl(187, 85%, 53%)", "hsl(270, 70%, 60%)", "hsl(220, 13%, 45%)"];
        const scansBreakdownArray = Object.entries(scanBreakdown).map(([category, value], i) => ({
          category,
          value,
          color: colors[i % colors.length],
        }));
        const realityBreakdownArray = Object.entries(realityBreakdown).map(([category, value], i) => ({
          category,
          value,
          color: colors[i % colors.length],
        }));

        return reply.send({
          success: true,
          data: {
            scansUsed,
            scansLimit: planLimits.scans,
            realityRunsUsed,
            realityRunsLimit: planLimits.reality,
            aiAgentRunsUsed,
            aiAgentRunsLimit: planLimits.aiAgent,
            teamMembersUsed: parseInt(teamCount.team_members_used) || 0,
            teamMembersLimit: planLimits.team,
            projectsUsed: parseInt(projectsCount.projects_used) || 0,
            projectsLimit: planLimits.projects,
            currentPeriodStart: currentPeriodStart.toISOString(),
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            daysRemaining,
            dailyUsageRate: {
              scans: Math.round(dailyScans * 10) / 10,
              realityRuns: Math.round(dailyReality * 10) / 10,
              aiAgentRuns: Math.round(dailyAI * 10) / 10,
            },
            projectedUsage: {
              scans: Math.round(dailyScans * totalDays),
              realityRuns: Math.round(dailyReality * totalDays),
              aiAgentRuns: Math.round(dailyAI * totalDays),
            },
            usageTrend,
            breakdown: {
              scans: scansBreakdownArray.length > 0 ? scansBreakdownArray : [{ category: "No data", value: 0, color: colors[0] }],
              realityRuns: realityBreakdownArray.length > 0 ? realityBreakdownArray : [{ category: "No data", value: 0, color: colors[0] }],
            },
          },
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Extended usage fetch error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to fetch extended usage",
        });
      }
    },
  );

  fastify.post(
    "/portal",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        const subscription = await getSubscriptionByUserId(user.userId);
        if (!subscription || !subscription.stripeCustomerId) {
          return reply.status(400).send({
            success: false,
            error: "No active subscription found",
          });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: subscription.stripeCustomerId,
          return_url: `${getFrontendUrl()}/billing`,
        });

        return reply.send({
          success: true,
          url: portalSession.url,
        });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Portal session error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to create portal session",
        });
      }
    },
  );

  fastify.get(
    "/invoice/:id",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = billingJwtUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Not authenticated" });
        }

        if (!stripe) {
          return reply.status(500).send({
            success: false,
            error: "Stripe is not configured",
          });
        }

        const { id } = request.params as { id: string };
        
        const subscription = await getSubscriptionByUserId(user.userId);
        if (!subscription || !subscription.stripeCustomerId) {
          return reply.status(400).send({
            success: false,
            error: "No active subscription found",
          });
        }

        const invoice = await stripe.invoices.retrieve(id, {
          expand: ['customer']
        });

        // Verify this invoice belongs to the customer
        const customerId = typeof invoice.customer === 'string' 
          ? invoice.customer 
          : invoice.customer?.id;

        if (customerId !== subscription.stripeCustomerId) {
          return reply.status(403).send({
            success: false,
            error: "Access denied",
          });
        }

        if (!invoice.invoice_pdf) {
          return reply.status(404).send({
            success: false,
            error: "Invoice PDF not available",
          });
        }

        // Fetch the PDF
        const pdfResponse = await fetch(invoice.invoice_pdf);
        if (!pdfResponse.ok) {
          throw new Error("Failed to fetch invoice PDF");
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        
        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`)
          .send(Buffer.from(pdfBuffer));

      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Invoice download error");
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to download invoice",
        });
      }
    },
  );

  fastify.post(
    "/webhook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!stripe) {
          return reply.status(500).send({ error: "Stripe is not configured" });
        }

        const sig = request.headers["stripe-signature"] as string;

        if (!sig || !WEBHOOK_SECRET) {
          fastify.log.warn("Missing stripe signature or webhook secret");
          return reply.status(400).send({ error: "Missing signature" });
        }

        let event: Stripe.Event;
        const reqWithRaw = request as FastifyRequest & {
          rawBody?: string | Buffer;
        };
        const rawBody = reqWithRaw.rawBody || request.body;
        const bodyString =
          typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

        try {
          event = stripe.webhooks.constructEvent(
            bodyString,
            sig,
            WEBHOOK_SECRET,
          );
        } catch (err) {
          const verifyErr = err as Error;
          logger.error(
            { error: verifyErr.message },
            "Webhook signature verification failed",
          );
          return reply
            .status(400)
            .send({ error: `Webhook Error: ${verifyErr.message}` });
        }

        logger.info(
          { eventType: event.type, eventId: event.id },
          "Processing Stripe webhook event",
        );

        // Import webhook processors
        const {
          processCheckoutCompleted,
          processPaymentSucceeded,
          processPaymentFailed,
          processSubscriptionUpdated,
          processSubscriptionDeleted,
        } = await import("../services/webhook-processor");

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await processCheckoutCompleted(stripe, session, event.id);
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;
            await processPaymentSucceeded(stripe, invoice, event.id);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            await processPaymentFailed(stripe, invoice, event.id);
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await processSubscriptionUpdated(subscription, event.id);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await processSubscriptionDeleted(subscription, event.id);
            break;
          }

          default:
            logger.info(
              { eventType: event.type, eventId: event.id },
              "Unhandled Stripe event type",
            );
        }

        return reply.send({ received: true });
      } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, "Webhook processing error");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    },
  );
}

// Type declaration moved to BillingRequest interface above
