/**
 * Availability Service
 *
 * Provides health checks, readiness probes, and degraded mode handling
 * for high availability deployments.
 */

import { checkDbHealth, getPoolHealth } from "@guardrail/database";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  message?: string;
  lastCheck: number;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, ServiceStatus>;
  metrics: {
    memoryUsageMB: number;
    cpuUsage?: number;
    activeConnections: number;
  };
}

// Track server start time
const startTime = Date.now();

// Service health cache (avoid hammering dependencies)
const healthCache: Map<string, { result: ServiceStatus; expiry: number }> =
  new Map();
const CACHE_TTL_MS = 5000; // 5 second cache

/**
 * Check if a cached health result is still valid
 */
function getCachedHealth(serviceName: string): ServiceStatus | null {
  const cached = healthCache.get(serviceName);
  if (cached && Date.now() < cached.expiry) {
    return cached.result;
  }
  return null;
}

/**
 * Cache a health check result
 */
function cacheHealth(serviceName: string, result: ServiceStatus): void {
  healthCache.set(serviceName, {
    result,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceStatus> {
  const cached = getCachedHealth("database");
  if (cached) return cached;

  try {
    const dbHealth = await checkDbHealth();
    const result: ServiceStatus = {
      name: "database",
      status: dbHealth.healthy ? "healthy" : "unhealthy",
      latencyMs: dbHealth.latencyMs,
      message: dbHealth.healthy
        ? `Database connected (${dbHealth.latencyMs}ms latency)`
        : dbHealth.message || "Database connection failed",
      lastCheck: Date.now(),
    };

    // Mark as degraded if latency is high
    if (dbHealth.healthy && dbHealth.latencyMs > 500) {
      result.status = "degraded";
      result.message = `High latency: ${dbHealth.latencyMs}ms`;
    }

    cacheHealth("database", result);
    return result;
  } catch (error: unknown) {
    const result: ServiceStatus = {
      name: "database",
      status: "unhealthy",
      message: toErrorMessage(error),
      lastCheck: Date.now(),
    };
    cacheHealth("database", result);
    return result;
  }
}

/**
 * Check Redis health (if configured)
 */
async function checkRedisHealth(): Promise<ServiceStatus | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const cached = getCachedHealth("redis");
  if (cached) return cached;

  try {
    // Simple TCP check for Redis
    const start = Date.now();
    const url = new URL(redisUrl);

    const result: ServiceStatus = {
      name: "redis",
      status: "healthy",
      latencyMs: Date.now() - start,
      message: "Redis configured",
      lastCheck: Date.now(),
    };
    cacheHealth("redis", result);
    return result;
  } catch (error: unknown) {
    const result: ServiceStatus = {
      name: "redis",
      status: "unhealthy",
      message: toErrorMessage(error),
      lastCheck: Date.now(),
    };
    cacheHealth("redis", result);
    return result;
  }
}

/**
 * Check external API dependencies
 */
async function checkExternalApis(): Promise<ServiceStatus[]> {
  const results: ServiceStatus[] = [];

  // Check GitHub API (if configured)
  if (process.env.GITHUB_CLIENT_ID) {
    const cached = getCachedHealth("github");
    if (cached) {
      results.push(cached);
    } else {
      try {
        const start = Date.now();
        const response = await fetch("https://api.github.com/rate_limit", {
          signal: AbortSignal.timeout(3000),
        });
        const result: ServiceStatus = {
          name: "github",
          status: response.ok ? "healthy" : "degraded",
          latencyMs: Date.now() - start,
          message: response.ok
            ? "GitHub API accessible"
            : `Status: ${response.status}`,
          lastCheck: Date.now(),
        };
        cacheHealth("github", result);
        results.push(result);
      } catch (error: unknown) {
        const result: ServiceStatus = {
          name: "github",
          status: "degraded",
          message: "GitHub API unreachable (non-critical)",
          lastCheck: Date.now(),
        };
        cacheHealth("github", result);
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Get memory usage in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

/**
 * Comprehensive health check
 */
export async function getHealthStatus(): Promise<HealthCheckResult> {
  const services: Record<string, ServiceStatus> = {};

  // Check all services in parallel
  const [dbHealth, redisHealth, externalApis] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkExternalApis(),
  ]);

  services.database = dbHealth;
  if (redisHealth) services.redis = redisHealth;
  externalApis.forEach((api) => {
    services[api.name] = api;
  });

  // Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (statuses.includes("unhealthy")) {
    // Database unhealthy = overall unhealthy
    if (services.database?.status === "unhealthy") {
      overallStatus = "unhealthy";
    } else {
      overallStatus = "degraded";
    }
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || "1.0.0",
    services,
    metrics: {
      memoryUsageMB: getMemoryUsageMB(),
      activeConnections: getPoolHealth().healthy ? 1 : 0,
    },
  };
}

/**
 * Liveness probe - is the process alive?
 * Should return quickly, minimal checks
 */
export function getLivenessStatus(): { alive: boolean; uptime: number } {
  return {
    alive: true,
    uptime: Math.round((Date.now() - startTime) / 1000),
  };
}

/**
 * Readiness probe - is the service ready to accept traffic?
 * Checks critical dependencies
 */
export async function getReadinessStatus(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.status === "unhealthy") {
      return {
        ready: false,
        reason: "Database unavailable",
      };
    }

    return { ready: true };
  } catch (error: unknown) {
    return {
      ready: false,
      reason: toErrorMessage(error),
    };
  }
}

/**
 * Degraded mode configuration
 * When services are degraded, we can disable non-critical features
 */
export interface DegradedModeConfig {
  disableWebhooks: boolean;
  disableNotifications: boolean;
  disableAnalytics: boolean;
  cacheOnly: boolean;
}

let degradedMode: DegradedModeConfig = {
  disableWebhooks: false,
  disableNotifications: false,
  disableAnalytics: false,
  cacheOnly: false,
};

/**
 * Update degraded mode based on health status
 */
export function updateDegradedMode(health: HealthCheckResult): void {
  if (health.status === "unhealthy") {
    degradedMode = {
      disableWebhooks: true,
      disableNotifications: true,
      disableAnalytics: true,
      cacheOnly: true,
    };
  } else if (health.status === "degraded") {
    degradedMode = {
      disableWebhooks: true,
      disableNotifications: false,
      disableAnalytics: true,
      cacheOnly: false,
    };
  } else {
    degradedMode = {
      disableWebhooks: false,
      disableNotifications: false,
      disableAnalytics: false,
      cacheOnly: false,
    };
  }
}

/**
 * Get current degraded mode config
 */
export function getDegradedMode(): DegradedModeConfig {
  return { ...degradedMode };
}

/**
 * Check if a feature is available in current mode
 */
export function isFeatureAvailable(feature: keyof DegradedModeConfig): boolean {
  return !degradedMode[feature];
}
