/**
 * Documentation Polish Checker
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, readFileSafe } from '../utils';

export class DocumentationPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Documentation';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];

    // Check for README
    const readmePath = path.join(projectPath, 'README.md');
    const hasReadme = await pathExists(readmePath);
    
    if (!hasReadme) {
      issues.push({
        id: 'missing-readme',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing README.md',
        description: 'No README file. Users don\'t know how to set up or use the project.',
        suggestion: 'Create README.md with setup instructions, usage, and examples.',
        autoFixable: false,
      });
    } else {
      const readme = await readFileSafe(readmePath);
      if (readme) {
        if (!readme.includes('## Installation') && !readme.includes('## Setup')) {
          issues.push({
            id: 'readme-missing-installation',
            category: this.getCategory(),
            severity: 'medium',
            title: 'README Missing Installation Instructions',
            description: 'README doesn\'t include installation/setup instructions.',
            suggestion: 'Add installation and setup instructions to README.',
            autoFixable: false,
          });
        }

        if (!readme.includes('## Usage') && !readme.includes('## Getting Started')) {
          issues.push({
            id: 'readme-missing-usage',
            category: this.getCategory(),
            severity: 'medium',
            title: 'README Missing Usage Instructions',
            description: 'README doesn\'t include usage examples.',
            suggestion: 'Add usage examples and getting started guide.',
            autoFixable: false,
          });
        }
      }
    }

    // Check for CHANGELOG
    const hasChangelog = await pathExists(path.join(projectPath, 'CHANGELOG.md'));
    if (!hasChangelog) {
      issues.push({
        id: 'missing-changelog',
        category: this.getCategory(),
        severity: 'low',
        title: 'Missing CHANGELOG.md',
        description: 'No changelog file. Users don\'t know what changed between versions.',
        suggestion: 'Create CHANGELOG.md following Keep a Changelog format.',
        autoFixable: false,
      });
    }

    return issues;
  }
}


