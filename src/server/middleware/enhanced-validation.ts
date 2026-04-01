/**
 * Enhanced Input Validation Middleware for Express
 * 
 * Provides comprehensive request validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  files?: boolean; // Enable file validation
}

/**
 * Validation middleware factory
 */
export function validateInput(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (options.body) {
        const validatedBody = options.body.parse(req.body);
        req.body = validatedBody;
      }

      // Validate query parameters
      if (options.query) {
        const validatedQuery = options.query.parse(req.query);
        req.query = validatedQuery;
      }

      // Validate route parameters
      if (options.params) {
        const validatedParams = options.params.parse(req.params);
        req.params = validatedParams;
      }

      // Validate headers
      if (options.headers) {
        const validatedHeaders = options.headers.parse(req.headers);
        req.headers = validatedHeaders;
      }

      // Validate files if present
      if (options.files && req.file) {
        validateFile(req.file);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'INVALID_INPUT'
      });
    }
  };
}

/**
 * Validate uploaded file
 */
function validateFile(file: any): void {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/pdf',
    'application/json',
    'application/xml'
  ];

  if (file.size > maxSize) {
    throw new Error('File size exceeds limit');
  }

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }
}

/**
 * Common validation schemas
 */
export const schemas = {
  // UUID parameter validation
  uuidParam: {
    id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' }
  },

  // Pagination query validation
  pagination: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 }
  },

  // Date range validation
  dateRange: {
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' }
  },

  // Email validation
  email: { type: 'string', format: 'email' },

  // Password validation
  password: { 
    type: 'string', 
    minLength: 8,
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$'
  },

  // Project validation
  createProject: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      path: { type: 'string' },
      repositoryUrl: { type: 'string', format: 'uri' }
    }
  },

  updateProject: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      path: { type: 'string' },
      repositoryUrl: { type: 'string', format: 'uri' }
    }
  },

  // User registration validation
  register: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$'
      },
      name: { type: 'string', minLength: 1, maxLength: 100 }
    }
  },

  // User login validation
  login: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 }
    }
  },

  // Password change validation
  changePassword: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1 },
      newPassword: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$'
      }
    }
  },

  // Code analysis validation
  analyzeCode: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', minLength: 1 },
      filename: { type: 'string' },
      experienceLevel: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }
    }
  },

  // AI question validation
  askQuestion: {
    type: 'object',
    required: ['code', 'question'],
    properties: {
      code: { type: 'string', minLength: 1 },
      question: { type: 'string', minLength: 1 },
      provider: { type: 'string', enum: ['openai', 'anthropic'] }
    }
  },

  // Search validation
  searchQuery: {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
    }
  },

  // Directory path validation
  directoryPath: {
    type: 'object',
    required: ['directory'],
    properties: {
      directory: { type: 'string', minLength: 1 }
    }
  },

  // Usage tracking validation
  trackUsage: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', minLength: 1 },
      projectId: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' },
      metadata: { type: 'object' }
    }
  }
};

/**
 * Sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Sanitize string fields in body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential XSS attacks
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * SQL injection prevention middleware
 */
export function preventSqlInjection(req: Request, res: Response, next: NextFunction): void {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|;|'|"/gi,
    /(\bOR\b.*=.*\bOR\b)/gi,
    /(\bAND\b.*=.*\bAND\b)/gi
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    res.status(400).json({
      success: false,
      error: 'Invalid input detected',
      code: 'INVALID_INPUT'
    });
    return;
  }

  next();
}

/**
 * XSS prevention middleware
 */
export function preventXSS(req: Request, res: Response, next: NextFunction): void {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]*src[^>]*javascript:/gi
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query)) {
    res.status(400).json({
      success: false,
      error: 'Potentially dangerous content detected',
      code: 'XSS_DETECTED'
    });
    return;
  }

  next();
}
