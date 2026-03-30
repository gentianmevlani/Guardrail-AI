/**
 * Enhanced Logging & Monitoring System
 * Provides structured logging, metrics collection, and monitoring
 */

import * as pino from 'pino';
import { Logger } from 'pino';

// Log levels
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Log context interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  duration?: number;
  error?: string;
  stack?: string;
  component?: string;
  version?: string;
  environment?: string;
  [key: string]: any;
}

// Metrics interface
export interface Metrics {
  requests: {
    total: number;
    success: number;
    error: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  database: {
    connections: number;
    queries: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  system: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
  };
}

// Logger class
class LoggerInstance {
  private logger: Logger;
  private metrics: Metrics;
  private responseTimes: number[] = [];
  private queryTimes: number[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    
    // Initialize Pino logger
    this.logger = (pino as any)({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (object: Record<string, unknown>) => {
          // Add timestamp if not present
          if (!object.time) {
            object.time = new Date().toISOString();
          }
          return object;
        },
      },
      serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err,
      },
      // Base context for all logs
      base: {
        service: 'guardrail-api',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        hostname: require('os').hostname(),
      },
      // Enable pretty printing in development
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    });

    // Initialize metrics
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      },
      database: {
        connections: 0,
        queries: 0,
        avgQueryTime: 0,
        slowQueries: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {},
      },
      system: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: 0,
      },
    };

    // Start metrics collection
    this.startMetricsCollection();
  }

  // Log methods with context
  trace(message: string, context?: LogContext): void {
    this.logger.trace(context, message);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context, message);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context, message);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context, message);
    this.updateErrorMetrics('warning', context);
  }

  error(message: string, context?: LogContext): void {
    this.logger.error(context, message);
    this.updateErrorMetrics('error', context);
  }

  fatal(message: string, context?: LogContext): void {
    this.logger.fatal(context, message);
    this.updateErrorMetrics('fatal', context);
  }

  // Request logging
  logRequest(context: LogContext): void {
    this.info('Incoming request', {
      ...context,
      type: 'request',
    });
    this.metrics.requests.total++;
  }

  logResponse(context: LogContext): void {
    const { responseTime, statusCode } = context;
    
    if (responseTime) {
      this.responseTimes.push(responseTime);
      // Keep only last 1000 response times for percentile calculation
      if (this.responseTimes.length > 1000) {
        this.responseTimes.shift();
      }
      this.updateResponseTimeMetrics();
    }

    if (statusCode && statusCode >= 400) {
      this.metrics.requests.error++;
      this.updateErrorMetrics('http_error', context);
    } else {
      this.metrics.requests.success++;
    }

    this.info('Request completed', {
      ...context,
      type: 'response',
    });
  }

  // Database logging
  logQuery(context: LogContext): void {
    const { duration } = context;
    
    if (duration) {
      this.queryTimes.push(duration);
      if (this.queryTimes.length > 1000) {
        this.queryTimes.shift();
      }
      this.updateQueryMetrics();
      
      if (duration > 1000) {
        this.warn('Slow query detected', context);
      }
    }

    this.debug('Database query executed', {
      ...context,
      type: 'database_query',
    });
  }

  logDatabaseError(context: LogContext): void {
    this.error('Database error occurred', {
      ...context,
      type: 'database_error',
    });
    this.updateErrorMetrics('database_error', context);
  }

  // Authentication logging
  logAuth(context: LogContext): void {
    this.info('Authentication event', {
      ...context,
      type: 'authentication',
    });
  }

  logAuthFailure(context: LogContext): void {
    this.warn('Authentication failed', {
      ...context,
      type: 'auth_failure',
    });
    this.updateErrorMetrics('auth_failure', context);
  }

  // Security logging
  logSecurityEvent(context: LogContext): void {
    this.warn('Security event detected', {
      ...context,
      type: 'security_event',
    });
    this.updateErrorMetrics('security_event', context);
  }

  // Business logic logging
  logBusinessEvent(context: LogContext): void {
    this.info('Business event', {
      ...context,
      type: 'business_event',
    });
  }

  logBusinessError(context: LogContext): void {
    this.error('Business logic error', {
      ...context,
      type: 'business_error',
    });
    this.updateErrorMetrics('business_error', context);
  }

  // Performance logging
  logPerformance(context: LogContext): void {
    this.info('Performance metric', {
      ...context,
      type: 'performance',
    });
  }

  logSlowOperation(context: LogContext): void {
    this.warn('Slow operation detected', {
      ...context,
      type: 'slow_operation',
    });
  }

  // Cache logging
  logCacheHit(context: LogContext): void {
    this.debug('Cache hit', {
      ...context,
      type: 'cache_hit',
    });
    this.metrics.cache.hits++;
    this.updateCacheMetrics();
  }

  logCacheMiss(context: LogContext): void {
    this.debug('Cache miss', {
      ...context,
      type: 'cache_miss',
    });
    this.metrics.cache.misses++;
    this.updateCacheMetrics();
  }

  // External service logging
  logExternalService(context: LogContext): void {
    this.info('External service call', {
      ...context,
      type: 'external_service',
    });
  }

  logExternalServiceError(context: LogContext): void {
    this.error('External service error', {
      ...context,
      type: 'external_service_error',
    });
    this.updateErrorMetrics('external_service_error', context);
  }

  // Metrics collection
  private startMetricsCollection(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  private updateResponseTimeMetrics(): void {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const avg = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    this.metrics.requests.avgResponseTime = avg;
    this.metrics.requests.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    this.metrics.requests.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
  }

  private updateQueryMetrics(): void {
    if (this.queryTimes.length === 0) return;

    const avg = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
    const slowQueries = this.queryTimes.filter(time => time > 1000).length;
    
    this.metrics.database.avgQueryTime = avg;
    this.metrics.database.slowQueries = slowQueries;
    this.metrics.database.queries = this.queryTimes.length;
  }

  private updateCacheMetrics(): void {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? this.metrics.cache.hits / total : 0;
  }

  private updateSystemMetrics(): void {
    this.metrics.system.memoryUsage = process.memoryUsage();
    this.metrics.system.cpuUsage = process.cpuUsage();
    this.metrics.system.uptime = process.uptime();
  }

  private updateErrorMetrics(errorType: string, context?: LogContext): void {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    
    if (context?.url) {
      const endpoint = context.method ? `${context.method} ${context.url}` : context.url;
      this.metrics.errors.byEndpoint[endpoint] = (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;
    }
  }

  // Get current metrics
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  // Get health status based on metrics
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: Metrics;
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check error rate
    const errorRate = this.metrics.requests.total > 0 
      ? this.metrics.requests.error / this.metrics.requests.total 
      : 0;
    
    if (errorRate > 0.1) { // 10% error rate
      issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
      status = 'unhealthy';
    } else if (errorRate > 0.05) { // 5% error rate
      issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
      status = 'degraded';
    }

    // Check response times
    if (this.metrics.requests.p95ResponseTime > 5000) { // 5 seconds
      issues.push(`High P95 response time: ${this.metrics.requests.p95ResponseTime}ms`);
      status = 'unhealthy';
    } else if (this.metrics.requests.p95ResponseTime > 2000) { // 2 seconds
      issues.push(`Elevated P95 response time: ${this.metrics.requests.p95ResponseTime}ms`);
      status = 'degraded';
    }

    // Check memory usage
    const memoryUsage = this.metrics.system.memoryUsage;
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      issues.push(`Elevated memory usage: ${memoryUsagePercent.toFixed(2)}%`);
      status = 'degraded';
    }

    // Check slow queries
    if (this.metrics.database.slowQueries > 10) {
      issues.push(`High number of slow queries: ${this.metrics.database.slowQueries}`);
      status = 'degraded';
    }

    return {
      status,
      issues,
      metrics: this.getMetrics(),
    };
  }

  // Create child logger with additional context
  child(context: LogContext): LoggerInstance {
    const childLogger = new LoggerInstance();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  // Export logs to file (for archival)
  async exportLogs(filePath: string, options: {
    startDate?: Date;
    endDate?: Date;
    level?: LogLevel;
    limit?: number;
  } = {}): Promise<void> {
    // This would typically read from log storage and export
    // For now, just log the export request
    this.info('Exporting logs', {
      filePath,
      options,
      type: 'log_export',
    });
  }

  // Rotate logs
  rotateLogs(): void {
    this.info('Rotating logs', { type: 'log_rotation' });
    // Implementation would depend on log storage system
  }

  // Cleanup old metrics data
  cleanupMetrics(): void {
    // Reset metrics counters periodically
    this.responseTimes = this.responseTimes.slice(-100);
    this.queryTimes = this.queryTimes.slice(-100);
    
    // Keep only recent error data
    const errorTypes = Object.keys(this.metrics.errors.byType);
    errorTypes.forEach(type => {
      if (this.metrics.errors.byType[type] < 10) {
        delete this.metrics.errors.byType[type];
      }
    });
  }
}

// Logger singleton
let loggerInstance: LoggerInstance;

export function getLogger(): LoggerInstance {
  if (!loggerInstance) {
    loggerInstance = new LoggerInstance();
  }
  return loggerInstance;
}

// Export default logger
export const logger = getLogger();

// Middleware factory for request logging
export function createRequestLogger() {
  return (request: any, reply: any, done: () => void) => {
    const startTime = Date.now();
        request.log = logger.child({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    // Log request
    request.log.logRequest({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    // Log response
    reply.addHook('onSend', async () => {
      const responseTime = Date.now() - startTime;
      request.log.logResponse({
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime,
      });
    });

    done();
  };
}

// Export for testing
export { LoggerInstance };
