/**
 * Stripe Webhook Handlers
 *
 * Handles all Stripe webhook events with signature verification.
 * Events are logged to billing_events for audit trail.
 */

import type { Prisma } from "@prisma/client";
import { Tier } from "@guardrail/core";
import { pool, prisma } from "@guardrail/database";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
import {
  createLicenseKey,
  logBillingEvent,
  syncInvoiceFromStripe,
} from "../services/billing-service";
import { emailNotificationService } from "../services/email-notification-service";
import { logAdminAction } from "../services/admin-service";
import { resolveStripeApiVersion } from "../config/stripe";
import { getFrontendUrl } from "../config/secrets";
import { stripeObjectToPrismaJson } from "../schemas/stripe-webhook-json";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: resolveStripeApiVersion() as Stripe.StripeConfig["apiVersion"],
    })
  : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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

export interface TierMappingResult {
  tier: Tier;
  billingTierUnknown: boolean;
}

/**
 * Map Stripe price IDs to tiers.
 * Supports monthly and annual prices, and comma-separated lists for legacy/promotional prices.
 * 
 * @param priceId - The Stripe price ID from the subscription
 * @param context - Optional context for error logging (customerId, subscriptionId)
 * @returns The mapped tier and whether the tier is unknown
 */
export function getTierFromPriceId(
  priceId: string,
  context?: { customerId?: string; subscriptionId?: string },
): TierMappingResult {
  // Check Starter tier (monthly + annual)
  // Note: "starter" is not in the Tier type from billing-service, map to "pro" or handle separately
  // For now, we'll check if starter prices map to a valid tier
  
  // Check Pro tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
      process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
      process.env.STRIPE_PRICE_PRO_MONTHLY, // Legacy env var names
      process.env.STRIPE_PRICE_PRO_ANNUAL,
      process.env.STRIPE_PRICE_ID_PRO, // Legacy fallback
    )
  ) {
    return { tier: "pro", billingTierUnknown: false };
  }

  // Check Starter tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
      process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_STARTER_MONTHLY, // Legacy env var names
      process.env.STRIPE_PRICE_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_ID_STARTER, // Legacy fallback
    )
  ) {
    return { tier: "starter", billingTierUnknown: false };
  }

  // Check Compliance tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL,
      process.env.STRIPE_PRICE_COMPLIANCE_MONTHLY, // Legacy env var names
      process.env.STRIPE_PRICE_COMPLIANCE_ANNUAL,
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
    // Enterprise Stripe products map to top product tier (`compliance`) in Tier enum
    return { tier: "compliance", billingTierUnknown: false };
  }

  // Unknown price ID - log structured error and return safe default
  logger.error(
    {
      priceId,
      customerId: context?.customerId,
      subscriptionId: context?.subscriptionId,
      configuredPrices: {
        pro: {
          monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY || process.env.STRIPE_PRICE_PRO_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL || process.env.STRIPE_PRICE_PRO_ANNUAL,
        },
        starter: {
          monthly: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY || process.env.STRIPE_PRICE_STARTER_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_STARTER_ANNUAL || process.env.STRIPE_PRICE_STARTER_ANNUAL,
        },
        compliance: {
          monthly: process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY || process.env.STRIPE_PRICE_COMPLIANCE_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL || process.env.STRIPE_PRICE_COMPLIANCE_ANNUAL,
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

// Get user ID from Stripe customer
async function getUserIdFromCustomer(
  customerId: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE "stripeCustomerId" = $1',
    [customerId],
  );
  return result.rows[0]?.id || null;
}

// Get user ID from Stripe customer metadata
async function getUserIdFromCustomerMetadata(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  if ("deleted" in customer && customer.deleted) {
    return null;
  }
  const fullCustomer = customer as Stripe.Customer;
  return fullCustomer.metadata?.userId || null;
}

/** Request with optional raw body buffer/string (Fastify rawBody / content parser). */
interface StripeWebhookRequest extends FastifyRequest {
  rawBody?: string | Buffer;
}

export async function billingWebhookRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/billing/webhook - Main Stripe webhook endpoint
   */
  fastify.post(
    "/webhook",
    {
      config: {
        rawBody: true, // Needed for signature verification
      },
    },
    async (request: StripeWebhookRequest, reply: FastifyReply) => {
      if (!stripe) {
        logger.error("Stripe is not configured");
        return reply.status(500).send({ error: "Stripe not configured" });
      }

      const sig = request.headers["stripe-signature"] as string;

      if (!sig || !WEBHOOK_SECRET) {
        logger.warn("Missing Stripe signature or webhook secret");
        return reply.status(400).send({ error: "Missing signature" });
      }

      let event: Stripe.Event;

      try {
        // Get raw body for signature verification
        const rawBody =
          request.rawBody ?? JSON.stringify(request.body);
        event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
      } catch (err: unknown) {
        logger.error(
          { error: toErrorMessage(err) },
          "Webhook signature verification failed",
        );
        return reply
          .status(400)
          .send({ error: `Webhook Error: ${toErrorMessage(err)}` });
      }

      logger.info(
        { eventType: event.type, eventId: event.id },
        "Processing Stripe webhook",
      );

      try {
        await handleStripeEvent(event);
        return reply.send({ received: true });
      } catch (error: unknown) {
        // Enhanced error logging with context for debugging
        const requestId = String(request.id ?? "unknown");
        logger.error(
          { 
            error: toErrorMessage(error),
            stack: getErrorStack(error),
            eventType: event.type,
            eventId: event.id,
            requestId,
            timestamp: new Date().toISOString(),
          },
          "Webhook processing failed",
        );
        return reply.status(500).send({ 
          error: "Webhook processing failed",
          code: "WEBHOOK_PROCESSING_ERROR",
          eventId: event.id,
          requestId,
        });
      }
    },
  );
}

/**
 * Main event handler - routes to specific handlers
 * 
 * Enhanced with:
 * - Idempotency check before processing
 * - Transaction safety for atomic operations
 * - Event logging before processing (for audit trail even on failure)
 * - Comprehensive error handling
 */
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Idempotency check: skip if event already processed
  if (event.id) {
    const existingEvent = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, eventType: true, createdAt: true },
    });

    if (existingEvent) {
      logger.info(
        {
          eventId: event.id,
          eventType: event.type,
          existingEventId: existingEvent.id,
          processedAt: existingEvent.createdAt,
        },
        "Stripe webhook event already processed, skipping duplicate",
      );
      
      // Emit telemetry for duplicate event
      // Note: Add telemetry service call here when available
      // telemetry.track('billing.webhook.duplicate', { eventId: event.id, eventType: event.type });
      
      return; // Event already processed, skip
    }
  }

  // Log event BEFORE processing (for audit trail even if processing fails)
  // Use transaction to ensure atomicity
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create billing event record first (for idempotency and audit)
      await tx.billingEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          eventSource: 'stripe',
          metadata: stripeObjectToPrismaJson(event.data.object),
          createdAt: new Date(),
        },
      });

      // Process event within same transaction
      await processEventInTransaction(event, tx);
    }, {
      timeout: 30000, // 30 second timeout
      isolationLevel: 'ReadCommitted', // Prevent dirty reads
    });

    // Emit success telemetry
    logger.info(
      { eventId: event.id, eventType: event.type },
      "Stripe webhook event processed successfully",
    );
    // telemetry.track('billing.webhook.processed', { eventId: event.id, eventType: event.type });
  } catch (error: unknown) {
    // Log error but don't fail webhook (Stripe will retry)
    logger.error(
      {
        error: toErrorMessage(error),
        stack: getErrorStack(error),
        eventId: event.id,
        eventType: event.type,
      },
      "Failed to process Stripe webhook event",
    );
    
    // Emit failure telemetry
    // telemetry.track('billing.webhook.failed', { 
    //   eventId: event.id, 
    //   eventType: event.type,
    //   error: toErrorMessage(error) 
    // });
    
    // Re-throw to trigger Stripe retry
    throw error;
  }
}

/**
 * Process event within transaction context
 * This ensures all database operations are atomic
 */
async function processEventInTransaction(
  event: Stripe.Event,
  tx: Prisma.TransactionClient,
): Promise<void> {

  switch (event.type) {
    // Checkout events
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        event.id,
        tx,
      );
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(
        event.data.object as Stripe.Checkout.Session,
        event.id,
        tx,
      );
      break;

    // Subscription events
    case "customer.subscription.created":
      await handleSubscriptionCreated(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;
    case "customer.subscription.paused":
      await handleSubscriptionPaused(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;
    case "customer.subscription.resumed":
      await handleSubscriptionResumed(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(
        event.data.object as Stripe.Subscription,
        event.id,
        tx,
      );
      break;

    // Invoice events
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
      await handleInvoiceUpdated(event.data.object as Stripe.Invoice, event.id, tx);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id, tx);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(
        event.data.object as Stripe.Invoice,
        event.id,
        tx,
      );
      break;
    case "invoice.payment_action_required":
      await handlePaymentActionRequired(
        event.data.object as Stripe.Invoice,
        event.id,
        tx,
      );
      break;

    // Payment events
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(
        event.data.object as Stripe.PaymentIntent,
        event.id,
        tx,
      );
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailed(
        event.data.object as Stripe.PaymentIntent,
        event.id,
        tx,
      );
      break;

    // Refund/dispute events
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge, event.id, tx);
      break;
    case "charge.dispute.created":
      await handleDisputeCreated(event.data.object as Stripe.Dispute, event.id, tx);
      break;

    default:
      logger.info({ eventType: event.type }, "Unhandled Stripe event type");
  }
}

// ============================================================================
// CHECKOUT HANDLERS
// ============================================================================

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripeEventId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  // Use transaction if provided, otherwise use regular prisma
  const db = tx || prisma;
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!customerId) {
    logger.warn(
      { sessionId: session.id },
      "No customer ID in checkout session",
    );
    return;
  }

  // Get full subscription details
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const tierResult = priceId 
    ? getTierFromPriceId(priceId, { customerId, subscriptionId }) 
    : { tier: "pro" as Tier, billingTierUnknown: false };
  const tier = tierResult.tier;

  // Get user ID from customer metadata
  const customer = (await stripe!.customers.retrieve(
    customerId,
  )) as Stripe.Customer;
  const userId = customer.metadata?.userId;

  if (!userId) {
    logger.warn({ customerId }, "No userId in customer metadata");
    return;
  }

  // Create or update subscription record (within transaction if provided)
  await db.subscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    create: {
      userId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      tier,
      status: subscription.status,
      priceId,
      quantity: subscription.items.data[0]?.quantity || 1,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      billingTierUnknown: tierResult.billingTierUnknown,
    },
    update: {
      tier,
      status: subscription.status,
      priceId,
      quantity: subscription.items.data[0]?.quantity || 1,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      billingTierUnknown: tierResult.billingTierUnknown,
    },
  });

  // Generate license key for the user
  if (tier !== "free") {
    try {
      const licenseKey = await createLicenseKey({
        userId,
        tier,
        maxActivations: tier === "compliance" ? 10 : tier === "pro" ? 5 : 3,
      });
      logger.info(
        { userId, tier, licenseKey: licenseKey.substring(0, 10) + "..." },
        "License key generated",
      );
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to generate license key");
    }
  }

  await logBillingEvent({
    userId,
    subscriptionId,
    eventType: "checkout.session.completed",
    eventSource: "stripe",
    stripeEventId,
    newState: { tier, status: subscription.status },
  });

  logger.info(
    { userId, tier, subscriptionId },
    "Checkout completed, subscription created",
  );
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  await logBillingEvent({
    userId: userId || undefined,
    eventType: "checkout.session.expired",
    eventSource: "stripe",
    stripeEventId,
    metadata: { sessionId: session.id },
  });
}

// ============================================================================
// SUBSCRIPTION HANDLERS
// ============================================================================

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx || prisma;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) {
    logger.warn({ customerId }, "No user found for customer");
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const tierResult = priceId 
    ? getTierFromPriceId(priceId, { customerId, subscriptionId: subscription.id }) 
    : { tier: "pro" as Tier, billingTierUnknown: false };
  const tier = tierResult.tier;

  // Send welcome email for new subscription (outside transaction for async operation)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email && subscription.status === 'active') {
    try {
      const tierDisplayName = tier.charAt(0).toUpperCase() + tier.slice(1);
      await emailNotificationService.sendEmail({
        to: user.email,
        subject: `Welcome to guardrail ${tierDisplayName}! 🎉`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Welcome to guardrail ${tierDisplayName}!</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Thank you for subscribing to guardrail ${tierDisplayName}! You now have access to all ${tierDisplayName} features including:</p>
            <ul style="padding-left: 20px;">
              ${tier === 'pro' ? '<li>Unlimited scans</li><li>Autopilot mode</li><li>Advanced AI analysis</li>' : ''}
              ${tier === 'compliance' ? '<li>All Pro features</li><li>SOC 2 & HIPAA compliance reports</li><li>Evidence collection</li><li>SSO/SAML integration (Enterprise plans)</li><li>Dedicated support</li>' : ''}
              <li>Priority email support</li>
            </ul>
            <p><a href="${getFrontendUrl()}/dashboard" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
            <p>If you have any questions, our support team is here to help.</p>
            <p>Best regards,<br>The guardrail Team</p>
          </div>
        `,
        text: `Welcome to guardrail ${tierDisplayName}! Visit your dashboard at ${getFrontendUrl()}/dashboard`,
      });
      logger.info({ userId, email: user.email, tier }, "Welcome email sent");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), userId }, "Failed to send welcome email");
    }
  }

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.created",
    eventSource: "stripe",
    stripeEventId,
    newState: { tier, status: subscription.status, billingTierUnknown: tierResult.billingTierUnknown },
  });

  // Audit log for subscription creation
  await logAdminAction({
    actorUserId: "system", // System-initiated via webhook
    action: "subscription_created",
    targetUserId: userId,
    metadata: {
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      tier,
      status: subscription.status,
      stripeEventId,
    },
  });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx || prisma;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const tierResult = priceId 
    ? getTierFromPriceId(priceId, { customerId, subscriptionId: subscription.id }) 
    : { tier: "pro" as Tier, billingTierUnknown: false };
  const tier = tierResult.tier;

  // Get previous state
  const existingSub = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { tier: true, status: true },
  });

  // Update subscription
  await db.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      tier,
      status: subscription.status,
      priceId,
      quantity: subscription.items.data[0]?.quantity || 1,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      billingTierUnknown: tierResult.billingTierUnknown,
    },
  });

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.updated",
    eventSource: "stripe",
    stripeEventId,
    previousState: existingSub || undefined,
    newState: {
      tier,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  logger.info(
    { userId, tier, status: subscription.status },
    "Subscription updated",
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx || prisma;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  // Get user info before update
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Get previous state for audit log
  const previousSub = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { tier: true, status: true },
  });

  // Update subscription to canceled/free
  await db.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
      tier: "free",
    },
  });

  // Send cancellation confirmation email
  if (user?.email) {
    try {
      await emailNotificationService.sendEmail({
        to: user.email,
        subject: "Your guardrail subscription has been cancelled",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Subscription Cancelled</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your guardrail subscription has been cancelled. You've been moved to the Free plan.</p>
            <p>With the Free plan, you still have access to:</p>
            <ul style="padding-left: 20px;">
              <li>3 scans per month</li>
              <li>Basic security analysis</li>
              <li>Community support</li>
            </ul>
            <p>If this was a mistake or you'd like to resubscribe, you can upgrade anytime:</p>
            <p><a href="${getFrontendUrl()}/billing" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Resubscribe</a></p>
            <p>We'd love to hear your feedback on why you cancelled. Reply to this email and let us know how we can improve.</p>
            <p>Best regards,<br>The guardrail Team</p>
          </div>
        `,
        text: `Your guardrail subscription has been cancelled. You've been moved to the Free plan. To resubscribe, visit ${getFrontendUrl()}/billing`,
      });
      logger.info({ userId, email: user.email }, "Cancellation email sent");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), userId }, "Failed to send cancellation email");
    }
  }

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.deleted",
    eventSource: "stripe",
    stripeEventId,
    previousState: previousSub || undefined,
    newState: { tier: "free", status: "canceled" },
  });

  // Audit log for subscription deletion
  await logAdminAction({
    actorUserId: "system", // System-initiated via webhook
    action: "subscription_deleted",
    targetUserId: userId,
    metadata: {
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      previousTier: previousSub?.tier,
      previousStatus: previousSub?.status,
      stripeEventId,
    },
  });

  logger.info({ userId }, "Subscription deleted, reverted to free tier");
}

async function handleSubscriptionPaused(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: "paused" },
  });

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.paused",
    eventSource: "stripe",
    stripeEventId,
  });
}

async function handleSubscriptionResumed(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: subscription.status },
  });

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.resumed",
    eventSource: "stripe",
    stripeEventId,
  });
}

async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  // Get user email for notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user?.email) {
    try {
      const trialEndDate = subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toLocaleDateString()
        : 'soon';
      
      await emailNotificationService.sendEmail({
        to: user.email,
        subject: "Your guardrail trial is ending soon",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your trial is ending ${trialEndDate}</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your guardrail trial will end on ${trialEndDate}. To continue using guardrail, please subscribe to a plan.</p>
            <p><a href="${getFrontendUrl()}/billing" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade Now</a></p>
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <p>Best regards,<br>The guardrail Team</p>
          </div>
        `,
        text: `Your guardrail trial is ending ${trialEndDate}. Visit ${getFrontendUrl()}/billing to upgrade.`,
      });
      logger.info({ userId, email: user.email }, "Trial ending email sent");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), userId }, "Failed to send trial ending email");
      // Don't throw - email failure shouldn't break webhook processing
    }
  }

  await logBillingEvent({
    userId,
    subscriptionId: subscription.id,
    eventType: "customer.subscription.trial_will_end",
    eventSource: "stripe",
    stripeEventId,
    metadata: { trialEnd: subscription.trial_end },
  });

  logger.info(
    { userId, trialEnd: subscription.trial_end },
    "Trial will end soon",
  );
}

// ============================================================================
// INVOICE HANDLERS
// ============================================================================

async function handleInvoiceUpdated(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  await syncInvoiceFromStripe(invoice);
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  await syncInvoiceFromStripe(invoice);

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  // Update subscription period if this is a subscription invoice
  if (invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;

    const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Send renewal confirmation email (not for first invoice)
    if (userId && invoice.billing_reason === 'subscription_cycle') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        try {
          const amount = (invoice.amount_paid / 100).toFixed(2);
          const currency = invoice.currency.toUpperCase();
          const nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          await emailNotificationService.sendEmail({
            to: user.email,
            subject: "Payment received - guardrail subscription renewed",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">Payment Received ✓</h2>
                <p>Hi ${user.name || 'there'},</p>
                <p>We've received your payment of <strong>${currency} ${amount}</strong> for your guardrail subscription. Thank you for your continued support!</p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Invoice:</strong> ${invoice.number || invoice.id}</p>
                  <p style="margin: 8px 0 0 0;"><strong>Next billing date:</strong> ${nextBillingDate}</p>
                </div>
                ${invoice.hosted_invoice_url ? `<p><a href="${invoice.hosted_invoice_url}" style="color: #10b981;">View Invoice</a></p>` : ''}
                <p>Best regards,<br>The guardrail Team</p>
              </div>
            `,
            text: `Payment of ${currency} ${amount} received for your guardrail subscription. Next billing: ${nextBillingDate}`,
          });
          logger.info({ userId, email: user.email }, "Renewal confirmation email sent");
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error), userId }, "Failed to send renewal confirmation email");
        }
      }
    }
  }

  await logBillingEvent({
    userId: userId || undefined,
    invoiceId: invoice.id,
    eventType: "invoice.paid",
    eventSource: "stripe",
    stripeEventId,
    newState: { amount: invoice.amount_paid, currency: invoice.currency },
  });

  logger.info(
    { userId, invoiceId: invoice.id, amount: invoice.amount_paid },
    "Invoice paid",
  );
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  await syncInvoiceFromStripe(invoice);

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  // Update subscription status
  if (invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;

    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: "past_due" },
    });
  }

  // Send email notification about payment failure
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      try {
        await emailNotificationService.sendEmail({
          to: user.email,
          subject: "Payment failed for your guardrail subscription",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Payment Failed</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>We were unable to process the payment for your guardrail subscription. Please update your payment method to avoid service interruption.</p>
              <p><a href="${getFrontendUrl()}/billing" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
              <p>If you have any questions, please contact support.</p>
              <p>Best regards,<br>The guardrail Team</p>
            </div>
          `,
          text: `Payment failed for your guardrail subscription. Please update your payment method at ${getFrontendUrl()}/billing`,
        });
        logger.info({ userId, email: user.email }, "Payment failure email sent");
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error), userId }, "Failed to send payment failure email");
      }
    }
  }

  await logBillingEvent({
    userId: userId || undefined,
    invoiceId: invoice.id,
    eventType: "invoice.payment_failed",
    eventSource: "stripe",
    stripeEventId,
    metadata: { attemptCount: invoice.attempt_count },
  });

  logger.warn({ userId, invoiceId: invoice.id }, "Invoice payment failed");
}

async function handlePaymentActionRequired(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  // Send email with payment link
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email && invoice.hosted_invoice_url) {
      try {
        await emailNotificationService.sendEmail({
          to: user.email,
          subject: "Action required: Complete your guardrail payment",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Payment Action Required</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>Your payment requires additional action. Please complete the payment to continue your guardrail subscription.</p>
              <p><a href="${invoice.hosted_invoice_url}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Complete Payment</a></p>
              <p>If you have any questions, please contact support.</p>
              <p>Best regards,<br>The guardrail Team</p>
            </div>
          `,
          text: `Payment action required. Complete your payment at: ${invoice.hosted_invoice_url}`,
        });
        logger.info({ userId, email: user.email }, "Payment action required email sent");
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error), userId }, "Failed to send payment action required email");
      }
    }
  }

  await logBillingEvent({
    userId: userId || undefined,
    invoiceId: invoice.id,
    eventType: "invoice.payment_action_required",
    eventSource: "stripe",
    stripeEventId,
    metadata: { hostedInvoiceUrl: invoice.hosted_invoice_url },
  });
}

// ============================================================================
// PAYMENT HANDLERS
// ============================================================================

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  await logBillingEvent({
    userId: userId || undefined,
    eventType: "payment_intent.succeeded",
    eventSource: "stripe",
    stripeEventId,
    newState: {
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  });
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  await logBillingEvent({
    userId: userId || undefined,
    eventType: "payment_intent.payment_failed",
    eventSource: "stripe",
    stripeEventId,
    metadata: {
      failureCode: paymentIntent.last_payment_error?.code,
      failureMessage: paymentIntent.last_payment_error?.message,
    },
  });

  logger.warn({ userId, paymentIntentId: paymentIntent.id }, "Payment failed");
}

// ============================================================================
// REFUND & DISPUTE HANDLERS
// ============================================================================

async function handleChargeRefunded(
  charge: Stripe.Charge,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;

  const userId = customerId ? await getUserIdFromCustomer(customerId) : null;

  await logBillingEvent({
    userId: userId || undefined,
    eventType: "charge.refunded",
    eventSource: "stripe",
    stripeEventId,
    newState: {
      refunded: charge.refunded,
      amountRefunded: charge.amount_refunded,
    },
  });

  logger.info(
    { userId, chargeId: charge.id, amountRefunded: charge.amount_refunded },
    "Charge refunded",
  );
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  stripeEventId: string,
  _tx?: Prisma.TransactionClient,
): Promise<void> {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  // Get the charge to find the customer
  let userId: string | null = null;
  if (chargeId && stripe) {
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId =
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer?.id;
    userId = customerId ? await getUserIdFromCustomer(customerId) : null;
  }

  await logBillingEvent({
    userId: userId || undefined,
    eventType: "charge.dispute.created",
    eventSource: "stripe",
    stripeEventId,
    metadata: {
      reason: dispute.reason,
      amount: dispute.amount,
      status: dispute.status,
    },
  });

  logger.warn(
    { userId, disputeId: dispute.id, reason: dispute.reason },
    "Dispute created",
  );
}
