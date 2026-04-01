/**
 * Enhanced Error Context
 * 
 * Provides context-aware error messages with suggested fixes and code examples
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import { semanticCodeSearch } from './semantic-search';

export interface ValidationError {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
  line?: number;
  code?: string;
}

export interface CodeContext {
  file: string;
  surroundingCode?: string;
  relatedFiles?: string[];
  similarPatterns?: Array<{ file: string; code: string }>;
}

export interface EnhancedError {
  original: ValidationError;
  context: CodeContext;
  explanation: string;
  suggestedFixes: FixSuggestion[];
  relatedDocs?: string[];
  commonMistake?: boolean;
}

export interface FixSuggestion {
  description: string;
  codeExample?: string;
  file?: string;
  priority: 'high' | 'medium' | 'low';
}

class ErrorEnhancer {
  private errorPatterns: Map<string, number> = new Map();

  /**
   * Enhance error with context and suggestions
   */
  async enhanceError(
    error: ValidationError,
    projectPath: string
  ): Promise<EnhancedError> {
    // Track error pattern
    this.trackErrorPattern(error);

    // Get code context
    const context = await this.getCodeContext(error, projectPath);

    // Generate explanation
    const explanation = this.generateExplanation(error, context);

    // Generate suggested fixes
    const suggestedFixes = await this.generateFixes(error, context, projectPath);

    // Check if this is a common mistake
    const commonMistake = this.isCommonMistake(error);

    // Get related documentation
    const relatedDocs = this.getRelatedDocs(error);

    return {
      original: error,
      context,
      explanation,
      suggestedFixes,
      relatedDocs,
      commonMistake,
    };
  }

  /**
   * Get code context for error
   */
  private async getCodeContext(
    error: ValidationError,
    projectPath: string
  ): Promise<CodeContext> {
    const context: CodeContext = {
      file: error.file || 'unknown',
    };

    if (error.file) {
      try {
        const fullPath = path.join(projectPath, error.file);
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const lines = content.split('\n');

        // Get surrounding code
        if (error.line) {
          const start = Math.max(0, error.line - 5);
          const end = Math.min(lines.length, error.line + 5);
          context.surroundingCode = lines.slice(start, end).join('\n');
        }

        // Find similar patterns
        const similar = await semanticCodeSearch.search(
          error.message,
          projectPath,
          3
        );
        context.similarPatterns = similar.map(result => ({
          file: result.snippet.file,
          code: result.snippet.code.substring(0, 200),
        }));
      } catch {
        // File not found or error reading
      }
    }

    return context;
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(error: ValidationError, context: CodeContext): string {
    const explanations: Record<string, string> = {
      'no-mock-data': 'This code uses mock data or fake endpoints. Real applications should use registered API endpoints.',
      'no-hardcoded-secrets': 'Hardcoded secrets are a security risk. Use environment variables or a secrets manager.',
      'no-console-log': 'Console.log statements should be replaced with proper logging for production code.',
      'no-any-type': 'Using "any" type defeats TypeScript\'s type safety. Use specific types or "unknown" for better safety.',
      'no-relative-imports-deep': 'Deep relative imports (../../../) make code harder to maintain. Use path aliases (@/) instead.',
      'api-endpoint-validation': 'This API endpoint is not registered. Register it first using apiValidator.registerEndpoint().',
      'no-root-files': 'Files should not be created in the root directory. Use proper feature-based organization.',
      'feature-based-organization': 'This file is not in the correct location. Follow the project\'s feature-based structure.',
    };

    return explanations[error.rule] || error.message;
  }

  /**
   * Generate suggested fixes
   */
  private async generateFixes(
    error: ValidationError,
    context: CodeContext,
    projectPath: string
  ): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    switch (error.rule) {
      case 'no-mock-data':
        fixes.push({
          description: 'Replace mock endpoint with registered API endpoint',
          codeExample: `// Instead of:
fetch('https://jsonplaceholder.typicode.com/users')

// Use:
import { validatedFetch } from '@/lib/api-validator';
await validatedFetch('/api/users', { method: 'GET' });`,
          priority: 'high',
        });
        fixes.push({
          description: 'Register the endpoint first if it doesn\'t exist',
          codeExample: `import { apiValidator } from '@/lib/api-validator';

apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
  description: 'Get all users',
});`,
          priority: 'high',
        });
        break;

      case 'no-hardcoded-secrets':
        fixes.push({
          description: 'Move secret to environment variable',
          codeExample: `// Instead of:
const apiKey = process.env.OPENAI_API_KEY || 'missing-api-key';

// Use:
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY not set');`,
          priority: 'high',
        });
        break;

      case 'no-console-log':
        fixes.push({
          description: 'Replace console.log with logger',
          codeExample: `// Instead of:
console.log('User logged in');

// Use:
import { logger } from '@/lib/logger';
logger.info('User logged in');`,
          priority: 'medium',
        });
        break;

      case 'no-any-type':
        fixes.push({
          description: 'Replace "any" with specific type or "unknown"',
          codeExample: `// Instead of:
  function process(data: Record<string, unknown>) { }

// Use:
function process(data: unknown) {
  if (typeof data === 'string') {
    // Type narrowing
  }
}`,
          priority: 'medium',
        });
        break;

      case 'no-relative-imports-deep':
        fixes.push({
          description: 'Replace deep relative import with path alias',
          codeExample: `// Instead of:
import { utils } from '../../../lib/utils';

// Use:
import { utils } from '@/lib/utils';`,
          priority: 'medium',
        });
        if (error.file) {
          fixes.push({
            description: 'Update tsconfig.json paths if needed',
            file: 'tsconfig.json',
            priority: 'low',
          });
        }
        break;

      case 'api-endpoint-validation':
        fixes.push({
          description: 'Register the endpoint in src/config/api-endpoints.ts',
          file: 'src/config/api-endpoints.ts',
          priority: 'high',
        });
        break;

      case 'no-root-files':
        fixes.push({
          description: 'Move file to appropriate feature directory',
          codeExample: `// Move to:
src/features/[feature-name]/components/YourComponent.tsx
// or
src/components/YourComponent.tsx`,
          priority: 'high',
        });
        break;
    }

    // Add context-specific fixes
    if (context.similarPatterns && context.similarPatterns.length > 0) {
      fixes.push({
        description: `Follow pattern from ${context.similarPatterns[0].file}`,
        codeExample: context.similarPatterns[0].code,
        priority: 'low',
      });
    }

    return fixes;
  }

  /**
   * Track error patterns for learning
   */
  private trackErrorPattern(error: ValidationError): void {
    const key = `${error.rule}:${error.file || 'unknown'}`;
    this.errorPatterns.set(key, (this.errorPatterns.get(key) || 0) + 1);
  }

  /**
   * Check if this is a common mistake
   */
  private isCommonMistake(error: ValidationError): boolean {
    const key = `${error.rule}:${error.file || 'unknown'}`;
    const count = this.errorPatterns.get(key) || 0;
    return count > 3; // Appeared more than 3 times
  }

  /**
   * Get related documentation links
   */
  private getRelatedDocs(error: ValidationError): string[] {
    const docs: Record<string, string[]> = {
      'no-mock-data': [
        'AI-AGENT-GUARDRAILS-KIT.md#api-validation',
        '04-API-ARCHITECTURE-TEMPLATE.md',
      ],
      'no-hardcoded-secrets': [
        '08-ENVIRONMENT-CONFIG-TEMPLATE.md',
      ],
      'no-console-log': [
        'INFRASTRUCTURE-ESSENTIALS.md#observability',
      ],
      'no-any-type': [
        '05-AI-AGENT-FILE-RULES.md#typescript-standards',
      ],
      'no-relative-imports-deep': [
        '05-AI-AGENT-FILE-RULES.md#import-patterns',
      ],
    };

    return docs[error.rule] || [];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): Map<string, number> {
    return new Map(this.errorPatterns);
  }
}

import * as fs from 'fs';
import * as path from 'path';

export const errorEnhancer = new ErrorEnhancer();

