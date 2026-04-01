/**
 * Design System Validator
 * 
 * Validates components against the locked design system
 * Prevents AI from creating inconsistent designs
 */

import { designSystemBuilder } from './design-system-builder';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

class DesignValidator {
  /**
   * Validate a component file
   */
  validateComponent(filePath: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        issues: [{
          severity: 'error',
          file: filePath,
          message: 'File not found',
          suggestion: 'Check file path',
        }],
        score: 0,
      };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Check for hardcoded colors
    const colorPatterns = [
      /#[0-9A-Fa-f]{6}/g,
      /#[0-9A-Fa-f]{3}/g,
      /rgb\([^)]+\)/g,
      /rgba\([^)]+\)/g,
      /color:\s*['"](#[0-9A-Fa-f]{3,6}|rgb|rgba)/gi,
    ];

    lines.forEach((line, index) => {
      colorPatterns.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            issues.push({
              severity: 'error',
              file: filePath,
              line: index + 1,
              message: `Hardcoded color found: ${match}`,
              suggestion: 'Use design tokens: colors.primary, colors.secondary, etc.',
            });
          });
        }
      });
    });

    // Check for hardcoded spacing
    const spacingPatterns = [
      /(?:padding|margin|gap|top|right|bottom|left):\s*\d+px/gi,
      /(?:padding|margin|gap|top|right|bottom|left):\s*\d+rem/gi,
    ];

    lines.forEach((line, index) => {
      spacingPatterns.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            issues.push({
              severity: 'warning',
              file: filePath,
              line: index + 1,
              message: `Hardcoded spacing found: ${match}`,
              suggestion: 'Use design tokens: spacing.sm, spacing.md, spacing.lg, etc.',
            });
          });
        }
      });
    });

    // Check for hardcoded font sizes
    const fontSizePatterns = [
      /font-size:\s*\d+px/gi,
      /fontSize:\s*\d+/gi,
    ];

    lines.forEach((line, index) => {
      fontSizePatterns.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            issues.push({
              severity: 'warning',
              file: filePath,
              line: index + 1,
              message: `Hardcoded font size found: ${match}`,
              suggestion: 'Use design tokens: typography.fontSize.sm, typography.fontSize.base, etc.',
            });
          });
        }
      });
    });

    // Check if design tokens are imported
    const hasDesignTokensImport = content.includes('design-system/tokens') ||
                                  content.includes('designTokens') ||
                                  content.includes('colors.') ||
                                  content.includes('spacing.');

    if (!hasDesignTokensImport && issues.length === 0) {
      issues.push({
        severity: 'warning',
        file: filePath,
        message: 'Design tokens not imported. Consider using the design system.',
        suggestion: "Import: import { colors, spacing } from '@/design-system/tokens'",
      });
    }

    // Calculate score
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

    return {
      valid: errorCount === 0,
      issues,
      score,
    };
  }

  /**
   * Validate all components in a directory
   */
  validateDirectory(dirPath: string): ValidationResult {
    const allIssues: ValidationIssue[] = [];
    let totalScore = 0;
    let fileCount = 0;

    const files = this.findComponentFiles(dirPath);

    files.forEach((file) => {
      const result = this.validateComponent(file);
      allIssues.push(...result.issues);
      totalScore += result.score;
      fileCount++;
    });

    const avgScore = fileCount > 0 ? Math.round(totalScore / fileCount) : 0;

    return {
      valid: allIssues.filter((i) => i.severity === 'error').length === 0,
      issues: allIssues,
      score: avgScore,
    };
  }

  /**
   * Find all component files
   */
  private findComponentFiles(dirPath: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dirPath)) {
      return files;
    }

    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        files.push(...this.findComponentFiles(fullPath));
      } else if (
        item.name.endsWith('.tsx') ||
        item.name.endsWith('.jsx') ||
        item.name.endsWith('.ts') ||
        item.name.endsWith('.js')
      ) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Generate validation report
   */
  generateReport(result: ValidationResult): string {
    let report = `# Design System Validation Report\n\n`;
    report += `**Overall Score: ${result.score}/100**\n\n`;

    if (result.valid) {
      report += `✅ **All components are consistent with the design system!**\n\n`;
    } else {
      report += `❌ **Found ${result.issues.length} issue(s) that need attention**\n\n`;
    }

    if (result.issues.length > 0) {
      report += `## Issues Found\n\n`;

      const errors = result.issues.filter((i) => i.severity === 'error');
      const warnings = result.issues.filter((i) => i.severity === 'warning');

      if (errors.length > 0) {
        report += `### Errors (${errors.length})\n\n`;
        errors.forEach((issue, index) => {
          report += `${index + 1}. **${issue.file}${issue.line ? `:${issue.line}` : ''}**\n`;
          report += `   ${issue.message}\n`;
          report += `   💡 ${issue.suggestion}\n\n`;
        });
      }

      if (warnings.length > 0) {
        report += `### Warnings (${warnings.length})\n\n`;
        warnings.forEach((issue, index) => {
          report += `${index + 1}. **${issue.file}${issue.line ? `:${issue.line}` : ''}**\n`;
          report += `   ${issue.message}\n`;
          report += `   💡 ${issue.suggestion}\n\n`;
        });
      }
    }

    return report;
  }
}

export const designValidator = new DesignValidator();

