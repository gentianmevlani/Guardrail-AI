/**
 * Enhanced Error Handling Middleware
 * Provides comprehensive error handling with proper status codes,
 * logging, and error correlation
 */

import { Prisma } from '@prisma/client';
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../logger';
import { ApiErrorCode, ApiResponse, ResponseBuilder } from '../types/api-responses';

// Error classification
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  INTERNAL = 'internal',
  RATE_LIMIT = 'rate_limit',
}

// Custom error classes
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly details?: unknown;
  public readonly field?: string;
  public readonly isOperational: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    category: ErrorCategory,
    details?: unknown,
    field?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.category = category;
    this.details = details;
    this.field = field;
    this.isOperational = true;
    this.statusCode = getStatusCodeFromErrorCode(code);
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, ApiError);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, field?: string, details?: unknown) {
    super(
      ApiErrorCode.VALIDATION_FAILED,
      message,
      ErrorCategory.VALIDATION,
      details,
      field
    );
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(
      ApiErrorCode.UNAUTHORIZED,
      message,
      ErrorCategory.AUTHENTICATION
    );
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(
      ApiErrorCode.FORBIDDEN,
      message,
      ErrorCategory.AUTHORIZATION
    );
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(
      ApiErrorCode.NOT_FOUND,
      `${resource} not found`,
      ErrorCategory.NOT_FOUND
    );
    this.name = 'NotFoundError';
  }
}

export class BusinessLogicError extends ApiError {
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(
      code,
      message,
      ErrorCategory.BUSINESS_LOGIC,
      details
    );
    this.name = 'BusinessLogicError';
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      ApiErrorCode.EXTERNAL_SERVICE_ERROR,
      `${service} service error: ${message}`,
      ErrorCategory.EXTERNAL_SERVICE,
      details
    );
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(
      ApiErrorCode.DATABASE_ERROR,
      `Database error: ${message}`,
      ErrorCategory.DATABASE,
      details
    );
    this.name = 'DatabaseError';
  }
}

export class RateLimitError extends ApiError {
  constructor(limit: number, windowMs: number) {
    super(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`,
      ErrorCategory.RATE_LIMIT,
      { limit, windowMs }
    );
    this.name = 'RateLimitError';
  }
}

function rateLimitLimitFromDetails(details: unknown): number {
  if (typeof details === 'object' && details !== null && 'limit' in details) {
    const v = (details as Record<string, unknown>)['limit'];
    return typeof v === 'number' && Number.isFinite(v) ? v : 60;
  }
  return 60;
}

// Error code to HTTP status code mapping
function getStatusCodeFromErrorCode(code: ApiErrorCode): number {
  const codeMap: Record<ApiErrorCode, number> = {
    [ApiErrorCode.VALIDATION_FAILED]: 400,
    [ApiErrorCode.INVALID_INPUT]: 400,
    [ApiErrorCode.MISSING_REQUIRED_FIELD]: 400,
    [ApiErrorCode.INVALID_FORMAT]: 400,
    
    [ApiErrorCode.UNAUTHORIZED]: 401,
    [ApiErrorCode.INVALID_TOKEN]: 401,
    [ApiErrorCode.TOKEN_EXPIRED]: 401,
    [ApiErrorCode.TOKEN_REVOKED]: 401,
    [ApiErrorCode.INVALID_CREDENTIALS]: 401,
    
    [ApiErrorCode.FORBIDDEN]: 403,
    [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
    [ApiErrorCode.ACCOUNT_SUSPENDED]: 403,
    
    [ApiErrorCode.NOT_FOUND]: 404,
    [ApiErrorCode.RESOURCE_NOT_FOUND]: 404,
    [ApiErrorCode.ENDPOINT_NOT_FOUND]: 404,
    
    [ApiErrorCode.CONFLICT]: 409,
    [ApiErrorCode.DUPLICATE_RESOURCE]: 409,
    [ApiErrorCode.RESOURCE_LOCKED]: 409,
    
    [ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ApiErrorCode.TOO_MANY_REQUESTS]: 429,
    
    [ApiErrorCode.INTERNAL_ERROR]: 500,
    [ApiErrorCode.DATABASE_ERROR]: 500,
    [ApiErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
    [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
    
    [ApiErrorCode.SUBSCRIPTION_REQUIRED]: 402,
    [ApiErrorCode.QUOTA_EXCEEDED]: 429,
    [ApiErrorCode.FEATURE_NOT_AVAILABLE]: 403,
    [ApiErrorCode.INVALID_PLAN]: 400,
  };
  
  return codeMap[code] || 500;
}

// Error classification utility
function classifyError(error: Error): ErrorCategory {
  if (error instanceof ValidationError) return ErrorCategory.VALIDATION;
  if (error instanceof AuthenticationError) return ErrorCategory.AUTHENTICATION;
  if (error instanceof AuthorizationError) return ErrorCategory.AUTHORIZATION;
  if (error instanceof NotFoundError) return ErrorCategory.NOT_FOUND;
  if (error instanceof BusinessLogicError) return ErrorCategory.BUSINESS_LOGIC;
  if (error instanceof ExternalServiceError) return ErrorCategory.EXTERNAL_SERVICE;
  if (error instanceof DatabaseError) return ErrorCategory.DATABASE;
  if (error instanceof RateLimitError) return ErrorCategory.RATE_LIMIT;
  
  // Built-in error types
  if (error instanceof ZodError) return ErrorCategory.VALIDATION;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return ErrorCategory.DATABASE;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return ErrorCategory.DATABASE;
  if (error instanceof Prisma.PrismaClientRustPanicError) return ErrorCategory.DATABASE;
  if (error instanceof Prisma.PrismaClientInitializationError) return ErrorCategory.DATABASE;
  if (error instanceof Prisma.PrismaClientValidationError) return ErrorCategory.VALIDATION;
  
  // Check error message patterns
  const message = error.message.toLowerCase();
  
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCategory.VALIDATION;
  }
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ErrorCategory.AUTHENTICATION;
  }
  if (message.includes('forbidden') || message.includes('permission')) {
    return ErrorCategory.AUTHORIZATION;
  }
  if (message.includes('not found') || message.includes('does not exist')) {
    return ErrorCategory.NOT_FOUND;
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return ErrorCategory.RATE_LIMIT;
  }
  if (message.includes('database') || message.includes('sql')) {
    return ErrorCategory.DATABASE;
  }
  if (message.includes('external') || message.includes('third party')) {
    return ErrorCategory.EXTERNAL_SERVICE;
  }
  
  return ErrorCategory.INTERNAL;
}

// Convert various error types to ApiError
function convertToApiError(error: Error): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof ZodError) {
    return new ValidationError(
      'Request validation failed',
      undefined,
      error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
    );
  }
  
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    
    switch (prismaError.code) {
      case 'P2002':
        return new BusinessLogicError(
          ApiErrorCode.DUPLICATE_RESOURCE,
          'Resource already exists',
          { field: prismaError.meta?.target }
        );
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ValidationError('Foreign key constraint failed');
      default:
        return new DatabaseError(`Database constraint error: ${prismaError.message}`);
    }
  }
  
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Database validation failed', undefined, error.message);
  }
  
  // Generic error conversion
  const category = classifyError(error);
  const statusCode = getDefaultStatusCodeForCategory(category);
  
  return new ApiError(
    getDefaultErrorCodeForCategory(category),
    error.message || 'An error occurred',
    category,
    error.stack
  );
}

function getDefaultStatusCodeForCategory(category: ErrorCategory): number {
  switch (category) {
    case ErrorCategory.VALIDATION: return 400;
    case ErrorCategory.AUTHENTICATION: return 401;
    case ErrorCategory.AUTHORIZATION: return 403;
    case ErrorCategory.NOT_FOUND: return 404;
    case ErrorCategory.BUSINESS_LOGIC: return 400;
    case ErrorCategory.RATE_LIMIT: return 429;
    case ErrorCategory.EXTERNAL_SERVICE: return 502;
    case ErrorCategory.DATABASE: return 500;
    default: return 500;
  }
}

function getDefaultErrorCodeForCategory(category: ErrorCategory): ApiErrorCode {
  switch (category) {
    case ErrorCategory.VALIDATION: return ApiErrorCode.VALIDATION_FAILED;
    case ErrorCategory.AUTHENTICATION: return ApiErrorCode.UNAUTHORIZED;
    case ErrorCategory.AUTHORIZATION: return ApiErrorCode.FORBIDDEN;
    case ErrorCategory.NOT_FOUND: return ApiErrorCode.NOT_FOUND;
    case ErrorCategory.BUSINESS_LOGIC: return ApiErrorCode.INVALID_INPUT;
    case ErrorCategory.RATE_LIMIT: return ApiErrorCode.RATE_LIMIT_EXCEEDED;
    case ErrorCategory.EXTERNAL_SERVICE: return ApiErrorCode.EXTERNAL_SERVICE_ERROR;
    case ErrorCategory.DATABASE: return ApiErrorCode.DATABASE_ERROR;
    default: return ApiErrorCode.INTERNAL_ERROR;
  }
}

// Enhanced error handler middleware
export async function enhancedErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse> {
  const requestId = request.id;
  const startTime = Date.now();
  
  // Convert error to ApiError
  const apiError = convertToApiError(error);
  
  // Prepare error response
  const errorResponse = ResponseBuilder.error(
    apiError.code,
    apiError.message,
    apiError.details,
    apiError.field
  );
  
  // Set request ID in response
  errorResponse.error!.requestId = requestId;
  errorResponse.meta!.requestId = requestId;
  errorResponse.meta!.processingTime = Date.now() - startTime;
  
  // Log error with context
  const logLevel = getLogLevelForCategory(apiError.category);
  const logData = {
    requestId,
    category: apiError.category,
    code: apiError.code,
    message: apiError.message,
    statusCode: apiError.statusCode,
    url: request.url,
    method: request.method,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    userId: (request as any).user?.id,
    details: apiError.details,
    field: apiError.field,
    stack: apiError.stack,
  };
  
  // Don't log stack traces for operational errors in production
  if (process.env.NODE_ENV === 'production' && apiError.isOperational) {
    delete logData.stack;
  }
  
  logger[logLevel](logData, `${apiError.category.toUpperCase()}: ${apiError.message}`);
  
  // Set status code
  reply.status(apiError.statusCode);
  
  // Add rate limit headers if applicable
  if (apiError.category === ErrorCategory.RATE_LIMIT) {
    const resetTime = Math.ceil(Date.now() / 1000) + 60; // 1 minute from now
    reply.header('X-RateLimit-Limit', rateLimitLimitFromDetails(apiError.details));
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', resetTime);
    reply.header('Retry-After', 60);
  }
  
  // Add security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  
  return errorResponse;
}

function getLogLevelForCategory(category: ErrorCategory): 'error' | 'warn' | 'info' {
  switch (category) {
    case ErrorCategory.VALIDATION:
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.AUTHORIZATION:
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.BUSINESS_LOGIC:
    case ErrorCategory.RATE_LIMIT:
      return 'warn';
    case ErrorCategory.EXTERNAL_SERVICE:
    case ErrorCategory.DATABASE:
    case ErrorCategory.INTERNAL:
      return 'error';
    default:
      return 'error';
  }
}

// Async error wrapper utility
export function asyncHandler<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) {
  return (...args: T): Promise<R> => {
    return Promise.resolve(fn(...args)).catch(error => {
      throw convertToApiError(error);
    });
  };
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ExternalServiceError(
          'CircuitBreaker',
          'Service temporarily unavailable'
        );
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
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
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
      
      // Don't retry for certain error types
      if (error instanceof ValidationError ||
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError ||
          error instanceof NotFoundError) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export default enhancedErrorHandler;
