/**
 * Configuration Polish Checker
 */

import * as path from 'path';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists } from '../utils';

export class ConfigurationPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Configuration';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];

    // Check for .env.example
    const hasEnvExample = await pathExists(path.join(projectPath, '.env.example'));
    if (!hasEnvExample) {
      issues.push({
        id: 'missing-env-example',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing .env.example',
        description: 'No .env.example file. Developers don\'t know what environment variables are needed.',
        suggestion: 'Create .env.example with all required environment variables.',
        autoFixable: false,
      });
    }

    // Check for .gitignore
    const hasGitignore = await pathExists(path.join(projectPath, '.gitignore'));
    if (!hasGitignore) {
      issues.push({
        id: 'missing-gitignore',
        category: this.getCategory(),
        severity: 'critical',
        title: 'Missing .gitignore',
        description: 'No .gitignore file. Sensitive files may be committed.',
        suggestion: 'Create .gitignore with common patterns (node_modules, .env, etc.).',
        autoFixable: true,
      });
    }

    return issues;
  }
}


