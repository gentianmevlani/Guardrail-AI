/**
 * Migration Assistant
 * 
 * Assists with framework/library migrations
 * Unique: Analyzes codebase and generates migration plan
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface MigrationStep {
  type: 'file' | 'code' | 'config' | 'dependency';
  file?: string;
  description: string;
  current: string;
  target: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // minutes
  automated: boolean;
}

export interface MigrationPlan {
  from: string;
  to: string;
  steps: MigrationStep[];
  totalTime: number; // minutes
  risk: 'low' | 'medium' | 'high';
  recommendations: string[];
}

class MigrationAssistant {
  /**
   * Generate migration plan
   */
  async planMigration(
    projectPath: string,
    from: string,
    to: string
  ): Promise<MigrationPlan> {
    const steps: MigrationStep[] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    // Detect current framework/version
    const current = await this.detectCurrent(projectPath, from);

    // Generate migration steps
    if (from.includes('react') && to.includes('react')) {
      const reactSteps = await this.planReactMigration(projectPath, from, to);
      steps.push(...reactSteps);
    }

    if (from.includes('express') && to.includes('express')) {
      const expressSteps = await this.planExpressMigration(projectPath, from, to);
      steps.push(...expressSteps);
    }

    // Calculate total time
    const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);

    // Assess risk
    const risk = this.assessRisk(steps);

    // Generate recommendations
    const recommendations = this.generateRecommendations(steps, risk);

    return {
      from,
      to,
      steps,
      totalTime,
      risk,
      recommendations,
    };
  }

  /**
   * Detect current framework/version
   */
  private async detectCurrent(projectPath: string, from: string): Promise<string> {
    // Check package.json
    const pkgPath = path.join(projectPath, 'package.json');
    if (await this.pathExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (from.includes('react')) {
          return deps.react || 'unknown';
        }
        if (from.includes('express')) {
          return deps.express || 'unknown';
        }
      } catch {
        // Error reading package.json
      }
    }

    return 'unknown';
  }

  /**
   * Plan React migration
   */
  private async planReactMigration(
    projectPath: string,
    from: string,
    to: string
  ): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];

    // Step 1: Update dependencies
    steps.push({
      type: 'dependency',
      description: 'Update React and related dependencies',
      current: from,
      target: to,
      difficulty: 'easy',
      estimatedTime: 15,
      automated: true,
    });

    // Step 2: Update deprecated APIs
    const files = await this.findReactFiles(projectPath);
    for (const file of files.slice(0, 10)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        
        // Check for deprecated patterns
        if (/componentWillMount|componentWillReceiveProps/.test(content)) {
          steps.push({
            type: 'code',
            file: path.relative(projectPath, file),
            description: 'Replace deprecated lifecycle methods',
            current: 'componentWillMount/componentWillReceiveProps',
            target: 'useEffect hook',
            difficulty: 'medium',
            estimatedTime: 30,
            automated: false,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return steps;
  }

  /**
   * Plan Express migration
   */
  private async planExpressMigration(
    projectPath: string,
    from: string,
    to: string
  ): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];

    // Step 1: Update Express
    steps.push({
      type: 'dependency',
      description: 'Update Express version',
      current: from,
      target: to,
      difficulty: 'easy',
      estimatedTime: 10,
      automated: true,
    });

    // Step 2: Update middleware
    steps.push({
      type: 'code',
      description: 'Review middleware compatibility',
      current: 'Current middleware',
      target: 'Updated middleware',
      difficulty: 'medium',
      estimatedTime: 60,
      automated: false,
    });

    return steps;
  }

  /**
   * Assess migration risk
   */
  private assessRisk(steps: MigrationStep[]): 'low' | 'medium' | 'high' {
    const hardSteps = steps.filter(s => s.difficulty === 'hard').length;
    const automated = steps.filter(s => s.automated).length;
    const total = steps.length;

    if (hardSteps > total * 0.3) return 'high';
    if (automated < total * 0.5) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    steps: MigrationStep[],
    risk: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    if (risk === 'high') {
      recommendations.push('⚠️ High-risk migration - consider incremental approach');
    }

    const automated = steps.filter(s => s.automated).length;
    if (automated < steps.length * 0.5) {
      recommendations.push('💡 Consider automating more steps');
    }

    const totalTime = steps.reduce((sum, s) => sum + s.estimatedTime, 0);
    if (totalTime > 480) { // 8 hours
      recommendations.push('⏱️ Large migration - plan for multiple sessions');
    }

    return recommendations;
  }

  // Helper methods
  private async findReactFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findReactFiles(fullPath));
        } else if (item.isFile() && /\.(tsx|jsx)$/.test(item.name)) {
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

export const migrationAssistant = new MigrationAssistant();

