"use strict";
/**
 * Enhanced Error Handling Middleware
 * Provides comprehensive error handling with proper status codes,
 * logging, and error correlation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.RateLimitError = exports.DatabaseError = exports.ExternalServiceError = exports.BusinessLogicError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ApiError = exports.ErrorCategory = void 0;
exports.enhancedErrorHandler = enhancedErrorHandler;
exports.asyncHandler = asyncHandler;
exports.retryWithBackoff = retryWithBackoff;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const logger_1 = require("../logger");
const api_responses_1 = require("../types/api-responses");
// Error classification
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["AUTHENTICATION"] = "authentication";
    ErrorCategory["AUTHORIZATION"] = "authorization";
    ErrorCategory["NOT_FOUND"] = "not_found";
    ErrorCategory["BUSINESS_LOGIC"] = "business_logic";
    ErrorCategory["EXTERNAL_SERVICE"] = "external_service";
    ErrorCategory["DATABASE"] = "database";
    ErrorCategory["INTERNAL"] = "internal";
    ErrorCategory["RATE_LIMIT"] = "rate_limit";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
// Custom error classes
class ApiError extends Error {
    code;
    statusCode;
    category;
    details;
    field;
    isOperational;
    constructor(code, message, category, details, field) {
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
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(message, field, details) {
        super(api_responses_1.ApiErrorCode.VALIDATION_FAILED, message, ErrorCategory.VALIDATION, details, field);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends ApiError {
    constructor(message = 'Authentication failed') {
        super(api_responses_1.ApiErrorCode.UNAUTHORIZED, message, ErrorCategory.AUTHENTICATION);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ApiError {
    constructor(message = 'Insufficient permissions') {
        super(api_responses_1.ApiErrorCode.FORBIDDEN, message, ErrorCategory.AUTHORIZATION);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(api_responses_1.ApiErrorCode.NOT_FOUND, `${resource} not found`, ErrorCategory.NOT_FOUND);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class BusinessLogicError extends ApiError {
    constructor(code, message, details) {
        super(code, message, ErrorCategory.BUSINESS_LOGIC, details);
        this.name = 'BusinessLogicError';
    }
}
exports.BusinessLogicError = BusinessLogicError;
class ExternalServiceError extends ApiError {
    constructor(service, message, details) {
        super(api_responses_1.ApiErrorCode.EXTERNAL_SERVICE_ERROR, `${service} service error: ${message}`, ErrorCategory.EXTERNAL_SERVICE, details);
        this.name = 'ExternalServiceError';
    }
}
exports.ExternalServiceError = ExternalServiceError;
class DatabaseError extends ApiError {
    constructor(message, details) {
        super(api_responses_1.ApiErrorCode.DATABASE_ERROR, `Database error: ${message}`, ErrorCategory.DATABASE, details);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class RateLimitError extends ApiError {
    constructor(limit, windowMs) {
        super(api_responses_1.ApiErrorCode.RATE_LIMIT_EXCEEDED, `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`, ErrorCategory.RATE_LIMIT, { limit, windowMs });
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
// Error code to HTTP status code mapping
function getStatusCodeFromErrorCode(code) {
    const codeMap = {
        [api_responses_1.ApiErrorCode.VALIDATION_FAILED]: 400,
        [api_responses_1.ApiErrorCode.INVALID_INPUT]: 400,
        [api_responses_1.ApiErrorCode.MISSING_REQUIRED_FIELD]: 400,
        [api_responses_1.ApiErrorCode.INVALID_FORMAT]: 400,
        [api_responses_1.ApiErrorCode.UNAUTHORIZED]: 401,
        [api_responses_1.ApiErrorCode.INVALID_TOKEN]: 401,
        [api_responses_1.ApiErrorCode.TOKEN_EXPIRED]: 401,
        [api_responses_1.ApiErrorCode.TOKEN_REVOKED]: 401,
        [api_responses_1.ApiErrorCode.INVALID_CREDENTIALS]: 401,
        [api_responses_1.ApiErrorCode.FORBIDDEN]: 403,
        [api_responses_1.ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
        [api_responses_1.ApiErrorCode.ACCOUNT_SUSPENDED]: 403,
        [api_responses_1.ApiErrorCode.NOT_FOUND]: 404,
        [api_responses_1.ApiErrorCode.RESOURCE_NOT_FOUND]: 404,
        [api_responses_1.ApiErrorCode.ENDPOINT_NOT_FOUND]: 404,
        [api_responses_1.ApiErrorCode.CONFLICT]: 409,
        [api_responses_1.ApiErrorCode.DUPLICATE_RESOURCE]: 409,
        [api_responses_1.ApiErrorCode.RESOURCE_LOCKED]: 409,
        [api_responses_1.ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,
        [api_responses_1.ApiErrorCode.TOO_MANY_REQUESTS]: 429,
        [api_responses_1.ApiErrorCode.INTERNAL_ERROR]: 500,
        [api_responses_1.ApiErrorCode.DATABASE_ERROR]: 500,
        [api_responses_1.ApiErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
        [api_responses_1.ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
        [api_responses_1.ApiErrorCode.SUBSCRIPTION_REQUIRED]: 402,
        [api_responses_1.ApiErrorCode.QUOTA_EXCEEDED]: 429,
        [api_responses_1.ApiErrorCode.FEATURE_NOT_AVAILABLE]: 403,
        [api_responses_1.ApiErrorCode.INVALID_PLAN]: 400,
    };
    return codeMap[code] || 500;
}
// Error classification utility
function classifyError(error) {
    if (error instanceof ValidationError)
        return ErrorCategory.VALIDATION;
    if (error instanceof AuthenticationError)
        return ErrorCategory.AUTHENTICATION;
    if (error instanceof AuthorizationError)
        return ErrorCategory.AUTHORIZATION;
    if (error instanceof NotFoundError)
        return ErrorCategory.NOT_FOUND;
    if (error instanceof BusinessLogicError)
        return ErrorCategory.BUSINESS_LOGIC;
    if (error instanceof ExternalServiceError)
        return ErrorCategory.EXTERNAL_SERVICE;
    if (error instanceof DatabaseError)
        return ErrorCategory.DATABASE;
    if (error instanceof RateLimitError)
        return ErrorCategory.RATE_LIMIT;
    // Built-in error types
    if (error instanceof zod_1.ZodError)
        return ErrorCategory.VALIDATION;
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError)
        return ErrorCategory.DATABASE;
    if (error instanceof client_1.Prisma.PrismaClientUnknownRequestError)
        return ErrorCategory.DATABASE;
    if (error instanceof client_1.Prisma.PrismaClientRustPanicError)
        return ErrorCategory.DATABASE;
    if (error instanceof client_1.Prisma.PrismaClientInitializationError)
        return ErrorCategory.DATABASE;
    if (error instanceof client_1.Prisma.PrismaClientValidationError)
        return ErrorCategory.VALIDATION;
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
function convertToApiError(error) {
    if (error instanceof ApiError) {
        return error;
    }
    if (error instanceof zod_1.ZodError) {
        return new ValidationError('Request validation failed', undefined, error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
        })));
    }
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        const prismaError = error;
        switch (prismaError.code) {
            case 'P2002':
                return new BusinessLogicError(api_responses_1.ApiErrorCode.DUPLICATE_RESOURCE, 'Resource already exists', { field: prismaError.meta?.target });
            case 'P2025':
                return new NotFoundError('Record');
            case 'P2003':
                return new ValidationError('Foreign key constraint failed');
            default:
                return new DatabaseError(`Database constraint error: ${prismaError.message}`);
        }
    }
    if (error instanceof client_1.Prisma.PrismaClientValidationError) {
        return new ValidationError('Database validation failed', undefined, error.message);
    }
    // Generic error conversion
    const category = classifyError(error);
    const statusCode = getDefaultStatusCodeForCategory(category);
    return new ApiError(getDefaultErrorCodeForCategory(category), error.message || 'An error occurred', category, error.stack);
}
function getDefaultStatusCodeForCategory(category) {
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
function getDefaultErrorCodeForCategory(category) {
    switch (category) {
        case ErrorCategory.VALIDATION: return api_responses_1.ApiErrorCode.VALIDATION_FAILED;
        case ErrorCategory.AUTHENTICATION: return api_responses_1.ApiErrorCode.UNAUTHORIZED;
        case ErrorCategory.AUTHORIZATION: return api_responses_1.ApiErrorCode.FORBIDDEN;
        case ErrorCategory.NOT_FOUND: return api_responses_1.ApiErrorCode.NOT_FOUND;
        case ErrorCategory.BUSINESS_LOGIC: return api_responses_1.ApiErrorCode.INVALID_INPUT;
        case ErrorCategory.RATE_LIMIT: return api_responses_1.ApiErrorCode.RATE_LIMIT_EXCEEDED;
        case ErrorCategory.EXTERNAL_SERVICE: return api_responses_1.ApiErrorCode.EXTERNAL_SERVICE_ERROR;
        case ErrorCategory.DATABASE: return api_responses_1.ApiErrorCode.DATABASE_ERROR;
        default: return api_responses_1.ApiErrorCode.INTERNAL_ERROR;
    }
}
// Enhanced error handler middleware
async function enhancedErrorHandler(error, request, reply) {
    const requestId = request.id;
    const startTime = Date.now();
    // Convert error to ApiError
    const apiError = convertToApiError(error);
    // Prepare error response
    const errorResponse = api_responses_1.ResponseBuilder.error(apiError.code, apiError.message, apiError.details, apiError.field);
    // Set request ID in response
    errorResponse.error.requestId = requestId;
    errorResponse.meta.requestId = requestId;
    errorResponse.meta.processingTime = Date.now() - startTime;
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
        userId: request.user?.id,
        details: apiError.details,
        field: apiError.field,
        stack: apiError.stack,
    };
    // Don't log stack traces for operational errors in production
    if (process.env.NODE_ENV === 'production' && apiError.isOperational) {
        delete logData.stack;
    }
    logger_1.logger[logLevel](logData, `${apiError.category.toUpperCase()}: ${apiError.message}`);
    // Set status code
    reply.status(apiError.statusCode);
    // Add rate limit headers if applicable
    if (apiError.category === ErrorCategory.RATE_LIMIT) {
        const resetTime = Math.ceil(Date.now() / 1000) + 60; // 1 minute from now
        reply.header('X-RateLimit-Limit', apiError.details?.limit || 60);
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
function getLogLevelForCategory(category) {
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
function asyncHandler(fn) {
    return (...args) => {
        return Promise.resolve(fn(...args)).catch(error => {
            throw convertToApiError(error);
        });
    };
}
// Circuit breaker for external services
class CircuitBreaker {
    threshold;
    timeout;
    failures = 0;
    lastFailureTime = 0;
    state = 'CLOSED';
    constructor(threshold = 5, timeout = 60000 // 1 minute
    ) {
        this.threshold = threshold;
        this.timeout = timeout;
    }
    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new ExternalServiceError('CircuitBreaker', 'Service temporarily unavailable');
            }
        }
        try {
            const result = await operation();
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failures = 0;
            }
            return result;
        }
        catch (error) {
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
exports.CircuitBreaker = CircuitBreaker;
// Retry utility with exponential backoff
async function retryWithBackoff(operation, maxAttempts = 3, baseDelay = 1000, maxDelay = 10000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
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
    throw lastError;
}
exports.default = enhancedErrorHandler;
