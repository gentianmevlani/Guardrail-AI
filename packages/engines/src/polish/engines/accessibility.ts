/**
 * Accessibility Polish Engine
 *
 * Checks: A11y testing, skip links, focus management.
 */

import path from 'path';
import { pathExists, findFile, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function accessibilityEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));

  const hasA11yTesting =
    packageJson && /axe-core|@axe-core|jest-axe|cypress-axe|pa11y/i.test(packageJson);
  if (!hasA11yTesting) {
    issues.push({
      id: 'missing-a11y-testing',
      category: 'Accessibility',
      severity: 'medium',
      title: 'No Accessibility Testing',
      description: 'No accessibility testing library found.',
      suggestion: 'Add jest-axe, cypress-axe, or pa11y for automated a11y testing.',
      autoFixable: false,
    });
  }

  const hasSkipLink = await findFile(projectPath, /skip-link|skiplink|SkipNav/i);
  if (!hasSkipLink) {
    issues.push({
      id: 'missing-skip-link',
      category: 'Accessibility',
      severity: 'medium',
      title: 'Missing Skip Link',
      description: "No skip-to-content link found. Keyboard users can't skip navigation.",
      suggestion: 'Add a skip-to-main-content link at the top of your pages.',
      autoFixable: true,
    });
  }

  const globalCss =
    (await readFileSafe(path.join(projectPath, 'src', 'styles', 'globals.css'))) ||
    (await readFileSafe(path.join(projectPath, 'app', 'globals.css'))) ||
    (await readFileSafe(path.join(projectPath, 'styles', 'globals.css')));

  if (
    globalCss &&
    /outline:\s*none|outline:\s*0/i.test(globalCss) &&
    !/focus-visible/i.test(globalCss)
  ) {
    issues.push({
      id: 'focus-removed',
      category: 'Accessibility',
      severity: 'high',
      title: 'Focus Outline Removed',
      description:
        "Focus outlines are removed without alternative. Keyboard users can't see focus.",
      suggestion: 'Use :focus-visible instead of removing outlines entirely.',
      autoFixable: false,
    });
  }

  return issues;
}
