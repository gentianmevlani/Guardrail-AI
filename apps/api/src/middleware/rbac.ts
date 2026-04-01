/**
 * RBAC Middleware
 * 
 * Fastify middleware for role-based access control enforcement.
 * Validates user permissions against required permissions for routes.
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  Permission,
  Role,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isValidRole,
  RBACContext,
  checkTierAndPermission,
  Tier,
} from "@guardrail/core";
import { logger } from "../logger";

// =============================================================================
// TYPES
// =============================================================================

export interface RBACRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    subscriptionTier?: string;
  };
  rbacContext?: RBACContext;
  organizationId?: string;
}

export interface RBACOptions {
  permission?: Permission;
  permissions?: Permission[];
  anyPermission?: Permission[];
  requiredTier?: Tier;
  organizationRequired?: boolean;
}

// =============================================================================
// RBAC CONTEXT BUILDER
// =============================================================================

/**
 * Build RBAC context for a user within an organization
 */
async function buildRBACContext(
  userId: string,
  organizationId: string
): Promise<RBACContext | null> {
  try {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
        user: {
          include: {
            subscriptions: {
              where: { status: "active" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    const role = member.role as Role;
    if (!isValidRole(role)) {
      logger.warn({ userId, organizationId, role }, "Invalid role found");
      return null;
    }

    const { getEffectivePermissions } = await import("@guardrail/core");
    const permissions = getEffectivePermissions(role);
    const tier = member.user.subscriptions[0]?.tier || member.organization.tier;

    return {
      userId,
      teamId: organizationId,
      role,
      permissions,
      tier,
    };
  } catch (error) {
    logger.error({ error, userId, organizationId }, "Failed to build RBAC context");
    return null;
  }
}

// =============================================================================
// MIDDLEWARE FACTORIES
// =============================================================================

/**
 * Middleware to attach RBAC context to request
 */
export function attachRBACContext() {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return; // Let auth middleware handle unauthenticated requests
    }

    const organizationId = 
      request.organizationId ||
      (request.params as Record<string, string>)?.organizationId ||
      (request.query as Record<string, string>)?.organizationId ||
      (request.headers["x-organization-id"] as string);

    if (organizationId) {
      const context = await buildRBACContext(request.user.id, organizationId);
      if (context) {
        request.rbacContext = context;
        request.organizationId = organizationId;
      }
    }
  };
}

/**
 * Create middleware that requires a specific permission
 */
export function requirePermission(permission: Permission) {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!request.rbacContext) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Organization context required",
      });
    }

    const check = hasPermission(request.rbacContext, permission);
    
    if (!check.allowed) {
      await logRBACAction(request, permission, false);
      return reply.status(403).send({
        error: "Forbidden",
        message: check.reason || `Permission '${permission}' required`,
        requiredPermission: permission,
      });
    }

    await logRBACAction(request, permission, true);
  };
}

/**
 * Create middleware that requires ALL of the specified permissions
 */
export function requireAllPermissions(permissions: Permission[]) {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!request.rbacContext) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Organization context required",
      });
    }

    const check = hasAllPermissions(request.rbacContext, permissions);
    
    if (!check.allowed) {
      await logRBACAction(request, permissions.join(","), false);
      return reply.status(403).send({
        error: "Forbidden",
        message: check.reason || `Required permissions: ${permissions.join(", ")}`,
        requiredPermissions: permissions,
      });
    }

    await logRBACAction(request, permissions.join(","), true);
  };
}

/**
 * Create middleware that requires ANY of the specified permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!request.rbacContext) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Organization context required",
      });
    }

    const check = hasAnyPermission(request.rbacContext, permissions);
    
    if (!check.allowed) {
      await logRBACAction(request, permissions.join("|"), false);
      return reply.status(403).send({
        error: "Forbidden",
        message: check.reason || `One of these permissions required: ${permissions.join(", ")}`,
        requiredPermissions: permissions,
      });
    }

    await logRBACAction(request, permissions.join("|"), true);
  };
}

/**
 * Create middleware that requires a permission AND a minimum tier
 */
export function requirePermissionAndTier(permission: Permission, requiredTier: Tier) {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!request.rbacContext) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Organization context required",
      });
    }

    const check = checkTierAndPermission(request.rbacContext, permission, requiredTier);
    
    if (!check.allowed) {
      await logRBACAction(request, permission, false);
      return reply.status(403).send({
        error: "Forbidden",
        message: check.reason,
        requiredPermission: permission,
        requiredTier,
      });
    }

    await logRBACAction(request, permission, true);
  };
}

/**
 * Create middleware that requires a specific role or higher
 */
export function requireRole(minimumRole: Role) {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!request.rbacContext) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Organization context required",
      });
    }

    const { isRoleAtLeast } = await import("@guardrail/core");
    
    if (!isRoleAtLeast(request.rbacContext.role, minimumRole)) {
      return reply.status(403).send({
        error: "Forbidden",
        message: `Role '${minimumRole}' or higher required`,
        currentRole: request.rbacContext.role,
        requiredRole: minimumRole,
      });
    }
  };
}

// =============================================================================
// ROUTE-SPECIFIC PERMISSION MAPS
// =============================================================================

/**
 * Permission requirements for specific route patterns
 */
export const ROUTE_PERMISSIONS: Record<string, RBACOptions> = {
  // Compliance & Audit
  "GET /api/audit": { permission: "view_audit" },
  "GET /api/audit/export": { permissions: ["view_audit", "export_audit"] },
  "POST /api/compliance/assess": { permission: "view_compliance", requiredTier: "compliance" },
  "GET /api/compliance/reports": { permission: "view_compliance" },
  "POST /api/compliance/reports/export": { permissions: ["view_compliance", "export_reports"] },
  
  // Autopilot & Reality
  "POST /api/autopilot/run": { permission: "run_autopilot", requiredTier: "pro" },
  "POST /api/reality/run": { permission: "run_reality" },
  "POST /api/scan/run": { permission: "run_scan" },
  "POST /api/fix/run": { permission: "run_fix" },
  "POST /api/gate/run": { permission: "run_gate" },
  
  // Policies
  "GET /api/policies": { permission: "view_policies" },
  "POST /api/policies": { permission: "manage_policies" },
  "PUT /api/policies/:id": { permission: "manage_policies" },
  "DELETE /api/policies/:id": { permission: "manage_policies" },
  
  // Team Management
  "GET /api/team/members": { permission: "view_dashboard", organizationRequired: true },
  "POST /api/team/invite": { permission: "invite_members", organizationRequired: true },
  "DELETE /api/team/members/:id": { permission: "remove_members", organizationRequired: true },
  "PUT /api/team/members/:id/role": { permission: "assign_roles", organizationRequired: true },
  
  // Reports
  "GET /api/reports": { permission: "view_reports" },
  "POST /api/reports/export": { permission: "export_reports" },
  
  // API Keys
  "GET /api/keys": { permission: "view_api_keys" },
  "POST /api/keys": { permission: "manage_api_keys" },
  "DELETE /api/keys/:id": { permission: "manage_api_keys" },
  
  // Billing
  "GET /api/billing": { permission: "view_billing" },
  "POST /api/billing": { permission: "manage_billing" },
};

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Log RBAC permission check to audit trail
 */
async function logRBACAction(
  request: RBACRequest,
  permission: string,
  allowed: boolean
): Promise<void> {
  if (!request.rbacContext || !request.organizationId) {
    return;
  }

  try {
    await prisma.rBACActivityLog.create({
      data: {
        organizationId: request.organizationId,
        actorUserId: request.user!.id,
        action: "permission_checked",
        permission,
        allowed,
        metadata: {
          route: request.url,
          method: request.method,
          role: request.rbacContext.role,
        },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] as string,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to log RBAC action");
  }
}

// =============================================================================
// SEAT LIMIT ENFORCEMENT
// =============================================================================

/**
 * Check if organization can add more members based on tier seat limits
 */
export async function checkSeatLimit(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  currentSeats: number;
  maxSeats: number;
}> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: true,
      },
    });

    if (!org) {
      return {
        allowed: false,
        reason: "Organization not found",
        currentSeats: 0,
        maxSeats: 0,
      };
    }

    const { getTierConfig, calculateEffectiveSeats } = await import("@guardrail/core");
    const tierConfig = getTierConfig(org.tier as Tier);
    const effectiveSeats = calculateEffectiveSeats(org.tier as Tier, org.purchasedExtraSeats);
    const currentSeats = org.members.length;

    if (currentSeats >= effectiveSeats) {
      return {
        allowed: false,
        reason: `Seat limit reached (${currentSeats}/${effectiveSeats}). Upgrade your plan or purchase additional seats.`,
        currentSeats,
        maxSeats: effectiveSeats,
      };
    }

    return {
      allowed: true,
      currentSeats,
      maxSeats: effectiveSeats,
    };
  } catch (error) {
    logger.error({ error, organizationId }, "Failed to check seat limit");
    return {
      allowed: false,
      reason: "Failed to verify seat limit",
      currentSeats: 0,
      maxSeats: 0,
    };
  }
}

/**
 * Middleware to enforce seat limits before adding members
 */
export function enforceSeatLimit() {
  return async (request: RBACRequest, reply: FastifyReply) => {
    if (!request.organizationId) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Organization ID required",
      });
    }

    const seatCheck = await checkSeatLimit(request.organizationId);
    
    if (!seatCheck.allowed) {
      return reply.status(403).send({
        error: "Seat Limit Exceeded",
        message: seatCheck.reason,
        currentSeats: seatCheck.currentSeats,
        maxSeats: seatCheck.maxSeats,
      });
    }
  };
}
