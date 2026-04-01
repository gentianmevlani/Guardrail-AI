/**
 * Explicit CORS Allowlist Configuration
 * 
 * Locks CORS down to known origins and headers
 * No wildcards in production, default deny policy
 */

import { FastifyInstance } from 'fastify';
import { logger } from '../logger';

interface CORSConfig {
  allowedOrigins: string[];
  allowedHeaders: string[];
  allowedMethods: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

/**
 * Parse ALLOWED_ORIGINS environment variable
 */
function parseAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  
  if (!envOrigins) {
    // Default to localhost for development
    if (process.env.NODE_ENV === 'development') {
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      ];
    }
    
    // In production, require explicit configuration
    logger.warn('ALLOWED_ORIGINS not configured, using empty allowlist');
    return [];
  }
  
  return envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Default allowed headers - only what we actually use
 */
const DEFAULT_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Request-ID',
  'X-Correlation-ID',
  'X-User-ID',
  'X-Client-ID',
  'Accept',
  'Origin',
  'User-Agent',
];

/**
 * Default allowed methods
 */
const DEFAULT_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
];

/**
 * Create explicit CORS configuration
 */
export function createCORSConfig(): CORSConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const allowedOrigins = parseAllowedOrigins();
  
  const config: CORSConfig = {
    allowedOrigins,
    allowedHeaders: DEFAULT_ALLOWED_HEADERS,
    allowedMethods: DEFAULT_ALLOWED_METHODS,
    credentials: true, // Needed for auth cookies/tokens
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  
  // Log configuration in development
  if (isDevelopment) {
    logger.debug({
      allowedOrigins: config.allowedOrigins,
      allowedHeaders: config.allowedHeaders,
      credentials: config.credentials,
    }, 'CORS configuration loaded');
  }
  
  return config;
}

/**
 * Origin validation function
 */
export function validateOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  // No origin header (same-origin requests) are allowed
  if (!origin) {
    return true;
  }
  
  // Check if origin is in allowlist
  return allowedOrigins.includes(origin);
}

/**
 * Register explicit CORS middleware
 */
export async function registerExplicitCORS(fastify: FastifyInstance): Promise<void> {
  const config = createCORSConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  
  await fastify.register(require('@fastify/cors'), {
    // Origin validation with explicit allowlist
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = validateOrigin(origin, config.allowedOrigins);
      
      if (!allowed) {
        // Log blocked CORS attempts in production
        if (isProduction) {
          logger.warn(
            {
              origin,
              allowedOrigins: config.allowedOrigins,
              ip: origin, // This will be the origin string, not IP
            },
            'CORS origin blocked'
          );
        }
        
        return callback(new Error('Not allowed by CORS'), false);
      }
      
      // In development, log allowed origins for debugging
      if (!isProduction && origin) {
        logger.debug(
          { origin, allowedOrigins: config.allowedOrigins },
          'CORS origin allowed'
        );
      }
      
      return callback(null, true);
    },
    
    // Explicit header allowlist
    allowedHeaders: config.allowedHeaders,
    
    // Explicit method allowlist
    methods: config.allowedMethods,
    
    // Credentials for auth
    credentials: config.credentials,
    
    // Cache preflight requests
    maxAge: config.maxAge,
    
    // Don't continue to route handlers for OPTIONS
    preflightContinue: config.preflightContinue,
    
    // Success status for preflight
    optionsSuccessStatus: config.optionsSuccessStatus,
    
    // Hide CORS headers in errors
    hideOptionsRoute: false, // Let @fastify/cors handle OPTIONS automatically
  });
  
  // Note: @fastify/cors automatically handles OPTIONS requests,
  // so we don't need to register an explicit OPTIONS handler
  
  logger.info('Explicit CORS middleware registered');
}

/**
 * Middleware to log CORS violations
 */
export function corsLoggingMiddleware() {
  return async (request: any, reply: any) => {
    const origin = request.headers.origin;
    
    // Log cross-origin requests
    if (origin && origin !== request.headers.host) {
      logger.debug(
        {
          origin,
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'],
        },
        'Cross-origin request received'
      );
    }
    
    // Add CORS headers to response for debugging
    reply.addHook('onSend', async (request: any, reply: any) => {
      // Log when CORS headers are sent
      if (reply.getHeader('access-control-allow-origin')) {
        logger.debug(
          {
            origin: request.headers.origin,
            allowedOrigin: reply.getHeader('access-control-allow-origin'),
            method: request.method,
          },
          'CORS headers sent'
        );
      }
    });
  };
}

/**
 * Validate CORS configuration
 */
export function validateCORSConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = createCORSConfig();
  
  // Check if origins are configured in production
  if (process.env.NODE_ENV === 'production') {
    if (config.allowedOrigins.length === 0) {
      errors.push('ALLOWED_ORIGINS must be configured in production');
    }
    
    // Check for wildcards in production
    if (config.allowedOrigins.includes('*')) {
      errors.push('Wildcard origins (*) not allowed in production');
    }
    
    // Check for insecure origins in production
    const insecureOrigins = config.allowedOrigins.filter(origin => 
      origin.startsWith('http://') && !origin.includes('localhost')
    );
    
    if (insecureOrigins.length > 0) {
      errors.push(`Insecure HTTP origins not allowed in production: ${insecureOrigins.join(', ')}`);
    }
  }
  
  // Check headers configuration
  if (config.allowedHeaders.includes('*')) {
    errors.push('Wildcard headers (*) not recommended');
  }
  
  // Check methods configuration
  if (config.allowedMethods.includes('*')) {
    errors.push('Wildcard methods (*) not recommended');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
