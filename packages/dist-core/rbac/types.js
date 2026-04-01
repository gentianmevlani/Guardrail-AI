"use strict";
/**
 * RBAC Type Definitions
 *
 * Core types for Role-Based Access Control system.
 * Defines roles, permissions, and related interfaces.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_METADATA = exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.ROLE_HIERARCHY = exports.ROLES = void 0;
// ============================================================================
// ROLES
// ============================================================================
exports.ROLES = ['owner', 'admin', 'dev', 'viewer', 'compliance-auditor'];
/** Role hierarchy for permission inheritance (higher index = more permissions) */
exports.ROLE_HIERARCHY = {
    'viewer': 0,
    'compliance-auditor': 1,
    'dev': 2,
    'admin': 3,
    'owner': 4,
};
// ============================================================================
// PERMISSIONS
// ============================================================================
exports.PERMISSIONS = [
    // Team Management
    'manage_team',
    'invite_members',
    'remove_members',
    'assign_roles',
    // Audit & Compliance
    'view_audit',
    'export_audit',
    'manage_compliance',
    'view_compliance',
    // Reports
    'view_reports',
    'export_reports',
    'create_reports',
    // Operations
    'run_scan',
    'run_reality',
    'run_autopilot',
    'run_fix',
    'run_gate',
    // Policies
    'view_policies',
    'manage_policies',
    'create_policies',
    // Projects
    'view_projects',
    'create_projects',
    'delete_projects',
    'manage_project_settings',
    // API & Integrations
    'manage_api_keys',
    'view_api_keys',
    'manage_webhooks',
    'manage_integrations',
    // Billing
    'view_billing',
    'manage_billing',
    // Admin
    'view_dashboard',
    'admin_settings',
];
// ============================================================================
// ROLE-PERMISSION MAPPING
// ============================================================================
/**
 * Default permissions for each role.
 * Roles inherit permissions from lower roles in the hierarchy.
 */
exports.ROLE_PERMISSIONS = {
    'viewer': [
        'view_dashboard',
        'view_projects',
        'view_reports',
        'view_compliance',
        'view_policies',
    ],
    'compliance-auditor': [
        // Inherits viewer permissions
        'view_dashboard',
        'view_projects',
        'view_reports',
        'view_compliance',
        'view_policies',
        // Additional audit permissions
        'view_audit',
        'export_audit',
        'export_reports',
    ],
    'dev': [
        // Inherits viewer permissions
        'view_dashboard',
        'view_projects',
        'view_reports',
        'view_compliance',
        'view_policies',
        // Dev operations
        'run_scan',
        'run_reality',
        'run_fix',
        'run_gate',
        'create_projects',
        'view_api_keys',
    ],
    'admin': [
        // Inherits dev permissions
        'view_dashboard',
        'view_projects',
        'view_reports',
        'view_compliance',
        'view_policies',
        'run_scan',
        'run_reality',
        'run_fix',
        'run_gate',
        'create_projects',
        'view_api_keys',
        // Admin permissions
        'manage_team',
        'invite_members',
        'remove_members',
        'assign_roles',
        'run_autopilot',
        'manage_policies',
        'create_policies',
        'delete_projects',
        'manage_project_settings',
        'manage_api_keys',
        'manage_webhooks',
        'manage_integrations',
        'view_audit',
        'export_audit',
        'export_reports',
        'create_reports',
        'manage_compliance',
        'view_billing',
    ],
    'owner': [
        // All permissions
        'manage_team',
        'invite_members',
        'remove_members',
        'assign_roles',
        'view_audit',
        'export_audit',
        'manage_compliance',
        'view_compliance',
        'view_reports',
        'export_reports',
        'create_reports',
        'run_scan',
        'run_reality',
        'run_autopilot',
        'run_fix',
        'run_gate',
        'view_policies',
        'manage_policies',
        'create_policies',
        'view_projects',
        'create_projects',
        'delete_projects',
        'manage_project_settings',
        'manage_api_keys',
        'view_api_keys',
        'manage_webhooks',
        'manage_integrations',
        'view_billing',
        'manage_billing',
        'view_dashboard',
        'admin_settings',
    ],
};
exports.ROLE_METADATA = {
    'owner': {
        name: 'owner',
        displayName: 'Owner',
        description: 'Full access to all features including billing and team deletion',
        color: '#8B5CF6', // purple
        icon: 'crown',
    },
    'admin': {
        name: 'admin',
        displayName: 'Admin',
        description: 'Manage team members, settings, and run all operations',
        color: '#3B82F6', // blue
        icon: 'shield',
    },
    'dev': {
        name: 'dev',
        displayName: 'Developer',
        description: 'Run scans, fixes, and manage projects',
        color: '#10B981', // green
        icon: 'code',
    },
    'viewer': {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'View-only access to dashboards and reports',
        color: '#6B7280', // gray
        icon: 'eye',
    },
    'compliance-auditor': {
        name: 'compliance-auditor',
        displayName: 'Compliance Auditor',
        description: 'View and export audit logs and compliance reports',
        color: '#F59E0B', // amber
        icon: 'clipboard-check',
    },
};
