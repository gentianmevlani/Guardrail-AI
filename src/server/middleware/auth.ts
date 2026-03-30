/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and attaches user to request.
 */

import { Request, Response, NextFunction } from 'express';
import { authService, UserResponse } from '../services/auth-service';

export interface AuthenticatedRequest extends Request {
  user?: UserResponse;
  token?: string;
}

/**
 * Middleware to verify JWT token
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await authService.verifyToken(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token, but attaches user if present
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const user = await authService.verifyToken(token);
      
      if (user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

/**
 * Require specific subscription tier
 */
export function requireTier(allowedTiers: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get user subscription from database
    const { databaseService } = await import('../services/database-service');
    const subscription = await databaseService.getUserSubscription(req.user.id);

    if (!subscription || !allowedTiers.includes(subscription.tier)) {
      res.status(403).json({ 
        error: 'Subscription required',
        message: `This feature requires one of these tiers: ${allowedTiers.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiting per user
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const key = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    
    const current = rateLimitMap.get(key);
    
    if (!current || now > current.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((current.resetAt - now) / 1000),
      });
      return;
    }

    current.count++;
    next();
  };
}
