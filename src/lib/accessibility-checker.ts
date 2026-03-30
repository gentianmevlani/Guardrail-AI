/**
 * Accessibility Checker
 * 
 * Validates WCAG compliance and accessibility best practices
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AccessibilityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
  wcag?: string; // WCAG guideline reference
  suggestion: string;
}

export interface AccessibilityReport {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: AccessibilityIssue[];
  score: number; // 0-100
}

class AccessibilityChecker {
  /**
   * Check project for accessibility issues
   */
  async checkProject(projectPath: string): Promise<AccessibilityReport> {
    const issues: AccessibilityIssue[] = [];
    const files = await this.findComponentFiles(projectPath);

    for (const file of files) {
      const fileIssues = await this.checkFile(file, projectPath);
      issues.push(...fileIssues);
    }

    const score = this.calculateScore(issues);

    return {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      issues,
      score,
    };
  }

  /**
   * Check a single file
   */
  private async checkFile(
    filePath: string,
    projectPath: string
  ): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const _lines = content.split('\n');
      const relativePath = path.relative(projectPath, filePath);

      // Check for missing alt text
      const altIssues = this.checkAltText(content, relativePath, _lines);
      issues.push(...altIssues);

      // Check for missing labels
      const labelIssues = this.checkLabels(content, relativePath, _lines);
      issues.push(...labelIssues);

      // Check for keyboard navigation
      const keyboardIssues = this.checkKeyboardNavigation(content, relativePath, _lines);
      issues.push(...keyboardIssues);

      // Check for color contrast
      const contrastIssues = this.checkColorContrast(content, relativePath, _lines);
      issues.push(...contrastIssues);

      // Check for ARIA attributes
      const ariaIssues = this.checkARIA(content, relativePath, _lines);
      issues.push(...ariaIssues);

      // Check for semantic HTML
      const semanticIssues = this.checkSemanticHTML(content, relativePath, _lines);
      issues.push(...semanticIssues);

    } catch {
      // Error reading file
    }

    return issues;
  }

  /**
   * Check for missing alt text on images
   */
  private checkAltText(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const imgRegex = /<img[^>]*>/gi;

    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const imgTag = match[0];
      const lineNum = content.substring(0, match.index).split('\n').length;

      // Check if alt attribute exists
      if (!imgTag.includes('alt=')) {
        issues.push({
          id: `missing-alt-${file}-${lineNum}`,
          severity: 'critical',
          title: 'Missing Alt Text',
          description: 'Image element lacks alt attribute',
          file,
          line: lineNum,
          wcag: 'WCAG 2.1 Level A - 1.1.1',
          suggestion: 'Add alt attribute to img element: <img src="..." alt="Description of image" />',
        });
      } else if (imgTag.includes('alt=""')) {
        issues.push({
          id: `empty-alt-${file}-${lineNum}`,
          severity: 'high',
          title: 'Empty Alt Text',
          description: 'Image has empty alt attribute. If image is decorative, use alt="" and role="presentation"',
          file,
          line: lineNum,
          wcag: 'WCAG 2.1 Level A - 1.1.1',
          suggestion: 'Add meaningful alt text or mark as decorative with role="presentation"',
        });
      }
    }

    return issues;
  }

  /**
   * Check for missing form labels
   */
  private checkLabels(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const inputRegex = /<(input|textarea|select)[^>]*>/gi;

    let match;
    while ((match = inputRegex.exec(content)) !== null) {
      const inputTag = match[0];
      const lineNum = content.substring(0, match.index).split('\n').length;

      // Check if input has id and corresponding label
      const idMatch = inputTag.match(/id=["']([^"']+)["']/);
      if (idMatch) {
        const id = idMatch[1];
        // Check if label exists with matching for attribute
        const labelRegex = new RegExp(`<label[^>]*for=["']${id}["']`, 'i');
        if (!labelRegex.test(content)) {
          issues.push({
            id: `missing-label-${file}-${lineNum}`,
            severity: 'high',
            title: 'Missing Form Label',
            description: `Input element with id="${id}" lacks associated label`,
            file,
            line: lineNum,
            wcag: 'WCAG 2.1 Level A - 1.3.1',
            suggestion: `Add label element: <label htmlFor="${id}">Label text</label>`,
          });
        }
      } else {
        // No id, check for aria-label
        if (!inputTag.includes('aria-label') && !inputTag.includes('aria-labelledby')) {
          issues.push({
            id: `missing-label-aria-${file}-${lineNum}`,
            severity: 'high',
            title: 'Missing Form Label or ARIA Label',
            description: 'Input element lacks id with label or aria-label',
            file,
            line: lineNum,
            wcag: 'WCAG 2.1 Level A - 1.3.1',
            suggestion: 'Add id and label, or use aria-label attribute',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for keyboard navigation
   */
  private checkKeyboardNavigation(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const interactiveRegex = /<(button|a|input|select|textarea)[^>]*>/gi;

    let match;
    while ((match = interactiveRegex.exec(content)) !== null) {
      const tag = match[0];
      const lineNum = content.substring(0, match.index).split('\n').length;

      // Check for disabled interactive elements without proper indication
      if (tag.includes('disabled') && !tag.includes('aria-disabled')) {
        issues.push({
          id: `keyboard-disabled-${file}-${lineNum}`,
          severity: 'medium',
          title: 'Disabled Element Accessibility',
          description: 'Disabled interactive element should use aria-disabled for better accessibility',
          file,
          line: lineNum,
          wcag: 'WCAG 2.1 Level A - 2.1.1',
          suggestion: 'Use aria-disabled instead of disabled, or provide alternative interaction method',
        });
      }

      // Check for click handlers without keyboard handlers
      if (tag.includes('onClick') && !tag.includes('onKeyDown') && !tag.includes('onKeyPress')) {
        const elementType = tag.match(/<(\w+)/)?.[1];
        if (elementType && !['button', 'a', 'input'].includes(elementType)) {
          issues.push({
            id: `keyboard-handler-${file}-${lineNum}`,
            severity: 'high',
            title: 'Missing Keyboard Handler',
            description: 'Element with onClick lacks keyboard event handler',
            file,
            line: lineNum,
            wcag: 'WCAG 2.1 Level A - 2.1.1',
            suggestion: 'Add onKeyDown handler or use semantic button/link element',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for color contrast (simplified)
   */
  private checkColorContrast(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for inline styles with color
    const colorRegex = /(?:color|background(?:-color)?)\s*:\s*([^;]+)/gi;
    let match;
    while ((match = colorRegex.exec(content)) !== null) {
      // Simplified check - in production, calculate actual contrast ratio
      const colorValue = match[1]?.trim() || '';
      if (colorValue === '#fff' || colorValue === '#ffffff' || colorValue === 'white') {
        issues.push({
          id: `contrast-${file}-${match.index}`,
          severity: 'low',
          title: 'Potential Color Contrast Issue',
          description: 'White text may not have sufficient contrast on all backgrounds',
          file,
          wcag: 'WCAG 2.1 Level AA - 1.4.3',
          suggestion: 'Ensure text has contrast ratio of at least 4.5:1 for normal text, 3:1 for large text',
        });
      }
    }

    return issues;
  }

  /**
   * Check for ARIA attributes
   */
  private checkARIA(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for custom interactive elements without ARIA
    const customButtonRegex = /<div[^>]*onClick[^>]*>/gi;
    let match;
    while ((match = customButtonRegex.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('role=') && !tag.includes('aria-')) {
        issues.push({
          id: `aria-missing-${file}-${match.index}`,
          severity: 'high',
          title: 'Missing ARIA Role',
          description: 'Custom interactive element (div with onClick) lacks ARIA role',
          file,
          wcag: 'WCAG 2.1 Level A - 4.1.2',
          suggestion: 'Add role="button" and appropriate ARIA attributes, or use semantic button element',
        });
      }
    }

    return issues;
  }

  /**
   * Check for semantic HTML
   */
  private checkSemanticHTML(
    content: string,
    file: string,
    _lines: string[]
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for div used instead of semantic elements
    const divRegex = /<div[^>]*>/gi;
    let match;
    while ((match = divRegex.exec(content)) !== null) {
      // This is a simplified check - in production, use AST parsing
      // Check if div could be replaced with semantic element
      const context = content.substring(Math.max(0, match.index - 50), match.index + 100);
      if (context.includes('navigation') || context.includes('nav')) {
        issues.push({
          id: `semantic-nav-${file}-${match.index}`,
          severity: 'medium',
          title: 'Use Semantic Navigation',
          description: 'Navigation should use <nav> element instead of <div>',
          file,
          wcag: 'WCAG 2.1 Level A - 1.3.1',
          suggestion: 'Replace div with nav element for navigation',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate accessibility score
   */
  private calculateScore(issues: AccessibilityIssue[]): number {
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
    return Math.max(0, score);
  }

  private async findComponentFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findComponentFiles(fullPath));
        } else if (item.isFile() && /\.(tsx|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }
}

export const accessibilityChecker = new AccessibilityChecker();

