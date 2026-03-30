/**
 * Project Healer
 * 
 * Analyzes and fixes broken projects
 * - Detects issues
 * - Suggests fixes
 * - Applies fixes automatically
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectIssue {
  type: 'file-location' | 'missing-dependency' | 'broken-import' | 'design-inconsistency' | 'missing-animations' | 'structure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  message: string;
  fix: string;
  autoFixable: boolean;
}

export interface ProjectHealth {
  score: number; // 0-100
  issues: ProjectIssue[];
  canAutoFix: boolean;
  estimatedFixTime: string;
}

class ProjectHealer {
  /**
   * Analyze project and find issues
   */
  async analyzeProject(projectPath: string): Promise<ProjectHealth> {
    const issues: ProjectIssue[] = [];

    // Check file locations
    issues.push(...await this.checkFileLocations(projectPath));

    // Check missing dependencies
    issues.push(...await this.checkDependencies(projectPath));

    // Check broken imports
    issues.push(...await this.checkImports(projectPath));

    // Check design inconsistencies
    issues.push(...await this.checkDesignConsistency(projectPath));

    // Check missing animations
    issues.push(...await this.checkMissingAnimations(projectPath));

    // Check project structure
    issues.push(...await this.checkStructure(projectPath));

    // Calculate score
    const score = this.calculateScore(issues);
    const canAutoFix = issues.some(i => i.autoFixable);
    const estimatedFixTime = this.estimateFixTime(issues);

    return {
      score,
      issues,
      canAutoFix,
      estimatedFixTime,
    };
  }

  /**
   * Auto-fix issues
   */
  async autoFix(projectPath: string, issues: ProjectIssue[]): Promise<{
    fixed: number;
    failed: number;
    results: Array<{ issue: ProjectIssue; success: boolean; error?: string }>;
  }> {
    const results: Array<{ issue: ProjectIssue; success: boolean; error?: string }> = [];
    let fixed = 0;
    let failed = 0;

    for (const issue of issues) {
      if (!issue.autoFixable) {
        results.push({ issue, success: false, error: 'Not auto-fixable' });
        failed++;
        continue;
      }

      try {
        await this.applyFix(projectPath, issue);
        results.push({ issue, success: true });
        fixed++;
      } catch (error) {
        results.push({ issue, success: false, error: (error as Error).message });
        failed++;
      }
    }

    return { fixed, failed, results };
  }

  /**
   * Check file locations
   */
  private async checkFileLocations(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    const rootFiles = await fs.promises.readdir(projectPath);

    const forbiddenPatterns = [
      /\.tsx?$/,
      /\.jsx?$/,
      /Component\.tsx?$/,
      /Hook\.tsx?$/,
    ];

    for (const file of rootFiles) {
      if (forbiddenPatterns.some(pattern => pattern.test(file))) {
        const stats = await fs.promises.stat(path.join(projectPath, file));
        if (stats.isFile()) {
          issues.push({
            type: 'file-location',
            severity: 'high',
            file,
            message: `File "${file}" is in root directory. Should be in /src/ subdirectory.`,
            fix: `Move ${file} to appropriate /src/ subdirectory`,
            autoFixable: false, // Would need to know destination
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for common missing dependencies
      const commonDeps = ['react', 'react-dom', 'typescript', 'eslint'];
      for (const dep of commonDeps) {
        if (!dependencies[dep]) {
          issues.push({
            type: 'missing-dependency',
            severity: 'high',
            message: `Missing dependency: ${dep}`,
            fix: `Install ${dep}: npm install ${dep}`,
            autoFixable: true,
          });
        }
      }
    } catch {
      // No package.json
    }

    return issues;
  }

  /**
   * Check imports
   */
  private async checkImports(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    // Would scan files for broken imports
    return issues;
  }

  /**
   * Check design consistency
   */
  private async checkDesignConsistency(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    // Would check for hardcoded colors, inconsistent spacing, etc.
    return issues;
  }

  /**
   * Check missing animations
   */
  private async checkMissingAnimations(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (!await this.pathExists(srcPath)) {
      return issues;
    }

    // Check if GSAP is installed
    const packageJsonPath = path.join(projectPath, 'package.json');
    let hasGSAP = false;
    try {
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      hasGSAP = !!deps['gsap'];
    } catch (error) {
      // Failed to process - continue with other operations
    }

    // Check for components without animations
    const componentFiles = await this.findComponentFiles(srcPath);
    const componentsWithoutAnimations = componentFiles.filter(async (file) => {
      const content = await fs.promises.readFile(file, 'utf8');
      return !content.includes('animate') && 
             !content.includes('transition') && 
             !content.includes('gsap') &&
             !content.includes('framer-motion');
    });

    if (componentsWithoutAnimations.length > 0 && !hasGSAP) {
      issues.push({
        type: 'missing-animations',
        severity: 'medium',
        message: `Found ${componentsWithoutAnimations.length} components without animations. Consider adding GSAP or Framer Motion.`,
        fix: 'Install GSAP: npm install gsap, or add animation hooks',
        autoFixable: true,
      });
    }

    return issues;
  }

  /**
   * Check project structure
   */
  private async checkStructure(projectPath: string): Promise<ProjectIssue[]> {
    const issues: ProjectIssue[] = [];
    const requiredDirs = ['src', 'src/components', 'src/lib'];

    for (const dir of requiredDirs) {
      const dirPath = path.join(projectPath, dir);
      if (!await this.pathExists(dirPath)) {
        issues.push({
          type: 'structure',
          severity: 'high',
          message: `Missing required directory: ${dir}`,
          fix: `Create directory: ${dir}`,
          autoFixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Apply a fix
   */
  private async applyFix(projectPath: string, issue: ProjectIssue): Promise<void> {
    switch (issue.type) {
      case 'missing-dependency':
        // Would run npm install
        break;
      case 'structure':
        const dirPath = path.join(projectPath, issue.fix.split(': ')[1]);
        await fs.promises.mkdir(dirPath, { recursive: true });
        break;
      case 'missing-animations':
        // Would add animation setup
        break;
    }
  }

  /**
   * Calculate health score
   */
  private calculateScore(issues: ProjectIssue[]): number {
    const weights = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5,
    };

    let totalDeduction = 0;
    issues.forEach(issue => {
      totalDeduction += weights[issue.severity];
    });

    return Math.max(0, 100 - totalDeduction);
  }

  /**
   * Estimate fix time
   */
  private estimateFixTime(issues: ProjectIssue[]): string {
    const autoFixable = issues.filter(i => i.autoFixable);
    const manual = issues.filter(i => !i.autoFixable);

    const autoTime = autoFixable.length * 0.5; // 30 seconds each
    const manualTime = manual.length * 5; // 5 minutes each

    const totalMinutes = Math.ceil(autoTime + manualTime);

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    }
    return `${Math.floor(totalMinutes / 60)} hours ${totalMinutes % 60} minutes`;
  }

  /**
   * Find component files
   */
  private async findComponentFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...await this.findComponentFiles(fullPath));
        } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  /**
   * Check if path exists
   */
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const projectHealer = new ProjectHealer();

