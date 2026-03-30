/**
 * Project Health Scoring System
 * 
 * Analyzes project health and provides actionable insights
 * Premium feature for Professional and Enterprise tiers
 */

import { licenseManager } from './license-manager';

export interface HealthScore {
  overall: number; // 0-100
  categories: {
    codeQuality: number;
    typeSafety: number;
    apiHealth: number;
    structure: number;
    testCoverage: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface HealthIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file?: string;
  line?: number;
  fixable: boolean;
  estimatedFixTime?: string;
}

class ProjectHealthAnalyzer {
  /**
   * Analyze project health
   */
  async analyzeProject(projectId: string): Promise<HealthScore> {
    // Check if feature is available
    if (!licenseManager.hasFeature(projectId, 'project-health-scoring')) {
      throw new Error(
        'Project health scoring is a premium feature. Upgrade to Professional or Enterprise tier.'
      );
    }

    // Run all health checks
    const [codeQuality, typeSafety, apiHealth, structure, testCoverage] =
      await Promise.all([
        this.checkCodeQuality(projectId),
        this.checkTypeSafety(projectId),
        this.checkApiHealth(projectId),
        this.checkStructure(projectId),
        this.checkTestCoverage(projectId),
      ]);

    const categories = {
      codeQuality,
      typeSafety,
      apiHealth,
      structure,
      testCoverage,
    };

    const overall = this.calculateOverallScore(categories);
    const issues = await this.collectIssues(projectId, categories);
    const recommendations = this.generateRecommendations(issues, categories);
    const trend = await this.analyzeTrend(projectId, overall);

    return {
      overall,
      categories,
      issues,
      recommendations,
      trend,
    };
  }

  /**
   * Check code quality
   */
  private async checkCodeQuality(projectId: string): Promise<number> {
    // Analyze ESLint errors, code complexity, etc.
    // This would integrate with actual linting results
    return 85; // Placeholder
  }

  /**
   * Check type safety
   */
  private async checkTypeSafety(projectId: string): Promise<number> {
    // Analyze TypeScript errors, any types usage, etc.
    return 90; // Placeholder
  }

  /**
   * Check API health
   */
  private async checkApiHealth(projectId: string): Promise<number> {
    // Check registered endpoints, mock data usage, etc.
    return 75; // Placeholder
  }

  /**
   * Check project structure
   */
  private async checkStructure(projectId: string): Promise<number> {
    // Check file organization, architecture compliance
    return 80; // Placeholder
  }

  /**
   * Check test coverage
   */
  private async checkTestCoverage(projectId: string): Promise<number> {
    // Analyze test coverage if available
    return 60; // Placeholder
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(categories: HealthScore['categories']): number {
    const weights = {
      codeQuality: 0.25,
      typeSafety: 0.25,
      apiHealth: 0.20,
      structure: 0.15,
      testCoverage: 0.15,
    };

    return Math.round(
      categories.codeQuality * weights.codeQuality +
        categories.typeSafety * weights.typeSafety +
        categories.apiHealth * weights.apiHealth +
        categories.structure * weights.structure +
        categories.testCoverage * weights.testCoverage
    );
  }

  /**
   * Collect all issues
   */
  private async collectIssues(
    projectId: string,
    categories: HealthScore['categories']
  ): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = [];

    // Code quality issues
    if (categories.codeQuality < 70) {
      issues.push({
        severity: 'high',
        category: 'code-quality',
        message: 'Code quality score is below recommended threshold',
        fixable: true,
        estimatedFixTime: '2-4 hours',
      });
    }

    // Type safety issues
    if (categories.typeSafety < 80) {
      issues.push({
        severity: 'medium',
        category: 'type-safety',
        message: 'Type safety could be improved',
        fixable: true,
        estimatedFixTime: '1-2 hours',
      });
    }

    // API health issues
    if (categories.apiHealth < 70) {
      issues.push({
        severity: 'critical',
        category: 'api-health',
        message: 'API endpoints may have issues or mock data detected',
        fixable: true,
        estimatedFixTime: '3-5 hours',
      });
    }

    // Structure issues
    if (categories.structure < 75) {
      issues.push({
        severity: 'medium',
        category: 'structure',
        message: 'Project structure could be improved',
        fixable: true,
        estimatedFixTime: '1-3 hours',
      });
    }

    // Test coverage issues
    if (categories.testCoverage < 60) {
      issues.push({
        severity: 'low',
        category: 'test-coverage',
        message: 'Test coverage is below recommended 60%',
        fixable: true,
        estimatedFixTime: '4-8 hours',
      });
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    issues: HealthIssue[],
    categories: HealthScore['categories']
  ): string[] {
    const recommendations: string[] = [];

    if (issues.length === 0) {
      recommendations.push('✅ Project health is excellent! Keep up the good work.');
      return recommendations;
    }

    // Prioritize by severity
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const highIssues = issues.filter((i) => i.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push(
        `🚨 Address ${criticalIssues.length} critical issue(s) first`
      );
    }

    if (highIssues.length > 0) {
      recommendations.push(
        `⚠️ Fix ${highIssues.length} high-priority issue(s)`
      );
    }

    if (categories.codeQuality < 70) {
      recommendations.push('Run `npm run lint:fix` to auto-fix code quality issues');
    }

    if (categories.typeSafety < 80) {
      recommendations.push('Review TypeScript errors with `npm run type-check`');
    }

    if (categories.apiHealth < 70) {
      recommendations.push('Register all API endpoints and remove mock data');
    }

    return recommendations;
  }

  /**
   * Analyze trend
   */
  private async analyzeTrend(
    projectId: string,
    currentScore: number
  ): Promise<'improving' | 'stable' | 'declining'> {
    // In production, this would compare with historical data
    // For now, return stable
    return 'stable';
  }

  /**
   * Get health report
   */
  async getHealthReport(projectId: string): Promise<string> {
    const health = await this.analyzeProject(projectId);

    let report = `# Project Health Report\n\n`;
    report += `**Overall Score: ${health.overall}/100**\n\n`;
    report += `## Category Scores\n\n`;
    report += `- Code Quality: ${health.categories.codeQuality}/100\n`;
    report += `- Type Safety: ${health.categories.typeSafety}/100\n`;
    report += `- API Health: ${health.categories.apiHealth}/100\n`;
    report += `- Structure: ${health.categories.structure}/100\n`;
    report += `- Test Coverage: ${health.categories.testCoverage}/100\n\n`;

    if (health.issues.length > 0) {
      report += `## Issues Found (${health.issues.length})\n\n`;
      health.issues.forEach((issue, index) => {
        report += `${index + 1}. **[${issue.severity.toUpperCase()}]** ${issue.message}\n`;
        if (issue.estimatedFixTime) {
          report += `   Estimated fix time: ${issue.estimatedFixTime}\n`;
        }
      });
      report += `\n`;
    }

    if (health.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      health.recommendations.forEach((rec) => {
        report += `- ${rec}\n`;
      });
    }

    return report;
  }
}

export const projectHealthAnalyzer = new ProjectHealthAnalyzer();

