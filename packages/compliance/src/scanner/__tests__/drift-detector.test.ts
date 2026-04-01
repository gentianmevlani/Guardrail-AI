import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DriftDetector } from '../drift-detector';
import { ComplianceScanResult } from '../types';
import { existsSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('DriftDetector', () => {
  let detector: DriftDetector;
  const testHistoryDir = '.guardrail/history-test';

  beforeEach(() => {
    detector = new DriftDetector(testHistoryDir);
  });

  afterEach(() => {
    const historyFile = join(process.cwd(), testHistoryDir, 'compliance.jsonl');
    if (existsSync(historyFile)) {
      try {
        unlinkSync(historyFile);
      } catch {}
    }
    
    const historyDir = join(process.cwd(), testHistoryDir);
    if (existsSync(historyDir)) {
      try {
        rmdirSync(historyDir, { recursive: true });
      } catch {}
    }
  });

  const createMockResult = (score: number, runId: string): ComplianceScanResult => ({
    runId,
    timestamp: new Date(),
    projectPath: '/test/project',
    framework: 'soc2',
    summary: {
      totalRules: 10,
      passed: Math.floor(score / 10),
      failed: 10 - Math.floor(score / 10),
      score
    },
    results: [
      {
        passed: true,
        controlId: 'CC6.1',
        severity: 'critical',
        message: 'Auth check passed',
        evidenceRefs: ['src/auth'],
        remediation: 'N/A'
      },
      {
        passed: score >= 50,
        controlId: 'CC6.7',
        severity: 'high',
        message: 'Encryption check',
        evidenceRefs: [],
        remediation: 'Implement encryption'
      }
    ],
    evidence: {
      runId,
      timestamp: new Date(),
      artifacts: []
    }
  });

  describe('saveToHistory', () => {
    it('should save scan result to history', () => {
      const result = createMockResult(80, 'test-run-1');
      detector.saveToHistory(result);

      const history = detector.loadHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.runId).toBe('test-run-1');
      expect(history[0]?.score).toBe(80);
    });

    it('should append multiple results', () => {
      const result1 = createMockResult(80, 'test-run-1');
      const result2 = createMockResult(85, 'test-run-2');
      
      detector.saveToHistory(result1);
      detector.saveToHistory(result2);

      const history = detector.loadHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.runId).toBe('test-run-1');
      expect(history[1]?.runId).toBe('test-run-2');
    });
  });

  describe('detectDrift', () => {
    it('should return undefined when no history exists', () => {
      const result = createMockResult(80, 'test-run-1');
      const drift = detector.detectDrift(result);
      expect(drift).toBeUndefined();
    });

    it('should detect score improvement', () => {
      const result1 = createMockResult(70, 'test-run-1');
      const result2 = createMockResult(85, 'test-run-2');
      
      detector.saveToHistory(result1);
      const drift = detector.detectDrift(result2);

      expect(drift).toBeDefined();
      expect(drift?.scoreDelta).toBe(15);
      expect(drift?.previousRunId).toBe('test-run-1');
    });

    it('should detect score regression', () => {
      const result1 = createMockResult(85, 'test-run-1');
      const result2 = createMockResult(70, 'test-run-2');
      
      detector.saveToHistory(result1);
      const drift = detector.detectDrift(result2);

      expect(drift).toBeDefined();
      expect(drift?.scoreDelta).toBe(-15);
    });

    it('should detect control regressions', () => {
      const result1: ComplianceScanResult = {
        ...createMockResult(80, 'test-run-1'),
        results: [
          {
            passed: true,
            controlId: 'CC6.7',
            severity: 'critical',
            message: 'Encryption check passed',
            evidenceRefs: [],
            remediation: 'N/A'
          }
        ]
      };

      const result2: ComplianceScanResult = {
        ...createMockResult(70, 'test-run-2'),
        results: [
          {
            passed: false,
            controlId: 'CC6.7',
            severity: 'critical',
            message: 'Encryption check failed',
            evidenceRefs: [],
            remediation: 'Implement encryption'
          }
        ]
      };
      
      detector.saveToHistory(result1);
      const drift = detector.detectDrift(result2);

      expect(drift).toBeDefined();
      expect(drift?.regressions.length).toBeGreaterThan(0);
      expect(drift?.regressions[0]?.controlId).toBe('CC6.7');
      expect(drift?.regressions[0]?.previousStatus).toBe('passed');
      expect(drift?.regressions[0]?.currentStatus).toBe('failed');
    });

    it('should detect new passes', () => {
      const result1: ComplianceScanResult = {
        ...createMockResult(70, 'test-run-1'),
        results: [
          {
            passed: false,
            controlId: 'CC6.7',
            severity: 'high',
            message: 'Encryption check failed',
            evidenceRefs: [],
            remediation: 'Implement encryption'
          }
        ]
      };

      const result2: ComplianceScanResult = {
        ...createMockResult(80, 'test-run-2'),
        results: [
          {
            passed: true,
            controlId: 'CC6.7',
            severity: 'high',
            message: 'Encryption check passed',
            evidenceRefs: ['package.json'],
            remediation: 'N/A'
          }
        ]
      };
      
      detector.saveToHistory(result1);
      const drift = detector.detectDrift(result2);

      expect(drift).toBeDefined();
      expect(drift?.newPasses.length).toBeGreaterThan(0);
      expect(drift?.newPasses).toContain('CC6.7');
    });
  });

  describe('getTrend', () => {
    it('should return trend for specific framework', () => {
      const soc2Result = createMockResult(80, 'soc2-run-1');
      const gdprResult = { ...createMockResult(75, 'gdpr-run-1'), framework: 'gdpr' };
      
      detector.saveToHistory(soc2Result);
      detector.saveToHistory(gdprResult);

      const trend = detector.getTrend('soc2', 10);
      expect(trend.length).toBe(1);
      expect(trend[0]?.framework).toBe('soc2');
    });

    it('should limit trend results', () => {
      for (let i = 0; i < 15; i++) {
        const result = createMockResult(80 + i, `test-run-${i}`);
        detector.saveToHistory(result);
      }

      const trend = detector.getTrend('soc2', 10);
      expect(trend.length).toBe(10);
    });

    it('should return most recent results', () => {
      const result1 = createMockResult(70, 'test-run-1');
      const result2 = createMockResult(80, 'test-run-2');
      const result3 = createMockResult(90, 'test-run-3');
      
      detector.saveToHistory(result1);
      detector.saveToHistory(result2);
      detector.saveToHistory(result3);

      const trend = detector.getTrend('soc2', 2);
      expect(trend.length).toBe(2);
      expect(trend[0]?.runId).toBe('test-run-2');
      expect(trend[1]?.runId).toBe('test-run-3');
    });
  });
});
