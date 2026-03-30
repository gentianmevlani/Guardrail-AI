/**
 * Breaking Change Detector
 * 
 * Automatically detects breaking changes between versions, saving hours
 * of manual analysis when upgrading or refactoring code.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ComponentSpec, RelationshipSpec } from './mdc-generator';

export interface BreakingChange {
  type: 'api' | 'signature' | 'dependency' | 'removal' | 'type';
  severity: 'critical' | 'major' | 'minor';
  component: string;
  description: string;
  before: string;
  after: string;
  impact: string[];
  migration: string;
  lineNumber?: number;
}

export interface BreakingChangeReport {
  changes: BreakingChange[];
  summary: {
    total: number;
    critical: number;
    major: number;
    minor: number;
    affectedComponents: number;
  };
  affectedSpecs: string[];
  riskScore: number; // 0-100
}

export class BreakingChangeDetector {
  private projectPath: string;
  private previousSpecs: Map<string, ComponentSpec> = new Map();
  private previousRelationships: Map<string, RelationshipSpec> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Detect breaking changes between two specification sets
   */
  async detectBreakingChanges(
    currentComponents: ComponentSpec[],
    currentRelationships: RelationshipSpec[],
    previousSpecsPath?: string
  ): Promise<BreakingChangeReport> {
    const changes: BreakingChange[] = [];

    // Load previous specs if path provided
    if (previousSpecsPath) {
      await this.loadPreviousSpecs(previousSpecsPath);
    }

    // Compare components
    for (const current of currentComponents) {
      const previous = this.previousSpecs.get(current.name);

      if (!previous) {
        // New component - not a breaking change
        continue;
      }

      // Check for API changes
      const apiChanges = this.detectAPIBreakingChanges(current, previous);
      changes.push(...apiChanges);

      // Check for type changes
      const typeChanges = this.detectTypeBreakingChanges(current, previous);
      changes.push(...typeChanges);

      // Check for method/property removals
      const removalChanges = this.detectRemovalBreakingChanges(current, previous);
      changes.push(...removalChanges);
    }

    // Check for removed components
    for (const [name, previous] of this.previousSpecs.entries()) {
      const current = currentComponents.find(c => c.name === name);
      if (!current) {
        changes.push({
          type: 'removal',
          severity: 'critical',
          component: name,
          description: `Component ${name} has been removed`,
          before: `Component existed at ${previous.path}`,
          after: 'Component no longer exists',
          impact: this.findComponentsUsing(name, currentComponents, currentRelationships),
          migration: `Update all references to ${name} or use alternative implementation`,
        });
      }
    }

    // Check for dependency changes
    const dependencyChanges = this.detectDependencyBreakingChanges(
      currentComponents,
      currentRelationships
    );
    changes.push(...dependencyChanges);

    // Generate summary
    const summary = {
      total: changes.length,
      critical: changes.filter(c => c.severity === 'critical').length,
      major: changes.filter(c => c.severity === 'major').length,
      minor: changes.filter(c => c.severity === 'minor').length,
      affectedComponents: new Set(changes.map(c => c.component)).size,
    };

    // Calculate risk score
    const riskScore = this.calculateRiskScore(changes);

    // Find affected specs
    const affectedSpecs = this.findAffectedSpecs(changes);

    return {
      changes,
      summary,
      affectedSpecs,
      riskScore,
    };
  }

  /**
   * Detect API breaking changes
   */
  private detectAPIBreakingChanges(
    current: ComponentSpec,
    previous: ComponentSpec
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Check method changes
    if (current.methods && previous.methods) {
      const removedMethods = previous.methods.filter(m => !current.methods?.includes(m));
      const addedMethods = current.methods.filter(m => !previous.methods?.includes(m));

      for (const method of removedMethods) {
        changes.push({
          type: 'api',
          severity: 'major',
          component: current.name,
          description: `Method ${method} was removed from ${current.name}`,
          before: `${current.name}.${method}()`,
          after: 'Method no longer exists',
          impact: [`All code using ${current.name}.${method}() will break`],
          migration: `Replace ${current.name}.${method}() with alternative method or update calling code`,
        });
      }

      // Added methods are not breaking (backward compatible)
    }

    // Check property changes
    if (current.properties && previous.properties) {
      const removedProperties = previous.properties.filter(p => !current.properties?.includes(p));

      for (const prop of removedProperties) {
        changes.push({
          type: 'api',
          severity: current.type === 'interface' || current.type === 'type' ? 'critical' : 'major',
          component: current.name,
          description: `Property ${prop} was removed from ${current.name}`,
          before: `${current.name}.${prop}`,
          after: 'Property no longer exists',
          impact: [`All code accessing ${current.name}.${prop} will break`],
          migration: `Update code to use alternative property or remove references to ${prop}`,
        });
      }
    }

    return changes;
  }

  /**
   * Detect type breaking changes
   */
  private detectTypeBreakingChanges(
    current: ComponentSpec,
    previous: ComponentSpec
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    if (current.type !== previous.type) {
      changes.push({
        type: 'type',
        severity: 'critical',
        component: current.name,
        description: `Type changed from ${previous.type} to ${current.type}`,
        before: `${previous.type} ${current.name}`,
        after: `${current.type} ${current.name}`,
        impact: [
          `All code expecting ${previous.type} will fail`,
          `Type imports and usages need updating`,
        ],
        migration: `Update all references to treat ${current.name} as ${current.type} instead of ${previous.type}`,
      });
    }

    return changes;
  }

  /**
   * Detect removal breaking changes
   */
  private detectRemovalBreakingChanges(
    current: ComponentSpec,
    previous: ComponentSpec
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // If component moved to different path, it's potentially breaking
    if (current.path !== previous.path) {
      changes.push({
        type: 'removal',
        severity: 'major',
        component: current.name,
        description: `Component moved from ${previous.path} to ${current.path}`,
        before: `import { ${current.name} } from '${previous.path}'`,
        after: `import { ${current.name} } from '${current.path}'`,
        impact: [`All imports from ${previous.path} will break`],
        migration: `Update imports to use new path: ${current.path}`,
      });
    }

    return changes;
  }

  /**
   * Detect dependency breaking changes
   */
  private detectDependencyBreakingChanges(
    currentComponents: ComponentSpec[],
    currentRelationships: RelationshipSpec[]
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Check for removed dependencies
    for (const [name, previous] of this.previousSpecs.entries()) {
      const current = currentComponents.find(c => c.name === name);
      
      if (current && previous.dependencies) {
        const removedDeps = previous.dependencies.filter(
          dep => !current.dependencies.includes(dep)
        );

        for (const dep of removedDeps) {
          // Check if the dependency still exists in the codebase
          const depStillExists = currentComponents.some(c => 
            c.name === dep || c.path.includes(dep)
          );

          if (!depStillExists) {
            changes.push({
              type: 'dependency',
              severity: 'major',
              component: current.name,
              description: `Dependency ${dep} was removed from ${current.name}`,
              before: `${current.name} depends on ${dep}`,
              after: `Dependency removed`,
              impact: [`If ${dep} was required, ${current.name} may not function correctly`],
              migration: `Verify ${current.name} no longer needs ${dep} or find alternative dependency`,
            });
          }
        }
      }
    }

    return changes;
  }

  /**
   * Find components using a specific component
   */
  private findComponentsUsing(
    componentName: string,
    components: ComponentSpec[],
    relationships: RelationshipSpec[]
  ): string[] {
    const users: string[] = [];

    for (const rel of relationships) {
      if (rel.to === componentName) {
        users.push(rel.from);
      }
    }

    // Also check dependencies
    for (const comp of components) {
      if (comp.dependencies.includes(componentName)) {
        users.push(comp.name);
      }
    }

    return [...new Set(users)];
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(changes: BreakingChange[]): number {
    if (changes.length === 0) return 0;

    let score = 0;
    for (const change of changes) {
      switch (change.severity) {
        case 'critical':
          score += 10;
          break;
        case 'major':
          score += 5;
          break;
        case 'minor':
          score += 1;
          break;
      }
    }

    // Normalize to 0-100
    return Math.min(100, (score / changes.length) * 10);
  }

  /**
   * Find affected specifications
   */
  private findAffectedSpecs(changes: BreakingChange[]): string[] {
    const affectedComponents = new Set(changes.map(c => c.component));
    const specs: string[] = [];

    // This would check which specs reference these components
    // For now, return generic categories
    if (affectedComponents.size > 0) {
      specs.push('architecture.mdc');
      specs.push('data-flow.mdc');
    }

    return specs;
  }

  /**
   * Load previous specifications
   */
  private async loadPreviousSpecs(specsPath: string): Promise<void> {
    // Implementation would load previous version of specs
    // For now, this is a placeholder
  }
}

