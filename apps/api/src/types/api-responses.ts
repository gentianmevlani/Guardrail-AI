/**
 * Standardized API Response Types
 * Ensures consistent response format across all endpoints
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  pagination?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  field?: string;
  timestamp: string;
  requestId?: string;
}

export interface ResponseMeta {
  version: string;
  timestamp: string;
  requestId: string;
  environment: string;
  processingTime?: number;
  rateLimit?: RateLimitInfo;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface ValidationError extends ApiError {
  field: string;
  value?: unknown;
  constraints: Record<string, string>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: Record<string, ServiceHealth>;
  checks: HealthCheck[];
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  output?: string;
  actions?: string[];
}

// Error codes enumeration
export enum ApiErrorCode {
  // Validation (400)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Authentication (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Authorization (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  
  // Not Found (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Conflict (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Server Errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Business Logic
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  INVALID_PLAN = 'INVALID_PLAN',
}

// HTTP Status Code Mapping
export const ErrorCodeToHttpStatus: Record<ApiErrorCode, number> = {
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

// Response builders
export class ResponseBuilder {
  static success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        requestId: '',
        environment: process.env.NODE_ENV || 'development',
        ...meta,
      },
    };
  }

  static error(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    field?: string
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        field,
        timestamp: new Date().toISOString(),
        requestId: '',
      },
      meta: {
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        requestId: '',
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      pagination,
      meta: {
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        requestId: '',
        environment: process.env.NODE_ENV || 'development',
        ...meta,
      },
    };
  }
}
