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

class Counter {
  private values: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
  ) {}

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  get(labels: MetricLabels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key) || 0;
  }

  reset(): void {
    this.values.clear();
  }

  collect(): MetricValue[] {
    const result: MetricValue[] = [];
    for (const [key, value] of this.values) {
      result.push({
        value,
        labels: this.keyToLabels(key),
      });
    }
    return result;
  }

  private labelsToKey(labels: MetricLabels): string {
    return this.labelNames.map((name) => labels[name] || "").join("|");
  }

  private keyToLabels(key: string): MetricLabels {
    const values = key.split("|");
    const labels: MetricLabels = {};
    this.labelNames.forEach((name, i) => {
      if (values[i]) {
        labels[name] = values[i];
      }
    });
    return labels;
  }
}

class Gauge {
  private values: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
  ) {}

  set(labels: MetricLabels, value: number): void;
  set(value: number): void;
  set(labelsOrValue: MetricLabels | number, value?: number): void {
    if (typeof labelsOrValue === "number") {
      this.values.set("", labelsOrValue);
    } else {
      const key = this.labelsToKey(labelsOrValue);
      this.values.set(key, value!);
    }
  }

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  dec(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - value);
  }

  get(labels: MetricLabels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key) || 0;
  }

  collect(): MetricValue[] {
    const result: MetricValue[] = [];
    for (const [key, value] of this.values) {
      result.push({
        value,
        labels: this.keyToLabels(key),
      });
    }
    return result;
  }

  private labelsToKey(labels: MetricLabels): string {
    return this.labelNames.map((name) => labels[name] || "").join("|");
  }

  private keyToLabels(key: string): MetricLabels {
    const values = key.split("|");
    const labels: MetricLabels = {};
    this.labelNames.forEach((name, i) => {
      if (values[i]) {
        labels[name] = values[i];
      }
    });
    return labels;
  }
}

class Histogram {
  private buckets: number[];
  private values: Map<
    string,
    { sum: number; count: number; buckets: number[] }
  > = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets?: number[],
  ) {
    this.buckets = buckets || [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ];
  }

  observe(labels: MetricLabels, value: number): void;
  observe(value: number): void;
  observe(labelsOrValue: MetricLabels | number, value?: number): void {
    let labels: MetricLabels;
    let observedValue: number;

    if (typeof labelsOrValue === "number") {
      labels = {};
      observedValue = labelsOrValue;
    } else {
      labels = labelsOrValue;
      observedValue = value!;
    }

    const key = this.labelsToKey(labels);
    let data = this.values.get(key);

    if (!data) {
      data = {
        sum: 0,
        count: 0,
        buckets: new Array(this.buckets.length).fill(0),
      };
      this.values.set(key, data);
    }

    data.sum += observedValue;
    data.count++;

    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];
      if (bucket !== undefined && observedValue <= bucket) {
        // @ts-ignore
        data.buckets[i]++;
      }
    }
  }

  startTimer(labels: MetricLabels = {}): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      this.observe(labels, durationMs / 1000); // Convert to seconds
      return durationMs;
    };
  }

  collect(): MetricValue[] {
    const result: MetricValue[] = [];

    for (const [key, data] of this.values) {
      const labels = this.keyToLabels(key);

      // Add bucket values
      for (let i = 0; i < this.buckets.length; i++) {
        const bucketValue = data.buckets[i] ?? 0;
        const bucketLimit = this.buckets[i] ?? 0;
        result.push({
          value: bucketValue,
          labels: { ...labels, le: String(bucketLimit) },
        });
      }

      // Add +Inf bucket
      result.push({
        value: data.count,
        labels: { ...labels, le: "+Inf" },
      });

      // Add sum and count
      result.push({
        value: data.sum,
        labels: { ...labels, quantile: "sum" },
      });
      result.push({
        value: data.count,
        labels: { ...labels, quantile: "count" },
      });
    }

    return result;
  }

  private labelsToKey(labels: MetricLabels): string {
    return this.labelNames.map((name) => labels[name] || "").join("|");
  }

  private keyToLabels(key: string): MetricLabels {
    const values = key.split("|");
    const labels: MetricLabels = {};
    this.labelNames.forEach((name, i) => {
      if (values[i]) {
        labels[name] = values[i];
      }
    });
    return labels;
  }
}

/**
 * guardrail Metrics Registry
 */
class MetricsRegistry {
  // Scan metrics
  readonly scansTotal = new Counter(
    "Guardrail_scans_total",
    "Total number of security scans performed",
    ["scan_type", "status"],
  );

  readonly scanDuration = new Histogram(
    "Guardrail_scan_duration_seconds",
    "Duration of security scans in seconds",
    ["scan_type"],
    [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  );

  // Injection detection metrics
  readonly injectionsDetected = new Counter(
    "Guardrail_injections_detected_total",
    "Total number of prompt injection attempts detected",
    ["severity", "type"],
  );

  readonly injectionScanDuration = new Histogram(
    "Guardrail_injection_scan_duration_seconds",
    "Duration of injection scans in seconds",
    ["content_type"],
  );

  // Vulnerability metrics
  readonly vulnerabilitiesFound = new Counter(
    "Guardrail_vulnerabilities_found_total",
    "Total number of vulnerabilities found",
    ["severity", "source"],
  );

  readonly vulnerablePackages = new Gauge(
    "Guardrail_vulnerable_packages",
    "Current number of vulnerable packages",
    ["project_id"],
  );

  // Secret detection metrics
  readonly secretsDetected = new Counter(
    "Guardrail_secrets_detected_total",
    "Total number of secrets detected",
    ["secret_type", "severity"],
  );

  // Compliance metrics
  readonly complianceScore = new Gauge(
    "Guardrail_compliance_score",
    "Current compliance score (0-100)",
    ["framework", "project_id"],
  );

  readonly complianceViolations = new Counter(
    "Guardrail_compliance_violations_total",
    "Total number of compliance violations",
    ["framework", "severity"],
  );

  // API metrics
  readonly apiRequestsTotal = new Counter(
    "Guardrail_api_requests_total",
    "Total number of API requests",
    ["method", "endpoint", "status_code"],
  );

  readonly apiRequestDuration = new Histogram(
    "Guardrail_api_request_duration_seconds",
    "Duration of API requests in seconds",
    ["method", "endpoint"],
  );

  // Agent metrics
  readonly agentActionsTotal = new Counter(
    "Guardrail_agent_actions_total",
    "Total number of agent actions",
    ["agent_id", "action_type", "status"],
  );

  readonly agentActionsBlocked = new Counter(
    "Guardrail_agent_actions_blocked_total",
    "Total number of agent actions blocked",
    ["agent_id", "reason"],
  );

  // Cache metrics
  readonly cacheHits = new Counter(
    "Guardrail_cache_hits_total",
    "Total number of cache hits",
    ["cache_type"],
  );

  readonly cacheMisses = new Counter(
    "Guardrail_cache_misses_total",
    "Total number of cache misses",
    ["cache_type"],
  );

  // System metrics
  readonly activeConnections = new Gauge(
    "Guardrail_active_connections",
    "Number of active WebSocket connections",
    [],
  );

  readonly memoryUsageBytes = new Gauge(
    "Guardrail_memory_usage_bytes",
    "Current memory usage in bytes",
    ["type"],
  );

  /**
   * Generate Prometheus-formatted output
   */
  generatePrometheusOutput(): string {
    const lines: string[] = [];

    const metrics = [
      { metric: this.scansTotal, type: "counter" },
      { metric: this.scanDuration, type: "histogram" },
      { metric: this.injectionsDetected, type: "counter" },
      { metric: this.injectionScanDuration, type: "histogram" },
      { metric: this.vulnerabilitiesFound, type: "counter" },
      { metric: this.vulnerablePackages, type: "gauge" },
      { metric: this.secretsDetected, type: "counter" },
      { metric: this.complianceScore, type: "gauge" },
      { metric: this.complianceViolations, type: "counter" },
      { metric: this.apiRequestsTotal, type: "counter" },
      { metric: this.apiRequestDuration, type: "histogram" },
      { metric: this.agentActionsTotal, type: "counter" },
      { metric: this.agentActionsBlocked, type: "counter" },
      { metric: this.cacheHits, type: "counter" },
      { metric: this.cacheMisses, type: "counter" },
      { metric: this.activeConnections, type: "gauge" },
      { metric: this.memoryUsageBytes, type: "gauge" },
    ];

    for (const { metric, type } of metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${type}`);

      const values = metric.collect();
      for (const { value, labels } of values) {
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");

        if (labelStr) {
          lines.push(`${metric.name}{${labelStr}} ${value}`);
        } else {
          lines.push(`${metric.name} ${value}`);
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.memoryUsageBytes.set({ type: "heap_used" }, memUsage.heapUsed);
    this.memoryUsageBytes.set({ type: "heap_total" }, memUsage.heapTotal);
    this.memoryUsageBytes.set({ type: "rss" }, memUsage.rss);
    this.memoryUsageBytes.set({ type: "external" }, memUsage.external);
  }

  /**
   * Reset all metrics (for testing)
   */
  resetAll(): void {
    this.scansTotal.reset();
    // Add reset for other metrics as needed
  }
}

// Export singleton registry
export const metrics = new MetricsRegistry();

// Export classes for custom metrics
export { Counter, Gauge, Histogram };
