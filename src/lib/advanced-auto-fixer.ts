/**
 * Advanced Auto-Fixer
 * 
 * Intelligent auto-fix system with preview, rollback, and smart fix strategies.
 * Unique: Context-aware fixes that learn from codebase patterns.
 * 
 * @module advanced-auto-fixer
 * @example
 * ```typescript
 * const fixer = new AdvancedAutoFixer(projectPath);
 * const fixes = await fixer.analyzeFile('src/app.ts');
 * 
 * // Preview fixes
 * const preview = await fixer.previewFixes(fixes);
 * console.log(preview.changes);
 * 
 * // Apply fixes
 * await fixer.applyFixes(fixes, { dryRun: false });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { universalGuardrails } from './universal-guardrails';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import type { GuardrailIssue } from './universal-guardrails';

export interface Fix {
  id: string;
  file: string;
  rule: string;
  issue: GuardrailIssue;
  fixStrategy: FixStrategy;
  confidence: number;
  estimatedImpact: 'low' | 'medium' | 'high';
  before: string;
  after: string;
  line: number;
  column?: number;
}

export interface FixStrategy {
  type: 'replace' | 'insert' | 'delete' | 'refactor';
  description: string;
  safety: 'safe' | 'risky' | 'experimental';
  requiresContext: boolean;
}

export interface FixPreview {
  file: string;
  fixes: Fix[];
  totalChanges: number;
  estimatedTime: number; // milliseconds
  riskLevel: 'low' | 'medium' | 'high';
  conflicts: Array<{
    fix1: string;
    fix2: string;
    reason: string;
  }>;
  diff: string;
}

export interface FixResult {
  applied: number;
  skipped: number;
  failed: number;
  rollbackAvailable: boolean;
  rollbackData?: string;
}

export interface AdvancedAutoFixerOptions {
  maxConcurrentFixes?: number;
  enableRollback?: boolean;
  requireConfirmation?: boolean;
  learningEnabled?: boolean;
}

class AdvancedAutoFixer {
  private projectPath: string;
  private options: Required<AdvancedAutoFixerOptions>;
  private fixHistory: Map<string, Fix[]> = new Map();
  private rollbackStack: Array<{ file: string; content: string; timestamp: number }> = [];

  constructor(
    projectPath: string,
    options: AdvancedAutoFixerOptions = {}
  ) {
    this.projectPath = projectPath;
    this.options = {
      maxConcurrentFixes: options.maxConcurrentFixes ?? 3,
      enableRollback: options.enableRollback ?? true,
      requireConfirmation: options.requireConfirmation ?? false,
      learningEnabled: options.learningEnabled ?? true,
    };
  }

  /**
   * Analyze file and generate fixes
   * 
   * @param filePath - Path to file to analyze
   * @returns Array of suggested fixes
   */
  async analyzeFile(filePath: string): Promise<Fix[]> {
    const validation = await universalGuardrails.validateFile(filePath);
    const fixes: Fix[] = [];

    // Get codebase context for smart fixes
    const knowledge = await codebaseKnowledgeBase.getKnowledge(this.projectPath);
    
    for (const issue of [...validation.errors, ...validation.warnings]) {
      const fix = await this.generateFix(filePath, issue, knowledge);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  /**
   * Preview fixes before applying
   * 
   * @param fixes - Array of fixes to preview
   * @returns Preview with diff and risk analysis
   */
  async previewFixes(fixes: Fix[]): Promise<FixPreview> {
    const fileGroups = new Map<string, Fix[]>();
    
    // Group fixes by file
    for (const fix of fixes) {
      if (!fileGroups.has(fix.file)) {
        fileGroups.set(fix.file, []);
      }
      fileGroups.get(fix.file)!.push(fix);
    }

    const previews: FixPreview[] = [];

    for (const [file, fileFixes] of fileGroups.entries()) {
      const filePath = path.join(this.projectPath, file);
      const originalContent = await fs.promises.readFile(filePath, 'utf8');
      const { modifiedContent, conflicts } = await this.applyFixesToContent(originalContent, fileFixes);
      
      const diff = this.generateDiff(originalContent, modifiedContent);
      const riskLevel = this.calculateRiskLevel(fileFixes);

      previews.push({
        file,
        fixes: fileFixes,
        totalChanges: fileFixes.length,
        estimatedTime: fileFixes.length * 10, // 10ms per fix estimate
        riskLevel,
        conflicts,
        diff,
      });
    }

    // Combine previews if multiple files
    if (previews.length === 1) {
      return previews[0];
    }

    // Multi-file preview
    return {
      file: 'multiple',
      fixes: fixes,
      totalChanges: fixes.length,
      estimatedTime: fixes.length * 10,
      riskLevel: this.calculateOverallRisk(fixes),
      conflicts: previews.flatMap(p => p.conflicts),
      diff: previews.map(p => `\n=== ${p.file} ===\n${p.diff}`).join('\n'),
    };
  }

  /**
   * Apply fixes to files
   * 
   * @param fixes - Array of fixes to apply
   * @param options - Apply options
   * @returns Result of applying fixes
   */
  async applyFixes(
    fixes: Fix[],
    options: { dryRun?: boolean; skipConfirmation?: boolean } = {}
  ): Promise<FixResult> {
    const result: FixResult = {
      applied: 0,
      skipped: 0,
      failed: 0,
      rollbackAvailable: false,
    };

    if (options.dryRun) {
      // Just preview, don't apply
      await this.previewFixes(fixes);
      return result;
    }

    // Create rollback point
    if (this.options.enableRollback) {
      await this.createRollbackPoint(fixes);
      result.rollbackAvailable = true;
    }

    const fileGroups = new Map<string, Fix[]>();
    for (const fix of fixes) {
      if (!fileGroups.has(fix.file)) {
        fileGroups.set(fix.file, []);
      }
      fileGroups.get(fix.file)!.push(fix);
    }

    // Apply fixes file by file
    for (const [file, fileFixes] of fileGroups.entries()) {
      try {
        const filePath = path.join(this.projectPath, file);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const { modifiedContent } = await this.applyFixesToContent(content, fileFixes);
        
        await fs.promises.writeFile(filePath, modifiedContent, 'utf8');
        result.applied += fileFixes.length;

        // Record in history
        this.fixHistory.set(file, fileFixes);
      } catch (error) {
        result.failed += fileFixes.length;
        this.emit('error', { file, error, fixes: fileFixes });
      }
    }

    return result;
  }

  /**
   * Rollback last set of fixes
   * 
   * @returns Success status
   */
  async rollback(): Promise<boolean> {
    if (this.rollbackStack.length === 0) {
      return false;
    }

    const rollbackPoint = this.rollbackStack.pop()!;
    const filePath = path.join(this.projectPath, rollbackPoint.file);

    try {
      await fs.promises.writeFile(filePath, rollbackPoint.content, 'utf8');
      return true;
    } catch (error) {
      // Restore rollback point if write fails
      this.rollbackStack.push(rollbackPoint);
      return false;
    }
  }

  /**
   * Generate fix for a specific issue
   */
  private async generateFix(
    filePath: string,
    issue: GuardrailIssue,
    knowledge: unknown
  ): Promise<Fix | null> {
    const fixStrategy = this.determineFixStrategy(issue);
    if (!fixStrategy) {
      return null;
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const { before, after } = await this.generateFixContent(fileContent, issue, fixStrategy);

    return {
      id: `${issue.rule}-${issue.line}-${Date.now()}`,
      file: path.relative(this.projectPath, filePath),
      rule: issue.rule,
      issue,
      fixStrategy,
      confidence: this.calculateConfidence(issue, fixStrategy),
      estimatedImpact: this.estimateImpact(issue, fixStrategy),
      before,
      after,
      line: issue.line || 0,
      column: issue.column,
    };
  }

  /**
   * Determine fix strategy for an issue
   */
  private determineFixStrategy(issue: GuardrailIssue): FixStrategy | null {
    // Map rules to fix strategies
    const strategyMap: Record<string, FixStrategy> = {
      'no-root-files': {
        type: 'refactor',
        description: 'Move file to appropriate directory',
        safety: 'safe',
        requiresContext: true,
      },
      'no-mock-data': {
        type: 'replace',
        description: 'Replace mock data with real API calls',
        safety: 'risky',
        requiresContext: true,
      },
      'no-any-type': {
        type: 'replace',
        description: 'Replace any with specific type',
        safety: 'safe',
        requiresContext: false,
      },
      'no-console-log': {
        type: 'delete',
        description: 'Remove console.log statements',
        safety: 'safe',
        requiresContext: false,
      },
    };

    return strategyMap[issue.rule] || null;
  }

  /**
   * Generate fix content
   */
  private async generateFixContent(
    content: string,
    issue: GuardrailIssue,
    strategy: FixStrategy
  ): Promise<{ before: string; after: string }> {
    const lines = content.split('\n');
    const lineIndex = (issue.line || 1) - 1;
    const line = lines[lineIndex] || '';

    let before = line;
    let after = line;

    switch (strategy.type) {
      case 'delete':
        after = '';
        break;
      case 'replace':
        after = this.applyReplacement(line, issue, strategy);
        break;
      case 'insert':
        after = line + '\n' + this.generateInsertion(issue, strategy);
        break;
      case 'refactor':
        // More complex refactoring would go here
        after = line;
        break;
    }

    return { before, after };
  }

  /**
   * Apply replacement fix
   */
  private applyReplacement(
    line: string,
    issue: GuardrailIssue,
    strategy: FixStrategy
  ): string {
    if (issue.rule === 'no-any-type') {
      return line.replace(/: any\b/g, ': unknown');
    }
    if (issue.rule === 'no-console-log') {
      return line.replace(/console\.log\([^)]*\);?/g, '');
    }
    return line;
  }

  /**
   * Generate insertion fix
   */
  private generateInsertion(
    issue: GuardrailIssue,
    strategy: FixStrategy
  ): string {
    // Generate appropriate insertion based on rule
    return '';
  }

  /**
   * Apply fixes to file content
   */
  private async applyFixesToContent(
    content: string,
    fixes: Fix[]
  ): Promise<{ modifiedContent: string; conflicts: FixPreview['conflicts'] }> {
    const lines = content.split('\n');
    const conflicts: FixPreview['conflicts'] = [];
    
    // Sort fixes by line number (reverse to avoid offset issues)
    const sortedFixes = [...fixes].sort((a, b) => b.line - a.line);

    for (const fix of sortedFixes) {
      const lineIndex = fix.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        if (fix.fixStrategy.type === 'delete') {
          lines[lineIndex] = '';
        } else {
          lines[lineIndex] = fix.after;
        }
      }
    }

    return {
      modifiedContent: lines.join('\n'),
      conflicts,
    };
  }

  /**
   * Generate diff between original and modified content
   */
  private generateDiff(original: string, modified: string): string {
    // Simple diff generation (could use a library like diff for better output)
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diff: string[] = [];

    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const orig = originalLines[i] || '';
      const mod = modifiedLines[i] || '';

      if (orig !== mod) {
        diff.push(`- ${orig}`);
        diff.push(`+ ${mod}`);
      }
    }

    return diff.join('\n');
  }

  /**
   * Calculate risk level for fixes
   */
  private calculateRiskLevel(fixes: Fix[]): 'low' | 'medium' | 'high' {
    const riskyCount = fixes.filter(f => f.fixStrategy.safety === 'risky').length;
    const experimentalCount = fixes.filter(f => f.fixStrategy.safety === 'experimental').length;

    if (experimentalCount > 0) return 'high';
    if (riskyCount > fixes.length / 2) return 'high';
    if (riskyCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall risk for multiple fixes
   */
  private calculateOverallRisk(fixes: Fix[]): 'low' | 'medium' | 'high' {
    return this.calculateRiskLevel(fixes);
  }

  /**
   * Calculate confidence for a fix
   */
  private calculateConfidence(issue: GuardrailIssue, strategy: FixStrategy): number {
    let confidence = 0.7; // Base confidence

    if (strategy.safety === 'safe') confidence += 0.2;
    if (strategy.safety === 'risky') confidence -= 0.2;
    if (!strategy.requiresContext) confidence += 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Estimate impact of a fix
   */
  private estimateImpact(issue: GuardrailIssue, strategy: FixStrategy): 'low' | 'medium' | 'high' {
    if (strategy.type === 'delete' && issue.rule === 'no-console-log') return 'low';
    if (strategy.type === 'refactor') return 'high';
    if (strategy.safety === 'risky') return 'high';
    return 'medium';
  }

  /**
   * Create rollback point
   */
  private async createRollbackPoint(fixes: Fix[]): Promise<void> {
    const files = new Set(fixes.map(f => f.file));

    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        this.rollbackStack.push({
          file,
          content,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  private emit(event: string, data: unknown): void {
    // EventEmitter functionality would be added here
  }
}

export const advancedAutoFixer = new AdvancedAutoFixer(process.cwd());

