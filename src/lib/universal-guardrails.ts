/**
 * Universal Guardrails System
 * 
 * Works across all AI coding platforms:
 * - VS Code (GitHub Copilot, Cursor, etc.)
 * - Cursor
 * - Windsurf
 * - Claude Desktop
 * - Any MCP-compatible editor
 * 
 * Provides consistent rules and validation across platforms
 * 
 * @module universal-guardrails
 * @example
 * ```typescript
 * const result = await universalGuardrails.validateFile('src/app.tsx', content);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { GuardrailError } from './errors';
import type { Result } from './types/result';

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  pattern?: RegExp;
  check: (filePath: string, content: string) => Promise<boolean>;
  fix?: (filePath: string, content: string) => Promise<string>;
  platforms: string[]; // ['vscode', 'cursor', 'windsurf', 'claude', 'all']
}

export interface GuardrailConfig {
  rules: GuardrailRule[];
  enabled: boolean;
  strictMode: boolean;
}

class UniversalGuardrails {
  private rules: GuardrailRule[] = [];

  constructor() {
    this.registerUniversalRules();
  }

  /**
   * Register universal rules that work across all platforms
   */
  private registerUniversalRules() {
    this.rules = [
      // File Organization Rules
      {
        id: 'no-root-files',
        name: 'No Files in Root Directory',
        description: 'Prevent creating files in root directory (except allowed config files)',
        severity: 'error',
        platforms: ['all'],
        check: async (filePath: string) => {
          const allowedRootFiles = [
            'package.json',
            'tsconfig.json',
            'jsconfig.json',
            '.gitignore',
            '.env',
            '.env.example',
            'README.md',
            'LICENSE',
            'Dockerfile',
            'docker-compose.yml',
          ];
          const fileName = path.basename(filePath);
          const isInRoot = !filePath.includes(path.sep) || filePath.split(path.sep).length === 1;
          return !isInRoot || allowedRootFiles.includes(fileName);
        },
      },
      {
        id: 'feature-based-organization',
        name: 'Feature-Based Organization',
        description: 'Enforce feature-based file organization',
        severity: 'warning',
        platforms: ['all'],
        check: async (filePath: string) => {
          // Components should be in /src/components or /src/features/[name]/components
          if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
            return filePath.includes('/src/components/') || 
                   filePath.includes('\\src\\components\\') ||
                   filePath.includes('/src/features/') ||
                   filePath.includes('\\src\\features\\');
          }
          return true;
        },
      },
      // Code Quality Rules
      {
        id: 'no-mock-data',
        name: 'No Mock Data',
        description: 'Prevent using mock data or fake endpoints',
        severity: 'error',
        pattern: /(jsonplaceholder|reqres\.in|mockapi|faker|fake)/i,
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          const rule = this.rules.find(r => r.id === 'no-mock-data');
          if (!rule?.pattern) return true;
          return !rule.pattern.test(content);
        },
      },
      {
        id: 'no-hardcoded-secrets',
        name: 'No Hardcoded Secrets',
        description: 'Prevent hardcoded API keys, passwords, or secrets',
        severity: 'error',
        pattern: /(api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]+['"]/i,
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          const rule = this.rules.find(r => r.id === 'no-hardcoded-secrets');
          if (!rule?.pattern) return true;
          return !rule.pattern.test(content);
        },
      },
      {
        id: 'no-console-log',
        name: 'No Console.log in Production',
        description: 'Warn about console.log statements (use logger instead)',
        severity: 'warning',
        pattern: /console\.(log|error|warn|debug)/,
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          // Allow in test files
          if (filePath.includes('.test.') || filePath.includes('.spec.')) return true;
          const rule = this.rules.find(r => r.id === 'no-console-log');
          if (!rule?.pattern) return true;
          return !rule.pattern.test(content);
        },
      },
      // API Rules
      {
        id: 'api-endpoint-validation',
        name: 'API Endpoint Validation',
        description: 'Ensure all API calls use registered endpoints',
        severity: 'error',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          // Check for fetch/axios calls
          const hasApiCall = /(fetch|axios|\.get|\.post|\.put|\.delete)\(/.test(content);
          if (!hasApiCall) return true;
          
          // Check if using validatedFetch or registered endpoints
          const usesValidatedFetch = /validatedFetch|apiValidator/.test(content);
          return usesValidatedFetch;
        },
      },
      // TypeScript Rules
      {
        id: 'no-any-type',
        name: 'No Any Type',
        description: 'Prevent using "any" type in TypeScript',
        severity: 'warning',
        pattern: /:\s*any\b/,
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return true;
          const rule = this.rules.find(r => r.id === 'no-any-type');
          if (!rule?.pattern) return true;
          return !rule.pattern.test(content);
        },
      },
      // Import Rules
      {
        id: 'no-relative-imports-deep',
        name: 'No Deep Relative Imports',
        description: 'Prevent deep relative imports (use @ aliases)',
        severity: 'warning',
        pattern: /from\s+['"]\.\.\/\.\.\/\.\.\//,
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          const rule = this.rules.find(r => r.id === 'no-relative-imports-deep');
          if (!rule?.pattern) return true;
          return !rule.pattern.test(content);
        },
      },
    ];
  }

  /**
   * Validate file against all rules
   * 
   * @param filePath - Path to the file being validated
   * @param content - Content of the file to validate
   * @returns Validation result with errors and warnings
   * 
   * @example
   * ```typescript
   * const result = await universalGuardrails.validateFile(
   *   'src/components/Button.tsx',
   *   'export const Button = () => <button>Click</button>;'
   * );
   * 
   * if (!result.valid) {
   *   result.errors.forEach(error => {
   *     console.error(`${error.rule}: ${error.message}`);
   *   });
   * }
   * ```
   */
  async validateFile(filePath: string, content: string): Promise<{
    valid: boolean;
    errors: Array<{ rule: string; message: string; severity: string }>;
    warnings: Array<{ rule: string; message: string }>;
  }> {
    const errors: Array<{ rule: string; message: string; severity: string }> = [];
    const warnings: Array<{ rule: string; message: string }> = [];

    for (const rule of this.rules) {
      try {
        const isValid = await rule.check(filePath, content);
        if (!isValid) {
          const issue = {
            rule: rule.name,
            message: rule.description,
            severity: rule.severity,
          };

          if (rule.severity === 'error') {
            errors.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      } catch (error) {
        // Log error but don't fail validation
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error checking rule ${rule.id}:`, errorMessage);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get rules for specific platform
   * 
   * @param platform - Platform name ('cursor', 'vscode', 'windsurf', 'claude', 'all')
   * @returns Array of rules applicable to the platform
   * 
   * @example
   * ```typescript
   * const cursorRules = universalGuardrails.getRulesForPlatform('cursor');
   * console.log(`Found ${cursorRules.length} rules for Cursor`);
   * ```
   */
  getRulesForPlatform(platform: string): GuardrailRule[] {
    return this.rules.filter(
      (rule) => rule.platforms.includes('all') || rule.platforms.includes(platform.toLowerCase())
    );
  }

  /**
   * Get all registered rules
   * 
   * @returns Array of all guardrail rules
   * 
   * @example
   * ```typescript
   * const allRules = universalGuardrails.getAllRules();
   * console.log(`Total rules: ${allRules.length}`);
   * ```
   */
  getAllRules(): GuardrailRule[] {
    return this.rules;
  }

  /**
   * Add a custom guardrail rule
   * 
   * @param rule - The guardrail rule to add
   * 
   * @example
   * ```typescript
   * universalGuardrails.addRule({
   *   id: 'custom-rule',
   *   name: 'Custom Rule',
   *   description: 'Prevents something',
   *   severity: 'warning',
   *   platforms: ['all'],
   *   check: async (filePath, content) => {
   *     return !content.includes('forbidden');
   *   }
   * });
   * ```
   */
  addRule(rule: GuardrailRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID
   * 
   * @param ruleId - ID of the rule to remove
   * 
   * @example
   * ```typescript
   * universalGuardrails.removeRule('no-console-log');
   * ```
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }
}

export const universalGuardrails = new UniversalGuardrails();

