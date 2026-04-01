"use strict";
/**
 * Request Context and Correlation ID Management
 *
 * Provides utilities for propagating request IDs through the system
 * and ensuring consistent correlation across outbound calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestId = generateRequestId;
exports.setRequestContext = setRequestContext;
exports.getRequestContext = getRequestContext;
exports.getRequestId = getRequestId;
exports.createCorrelationHeaders = createCorrelationHeaders;
exports.withRequestContext = withRequestContext;
exports.executeWithContext = executeWithContext;
exports.requestContextMiddleware = requestContextMiddleware;
const async_hooks_1 = require("async_hooks");
// AsyncLocalStorage for request context propagation
const requestContext = new async_hooks_1.AsyncLocalStorage();
/**
 * Generate a unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Set the current request context
 */
function setRequestContext(context) {
    requestContext.enterWith(context);
}
/**
 * Get the current request context
 */
function getRequestContext() {
    return requestContext.getStore();
}
/**
 * Get the current request ID (or generate one if none exists)
 */
function getRequestId() {
    const context = getRequestContext();
    if (context?.requestId) {
        return context.requestId;
    }
    // Generate a fallback request ID for out-of-band operations
    return generateRequestId();
}
/**
 * Create headers for outbound API calls with correlation ID
 */
function createCorrelationHeaders(existingHeaders = {}) {
    const requestId = getRequestId();
    const context = getRequestContext();
    return {
        ...existingHeaders,
        // Standard correlation headers
        'X-Request-Id': requestId,
        'X-Correlation-Id': requestId,
        // Additional context headers
        ...(context?.userId && { 'X-User-Id': context.userId }),
        ...(context?.userAgent && { 'X-User-Agent': context.userAgent }),
        ...(context?.ip && { 'X-Client-IP': context.ip }),
    };
}
/**
 * Wrap an async function with request context
 */
function withRequestContext(fn, context) {
    return ((...args) => {
        return requestContext.run(context, () => fn(...args));
    });
}
/**
 * Execute a function within a request context and return the result
 */
async function executeWithContext(context, fn) {
    return requestContext.run(context, fn);
}
/**
 * Middleware for Fastify to set up request context
 */
function requestContextMiddleware() {
    return async (request, reply) => {
        const requestId = request.headers['x-request-id'] || generateRequestId();
        const context = {
            requestId,
            userId: request.user?.id,
            userAgent: request.headers['user-agent'],
            ip: request.ip || request.headers['x-forwarded-for'] || request.headers['x-real-ip'],
            startTime: Date.now(),
        };
        // Set context for this request
        setRequestContext(context);
        // Add requestId to request object for easy access
        request.requestId = requestId;
        // Add correlation headers to response
        reply.header('X-Request-Id', requestId);
        reply.header('X-Correlation-Id', requestId);
    };
}
