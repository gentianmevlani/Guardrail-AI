/**
 * AI-Powered Rule Suggester
 * 
 * Suggests new guardrail rules based on common mistakes
 */

import { GuardrailRule } from './universal-guardrails';
import { errorEnhancer } from './error-enhancer';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface RuleSuggestion {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  pattern?: string;
  rationale: string;
  confidence: number; // 0-1
  examples: Array<{
    bad: string;
    good: string;
  }>;
}

class RuleSuggester {
  /**
   * Analyze codebase and suggest new rules
   */
  async suggestRules(projectPath: string): Promise<RuleSuggestion[]> {
    const suggestions: RuleSuggestion[] = [];

    // Get error statistics
    const errorStats = errorEnhancer.getErrorStatistics();

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);

    // Analyze common patterns
    const commonMistakes = this.analyzeCommonMistakes(errorStats, knowledge);

    // Generate suggestions
    for (const mistake of commonMistakes) {
      const suggestion = this.generateRuleSuggestion(mistake);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Analyze common mistakes from error statistics
   */
  private analyzeCommonMistakes(
    errorStats: Map<string, number>,
    knowledge: KnowledgeBase
  ): Array<{
    pattern: string;
    frequency: number;
    context: string;
  }> {
    const mistakes: Array<{
      pattern: string;
      frequency: number;
      context: string;
    }> = [];

    // Find frequently occurring errors
    for (const [key, count] of errorStats.entries()) {
      if (count > 5) {
        const [rule, file] = key.split(':');
        mistakes.push({
          pattern: rule,
          frequency: count,
          context: file || 'unknown',
        });
      }
    }

    return mistakes;
  }

  /**
   * Generate rule suggestion from mistake pattern
   */
  private generateRuleSuggestion(mistake: {
    pattern: string;
    frequency: number;
    context: string;
  }): RuleSuggestion | null {
    // Rule templates based on common patterns
    const ruleTemplates: Record<string, Partial<RuleSuggestion>> = {
      'no-mock-data': {
        name: 'No Mock Data',
        description: 'Prevent using mock data or fake endpoints',
        severity: 'error',
        pattern: '(jsonplaceholder|reqres\\.in|mockapi)',
        rationale: 'Mock data should not be used in production code',
        confidence: 0.9,
        examples: [
          {
            bad: "fetch('https://jsonplaceholder.typicode.com/users')",
            good: "fetch('/api/users')",
          },
        ],
      },
      'no-console-log': {
        name: 'No Console.log',
        description: 'Prevent console.log statements in production',
        severity: 'warning',
        pattern: 'console\\.(log|debug)',
        rationale: 'Console.log should be replaced with proper logging',
        confidence: 0.8,
        examples: [
          {
            bad: "console.log('User logged in')",
            good: "logger.info('User logged in')",
          },
        ],
      },
    };

    const template = ruleTemplates[mistake.pattern];
    if (!template) {
      return null;
    }

    return {
      id: `suggested-${mistake.pattern}-${Date.now()}`,
      name: template.name || mistake.pattern,
      description: template.description || `Rule for ${mistake.pattern}`,
      severity: template.severity || 'warning',
      pattern: template.pattern,
      rationale: template.rationale || `This pattern appears ${mistake.frequency} times`,
      confidence: template.confidence || 0.5,
      examples: template.examples || [],
    };
  }

  /**
   * Convert suggestion to guardrail rule
   */
  suggestionToRule(suggestion: RuleSuggestion): GuardrailRule {
    return {
      id: suggestion.id,
      name: suggestion.name,
      description: suggestion.description,
      severity: suggestion.severity,
      pattern: suggestion.pattern ? new RegExp(suggestion.pattern, 'i') : undefined,
      platforms: ['all'],
      check: async (filePath: string, content: string) => {
        if (suggestion.pattern) {
          const regex = new RegExp(suggestion.pattern, 'i');
          return !regex.test(content);
        }
        return true;
      },
    };
  }
}

export const ruleSuggester = new RuleSuggester();

