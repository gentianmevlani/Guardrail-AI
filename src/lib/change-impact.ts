/**
 * Change Impact Analysis
 * 
 * Understands what breaks when you change code
 * Analyzes dependencies and affected files
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface ChangeImpact {
  file: string;
  directImpact: string[]; // Files that directly import this
  indirectImpact: string[]; // Files that import files that import this
  breakingChanges: Array<{
    type: 'export' | 'signature' | 'type';
    name: string;
    affectedFiles: string[];
  }>;
  risk: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
}

class ChangeImpactAnalyzer {
  /**
   * Analyze impact of changing a file
   */
  async analyzeImpact(
    filePath: string,
    projectPath: string
  ): Promise<ChangeImpact> {
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found. Run build-knowledge first.');
    }

    const relativePath = path.relative(projectPath, filePath);
    const relationships = knowledge.relationships;

    // Find direct dependents
    const directImpact: string[] = [];
    for (const [file, imports] of relationships.imports.entries()) {
      if (imports.some(imp => imp.includes(relativePath) || relativePath.includes(imp))) {
        directImpact.push(file);
      }
    }

    // Find indirect dependents (files that import files that import this)
    const indirectImpact: string[] = [];
    for (const dependent of directImpact) {
      for (const [file, imports] of relationships.imports.entries()) {
        if (imports.some(imp => imp.includes(dependent))) {
          if (!directImpact.includes(file) && !indirectImpact.includes(file)) {
            indirectImpact.push(file);
          }
        }
      }
    }

    // Analyze potential breaking changes
    const breakingChanges = await this.analyzeBreakingChanges(
      filePath,
      relationships,
      projectPath
    );

    // Calculate risk
    const risk = this.calculateRisk(directImpact.length, indirectImpact.length, breakingChanges.length);

    // Generate suggestions
    const suggestions = this.generateSuggestions(risk, directImpact, indirectImpact, breakingChanges);

    return {
      file: relativePath,
      directImpact,
      indirectImpact,
      breakingChanges,
      risk,
      suggestions,
    };
  }

  /**
   * Analyze potential breaking changes
   */
  private async analyzeBreakingChanges(
    filePath: string,
    relationships: Record<string, unknown>,
    projectPath: string
  ): Promise<ChangeImpact['breakingChanges']> {
    const breakingChanges: ChangeImpact['breakingChanges'] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(projectPath, filePath);

      // Find exports
      const exports = relationships.exports.get(relativePath) || [];

      // Find files that import these exports
      const affectedFiles = new Set<string>();
      
      for (const [file, imports] of relationships.imports.entries()) {
        if (imports.some(imp => imp.includes(relativePath))) {
          affectedFiles.add(file);
        }
      }

      // Check for exported functions/classes
      const functionExports = content.match(/export\s+(?:async\s+)?function\s+(\w+)/g) || [];
      const classExports = content.match(/export\s+class\s+(\w+)/g) || [];
      const constExports = content.match(/export\s+const\s+(\w+)/g) || [];

      [...functionExports, ...classExports, ...constExports].forEach(exp => {
        const name = exp.match(/(\w+)$/)?.[1];
        if (name) {
          breakingChanges.push({
            type: 'export',
            name,
            affectedFiles: Array.from(affectedFiles),
          });
        }
      });

      // Check for type exports
      const typeExports = content.match(/export\s+type\s+(\w+)/g) || [];
      const interfaceExports = content.match(/export\s+interface\s+(\w+)/g) || [];

      [...typeExports, ...interfaceExports].forEach(exp => {
        const name = exp.match(/(\w+)$/)?.[1];
        if (name) {
          breakingChanges.push({
            type: 'type',
            name,
            affectedFiles: Array.from(affectedFiles),
          });
        }
      });
    } catch (error) {
      // Failed to process - continue with other operations
    }

    return breakingChanges;
  }

  /**
   * Calculate risk level
   */
  private calculateRisk(
    directCount: number,
    indirectCount: number,
    breakingCount: number
  ): ChangeImpact['risk'] {
    if (breakingCount > 5 || directCount > 20) return 'critical';
    if (breakingCount > 2 || directCount > 10 || indirectCount > 20) return 'high';
    if (breakingCount > 0 || directCount > 5) return 'medium';
    return 'low';
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    risk: ChangeImpact['risk'],
    directImpact: string[],
    indirectImpact: string[],
    breakingChanges: ChangeImpact['breakingChanges']
  ): string[] {
    const suggestions: string[] = [];

    if (risk === 'critical' || risk === 'high') {
      suggestions.push('⚠️ High impact change - consider creating a new version or feature flag');
      suggestions.push('📋 Review all affected files before merging');
      suggestions.push('🧪 Add tests for affected functionality');
    }

    if (breakingChanges.length > 0) {
      suggestions.push(`🔧 ${breakingChanges.length} potential breaking change(s) detected`);
      suggestions.push('💡 Consider deprecation strategy for removed exports');
    }

    if (directImpact.length > 10) {
      suggestions.push('📊 Many direct dependents - consider refactoring to reduce coupling');
    }

    if (indirectImpact.length > 0) {
      suggestions.push(`🔗 ${indirectImpact.length} indirect dependents may also be affected`);
    }

    if (risk === 'low') {
      suggestions.push('✅ Low risk change - safe to proceed');
    }

    return suggestions;
  }

  /**
   * Get files that would be affected by deleting a file
   */
  async analyzeDeletion(
    filePath: string,
    projectPath: string
  ): Promise<{
    wouldBreak: string[];
    safe: boolean;
    warnings: string[];
  }> {
    const impact = await this.analyzeImpact(filePath, projectPath);

    return {
      wouldBreak: [...impact.directImpact, ...impact.indirectImpact],
      safe: impact.risk === 'low' && impact.directImpact.length === 0,
      warnings: impact.suggestions,
    };
  }
}

export const changeImpactAnalyzer = new ChangeImpactAnalyzer();

