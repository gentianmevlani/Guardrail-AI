/**
 * Prometheus Metrics
 *
 * Production-ready metrics collection for guardrail AI
 * Exposes metrics in Prometheus format for monitoring and alerting
 */
export interface MetricLabels {
  [key: string]: string;
}
export interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp?: number;
}
export interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  values: MetricValue[];
}
declare class Counter {
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];
  private values;
  constructor(name: string, help: string, labelNames?: string[]);
  inc(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  reset(): void;
  collect(): MetricValue[];
  private labelsToKey;
  private keyToLabels;
}
declare class Gauge {
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];
  private values;
  constructor(name: string, help: string, labelNames?: string[]);
  set(labels: MetricLabels, value: number): void;
  set(value: number): void;
  inc(labels?: MetricLabels, value?: number): void;
  dec(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  collect(): MetricValue[];
  private labelsToKey;
  private keyToLabels;
}
declare class Histogram {
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];
  private buckets;
  private values;
  constructor(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[],
  );
  observe(labels: MetricLabels, value: number): void;
  observe(value: number): void;
  startTimer(labels?: MetricLabels): () => number;
  collect(): MetricValue[];
  private labelsToKey;
  private keyToLabels;
}
/**
 * guardrail Metrics Registry
 */
declare class MetricsRegistry {
  readonly scansTotal: Counter;
  readonly scanDuration: Histogram;
  readonly injectionsDetected: Counter;
  readonly injectionScanDuration: Histogram;
  readonly vulnerabilitiesFound: Counter;
  readonly vulnerablePackages: Gauge;
  readonly secretsDetected: Counter;
  readonly complianceScore: Gauge;
  readonly complianceViolations: Counter;
  readonly apiRequestsTotal: Counter;
  readonly apiRequestDuration: Histogram;
  readonly agentActionsTotal: Counter;
  readonly agentActionsBlocked: Counter;
  readonly cacheHits: Counter;
  readonly cacheMisses: Counter;
  readonly activeConnections: Gauge;
  readonly memoryUsageBytes: Gauge;
  /**
   * Generate Prometheus-formatted output
   */
  generatePrometheusOutput(): string;
  /**
   * Update system metrics
   */
  updateSystemMetrics(): void;
  /**
   * Reset all metrics (for testing)
   */
  resetAll(): void;
}
export declare const metrics: MetricsRegistry;
export { Counter, Gauge, Histogram };
//# sourceMappingURL=prometheus.d.ts.map
