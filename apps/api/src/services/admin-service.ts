/**
 * Admin & Support Ops Service
 * 
 * Core service for administrative operations including:
 * - User management and debugging
 * - Audit logging for all admin actions
 * - Impersonation support with full audit trail
 * - Broadcast email system
 * - Support notes and internal communication
 */

import { prisma as prismaClient } from "@guardrail/database";
import { mfaService } from "./mfa-service";
import { z } from "zod";
import { logger } from "../logger";
import { generateToken, verifyToken } from "../middleware/fastify-auth";

// Cast prisma to any to handle models/fields that may not be in generated client yet
const prisma = prismaClient as any;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionTier?: string;
  lastLoginAt?: Date;
  emailVerified?: Date | null;
  createdAt: Date;
  isActive: boolean;
  flags: UserFlags;
}

export interface UserFlags {
  isDisabled: boolean;
  requiresMfaReset: boolean;
  hasPendingIssues: boolean;
  subscriptionIssues: boolean;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUserId: string;
  action: string;
  targetUserId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ImpersonationSession {
  id: string;
  actorUserId: string;
  targetUserId: string;
  startedAt: Date;
  endedAt?: Date;
  reason: string;
  impersonationToken: string;
  isActive: boolean;
}

export interface BroadcastJob {
  id: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  audienceFilter: AudienceFilter;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalRecipients?: number;
  sentCount: number;
  failedCount: number;
  errorMessage?: string;
}

export interface AudienceFilter {
  tiers?: string[];
  roles?: string[];
  verifiedOnly?: boolean;
  activeOnly?: boolean;
  customUserIds?: string[];
}

export interface SupportNote {
  id: string;
  actorUserId: string;
  targetUserId: string;
  note: string;
  createdAt: Date;
  isInternal: boolean;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UserQuerySchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['user', 'admin', 'support']).optional(),
  tier: z.string().optional(),
  status: z.enum(['active', 'disabled', 'all']).default('active'),
});

const ImpersonationStartSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason too long"),
});

const BroadcastCreateSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  htmlContent: z.string().min(1, "HTML content is required"),
  textContent: z.string().optional(),
  audienceFilter: z.object({
    tiers: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    verifiedOnly: z.boolean().optional(),
    activeOnly: z.boolean().default(true),
    customUserIds: z.array(z.string()).optional(),
  }),
});

const SupportNoteSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  note: z.string().min(1, "Note is required").max(2000, "Note too long"),
  isInternal: z.boolean().default(true),
});

// =============================================================================
// ADMIN AUDIT LOGGING
// =============================================================================

/**
 * Log an admin action for audit trail
 */
export async function logAdminAction(params: {
  actorUserId: string;
  action: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        targetUserId: params.targetUserId,
        metadata: params.metadata || {},
      },
    });

    logger.info(
      {
        actorUserId: params.actorUserId,
        action: params.action,
        targetUserId: params.targetUserId,
        metadata: params.metadata,
      },
      "Admin action logged"
    );
  } catch (error) {
    logger.error({ error, params }, "Failed to log admin action");
    // Don't throw - audit logging failure shouldn't break the operation
  }
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * Get users with pagination and filtering
 */
export async function getUsers(params: {
  query?: string;
  page?: number;
  limit?: number;
  role?: string;
  tier?: string;
  status?: string;
}): Promise<{ users: AdminUser[]; total: number; page: number; limit: number }> {
  const validated = UserQuerySchema.parse(params);
  const { query, page, limit, role, tier, status } = validated;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};

  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (tier) {
    where.subscriptions = {
      some: {
        tier: tier,
        status: 'active',
      },
    };
  }

  if (status === 'disabled') {
    where.subscriptions = {
      every: {
        status: {
          not: 'active',
        },
      },
    };
  } else if (status === 'active') {
    where.subscriptions = {
      some: {
        status: 'active',
      },
    };
  }

  // Get users with their subscription data
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        subscriptions: {
          where: { status: 'active' },
          select: { tier: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        usageRecords: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  // Transform to AdminUser format
  const adminUsers = await Promise.all(users.map(async (user: any) => {
    const lastActivity = user.usageRecords[0]?.createdAt;
    const subscription = user.subscriptions[0];
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionTier: subscription?.tier,
      lastLoginAt: lastActivity,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      isActive: (subscription as any)?.status === 'active',
      flags: {
        isDisabled: !subscription || (subscription as any).status !== 'active',
        requiresMfaReset: !(await mfaService.isMFAEnabled(user.id)),
        hasPendingIssues: await prisma.supportNote.count({ 
          where: { targetUserId: user.id, isInternal: true } 
        }) > 0,
        subscriptionIssues: !subscription,
      },
    };
  }));

  return {
    users: adminUsers,
    total,
    page,
    limit,
  };
}

/**
 * Get detailed user information
 */
export async function getUserById(userId: string): Promise<AdminUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      subscriptions: {
        where: { status: 'active' },
        select: { tier: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      usageRecords: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      apiKeys: {
        select: { id: true, lastUsedAt: true, isActive: true },
        orderBy: { createdAt: 'desc' },
      },
      projects: {
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) return null;

  const lastActivity = user.usageRecords[0]?.createdAt;
  const subscription = user.subscriptions[0];
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isDisabled = !subscription || (subscription.status !== 'active' && subscription.status !== 'trialing');

  // Check for pending issues: support notes, failed scans, or subscription issues
  const [pendingSupportNotes, failedScans, mfaEnabled] = await Promise.all([
    prisma.supportNote.count({
      where: { 
        targetUserId: user.id, 
        isInternal: true,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }
    }),
    prisma.scan.count({
      where: {
        userId: user.id,
        status: 'failed',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }
    }),
    mfaService.isMFAEnabled(user.id)
  ]);
  
  const hasPendingIssues = pendingSupportNotes > 0 || failedScans > 0;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionTier: subscription?.tier,
    lastLoginAt: lastActivity,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    isActive,
    flags: {
      isDisabled,
      requiresMfaReset: !mfaEnabled,
      hasPendingIssues,
      subscriptionIssues: subscription?.status === 'past_due' || subscription?.status === 'incomplete',
    },
  };
}

/**
 * Disable a user account
 */
export async function disableUser(
  actorUserId: string,
  targetUserId: string,
  reason?: string
): Promise<void> {
  // Cancel all active subscriptions
  await prisma.subscription.updateMany({
    where: {
      userId: targetUserId,
      status: 'active',
    },
    data: {
      status: 'canceled',
      cancelAtPeriodEnd: true,
    },
  });

  // Revoke all API keys
  await prisma.apiKey.updateMany({
    where: {
      userId: targetUserId,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'user_disabled',
    targetUserId,
    metadata: { reason },
  });

  logger.info(
    { actorUserId, targetUserId, reason },
    "User disabled by admin"
  );
}

/**
 * Enable a user account
 */
export async function enableUser(
  actorUserId: string,
  targetUserId: string,
  reason?: string
): Promise<void> {
  // Note: This is a simplified enable. In practice, you might need to:
  // - Check if they have a valid payment method
  // - Verify their subscription status
  // - Send welcome back email
  
  // Reactivate API keys
  await prisma.apiKey.updateMany({
    where: {
      userId: targetUserId,
      revokedAt: { not: null },
    },
    data: {
      isActive: true,
      revokedAt: null,
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'user_enabled',
    targetUserId,
    metadata: { reason },
  });

  logger.info(
    { actorUserId, targetUserId, reason },
    "User enabled by admin"
  );
}

/**
 * Reset user's MFA / revoke sessions
 */
export async function resetUserMfa(
  actorUserId: string,
  targetUserId: string
): Promise<void> {
  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: {
      userId: targetUserId,
      revoked: false,
    },
    data: {
      revoked: true,
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'user_mfa_reset',
    targetUserId,
  });

  logger.info(
    { actorUserId, targetUserId },
    "User MFA reset by admin"
  );
}

// =============================================================================
// IMPERSONATION SYSTEM
// =============================================================================

const IMPERSONATION_TOKEN_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Start impersonation session
 */
export async function startImpersonation(
  actorUserId: string,
  targetUserId: string,
  reason: string
): Promise<{ impersonationToken: string; session: ImpersonationSession }> {
  // Validate target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Prevent self-impersonation
  if (actorUserId === targetUserId) {
    throw new Error("Cannot impersonate yourself");
  }

  // Prevent impersonating other admins (unless you're also admin)
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });

  if (targetUser.role === 'admin' && actor?.role !== 'admin') {
    throw new Error("Cannot impersonate admin users");
  }

  // End any existing impersonation sessions
  await endImpersonation(actorUserId);

  // Generate impersonation token
  const impersonationToken = await generateImpersonationToken(actorUserId, targetUserId);
  
  // Create session record
  const session = await prisma.impersonationSession.create({
    data: {
      actorUserId,
      targetUserId,
      reason,
      impersonationToken,
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'impersonation_started',
    targetUserId,
    metadata: { reason, sessionId: session.id },
  });

  logger.info(
    { actorUserId, targetUserId, reason, sessionId: session.id },
    "Impersonation session started"
  );

  return {
    impersonationToken,
    session: {
      ...session,
      isActive: true,
    },
  };
}

/**
 * End impersonation session
 */
export async function endImpersonation(actorUserId: string): Promise<void> {
  const session = await prisma.impersonationSession.findFirst({
    where: {
      actorUserId,
      isActive: true,
    },
  });

  if (!session) {
    return; // No active session to end
  }

  await prisma.impersonationSession.update({
    where: { id: session.id },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'impersonation_ended',
    targetUserId: session.targetUserId,
    metadata: { sessionId: session.id, duration: Date.now() - session.startedAt.getTime() },
  });

  logger.info(
    { actorUserId, sessionId: session.id, targetUserId: session.targetUserId },
    "Impersonation session ended"
  );
}

/**
 * Verify impersonation token
 */
export async function verifyImpersonationToken(token: string): Promise<{
  actorUserId: string;
  targetUserId: string;
  session: ImpersonationSession;
} | null> {
  try {
    const decoded = verifyToken(token) as any;
    
    if (!decoded.impersonation || !decoded.actorUserId || !decoded.targetUserId) {
      return null;
    }

    // Find active session
    const session = await prisma.impersonationSession.findFirst({
      where: {
        impersonationToken: token,
        isActive: true,
      },
    });

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.startedAt.getTime() > IMPERSONATION_TOKEN_TTL) {
      await endImpersonation(session.actorUserId);
      return null;
    }

    return {
      actorUserId: decoded.actorUserId,
      targetUserId: decoded.targetUserId,
      session: {
        ...session,
        isActive: true,
      },
    };
  } catch (error) {
    logger.warn({ error, token: token.slice(0, 10) + "..." }, "Invalid impersonation token");
    return null;
  }
}

/**
 * Generate impersonation token
 */
async function generateImpersonationToken(actorUserId: string, targetUserId: string): Promise<string> {
  // Get target user info for the token
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, role: true }
  });

  if (!targetUser) {
    throw new Error('Target user not found');
  }

  const payload = {
    id: targetUserId,
    email: targetUser.email,
    role: targetUser.role,
    actorUserId,
    impersonation: true,
    type: 'impersonation',
  };

  return generateToken(payload as any);
}

// =============================================================================
// BROADCAST EMAIL SYSTEM
// =============================================================================

/**
 * Create broadcast email job
 */
export async function createBroadcastJob(
  actorUserId: string,
  params: {
    subject: string;
    htmlContent: string;
    textContent?: string;
    audienceFilter: AudienceFilter;
  }
): Promise<BroadcastJob> {
  const validated = BroadcastCreateSchema.parse(params);

  // Get recipient count
  const recipientCount = await getBroadcastRecipientCount(validated.audienceFilter);

  // Create job
  const job = await prisma.broadcastJob.create({
    data: {
      subject: validated.subject,
      htmlContent: validated.htmlContent,
      textContent: validated.textContent,
      audienceFilter: validated.audienceFilter,
      createdBy: actorUserId,
      totalRecipients: recipientCount,
    },
  });

  // Create recipient records
  await createBroadcastRecipients(job.id, validated.audienceFilter);

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'broadcast_created',
    metadata: { 
      jobId: job.id, 
      subject: validated.subject, 
      recipientCount,
      audienceFilter: validated.audienceFilter 
    },
  });

  logger.info(
    { actorUserId, jobId: job.id, recipientCount },
    "Broadcast job created"
  );

  return {
    ...job,
    status: job.status as any,
    audienceFilter: validated.audienceFilter,
  };
}

/**
 * Get broadcast recipient count
 */
async function getBroadcastRecipientCount(filter: AudienceFilter): Promise<number> {
  const where: any = {};

  if (filter.tiers?.length) {
    where.subscriptions = {
      some: {
        tier: { in: filter.tiers },
        status: 'active',
      },
    };
  }

  if (filter.roles?.length) {
    where.role = { in: filter.roles };
  }

  if (filter.verifiedOnly) {
    where.emailVerified = { not: null };
  }

  if (filter.activeOnly) {
    where.subscriptions = {
      some: {
        status: 'active',
      },
    };
  }

  if (filter.customUserIds?.length) {
    where.id = { in: filter.customUserIds };
  }

  return prisma.user.count({ where });
}

/**
 * Create broadcast recipient records
 */
async function createBroadcastRecipients(jobId: string, filter: AudienceFilter): Promise<void> {
  const where: any = {};

  if (filter.tiers?.length) {
    where.subscriptions = {
      some: {
        tier: { in: filter.tiers },
        status: 'active',
      },
    };
  }

  if (filter.roles?.length) {
    where.role = { in: filter.roles };
  }

  if (filter.verifiedOnly) {
    where.emailVerified = { not: null };
  }

  if (filter.activeOnly) {
    where.subscriptions = {
      some: {
        status: 'active',
      },
    };
  }

  if (filter.customUserIds?.length) {
    where.id = { in: filter.customUserIds };
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true },
  });

  const recipients = users.map((user: any) => ({
    jobId,
    userId: user.id,
    email: user.email,
  }));

  if (recipients.length > 0) {
    await prisma.broadcastRecipient.createMany({
      data: recipients,
    });
  }
}

/**
 * Get broadcast job status
 */
export async function getBroadcastJob(jobId: string): Promise<BroadcastJob | null> {
  const job = await prisma.broadcastJob.findUnique({
    where: { id: jobId },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!job) return null;

  return {
    ...job,
    status: job.status as any,
    audienceFilter: job.audienceFilter as any,
  };
}

/**
 * Get broadcast jobs list
 */
export async function getBroadcastJobs(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ jobs: BroadcastJob[]; total: number }> {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const [jobs, total] = await Promise.all([
    prisma.broadcastJob.findMany({
      where,
      skip,
      take: limit,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.broadcastJob.count({ where }),
  ]);

  return {
    jobs: jobs.map((job: any) => ({
      ...job,
      status: job.status as any,
      audienceFilter: job.audienceFilter as any,
    })),
    total,
  };
}

// =============================================================================
// SUPPORT NOTES
// =============================================================================

/**
 * Create support note
 */
export async function createSupportNote(
  actorUserId: string,
  params: {
    targetUserId: string;
    note: string;
    isInternal?: boolean;
  }
): Promise<SupportNote> {
  const validated = SupportNoteSchema.parse(params);

  const note = await prisma.supportNote.create({
    data: {
      actorUserId,
      targetUserId: validated.targetUserId,
      note: validated.note,
      isInternal: validated.isInternal ?? true,
    },
  });

  // Log the action
  await logAdminAction({
    actorUserId,
    action: 'support_note_created',
    targetUserId: validated.targetUserId,
    metadata: { noteId: note.id, isInternal: validated.isInternal },
  });

  logger.info(
    { actorUserId, targetUserId: validated.targetUserId, noteId: note.id },
    "Support note created"
  );

  return note;
}

/**
 * Get support notes for a user
 */
export async function getSupportNotes(
  targetUserId: string,
  params: {
    page?: number;
    limit?: number;
    internalOnly?: boolean;
  } = {}
): Promise<{ notes: SupportNote[]; total: number }> {
  const { page = 1, limit = 50, internalOnly } = params;
  const skip = (page - 1) * limit;

  const where: any = { targetUserId };
  if (internalOnly) {
    where.isInternal = true;
  }

  const [notes, total] = await Promise.all([
    prisma.supportNote.findMany({
      where,
      skip,
      take: limit,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportNote.count({ where }),
  ]);

  return {
    notes: notes.map((note: any) => ({
      ...note,
      isInternal: note.isInternal,
    })),
    total,
  };
}

// =============================================================================
// AUDIT LOG
// =============================================================================

/**
 * Get admin audit log
 */
export async function getAdminAuditLog(params: {
  page?: number;
  limit?: number;
  actorUserId?: string;
  targetUserId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ entries: AdminAuditLogEntry[]; total: number }> {
  const { page = 1, limit = 50, actorUserId, targetUserId, action, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (actorUserId) {
    where.actorUserId = actorUserId;
  }

  if (targetUserId) {
    where.targetUserId = targetUserId;
  }

  if (action) {
    where.action = action;
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      skip,
      take: limit,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return {
    entries: entries.map((entry: any) => ({
      ...entry,
      metadata: entry.metadata as Record<string, unknown> | undefined,
    })),
    total,
  };
}
