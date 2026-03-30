import { AgentPermissionScope } from './types';

/**
 * Pre-built permission templates for common agent types
 */
export const PermissionTemplates: Record<string, AgentPermissionScope> = {
  /**
   * Code Reviewer: Read-only access to code files
   */
  codeReviewer: {
    filesystem: {
      allowedPaths: ['.'],
      deniedPaths: [
        '.git',
        'node_modules',
        '.env',
        '.env.local',
        'secrets',
        'credentials.json',
      ],
      operations: ['read'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
    },
    network: {
      allowedDomains: [],
      deniedDomains: [],
      maxRequests: 0,
      allowedProtocols: [],
    },
    shell: {
      allowedCommands: [],
      deniedCommands: ['*'],
      requireConfirmation: [],
      allowEnvironmentVariables: false,
    },
    resources: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxTokens: 100000,
      maxExecutionTimeMs: 60000, // 1 minute
    },
  },

  /**
   * Code Fixer: Controlled write access for fixing issues
   */
  codeFixer: {
    filesystem: {
      allowedPaths: ['src', 'lib', 'app', 'components'],
      deniedPaths: [
        '.git',
        'node_modules',
        '.env',
        '.env.local',
        'secrets',
        'credentials.json',
        'package.json',
        'package-lock.json',
      ],
      operations: ['read', 'write'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    network: {
      allowedDomains: [],
      deniedDomains: [],
      maxRequests: 0,
      allowedProtocols: [],
    },
    shell: {
      allowedCommands: [],
      deniedCommands: ['*'],
      requireConfirmation: [],
      allowEnvironmentVariables: false,
    },
    resources: {
      maxMemoryMB: 1024,
      maxCpuPercent: 70,
      maxTokens: 200000,
      maxExecutionTimeMs: 300000, // 5 minutes
    },
  },

  /**
   * Test Generator: Write access to test files, read access to source
   */
  testGenerator: {
    filesystem: {
      allowedPaths: ['.'],
      deniedPaths: [
        '.git',
        'node_modules',
        '.env',
        '.env.local',
        'secrets',
        'credentials.json',
      ],
      operations: ['read', 'write'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    network: {
      allowedDomains: [],
      deniedDomains: [],
      maxRequests: 0,
      allowedProtocols: [],
    },
    shell: {
      allowedCommands: ['npm test', 'yarn test', 'pnpm test', 'vitest', 'jest'],
      deniedCommands: ['rm', 'del', 'format', 'dd'],
      requireConfirmation: ['npm test', 'yarn test', 'pnpm test'],
      allowEnvironmentVariables: false,
    },
    resources: {
      maxMemoryMB: 2048,
      maxCpuPercent: 80,
      maxTokens: 300000,
      maxExecutionTimeMs: 600000, // 10 minutes
    },
  },

  /**
   * Full Access: Admin-level access (requires explicit approval)
   */
  fullAccess: {
    filesystem: {
      allowedPaths: ['.'],
      deniedPaths: [],
      operations: ['read', 'write', 'delete', 'execute'],
      maxFileSize: 100 * 1024 * 1024, // 100MB
    },
    network: {
      allowedDomains: [],
      deniedDomains: [],
      maxRequests: 1000,
      allowedProtocols: ['http', 'https', 'ws', 'wss'],
    },
    shell: {
      allowedCommands: ['*'],
      deniedCommands: [],
      requireConfirmation: ['rm -rf', 'format', 'dd', 'mkfs'],
      allowEnvironmentVariables: true,
    },
    resources: {
      maxMemoryMB: 8192,
      maxCpuPercent: 100,
      maxTokens: 1000000,
      maxExecutionTimeMs: 3600000, // 1 hour
    },
  },

  /**
   * API Integration: Network access for API calls, read-only filesystem
   */
  apiIntegration: {
    filesystem: {
      allowedPaths: ['.'],
      deniedPaths: [
        '.git',
        'node_modules',
        '.env',
        '.env.local',
        'secrets',
        'credentials.json',
      ],
      operations: ['read'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
    },
    network: {
      allowedDomains: [
        'api.github.com',
        'registry.npmjs.org',
        'api.stripe.com',
        'api.anthropic.com',
        'api.openai.com',
      ],
      deniedDomains: [],
      maxRequests: 100,
      allowedProtocols: ['https'],
    },
    shell: {
      allowedCommands: [],
      deniedCommands: ['*'],
      requireConfirmation: [],
      allowEnvironmentVariables: false,
    },
    resources: {
      maxMemoryMB: 1024,
      maxCpuPercent: 60,
      maxTokens: 150000,
      maxExecutionTimeMs: 300000, // 5 minutes
    },
  },
};
