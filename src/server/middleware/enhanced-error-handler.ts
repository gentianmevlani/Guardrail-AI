/**
 * Enhanced Error Handling Middleware for Express
 * 
 * Provides comprehensive error handling with proper logging and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

/**
 * Custom API Error class
 */
export class CustomApiError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'CustomApiError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, CustomApiError);
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error with context
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString()
  });

  // Handle different error types
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
    return;
  }

  // Handle Multer errors (file uploads)
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let code = 'FILE_UPLOAD_ERROR';

    if (err.message.includes('File too large')) {
      message = 'File too large';
      code = 'FILE_TOO_LARGE';
    } else if (err.message.includes('Unexpected field')) {
      message = 'Unexpected field in file upload';
      code = 'UNEXPECTED_FIELD';
    }

    res.status(400).json({
      success: false,
      error: message,
      code
    });
    return;
  }

  // Handle custom API errors
  if (err instanceof CustomApiError) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details })
    });
    return;
  }

  // Handle syntax errors (invalid JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
    return;
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env['NODE_ENV'] !== 'production';
  
  res.status(statusCode).json({
    success: false,
    error: isDevelopment || err.isOperational ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err.details 
    })
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create typed error responses
 */
export const createError = {
  badRequest: (message: string, details?: any) => 
    new CustomApiError(message, 400, 'BAD_REQUEST', details),
    
  unauthorized: (message: string = 'Unauthorized') => 
    new CustomApiError(message, 401, 'UNAUTHORIZED'),
    
  forbidden: (message: string = 'Forbidden') => 
    new CustomApiError(message, 403, 'FORBIDDEN'),
    
  notFound: (message: string = 'Resource not found') => 
    new CustomApiError(message, 404, 'NOT_FOUND'),
    
  conflict: (message: string, details?: any) => 
    new CustomApiError(message, 409, 'CONFLICT', details),
    
  tooManyRequests: (message: string = 'Too many requests') => 
    new CustomApiError(message, 429, 'TOO_MANY_REQUESTS'),
    
  internal: (message: string = 'Internal server error', details?: any) => 
    new CustomApiError(message, 500, 'INTERNAL_ERROR', details),
    
  serviceUnavailable: (message: string = 'Service unavailable') => 
    new CustomApiError(message, 503, 'SERVICE_UNAVAILABLE'),
    
  paymentRequired: (message: string = 'Payment required') => 
    new CustomApiError(message, 402, 'PAYMENT_REQUIRED')
};

/**
 * 404 handler middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
}

/**
 * Process unhandled promise rejections
 */
export function handleUnhandledRejections(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to exit the process
    if (process.env['NODE_ENV'] === 'production') {
      console.error('Shutting down due to unhandled rejection');
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    console.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw createError.serviceUnavailable('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
