/**
 * Request ID Middleware
 * 
 * Essential for debugging - AI agents often miss this
 * Adds unique ID to every request for tracking
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  id?: string;
}

/**
 * Add unique request ID to every request
 */
export const requestIdMiddleware = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const requestId = randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

