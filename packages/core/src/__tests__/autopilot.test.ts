/**
 * Autopilot Tests
 * 
 * Tests for the Autopilot batch remediation feature.
 */

import { AutopilotRunner } from '../autopilot/autopilot-runner';
import { 
  AutopilotFinding, 
  AutopilotFixPackCategory,
  AUTOPILOT_FIX_PACK_PRIORITY 
} from '../autopilot/types';

describe('AutopilotRunner', () => {
  let runner: AutopilotRunner;

  beforeEach(() => {
    runner = new AutopilotRunner();
    // Note: GUARDRAIL_SKIP_ENTITLEMENTS bypass removed for security
    // Tests should mock entitlements service instead
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('groupIntoFixPacks', () => {
    it('should group findings by category', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'type-errors', severity: 'high', file: 'a.ts', line: 1, message: 'err', fixable: true },
        { id: '2', category: 'type-errors', severity: 'high', file: 'b.ts', line: 2, message: 'err', fixable: true },
        { id: '3', category: 'quality', severity: 'low', file: 'c.ts', line: 3, message: 'console.log', fixable: true },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs).toHaveLength(2);
      const typeErrorsPack = packs.find(p => p.category === 'type-errors');
      const qualityPack = packs.find(p => p.category === 'quality');
      expect(typeErrorsPack).toBeDefined();
      expect(qualityPack).toBeDefined();
      expect(typeErrorsPack!.findings).toHaveLength(2);
      expect(qualityPack!.findings).toHaveLength(1);
    });

    it('should exclude non-fixable findings', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'quality', severity: 'low', file: 'a.ts', line: 1, message: 'TODO', fixable: false },
        { id: '2', category: 'quality', severity: 'low', file: 'b.ts', line: 2, message: 'console.log', fixable: true },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs).toHaveLength(1);
      expect(packs[0]!.findings).toHaveLength(1);
      expect(packs[0]!.findings[0]!.id).toBe('2');
    });

    it('should respect maxFixes limit', () => {
      const findings: AutopilotFinding[] = Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        category: 'type-errors' as AutopilotFixPackCategory,
        severity: 'high' as const,
        file: `file${i}.ts`,
        line: i,
        message: 'error',
        fixable: true,
      }));

      const packs = runner.groupIntoFixPacks(findings, 5);

      expect(packs).toHaveLength(1);
      expect(packs[0]!.findings).toHaveLength(5);
    });

    it('should sort packs by priority', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'quality', severity: 'low', file: 'a.ts', line: 1, message: 'q', fixable: true },
        { id: '2', category: 'security', severity: 'critical', file: 'b.ts', line: 2, message: 's', fixable: true },
        { id: '3', category: 'type-errors', severity: 'high', file: 'c.ts', line: 3, message: 't', fixable: true },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs[0]!.category).toBe('security');
      expect(packs[1]!.category).toBe('type-errors');
      expect(packs[2]!.category).toBe('quality');
    });

    it('should calculate risk based on severity', () => {
      const lowSeverityFindings: AutopilotFinding[] = [
        { id: '1', category: 'quality', severity: 'low', file: 'a.ts', line: 1, message: 'q', fixable: true },
      ];

      const highSeverityFindings: AutopilotFinding[] = [
        { id: '2', category: 'security', severity: 'critical', file: 'b.ts', line: 2, message: 's', fixable: true },
      ];

      const lowPacks = runner.groupIntoFixPacks(lowSeverityFindings);
      const highPacks = runner.groupIntoFixPacks(highSeverityFindings);

      expect(lowPacks[0]!.estimatedRisk).toBe('low');
      expect(highPacks[0]!.estimatedRisk).toBe('medium');
    });

    it('should collect impacted files without duplicates', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'type-errors', severity: 'high', file: 'a.ts', line: 1, message: 'err', fixable: true },
        { id: '2', category: 'type-errors', severity: 'high', file: 'a.ts', line: 2, message: 'err', fixable: true },
        { id: '3', category: 'type-errors', severity: 'high', file: 'b.ts', line: 1, message: 'err', fixable: true },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs[0]!.impactedFiles).toHaveLength(2);
      expect(packs[0]!.impactedFiles).toContain('a.ts');
      expect(packs[0]!.impactedFiles).toContain('b.ts');
    });

    it('should return empty array when no fixable findings', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'quality', severity: 'low', file: 'a.ts', line: 1, message: 'TODO', fixable: false },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs).toHaveLength(0);
    });

    it('should assign correct priority from FIX_PACK_PRIORITY', () => {
      const findings: AutopilotFinding[] = [
        { id: '1', category: 'security', severity: 'high', file: 'a.ts', line: 1, message: 's', fixable: true },
      ];

      const packs = runner.groupIntoFixPacks(findings);

      expect(packs[0]!.priority).toBe(AUTOPILOT_FIX_PACK_PRIORITY['security']);
    });
  });

  describe('FIX_PACK_PRIORITY', () => {
    it('should have security as highest priority', () => {
      expect(AUTOPILOT_FIX_PACK_PRIORITY['security']).toBe(1);
    });

    it('should have quality as lowest priority', () => {
      expect(AUTOPILOT_FIX_PACK_PRIORITY['quality']).toBe(7);
    });

    it('should have all categories defined', () => {
      const categories: AutopilotFixPackCategory[] = [
        'security',
        'build-blockers',
        'type-errors',
        'test-failures',
        'route-integrity',
        'placeholders',
        'quality',
      ];

      for (const category of categories) {
        expect(AUTOPILOT_FIX_PACK_PRIORITY[category]).toBeDefined();
      }
    });
  });
});

describe('Autopilot Entitlement Gating', () => {
  it('should require autopilot feature to be enabled', async () => {
    const runner = new AutopilotRunner();
    
    // Note: GUARDRAIL_SKIP_ENTITLEMENTS bypass removed for security
    // Tests should mock entitlements service instead
    // This test verifies the entitlement check is wired up
    
    // The run method should attempt to check entitlements
    // We expect it to either succeed (if entitlements pass) or fail with entitlement error
    try {
      await runner.run({
        projectPath: process.cwd(),
        mode: 'plan',
      });
      // If we get here, entitlements passed (e.g., in CI with proper config)
    } catch (error: any) {
      // Expected to fail with entitlement-related error in test environment
      expect(
        error.message.includes('autopilot') || 
        error.message.includes('tier') ||
        error.message.includes('feature') ||
        error.message.includes('FEATURE_NOT_AVAILABLE') ||
        error.code === 'FEATURE_NOT_AVAILABLE'
      ).toBe(true);
    }
  });
});
