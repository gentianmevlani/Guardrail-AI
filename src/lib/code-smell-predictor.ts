/**
 * Code Smell Predictor
 * 
 * Predicts technical debt and code smells before they become problems
 * Unique: Proactive technical debt detection
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CodeSmell {
  type: 'long-method' | 'large-class' | 'duplication' | 'complexity' | 'coupling' | 'cohesion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  description: string;
  metrics: {
    current: number;
    threshold: number;
    trend?: 'increasing' | 'decreasing' | 'stable';
  };
  prediction: {
    when: 'immediate' | '1-month' | '3-months' | '6-months';
    impact: string;
    cost: 'low' | 'medium' | 'high';
  };
  recommendation: string[];
}

export interface TechnicalDebtReport {
  totalSmells: number;
  critical: number;
  estimatedDebt: number; // Hours
  smells: CodeSmell[];
  trends: Array<{
    type: string;
    trend: 'improving' | 'worsening' | 'stable';
    change: number;
  }>;
}

class CodeSmellPredictor {
  /**
   * Predict code smells and technical debt
   */
  async predict(projectPath: string): Promise<TechnicalDebtReport> {
    const smells: CodeSmell[] = [];

    // Predict long methods
    const longMethods = await this.predictLongMethods(projectPath);
    smells.push(...longMethods);

    // Predict large classes
    const largeClasses = await this.predictLargeClasses(projectPath);
    smells.push(...largeClasses);

    // Predict duplication
    const duplication = await this.predictDuplication(projectPath);
    smells.push(...duplication);

    // Predict complexity
    const complexity = await this.predictComplexity(projectPath);
    smells.push(...complexity);

    // Predict coupling
    const coupling = await this.predictCoupling(projectPath);
    smells.push(...coupling);

    // Calculate estimated debt
    const estimatedDebt = this.calculateDebt(smells);

    // Analyze trends
    const trends = this.analyzeTrends(smells);

    return {
      totalSmells: smells.length,
      critical: smells.filter(s => s.severity === 'critical').length,
      estimatedDebt,
      smells,
      trends,
    };
  }

  /**
   * Predict long methods
   */
  private async predictLongMethods(projectPath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const functions = this.extractFunctions(content);

        for (const func of functions) {
          if (func.lines > 50) {
            const severity = func.lines > 100 ? 'critical' : func.lines > 75 ? 'high' : 'medium';
            smells.push({
              type: 'long-method',
              severity,
              file: path.relative(projectPath, file),
              line: func.line,
              description: `Method ${func.name} is ${func.lines} lines long`,
              metrics: {
                current: func.lines,
                threshold: 50,
                trend: 'increasing',
              },
              prediction: {
                when: func.lines > 100 ? 'immediate' : '1-month',
                impact: 'Hard to test, understand, and maintain',
                cost: severity === 'critical' ? 'high' : 'medium',
              },
              recommendation: [
                'Extract smaller methods',
                'Apply Single Responsibility Principle',
                'Break into logical sections',
              ],
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return smells;
  }

  /**
   * Predict large classes
   */
  private async predictLargeClasses(projectPath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const classes = this.extractClasses(content);

        for (const cls of classes) {
          if (cls.lines > 300) {
            const severity = cls.lines > 500 ? 'critical' : 'high';
            smells.push({
              type: 'large-class',
              severity,
              file: path.relative(projectPath, file),
              line: cls.line,
              description: `Class ${cls.name} is ${cls.lines} lines long with ${cls.methods} methods`,
              metrics: {
                current: cls.lines,
                threshold: 300,
                trend: 'increasing',
              },
              prediction: {
                when: cls.lines > 500 ? 'immediate' : '3-months',
                impact: 'Violates Single Responsibility Principle, hard to maintain',
                cost: 'high',
              },
              recommendation: [
                'Split into smaller classes',
                'Extract related functionality',
                'Apply composition over inheritance',
              ],
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return smells;
  }

  /**
   * Predict code duplication
   */
  private async predictDuplication(projectPath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    // Simplified - in production use proper duplication detection
    return smells;
  }

  /**
   * Predict complexity
   */
  private async predictComplexity(projectPath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    // Simplified - in production calculate cyclomatic complexity
    return smells;
  }

  /**
   * Predict coupling
   */
  private async predictCoupling(projectPath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    // Simplified - in production analyze dependencies
    return smells;
  }

  /**
   * Calculate estimated technical debt in hours
   * Updated for AI-assisted development - reduced times due to AI tools
   */
  private calculateDebt(smells: CodeSmell[]): number {
    let totalHours = 0;
    for (const smell of smells) {
      // AI-assisted development significantly reduces remediation time
      const hours = smell.severity === 'critical' ? 2 :  // Was 8, now 2 with AI
                   smell.severity === 'high' ? 1 :       // Was 4, now 1 with AI  
                   smell.severity === 'medium' ? 0.5 :   // Was 2, now 0.5 with AI
                   0.25;                                  // Was 1, now 0.25 with AI
      totalHours += hours;
    }
    return totalHours;
  }

  /**
   * Analyze trends
   */
  private analyzeTrends(smells: CodeSmell[]): Array<{
    type: string;
    trend: 'improving' | 'worsening' | 'stable';
    change: number;
  }> {
    const byType = new Map<string, number>();
    for (const smell of smells) {
      byType.set(smell.type, (byType.get(smell.type) || 0) + 1);
    }

    return Array.from(byType.entries()).map(([type, count]) => ({
      type,
      trend: 'worsening' as const, // Simplified
      change: count,
    }));
  }

  private extractFunctions(content: string): Array<{ name: string; line: number; lines: number }> {
    const functions: Array<{ name: string; line: number; lines: number }> = [];
    const lines = content.split('\n');
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*[:=]\s*(?:async\s+)?\(/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      const lineNum = content.substring(0, match.index).split('\n').length;
      // Estimate function length (simplified)
      const funcLines = this.estimateFunctionLength(content, match.index);
      functions.push({ name: funcName, line: lineNum, lines: funcLines });
    }

    return functions;
  }

  private extractClasses(content: string): Array<{ name: string; line: number; lines: number; methods: number }> {
    const classes: Array<{ name: string; line: number; lines: number; methods: number }> = [];
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;
      const classInfo = this.estimateClassSize(content, match.index);
      classes.push({
        name: className,
        line: lineNum,
        lines: classInfo.lines,
        methods: classInfo.methods,
      });
    }

    return classes;
  }

  private estimateFunctionLength(content: string, startIndex: number): number {
    // Simplified - find next function or end of file
    const remaining = content.substring(startIndex);
    const nextFunction = remaining.search(/(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?const\s+\w+\s*[:=]\s*(?:async\s+)?\(/);
    const endIndex = nextFunction > 0 ? startIndex + nextFunction : content.length;
    return content.substring(startIndex, endIndex).split('\n').length;
  }

  private estimateClassSize(content: string, startIndex: number): { lines: number; methods: number } {
    // Simplified estimation
    const remaining = content.substring(startIndex);
    const nextClass = remaining.search(/(?:export\s+)?class\s+\w+/);
    const endIndex = nextClass > 0 ? startIndex + nextClass : content.length;
    const classContent = content.substring(startIndex, endIndex);
    const methods = (classContent.match(/\w+\s*\([^)]*\)\s*{/g) || []).length;
    return {
      lines: classContent.split('\n').length,
      methods,
    };
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
}

export const codeSmellPredictor = new CodeSmellPredictor();

