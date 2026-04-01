"use strict";
/**
 * Prometheus Metrics
 *
 * Production-ready metrics collection for Guardrail AI
 * Exposes metrics in Prometheus format for monitoring and alerting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Histogram = exports.Gauge = exports.Counter = exports.metrics = void 0;
class Counter {
    name;
    help;
    labelNames;
    values = new Map();
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
    }
    inc(labels = {}, value = 1) {
        const key = this.labelsToKey(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current + value);
    }
    get(labels = {}) {
        const key = this.labelsToKey(labels);
        return this.values.get(key) || 0;
    }
    reset() {
        this.values.clear();
    }
    collect() {
        const result = [];
        for (const [key, value] of this.values) {
            result.push({
                value,
                labels: this.keyToLabels(key),
            });
        }
        return result;
    }
    labelsToKey(labels) {
        return this.labelNames.map((name) => labels[name] || "").join("|");
    }
    keyToLabels(key) {
        const values = key.split("|");
        const labels = {};
        this.labelNames.forEach((name, i) => {
            if (values[i]) {
                labels[name] = values[i];
            }
        });
        return labels;
    }
}
exports.Counter = Counter;
class Gauge {
    name;
    help;
    labelNames;
    values = new Map();
    constructor(name, help, labelNames = []) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
    }
    set(labelsOrValue, value) {
        if (typeof labelsOrValue === "number") {
            this.values.set("", labelsOrValue);
        }
        else {
            const key = this.labelsToKey(labelsOrValue);
            this.values.set(key, value);
        }
    }
    inc(labels = {}, value = 1) {
        const key = this.labelsToKey(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current + value);
    }
    dec(labels = {}, value = 1) {
        const key = this.labelsToKey(labels);
        const current = this.values.get(key) || 0;
        this.values.set(key, current - value);
    }
    get(labels = {}) {
        const key = this.labelsToKey(labels);
        return this.values.get(key) || 0;
    }
    collect() {
        const result = [];
        for (const [key, value] of this.values) {
            result.push({
                value,
                labels: this.keyToLabels(key),
            });
        }
        return result;
    }
    labelsToKey(labels) {
        return this.labelNames.map((name) => labels[name] || "").join("|");
    }
    keyToLabels(key) {
        const values = key.split("|");
        const labels = {};
        this.labelNames.forEach((name, i) => {
            if (values[i]) {
                labels[name] = values[i];
            }
        });
        return labels;
    }
}
exports.Gauge = Gauge;
class Histogram {
    name;
    help;
    labelNames;
    buckets;
    values = new Map();
    constructor(name, help, labelNames = [], buckets) {
        this.name = name;
        this.help = help;
        this.labelNames = labelNames;
        this.buckets = buckets || [
            0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
        ];
    }
    observe(labelsOrValue, value) {
        let labels;
        let observedValue;
        if (typeof labelsOrValue === "number") {
            labels = {};
            observedValue = labelsOrValue;
        }
        else {
            labels = labelsOrValue;
            observedValue = value;
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
    startTimer(labels = {}) {
        const start = process.hrtime.bigint();
        return () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1e6;
            this.observe(labels, durationMs / 1000); // Convert to seconds
            return durationMs;
        };
    }
    collect() {
        const result = [];
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
    labelsToKey(labels) {
        return this.labelNames.map((name) => labels[name] || "").join("|");
    }
    keyToLabels(key) {
        const values = key.split("|");
        const labels = {};
        this.labelNames.forEach((name, i) => {
            if (values[i]) {
                labels[name] = values[i];
            }
        });
        return labels;
    }
}
exports.Histogram = Histogram;
/**
 * Guardrail Metrics Registry
 */
class MetricsRegistry {
    // Scan metrics
    scansTotal = new Counter("Guardrail_scans_total", "Total number of security scans performed", ["scan_type", "status"]);
    scanDuration = new Histogram("Guardrail_scan_duration_seconds", "Duration of security scans in seconds", ["scan_type"], [0.1, 0.5, 1, 2, 5, 10, 30, 60]);
    // Injection detection metrics
    injectionsDetected = new Counter("Guardrail_injections_detected_total", "Total number of prompt injection attempts detected", ["severity", "type"]);
    injectionScanDuration = new Histogram("Guardrail_injection_scan_duration_seconds", "Duration of injection scans in seconds", ["content_type"]);
    // Vulnerability metrics
    vulnerabilitiesFound = new Counter("Guardrail_vulnerabilities_found_total", "Total number of vulnerabilities found", ["severity", "source"]);
    vulnerablePackages = new Gauge("Guardrail_vulnerable_packages", "Current number of vulnerable packages", ["project_id"]);
    // Secret detection metrics
    secretsDetected = new Counter("Guardrail_secrets_detected_total", "Total number of secrets detected", ["secret_type", "severity"]);
    // Compliance metrics
    complianceScore = new Gauge("Guardrail_compliance_score", "Current compliance score (0-100)", ["framework", "project_id"]);
    complianceViolations = new Counter("Guardrail_compliance_violations_total", "Total number of compliance violations", ["framework", "severity"]);
    // API metrics
    apiRequestsTotal = new Counter("Guardrail_api_requests_total", "Total number of API requests", ["method", "endpoint", "status_code"]);
    apiRequestDuration = new Histogram("Guardrail_api_request_duration_seconds", "Duration of API requests in seconds", ["method", "endpoint"]);
    // Agent metrics
    agentActionsTotal = new Counter("Guardrail_agent_actions_total", "Total number of agent actions", ["agent_id", "action_type", "status"]);
    agentActionsBlocked = new Counter("Guardrail_agent_actions_blocked_total", "Total number of agent actions blocked", ["agent_id", "reason"]);
    // Cache metrics
    cacheHits = new Counter("Guardrail_cache_hits_total", "Total number of cache hits", ["cache_type"]);
    cacheMisses = new Counter("Guardrail_cache_misses_total", "Total number of cache misses", ["cache_type"]);
    // System metrics
    activeConnections = new Gauge("Guardrail_active_connections", "Number of active WebSocket connections", []);
    memoryUsageBytes = new Gauge("Guardrail_memory_usage_bytes", "Current memory usage in bytes", ["type"]);
    /**
     * Generate Prometheus-formatted output
     */
    generatePrometheusOutput() {
        const lines = [];
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
                }
                else {
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
    updateSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.memoryUsageBytes.set({ type: "heap_used" }, memUsage.heapUsed);
        this.memoryUsageBytes.set({ type: "heap_total" }, memUsage.heapTotal);
        this.memoryUsageBytes.set({ type: "rss" }, memUsage.rss);
        this.memoryUsageBytes.set({ type: "external" }, memUsage.external);
    }
    /**
     * Reset all metrics (for testing)
     */
    resetAll() {
        this.scansTotal.reset();
        // Add reset for other metrics as needed
    }
}
// Export singleton registry
exports.metrics = new MetricsRegistry();
