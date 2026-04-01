/**
 * Enhanced Performance Monitor
 * 
 * Advanced performance monitoring with real-time metrics, optimization recommendations,
 * and performance dashboards.
 * Unique: Predictive performance analysis and automatic optimization suggestions.
 * 
 * @module enhanced-performance-monitor
 * @example
 * ```typescript
 * const monitor = new EnhancedPerformanceMonitor();
 * await monitor.initialize();
 * 
 * // Track operation
 * await monitor.track('code-analysis', async () => {
 *   return await analyzeCodebase();
 * });
 * 
 * // Get insights
 * const insights = await monitor.getInsights();
 * ```
 */

import { performanceMonitor } from './performance-monitor';
import type { PerformanceMetrics, PerformanceInsights } from './performance-monitor';
import * as fs from 'fs';
import * as path from 'path';

export interface EnhancedPerformanceMetrics extends PerformanceMetrics {
  operation: string;
  category: 'analysis' | 'validation' | 'generation' | 'search' | 'sync' | 'other';
  fileCount?: number;
  fileSize?: number;
  cacheHit?: boolean;
  optimizationApplied?: boolean;
}

export interface PerformanceTrend {
  operation: string;
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
  prediction: {
    nextValue: number;
    confidence: number;
  };
}

export interface OptimizationRecommendation {
  operation: string;
  issue: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  estimatedImprovement: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PerformanceDashboard {
  overview: {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    totalDuration: number;
  };
  trends: PerformanceTrend[];
  slowestOperations: Array<{
    operation: string;
    averageDuration: number;
    count: number;
    trend: PerformanceTrend['trend'];
  }>;
  recommendations: OptimizationRecommendation[];
  categoryBreakdown: Record<string, {
    count: number;
    averageDuration: number;
    totalDuration: number;
  }>;
}

class EnhancedPerformanceMonitor {
  private metrics: EnhancedPerformanceMetrics[] = [];
  private readonly maxMetrics = 5000;
  private metricsFile: string;
  private isInitialized = false;

  constructor(projectPath: string = process.cwd()) {
    this.metricsFile = path.join(projectPath, '.guardrail', 'performance-metrics.json');
  }

  /**
   * Initialize performance monitor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load historical metrics
    await this.loadMetrics();

    this.isInitialized = true;
  }

  /**
   * Track operation with enhanced metrics
   * 
   * @param operation - Operation name
   * @param category - Operation category
   * @param fn - Function to track
   * @param metadata - Additional metadata
   * @returns Result of function execution
   */
  async track<T>(
    operation: string,
    category: EnhancedPerformanceMetrics['category'],
    fn: () => Promise<T>,
    metadata?: {
      fileCount?: number;
      fileSize?: number;
      cacheHit?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      const metric: EnhancedPerformanceMetrics = {
        command: operation,
        operation,
        category,
        duration,
        memoryUsage,
        cpuUsage: 0, // Would calculate in production
        success: true,
        timestamp: new Date().toISOString(),
        fileCount: metadata?.fileCount,
        fileSize: metadata?.fileSize,
        cacheHit: metadata?.cacheHit,
        optimizationApplied: false,
        metadata: metadata,
      };

      this.recordMetric(metric);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      const metric: EnhancedPerformanceMetrics = {
        command: operation,
        operation,
        category,
        duration,
        memoryUsage,
        cpuUsage: 0,
        success: false,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
      };

      this.recordMetric(metric);
      throw error;
    }
  }

  /**
   * Get enhanced insights
   */
  async getInsights(): Promise<PerformanceDashboard> {
    const baseInsights = performanceMonitor.getInsights();
    
    // Calculate trends
    const trends = this.calculateTrends();
    
    // Get slowest operations with trends
    const slowestOperations = this.getSlowestOperationsWithTrends();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    
    // Category breakdown
    const categoryBreakdown = this.getCategoryBreakdown();

    return {
      overview: {
        totalOperations: this.metrics.length,
        averageDuration: baseInsights.averageDuration,
        successRate: baseInsights.successRate,
        totalDuration: this.metrics.reduce((sum, m) => sum + m.duration, 0),
      },
      trends,
      slowestOperations,
      recommendations,
      categoryBreakdown,
    };
  }

  /**
   * Get performance trends
   */
  getTrends(): PerformanceTrend[] {
    return this.calculateTrends();
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): OptimizationRecommendation[] {
    return this.generateRecommendations();
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(filePath: string): Promise<void> {
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(this.metrics, null, 2)
    );
  }

  /**
   * Record metric
   */
  private recordMetric(metric: EnhancedPerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Periodically save (every 100 metrics)
    if (this.metrics.length % 100 === 0) {
      this.saveMetrics().catch(console.error);
    }
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    const operationGroups = new Map<string, EnhancedPerformanceMetrics[]>();

    // Group by operation
    for (const metric of this.metrics) {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, []);
      }
      operationGroups.get(metric.operation)!.push(metric);
    }

    // Calculate trend for each operation
    for (const [operation, metrics] of operationGroups.entries()) {
      if (metrics.length < 10) continue; // Need enough data

      // Split into recent and older
      const recent = metrics.slice(-10);
      const older = metrics.slice(-20, -10);

      if (older.length === 0) continue;

      const recentAvg = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
      const olderAvg = older.reduce((sum, m) => sum + m.duration, 0) / older.length;

      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      let trend: PerformanceTrend['trend'];
      if (changePercent < -5) trend = 'improving';
      else if (changePercent > 5) trend = 'declining';
      else trend = 'stable';

      // Simple prediction (linear regression)
      const prediction = this.predictNextValue(metrics.map(m => m.duration));

      trends.push({
        operation,
        trend,
        changePercent,
        prediction,
      });
    }

    return trends;
  }

  /**
   * Get slowest operations with trends
   */
  private getSlowestOperationsWithTrends(): PerformanceDashboard['slowestOperations'] {
    const operationGroups = new Map<string, EnhancedPerformanceMetrics[]>();

    for (const metric of this.metrics) {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, []);
      }
      operationGroups.get(metric.operation)!.push(metric);
    }

    const operations = Array.from(operationGroups.entries()).map(([operation, metrics]) => {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      const trend = this.getTrendForOperation(operation);
      
      return {
        operation,
        averageDuration: avgDuration,
        count: metrics.length,
        trend: trend?.trend || 'stable',
      };
    });

    return operations.sort((a, b) => b.averageDuration - a.averageDuration).slice(0, 10);
  }

  /**
   * Get trend for specific operation
   */
  private getTrendForOperation(operation: string): PerformanceTrend | null {
    const trends = this.calculateTrends();
    return trends.find(t => t.operation === operation) || null;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const trends = this.calculateTrends();

    // Check for declining trends
    for (const trend of trends) {
      if (trend.trend === 'declining' && trend.changePercent > 20) {
        recommendations.push({
          operation: trend.operation,
          issue: `Performance declining by ${trend.changePercent.toFixed(1)}%`,
          impact: 'high',
          recommendation: `Investigate ${trend.operation} for performance bottlenecks`,
          estimatedImprovement: '20-40%',
          difficulty: 'medium',
        });
      }
    }

    // Check for slow operations
    const slowOperations = this.getSlowestOperationsWithTrends().slice(0, 5);
    for (const op of slowOperations) {
      if (op.averageDuration > 5000) { // > 5 seconds
        recommendations.push({
          operation: op.operation,
          issue: `Operation takes ${(op.averageDuration / 1000).toFixed(1)}s on average`,
          impact: 'high',
          recommendation: `Consider caching, parallelization, or optimization for ${op.operation}`,
          estimatedImprovement: '30-50%',
          difficulty: 'medium',
        });
      }
    }

    // Check cache hit rates
    const cacheMetrics = this.metrics.filter(m => m.cacheHit !== undefined);
    if (cacheMetrics.length > 0) {
      const cacheHitRate = cacheMetrics.filter(m => m.cacheHit).length / cacheMetrics.length;
      if (cacheHitRate < 0.5) {
        recommendations.push({
          operation: 'caching',
          issue: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
          impact: 'medium',
          recommendation: 'Improve caching strategy to reduce redundant operations',
          estimatedImprovement: '20-30%',
          difficulty: 'easy',
        });
      }
    }

    return recommendations;
  }

  /**
   * Get category breakdown
   */
  private getCategoryBreakdown(): Record<string, {
    count: number;
    averageDuration: number;
    totalDuration: number;
  }> {
    const breakdown: Record<string, {
      count: number;
      totalDuration: number;
      averageDuration: number;
    }> = {};

    for (const metric of this.metrics) {
      const category = metric.category;
      if (!breakdown[category]) {
        breakdown[category] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
        };
      }

      breakdown[category].count++;
      breakdown[category].totalDuration += metric.duration;
    }

    // Calculate averages
    for (const category in breakdown) {
      const stats = breakdown[category];
      stats.averageDuration = stats.totalDuration / stats.count;
    }

    return breakdown;
  }

  /**
   * Predict next value using simple linear regression
   */
  private predictNextValue(values: number[]): { nextValue: number; confidence: number } {
    if (values.length < 2) {
      return { nextValue: values[0] || 0, confidence: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const nextValue = slope * n + intercept;
    const confidence = Math.min(0.9, 0.5 + (n / 100)); // More data = higher confidence

    return { nextValue, confidence };
  }

  /**
   * Load metrics from disk
   */
  private async loadMetrics(): Promise<void> {
    try {
      if (await this.pathExists(this.metricsFile)) {
        const content = await fs.promises.readFile(this.metricsFile, 'utf8');
        const loaded = JSON.parse(content) as EnhancedPerformanceMetrics[];
        this.metrics = loaded.slice(-this.maxMetrics); // Keep only recent
      }
    } catch {
      // Start with empty metrics
    }
  }

  /**
   * Save metrics to disk
   */
  private async saveMetrics(): Promise<void> {
    try {
      const metricsDir = path.dirname(this.metricsFile);
      await fs.promises.mkdir(metricsDir, { recursive: true });
      await fs.promises.writeFile(
        this.metricsFile,
        JSON.stringify(this.metrics, null, 2)
      );
    } catch (error) {
      // Log but don't fail
      console.warn('Failed to save performance metrics:', error);
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

export const enhancedPerformanceMonitor = new EnhancedPerformanceMonitor();

