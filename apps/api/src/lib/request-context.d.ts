/**
 * Request Context and Correlation ID Management
 *
 * Provides utilities for propagating request IDs through the system
 * and ensuring consistent correlation across outbound calls.
 */
export interface RequestContext {
    requestId: string;
    userId?: string;
    userAgent?: string;
    ip?: string;
    startTime?: number;
}
/**
 * Generate a unique request ID
 */
export declare function generateRequestId(): string;
/**
 * Set the current request context
 */
export declare function setRequestContext(context: RequestContext): void;
/**
 * Get the current request context
 */
export declare function getRequestContext(): RequestContext | undefined;
/**
 * Get the current request ID (or generate one if none exists)
 */
export declare function getRequestId(): string;
/**
 * Create headers for outbound API calls with correlation ID
 */
export declare function createCorrelationHeaders(existingHeaders?: Record<string, string>): Record<string, string>;
/**
 * Wrap an async function with request context
 */
export declare function withRequestContext<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, context: RequestContext): T;
/**
 * Execute a function within a request context and return the result
 */
export declare function executeWithContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T>;
/**
 * Middleware for Fastify to set up request context
 */
export declare function requestContextMiddleware(): (request: any, reply: any) => Promise<void>;
//# sourceMappingURL=request-context.d.ts.map