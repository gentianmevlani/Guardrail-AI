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
export declare enum ApiErrorCode {
    VALIDATION_FAILED = "VALIDATION_FAILED",
    INVALID_INPUT = "INVALID_INPUT",
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
    INVALID_FORMAT = "INVALID_FORMAT",
    UNAUTHORIZED = "UNAUTHORIZED",
    INVALID_TOKEN = "INVALID_TOKEN",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_REVOKED = "TOKEN_REVOKED",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    FORBIDDEN = "FORBIDDEN",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
    NOT_FOUND = "NOT_FOUND",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    ENDPOINT_NOT_FOUND = "ENDPOINT_NOT_FOUND",
    CONFLICT = "CONFLICT",
    DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",
    RESOURCE_LOCKED = "RESOURCE_LOCKED",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED",
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE",
    INVALID_PLAN = "INVALID_PLAN"
}
export declare const ErrorCodeToHttpStatus: Record<ApiErrorCode, number>;
export declare class ResponseBuilder {
    static success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T>;
    static error(code: ApiErrorCode, message: string, details?: unknown, field?: string): ApiResponse;
    static paginated<T>(data: T[], pagination: PaginationMeta, meta?: Partial<ResponseMeta>): ApiResponse<T[]>;
}
//# sourceMappingURL=api-responses.d.ts.map