/**
 * RBAC Permission Tests
 * 
 * Tests for role-based access control permission checking logic.
 * Validates acceptance criteria for different roles.
 */

import {
  canAssignRole,
  canRemoveMember,
  compareRoles,
  generatePermissionMatrix,
  getEffectivePermissions,
  getMinimumRoleForPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isRoleAtLeast,
  isValidPermission,
  isValidRole,
  parseRole,
  roleHasPermission,
} from '../permissions';
import {
  Permission,
  RBACContext,
  Role,
  ROLES,
} from '../types';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createContext(role: Role, tier?: string): RBACContext {
  return {
    userId: 'user_123',
    teamId: 'team_456',
    role,
    permissions: getEffectivePermissions(role),
    tier,
  };
}

// =============================================================================
// ROLE VALIDATION TESTS
// =============================================================================

describe('Role Validation', () => {
  test('isValidRole returns true for valid roles', () => {
    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('dev')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('compliance-auditor')).toBe(true);
  });

  test('isValidRole returns false for invalid roles', () => {
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('ADMIN')).toBe(false);
  });

  test('parseRole returns role for valid input', () => {
    expect(parseRole('owner')).toBe('owner');
    expect(parseRole('admin')).toBe('admin');
  });

  test('parseRole returns null for invalid input', () => {
    expect(parseRole('invalid')).toBeNull();
    expect(parseRole('')).toBeNull();
  });
});

// =============================================================================
// PERMISSION VALIDATION TESTS
// =============================================================================

describe('Permission Validation', () => {
  test('isValidPermission returns true for valid permissions', () => {
    expect(isValidPermission('manage_team')).toBe(true);
    expect(isValidPermission('view_audit')).toBe(true);
    expect(isValidPermission('run_autopilot')).toBe(true);
  });

  test('isValidPermission returns false for invalid permissions', () => {
    expect(isValidPermission('invalid_permission')).toBe(false);
    expect(isValidPermission('')).toBe(false);
  });
});

// =============================================================================
// ROLE HIERARCHY TESTS
// =============================================================================

describe('Role Hierarchy', () => {
  test('compareRoles returns correct hierarchy order', () => {
    expect(compareRoles('owner', 'admin')).toBeGreaterThan(0);
    expect(compareRoles('admin', 'dev')).toBeGreaterThan(0);
    expect(compareRoles('dev', 'viewer')).toBeGreaterThan(0);
    expect(compareRoles('viewer', 'owner')).toBeLessThan(0);
    expect(compareRoles('admin', 'admin')).toBe(0);
  });

  test('isRoleAtLeast correctly compares roles', () => {
    expect(isRoleAtLeast('owner', 'admin')).toBe(true);
    expect(isRoleAtLeast('owner', 'owner')).toBe(true);
    expect(isRoleAtLeast('admin', 'owner')).toBe(false);
    expect(isRoleAtLeast('dev', 'viewer')).toBe(true);
    expect(isRoleAtLeast('viewer', 'dev')).toBe(false);
  });
});

// =============================================================================
// PERMISSION CHECKING TESTS
// =============================================================================

describe('Permission Checking', () => {
  test('roleHasPermission returns correct values', () => {
    expect(roleHasPermission('owner', 'manage_billing')).toBe(true);
    expect(roleHasPermission('admin', 'manage_billing')).toBe(false);
    expect(roleHasPermission('viewer', 'view_dashboard')).toBe(true);
    expect(roleHasPermission('viewer', 'run_autopilot')).toBe(false);
  });

  test('hasPermission returns allowed for valid permissions', () => {
    const ownerContext = createContext('owner');
    const result = hasPermission(ownerContext, 'manage_billing');
    expect(result.allowed).toBe(true);
  });

  test('hasPermission returns denied with reason for missing permissions', () => {
    const viewerContext = createContext('viewer');
    const result = hasPermission(viewerContext, 'manage_team');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('manage_team');
    expect(result.requiredPermissions).toContain('manage_team');
  });

  test('hasAllPermissions requires all permissions', () => {
    const adminContext = createContext('admin');
    
    const allPresent = hasAllPermissions(adminContext, ['manage_team', 'run_autopilot']);
    expect(allPresent.allowed).toBe(true);
    
    const someMissing = hasAllPermissions(adminContext, ['manage_team', 'manage_billing']);
    expect(someMissing.allowed).toBe(false);
  });

  test('hasAnyPermission allows with any matching permission', () => {
    const devContext = createContext('dev');
    
    const onePresent = hasAnyPermission(devContext, ['run_scan', 'manage_billing']);
    expect(onePresent.allowed).toBe(true);
    
    const nonePresent = hasAnyPermission(devContext, ['manage_billing', 'admin_settings']);
    expect(nonePresent.allowed).toBe(false);
  });
});

// =============================================================================
// ACCEPTANCE CRITERIA TESTS
// =============================================================================

describe('Acceptance Criteria: Compliance Auditor', () => {
  const auditorContext = createContext('compliance-auditor');

  test('can view audit logs', () => {
    const result = hasPermission(auditorContext, 'view_audit');
    expect(result.allowed).toBe(true);
  });

  test('can export audit logs', () => {
    const result = hasPermission(auditorContext, 'export_audit');
    expect(result.allowed).toBe(true);
  });

  test('cannot edit policies', () => {
    const result = hasPermission(auditorContext, 'manage_policies');
    expect(result.allowed).toBe(false);
  });

  test('cannot manage team', () => {
    const result = hasPermission(auditorContext, 'manage_team');
    expect(result.allowed).toBe(false);
  });

  test('cannot run autopilot', () => {
    const result = hasPermission(auditorContext, 'run_autopilot');
    expect(result.allowed).toBe(false);
  });
});

describe('Acceptance Criteria: Viewer', () => {
  const viewerContext = createContext('viewer');

  test('can see dashboard', () => {
    const result = hasPermission(viewerContext, 'view_dashboard');
    expect(result.allowed).toBe(true);
  });

  test('can view reports', () => {
    const result = hasPermission(viewerContext, 'view_reports');
    expect(result.allowed).toBe(true);
  });

  test('cannot run Reality Mode', () => {
    const result = hasPermission(viewerContext, 'run_reality');
    expect(result.allowed).toBe(false);
  });

  test('cannot run Autopilot', () => {
    const result = hasPermission(viewerContext, 'run_autopilot');
    expect(result.allowed).toBe(false);
  });

  test('cannot run scans', () => {
    const result = hasPermission(viewerContext, 'run_scan');
    expect(result.allowed).toBe(false);
  });

  test('cannot manage policies', () => {
    const result = hasPermission(viewerContext, 'manage_policies');
    expect(result.allowed).toBe(false);
  });
});

describe('Acceptance Criteria: Developer', () => {
  const devContext = createContext('dev');

  test('can run scans', () => {
    const result = hasPermission(devContext, 'run_scan');
    expect(result.allowed).toBe(true);
  });

  test('can run Reality Mode', () => {
    const result = hasPermission(devContext, 'run_reality');
    expect(result.allowed).toBe(true);
  });

  test('can run fixes', () => {
    const result = hasPermission(devContext, 'run_fix');
    expect(result.allowed).toBe(true);
  });

  test('cannot run Autopilot', () => {
    const result = hasPermission(devContext, 'run_autopilot');
    expect(result.allowed).toBe(false);
  });

  test('cannot manage team', () => {
    const result = hasPermission(devContext, 'manage_team');
    expect(result.allowed).toBe(false);
  });
});

describe('Acceptance Criteria: Admin', () => {
  const adminContext = createContext('admin');

  test('can manage team', () => {
    const result = hasPermission(adminContext, 'manage_team');
    expect(result.allowed).toBe(true);
  });

  test('can run Autopilot', () => {
    const result = hasPermission(adminContext, 'run_autopilot');
    expect(result.allowed).toBe(true);
  });

  test('can manage policies', () => {
    const result = hasPermission(adminContext, 'manage_policies');
    expect(result.allowed).toBe(true);
  });

  test('cannot manage billing', () => {
    const result = hasPermission(adminContext, 'manage_billing');
    expect(result.allowed).toBe(false);
  });
});

describe('Acceptance Criteria: Owner', () => {
  const ownerContext = createContext('owner');

  test('has all permissions', () => {
    const permissions: Permission[] = [
      'manage_team',
      'manage_billing',
      'run_autopilot',
      'manage_policies',
      'admin_settings',
    ];
    
    for (const permission of permissions) {
      const result = hasPermission(ownerContext, permission);
      expect(result.allowed).toBe(true);
    }
  });
});

// =============================================================================
// ROLE ASSIGNMENT TESTS
// =============================================================================

describe('Role Assignment', () => {
  test('owner can assign any role', () => {
    expect(canAssignRole('owner', 'admin').allowed).toBe(true);
    expect(canAssignRole('owner', 'dev').allowed).toBe(true);
    expect(canAssignRole('owner', 'viewer').allowed).toBe(true);
    expect(canAssignRole('owner', 'compliance-auditor').allowed).toBe(true);
  });

  test('admin can assign lower roles', () => {
    expect(canAssignRole('admin', 'dev').allowed).toBe(true);
    expect(canAssignRole('admin', 'viewer').allowed).toBe(true);
  });

  test('admin cannot assign admin or owner', () => {
    expect(canAssignRole('admin', 'admin').allowed).toBe(false);
    expect(canAssignRole('admin', 'owner').allowed).toBe(false);
  });

  test('dev cannot assign roles', () => {
    expect(canAssignRole('dev', 'viewer').allowed).toBe(false);
  });

  test('viewer cannot assign roles', () => {
    expect(canAssignRole('viewer', 'viewer').allowed).toBe(false);
  });
});

// =============================================================================
// MEMBER REMOVAL TESTS
// =============================================================================

describe('Member Removal', () => {
  test('owner can remove any non-owner member', () => {
    expect(canRemoveMember('owner', 'admin').allowed).toBe(true);
    expect(canRemoveMember('owner', 'dev').allowed).toBe(true);
    expect(canRemoveMember('owner', 'viewer').allowed).toBe(true);
  });

  test('nobody can remove owner', () => {
    expect(canRemoveMember('owner', 'owner').allowed).toBe(false);
    expect(canRemoveMember('admin', 'owner').allowed).toBe(false);
  });

  test('admin can remove lower roles', () => {
    expect(canRemoveMember('admin', 'dev').allowed).toBe(true);
    expect(canRemoveMember('admin', 'viewer').allowed).toBe(true);
  });

  test('admin cannot remove admin', () => {
    expect(canRemoveMember('admin', 'admin').allowed).toBe(false);
  });

  test('dev cannot remove members', () => {
    expect(canRemoveMember('dev', 'viewer').allowed).toBe(false);
  });
});

// =============================================================================
// PERMISSION MATRIX TESTS
// =============================================================================

describe('Permission Matrix', () => {
  test('generatePermissionMatrix returns valid structure', () => {
    const matrix = generatePermissionMatrix();
    
    expect(matrix.roles).toEqual(ROLES);
    expect(matrix.permissions.length).toBeGreaterThan(0);
    expect(typeof matrix.matrix).toBe('object');
  });

  test('matrix contains all role-permission combinations', () => {
    const matrix = generatePermissionMatrix();
    
    for (const role of ROLES) {
      expect(matrix.matrix[role]).toBeDefined();
      for (const permission of matrix.permissions) {
        expect(typeof matrix.matrix[role][permission as Permission]).toBe('boolean');
      }
    }
  });

  test('matrix values match roleHasPermission', () => {
    const matrix = generatePermissionMatrix();
    
    for (const role of ROLES) {
      for (const permission of matrix.permissions) {
        const matrixValue = matrix.matrix[role][permission as Permission];
        const functionValue = roleHasPermission(role, permission as Permission);
        expect(matrixValue).toBe(functionValue);
      }
    }
  });
});

// =============================================================================
// MINIMUM ROLE TESTS
// =============================================================================

describe('Minimum Role for Permission', () => {
  test('getMinimumRoleForPermission returns correct minimum role', () => {
    expect(getMinimumRoleForPermission('view_dashboard')).toBe('viewer');
    expect(getMinimumRoleForPermission('view_audit')).toBe('compliance-auditor');
    expect(getMinimumRoleForPermission('run_scan')).toBe('dev');
    expect(getMinimumRoleForPermission('manage_team')).toBe('admin');
    expect(getMinimumRoleForPermission('manage_billing')).toBe('owner');
  });
});

// =============================================================================
// EFFECTIVE PERMISSIONS TESTS
// =============================================================================

describe('Effective Permissions', () => {
  test('getEffectivePermissions returns array for each role', () => {
    for (const role of ROLES) {
      const permissions = getEffectivePermissions(role);
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    }
  });

  test('owner has more permissions than admin', () => {
    const ownerPerms = getEffectivePermissions('owner');
    const adminPerms = getEffectivePermissions('admin');
    expect(ownerPerms.length).toBeGreaterThan(adminPerms.length);
  });

  test('admin has more permissions than dev', () => {
    const adminPerms = getEffectivePermissions('admin');
    const devPerms = getEffectivePermissions('dev');
    expect(adminPerms.length).toBeGreaterThan(devPerms.length);
  });

  test('viewer has fewest permissions', () => {
    const viewerPerms = getEffectivePermissions('viewer');
    for (const role of ROLES) {
      if (role !== 'viewer') {
        const otherPerms = getEffectivePermissions(role);
        expect(viewerPerms.length).toBeLessThanOrEqual(otherPerms.length);
      }
    }
  });
});
