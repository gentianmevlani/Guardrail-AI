/**
 * Scan Output Schema - Hardened Verdict Tests
 * 
 * Tests for hardened confidence thresholds and sorting
 */

const {
  isBlocker,
  calculateVerdict,
  sortFindings,
  getConfidenceScore,
} = require('../../bin/runners/lib/scan-output-schema');

describe('Hardened Verdict Logic', () => {
  describe('isBlocker - Hardened Thresholds', () => {
    it('should block critical findings only if confidence > 80%', () => {
      const finding = { severity: 'critical', confidence: 75, type: 'vulnerability' };
      expect(isBlocker(finding)).toBe(false); // 75% < 80%

      finding.confidence = 81;
      expect(isBlocker(finding)).toBe(true); // 81% > 80%
    });

    it('should block high findings only if confidence > 90%', () => {
      const finding = { severity: 'high', confidence: 85, type: 'issue' };
      expect(isBlocker(finding)).toBe(false); // 85% < 90%

      finding.confidence = 91;
      expect(isBlocker(finding)).toBe(true); // 91% > 90%
    });

    it('should always block secrets regardless of confidence', () => {
      const finding = { severity: 'high', confidence: 50, type: 'secret' };
      expect(isBlocker(finding)).toBe(true); // Secrets always block
    });

    it('should not block medium findings', () => {
      const finding = { severity: 'medium', confidence: 100, type: 'issue' };
      expect(isBlocker(finding)).toBe(false);
    });
  });

  describe('sortFindings - Shipping Impact', () => {
    it('should put blockers first', () => {
      const findings = [
        { severity: 'high', confidence: 50, blocksShip: false },
        { severity: 'critical', confidence: 85, blocksShip: true },
        { severity: 'low', confidence: 30, blocksShip: false },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].blocksShip).toBe(true);
    });

    it('should sort by severity within same blocker status', () => {
      const findings = [
        { severity: 'medium', confidence: 50, blocksShip: false },
        { severity: 'critical', confidence: 50, blocksShip: false },
        { severity: 'high', confidence: 50, blocksShip: false },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('high');
      expect(sorted[2].severity).toBe('medium');
    });

    it('should sort by confidence within same severity', () => {
      const findings = [
        { severity: 'high', confidence: 50, blocksShip: false },
        { severity: 'high', confidence: 90, blocksShip: false },
        { severity: 'high', confidence: 70, blocksShip: false },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].confidence).toBe(90);
      expect(sorted[1].confidence).toBe(70);
      expect(sorted[2].confidence).toBe(50);
    });
  });

  describe('calculateVerdict', () => {
    it('should return fail only for blockers or high-confidence criticals', () => {
      const findings = [
        { severity: 'critical', confidence: 75, blocksShip: false }, // Not a blocker (75% < 80%)
        { severity: 'high', confidence: 85, blocksShip: false }, // Not a blocker (85% < 90%)
      ];
      expect(calculateVerdict(findings)).toBe('warn'); // Should warn, not fail
    });

    it('should return fail for actual blockers', () => {
      const findings = [
        { severity: 'critical', confidence: 85, blocksShip: true },
      ];
      expect(calculateVerdict(findings)).toBe('fail');
    });
  });
});
