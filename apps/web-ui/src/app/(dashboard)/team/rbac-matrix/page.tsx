"use client";

import { useState, useEffect } from "react";
import { 
  Shield, 
  Check, 
  X, 
  Loader2,
  Info,
  Crown,
  Code,
  Eye,
  ClipboardCheck,
} from "lucide-react";

type Role = "owner" | "admin" | "dev" | "viewer" | "compliance-auditor";
type Permission = string;

interface RoleMetadata {
  name: Role;
  displayName: string;
  description: string;
  color: string;
  icon: string;
}

interface PermissionMatrix {
  roles: Role[];
  permissions: Permission[];
  matrix: Record<Role, Record<Permission, boolean>>;
  roleMetadata: Record<Role, RoleMetadata>;
}

const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: string[] }> = {
  team: {
    label: "Team Management",
    permissions: ["manage_team", "invite_members", "remove_members", "assign_roles"],
  },
  audit: {
    label: "Audit & Compliance",
    permissions: ["view_audit", "export_audit", "manage_compliance", "view_compliance"],
  },
  reports: {
    label: "Reports",
    permissions: ["view_reports", "export_reports", "create_reports"],
  },
  operations: {
    label: "Operations",
    permissions: ["run_scan", "run_reality", "run_autopilot", "run_fix", "run_gate"],
  },
  policies: {
    label: "Policies",
    permissions: ["view_policies", "manage_policies", "create_policies"],
  },
  projects: {
    label: "Projects",
    permissions: ["view_projects", "create_projects", "delete_projects", "manage_project_settings"],
  },
  api: {
    label: "API & Integrations",
    permissions: ["manage_api_keys", "view_api_keys", "manage_webhooks", "manage_integrations"],
  },
  billing: {
    label: "Billing",
    permissions: ["view_billing", "manage_billing"],
  },
  admin: {
    label: "Admin",
    permissions: ["view_dashboard", "admin_settings"],
  },
};

const ROLE_ICONS: Record<Role, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  dev: Code,
  viewer: Eye,
  "compliance-auditor": ClipboardCheck,
};

const ROLE_COLORS: Record<Role, string> = {
  owner: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  admin: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  dev: "text-green-500 bg-green-100 dark:bg-green-900/30",
  viewer: "text-gray-500 bg-gray-100 dark:bg-gray-900/30",
  "compliance-auditor": "text-amber-500 bg-amber-100 dark:bg-amber-900/30",
};

function formatPermissionName(permission: string): string {
  return permission
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RBACMatrixPage() {
  const [matrixData, setMatrixData] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(PERMISSION_CATEGORIES)));

  useEffect(() => {
    fetchMatrix();
  }, []);

  async function fetchMatrix() {
    try {
      const response = await fetch("/api/team/rbac-matrix");
      if (!response.ok) throw new Error("Failed to fetch RBAC matrix");
      
      const data = await response.json();
      setMatrixData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(category: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !matrixData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error || "Failed to load RBAC matrix"}</p>
        </div>
      </div>
    );
  }

  const roles = matrixData.roles;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />
          RBAC Permission Matrix
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View role permissions across your organization (read-only)
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400">
          <strong>Transparency View:</strong> This matrix shows all permissions assigned to each role.
          Role assignments are managed in Team Settings. Contact an admin to request role changes.
        </div>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-3">
        {roles.map((role) => {
          const Icon = ROLE_ICONS[role];
          const colorClass = ROLE_COLORS[role];
          const metadata = matrixData.roleMetadata?.[role];
          
          return (
            <div
              key={role}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}
              title={metadata?.description}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{metadata?.displayName || role}</span>
            </div>
          );
        })}
      </div>

      {/* Permission Matrix Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white w-64">
                  Permission
                </th>
                {roles.map((role) => {
                  const Icon = ROLE_ICONS[role];
                  const metadata = matrixData.roleMetadata?.[role];
                  
                  return (
                    <th
                      key={role}
                      className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white min-w-[100px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="w-5 h-5" />
                        <span>{metadata?.displayName || role}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                <>
                  {/* Category Header */}
                  <tr
                    key={`category-${categoryKey}`}
                    className="bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <td
                      colSpan={roles.length + 1}
                      className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`transform transition-transform ${expandedCategories.has(categoryKey) ? "rotate-90" : ""}`}>
                          ▶
                        </span>
                        {category.label}
                        <span className="text-xs text-gray-500 font-normal">
                          ({category.permissions.length} permissions)
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Permission Rows */}
                  {expandedCategories.has(categoryKey) && category.permissions.map((permission) => {
                    // Skip if permission doesn't exist in matrix
                    if (!matrixData.permissions.includes(permission)) return null;
                    
                    return (
                      <tr
                        key={permission}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 pl-10">
                          {formatPermissionName(permission)}
                        </td>
                        {roles.map((role) => {
                          const hasPermission = matrixData.matrix[role]?.[permission as Permission];
                          
                          return (
                            <td key={`${role}-${permission}`} className="px-4 py-3 text-center">
                              {hasPermission ? (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <X className="w-4 h-4 text-gray-400" />
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {roles.map((role) => {
          const Icon = ROLE_ICONS[role];
          const colorClass = ROLE_COLORS[role];
          const metadata = matrixData.roleMetadata?.[role];
          const permissionCount = Object.values(matrixData.matrix[role] || {}).filter(Boolean).length;
          
          return (
            <div
              key={role}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${colorClass} mb-3`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{metadata?.displayName || role}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {permissionCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                permissions granted
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {metadata?.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
