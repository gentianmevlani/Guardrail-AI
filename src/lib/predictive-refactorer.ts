/**
 * Predictive Refactoring
 * 
 * Suggests refactoring before code becomes problematic
 * Unique: Proactive refactoring suggestions based on predictions
 */

import { codeSmellPredictor } from './code-smell-predictor';
import { predictiveQuality } from './predictive-quality';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import * as fs from 'fs';
import * as path from 'path';

export interface RefactoringSuggestion {
  id: string;
  type: 'extract' | 'simplify' | 'consolidate' | 'optimize' | 'modernize';
  priority: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  currentCode: string;
  suggestedCode: string;
  reason: string;
  predictedIssue: string;
  estimatedTime: number; // minutes
  confidence: number; // 0-1
  benefits: string[];
  risks: string[];
  beforeMetrics: {
    complexity: number;
    lines: number;
    maintainability: number;
  };
  afterMetrics: {
    complexity: number;
    lines: number;
    maintainability: number;
  };
}

export interface RefactoringPlan {
  suggestions: RefactoringSuggestion[];
  totalEstimatedTime: number;
  priorityOrder: string[];
  impact: {
    complexityReduction: number;
    maintainabilityImprovement: number;
    riskReduction: number;
  };
}

class PredictiveRefactorer {
  /**
   * Generate predictive refactoring suggestions
   */
  async suggestRefactorings(projectPath: string): Promise<RefactoringPlan> {
    const suggestions: RefactoringSuggestion[] = [];

    // Get predictions
    const qualityPredictions = await predictiveQuality.predict(projectPath);
    const smellReport = await codeSmellPredictor.predict(projectPath);

    // Convert predictions to refactoring suggestions
    for (const prediction of qualityPredictions.predictions) {
      if (prediction.type === 'maintainability' && prediction.severity === 'high') {
        const suggestion = await this.createRefactoringSuggestion(
          projectPath,
          prediction,
          'simplify'
        );
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Convert code smells to refactoring suggestions
    for (const smell of smellReport.smells) {
      if (smell.type === 'long-method' || smell.type === 'large-class') {
        const suggestion = await this.createRefactoringSuggestion(
          projectPath,
          smell,
          smell.type === 'long-method' ? 'extract' : 'consolidate'
        );
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Sort by priority
    suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Calculate impact
    const impact = this.calculateImpact(suggestions);

    return {
      suggestions,
      totalEstimatedTime: suggestions.reduce((sum, s) => sum + s.estimatedTime, 0),
      priorityOrder: suggestions.map(s => s.id),
      impact,
    };
  }

  /**
   * Create refactoring suggestion from prediction/smell
   */
  private async createRefactoringSuggestion(
    projectPath: string,
    issue: RefactoringSuggestion,
    type: RefactoringSuggestion['type']
  ): Promise<RefactoringSuggestion | null> {
    if (!issue.file) return null;

    const filePath = path.join(projectPath, issue.file);
    if (!await this.pathExists(filePath)) return null;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Get code around the issue
      const startLine = issue.line ? Math.max(0, issue.line - 10) : 0;
      const endLine = issue.line ? Math.min(lines.length, issue.line + 10) : lines.length;
      const currentCode = lines.slice(startLine, endLine).join('\n');

      // Generate suggested refactoring
      const suggestedCode = this.generateRefactoredCode(currentCode, type, issue);

      // Calculate metrics
      const beforeMetrics = this.calculateMetrics(currentCode);
      const afterMetrics = this.calculateMetrics(suggestedCode);

      return {
        id: `refactor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        priority: issue.severity === 'critical' ? 'critical' :
                 issue.severity === 'high' ? 'high' :
                 issue.severity === 'medium' ? 'medium' : 'low',
        file: issue.file,
        line: issue.line,
        currentCode,
        suggestedCode,
        reason: issue.description || issue.predictedIssue,
        predictedIssue: issue.predictedIssue || issue.description,
        estimatedTime: this.estimateTime(type, beforeMetrics, afterMetrics),
        confidence: issue.confidence || 0.7,
        benefits: this.getBenefits(type, beforeMetrics, afterMetrics),
        risks: this.getRisks(type),
        beforeMetrics,
        afterMetrics,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate refactored code
   */
  private generateRefactoredCode(
    code: string,
    type: RefactoringSuggestion['type'],
    issue: RefactoringSuggestion
  ): string {
    // Simplified refactoring generation
    switch (type) {
      case 'extract':
        // Extract method
        return `// Extracted function\nfunction extractedFunction() {\n  ${code.trim()}\n}\n\n// Usage\nextractedFunction();`;
      
      case 'simplify':
        // Simplify logic
        return code.replace(/\s+/g, ' ').trim();
      
      case 'consolidate':
        // Consolidate similar code
        return `// Consolidated code\n${code}`;
      
      case 'optimize':
        // Optimize performance
        return `// Optimized version\n${code}`;
      
      case 'modernize':
        // Modernize syntax
        return code.replace(/var\s+/g, 'const ').replace(/function\s+/g, 'const ');
      
      default:
        return code;
    }
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(code: string): RefactoringSuggestion['beforeMetrics'] {
    return {
      complexity: this.calculateComplexity(code),
      lines: code.split('\n').length,
      maintainability: this.calculateMaintainability(code),
    };
  }

  private calculateComplexity(code: string): number {
    // Simplified cyclomatic complexity
    const decisions = (code.match(/\b(if|else|for|while|switch|case|catch)\b/g) || []).length;
    return decisions + 1;
  }

  private calculateMaintainability(code: string): number {
    // Simplified maintainability score (0-100)
    const lines = code.split('\n').length;
    const complexity = this.calculateComplexity(code);
    const score = 100 - (lines * 0.5) - (complexity * 5);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate refactoring time
   */
  private estimateTime(
    type: RefactoringSuggestion['type'],
    before: RefactoringSuggestion['beforeMetrics'],
    after: RefactoringSuggestion['afterMetrics']
  ): number {
    const baseTime: Record<RefactoringSuggestion['type'], number> = {
      extract: 15,
      simplify: 10,
      consolidate: 20,
      optimize: 25,
      modernize: 5,
    };

    const complexityFactor = before.complexity / 10;
    return Math.round(baseTime[type] * (1 + complexityFactor));
  }

  /**
   * Get benefits of refactoring
   */
  private getBenefits(
    type: RefactoringSuggestion['type'],
    before: RefactoringSuggestion['beforeMetrics'],
    after: RefactoringSuggestion['afterMetrics']
  ): string[] {
    const benefits: string[] = [];

    if (after.complexity < before.complexity) {
      benefits.push(`Reduces complexity by ${before.complexity - after.complexity}`);
    }

    if (after.maintainability > before.maintainability) {
      benefits.push(`Improves maintainability by ${(after.maintainability - before.maintainability).toFixed(1)} points`);
    }

    switch (type) {
      case 'extract':
        benefits.push('Improves code reusability');
        benefits.push('Makes code easier to test');
        break;
      case 'simplify':
        benefits.push('Improves readability');
        benefits.push('Reduces cognitive load');
        break;
      case 'consolidate':
        benefits.push('Reduces duplication');
        benefits.push('Easier to maintain');
        break;
    }

    return benefits;
  }

  /**
   * Get risks of refactoring
   */
  private getRisks(type: RefactoringSuggestion['type']): string[] {
    const risks: string[] = ['Requires testing after refactoring'];

    switch (type) {
      case 'extract':
        risks.push('May break existing functionality');
        break;
      case 'consolidate':
        risks.push('May introduce subtle bugs');
        break;
      case 'optimize':
        risks.push('May reduce readability');
        break;
    }

    return risks;
  }

  /**
   * Calculate overall impact
   */
  private calculateImpact(suggestions: RefactoringSuggestion[]): RefactoringPlan['impact'] {
    let complexityReduction = 0;
    let maintainabilityImprovement = 0;
    let riskReduction = 0;

    for (const suggestion of suggestions) {
      complexityReduction += suggestion.beforeMetrics.complexity - suggestion.afterMetrics.complexity;
      maintainabilityImprovement += suggestion.afterMetrics.maintainability - suggestion.beforeMetrics.maintainability;
      if (suggestion.priority === 'critical' || suggestion.priority === 'high') {
        riskReduction += 10;
      }
    }

    return {
      complexityReduction,
      maintainabilityImprovement: maintainabilityImprovement / suggestions.length,
      riskReduction,
    };
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const predictiveRefactorer = new PredictiveRefactorer();

