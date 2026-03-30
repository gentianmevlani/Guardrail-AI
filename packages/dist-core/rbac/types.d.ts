/**
 * RBAC Type Definitions
 *
 * Core types for Role-Based Access Control system.
 * Defines roles, permissions, and related interfaces.
 */
export declare const ROLES: readonly ["owner", "admin", "dev", "viewer", "compliance-auditor"];
export type Role = typeof ROLES[number];
/** Role hierarchy for permission inheritance (higher index = more permissions) */
export declare const ROLE_HIERARCHY: Record<Role, number>;
export declare const PERMISSIONS: readonly ["manage_team", "invite_members", "remove_members", "assign_roles", "view_audit", "export_audit", "manage_compliance", "view_compliance", "view_reports", "export_reports", "create_reports", "run_scan", "run_reality", "run_autopilot", "run_fix", "run_gate", "view_policies", "manage_policies", "create_policies", "view_projects", "create_projects", "delete_projects", "manage_project_settings", "manage_api_keys", "view_api_keys", "manage_webhooks", "manage_integrations", "view_billing", "manage_billing", "view_dashboard", "admin_settings"];
export type Permission = typeof PERMISSIONS[number];
/**
 * Default permissions for each role.
 * Roles inherit permissions from lower roles in the hierarchy.
 */
export declare const ROLE_PERMISSIONS: Record<Role, Permission[]>;
export interface RoleAssignment {
    userId: string;
    teamId: string;
    role: Role;
    assignedBy: string;
    assignedAt: Date;
}
export interface PermissionCheck {
    allowed: boolean;
    reason?: string;
    requiredRole?: Role;
    requiredPermissions?: Permission[];
}
export interface TeamMemberWithRole {
    id: string;
    userId: string;
    email: string;
    name: string;
    role: Role;
    joinedAt: Date;
    lastActive?: Date;
}
export interface TeamInvitation {
    id: string;
    teamId: string;
    email: string;
    role: Role;
    invitedBy: string;
    expiresAt: Date;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
}
export interface RBACContext {
    userId: string;
    teamId: string;
    role: Role;
    permissions: Permission[];
    tier?: string;
}
export interface PermissionMatrix {
    roles: Role[];
    permissions: Permission[];
    matrix: Record<Role, Record<Permission, boolean>>;
}
export interface RoleMetadata {
    name: Role;
    displayName: string;
    description: string;
    color: string;
    icon: string;
}
export declare const ROLE_METADATA: Record<Role, RoleMetadata>;
//# sourceMappingURL=types.d.ts.map