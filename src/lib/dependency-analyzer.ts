/**
 * Dependency Analyzer
 * 
 * Analyzes dependencies for outdated versions, vulnerabilities, and unused packages
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface DependencyIssue {
  package: string;
  currentVersion: string;
  latestVersion?: string;
  type: 'outdated' | 'vulnerable' | 'unused' | 'duplicate';
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

export interface DependencyReport {
  totalDependencies: number;
  outdated: number;
  vulnerable: number;
  unused: number;
  duplicate: number;
  issues: DependencyIssue[];
  score: number; // 0-100
}

class DependencyAnalyzer {
  /**
   * Analyze project dependencies
   */
  async analyze(projectPath: string): Promise<DependencyReport> {
    const issues: DependencyIssue[] = [];

    // Check package.json
    const packageJson = path.join(projectPath, 'package.json');
    if (!await this.pathExists(packageJson)) {
      throw new Error('package.json not found');
    }

    const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    // Check for outdated packages
    const outdatedIssues = await this.checkOutdated(projectPath, allDeps);
    issues.push(...outdatedIssues);

    // Check for vulnerable packages
    const vulnerableIssues = await this.checkVulnerable(projectPath, allDeps);
    issues.push(...vulnerableIssues);

    // Check for unused packages
    const unusedIssues = await this.checkUnused(projectPath, allDeps);
    issues.push(...unusedIssues);

    // Check for duplicate packages
    const duplicateIssues = this.checkDuplicates(pkg);
    issues.push(...duplicateIssues);

    // Calculate score
    const score = this.calculateScore(issues, Object.keys(allDeps).length);

    return {
      totalDependencies: Object.keys(allDeps).length,
      outdated: outdatedIssues.length,
      vulnerable: vulnerableIssues.length,
      unused: unusedIssues.length,
      duplicate: duplicateIssues.length,
      issues,
      score,
    };
  }

  /**
   * Check for outdated packages
   */
  private async checkOutdated(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = [];

    try {
      // Run npm outdated (non-blocking, simplified)
      // In production, use npm-check-updates or similar
      for (const [pkg, version] of Object.entries(deps)) {
        // Simplified check - in production, query npm registry
        if (version.includes('^') || version.includes('~')) {
          issues.push({
            package: pkg,
            currentVersion: version,
            type: 'outdated',
            severity: 'low',
            description: `Package ${pkg} may have newer versions available`,
            suggestion: `Run 'npm outdated' to check for updates, then 'npm update ${pkg}'`,
          });
        }
      }
    } catch {
      // npm not available or error
    }

    return issues;
  }

  /**
   * Check for vulnerable packages
   */
  private async checkVulnerable(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = [];

    try {
      // In production, use npm audit or Snyk
      // This is a simplified version
      const knownVulnerable = [
        'lodash', // Check version
        'express', // Check version
      ];

      for (const pkg of Object.keys(deps)) {
        if (knownVulnerable.includes(pkg)) {
          issues.push({
            package: pkg,
            currentVersion: deps[pkg],
            type: 'vulnerable',
            severity: 'high',
            description: `Package ${pkg} may have known vulnerabilities`,
            suggestion: `Run 'npm audit' to check for vulnerabilities and update if needed`,
          });
        }
      }
    } catch {
      // Error checking vulnerabilities
    }

    return issues;
  }

  /**
   * Check for unused packages
   */
  private async checkUnused(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = [];

    try {
      // Find all code files
      const files = await this.findCodeFiles(projectPath);
      const imports = new Set<string>();

      // Extract all imports
      for (const file of files) {
        const content = await fs.promises.readFile(file, 'utf8');
        const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
          const importPath = match[1];
          // Extract package name (first part before /)
          const pkgName = importPath.split('/')[0];
          if (pkgName && !pkgName.startsWith('.')) {
            imports.add(pkgName);
          }
        }
      }

      // Check for unused packages
      for (const pkg of Object.keys(deps)) {
        // Check if package is imported (simplified - doesn't handle scoped packages)
        const isUsed = imports.has(pkg) || 
                      imports.has(`@${pkg.split('/')[0]}`) ||
                      this.isPackageUsed(pkg, projectPath);

        if (!isUsed) {
          issues.push({
            package: pkg,
            currentVersion: deps[pkg],
            type: 'unused',
            severity: 'low',
            description: `Package ${pkg} is installed but not imported anywhere`,
            suggestion: `Remove unused package: 'npm uninstall ${pkg}'`,
          });
        }
      }
    } catch {
      // Error checking unused packages
    }

    return issues;
  }

  /**
   * Check for duplicate packages
   */
  private checkDuplicates(pkg: Record<string, unknown>): DependencyIssue[] {
    const issues: DependencyIssue[] = [];
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    // Check for packages in both dependencies and devDependencies
    for (const dep of Object.keys(pkg.dependencies || {})) {
      if (pkg.devDependencies && pkg.devDependencies[dep]) {
        issues.push({
          package: dep,
          currentVersion: pkg.dependencies[dep],
          type: 'duplicate',
          severity: 'medium',
          description: `Package ${dep} is listed in both dependencies and devDependencies`,
          suggestion: `Move ${dep} to only one section (dependencies or devDependencies)`,
        });
      }
    }

    return issues;
  }

  /**
   * Check if package is used (simplified)
   */
  private isPackageUsed(pkg: string, projectPath: string): boolean {
    // Check for package in package.json scripts, config files, etc.
    // This is a simplified check
    return false;
  }

  /**
   * Calculate dependency health score
   */
  private calculateScore(issues: DependencyIssue[], totalDeps: number): number {
    if (totalDeps === 0) return 100;

    let score = 100;
    for (const issue of issues) {
      switch (issue.type) {
        case 'vulnerable':
          score -= 10;
          break;
        case 'outdated':
          score -= 2;
          break;
        case 'unused':
          score -= 1;
          break;
        case 'duplicate':
          score -= 3;
          break;
      }
    }

    return Math.max(0, score);
  }

  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
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

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const dependencyAnalyzer = new DependencyAnalyzer();

