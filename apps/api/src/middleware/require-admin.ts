/**
 * Admin Authorization Middleware
 *
 * Ensures only admin/superadmin users can access protected routes.
 * Logs all admin access attempts for audit trail.
 */

import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/secrets";
import { logger } from "../logger";

export interface AdminUser {
  userId: string;
  id?: string;
  email?: string;
  role?: "user" | "admin" | "superadmin";
}

export interface AdminRequest extends Omit<FastifyRequest, 'user'> {
  user?: AdminUser;
}

/**
 * Verify JWT token and extract user info
 */
async function verifyToken(request: FastifyRequest): Promise<AdminUser | null> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
    return decoded;
  } catch (error) {
    logger.warn({
      msg: "Token verification failed",
      error: error instanceof Error ? error.message : "Unknown error",
      ip: request.ip,
      path: request.url,
    });
    return null;
  }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = await verifyToken(request);

  if (!user) {
    logger.warn({
      msg: "Unauthenticated access attempt",
      ip: request.ip,
      path: request.url,
      method: request.method,
    });

    reply.status(401).send({
      success: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
    return;
  }

  (request as AdminRequest).user = user;
}

/**
 * Require admin role middleware
 * Must be used after requireAuth
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // First verify authentication
  await requireAuth(request, reply);

  // If already replied (unauthorized), don't continue
  if (reply.sent) {
    return;
  }

  const user = (request as AdminRequest).user;

  if (!user) {
    return; // Already handled by requireAuth
  }

  // Check for admin role
  const isAdmin = user.role === "admin" || user.role === "superadmin";

  if (!isAdmin) {
    logger.warn({
      msg: "Unauthorized admin access attempt",
      userId: user.userId || user.id,
      email: user.email,
      role: user.role || "unknown",
      attemptedRoute: request.url,
      method: request.method,
      ip: request.ip,
    });

    reply.status(403).send({
      success: false,
      error: "Admin access required",
      code: "ADMIN_REQUIRED",
    });
    return;
  }

  // Log successful admin access
  logger.info({
    msg: "Admin action",
    userId: user.userId || user.id,
    email: user.email,
    role: user.role,
    route: request.url,
    method: request.method,
    ip: request.ip,
  });
}

/**
 * Require superadmin role middleware
 * For the most sensitive operations
 */
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // First verify authentication
  await requireAuth(request, reply);

  if (reply.sent) {
    return;
  }

  const user = (request as AdminRequest).user;

  if (!user) {
    return;
  }

  if (user.role !== "superadmin") {
    logger.warn({
      msg: "Unauthorized superadmin access attempt",
      userId: user.userId || user.id,
      email: user.email,
      role: user.role || "unknown",
      attemptedRoute: request.url,
      method: request.method,
      ip: request.ip,
    });

    reply.status(403).send({
      success: false,
      error: "Superadmin access required",
      code: "SUPERADMIN_REQUIRED",
    });
    return;
  }

  logger.info({
    msg: "Superadmin action",
    userId: user.userId || user.id,
    email: user.email,
    route: request.url,
    method: request.method,
    ip: request.ip,
  });
}

/**
 * Check if user owns the resource or is admin
 * Useful for routes where users can manage their own resources
 * but admins can manage all resources
 */
export function requireOwnerOrAdmin(
  getResourceOwnerId: (request: FastifyRequest) => string | Promise<string>,
) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await requireAuth(request, reply);

    if (reply.sent) {
      return;
    }

    const user = (request as AdminRequest).user;

    if (!user) {
      return;
    }

    // Admins can access any resource
    if (user.role === "admin" || user.role === "superadmin") {
      logger.info({
        msg: "Admin accessing user resource",
        adminId: user.userId || user.id,
        route: request.url,
        method: request.method,
      });
      return;
    }

    // Check if user owns the resource
    const resourceOwnerId = await getResourceOwnerId(request);
    const userId = user.userId || user.id;

    if (resourceOwnerId !== userId) {
      logger.warn({
        msg: "Unauthorized resource access attempt",
        userId,
        resourceOwnerId,
        route: request.url,
        method: request.method,
        ip: request.ip,
      });

      reply.status(403).send({
        success: false,
        error: "Access denied",
        code: "FORBIDDEN",
      });
    }
  };
}
