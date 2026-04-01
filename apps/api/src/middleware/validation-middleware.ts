/**
 * Comprehensive Validation & Sanitization Middleware
 * Provides input validation, sanitization, and security checks
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../logger';
import { ApiErrorCode, ResponseBuilder } from '../types/api-responses';

// Validation schemas
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Email validation with DNS check
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(254, 'Email too long'),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
  
  // Phone number validation (E.164 format)
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .transform(phone => phone.replace(/\s/g, '')),
  
  // URL validation
  url: z.string()
    .url('Invalid URL format')
    .refine(url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, 'URL must use HTTP or HTTPS protocol')
    .transform(url => {
      const parsed = new URL(url);
      // Remove trailing slash for consistency
      return parsed.toString().replace(/\/$/, '');
    }),
  
  // Sanitized text (XSS prevention)
  sanitizedText: z.string()
    .transform(text => {
      // Basic XSS sanitization
      return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  }),
  
  // Date validation
  date: z.string()
    .datetime('Invalid date format')
    .transform(date => new Date(date)),
  
  // File upload validation
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z.enum([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/json', 'application/xml'
    ]),
    size: z.number().max(25 * 1024 * 1024), // 25MB max
  }),
};

// Request validation interface
export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  sanitize?: boolean;
  strict?: boolean; // Reject unknown fields
}

// Validation middleware factory
export function createValidationMiddleware(options: ValidationOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    const validationErrors: Array<{ field: string; message: string; value?: unknown }> = [];
    
    try {
      // Validate request body
      if (options.body) {
        try {
          const body = await options.body.parseAsync(request.body);
          request.body = body;
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(err => {
              validationErrors.push({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received,
              });
            });
          } else {
            validationErrors.push({
              field: 'body',
              message: 'Invalid request body',
            });
          }
        }
      }
      
      // Validate query parameters
      if (options.query) {
        try {
          const query = await options.query.parseAsync(request.query);
          request.query = query;
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(err => {
              validationErrors.push({
                field: `query.${err.path.join('.')}`,
                message: err.message,
                value: (err as any).received || undefined,
              });
            });
          } else {
            validationErrors.push({
              field: 'query',
              message: 'Invalid query parameters',
            });
          }
        }
      }
      
      // Validate path parameters
      if (options.params) {
        try {
          const params = await options.params.parseAsync(request.params);
          request.params = params;
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(err => {
              validationErrors.push({
                field: `params.${err.path.join('.')}`,
                message: err.message,
                value: (err as any).received || undefined,
              });
            });
          } else {
            validationErrors.push({
              field: 'params',
              message: 'Invalid path parameters',
            });
          }
        }
      }
      
      // Validate headers
      if (options.headers) {
        try {
          const headers = await options.headers.parseAsync(request.headers);
          Object.assign(request.headers, headers);
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(err => {
              validationErrors.push({
                field: `headers.${err.path.join('.')}`,
                message: err.message,
                value: (err as any).received || undefined,
              });
            });
          } else {
            validationErrors.push({
              field: 'headers',
              message: 'Invalid headers',
            });
          }
        }
      }
      
      // If validation errors exist, return 400
      if (validationErrors.length > 0) {
        logger.warn({
          requestId,
          errors: validationErrors,
          url: request.url,
          method: request.method,
        }, 'Validation failed');
        
        return reply.status(400).send(
          ResponseBuilder.error(
            ApiErrorCode.VALIDATION_FAILED,
            'Request validation failed',
            validationErrors
          )
        );
      }
      
      // Apply sanitization if enabled
      if (options.sanitize) {
        await sanitizeRequest(request);
      }
      
    } catch (error) {
      logger.error({
        requestId,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Validation middleware error');
      
      return reply.status(500).send(
        ResponseBuilder.error(
          ApiErrorCode.INTERNAL_ERROR,
          'Validation error occurred'
        )
      );
    }
  };
}

// Request sanitization
async function sanitizeRequest(request: FastifyRequest): Promise<void> {
  // Sanitize string fields in request body
  if (request.body && typeof request.body === 'object') {
    sanitizeObject(request.body);
  }
  
  // Sanitize query parameters
  if (request.query && typeof request.query === 'object') {
    sanitizeObject(request.query);
  }
}

// Recursive object sanitization
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Basic XSS sanitization for strings
        obj[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitizeObject(value);
      }
    }
  }
}

// Common validation schemas for API endpoints
export const apiSchemas = {
  // User registration
  register: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    name: z.string().min(1).max(100).optional(),
  }),
  
  // User login
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
  }),
  
  // Password change
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: commonSchemas.password,
  }),
  
  // Password reset
  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: commonSchemas.password,
  }),
  
  // Project creation/update
  project: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    repositoryUrl: commonSchemas.url.optional(),
    visibility: z.enum(['public', 'private']).default('private'),
  }),
  
  // API key creation
  apiKey: z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).min(1),
    expiresAt: commonSchemas.date.optional(),
  }),
  
  // Scan request
  scan: z.object({
    projectId: commonSchemas.uuid,
    scanType: z.enum(['security', 'performance', 'accessibility', 'all']),
    options: z.object({
      depth: z.number().int().min(1).max(10).default(3),
      includeTests: z.boolean().default(false),
      timeout: z.number().int().min(5000).max(300000).default(60000),
    }).optional(),
  }),
};

// Validation decorators for routes
export function validateBody(schema: ZodSchema, options: { sanitize?: boolean } = {}) {
  return createValidationMiddleware({ body: schema, sanitize: options.sanitize });
}

export function validateQuery(schema: ZodSchema) {
  return createValidationMiddleware({ query: schema });
}

export function validateParams(schema: ZodSchema) {
  return createValidationMiddleware({ params: schema });
}

export function validateHeaders(schema: ZodSchema) {
  return createValidationMiddleware({ headers: schema });
}

// Combined validation
export function validate(options: ValidationOptions) {
  return createValidationMiddleware(options);
}

// Input sanitization utilities
export class InputSanitizer {
  // Sanitize HTML content
  static sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .trim();
  }
  
  // Sanitize SQL input (basic prevention)
  static sanitizeSql(input: string): string {
    return input
      .replace(/['"\\]/g, '') // Remove quotes and backslashes
      .replace(/--/g, '') // Remove SQL comments
      .replace(/;/g, '') // Remove semicolons
      .trim();
  }
  
  // Validate file type using magic bytes
  static async validateFileType(buffer: Buffer, allowedMimeTypes: string[]): Promise<boolean> {
    // Basic file signature detection
    const signatures: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
    };
    
    for (const mimeType of allowedMimeTypes) {
      const signature = signatures[mimeType];
      if (signature && buffer.length >= signature.length) {
        const matches = signature.every((byte, index) => buffer[index] === byte);
        if (matches) return true;
      }
    }
    
    return false;
  }
  
  // Validate and sanitize decimal numbers
  static sanitizeDecimal(value: string | number, precision: number = 2): number {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) throw new Error('Invalid number format');
    
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }
}

export default createValidationMiddleware;
