/**
 * Enhanced Logging & Monitoring System
 * Provides structured logging, metrics collection, and monitoring
 */
export declare enum LogLevel {
    TRACE = "trace",
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal"
}
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
declare class LoggerInstance {
    private logger;
    private metrics;
    private responseTimes;
    private queryTimes;
    private startTime;
    constructor();
    trace(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    fatal(message: string, context?: LogContext): void;
    logRequest(context: LogContext): void;
    logResponse(context: LogContext): void;
    logQuery(context: LogContext): void;
    logDatabaseError(context: LogContext): void;
    logAuth(context: LogContext): void;
    logAuthFailure(context: LogContext): void;
    logSecurityEvent(context: LogContext): void;
    logBusinessEvent(context: LogContext): void;
    logBusinessError(context: LogContext): void;
    logPerformance(context: LogContext): void;
    logSlowOperation(context: LogContext): void;
    logCacheHit(context: LogContext): void;
    logCacheMiss(context: LogContext): void;
    logExternalService(context: LogContext): void;
    logExternalServiceError(context: LogContext): void;
    private startMetricsCollection;
    private updateResponseTimeMetrics;
    private updateQueryMetrics;
    private updateCacheMetrics;
    private updateSystemMetrics;
    private updateErrorMetrics;
    getMetrics(): Metrics;
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        issues: string[];
        metrics: Metrics;
    };
    child(context: LogContext): LoggerInstance;
    exportLogs(filePath: string, options?: {
        startDate?: Date;
        endDate?: Date;
        level?: LogLevel;
        limit?: number;
    }): Promise<void>;
    rotateLogs(): void;
    cleanupMetrics(): void;
}
export declare function getLogger(): LoggerInstance;
export declare const logger: LoggerInstance;
export declare function createRequestLogger(): (request: any, reply: any, done: () => void) => void;
export { LoggerInstance };
//# sourceMappingURL=enhanced-logger.d.ts.map