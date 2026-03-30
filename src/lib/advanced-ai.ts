/**
 * Advanced AI Capabilities
 * 
 * Enhanced AI features for better understanding and suggestions.
 * Provides intelligent code analysis, suggestions, and project insights.
 * 
 * @module advanced-ai
 * @example
 * ```typescript
 * const advancedAI = new AdvancedAI();
 * const suggestions = await advancedAI.generateSuggestions(
 *   code,
 *   { file: 'src/app.ts', projectPath: './my-project' }
 * );
 * ```
 */

import type { CodeContext, ProjectMap } from './types/advanced-ai';

export interface CodeSuggestion {
  type: 'optimization' | 'bug-fix' | 'refactor' | 'pattern' | 'security';
  file: string;
  line: number;
  current: string;
  suggested: string;
  reason: string;
  confidence: number;
}

export interface ProjectInsight {
  category: 'architecture' | 'performance' | 'security' | 'maintainability';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  suggestions: string[];
}

class AdvancedAI {
  /**
   * Generate code suggestions
   * 
   * Analyzes code and provides intelligent suggestions for improvements,
   * optimizations, bug fixes, and security enhancements.
   * 
   * @param code - The code to analyze
   * @param context - Context information about the code (file path, project, etc.)
   * @returns Array of code suggestions
   * 
   * @example
   * ```typescript
   * const suggestions = await advancedAI.generateSuggestions(
   *   'function process(data) { return data.map(x => x.value); }',
   *   { file: 'src/utils.ts', projectPath: './my-project' }
   * );
   * 
   * suggestions.forEach(s => {
   *   console.log(`${s.type}: ${s.suggested}`);
   * });
   * ```
   */
  async generateSuggestions(code: string, context: CodeContext): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Detect common patterns that could be improved
    if (this.detectNestedCallbacks(code)) {
      suggestions.push({
        type: 'refactor',
        file: context.file || 'unknown',
        line: 0,
        current: 'Nested callbacks',
        suggested: 'Use async/await or Promises',
        reason: 'Nested callbacks reduce readability and maintainability',
        confidence: 0.9,
      });
    }

    if (this.detectMagicNumbers(code)) {
      suggestions.push({
        type: 'refactor',
        file: context.file || 'unknown',
        line: 0,
        current: 'Magic numbers',
        suggested: 'Extract to named constants',
        reason: 'Magic numbers make code harder to understand and maintain',
        confidence: 0.8,
      });
    }

    if (this.detectSecurityIssues(code)) {
      suggestions.push({
        type: 'security',
        file: context.file || 'unknown',
        line: 0,
        current: 'Potential security issue',
        suggested: 'Add input validation and sanitization',
        reason: 'Unvalidated input can lead to security vulnerabilities',
        confidence: 0.85,
      });
    }

    return suggestions;
  }

  /**
   * Generate project insights
   * 
   * Analyzes project structure and provides insights about architecture,
   * performance, security, and maintainability.
   * 
   * @param projectMap - Project structure and metadata
   * @returns Array of project insights
   * 
   * @example
   * ```typescript
   * const insights = await advancedAI.generateProjectInsights({
   *   architecture: { type: 'monolith' },
   *   metadata: { totalFiles: 150 },
   *   endpoints: [{ path: '/api/users', method: 'GET', auth: false }]
   * });
   * 
   * insights.forEach(insight => {
   *   console.log(`${insight.category}: ${insight.title}`);
   * });
   * ```
   */
  async generateProjectInsights(projectMap: ProjectMap): Promise<ProjectInsight[]> {
    const insights: ProjectInsight[] = [];

    // Architecture insights
    if (projectMap.architecture?.type === 'monolith' && projectMap.metadata?.totalFiles > 100) {
      insights.push({
        category: 'architecture',
        title: 'Consider Microservices',
        description: 'Large monolith detected - consider splitting into microservices',
        impact: 'medium',
        suggestions: [
          'Identify bounded contexts',
          'Extract services gradually',
          'Use API gateway pattern',
        ],
      });
    }

    // Performance insights
    if (projectMap.endpoints && projectMap.endpoints.length > 50) {
      insights.push({
        category: 'performance',
        title: 'API Endpoint Optimization',
        description: 'Many API endpoints detected - consider optimization',
        impact: 'medium',
        suggestions: [
          'Implement caching',
          'Add rate limiting',
          'Consider GraphQL for complex queries',
        ],
      });
    }

    // Security insights
    const hasAuth = projectMap.endpoints?.some((ep) => ep.auth);
    if (!hasAuth && projectMap.endpoints && projectMap.endpoints.length > 0) {
      insights.push({
        category: 'security',
        title: 'Missing Authentication',
        description: 'API endpoints detected without authentication',
        impact: 'high',
        suggestions: [
          'Add authentication middleware',
          'Implement JWT tokens',
          'Add role-based access control',
        ],
      });
    }

    return insights;
  }

  /**
   * Smart code completion suggestions
   * 
   * Provides intelligent code completion suggestions based on partial code
   * and project context.
   * 
   * @param partialCode - Partial code that needs completion
   * @param context - Context information about the code
   * @returns Array of completion suggestions
   */
  async suggestCompletion(partialCode: string, context: CodeContext): Promise<string[]> {
    const suggestions: string[] = [];

    // Pattern-based suggestions
    if (partialCode.includes('async function')) {
      suggestions.push('try {', 'const result = await', 'return result;', '} catch (error) {');
    }

    if (partialCode.includes('useState')) {
      suggestions.push('const [value, setValue] = useState', 'useEffect(() => {', '}, [dependencies]);');
    }

    if (partialCode.includes('router.')) {
      suggestions.push('router.get(', 'router.post(', 'router.use(', 'router.middleware(');
    }

    return suggestions;
  }

  // Helper methods
  private detectNestedCallbacks(code: string): boolean {
    // Simple detection - count nested callbacks
    const callbackPattern = /\.(then|catch|callback)\(/g;
    const matches = code.match(callbackPattern);
    return matches ? matches.length > 2 : false;
  }

  private detectMagicNumbers(code: string): boolean {
    // Detect standalone numbers (not in variable names or strings)
    const magicNumberPattern = /\b\d{2,}\b/g;
    return magicNumberPattern.test(code);
  }

  private detectSecurityIssues(code: string): boolean {
    // Detect common security issues
    const securityPatterns = [
      /eval\(/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /\.query\(/,
      /\.exec\(/,
    ];

    return securityPatterns.some(pattern => pattern.test(code));
  }
}

export const advancedAI = new AdvancedAI();

