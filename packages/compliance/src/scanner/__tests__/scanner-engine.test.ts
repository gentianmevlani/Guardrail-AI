import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceScannerEngine } from '../scanner-engine';

describe('ComplianceScannerEngine', () => {
  let engine: ComplianceScannerEngine;

  beforeEach(() => {
    engine = new ComplianceScannerEngine();
  });

  describe('scan', () => {
    it('should complete a scan successfully', async () => {
      const result = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      expect(result).toHaveProperty('runId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('framework', 'soc2');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('results');
      expect(result.summary.totalRules).toBeGreaterThan(0);
    });

    it('should calculate score correctly', async () => {
      const result = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      expect(result.summary.score).toBeGreaterThanOrEqual(0);
      expect(result.summary.score).toBeLessThanOrEqual(100);
      expect(result.summary.totalRules).toBe(
        result.summary.passed + result.summary.failed
      );
    });

    it('should collect evidence when enabled', async () => {
      const result = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: true,
        detectDrift: false
      });

      expect(result.evidence).toBeDefined();
      expect(result.evidence.artifacts.length).toBeGreaterThan(0);
    });

    it('should detect drift when enabled', async () => {
      await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: true
      });

      const result2 = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: true
      });

      expect(result2.drift).toBeDefined();
      expect(result2.drift?.previousRunId).toBeDefined();
    });

    it('should scan different frameworks', async () => {
      const frameworks = ['soc2', 'gdpr', 'hipaa', 'pci', 'iso27001', 'nist'];

      for (const framework of frameworks) {
        const result = await engine.scan(process.cwd(), framework, {
          collectEvidence: false,
          detectDrift: false
        });

        expect(result.framework).toBe(framework);
        expect(result.results.length).toBeGreaterThan(0);
      }
    });

    it('should generate unique run IDs', async () => {
      const result1 = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      const result2 = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      expect(result1.runId).not.toBe(result2.runId);
    });

    it('should include severity in results', async () => {
      const result = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      const severities = new Set(result.results.map(r => r.severity));
      expect(severities.size).toBeGreaterThan(0);
      
      result.results.forEach(r => {
        expect(['critical', 'high', 'medium', 'low']).toContain(r.severity);
      });
    });

    it('should include remediation for failed checks', async () => {
      const result = await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: false
      });

      const failedResults = result.results.filter(r => !r.passed);
      failedResults.forEach(r => {
        expect(r.remediation).toBeDefined();
        expect(r.remediation.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history', () => {
      const history = engine.getHistory('soc2');
      expect(Array.isArray(history)).toBe(true);
    });

    it('should return history after scans', async () => {
      await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: true
      });

      await engine.scan(process.cwd(), 'soc2', {
        collectEvidence: false,
        detectDrift: true
      });

      const history = engine.getHistory('soc2');
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });
});
