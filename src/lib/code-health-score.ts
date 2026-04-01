/**
 * Code Health Score
 * 
 * Overall health metric with predictions
 * Unique: Comprehensive health scoring with future predictions
 */

import { codeSmellPredictor } from './code-smell-predictor';
import { predictiveQuality } from './predictive-quality';
import { architectureDriftPredictor } from './architecture-drift-predictor';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import * as fs from 'fs';
import * as path from 'path';

export interface HealthMetric {
  category: 'quality' | 'maintainability' | 'security' | 'performance' | 'architecture';
  score: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  prediction: {
    futureScore: number;
    timeframe: string;
    confidence: number;
  };
  issues: number;
  recommendations: string[];
}

export interface HealthScore {
  overall: number; // 0-100
  breakdown: HealthMetric[];
  predictions: {
    nextWeek: number;
    nextMonth: number;
    nextQuarter: number;
  };
  riskFactors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    probability: number;
  }>;
  actionPlan: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    impact: string;
    effort: string;
  }>;
}

class CodeHealthScore {
  /**
   * Calculate comprehensive health score
   */
  async calculateHealth(projectPath: string): Promise<HealthScore> {
    // Get all analysis results
    const [qualityReport, smellReport, driftReport] = await Promise.all([
      predictiveQuality.predict(projectPath),
      codeSmellPredictor.predict(projectPath),
      architectureDriftPredictor.predict(projectPath),
    ]);

    // Calculate metrics for each category
    const quality = this.calculateQualityMetric(qualityReport);
    const maintainability = this.calculateMaintainabilityMetric(smellReport);
    const security = this.calculateSecurityMetric(qualityReport);
    const performance = this.calculatePerformanceMetric(qualityReport);
    const architecture = this.calculateArchitectureMetric(driftReport);

    const breakdown: HealthMetric[] = [
      quality,
      maintainability,
      security,
      performance,
      architecture,
    ];

    // Calculate overall score (weighted average)
    const overall = this.calculateOverallScore(breakdown);

    // Generate predictions
    const predictions = this.generatePredictions(breakdown);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(breakdown, qualityReport, smellReport);

    // Create action plan
    const actionPlan = this.createActionPlan(breakdown, riskFactors);

    return {
      overall,
      breakdown,
      predictions,
      riskFactors,
      actionPlan,
    };
  }

  /**
   * Calculate quality metric
   */
  private calculateQualityMetric(report: QualityReport): HealthMetric {
    const baseScore = 100 - (report.riskScore / 2);
    const issues = report.highRisk;

    return {
      category: 'quality',
      score: Math.max(0, Math.min(100, baseScore)),
      trend: issues > 5 ? 'declining' : issues < 2 ? 'improving' : 'stable',
      prediction: {
        futureScore: Math.max(0, baseScore - (issues * 2)),
        timeframe: '1-month',
        confidence: 0.7,
      },
      issues,
      recommendations: report.recommendations || [],
    };
  }

  /**
   * Calculate maintainability metric
   */
  private calculateMaintainabilityMetric(report: QualityReport): HealthMetric {
    const baseScore = 100 - (report.totalSmells * 2) - (report.critical * 5);
    const issues = report.totalSmells;

    return {
      category: 'maintainability',
      score: Math.max(0, Math.min(100, baseScore)),
      trend: report.trends.some((t) => t.trend === 'worsening') ? 'declining' : 'stable',
      prediction: {
        futureScore: Math.max(0, baseScore - (issues * 1.5)),
        timeframe: '1-month',
        confidence: 0.75,
      },
      issues,
      recommendations: [
        'Refactor long methods',
        'Reduce code duplication',
        'Improve code organization',
      ],
    };
  }

  /**
   * Calculate security metric
   */
  private calculateSecurityMetric(report: QualityReport): HealthMetric {
    const securityPredictions = report.predictions.filter((p) => p.type === 'security');
    const issues = securityPredictions.length;
    const baseScore = 100 - (issues * 10);

    return {
      category: 'security',
      score: Math.max(0, Math.min(100, baseScore)),
      trend: issues > 0 ? 'declining' : 'stable',
      prediction: {
        futureScore: Math.max(0, baseScore - (issues * 5)),
        timeframe: '1-month',
        confidence: 0.8,
      },
      issues,
      recommendations: [
        'Add input validation',
        'Review authentication mechanisms',
        'Audit third-party dependencies',
      ],
    };
  }

  /**
   * Calculate performance metric
   */
  private calculatePerformanceMetric(report: QualityReport): HealthMetric {
    const perfPredictions = report.predictions.filter((p) => p.type === 'performance');
    const issues = perfPredictions.length;
    const baseScore = 100 - (issues * 8);

    return {
      category: 'performance',
      score: Math.max(0, Math.min(100, baseScore)),
      trend: issues > 2 ? 'declining' : 'stable',
      prediction: {
        futureScore: Math.max(0, baseScore - (issues * 4)),
        timeframe: '1-month',
        confidence: 0.7,
      },
      issues,
      recommendations: [
        'Optimize database queries',
        'Implement caching',
        'Review bundle size',
      ],
    };
  }

  /**
   * Calculate architecture metric
   */
  private calculateArchitectureMetric(report: QualityReport): HealthMetric {
    const baseScore = report.overallHealth;
    const issues = report.totalDrifts;

    return {
      category: 'architecture',
      score: baseScore,
      trend: report.critical > 0 ? 'declining' : 'stable',
      prediction: {
        futureScore: Math.max(0, baseScore - (issues * 3)),
        timeframe: '3-months',
        confidence: 0.65,
      },
      issues,
      recommendations: [
        'Align with intended architecture',
        'Reduce coupling',
        'Improve module boundaries',
      ],
    };
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(breakdown: HealthMetric[]): number {
    // Weighted average
    const weights: Record<string, number> = {
      quality: 0.25,
      maintainability: 0.25,
      security: 0.20,
      performance: 0.15,
      architecture: 0.15,
    };

    let total = 0;
    let totalWeight = 0;

    for (const metric of breakdown) {
      const weight = weights[metric.category] || 0.2;
      total += metric.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? total / totalWeight : 0;
  }

  /**
   * Generate predictions
   */
  private generatePredictions(breakdown: HealthMetric[]): HealthScore['predictions'] {
    const avgFutureScore = breakdown.reduce((sum, m) => sum + m.prediction.futureScore, 0) / breakdown.length;
    const trend = breakdown.filter(m => m.trend === 'declining').length;

    return {
      nextWeek: avgFutureScore - (trend * 2),
      nextMonth: avgFutureScore - (trend * 5),
      nextQuarter: avgFutureScore - (trend * 15),
    };
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    breakdown: HealthMetric[],
    qualityReport: any,
    smellReport: any
  ): HealthScore['riskFactors'] {
    const factors: HealthScore['riskFactors'] = [];

    // Low scores
    for (const metric of breakdown) {
      if (metric.score < 50) {
        factors.push({
          factor: `Low ${metric.category} score (${metric.score.toFixed(0)})`,
          impact: 'high',
          probability: 0.8,
        });
      }
    }

    // Declining trends
    const declining = breakdown.filter(m => m.trend === 'declining');
    if (declining.length > 2) {
      factors.push({
        factor: 'Multiple categories declining',
        impact: 'high',
        probability: 0.7,
      });
    }

    // High issue counts
    if (qualityReport.highRisk > 5) {
      factors.push({
        factor: 'High number of quality issues',
        impact: 'medium',
        probability: 0.6,
      });
    }

    if (smellReport.critical > 3) {
      factors.push({
        factor: 'Critical code smells detected',
        impact: 'high',
        probability: 0.8,
      });
    }

    return factors;
  }

  /**
   * Create action plan
   */
  private createActionPlan(
    breakdown: HealthMetric[],
    riskFactors: HealthScore['riskFactors']
  ): HealthScore['actionPlan'] {
    const plan: HealthScore['actionPlan'] = [];

    // Sort by score (lowest first)
    const sorted = [...breakdown].sort((a, b) => a.score - b.score);

    for (const metric of sorted.slice(0, 3)) {
      if (metric.score < 70) {
        plan.push({
          priority: metric.score < 40 ? 'critical' : metric.score < 60 ? 'high' : 'medium',
          action: `Improve ${metric.category} (current: ${metric.score.toFixed(0)})`,
          impact: `Should improve overall score by ~${(70 - metric.score) * 0.2} points`,
          effort: metric.score < 40 ? 'High' : 'Medium',
        });
      }
    }

    // Add risk factor actions
    for (const factor of riskFactors.filter(f => f.impact === 'high')) {
      plan.push({
        priority: 'high',
        action: `Address: ${factor.factor}`,
        impact: 'Reduces risk of future issues',
        effort: 'Medium',
      });
    }

    return plan.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

export const codeHealthScore = new CodeHealthScore();

