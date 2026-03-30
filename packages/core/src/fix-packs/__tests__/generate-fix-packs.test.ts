/**
 * Fix Packs Generator Tests
 * 
 * Tests for deterministic grouping and fix pack generation.
 */

import {
  generateFixPacks,
  parseFindingsFromScanOutput,
} from '../generate-fix-packs';
import {
  Finding,
  FindingCategory,
  SeverityLevel,
  compareSeverity,
  sortPacksBySeverity,
  generatePackId,
} from '../types';

describe('generateFixPacks', () => {
  const mockRepoFingerprint = {
    id: 'repo-abc123',
    name: 'test-repo',
    hasTypeScript: true,
    hasTests: true,
    packageManager: 'pnpm' as const,
    hash: 'abc123def456',
  };

  const createFinding = (
    id: string,
    category: FindingCategory,
    severity: SeverityLevel,
    file: string
  ): Finding => ({
    id,
    category,
    severity,
    title: `Test finding ${id}`,
    description: `Description for ${id}`,
    file,
    line: 10,
  });

  describe('deterministic grouping', () => {
    it('should produce identical output for identical input', () => {
      const findings: Finding[] = [
        createFinding('f1', 'secrets', 'critical', 'src/config.ts'),
        createFinding('f2', 'secrets', 'high', 'src/auth.ts'),
        createFinding('f3', 'routes', 'medium', 'src/routes/api.ts'),
      ];

      const result1 = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });
      const result2 = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });

      expect(result1.packs.length).toBe(result2.packs.length);
      expect(result1.packs.map(p => p.id)).toEqual(result2.packs.map(p => p.id));
    });

    it('should produce stable pack IDs across runs', () => {
      const findings: Finding[] = [
        createFinding('f1', 'mocks', 'medium', 'src/test/mock.ts'),
        createFinding('f2', 'mocks', 'medium', 'src/test/fixture.ts'),
      ];

      const result1 = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });
      const result2 = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });

      expect(result1.packs[0]!.id).toBe(result2.packs[0]!.id);
    });

    it('should maintain order independence for same findings', () => {
      const findings1: Finding[] = [
        createFinding('f1', 'secrets', 'critical', 'src/a.ts'),
        createFinding('f2', 'secrets', 'high', 'src/b.ts'),
      ];

      const findings2: Finding[] = [
        createFinding('f2', 'secrets', 'high', 'src/b.ts'),
        createFinding('f1', 'secrets', 'critical', 'src/a.ts'),
      ];

      const result1 = generateFixPacks({ findings: findings1, repoFingerprint: mockRepoFingerprint });
      const result2 = generateFixPacks({ findings: findings2, repoFingerprint: mockRepoFingerprint });

      expect(result1.packs.length).toBe(result2.packs.length);
      expect(result1.packs[0]!.findings.length).toBe(result2.packs[0]!.findings.length);
    });
  });

  describe('category grouping', () => {
    it('should group findings by category', () => {
      const findings: Finding[] = [
        createFinding('f1', 'secrets', 'critical', 'src/a.ts'),
        createFinding('f2', 'routes', 'medium', 'src/b.ts'),
        createFinding('f3', 'secrets', 'high', 'src/c.ts'),
      ];

      const result = generateFixPacks({
        findings,
        repoFingerprint: mockRepoFingerprint,
        groupByCategory: true,
      });

      const secretsPack = result.packs.find(p => p.category === 'secrets');
      const routesPack = result.packs.find(p => p.category === 'routes');

      expect(secretsPack).toBeDefined();
      expect(routesPack).toBeDefined();
      expect(secretsPack!.findings.length).toBe(2);
      expect(routesPack!.findings.length).toBe(1);
    });

    it('should prioritize categories correctly', () => {
      const findings: Finding[] = [
        createFinding('f1', 'placeholders', 'medium', 'src/a.ts'),
        createFinding('f2', 'secrets', 'critical', 'src/b.ts'),
        createFinding('f3', 'auth', 'high', 'src/c.ts'),
      ];

      const result = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });

      expect(result.packs[0]!.category).toBe('secrets');
      expect(result.packs[1]!.category).toBe('auth');
      expect(result.packs[2]!.category).toBe('placeholders');
    });
  });

  describe('severity sorting', () => {
    it('should sort packs by severity (highest first)', () => {
      const findings: Finding[] = [
        createFinding('f1', 'routes', 'low', 'src/a.ts'),
        createFinding('f2', 'mocks', 'critical', 'src/b.ts'),
        createFinding('f3', 'deps', 'medium', 'src/c.ts'),
      ];

      const result = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });

      expect(result.packs[0]!.severity).toBe('critical');
    });

    it('should assign pack severity based on highest finding severity', () => {
      const findings: Finding[] = [
        createFinding('f1', 'secrets', 'low', 'src/a.ts'),
        createFinding('f2', 'secrets', 'critical', 'src/b.ts'),
        createFinding('f3', 'secrets', 'medium', 'src/c.ts'),
      ];

      const result = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });
      const secretsPack = result.packs.find(p => p.category === 'secrets');

      expect(secretsPack!.severity).toBe('critical');
    });
  });

  describe('pack size limits', () => {
    it('should respect maxPackSize', () => {
      const findings: Finding[] = Array.from({ length: 25 }, (_, i) =>
        createFinding(`f${i}`, 'secrets', 'medium', `src/file${i}.ts`)
      );

      const result = generateFixPacks({
        findings,
        repoFingerprint: mockRepoFingerprint,
        maxPackSize: 10,
      });

      result.packs.forEach(pack => {
        expect(pack.findings.length).toBeLessThanOrEqual(10);
      });
    });

    it('should respect minPackSize', () => {
      const findings: Finding[] = [
        createFinding('f1', 'secrets', 'medium', 'src/a.ts'),
      ];

      const result = generateFixPacks({
        findings,
        repoFingerprint: mockRepoFingerprint,
        minPackSize: 2,
      });

      expect(result.ungrouped.length).toBe(1);
      expect(result.packs.length).toBe(0);
    });
  });

  describe('empty input', () => {
    it('should handle empty findings array', () => {
      const result = generateFixPacks({
        findings: [],
        repoFingerprint: mockRepoFingerprint,
      });

      expect(result.packs).toEqual([]);
      expect(result.ungrouped).toEqual([]);
      expect(result.stats.totalFindings).toBe(0);
      expect(result.stats.totalPacks).toBe(0);
    });
  });

  describe('stats calculation', () => {
    it('should calculate correct stats', () => {
      const findings: Finding[] = [
        createFinding('f1', 'secrets', 'critical', 'src/a.ts'),
        createFinding('f2', 'secrets', 'high', 'src/b.ts'),
        createFinding('f3', 'routes', 'medium', 'src/c.ts'),
        createFinding('f4', 'mocks', 'low', 'src/d.ts'),
      ];

      const result = generateFixPacks({ findings, repoFingerprint: mockRepoFingerprint });

      expect(result.stats.totalFindings).toBe(4);
      expect(result.stats.byCategory.secrets).toBe(2);
      expect(result.stats.byCategory.routes).toBe(1);
      expect(result.stats.byCategory.mocks).toBe(1);
      expect(result.stats.bySeverity.critical).toBe(1);
      expect(result.stats.bySeverity.high).toBe(1);
      expect(result.stats.bySeverity.medium).toBe(1);
      expect(result.stats.bySeverity.low).toBe(1);
    });
  });
});

describe('helper functions', () => {
  describe('compareSeverity', () => {
    it('should order critical < high < medium < low < info', () => {
      expect(compareSeverity('critical', 'high')).toBeLessThan(0);
      expect(compareSeverity('high', 'medium')).toBeLessThan(0);
      expect(compareSeverity('medium', 'low')).toBeLessThan(0);
      expect(compareSeverity('low', 'info')).toBeLessThan(0);
    });

    it('should return 0 for equal severities', () => {
      expect(compareSeverity('critical', 'critical')).toBe(0);
      expect(compareSeverity('medium', 'medium')).toBe(0);
    });
  });

  describe('generatePackId', () => {
    it('should generate stable IDs', () => {
      const id1 = generatePackId('secrets', 1, 'abc123');
      const id2 = generatePackId('secrets', 1, 'abc123');
      expect(id1).toBe(id2);
    });

    it('should include category prefix', () => {
      const id = generatePackId('secrets', 0, 'abc123');
      expect(id).toMatch(/^FP-SEC-/);
    });

    it('should include index', () => {
      const id1 = generatePackId('routes', 0, 'abc123');
      const id2 = generatePackId('routes', 1, 'abc123');
      expect(id1).toContain('-000-');
      expect(id2).toContain('-001-');
    });
  });

  describe('sortPacksBySeverity', () => {
    it('should sort packs by severity', () => {
      const packs = [
        { severity: 'low' as const },
        { severity: 'critical' as const },
        { severity: 'medium' as const },
      ] as any[];

      const sorted = sortPacksBySeverity(packs);
      expect(sorted[0]!.severity).toBe('critical');
      expect(sorted[1]!.severity).toBe('medium');
      expect(sorted[2]!.severity).toBe('low');
    });
  });
});

describe('parseFindingsFromScanOutput', () => {
  it('should parse JSON array format', () => {
    const input = JSON.stringify([
      { id: 'f1', category: 'secrets', severity: 'high', title: 'Test', file: 'a.ts' },
    ]);

    const findings = parseFindingsFromScanOutput(input);
    expect(findings.length).toBe(1);
    expect(findings[0]!.category).toBe('secrets');
  });

  it('should parse findings object format', () => {
    const input = JSON.stringify({
      findings: [
        { id: 'f1', category: 'mocks', severity: 'medium', message: 'Mock detected', filePath: 'b.ts' },
      ],
    });

    const findings = parseFindingsFromScanOutput(input);
    expect(findings.length).toBe(1);
    expect(findings[0]!.category).toBe('mocks');
  });

  it('should normalize category names', () => {
    const input = JSON.stringify([
      { id: 'f1', type: 'credential', severity: 'high', title: 'API key', file: 'c.ts' },
    ]);

    const findings = parseFindingsFromScanOutput(input);
    expect(findings[0]!.category).toBe('secrets');
  });

  it('should normalize severity levels', () => {
    const input = JSON.stringify([
      { id: 'f1', category: 'security', level: 'error', title: 'XSS', file: 'd.ts' },
    ]);

    const findings = parseFindingsFromScanOutput(input);
    expect(findings[0]!.severity).toBe('high');
  });
});
