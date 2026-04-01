/**
 * Code Quality Analyzer
 * 
 * Analyzes code quality metrics like complexity, maintainability,
 * technical debt, saving hours of manual code review.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { ComponentSpec } from './mdc-generator';

export interface CodeQualityMetrics {
  component: string;
  complexity: {
    cyclomatic: number;
    cognitive: number;
    halstead: {
      vocabulary: number;
      length: number;
      volume: number;
      difficulty: number;
      effort: number;
    };
  };
  maintainability: {
    index: number; // 0-100
    technicalDebt: number; // hours
    debtRatio: number; // percentage
  };
  metrics: {
    linesOfCode: number;
    linesOfComment: number;
    commentRatio: number;
    methodCount: number;
    averageMethodLength: number;
    maxNestingDepth: number;
  };
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  issues: QualityIssue[];
  suggestions: string[];
}

export interface QualityIssue {
  type: 'complexity' | 'maintainability' | 'debt' | 'naming' | 'structure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location: string;
  line?: number;
  suggestion: string;
}

export interface QualityReport {
  components: Map<string, CodeQualityMetrics>;
  summary: {
    totalComponents: number;
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
    averageMaintainability: number;
    totalTechnicalDebt: number;
  };
  topIssues: QualityIssue[];
  recommendations: string[];
}

export class CodeQualityAnalyzer {
  private projectPath: string;
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;

  constructor(projectPath: string, program?: ts.Program, checker?: ts.TypeChecker) {
    this.projectPath = projectPath;
    this.program = program || null;
    this.checker = checker || null;
  }

  /**
   * Analyze code quality for all components
   */
  async analyzeQuality(components: ComponentSpec[]): Promise<QualityReport> {
    const metricsMap = new Map<string, CodeQualityMetrics>();

    console.log('📊 Analyzing code quality...\n');

    for (const component of components) {
      if (component.type === 'class' || component.type === 'function') {
        const metrics = await this.analyzeComponentQuality(component);
        metricsMap.set(component.name, metrics);

        const emoji = this.getQualityEmoji(metrics.quality);
        console.log(`   ${emoji} ${component.name}: ${metrics.quality} (Maintainability: ${metrics.maintainability.index}/100)`);
      }
    }

    console.log('');

    // Generate summary
    const summary = this.generateSummary(metricsMap);
    
    // Collect top issues
    const topIssues: QualityIssue[] = [];
    for (const metrics of metricsMap.values()) {
      topIssues.push(...metrics.issues.filter(i => i.severity === 'critical' || i.severity === 'high'));
    }
    topIssues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(metricsMap, summary);

    return {
      components: metricsMap,
      summary,
      topIssues: topIssues.slice(0, 20),
      recommendations,
    };
  }

  /**
   * Analyze quality for a single component
   */
  private async analyzeComponentQuality(component: ComponentSpec): Promise<CodeQualityMetrics> {
    const filePath = path.join(this.projectPath, component.path);
    const sourceCode = await this.readFileIfExists(filePath);

    if (!sourceCode) {
      return this.createDefaultMetrics(component);
    }

    // Calculate complexity metrics
    const complexity = this.calculateComplexity(sourceCode, component);

    // Calculate maintainability
    const maintainability = this.calculateMaintainability(sourceCode, complexity);

    // Calculate basic metrics
    const metrics = this.calculateBasicMetrics(sourceCode, component);

    // Detect issues
    const issues = this.detectQualityIssues(sourceCode, component, complexity, maintainability);

    // Generate suggestions
    const suggestions = this.generateSuggestions(complexity, maintainability, issues);

    // Determine overall quality
    const quality = this.determineQuality(maintainability, complexity, issues);

    return {
      component: component.name,
      complexity,
      maintainability,
      metrics,
      quality,
      issues,
      suggestions,
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(sourceCode: string, component: ComponentSpec): CodeQualityMetrics['complexity'] {
    const lines = sourceCode.split('\n');
    let cyclomatic = 1; // Base complexity
    let cognitive = 1;
    
    // Count decision points
    for (const line of lines) {
      // if, else if, for, while, switch, catch, &&
      if (/\bif\s*\(/.test(line) || /\belse\s+if/.test(line)) cyclomatic++;
      if (/\bfor\s*\(/.test(line) || /\bwhile\s*\(/.test(line)) cyclomatic++;
      if (/\bswitch\s*\(/.test(line)) cyclomatic++;
      if (/\bcatch\s*\(/.test(line)) cyclomatic++;
      if (/&&/.test(line) || /\|\|/.test(line)) cyclomatic++;

      // Cognitive complexity (nested structures)
      const indentLevel = (line.match(/^\s*/)?.[0] || '').length / 2;
      cognitive += Math.max(0, indentLevel - 2); // Penalize deep nesting
    }

    // Simple Halstead metrics (approximation)
    const tokens = sourceCode.match(/\b\w+\b/g) || [];
    const uniqueTokens = new Set(tokens).size;
    const halstead = {
      vocabulary: uniqueTokens,
      length: tokens.length,
      volume: tokens.length * Math.log2(uniqueTokens || 1),
      difficulty: uniqueTokens / 2,
      effort: tokens.length * uniqueTokens * Math.log2(uniqueTokens || 1) / 2,
    };

    return {
      cyclomatic,
      cognitive,
      halstead,
    };
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainability(
    sourceCode: string,
    complexity: CodeQualityMetrics['complexity']
  ): CodeQualityMetrics['maintainability'] {
    const lines = sourceCode.split('\n');
    const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const linesOfComment = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*')).length;
    
    // Simplified maintainability index calculation
    const commentRatio = linesOfCode > 0 ? linesOfComment / linesOfCode : 0;
    const complexityFactor = complexity.cyclomatic;
    
    // Maintainability Index (simplified): 171 - 5.2 * ln(complexity) - 0.23 * ln(lines) + 50 * sin(sqrt(2.4 * comment_ratio))
    let maintainability = 171;
    maintainability -= 5.2 * Math.log(complexityFactor || 1);
    maintainability -= 0.23 * Math.log(linesOfCode || 1);
    maintainability += 50 * Math.sin(Math.sqrt(2.4 * commentRatio));

    // Normalize to 0-100
    maintainability = Math.max(0, Math.min(100, maintainability));

    // Estimate technical debt (hours)
    const technicalDebt = this.estimateTechnicalDebt(complexity, maintainability, linesOfCode);

    // Debt ratio
    const debtRatio = maintainability < 60 ? (100 - maintainability) / 100 : 0;

    return {
      index: Math.round(maintainability),
      technicalDebt,
      debtRatio: Math.round(debtRatio * 100),
    };
  }

  /**
   * Estimate technical debt in hours
   */
  private estimateTechnicalDebt(
    complexity: CodeQualityMetrics['complexity'],
    maintainability: number,
    linesOfCode: number
  ): number {
    let debt = 0;

    // High complexity = debt
    if (complexity.cyclomatic > 10) {
      debt += (complexity.cyclomatic - 10) * 2; // 2 hours per extra complexity point
    }

    // Low maintainability = debt
    if (maintainability < 70) {
      debt += (70 - maintainability) * 0.5; // 0.5 hours per maintainability point below 70
    }

    // Large files = debt
    if (linesOfCode > 500) {
      debt += (linesOfCode - 500) / 100; // 0.01 hours per line over 500
    }

    return Math.round(debt * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate basic metrics
   */
  private calculateBasicMetrics(sourceCode: string, component: ComponentSpec): CodeQualityMetrics['metrics'] {
    const lines = sourceCode.split('\n');
    const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).length;
    const linesOfComment = lines.filter(l => 
      l.trim().startsWith('//') || 
      l.trim().startsWith('/*') || 
      l.trim().includes('/**')
    ).length;

    // Count methods
    const methodMatches = sourceCode.match(/\b\w+\s*\(/g) || [];
    const methodCount = methodMatches.length;

    // Average method length (approximation)
    const averageMethodLength = methodCount > 0 ? linesOfCode / methodCount : 0;

    // Max nesting depth
    let maxNestingDepth = 0;
    let currentDepth = 0;
    for (const line of lines) {
      const indentLevel = (line.match(/^\s*/)?.[0] || '').length / 2;
      currentDepth = Math.max(currentDepth, indentLevel);
      maxNestingDepth = Math.max(maxNestingDepth, currentDepth);
    }

    const commentRatio = linesOfCode > 0 ? linesOfComment / linesOfCode : 0;

    return {
      linesOfCode,
      linesOfComment,
      commentRatio: Math.round(commentRatio * 100) / 100,
      methodCount,
      averageMethodLength: Math.round(averageMethodLength * 10) / 10,
      maxNestingDepth,
    };
  }

  /**
   * Detect quality issues
   */
  private detectQualityIssues(
    sourceCode: string,
    component: ComponentSpec,
    complexity: CodeQualityMetrics['complexity'],
    maintainability: CodeQualityMetrics['maintainability']
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Complexity issues
    if (complexity.cyclomatic > 10) {
      issues.push({
        type: 'complexity',
        severity: complexity.cyclomatic > 20 ? 'critical' : 'high',
        message: `High cyclomatic complexity (${complexity.cyclomatic})`,
        location: component.path,
        suggestion: 'Consider breaking down into smaller functions or using design patterns',
      });
    }

    if (complexity.cognitive > 15) {
      issues.push({
        type: 'complexity',
        severity: 'high',
        message: `High cognitive complexity (${complexity.cognitive}) due to deep nesting`,
        location: component.path,
        suggestion: 'Reduce nesting depth by extracting functions or using early returns',
      });
    }

    // Maintainability issues
    if (maintainability.index < 60) {
      issues.push({
        type: 'maintainability',
        severity: maintainability.index < 40 ? 'critical' : 'high',
        message: `Low maintainability index (${maintainability.index}/100)`,
        location: component.path,
        suggestion: `Add comments, reduce complexity, and improve structure. Estimated ${maintainability.technicalDebt}h of technical debt.`,
      });
    }

    // Structure issues
    const metrics = this.calculateBasicMetrics(sourceCode, component);
    if (metrics.linesOfCode > 500) {
      issues.push({
        type: 'structure',
        severity: metrics.linesOfCode > 1000 ? 'high' : 'medium',
        message: `Large file size (${metrics.linesOfCode} lines)`,
        location: component.path,
        suggestion: 'Consider splitting into multiple files or modules',
      });
    }

    if (metrics.maxNestingDepth > 5) {
      issues.push({
        type: 'structure',
        severity: 'medium',
        message: `Deep nesting (${metrics.maxNestingDepth} levels)`,
        location: component.path,
        suggestion: 'Extract nested logic into separate functions or use early returns',
      });
    }

    if (metrics.averageMethodLength > 50) {
      issues.push({
        type: 'structure',
        severity: 'medium',
        message: `Long average method length (${Math.round(metrics.averageMethodLength)} lines)`,
        location: component.path,
        suggestion: 'Extract logic into smaller, focused methods',
      });
    }

    return issues;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    complexity: CodeQualityMetrics['complexity'],
    maintainability: CodeQualityMetrics['maintainability'],
    issues: QualityIssue[]
  ): string[] {
    const suggestions: string[] = [];

    if (complexity.cyclomatic > 10) {
      suggestions.push('Refactor into smaller functions using single responsibility principle');
      suggestions.push('Use design patterns like Strategy or Command to reduce complexity');
    }

    if (maintainability.index < 70) {
      suggestions.push('Add JSDoc comments to improve documentation');
      suggestions.push('Improve naming to make code self-documenting');
    }

    if (issues.filter(i => i.type === 'structure').length > 0) {
      suggestions.push('Consider splitting large files into focused modules');
      suggestions.push('Extract common logic into reusable utilities');
    }

    return suggestions;
  }

  /**
   * Determine overall quality
   */
  private determineQuality(
    maintainability: CodeQualityMetrics['maintainability'],
    complexity: CodeQualityMetrics['complexity'],
    issues: QualityIssue[]
  ): CodeQualityMetrics['quality'] {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0 || maintainability.index < 40) {
      return 'critical';
    }

    if (highIssues > 2 || maintainability.index < 60 || complexity.cyclomatic > 20) {
      return 'poor';
    }

    if (maintainability.index < 70 || complexity.cyclomatic > 10) {
      return 'fair';
    }

    if (maintainability.index < 85) {
      return 'good';
    }

    return 'excellent';
  }

  /**
   * Generate summary
   */
  private generateSummary(metricsMap: Map<string, CodeQualityMetrics>): QualityReport['summary'] {
    const components = Array.from(metricsMap.values());
    const totalComponents = components.length;

    const excellent = components.filter(c => c.quality === 'excellent').length;
    const good = components.filter(c => c.quality === 'good').length;
    const fair = components.filter(c => c.quality === 'fair').length;
    const poor = components.filter(c => c.quality === 'poor').length;
    const critical = components.filter(c => c.quality === 'critical').length;

    const averageMaintainability = totalComponents > 0
      ? components.reduce((sum, c) => sum + c.maintainability.index, 0) / totalComponents
      : 0;

    const totalTechnicalDebt = components.reduce((sum, c) => sum + c.maintainability.technicalDebt, 0);

    return {
      totalComponents,
      excellent,
      good,
      fair,
      poor,
      critical,
      averageMaintainability: Math.round(averageMaintainability),
      totalTechnicalDebt: Math.round(totalTechnicalDebt * 10) / 10,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    metricsMap: Map<string, CodeQualityMetrics>,
    summary: QualityReport['summary']
  ): string[] {
    const recommendations: string[] = [];

    if (summary.critical > 0) {
      recommendations.push(`🚨 Urgent: Fix ${summary.critical} critical quality issues immediately`);
    }

    if (summary.totalTechnicalDebt > 100) {
      recommendations.push(`⚠️ High technical debt: ${summary.totalTechnicalDebt} hours estimated. Prioritize refactoring.`);
    }

    if (summary.averageMaintainability < 70) {
      recommendations.push(`📊 Low average maintainability (${summary.averageMaintainability}/100). Improve code structure and documentation.`);
    }

    if (summary.poor + summary.critical > summary.totalComponents * 0.3) {
      recommendations.push(`🔧 ${Math.round(((summary.poor + summary.critical) / summary.totalComponents) * 100)}% of components need attention. Consider code review cycle.`);
    }

    return recommendations;
  }

  /**
   * Get quality emoji
   */
  private getQualityEmoji(quality: CodeQualityMetrics['quality']): string {
    const emojis = {
      excellent: '✅',
      good: '👍',
      fair: '⚠️',
      poor: '🔴',
      critical: '🚨',
    };
    return emojis[quality];
  }

  /**
   * Create default metrics
   */
  private createDefaultMetrics(component: ComponentSpec): CodeQualityMetrics {
    return {
      component: component.name,
      complexity: {
        cyclomatic: 0,
        cognitive: 0,
        halstead: { vocabulary: 0, length: 0, volume: 0, difficulty: 0, effort: 0 },
      },
      maintainability: { index: 0, technicalDebt: 0, debtRatio: 100 },
      metrics: { linesOfCode: 0, linesOfComment: 0, commentRatio: 0, methodCount: 0, averageMethodLength: 0, maxNestingDepth: 0 },
      quality: 'critical',
      issues: [{ type: 'maintainability', severity: 'critical', message: 'Source file not found', location: component.path, suggestion: 'Verify file exists' }],
      suggestions: [],
    };
  }

  /**
   * Read file if exists
   */
  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }
}

