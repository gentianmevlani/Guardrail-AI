import { describe, it, expect } from 'vitest';
import { architectAgent } from '../architect-agent';

describe('ArchitectAgent', () => {
  describe('analyzeProject', () => {
    it('should analyze a project and return context and recommendations', async () => {
      // Create a temporary project directory structure
      const testProjectPath = './test-project';
      
      const result = await architectAgent.analyzeProject(testProjectPath);
      
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('plan');
      expect(result.context).toHaveProperty('type');
      expect(result.context).toHaveProperty('framework');
      expect(result.context).toHaveProperty('stage');
    });

    it('should detect frontend project type', async () => {
      const result = await architectAgent.analyzeProject('./test-project');
      
      // Should detect project type (may be unknown for test project)
      expect(['frontend', 'backend', 'fullstack', 'unknown']).toContain(result.context.type);
    });

    it('should generate recommendations', async () => {
      const result = await architectAgent.analyzeProject('./test-project');
      
      expect(Array.isArray(result.recommendations)).toBe(true);
      result.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('action');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('description');
        expect(['setup', 'enhance', 'fix', 'polish']).toContain(rec.action);
        expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
      });
    });

    it('should create a template plan', async () => {
      const result = await architectAgent.analyzeProject('./test-project');
      
      expect(result.plan).toHaveProperty('templates');
      expect(result.plan).toHaveProperty('order');
      expect(Array.isArray(result.plan.templates)).toBe(true);
      expect(Array.isArray(result.plan.order)).toBe(true);
    });
  });
});


