import { EventEmitter } from 'events';
import {
  MonitoringMetric,
  MonitoringDashboardData,
  DateRange,
} from '@guardrail/core';

/**
 * Monitoring Collector — Process Guardrail
 *
 * Collects, aggregates, and serves metrics for monitoring dashboards.
 * Tracks requests, blocks, latency, errors, token usage, costs,
 * PII detections, policy violations, and agent health.
 */
export class MonitoringCollector extends EventEmitter {
  private metrics: MonitoringMetric[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private agentStatus: Map<string, AgentHealthRecord> = new Map();
  private readonly retentionMs: number;
  private readonly maxMetrics: number;

  constructor(options?: {
    retentionDays?: number;
    maxMetrics?: number;
  }) {
    super();
    this.retentionMs = (options?.retentionDays ?? 7) * 86_400_000;
    this.maxMetrics = options?.maxMetrics ?? 100_000;
  }

  /**
   * Record a metric
   */
  record(metric: Omit<MonitoringMetric, 'timestamp'>): void {
    const fullMetric: MonitoringMetric = {
      ...metric,
      timestamp: new Date(),
    };

    this.metrics.push(fullMetric);
    this.pruneIfNeeded();

    // Update counters/gauges
    if (metric.unit === 'count') {
      this.incrementCounter(metric.name, metric.value);
    } else {
      this.setGauge(metric.name, metric.value);
    }

    // Track histogram data for latency metrics
    if (metric.name.includes('latency') || metric.name.includes('duration')) {
      this.recordHistogram(metric.name, metric.value);
    }

    // Update agent health if applicable
    if (metric.agentId) {
      this.updateAgentHealth(metric.agentId, fullMetric);
    }

    this.emit('metric', fullMetric);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, delta: number = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + delta);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    if (values.length > 10_000) values.shift();
    this.histograms.set(name, values);
  }

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  /**
   * Get histogram percentile
   */
  getPercentile(name: string, percentile: number): number {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)]!;
  }

  /**
   * Generate dashboard data for a time range
   */
  getDashboardData(timeRange?: DateRange): MonitoringDashboardData {
    const now = new Date();
    const range: DateRange = timeRange || {
      start: new Date(now.getTime() - 3_600_000), // Last hour
      end: now,
    };

    const rangeMetrics = this.metrics.filter(
      (m) => m.timestamp >= range.start && m.timestamp <= range.end
    );

    return {
      timeRange: range,
      metrics: this.aggregateMetrics(rangeMetrics),
      timeSeries: this.buildTimeSeries(rangeMetrics, range),
      topViolations: this.getTopViolations(rangeMetrics),
      agentHealth: this.getAgentHealthSummary(),
    };
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, limit?: number): MonitoringMetric[] {
    const filtered = this.metrics.filter((m) => m.name === name);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Update agent health status
   */
  setAgentStatus(
    agentId: string,
    status: 'healthy' | 'degraded' | 'critical' | 'stopped'
  ): void {
    const existing = this.agentStatus.get(agentId) || {
      agentId,
      status: 'healthy',
      requestCount: 0,
      errorCount: 0,
      lastActive: new Date(),
    };
    existing.status = status;
    this.agentStatus.set(agentId, existing);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.agentStatus.clear();
  }

  private aggregateMetrics(metrics: MonitoringMetric[]): MonitoringDashboardData['metrics'] {
    const getSum = (name: string) =>
      metrics.filter((m) => m.name === name).reduce((s, m) => s + m.value, 0);
    const getAvg = (name: string) => {
      const matching = metrics.filter((m) => m.name === name);
      return matching.length > 0
        ? matching.reduce((s, m) => s + m.value, 0) / matching.length
        : 0;
    };
    const getLatest = (name: string) => {
      const matching = metrics.filter((m) => m.name === name);
      return matching.length > 0 ? matching[matching.length - 1]!.value : 0;
    };

    const totalRequests = getSum('requests_total');
    const errors = getSum('errors_total');

    return {
      totalRequests,
      blockedRequests: getSum('requests_blocked'),
      averageLatencyMs: getAvg('request_latency_ms'),
      errorRate: totalRequests > 0 ? errors / totalRequests : 0,
      tokenUsage: getSum('tokens_used'),
      costEstimate: getSum('cost_usd'),
      activeAgents: getLatest('active_agents'),
      threatEvents: getSum('threat_events'),
      piiDetections: getSum('pii_detections'),
      policyViolations: getSum('policy_violations'),
      humanReviewsPending: getLatest('human_reviews_pending'),
      killSwitchActivations: getSum('kill_switch_activations'),
    };
  }

  private buildTimeSeries(
    metrics: MonitoringMetric[],
    range: DateRange
  ): MonitoringDashboardData['timeSeries'] {
    const bucketCount = 60; // 60 time buckets
    const bucketSize = (range.end.getTime() - range.start.getTime()) / bucketCount;
    const series: MonitoringDashboardData['timeSeries'] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = range.start.getTime() + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;

      const bucketMetrics = metrics.filter(
        (m) => m.timestamp.getTime() >= bucketStart && m.timestamp.getTime() < bucketEnd
      );

      const requests = bucketMetrics.filter((m) => m.name === 'requests_total');
      const blocked = bucketMetrics.filter((m) => m.name === 'requests_blocked');
      const latencies = bucketMetrics.filter((m) => m.name === 'request_latency_ms').map((m) => m.value);
      const errors = bucketMetrics.filter((m) => m.name === 'errors_total');

      const sortedLatencies = [...latencies].sort((a, b) => a - b);

      series.push({
        timestamp: new Date(bucketStart),
        requestCount: requests.reduce((s, m) => s + m.value, 0),
        blockedCount: blocked.reduce((s, m) => s + m.value, 0),
        latencyP50: sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]!
          : 0,
        latencyP99: sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]!
          : 0,
        errorCount: errors.reduce((s, m) => s + m.value, 0),
      });
    }

    return series;
  }

  private getTopViolations(
    metrics: MonitoringMetric[]
  ): MonitoringDashboardData['topViolations'] {
    const violationCounts = new Map<string, number>();

    for (const m of metrics) {
      if (m.name.startsWith('violation_')) {
        const category = m.tags['category'] || m.name;
        violationCounts.set(category, (violationCounts.get(category) || 0) + m.value);
      }
    }

    return Array.from(violationCounts.entries())
      .map(([category, count]) => ({
        category,
        count,
        trend: 'stable' as const, // Would need historical data for real trend
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getAgentHealthSummary(): MonitoringDashboardData['agentHealth'] {
    return Array.from(this.agentStatus.values()).map((agent) => ({
      agentId: agent.agentId,
      status: agent.status,
      requestCount: agent.requestCount,
      errorRate: agent.requestCount > 0 ? agent.errorCount / agent.requestCount : 0,
      lastActive: agent.lastActive,
    }));
  }

  private updateAgentHealth(agentId: string, metric: MonitoringMetric): void {
    const existing = this.agentStatus.get(agentId) || {
      agentId,
      status: 'healthy' as const,
      requestCount: 0,
      errorCount: 0,
      lastActive: new Date(),
    };

    existing.lastActive = metric.timestamp;

    if (metric.name === 'requests_total') {
      existing.requestCount += metric.value;
    }
    if (metric.name === 'errors_total') {
      existing.errorCount += metric.value;
      const errorRate = existing.requestCount > 0
        ? existing.errorCount / existing.requestCount
        : 0;
      if (errorRate > 0.5) existing.status = 'critical';
      else if (errorRate > 0.1) existing.status = 'degraded';
    }

    this.agentStatus.set(agentId, existing);
  }

  private pruneIfNeeded(): void {
    const now = Date.now();

    // Remove expired metrics
    if (this.metrics.length > this.maxMetrics) {
      const cutoff = now - this.retentionMs;
      this.metrics = this.metrics.filter((m) => m.timestamp.getTime() > cutoff);
    }

    // Hard cap
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
}

interface AgentHealthRecord {
  agentId: string;
  status: 'healthy' | 'degraded' | 'critical' | 'stopped';
  requestCount: number;
  errorCount: number;
  lastActive: Date;
}

export const monitoringCollector = new MonitoringCollector();
