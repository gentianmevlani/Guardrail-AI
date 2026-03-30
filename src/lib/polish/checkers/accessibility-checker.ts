/**
 * Accessibility Polish Checker
 */

import * as path from 'path';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findFile } from '../utils';

export class AccessibilityPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Accessibility';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (!(await pathExists(srcPath))) {
      return issues;
    }

    // Check for skip to content link
    const hasSkipLink = await findFile(srcPath, /skip.*content|skip.*main/i);
    if (!hasSkipLink) {
      issues.push({
        id: 'missing-skip-link',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing Skip to Content Link',
        description: 'No skip to content link. Keyboard users must tab through navigation.',
        suggestion: 'Add skip to main content link for keyboard navigation.',
        autoFixable: true,
      });
    }

    return issues;
  }
}


