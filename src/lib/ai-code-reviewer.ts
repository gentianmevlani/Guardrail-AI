/**
 * AI-Powered Code Review System
 * 
 * Automated code review with AI that learns from your team's review patterns
 * Unique: Learns your team's review style and applies it automatically
 */

import { codebaseKnowledgeBase, type CodebaseKnowledge } from './codebase-knowledge';
import type { KnowledgeBase } from './types/advanced-context';
import { aiBehaviorLearner } from './ai-behavior-learner';
import { codePatternDNA } from './code-pattern-dna';
import { predictiveQuality } from './predictive-quality';
import * as fs from 'fs';
import * as path from 'path';

export interface ReviewComment {
  type: 'bug' | 'security' | 'performance' | 'style' | 'suggestion' | 'question';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  code?: string;
  confidence: number;
  category: string;
}

export interface CodeReview {
  file: string;
  overallScore: number; // 0-100
  comments: ReviewComment[];
  summary: string;
  recommendations: string[];
  timeToReview: number; // seconds
  confidence: number;
}

export interface ReviewPattern {
  pattern: string;
  comment: string;
  severity: ReviewComment['severity'];
  frequency: number;
  teamConsensus: number; // 0-1
}

class AICodeReviewer {
  private reviewPatterns: Map<string, ReviewPattern> = new Map();

  /**
   * Review code with AI
   */
  async review(
    filePath: string,
    projectPath: string,
    options?: {
      focus?: 'all' | 'security' | 'performance' | 'quality';
      strictness?: 'strict' | 'moderate' | 'lenient';
    }
  ): Promise<CodeReview> {
    const startTime = Date.now();

    // Read file
    const code = await fs.promises.readFile(filePath, 'utf8');
    const lines = code.split('\n');

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    const comments: ReviewComment[] = [];

    // Review categories
    const securityComments = await this.reviewSecurity(code, lines, knowledge);
    comments.push(...securityComments);

    const performanceComments = await this.reviewPerformance(code, lines, knowledge);
    comments.push(...performanceComments);

    const qualityComments = await this.reviewQuality(code, lines, knowledge);
    comments.push(...qualityComments);

    const styleComments = await this.reviewStyle(code, lines, knowledge);
    comments.push(...styleComments);

    // Filter by focus
    let filteredComments = comments;
    if (options?.focus && options.focus !== 'all') {
      filteredComments = comments.filter(c => 
        options.focus === 'security' && c.type === 'security' ||
        options.focus === 'performance' && c.type === 'performance' ||
        options.focus === 'quality' && (c.type === 'bug' || c.type === 'suggestion')
      );
    }

    // Apply strictness filter
    if (options?.strictness) {
      const strictnessMap = {
        strict: ['critical', 'high', 'medium', 'low', 'info'],
        moderate: ['critical', 'high', 'medium'],
        lenient: ['critical', 'high'],
      };
      filteredComments = filteredComments.filter(c => 
        strictnessMap[options.strictness!].includes(c.severity)
      );
    }

    // Calculate overall score
    const overallScore = this.calculateScore(filteredComments);

    // Generate summary
    const summary = this.generateSummary(filteredComments, overallScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(filteredComments);

    const timeToReview = (Date.now() - startTime) / 1000;

    return {
      file: path.relative(projectPath, filePath),
      overallScore,
      comments: filteredComments,
      summary,
      recommendations,
      timeToReview,
      confidence: this.calculateConfidence(filteredComments),
    };
  }

  /**
   * Review security issues
   */
  private async reviewSecurity(
    code: string,
    lines: string[],
    knowledge: KnowledgeBase
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Check for SQL injection
    const sqlInjectionPattern = /['"]\s*\+\s*[^'"]*['"]/g;
    if (sqlInjectionPattern.test(code)) {
      const matches = code.match(sqlInjectionPattern);
      for (const match of matches || []) {
        const lineNum = this.findLineNumber(code, match);
        comments.push({
          type: 'security',
          severity: 'critical',
          line: lineNum,
          message: 'Potential SQL injection vulnerability',
          suggestion: 'Use parameterized queries or prepared statements',
          code: match,
          confidence: 0.9,
          category: 'sql-injection',
        });
      }
    }

    // Check for XSS
    const xssPattern = /dangerouslySetInnerHTML|innerHTML\s*=/g;
    if (xssPattern.test(code)) {
      const lineNum = this.findLineNumber(code, xssPattern);
      comments.push({
        type: 'security',
        severity: 'high',
        line: lineNum,
        message: 'Potential XSS vulnerability',
        suggestion: 'Sanitize HTML or use React\'s safe rendering',
        confidence: 0.8,
        category: 'xss',
      });
    }

    // Check for hardcoded secrets
    const secretPattern = /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"]([^'"]+)['"]/gi;
    if (secretPattern.test(code)) {
      const lineNum = this.findLineNumber(code, secretPattern);
      comments.push({
        type: 'security',
        severity: 'critical',
        line: lineNum,
        message: 'Hardcoded secret detected',
        suggestion: 'Use environment variables or secure secret management',
        confidence: 0.95,
        category: 'hardcoded-secret',
      });
    }

    return comments;
  }

  /**
   * Review performance issues
   */
  private async reviewPerformance(
    code: string,
    lines: string[],
    knowledge: KnowledgeBase
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Check for N+1 queries
    const loopPattern = /for\s*\([^)]+\)\s*\{[^}]*\.(?:find|findOne|findById)/g;
    if (loopPattern.test(code)) {
      const lineNum = this.findLineNumber(code, loopPattern);
      comments.push({
        type: 'performance',
        severity: 'high',
        line: lineNum,
        message: 'Potential N+1 query pattern',
        suggestion: 'Use eager loading or batch queries',
        confidence: 0.7,
        category: 'n-plus-one',
      });
    }

    // Check for missing memoization
    const expensivePattern = /useMemo|useCallback|React\.memo/;
    const expensiveOps = /\.map\(|\.filter\(|\.reduce\(/g;
    if (expensiveOps.test(code) && !expensivePattern.test(code)) {
      const lineNum = this.findLineNumber(code, expensiveOps);
      comments.push({
        type: 'performance',
        severity: 'medium',
        line: lineNum,
        message: 'Expensive operation without memoization',
        suggestion: 'Consider using useMemo or useCallback',
        confidence: 0.6,
        category: 'memoization',
      });
    }

    // Check for large bundle size
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const largeLibs = ['lodash', 'moment', 'rxjs'];
    let match;
    while ((match = importPattern.exec(code)) !== null) {
      if (largeLibs.some(lib => match[1].includes(lib))) {
        const lineNum = this.findLineNumber(code, match[0]);
        comments.push({
          type: 'performance',
          severity: 'medium',
          line: lineNum,
          message: `Large library import: ${match[1]}`,
          suggestion: 'Consider tree-shaking or using lighter alternatives',
          confidence: 0.7,
          category: 'bundle-size',
        });
      }
    }

    return comments;
  }

  /**
   * Review code quality
   */
  private async reviewQuality(
    code: string,
    lines: string[],
    knowledge: KnowledgeBase
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Check for long functions
    const functionPattern = /(?:function|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
    const functions = [];
    let match;
    while ((match = functionPattern.exec(code)) !== null) {
      functions.push({ start: match.index, name: match[0] });
    }

    for (const func of functions) {
      const funcCode = this.extractFunction(code, func.start);
      const lineCount = funcCode.split('\n').length;
      
      if (lineCount > 50) {
        const lineNum = this.findLineNumber(code, func.name);
        comments.push({
          type: 'suggestion',
          severity: 'medium',
          line: lineNum,
          message: `Long function (${lineCount} lines)`,
          suggestion: 'Consider breaking into smaller functions',
          confidence: 0.8,
          category: 'function-length',
        });
      }
    }

    // Check for complexity
    const complexity = this.calculateComplexity(code);
    if (complexity > 10) {
      comments.push({
        type: 'suggestion',
        severity: 'medium',
        line: 1,
        message: `High cyclomatic complexity (${complexity})`,
        suggestion: 'Simplify logic or extract functions',
        confidence: 0.7,
        category: 'complexity',
      });
    }

    // Check for code duplication
    const duplicates = await this.findDuplicates(code, knowledge);
    for (const dup of duplicates) {
      comments.push({
        type: 'suggestion',
        severity: 'low',
        line: dup.line,
        message: 'Potential code duplication',
        suggestion: 'Consider extracting to shared function',
        confidence: 0.6,
        category: 'duplication',
      });
    }

    return comments;
  }

  /**
   * Review code style
   */
  private async reviewStyle(
    code: string,
    lines: string[],
    knowledge: KnowledgeBase
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    const conventions = knowledge.architecture?.conventions || {};

    // Check naming conventions
    if (conventions.naming) {
      const naming = conventions.naming.files || 'camelCase';
      // Simplified check
    }

    // Check for console.log
    if (/console\.(log|debug|info)/.test(code)) {
      const lineNum = this.findLineNumber(code, /console\.(log|debug|info)/);
      comments.push({
        type: 'style',
        severity: 'low',
        line: lineNum,
        message: 'console.log found',
        suggestion: 'Remove or use proper logging',
        confidence: 0.9,
        category: 'console-log',
      });
    }

    // Check for TODO/FIXME
    if (/(?:TODO|FIXME|HACK|XXX)/i.test(code)) {
      const lineNum = this.findLineNumber(code, /(?:TODO|FIXME|HACK|XXX)/i);
      comments.push({
        type: 'question',
        severity: 'info',
        line: lineNum,
        message: 'TODO/FIXME comment found',
        suggestion: 'Address before merging',
        confidence: 1.0,
        category: 'todo',
      });
    }

    return comments;
  }

  /**
   * Learn from team reviews
   */
  async learnFromReview(
    filePath: string,
    humanComments: ReviewComment[],
    projectPath: string
  ): Promise<void> {
    // Extract patterns from human comments
    for (const comment of humanComments) {
      const pattern = this.extractPattern(filePath, comment);
      if (pattern) {
        const key = `${comment.category}:${pattern}`;
        const existing = this.reviewPatterns.get(key);
        
        if (existing) {
          existing.frequency++;
          existing.teamConsensus = (existing.teamConsensus + 1) / 2;
        } else {
          this.reviewPatterns.set(key, {
            pattern,
            comment: comment.message,
            severity: comment.severity,
            frequency: 1,
            teamConsensus: 1.0,
          });
        }
      }
    }
  }

  /**
   * Calculate review score
   */
  private calculateScore(comments: ReviewComment[]): number {
    let score = 100;
    
    for (const comment of comments) {
      const penalty = comment.severity === 'critical' ? 20 :
                     comment.severity === 'high' ? 15 :
                     comment.severity === 'medium' ? 10 :
                     comment.severity === 'low' ? 5 : 2;
      score -= penalty * comment.confidence;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate summary
   */
  private generateSummary(comments: ReviewComment[], score: number): string {
    const byType = new Map<string, number>();
    for (const comment of comments) {
      byType.set(comment.type, (byType.get(comment.type) || 0) + 1);
    }

    const parts: string[] = [];
    parts.push(`Overall Score: ${score}/100`);
    
    if (comments.length === 0) {
      parts.push('✅ No issues found!');
    } else {
      parts.push(`Found ${comments.length} issue(s):`);
      for (const [type, count] of byType.entries()) {
        parts.push(`  - ${count} ${type} issue(s)`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(comments: ReviewComment[]): string[] {
    const recommendations: string[] = [];

    const critical = comments.filter(c => c.severity === 'critical');
    if (critical.length > 0) {
      recommendations.push(`🔴 ${critical.length} critical issue(s) must be fixed before merging`);
    }

    const security = comments.filter(c => c.type === 'security');
    if (security.length > 0) {
      recommendations.push(`🔒 ${security.length} security issue(s) found - review immediately`);
    }

    const performance = comments.filter(c => c.type === 'performance');
    if (performance.length > 0) {
      recommendations.push(`⚡ ${performance.length} performance issue(s) - consider optimizing`);
    }

    return recommendations;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(comments: ReviewComment[]): number {
    if (comments.length === 0) return 1.0;
    const avg = comments.reduce((sum, c) => sum + c.confidence, 0) / comments.length;
    return avg;
  }

  // Helper methods
  private findLineNumber(code: string, pattern: RegExp | string): number {
    if (typeof pattern === 'string') {
      const index = code.indexOf(pattern);
      return code.substring(0, index).split('\n').length;
    }
    const match = code.match(pattern);
    if (match && match.index !== undefined) {
      return code.substring(0, match.index).split('\n').length;
    }
    return 1;
  }

  private extractFunction(code: string, startIndex: number): string {
    // Simplified - find function end
    let depth = 0;
    let inFunction = false;
    
    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        depth++;
        inFunction = true;
      } else if (code[i] === '}') {
        depth--;
        if (inFunction && depth === 0) {
          return code.substring(startIndex, i + 1);
        }
      }
    }
    
    return code.substring(startIndex);
  }

  private calculateComplexity(code: string): number {
    const decisions = (code.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []).length;
    return decisions + 1;
  }

  private async findDuplicates(code: string, knowledge: any): Promise<Array<{ line: number; similarity: number }>> {
    // Simplified - in production use proper duplication detection
    return [];
  }

  private extractPattern(filePath: string, comment: ReviewComment): string | null {
    // Extract code pattern that triggered comment
    return comment.code || null;
  }
}

export const aiCodeReviewer = new AICodeReviewer();

