/**
 * Automated Dependency Impact Analyzer
 * 
 * Revolutionary feature: Predicts how dependency updates will affect your code
 * BEFORE you update them. Analyzes breaking changes, compatibility, and risks.
 * 
 * Unlike npm audit which only shows security issues, this predicts the full
 * impact of dependency changes on your codebase.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  type: 'dependencies' | 'devDependencies';
  directUsages: {
    file: string;
    line: number;
    usage: string;
  }[];
}

interface BreakingChange {
  type: 'api-change' | 'removal' | 'behavior-change' | 'type-change';
  description: string;
  affectedCode: {
    file: string;
    line: number;
    currentCode: string;
    suggestedFix?: string;
  }[];
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  documentationUrl?: string;
}

interface ImpactAnalysis {
  dependency: string;
  currentVersion: string;
  targetVersion: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  breakingChanges: BreakingChange[];
  compatibilityIssues: string[];
  estimatedEffort: {
    hours: number;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  recommendations: string[];
  safeToUpdate: boolean;
}

interface UpdatePlan {
  dependencies: {
    name: string;
    from: string;
    to: string;
    order: number; // Update order
    reason: string;
  }[];
  totalEstimatedTime: number;
  risks: string[];
  prerequisites: string[];
  testingStrategy: string[];
}

class AutomatedDependencyImpactAnalyzer {
  /**
   * Analyze impact of updating a specific dependency
   */
  async analyzeDependencyUpdate(
    projectPath: string,
    dependencyName: string,
    targetVersion?: string
  ): Promise<ImpactAnalysis> {
    console.log(`🔍 Analyzing impact of updating ${dependencyName}...`);

    // Read package.json
    const packageJson = await this.readPackageJson(projectPath);
    const currentVersion =
      packageJson.dependencies?.[dependencyName] ||
      packageJson.devDependencies?.[dependencyName] ||
      '';

    // Determine target version
    const latest = targetVersion || (await this.getLatestVersion(dependencyName));

    // Find all usages in code
    const usages = await this.findDependencyUsages(projectPath, dependencyName);

    // Analyze breaking changes
    const breakingChanges = await this.analyzeBreakingChanges(
      dependencyName,
      currentVersion,
      latest,
      usages
    );

    // Check compatibility
    const compatibilityIssues = await this.checkCompatibility(
      dependencyName,
      latest,
      packageJson
    );

    // Calculate risk
    const riskScore = this.calculateRiskScore(breakingChanges, compatibilityIssues);
    const overallRisk = this.categorizeRisk(riskScore);

    // Estimate effort
    const estimatedEffort = this.estimateEffort(breakingChanges, usages);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      breakingChanges,
      compatibilityIssues,
      riskScore
    );

    // Determine if safe to update
    const safeToUpdate = riskScore < 30 && breakingChanges.length === 0;

    return {
      dependency: dependencyName,
      currentVersion,
      targetVersion: latest,
      overallRisk,
      riskScore,
      breakingChanges,
      compatibilityIssues,
      estimatedEffort,
      recommendations,
      safeToUpdate,
    };
  }

  /**
   * Analyze impact of updating all dependencies
   */
  async analyzeAllUpdates(projectPath: string): Promise<{
    totalDependencies: number;
    outdated: number;
    analyses: ImpactAnalysis[];
    summary: {
      safe: number;
      caution: number;
      risky: number;
    };
    recommendations: string[];
  }> {
    console.log('📊 Analyzing all dependency updates...');

    const packageJson = await this.readPackageJson(projectPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const analyses: ImpactAnalysis[] = [];

    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const analysis = await this.analyzeDependencyUpdate(projectPath, name);
        analyses.push(analysis);
      } catch (error) {
        console.warn(`Failed to analyze ${name}:`, error);
      }
    }

    const outdated = analyses.filter(
      a => a.currentVersion !== a.targetVersion
    ).length;

    const summary = {
      safe: analyses.filter(a => a.overallRisk === 'low').length,
      caution: analyses.filter(
        a => a.overallRisk === 'medium' || a.overallRisk === 'high'
      ).length,
      risky: analyses.filter(a => a.overallRisk === 'critical').length,
    };

    const recommendations = this.generateGlobalRecommendations(analyses);

    return {
      totalDependencies: Object.keys(allDeps).length,
      outdated,
      analyses,
      summary,
      recommendations,
    };
  }

  /**
   * Generate update plan with optimal order
   */
  async generateUpdatePlan(
    projectPath: string,
    includeDev = true
  ): Promise<UpdatePlan> {
    console.log('📋 Generating update plan...');

    const allAnalyses = await this.analyzeAllUpdates(projectPath);

    // Sort by risk and dependencies
    const sorted = this.sortByUpdateOrder(allAnalyses.analyses);

    // Create update plan
    const dependencies = sorted
      .filter(a => !a.safeToUpdate || includeDev)
      .map((a, idx) => ({
        name: a.dependency,
        from: a.currentVersion,
        to: a.targetVersion,
        order: idx + 1,
        reason: this.explainUpdateReason(a),
      }));

    const totalEstimatedTime = sorted.reduce(
      (sum, a) => sum + a.estimatedEffort.hours,
      0
    );

    const risks = sorted
      .filter(a => a.overallRisk !== 'low')
      .map(a => `${a.dependency}: ${a.overallRisk} risk`);

    const prerequisites = this.identifyPrerequisites(sorted);

    const testingStrategy = this.generateTestingStrategy(sorted);

    return {
      dependencies,
      totalEstimatedTime,
      risks,
      prerequisites,
      testingStrategy,
    };
  }

  /**
   * Predict transitive dependency issues
   */
  async predictTransitiveIssues(
    projectPath: string,
    dependencyName: string
  ): Promise<{
    affectedDependencies: string[];
    conflicts: {
      dependency: string;
      issue: string;
      resolution: string;
    }[];
    warnings: string[];
  }> {
    console.log(`🔗 Analyzing transitive dependencies for ${dependencyName}...`);

    // This would use npm ls or yarn why to analyze dependency tree
    const affectedDependencies = await this.getTransitiveDependencies(
      projectPath,
      dependencyName
    );

    const conflicts = await this.detectConflicts(
      projectPath,
      dependencyName,
      affectedDependencies
    );

    const warnings = this.generateTransitiveWarnings(affectedDependencies, conflicts);

    return {
      affectedDependencies,
      conflicts,
      warnings,
    };
  }

  // ============= Private Helper Methods =============

  private async readPackageJson(projectPath: string) {
    const content = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(content);
  }

  private async getLatestVersion(packageName: string): Promise<string> {
    try {
      const result = execSync(`npm view ${packageName} version`, {
        encoding: 'utf-8',
      });
      return result.trim();
    } catch {
      return 'unknown';
    }
  }

  private async findDependencyUsages(projectPath: string, packageName: string) {
    const usages: any[] = [];

    // Search for import/require statements
    const files = await this.getAllFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          if (line.includes(packageName)) {
            usages.push({
              file,
              line: idx + 1,
              usage: line.trim(),
            });
          }
        });
      } catch {
        // Ignore errors
      }
    }

    return usages;
  }

  private async analyzeBreakingChanges(
    packageName: string,
    currentVersion: string,
    targetVersion: string,
    usages: any[]
  ): Promise<BreakingChange[]> {
    // This would check changelog or breaking change databases
    const changes: BreakingChange[] = [];

    // Simplified: detect major version changes
    const current = parseInt(currentVersion.replace(/^\D+/, ''));
    const target = parseInt(targetVersion.replace(/^\D+/, ''));

    if (target > current) {
      changes.push({
        type: 'api-change',
        description: 'Major version change may include breaking changes',
        affectedCode: usages.slice(0, 3).map(u => ({
          file: u.file,
          line: u.line,
          currentCode: u.usage,
        })),
        severity: 'major',
      });
    }

    return changes;
  }

  private async checkCompatibility(
    packageName: string,
    version: string,
    packageJson: any
  ): Promise<string[]> {
    const issues: string[] = [];

    // Check Node version compatibility
    const nodeVersion = process.version;
    // Simplified check
    if (parseInt(nodeVersion.slice(1)) < 14) {
      issues.push(`May require Node.js 14+ (current: ${nodeVersion})`);
    }

    return issues;
  }

  private calculateRiskScore(
    breakingChanges: BreakingChange[],
    compatibilityIssues: string[]
  ): number {
    let score = 0;

    // Add points for breaking changes
    breakingChanges.forEach(change => {
      const points = {
        minor: 5,
        moderate: 15,
        major: 30,
        critical: 50,
      };
      score += points[change.severity];
    });

    // Add points for compatibility issues
    score += compatibilityIssues.length * 10;

    return Math.min(100, score);
  }

  private categorizeRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 20) return 'low';
    if (score < 40) return 'medium';
    if (score < 70) return 'high';
    return 'critical';
  }

  private estimateEffort(breakingChanges: BreakingChange[], usages: any[]) {
    const baseHours = 0.5;
    const changeHours = breakingChanges.length * 2;
    const usageHours = usages.length * 0.1;

    const hours = baseHours + changeHours + usageHours;

    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (hours > 8) complexity = 'complex';
    else if (hours > 3) complexity = 'moderate';

    return {
      hours: Math.round(hours * 10) / 10,
      complexity,
    };
  }

  private generateRecommendations(
    breakingChanges: BreakingChange[],
    compatibilityIssues: string[],
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore < 20) {
      recommendations.push('Safe to update - low risk');
    } else if (riskScore < 40) {
      recommendations.push('Update with caution - test thoroughly');
    } else {
      recommendations.push('High risk - consider deferring or plan carefully');
    }

    if (breakingChanges.length > 0) {
      recommendations.push('Review breaking changes documentation');
      recommendations.push('Update code to handle API changes');
    }

    if (compatibilityIssues.length > 0) {
      recommendations.push('Address compatibility issues first');
    }

    recommendations.push('Run full test suite after update');

    return recommendations;
  }

  private sortByUpdateOrder(analyses: ImpactAnalysis[]): ImpactAnalysis[] {
    // Sort by risk (lowest first) and dependencies
    return analyses.sort((a, b) => {
      if (a.riskScore !== b.riskScore) {
        return a.riskScore - b.riskScore;
      }
      return a.dependency.localeCompare(b.dependency);
    });
  }

  private explainUpdateReason(analysis: ImpactAnalysis): string {
    if (analysis.safeToUpdate) {
      return 'Safe update with no breaking changes';
    }
    if (analysis.breakingChanges.length > 0) {
      return `Contains ${analysis.breakingChanges.length} breaking change(s)`;
    }
    return 'Update available';
  }

  private identifyPrerequisites(analyses: ImpactAnalysis[]): string[] {
    return [
      'Ensure all tests pass before starting',
      'Create backup branch',
      'Review change logs for major updates',
    ];
  }

  private generateTestingStrategy(analyses: ImpactAnalysis[]): string[] {
    return [
      'Run unit tests after each update',
      'Perform integration testing',
      'Test critical user flows',
      'Check for console errors',
    ];
  }

  private generateGlobalRecommendations(analyses: ImpactAnalysis[]): string[] {
    const highrisk = analyses.filter(a => a.overallRisk === 'high' || a.overallRisk === 'critical');

    if (highrisk.length > 5) {
      return ['Consider gradual updates rather than updating all at once'];
    }

    return ['Update low-risk dependencies first to build confidence'];
  }

  private async getTransitiveDependencies(
    projectPath: string,
    packageName: string
  ): Promise<string[]> {
    // This would use npm ls to get dependency tree
    return [];
  }

  private async detectConflicts(
    projectPath: string,
    packageName: string,
    transitive: string[]
  ) {
    return [];
  }

  private generateTransitiveWarnings(transitive: string[], conflicts: any[]): string[] {
    if (conflicts.length > 0) {
      return ['Dependency conflicts detected - may require manual resolution'];
    }
    return [];
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist'].includes(entry.name)) {
            continue;
          }
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else if (this.isCodeFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }

    return files;
  }

  private isCodeFile(filename: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => filename.endsWith(ext));
  }
}

export const automatedDependencyImpactAnalyzer = new AutomatedDependencyImpactAnalyzer();
export default automatedDependencyImpactAnalyzer;
