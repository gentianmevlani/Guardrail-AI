/**
 * Change Impact Analyzer
 * 
 * Analyzes the impact of code changes using AST parsing and dependency analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ImpactAnalysis {
  file: string;
  impact: {
    critical: Dependency[];
    high: Dependency[];
    medium: Dependency[];
    low: Dependency[];
  };
  summary: {
    totalAffected: number;
    riskScore: number;
    estimatedTests: number;
  };
  recommendations: string[];
}

interface Dependency {
  file: string;
  type: 'import' | 'function-call' | 'class-extension' | 'interface-implementation' | 'config';
  line?: number;
  description: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

class ChangeImpactAnalyzer {
  private projectGraph: Map<string, Set<string>> = new Map();
  private reverseGraph: Map<string, Set<string>> = new Map();

  /**
   * Analyze impact of changing a specific file
   */
  async analyzeImpact(projectPath: string, targetFile: string): Promise<ImpactAnalysis> {
    console.log(`💥 Analyzing impact of changes to: ${targetFile}`);
    
    // Build dependency graph if not exists
    if (this.projectGraph.size === 0) {
      await this.buildDependencyGraph(projectPath);
    }
    
    // Find all dependents
    const affectedFiles = this.findDependents(targetFile);
    
    // Categorize by impact level
    const impact = await this.categorizeImpact(targetFile, affectedFiles);
    
    // Calculate summary
    const summary = this.calculateSummary(impact);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(targetFile, impact);
    
    return {
      file: targetFile,
      impact,
      summary,
      recommendations
    };
  }

  /**
   * Build project dependency graph
   */
  private async buildDependencyGraph(projectPath: string): Promise<void> {
    console.log('🔗 Building dependency graph...');
    
    const sourceFiles = await this.findSourceFiles(projectPath);
    
    for (const file of sourceFiles) {
      const dependencies = await this.extractDependencies(file);
      this.projectGraph.set(file, new Set(dependencies));
      
      // Build reverse graph
      for (const dep of dependencies) {
        if (!this.reverseGraph.has(dep)) {
          this.reverseGraph.set(dep, new Set());
        }
        this.reverseGraph.get(dep)!.add(file);
      }
    }
    
    console.log(`✅ Built graph with ${sourceFiles.length} files`);
  }

  /**
   * Find all files that depend on the target file
   */
  private findDependents(targetFile: string): string[] {
    const dependents: string[] = [];
    const visited = new Set<string>();
    const queue = [targetFile];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) continue;
      visited.add(current);
      
      const deps = this.reverseGraph.get(current) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dependents.push(dep);
          queue.push(dep);
        }
      }
    }
    
    return dependents;
  }

  /**
   * Categorize impact level for each affected file
   */
  private async categorizeImpact(targetFile: string, affectedFiles: string[]): Promise<ImpactAnalysis['impact']> {
    const impact = {
      critical: [] as Dependency[],
      high: [] as Dependency[],
      medium: [] as Dependency[],
      low: [] as Dependency[]
    };
    
    for (const file of affectedFiles) {
      const dep = await this.analyzeDependency(targetFile, file);
      
      switch (dep.risk) {
        case 'critical':
          impact.critical.push(dep);
          break;
        case 'high':
          impact.high.push(dep);
          break;
        case 'medium':
          impact.medium.push(dep);
          break;
        case 'low':
          impact.low.push(dep);
          break;
      }
    }
    
    return impact;
  }

  /**
   * Analyze specific dependency relationship
   */
  private async analyzeDependency(source: string, dependent: string): Promise<Dependency> {
    const content = await fs.readFile(dependent, 'utf-8');
    const relativeSource = path.relative(path.dirname(dependent), source);
    
    // Check import type
    if (content.includes(`from '${relativeSource}'`) || content.includes(`from "${relativeSource}"`)) {
      // Check if it's a default export or named export
      if (content.includes('import * as')) {
        return {
          file: dependent,
          type: 'import',
          description: 'Imports entire module',
          risk: 'critical'
        };
      } else if (content.includes('import {') && content.includes('export class')) {
        return {
          file: dependent,
          type: 'class-extension',
          description: 'Extends class from this module',
          risk: 'critical'
        };
      } else {
        return {
          file: dependent,
          type: 'import',
          description: 'Imports specific functions/types',
          risk: 'high'
        };
      }
    }
    
    // Check for function calls
    const exportedFunctions = await this.getExportedFunctions(source);
    for (const func of exportedFunctions) {
      if (content.includes(`${func}(`)) {
        return {
          file: dependent,
          type: 'function-call',
          description: `Calls function ${func}()`,
          risk: 'medium'
        };
      }
    }
    
    // Default low impact
    return {
      file: dependent,
      type: 'import',
      description: 'Indirect dependency',
      risk: 'low'
    };
  }

  /**
   * Calculate impact summary
   */
  private calculateSummary(impact: ImpactAnalysis['impact']): ImpactAnalysis['summary'] {
    const totalAffected = impact.critical.length + impact.high.length + impact.medium.length + impact.low.length;
    
    // Calculate risk score (0-100)
    const riskScore = Math.min(100, 
      (impact.critical.length * 25) + 
      (impact.high.length * 15) + 
      (impact.medium.length * 8) + 
      (impact.low.length * 3)
    );
    
    // Estimate tests needed
    const estimatedTests = impact.critical.length * 5 + impact.high.length * 3 + impact.medium.length * 2 + impact.low.length;
    
    return {
      totalAffected,
      riskScore,
      estimatedTests
    };
  }

  /**
   * Generate recommendations based on impact
   */
  private generateRecommendations(_targetFile: string, impact: ImpactAnalysis['impact']): string[] {
    const recommendations: string[] = [];
    
    if (impact.critical.length > 0) {
      recommendations.push('🚨 Critical impact detected! Run full test suite before deploying');
      recommendations.push('Consider creating a feature branch for this change');
    }
    
    if (impact.high.length > 5) {
      recommendations.push('⚠️ High impact on multiple files - coordinate with team');
    }
    
    if (impact.critical.length > 0 || impact.high.length > 0) {
      recommendations.push('📝 Update documentation for breaking changes');
    }
    
    recommendations.push(`🧪 Run at least ${impact.critical.length * 5 + impact.high.length * 3} targeted tests`);
    
    if (impact.medium.length + impact.low.length > 10) {
      recommendations.push('🔄 Consider incremental rollout to monitor issues');
    }
    
    return recommendations;
  }

  /**
   * Find all source files in project
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const files: string[] = [];
    
    const scan = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    await scan(projectPath);
    return files;
  }

  /**
   * Extract dependencies from a file
   */
  private async extractDependencies(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const dependencies: string[] = [];
      
      // Extract import statements
      const importRegex = /from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath && !importPath.startsWith('.')) {
          dependencies.push(importPath);
        }
      }
      
      return dependencies;
    } catch (error) {
      console.warn(`Warning: Could not extract dependencies from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get exported functions from a file
   */
  private async getExportedFunctions(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const functions: string[] = [];
      
      // Match exported functions
      const exportFunctionRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
      let match;
      
      while ((match = exportFunctionRegex.exec(content)) !== null) {
        if (match[1]) {
          functions.push(match[1]);
        }
      }
      
      // Match exported arrow functions
      const exportArrowRegex = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
      while ((match = exportArrowRegex.exec(content)) !== null) {
        if (match[1]) {
          functions.push(match[1]);
        }
      }
      
      return functions;
    } catch (error) {
      return [];
    }
  }
}

// Export singleton instance
export const changeImpactAnalyzer = new ChangeImpactAnalyzer();
