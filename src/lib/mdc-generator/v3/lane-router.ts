/**
 * Lane Router
 * 
 * Routes context into separate packs to avoid merge conflicts:
 * - PACK_CLI_MCP.mdc: CLI commands, MCP tools, exit codes, evidence ladder
 * - PACK_DASHBOARD.mdc: Action registry, API contracts, permission model, button sweep
 */

import { relative } from 'path';

export type Lane = 'cli-mcp' | 'dashboard' | 'shared';

export interface LaneAssignment {
  lane: Lane;
  reason: string;
}

export interface FileLaneMapping {
  file: string;
  lane: Lane;
  reason: string;
}

export class LaneRouter {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Determine lane for a file
   */
  assignLane(filePath: string): LaneAssignment {
    const relativePath = relative(this.projectPath, filePath).replace(/\\/g, '/');

    // CLI/MCP lane
    if (
      relativePath.includes('packages/cli/') ||
      relativePath.includes('bin/runners/') ||
      relativePath.includes('mcp-server/') ||
      relativePath.includes('packages/core/src/') ||
      relativePath.includes('packages/ship/') ||
      relativePath.startsWith('bin/')
    ) {
      return {
        lane: 'cli-mcp',
        reason: 'CLI/MCP surface',
      };
    }

    // Dashboard lane
    if (
      relativePath.includes('apps/web-ui/') ||
      relativePath.includes('apps/api/src/routes/') ||
      relativePath.includes('apps/api/src/services/') ||
      relativePath.includes('apps/api/src/middleware/') ||
      relativePath.includes('apps/api/src/plugins/')
    ) {
      return {
        lane: 'dashboard',
        reason: 'Dashboard/API surface',
      };
    }

    // Shared (both lanes need this)
    if (
      relativePath.includes('packages/security/') ||
      relativePath.includes('packages/ai-guardrails/') ||
      relativePath.includes('shared/') ||
      relativePath.includes('prisma/') ||
      relativePath.includes('src/lib/')
    ) {
      return {
        lane: 'shared',
        reason: 'Shared infrastructure',
      };
    }

    // Default to CLI/MCP for unknown
    return {
      lane: 'cli-mcp',
      reason: 'Default assignment',
    };
  }

  /**
   * Assign lanes to multiple files
   */
  assignLanes(filePaths: string[]): FileLaneMapping[] {
    return filePaths.map(file => {
      const assignment = this.assignLane(file);
      return {
        file,
        lane: assignment.lane,
        reason: assignment.reason,
      };
    });
  }

  /**
   * Group files by lane
   */
  groupByLane(filePaths: string[]): Record<Lane, string[]> {
    const grouped: Record<Lane, string[]> = {
      'cli-mcp': [],
      'dashboard': [],
      'shared': [],
    };

    for (const file of filePaths) {
      const assignment = this.assignLane(file);
      grouped[assignment.lane].push(file);
    }

    return grouped;
  }

  /**
   * Get pack name for lane
   */
  getPackName(lane: Lane): string {
    switch (lane) {
      case 'cli-mcp':
        return 'PACK_CLI_MCP.mdc';
      case 'dashboard':
        return 'PACK_DASHBOARD.mdc';
      case 'shared':
        return 'PACK_SHARED.mdc';
    }
  }

  /**
   * Get pack description for lane
   */
  getPackDescription(lane: Lane): string {
    switch (lane) {
      case 'cli-mcp':
        return 'CLI commands, MCP tools, exit codes, evidence ladder, entitlements gating';
      case 'dashboard':
        return 'Action registry, typed API contracts, permission model, integration flows, button sweep rules';
      case 'shared':
        return 'Shared infrastructure: security, AI guardrails, database models, common utilities';
    }
  }
}
