/**
 * Documentation Polish Engine
 *
 * Checks: README, CHANGELOG, CONTRIBUTING, LICENSE.
 */

import path from 'path';
import { pathExists, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function documentationEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];

  const hasReadme = await pathExists(path.join(projectPath, 'README.md'));
  if (!hasReadme) {
    issues.push({
      id: 'missing-readme',
      category: 'Documentation',
      severity: 'high',
      title: 'Missing README',
      description: "No README.md found. New developers won't know how to start.",
      suggestion: 'Add README.md with project overview, setup, and usage instructions.',
      autoFixable: true,
    });
  } else {
    const readme = await readFileSafe(path.join(projectPath, 'README.md'));
    if (readme && readme.length < 500) {
      issues.push({
        id: 'insufficient-readme',
        category: 'Documentation',
        severity: 'medium',
        title: 'Insufficient README',
        description: 'README is very short. May be missing important sections.',
        suggestion: 'Expand README with installation, usage, API docs, and contributing guide.',
        autoFixable: false,
      });
    }
  }

  if (!(await pathExists(path.join(projectPath, 'CHANGELOG.md')))) {
    issues.push({
      id: 'missing-changelog',
      category: 'Documentation',
      severity: 'low',
      title: 'Missing CHANGELOG',
      description: 'No CHANGELOG.md found. Version history is not documented.',
      suggestion: 'Add CHANGELOG.md to track version history and changes.',
      autoFixable: true,
    });
  }

  if (!(await pathExists(path.join(projectPath, 'CONTRIBUTING.md')))) {
    issues.push({
      id: 'missing-contributing',
      category: 'Documentation',
      severity: 'low',
      title: 'Missing CONTRIBUTING Guide',
      description: "No CONTRIBUTING.md found. Contributors won't know the process.",
      suggestion: 'Add CONTRIBUTING.md with contribution guidelines.',
      autoFixable: true,
    });
  }

  const hasLicense =
    (await pathExists(path.join(projectPath, 'LICENSE'))) ||
    (await pathExists(path.join(projectPath, 'LICENSE.md')));
  if (!hasLicense) {
    issues.push({
      id: 'missing-license',
      category: 'Documentation',
      severity: 'medium',
      title: 'Missing LICENSE',
      description: 'No LICENSE file found. Legal usage of code is unclear.',
      suggestion: 'Add a LICENSE file to clarify code usage rights.',
      autoFixable: false,
    });
  }

  return issues;
}
