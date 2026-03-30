/**
 * RBAC Permission Checker
 *
 * Core permission checking logic for role-based access control.
 * Provides functions to verify user permissions against required permissions.
 */
import { Tier } from '../tier-config';
import { Permission, PermissionCheck, PermissionMatrix, RBACContext, Role } from './types';
/**
 * Check if a role has a specific permission
 */
export declare function roleHasPermission(role: Role, permission: Permission): boolean;
/**
 * Check if a user has a specific permission based on their role
 */
export declare function hasPermission(context: RBACContext, permission: Permission): PermissionCheck;
/**
 * Check if a user has ALL of the specified permissions
 */
export declare function hasAllPermissions(context: RBACContext, permissions: Permission[]): PermissionCheck;
/**
 * Check if a user has ANY of the specified permissions
 */
export declare function hasAnyPermission(context: RBACContext, permissions: Permission[]): PermissionCheck;
/**
 * Compare two roles and return their relative hierarchy
 * Returns positive if role1 > role2, negative if role1 < role2, 0 if equal
 */
export declare function compareRoles(role1: Role, role2: Role): number;
/**
 * Check if role1 is higher than or equal to role2 in the hierarchy
 */
export declare function isRoleAtLeast(role: Role, minimumRole: Role): boolean;
/**
 * Get the minimum role required for a specific permission
 */
export declare function getMinimumRoleForPermission(permission: Permission): Role;
/**
 * Get all permissions for a role (including inherited)
 */
export declare function getEffectivePermissions(role: Role): Permission[];
/**
 * Check if a tier allows a specific operation with RBAC
 */
export declare function checkTierAndPermission(context: RBACContext, permission: Permission, requiredTier: Tier): PermissionCheck;
/**
 * Generate a permission matrix for UI display
 */
export declare function generatePermissionMatrix(): PermissionMatrix;
/**
 * Check if a user can assign a specific role to another user
 * Users can only assign roles lower than their own
 */
export declare function canAssignRole(assignerRole: Role, targetRole: Role): PermissionCheck;
/**
 * Check if a user can remove another user from the team
 */
export declare function canRemoveMember(removerRole: Role, targetRole: Role): PermissionCheck;
/**
 * Validate if a string is a valid role
 */
export declare function isValidRole(role: string): role is Role;
/**
 * Validate if a string is a valid permission
 */
export declare function isValidPermission(permission: string): permission is Permission;
/**
 * Get role from string with validation
 */
export declare function parseRole(role: string): Role | null;
//# sourceMappingURL=permissions.d.ts.map