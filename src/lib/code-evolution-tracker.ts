/**
 * Code Evolution Tracker
 * 
 * Tracks how code patterns evolve over time
 * Unique: Historical pattern analysis and trend prediction
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import { changeTracker } from './change-tracker';
import * as fs from 'fs';
import * as path from 'path';

export interface EvolutionSnapshot {
  timestamp: string;
  patterns: Array<{
    id: string;
    name: string;
    frequency: number;
    files: string[];
  }>;
  metrics: {
    totalFiles: number;
    totalLines: number;
    complexity: number;
    coupling: number;
  };
}

export interface EvolutionTrend {
  pattern: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'emerging' | 'declining';
  change: number; // Percentage change
  timeline: EvolutionSnapshot[];
  prediction: {
    direction: 'up' | 'down' | 'stable';
    confidence: number;
    timeframe: string;
  };
}

export interface EvolutionReport {
  snapshots: EvolutionSnapshot[];
  trends: EvolutionTrend[];
  predictions: Array<{
    pattern: string;
    prediction: string;
    confidence: number;
  }>;
  insights: string[];
}

class CodeEvolutionTracker {
  private snapshots: EvolutionSnapshot[] = [];
  private snapshotsFile = '.guardrail-evolution.json';

  constructor() {
    this.loadSnapshots();
  }

  /**
   * Capture current state as snapshot
   */
  async captureSnapshot(projectPath: string): Promise<EvolutionSnapshot> {
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    const snapshot: EvolutionSnapshot = {
      timestamp: new Date().toISOString(),
      patterns: knowledge.patterns.map(p => ({
        id: p.id,
        name: p.name,
        frequency: p.frequency,
        files: p.examples,
      })),
      metrics: {
        totalFiles: await this.countFiles(projectPath),
        totalLines: await this.countLines(projectPath),
        complexity: this.calculateComplexity(knowledge),
        coupling: this.calculateCoupling(knowledge),
      },
    };

    this.snapshots.push(snapshot);
    await this.saveSnapshots();

    return snapshot;
  }

  /**
   * Analyze evolution trends
   */
  async analyzeEvolution(projectPath: string): Promise<EvolutionReport> {
    // Capture current snapshot
    const current = await this.captureSnapshot(projectPath);

    // Analyze trends
    const trends = this.analyzeTrends();

    // Generate predictions
    const predictions = this.generatePredictions(trends);

    // Generate insights
    const insights = this.generateInsights(trends, current);

    return {
      snapshots: this.snapshots,
      trends,
      predictions,
      insights,
    };
  }

  /**
   * Analyze trends from snapshots
   */
  private analyzeTrends(): EvolutionTrend[] {
    const trends: EvolutionTrend[] = [];

    if (this.snapshots.length < 2) {
      return trends; // Need at least 2 snapshots
    }

    // Get all unique patterns
    const allPatterns = new Set<string>();
    for (const snapshot of this.snapshots) {
      for (const pattern of snapshot.patterns) {
        allPatterns.add(pattern.id);
      }
    }

    // Analyze each pattern
    for (const patternId of allPatterns) {
      const patternSnapshots = this.snapshots.map(s => {
        const pattern = s.patterns.find(p => p.id === patternId);
        return {
          timestamp: s.timestamp,
          frequency: pattern?.frequency || 0,
        };
      });

      const trend = this.calculateTrend(patternSnapshots);
      if (trend) {
        trends.push({
          pattern: patternId,
          ...trend,
          timeline: this.snapshots.map(s => ({
            timestamp: s.timestamp,
            patterns: s.patterns.filter(p => p.id === patternId),
            metrics: s.metrics,
          })),
        });
      }
    }

    return trends;
  }

  /**
   * Calculate trend for a pattern
   */
  private calculateTrend(snapshots: Array<{ timestamp: string; frequency: number }>): Omit<EvolutionTrend, 'pattern' | 'timeline'> | null {
    if (snapshots.length < 2) return null;

    const first = snapshots[0].frequency;
    const last = snapshots[snapshots.length - 1].frequency;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;

    let trend: EvolutionTrend['trend'];
    if (change > 20) {
      trend = first === 0 ? 'emerging' : 'increasing';
    } else if (change < -20) {
      trend = last === 0 ? 'declining' : 'decreasing';
    } else {
      trend = 'stable';
    }

    // Predict future
    const prediction = this.predictFuture(snapshots);

    return {
      trend,
      change,
      prediction,
    };
  }

  /**
   * Predict future trend
   */
  private predictFuture(snapshots: Array<{ timestamp: string; frequency: number }>): EvolutionTrend['prediction'] {
    if (snapshots.length < 3) {
      return {
        direction: 'stable',
        confidence: 0.5,
        timeframe: 'unknown',
      };
    }

    // Simple linear regression
    const values = snapshots.map(s => s.frequency);
    const avgChange = (values[values.length - 1] - values[0]) / values.length;

    let direction: 'up' | 'down' | 'stable';
    if (avgChange > 1) {
      direction = 'up';
    } else if (avgChange < -1) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    return {
      direction,
      confidence: Math.min(0.9, 0.5 + Math.abs(avgChange) / 10),
      timeframe: '1-month',
    };
  }

  /**
   * Generate predictions
   */
  private generatePredictions(trends: EvolutionTrend[]): Array<{
    pattern: string;
    prediction: string;
    confidence: number;
  }> {
    return trends
      .filter(t => t.prediction.confidence > 0.6)
      .map(t => ({
        pattern: t.pattern,
        prediction: `Pattern ${t.pattern} is ${t.trend} (${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}%)`,
        confidence: t.prediction.confidence,
      }));
  }

  /**
   * Generate insights
   */
  private generateInsights(trends: EvolutionTrend[], current: EvolutionSnapshot): string[] {
    const insights: string[] = [];

    // Find emerging patterns
    const emerging = trends.filter(t => t.trend === 'emerging');
    if (emerging.length > 0) {
      insights.push(`${emerging.length} new pattern(s) emerging in codebase`);
    }

    // Find declining patterns
    const declining = trends.filter(t => t.trend === 'declining');
    if (declining.length > 0) {
      insights.push(`${declining.length} pattern(s) declining - consider refactoring`);
    }

    // Complexity trend
    if (this.snapshots.length >= 2) {
      const complexityChange = current.metrics.complexity - this.snapshots[0].metrics.complexity;
      if (complexityChange > 10) {
        insights.push('Code complexity is increasing - consider refactoring');
      }
    }

    return insights;
  }

  private async countFiles(projectPath: string): Promise<number> {
    // Simplified
    return 0;
  }

  private async countLines(projectPath: string): Promise<number> {
    // Simplified
    return 0;
  }

  private calculateComplexity(knowledge: KnowledgeBase): number {
    // Simplified complexity metric
    return knowledge.patterns.length * 10;
  }

  private calculateCoupling(knowledge: KnowledgeBase): number {
    // Simplified coupling metric
    let totalConnections = 0;
    for (const [, imports] of knowledge.relationships.imports.entries()) {
      totalConnections += imports.length;
    }
    return totalConnections;
  }

  private async saveSnapshots(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.snapshotsFile,
        JSON.stringify(this.snapshots, null, 2)
      );
    } catch {
      // Error saving
    }
  }

  private async loadSnapshots(): Promise<void> {
    try {
      if (await this.pathExists(this.snapshotsFile)) {
        const content = await fs.promises.readFile(this.snapshotsFile, 'utf8');
        this.snapshots = JSON.parse(content);
      }
    } catch {
      // Error loading
    }
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

export const codeEvolutionTracker = new CodeEvolutionTracker();

