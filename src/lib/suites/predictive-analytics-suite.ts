/**
 * Predictive Analytics Suite
 *
 * Unified predictive intelligence combining:
 * - Quality Prediction (future issues)
 * - Anomaly Detection (unusual patterns)
 * - Evolution Tracking (code trends)
 * - Growth Forecasting (project trajectory)
 * - Risk Assessment (failure prediction)
 *
 * Uses historical data to predict future problems before they occur.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";

// ============================================================================
// TYPES
// ============================================================================

export interface PredictiveAnalyticsReport {
  projectPath: string;
  timestamp: string;
  duration: number;

  // Quality predictions
  quality: {
    currentScore: number;
    predictedScore: number;
    trend: "improving" | "stable" | "degrading";
    predictions: QualityPrediction[];
    riskAreas: RiskArea[];
  };

  // Anomaly detection
  anomalies: {
    detected: Anomaly[];
    patterns: AnomalyPattern[];
    alerts: Alert[];
  };

  // Evolution tracking
  evolution: {
    metrics: EvolutionMetric[];
    milestones: Milestone[];
    trajectory: Trajectory;
  };

  // Growth forecasting
  growth: {
    currentSize: ProjectSize;
    projectedSize: ProjectSize;
    growthRate: GrowthRate;
    capacityWarnings: CapacityWarning[];
  };

  // Risk assessment
  risk: {
    overallRisk: number;
    categories: RiskCategory[];
    timeline: RiskTimeline[];
    mitigations: RiskMitigation[];
  };

  // Recommendations
  recommendations: PredictiveRecommendation[];
}

export interface QualityPrediction {
  metric: string;
  current: number;
  predicted: number;
  timeframe: string;
  confidence: number;
  factors: string[];
}

export interface RiskArea {
  path: string;
  riskScore: number;
  factors: string[];
  predictedIssues: number;
  suggestion: string;
}

export interface Anomaly {
  id: string;
  type: "spike" | "drop" | "pattern_break" | "unusual_activity";
  severity: "critical" | "high" | "medium" | "low";
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  timestamp: string;
  context: string;
}

export interface AnomalyPattern {
  name: string;
  description: string;
  frequency: string;
  lastOccurrence: string;
  predictedNext?: string;
}

export interface Alert {
  id: string;
  type: "warning" | "critical";
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  recommendation: string;
}

export interface EvolutionMetric {
  name: string;
  values: { date: string; value: number }[];
  trend: "up" | "down" | "stable";
  changeRate: number;
}

export interface Milestone {
  date: string;
  type: "release" | "refactor" | "growth" | "regression";
  description: string;
  impact: number;
}

export interface Trajectory {
  direction: "positive" | "neutral" | "negative";
  velocity: number;
  acceleration: number;
  predictedState: string;
}

export interface ProjectSize {
  files: number;
  loc: number;
  complexity: number;
  dependencies: number;
  contributors: number;
}

export interface GrowthRate {
  filesPerMonth: number;
  locPerMonth: number;
  complexityPerMonth: number;
  contributorsPerMonth: number;
}

export interface CapacityWarning {
  metric: string;
  currentValue: number;
  threshold: number;
  timeToThreshold: string;
  recommendation: string;
}

export interface RiskCategory {
  name: string;
  score: number;
  trend: "increasing" | "stable" | "decreasing";
  factors: string[];
}

export interface RiskTimeline {
  date: string;
  overallRisk: number;
  events: string[];
}

export interface RiskMitigation {
  risk: string;
  action: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  priority: number;
}

export interface PredictiveRecommendation {
  priority: number;
  category: "quality" | "growth" | "risk" | "maintenance";
  action: string;
  reason: string;
  timeframe: string;
  impact: "high" | "medium" | "low";
}

// ============================================================================
// PREDICTIVE ANALYTICS SUITE
// ============================================================================

class PredictiveAnalyticsSuite {
  /**
   * Run comprehensive predictive analytics
   */
  async analyze(projectPath: string): Promise<PredictiveAnalyticsReport> {
    const startTime = Date.now();

    console.log(`🔮 Predictive Analytics analyzing: ${projectPath}`);

    // Get historical data
    const history = await this.getHistoricalData(projectPath);

    // Predict quality
    const quality = await this.predictQuality(projectPath, history);

    // Detect anomalies
    const anomalies = await this.detectAnomalies(history);

    // Track evolution
    const evolution = await this.trackEvolution(history);

    // Forecast growth
    const growth = await this.forecastGrowth(projectPath, history);

    // Assess risk
    const risk = await this.assessRisk(quality, anomalies, growth);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      quality,
      anomalies,
      growth,
      risk,
    );

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      quality,
      anomalies,
      evolution,
      growth,
      risk,
      recommendations,
    };
  }

  /**
   * Quick risk assessment
   */
  async quickRiskAssessment(projectPath: string): Promise<{
    score: number;
    level: "low" | "medium" | "high" | "critical";
    topRisks: string[];
  }> {
    const history = await this.getHistoricalData(projectPath);
    const quality = await this.predictQuality(projectPath, history);

    const score = quality.currentScore;
    const level =
      score >= 80
        ? "low"
        : score >= 60
          ? "medium"
          : score >= 40
            ? "high"
            : "critical";
    const topRisks = quality.riskAreas.slice(0, 5).map((r) => r.path);

    return { score, level, topRisks };
  }

  // ============================================================================
  // QUALITY PREDICTION
  // ============================================================================

  private async predictQuality(
    projectPath: string,
    history: HistoricalData,
  ): Promise<PredictiveAnalyticsReport["quality"]> {
    // Current quality score
    const currentScore = await this.calculateCurrentQuality(projectPath);

    // Predict future score based on trends
    const trend = this.calculateTrend(history.qualityScores);
    const predictedScore = this.predictFutureValue(history.qualityScores, 30);

    // Generate predictions
    const predictions: QualityPrediction[] = [
      {
        metric: "Code Quality",
        current: currentScore,
        predicted: predictedScore,
        timeframe: "30 days",
        confidence: 0.75,
        factors: this.identifyQualityFactors(history),
      },
      {
        metric: "Technical Debt",
        current: 100 - currentScore,
        predicted: 100 - predictedScore,
        timeframe: "30 days",
        confidence: 0.7,
        factors: ["Complexity growth", "Code churn"],
      },
      {
        metric: "Test Coverage",
        current:
          history.testCoverage.length > 0
            ? history.testCoverage[history.testCoverage.length - 1]
            : 60,
        predicted: this.predictFutureValue(history.testCoverage, 30),
        timeframe: "30 days",
        confidence: 0.65,
        factors: ["Test addition rate", "Code growth rate"],
      },
    ];

    // Identify risk areas
    const riskAreas = await this.identifyRiskAreas(projectPath, history);

    return {
      currentScore,
      predictedScore,
      trend,
      predictions,
      riskAreas,
    };
  }

  private async calculateCurrentQuality(projectPath: string): Promise<number> {
    const files = await this.getSourceFiles(projectPath);
    let totalComplexity = 0;
    let fileCount = 0;

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const complexity = this.calculateComplexity(content);
        totalComplexity += complexity;
        fileCount++;
      } catch {
        // Skip
      }
    }

    const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 10;
    // Convert complexity to quality score (lower complexity = higher quality)
    return Math.max(0, Math.min(100, 100 - avgComplexity * 3));
  }

  private identifyQualityFactors(history: HistoricalData): string[] {
    const factors: string[] = [];

    if (history.complexity.length > 1) {
      const recent = history.complexity.slice(-5);
      const trend = this.calculateTrend(recent.map((c) => c.value));
      if (trend === "degrading") {
        factors.push("Increasing complexity");
      }
    }

    if (history.codeChurn.length > 0) {
      const avgChurn =
        history.codeChurn.reduce((a, b) => a + b, 0) / history.codeChurn.length;
      if (avgChurn > 50) {
        factors.push("High code churn");
      }
    }

    if (history.testCoverage.length > 1) {
      const trend = this.calculateTrend(history.testCoverage);
      if (trend === "degrading") {
        factors.push("Declining test coverage");
      }
    }

    return factors.length > 0 ? factors : ["Normal development patterns"];
  }

  private async identifyRiskAreas(
    projectPath: string,
    history: HistoricalData,
  ): Promise<RiskArea[]> {
    const riskAreas: RiskArea[] = [];
    const files = await this.getSourceFiles(projectPath);

    // Analyze top files by complexity
    const fileComplexity: { path: string; complexity: number }[] = [];

    for (const file of files.slice(0, 30)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const complexity = this.calculateComplexity(content);
        const relativePath = path.relative(projectPath, file);

        fileComplexity.push({ path: relativePath, complexity });
      } catch {
        // Skip
      }
    }

    // Sort by complexity and identify high-risk areas
    const sorted = fileComplexity.sort((a, b) => b.complexity - a.complexity);

    for (const file of sorted.slice(0, 10)) {
      if (file.complexity > 15) {
        riskAreas.push({
          path: file.path,
          riskScore: Math.min(100, file.complexity * 5),
          factors: [
            `High complexity (${file.complexity})`,
            "Potential for bugs",
          ],
          predictedIssues: Math.ceil(file.complexity / 5),
          suggestion: "Consider refactoring to reduce complexity",
        });
      }
    }

    return riskAreas;
  }

  // ============================================================================
  // ANOMALY DETECTION
  // ============================================================================

  private async detectAnomalies(
    history: HistoricalData,
  ): Promise<PredictiveAnalyticsReport["anomalies"]> {
    const detected: Anomaly[] = [];
    const patterns: AnomalyPattern[] = [];
    const alerts: Alert[] = [];

    // Detect complexity anomalies
    if (history.complexity.length > 5) {
      const values = history.complexity.map((c) => c.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
          values.length,
      );

      for (let i = 0; i < history.complexity.length; i++) {
        const deviation = Math.abs(history.complexity[i].value - mean) / stdDev;

        if (deviation > 2) {
          detected.push({
            id: `anomaly-${i}`,
            type: history.complexity[i].value > mean ? "spike" : "drop",
            severity: deviation > 3 ? "critical" : "high",
            metric: "complexity",
            value: history.complexity[i].value,
            expected: mean,
            deviation,
            timestamp: history.complexity[i].date,
            context: `Complexity ${history.complexity[i].value > mean ? "increased" : "decreased"} significantly`,
          });
        }
      }
    }

    // Detect code churn patterns
    if (history.codeChurn.length > 10) {
      const recentChurn = history.codeChurn.slice(-5);
      const avgRecent =
        recentChurn.reduce((a, b) => a + b, 0) / recentChurn.length;
      const historicalAvg =
        history.codeChurn.reduce((a, b) => a + b, 0) / history.codeChurn.length;

      if (avgRecent > historicalAvg * 1.5) {
        patterns.push({
          name: "Increased Code Churn",
          description:
            "Recent code changes are significantly higher than historical average",
          frequency: "Recent",
          lastOccurrence: new Date().toISOString(),
        });

        alerts.push({
          id: "alert-churn",
          type: "warning",
          message: "Code churn is 50% above normal",
          metric: "code_churn",
          threshold: historicalAvg * 1.5,
          currentValue: avgRecent,
          recommendation: "Review recent changes for potential instability",
        });
      }
    }

    return {
      detected,
      patterns,
      alerts,
    };
  }

  // ============================================================================
  // EVOLUTION TRACKING
  // ============================================================================

  private async trackEvolution(
    history: HistoricalData,
  ): Promise<PredictiveAnalyticsReport["evolution"]> {
    const metrics: EvolutionMetric[] = [];

    // Complexity evolution
    if (history.complexity.length > 0) {
      metrics.push({
        name: "Complexity",
        values: history.complexity.map((c) => ({
          date: c.date,
          value: c.value,
        })),
        trend: this.calculateTrendDirection(
          history.complexity.map((c) => c.value),
        ),
        changeRate: this.calculateChangeRate(
          history.complexity.map((c) => c.value),
        ),
      });
    }

    // File count evolution
    if (history.fileCount.length > 0) {
      metrics.push({
        name: "File Count",
        values: history.fileCount.map((f) => ({
          date: f.date,
          value: f.value,
        })),
        trend: this.calculateTrendDirection(
          history.fileCount.map((f) => f.value),
        ),
        changeRate: this.calculateChangeRate(
          history.fileCount.map((f) => f.value),
        ),
      });
    }

    // LOC evolution
    if (history.loc.length > 0) {
      metrics.push({
        name: "Lines of Code",
        values: history.loc.map((l) => ({ date: l.date, value: l.value })),
        trend: this.calculateTrendDirection(history.loc.map((l) => l.value)),
        changeRate: this.calculateChangeRate(history.loc.map((l) => l.value)),
      });
    }

    // Detect milestones
    const milestones = this.detectMilestones(history);

    // Calculate trajectory
    const trajectory = this.calculateTrajectory(metrics);

    return {
      metrics,
      milestones,
      trajectory,
    };
  }

  private detectMilestones(history: HistoricalData): Milestone[] {
    const milestones: Milestone[] = [];

    // Detect significant changes in metrics
    if (history.loc.length > 5) {
      for (let i = 1; i < history.loc.length; i++) {
        const change =
          (history.loc[i].value - history.loc[i - 1].value) /
          history.loc[i - 1].value;

        if (Math.abs(change) > 0.2) {
          milestones.push({
            date: history.loc[i].date,
            type: change > 0 ? "growth" : "refactor",
            description: `${change > 0 ? "Added" : "Removed"} ${Math.abs(Math.round(change * 100))}% of codebase`,
            impact: Math.abs(change),
          });
        }
      }
    }

    return milestones.slice(0, 10);
  }

  private calculateTrajectory(metrics: EvolutionMetric[]): Trajectory {
    let positiveCount = 0;
    let negativeCount = 0;
    let totalVelocity = 0;

    for (const metric of metrics) {
      if (metric.name === "Complexity") {
        // Lower complexity is better
        if (metric.trend === "down") positiveCount++;
        else if (metric.trend === "up") negativeCount++;
      } else {
        // Growth is generally positive
        if (metric.trend === "up") positiveCount++;
        else if (metric.trend === "down") negativeCount++;
      }
      totalVelocity += Math.abs(metric.changeRate);
    }

    const direction =
      positiveCount > negativeCount
        ? "positive"
        : negativeCount > positiveCount
          ? "negative"
          : "neutral";

    return {
      direction,
      velocity: totalVelocity / metrics.length,
      acceleration: 0, // Would need more historical data
      predictedState:
        direction === "positive"
          ? "Improving health"
          : direction === "negative"
            ? "Declining health"
            : "Stable",
    };
  }

  // ============================================================================
  // GROWTH FORECASTING
  // ============================================================================

  private async forecastGrowth(
    projectPath: string,
    history: HistoricalData,
  ): Promise<PredictiveAnalyticsReport["growth"]> {
    // Current size
    const files = await this.getSourceFiles(projectPath);
    let totalLoc = 0;
    let totalComplexity = 0;

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        totalLoc += content.split("\n").length;
        totalComplexity += this.calculateComplexity(content);
      } catch {
        // Skip
      }
    }

    const currentSize: ProjectSize = {
      files: files.length,
      loc: totalLoc,
      complexity: totalComplexity,
      dependencies: await this.countDependencies(projectPath),
      contributors: history.contributors || 1,
    };

    // Calculate growth rates
    const growthRate: GrowthRate = {
      filesPerMonth: this.calculateGrowthRate(
        history.fileCount.map((f) => f.value),
      ),
      locPerMonth: this.calculateGrowthRate(history.loc.map((l) => l.value)),
      complexityPerMonth: this.calculateGrowthRate(
        history.complexity.map((c) => c.value),
      ),
      contributorsPerMonth: 0,
    };

    // Project 6 months ahead
    const projectedSize: ProjectSize = {
      files: Math.round(currentSize.files + growthRate.filesPerMonth * 6),
      loc: Math.round(currentSize.loc + growthRate.locPerMonth * 6),
      complexity: Math.round(
        currentSize.complexity + growthRate.complexityPerMonth * 6,
      ),
      dependencies: currentSize.dependencies,
      contributors: currentSize.contributors,
    };

    // Generate capacity warnings
    const capacityWarnings: CapacityWarning[] = [];

    if (projectedSize.loc > 100000) {
      capacityWarnings.push({
        metric: "Lines of Code",
        currentValue: currentSize.loc,
        threshold: 100000,
        timeToThreshold: this.estimateTimeToThreshold(
          currentSize.loc,
          100000,
          growthRate.locPerMonth,
        ),
        recommendation: "Consider modularizing the codebase",
      });
    }

    if (projectedSize.complexity > 1000) {
      capacityWarnings.push({
        metric: "Total Complexity",
        currentValue: currentSize.complexity,
        threshold: 1000,
        timeToThreshold: this.estimateTimeToThreshold(
          currentSize.complexity,
          1000,
          growthRate.complexityPerMonth,
        ),
        recommendation: "Focus on reducing complexity through refactoring",
      });
    }

    return {
      currentSize,
      projectedSize,
      growthRate,
      capacityWarnings,
    };
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];
    const months = values.length; // Assuming monthly data

    return (last - first) / months;
  }

  private estimateTimeToThreshold(
    current: number,
    threshold: number,
    rate: number,
  ): string {
    if (rate <= 0 || current >= threshold) return "N/A";

    const months = (threshold - current) / rate;

    if (months < 1) return "Less than 1 month";
    if (months < 12) return `${Math.round(months)} months`;
    return `${Math.round(months / 12)} years`;
  }

  // ============================================================================
  // RISK ASSESSMENT
  // ============================================================================

  private async assessRisk(
    quality: PredictiveAnalyticsReport["quality"],
    anomalies: PredictiveAnalyticsReport["anomalies"],
    growth: PredictiveAnalyticsReport["growth"],
  ): Promise<PredictiveAnalyticsReport["risk"]> {
    // Calculate category risks
    const categories: RiskCategory[] = [
      {
        name: "Code Quality",
        score: 100 - quality.currentScore,
        trend:
          quality.trend === "degrading"
            ? "increasing"
            : quality.trend === "improving"
              ? "decreasing"
              : "stable",
        factors: quality.predictions[0]?.factors || [],
      },
      {
        name: "Technical Debt",
        score: Math.min(
          100,
          quality.riskAreas.reduce((sum, r) => sum + r.riskScore, 0) / 10,
        ),
        trend: "stable",
        factors: ["Complexity accumulation", "Delayed refactoring"],
      },
      {
        name: "Scalability",
        score: growth.capacityWarnings.length * 25,
        trend: growth.growthRate.locPerMonth > 1000 ? "increasing" : "stable",
        factors: growth.capacityWarnings.map((w) => w.metric),
      },
      {
        name: "Stability",
        score: anomalies.detected.length * 10,
        trend: anomalies.detected.length > 0 ? "increasing" : "stable",
        factors: anomalies.detected.map((a) => a.metric),
      },
    ];

    // Calculate overall risk
    const overallRisk = Math.round(
      categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
    );

    // Generate risk timeline
    const timeline: RiskTimeline[] = [
      {
        date: new Date().toISOString(),
        overallRisk,
        events: anomalies.alerts.map((a) => a.message),
      },
    ];

    // Generate mitigations
    const mitigations = this.generateMitigations(categories, quality, growth);

    return {
      overallRisk,
      categories,
      timeline,
      mitigations,
    };
  }

  private generateMitigations(
    categories: RiskCategory[],
    quality: PredictiveAnalyticsReport["quality"],
    growth: PredictiveAnalyticsReport["growth"],
  ): RiskMitigation[] {
    const mitigations: RiskMitigation[] = [];

    // Quality mitigations
    if (quality.currentScore < 70) {
      mitigations.push({
        risk: "Low Code Quality",
        action: "Implement code review process and quality gates",
        effort: "medium",
        impact: "high",
        priority: 1,
      });
    }

    // Risk area mitigations
    for (const area of quality.riskAreas.slice(0, 3)) {
      mitigations.push({
        risk: `High complexity in ${area.path}`,
        action: area.suggestion,
        effort: "high",
        impact: "medium",
        priority: 2,
      });
    }

    // Growth mitigations
    for (const warning of growth.capacityWarnings) {
      mitigations.push({
        risk: `${warning.metric} approaching limit`,
        action: warning.recommendation,
        effort: "high",
        impact: "high",
        priority: 3,
      });
    }

    return mitigations.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  private generateRecommendations(
    quality: PredictiveAnalyticsReport["quality"],
    anomalies: PredictiveAnalyticsReport["anomalies"],
    growth: PredictiveAnalyticsReport["growth"],
    risk: PredictiveAnalyticsReport["risk"],
  ): PredictiveRecommendation[] {
    const recommendations: PredictiveRecommendation[] = [];

    // Quality recommendations
    if (quality.predictedScore < quality.currentScore - 5) {
      recommendations.push({
        priority: 1,
        category: "quality",
        action: "Address declining code quality",
        reason: `Quality predicted to drop from ${quality.currentScore} to ${quality.predictedScore}`,
        timeframe: "30 days",
        impact: "high",
      });
    }

    // Anomaly recommendations
    const criticalAnomalies = anomalies.detected.filter(
      (a) => a.severity === "critical",
    );
    if (criticalAnomalies.length > 0) {
      recommendations.push({
        priority: 1,
        category: "maintenance",
        action: `Investigate ${criticalAnomalies.length} critical anomalies`,
        reason: "Unusual patterns detected that may indicate problems",
        timeframe: "Immediate",
        impact: "high",
      });
    }

    // Growth recommendations
    if (growth.capacityWarnings.length > 0) {
      recommendations.push({
        priority: 2,
        category: "growth",
        action: "Plan for scaling",
        reason: `${growth.capacityWarnings.length} capacity warning(s) detected`,
        timeframe: growth.capacityWarnings[0]?.timeToThreshold || "6 months",
        impact: "medium",
      });
    }

    // Risk recommendations
    if (risk.overallRisk > 50) {
      recommendations.push({
        priority: 1,
        category: "risk",
        action: "Implement risk mitigation plan",
        reason: `Overall risk score is ${risk.overallRisk}%`,
        timeframe: "30 days",
        impact: "high",
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private async getHistoricalData(
    projectPath: string,
  ): Promise<HistoricalData> {
    // Try to get git history for metrics
    const history: HistoricalData = {
      qualityScores: [],
      complexity: [],
      loc: [],
      fileCount: [],
      testCoverage: [],
      codeChurn: [],
      contributors: 1,
    };

    try {
      // Get commit history
      const result = execSync(
        'git log --pretty=format:"%aI" --numstat -n 100',
        {
          cwd: projectPath,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      // Parse and aggregate by date
      const lines = result.split("\n");
      const dateStats = new Map<
        string,
        { added: number; removed: number; files: number }
      >();
      let currentDate = "";

      for (const line of lines) {
        if (line.match(/^\d{4}-\d{2}/)) {
          currentDate = line.split("T")[0];
          if (!dateStats.has(currentDate)) {
            dateStats.set(currentDate, { added: 0, removed: 0, files: 0 });
          }
        } else if (line.match(/^\d+\s+\d+/) && currentDate) {
          const [added, removed] = line.split("\t").map(Number);
          const stats = dateStats.get(currentDate)!;
          stats.added += added || 0;
          stats.removed += removed || 0;
          stats.files++;
        }
      }

      // Build history arrays
      let cumulativeLoc = 0;
      let cumulativeFiles = 0;

      for (const [date, stats] of dateStats) {
        cumulativeLoc += stats.added - stats.removed;
        cumulativeFiles += stats.files > 0 ? 1 : 0;

        history.loc.push({ date, value: Math.max(0, cumulativeLoc) });
        history.fileCount.push({ date, value: cumulativeFiles });
        history.codeChurn.push(stats.added + stats.removed);
        history.complexity.push({
          date,
          value: Math.ceil(cumulativeLoc / 100),
        }); // Estimate
      }

      // Get contributor count
      const contributors = execSync("git shortlog -sn --no-merges | wc -l", {
        cwd: projectPath,
        encoding: "utf-8",
      });
      history.contributors = parseInt(contributors.trim(), 10) || 1;
    } catch {
      // No git history available
    }

    return history;
  }

  private calculateTrend(
    values: number[],
  ): "improving" | "stable" | "degrading" {
    if (values.length < 2) return "stable";

    const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const historicalAvg =
      values.slice(0, -3).reduce((a, b) => a + b, 0) /
      Math.max(1, values.length - 3);

    const change = (recentAvg - historicalAvg) / historicalAvg;

    if (change > 0.1) return "improving";
    if (change < -0.1) return "degrading";
    return "stable";
  }

  private calculateTrendDirection(values: number[]): "up" | "down" | "stable" {
    if (values.length < 2) return "stable";

    const first =
      values.slice(0, Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) /
      Math.ceil(values.length / 2);
    const second =
      values.slice(Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) /
      Math.floor(values.length / 2);

    const change = (second - first) / first;

    if (change > 0.05) return "up";
    if (change < -0.05) return "down";
    return "stable";
  }

  private calculateChangeRate(values: number[]): number {
    if (values.length < 2) return 0;
    return (values[values.length - 1] - values[0]) / values.length;
  }

  private predictFutureValue(values: number[], daysAhead: number): number {
    if (values.length < 2) return values[0] || 0;

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const futureX = n + daysAhead / 30; // Assuming monthly data
    return Math.max(0, intercept + slope * futureX);
  }

  private calculateComplexity(code: string): number {
    const decisions = (
      code.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []
    ).length;
    return decisions + 1;
  }

  private async countDependencies(projectPath: string): Promise<number> {
    try {
      const content = await fs.readFile(
        path.join(projectPath, "package.json"),
        "utf-8",
      );
      const pkg = JSON.parse(content);
      return (
        Object.keys(pkg.dependencies || {}).length +
        Object.keys(pkg.devDependencies || {}).length
      );
    } catch {
      return 0;
    }
  }

  private async getSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    const excludedDirs = ["node_modules", ".git", "dist", "build", ".next"];
    const files: string[] = [];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !excludedDirs.includes(entry.name)) {
            await walk(fullPath);
          } else if (
            entry.isFile() &&
            extensions.some((ext) => entry.name.endsWith(ext))
          ) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip
      }
    };

    await walk(projectPath);
    return files;
  }
}

interface HistoricalData {
  qualityScores: number[];
  complexity: { date: string; value: number }[];
  loc: { date: string; value: number }[];
  fileCount: { date: string; value: number }[];
  testCoverage: number[];
  codeChurn: number[];
  contributors: number;
}

export const predictiveAnalyticsSuite = new PredictiveAnalyticsSuite();
export default predictiveAnalyticsSuite;
