/**
 * Performance Monitor
 * 
 * Tracks performance metrics and provides insights
 */

export interface PerformanceMetrics {
  command: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PerformanceInsights {
  averageDuration: number;
  slowestCommands: Array<{ command: string; duration: number }>;
  fastestCommands: Array<{ command: string; duration: number }>;
  successRate: number;
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Track command execution
   */
  async trackCommand<T>(
    command: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;
      const cpuUsage = process.cpuUsage(startCpu);

      this.recordMetric({
        command,
        duration,
        memoryUsage,
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to ms
        success: true,
        timestamp: new Date().toISOString(),
        metadata,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      this.recordMetric({
        command,
        duration,
        memoryUsage,
        cpuUsage: 0,
        success: false,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: (error as Error).message },
      });

      throw error;
    }
  }

  /**
   * Record metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance insights
   */
  getInsights(): PerformanceInsights {
    if (this.metrics.length === 0) {
      return {
        averageDuration: 0,
        slowestCommands: [],
        fastestCommands: [],
        successRate: 0,
        recommendations: [],
      };
    }

    const successful = this.metrics.filter(m => m.success);
    const averageDuration = successful.reduce((sum, m) => sum + m.duration, 0) / successful.length;

    // Group by command
    const commandStats = new Map<string, { total: number; count: number; durations: number[] }>();
    for (const metric of this.metrics) {
      const stats = commandStats.get(metric.command) || { total: 0, count: 0, durations: [] };
      stats.total += metric.duration;
      stats.count += 1;
      stats.durations.push(metric.duration);
      commandStats.set(metric.command, stats);
    }

    // Find slowest and fastest
    const commandAverages = Array.from(commandStats.entries()).map(([cmd, stats]) => ({
      command: cmd,
      duration: stats.total / stats.count,
    }));

    const slowestCommands = commandAverages
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    const fastestCommands = commandAverages
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5);

    const successRate = (successful.length / this.metrics.length) * 100;

    // Generate recommendations
    const recommendations = this.generateRecommendations(commandAverages, averageDuration);

    return {
      averageDuration,
      slowestCommands,
      fastestCommands,
      successRate,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    commandAverages: Array<{ command: string; duration: number }>,
    averageDuration: number
  ): string[] {
    const recommendations: string[] = [];

    // Check for slow commands
    const slowCommands = commandAverages.filter(c => c.duration > averageDuration * 2);
    if (slowCommands.length > 0) {
      recommendations.push(
        `Consider optimizing: ${slowCommands.map(c => c.command).join(', ')}`
      );
    }

    // Check memory usage
    const highMemory = this.metrics.filter(m => m.memoryUsage > 100 * 1024 * 1024); // > 100MB
    if (highMemory.length > 0) {
      recommendations.push('Some commands use high memory - consider caching or optimization');
    }

    // Check success rate
    const successRate = (this.metrics.filter(m => m.success).length / this.metrics.length) * 100;
    if (successRate < 90) {
      recommendations.push(`Success rate is ${successRate.toFixed(1)}% - investigate failures`);
    }

    return recommendations;
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    totalCommands: number;
    successful: number;
    failed: number;
    averageDuration: number;
    totalDuration: number;
  } {
    const successful = this.metrics.filter(m => m.success);
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);

    return {
      totalCommands: this.metrics.length,
      successful: successful.length,
      failed: this.metrics.length - successful.length,
      averageDuration: successful.length > 0 ? totalDuration / successful.length : 0,
      totalDuration,
    };
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

