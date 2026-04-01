/**
 * Performance Optimizer
 * 
 * Analyzes and optimizes code performance automatically
 * Unique: Proactive performance optimization with measurable improvements
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface PerformanceIssue {
  type: 'bundle-size' | 'render' | 'query' | 'memory' | 'network' | 'computation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  issue: string;
  impact: string;
  current: string;
  optimized: string;
  improvement: number; // percentage
  confidence: number;
}

export interface OptimizationReport {
  issues: PerformanceIssue[];
  totalImprovement: number; // percentage
  estimatedSavings: {
    bundleSize: number; // bytes
    loadTime: number; // milliseconds
    renderTime: number; // milliseconds
  };
  recommendations: string[];
}

class PerformanceOptimizer {
  /**
   * Analyze and optimize code
   */
  async optimize(
    projectPath: string,
    options?: {
      focus?: 'all' | 'bundle' | 'render' | 'queries';
      autoFix?: boolean;
    }
  ): Promise<OptimizationReport> {
    const issues: PerformanceIssue[] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    // Analyze bundle size
    const bundleIssues = await this.analyzeBundleSize(projectPath);
    issues.push(...bundleIssues);

    // Analyze render performance
    const renderIssues = await this.analyzeRenderPerformance(projectPath);
    issues.push(...renderIssues);

    // Analyze queries
    const queryIssues = await this.analyzeQueries(projectPath);
    issues.push(...queryIssues);

    // Analyze memory
    const memoryIssues = await this.analyzeMemory(projectPath);
    issues.push(...memoryIssues);

    // Filter by focus
    let filteredIssues = issues;
    if (options?.focus && options.focus !== 'all') {
      filteredIssues = issues.filter(i => 
        options.focus === 'bundle' && i.type === 'bundle-size' ||
        options.focus === 'render' && i.type === 'render' ||
        options.focus === 'queries' && i.type === 'query'
      );
    }

    // Calculate improvements
    const totalImprovement = this.calculateTotalImprovement(filteredIssues);
    const estimatedSavings = this.calculateSavings(filteredIssues);

    // Generate recommendations
    const recommendations = this.generateRecommendations(filteredIssues);

    // Auto-fix if requested
    if (options?.autoFix) {
      await this.applyFixes(filteredIssues, projectPath);
    }

    return {
      issues: filteredIssues,
      totalImprovement,
      estimatedSavings,
      recommendations,
    };
  }

  /**
   * Analyze bundle size
   */
  private async analyzeBundleSize(projectPath: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    // Find large imports
    const files = await this.findCodeFiles(projectPath);
    
    for (const file of files.slice(0, 50)) { // Limit for performance
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        
        // Check for full library imports
        const fullImports = content.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g);
        if (fullImports) {
          for (const imp of fullImports) {
            const lib = imp.match(/['"]([^'"]+)['"]/)?.[1];
            if (lib && this.isLargeLibrary(lib)) {
              issues.push({
                type: 'bundle-size',
                severity: 'high',
                file: path.relative(projectPath, file),
                issue: `Full import of large library: ${lib}`,
                impact: 'Increases bundle size significantly',
                current: imp,
                optimized: `import { specificFunction } from '${lib}';`,
                improvement: 60,
                confidence: 0.9,
              });
            }
          }
        }

        // Check for duplicate imports
        const imports = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g) || [];
        const importMap = new Map<string, number>();
        for (const imp of imports) {
          const lib = imp.match(/['"]([^'"]+)['"]/)?.[1];
          if (lib) {
            importMap.set(lib, (importMap.get(lib) || 0) + 1);
          }
        }

        for (const [lib, count] of importMap.entries()) {
          if (count > 1) {
            issues.push({
              type: 'bundle-size',
              severity: 'medium',
              file: path.relative(projectPath, file),
              issue: `Duplicate imports from ${lib}`,
              impact: 'Unnecessary bundle size',
              current: `${count} imports from ${lib}`,
              optimized: 'Consolidate into single import',
              improvement: 10,
              confidence: 0.8,
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return issues;
  }

  /**
   * Analyze render performance
   */
  private async analyzeRenderPerformance(projectPath: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    const files = await this.findReactFiles(projectPath);

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for missing memoization
        const hasExpensiveOps = /\.map\(|\.filter\(|\.reduce\(|\.sort\(/.test(content);
        const hasMemo = /useMemo|useCallback|React\.memo/.test(content);
        
        if (hasExpensiveOps && !hasMemo) {
          const lineNum = this.findLineNumber(content, /\.map\(|\.filter\(|\.reduce\(/);
          issues.push({
            type: 'render',
            severity: 'medium',
            file: path.relative(projectPath, file),
            line: lineNum,
            issue: 'Expensive operations without memoization',
            impact: 'Causes unnecessary re-renders',
            current: 'Operations run on every render',
            optimized: 'Wrap in useMemo or useCallback',
            improvement: 40,
            confidence: 0.7,
          });
        }

        // Check for inline functions
        const inlineFunctions = /onClick=\{.*=>/g;
        if (inlineFunctions.test(content)) {
          issues.push({
            type: 'render',
            severity: 'low',
            file: path.relative(projectPath, file),
            issue: 'Inline functions in JSX',
            impact: 'Creates new function on every render',
            current: 'onClick={() => ...}',
            optimized: 'Extract to useCallback',
            improvement: 15,
            confidence: 0.6,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return issues;
  }

  /**
   * Analyze database queries
   */
  private async analyzeQueries(projectPath: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for N+1 queries
        const loopWithQuery = /for\s*\([^)]+\)\s*\{[^}]*\.(?:find|findOne|findById|query)/g;
        if (loopWithQuery.test(content)) {
          const lineNum = this.findLineNumber(content, loopWithQuery);
          issues.push({
            type: 'query',
            severity: 'high',
            file: path.relative(projectPath, file),
            line: lineNum,
            issue: 'Potential N+1 query pattern',
            impact: 'Exponential query growth',
            current: 'Query inside loop',
            optimized: 'Use batch query or eager loading',
            improvement: 80,
            confidence: 0.8,
          });
        }

        // Check for missing indexes
        const queries = content.match(/\.(?:find|findOne|where)\([^)]+\)/g) || [];
        if (queries.length > 0) {
          issues.push({
            type: 'query',
            severity: 'medium',
            file: path.relative(projectPath, file),
            issue: 'Queries may benefit from indexes',
            impact: 'Slower query performance',
            current: 'No index hints',
            optimized: 'Add database indexes',
            improvement: 50,
            confidence: 0.6,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return issues;
  }

  /**
   * Analyze memory usage
   */
  private async analyzeMemory(projectPath: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for memory leaks
        const eventListeners = /addEventListener/g;
        const removals = /removeEventListener/g;
        const addCount = (content.match(eventListeners) || []).length;
        const removeCount = (content.match(removals) || []).length;

        if (addCount > removeCount) {
          issues.push({
            type: 'memory',
            severity: 'high',
            file: path.relative(projectPath, file),
            issue: 'Potential memory leak: event listeners not removed',
            impact: 'Memory usage grows over time',
            current: `${addCount} listeners added, ${removeCount} removed`,
            optimized: 'Remove listeners in cleanup',
            improvement: 70,
            confidence: 0.8,
          });
        }

        // Check for large arrays in memory
        const largeArrays = /const\s+\w+\s*=\s*\[[^\]]{500,}\]/g;
        if (largeArrays.test(content)) {
          issues.push({
            type: 'memory',
            severity: 'medium',
            file: path.relative(projectPath, file),
            issue: 'Large array in memory',
            impact: 'High memory usage',
            current: 'Large array stored in memory',
            optimized: 'Use pagination or lazy loading',
            improvement: 60,
            confidence: 0.7,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return issues;
  }

  /**
   * Calculate total improvement
   */
  private calculateTotalImprovement(issues: PerformanceIssue[]): number {
    if (issues.length === 0) return 0;
    
    const weightedSum = issues.reduce((sum, issue) => {
      const weight = issue.severity === 'critical' ? 1.5 :
                     issue.severity === 'high' ? 1.2 :
                     issue.severity === 'medium' ? 1.0 : 0.8;
      return sum + issue.improvement * weight * issue.confidence;
    }, 0);

    const totalWeight = issues.reduce((sum, issue) => {
      const weight = issue.severity === 'critical' ? 1.5 :
                     issue.severity === 'high' ? 1.2 :
                     issue.severity === 'medium' ? 1.0 : 0.8;
      return sum + weight;
    }, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate estimated savings
   */
  private calculateSavings(issues: PerformanceIssue[]): OptimizationReport['estimatedSavings'] {
    let bundleSize = 0;
    let loadTime = 0;
    let renderTime = 0;

    for (const issue of issues) {
      if (issue.type === 'bundle-size') {
        bundleSize += issue.improvement * 1000; // Estimate bytes
        loadTime += issue.improvement * 10; // Estimate ms
      } else if (issue.type === 'render') {
        renderTime += issue.improvement * 5; // Estimate ms
      } else if (issue.type === 'query') {
        loadTime += issue.improvement * 20; // Estimate ms
      }
    }

    return {
      bundleSize: Math.round(bundleSize),
      loadTime: Math.round(loadTime),
      renderTime: Math.round(renderTime),
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];

    const byType = new Map<string, number>();
    for (const issue of issues) {
      byType.set(issue.type, (byType.get(issue.type) || 0) + 1);
    }

    if (byType.get('bundle-size') && byType.get('bundle-size')! > 0) {
      recommendations.push(`📦 ${byType.get('bundle-size')} bundle size issue(s) - can reduce by ~${this.calculateSavings(issues.filter(i => i.type === 'bundle-size')).bundleSize} bytes`);
    }

    if (byType.get('render') && byType.get('render')! > 0) {
      recommendations.push(`⚡ ${byType.get('render')} render performance issue(s) - can improve by ~${this.calculateSavings(issues.filter(i => i.type === 'render')).renderTime}ms`);
    }

    if (byType.get('query') && byType.get('query')! > 0) {
      recommendations.push(`🗄️ ${byType.get('query')} query performance issue(s) - can improve by ~${this.calculateSavings(issues.filter(i => i.type === 'query')).loadTime}ms`);
    }

    return recommendations;
  }

  /**
   * Apply fixes
   */
  private async applyFixes(
    issues: PerformanceIssue[],
    projectPath: string
  ): Promise<void> {
    // Group by file
    const byFile = new Map<string, PerformanceIssue[]>();
    for (const issue of issues) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, []);
      }
      byFile.get(issue.file)!.push(issue);
    }

    // Apply fixes to each file
    for (const [file, fileIssues] of byFile.entries()) {
      const filePath = path.join(projectPath, file);
      try {
        let content = await fs.promises.readFile(filePath, 'utf8');

        for (const issue of fileIssues) {
          // Apply fix based on type
          if (issue.type === 'bundle-size' && issue.current && issue.optimized) {
            content = content.replace(issue.current, issue.optimized);
          }
          // Add more fix types as needed
        }

        await fs.promises.writeFile(filePath, content, 'utf8');
      } catch {
        // Error applying fixes
      }
    }
  }

  // Helper methods
  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private async findReactFiles(dir: string): Promise<string[]> {
    const allFiles = await this.findCodeFiles(dir);
    return allFiles.filter(f => /\.(tsx|jsx)$/.test(f));
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }

  private isLargeLibrary(lib: string): boolean {
    const largeLibs = ['lodash', 'moment', 'rxjs', 'ramda', 'immutable'];
    return largeLibs.some(l => lib.includes(l));
  }

  private findLineNumber(code: string, pattern: RegExp): number {
    const match = code.match(pattern);
    if (match && match.index !== undefined) {
      return code.substring(0, match.index).split('\n').length;
    }
    return 1;
  }
}

export const performanceOptimizer = new PerformanceOptimizer();

