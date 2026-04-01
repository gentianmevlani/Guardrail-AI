/**
 * Polish Service
 * 
 * Orchestrates all polish checkers and generates comprehensive reports.
 * Analyzes projects for missing polish, infrastructure essentials, and production readiness.
 * 
 * @module polish-service
 * @example
 * ```typescript
 * const report = await polishService.analyzeProject('./my-project');
 * console.log(`Polish Score: ${report.score}/100`);
 * console.log(`Found ${report.totalIssues} issues`);
 * ```
 */

import type { PolishChecker, PolishIssue, PolishReport } from './types';
import { FrontendPolishChecker } from './checkers/frontend-checker';
import { BackendPolishChecker } from './checkers/backend-checker';
import { SecurityPolishChecker } from './checkers/security-checker';
import { PerformancePolishChecker } from './checkers/performance-checker';
import { AccessibilityPolishChecker } from './checkers/accessibility-checker';
import { SEOPolishChecker } from './checkers/seo-checker';
import { ConfigurationPolishChecker } from './checkers/configuration-checker';
import { DocumentationPolishChecker } from './checkers/documentation-checker';
import { InfrastructurePolishChecker } from './checkers/infrastructure-checker';

class PolishService {
  private checkers: PolishChecker[] = [];

  constructor() {
    // Register all checkers
    this.checkers = [
      new FrontendPolishChecker(),
      new BackendPolishChecker(),
      new SecurityPolishChecker(),
      new PerformancePolishChecker(),
      new AccessibilityPolishChecker(),
      new SEOPolishChecker(),
      new ConfigurationPolishChecker(),
      new DocumentationPolishChecker(),
      new InfrastructurePolishChecker(),
    ];
  }

  /**
   * Analyze project for polish issues
   * 
   * Runs all registered polish checkers and generates a comprehensive report
   * with issues, scores, and recommendations.
   * 
   * @param projectPath - Path to the project root directory
   * @returns Polish report with issues, scores, and recommendations
   * 
   * @example
   * ```typescript
   * const report = await polishService.analyzeProject('./my-project');
   * 
   * if (report.score < 80) {
   *   console.warn('Project needs polish!');
   *   report.issues.forEach(issue => {
   *     console.log(`${issue.severity}: ${issue.title}`);
   *   });
   * }
   * ```
   */
  async analyzeProject(projectPath: string): Promise<PolishReport> {
    const allIssues: PolishIssue[] = [];

    // Run all checkers
    for (const checker of this.checkers) {
      try {
        const issues = await checker.check(projectPath);
        allIssues.push(...issues);
      } catch (error) {
        // Log error but continue with other checkers
        console.error(`Error in ${checker.getCategory()} checker:`, error);
      }
    }

    // Calculate score
    const score = this.calculateScore(allIssues);
    const recommendations = this.generateRecommendations(allIssues);

    return {
      projectPath,
      totalIssues: allIssues.length,
      critical: allIssues.filter(i => i.severity === 'critical').length,
      high: allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low: allIssues.filter(i => i.severity === 'low').length,
      issues: allIssues,
      score,
      recommendations,
    };
  }

  /**
   * Calculate polish score (0-100)
   */
  private calculateScore(issues: PolishIssue[]): number {
    if (issues.length === 0) return 100;

    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 10;
          break;
        case 'high':
          score -= 5;
          break;
        case 'medium':
          score -= 2;
          break;
        case 'low':
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: PolishIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(
        `Fix ${criticalIssues.length} critical issue(s) immediately - these affect security or functionality.`
      );
    }

    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length > 0) {
      recommendations.push(
        `Address ${highIssues.length} high-priority issue(s) - these impact user experience or production readiness.`
      );
    }

    const autoFixable = issues.filter(i => i.autoFixable);
    if (autoFixable.length > 0) {
      recommendations.push(
        `${autoFixable.length} issue(s) can be auto-fixed. Run 'guardrail polish --fix' to apply fixes.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Your project looks polished! Great job! 🎉');
    }

    return recommendations;
  }

  /**
   * Register a custom polish checker
   * 
   * Allows extending the polish service with custom checkers.
   * 
   * @param checker - The polish checker to register
   * 
   * @example
   * ```typescript
   * class CustomChecker implements PolishChecker {
   *   getCategory() { return 'Custom'; }
   *   async check(projectPath) { return []; }
   * }
   * 
   * polishService.registerChecker(new CustomChecker());
   * ```
   */
  registerChecker(checker: PolishChecker): void {
    this.checkers.push(checker);
  }
}

export const polishService = new PolishService();
export type { PolishIssue, PolishReport, PolishChecker };

