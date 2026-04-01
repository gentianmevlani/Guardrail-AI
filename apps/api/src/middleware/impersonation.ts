/**
 * Impersonation Middleware
 * 
 * Handles user impersonation for support staff with full audit logging:
 * - Validates impersonation tokens
 * - Enforces TTL and session limits
 * - Logs all impersonated requests
 * - Provides context for downstream services
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "../types/auth";
import { logger } from "../logger";
import { verifyToken } from "./fastify-auth";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ImpersonationContext {
  actorUserId: string;
  targetUserId: string;
  sessionId: string;
  startedAt: Date;
  reason: string;
}

export interface ImpersonationRequest extends FastifyRequest {
  impersonation?: ImpersonationContext;
  /** Actor (support) or target user depending on middleware phase */
  user?: AuthUser;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const IMPERSONATION_TOKEN_PREFIX = "imp_";
const IMPERSONATION_TTL = 10 * 60 * 1000; // 10 minutes

// =============================================================================
// IMPERSONATION MIDDLEWARE
// =============================================================================

/**
 * Impersonation middleware - validates impersonation tokens and sets context
 */
export async function impersonationMiddleware(
  request: ImpersonationRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return; // No token, continue with normal auth
  }

  const token = authHeader.slice(7).trim();

  // Check if this is an impersonation token
  if (!token.startsWith(IMPERSONATION_TOKEN_PREFIX)) {
    return; // Normal auth token, continue
  }

  try {
    // Verify the token
    const decoded = verifyToken(token) as any;

    if (!decoded.impersonation || !decoded.actorUserId || !decoded.targetUserId) {
      logger.warn(
        { token: token.slice(0, 20) + "..." },
        "Invalid impersonation token structure"
      );
      reply.status(401).send({
        success: false,
        error: "Invalid impersonation token",
        code: "INVALID_IMPERSONATION_TOKEN",
      });
      return;
    }

    // Check for active impersonation session
    const session = await prisma.impersonationSession.findFirst({
      where: {
        impersonationToken: token,
        isActive: true,
      },
      include: {
        actorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!session) {
      logger.warn(
        { actorUserId: decoded.actorUserId, targetUserId: decoded.targetUserId },
        "No active impersonation session found"
      );
      reply.status(401).send({
        success: false,
        error: "Impersonation session not found or expired",
        code: "IMPERSONATION_SESSION_NOT_FOUND",
      });
      return;
    }

    // Check if session has expired
    if (Date.now() - session.startedAt.getTime() > IMPERSONATION_TTL) {
      // Auto-end expired session
      await prisma.impersonationSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });

      logger.warn(
        { sessionId: session.id, actorUserId: session.actorUserId },
        "Impersonation session expired and ended"
      );

      reply.status(401).send({
        success: false,
        error: "Impersonation session expired",
        code: "IMPERSONATION_SESSION_EXPIRED",
      });
      return;
    }

    // Prevent impersonating other admins (unless actor is also admin)
    if (session.targetUser.role === 'admin' && session.actorUser.role !== 'admin') {
      logger.warn(
        { 
          sessionId: session.id,
          actorUserId: session.actorUserId,
          actorRole: session.actorUser.role,
          targetUserId: session.targetUserId,
          targetRole: session.targetUser.role,
        },
        "Attempted to impersonate admin user without admin privileges"
      );

      reply.status(403).send({
        success: false,
        error: "Cannot impersonate admin users",
        code: "IMPERSONATION_ADMIN_FORBIDDEN",
      });
      return;
    }

    // Set impersonation context
    request.impersonation = {
      actorUserId: session.actorUserId,
      targetUserId: session.targetUserId,
      sessionId: session.id,
      startedAt: session.startedAt,
      reason: session.reason,
    };

    // Override user context to be the target user
    // But keep original user for audit logging
    const originalUser = request.user;
    request.user = {
      ...session.targetUser,
      _impersonatedBy: session.actorUserId,
      _originalUser: originalUser,
    };

    // Log the impersonated request
    logger.info(
      {
        sessionId: session.id,
        actorUserId: session.actorUserId,
        targetUserId: session.targetUserId,
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      },
      "Impersonated request"
    );

  } catch (error) {
    logger.error({ error, token: token.slice(0, 20) + "..." }, "Impersonation middleware error");
    
    reply.status(401).send({
      success: false,
      error: "Impersonation validation failed",
      code: "IMPERSONATION_VALIDATION_FAILED",
    });
  }
}

/**
 * Require impersonation context middleware
 */
export function requireImpersonation() {
  return async (
    request: ImpersonationRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!request.impersonation) {
      reply.status(403).send({
        success: false,
        error: "Impersonation context required",
        code: "IMPERSONATION_REQUIRED",
      });
      return;
    }
  };
}

/**
 * Prevent impersonation middleware (for sensitive endpoints)
 */
export function preventImpersonation() {
  return async (
    request: ImpersonationRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (request.impersonation) {
      reply.status(403).send({
        success: false,
        error: "This action cannot be performed while impersonating",
        code: "IMPERSONATION_FORBIDDEN",
      });
      return;
    }
  };
}

// =============================================================================
// AUDIT LOGGING HELPERS
// =============================================================================

/**
 * Log impersonated action with full context
 */
export async function logImpersonatedAction(params: {
  request: ImpersonationRequest;
  action: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!params.request.impersonation) {
    return; // Not an impersonated request
  }

  const { actorUserId, targetUserId, sessionId, reason } = params.request.impersonation;

  try {
    // Log to admin audit log
    await prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action: `impersonated_${params.action}`,
        targetUserId: params.targetUserId || targetUserId,
        metadata: {
          ...params.metadata,
          impersonationSessionId: sessionId,
          originalReason: reason,
          requestUrl: params.request.url,
          requestMethod: params.request.method,
          userAgent: params.request.headers["user-agent"],
          ip: params.request.ip,
        },
      },
    });

    logger.info(
      {
        actorUserId,
        targetUserId,
        sessionId,
        action: params.action,
        metadata: params.metadata,
      },
      "Impersonated action logged"
    );
  } catch (error) {
    logger.error({ error, params }, "Failed to log impersonated action");
    // Don't throw - audit logging failure shouldn't break the operation
  }
}

/**
 * Get impersonation session info
 */
export async function getImpersonationSession(sessionId: string): Promise<unknown> {
  try {
    return await prisma.impersonationSession.findUnique({
      where: { id: sessionId },
      include: {
        actorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to get impersonation session");
    return null;
  }
}

/**
 * Get active impersonation sessions
 */
export async function getActiveImpersonationSessions(): Promise<unknown[]> {
  try {
    return await prisma.impersonationSession.findMany({
      where: {
        isActive: true,
      },
      include: {
        actorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get active impersonation sessions");
    return [];
  }
}

/**
 * Cleanup expired impersonation sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const expiredTime = new Date(Date.now() - IMPERSONATION_TTL);
    
    const result = await prisma.impersonationSession.updateMany({
      where: {
        isActive: true,
        startedAt: {
          lt: expiredTime,
        },
      },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info(
        { expiredCount: result.count },
        "Cleaned up expired impersonation sessions"
      );
    }
  } catch (error) {
    logger.error({ error }, "Failed to cleanup expired impersonation sessions");
  }
}

// Run cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
cleanupInterval.unref(); // Don't prevent process exit
