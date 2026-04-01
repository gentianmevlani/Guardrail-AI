/**
 * Async Handler Middleware
 * 
 * Essential for handling async route handlers
 * Prevents unhandled promise rejections
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Wrap async route handlers to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

