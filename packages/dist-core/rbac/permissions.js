"use strict";
/**
 * RBAC Permission Checker
 *
 * Core permission checking logic for role-based access control.
 * Provides functions to verify user permissions against required permissions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleHasPermission = roleHasPermission;
exports.hasPermission = hasPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.hasAnyPermission = hasAnyPermission;
exports.compareRoles = compareRoles;
exports.isRoleAtLeast = isRoleAtLeast;
exports.getMinimumRoleForPermission = getMinimumRoleForPermission;
exports.getEffectivePermissions = getEffectivePermissions;
exports.checkTierAndPermission = checkTierAndPermission;
exports.generatePermissionMatrix = generatePermissionMatrix;
exports.canAssignRole = canAssignRole;
exports.canRemoveMember = canRemoveMember;
exports.isValidRole = isValidRole;
exports.isValidPermission = isValidPermission;
exports.parseRole = parseRole;
const tier_config_1 = require("../tier-config");
const types_1 = require("./types");
// ============================================================================
// PERMISSION CHECKING
// ============================================================================
/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, permission) {
    const permissions = types_1.ROLE_PERMISSIONS[role];
    return permissions.includes(permission);
}
/**
 * Check if a user has a specific permission based on their role
 */
function hasPermission(context, permission) {
    if (!context.role || !types_1.ROLES.includes(context.role)) {
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
function hasAllPermissions(context, permissions) {
    const missingPermissions = [];
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
function hasAnyPermission(context, permissions) {
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
function compareRoles(role1, role2) {
    return types_1.ROLE_HIERARCHY[role1] - types_1.ROLE_HIERARCHY[role2];
}
/**
 * Check if role1 is higher than or equal to role2 in the hierarchy
 */
function isRoleAtLeast(role, minimumRole) {
    return types_1.ROLE_HIERARCHY[role] >= types_1.ROLE_HIERARCHY[minimumRole];
}
/**
 * Get the minimum role required for a specific permission
 */
function getMinimumRoleForPermission(permission) {
    // Check roles from lowest to highest
    const orderedRoles = ['viewer', 'compliance-auditor', 'dev', 'admin', 'owner'];
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
function getEffectivePermissions(role) {
    return [...types_1.ROLE_PERMISSIONS[role]];
}
// ============================================================================
// TIER-BASED RESTRICTIONS
// ============================================================================
/**
 * Check if a tier allows a specific operation with RBAC
 */
function checkTierAndPermission(context, permission, requiredTier) {
    // First check permission
    const permissionCheck = hasPermission(context, permission);
    if (!permissionCheck.allowed) {
        return permissionCheck;
    }
    // Then check tier if provided
    if (context.tier) {
        const userTierIndex = tier_config_1.TIER_ORDER.indexOf(context.tier);
        const requiredTierIndex = tier_config_1.TIER_ORDER.indexOf(requiredTier);
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
function generatePermissionMatrix() {
    const matrix = {};
    for (const role of types_1.ROLES) {
        matrix[role] = {};
        for (const permission of types_1.PERMISSIONS) {
            matrix[role][permission] = roleHasPermission(role, permission);
        }
    }
    return {
        roles: [...types_1.ROLES],
        permissions: [...types_1.PERMISSIONS],
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
function canAssignRole(assignerRole, targetRole) {
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
    if (types_1.ROLE_HIERARCHY[targetRole] >= types_1.ROLE_HIERARCHY[assignerRole]) {
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
function canRemoveMember(removerRole, targetRole) {
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
    if (removerRole !== 'owner' && types_1.ROLE_HIERARCHY[targetRole] >= types_1.ROLE_HIERARCHY[removerRole]) {
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
function isValidRole(role) {
    return types_1.ROLES.includes(role);
}
/**
 * Validate if a string is a valid permission
 */
function isValidPermission(permission) {
    return types_1.PERMISSIONS.includes(permission);
}
/**
 * Get role from string with validation
 */
function parseRole(role) {
    return isValidRole(role) ? role : null;
}
