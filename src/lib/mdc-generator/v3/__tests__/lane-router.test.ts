/**
 * Tests for Lane Router
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LaneRouter } from '../lane-router';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LaneRouter', () => {
  let testProjectPath: string;
  let router: LaneRouter;

  beforeEach(() => {
    testProjectPath = join(tmpdir(), `guardrail-test-${Date.now()}`);
    router = new LaneRouter(testProjectPath);
  });

  it('should assign CLI/MCP lane for CLI files', () => {
    const cliFiles = [
      'packages/cli/src/index.ts',
      'bin/runners/runMdc.ts',
      'mcp-server/index.js',
      'packages/core/src/autopilot.ts',
    ];

    for (const file of cliFiles) {
      const assignment = router.assignLane(join(testProjectPath, file));
      expect(assignment.lane).toBe('cli-mcp');
    }
  });

  it('should assign Dashboard lane for dashboard files', () => {
    const dashboardFiles = [
      'apps/web-ui/src/app/page.tsx',
      'apps/api/src/routes/dashboard.ts',
      'apps/api/src/services/billing.ts',
    ];

    for (const file of dashboardFiles) {
      const assignment = router.assignLane(join(testProjectPath, file));
      expect(assignment.lane).toBe('dashboard');
    }
  });

  it('should assign Shared lane for shared infrastructure', () => {
    const sharedFiles = [
      'packages/security/src/secrets/scanner.ts',
      'shared/models/user.ts',
      'prisma/schema.prisma',
      'src/lib/common.ts',
    ];

    for (const file of sharedFiles) {
      const assignment = router.assignLane(join(testProjectPath, file));
      expect(assignment.lane).toBe('shared');
    }
  });

  it('should group files by lane', () => {
    const files = [
      'packages/cli/src/index.ts',
      'apps/web-ui/src/app/page.tsx',
      'packages/security/src/scanner.ts',
      'bin/runners/runMdc.ts',
      'apps/api/src/routes/dashboard.ts',
    ];

    const grouped = router.groupByLane(files.map(f => join(testProjectPath, f)));

    expect(grouped['cli-mcp'].length).toBe(2);
    expect(grouped['dashboard'].length).toBe(2);
    expect(grouped['shared'].length).toBe(1);
  });

  it('should return correct pack names', () => {
    expect(router.getPackName('cli-mcp')).toBe('PACK_CLI_MCP.mdc');
    expect(router.getPackName('dashboard')).toBe('PACK_DASHBOARD.mdc');
    expect(router.getPackName('shared')).toBe('PACK_SHARED.mdc');
  });

  it('should return pack descriptions', () => {
    const cliDesc = router.getPackDescription('cli-mcp');
    expect(cliDesc).toContain('CLI');
    expect(cliDesc).toContain('MCP');

    const dashboardDesc = router.getPackDescription('dashboard');
    expect(dashboardDesc).toContain('Action registry');
    expect(dashboardDesc).toContain('API contracts');

    const sharedDesc = router.getPackDescription('shared');
    expect(sharedDesc).toContain('Shared');
  });
});
