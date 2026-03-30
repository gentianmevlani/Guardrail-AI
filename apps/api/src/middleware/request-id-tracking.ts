/**
 * Request ID Tracking and Propagation
 * 
 * Ensures every request has a requestId that's:
 * - In logs
 * - In response headers  
 * - Propagated to outbound calls
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { generateRequestId, getRequestContext, setRequestContext } from '../lib/request-context';
import { logger } from '../logger';

// Request ID validation regex
const REQUEST_ID_REGEX = /^[a-zA-Z0-9\-_\.]{8,64}$/;

/**
 * Validate request ID format
 */
function validateRequestId(requestId: string): boolean {
  if (!requestId || typeof requestId !== 'string') {
    return false;
  }
  
  // Check length
  if (requestId.length < 8 || requestId.length > 64) {
    return false;
  }
  
  // Check allowed characters
  return REQUEST_ID_REGEX.test(requestId);
}

/**
 * Generate a safe request ID
 */
function generateSafeRequestId(): string {
  return generateRequestId();
}

/**
 * Extract request ID from headers
 */
function extractRequestId(request: FastifyRequest): string | null {
  const requestId = request.headers['x-request-id'] as string;
  
  if (!requestId) {
    return null;
  }
  
  if (validateRequestId(requestId)) {
    return requestId;
  }
  
  // Log invalid request ID
  logger.warn(
    {
      invalidRequestId: requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
    'Invalid request ID format, generating new one'
  );
  
  return null;
}

/**
 * Request ID tracking middleware
 */
export function requestIdTrackingMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract or generate request ID
    let requestId = extractRequestId(request);
    
    if (!requestId) {
      requestId = generateSafeRequestId();
    }
    
    // Store request ID for easy access
    (request as any).requestId = requestId;
    
    // Set request context
    const context = {
      requestId,
      userId: (request.user as any)?.id,
      userAgent: request.headers['user-agent'],
      ip: Array.isArray(request.ip) ? request.ip[0] : (request.ip || request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown'),
      startTime: Date.now(),
      route: request.routeOptions?.url,
      method: request.method,
    };
    
    setRequestContext(context);
    
    // Add request ID to response headers
    reply.header('X-Request-ID', requestId);
    reply.header('X-Correlation-ID', requestId);
    
    // Add request ID to logger context
    const requestLogger = logger.child({ requestId });
    (request as any).log = requestLogger;
    
    // Log request start
    requestLogger.debug(
      {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId,
      },
      'Request started'
    );
  };
}

/**
 * Enhanced fetch with request ID propagation
 */
export function createSafeFetch(baseFetch = fetch) {
  return async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Get current request context
    const context = getRequestContext();
    
    // Create headers with correlation ID
    const headers = new Headers(options.headers);
    
    if (context?.requestId) {
      headers.set('X-Request-ID', context.requestId);
      headers.set('X-Correlation-ID', context.requestId);
    }
    
    // Add additional context headers
    if (context?.userId) {
      headers.set('X-User-ID', context.userId);
    }
    
    if (context?.userAgent) {
      headers.set('X-User-Agent', context.userAgent);
    }
    
    if (context?.ip) {
      headers.set('X-Client-IP', context.ip);
    }
    
    // Log outbound request
    logger.debug(
      {
        method: options.method || 'GET',
        url,
        requestId: context?.requestId,
        headers: Object.fromEntries(headers.entries()),
      },
      'Outbound request'
    );
    
    // Make request with propagated headers
    const response = await baseFetch(url, {
      ...options,
      headers,
    });
    
    // Log response
    logger.debug(
      {
        status: response.status,
        statusText: response.statusText,
        url,
        requestId: context?.requestId,
      },
      'Outbound response'
    );
    
    return response;
  };
}

/**
 * Axios interceptor for request ID propagation
 */
export function createAxiosRequestInterceptor(axios: any) {
  // Request interceptor
  axios.interceptors.request.use((config: any) => {
    const context = getRequestContext();
    
    if (context?.requestId) {
      config.headers = config.headers || {};
      config.headers['X-Request-ID'] = context.requestId;
      config.headers['X-Correlation-ID'] = context.requestId;
    }
    
    if (context?.userId) {
      config.headers = config.headers || {};
      config.headers['X-User-ID'] = context.userId;
    }
    
    return config;
  });
  
  // Response interceptor
  axios.interceptors.response.use(
    (response: any) => {
      logger.debug(
        {
          status: response.status,
          url: response.config.url,
          requestId: response.config.headers['X-Request-ID'],
        },
        'Axios response'
      );
      
      return response;
    },
    (error: any) => {
      logger.debug(
        {
          status: error.response?.status,
          url: error.config?.url,
          requestId: error.config?.headers?.['X-Request-ID'],
          error: error.message,
        },
        'Axios error'
      );
      
      return Promise.reject(error);
    }
  );
}

/**
 * Hook to add request ID to response logging
 */
export function addResponseLoggingHooks(fastify: any) {
  // Add response logging hook
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestId = (request as any).requestId;
    const context = getRequestContext();
    
    if (requestId && context) {
      const duration = Date.now() - (context.startTime || Date.now());
      
      (request as any).log?.info(
        {
          statusCode: reply.statusCode,
          responseTime: duration,
          contentLength: reply.getHeader('content-length'),
          requestId,
        },
        'Request completed'
      );
    }
    
    return payload;
  });
  
  // Add error logging hook
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: any) => {
    const requestId = (request as any).requestId;
    
    if (requestId) {
      (request as any).log?.error(
        {
          error: error.message,
          stack: error.stack,
          statusCode: reply.statusCode,
          requestId,
        },
        'Request error'
      );
    }
  });
}

/**
 * Helper to get request ID from anywhere in the code
 */
export function getCurrentRequestId(): string {
  const context = getRequestContext();
  return context?.requestId || 'unknown';
}

/**
 * Helper to create child logger with request ID
 */
export function createRequestLogger(additionalContext: any = {}) {
  const requestId = getCurrentRequestId();
  return logger.child({ 
    requestId, 
    ...additionalContext 
  });
}

/**
 * Middleware to validate request ID in production
 */
export function requestIdValidationMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const providedRequestId = request.headers['x-request-id'] as string;
    
    // In production, be stricter about request ID validation
    if (process.env.NODE_ENV === 'production' && providedRequestId) {
      if (!validateRequestId(providedRequestId)) {
        logger.warn(
          {
            invalidRequestId: providedRequestId,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
          'Rejected request with invalid ID format'
        );
        
        return reply.status(400).send({
          success: false,
          error: 'Invalid request ID format',
          code: 'INVALID_REQUEST_ID',
        });
      }
    }
  };
}

/**
 * Test helper to verify request ID propagation
 */
export function testRequestIdPropagation() {
  return {
    generateRequestId,
    validateRequestId,
    getCurrentRequestId,
    createSafeFetch,
  };
}
