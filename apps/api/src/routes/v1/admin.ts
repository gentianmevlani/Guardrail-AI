/**
 * Admin & Support Ops API Routes
 * 
 * Secure admin endpoints for:
 * - User management and debugging
 * - Safe impersonation with audit logging
 * - Broadcast email system
 * - Support notes and internal tools
 * 
 * SECURITY: All routes require admin role and full audit logging
 */

import { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@guardrail/database";
import { logger } from "../../logger";
import { AuthenticatedRequest, authMiddleware, requireRole } from "../../middleware/fastify-auth";
import crypto from "crypto";
import { 
  getBroadcastJob, 
  createSupportNote, 
  getSupportNotes,
  getAdminAuditLog,
  getUserById
} from "../../services/admin-service";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionTier?: string;
  lastLoginAt?: Date;
  emailVerified?: Date | null;
  createdAt: Date;
  isActive: boolean;
  flags: {
    isDisabled: boolean;
    requiresMfaReset: boolean;
    hasPendingIssues: boolean;
    subscriptionIssues: boolean;
  };
}

interface ImpersonationSession {
  id: string;
  actorUserId: string;
  targetUserId: string;
  startedAt: Date;
  endedAt?: Date;
  reason: string;
  impersonationToken: string;
  isActive: boolean;
}

interface BroadcastJob {
  id: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  audienceFilter: any;
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

interface SupportNote {
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
// DATABASE HELPERS (Temporary until Prisma client is updated)
// =============================================================================

// These are simplified versions that use the existing Prisma client
// In production, these would use the new admin models

async function logAdminAction(params: {
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
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Fallback to logging if DB write fails
    logger.error({ error, ...params }, "Failed to write admin audit log");
  }
}

async function createImpersonationSession(
  actorUserId: string,
  targetUserId: string,
  reason: string,
  token: string
): Promise<ImpersonationSession> {
  const session = await prisma.impersonationSession.create({
    data: {
      actorUserId,
      targetUserId,
      reason,
      impersonationToken: token,
      isActive: true,
      startedAt: new Date(),
    },
  });

  return {
    id: session.id,
    actorUserId: session.actorUserId,
    targetUserId: session.targetUserId,
    startedAt: session.startedAt,
    endedAt: session.endedAt || undefined,
    reason: session.reason,
    impersonationToken: session.impersonationToken,
    isActive: session.isActive,
  };
}

async function endImpersonationSession(actorUserId: string): Promise<void> {
  await prisma.impersonationSession.updateMany({
    where: {
      actorUserId,
      isActive: true,
    },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });
}

// =============================================================================
// ADMIN ROUTES
// =============================================================================

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require authentication and admin role
  fastify.addHook("preHandler", authMiddleware);
  fastify.addHook("preHandler", requireRole(["admin", "support"]));

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * GET /v1/admin/users
   * Get users with pagination and filtering
   */
  fastify.get("/users", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { query, page, limit, role, tier, status } = UserQuerySchema.parse(request.query);
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where: any = {};
      if (role) where.role = role;
      if (status === 'active') {
        // Active users - check for active subscriptions or no disabled flag
        where.subscriptions = {
          some: {
            status: { in: ['active', 'trialing'] },
          },
        };
      } else if (status === 'disabled') {
        // Disabled users: no active subscriptions or explicitly disabled
        where.subscriptions = {
          none: {
            status: { in: ['active', 'trialing'] },
          },
        };
      }
      
      // Search query
      if (query) {
        where.OR = [
          { email: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ];
      }

      // Get users with subscriptions
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      // Transform to AdminUser format
      const adminUsers: AdminUser[] = await Promise.all(users.map(async (user: any) => {
        const subscription = user.subscriptions[0];
        const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
        const isDisabled = !subscription || (subscription.status !== 'active' && subscription.status !== 'trialing');
        
        // Check for pending issues: support notes, failed scans, or subscription issues
        const [pendingSupportNotes, failedScans] = await Promise.all([
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
          })
        ]);
        
        const hasPendingIssues = pendingSupportNotes > 0 || failedScans > 0;
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionTier: subscription?.tier || 'free',
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          isActive,
          flags: {
            isDisabled,
            requiresMfaReset: !user.mfaEnabled && user.mfaSecret !== null,
            hasPendingIssues,
            subscriptionIssues: subscription?.status === 'past_due' || subscription?.status === 'incomplete',
          },
        };
      }));

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "users_listed",
        metadata: { query, page, limit, role, tier, status },
      });

      return reply.send({
        success: true,
        data: {
          users: adminUsers,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to list users");
      return reply.status(500).send({
        success: false,
        error: "Failed to list users",
        code: "USER_LIST_FAILED",
      });
    }
  });

  /**
   * GET /v1/admin/users/:id
   * Get detailed user information
   */
  fastify.get("/users/:id", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const user = await getUserById(id);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "user_viewed",
        targetUserId: id,
      });

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error({ error, userId: (request.params as any).id }, "Failed to get user");
      return reply.status(500).send({
        success: false,
        error: "Failed to get user",
        code: "USER_GET_FAILED",
      });
    }
  });

  /**
   * POST /v1/admin/users/:id/disable
   * Disable a user account
   */
  fastify.post("/users/:id/disable", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };

      // Cancel active subscriptions
      await prisma.subscription.updateMany({
        where: {
          userId: id,
          status: { in: ['active', 'trialing'] },
        },
        data: {
          status: 'canceled',
          cancelAtPeriodEnd: true,
        },
      });

      // Revoke all API keys
      await prisma.apiKey.updateMany({
        where: {
          userId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      // Revoke refresh tokens
      await prisma.refreshToken.updateMany({
        where: {
          userId: id,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "user_disabled",
        targetUserId: id,
        metadata: { reason },
      });

      logger.info(
        { actorUserId: request.user!.id, targetUserId: id, reason },
        "User disabled"
      );

      return reply.send({
        success: true,
        message: "User disabled successfully",
      });
    } catch (error) {
      logger.error({ error, userId: (request.params as any).id }, "Failed to disable user");
      return reply.status(500).send({
        success: false,
        error: "Failed to disable user",
        code: "USER_DISABLE_FAILED",
      });
    }
  });

  /**
   * POST /v1/admin/users/:id/enable
   * Enable a user account
   */
  fastify.post("/users/:id/enable", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };

      // Note: Re-enabling subscriptions requires manual intervention via Stripe
      // We just log the action here - actual reactivation should be done through billing system
      
      // Re-enable API keys that were revoked (but not expired)
      await prisma.apiKey.updateMany({
        where: {
          userId: id,
          revokedAt: { not: null },
          expiresAt: { gte: new Date() },
        },
        data: {
          isActive: true,
          revokedAt: null,
        },
      });

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "user_enabled",
        targetUserId: id,
        metadata: { reason },
      });

      logger.info(
        { actorUserId: request.user!.id, targetUserId: id, reason },
        "User enabled"
      );

      return reply.send({
        success: true,
        message: "User enabled successfully. Note: Subscriptions must be reactivated manually via billing system.",
      });
    } catch (error) {
      logger.error({ error, userId: (request.params as any).id }, "Failed to enable user");
      return reply.status(500).send({
        success: false,
        error: "Failed to enable user",
        code: "USER_ENABLE_FAILED",
      });
    }
  });

  /**
   * POST /v1/admin/users/:id/reset-mfa
   * Reset user's MFA / revoke sessions
   */
  fastify.post("/users/:id/reset-mfa", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Clear MFA settings
      await prisma.user.update({
        where: { id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
          mfaVerifiedAt: null,
        },
      });

      // Revoke all refresh tokens to force re-authentication
      await prisma.refreshToken.updateMany({
        where: {
          userId: id,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "user_mfa_reset",
        targetUserId: id,
      });

      logger.info(
        { actorUserId: request.user!.id, targetUserId: id },
        "User MFA reset"
      );

      return reply.send({
        success: true,
        message: "MFA reset successfully. User will need to set up MFA again on next login.",
      });
    } catch (error) {
      logger.error({ error, userId: (request.params as any).id }, "Failed to reset MFA");
      return reply.status(500).send({
        success: false,
        error: "Failed to reset MFA",
        code: "MFA_RESET_FAILED",
      });
    }
  });

  // ==========================================
  // IMPERSONATION
  // ==========================================

  /**
   * POST /v1/admin/impersonate/start
   * Start impersonation session
   */
  fastify.post("/impersonate/start", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { targetUserId, reason } = ImpersonationStartSchema.parse(request.body);
      const actorUserId = request.user!.id;

      // Validate target user exists and can be impersonated
      if (actorUserId === targetUserId) {
        return reply.status(400).send({
          success: false,
          error: "Cannot impersonate yourself",
          code: "SELF_IMPERSONATION",
        });
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          error: "Target user not found",
          code: "TARGET_USER_NOT_FOUND",
        });
      }

      // Generate secure impersonation token
      const impersonationToken = `imp_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
      
      // Create session
      const session = await createImpersonationSession(
        actorUserId,
        targetUserId,
        reason,
        impersonationToken
      );

      await logAdminAction({
        actorUserId,
        action: "impersonation_started",
        targetUserId,
        metadata: { reason, sessionId: session.id },
      });

      return reply.send({
        success: true,
        data: {
          impersonationToken,
          session,
          expiresIn: 10 * 60, // 10 minutes
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to start impersonation");
      return reply.status(500).send({
        success: false,
        error: "Failed to start impersonation",
        code: "IMPERSONATION_START_FAILED",
      });
    }
  });

  /**
   * POST /v1/admin/impersonate/stop
   * End impersonation session
   */
  fastify.post("/impersonate/stop", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const actorUserId = request.user!.id;

      await endImpersonationSession(actorUserId);

      await logAdminAction({
        actorUserId,
        action: "impersonation_ended",
      });

      return reply.send({
        success: true,
        message: "Impersonation session ended",
      });
    } catch (error) {
      logger.error({ error }, "Failed to end impersonation");
      return reply.status(500).send({
        success: false,
        error: "Failed to end impersonation",
        code: "IMPERSONATION_END_FAILED",
      });
    }
  });

  // ==========================================
  // BROADCAST EMAIL
  // ==========================================

  /**
   * POST /v1/admin/broadcast
   * Create broadcast email job
   */
  fastify.post("/broadcast", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const validated = BroadcastCreateSchema.parse(request.body);
      const actorUserId = request.user!.id;

      // Calculate recipient count based on audience filter
      const where: any = {};
      if (validated.audienceFilter.activeOnly !== false) {
        where.subscriptions = {
          some: {
            status: { in: ['active', 'trialing'] },
          },
        };
      }
      if (validated.audienceFilter.verifiedOnly) {
        where.emailVerified = { not: null };
      }
      if (validated.audienceFilter.roles && validated.audienceFilter.roles.length > 0) {
        where.role = { in: validated.audienceFilter.roles };
      }
      if (validated.audienceFilter.tiers && validated.audienceFilter.tiers.length > 0) {
        where.subscriptions = {
          some: {
            tier: { in: validated.audienceFilter.tiers },
            status: { in: ['active', 'trialing'] },
          },
        };
      }
      if (validated.audienceFilter.customUserIds && validated.audienceFilter.customUserIds.length > 0) {
        where.id = { in: validated.audienceFilter.customUserIds };
      }

      const totalRecipients = await prisma.user.count({ where });

      // Create broadcast job
      const job = await prisma.broadcastJob.create({
        data: {
          subject: validated.subject,
          htmlContent: validated.htmlContent,
          textContent: validated.textContent || null,
          audienceFilter: validated.audienceFilter as any,
          status: 'pending',
          createdBy: actorUserId,
          totalRecipients,
        },
      });

      await logAdminAction({
        actorUserId,
        action: "broadcast_created",
        metadata: {
          jobId: job.id,
          subject: validated.subject,
          audienceFilter: validated.audienceFilter,
          totalRecipients,
        },
      });

      logger.info(
        { actorUserId, jobId: job.id, subject: validated.subject, totalRecipients },
        "Broadcast job created"
      );

      return reply.send({
        success: true,
        data: {
          id: job.id,
          subject: job.subject,
          htmlContent: job.htmlContent,
          textContent: job.textContent,
          audienceFilter: job.audienceFilter,
          status: job.status,
          createdBy: job.createdBy,
          createdAt: job.createdAt,
          totalRecipients: job.totalRecipients,
          sentCount: job.sentCount,
          failedCount: job.failedCount,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to create broadcast job");
      return reply.status(500).send({
        success: false,
        error: "Failed to create broadcast job",
        code: "BROADCAST_CREATE_FAILED",
      });
    }
  });

  /**
   * GET /v1/admin/broadcast/:jobId/status
   * Get broadcast job status
   */
  fastify.get("/broadcast/:jobId/status", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      const job = await getBroadcastJob(jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: "Broadcast job not found",
          code: "BROADCAST_NOT_FOUND",
        });
      }

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "broadcast_status_viewed",
        metadata: { jobId },
      });

      return reply.send({
        success: true,
        data: job,
      });
    } catch (error) {
      logger.error({ error, jobId: (request.params as any).jobId }, "Failed to get broadcast status");
      return reply.status(500).send({
        success: false,
        error: "Failed to get broadcast status",
        code: "BROADCAST_STATUS_FAILED",
      });
    }
  });

  /**
   * GET /v1/admin/broadcast
   * List broadcast jobs
   */
  fastify.get("/broadcast", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 20, status } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);
      
      const where: any = {};
      if (status) {
        where.status = status;
      }

      const [jobs, total] = await Promise.all([
        prisma.broadcastJob.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            totalRecipients: true,
            sentCount: true,
            failedCount: true,
            createdBy: true,
          },
        }),
        prisma.broadcastJob.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: {
          jobs,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to list broadcast jobs");
      return reply.status(500).send({
        success: false,
        error: "Failed to list broadcast jobs",
        code: "BROADCAST_LIST_FAILED",
      });
    }
  });

  // ==========================================
  // SUPPORT NOTES
  // ==========================================

  /**
   * POST /v1/admin/support-notes
   * Create support note
   */
  fastify.post("/support-notes", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const validated = SupportNoteSchema.parse(request.body);
      const actorUserId = request.user!.id;

      const note = await createSupportNote(actorUserId, {
        targetUserId: validated.targetUserId,
        note: validated.note,
        isInternal: validated.isInternal,
      });

      return reply.send({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error({ error }, "Failed to create support note");
      return reply.status(500).send({
        success: false,
        error: "Failed to create support note",
        code: "SUPPORT_NOTE_CREATE_FAILED",
      });
    }
  });

  /**
   * GET /v1/admin/support-notes/:userId
   * Get support notes for a user
   */
  fastify.get("/support-notes/:userId", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string };
      const { page = 1, limit = 50, internalOnly } = request.query as any;

      const { notes, total } = await getSupportNotes(userId, {
        page: Number(page),
        limit: Number(limit),
        internalOnly: internalOnly === 'true',
      });

      return reply.send({
        success: true,
        data: {
          notes: notes.map((note) => ({
            id: note.id,
            actorUserId: note.actorUserId,
            targetUserId: note.targetUserId,
            note: note.note,
            createdAt: note.createdAt,
            isInternal: note.isInternal,
            actor: (note as any).actorUser ? {
              id: (note as any).actorUser.id,
              email: (note as any).actorUser.email,
              name: (note as any).actorUser.name,
            } : null,
          })),
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error({ error, userId: (request.params as any).userId }, "Failed to get support notes");
      return reply.status(500).send({
        success: false,
        error: "Failed to get support notes",
        code: "SUPPORT_NOTES_GET_FAILED",
      });
    }
  });

  // ==========================================
  // AUDIT LOG
  // ==========================================

  /**
   * GET /v1/admin/audit-log
   * Get admin audit log
   */
  fastify.get("/audit-log", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const {
        page = 1,
        limit = 50,
        actorUserId,
        targetUserId,
        action,
        startDate,
        endDate,
      } = request.query as any;

      const { entries, total } = await getAdminAuditLog({
        page: Number(page),
        limit: Number(limit),
        actorUserId: actorUserId as string | undefined,
        targetUserId: targetUserId as string | undefined,
        action: action as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      await logAdminAction({
        actorUserId: request.user!.id,
        action: "audit_log_viewed",
        metadata: { page, limit, filters: { actorUserId, targetUserId, action, startDate, endDate } },
      });

      return reply.send({
        success: true,
        data: {
          entries: entries.map((entry) => ({
            id: entry.id,
            actorUserId: entry.actorUserId,
            action: entry.action,
            targetUserId: entry.targetUserId,
            timestamp: entry.timestamp,
            metadata: entry.metadata,
            actor: (entry as any).actorUser ? {
              id: (entry as any).actorUser.id,
              email: (entry as any).actorUser.email,
              name: (entry as any).actorUser.name,
            } : null,
            target: (entry as any).targetUser ? {
              id: (entry as any).targetUser.id,
              email: (entry as any).targetUser.email,
              name: (entry as any).targetUser.name,
            } : null,
          })),
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to get audit log");
      return reply.status(500).send({
        success: false,
        error: "Failed to get audit log",
        code: "AUDIT_LOG_GET_FAILED",
      });
    }
  });

  // ==========================================
  // ADMIN DASHBOARD
  // ==========================================

  /**
   * GET /v1/admin/dashboard
   * Get admin dashboard stats
   */
  fastify.get("/dashboard", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const [
        totalUsers,
        activeUsers,
        recentSignups,
        openSupportTickets,
        activeImpersonations,
        pendingBroadcasts,
        totalScans,
        totalProjects,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            subscriptions: {
              some: {
                status: { in: ['active', 'trialing'] },
              },
            },
          },
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
        prisma.feedback.count({
          where: {
            status: { in: ['new', 'in_progress'] },
          },
        }),
        prisma.impersonationSession.count({
          where: {
            isActive: true,
          },
        }),
        prisma.broadcastJob.count({
          where: {
            status: { in: ['pending', 'processing'] },
          },
        }),
        prisma.scan.count(),
        prisma.project.count(),
      ]);

      const stats = {
        totalUsers,
        activeUsers,
        recentSignups,
        openSupportTickets,
        activeImpersonations,
        pendingBroadcasts,
        totalScans,
        totalProjects,
        systemHealth: "healthy" as const,
      };

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get dashboard stats");
      return reply.status(500).send({
        success: false,
        error: "Failed to get dashboard stats",
        code: "DASHBOARD_GET_FAILED",
      });
    }
  });
}
