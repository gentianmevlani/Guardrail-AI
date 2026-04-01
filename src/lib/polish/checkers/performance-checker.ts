/**
 * Performance Polish Checker
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findFile } from '../utils';

export class PerformancePolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Performance';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];

    // Check for image optimization
    const hasImageOptimization = await findFile(projectPath, /image.*optim|sharp|imagemin/i);
    if (!hasImageOptimization && await this.isWebProject(projectPath)) {
      issues.push({
        id: 'missing-image-optimization',
        category: this.getCategory(),
        severity: 'medium',
        title: 'Missing Image Optimization',
        description: 'No image optimization found. Large images slow down page loads.',
        suggestion: 'Add image optimization (Sharp, ImageMin, or Next.js Image component).',
        autoFixable: false,
      });
    }

    // Check for bundle analysis
    const packageJson = path.join(projectPath, 'package.json');
    if (await pathExists(packageJson)) {
      const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
      const scripts = pkg.scripts || {};
      
      if (!scripts['analyze'] && !scripts['bundle-analyze']) {
        issues.push({
          id: 'missing-bundle-analysis',
          category: this.getCategory(),
          severity: 'low',
          title: 'Missing Bundle Analysis',
          description: 'No bundle analysis script. Can\'t identify large dependencies.',
          suggestion: 'Add bundle analysis script (webpack-bundle-analyzer, etc.).',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  private async isWebProject(projectPath: string): Promise<boolean> {
    const packageJson = path.join(projectPath, 'package.json');
    if (!(await pathExists(packageJson))) return false;
    
    try {
      const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!(deps['react'] || deps['next'] || deps['vue'] || deps['angular']);
    } catch {
      return false;
    }
  }
}


