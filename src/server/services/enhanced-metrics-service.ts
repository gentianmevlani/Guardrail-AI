/**
 * Enhanced Metrics Service
 *
 * Advanced analytics and metrics tracking with:
 * - Time-series data storage
 * - Real-time aggregation
 * - Custom dashboards
 * - Predictive analytics
 * - Export capabilities
 * - Performance monitoring
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";
import { EventEmitter } from "events";
// import { prisma } from '@guardrail/database';

// Enhanced Types
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  type: "counter" | "gauge" | "histogram" | "timer";
  unit: string;
  aggregation: "sum" | "avg" | "min" | "max" | "p50" | "p95" | "p99";
  retention: "1h" | "1d" | "1w" | "1M" | "1y";
  dimensions: string[];
}

export interface GuardrailMetrics {
  totalChecks: number;
  errorsCaught: number;
  warningsIssued: number;
  criticalIssues: number;
  successRate: number;
  trend: {
    direction: "up" | "down" | "stable";
    percentage: number;
    period: "1h" | "1d" | "1w" | "1M";
  };
  distribution: {
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byFile: Array<{ file: string; count: number }>;
  };
}

export interface CodeQualityMetrics {
  score: number;
  trend: {
    direction: "improving" | "declining" | "stable";
    percentage: number;
    period: string;
  };
  metrics: {
    complexity: { avg: number; trend: number };
    maintainability: { avg: number; trend: number };
    testCoverage: { avg: number; trend: number };
    duplication: { avg: number; trend: number };
    technicalDebt: { hours: number; cost: number };
  };
  hotspots: Array<{
    file: string;
    score: number;
    issues: number;
    complexity: number;
  }>;
}

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    trend: number;
  };
  throughput: {
    requests: number;
    rate: number;
    peak: number;
  };
  resources: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  errors: {
    rate: number;
    types: Record<string, number>;
    critical: number;
  };
}

export interface TeamMetrics {
  productivity: {
    commitsPerDay: number;
    prsMerged: number;
    issuesClosed: number;
    linesOfCode: number;
  };
  collaboration: {
    activeMembers: number;
    pairProgrammingSessions: number;
    codeReviews: number;
    knowledgeSharing: number;
  };
  quality: {
    avgPrTime: number;
    reworkRate: number;
    bugEscapeRate: number;
    customerIssues: number;
  };
}

export interface ActivityItem {
  id: string;
  type:
    | "fix"
    | "validation"
    | "rule"
    | "sync"
    | "scan"
    | "analyze"
    | "deploy"
    | "rollback"
    | "incident";
  message: string;
  timestamp: Date;
  user?: string;
  userAvatar?: string;
  severity: "info" | "warning" | "error" | "critical";
  metadata?: {
    duration?: number;
    impact?: string;
    relatedIssues?: string[];
    tags?: string[];
  };
}

export interface MetricsData {
  guardrailEffectiveness: GuardrailMetrics;
  codeQuality: CodeQualityMetrics;
  performance: PerformanceMetrics;
  team: TeamMetrics;
  recentActivity: ActivityItem[];
  predictions: {
    qualityTrend: number;
    riskScore: number;
    recommendationCount: number;
  };
  timeRange: "1h" | "1d" | "1w" | "1M" | "3M" | "6M" | "1y";
  generatedAt: Date;
  refreshInterval: number;
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  filters: Record<string, any>;
  refreshInterval: number;
  shared: boolean;
}

export interface Widget {
  id: string;
  type: "chart" | "metric" | "table" | "heatmap" | "gauge" | "trend";
  title: string;
  query: string;
  visualization: {
    chartType?: "line" | "bar" | "pie" | "area" | "scatter";
    colors?: string[];
    axes?: Record<string, any>;
    thresholds?: Array<{ value: number; color: string; label: string }>;
  };
  size: { w: number; h: number; x: number; y: number };
}

class EnhancedMetricsService extends EventEmitter {
  private metrics: Map<string, TimeSeriesPoint[]> = new Map();
  private definitions: Map<string, MetricDefinition> = new Map();
  private dashboards: Map<string, DashboardConfig> = new Map();
  private activityBuffer: ActivityItem[] = [];
  private aggregationCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BUFFER_SIZE = 10000;
  private readonly FLUSH_INTERVAL = 30 * 1000; // 30 seconds

  constructor() {
    super();
    this.initializeMetricDefinitions();
    this.startPeriodicFlush();
    this.loadPersistedData();
  }

  /**
   * Record a metric value
   */
  recordMetric(
    metricId: string,
    value: number,
    metadata?: any,
    tags?: Record<string, string>,
  ): void {
    const point: TimeSeriesPoint = {
      timestamp: new Date(),
      value,
      metadata,
      tags,
    };

    if (!this.metrics.has(metricId)) {
      this.metrics.set(metricId, []);
    }

    const series = this.metrics.get(metricId)!;
    series.push(point);

    // Enforce retention
    const definition = this.definitions.get(metricId);
    if (definition) {
      const cutoff = this.calculateRetentionCutoff(definition.retention);
      while (series.length > 0 && series[0].timestamp < cutoff) {
        series.shift();
      }
    }

    // Emit event for real-time updates
    this.emit("metric", { metricId, point });
  }

  /**
   * Record an activity event
   */
  recordActivity(activity: Omit<ActivityItem, "id">): void {
    const fullActivity: ActivityItem = {
      ...activity,
      id: this.generateId(),
    };

    this.activityBuffer.push(fullActivity);

    // Keep buffer size manageable
    if (this.activityBuffer.length > this.BUFFER_SIZE) {
      this.activityBuffer = this.activityBuffer.slice(-this.BUFFER_SIZE / 2);
    }

    // Emit event
    this.emit("activity", fullActivity);

    // Store in database if critical
    if (activity.severity === "critical" || activity.type === "incident") {
      this.persistActivity(fullActivity);
    }
  }

  /**
   * Get aggregated metrics for a time range
   */
  async getMetrics(
    metricIds: string[],
    timeRange: "1h" | "1d" | "1w" | "1M" | "3M" | "6M" | "1y",
    aggregation?: string,
  ): Promise<Record<string, any>> {
    const cacheKey = `${metricIds.join(",")}:${timeRange}:${aggregation}`;
    const cached = this.aggregationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const result: Record<string, any> = {};
    const now = new Date();
    const startTime = this.calculateStartTime(now, timeRange);

    for (const metricId of metricIds) {
      const series = this.metrics.get(metricId) || [];
      const filtered = series.filter((p) => p.timestamp >= startTime);

      if (filtered.length === 0) {
        result[metricId] = null;
        continue;
      }

      const definition = this.definitions.get(metricId);
      const aggFn = aggregation || definition?.aggregation || "avg";

      result[metricId] = this.aggregate(filtered, aggFn);
    }

    // Cache result
    this.aggregationCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Generate comprehensive metrics dashboard
   */
  async generateDashboard(
    timeRange: "1d" | "1w" | "1M" | "3M" = "1M",
  ): Promise<MetricsData> {
    const now = new Date();
    const startTime = this.calculateStartTime(now, timeRange);

    // Gather all metrics
    const [guardrailMetrics, qualityMetrics, performanceMetrics, teamMetrics] =
      await Promise.all([
        this.calculateGuardrailMetrics(startTime, now),
        this.calculateCodeQualityMetrics(startTime, now),
        this.calculatePerformanceMetrics(startTime, now),
        this.calculateTeamMetrics(startTime, now),
      ]);

    // Get recent activity
    const recentActivity = this.activityBuffer
      .filter((a) => a.timestamp >= startTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);

    // Generate predictions
    const predictions = await this.generatePredictions(timeRange);

    return {
      guardrailEffectiveness: guardrailMetrics,
      codeQuality: qualityMetrics,
      performance: performanceMetrics,
      team: teamMetrics,
      recentActivity,
      predictions,
      timeRange,
      generatedAt: now,
      refreshInterval: this.CACHE_TTL,
    };
  }

  /**
   * Create custom dashboard
   */
  createDashboard(config: Omit<DashboardConfig, "id">): string {
    const dashboard: DashboardConfig = {
      ...config,
      id: this.generateId(),
    };

    this.dashboards.set(dashboard.id, dashboard);
    this.persistDashboard(dashboard);

    this.emit("dashboardCreated", dashboard);
    return dashboard.id;
  }

  /**
   * Export metrics in various formats
   */
  async exportMetrics(
    format: "json" | "csv" | "xlsx" | "pdf",
    metricIds: string[],
    timeRange: string,
  ): Promise<Buffer> {
    const data = await this.getMetrics(metricIds, timeRange as any);

    switch (format) {
      case "json":
        return Buffer.from(JSON.stringify(data, null, 2));

      case "csv":
        return this.convertToCSV(data);

      case "xlsx":
        return this.convertToXLSX(data);

      case "pdf":
        return this.convertToPDF(data);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Calculate guardrail effectiveness metrics
   */
  private async calculateGuardrailMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<GuardrailMetrics> {
    const totalChecks = await this.aggregateMetric(
      "guardrail.checks.total",
      startTime,
      endTime,
      "sum",
    );
    const errorsCaught = await this.aggregateMetric(
      "guardrail.errors.caught",
      startTime,
      endTime,
      "sum",
    );
    const warningsIssued = await this.aggregateMetric(
      "guardrail.warnings.issued",
      startTime,
      endTime,
      "sum",
    );
    const criticalIssues = await this.aggregateMetric(
      "guardrail.issues.critical",
      startTime,
      endTime,
      "sum",
    );

    const successRate =
      totalChecks > 0 ? ((totalChecks - errorsCaught) / totalChecks) * 100 : 0;

    // Calculate trend
    const previousPeriod = new Date(
      startTime.getTime() - (endTime.getTime() - startTime.getTime()),
    );
    const previousSuccess = await this.calculateSuccessRate(
      previousPeriod,
      startTime,
    );
    const trendValue = this.calculateTrend(previousSuccess, successRate);
    const trend: {
      direction: "up" | "down" | "stable";
      percentage: number;
      period: "1h" | "1d" | "1w" | "1M";
    } = {
      direction: trendValue > 5 ? "up" : trendValue < -5 ? "down" : "stable",
      percentage: Math.abs(trendValue),
      period: "1d",
    };

    // Get distribution data
    const distribution = await this.getDistributionData(startTime, endTime);

    return {
      totalChecks,
      errorsCaught,
      warningsIssued,
      criticalIssues,
      successRate,
      trend,
      distribution,
    };
  }

  /**
   * Calculate code quality metrics
   */
  private async calculateCodeQualityMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<CodeQualityMetrics> {
    const score = await this.aggregateMetric(
      "code.quality.score",
      startTime,
      endTime,
      "avg",
    );
    const complexity = await this.aggregateMetric(
      "code.complexity.avg",
      startTime,
      endTime,
      "avg",
    );
    const maintainability = await this.aggregateMetric(
      "code.maintainability.avg",
      startTime,
      endTime,
      "avg",
    );
    const testCoverage = await this.aggregateMetric(
      "code.coverage.avg",
      startTime,
      endTime,
      "avg",
    );
    const duplication = await this.aggregateMetric(
      "code.duplication.avg",
      startTime,
      endTime,
      "avg",
    );

    // Calculate trends
    const previousPeriod = new Date(
      startTime.getTime() - (endTime.getTime() - startTime.getTime()),
    );
    const previousScore = await this.aggregateMetric(
      "code.quality.score",
      previousPeriod,
      startTime,
      "avg",
    );
    const trend = this.calculateTrend(previousScore, score);

    // Calculate technical debt
    const debtHours = await this.aggregateMetric(
      "code.debt.hours",
      startTime,
      endTime,
      "sum",
    );
    const debtCost = debtHours * 150; // $150/hour average

    // Find quality hotspots
    const hotspots = await this.getQualityHotspots(startTime, endTime);

    return {
      score,
      trend: {
        direction:
          trend > 5 ? "improving" : trend < -5 ? "declining" : "stable",
        percentage: Math.abs(trend),
        period: "30d",
      },
      metrics: {
        complexity: {
          avg: complexity,
          trend: await this.getMetricTrend(
            "code.complexity.avg",
            startTime,
            endTime,
          ),
        },
        maintainability: {
          avg: maintainability,
          trend: await this.getMetricTrend(
            "code.maintainability.avg",
            startTime,
            endTime,
          ),
        },
        testCoverage: {
          avg: testCoverage,
          trend: await this.getMetricTrend(
            "code.coverage.avg",
            startTime,
            endTime,
          ),
        },
        duplication: {
          avg: duplication,
          trend: await this.getMetricTrend(
            "code.duplication.avg",
            startTime,
            endTime,
          ),
        },
        technicalDebt: { hours: debtHours, cost: debtCost },
      },
      hotspots,
    };
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<PerformanceMetrics> {
    const responseTime = await this.calculateResponseTimeMetrics(
      startTime,
      endTime,
    );
    const throughput = await this.calculateThroughputMetrics(
      startTime,
      endTime,
    );
    const resources = await this.getResourceMetrics(startTime, endTime);
    const errors = await this.getErrorMetrics(startTime, endTime);

    return {
      responseTime,
      throughput,
      resources,
      errors,
    };
  }

  /**
   * Calculate team productivity metrics
   */
  private async calculateTeamMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<TeamMetrics> {
    const productivity = await this.getProductivityMetrics(startTime, endTime);
    const collaboration = await this.getCollaborationMetrics(
      startTime,
      endTime,
    );
    const quality = await this.getTeamQualityMetrics(startTime, endTime);

    return {
      productivity,
      collaboration,
      quality,
    };
  }

  /**
   * Generate predictive analytics
   */
  private async generatePredictions(timeRange: string): Promise<any> {
    // Use machine learning models or statistical analysis
    const qualityTrend = await this.predictQualityTrend(timeRange);
    const riskScore = await this.calculateRiskScore();
    const recommendationCount = await this.generateRecommendations();

    return {
      qualityTrend,
      riskScore,
      recommendationCount,
    };
  }

  /**
   * Helper methods
   */
  private initializeMetricDefinitions(): void {
    const definitions: MetricDefinition[] = [
      {
        id: "guardrail.checks.total",
        name: "Total guardrail Checks",
        description: "Total number of guardrail checks performed",
        type: "counter",
        unit: "count",
        aggregation: "sum",
        retention: "1y",
        dimensions: ["project", "user", "type"],
      },
      {
        id: "guardrail.errors.caught",
        name: "Errors Caught",
        description: "Number of errors caught by guardrails",
        type: "counter",
        unit: "count",
        aggregation: "sum",
        retention: "1y",
        dimensions: ["severity", "category", "file"],
      },
      {
        id: "code.quality.score",
        name: "Code Quality Score",
        description: "Overall code quality score (0-100)",
        type: "gauge",
        unit: "score",
        aggregation: "avg",
        retention: "1y",
        dimensions: ["project", "file"],
      },
      // Add more definitions...
    ];

    for (const def of definitions) {
      this.definitions.set(def.id, def);
    }
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flushToDatabase();
    }, this.FLUSH_INTERVAL);
  }

  private async flushToDatabase(): Promise<void> {
    try {
      // Flush metrics to database
      for (const [metricId, series] of this.metrics) {
        // Implementation would depend on your database schema
        // await this.persistMetrics(metricId, series);
      }

      // Flush activity buffer
      if (this.activityBuffer.length > 0) {
        const activities = this.activityBuffer.splice(0);
        // await this.persistActivities(activities);
      }
    } catch (error) {
      console.error("Failed to flush metrics to database:", error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      // Load recent metrics from database
      // Implementation would depend on your database schema
    } catch (error) {
      console.error("Failed to load persisted metrics:", error);
    }
  }

  private generateId(): string {
    return createHash("md5")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 16);
  }

  private calculateRetentionCutoff(retention: string): Date {
    const now = new Date();
    const duration: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - duration[retention]);
  }

  private calculateStartTime(now: Date, range: string): Date {
    const durations: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
      "3M": 90 * 24 * 60 * 60 * 1000,
      "6M": 180 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - durations[range]);
  }

  private aggregate(points: TimeSeriesPoint[], method: string): number {
    if (points.length === 0) return 0;

    const values = points.map((p) => p.value);

    switch (method) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "p50":
        return this.percentile(values, 0.5);
      case "p95":
        return this.percentile(values, 0.95);
      case "p99":
        return this.percentile(values, 0.99);
      default:
        return values[values.length - 1];
    }
  }

  private percentile(values: number[], p: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateTrend(previous: number, current: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  private async aggregateMetric(
    metricId: string,
    start: Date,
    end: Date,
    method: string,
  ): Promise<number> {
    const series = this.metrics.get(metricId) || [];
    const filtered = series.filter(
      (p) => p.timestamp >= start && p.timestamp <= end,
    );
    return this.aggregate(filtered, method);
  }

  private async persistActivity(activity: ActivityItem): Promise<void> {
    try {
      // Save to database
      // await prisma.activity.create({ data: activity });
    } catch (error) {
      console.error("Failed to persist activity:", error);
    }
  }

  private async persistDashboard(dashboard: DashboardConfig): Promise<void> {
    try {
      // Save to database
      // await prisma.dashboard.upsert({ where: { id: dashboard.id }, data: dashboard });
    } catch (error) {
      console.error("Failed to persist dashboard:", error);
    }
  }

  // Additional helper methods for calculations would be implemented here
  private async calculateSuccessRate(start: Date, end: Date): Promise<number> {
    // Implementation
    return 0;
  }

  private async getDistributionData(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      bySeverity: {},
      byCategory: {},
      byFile: [],
    };
  }

  private async getQualityHotspots(start: Date, end: Date): Promise<any[]> {
    // Implementation
    return [];
  }

  private async calculateResponseTimeMetrics(
    start: Date,
    end: Date,
  ): Promise<any> {
    // Implementation
    return {
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      trend: 0,
    };
  }

  private async calculateThroughputMetrics(
    start: Date,
    end: Date,
  ): Promise<any> {
    // Implementation
    return {
      requests: 0,
      rate: 0,
      peak: 0,
    };
  }

  private async getResourceMetrics(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
    };
  }

  private async getErrorMetrics(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      rate: 0,
      types: {},
      critical: 0,
    };
  }

  private async getProductivityMetrics(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      commitsPerDay: 0,
      prsMerged: 0,
      issuesClosed: 0,
      linesOfCode: 0,
    };
  }

  private async getCollaborationMetrics(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      activeMembers: 0,
      pairProgrammingSessions: 0,
      codeReviews: 0,
      knowledgeSharing: 0,
    };
  }

  private async getTeamQualityMetrics(start: Date, end: Date): Promise<any> {
    // Implementation
    return {
      avgPrTime: 0,
      reworkRate: 0,
      bugEscapeRate: 0,
      customerIssues: 0,
    };
  }

  private async predictQualityTrend(timeRange: string): Promise<number> {
    // Implementation would use ML models
    return 0;
  }

  private async calculateRiskScore(): Promise<number> {
    // Implementation
    return 0;
  }

  private async generateRecommendations(): Promise<number> {
    // Implementation
    return 0;
  }

  private async getMetricTrend(
    metricId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    // Implementation
    return 0;
  }

  private convertToCSV(data: any): Buffer {
    // Implementation
    return Buffer.from("");
  }

  private convertToXLSX(data: any): Buffer {
    // Implementation
    return Buffer.from("");
  }

  private convertToPDF(data: any): Buffer {
    // Implementation
    return Buffer.from("");
  }
}

export const enhancedMetricsService = new EnhancedMetricsService();
