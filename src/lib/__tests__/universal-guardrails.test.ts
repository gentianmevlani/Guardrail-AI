import { describe, it, expect } from 'vitest';
import { universalGuardrails } from '../universal-guardrails';
import type { GuardrailRule } from '../universal-guardrails';

describe('UniversalGuardrails', () => {
  describe('validateFile', () => {
    it('should reject files in root directory', async () => {
      const result = await universalGuardrails.validateFile(
        'UserProfile.tsx',
        'export const UserProfile = () => <div>Profile</div>;'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          rule: 'No Files in Root Directory',
          severity: 'error',
        })
      );
    });

    it('should allow allowed root files', async () => {
      const result = await universalGuardrails.validateFile(
        'package.json',
        '{"name": "test"}'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow files in src directory', async () => {
      const result = await universalGuardrails.validateFile(
        'src/components/Button.tsx',
        'export const Button = () => <button>Click</button>;'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect mock data usage', async () => {
      const result = await universalGuardrails.validateFile(
        'src/api/users.ts',
        'const data = await fetch("https://jsonplaceholder.typicode.com/users");'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          rule: 'No Mock Data',
          severity: 'error',
        })
      );
    });

    it('should detect hardcoded secrets', async () => {
      const result = await universalGuardrails.validateFile(
        'src/config.ts',
        'const apiKey = "sk-1234567890abcdef";'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          rule: 'No Hardcoded Secrets',
          severity: 'error',
        })
      );
    });

    it('should warn about console.log in production files', async () => {
      const result = await universalGuardrails.validateFile(
        'src/utils/logger.ts',
        'console.log("Debug message");'
      );

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          rule: 'No Console.log in Production',
        })
      );
    });

    it('should allow console.log in test files', async () => {
      const result = await universalGuardrails.validateFile(
        'src/utils/logger.test.ts',
        'console.log("Test debug");'
      );

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          rule: 'No Console.log in Production',
        })
      );
    });

    it('should detect any types in TypeScript files', async () => {
      const result = await universalGuardrails.validateFile(
        'src/utils/helper.ts',
        'function process(data: any) { return data; }'
      );

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          rule: 'No Any Type',
        })
      );
    });

    it('should not check any types in JavaScript files', async () => {
      const result = await universalGuardrails.validateFile(
        'src/utils/helper.js',
        'function process(data) { return data; }'
      );

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          rule: 'No Any Type',
        })
      );
    });

    it('should detect deep relative imports', async () => {
      const result = await universalGuardrails.validateFile(
        'src/features/user/components/Profile.tsx',
        'import { Button } from "../../../components/Button";'
      );

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          rule: 'No Deep Relative Imports',
        })
      );
    });
  });

  describe('getRulesForPlatform', () => {
    it('should return all rules for "all" platform', () => {
      const rules = universalGuardrails.getRulesForPlatform('all');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return platform-specific rules', () => {
      const rules = universalGuardrails.getRulesForPlatform('cursor');
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('getAllRules', () => {
    it('should return all registered rules', () => {
      const rules = universalGuardrails.getAllRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('name');
      expect(rules[0]).toHaveProperty('check');
    });
  });

  describe('addRule', () => {
    it('should add a custom rule', () => {
      const customRule: GuardrailRule = {
        id: 'custom-test-rule',
        name: 'Custom Test Rule',
        description: 'Test rule',
        severity: 'warning',
        platforms: ['all'],
        check: async () => true,
      };

      universalGuardrails.addRule(customRule);
      const rules = universalGuardrails.getAllRules();
      expect(rules).toContainEqual(expect.objectContaining({ id: 'custom-test-rule' }));
    });
  });

  describe('removeRule', () => {
    it('should remove a rule by id', () => {
      const initialCount = universalGuardrails.getAllRules().length;
      
      // Add a test rule
      const testRule: GuardrailRule = {
        id: 'test-remove-rule',
        name: 'Test Remove Rule',
        description: 'Test',
        severity: 'info',
        platforms: ['all'],
        check: async () => true,
      };
      
      universalGuardrails.addRule(testRule);
      expect(universalGuardrails.getAllRules().length).toBe(initialCount + 1);
      
      // Remove it
      universalGuardrails.removeRule('test-remove-rule');
      expect(universalGuardrails.getAllRules().length).toBe(initialCount);
      expect(universalGuardrails.getAllRules()).not.toContainEqual(
        expect.objectContaining({ id: 'test-remove-rule' })
      );
    });
  });

  describe('feature-based organization', () => {
    it('should allow components in src/components', async () => {
      const result = await universalGuardrails.validateFile(
        'src/components/Button.tsx',
        'export const Button = () => <button>Click</button>;'
      );

      expect(result.valid).toBe(true);
    });

    it('should allow components in src/features', async () => {
      const result = await universalGuardrails.validateFile(
        'src/features/user/components/UserProfile.tsx',
        'export const UserProfile = () => <div>Profile</div>;'
      );

      expect(result.valid).toBe(true);
    });
  });
});


