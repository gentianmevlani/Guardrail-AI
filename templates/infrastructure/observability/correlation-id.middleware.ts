/**
 * Correlation ID Middleware
 * 
 * Tracks requests across services for debugging
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createLogger } from './logger';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  log?: ReturnType<typeof createLogger>;
}

/**
 * Add correlation ID to requests
 */
export const correlationIdMiddleware = (
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
) => {
  // Get correlation ID from header or generate new one
  const incomingId = req.headers['x-correlation-id'] as string || randomUUID();
  req.correlationId = incomingId;

  // Set in response header
  res.setHeader('x-correlation-id', incomingId);

  // Create request-scoped logger
  req.log = createLogger(incomingId, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  next();
};

