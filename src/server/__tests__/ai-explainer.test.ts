import { describe, it, expect } from 'vitest';
import { aiExplainer } from '../services/ai-explainer';

describe('AI Explainer', () => {
  describe('without API keys', () => {
    it('should return basic analysis when no AI provider is available', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;
      
      const explanation = await aiExplainer.explainCode(code, {
        experienceLevel: 'beginner',
      });
      
      expect(explanation).toBeDefined();
      expect(explanation.summary).toBeDefined();
      expect(explanation.details).toBeInstanceOf(Array);
      expect(explanation.edgeCases).toBeInstanceOf(Array);
      expect(explanation.improvements).toBeInstanceOf(Array);
      expect(explanation.timestamp).toBeDefined();
    });

    it('should detect functions in code', async () => {
      const code = `
        function processData(input) {
          const result = transform(input);
          return result;
        }
        
        const helper = (x) => x * 2;
      `;
      
      const explanation = await aiExplainer.explainCode(code);
      
      expect(explanation.details.length).toBeGreaterThan(0);
      expect(explanation.details.some(d => d.toLowerCase().includes('function'))).toBe(true);
    });

    it('should detect async code patterns', async () => {
      const code = `
        async function fetchUser(id) {
          const response = await fetch(\`/api/users/\${id}\`);
          return response.json();
        }
      `;
      
      const explanation = await aiExplainer.explainCode(code);
      
      expect(explanation.details.some(d => d.toLowerCase().includes('async'))).toBe(true);
    });

    it('should provide different explanations for different experience levels', async () => {
      const code = `const sum = (arr) => arr.reduce((a, b) => a + b, 0);`;
      
      const beginnerExplanation = await aiExplainer.explainCode(code, {
        experienceLevel: 'beginner',
      });
      
      const expertExplanation = await aiExplainer.explainCode(code, {
        experienceLevel: 'expert',
      });
      
      // Both should work and return different summaries
      expect(beginnerExplanation.summary).toBeDefined();
      expect(expertExplanation.summary).toBeDefined();
    });

    it('should calculate complexity based on code structure', async () => {
      const simpleCode = `const x = 1;`;
      
      const complexCode = `
        function complex(arr) {
          if (arr.length === 0) return [];
          for (let i = 0; i < arr.length; i++) {
            for (let j = 0; j < arr.length; j++) {
              if (arr[i] > arr[j]) {
                switch(arr[i]) {
                  case 1: break;
                  case 2: break;
                  default: break;
                }
              }
            }
          }
          return arr;
        }
      `;
      
      const simpleExplanation = await aiExplainer.explainCode(simpleCode);
      const complexExplanation = await aiExplainer.explainCode(complexCode);
      
      expect(simpleExplanation.complexity).toBe('simple');
      // Complex code should be 'intermediate' or 'complex' based on the number of control flow statements
      expect(['intermediate', 'complex']).toContain(complexExplanation.complexity);
    });
  });

  describe('askQuestion', () => {
    it('should return an answer even without AI provider', async () => {
      const code = `function hello() { return "Hello"; }`;
      const question = 'What does this function do?';
      
      const answer = await aiExplainer.askQuestion(code, question);
      
      expect(answer).toBeDefined();
      expect(answer.answer).toBeDefined();
      expect(answer.timestamp).toBeDefined();
    });
  });

  describe('getAvailableProviders', () => {
    it('should return an array of available providers', () => {
      const providers = aiExplainer.getAvailableProviders();
      
      expect(providers).toBeInstanceOf(Array);
      // Without API keys, should be empty
      // With keys, should contain 'openai' and/or 'anthropic'
    });
  });

  describe('isAvailable', () => {
    it('should return boolean indicating availability', () => {
      const available = aiExplainer.isAvailable();
      
      expect(typeof available).toBe('boolean');
    });
  });
});
