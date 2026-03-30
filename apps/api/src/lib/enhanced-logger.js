"use strict";
/**
 * Enhanced Logging & Monitoring System
 * Provides structured logging, metrics collection, and monitoring
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerInstance = exports.logger = exports.LogLevel = void 0;
exports.getLogger = getLogger;
exports.createRequestLogger = createRequestLogger;
const pino = __importStar(require("pino"));
// Log levels
var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "trace";
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// Logger class
class LoggerInstance {
    logger;
    metrics;
    responseTimes = [];
    queryTimes = [];
    startTime;
    constructor() {
        this.startTime = Date.now();
        // Initialize Pino logger
        this.logger = pino({
            level: process.env.LOG_LEVEL || 'info',
            formatters: {
                level: (label) => ({ level: label }),
                log: (object) => {
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
    trace(message, context) {
        this.logger.trace(context, message);
    }
    debug(message, context) {
        this.logger.debug(context, message);
    }
    info(message, context) {
        this.logger.info(context, message);
    }
    warn(message, context) {
        this.logger.warn(context, message);
        this.updateErrorMetrics('warning', context);
    }
    error(message, context) {
        this.logger.error(context, message);
        this.updateErrorMetrics('error', context);
    }
    fatal(message, context) {
        this.logger.fatal(context, message);
        this.updateErrorMetrics('fatal', context);
    }
    // Request logging
    logRequest(context) {
        this.info('Incoming request', {
            ...context,
            type: 'request',
        });
        this.metrics.requests.total++;
    }
    logResponse(context) {
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
        }
        else {
            this.metrics.requests.success++;
        }
        this.info('Request completed', {
            ...context,
            type: 'response',
        });
    }
    // Database logging
    logQuery(context) {
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
    logDatabaseError(context) {
        this.error('Database error occurred', {
            ...context,
            type: 'database_error',
        });
        this.updateErrorMetrics('database_error', context);
    }
    // Authentication logging
    logAuth(context) {
        this.info('Authentication event', {
            ...context,
            type: 'authentication',
        });
    }
    logAuthFailure(context) {
        this.warn('Authentication failed', {
            ...context,
            type: 'auth_failure',
        });
        this.updateErrorMetrics('auth_failure', context);
    }
    // Security logging
    logSecurityEvent(context) {
        this.warn('Security event detected', {
            ...context,
            type: 'security_event',
        });
        this.updateErrorMetrics('security_event', context);
    }
    // Business logic logging
    logBusinessEvent(context) {
        this.info('Business event', {
            ...context,
            type: 'business_event',
        });
    }
    logBusinessError(context) {
        this.error('Business logic error', {
            ...context,
            type: 'business_error',
        });
        this.updateErrorMetrics('business_error', context);
    }
    // Performance logging
    logPerformance(context) {
        this.info('Performance metric', {
            ...context,
            type: 'performance',
        });
    }
    logSlowOperation(context) {
        this.warn('Slow operation detected', {
            ...context,
            type: 'slow_operation',
        });
    }
    // Cache logging
    logCacheHit(context) {
        this.debug('Cache hit', {
            ...context,
            type: 'cache_hit',
        });
        this.metrics.cache.hits++;
        this.updateCacheMetrics();
    }
    logCacheMiss(context) {
        this.debug('Cache miss', {
            ...context,
            type: 'cache_miss',
        });
        this.metrics.cache.misses++;
        this.updateCacheMetrics();
    }
    // External service logging
    logExternalService(context) {
        this.info('External service call', {
            ...context,
            type: 'external_service',
        });
    }
    logExternalServiceError(context) {
        this.error('External service error', {
            ...context,
            type: 'external_service_error',
        });
        this.updateErrorMetrics('external_service_error', context);
    }
    // Metrics collection
    startMetricsCollection() {
        // Update system metrics every 30 seconds
        setInterval(() => {
            this.updateSystemMetrics();
        }, 30000);
    }
    updateResponseTimeMetrics() {
        if (this.responseTimes.length === 0)
            return;
        const sorted = [...this.responseTimes].sort((a, b) => a - b);
        const avg = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
        this.metrics.requests.avgResponseTime = avg;
        this.metrics.requests.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
        this.metrics.requests.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
    }
    updateQueryMetrics() {
        if (this.queryTimes.length === 0)
            return;
        const avg = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
        const slowQueries = this.queryTimes.filter(time => time > 1000).length;
        this.metrics.database.avgQueryTime = avg;
        this.metrics.database.slowQueries = slowQueries;
        this.metrics.database.queries = this.queryTimes.length;
    }
    updateCacheMetrics() {
        const total = this.metrics.cache.hits + this.metrics.cache.misses;
        this.metrics.cache.hitRate = total > 0 ? this.metrics.cache.hits / total : 0;
    }
    updateSystemMetrics() {
        this.metrics.system.memoryUsage = process.memoryUsage();
        this.metrics.system.cpuUsage = process.cpuUsage();
        this.metrics.system.uptime = process.uptime();
    }
    updateErrorMetrics(errorType, context) {
        this.metrics.errors.total++;
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
        if (context?.url) {
            const endpoint = context.method ? `${context.method} ${context.url}` : context.url;
            this.metrics.errors.byEndpoint[endpoint] = (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;
        }
    }
    // Get current metrics
    getMetrics() {
        return { ...this.metrics };
    }
    // Get health status based on metrics
    getHealthStatus() {
        const issues = [];
        let status = 'healthy';
        // Check error rate
        const errorRate = this.metrics.requests.total > 0
            ? this.metrics.requests.error / this.metrics.requests.total
            : 0;
        if (errorRate > 0.1) { // 10% error rate
            issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
            status = 'unhealthy';
        }
        else if (errorRate > 0.05) { // 5% error rate
            issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
            status = 'degraded';
        }
        // Check response times
        if (this.metrics.requests.p95ResponseTime > 5000) { // 5 seconds
            issues.push(`High P95 response time: ${this.metrics.requests.p95ResponseTime}ms`);
            status = 'unhealthy';
        }
        else if (this.metrics.requests.p95ResponseTime > 2000) { // 2 seconds
            issues.push(`Elevated P95 response time: ${this.metrics.requests.p95ResponseTime}ms`);
            status = 'degraded';
        }
        // Check memory usage
        const memoryUsage = this.metrics.system.memoryUsage;
        const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        if (memoryUsagePercent > 90) {
            issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
            status = 'unhealthy';
        }
        else if (memoryUsagePercent > 80) {
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
    child(context) {
        const childLogger = new LoggerInstance();
        childLogger.logger = this.logger.child(context);
        return childLogger;
    }
    // Export logs to file (for archival)
    async exportLogs(filePath, options = {}) {
        // This would typically read from log storage and export
        // For now, just log the export request
        this.info('Exporting logs', {
            filePath,
            options,
            type: 'log_export',
        });
    }
    // Rotate logs
    rotateLogs() {
        this.info('Rotating logs', { type: 'log_rotation' });
        // Implementation would depend on log storage system
    }
    // Cleanup old metrics data
    cleanupMetrics() {
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
exports.LoggerInstance = LoggerInstance;
// Logger singleton
let loggerInstance;
function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new LoggerInstance();
    }
    return loggerInstance;
}
// Export default logger
exports.logger = getLogger();
// Middleware factory for request logging
function createRequestLogger() {
    return (request, reply, done) => {
        const startTime = Date.now();
        request.log = exports.logger.child({
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
