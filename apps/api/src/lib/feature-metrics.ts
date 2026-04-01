/**
 * Feature Metrics Module
 * 
 * Provides metrics for newly implemented features:
 * - Plan gating
 * - Security events
 * - Billing webhooks
 * - Usage metering
 * - Webhook delivery
 */

import { logger } from '../logger';

// Metrics store
interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

interface MetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: MetricValue[];
}

class FeatureMetricsCollector {
  private metrics: Map<string, MetricDefinition> = new Map();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Plan gating metrics
    this.registerCounter('guardrail_plan_gate_check_total', 'Total number of plan gate checks', {});
    this.registerCounter('guardrail_plan_gate_allowed_total', 'Total number of allowed plan gate checks', {});
    this.registerCounter('guardrail_plan_gate_blocked_total', 'Total number of blocked plan gate checks', {});

    // Security event metrics
    this.registerCounter('guardrail_security_events_total', 'Total number of security events', {});
    this.registerCounter('guardrail_security_events_by_type_total', 'Security events by type', {});
    this.registerCounter('guardrail_security_events_by_severity_total', 'Security events by severity', {});

    // Billing webhook metrics
    this.registerCounter('guardrail_billing_webhook_total', 'Total number of billing webhooks processed', {});
    this.registerCounter('guardrail_billing_webhook_success_total', 'Successful billing webhooks', {});
    this.registerCounter('guardrail_billing_webhook_error_total', 'Failed billing webhooks', {});
    this.registerCounter('guardrail_subscription_changes_total', 'Total subscription state changes', {});
    this.registerCounter('guardrail_email_notifications_total', 'Total email notifications sent', {});

    // Usage metering metrics
    this.registerCounter('guardrail_usage_tracked_total', 'Total usage events tracked', {});
    this.registerCounter('guardrail_usage_overage_total', 'Total overage events reported', {});
    this.registerGauge('guardrail_usage_current', 'Current usage by type', {});

    // Webhook delivery metrics
    this.registerCounter('guardrail_webhook_delivery_total', 'Total webhook deliveries attempted', {});
    this.registerCounter('guardrail_webhook_delivery_success_total', 'Successful webhook deliveries', {});
    this.registerCounter('guardrail_webhook_delivery_failure_total', 'Failed webhook deliveries', {});
    this.registerHistogram('guardrail_webhook_delivery_duration_ms', 'Webhook delivery duration in milliseconds', {});

    // MFA metrics
    this.registerCounter('guardrail_mfa_setup_total', 'Total MFA setup attempts', {});
    this.registerCounter('guardrail_mfa_verification_total', 'Total MFA verifications', {});
    this.registerCounter('guardrail_mfa_verification_failure_total', 'Failed MFA verifications', {});

    // Intelligence suite metrics
    this.registerCounter('guardrail_intelligence_analysis_total', 'Total intelligence analyses run', {});
    this.registerHistogram('guardrail_intelligence_analysis_duration_ms', 'Intelligence analysis duration', {});
  }

  private registerCounter(name: string, help: string, labels: Record<string, string>) {
    this.metrics.set(name, {
      name,
      help,
      type: 'counter',
      values: [{ value: 0, labels, timestamp: Date.now() }],
    });
  }

  private registerGauge(name: string, help: string, labels: Record<string, string>) {
    this.metrics.set(name, {
      name,
      help,
      type: 'gauge',
      values: [{ value: 0, labels, timestamp: Date.now() }],
    });
  }

  private registerHistogram(name: string, help: string, labels: Record<string, string>) {
    this.metrics.set(name, {
      name,
      help,
      type: 'histogram',
      values: [],
    });
  }

  // Increment a counter
  inc(metricName: string, labels?: Record<string, string>, amount: number = 1) {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      logger.warn({ metricName }, 'Unknown metric');
      return;
    }

    const labelKey = labels ? JSON.stringify(labels) : '';
    const existingValue = metric.values.find(v => JSON.stringify(v.labels || {}) === labelKey);
    
    if (existingValue) {
      existingValue.value += amount;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({ value: amount, labels, timestamp: Date.now() });
    }
  }

  // Set a gauge value
  set(metricName: string, value: number, labels?: Record<string, string>) {
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'gauge') {
      logger.warn({ metricName }, 'Unknown gauge metric');
      return;
    }

    const labelKey = labels ? JSON.stringify(labels) : '';
    const existingValue = metric.values.find(v => JSON.stringify(v.labels || {}) === labelKey);
    
    if (existingValue) {
      existingValue.value = value;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({ value, labels, timestamp: Date.now() });
    }
  }

  // Observe a histogram value
  observe(metricName: string, value: number, labels?: Record<string, string>) {
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'histogram') {
      logger.warn({ metricName }, 'Unknown histogram metric');
      return;
    }

    metric.values.push({ value, labels, timestamp: Date.now() });
    
    // Keep only last 1000 observations to prevent memory issues
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }
  }

  // Get all metrics in JSON format
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [name, metric] of this.metrics) {
      if (metric.type === 'histogram') {
        const values = metric.values.map(v => v.value);
        result[name] = {
          type: 'histogram',
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          p50: this.percentile(values, 50),
          p95: this.percentile(values, 95),
          p99: this.percentile(values, 99),
        };
      } else {
        result[name] = {
          type: metric.type,
          values: metric.values,
        };
      }
    }
    
    return result;
  }

  // Generate Prometheus format output
  toPrometheus(): string {
    const lines: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      
      if (metric.type === 'histogram') {
        const values = metric.values.map(v => v.value);
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          lines.push(`${name}_count ${values.length}`);
          lines.push(`${name}_sum ${sum}`);
        }
      } else {
        for (const v of metric.values) {
          const labelStr = v.labels 
            ? '{' + Object.entries(v.labels).map(([k, val]) => `${k}="${val}"`).join(',') + '}' 
            : '';
          lines.push(`${name}${labelStr} ${v.value}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Singleton instance
export const featureMetrics = new FeatureMetricsCollector();

// Convenience functions for common metrics

// Plan gating
export function recordPlanGateCheck(tier: string, allowed: boolean) {
  featureMetrics.inc('guardrail_plan_gate_check_total', { tier });
  if (allowed) {
    featureMetrics.inc('guardrail_plan_gate_allowed_total', { tier });
  } else {
    featureMetrics.inc('guardrail_plan_gate_blocked_total', { tier });
  }
}

// Security events
export function recordSecurityEvent(eventType: string, severity: string) {
  featureMetrics.inc('guardrail_security_events_total');
  featureMetrics.inc('guardrail_security_events_by_type_total', { type: eventType });
  featureMetrics.inc('guardrail_security_events_by_severity_total', { severity });
}

// Billing webhooks
export function recordBillingWebhook(eventType: string, success: boolean) {
  featureMetrics.inc('guardrail_billing_webhook_total', { type: eventType });
  if (success) {
    featureMetrics.inc('guardrail_billing_webhook_success_total', { type: eventType });
  } else {
    featureMetrics.inc('guardrail_billing_webhook_error_total', { type: eventType });
  }
}

export function recordSubscriptionChange(oldTier: string, newTier: string, status: string) {
  featureMetrics.inc('guardrail_subscription_changes_total', { 
    from_tier: oldTier, 
    to_tier: newTier, 
    status 
  });
}

export function recordEmailNotification(type: string, success: boolean) {
  featureMetrics.inc('guardrail_email_notifications_total', { 
    type, 
    success: String(success) 
  });
}

// Usage metering
export function recordUsageTracked(usageType: string, count: number) {
  featureMetrics.inc('guardrail_usage_tracked_total', { type: usageType }, count);
}

export function recordUsageOverage(usageType: string, overage: number) {
  featureMetrics.inc('guardrail_usage_overage_total', { type: usageType }, overage);
}

export function setCurrentUsage(usageType: string, value: number) {
  featureMetrics.set('guardrail_usage_current', value, { type: usageType });
}

// Webhook delivery
export function recordWebhookDelivery(provider: string, success: boolean, durationMs: number) {
  featureMetrics.inc('guardrail_webhook_delivery_total', { provider });
  if (success) {
    featureMetrics.inc('guardrail_webhook_delivery_success_total', { provider });
  } else {
    featureMetrics.inc('guardrail_webhook_delivery_failure_total', { provider });
  }
  featureMetrics.observe('guardrail_webhook_delivery_duration_ms', durationMs, { provider });
}

// MFA
export function recordMFASetup(success: boolean) {
  featureMetrics.inc('guardrail_mfa_setup_total', { success: String(success) });
}

export function recordMFAVerification(success: boolean) {
  featureMetrics.inc('guardrail_mfa_verification_total');
  if (!success) {
    featureMetrics.inc('guardrail_mfa_verification_failure_total');
  }
}

// Intelligence suite
export function recordIntelligenceAnalysis(suite: string, durationMs: number) {
  featureMetrics.inc('guardrail_intelligence_analysis_total', { suite });
  featureMetrics.observe('guardrail_intelligence_analysis_duration_ms', durationMs, { suite });
}
