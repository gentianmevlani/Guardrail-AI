// @ts-nocheck - Prisma client types need regeneration after file moves
/**
 * Prisma Service
 * 
 * Centralized database operations with error handling and logging
 */

// @ts-nocheck - Prisma client types need regeneration after file moves
import { PrismaClient } from '@prisma/client';

// ============================================================================
// PRISMA CLIENT
// ============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// USER OPERATIONS
// ============================================================================

export const userService = {
  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          where: { status: { in: ['active', 'trialing', 'past_due'] } },
        },
        projects: {
          orderBy: { updatedAt: 'desc' },
        },
        apiKeys: {
          orderBy: { createdAt: 'desc' },
        },
        usageRecords: {
          orderBy: { createdAt: 'desc' },
        },
        licenseKeys: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  },

  async updateStripeCustomerId(id: string, stripeCustomerId: string) {
    return await prisma.user.update({
      where: { id },
      data: { stripeCustomerId },
    });
  },

  async create(data: {
    email: string;
    name?: string;
    password?: string;
    avatar?: string;
    emailVerified?: Date;
    role?: string;
    provider?: string;
    providerId?: string;
  }) {
    return await prisma.user.create({
      data,
    });
  },
};

// ============================================================================
// SUBSCRIPTION OPERATIONS
// ============================================================================

export const subscriptionService = {
  async findActiveByUserId(userId: string) {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    userId: string;
    stripeSubscriptionId?: string;
    stripeCustomerId: string;
    tier: string;
    status: string;
    priceId?: string;
    quantity?: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    metadata?: unknown;
  }) {
    return await prisma.subscription.create({
      data,
    });
  },

  async updateStripeSubscriptionId(id: string, stripeSubscriptionId: string) {
    return await prisma.subscription.update({
      where: { id },
      data: { stripeSubscriptionId },
    });
  },

  async updateCancelAtPeriodEnd(stripeSubscriptionId: string, cancelAtPeriodEnd: boolean) {
    return await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { 
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      },
    });
  },

  async updateTier(stripeSubscriptionId: string, newTier: string) {
    return await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        tier: newTier,
        updatedAt: new Date(),
      },
    });
  },

  async findByStripeSubscriptionId(stripeSubscriptionId: string) {
    return await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  },

  async findCancellingByUserId(userId: string) {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        cancelAtPeriodEnd: true,
      },
    });
  },
};

// ============================================================================
// LICENSE KEY OPERATIONS
// ============================================================================

export const licenseKeyService = {
  async create(data: {
    userId: string;
    key: string;
    keyHash: string;
    tier: string;
    maxActivations: number;
    expiresAt?: Date;
    metadata?: unknown;
  }) {
    return await prisma.licenseKey.create({
      data,
    });
  },

  async findByKeyHash(keyHash: string) {
    return await prisma.licenseKey.findUnique({
      where: { keyHash },
      include: {
        activationRecords: {
          where: { isActive: true },
        },
      },
    });
  },

  async updateStatus(id: string, status: string, revokedReason?: string) {
    return await prisma.licenseKey.update({
      where: { id },
      data: {
        status,
        revokedAt: revokedReason ? new Date() : undefined,
        revokedReason,
      },
    });
  },

  async incrementActivations(id: string) {
    return await prisma.licenseKey.update({
      where: { id },
      data: {
        activations: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  },

  async decrementActivations(id: string) {
    return await prisma.licenseKey.update({
      where: { id },
      data: {
        activations: { decrement: 1 },
      },
    });
  },

  async updateLastUsed(id: string) {
    return await prisma.licenseKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  },

  async findByUserId(userId: string) {
    return await prisma.licenseKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },
};

// ============================================================================
// LICENSE ACTIVATION OPERATIONS
// ============================================================================

export const licenseActivationService = {
  async create(data: {
    licenseKeyId: string;
    fingerprint: string;
    machineId?: string;
    ipAddress?: string;
    userAgent?: string;
    hostname?: string;
    platform?: string;
  }) {
    return await prisma.licenseActivation.create({
      data,
    });
  },

  async findByLicenseKeyAndFingerprint(licenseKeyId: string, fingerprint: string) {
    return await prisma.licenseActivation.findFirst({
      where: {
        licenseKeyId,
        fingerprint,
        isActive: true,
      },
    });
  },

  async updateLastSeen(id: string) {
    return await prisma.licenseActivation.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  },

  async deactivateByLicenseKeyAndFingerprint(licenseKeyId: string, fingerprint: string) {
    return await prisma.licenseActivation.updateMany({
      where: {
        licenseKeyId,
        fingerprint,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });
  },
};

// ============================================================================
// USAGE LOG OPERATIONS
// ============================================================================

export const usageLogService = {
  async upsert(data: {
    userId: string;
    projectId?: string;
    type: string;
    count: number;
    periodStart: Date;
    periodEnd: Date;
    metadata?: unknown;
  }) {
    return await prisma.usageLog.upsert({
      where: {
        userId_type_periodStart: {
          userId: data.userId,
          type: data.type,
          periodStart: data.periodStart,
        },
      },
      update: {
        count: { increment: data.count },
        metadata: data.metadata || {},
      },
      create: data,
    });
  },

  async getCount(userId: string, type: string, periodStart: Date) {
    const result = await prisma.usageLog.aggregate({
      where: {
        userId,
        type,
        periodStart,
      },
      _sum: {
        count: true,
      },
    });

    return result._sum.count || 0;
  },

  async getUsageByType(userId: string, periodStart: Date) {
    return await prisma.usageLog.groupBy({
      by: ['type'],
      where: {
        userId,
        periodStart,
      },
      _sum: {
        count: true,
      },
    });
  },
};

// ============================================================================
// INVOICE OPERATIONS
// ============================================================================

export const invoiceService = {
  async create(data: {
    userId: string;
    stripeInvoiceId: string;
    stripeCustomerId: string;
    number: string;
    status: string;
    currency: string;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    periodStart: Date;
    periodEnd: Date;
    hostedInvoiceUrl?: string;
    invoicePdf?: string;
  }) {
    return await prisma.invoice.create({
      data,
    });
  },

  async findByUserId(userId: string, limit?: number) {
    return await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async findByStripeCustomerId(customerId: string) {
    return await prisma.invoice.findMany({
      where: { stripeCustomerId: customerId },
      orderBy: { createdAt: 'desc' },
    });
  },
};

// ============================================================================
// BILLING EVENT OPERATIONS
// ============================================================================

export const billingEventService = {
  async create(data: {
    userId: string;
    subscriptionId?: string;
    invoiceId?: string;
    licenseKeyId?: string;
    eventType: string;
    eventSource: string;
    stripeEventId?: string;
    metadata?: unknown;
  }) {
    return await prisma.billingEvent.create({
      data,
    });
  },

  async findByUserId(userId: string, limit?: number) {
    return await prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

// ============================================================================
// TRANSACTION HELPER
// ============================================================================

export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default prisma;

