/**
 * Request Size Limit Middleware
 * 
 * Enforces strict request size limits to prevent resource exhaustion
 * - Validates Content-Length header when present
 * - Applies tier-based upload limits
 * - Handles multipart upload constraints
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../logger';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface SizeLimitOptions {
  maxBodySize?: number; // Default global limit
  maxFileSize?: number; // Per-file limit for uploads
  maxFileCount?: number; // Max files per multipart request
  maxTotalMultipartSize?: number; // Total multipart size limit
}

interface TierLimits {
  maxFileSize: number;
  maxFileCount: number;
  maxTotalSize: number;
}

// Tier-based upload limits (in bytes)
const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxFileSize: 1 * 1024 * 1024, // 1MB
    maxFileCount: 1,
    maxTotalSize: 1 * 1024 * 1024, // 1MB
  },
  starter: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFileCount: 3,
    maxTotalSize: 10 * 1024 * 1024, // 10MB
  },
  pro: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxFileCount: 10,
    maxTotalSize: 100 * 1024 * 1024, // 100MB
  },
  compliance: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFileCount: 20,
    maxTotalSize: 250 * 1024 * 1024, // 250MB
  },
  enterprise: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFileCount: 50,
    maxTotalSize: 500 * 1024 * 1024, // 500MB
  },
};

// Default limits for unauthenticated requests
const DEFAULT_LIMITS: TierLimits = {
  maxFileSize: 1 * 1024 * 1024, // 1MB
  maxFileCount: 1,
  maxTotalSize: 1 * 1024 * 1024, // 1MB
};

/**
 * Get user tier from request (simplified - in production would use entitlements service)
 */
function getUserTier(request: FastifyRequest): string {
  // Check if user is authenticated
  if (!request.user) {
    return 'free';
  }
  
  // In production, this would check the user's subscription tier
  // For now, we'll use a simple role-based system
  const role = (request.user as any)?.role || 'member';
  
  switch (role) {
    case 'admin':
    case 'enterprise':
      return 'enterprise';
    case 'pro':
      return 'pro';
    case 'compliance':
      return 'compliance';
    case 'starter':
      return 'starter';
    default:
      return 'free';
  }
}

/**
 * Validate Content-Length header against limits
 */
function validateContentLength(
  request: FastifyRequest,
  maxBodySize: number
): { valid: boolean; error?: string } {
  const contentLength = request.headers['content-length'];
  
  if (!contentLength) {
    return { valid: true }; // No header, skip validation
  }
  
  const length = parseInt(contentLength, 10);
  
  if (isNaN(length)) {
    return { 
      valid: false, 
      error: 'Invalid Content-Length header format' 
    };
  }
  
  if (length > maxBodySize) {
    return { 
      valid: false, 
      error: `Request size ${length} bytes exceeds limit of ${maxBodySize} bytes` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate multipart upload constraints
 */
function validateMultipartUpload(
  request: FastifyRequest,
  limits: TierLimits
): { valid: boolean; error?: string } {
  // Check if this is a multipart request
  const contentType = request.headers['content-type'];
  
  if (!contentType?.includes('multipart/form-data')) {
    return { valid: true }; // Not multipart, skip validation
  }
  
  // In a real implementation, we would parse the multipart data here
  // For now, we'll do basic validation based on Content-Length
  
  const contentLength = request.headers['content-length'];
  if (!contentLength) {
    return { valid: true }; // No size info to validate
  }
  
  const totalSize = parseInt(contentLength, 10);
  
  if (totalSize > limits.maxTotalSize) {
    return {
      valid: false,
      error: `Multipart request size ${totalSize} bytes exceeds tier limit of ${limits.maxTotalSize} bytes`
    };
  }
  
  return { valid: true };
}

/**
 * Create request size limit middleware
 */
export function createSizeLimitMiddleware(options: SizeLimitOptions = {}) {
  const {
    maxBodySize = 10 * 1024 * 1024, // 10MB default global limit
    maxFileSize = 5 * 1024 * 1024, // 5MB default per-file
    maxFileCount = 5,
    maxTotalMultipartSize = 25 * 1024 * 1024, // 25MB default multipart
  } = options;
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Validate Content-Length header
      const contentLengthValidation = validateContentLength(request, maxBodySize);
      if (!contentLengthValidation.valid) {
        logger.warn(
          { 
            ip: request.ip,
            method: request.method,
            url: request.url,
            contentLength: request.headers['content-length'],
            limit: maxBodySize
          },
          'Request rejected due to Content-Length limit'
        );
        
        return reply.status(413).send({
          success: false,
          error: 'Payload Too Large',
          message: contentLengthValidation.error,
          code: 'PAYLOAD_TOO_LARGE'
        });
      }
      
      // 2. For upload routes, apply tier-based limits
      if (request.url.includes('/upload') || request.url.includes('/avatar')) {
        const userTier = getUserTier(request);
        const tierLimits = TIER_LIMITS[userTier] || DEFAULT_LIMITS;
        
        // Validate multipart constraints
        const multipartValidation = validateMultipartUpload(request, tierLimits);
        if (!multipartValidation.valid) {
          logger.warn(
            { 
              ip: request.ip,
              method: request.method,
              url: request.url,
              userTier,
              contentLength: request.headers['content-length'],
              limit: tierLimits.maxTotalSize
            },
            'Upload rejected due to tier limit'
          );
          
          return reply.status(413).send({
            success: false,
            error: 'Upload Too Large',
            message: multipartValidation.error,
            code: 'UPLOAD_TOO_LARGE',
            limits: {
              maxFileSize: tierLimits.maxFileSize,
              maxFileCount: tierLimits.maxFileCount,
              maxTotalSize: tierLimits.maxTotalSize
            }
          });
        }
      }
      
      // Add size limit info to request for downstream handlers
      (request as any).sizeLimits = {
        maxBodySize,
        maxFileSize,
        maxFileCount,
        maxTotalMultipartSize
      };
      
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Size limit middleware error');
      
      // Fail open - allow request but log error
      // In production, you might want to fail closed instead
    }
  };
}

/**
 * Middleware specifically for upload routes with enhanced validation
 */
export function createUploadLimitMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userTier = getUserTier(request);
    const limits = TIER_LIMITS[userTier] || DEFAULT_LIMITS;
    
    // Store limits for use in route handlers
    (request as any).uploadLimits = limits;
    
    logger.debug(
      { 
        userTier,
        limits,
        url: request.url
      },
      'Upload limits applied'
    );
  };
}

/**
 * Helper function to get tier limits for a user
 */
export function getTierLimits(userTier: string): TierLimits {
  return TIER_LIMITS[userTier] || DEFAULT_LIMITS;
}

/**
 * Helper function to validate file size against tier limits
 */
export function validateFileSize(fileSize: number, userTier: string): { valid: boolean; error?: string } {
  const limits = getTierLimits(userTier);
  
  if (fileSize > limits.maxFileSize) {
    return {
      valid: false,
      error: `File size ${fileSize} bytes exceeds tier limit of ${limits.maxFileSize} bytes`
    };
  }
  
  return { valid: true };
}
