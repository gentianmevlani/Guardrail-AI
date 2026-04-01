import { describe, it, expect } from 'vitest';
import { polishService } from '../polish/polish-service';

describe('PolishService', () => {
  describe('analyzeProject', () => {
    it('should analyze a project and return a polish report', async () => {
      const testProjectPath = './test-project';
      
      const report = await polishService.analyzeProject(testProjectPath);
      
      expect(report).toHaveProperty('projectPath');
      expect(report).toHaveProperty('totalIssues');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('score');
      expect(report).toHaveProperty('recommendations');
      expect(report.projectPath).toBe(testProjectPath);
    });

    it('should return valid issue counts', async () => {
      const report = await polishService.analyzeProject('./test-project');
      
      expect(report.totalIssues).toBeGreaterThanOrEqual(0);
      expect(report.critical).toBeGreaterThanOrEqual(0);
      expect(report.high).toBeGreaterThanOrEqual(0);
      expect(report.medium).toBeGreaterThanOrEqual(0);
      expect(report.low).toBeGreaterThanOrEqual(0);
      
      const sum = report.critical + report.high + report.medium + report.low;
      expect(sum).toBe(report.totalIssues);
    });

    it('should calculate score between 0 and 100', async () => {
      const report = await polishService.analyzeProject('./test-project');
      
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });

    it('should return issues with required properties', async () => {
      const report = await polishService.analyzeProject('./test-project');
      
      report.issues.forEach(issue => {
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('category');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('description');
        expect(issue).toHaveProperty('suggestion');
        expect(issue).toHaveProperty('autoFixable');
        expect(['critical', 'high', 'medium', 'low']).toContain(issue.severity);
        expect(typeof issue.autoFixable).toBe('boolean');
      });
    });

    it('should return recommendations array', async () => {
      const report = await polishService.analyzeProject('./test-project');
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      report.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
  });
});


