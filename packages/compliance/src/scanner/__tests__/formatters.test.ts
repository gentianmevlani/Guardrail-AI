import { describe, it, expect } from 'vitest';
import { TableFormatter } from '../formatters/table-formatter';
import { JsonFormatter } from '../formatters/json-formatter';
import { SarifFormatter } from '../formatters/sarif-formatter';
import { ComplianceScanResult } from '../types';

describe('Formatters', () => {
  const mockResult: ComplianceScanResult = {
    runId: 'test-run-123',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    projectPath: '/test/project',
    framework: 'soc2',
    summary: {
      totalRules: 10,
      passed: 7,
      failed: 3,
      score: 75
    },
    results: [
      {
        passed: true,
        controlId: 'CC6.1',
        severity: 'critical',
        message: 'Authentication implemented',
        evidenceRefs: ['src/auth'],
        remediation: 'N/A'
      },
      {
        passed: false,
        controlId: 'CC6.7',
        severity: 'high',
        message: 'Encryption not configured',
        evidenceRefs: [],
        remediation: 'Implement encryption using bcrypt or argon2'
      },
      {
        passed: false,
        controlId: 'CC7.2',
        severity: 'medium',
        message: 'Monitoring not configured',
        evidenceRefs: [],
        remediation: 'Add APM tool like Sentry'
      }
    ],
    evidence: {
      runId: 'test-run-123',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      artifacts: [
        {
          type: 'config',
          path: 'config-snapshot.json',
          description: 'Configuration snapshot',
          metadata: {}
        }
      ]
    },
    drift: {
      previousRunId: 'test-run-122',
      scoreDelta: -5,
      newFailures: ['CC7.2'],
      newPasses: [],
      regressions: [
        {
          controlId: 'CC7.2',
          severity: 'medium',
          message: 'Monitoring not configured',
          previousStatus: 'passed',
          currentStatus: 'failed'
        }
      ]
    }
  };

  describe('TableFormatter', () => {
    it('should format result as table', () => {
      const formatter = new TableFormatter();
      const output = formatter.format(mockResult);

      expect(output).toContain('COMPLIANCE SCAN REPORT');
      expect(output).toContain('SOC2');
      expect(output).toContain('test-run-123');
      expect(output).toContain('SUMMARY');
      expect(output).toContain('Total Rules:  10');
      expect(output).toContain('Passed:       7');
      expect(output).toContain('Failed:       3');
      expect(output).toContain('Score:        75/100');
    });

    it('should include drift analysis', () => {
      const formatter = new TableFormatter();
      const output = formatter.format(mockResult);

      expect(output).toContain('DRIFT ANALYSIS');
      expect(output).toContain('Score Delta:  -5');
      expect(output).toContain('REGRESSIONS');
    });

    it('should categorize failures by severity', () => {
      const formatter = new TableFormatter();
      const output = formatter.format(mockResult);

      expect(output).toContain('HIGH SEVERITY FAILURES');
      expect(output).toContain('MEDIUM SEVERITY FAILURES');
      expect(output).toContain('CC6.7');
      expect(output).toContain('CC7.2');
    });

    it('should include remediation for failures', () => {
      const formatter = new TableFormatter();
      const output = formatter.format(mockResult);

      expect(output).toContain('Remediation:');
      expect(output).toContain('Implement encryption');
    });

    it('should show evidence collected', () => {
      const formatter = new TableFormatter();
      const output = formatter.format(mockResult);

      expect(output).toContain('EVIDENCE COLLECTED');
      expect(output).toContain('.guardrail/evidence/test-run-123/');
    });
  });

  describe('JsonFormatter', () => {
    it('should format result as JSON', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      expect(parsed.runId).toBe('test-run-123');
      expect(parsed.framework).toBe('soc2');
      expect(parsed.summary.score).toBe(75);
    });

    it('should include all result fields', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('runId');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('projectPath');
      expect(parsed).toHaveProperty('framework');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('results');
      expect(parsed).toHaveProperty('drift');
      expect(parsed).toHaveProperty('evidence');
    });

    it('should format timestamps as ISO strings', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should support compact formatting', () => {
      const formatter = new JsonFormatter();
      const prettyOutput = formatter.format(mockResult, true);
      const compactOutput = formatter.format(mockResult, false);

      expect(prettyOutput.length).toBeGreaterThan(compactOutput.length);
      expect(compactOutput).not.toContain('\n  ');
    });
  });

  describe('SarifFormatter', () => {
    it('should format result as SARIF', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      expect(parsed.version).toBe('2.1.0');
      expect(parsed.$schema).toContain('sarif-schema');
      expect(parsed.runs).toHaveLength(1);
    });

    it('should include tool information', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      const tool = parsed.runs[0].tool.driver;
      expect(tool.name).toBe('guardrail Compliance Scanner');
      expect(tool.version).toBeDefined();
      expect(tool.informationUri).toBeDefined();
    });

    it('should include rules', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      const rules = parsed.runs[0].tool.driver.rules;
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('shortDescription');
    });

    it('should only include failed results', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      const results = parsed.runs[0].results;
      expect(results.length).toBe(2);
      expect(results.every((r: any) => r.level === 'error' || r.level === 'warning')).toBe(true);
    });

    it('should map severity to SARIF levels', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      const results = parsed.runs[0].results;
      
      const highSeverity = results.find((r: any) => r.ruleId === 'CC6.7');
      expect(highSeverity.level).toBe('error');
      
      const mediumSeverity = results.find((r: any) => r.ruleId === 'CC7.2');
      expect(mediumSeverity.level).toBe('warning');
    });

    it('should include remediation in properties', () => {
      const formatter = new SarifFormatter();
      const output = formatter.format(mockResult);

      const parsed = JSON.parse(output);
      const results = parsed.runs[0].results;
      results.forEach((r: any) => {
        expect(r.properties).toHaveProperty('remediation');
      });
    });
  });
});
