/**
 * Architecture Drift Predictor
 * 
 * Predicts when architecture will drift from intended design
 * Unique: Proactive architecture monitoring
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import { changeTracker } from './change-tracker';
import * as fs from 'fs';
import * as path from 'path';

export interface ArchitectureDrift {
  type: 'structure' | 'patterns' | 'conventions' | 'dependencies';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  current: string;
  intended: string;
  drift: number; // 0-100
  prediction: {
    when: 'immediate' | '1-month' | '3-months' | '6-months';
    impact: string;
    cost: number; // Hours to fix
  };
  recommendation: string[];
}

export interface DriftReport {
  totalDrifts: number;
  critical: number;
  drifts: ArchitectureDrift[];
  overallHealth: number; // 0-100
  predictions: Array<{
    type: string;
    when: string;
    impact: string;
  }>;
}

class ArchitectureDriftPredictor {
  /**
   * Predict architecture drift
   */
  async predict(projectPath: string): Promise<DriftReport> {
    const drifts: ArchitectureDrift[] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    // Get intended architecture (from .guardrailrc or default)
    const intended = await this.getIntendedArchitecture(projectPath);

    // Check structure drift
    const structureDrifts = this.checkStructureDrift(knowledge, intended);
    drifts.push(...structureDrifts);

    // Check pattern drift
    const patternDrifts = this.checkPatternDrift(knowledge, intended);
    drifts.push(...patternDrifts);

    // Check convention drift
    const conventionDrifts = this.checkConventionDrift(knowledge, intended);
    drifts.push(...conventionDrifts);

    // Check dependency drift
    const dependencyDrifts = await this.checkDependencyDrift(projectPath, intended);
    drifts.push(...dependencyDrifts);

    // Calculate overall health
    const overallHealth = this.calculateHealth(drifts);

    // Generate predictions
    const predictions = this.generatePredictions(drifts);

    return {
      totalDrifts: drifts.length,
      critical: drifts.filter(d => d.severity === 'critical').length,
      drifts,
      overallHealth,
      predictions,
    };
  }

  /**
   * Check structure drift
   */
  private checkStructureDrift(knowledge: any, intended: any): ArchitectureDrift[] {
    const drifts: ArchitectureDrift[] = [];

    // Check if structure matches intended
    if (intended.structure && knowledge.architecture.structure.type !== intended.structure) {
      drifts.push({
        type: 'structure',
        severity: 'high',
        description: `Architecture type mismatch: ${knowledge.architecture.structure.type} vs intended ${intended.structure}`,
        current: knowledge.architecture.structure.type,
        intended: intended.structure,
        drift: 50,
        prediction: {
          when: '3-months',
          impact: 'Architecture will become inconsistent and hard to maintain',
          cost: 40,
        },
        recommendation: [
          'Align structure with intended architecture',
          'Refactor to match intended type',
          'Update architecture documentation',
        ],
      });
    }

    return drifts;
  }

  /**
   * Check pattern drift
   */
  private checkPatternDrift(knowledge: any, intended: any): ArchitectureDrift[] {
    const drifts: ArchitectureDrift[] = [];

    // Check for anti-patterns
    const antiPatterns = knowledge.patterns.filter((p: any) => 
      p.name.toLowerCase().includes('anti') || 
      p.frequency < 2
    );

    if (antiPatterns.length > 0) {
      drifts.push({
        type: 'patterns',
        severity: 'medium',
        description: `${antiPatterns.length} anti-pattern(s) detected`,
        current: `${antiPatterns.length} anti-patterns`,
        intended: 'No anti-patterns',
        drift: antiPatterns.length * 10,
        prediction: {
          when: '1-month',
          impact: 'Anti-patterns will accumulate and reduce code quality',
          cost: antiPatterns.length * 4,
        },
        recommendation: [
          'Refactor anti-patterns',
          'Establish pattern guidelines',
          'Code review to prevent new anti-patterns',
        ],
      });
    }

    return drifts;
  }

  /**
   * Check convention drift
   */
  private checkConventionDrift(knowledge: any, intended: any): ArchitectureDrift[] {
    const drifts: ArchitectureDrift[] = [];

    // Check naming conventions
    if (intended.naming && knowledge.architecture.conventions.naming.files !== intended.naming) {
      drifts.push({
        type: 'conventions',
        severity: 'low',
        description: `Naming convention drift: ${knowledge.architecture.conventions.naming.files} vs intended ${intended.naming}`,
        current: knowledge.architecture.conventions.naming.files || 'mixed',
        intended: intended.naming,
        drift: 20,
        prediction: {
          when: '6-months',
          impact: 'Inconsistent naming will make code harder to navigate',
          cost: 8,
        },
        recommendation: [
          'Standardize naming convention',
          'Add linting rules',
          'Refactor existing files gradually',
        ],
      });
    }

    return drifts;
  }

  /**
   * Check dependency drift
   */
  private async checkDependencyDrift(
    projectPath: string,
    intended: any
  ): Promise<ArchitectureDrift[]> {
    const drifts: ArchitectureDrift[] = [];

    // Check for dependency violations
    // Simplified - in production analyze actual dependencies
    return drifts;
  }

  /**
   * Get intended architecture
   */
  private async getIntendedArchitecture(projectPath: string): Promise<any> {
    // Try to load from .guardrailrc
    const configPath = path.join(projectPath, '.guardrailrc.json');
    try {
      if (await this.pathExists(configPath)) {
        const config = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
        return config.architecture || {};
      }
    } catch {
      // Config doesn't exist
    }

    // Default intended architecture
    return {
      structure: 'modular',
      naming: 'camelCase',
    };
  }

  /**
   * Calculate overall health
   */
  private calculateHealth(drifts: ArchitectureDrift[]): number {
    let health = 100;
    for (const drift of drifts) {
      const penalty = drift.severity === 'critical' ? 15 :
                     drift.severity === 'high' ? 10 :
                     drift.severity === 'medium' ? 5 : 2;
      health -= penalty;
    }
    return Math.max(0, health);
  }

  /**
   * Generate predictions
   */
  private generatePredictions(drifts: ArchitectureDrift[]): Array<{
    type: string;
    when: string;
    impact: string;
  }> {
    return drifts
      .filter(d => d.severity === 'critical' || d.severity === 'high')
      .map(d => ({
        type: d.type,
        when: d.prediction.when,
        impact: d.prediction.impact,
      }));
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

export const architectureDriftPredictor = new ArchitectureDriftPredictor();

