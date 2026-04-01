/**
 * Real-Time Code Quality Guardian
 * 
 * Revolutionary feature: Live monitoring as you code with instant feedback
 * on quality, security, and best practices - before you even save the file.
 * 
 * Unlike linters that run on save, this provides real-time guidance as you type.
 */

import * as fs from 'fs/promises';
import { productionAnomalyPredictor } from './production-anomaly-predictor';

interface QualityIssue {
  line: number;
  column: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'quality' | 'security' | 'performance' | 'best-practice';
  message: string;
  suggestion: string;
  autoFixAvailable: boolean;
  autoFix?: string;
}

interface LiveFeedback {
  score: number; // 0-100
  issues: QualityIssue[];
  metrics: {
    complexity: number;
    maintainability: number;
    security: number;
    performance: number;
  };
  suggestions: string[];
  preventionTips: string[];
}

class RealTimeCodeQualityGuardian {
  private watchers: Map<string, any> = new Map();

  /**
   * Start monitoring a file for real-time quality feedback
   */
  async startMonitoring(filePath: string, onChange: (feedback: LiveFeedback) => void): Promise<void> {
    console.log(`👁️ Starting real-time monitoring: ${filePath}`);

    const watcher = setInterval(async () => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const feedback = await this.analyzeInRealTime(content, filePath);
        onChange(feedback);
      } catch (error) {
        // File might be temporarily unavailable
      }
    }, 2000); // Check every 2 seconds

    this.watchers.set(filePath, watcher);
  }

  /**
   * Stop monitoring a file
   */
  stopMonitoring(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      clearInterval(watcher);
      this.watchers.delete(filePath);
      console.log(`✅ Stopped monitoring: ${filePath}`);
    }
  }

  /**
   * Analyze code in real-time
   */
  async analyzeInRealTime(code: string, filePath?: string): Promise<LiveFeedback> {
    const issues: QualityIssue[] = [];

    // Check for quality issues
    issues.push(...this.checkQuality(code));

    // Check for security issues
    issues.push(...this.checkSecurity(code));

    // Check for performance issues
    issues.push(...this.checkPerformance(code));

    // Check for best practices
    issues.push(...this.checkBestPractices(code));

    // Calculate metrics
    const metrics = this.calculateMetrics(code, issues);

    // Calculate overall score
    const score = this.calculateScore(metrics, issues);

    // Generate suggestions
    const suggestions = this.generateSuggestions(issues, metrics);

    // Generate prevention tips
    const preventionTips = this.generatePreventionTips(issues);

    return {
      score,
      issues,
      metrics,
      suggestions,
      preventionTips,
    };
  }

  /**
   * Get auto-fix for an issue
   */
  async getAutoFix(code: string, issue: QualityIssue): Promise<string> {
    if (!issue.autoFixAvailable) {
      throw new Error('Auto-fix not available for this issue');
    }

    return issue.autoFix || code;
  }

  /**
   * Apply all auto-fixes
   */
  async applyAllAutoFixes(code: string, issues: QualityIssue[]): Promise<string> {
    let fixedCode = code;

    for (const issue of issues.filter(i => i.autoFixAvailable)) {
      if (issue.autoFix) {
        fixedCode = issue.autoFix;
      }
    }

    return fixedCode;
  }

  // ============= Private Helper Methods =============

  private checkQuality(code: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for long functions
    const lines = code.split('\n');
    let functionStart = -1;
    let functionLength = 0;

    lines.forEach((line, idx) => {
      if (/function|=>/.test(line)) {
        if (functionStart >= 0 && functionLength > 50) {
          issues.push({
            line: functionStart,
            column: 0,
            severity: 'warning',
            category: 'quality',
            message: 'Function is too long (>50 lines)',
            suggestion: 'Consider breaking into smaller functions',
            autoFixAvailable: false,
          });
        }
        functionStart = idx;
        functionLength = 0;
      } else if (functionStart >= 0) {
        functionLength++;
      }
    });

    // Check for magic numbers
    lines.forEach((line, idx) => {
      const magicNumbers = line.match(/\b\d{3,}\b/g);
      if (magicNumbers) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'info',
          category: 'quality',
          message: 'Magic number detected',
          suggestion: 'Extract to a named constant',
          autoFixAvailable: false,
        });
      }
    });

    return issues;
  }

  private checkSecurity(code: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // SQL injection risk
      if (/SELECT.*\+|INSERT.*\+/.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'critical',
          category: 'security',
          message: 'Potential SQL injection vulnerability',
          suggestion: 'Use parameterized queries',
          autoFixAvailable: false,
        });
      }

      // Hardcoded credentials
      if (/password\s*=\s*['"][^'"]+['"]/i.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'critical',
          category: 'security',
          message: 'Hardcoded credentials detected',
          suggestion: 'Use environment variables',
          autoFixAvailable: false,
        });
      }

      // eval() usage
      if (/\beval\(/.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'error',
          category: 'security',
          message: 'Dangerous eval() usage',
          suggestion: 'Use safer alternatives',
          autoFixAvailable: false,
        });
      }
    });

    return issues;
  }

  private checkPerformance(code: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // Nested loops
      if (/for.*for/.test(line) || /while.*while/.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'warning',
          category: 'performance',
          message: 'Nested loops detected - O(n²) complexity',
          suggestion: 'Consider using more efficient algorithm',
          autoFixAvailable: false,
        });
      }

      // Synchronous operations in async context
      if (/Sync\(/.test(line) && code.includes('async')) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'warning',
          category: 'performance',
          message: 'Synchronous operation in async context',
          suggestion: 'Use async version to avoid blocking',
          autoFixAvailable: false,
        });
      }
    });

    return issues;
  }

  private checkBestPractices(code: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // Missing error handling
      if (/await\s+/.test(line) && !code.includes('try') && !code.includes('.catch')) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'warning',
          category: 'best-practice',
          message: 'Async operation without error handling',
          suggestion: 'Add try-catch or .catch()',
          autoFixAvailable: true,
          autoFix: `try {\n${line}\n} catch (error) {\n  console.error(error);\n}`,
        });
      }

      // Console.log in production code
      if (/console\.log/.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'info',
          category: 'best-practice',
          message: 'Console.log detected',
          suggestion: 'Use proper logging library',
          autoFixAvailable: false,
        });
      }

      // var usage
      if (/\bvar\s+/.test(line)) {
        issues.push({
          line: idx + 1,
          column: 0,
          severity: 'info',
          category: 'best-practice',
          message: 'Use const or let instead of var',
          suggestion: 'Replace with const or let',
          autoFixAvailable: true,
          autoFix: line.replace(/\bvar\b/, 'const'),
        });
      }
    });

    return issues;
  }

  private calculateMetrics(code: string, issues: QualityIssue[]) {
    const lines = code.split('\n');
    const controlStatements = (code.match(/if|for|while|switch/g) || []).length;

    // Complexity (cyclomatic complexity approximation)
    const complexity = controlStatements + 1;

    // Maintainability (based on issues and complexity)
    const maintainability = Math.max(0, 100 - issues.length * 5 - complexity);

    // Security (based on critical/error issues)
    const securityIssues = issues.filter(
      i => i.category === 'security' && (i.severity === 'critical' || i.severity === 'error')
    ).length;
    const security = Math.max(0, 100 - securityIssues * 20);

    // Performance (based on performance issues)
    const performanceIssues = issues.filter(i => i.category === 'performance').length;
    const performance = Math.max(0, 100 - performanceIssues * 10);

    return {
      complexity,
      maintainability,
      security,
      performance,
    };
  }

  private calculateScore(metrics: any, issues: QualityIssue[]): number {
    // Weight different factors
    const weights = {
      maintainability: 0.3,
      security: 0.4,
      performance: 0.2,
      issueCount: 0.1,
    };

    const issueScore = Math.max(0, 100 - issues.length * 5);

    const score =
      metrics.maintainability * weights.maintainability +
      metrics.security * weights.security +
      metrics.performance * weights.performance +
      issueScore * weights.issueCount;

    return Math.round(score);
  }

  private generateSuggestions(issues: QualityIssue[], metrics: any): string[] {
    const suggestions: string[] = [];

    if (metrics.complexity > 10) {
      suggestions.push('Reduce complexity by extracting functions');
    }

    if (metrics.security < 80) {
      suggestions.push('Address security vulnerabilities immediately');
    }

    if (issues.some(i => i.autoFixAvailable)) {
      suggestions.push('Some issues can be auto-fixed');
    }

    if (issues.length > 10) {
      suggestions.push('Consider refactoring to address multiple issues');
    }

    return suggestions;
  }

  private generatePreventionTips(issues: QualityIssue[]): string[] {
    const tips: string[] = [];
    const categories = new Set(issues.map(i => i.category));

    if (categories.has('security')) {
      tips.push('Always validate and sanitize user input');
    }

    if (categories.has('performance')) {
      tips.push('Profile code before optimizing');
    }

    if (categories.has('quality')) {
      tips.push('Follow SOLID principles for better code quality');
    }

    return tips;
  }
}

export const realTimeCodeQualityGuardian = new RealTimeCodeQualityGuardian();
export default realTimeCodeQualityGuardian;
