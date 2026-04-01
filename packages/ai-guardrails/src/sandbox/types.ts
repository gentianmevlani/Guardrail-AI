import {
  AgentPermissionScope,
  FilesystemPermissions,
  NetworkPermissions,
  ShellPermissions,
  ResourceLimits,
} from '@guardrail/core';

export type {
  AgentPermissionScope,
  FilesystemPermissions,
  NetworkPermissions,
  ShellPermissions,
  ResourceLimits,
};

export interface PermissionTemplate {
  name: string;
  description: string;
  scope: AgentPermissionScope;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresApproval: boolean;
}
