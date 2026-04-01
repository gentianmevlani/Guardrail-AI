"use strict";
/**
 * Standardized API Response Types
 * Ensures consistent response format across all endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilder = exports.ErrorCodeToHttpStatus = exports.ApiErrorCode = void 0;
// Error codes enumeration
var ApiErrorCode;
(function (ApiErrorCode) {
    // Validation (400)
    ApiErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ApiErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ApiErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ApiErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    // Authentication (401)
    ApiErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ApiErrorCode["INVALID_TOKEN"] = "INVALID_TOKEN";
    ApiErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ApiErrorCode["TOKEN_REVOKED"] = "TOKEN_REVOKED";
    ApiErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    // Authorization (403)
    ApiErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ApiErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    ApiErrorCode["ACCOUNT_SUSPENDED"] = "ACCOUNT_SUSPENDED";
    // Not Found (404)
    ApiErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ApiErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ApiErrorCode["ENDPOINT_NOT_FOUND"] = "ENDPOINT_NOT_FOUND";
    // Conflict (409)
    ApiErrorCode["CONFLICT"] = "CONFLICT";
    ApiErrorCode["DUPLICATE_RESOURCE"] = "DUPLICATE_RESOURCE";
    ApiErrorCode["RESOURCE_LOCKED"] = "RESOURCE_LOCKED";
    // Rate Limiting (429)
    ApiErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ApiErrorCode["TOO_MANY_REQUESTS"] = "TOO_MANY_REQUESTS";
    // Server Errors (500)
    ApiErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ApiErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ApiErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ApiErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    // Business Logic
    ApiErrorCode["SUBSCRIPTION_REQUIRED"] = "SUBSCRIPTION_REQUIRED";
    ApiErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    ApiErrorCode["FEATURE_NOT_AVAILABLE"] = "FEATURE_NOT_AVAILABLE";
    ApiErrorCode["INVALID_PLAN"] = "INVALID_PLAN";
})(ApiErrorCode || (exports.ApiErrorCode = ApiErrorCode = {}));
// HTTP Status Code Mapping
exports.ErrorCodeToHttpStatus = {
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
class ResponseBuilder {
    static success(data, meta) {
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
    static error(code, message, details, field) {
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
    static paginated(data, pagination, meta) {
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
exports.ResponseBuilder = ResponseBuilder;
