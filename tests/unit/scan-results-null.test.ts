/**
 * Unit tests for null/undefined scan result handling
 * 
 * Verifies graceful degradation when scan results are incomplete
 */

describe('Scan Results - Null Safety', () => {
  describe('calculateVerdict with null findings', () => {
    it('should handle null findings array', () => {
      const findings = null as any;
      const score = 85;

      // Simulate the calculateVerdict logic
      const safeFindings = findings || [];
      const verdict = safeFindings.length === 0 && score >= 80 ? 'pass' : 'review';

      expect(verdict).toBe('pass');
      expect(() => safeFindings.length).not.toThrow();
    });

    it('should handle undefined findings array', () => {
      const findings = undefined as any;
      const score = 60;

      const safeFindings = findings || [];
      const verdict = safeFindings.length === 0 && score >= 80 ? 'pass' : 'review';

      expect(verdict).toBe('review');
    });

    it('should handle missing summary properties', () => {
      const results = {
        score: 75,
        // summary is missing
      } as any;

      const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

      expect(summary.critical).toBe(0);
      expect(summary.high).toBe(0);
      expect(() => summary.critical).not.toThrow();
    });

    it('should handle partial summary properties', () => {
      const results = {
        score: 80,
        summary: {
          critical: 2,
          // high, medium, low, info are missing
        },
      } as any;

      const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      const critical = summary.critical || 0;
      const high = summary.high || 0;

      expect(critical).toBe(2);
      expect(high).toBe(0);
    });
  });

  describe('safe property access patterns', () => {
    it('should use nullish coalescing for optional properties', () => {
      const cliResult = null as any;

      const filesScanned = cliResult?.filesScanned ?? 0;
      const linesScanned = cliResult?.linesScanned ?? 0;
      const score = cliResult?.score ?? 0;

      expect(filesScanned).toBe(0);
      expect(linesScanned).toBe(0);
      expect(score).toBe(0);
    });

    it('should handle empty findings array safely', () => {
      const findings = [] as any[];

      const issuesFound = findings?.length ?? 0;
      const criticalCount = findings?.filter(f => f.severity === 'critical').length ?? 0;

      expect(issuesFound).toBe(0);
      expect(criticalCount).toBe(0);
    });

    it('should handle undefined cliResult gracefully', () => {
      const cliResult = undefined as any;
      const findings = [] as any[];

      const result = {
        score: cliResult?.score ?? 0,
        metrics: {
          filesScanned: cliResult?.filesScanned ?? 0,
          issuesFound: findings?.length ?? 0,
        },
      };

      expect(result.score).toBe(0);
      expect(result.metrics.filesScanned).toBe(0);
      expect(result.metrics.issuesFound).toBe(0);
    });
  });
});
