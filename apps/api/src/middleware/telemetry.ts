/**
 * Telemetry Middleware
 * 
 * Tracks metrics, events, and traces for observability:
 * - Request/response metrics (latency, status codes)
 * - Business events (scans, uploads, webhooks)
 * - Error tracking
 * - User funnel tracking
 */

import { randomUUID } from "node:crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../logger";

export interface TelemetryEvent {
  event: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

// In-memory metrics store (in production, use Prometheus, DataDog, etc.)
const metrics: Map<string, number[]> = new Map();
const events: TelemetryEvent[] = [];

/**
 * Track a business event
 */
export function trackEvent(event: TelemetryEvent): void {
  const enrichedEvent = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };
  
  events.push(enrichedEvent);
  logger.info({ telemetry: enrichedEvent }, `Event: ${event.event}`);
  
  // In production, send to analytics service (Segment, Mixpanel, etc.)
  // For now, just log
}

/**
 * Track a metric
 */
export function trackMetric(metric: Metric): void {
  const key = metric.name + JSON.stringify(metric.tags || {});
  if (!metrics.has(key)) {
    metrics.set(key, []);
  }
  metrics.get(key)!.push(metric.value);
  
  logger.debug({ metric }, `Metric: ${metric.name}=${metric.value}`);
}

/**
 * Get metric statistics (p50, p95, p99, mean)
 */
export function getMetricStats(name: string, tags?: Record<string, string>): {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
} | null {
  const key = name + JSON.stringify(tags || {});
  const values = metrics.get(key);
  if (!values || values.length === 0) {
    return null;
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / count;
  const p50 = sorted[Math.floor(count * 0.5)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.floor(count * 0.99)];
  const min = sorted[0];
  const max = sorted[count - 1];
  
  return { count, mean, p50, p95, p99, min, max };
}

/**
 * Get all metrics in Prometheus format
 */
export function getMetricsPrometheus(): string {
  const lines: string[] = [];
  
  for (const [key, values] of metrics.entries()) {
    const [name, tagsJson] = key.split(JSON.stringify({}));
    const tags = tagsJson ? JSON.parse(tagsJson) : {};
    const stats = getMetricStats(name, tags);
    
    if (stats) {
      const tagStr = Object.entries(tags)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const labels = tagStr ? `{${tagStr}}` : "";
      
      lines.push(`# HELP ${name} ${name} metric`);
      lines.push(`# TYPE ${name} histogram`);
      lines.push(`${name}_count${labels} ${stats.count}`);
      lines.push(`${name}_sum${labels} ${stats.mean * stats.count}`);
      lines.push(`${name}_mean${labels} ${stats.mean}`);
      lines.push(`${name}_p50${labels} ${stats.p50}`);
      lines.push(`${name}_p95${labels} ${stats.p95}`);
      lines.push(`${name}_p99${labels} ${stats.p99}`);
      lines.push(`${name}_min${labels} ${stats.min}`);
      lines.push(`${name}_max${labels} ${stats.max}`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Add request ID to request context (must be called early in request lifecycle)
 */
export async function addRequestId(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Generate or use existing request ID from header
  const requestId = (request.headers['x-request-id'] as string) || 
    `req_${Date.now()}_${randomUUID().slice(0, 8)}`;
  
  (request as any).requestId = requestId;
  reply.header('x-request-id', requestId);
}

/**
 * Telemetry middleware for Fastify
 * Tracks request/response metrics automatically
 */
export function telemetryMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();
    const userId = (request as any).user?.id;
    const requestId = (request as any).requestId || 'unknown';
    const req = request as FastifyRequest & { routerPath?: string };
    const route =
      req.routerPath ??
      (request.routeOptions as { url?: string } | undefined)?.url ??
      request.url.split("?")[0];
    const method = request.method;
    
    // Track request start
    trackEvent({
      event: "api.request.started",
      userId,
      metadata: {
        requestId,
        route,
        method,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      },
    });
    
    // Track response when the HTTP response finishes (Fastify Reply has no addHook)
    reply.raw.once("finish", () => {
      const duration = Date.now() - startTime;
      const statusCode = reply.statusCode;

      trackMetric({
        name: "api.request.duration",
        value: duration,
        tags: {
          route,
          method,
          status: statusCode.toString(),
          statusClass: `${Math.floor(statusCode / 100)}xx`,
        },
      });

      trackEvent({
        event: "api.request.completed",
        userId,
        metadata: {
          requestId,
          route,
          method,
          statusCode,
          duration,
          success: statusCode >= 200 && statusCode < 400,
        },
      });
    });

    reply.raw.once("error", (error: Error) => {
      const duration = Date.now() - startTime;

      trackEvent({
        event: "api.request.error",
        userId,
        metadata: {
          requestId,
          route,
          method,
          statusCode: reply.statusCode,
          duration,
          error: error.message,
          errorStack: error.stack,
        },
      });

      trackMetric({
        name: "api.request.errors",
        value: 1,
        tags: {
          route,
          method,
          errorType: error.constructor.name,
        },
      });
    });
  };
}

/**
 * Helper to track business events
 */
export const track = {
  scan: {
    started: (userId: string, scanId: string, metadata?: Record<string, unknown>) => {
      trackEvent({
        event: "scan.started",
        userId,
        metadata: { scanId, ...metadata },
      });
    },
    completed: (userId: string, scanId: string, duration: number, metadata?: Record<string, unknown>) => {
      trackEvent({
        event: "scan.completed",
        userId,
        metadata: { scanId, duration, ...metadata },
      });
      trackMetric({
        name: "scan.duration",
        value: duration,
        tags: { userId },
      });
    },
    failed: (userId: string, scanId: string, error: string, metadata?: Record<string, unknown>) => {
      trackEvent({
        event: "scan.failed",
        userId,
        metadata: { scanId, error, ...metadata },
      });
      trackMetric({
        name: "scan.failures",
        value: 1,
        tags: { userId },
      });
    },
  },
  
  upload: {
    started: (userId: string, filename: string, size: number) => {
      trackEvent({
        event: "upload.started",
        userId,
        metadata: { filename, size },
      });
    },
    completed: (userId: string, filename: string, duration: number, size: number) => {
      trackEvent({
        event: "upload.completed",
        userId,
        metadata: { filename, duration, size },
      });
      trackMetric({
        name: "upload.duration",
        value: duration,
        tags: { userId },
      });
      trackMetric({
        name: "upload.size",
        value: size,
        tags: { userId },
      });
    },
    failed: (userId: string, filename: string, error: string) => {
      trackEvent({
        event: "upload.failed",
        userId,
        metadata: { filename, error },
      });
      trackMetric({
        name: "upload.failures",
        value: 1,
        tags: { userId },
      });
    },
  },
  
  webhook: {
    deliveryStarted: (subscriptionId: string, eventId: string, url: string) => {
      trackEvent({
        event: "webhook.delivery.started",
        metadata: { subscriptionId, eventId, url: url.substring(0, 100) },
      });
    },
    deliveryCompleted: (subscriptionId: string, eventId: string, duration: number, statusCode: number) => {
      trackEvent({
        event: "webhook.delivery.completed",
        metadata: { subscriptionId, eventId, duration, statusCode },
      });
      trackMetric({
        name: "webhook.delivery.duration",
        value: duration,
        tags: { statusCode: statusCode.toString() },
      });
    },
    deliveryFailed: (subscriptionId: string, eventId: string, error: string, attempt: number) => {
      trackEvent({
        event: "webhook.delivery.failed",
        metadata: { subscriptionId, eventId, error, attempt },
      });
      trackMetric({
        name: "webhook.delivery.failures",
        value: 1,
        tags: { attempt: attempt.toString() },
      });
    },
    retry: (subscriptionId: string, eventId: string, attempt: number) => {
      trackEvent({
        event: "webhook.delivery.retry",
        metadata: { subscriptionId, eventId, attempt },
      });
      trackMetric({
        name: "webhook.delivery.retries",
        value: 1,
        tags: { attempt: attempt.toString() },
      });
    },
  },
  
  planGate: {
    blocked: (userId: string, route: string, userTier: string, requiredTier: string) => {
      trackEvent({
        event: "plan_gate.blocked",
        userId,
        metadata: { route, userTier, requiredTier },
      });
      trackMetric({
        name: "plan_gate.blocked",
        value: 1,
        tags: { route, userTier, requiredTier },
      });
    },
  },
};
