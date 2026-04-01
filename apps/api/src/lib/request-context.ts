/**
 * Request Context and Correlation ID Management
 * 
 * Provides utilities for propagating request IDs through the system
 * and ensuring consistent correlation across outbound calls.
 */

import { AsyncLocalStorage } from 'async_hooks';

// Request context interface
export interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  startTime?: number;
}

// AsyncLocalStorage for request context propagation
const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set the current request context
 */
export function setRequestContext(context: RequestContext): void {
  requestContext.enterWith(context);
}

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Get the current request ID (or generate one if none exists)
 */
export function getRequestId(): string {
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
export function createCorrelationHeaders(existingHeaders: Record<string, string> = {}): Record<string, string> {
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
export function withRequestContext<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: RequestContext
): T {
  return ((...args: Parameters<T>) => {
    return requestContext.run(context, () => fn(...args));
  }) as T;
}

/**
 * Execute a function within a request context and return the result
 */
export async function executeWithContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContext.run(context, fn);
}

/**
 * Middleware for Fastify to set up request context
 */
export function requestContextMiddleware() {
  return async (request: any, reply: any) => {
    const requestId = request.headers['x-request-id'] as string || generateRequestId();
    
    const context: RequestContext = {
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
