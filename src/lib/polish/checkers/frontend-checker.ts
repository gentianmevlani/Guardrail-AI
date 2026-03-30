/**
 * Frontend Polish Checker
 * 
 * Checks for frontend-specific polish issues
 */

import * as path from 'path';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findFile } from '../utils';

export class FrontendPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Frontend';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (!(await pathExists(srcPath))) {
      return issues;
    }

    // Check for error boundaries
    const hasErrorBoundary = await findFile(srcPath, /ErrorBoundary/i);
    if (!hasErrorBoundary) {
      issues.push({
        id: 'missing-error-boundary',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Error Boundary',
        description: 'No error boundary component found. React errors will crash the entire app.',
        suggestion: 'Add ErrorBoundary component to catch and handle React errors gracefully.',
        autoFixable: true,
      });
    }

    // Check for 404 page
    const has404 = await findFile(srcPath, /NotFound|404/i);
    if (!has404) {
      issues.push({
        id: 'missing-404',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing 404 Page',
        description: 'No custom 404/NotFound page found. Users will see default browser error.',
        suggestion: 'Add a custom 404 page with navigation options.',
        autoFixable: true,
      });
    }

    // Check for loading states
    const hasLoading = await findFile(srcPath, /Loading|Spinner/i);
    if (!hasLoading) {
      issues.push({
        id: 'missing-loading-states',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Loading States',
        description: 'No loading state components found. Users won\'t see feedback during async operations.',
        suggestion: 'Add LoadingState or Spinner components for async operations.',
        autoFixable: true,
      });
    }

    // Check for empty states
    const hasEmptyState = await findFile(srcPath, /EmptyState|Empty/i);
    if (!hasEmptyState) {
      issues.push({
        id: 'missing-empty-states',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing Empty States',
        description: 'No empty state components found. Users won\'t see helpful messages when data is empty.',
        suggestion: 'Add EmptyState components for lists and data displays.',
        autoFixable: true,
      });
    }

    return issues;
  }
}


