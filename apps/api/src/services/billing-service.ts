/**
 * Billing Service
 *
 * Core billing logic for guardrail monetization.
 * Handles Stripe integration, license keys, usage metering, and tier management.
 * 
 * NOTE: Tier definitions are imported from @guardrail/core/tier-config
 * DO NOT define tier configurations here - use the shared config.
 */

import { pool, prisma as prismaClient } from "@guardrail/database";
import crypto from "crypto";
import Stripe from "stripe";
import { getRequestId } from "../lib/request-context";
import { logger } from "../logger";

// Cast prisma to any to handle fields that may not be in generated client yet
// These fields exist in schema.prisma but client may need regeneration
const prisma = prismaClient as any;

// Import canonical tier config from shared module
import {
    PurchasableTier,
    TIER_CONFIG,
    Tier,
    getStripePriceId,
    getTierConfig,
    isValidTier
} from "@guardrail/core";

// Re-export for consumers
export { TIER_CONFIG, getTierConfig, isValidTier };
export type { PurchasableTier, Tier };

// ============================================================================
// CONFIGURATION
// ============================================================================

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

// Legacy PRICING_TIERS export for backward compatibility
// @deprecated Use TIER_CONFIG from @guardrail/core instead
export const PRICING_TIERS = TIER_CONFIG;

// ============================================================================
// STRIPE CUSTOMER MANAGEMENT
// ============================================================================

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Check for existing customer
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new customer with request context logging
  const requestId = getRequestId();
  logger.debug({ requestId, userId }, "Creating Stripe customer");
  
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { 
      userId,
      requestId, // Include requestId in metadata for traceability
    },
  });

  // Save to database
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  await logBillingEvent({
    userId,
    eventType: "customer.created",
    eventSource: "system",
    newState: { customerId: customer.id, email },
  });

  return customer.id;
}

// ============================================================================
// CHECKOUT & SUBSCRIPTIONS
// ============================================================================

export interface CreateCheckoutOptions {
  userId: string;
  email: string;
  tier: PurchasableTier;
  interval: "month" | "year";
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  quantity?: number; // For team seats
}

export async function createCheckoutSession(
  options: CreateCheckoutOptions,
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const {
    userId,
    email,
    tier,
    interval,
    successUrl,
    cancelUrl,
    trialDays,
    quantity,
  } = options;

  const priceId = getStripePriceId(tier, interval === "year" ? "year" : "month");

  if (!priceId) {
    throw new Error(`Price ID not configured for ${tier} ${interval}`);
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: quantity || 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId,
        tier,
      },
      ...(trialDays && { trial_period_days: trialDays }),
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    tax_id_collection: { enabled: true },
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  await logBillingEvent({
    userId,
    eventType: "checkout.session.created",
    eventSource: "user",
    metadata: { sessionId: session.id, tier, interval },
  });

  return session.url!;
}

export async function createCustomerPortalSession(
  userId: string,
  returnUrl: string,
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  let customerId = user?.stripeCustomerId;

  if (!customerId) {
    // Create new Stripe customer if none exists
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    customerId = customer.id;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export interface SubscriptionInfo {
  id: string;
  tier: Tier;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  quantity: number;
}

interface SubscriptionRow {
  id: string;
  tier: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  quantity: number;
}

export async function getSubscription(
  userId: string,
): Promise<SubscriptionInfo | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    tier: subscription.tier as Tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEnd: subscription.trialEnd,
    quantity: subscription.quantity || 1,
  };
}

export async function getUserTier(userId: string): Promise<Tier> {
  const subscription = await getSubscription(userId);
  return subscription?.tier || "free";
}

export async function cancelSubscription(
  userId: string,
  immediate: boolean = false,
): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const stripeSubId = subscription?.stripeSubscriptionId;
  if (!stripeSubId) {
    throw new Error("No active subscription found");
  }

  if (immediate) {
    await stripe.subscriptions.cancel(stripeSubId);
  } else {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });
  }

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: stripeSubId },
    data: {
      cancelAtPeriodEnd: !immediate,
      updatedAt: new Date(),
    },
  });

  await logBillingEvent({
    userId,
    subscriptionId: stripeSubId,
    eventType: immediate
      ? "subscription.canceled"
      : "subscription.cancel_scheduled",
    eventSource: "user",
  });
}

export async function reactivateSubscription(userId: string): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      cancelAtPeriodEnd: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const stripeSubId = subscription?.stripeSubscriptionId;
  if (!stripeSubId) {
    throw new Error("No subscription pending cancellation");
  }

  await stripe.subscriptions.update(stripeSubId, {
    cancel_at_period_end: false,
  });

  await prisma.subscription.update({
    where: { stripeSubscriptionId: stripeSubId },
    data: {
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    },
  });

  await logBillingEvent({
    userId,
    subscriptionId: stripeSubId,
    eventType: "subscription.reactivated",
    eventSource: "user",
  });
}

// ============================================================================
// PRORATION & PLAN CHANGES
// ============================================================================

export async function changePlan(
  userId: string,
  newTier: PurchasableTier,
  interval: "month" | "year",
): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    throw new Error("No active subscription found");
  }

  const stripeSub = await stripe.subscriptions.retrieve(
    sub.stripeSubscriptionId,
  );
  const subscriptionItemId = stripeSub.items.data[0].id;

  const newPriceId = getStripePriceId(newTier, interval === "year" ? "year" : "month");

  if (!newPriceId) {
    throw new Error(`Price ID not configured for ${newTier} ${interval}`);
  }

  // Determine if upgrade or downgrade using canonical tier order
  const { TIER_ORDER } = await import("@guardrail/core");
  const isUpgrade =
    TIER_ORDER.indexOf(newTier as Tier) > TIER_ORDER.indexOf(sub.tier as Tier);

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [
      {
        id: subscriptionItemId,
        price: newPriceId,
      },
    ],
    proration_behavior: isUpgrade ? "create_prorations" : "none",
  });

  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.stripeSubscriptionId },
    data: {
      tier: newTier,
      updatedAt: new Date(),
    },
  });

  await logBillingEvent({
    userId,
    subscriptionId: sub.stripeSubscriptionId,
    eventType: isUpgrade ? "subscription.upgraded" : "subscription.downgraded",
    eventSource: "user",
    previousState: { tier: sub.tier },
    newState: { tier: newTier, interval },
  });
}

// ============================================================================
// LICENSE KEY SYSTEM
// ============================================================================

const LICENSE_KEY_PREFIX = "CG";

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }
  return `${LICENSE_KEY_PREFIX}-${segments.join("-")}`;
}

function hashLicenseKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export interface CreateLicenseKeyOptions {
  userId: string;
  tier: Tier;
  maxActivations?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export async function createLicenseKey(
  options: CreateLicenseKeyOptions,
): Promise<string> {
  const { userId, tier, maxActivations = 3, expiresAt, metadata } = options;

  const key = generateLicenseKey();
  const keyHash = hashLicenseKey(key);

  await prisma.licenseKey.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      key,
      keyHash,
      tier,
      maxActivations,
      expiresAt,
      metadata: metadata || {},
    },
  });

  await logBillingEvent({
    userId,
    eventType: "license_key.created",
    eventSource: "system",
    metadata: { tier, maxActivations },
  });

  return key;
}

export interface ValidateLicenseResult {
  valid: boolean;
  tier?: Tier;
  reason?: string;
  expiresAt?: Date;
  activationsRemaining?: number;
}

interface LicenseKeyRow {
  id: string;
  userId: string;
  tier: string;
  status: string;
  activations: number;
  maxActivations: number;
  expiresAt: Date | null;
}

export async function validateLicenseKey(
  key: string,
  fingerprint?: string,
  activationData?: {
    machineId?: string;
    ipAddress?: string;
    userAgent?: string;
    hostname?: string;
    platform?: string;
  },
): Promise<ValidateLicenseResult> {
  const keyHash = hashLicenseKey(key);

  const license = await prisma.licenseKey.findUnique({
    where: { keyHash },
  });

  if (!license) {
    return { valid: false, reason: "Invalid license key" };
  }

  // Check status
  if (license.status !== "active") {
    return { valid: false, reason: `License key is ${license.status}` };
  }

  // Check expiration
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    await prisma.licenseKey.update({
    where: { id: license.id },
    data: { status: 'expired' },
  });
    return { valid: false, reason: "License key has expired" };
  }

  // Handle activation if fingerprint provided
  if (fingerprint) {
    // Check if already activated on this device
    const existingActivation = await prisma.licenseActivation.findFirst({
      where: {
        licenseKeyId: license.id,
        fingerprint,
        isActive: true,
      },
    });

    if (existingActivation) {
      // Update last seen
      await prisma.licenseActivation.update({
        where: { id: existingActivation.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      // Check activation limit
      if (license.activations >= license.maxActivations) {
        return {
          valid: false,
          reason: "Maximum activations reached",
          activationsRemaining: 0,
        };
      }

      // Create new activation
      await prisma.licenseActivation.create({
        data: {
          id: crypto.randomUUID(),
          licenseKeyId: license.id,
          fingerprint,
          machineId: activationData?.machineId,
          ipAddress: activationData?.ipAddress,
          userAgent: activationData?.userAgent,
          hostname: activationData?.hostname,
          platform: activationData?.platform,
        },
      });

      // Increment activation count
      await prisma.licenseKey.update({
        where: { id: license.id },
        data: {
          activations: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }
  }

  // Update last used
  await prisma.licenseKey.update({
    where: { id: license.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    tier: license.tier as Tier,
    expiresAt: license.expiresAt,
    activationsRemaining: license.maxActivations - license.activations,
  };
}

export async function revokeLicenseKey(
  licenseKeyId: string,
  reason: string,
): Promise<void> {
  const license = await prisma.licenseKey.update({
    where: { id: licenseKeyId },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });

  await logBillingEvent({
    userId: license.userId,
    licenseKeyId,
    eventType: "license_key.revoked",
    eventSource: "admin",
    metadata: { reason },
  });
}

export async function deactivateLicenseActivation(
  licenseKeyId: string,
  fingerprint: string,
): Promise<void> {
  await prisma.licenseActivation.updateMany({
    where: {
      licenseKeyId,
      fingerprint,
    },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  });

  // Decrement activation count
  const license = await prisma.licenseKey.findUnique({
    where: { id: licenseKeyId },
  });
  if (license && license.activations > 0) {
    await prisma.licenseKey.update({
      where: { id: licenseKeyId },
      data: { activations: license.activations - 1 },
    });
  }
}

export async function getUserLicenseKeys(userId: string) {
  return await prisma.licenseKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      key: true,
      tier: true,
      status: true,
      activations: true,
      maxActivations: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
}

// ============================================================================
// USAGE METERING
// ============================================================================

function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export type UsageType = "scan" | "reality_run" | "ai_agent_run" | "api_call";

export async function trackUsage(
  userId: string,
  type: UsageType,
  count: number = 1,
  projectId?: string,
  metadata?: Record<string, unknown>,
): Promise<{ current: number; limit: number; isOverLimit: boolean }> {
  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();

  // Upsert usage
  await prisma.usageLog.upsert({
    where: {
      userId_type_periodStart: {
        userId,
        type,
        periodStart,
      },
    },
    update: {
      count: { increment: count },
      metadata: metadata || {},
    },
    create: {
      id: crypto.randomUUID(),
      userId,
      projectId,
      type,
      count,
      periodStart,
      periodEnd,
      metadata: metadata || {},
    },
  });

  // Get current usage
  const usageLog = await prisma.usageLog.findUnique({
    where: {
      userId_type_periodStart: {
        userId,
        type,
        periodStart,
      },
    },
  });

  const current = usageLog?.count || 0;

  // Get user's tier and limits
  const tier = await getUserTier(userId);
  const tierConfig = TIER_CONFIG[tier];
  const limit = type === "scan" ? tierConfig.limits.scansPerMonth : -1;

  return {
    current,
    limit,
    isOverLimit: limit !== -1 && current > limit,
  };
}

export async function getUsageSummary(userId: string): Promise<{
  tier: Tier;
  period: { start: Date; end: Date };
  usage: Record<
    UsageType,
    { count: number; limit: number; percentage: number }
  >;
}> {
  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();
  const tier = await getUserTier(userId);
  const tierConfig = TIER_CONFIG[tier];

  const usageLogs = await prisma.usageLog.findMany({
    where: {
      userId,
      periodStart,
    },
    select: {
      type: true,
      count: true,
    },
  });

  const usageMap: Record<string, number> = {};
  for (const log of usageLogs) {
    usageMap[log.type] = log.count;
  }

  const types: UsageType[] = [
    "scan",
    "reality_run",
    "ai_agent_run",
    "api_call",
  ];
  const usage: Record<
    string,
    { count: number; limit: number; percentage: number }
  > = {};

  for (const type of types) {
    const count = usageMap[type] || 0;
    const limit = type === "scan" ? tierConfig.limits.scansPerMonth : -1;
    usage[type] = {
      count,
      limit,
      percentage:
        limit === -1 ? 0 : Math.min(100, Math.round((count / limit) * 100)),
    };
  }

  return {
    tier,
    period: { start: periodStart, end: periodEnd },
    usage: usage as Record<
      UsageType,
      { count: number; limit: number; percentage: number }
    >,
  };
}

export async function checkUsageLimit(
  userId: string,
  type: UsageType,
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  upgradePrompt?: string;
}> {
  const tier = await getUserTier(userId);
  const tierConfig = TIER_CONFIG[tier];
  const limit = type === "scan" ? tierConfig.limits.scansPerMonth : -1;

  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  const { start: periodStart } = getCurrentBillingPeriod();

  const usageLog = await prisma.usageLog.findUnique({
    where: {
      userId_type_periodStart: {
        userId,
        type,
        periodStart,
      },
    },
  });

  const current = usageLog?.count || 0;

  if (current >= limit) {
    return {
      allowed: false,
      current,
      limit,
      upgradePrompt:
        tier === "free"
          ? "Upgrade to Pro for unlimited scans at $19/month"
          : "Contact support to increase your limits",
    };
  }

  return { allowed: true, current, limit };
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getInvoices(userId: string, limit: number = 12) {
  return await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      currency: true,
      periodStart: true,
      periodEnd: true,
      paidAt: true,
      hostedInvoiceUrl: true,
      invoicePdf: true,
      createdAt: true,
    },
  });
}

export async function syncInvoiceFromStripe(
  stripeInvoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof stripeInvoice.customer === "string"
      ? stripeInvoice.customer
      : stripeInvoice.customer?.id;

  // Get user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) {
    logger.warn({ customerId }, "No user found for Stripe customer");
    return;
  }

  const userId = user.id;

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: stripeInvoice.id },
    update: {
      status: stripeInvoice.status,
      amountPaid: stripeInvoice.amount_paid,
      amountDue: stripeInvoice.amount_due,
      paidAt: stripeInvoice.status === "paid" ? new Date() : null,
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      userId,
      stripeInvoiceId: stripeInvoice.id,
      stripeCustomerId: customerId,
      number: stripeInvoice.number,
      status: stripeInvoice.status,
      currency: stripeInvoice.currency,
      subtotal: stripeInvoice.subtotal,
      tax: stripeInvoice.tax || 0,
      total: stripeInvoice.total,
      amountPaid: stripeInvoice.amount_paid,
      amountDue: stripeInvoice.amount_due,
      periodStart: stripeInvoice.period_start
        ? new Date(stripeInvoice.period_start * 1000)
        : null,
      periodEnd: stripeInvoice.period_end
        ? new Date(stripeInvoice.period_end * 1000)
        : null,
      dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
      paidAt: stripeInvoice.status === "paid" ? new Date() : null,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
      invoicePdf: stripeInvoice.invoice_pdf,
    },
  });
}

// ============================================================================
// BILLING EVENTS (AUDIT TRAIL)
// ============================================================================

interface LogBillingEventOptions {
  userId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  licenseKeyId?: string;
  eventType: string;
  eventSource: "stripe" | "system" | "admin" | "user";
  stripeEventId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logBillingEvent(
  options: LogBillingEventOptions,
): Promise<void> {
  try {
    await prisma.billingEvent.create({
      data: {
        id: crypto.randomUUID(),
        userId: options.userId,
        subscriptionId: options.subscriptionId,
        invoiceId: options.invoiceId,
        licenseKeyId: options.licenseKeyId,
        eventType: options.eventType,
        eventSource: options.eventSource,
        stripeEventId: options.stripeEventId,
        previousState: options.previousState || {},
        newState: options.newState || {},
        metadata: options.metadata || {},
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });
  } catch (error) {
    logger.error({ error, options }, "Failed to log billing event");
  }
}

export async function getBillingEvents(
  userId: string,
  options: { limit?: number; eventTypes?: string[] } = {},
) {
  const { limit = 50, eventTypes } = options;

  const whereClause: any = { userId };
  if (eventTypes && eventTypes.length > 0) {
    whereClause.eventType = { in: eventTypes };
  }

  return await prisma.billingEvent.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============================================================================
// TEAM SEATS
// ============================================================================

export async function getTeamSeats(subscriptionId: string) {
  return await prisma.teamSeat.findMany({
    where: { subscriptionId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function inviteTeamMember(
  subscriptionId: string,
  email: string,
  role: "admin" | "member" = "member",
): Promise<void> {
  // Check seat limit
  const subResult = await pool.query<{ tier: Tier; quantity: number }>(
    "SELECT tier, quantity FROM subscriptions WHERE id = $1",
    [subscriptionId],
  );

  if (subResult.rows.length === 0) {
    throw new Error("Subscription not found");
  }

  const { tier, quantity } = subResult.rows[0];
  const maxSeats = PRICING_TIERS[tier as Tier].limits.teamMembers;

  if (maxSeats !== -1) {
    const seatCount = await pool.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM team_seats 
       WHERE "subscriptionId" = $1 AND status != 'removed'`,
      [subscriptionId],
    );

    if (seatCount.rows[0].count >= maxSeats * quantity) {
      throw new Error("Team seat limit reached");
    }
  }

  await pool.query(
    `INSERT INTO team_seats (id, "subscriptionId", email, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("subscriptionId", email)
     DO UPDATE SET role = $4, status = 'pending', "invitedAt" = NOW()`,
    [crypto.randomUUID(), subscriptionId, email, role],
  );
}

export async function acceptTeamInvite(
  email: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `UPDATE team_seats 
     SET "userId" = $1, status = 'active', "acceptedAt" = NOW()
     WHERE email = $2 AND status = 'pending'`,
    [userId, email],
  );
}

export async function removeTeamMember(
  subscriptionId: string,
  seatId: string,
): Promise<void> {
  await pool.query(
    `UPDATE team_seats SET status = 'removed' 
     WHERE id = $1 AND "subscriptionId" = $2`,
    [seatId, subscriptionId],
  );
}
