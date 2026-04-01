/**
 * Configuration Polish Engine
 *
 * Checks: TypeScript strict, ESLint, Prettier, EditorConfig.
 */

import path from 'path';
import { pathExists, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function configurationEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];

  const tsConfig = await readFileSafe(path.join(projectPath, 'tsconfig.json'));
  if (tsConfig) {
    try {
      const parsed = JSON.parse(tsConfig);
      if (!parsed.compilerOptions?.strict) {
        issues.push({
          id: 'ts-not-strict',
          category: 'Configuration',
          severity: 'medium',
          title: 'TypeScript Strict Mode Disabled',
          description: 'TypeScript strict mode is not enabled. Type safety is reduced.',
          suggestion: 'Enable "strict": true in tsconfig.json for better type safety.',
          autoFixable: true,
        });
      }
    } catch {
      // Malformed tsconfig - skip
    }
  }

  const hasEslint =
    (await pathExists(path.join(projectPath, '.eslintrc.json'))) ||
    (await pathExists(path.join(projectPath, '.eslintrc.js'))) ||
    (await pathExists(path.join(projectPath, 'eslint.config.js')));
  if (!hasEslint) {
    issues.push({
      id: 'missing-eslint',
      category: 'Configuration',
      severity: 'medium',
      title: 'Missing ESLint Configuration',
      description: 'No ESLint config found. Code quality may not be enforced.',
      suggestion: 'Add ESLint configuration for code quality enforcement.',
      autoFixable: true,
    });
  }

  const hasPrettier =
    (await pathExists(path.join(projectPath, '.prettierrc'))) ||
    (await pathExists(path.join(projectPath, '.prettierrc.json'))) ||
    (await pathExists(path.join(projectPath, 'prettier.config.js')));
  if (!hasPrettier) {
    issues.push({
      id: 'missing-prettier',
      category: 'Configuration',
      severity: 'low',
      title: 'Missing Prettier Configuration',
      description: 'No Prettier config found. Code formatting may be inconsistent.',
      suggestion: 'Add Prettier configuration for consistent code formatting.',
      autoFixable: true,
    });
  }

  const hasEditorConfig = await pathExists(path.join(projectPath, '.editorconfig'));
  if (!hasEditorConfig) {
    issues.push({
      id: 'missing-editorconfig',
      category: 'Configuration',
      severity: 'low',
      title: 'Missing .editorconfig',
      description: 'No .editorconfig found. Different editors may format differently.',
      suggestion: 'Add .editorconfig for consistent editor settings across team.',
      autoFixable: true,
    });
  }

  return issues;
}
