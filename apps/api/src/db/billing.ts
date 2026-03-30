/**
 * Billing Data Access Layer
 * 
 * Typed database operations for billing, subscriptions, and payments
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSubscriptionData {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  tier: string;
  status: string;
  priceId?: string;
  quantity?: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateSubscriptionData {
  tier?: string;
  status?: string;
  priceId?: string;
  quantity?: number;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateInvoiceData {
  userId: string;
  subscriptionId?: string;
  stripeInvoiceId?: string;
  stripeCustomerId?: string;
  number?: string;
  status?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  amountPaid?: number;
  amountDue?: number;
  description?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateLicenseKeyData {
  userId: string;
  key: string;
  keyHash: string;
  tier?: string;
  status?: string;
  maxActivations?: number;
  expiresAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateLicenseActivationData {
  licenseKeyId: string;
  fingerprint: string;
  machineId?: string;
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
  platform?: string;
}

// ============================================================================
// USERS
// ============================================================================

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  return user?.stripeCustomerId || null;
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  return prisma.user.findUnique({
    where: { stripeCustomerId },
    select: { id: true, email: true, name: true },
  });
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function createSubscription(data: CreateSubscriptionData) {
  return prisma.subscription.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function getSubscriptionByUserId(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function updateSubscription(id: string, data: UpdateSubscriptionData) {
  return prisma.subscription.update({
    where: { id },
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: UpdateSubscriptionData
) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function cancelSubscription(stripeSubscriptionId: string, immediate: boolean = false) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      cancelAtPeriodEnd: !immediate,
      status: immediate ? 'canceled' : undefined,
    },
  });
}

export async function reactivateSubscription(stripeSubscriptionId: string) {
  return prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: false },
  });
}

// ============================================================================
// LICENSE KEYS
// ============================================================================

export async function createLicenseKey(data: CreateLicenseKeyData) {
  return prisma.licenseKey.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function getLicenseKeyByHash(keyHash: string) {
  return prisma.licenseKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      activationRecords: true,
    },
  });
}

export async function updateLicenseKeyStatus(id: string, status: string, revokedReason?: string) {
  return prisma.licenseKey.update({
    where: { id },
    data: {
      status,
      ...(revokedReason && { revokedReason }),
      ...(status === 'revoked' && { revokedAt: new Date() }),
    },
  });
}

export async function incrementLicenseActivations(id: string) {
  return prisma.licenseKey.update({
    where: { id },
    data: {
      activations: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

export async function updateLicenseKeyLastUsed(id: string) {
  return prisma.licenseKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

export async function getUserLicenseKeys(userId: string) {
  return prisma.licenseKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================================
// LICENSE ACTIVATIONS
// ============================================================================

export async function getLicenseActivation(
  licenseKeyId: string,
  fingerprint: string
) {
  return prisma.licenseActivation.findUnique({
    where: {
      licenseKeyId_fingerprint: {
        licenseKeyId,
        fingerprint,
      },
    },
  });
}

export async function createLicenseActivation(data: CreateLicenseActivationData) {
  return prisma.licenseActivation.create({
    data,
  });
}

export async function updateLicenseActivationLastSeen(id: string) {
  return prisma.licenseActivation.update({
    where: { id },
    data: { lastSeenAt: new Date() },
  });
}

export async function deactivateLicenseActivation(
  licenseKeyId: string,
  fingerprint: string
) {
  return prisma.licenseActivation.updateMany({
    where: {
      licenseKeyId,
      fingerprint,
      isActive: true,
    },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  });
}

export async function decrementLicenseActivations(licenseKeyId: string) {
  return prisma.licenseKey.update({
    where: { id: licenseKeyId },
    data: {
      activations: {
        decrement: 1,
      },
    },
  });
}

// ============================================================================
// INVOICES
// ============================================================================

export async function createInvoice(data: CreateInvoiceData) {
  return prisma.invoice.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function getUserInvoices(userId: string, limit: number = 12) {
  return prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============================================================================
// BILLING EVENTS
// ============================================================================

export async function createBillingEvent(data: {
  userId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  licenseKeyId?: string;
  eventType: string;
  eventSource?: string;
  stripeEventId?: string;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.billingEvent.create({
    data,
  });
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function createSubscriptionWithCustomer(
  userId: string,
  stripeCustomerId: string,
  subscriptionData: Omit<CreateSubscriptionData, 'userId' | 'stripeCustomerId'>
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update user with Stripe customer ID
    await tx.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });

    // Create subscription
    return tx.subscription.create({
      data: {
        ...subscriptionData,
        userId,
        stripeCustomerId,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  });
}

export async function processStripeWebhook(data: {
  eventType: string;
  stripeEventId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  customerId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let user = null;
    let subscription = null;
    let invoice = null;

    // Find user by customer ID if provided
    if (data.customerId) {
      user = await tx.user.findUnique({
        where: { stripeCustomerId: data.customerId },
      });
    }

    // Find subscription if provided
    if (data.subscriptionId) {
      subscription = await tx.subscription.findUnique({
        where: { stripeSubscriptionId: data.subscriptionId },
        include: { user: true },
      });
      user = user || subscription?.user;
    }

    // Find invoice if provided
    if (data.invoiceId) {
      invoice = await tx.invoice.findUnique({
        where: { stripeInvoiceId: data.invoiceId },
        include: { user: true },
      });
      user = user || invoice?.user;
    }

    // Create billing event
    const billingEvent = await tx.billingEvent.create({
      data: {
        userId: user?.id,
        subscriptionId: subscription?.id,
        invoiceId: invoice?.id,
        eventType: data.eventType,
        eventSource: 'stripe',
        stripeEventId: data.stripeEventId,
        metadata: data.metadata,
      },
    });

    return {
      billingEvent,
      user,
      subscription,
      invoice,
    };
  });
}

export async function activateLicenseWithValidation(
  keyHash: string,
  fingerprint: string,
  activationData: Omit<CreateLicenseActivationData, 'licenseKeyId' | 'fingerprint'>
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Get and validate license key
    const licenseKey = await tx.licenseKey.findUnique({
      where: { keyHash },
      include: { activationRecords: true },
    });

    if (!licenseKey) {
      throw new Error('License key not found');
    }

    // Check if already activated on this device
    const existingActivation = await tx.licenseActivation.findUnique({
      where: {
        licenseKeyId_fingerprint: {
          licenseKeyId: licenseKey.id,
          fingerprint,
        },
      },
    });

    if (existingActivation) {
      // Update last seen
      await tx.licenseActivation.update({
        where: { id: existingActivation.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      // Check activation limits
      if (licenseKey.activations >= licenseKey.maxActivations) {
        throw new Error('Maximum activations reached');
      }

      // Create new activation
      await tx.licenseActivation.create({
        data: {
          licenseKeyId: licenseKey.id,
          fingerprint,
          ...activationData,
        },
      });

      // Increment activation count
      await tx.licenseKey.update({
        where: { id: licenseKey.id },
        data: {
          activations: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    // Update last used
    await tx.licenseKey.update({
      where: { id: licenseKey.id },
      data: { lastUsedAt: new Date() },
    });

    return licenseKey;
  });
}
