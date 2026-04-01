/**
 * Security Polish Checker
 * 
 * Checks for security-related polish issues
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findAllFiles, readFileSafe } from '../utils';

export class SecurityPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Security';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];

    // Check for .env.example
    const envExample = path.join(projectPath, '.env.example');
    if (!(await pathExists(envExample))) {
      issues.push({
        id: 'missing-env-example',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing .env.example',
        description: 'No .env.example file found. Developers won\'t know what environment variables are needed.',
        suggestion: 'Create .env.example with all required environment variables (without values).',
        autoFixable: false,
      });
    }

    // Check for hardcoded secrets
    const codeFiles = await findAllFiles(
      path.join(projectPath, 'src'),
      /\.(ts|tsx|js|jsx)$/
    );

    const secretPattern = /(api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]{10,}['"]/i;
    for (const file of codeFiles.slice(0, 50)) { // Limit to first 50 files
      const content = await readFileSafe(file);
      if (content && secretPattern.test(content)) {
        issues.push({
          id: 'hardcoded-secret',
          category: this.getCategory(),
          severity: 'critical',
          title: 'Hardcoded Secret Found',
          description: `Potential hardcoded secret found in ${path.relative(projectPath, file)}`,
          file: path.relative(projectPath, file),
          suggestion: 'Move secrets to environment variables. Never commit secrets to version control.',
          autoFixable: false,
        });
      }
    }

    // Check for .gitignore including .env
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (await pathExists(gitignorePath)) {
      const gitignore = await readFileSafe(gitignorePath);
      if (gitignore && !/\.env/.test(gitignore)) {
        issues.push({
          id: 'env-not-in-gitignore',
          category: this.getCategory(),
          severity: 'critical',
          title: '.env Not in .gitignore',
          description: '.env file is not ignored. Secrets may be committed to version control.',
          suggestion: 'Add .env to .gitignore to prevent committing secrets.',
          autoFixable: true,
        });
      }
    }

    return issues;
  }
}


