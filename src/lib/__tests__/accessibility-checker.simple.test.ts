import { accessibilityChecker } from '../accessibility-checker';

describe('AccessibilityChecker', () => {
  describe('checkProject', () => {
    it('should be defined', () => {
      expect(accessibilityChecker).toBeDefined();
      expect(typeof accessibilityChecker.checkProject).toBe('function');
    });

    it('should return a report structure', async () => {
      // Test with a non-existent directory - should handle gracefully
      const report = await accessibilityChecker.checkProject('/nonexistent');
      
      expect(report).toBeDefined();
      expect(typeof report.totalIssues).toBe('number');
      expect(typeof report.score).toBe('number');
      expect(Array.isArray(report.issues)).toBe(true);
    });
  });
});
