/**
 * Predictive Quality Service
 * 
 * Real implementation for predicting code quality issues.
 * Analyzes code patterns to predict potential bugs and issues.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Prediction {
  type: 'bug' | 'performance' | 'maintainability' | 'security' | 'scalability';
  confidence: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  file: string;
  line?: number;
  predictedIssue: string;
  prevention: string[];
  timeline: 'immediate' | 'short-term' | 'long-term';
  evidence: string[];
}

export interface PredictiveAnalysis {
  predictions: Prediction[];
  riskScore: number;
  summary: {
    totalPredictions: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  analyzedAt: string;
}

// Pattern detectors for different issue types
interface PatternDetector {
  pattern: RegExp;
  type: Prediction['type'];
  severity: Prediction['severity'];
  description: string;
  predictedIssue: string;
  prevention: string[];
  timeline: Prediction['timeline'];
}

const patternDetectors: PatternDetector[] = [
  // Performance issues
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*await\s+/gs,
    type: 'performance',
    severity: 'high',
    description: 'Sequential await in loop detected',
    predictedIssue: 'Performance degradation due to sequential async operations',
    prevention: ['Use Promise.all() for parallel execution', 'Batch operations when possible'],
    timeline: 'short-term',
  },
  {
    pattern: /\.forEach\([^)]*async/g,
    type: 'performance',
    severity: 'medium',
    description: 'Async function in forEach',
    predictedIssue: 'forEach does not wait for async operations',
    prevention: ['Use for...of with await', 'Use Promise.all with map'],
    timeline: 'immediate',
  },
  {
    pattern: /document\.querySelector.*\.forEach|querySelectorAll.*\.forEach/g,
    type: 'performance',
    severity: 'low',
    description: 'DOM manipulation in loop',
    predictedIssue: 'Multiple DOM queries can cause layout thrashing',
    prevention: ['Cache DOM references', 'Batch DOM updates'],
    timeline: 'short-term',
  },
  
  // Security issues
  {
    pattern: /innerHTML\s*=|outerHTML\s*=/g,
    type: 'security',
    severity: 'high',
    description: 'Direct HTML injection detected',
    predictedIssue: 'Potential XSS vulnerability',
    prevention: ['Use textContent for plain text', 'Sanitize HTML before injection', 'Use DOM methods instead'],
    timeline: 'immediate',
  },
  {
    pattern: /eval\s*\(|new\s+Function\s*\(/g,
    type: 'security',
    severity: 'high',
    description: 'Dynamic code execution detected',
    predictedIssue: 'Potential code injection vulnerability',
    prevention: ['Avoid eval and new Function', 'Use safer alternatives like JSON.parse'],
    timeline: 'immediate',
  },
  {
    pattern: /password|secret|apikey|api_key|token/gi,
    type: 'security',
    severity: 'medium',
    description: 'Potential sensitive data exposure',
    predictedIssue: 'Sensitive data may be exposed in code',
    prevention: ['Use environment variables', 'Never commit secrets to version control'],
    timeline: 'immediate',
  },

  // Bug-prone patterns
  {
    pattern: /==\s*null|null\s*==/g,
    type: 'bug',
    severity: 'low',
    description: 'Loose null comparison',
    predictedIssue: 'May not handle undefined values correctly',
    prevention: ['Use === for strict comparison', 'Consider nullish coalescing (??)'],
    timeline: 'short-term',
  },
  {
    pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    type: 'bug',
    severity: 'medium',
    description: 'Empty catch block',
    predictedIssue: 'Silently swallowing errors can hide bugs',
    prevention: ['Log errors', 'Re-throw or handle appropriately'],
    timeline: 'short-term',
  },
  {
    pattern: /\.then\([^)]*\)(?!\s*\.catch)/g,
    type: 'bug',
    severity: 'medium',
    description: 'Unhandled promise rejection',
    predictedIssue: 'Unhandled promise rejections can cause crashes',
    prevention: ['Add .catch() handler', 'Use try/catch with async/await'],
    timeline: 'short-term',
  },

  // Maintainability issues
  {
    pattern: /function\s+\w+\s*\([^)]{100,}\)/g,
    type: 'maintainability',
    severity: 'medium',
    description: 'Function with many parameters',
    predictedIssue: 'Hard to maintain and understand',
    prevention: ['Use an options object', 'Break into smaller functions'],
    timeline: 'long-term',
  },
  {
    pattern: /TODO|FIXME|HACK|XXX/g,
    type: 'maintainability',
    severity: 'low',
    description: 'Technical debt marker found',
    predictedIssue: 'Deferred work that may cause issues',
    prevention: ['Address TODOs promptly', 'Create tickets for tracking'],
    timeline: 'long-term',
  },
  {
    pattern: /console\.(log|debug|info)/g,
    type: 'maintainability',
    severity: 'low',
    description: 'Console logging in production code',
    predictedIssue: 'Debug logs should not be in production',
    prevention: ['Use proper logging library', 'Remove console.log before commit'],
    timeline: 'short-term',
  },

  // Scalability issues
  {
    pattern: /Array\(\d{5,}\)|new\s+Array\s*\(\s*\d{5,}/g,
    type: 'scalability',
    severity: 'high',
    description: 'Large array allocation',
    predictedIssue: 'Memory issues with large data sets',
    prevention: ['Use streaming/pagination', 'Process in chunks'],
    timeline: 'short-term',
  },
  {
    pattern: /setTimeout.*0\)|setImmediate/g,
    type: 'scalability',
    severity: 'low',
    description: 'Zero timeout pattern detected',
    predictedIssue: 'Can cause event loop blocking',
    prevention: ['Use proper async patterns', 'Consider queueMicrotask'],
    timeline: 'long-term',
  },
];

class PredictiveQualityService {
  private excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  private codeExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  /**
   * Analyze a project for quality predictions
   */
  async analyzeProject(directory: string): Promise<PredictiveAnalysis> {
    const predictions: Prediction[] = [];
    const files = await this.getAllFiles(directory);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(directory, file);
        const filePredictions = this.analyzeFile(content, relativePath);
        predictions.push(...filePredictions);
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(predictions);

    // Generate summary
    const summary = this.generateSummary(predictions);

    return {
      predictions,
      riskScore,
      summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze content directly
   */
  analyzeContent(content: string, filename: string): Prediction[] {
    return this.analyzeFile(content, filename);
  }

  /**
   * Analyze a single file
   */
  private analyzeFile(content: string, filePath: string): Prediction[] {
    const predictions: Prediction[] = [];
    const lines = content.split('\n');

    for (const detector of patternDetectors) {
      // Reset regex lastIndex
      detector.pattern.lastIndex = 0;
      
      let match;
      while ((match = detector.pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        predictions.push({
          type: detector.type,
          confidence: this.calculateConfidence(match[0], detector),
          severity: detector.severity,
          description: detector.description,
          file: filePath,
          line: lineNumber,
          predictedIssue: detector.predictedIssue,
          prevention: detector.prevention,
          timeline: detector.timeline,
          evidence: [this.getCodeContext(lines, lineNumber)],
        });
      }
    }

    // Additional complexity analysis
    const complexityPredictions = this.analyzeComplexity(content, filePath, lines);
    predictions.push(...complexityPredictions);

    return predictions;
  }

  /**
   * Analyze code complexity
   */
  private analyzeComplexity(content: string, filePath: string, lines: string[]): Prediction[] {
    const predictions: Prediction[] = [];

    // Check function length
    const functionMatches = content.matchAll(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))[^{]*\{/g);
    
    for (const match of functionMatches) {
      const startIndex = match.index!;
      const startLine = content.substring(0, startIndex).split('\n').length;
      
      // Count lines in function (simplified - count to matching brace)
      let braceCount = 1;
      let funcLines = 0;
      for (let i = startIndex + match[0].length; i < content.length && braceCount > 0; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (content[i] === '\n') funcLines++;
      }

      if (funcLines > 50) {
        predictions.push({
          type: 'maintainability',
          confidence: 0.9,
          severity: 'medium',
          description: `Long function (${funcLines} lines)`,
          file: filePath,
          line: startLine,
          predictedIssue: 'Functions over 50 lines are harder to test and maintain',
          prevention: ['Break into smaller functions', 'Extract helper methods', 'Use composition'],
          timeline: 'long-term',
          evidence: [`Function has ${funcLines} lines of code`],
        });
      }
    }

    // Check file length
    if (lines.length > 300) {
      predictions.push({
        type: 'maintainability',
        confidence: 0.8,
        severity: 'low',
        description: `Large file (${lines.length} lines)`,
        file: filePath,
        predictedIssue: 'Large files are harder to navigate and maintain',
        prevention: ['Split into modules', 'Extract reusable components', 'Use barrel files'],
        timeline: 'long-term',
        evidence: [`File has ${lines.length} lines of code`],
      });
    }

    return predictions;
  }

  /**
   * Calculate confidence based on pattern match
   */
  private calculateConfidence(match: string, detector: PatternDetector): number {
    // Base confidence
    let confidence = 0.7;

    // Increase confidence for longer matches (more context)
    if (match.length > 50) confidence += 0.1;

    // Adjust based on severity
    if (detector.severity === 'high') confidence += 0.1;
    if (detector.severity === 'low') confidence -= 0.1;

    return Math.min(0.99, Math.max(0.5, confidence));
  }

  /**
   * Get code context around a line
   */
  private getCodeContext(lines: string[], lineNumber: number): string {
    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(lines.length, lineNumber + 1);
    return lines.slice(start, end).join('\n').trim();
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(predictions: Prediction[]): number {
    if (predictions.length === 0) return 0;

    const weights = { high: 30, medium: 15, low: 5 };
    let score = 0;

    for (const pred of predictions) {
      score += weights[pred.severity] * pred.confidence;
    }

    // Normalize to 0-100
    return Math.min(100, Math.round(score));
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(predictions: Prediction[]): PredictiveAnalysis['summary'] {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const pred of predictions) {
      byType[pred.type] = (byType[pred.type] || 0) + 1;
      bySeverity[pred.severity] = (bySeverity[pred.severity] || 0) + 1;
    }

    return {
      totalPredictions: predictions.length,
      byType,
      bySeverity,
    };
  }

  /**
   * Get all code files in directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (directory: string) => {
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            if (!this.excludedDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.codeExtensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading ${directory}:`, error);
      }
    };

    await walk(dir);
    return files;
  }
}

export const predictiveQualityService = new PredictiveQualityService();
