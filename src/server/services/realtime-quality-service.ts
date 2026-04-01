/**
 * Real-Time Quality Service
 * 
 * Real implementation for live code quality monitoring.
 * Analyzes code in real-time and provides instant feedback.
 */

export interface QualityIssue {
  type: 'performance' | 'security' | 'quality' | 'error' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  column?: number;
  message: string;
  code?: string;
  autoFixAvailable: boolean;
  fix?: string;
}

export interface QualityMetrics {
  score: number;
  complexity: number;
  maintainability: number;
  testability: number;
  issues: QualityIssue[];
}

export interface LiveAnalysis {
  content: string;
  filename: string;
  metrics: QualityMetrics;
  suggestions: string[];
  analyzedAt: string;
}

// Real-time quality checks
interface QualityCheck {
  pattern: RegExp;
  type: QualityIssue['type'];
  severity: QualityIssue['severity'];
  message: string;
  autoFixAvailable: boolean;
  fix?: (match: string) => string;
}

const qualityChecks: QualityCheck[] = [
  // Performance issues
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*\.push\(/g,
    type: 'performance',
    severity: 'low',
    message: 'Consider using map() instead of push() in loop',
    autoFixAvailable: false,
  },
  {
    pattern: /document\.querySelector.*for|for.*document\.querySelector/g,
    type: 'performance',
    severity: 'medium',
    message: 'DOM queries inside loops can cause performance issues',
    autoFixAvailable: false,
  },
  {
    pattern: /JSON\.parse\(.*JSON\.stringify/g,
    type: 'performance',
    severity: 'low',
    message: 'Deep clone using JSON is slow - consider structuredClone()',
    autoFixAvailable: true,
    fix: (match) => match.replace('JSON.parse(JSON.stringify(', 'structuredClone(').replace('))', ')'),
  },
  {
    pattern: /\.filter\([^)]+\)\.map\(/g,
    type: 'performance',
    severity: 'low',
    message: 'Chain filter().map() causes two iterations - consider reduce()',
    autoFixAvailable: false,
  },
  
  // Security issues
  {
    pattern: /innerHTML\s*=\s*[^;]+(?:user|input|param|query)/gi,
    type: 'security',
    severity: 'high',
    message: 'Potential XSS vulnerability - user input in innerHTML',
    autoFixAvailable: false,
  },
  {
    pattern: /eval\s*\(/g,
    type: 'security',
    severity: 'critical',
    message: 'eval() is dangerous and should be avoided',
    autoFixAvailable: false,
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    type: 'security',
    severity: 'high',
    message: 'dangerouslySetInnerHTML can cause XSS - ensure content is sanitized',
    autoFixAvailable: false,
  },
  {
    pattern: /\$\{.*\}.*sql|sql.*\$\{.*\}/gi,
    type: 'security',
    severity: 'critical',
    message: 'Potential SQL injection - use parameterized queries',
    autoFixAvailable: false,
  },
  
  // Quality issues
  {
    pattern: /function\s+\w+\s*\([^)]{80,}\)/g,
    type: 'quality',
    severity: 'medium',
    message: 'Function has too many parameters - consider using an options object',
    autoFixAvailable: false,
  },
  {
    pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    type: 'quality',
    severity: 'high',
    message: 'Empty catch block - errors are being silently ignored',
    autoFixAvailable: false,
  },
  {
    pattern: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/g,
    type: 'quality',
    severity: 'low',
    message: 'Technical debt marker found - consider addressing',
    autoFixAvailable: false,
  },
  {
    pattern: /console\.(log|debug|info)\s*\(/g,
    type: 'quality',
    severity: 'low',
    message: 'Console statement found - remove before production',
    autoFixAvailable: true,
    fix: () => '',
  },
  {
    pattern: /any(?:\[\])?(?:\s*[,);>]|\s*$)/gm,
    type: 'quality',
    severity: 'medium',
    message: 'Using "any" type loses type safety',
    autoFixAvailable: false,
  },
  {
    pattern: /\!\!\s*\w+/g,
    type: 'quality',
    severity: 'low',
    message: 'Double negation - consider Boolean() for clarity',
    autoFixAvailable: true,
    fix: (match) => `Boolean(${match.slice(2)})`,
  },
  
  // Style issues
  {
    pattern: /var\s+\w+\s*=/g,
    type: 'style',
    severity: 'low',
    message: 'Use const or let instead of var',
    autoFixAvailable: true,
    fix: (match) => match.replace('var', 'const'),
  },
  {
    pattern: /==(?!=)/g,
    type: 'style',
    severity: 'low',
    message: 'Use === for strict equality comparison',
    autoFixAvailable: true,
    fix: (_match) => '===',
  },
  {
    pattern: /!=(?!=)/g,
    type: 'style',
    severity: 'low',
    message: 'Use !== for strict inequality comparison',
    autoFixAvailable: true,
    fix: (_match) => '!==',
  },
  {
    pattern: /\bthen\s*\(\s*(?:function|async\s*function|\([^)]*\)\s*=>)/g,
    type: 'style',
    severity: 'low',
    message: 'Consider using async/await instead of .then()',
    autoFixAvailable: false,
  },
];

class RealTimeQualityService {
  /**
   * Analyze code in real-time
   */
  analyzeCode(content: string, filename: string = 'unknown'): LiveAnalysis {
    const lines = content.split('\n');
    const issues = this.detectIssues(content, lines);
    const metrics = this.calculateMetrics(content, issues);
    const suggestions = this.generateSuggestions(issues, metrics);

    return {
      content,
      filename,
      metrics,
      suggestions,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Get quality score for content
   */
  getQualityScore(content: string): number {
    const lines = content.split('\n');
    const issues = this.detectIssues(content, lines);
    return this.calculateScore(issues);
  }

  /**
   * Detect issues in code
   */
  private detectIssues(content: string, lines: string[]): QualityIssue[] {
    const issues: QualityIssue[] = [];

    for (const check of qualityChecks) {
      check.pattern.lastIndex = 0;
      let match;

      while ((match = check.pattern.exec(content)) !== null) {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        issues.push({
          type: check.type,
          severity: check.severity,
          line: lineNumber,
          message: check.message,
          code: match[0].substring(0, 50),
          autoFixAvailable: check.autoFixAvailable,
          fix: check.fix ? check.fix(match[0]) : undefined,
        });
      }
    }

    // Additional complexity checks
    issues.push(...this.checkComplexity(lines));

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return issues;
  }

  /**
   * Check code complexity
   */
  private checkComplexity(lines: string[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    let nestingLevel = 0;
    let functionNesting = 0;
    let maxNesting = 0;
    let functionStart = -1;
    let functionLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line?.trim() || '';
      
      if (!trimmed) continue;
      
      const opens = (trimmed.match(/\{/g) || []).length;
      const closes = (trimmed.match(/\}/g) || []).length;
      
      nestingLevel += opens - closes;
      maxNesting = Math.max(maxNesting, nestingLevel);

      // Track function starts
      if (/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/.test(trimmed)) {
        functionStart = i;
        functionNesting = nestingLevel;
        functionLines = 0;
      }

      // Count function lines
      if (functionStart >= 0) {
        functionLines++;
        
        // Check if function ended
        if (nestingLevel < functionNesting) {
          if (functionLines > 50) {
            issues.push({
              type: 'quality',
              severity: 'medium',
              line: functionStart + 1,
              message: `Function is too long (${functionLines} lines) - consider breaking it up`,
              autoFixAvailable: false,
            });
          }
          functionStart = -1;
        }
      }

      // Check deeply nested code
      if (nestingLevel > 4 && opens > 0) {
        issues.push({
          type: 'quality',
          severity: 'medium',
          line: i + 1,
          message: `Deeply nested code (level ${nestingLevel}) - consider extracting to functions`,
          autoFixAvailable: false,
        });
      }

      // Check long lines
      if (line && line.length > 120) {
        issues.push({
          type: 'style',
          severity: 'low',
          line: i + 1,
          message: `Line too long (${line.length} chars) - keep under 120 characters`,
          autoFixAvailable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Calculate quality metrics
   */
  private calculateMetrics(content: string, issues: QualityIssue[]): QualityMetrics {
    const score = this.calculateScore(issues);
    
    // Calculate complexity (simplified cyclomatic complexity)
    const complexity = this.calculateComplexity(content);
    
    // Calculate maintainability index (simplified)
    const maintainability = Math.max(0, 100 - (complexity * 2) - (issues.length * 3));
    
    // Calculate testability (based on function size and dependencies)
    const testability = Math.max(0, 100 - (complexity * 1.5) - (issues.filter(i => i.type === 'quality').length * 5));

    return {
      score: Math.round(score),
      complexity: Math.round(complexity),
      maintainability: Math.round(maintainability),
      testability: Math.round(testability),
      issues,
    };
  }

  /**
   * Calculate quality score
   */
  private calculateScore(issues: QualityIssue[]): number {
    let score = 100;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private calculateComplexity(content: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+:/g, // Ternary
      /&&/g,
      /\|\|/g,
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(issues: QualityIssue[], metrics: QualityMetrics): string[] {
    const suggestions: string[] = [];
    
    // Score-based suggestions
    if (metrics.score < 60) {
      suggestions.push('Code quality is low - prioritize fixing critical and high severity issues');
    } else if (metrics.score < 80) {
      suggestions.push('Code quality is acceptable - address medium severity issues for improvement');
    } else {
      suggestions.push('Code quality is good - focus on maintaining current standards');
    }
    
    // Complexity suggestions
    if (metrics.complexity > 20) {
      suggestions.push('High complexity detected - consider breaking code into smaller functions');
    }
    
    // Type-specific suggestions
    const securityIssues = issues.filter(i => i.type === 'security');
    if (securityIssues.length > 0) {
      suggestions.push(`${securityIssues.length} security issue(s) found - address these first`);
    }
    
    const performanceIssues = issues.filter(i => i.type === 'performance');
    if (performanceIssues.length > 2) {
      suggestions.push('Multiple performance issues detected - consider code optimization');
    }
    
    // Auto-fix suggestions
    const autoFixable = issues.filter(i => i.autoFixAvailable);
    if (autoFixable.length > 0) {
      suggestions.push(`${autoFixable.length} issue(s) can be auto-fixed`);
    }
    
    return suggestions;
  }

  /**
   * Apply auto-fixes to code
   */
  applyAutoFixes(content: string): { fixed: string; fixCount: number } {
    let fixed = content;
    let fixCount = 0;

    for (const check of qualityChecks) {
      if (check.autoFixAvailable && check.fix) {
        check.pattern.lastIndex = 0;
        const matches = content.match(check.pattern);
        if (matches) {
          for (const match of matches) {
            fixed = fixed.replace(match, check.fix(match));
            fixCount++;
          }
        }
      }
    }

    return { fixed, fixCount };
  }
}

export const realTimeQualityService = new RealTimeQualityService();
