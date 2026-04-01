/**
 * Authentication Middleware
 * 
 * Essential auth middleware that AI agents often miss
 * Handles JWT, session validation, and role-based access
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
}

/**
 * JWT Authentication Middleware
 */
export const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        code: 'SERVER_ERROR',
      });
    }

    try {
      const decoded = jwt.verify(token, secret) as any;
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional Authentication (doesn't fail if no token)
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET;

      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as any;
          req.user = decoded;
        } catch (error) {
          // Silently fail for optional auth
        }
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Role-Based Access Control
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

/**
 * Admin Only Middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Owner or Admin Check
 */
export const requireOwnerOrAdmin = (userIdParam: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const isOwner = req.user.id === req.params[userIdParam];
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

