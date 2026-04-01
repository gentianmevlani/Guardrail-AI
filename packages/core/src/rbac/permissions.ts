/**
 * RBAC Permission Checker
 * 
 * Core permission checking logic for role-based access control.
 * Provides functions to verify user permissions against required permissions.
 */

import { Tier, TIER_ORDER } from '../tier-config';
import {
  Permission,
  PERMISSIONS,
  PermissionCheck,
  PermissionMatrix,
  RBACContext,
  Role,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  ROLES,
} from './types';

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Check if a user has a specific permission based on their role
 */
export function hasPermission(
  context: RBACContext,
  permission: Permission
): PermissionCheck {
  if (!context.role || !ROLES.includes(context.role)) {
    return {
      allowed: false,
      reason: 'Invalid or missing role',
    };
  }

  const hasAccess = roleHasPermission(context.role, permission);
  
  if (!hasAccess) {
    const requiredRole = getMinimumRoleForPermission(permission);
    return {
      allowed: false,
      reason: `Permission '${permission}' requires at least '${requiredRole}' role`,
      requiredRole,
      requiredPermissions: [permission],
    };
  }

  return { allowed: true };
}

/**
 * Check if a user has ALL of the specified permissions
 */
export function hasAllPermissions(
  context: RBACContext,
  permissions: Permission[]
): PermissionCheck {
  const missingPermissions: Permission[] = [];

  for (const permission of permissions) {
    if (!roleHasPermission(context.role, permission)) {
      missingPermissions.push(permission);
    }
  }

  if (missingPermissions.length > 0) {
    return {
      allowed: false,
      reason: `Missing required permissions: ${missingPermissions.join(', ')}`,
      requiredPermissions: missingPermissions,
    };
  }

  return { allowed: true };
}

/**
 * Check if a user has ANY of the specified permissions
 */
export function hasAnyPermission(
  context: RBACContext,
  permissions: Permission[]
): PermissionCheck {
  for (const permission of permissions) {
    if (roleHasPermission(context.role, permission)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Requires at least one of: ${permissions.join(', ')}`,
    requiredPermissions: permissions,
  };
}

// ============================================================================
// ROLE COMPARISON
// ============================================================================

/**
 * Compare two roles and return their relative hierarchy
 * Returns positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export function compareRoles(role1: Role, role2: Role): number {
  return ROLE_HIERARCHY[role1] - ROLE_HIERARCHY[role2];
}

/**
 * Check if role1 is higher than or equal to role2 in the hierarchy
 */
export function isRoleAtLeast(role: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get the minimum role required for a specific permission
 */
export function getMinimumRoleForPermission(permission: Permission): Role {
  // Check roles from lowest to highest
  const orderedRoles: Role[] = ['viewer', 'compliance-auditor', 'dev', 'admin', 'owner'];
  
  for (const role of orderedRoles) {
    if (roleHasPermission(role, permission)) {
      return role;
    }
  }
  
  // Default to owner if permission not found
  return 'owner';
}

/**
 * Get all permissions for a role (including inherited)
 */
export function getEffectivePermissions(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

// ============================================================================
// TIER-BASED RESTRICTIONS
// ============================================================================

/**
 * Check if a tier allows a specific operation with RBAC
 */
export function checkTierAndPermission(
  context: RBACContext,
  permission: Permission,
  requiredTier: Tier
): PermissionCheck {
  // First check permission
  const permissionCheck = hasPermission(context, permission);
  if (!permissionCheck.allowed) {
    return permissionCheck;
  }

  // Then check tier if provided
  if (context.tier) {
    const userTierIndex = TIER_ORDER.indexOf(context.tier as Tier);
    const requiredTierIndex = TIER_ORDER.indexOf(requiredTier);

    if (userTierIndex < requiredTierIndex) {
      return {
        allowed: false,
        reason: `This feature requires ${requiredTier} tier or higher`,
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

/**
 * Generate a permission matrix for UI display
 */
export function generatePermissionMatrix(): PermissionMatrix {
  const matrix: Record<Role, Record<Permission, boolean>> = {} as Record<Role, Record<Permission, boolean>>;

  for (const role of ROLES) {
    matrix[role] = {} as Record<Permission, boolean>;
    for (const permission of PERMISSIONS) {
      matrix[role][permission] = roleHasPermission(role, permission);
    }
  }

  return {
    roles: [...ROLES],
    permissions: [...PERMISSIONS],
    matrix,
  };
}

// ============================================================================
// ROLE ASSIGNMENT VALIDATION
// ============================================================================

/**
 * Check if a user can assign a specific role to another user
 * Users can only assign roles lower than their own
 */
export function canAssignRole(
  assignerRole: Role,
  targetRole: Role
): PermissionCheck {
  // Must have assign_roles permission
  if (!roleHasPermission(assignerRole, 'assign_roles')) {
    return {
      allowed: false,
      reason: 'You do not have permission to assign roles',
    };
  }

  // Cannot assign a role equal to or higher than your own (except owner can assign admin)
  if (assignerRole === 'owner') {
    return { allowed: true };
  }

  if (ROLE_HIERARCHY[targetRole] >= ROLE_HIERARCHY[assignerRole]) {
    return {
      allowed: false,
      reason: `Cannot assign role '${targetRole}' - must be lower than your role '${assignerRole}'`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a user can remove another user from the team
 */
export function canRemoveMember(
  removerRole: Role,
  targetRole: Role
): PermissionCheck {
  // Must have remove_members permission
  if (!roleHasPermission(removerRole, 'remove_members')) {
    return {
      allowed: false,
      reason: 'You do not have permission to remove members',
    };
  }

  // Cannot remove owner
  if (targetRole === 'owner') {
    return {
      allowed: false,
      reason: 'Cannot remove the team owner',
    };
  }

  // Cannot remove someone with equal or higher role (unless owner)
  if (removerRole !== 'owner' && ROLE_HIERARCHY[targetRole] >= ROLE_HIERARCHY[removerRole]) {
    return {
      allowed: false,
      reason: `Cannot remove a member with role '${targetRole}' - must have a lower role than yours`,
    };
  }

  return { allowed: true };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return ROLES.includes(role as Role);
}

/**
 * Validate if a string is a valid permission
 */
export function isValidPermission(permission: string): permission is Permission {
  return PERMISSIONS.includes(permission as Permission);
}

/**
 * Get role from string with validation
 */
export function parseRole(role: string): Role | null {
  return isValidRole(role) ? role : null;
}
