/**
 * Enhanced Error Handling Middleware
 * Provides comprehensive error handling with proper status codes,
 * logging, and error correlation
 */
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ApiErrorCode, ApiResponse } from '../types/api-responses';
export declare enum ErrorCategory {
    VALIDATION = "validation",
    AUTHENTICATION = "authentication",
    AUTHORIZATION = "authorization",
    NOT_FOUND = "not_found",
    BUSINESS_LOGIC = "business_logic",
    EXTERNAL_SERVICE = "external_service",
    DATABASE = "database",
    INTERNAL = "internal",
    RATE_LIMIT = "rate_limit"
}
export declare class ApiError extends Error {
    readonly code: ApiErrorCode;
    readonly statusCode: number;
    readonly category: ErrorCategory;
    readonly details?: unknown;
    readonly field?: string;
    readonly isOperational: boolean;
    constructor(code: ApiErrorCode, message: string, category: ErrorCategory, details?: unknown, field?: string);
}
export declare class ValidationError extends ApiError {
    constructor(message: string, field?: string, details?: unknown);
}
export declare class AuthenticationError extends ApiError {
    constructor(message?: string);
}
export declare class AuthorizationError extends ApiError {
    constructor(message?: string);
}
export declare class NotFoundError extends ApiError {
    constructor(resource?: string);
}
export declare class BusinessLogicError extends ApiError {
    constructor(code: ApiErrorCode, message: string, details?: unknown);
}
export declare class ExternalServiceError extends ApiError {
    constructor(service: string, message: string, details?: unknown);
}
export declare class DatabaseError extends ApiError {
    constructor(message: string, details?: unknown);
}
export declare class RateLimitError extends ApiError {
    constructor(limit: number, windowMs: number);
}
export declare function enhancedErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse>;
export declare function asyncHandler<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R>;
export declare class CircuitBreaker {
    private readonly threshold;
    private readonly timeout;
    private failures;
    private lastFailureTime;
    private state;
    constructor(threshold?: number, timeout?: number);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    getState(): {
        state: "CLOSED" | "OPEN" | "HALF_OPEN";
        failures: number;
        lastFailureTime: number;
    };
}
export declare function retryWithBackoff<T>(operation: () => Promise<T>, maxAttempts?: number, baseDelay?: number, maxDelay?: number): Promise<T>;
export default enhancedErrorHandler;
//# sourceMappingURL=enhanced-error-handler.d.ts.map