/**
 * Error Handling Middleware
 * 
 * Essential error handling that AI agents often miss
 * Standardized error responses and logging
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError } from 'jsonwebtoken';
import { logger } from '../utils/logger.util';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Custom Error Class
 */
export class CustomError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler Middleware
 */
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error('Request error', err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id,
    requestId: (req as any).id,
  });

  // Handle known error types
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Handle database errors
  if ((err as any).code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if ((err as any).code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Invalid reference',
      code: 'INVALID_REFERENCE',
    });
  }

  // Default error response
  const statusCode = (err as AppError).statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: (err as AppError).code || 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack }),
  });
};

/**
 * 404 Handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
};

// Async handler moved to async.middleware.ts

