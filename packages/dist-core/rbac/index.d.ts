/**
 * RBAC Module - Role-Based Access Control
 *
 * Exports all RBAC types, permissions, and utilities.
 */
export type { Permission, PermissionCheck, PermissionMatrix, RBACContext, Role, RoleAssignment, RoleMetadata, TeamInvitation, TeamMemberWithRole, } from './types';
export { PERMISSIONS, ROLE_HIERARCHY, ROLE_METADATA, ROLE_PERMISSIONS, ROLES, } from './types';
export { canAssignRole, canRemoveMember, checkTierAndPermission, compareRoles, generatePermissionMatrix, getEffectivePermissions, getMinimumRoleForPermission, hasAllPermissions, hasAnyPermission, hasPermission, isRoleAtLeast, isValidPermission, isValidRole, parseRole, roleHasPermission, } from './permissions';
//# sourceMappingURL=index.d.ts.map