/**
 * Types for Prisma JSON fields to satisfy InputJsonValue constraints
 */

export interface JsonValue {
  [key: string]: unknown;
}

export interface FilesystemPermissions extends JsonValue {
  read: boolean;
  write: boolean;
  execute: boolean;
  paths: string[];
  maxFileSize: number;
  allowedExtensions: string[];
}

export interface NetworkPermissions extends JsonValue {
  outbound: boolean;
  inbound: boolean;
  domains: string[];
  ports: number[];
  maxRequests: number;
  protocols: string[];
}

export interface ShellPermissions extends JsonValue {
  allowExecution: boolean;
  allowedCommands: string[];
  restrictedPaths: string[];
  allowSudo: boolean;
}

export interface ResourceLimits extends JsonValue {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxTokens: number;
  timeoutSeconds: number;
}

export interface FileSnapshot extends JsonValue {
  path: string;
  hash: string;
  size: number;
  modified: boolean;
  permissions: string;
}

export interface ResourceUsage extends JsonValue {
  memoryUsed: number;
  cpuUsed: number;
  tokensUsed: number;
  requestsMade: number;
  filesAccessed: number;
}
