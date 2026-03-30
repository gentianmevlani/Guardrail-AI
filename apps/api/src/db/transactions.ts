/**
 * Transaction Wrappers for Critical Workflows
 * 
 * Centralized transaction logic for multi-step operations that need atomicity
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './index';

// ============================================================================
// SUBSCRIPTION WORKFLOWS
// ============================================================================

export async function createSubscriptionWithStripeCustomer(
  userId: string,
  stripeCustomerId: string,
  subscriptionData: {
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
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update user with Stripe customer ID
    await tx.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });

    // Create subscription
    const subscription = await tx.subscription.create({
      data: {
        userId,
        stripeCustomerId,
        ...subscriptionData,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Create billing event
    await tx.billingEvent.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        eventType: 'subscription.created',
        eventSource: 'system',
        newState: {
          subscriptionId: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
        },
      },
    });

    return subscription;
  });
}

export async function processStripeWebhookEvent(data: {
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

    // Handle specific event types
    if (data.eventType === 'invoice.payment_succeeded' && invoice) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      });
    }

    if (data.eventType === 'customer.subscription.deleted' && subscription) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      });
    }

    return {
      billingEvent,
      user,
      subscription,
      invoice,
    };
  });
}

// ============================================================================
// SCAN WORKFLOWS
// ============================================================================

export async function completeScanWithFindings(
  scanId: string,
  results: {
    verdict: string;
    score: number;
    filesScanned: number;
    linesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    durationMs: number;
    findings: Array<{
      type: string;
      severity: string;
      category: string;
      file: string;
      line: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
      title: string;
      message: string;
      codeSnippet?: string;
      suggestion?: string;
      confidence: number;
      aiGenerated?: boolean;
      status?: string;
      ruleId?: string;
      metadata?: Prisma.InputJsonValue;
    }>;
  }
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update scan with results
    const scan = await tx.scan.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        progress: 100,
        verdict: results.verdict,
        score: results.score,
        filesScanned: results.filesScanned,
        linesScanned: results.linesScanned,
        issuesFound: results.issuesFound,
        criticalCount: results.criticalCount,
        warningCount: results.warningCount,
        infoCount: results.infoCount,
        completedAt: new Date(),
        durationMs: results.durationMs,
      },
    });

    // Create findings in batch
    if (results.findings.length > 0) {
      await tx.finding.createMany({
        data: results.findings.map(f => ({
          scanId,
          type: f.type,
          severity: f.severity,
          category: f.category,
          file: f.file,
          line: f.line,
          column: f.column,
          endLine: f.endLine,
          endColumn: f.endColumn,
          title: f.title,
          message: f.message,
          codeSnippet: f.codeSnippet,
          suggestion: f.suggestion,
          confidence: f.confidence,
          aiGenerated: f.aiGenerated || false,
          status: f.status || 'open',
          ruleId: f.ruleId,
          metadata: f.metadata,
        })),
        skipDuplicates: true,
      });
    }

    return scan;
  });
}

export async function failScan(scanId: string, error: string, durationMs: number) {
  return prisma.scan.update({
    where: { id: scanId },
    data: {
      status: 'failed',
      progress: 0,
      error,
      completedAt: new Date(),
      durationMs,
    },
  });
}

// ============================================================================
// USAGE TRACKING WORKFLOWS
// ============================================================================

export async function trackUsageWithEnforcement(
  userId: string,
  type: string,
  amount: number = 1,
  projectId?: string,
  metadata?: Prisma.InputJsonValue
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Get current period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Check current usage
    const currentUsage = await tx.usageLog.findUnique({
      where: {
        userId_type_periodStart: {
          userId,
          type,
          periodStart,
        },
      },
      select: { count: true },
    });

    const newCount = (currentUsage?.count || 0) + amount;

    // Update usage log
    const usageLog = await tx.usageLog.upsert({
      where: {
        userId_type_periodStart: {
          userId,
          type,
          periodStart,
        },
      },
      update: {
        count: newCount,
        metadata,
      },
      create: {
        userId,
        type,
        count: amount,
        periodStart,
        periodEnd,
        metadata,
      },
    });

    // Create usage record
    await tx.usageRecord.create({
      data: {
        userId,
        projectId,
        type,
        count: amount,
        metadata,
      },
    });

    // Update server-side counter
    const counterField = `${type.toLowerCase()}Count` as keyof any;
    await tx.usageCounter.upsert({
      where: {
        userId_periodStart: {
          userId,
          periodStart,
        },
      },
      update: {
        [counterField]: { increment: amount },
      },
      create: {
        userId,
        periodStart,
        periodEnd,
        [counterField]: amount,
      },
    });

    return {
      usageLog,
      newCount,
      previousCount: currentUsage?.count || 0,
    };
  });
}

// ============================================================================
// LICENSE WORKFLOWS
// ============================================================================

export async function activateLicenseWithValidation(
  keyHash: string,
  fingerprint: string,
  activationData: {
    machineId?: string;
    ipAddress?: string;
    userAgent?: string;
    hostname?: string;
    platform?: string;
  }
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

export async function revokeLicenseKey(licenseKeyId: string, reason: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update license key status
    const licenseKey = await tx.licenseKey.update({
      where: { id: licenseKeyId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Deactivate all activations
    await tx.licenseActivation.updateMany({
      where: { licenseKeyId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    return licenseKey;
  });
}

// ============================================================================
// BILLING WORKFLOWS
// ============================================================================

export async function createInvoiceFromStripe(
  userId: string,
  stripeInvoice: any
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create invoice record
    const invoice = await tx.invoice.create({
      data: {
        userId,
        stripeInvoiceId: stripeInvoice.id,
        stripeCustomerId: stripeInvoice.customer,
        number: stripeInvoice.number,
        status: stripeInvoice.status,
        currency: stripeInvoice.currency,
        subtotal: stripeInvoice.subtotal,
        tax: stripeInvoice.tax,
        total: stripeInvoice.total,
        amountPaid: stripeInvoice.amount_paid,
        amountDue: stripeInvoice.amount_due,
        description: stripeInvoice.description,
        periodStart: new Date(stripeInvoice.period_start * 1000),
        periodEnd: new Date(stripeInvoice.period_end * 1000),
        dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
        invoicePdf: stripeInvoice.invoice_pdf,
      },
    });

    // Create billing event
    await tx.billingEvent.create({
      data: {
        userId,
        invoiceId: invoice.id,
        eventType: 'invoice.created',
        eventSource: 'stripe',
        metadata: {
          stripeInvoiceId: stripeInvoice.id,
          amount: stripeInvoice.total,
        },
      },
    });

    return invoice;
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>,
  options?: {
    timeout?: number;
    isolation?: unknown;
  }
): Promise<T> {
  try {
    return await prisma.$transaction(callback, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new TransactionError(
        `Transaction failed: ${error.message}`,
        'TRANSACTION_ERROR',
        { originalError: error }
      );
    }
    throw error;
  }
}
