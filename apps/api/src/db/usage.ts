/**
 * Usage Data Access Layer
 * 
 * Typed database operations for usage tracking and enforcement
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateUsageRecordData {
  userId: string;
  projectId?: string;
  type: string;
  count?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateUsageLogData {
  userId: string;
  projectId?: string;
  type: string;
  count?: number;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateUsageCounterData {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  scanCount?: number;
  realityCount?: number;
  agentCount?: number;
  gateCount?: number;
  fixCount?: number;
}

export interface CreateUsageTokenData {
  userId: string;
  tokenHash: string;
  signature: string;
  payload: any;
  issuedAt: Date;
  expiresAt: Date;
}

export interface UsageFilters {
  type?: string;
  periodStart?: Date;
  periodEnd?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// USAGE RECORDS
// ============================================================================

export async function createUsageRecord(data: CreateUsageRecordData) {
  return prisma.usageRecord.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      project: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function getUsageRecordsByUserId(
  userId: string,
  filters: UsageFilters = {}
) {
  const { type, periodStart, periodEnd, limit = 50, offset = 0 } = filters;
  
  const where: any = { userId };
  if (type) where.type = type;
  if (periodStart) where.createdAt = { ...where.createdAt, gte: periodStart };
  if (periodEnd) where.createdAt = { ...where.createdAt, lte: periodEnd };

  const [records, total] = await Promise.all([
    prisma.usageRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.usageRecord.count({ where }),
  ]);

  return { records, total };
}

export async function getUsageRecordsByProjectId(projectId: string) {
  return prisma.usageRecord.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================================
// USAGE LOGS (Metered Billing)
// ============================================================================

export async function upsertUsageLog(data: CreateUsageLogData) {
  return prisma.usageLog.upsert({
    where: {
      userId_type_periodStart: {
        userId: data.userId,
        type: data.type,
        periodStart: data.periodStart,
      },
    },
    update: {
      count: { increment: data.count || 1 },
      metadata: data.metadata,
    },
    create: data,
  });
}

export async function getUsageLogsByUserId(
  userId: string,
  filters: UsageFilters = {}
) {
  const { type, periodStart, periodEnd, limit = 50, offset = 0 } = filters;
  
  const where: any = { userId };
  if (type) where.type = type;
  if (periodStart) where.periodStart = { gte: periodStart };
  if (periodEnd) where.periodEnd = { lte: periodEnd };

  const [logs, total] = await Promise.all([
    prisma.usageLog.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.usageLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getCurrentUsageCount(
  userId: string,
  type: string,
  periodStart: Date
) {
  const usageLog = await prisma.usageLog.findUnique({
    where: {
      userId_type_periodStart: {
        userId,
        type,
        periodStart,
      },
    },
    select: { count: true },
  });

  return usageLog?.count || 0;
}

export async function getUserUsageSummary(userId: string, periodStart: Date) {
  return prisma.usageLog.findMany({
    where: {
      userId,
      periodStart,
    },
    select: {
      type: true,
      count: true,
    },
  });
}

// ============================================================================
// USAGE COUNTERS (Server-side tracking)
// ============================================================================

export async function createOrUpdateUsageCounter(data: CreateUsageCounterData) {
  return prisma.usageCounter.upsert({
    where: {
      userId_periodStart: {
        userId: data.userId,
        periodStart: data.periodStart,
      },
    },
    update: {
      scanCount: { increment: data.scanCount || 0 },
      realityCount: { increment: data.realityCount || 0 },
      agentCount: { increment: data.agentCount || 0 },
      gateCount: { increment: data.gateCount || 0 },
      fixCount: { increment: data.fixCount || 0 },
    },
    create: data,
  });
}

export async function incrementUsageCounter(
  userId: string,
  periodStart: Date,
  type: 'scanCount' | 'realityCount' | 'agentCount' | 'gateCount' | 'fixCount',
  increment: number = 1
) {
  return prisma.usageCounter.update({
    where: {
      userId_periodStart: {
        userId,
        periodStart,
      },
    },
    data: {
      [type]: { increment: increment },
    },
  });
}

export async function getUsageCounter(userId: string, periodStart: Date) {
  return prisma.usageCounter.findUnique({
    where: {
      userId_periodStart: {
        userId,
        periodStart,
      },
    },
  });
}

export async function getUsageCountersByUserId(userId: string, limit: number = 12) {
  return prisma.usageCounter.findMany({
    where: { userId },
    orderBy: { periodStart: 'desc' },
    take: limit,
  });
}

// ============================================================================
// USAGE TOKENS (Offline tracking)
// ============================================================================

export async function createUsageToken(data: CreateUsageTokenData) {
  return prisma.usageToken.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function validateUsageToken(tokenHash: string) {
  return prisma.usageToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function revokeUsageToken(tokenHash: string) {
  return prisma.usageToken.update({
    where: { tokenHash },
    data: { revoked: true },
  });
}

export async function cleanupExpiredTokens() {
  return prisma.usageToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

// ============================================================================
// OFFLINE USAGE QUEUE
// ============================================================================

export async function queueOfflineUsage(data: {
  userId: string;
  actionType: string;
  count?: number;
  machineId?: string;
}) {
  return prisma.offlineUsageQueue.create({
    data,
  });
}

export async function getOfflineUsageQueue(userId: string) {
  return prisma.offlineUsageQueue.findMany({
    where: {
      userId,
      synced: false,
    },
    orderBy: { queuedAt: 'asc' },
  });
}

export async function markOfflineUsageSynced(ids: string[]) {
  return prisma.offlineUsageQueue.updateMany({
    where: { id: { in: ids } },
    data: {
      synced: true,
      syncedAt: new Date(),
    },
  });
}

// ============================================================================
// TRANSACTIONS
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
    await tx.usageCounter.upsert({
      where: {
        userId_periodStart: {
          userId,
          periodStart,
        },
      },
      update: {
        [`${type.toLowerCase()}Count`]: { increment: amount },
      },
      create: {
        userId,
        periodStart,
        periodEnd,
        [`${type.toLowerCase()}Count`]: amount,
      },
    });

    return {
      usageLog,
      newCount,
      previousCount: currentUsage?.count || 0,
    };
  });
}

export async function processOfflineUsageQueue(userId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Get pending offline usage
    const pendingUsage = await tx.offlineUsageQueue.findMany({
      where: {
        userId,
        synced: false,
      },
      orderBy: { queuedAt: 'asc' },
    });

    if (pendingUsage.length === 0) {
      return { processed: 0, items: [] };
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Group by action type
    const groupedUsage = pendingUsage.reduce<Record<string, number>>((acc, item) => {
      if (!acc[item.actionType]) {
        acc[item.actionType] = 0;
      }
      acc[item.actionType] += item.count;
      return acc;
    }, {} as Record<string, number>);

    // Process each action type
    const processedItems = [];
    for (const [actionType, totalAmount] of Object.entries(groupedUsage)) {
      // Update usage log
      await tx.usageLog.upsert({
        where: {
          userId_type_periodStart: {
            userId,
            type: actionType,
            periodStart,
          },
        },
        update: {
          count: { increment: totalAmount },
        },
        create: {
          userId,
          type: actionType,
          count: totalAmount,
          periodStart,
          periodEnd,
        },
      });

      // Create usage records
      await tx.usageRecord.createMany({
        data: pendingUsage
          .filter(item => item.actionType === actionType)
          .map(item => ({
            userId,
            type: item.actionType,
            count: item.count,
            metadata: {
              machineId: item.machineId,
              queuedAt: item.queuedAt,
              syncedAt: new Date(),
            },
          })),
      });

      processedItems.push({
        actionType,
        amount: totalAmount,
        items: pendingUsage.filter(item => item.actionType === actionType).length,
      });
    }

    // Mark all as synced
    const itemIds = pendingUsage.map(item => item.id);
    await tx.offlineUsageQueue.updateMany({
      where: { id: { in: itemIds } },
      data: {
        synced: true,
        syncedAt: new Date(),
      },
    });

    return {
      processed: pendingUsage.length,
      items: processedItems,
    };
  });
}

export async function resetUsageCounters(userId: string, periodStart: Date) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Reset usage counter
    await tx.usageCounter.update({
      where: {
        userId_periodStart: {
          userId,
          periodStart,
        },
      },
      data: {
        scanCount: 0,
        realityCount: 0,
        agentCount: 0,
        gateCount: 0,
        fixCount: 0,
      },
    });

    // Get all usage logs for this period
    const usageLogs = await tx.usageLog.findMany({
      where: {
        userId,
        periodStart,
      },
    });

    return usageLogs;
  });
}
